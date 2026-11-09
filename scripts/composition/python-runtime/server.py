"""Explicitly started local inventory API. No framework or provider SDK."""
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import sys
import signal
import threading
import urllib.request
from inventory import Repository, Fault, valid


def create_server(directory, provider, credentials, host="127.0.0.1", port=8080):
    if type(credentials) is not dict or not credentials or any(not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", tenant) or type(value) is not str or not 32 <= len(value) <= 500 or re.search(r"\s", value) for tenant, value in credentials.items()) or len(set(credentials.values())) != len(credentials):
        raise ValueError("Configure distinct tenant-scoped credentials")
    repository = Repository(directory, provider)
    repository.check()
    document = json.loads((Path(__file__).parent / "contracts" / "openapi.json").read_text(encoding="utf-8"))

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def setup(self):
            super().setup()
            self.connection.settimeout(5)

        def respond(self, status, value):
            payload = json.dumps(value, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(payload)

        def dispatch(self):
            try:
                route = self.path.split("?", 1)[0]
                operation = document["paths"].get(route, {}).get(self.command.lower())
                if operation is None:
                    raise Fault(404, "Not found")
                if route == "/health":
                    self.respond(200, {"status": "ok"})
                    return
                tenant = self.headers.get("X-Tenant-Id", "")
                if tenant not in credentials or not hmac.compare_digest(self.headers.get("Authorization", "").encode("utf-8"), ("Bearer " + credentials[tenant]).encode("utf-8")):
                    raise Fault(401, "Unauthorized")
                body = None
                key = None
                if self.command == "POST":
                    key = self.headers.get("Idempotency-Key", "")
                    length = self.headers.get("Content-Length", "")
                    if self.headers.get("Transfer-Encoding") or not length.isdigit() or not self.headers.get("Content-Type", "").split(";", 1)[0].lower() == "application/json":
                        raise Fault(400, "JSON Content-Length required")
                    if int(length) > 32768:
                        raise Fault(413, "Request body too large")
                    try:
                        body = json.loads(self.rfile.read(int(length)))
                    except (ValueError, UnicodeError) as error:
                        raise Fault(400, "Invalid JSON") from error
                result = repository.execute(tenant, key, operation["operationId"], body)
                response_schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
                if not valid(result, response_schema, document):
                    raise Fault(500, "Response contract failed")
                self.respond(200, result)
            except Fault as error:
                self.close_connection = True
                self.respond(error.status, {"error": str(error) or "Request failed"})
            except Exception:
                self.close_connection = True
                self.respond(500, {"error": "Internal error"})

        do_GET = dispatch
        do_POST = dispatch
        do_PUT = dispatch
        do_DELETE = dispatch
        do_PATCH = dispatch

    class Server(ThreadingHTTPServer):
        daemon_threads = False
        def handle_error(self, _request, _address):
            pass

    return Server((host, port), Handler)


def main():
    if sys.argv[1:] == ["--healthcheck"]:
        with urllib.request.urlopen("http://127.0.0.1:" + os.environ.get("PORT", "8080") + "/health", timeout=3) as response:
            return 0 if response.status == 200 else 1
    modules = json.loads((Path(__file__).parent / "modules.json").read_text(encoding="utf-8"))
    with open(os.environ.get("AUTH_TOKENS_FILE", "secrets/tenant-tokens.json"), encoding="utf-8") as stream:
        credentials = json.load(stream)
    server = create_server(os.environ.get("DATA_DIR", "data"), modules["persistence"]["provider"], credentials, os.environ.get("HOST", "127.0.0.1"), int(os.environ.get("PORT", "8080")))
    stopping = threading.Event()
    def stop(_signum, _frame):
        if not stopping.is_set():
            stopping.set()
            threading.Thread(target=server.shutdown, daemon=True).start()
    signal.signal(signal.SIGTERM, stop)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    try:
        sys.exit(main() or 0)
    except Exception:
        print("Startup failed: review runtime, credentials, data schema and explicit migration.", file=sys.stderr)
        sys.exit(1)
