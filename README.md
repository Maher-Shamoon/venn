# venn

Find the revenue slipping through the cracks. venn reads your invoices, bank payments and customer emails, finds where they disagree, and gives your team an evidence-backed case file for every gap. A person approves anything consequential.

## Repository

| Path | What it is |
|---|---|
| `apps/web` | The production frontend (Vite, React 19, TypeScript, Tailwind v4, shadcn/ui) |
| `services/api` | The API (FastAPI, SQLAlchemy, Alembic, PostgreSQL with row-level security) |
| `design-v2` | The approved interactive design, kept as a visual reference |
| `prototype` | The first static HTML prototype |
| `docs` | Product, architecture, API, security and testing documents |

## Run the frontend

```bash
cd apps/web
npm install
npm run dev
```

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run typecheck` | Type-check the project |
| `npm run lint` | Lint with oxlint |
| `npm test` | Run unit tests with Vitest |
| `npm run build` | Type-check and build for production |

The sample workspace keeps its data in the browser. Real organizations use the API. Open `/demo` to sign in to the sample workspace, or `/demo?fresh=1` to start with an empty one.

## Status

Phase 3: building the real frontend from the approved design, then the backend described in `docs/planning`. See `docs/PROJECT_STATUS.md`.

## Run everything with Docker

```bash
docker compose up --build          # web http://localhost:8080, API :8000, database, mail inbox http://localhost:8025
docker compose --profile scan up   # adds a ClamAV virus scanner (then set VENN_CLAMD_HOST=clamav on the api)
```

Sign-in needs a Supabase project: put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a root `.env` and the API settings in `services/api/.env.docker` (see `services/api/.env.example`). Without them the web app runs the sample workspace only.

## Live (free tiers)

- Web: https://venn-web-beta.vercel.app · API: https://venn-api.vercel.app (both on Vercel; deploy with `npx vercel deploy --prod` from `apps/web` and `services/api`).
- Operations, configuration and recovery: `docs/deployment/RUNBOOK.md`. Status and evidence: `docs/PROJECT_STATUS.md` and `docs/testing/checkpoints/`.

## Tests

```bash
cd services/api && uv run pytest              # API (needs no database installed: uses an embedded PostgreSQL)
cd apps/web && npm test                       # unit tests
cd apps/web && npx playwright test            # end to end (real-stack specs need services/api/.env and a test user)
```
