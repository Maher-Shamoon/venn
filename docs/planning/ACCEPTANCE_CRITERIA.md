# Venn — Acceptance Criteria

Status: Phase 1 draft · Last updated 2026-11-13

Each criterion is verifiable. "Verified by" names the kind of evidence: **T** automated test, **E** end-to-end test, **M** recorded manual/visual check, **R** review. Results are recorded as PASSED / FAILED / BLOCKED in `docs/testing/checkpoints/`.

## 1. Global criteria (apply to every Phase 3 checkpoint)

| ID | Criterion | By |
|---|---|---|
| G-1 | Lint, type-check and the full existing test suite pass | T |
| G-2 | New endpoints declare a permission and appear in the RBAC matrix test | T |
| G-3 | New tenant tables have `organization_id`, composite FKs and forced RLS; coverage test passes | T |
| G-4 | Every new mutation writes an audit row in the same transaction | T |
| G-5 | Monetary values use Decimal/NUMERIC and string transport; no float in diff | T, R |
| G-6 | Cross-tenant suite extended to the new endpoints and passing | T |
| G-7 | UI changes viewed at 1440 and 390 widths; loading, empty and error states present | M |
| G-8 | No secret in the diff; `.env.example` updated for new variables | T, R |
| G-9 | `docs/PROJECT_STATUS.md` and the checkpoint evidence file updated | R |
| G-10 | Anything not verifiable is reported BLOCKED with the reason | R |

## 2. Phase 1

| ID | Criterion | By |
|---|---|---|
| AC-P1-1 | All required planning documents exist under `docs/planning/` plus `docs/PROJECT_STATUS.md` | R |
| AC-P1-2 | Eight required Mermaid diagrams present (architecture, signup/onboarding, invitation, navigation, reconciliation, investigation engine, approval, integration/data flow) plus ER diagram | R |
| AC-P1-3 | MVP / post-MVP / enterprise / mandatory controls distinguished | R |
| AC-P1-4 | No product code, prototype, migrations or external connections created | R |
| AC-P1-5 | Product owner approves, with decisions D-01…D-16 answered or deferred explicitly | Owner |

## 3. Phase 2 — M3 prototype

| ID | Criterion | By |
|---|---|---|
| AC-M3-1 | Every page in UI_PAGE_INVENTORY §8 exists and is reachable by navigation, with no dead links | M (link check) |
| AC-M3-2 | Role switcher changes sidebar, dashboard and available actions; Owner-only pages show a permission state for AR | M |
| AC-M3-3 | Interactive: filters, tabs, drawers, modals, form validation, import wizard steps, reconciliation confirm/reject, approval approve/reject work on mock data | M |
| AC-M3-4 | Investigation workspace shows facts, calculations, possible explanations, unverified claims and missing evidence as visually distinct, with working citation highlighting | M |
| AC-M3-5 | Demo data is consistent across pages (an invoice's balance equals its payments and adjustments everywhere) | M |
| AC-M3-6 | Every page carries the prototype/demo-data marker; no real auth, email or network calls to financial services | R |
| AC-M3-7 | Design tokens match DESIGN_SYSTEM; text contrast measured and meeting AA | M |
| AC-M3-8 | Usable at 1440, 1024, 768 and 390 widths | M |
| AC-M3-9 | Marketing pages contain no fabricated testimonials, logos, statistics or certification claims | R |
| AC-M3-10 | Product owner approval recorded | Owner |

## 4. Phase 3 — MVP-Core

### M4 Environment
| ID | Criterion | By |
|---|---|---|
| AC-M4.1-1 | Tool versions verified and recorded; repository initialised; `.gitignore` excludes env files and build output | M |
| AC-M4.2-1 | `docker compose up` brings all services healthy from a clean clone following the README | M |
| AC-M4.3-1 | `/healthz` and `/readyz` respond; errors use the problem format with a request ID | T |
| AC-M4.3-2 | Web app renders with design tokens; a Celery task round-trips | T, M |
| AC-M4.4-1 | CI runs lint, type-check, unit, integration, Playwright smoke and secret scan, and fails on any failure | T |

### M5 Identity, RBAC, audit
| ID | Criterion | By |
|---|---|---|
| AC-M5.1-1 | Signup requires email verification before any API access beyond `/me` | T, E |
| AC-M5.1-2 | Signup/reset responses do not reveal whether an email exists | T |
| AC-M5.1-3 | Invalid, expired and wrong-audience tokens are rejected with 401 | T |
| AC-M5.2-1 | Creating an organization creates the Owner membership, system roles and default policies atomically | T |
| AC-M5.2-2 | Requests with an `X-Organization-Id` the caller is not an active member of return 403; body-supplied organization IDs are ignored | T |
| AC-M5.2-3 | As `venn_app` with Org B context, raw SQL returns zero rows of Org A in every tenant table | T |
| AC-M5.3-1 | Generated route × role matrix matches ROLE_PERMISSION_MATRIX | T |
| AC-M5.3-2 | A route without a permission declaration fails CI | T |
| AC-M5.3-3 | Suspending a member blocks their very next request | T |
| AC-M5.3-4 | The last active Owner cannot be demoted, suspended or removed (service and database) | T |
| AC-M5.4-1 | Invited user (new or existing account) joins the inviting organization; organization count is unchanged | T, E |
| AC-M5.4-2 | Invitation tokens are stored hashed, single-use, expire in 7 days; resend invalidates the previous token; email mismatch is rejected | T |
| AC-M5.5-1 | Role change, invitation, membership and settings changes each produce one audit row with before/after | T |
| AC-M5.5-2 | UPDATE/DELETE on `audit_logs` fails for the app role; hash chain verification passes and detects tampering | T |
| AC-M5.5-3 | Replaying a POST with the same idempotency key yields one side effect and the same response | T |
| AC-M5.6-1 | Security review findings of high severity are fixed or accepted in writing by the owner | R |
| AC-M5-E | Scenarios A, B and J (initial scope) pass | E |

### M6 App shell
| ID | Criterion | By |
|---|---|---|
| AC-M6.1-1 | Primitives implement DESIGN_SYSTEM tokens; contrast checks pass | T (axe), M |
| AC-M6.2-1 | Owner and AR see their respective navigation; hidden items are also blocked by route guards and by the API | T, E |
| AC-M6.3-1 | Shared table supports sort, filter chips, cursor pagination, loading/empty/error states and keyboard navigation | T |
| AC-M6.4-1 | Notifications are per-user and per-organization; job polling shows progress and terminal states | T |

### M7 Customers and invoices
| ID | Criterion | By |
|---|---|---|
| AC-M7.1-1 | Customer CRUD with contacts; external ID uniqueness per source | T |
| AC-M7.2-1 | `balance_due = total − paid − adjusted` enforced by CHECK; display status follows the precedence table for all flag combinations | T |
| AC-M7.2-2 | Overdue is computed in the organization's timezone (boundary tests) | T |
| AC-M7.2-3 | Duplicate invoice number for the same customer is rejected (409) | T |
| AC-M7.3-1 | CSV import validates types, dates, decimals and currency and reports row-level errors | T |
| AC-M7.3-2 | Importing the same file twice creates no duplicates and warns the user | T, E |
| AC-M7.3-3 | A re-imported invoice with different values becomes a conflict row; the stored invoice is unchanged | T |
| AC-M7.3-4 | A worker crash mid-import followed by retry leaves each valid row imported exactly once | T |
| AC-M7.3-5 | 10,000 rows import in under 60 seconds on the reference environment | T (perf) |
| AC-M7.4-1 | Wizard remembers column mapping for the same header layout; ambiguous date formats require user confirmation | E |
| AC-M7.5-1 | List filters and search return correct results; cursor pagination has no gaps or repeats | T |
| AC-M7-E | Scenario C passes | E |

### M8 Payments and allocations
| ID | Criterion | By |
|---|---|---|
| AC-M8.1-1 | Manual payments are `manual`; imported are `source_verified`; duplicates by external ID or fingerprint are not created twice | T |
| AC-M8.2-1 | Allocation rejects: different currency, amount over payment's unallocated, amount over invoice balance, cancelled invoice | T |
| AC-M8.2-2 | The same violations attempted by direct SQL fail in the database | T |
| AC-M8.2-3 | Many-to-many allocation updates all balances atomically; failure of one line rolls back all | T |
| AC-M8.2-4 | Property-based test: invariants hold after arbitrary sequences of allocate/void/adjust/reverse | T |
| AC-M8.2-5 | Two concurrent allocations against the same invoice cannot over-allocate | T |
| AC-M8.2-6 | Allocations are voided, never edited or deleted; each change is audited | T |
| AC-M8.3-1 | Reversing a payment voids its allocations and restores invoice balances in one transaction | T |
| AC-M8.3-2 | Integrity job detects an artificially corrupted balance in a test database | T |
| AC-M8.4-1 | Payment detail shows allocated/unallocated and allows allocate/void with permission | E |

### M9 Reconciliation
| ID | Criterion | By |
|---|---|---|
| AC-M9.1-1 | A run starts after payment import, is recorded with counters, and only one runs per organization at a time | T |
| AC-M9.2-1 | R1 auto-applies only when reference, amount and uniqueness conditions all hold and the setting is on; with the setting off it becomes a suggestion | T |
| AC-M9.2-2 | R2–R4 produce suggestions with correct proposed allocations and plain-language explanations | T |
| AC-M9.3-1 | R5–R6 never auto-apply; R6 produces no suggestion when more than one subset matches | T |
| AC-M9.3-2 | R7 and R8 create discrepancies with correct type and exposure and do not allocate | T |
| AC-M9.3-3 | Re-running reconciliation creates no duplicate matches or discrepancies | T |
| AC-M9.3-4 | On the fixture dataset: zero incorrect auto-applied matches | T |
| AC-M9.4-1 | Reviewer can confirm, edit amounts, reject, and undo an auto-applied match; each is audited | T, E |
| AC-M9-E | Scenario D passes | E |

### M10 Approvals and adjustments
| ID | Criterion | By |
|---|---|---|
| AC-M10.1-1 | Policy decision table produces the expected execute/approve result for every action type, role and threshold | T |
| AC-M10.1-2 | A requester cannot decide their own request (API 403 and DB CHECK) | T |
| AC-M10.1-3 | Single-owner organization: sensitive action executes with typed confirmation and is logged as owner direct action | T |
| AC-M10.1-4 | Approving a request whose subject changed returns `approval_stale` and applies nothing | T |
| AC-M10.2-1 | An applied write-off/credit/discount reduces balance by exactly the amount; cannot exceed balance | T |
| AC-M10.2-2 | `refund_record` does not change invoice balance and is linkable to a later outgoing transaction | T |
| AC-M10.2-3 | No adjustment reaches `applied` without an approval or the owner-direct flag (DB) | T |
| AC-M10.3-1 | Approval detail shows requester, reason, before/after impact, evidence and history; decisions are immutable | E |
| AC-M10.4-1 | Remittance change requires step-up auth, notifies all owners and is audited without storing raw values in the log | T |
| AC-M10.4-2 | Audit viewer filters by actor, action, record and date; export is permission-checked and audited | T |
| AC-M10-E | Scenario I passes | E |

### M11 Documents and Investigation Engine
| ID | Criterion | By |
|---|---|---|
| AC-M11.1-1 | Upload rejects disallowed types (by magic bytes) and oversize files; EICAR file is quarantined | T |
| AC-M11.1-2 | Documents are retrievable only via signed URLs after a permission and tenant check | T |
| AC-M11.2-1 | Import-linter rule proves `venn_ai` cannot import write services or repositories | T |
| AC-M11.2-2 | Provider failure triggers retry then fallback provider then deterministic fallback | T (fake provider) |
| AC-M11.3-1 | Extraction output is schema-valid, carries per-field source locators, and creates nothing until a human confirms | T |
| AC-M11.3-2 | Extraction evaluation meets the gate in AI_AGENT_ARCHITECTURE §9 | T (live) — BLOCKED without key |
| AC-M11.4-1 | Retrieval and every tool return only the context organization's data | T |
| AC-M11.5-1 | Confirmed facts and calculations are generated by code and equal hand-computed values on fixtures | T |
| AC-M11.5-2 | Invalid state transitions are rejected | T |
| AC-M11.6-1 | Validator rejects: missing citation, unknown evidence ID, numeric mismatch, payment-received claim citing only tier-4 evidence, action outside the catalog | T |
| AC-M11.6-2 | After a full analysis run no row changed in invoices, payments, allocations, adjustments or sent messages | T |
| AC-M11.6-3 | When AI is disabled or fails, the investigation is usable in manual mode | T, E |
| AC-M11.6-4 | Prompt-injection suite: 100% pass | T (live) — BLOCKED without key; fake-provider structural tests always run |
| AC-M11.6-5 | Groundedness suite: 100% of statements cited, zero numeric mismatches | T (live) |
| AC-M11.7-1 | Workspace shows the five finding categories distinctly, evidence with source links and tiers, analysis versions, and a stale-analysis warning | E |
| AC-M11.8-1 | Choosing an action that policy restricts creates an approval; approved action is recorded and audited | T, E |
| AC-M11.8-2 | `recovered_verified` can be set only when source-verified allocations dated after the action exist; the amount equals their sum | T |
| AC-M11.8-3 | A manual payment or an email claim alone does not produce a verified recovery | T |
| AC-M11.9-1 | AI run records tokens, cost estimate, model and prompt version; per-organization budget stop works | T |
| AC-M11-E | Scenarios E and F pass (live-model variant reported separately) | E |

**MVP-Core exit:** scenarios A–F, I, J pass; all M4–M11 criteria PASSED or BLOCKED with owner acknowledgement.

## 5. Phase 3 — MVP-Complete

### M12 Collections and disputes
| ID | Criterion | By |
|---|---|---|
| AC-M12.1-1 | Nightly job opens/updates a case for each overdue invoice with balance; closes it when paid; priority reasons are shown | T |
| AC-M12.2-1 | Every amount, date and invoice number in a generated draft exists in the case facts; otherwise the draft is blocked | T |
| AC-M12.2-2 | Drafts contain no guarantee, legal threat or invented fee (rule check + evaluation) | T |
| AC-M12.3-1 | AR without `collections.send` → approval; with it and a standard template → send; final notice always → approval | T |
| AC-M12.3-2 | A message is sent at most once (idempotent outbox) and appears on the timeline with provider ID | T |
| AC-M12.3-3 | Without a connected mailbox the UI offers only "mark as sent manually", recorded as manual | E |
| AC-M12.4-1 | Open dispute marks the invoice Disputed and pauses reminders; resolution with adjustment creates an approval | T, E |
| AC-M12-E | Scenarios G (fake mail provider) and H pass | E |

### M13 Email intelligence
| ID | Criterion | By |
|---|---|---|
| AC-M13.1-1 | Tokens are encrypted at rest, never returned by the API and never logged (log-scrub test) | T |
| AC-M13.2-1 | OAuth `state` tampering/reuse is rejected; requested scopes equal the documented minimum | T |
| AC-M13.2-2 | Sync is incremental and idempotent on provider message ID; only messages passing the financial filter are stored | T (recorded fixtures) |
| AC-M13.2-3 | Connection shows `connected` only after a successful live call | T; live — BLOCKED without Google credentials |
| AC-M13.3-1 | A payment-claim email creates evidence and (after the grace period) a `missing_payment_claimed` discrepancy, and never a payment or status change | T |
| AC-M13.3-2 | Low-confidence links go to review; confirmed/rejected decisions persist | T |
| AC-M13.4-1 | Approved message is sent through Gmail and recorded | E live — BLOCKED without credentials |
| AC-M13.4-2 | Disconnect revokes and deletes tokens and honours the keep/delete data choice | T |

### M14 Analytics
| ID | Criterion | By |
|---|---|---|
| AC-M14.1-1 | Each KPI equals a hand-computed value on fixtures and equals the sum of its drill-down list | T |
| AC-M14.1-2 | Currencies are never summed together | T |
| AC-M14.2-1 | Owner dashboard requires `dashboard.executive`; AR dashboard exposes no organization-wide financial totals | T |
| AC-M14.3-1 | Each report shows its definition; export respects filters and permissions, escapes formula characters and is audited | T |
| AC-M14.3-2 | Historical trend values do not change when a record is edited after the snapshot | T |

### M15 QuickBooks and Stripe
| ID | Criterion | By |
|---|---|---|
| AC-M15.1-1 | QuickBooks sync maps customers, invoices and payments idempotently; changed amounts on allocated records create conflicts | T (fixtures); sandbox — BLOCKED without credentials |
| AC-M15.2-1 | Stripe webhooks with bad signature or replayed ID are rejected/ignored | T |
| AC-M15.2-2 | Venn requests no write scope and performs no write call to either provider | R, T |
| AC-M15.3-1 | Integrations not yet live are labelled "coming soon" and cannot show a connected state | E |

### M16 Hardening and website
| ID | Criterion | By |
|---|---|---|
| AC-M16.1-1 | Owners must enrol MFA; step-up enforced on sensitive operations | T, E |
| AC-M16.1-2 | Rate limits enforced per user/org/IP; security headers and CSP present with the app fully functional | T |
| AC-M16.2-1 | With 100k invoices/150k payments: list p95 < 400 ms, dashboard < 1.5 s | T (perf) |
| AC-M16.3-1 | axe: no serious/critical violations on all main pages; keyboard walkthroughs recorded | T, M |
| AC-M16.4-1 | All public routes exist; contact form validated and rate-limited; claims review against SECURITY §11 passes | E, R |
| AC-M16.5-1 | Dependency, secret, container and ZAP baseline scans have no unaccepted high findings | T |
| AC-M16.5-2 | Incident runbook written | R |

### M17 Deployment readiness
| ID | Criterion | By |
|---|---|---|
| AC-M17.1-1 | Staging deploys from CI with migrations as a release step | M |
| AC-M17.2-1 | Scenarios A–J pass on staging; live-integration variants passed or explicitly BLOCKED | E |
| AC-M17.3-1 | Backup restored into a clean environment and verified | M |
| AC-M17.3-2 | Alerts fire for induced API errors, job failures and integrity-job failure | M |
| AC-M17.4-1 | Launch checklist (legal pages reviewed, sub-processors listed, name/trademark cleared, provider verifications status) signed by the product owner | Owner |

## 6. End-to-end scenario acceptance (summary)

| Scenario | Passes when |
|---|---|
| A | A new user verifies email, creates an organization, becomes Owner and lands on the dashboard with skipped steps listed |
| B | An invited employee joins the existing organization as AR Specialist; no new organization; Owner-only API calls return 403 |
| C | Duplicate invoices are detected, reported and not overwritten; counts are exact |
| D | Imported payments are matched per rules; only exact matches auto-apply; balances are correct |
| E | A short payment produces an investigation whose facts cite records, whose calculation is correct, and whose email/document claims remain unverified |
| F | An approved action is recorded, and a later verified payment yields an exact verified recovered amount |
| G | A collection email is drafted from facts, approved where required, sent once and logged |
| H | A dispute is tracked to resolution, pausing reminders and routing any adjustment through approval |
| I | A restricted financial action cannot be completed by its requester and is completed only after Owner approval |
| J | No UI or API path lets one organization read or change another's data |
