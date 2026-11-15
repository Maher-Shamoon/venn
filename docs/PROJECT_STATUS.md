# Venn — Project Status

Last updated: 2026-11-13

## Current position

| | |
|---|---|
| **Phase** | 2 — Interactive HTML prototype |
| **State** | **Complete — awaiting product-owner approval** |
| **Milestone / checkpoint** | M3 (M3.1–M3.7 delivered together as one prototype) |
| **Next phase** | 3 — Production development. **Not started. Requires explicit approval.** |

## Product-owner approvals

| Gate | Status | Date |
|---|---|---|
| Phase 1 plan | **Approved.** Decisions D-03, D-07, D-11, D-12, D-14 taken as recommended; D-01 acknowledged as a working name | 2026-11-13 |
| Phase 2 prototype | **Pending** | — |

## Phase 2 deliverable

`prototype/` — open `index.html` (website), `auth.html` (sign-in, onboarding), `app.html` (application with Owner / AR Specialist switch). Run notes and a guided walkthrough are in `prototype/README.md`. Evidence and gaps: `docs/testing/checkpoints/M3-prototype.md`.

**Design v2 (2026-11-13, product-owner request):** a second, ramp.com-inspired design of the website and core app screens, built with React, Tailwind and shadcn/ui in `design-v2/` for confirmation. Analysis: `docs/design/RAMP_ANALYSIS.md`. Product name is lowercase "venn" throughout. Phase 2 approval now covers choosing between `prototype/` (v1) and `design-v2/`. Revision 2 (same day, feedback round): v2 now covers the full prototype scope: home, pricing, 15 content pages, and 16 app screens for both roles (dashboard, customers, invoices, payments, reconciliation, investigations + detail, collections, disputes, approvals, reports, documents, integrations, team, audit log, settings). Nav labels are venn-specific, the header is glass on scroll, hero numbers use a rolling odometer, and the hero shows a looping walkthrough. Not yet built in v2: import wizard, onboarding, sign-in screens, per-customer detail.

Changes made to the Phase 1 plan during Phase 2: `--border-strong` colour token changed after measurement (DESIGN_SYSTEM §2.2). No scope or requirement changes.

## Planning documents

Unchanged from Phase 1: 19 documents in `docs/planning/` (see PROJECT_SCOPE, ROADMAP, RISKS_AND_ASSUMPTIONS for decisions D-01…D-16).

## Pending checkpoints

Phase 3: M4.1 – M17.4. See `planning/DEVELOPMENT_ROADMAP.md`.

## Failed tests

None known. The prototype has scripted browser checks only (see checkpoint file); no automated test suite exists yet.

## Blocked tasks

| Task | Blocked by |
|---|---|
| Phase 3 start | Product-owner approval of the prototype |

## Outstanding decisions

- **Prototype review feedback** (change requests are logged here before Phase 3).
- D-12 colour additions are now measured and applied in the prototype; approval is implied by approving the prototype.
- D-01 (name) still needs trademark and domain checks before any public use. D-02, D-04, D-05, D-08–D-10, D-13, D-15, D-16 remain open; none blocks Phase 3 start except D-04 (needed at M11) and D-15 (M10).

## Known gaps

- No customer interviews (D-16 recommends 5–8 conversations using this prototype).
- Prototype gaps: no keyboard-only or screen-reader test, no axe run, table rows not keyboard-focusable, system pages incomplete, see checkpoint file.
- Phase 1 Mermaid diagrams unrendered.
- Local tooling for Phase 3 not yet verified (Python 3.10 and Node are present; Docker not checked). Note: the repo is not a git repository yet.

## Next recommended action

Walk through both roles in the prototype, list change requests, and approve or amend. On explicit approval, begin M4.1 (tool check, `git init`, scaffold).

## Revision 3: working frontend (design-v2)

The `/app` area is now a working frontend with local state (saved in the browser, reset under Settings, Data). It covers auth, onboarding, both dashboards with charts, customers, invoices (CSV import wizard, PDF review, record payment, adjustments), payments, reconciliation (keyboard review), investigations, collections (fact-checked drafts), disputes, approvals (decisions change balances), analytics with exports, documents, integrations, team, audit log, 8 settings tabs, notifications, tasks, profile and system pages. `/demo` signs into the sample workspace. Data is stored locally only; there is no backend. Phase 3 (real build) still needs explicit approval.

## Revision 4: plan gaps closed (design-v2)
- Shared time range (7 days, 30 days, 90 days, 12 months) on every chart: dashboards, analytics grid, report pages and CSV export. Data lives in `src/components/app/ranges.ts`.
- Investigations board view (drag to change status, keyboard-accessible select per card) next to the table.
- Investigation analysis states: "analysis failed" (retry) and "needs evidence" (re-run blocked until a document or email is linked).
- First-run empty dashboard with setup steps; reachable by signing up, by `/demo?fresh=1`, or Settings > Start with an empty workspace.
- Loading skeletons shaped like the page (dashboard, list, detail) on first visit to each screen.
- Storage key bumped to `venn.app.v5`.

## Revision 5: Phase 3 frontend QA (apps/web)
- Production frontend lives in `apps/web`; `design-v2` is the frozen visual reference.
- QA pass over every route as owner and AR specialist at 390, 768 and 1280 px, plus click-through of every list, modal, form and flow.
- Bugs found and fixed: Ctrl+K palette crashed the app; reconciliation key handler threw on non-element targets; approvals could be rejected without a reason; integration detail pages showed Disconnect for unconnected systems; record ids jumped (INVG-0133); settings tabs flashed the skeleton; login accepted any password.
- Added: local account service (hashed passwords, lockout, reset), skip link, focus ring, main landmarks, per-page titles, favicon, meta tags.
- 20 unit tests, lint, typecheck and build run in CI on every push.
- Still local-only until the backend exists: data is in browser storage, contact and early-access forms store nothing server-side.

## Revision 6: module specifications and delivery plan
- `docs/modules/`: the frontend divided into 21 modules, each with scope, use cases, FRs (with prototype status), NFRs, test cases, backend contract and gaps. Totals: 147 use cases, 202 FRs, 181 test cases, 14 global NFRs.
- `docs/planning/MODULE_DELIVERY_PLAN.md`: stages A–J with checkpoints and approval gates, decisions P3-D1…D7. **Awaiting owner approval; no build work started.**

## Revision 7: Stage A (foundation) complete, awaiting Gate A approval
- Backend skeleton `services/api` (FastAPI, SQLAlchemy, Alembic, problem+json, request ids), Docker Compose file, CI with API, web, Playwright and secret-scan jobs, OpenAPI-to-TypeScript generation with drift checks, frontend data layer (TanStack Query, money helpers, MSW, URL-synced tables, API error toasts).
- Evidence: `docs/testing/checkpoints/STAGE-A-foundation.md`. CI green on all four jobs.
- Docker Desktop installed and `docker compose up` verified (see evidence).
- Next: Stage B (identity, tenancy, audit) after approval. It needs a Supabase project from you.

## Revision 8: Stage B in progress (hosted Supabase)
- Done and tested: identity, tenancy, RBAC, audit chain (B1, B2); real Supabase sign-in/out through the app with the API accepting the token (B3 partly); browser key locked out of application tables.
- Not yet: sign-up and email-link flows (no readable inbox), team and invitations, settings, audit viewer screen, sandbox organizations (B4, B5). Gate B is not reached.

## Revision 9: Gate B passed (self-review), Stage C started
- Identity, tenancy, audit, team, invitations, settings (company and financial) and audit viewer are live on the API and tested. See the Gate B section of `docs/testing/checkpoints/STAGE-B-identity-tenancy-audit.md` for the gaps carried forward.
- Next: Stage C core ledger (customers, invoices, payments, CSV import).

## Revision 10: Gate C passed (self-review), Stage D started
- Customers, invoices, payments, allocations and CSV import run on the real API end to end; see `docs/testing/checkpoints/STAGE-C-core-ledger.md` for gaps (notably the real dashboard, Stage H).
- Next: reconciliation rules R1 to R8, review workspace, approvals and adjustments.

## Revision 11: Gate D passed (self-review), Stage E started
- Reconciliation rules R1 to R8, the review workspace (run, keyboard review, undo of auto-matches, discrepancies) and approvals with adjustments (separation of duties, staleness, expiry, policies) run on the real API; see `docs/testing/checkpoints/STAGE-D-reconciliation-approvals.md`.
- Measured: 1,000 payments reconcile in 6.3 s. A run is synchronous, so very large organizations need the job runner (Stage I).
- Next: Stage E. Documents, deterministic investigations and the evidence model can be built now. **The AI analysis (E4) is blocked until an LLM API key is provided**; the deterministic path will work without it.

## Revision 12: Stage E (documents and investigations), AI step blocked
- Investigations open from discrepancies, with cited findings in five kinds, versioned analyses, evidence, timeline and approval-gated actions; documents with PDF text extraction. See `docs/testing/checkpoints/STAGE-E-documents-investigations.md`.
- **BLOCKED: E4 (AI analysis) needs an LLM API key.** The deterministic engine works without it. E2 (PDF import review) is also open.
- Documents have no virus scan and no OCR yet.
- Next: Stage H first (the real dashboard still shows the prototype page), then Stage F.

## Revision 13: Stages H, F and I (as far as they can go without outside accounts)
- Real dashboards, six reports with CSV export, search and badge counts (Stage H); collections with fact-checked drafts and an approved final notice, disputes, notifications and tasks (Stage F); rate limiting, migration round trip, accessibility of every signed-in screen and a runbook (Stage I). Evidence: `STAGE-F-H-workflow-and-insight.md` and `STAGE-I-hardening.md` in `docs/testing/checkpoints/`.
- Real organizations no longer show any prototype data in the app frame or on the dashboard. Integrations in a real organization honestly say that nothing is connected.
- **Still blocked:** AI analysis (needs an LLM key), Gmail, QuickBooks and Stripe (need accounts and credentials), real email delivery and hosting (Stage J: needs a mail provider, a host, a domain and an error tracker).
- **Still open without a blocker:** PDF import review, virus scan and OCR for documents, job runner, load tests at 100k invoices, website pre-rendering, a security review by someone else.
