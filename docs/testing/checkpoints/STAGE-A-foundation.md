# Stage A: Foundation (checkpoints A1 to A4)

Date: 2026-11-15 · Plan: docs/planning/MODULE_DELIVERY_PLAN.md

## Commands and results
| Command | Result |
|---|---|
| `cd services/api && uv run pytest` | 6 passed (4 app, 2 database against embedded PostgreSQL with pgvector) |
| `uv run ruff check .` / `uv run mypy app` | clean / no issues (strict) |
| `cd apps/web && npx vitest run` | 8 files, 35 tests passed |
| `npx oxlint`, `npx tsc -b`, `npm run build` | clean |
| `npx playwright test` (desktop 1280, mobile 390) | 18 passed |
| GitHub Actions (web, e2e, api, secrets) | see the run for the final commit of this stage |

## Acceptance
| ID | Check | Result |
|---|---|---|
| A1 | FastAPI service runs; `/api/v1/health` 200; `/health/ready` reaches a real PostgreSQL; problem+json with request id; Alembic baseline applies | PASSED (pytest) |
| A1 | `docker compose up -d --build` brings up db, redis, mailpit, api | PASSED 2026-11-15 after installing Docker Desktop: api `/health/ready` returned `{"status":"ready"}`, Mailpit UI 200, Redis PONG, `vector` extension present, pytest against the compose database 6 passed |
| A2 | CI: lint, types, tests, build, e2e, API tests with pgvector service, OpenAPI and TypeScript type drift check, gitleaks | PASSED on GitHub |
| A2 | `pip-audit` | Runs but is non-blocking (`|| true`) until a baseline of known findings is reviewed |
| A3 | TanStack Query, money helpers (exact decimals), MSW, Playwright + axe, generated API types, feature folder convention | PASSED |
| A4 | URL-synced and server-mode DataTable, loading rows, API error toast with request id | PASSED (component tests) |
| G-7 | Existing screens unchanged visually | Verified by e2e render checks; no manual screenshot pass this stage |

## Defects found and fixed during this stage
- Marketing home failed axe: duplicated testimonial row exposed focusable elements while hidden (now `inert`); decorative footer wordmark flagged for contrast (now CSS content).
- Marketing home scrolled horizontally at 390 px because pre-reveal animation offsets overflowed (now clipped).
- `npm ci` failed after adding openapi-typescript (TypeScript 7 peer conflict): `.npmrc` sets `legacy-peer-deps`, and the type generator runs under `typescript@5.9` via npx.
- Vitest picked up Playwright specs: restricted to `src/**/*.test.*`.

## Known limits and open items
- Embedded local PostgreSQL (pgserver) has no `pg_trgm` or `pgcrypto`. `pg_trgm` for payer-name similarity moves to the reconciliation migration; CI uses the full pgvector image.
- Python 3.12 pinned with uv; backend uses synchronous SQLAlchemy and psycopg 3 (the architecture allows this simplification; shared with Celery later).
- Decisions P3-D1 to D7 were approved with the plan.
