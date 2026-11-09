"""Original inventory domain with interchangeable, bounded local persistence."""
import copy
import json
import os
from pathlib import Path
import re
try:
    import sqlite3
except ImportError:
    sqlite3 = None  # JSON-file does not depend on an optional SQLite build.
import tempfile


class Fault(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def valid(value, schema, document):
    if "$ref" in schema:
        return valid(value, document["components"]["schemas"][schema["$ref"].split("/")[-1]], document)
    if "const" in schema and value != schema["const"]:
        return False
    if "enum" in schema and value not in schema["enum"]:
        return False
    kind = schema.get("type")
    if kind == "object":
        if type(value) is not dict or any(k not in value for k in schema.get("required", [])):
            return False
        if schema.get("additionalProperties") is False and any(k not in schema.get("properties", {}) for k in value):
            return False
        return all(k not in value or valid(value[k], s, document) for k, s in schema.get("properties", {}).items())
    if kind == "array":
        return type(value) is list and all(valid(v, schema["items"], document) for v in value)
    if kind == "integer":
        return type(value) is int and schema.get("minimum", -float("inf")) <= value <= schema.get("maximum", float("inf"))
    if kind == "string":
        return type(value) is str and schema.get("minLength", 0) <= len(value) <= schema.get("maxLength", float("inf")) and ("pattern" not in schema or re.search(schema["pattern"], value) is not None)
    if kind == "boolean":
        return type(value) is bool
    return True


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def operate(operation, body, read, write):
    if operation == "listProducts":
        return read(None)
    if operation == "createProduct":
        if read(body["id"]) is not None:
            raise Fault(409, "Product already exists")
        product = dict(body)
    elif operation == "receiveStock":
        product = read(body["productId"])
        if product is None:
            raise Fault(404, "Product not found")
        product = {**product, "stock": product["stock"] + body["quantity"]}
        if product["stock"] > 1000000000:
            raise Fault(409, "Stock exceeds supported range")
    else:
        raise Fault(404, "Operation not supported")
    write(product)
    return product


class Repository:
    def __init__(self, directory, provider):
        if provider not in ("sqlite", "json-file"):
            raise ValueError("Unsupported persistence provider")
        self.directory = Path(directory)
        self.provider = provider
        self.file = self.directory / ("inventory.sqlite" if provider == "sqlite" else "inventory.json")
        if self.directory.is_symlink() or self.file.is_symlink():
            raise ValueError("Linked data paths are not supported")

    def _connect(self):
        if sqlite3 is None:
            raise ValueError("This Python build does not provide sqlite3")
        connection = sqlite3.connect(self.file.resolve().as_uri() + "?mode=rw", uri=True, timeout=5, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def _json(self):
        if self.file.stat().st_size > 16 * 1024 * 1024:
            raise Fault(503, "Local JSON store needs operator review")
        value = json.loads(self.file.read_text(encoding="utf-8"))
        if type(value) is not dict or set(value) != {"schemaVersion", "products", "receipts"} or type(value["schemaVersion"]) is not int or value["schemaVersion"] != 1 or type(value["products"]) is not dict or type(value["receipts"]) is not dict:
            raise ValueError("Unsupported or corrupt data schema")
        document = json.loads((Path(__file__).parent / "contracts" / "openapi.json").read_text(encoding="utf-8"))
        for tenant, products in value["products"].items():
            if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", tenant) or type(products) is not dict or any(identifier != p.get("id") or not valid(p, document["components"]["schemas"]["Product"], document) for identifier, p in products.items() if type(p) is dict) or any(type(p) is not dict for p in products.values()):
                raise ValueError("Corrupt product data")
        return value

    def check(self):
        if not self.file.is_file():
            raise ValueError("Run the reviewed migration command first")
        if self.provider == "json-file":
            self._json()
        else:
            connection = self._connect()
            try:
                if connection.execute("SELECT MAX(version) FROM schema_version").fetchone()[0] != 1:
                    raise ValueError("Unsupported data schema")
            finally:
                connection.close()

    def migrate(self):
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        if self.file.exists():
            self.check()
            return
        # Exclusive reservation never adopts or resets an existing data file.
        with self.file.open("x", encoding="utf-8") as initial:
            if self.provider == "json-file":
                json.dump({"schemaVersion": 1, "products": {}, "receipts": {}}, initial)
        if self.provider == "sqlite":
            connection = self._connect()
            try:
                connection.executescript((Path(__file__).parent / "migrations" / "001.sql").read_text(encoding="utf-8"))
            finally:
                connection.close()

    def execute(self, tenant, key, operation, body):
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", tenant):
            raise Fault(400, "Invalid tenant")
        document = json.loads((Path(__file__).parent / "contracts" / "openapi.json").read_text(encoding="utf-8"))
        input_schema = {"createProduct": "ProductInput", "receiveStock": "StockInput"}.get(operation)
        if operation != "listProducts" and (not input_schema or not valid(body, document["components"]["schemas"][input_schema], document) or not key or not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", key)):
            raise Fault(400, "Invalid request contract or idempotency key")
        return self._sql(tenant, key, operation, body) if self.provider == "sqlite" else self._file(tenant, key, operation, body)

    def _sql(self, tenant, key, operation, body):
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE" if operation != "listProducts" else "BEGIN")
            old = connection.execute("SELECT operation,request,result FROM receipt WHERE tenant=? AND key=?", (tenant, key)).fetchone() if key else None
            if old:
                if old["operation"] != operation or old["request"] != canonical(body):
                    raise Fault(409, "Idempotency key conflict")
                result = json.loads(old["result"])
            else:
                def read(identifier):
                    sql = "SELECT id,name,price_cents AS priceCents,stock FROM product WHERE tenant=?"
                    if identifier is None:
                        return [dict(row) for row in connection.execute(sql + " ORDER BY id LIMIT 1000", (tenant,))]
                    row = connection.execute(sql + " AND id=?", (tenant, identifier)).fetchone()
                    return dict(row) if row else None
                def write(product):
                    connection.execute("INSERT INTO product VALUES(?,?,?,?,?) ON CONFLICT(tenant,id) DO UPDATE SET name=excluded.name,price_cents=excluded.price_cents,stock=excluded.stock", (tenant, product["id"], product["name"], product["priceCents"], product["stock"]))
                result = operate(operation, body, read, write)
                if key:
                    connection.execute("INSERT INTO receipt VALUES(?,?,?,?,?)", (tenant, key, operation, canonical(body), canonical(result)))
            connection.commit()
            return result
        except sqlite3.IntegrityError as error:
            connection.rollback()
            raise Fault(409, "Persisted data conflict") from error
        except sqlite3.OperationalError as error:
            connection.rollback()
            raise Fault(503, "Persistence unavailable") from error
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _file(self, tenant, key, operation, body):
        lock = self.directory / ".transaction-lock"
        try:
            lock.mkdir(mode=0o700)
        except FileExistsError as error:
            raise Fault(503, "Persistence busy; retry with the same idempotency key") from error
        temporary = None
        try:
            state = self._json()
            products = state["products"].setdefault(tenant, {})
            receipts = state["receipts"].setdefault(tenant, {})
            if key and key in receipts:
                old = receipts[key]
                if old["operation"] != operation or old["request"] != canonical(body):
                    raise Fault(409, "Idempotency key conflict")
                return old["result"]
            def read(identifier):
                return [products[k] for k in sorted(products)[:1000]] if identifier is None else products.get(identifier)
            def write(product):
                products[product["id"]] = product
            result = operate(operation, body, read, write)
            if operation != "listProducts":
                receipts[key] = {"operation": operation, "request": canonical(body), "result": copy.deepcopy(result)}
                with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=self.directory, prefix=".inventory-", delete=False) as stream:
                    temporary = stream.name
                    payload = canonical(state)
                    if len(payload.encode("utf-8")) > 16 * 1024 * 1024:
                        raise Fault(503, "Local JSON capacity exceeded; no update committed")
                    stream.write(payload)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.replace(temporary, self.file)
                temporary = None
            return result
        finally:
            if temporary is not None:
                os.unlink(temporary)  # Only the newly created, uncommitted temporary file.
            lock.rmdir()  # Our empty transaction lock, never a data directory.
