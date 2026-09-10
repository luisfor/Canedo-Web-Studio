CREATE TABLE IF NOT EXISTS generation_cost_log (
    generation_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL UNIQUE,
    state_id TEXT,
    source TEXT NOT NULL,
    model TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    r2_key TEXT,
    created_at INTEGER NOT NULL,
    estimated_cost REAL,
    actual_cost REAL,
    provider_request_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_gen_cost_request ON generation_cost_log(request_id);
