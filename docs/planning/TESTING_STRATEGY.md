# Venn — Testing Strategy

Status: Phase 1 draft · Last updated 2026-11-13

## 1. Rules

1. A checkpoint is complete only when its acceptance criteria are **verified by executed tests or recorded manual checks**. Written code is not evidence.
2. Results are reported as **PASSED**, **FAILED** or **BLOCKED** (missing credentials or external service). Blocked is never reported as passed.
3. No fabricated results: every reported result quotes the command run and its summary line.
4. Money, allocation, reconciliation, permission and tenancy code is written test-first.
5. Tests use synthetic data only.

## 2. Test pyramid

| Level | Tools | Scope | Runs |
|---|---|---|---|
| Static | Ruff, mypy (strict on `services/`, `ai/`), ESLint, `tsc --noEmit`, import-linter | Types, layering rules (AI cannot import write services) | Every commit |
| Backend unit | Pytest, Hypothesis | Pure services: money, balance, allocation, reconciliation rules, policy decisions, validators | Every commit |
| Backend integration | Pytest + HTTPX `AsyncClient` + real PostgreSQL (pgvector image) + Redis | API endpoints, DB constraints, RLS, audit, idempotency, Celery tasks run eagerly | Every commit |
| Frontend unit/component | Vitest, React Testing Library, MSW | Components, forms, formatters, permission-driven rendering | Every commit |
| Contract | OpenAPI schema diff; generated TS types compile; Schemathesis fuzzing on read endpoints | API ↔ web agreement | Every commit |
| End-to-end | Playwright against Docker Compose | Scenarios A–J, role-based navigation, responsive checks, axe accessibility | Every PR to main; nightly full |
| AI evaluation | Pytest runners in `ai/evaluations` | Suites in AI_AGENT_ARCHITECTURE §9 | Deterministic parts every commit (recorded/fake provider); live-model suites nightly and before prompt/model changes |
| Performance | k6 or Locust; seeded 100k-invoice org | List/aggregate latency, import throughput | M16 and before releases |
| Security | Cross-tenant suite, RBAC matrix, `pip-audit`, `npm audit`, gitleaks, container scan, ZAP baseline | See §6 | Every commit (suites); weekly (scans) |

Test database: each integration test runs in a transaction rolled back at the end; RLS tests use real commits in a throwaway schema because policies depend on session settings. Tests connect as `venn_app`, never as a superuser, so RLS and grants are exercised.

## 3. Backend test areas

### 3.1 Financial calculations (unit + property-based)
- Balance equation holds after any sequence of allocate / void / adjust / reverse (Hypothesis stateful test): `balance_due = total − paid − adjusted`, never negative; `payment.allocated ≤ amount`.
- Decimal handling: 4-decimal inputs, currencies with 0 and 3 minor units, rejection of floats and of strings like `"1e3"`, `"NaN"`.
- Display-status precedence table (every flag combination).
- Overdue calculation at timezone boundaries (organization in UTC+13 and UTC−10 on the due date).
- Verified-recovered definition against hand-computed fixtures.

### 3.2 Reconciliation rules
One fixture per rule R1–R8 plus negatives: reference inside longer string, invoice number collisions between customers, two candidate invoices of equal amount (must **not** auto-apply), subset-sum with two valid subsets (no suggestion of a single one), duplicate within/outside window, reversed payment, different currency, already-allocated payment, re-run idempotency (no duplicate matches or discrepancies).

### 3.3 Database integrity
Direct SQL attempts that must fail: over-allocation, allocation with mismatched currency, allocation to cancelled invoice, cross-tenant foreign key, self-approval, applied adjustment without approval, UPDATE/DELETE on `audit_logs`, removing the last owner.

### 3.4 Imports and idempotency
Same file twice; same rows in a different file; duplicate invoice numbers inside one file; conflicting re-import (different amount); malformed dates and ambiguous date formats; BOM and non-UTF-8 encodings; 10k-row file; job retried mid-way (no duplicates); commit replay with the same idempotency key.

### 3.5 Authentication, RBAC, tenancy
- Token cases: missing, malformed, expired, wrong audience, unverified email.
- Generated matrix: for every route × {owner, ar_specialist, suspended member, non-member} assert expected status from ROLE_PERMISSION_MATRIX. The test fails when a new route has no matrix entry.
- Configurable permissions: toggling `collections.send` changes behaviour on the next request.
- Cross-tenant suite (SECURITY §3).
- Invitation: token single-use, expiry, email mismatch, accepting never creates an organization, re-invite invalidates old token.

### 3.6 Approvals
Policy decision table; requester cannot decide; single-owner direct path; stale approval; reject requires comment; idempotent approve; execution failure leaves approval `approved` + `execution_failed` event and no partial financial change.

### 3.7 Audit
Each mutating endpoint produces exactly one audit row with correct before/after; failed transaction produces none; hash chain verifies; tampering in a test DB (as superuser) is detected by the verify endpoint.

## 4. Frontend test areas

| Area | Checks |
|---|---|
| Components | Money formatting per currency; status badge mapping; table sorting/filter chips; evidence card; finding item variants |
| Forms | Zod validation messages; money input rejects invalid characters; server validation errors mapped to fields; double-submit prevention |
| Navigation | Sidebar per role; deep links; unauthenticated redirect; return-to after login |
| Role-based UI | Owner-only pages render a permission state for AR; restricted actions show "Submit for approval" |
| States | Loading skeleton, empty, filtered-empty, error + retry, version-conflict, session-expired |
| Responsive | Playwright at 1440, 1024, 768, 390 widths for dashboard, invoice list, investigation workspace, approval detail |
| Accessibility | axe on each main page (no serious/critical violations); keyboard walkthrough of reconciliation review and approval decision; focus management in drawers/modals |
| Visual | Playwright screenshots of key pages as a regression baseline (reviewed, not pixel-gated, in MVP) |

## 5. AI tests

Defined in AI_AGENT_ARCHITECTURE §9. Additional engineering tests:
- Validator unit tests with crafted bad outputs (missing citation, wrong amount, claim promoted to fact, unknown action key).
- Graph tests with a **fake provider** returning scripted outputs: repair loop, fallback to manual mode, budget exhaustion, timeout, provider failover.
- Tool tests: every tool returns only the context organization's data; no registered tool performs writes (asserted by inspecting the registry and by running tools against a read-only DB role).
- Human-approval enforcement: integration test that runs a full analysis and asserts no row changed in `invoices`, `payments`, `payment_allocations`, `adjustments`, `outbound_messages(sent)`.
- Prompt-injection corpus run on every prompt or model change.

## 6. Security tests

Cross-tenant suite · RBAC matrix · route-has-permission check · RLS coverage check (every table with `organization_id` has forced RLS) · log-scrubbing test · upload validation (wrong magic bytes, oversized, EICAR test file → quarantined) · webhook signature and replay · rate-limit behaviour · CSV-injection escaping in exports · OAuth `state` tampering and reuse · dependency, secret and container scans · ZAP baseline scan against staging · external penetration test before paid launch (recommended).

## 7. End-to-end scenarios

Each is a Playwright spec using seeded synthetic data. Email is captured by Mailpit locally.

| ID | Scenario | Key assertions | External dependency |
|---|---|---|---|
| A | New organization signup and onboarding | Verification required; org created; creator is Owner; skipped steps appear in checklist | None (local auth + Mailpit) |
| B | Owner invites AR Specialist; employee joins existing org | One organization exists afterwards; member has AR navigation; Owner-only URLs show permission state and API returns 403 | None |
| C | Invoice import with duplicate detection | Duplicates listed and skipped; re-upload warns; counts match; no overwrite | None |
| D | Payment import and reconciliation | Exact match auto-applied (when enabled) and undoable; ambiguous one waits for review; balances correct | None |
| E | Discrepancy → evidence-backed investigation | Short payment detected; investigation shows cited facts, calculation, an unverified email/document claim kept separate | Live LLM for full run → otherwise fake provider; live variant **BLOCKED** without key |
| F | Human-approved action → verified outcome | AR submits; Owner approves; action recorded; later payment import flips investigation to verified recovered with the exact amount | None |
| G | Collection email drafting, approval, sending | Draft facts match records; AR without `collections.send` → approval; after approval message is sent and on the timeline | Sending via Gmail **BLOCKED** without Google credentials; verified locally with a fake mail provider |
| H | Dispute management | Create from invoice; invoice shows Disputed; reminders paused; resolve with credit → approval → balance updated | None |
| I | Owner approval of restricted financial action | Write-off request; requester cannot approve; Owner approves; audit entries present; stale case handled | None |
| J | Cross-tenant access denial | UI and direct API attempts with Org B on Org A IDs fail with 404/403 and nothing changes | None |

## 8. Test data

- `fixtures/` synthetic dataset: one demo organization (fictional company and customer names clearly marked as demo), ~12 customers, ~120 invoices, ~140 payments engineered to contain every reconciliation rule and discrepancy type, 6 PDFs, 15 emails. The same dataset backs the Phase 2 prototype, the in-app "demo data" option, E2E tests and AI evaluations.
- Factories (factory_boy / TS builders) for unit and integration tests.
- A generator script produces the 100k-invoice performance dataset.

## 9. CI pipeline

1. Lint + type-check (web, api, ai).
2. Backend unit → integration (Postgres + Redis service containers).
3. Frontend unit/component.
4. OpenAPI generation; fail on uncommitted diff of generated types.
5. Build images; Compose up; Playwright smoke (A, B, J) on every PR; full A–J on main and nightly.
6. Security scans.
7. Coverage reported; thresholds: 95% lines on `services/` money, allocation, reconciliation and policy modules; 80% overall backend; frontend threshold set after M6. Coverage is a floor, not the goal.

## 10. Checkpoint evidence format

Stored in `docs/testing/checkpoints/<checkpoint-id>.md`:

```
Checkpoint: M9.2 Reconciliation rules R1–R4
Commands:
  pytest services/api/tests/unit/reconciliation -q        → 64 passed
  pytest services/api/tests/integration/reconciliation -q → 21 passed
Acceptance criteria:
  AC-M9.2-1 … PASSED (test_r1_exact_reference_auto_applies)
  AC-M9.2-4 … BLOCKED (reason)
Manual / visual checks: screenshots at 1440 and 390, notes
Open issues: …
```

## 11. Manual and exploratory testing

- Product-owner review of the prototype (Phase 2) and of each milestone demo.
- Exploratory sessions on imports with real-world messy CSV exports (bank, QuickBooks, Stripe formats) using anonymised or synthetic files.
- Usability walk-throughs with target users once available (Risk R-01).
