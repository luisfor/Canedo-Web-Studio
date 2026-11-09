CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
INSERT OR IGNORE INTO schema_version VALUES (1);
CREATE TABLE IF NOT EXISTS contact (
 tenant_id TEXT NOT NULL,id TEXT NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,consent INTEGER NOT NULL CHECK(consent IN(0,1)),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,phone)
);
CREATE TABLE IF NOT EXISTS message (
 tenant_id TEXT NOT NULL,id TEXT NOT NULL,contact_id TEXT NOT NULL,text TEXT NOT NULL,channel TEXT NOT NULL,status TEXT NOT NULL,
 PRIMARY KEY(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS inbox (tenant_id TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(tenant_id,id));
CREATE TABLE IF NOT EXISTS receipt (
 tenant_id TEXT NOT NULL,key TEXT NOT NULL,operation TEXT NOT NULL,request TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(tenant_id,key)
);
