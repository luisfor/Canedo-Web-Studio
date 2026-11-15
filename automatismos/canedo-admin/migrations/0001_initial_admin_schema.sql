-- Migración 0001: Tablas de Canedo Admin Unificado (Local D1)
-- Reversible: DROP TABLE IF EXISTS admin_audit_log; DROP TABLE IF EXISTS admin_pending_jobs; DROP TABLE IF EXISTS blog_manual_drafts; DROP TABLE IF EXISTS admin_telegram_updates;

-- 0. Deduplicación atómica de eventos de Telegram (Idempotencia en D1)
CREATE TABLE IF NOT EXISTS admin_telegram_updates (
  update_id INTEGER PRIMARY KEY,             -- ID único del update de Telegram
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 1. Tabla de borradores editoriales manuales creados vía Telegram
CREATE TABLE IF NOT EXISTS blog_manual_drafts (
  id TEXT PRIMARY KEY,                       -- UUID v4 o draft_<timestamp>
  topic_tema TEXT NOT NULL,                  -- Tema solicitado
  topic_angulo TEXT NOT NULL,                -- Ángulo editorial
  title TEXT NOT NULL,                       -- Título generado
  tag TEXT NOT NULL,                         -- Etiqueta (Estrategia, Chatbots, etc.)
  excerpt TEXT NOT NULL,                     -- Resumen gancho
  content_json TEXT NOT NULL,                -- Bloques editoriales en JSON
  brief_json TEXT NOT NULL,                  -- Brief editorial completo
  audit_json TEXT NOT NULL,                  -- Veredicto del Quality Gate
  word_count INTEGER NOT NULL,               -- Recuento determinista de palabras de cuerpo
  status TEXT NOT NULL DEFAULT 'draft',      -- 'draft' | 'approved' | 'published' | 'discarded' | 'failed'
  created_by_user_id TEXT NOT NULL,          -- Telegram User ID
  approved_by_user_id TEXT,                  -- Telegram User ID
  published_slug TEXT,                       -- Slug final si se publica
  published_at TEXT,                         -- Timestamp ISO
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blog_manual_drafts_status ON blog_manual_drafts(status);
CREATE INDEX IF NOT EXISTS idx_blog_manual_drafts_created_at ON blog_manual_drafts(created_at);

-- 2. Cola / Registro de trabajos asíncronos y recuperación de estados (Jobs)
CREATE TABLE IF NOT EXISTS admin_pending_jobs (
  id TEXT PRIMARY KEY,                       -- job_<timestamp>_<rand>
  job_type TEXT NOT NULL,                    -- 'blog_generate_draft' | 'blog_publish_approved'
  status TEXT NOT NULL DEFAULT 'queued',     -- 'queued' | 'processing' | 'completed' | 'failed'
  user_id TEXT NOT NULL,                     -- Telegram User ID solicitante
  chat_id TEXT NOT NULL,                     -- Telegram Chat ID
  message_id INTEGER,                        -- ID del mensaje de progreso a editar
  payload_json TEXT NOT NULL,                -- Parámetros de entrada
  result_json TEXT,                          -- Resultado final
  error_message TEXT,                        -- Mensaje de error si falla
  attempts INTEGER NOT NULL DEFAULT 0,       -- Intentos de ejecución
  locked_until TEXT,                         -- Mutex temporal (ISO)
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_jobs_status ON admin_pending_jobs(status, locked_until);

-- 3. Registro de auditoría y acciones sensibles
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,                     -- Telegram User ID
  username TEXT,                             -- @username opcional
  action TEXT NOT NULL,                      -- 'BLOG_DRAFT_REQUEST' | 'BLOG_DRAFT_APPROVE' | 'BLOG_DRAFT_DISCARD' | 'BLOG_DIRECT_PUBLISH'
  entity_id TEXT,                            -- ID del borrador o recurso
  details_json TEXT,                         -- Parámetros o contexto de la acción
  ip_address TEXT,                           -- IP del webhook
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_user ON admin_audit_log(user_id, action);

