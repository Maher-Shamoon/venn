# Venn — API Specification

Status: Phase 1 draft · Last updated 2026-11-13

REST over HTTPS, JSON, base path `/api/v1`. FastAPI generates the OpenAPI document, which is the binding contract once implemented; this file defines its shape. The frontend's types are generated from it.

## 1. Conventions

### 1.1 Authentication and tenant context
- `Authorization: Bearer <Supabase access token>` on every request except the public ones marked below.
- `X-Organization-Id: <uuid>` on every organization-scoped request. The server verifies an **active membership** for the caller in that organization; otherwise `403 not_a_member`. Any `organization_id` in a body or query is ignored.
- Email must be verified, else `403 email_not_verified`.

### 1.2 Requests
- `Idempotency-Key: <uuid>` required on `POST` endpoints that create or act (marked ⟳). Same key + same body → original response; same key + different body → `409 idempotency_conflict`.
- Updates use `PATCH` with `If-Match: <version>` (or `version` in the body). Mismatch → `409 version_conflict`.
- Money: strings with up to 4 decimals (`"1000.00"`), always with `currency`.
- Dates `YYYY-MM-DD`; timestamps RFC 3339 UTC.

### 1.3 Responses
```json
{ "data": { ... } }
{ "data": [ ... ], "meta": { "next_cursor": "…", "has_more": true, "total": 1234 } }
```
- `total` is included only when `?include_total=true` and the count is cheap.
- Long-running operations return `202` with `{ "data": { "job_id": "…" } }`; poll `GET /jobs/{id}`.
- Actions diverted to approval return `202` with `{ "data": { "approval_id": "…", "status": "pending" } }`.

### 1.4 Errors (RFC 9457 `application/problem+json`)
```json
{
  "type": "https://docs.venn.example/errors/validation_error",
  "title": "Validation failed",
  "status": 422,
  "code": "validation_error",
  "detail": "amount must be greater than 0",
  "errors": [{ "field": "allocations[0].amount", "code": "greater_than", "message": "…" }],
  "request_id": "req_…"
}
```
| Status | Codes |
|---|---|
| 400 | `bad_request`, `invalid_cursor` |
| 401 | `unauthenticated`, `token_expired` |
| 403 | `permission_denied`, `not_a_member`, `membership_suspended`, `email_not_verified`, `reauthentication_required` |
| 404 | `not_found` (also returned for records in other tenants — existence is never revealed) |
| 409 | `version_conflict`, `idempotency_conflict`, `duplicate`, `invalid_state`, `approval_stale` |
| 422 | `validation_error`, `business_rule_violation` (e.g. `allocation_exceeds_balance`, `currency_mismatch`, `last_owner`) |
| 429 | `rate_limited` (with `Retry-After`) |
| 5xx | `internal_error`, `upstream_unavailable` |

### 1.5 Lists
`?cursor=&limit=25` (max 100) · `?sort=-due_date` (allow-listed fields) · filters as query params (`status=overdue&customer_id=…&due_date_from=…&due_date_to=…&amount_min=…`) · `?q=` search. Unknown filter → 400.

### 1.6 Rate limits (initial)
Per user 300 req/min; per organization 1,200 req/min; auth-adjacent and invitation endpoints 10/min per IP; AI-triggering endpoints 20/min per organization; exports 10/hour per user.

## 2. Endpoint groups

Columns: method and path · permission · notes. ⟳ = idempotency key required. All paths are under `/api/v1`.

### 2.1 Session and identity — `/me`, `/auth`
Sign-in, sign-up, verification and password reset are performed by the Supabase client; the API exposes only what needs server logic.

| Endpoint | Permission | Notes |
|---|---|---|
| `GET /me` | authenticated | Profile, memberships (org, role, status), effective permissions for the active org, onboarding state |
| `PATCH /me` | authenticated | Name, notification preferences, last active org |
| `POST /auth/reauthenticate` | authenticated | Verifies a fresh password/MFA proof; returns a short-lived step-up token used for `remittance.manage` |
| `GET /invitations/{token}` | public (rate-limited) | Org name, inviter, role, invited email, status |
| `POST /invitations/{token}/accept` ⟳ | authenticated | Caller email must equal invited email; creates membership in the inviting org |

### 2.2 Organizations — `/organizations`
| Endpoint | Permission | Notes |
|---|---|---|
| `POST /organizations` ⟳ | authenticated, no pending invitation flow | Creates org, owner membership, system roles, default policies in one transaction |
| `GET /organizations/current` | member | |
| `PATCH /organizations/current` | `settings.manage` | Profile and financial preferences |
| `GET/PUT /organizations/current/approval-policies` | `settings.view` / `settings.manage` | Locked policies reject changes |
| `PUT /organizations/current/remittance` | `remittance.manage` + step-up token | Notifies all owners; audit |
| `PATCH /organizations/current/onboarding` | `settings.manage` | Step progress |
| `POST /organizations/current/demo-data` / `DELETE …` | `settings.manage` | Load/remove labelled sample data |

### 2.3 Members and roles — `/members`, `/roles`
| Endpoint | Permission | Notes |
|---|---|---|
| `GET /members` | `team.view` | AR sees name, role, status only |
| `GET /members/{id}` | `team.manage` | Includes activity summary |
| `PATCH /members/{id}` | `team.manage` | Role, status (`active`/`suspended`); `422 last_owner` guard |
| `DELETE /members/{id}` | `team.manage` | Sets `removed` |
| `GET /members/invitations` | `team.manage` | |
| `POST /members/invitations` ⟳ | `team.manage` | `{email, role_key}`; 409 if already member/pending |
| `POST /members/invitations/{id}/resend` | `team.manage` | New token, old one invalid |
| `DELETE /members/invitations/{id}` | `team.manage` | Revoke |
| `GET /roles` | `team.view` | Roles with permissions |
| `PUT /roles/{id}/permissions` | `team.manage` | Only grantable keys; owner role immutable |
| `GET /permissions` | `team.view` | Catalog |

### 2.4 Customers — `/customers`
| Endpoint | Permission |
|---|---|
| `GET /customers`, `GET /customers/{id}` | `customers.view` |
| `POST /customers` ⟳, `PATCH /customers/{id}` | `customers.manage` |
| `POST /customers/{id}/archive` | `customers.manage` |
| `GET/POST/PATCH/DELETE /customers/{id}/contacts[/{cid}]` | `customers.view` / `customers.manage` |
| `GET /customers/{id}/summary` | `customers.view` — balance, overdue, payment behaviour facts |
| `GET /customers/{id}/timeline` | `customers.view` |

Customer response (abridged): `id, name, external_id, default_currency, payment_terms_days, status, balances: [{currency, open_balance, overdue_balance}], stats: {avg_days_to_pay, late_share, open_invoices}`.

### 2.5 Invoices — `/invoices`
| Endpoint | Permission | Notes |
|---|---|---|
| `GET /invoices` | `invoices.view` | Filters: `display_status`, `is_overdue`, `is_disputed`, `payment_state`, `customer_id`, date ranges, amount range, `currency`, `has_investigation`, `q` |
| `GET /invoices/{id}` | `invoices.view` | Includes allocations, adjustments, related cases |
| `POST /invoices` ⟳ | `invoices.manage` | 409 `duplicate` on number+customer |
| `PATCH /invoices/{id}` | `invoices.manage` | `total_amount` immutable once allocations exist → 422 |
| `POST /invoices/{id}/issue` | `invoices.manage` | draft → issued |
| `POST /invoices/{id}/cancel` | `invoices.manage` | 422 if active allocations |
| `GET /invoices/{id}/history` | `invoices.view` | Record-level audit view |
| `POST /invoices/{id}/adjustments` ⟳ | `adjustments.request` | `{type, amount, reason}` → 201 applied or 202 approval |
| `GET /invoices/summary` | `invoices.view` | Totals for the current filter |

Invoice response (abridged):
```json
{
  "id": "…", "invoice_number": "INV-1042",
  "customer": { "id": "…", "name": "Northwind Labs" },
  "issue_date": "2026-09-01", "due_date": "2026-10-01",
  "currency": "USD", "total_amount": "5000.00",
  "amount_paid": "4000.00", "amount_adjusted": "0.00", "balance_due": "1000.00",
  "lifecycle_status": "issued", "payment_state": "partially_paid",
  "is_overdue": true, "is_disputed": false, "display_status": "overdue",
  "days_overdue": 43, "version": 3
}
```

### 2.6 Payments and allocations — `/payments`
| Endpoint | Permission | Notes |
|---|---|---|
| `GET /payments`, `GET /payments/{id}` | `payments.view` | Filters: `status`, `source`, `customer_id`, dates, `has_unallocated` |
| `POST /payments` ⟳ | `payments.manage` | Manual entry → `verification_level = manual` |
| `PATCH /payments/{id}` | `payments.manage` | Amount immutable once allocated |
| `POST /payments/{id}/reverse` ⟳ | `payments.manage` | Voids allocations; policy may divert to approval |
| `GET /payments/{id}/suggestions` | `payments.view` | Deterministic candidates with reasons |
| `POST /payments/{id}/allocations` ⟳ | `reconciliation.allocate` | `{allocations: [{invoice_id, amount}]}`; all-or-nothing |
| `DELETE /payments/{id}/allocations/{aid}` | `reconciliation.allocate` | Void with `reason`; old allocations may need approval |

Validation on allocation: same currency; Σ ≤ unallocated; each ≤ invoice balance; invoice issued and not cancelled. Violations → `422 business_rule_violation` with a specific sub-code.

### 2.7 Imports — `/imports`
| Endpoint | Permission | Notes |
|---|---|---|
| `POST /imports` ⟳ | `invoices.import` or `payments.import` by `kind` | Creates batch + upload slot |
| `POST /imports/{id}/mapping` | same | Saves mapping; starts validation job |
| `GET /imports/{id}` | same | Status and counters |
| `GET /imports/{id}/rows?status=` | same | Preview rows with messages |
| `POST /imports/{id}/commit` ⟳ | same | Starts import job → 202 |
| `POST /imports/{id}/cancel` | same | |
| `GET /imports/{id}/errors.csv` | same | |
| `GET /imports` | same | History |

### 2.8 Reconciliation — `/reconciliation`
| Endpoint | Permission |
|---|---|
| `POST /reconciliation/runs` ⟳ | `reconciliation.run` → 202 job |
| `GET /reconciliation/runs`, `GET /reconciliation/runs/{id}` | `payments.view` |
| `GET /reconciliation/matches?status=suggested` | `payments.view` |
| `POST /reconciliation/matches/{id}/confirm` ⟳ | `reconciliation.allocate` — optional edited allocations |
| `POST /reconciliation/matches/{id}/reject` | `reconciliation.allocate` |
| `POST /reconciliation/matches/{id}/undo` ⟳ | `reconciliation.allocate` — for auto-applied |
| `GET /reconciliation/summary` | `payments.view` |
| `GET /discrepancies`, `GET /discrepancies/{id}` | `investigations.view` |
| `POST /discrepancies` ⟳ | `investigations.manage` — user-reported |
| `POST /discrepancies/{id}/dismiss` | `investigations.manage` — reason required |

### 2.9 Investigations — `/investigations`
| Endpoint | Permission | Notes |
|---|---|---|
| `GET /investigations`, `GET /investigations/{id}` | `investigations.view` | Detail embeds current analysis, findings, recommendations |
| `POST /investigations` ⟳ | `investigations.manage` | From `discrepancy_id` or manual |
| `PATCH /investigations/{id}` | `investigations.manage` | Priority, title, follow-up date |
| `POST /investigations/{id}/assign` | `investigations.assign` | |
| `POST /investigations/{id}/analyze` ⟳ | `investigations.manage` | → 202 job; new analysis version |
| `GET /investigations/{id}/analyses` | `investigations.view` | Version history |
| `GET/POST/DELETE /investigations/{id}/evidence[/{eid}]` | view / manage | Add by record link or document upload |
| `POST /investigations/{id}/findings` | `investigations.manage` | User-authored finding (`origin = user`) |
| `POST /investigations/{id}/actions` ⟳ | `investigations.manage` | `{action_key, payload, reason}`; server decides execute vs approval |
| `POST /investigations/{id}/resolve` | `investigations.manage` | Outcome; `recovered_verified` requires verified allocations, else 422 |
| `POST /investigations/{id}/dismiss` | `investigations.manage` | |
| `GET /investigations/{id}/timeline` | `investigations.view` | |
| `GET/POST /notes?record_type=&record_id=` | view/manage of the record | Shared notes |

Analysis response (abridged):
```json
{
  "version_no": 2, "status": "completed", "is_stale": false,
  "narrative": "Invoice INV-1042 was issued for 5,000.00 USD …",
  "narrative_citations": [{ "span": [0, 52], "evidence_ids": ["ev_1"] }],
  "calculations": [{ "label": "Outstanding", "expression": "5000.00 - 4000.00", "result": "1000.00", "currency": "USD" }],
  "findings": [
    { "category": "confirmed_fact", "statement": "…", "evidence_ids": ["ev_1","ev_2"], "origin": "deterministic" },
    { "category": "unverified_claim", "statement": "…", "evidence_ids": ["ev_5"], "origin": "ai" }
  ],
  "recommendations": [{ "action_key": "request_proof_of_payment", "is_primary": true, "requires_approval": false, "rationale": "…" }]
}
```

### 2.10 Collections — `/collections`
| Endpoint | Permission |
|---|---|
| `GET /collections/cases`, `GET /collections/cases/{id}` | `collections.view` |
| `PATCH /collections/cases/{id}` | `collections.draft` — stage, owner, next action, promise, pause |
| `POST /collections/cases/{id}/drafts` ⟳ | `collections.draft` — `{template_key, tone}` → AI draft |
| `PATCH /messages/{id}` | `collections.draft` |
| `POST /messages/{id}/send` ⟳ | `collections.draft` — server: send if `collections.send` and standard template, else 202 approval |
| `POST /messages/{id}/mark-sent` | `collections.draft` — manual send record |
| `POST /collections/cases/{id}/activities` | `collections.draft` — note, call, promise |

### 2.11 Disputes — `/disputes`
`GET /disputes`, `GET /disputes/{id}` (`disputes.view`) · `POST /disputes` ⟳, `PATCH /disputes/{id}`, `POST /disputes/{id}/status`, `POST /disputes/{id}/resolve` ⟳ (`disputes.manage`; a resolution with an adjustment creates an approval) · evidence and timeline as investigations.

### 2.12 Approvals — `/approvals`
| Endpoint | Permission | Notes |
|---|---|---|
| `GET /approvals` | `approvals.decide` (all) or `approvals.view_own` (own only, enforced server-side) | |
| `GET /approvals/{id}` | same | Includes impact, evidence, events, `is_stale` |
| `POST /approvals/{id}/approve` ⟳ | `approvals.decide` | 403 if caller is requester; 409 `approval_stale` |
| `POST /approvals/{id}/reject` ⟳ | `approvals.decide` | Comment required |
| `POST /approvals/{id}/request-info` | `approvals.decide` | |
| `POST /approvals/{id}/respond` | requester | Adds info, returns to pending |
| `POST /approvals/{id}/withdraw` | requester | |

There is no "create approval" endpoint: approvals are created only by the policy service when an action requires one.

### 2.13 Documents — `/documents`
`POST /documents` ⟳ (upload slot; `documents.upload`) · `POST /documents/{id}/complete` · `GET /documents`, `GET /documents/{id}` · `GET /documents/{id}/download` (signed URL, 60 s) · `GET /documents/{id}/extraction` · `POST /documents/{id}/extraction/confirm` ⟳ (`invoices.import`; creates/links the record) · `POST /documents/{id}/link`.

### 2.14 Email — `/email`
`GET /email/messages` (filters: customer, invoice, classification, needs_review; `investigations.view`) · `GET /email/messages/{id}` · `POST /email/links/{id}/confirm|reject` (`investigations.manage`).

### 2.15 Integrations — `/integrations`
| Endpoint | Permission |
|---|---|
| `GET /integrations` | `integrations.view` — catalog with per-org status |
| `POST /integrations/{provider}/connect` | `integrations.manage` — returns authorization URL |
| `GET /integrations/{provider}/callback` | public; validated by signed `state` bound to org + user |
| `GET /integrations/connections/{id}` | `integrations.view` |
| `PATCH /integrations/connections/{id}` | `integrations.manage` — settings |
| `POST /integrations/connections/{id}/sync` ⟳ | `integrations.manage` |
| `GET /integrations/connections/{id}/sync-runs` | `integrations.view` |
| `DELETE /integrations/connections/{id}` | `integrations.manage` — `{data: "keep" | "delete"}` |
| `POST /webhooks/stripe`, `/webhooks/quickbooks` | public; signature verified; idempotent on event id |

### 2.16 Analytics and reports — `/analytics`, `/reports`
| Endpoint | Permission |
|---|---|
| `GET /analytics/dashboard/executive` | `dashboard.executive` |
| `GET /analytics/dashboard/operational` | `dashboard.operational` |
| `GET /reports/aging?as_of=&currency=` | `reports.financial` |
| `GET /reports/outstanding-trend`, `/overdue-trend`, `/collection-effectiveness`, `/verified-recovery`, `/customer-payment-behaviour` | `reports.financial` |
| `GET /reports/reconciliation-performance`, `/discrepancy-categories`, `/investigation-resolution` | `reports.operational` |
| `POST /reports/{slug}/export` ⟳ | `reports.export` + the report's permission → job → signed URL |

Every report response includes `definition` (the formula in words) and `generated_at`. Every aggregate has a matching list filter so the UI can drill down.

### 2.17 Audit, notifications, tasks, jobs, search
- `GET /audit-logs` (`audit.view`; filters actor, action, record, dates) · `GET /audit-logs/{id}` · `POST /audit-logs/export` ⟳ · `GET /audit-logs/verify` (hash-chain check).
- `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`.
- `GET/POST/PATCH /tasks`.
- `GET /jobs/{id}` (creator or relevant permission).
- `GET /search?q=` — invoices, customers, payments, investigations the caller may view.

### 2.18 Operational
`GET /healthz` (liveness), `GET /readyz` (DB, Redis) — public, no data.

## 3. Standard tests for every group

| Test class | Assertion |
|---|---|
| Contract | Response validates against the OpenAPI schema |
| AuthN | No/expired token → 401 |
| Tenant | Org B token cannot read or mutate Org A's record → 404, and no state change |
| RBAC | Generated allow/deny matrix from ROLE_PERMISSION_MATRIX |
| Validation | Bad types, negative/zero money, >4 decimals, unknown currency → 422 |
| Idempotency | Repeat with same key → same response, single side effect |
| Concurrency | Stale version → 409 |
| Pagination | Stable ordering, no duplicates/skips across cursors |
| Audit | Mutation produces exactly one matching audit row |

## 4. Versioning

Additive changes within `/v1`. Breaking changes require `/v2`. Deprecations are announced through response headers. There is no public API commitment in MVP; the web app is the only consumer.
