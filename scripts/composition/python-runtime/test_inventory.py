import json
import os
from pathlib import Path
import secrets
import sys
import tempfile
import threading
import unittest
import urllib.request
import urllib.error

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from inventory import Repository, Fault
from server import create_server


class InventoryTests(unittest.TestCase):
    def test_transactions_idempotency_isolation_and_restart_for_each_provider(self):
        for provider in ("sqlite", "json-file"):
            with self.subTest(provider=provider), tempfile.TemporaryDirectory(prefix="kit-python-domain-") as directory:
                repository = Repository(directory, provider)
                with self.assertRaises(Exception):
                    repository.check()
                repository.migrate()
                product = {"id": "p", "name": "Producto de prueba", "priceCents": 1299, "stock": 2}
                self.assertEqual(repository.execute("demo", "p", "createProduct", product), product)
                received = repository.execute("demo", "stock", "receiveStock", {"productId": "p", "quantity": 3})
                self.assertEqual(received["stock"], 5)
                self.assertEqual(repository.execute("demo", "stock", "receiveStock", {"productId": "p", "quantity": 3})["stock"], 5)
                with self.assertRaises(Fault):
                    repository.execute("demo", "stock", "receiveStock", {"productId": "p", "quantity": 4})
                with self.assertRaises(Fault):
                    repository.execute("demo", "invalid", "receiveStock", {"productId": "p", "quantity": -1})
                self.assertEqual(repository.execute("other", None, "listProducts", None), [])
                restarted = Repository(directory, provider)
                restarted.migrate()  # Does not reset the stored product or schema.
                self.assertEqual(restarted.execute("demo", None, "listProducts", None)[0]["stock"], 5)

    def test_json_lock_and_failed_update_preserve_committed_data(self):
        with tempfile.TemporaryDirectory(prefix="kit-python-lock-") as directory:
            repository = Repository(directory, "json-file")
            repository.migrate()
            original = repository.file.read_bytes()
            lock = Path(directory) / ".transaction-lock"
            lock.mkdir()
            with self.assertRaises(Fault):
                repository.execute("demo", None, "listProducts", None)
            self.assertTrue(lock.exists())
            lock.rmdir()  # This test owns the synthetic lock, not an application recovery.
            with self.assertRaises(Fault):
                repository.execute("demo", "missing", "receiveStock", {"productId": "none", "quantity": 1})
            self.assertEqual(repository.file.read_bytes(), original)

    def test_unknown_existing_data_is_never_reset(self):
        for provider, name in (("sqlite", "inventory.sqlite"), ("json-file", "inventory.json")):
            with self.subTest(provider=provider), tempfile.TemporaryDirectory(prefix="kit-python-unknown-") as directory:
                file = Path(directory) / name
                file.write_bytes(b"synthetic-data-that-must-remain")
                with self.assertRaises(Exception):
                    Repository(directory, provider).migrate()
                self.assertEqual(file.read_bytes(), b"synthetic-data-that-must-remain")

    def test_real_http_contracts_authentication_and_inventory_for_each_provider(self):
        for provider in ("sqlite", "json-file"):
            with self.subTest(provider=provider), tempfile.TemporaryDirectory(prefix="kit-python-http-") as directory:
                Repository(directory, provider).migrate()
                tokens = {"demo": secrets.token_hex(32), "other": secrets.token_hex(32)}
                server = create_server(directory, provider, tokens, port=0)
                thread = threading.Thread(target=server.serve_forever)
                thread.start()
                origin = "http://127.0.0.1:" + str(server.server_address[1])
                def request(route, body=None, key="request", tenant="demo", token=None):
                    headers = {"X-Tenant-Id": tenant, "Authorization": "Bearer " + (token or tokens[tenant]), "Content-Type": "application/json", "Idempotency-Key": key}
                    req = urllib.request.Request(origin + route, data=None if body is None else json.dumps(body).encode("utf-8"), headers=headers)
                    try:
                        with urllib.request.urlopen(req, timeout=3) as response:
                            return response.status, json.load(response)
                    except urllib.error.HTTPError as error:
                        with error:
                            return error.code, json.load(error)
                try:
                    self.assertEqual(request("/health")[0], 200)
                    self.assertEqual(request("/products", token="invalid")[0], 401)
                    self.assertEqual(request("/products", token=tokens["other"])[0], 401)
                    product = {"id": "sku", "name": "Example", "priceCents": 100, "stock": 1}
                    self.assertEqual(request("/products", product, "p")[0], 200)
                    self.assertEqual(request("/inventory/adjust", {"productId": "sku", "quantity": 2}, "s")[1]["stock"], 3)
                    self.assertEqual(request("/products")[1][0]["stock"], 3)
                    self.assertEqual(request("/products", tenant="other")[1], [])
                    self.assertEqual(request("/products", {**product, "stock": 2}, "p")[0], 409)
                    self.assertEqual(request("/products", {**product, "stock": -1}, "bad")[0], 400)
                    self.assertEqual(request("/missing")[0], 404)
                finally:
                    server.shutdown()
                    server.server_close()
                    thread.join(timeout=5)
                    self.assertFalse(thread.is_alive())


if __name__ == "__main__":
    unittest.main()
