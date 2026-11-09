CREATE TABLE IF NOT EXISTS saas_plan(tenant_id TEXT NOT NULL,id TEXT NOT NULL,name TEXT NOT NULL,limits TEXT NOT NULL,PRIMARY KEY(tenant_id,id));
CREATE TABLE IF NOT EXISTS subscription(tenant_id TEXT PRIMARY KEY,plan_id TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('trialing','active','suspended','cancelled')),valid_until INTEGER NOT NULL,FOREIGN KEY(tenant_id,plan_id) REFERENCES saas_plan(tenant_id,id));
CREATE TABLE IF NOT EXISTS usage_event(tenant_id TEXT NOT NULL,id TEXT NOT NULL,metric TEXT NOT NULL,period TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),PRIMARY KEY(tenant_id,id));
CREATE TABLE IF NOT EXISTS usage_alert(tenant_id TEXT NOT NULL,metric TEXT NOT NULL,period TEXT NOT NULL,threshold INTEGER NOT NULL,PRIMARY KEY(tenant_id,metric,period,threshold));
