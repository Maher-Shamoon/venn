# Runbook

What an operator needs to run, upgrade, back up and recover venn. It describes what exists today. Hosting accounts have not been chosen, so nothing here names a provider.

## Parts
| Part | What it is | Where it lives |
|---|---|---|
| Web app | Static build of `apps/web` (Vite) | any static host or CDN |
| API | `services/api` FastAPI, started with `uvicorn app.main:app` | one or more instances behind HTTPS |
| Database | PostgreSQL 16 with `pgvector` and row-level security | Supabase project today |
| Auth | Supabase Auth (email and password). The API verifies the tokens with the project's JWKS | Supabase |

## Configuration
The API reads `VENN_*` environment variables (`services/api/.env.example`). Never commit real values.
| Variable | Purpose |
|---|---|
| `VENN_DATABASE_URL` | SQLAlchemy URL with the `postgresql+psycopg://` prefix. URL-encode the password |
| `VENN_JWKS_URL`, `VENN_JWT_ISSUER`, `VENN_JWT_AUDIENCE` | how tokens are verified |
| `VENN_JWT_SECRET` | only for development and tests (HS256). Leave empty in production |
| `VENN_WEB_URL`, `VENN_CORS_ORIGINS` | allowed browser origins |
| `VENN_ENV` | `production` turns off `/docs` and lets destructive scripts refuse to run |
| `VENN_RATE_LIMIT_PER_MINUTE`, `..._HEAVY_...`, `..._ANONYMOUS_...` | per caller limits (defaults 600, 30, 120). Counters are per process |
The web build takes `VITE_API_URL`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The anon key is public by design; the service-role key must never be given to the web app or placed in a repository.

## Deploying a change
1. CI must be green (web, e2e smoke, api, secrets).
2. Apply migrations first: `cd services/api && uv run alembic upgrade head`. Migrations are written so the previous API version keeps working against the new schema for one release.
3. Start the new API instances, check `GET /api/v1/health/ready`, then publish the web build.
4. Regenerate the API types when endpoints change: `uv run python scripts/dump_openapi.py ../../apps/web/src/types/openapi.json`, then `npm run api:types` in `apps/web`. CI fails when the committed document is out of date.

## Rolling back
- **Code:** redeploy the previous build. Migrations are additive, so the old code still runs.
- **Schema:** `uv run alembic downgrade -1`. A test (`tests/test_migrations_roundtrip.py`) applies every migration, undoes them all and applies them again on every CI run. Downgrades drop the new tables, so take a backup first.
- **Data written by a bad release:** financial records are never edited in place. Reverse a payment, void an allocation or cancel an invoice from the application, which keeps the audit trail. Do not edit rows by hand.

## Backups and recovery
- Supabase takes daily backups on paid plans, and point-in-time recovery is a plan option. **Confirm which is enabled for the production project before launch**; it is not set up by this repository.
- Test a restore into a scratch project at least once before launch and after any large schema change, then run `uv run python scripts/cloud_check.py` against it.
- Uploaded documents are stored in the database, so they are covered by the same backup.

## Secrets and keys
- Rotate the database password in the provider, update `VENN_DATABASE_URL`, restart the API.
- If a service-role key or database password is ever pasted into chat, a ticket or a commit, treat it as leaked and rotate it. The secret scan in CI (`gitleaks`) fails the build on committed secrets.

## Checks to run
| When | What |
|---|---|
| each deploy | `/api/v1/health/ready` returns 200 |
| weekly | `npm audit --omit=dev` and `pip-audit`; CI also runs them |
| after a migration | the audit chain: `GET /api/v1/audit-events/verify` as an owner must report `valid` |
| when support gets a report | search the logs for the request id the user sees in the error message |

## Known limits of this version
- Rate limits and the reconciliation run are per process and synchronous. Run a single API instance until a shared limiter and a job runner exist.
- No email leaves the system until a mail provider is configured. Invitations and collection messages are logged by the development mailer.
- Documents have no virus scan and no OCR.
- Integrations (Gmail, QuickBooks, Stripe, bank feeds) and AI analysis are not connected.
