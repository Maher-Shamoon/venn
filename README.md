# venn

Find the revenue slipping through the cracks. venn reads your invoices, bank payments and customer emails, finds where they disagree, and gives your team an evidence-backed case file for every gap. A person approves anything consequential.

## Repository

| Path | What it is |
|---|---|
| `apps/web` | The production frontend (Vite, React 19, TypeScript, Tailwind v4, shadcn/ui) |
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

Data is stored in the browser until the backend exists. Open `/demo` to sign in to the sample workspace, or `/demo?fresh=1` to start with an empty one.

## Status

Phase 3: building the real frontend from the approved design, then the backend described in `docs/planning`. See `docs/PROJECT_STATUS.md`.
