CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
INSERT OR IGNORE INTO schema_version VALUES (1);
CREATE TABLE IF NOT EXISTS product (
 tenant_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL,
 price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 0 AND 1000000000),
 stock INTEGER NOT NULL CHECK(stock BETWEEN 0 AND 1000000000), PRIMARY KEY(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS supplier (tenant_id TEXT NOT NULL,id TEXT NOT NULL,name TEXT NOT NULL,PRIMARY KEY(tenant_id,id));
CREATE TABLE IF NOT EXISTS sale (
 tenant_id TEXT NOT NULL,id TEXT NOT NULL,product_id TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),
 contact_id TEXT NOT NULL,total_cents INTEGER NOT NULL CHECK(total_cents>=0),PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,product_id) REFERENCES product(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS cash_entry (
 tenant_id TEXT NOT NULL,id TEXT NOT NULL,sale_id TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,sale_id),FOREIGN KEY(tenant_id,sale_id) REFERENCES sale(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS stock_movement (
 tenant_id TEXT NOT NULL,id TEXT NOT NULL,product_id TEXT NOT NULL,quantity INTEGER NOT NULL,reason TEXT NOT NULL,
 PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES product(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS purchase (
 tenant_id TEXT NOT NULL,id TEXT NOT NULL,product_id TEXT NOT NULL,supplier_id TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),
 total_cents INTEGER NOT NULL CHECK(total_cents>=0),PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,product_id) REFERENCES product(tenant_id,id),FOREIGN KEY(tenant_id,supplier_id) REFERENCES supplier(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS outbox (
 tenant_id TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,
 delivered INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS receipt (
 tenant_id TEXT NOT NULL,key TEXT NOT NULL,operation TEXT NOT NULL,request TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(tenant_id,key)
);
