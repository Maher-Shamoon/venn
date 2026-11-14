"""Writes the OpenAPI document the web app generates its types from.

Usage: uv run python scripts/dump_openapi.py ../../apps/web/src/types/openapi.json
"""
import json
import sys
from pathlib import Path

from app.main import app

out = Path(sys.argv[1])
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(f"wrote {out}")
