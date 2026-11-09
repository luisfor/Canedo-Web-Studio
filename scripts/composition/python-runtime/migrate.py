"""Explicit migration, never invoked by generation/server startup."""
import json
import os
from pathlib import Path
from inventory import Repository

if __name__ == "__main__":
    modules = json.loads((Path(__file__).parent / "modules.json").read_text(encoding="utf-8"))
    Repository(os.environ.get("DATA_DIR", "data"), modules["persistence"]["provider"]).migrate()
    print("Local schema v1 ready; no seed data, provider calls or destructive operations.")
