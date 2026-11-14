# venn API

FastAPI + SQLAlchemy 2 + PostgreSQL (pgvector). Python 3.12, managed with [uv](https://docs.astral.sh/uv/).

```bash
cd services/api
uv sync                      # install
uv run pytest                # tests (starts an embedded PostgreSQL with pgvector)
uv run ruff check .          # lint
uv run mypy app              # types
uv run alembic upgrade head  # migrate (needs VENN_DATABASE_URL)
uv run uvicorn app.main:app --reload
```

With Docker: `docker compose up --build` from the repository root starts PostgreSQL, Redis, Mailpit and the API on http://localhost:8000 (docs at `/docs`).

Layers (one direction): `api` → `services` → `repositories` → `models`; `core` is shared. See `docs/planning/SYSTEM_ARCHITECTURE.md`.

Errors are RFC 9457 `application/problem+json` with a stable `code`; every response carries `X-Request-Id`.

Tests use a real PostgreSQL, never SQLite. Locally that is the embedded `pgserver` (no `pg_trgm`/`pgcrypto` contrib extensions); in CI it is a `pgvector/pgvector:pg16` service via `VENN_TEST_DATABASE_URL`.
