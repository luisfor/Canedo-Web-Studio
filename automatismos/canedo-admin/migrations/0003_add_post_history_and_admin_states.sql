-- Migración: 0003_add_post_history_and_admin_states.sql
-- Objetivo: Soporte de historial de cambios, despublicación, auditoría y rollback para artículos de blog_posts.

CREATE TABLE IF NOT EXISTS blog_post_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  tag TEXT NOT NULL,
  date TEXT NOT NULL,
  reading_time TEXT,
  cover_url TEXT,
  excerpt TEXT NOT NULL,
  content_json TEXT NOT NULL,
  status TEXT NOT NULL,
  modified_by TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'edit', 'unpublish', 'restore', 'rollback'
  change_summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_post_history_slug ON blog_post_history(post_slug);
CREATE INDEX IF NOT EXISTS idx_post_history_created ON blog_post_history(created_at DESC);

