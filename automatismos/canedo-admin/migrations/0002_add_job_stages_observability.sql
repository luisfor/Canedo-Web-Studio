-- Migración 0002: Observabilidad y Seguimiento por Etapas de Trabajos Asíncronos
-- Fecha: 2026-11-15
-- Propósito: Registrar etapas, timestamps, palabras y diagnóstico técnico/editorial por cada job en D1

-- 1. Ampliación defensiva de admin_pending_jobs con columnas de etapa y métricas
ALTER TABLE admin_pending_jobs ADD COLUMN current_stage TEXT DEFAULT 'queued';
ALTER TABLE admin_pending_jobs ADD COLUMN stage_updated_at TEXT DEFAULT NULL;
ALTER TABLE admin_pending_jobs ADD COLUMN word_count INTEGER DEFAULT 0;
ALTER TABLE admin_pending_jobs ADD COLUMN stage_details_json TEXT DEFAULT NULL;

-- 2. Tabla granular de eventos de observabilidad por trabajo (Historial de etapas)
CREATE TABLE IF NOT EXISTS admin_job_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  duration_ms INTEGER,
  word_count INTEGER,
  error_type TEXT,                         -- 'NONE' | 'TECHNICAL_WORKERS_AI' | 'QUALITY_GATE_LENGTH' | 'QUALITY_GATE_EDITORIAL' | 'TIMEOUT'
  details_json TEXT,                       -- Detalles concisos (sin secretos ni textos enteros)
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_job_events_job ON admin_job_events(job_id, created_at);

