-- Migración Inicial para el CRM del Sales Agent
-- Aislamiento de social-media-bot: estas tablas vivirán en canedostudio_sales_agent_db

CREATE TABLE IF NOT EXISTS leads (
  lead_id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  name TEXT,
  business_name TEXT,
  business_type TEXT,
  detected_need TEXT,
  main_problem TEXT,
  desired_result TEXT,
  service_interest TEXT, -- Guardado como JSON Array String
  urgency TEXT,
  lead_temperature TEXT,
  funnel_stage TEXT,
  human_required INTEGER DEFAULT 0, -- Booleano en SQLite (0 o 1)
  status TEXT DEFAULT 'ACTIVE',
  conversation_summary TEXT,
  handoff_status TEXT DEFAULT 'NOT_REQUIRED', -- NOT_REQUIRED, PENDING, NOTIFIED, ACKNOWLEDGED, CLOSED
  handoff_notified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform_user_id, channel)
);

CREATE TABLE IF NOT EXISTS conversations (
  conversation_id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT DEFAULT 'OPEN',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(lead_id) REFERENCES leads(lead_id)
);

CREATE TABLE IF NOT EXISTS messages (
  message_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  direction TEXT NOT NULL, -- INBOUND | OUTBOUND
  role TEXT NOT NULL, -- USER | ASSISTANT | SYSTEM
  content TEXT NOT NULL,
  message_type TEXT NOT NULL, -- TEXT | COMMENT | DM | IMAGE | AUDIO | OTHER
  provider_message_id TEXT, -- ID provisto por Meta
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(conversation_id) REFERENCES conversations(conversation_id),
  FOREIGN KEY(lead_id) REFERENCES leads(lead_id)
);

CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL, -- RECEIVED | PROCESSING | RESPONDED | FAILED | IGNORED
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  error_message TEXT,
  UNIQUE(provider_event_id, channel)
);

CREATE INDEX idx_leads_platform ON leads(platform_user_id, channel);
CREATE INDEX idx_conversations_lead ON conversations(lead_id, status);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_processed_events_provider ON processed_events(provider_event_id, channel);
