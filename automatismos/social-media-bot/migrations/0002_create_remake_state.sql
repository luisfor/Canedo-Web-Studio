CREATE TABLE IF NOT EXISTS remake_state (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_remake_state_expires
ON remake_state(expires_at);
