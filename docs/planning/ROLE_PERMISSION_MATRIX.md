# Venn — Role and Permission Matrix

Status: Phase 1 draft · Last updated 2026-11-13

## 1. Model

- A **user** has one **membership** per organization. A membership has one **role**.
- A **role** is a named set of **permissions**. Permissions are the unit the backend checks: every protected endpoint declares the permission key it requires.
- MVP ships two **system roles** per organization: `owner` and `ar_specialist`. System roles cannot be deleted or renamed.
- The Owner role always has every permission and cannot be edited (prevents lock-out).
- The AR Specialist role's permissions are **configurable per organization** within the limits in §3 (some permissions are *locked off* in MVP).
- Custom roles are post-MVP; the schema (`roles`, `permissions`, `role_permissions`) already supports them.
- The frontend receives the caller's effective permission list from `GET /api/v1/me` and uses it only to shape the UI. **Authorization is decided by the backend on every request.**

## 2. Permission catalog

| Key | Allows |
|---|---|
| `dashboard.executive` | Owner dashboard and organization-wide KPIs |
| `dashboard.operational` | AR dashboard (own queue and team operational counts) |
| `customers.view` / `customers.manage` | Read / create and edit customers and contacts |
| `invoices.view` / `invoices.manage` | Read / create, edit, cancel invoices |
| `invoices.import` | CSV import and PDF-extracted creation |
| `payments.view` / `payments.manage` | Read / create, edit, mark reversed |
| `payments.import` | CSV import |
| `reconciliation.run` | Start a reconciliation run |
| `reconciliation.allocate` | Confirm suggestions, create/edit/remove allocations |
| `investigations.view` / `investigations.manage` | Read / open, update, add evidence and notes, re-run analysis, choose action |
| `investigations.assign` | Assign to another member |
| `collections.view` / `collections.draft` | Read queue and timeline / create and edit drafts, schedule follow-ups |
| `collections.send` | Send a standard collection email without approval |
| `disputes.view` / `disputes.manage` | Read / create, update, resolve disputes |
| `documents.view` / `documents.upload` | Read / upload documents |
| `adjustments.request` | Request a write-off, credit, discount or refund record |
| `approvals.view_own` | See approval requests the user created |
| `approvals.decide` | See all requests and approve/reject |
| `analytics.view` | Analytics pages |
| `reports.operational` / `reports.financial` | Operational reports / organization-wide financial reports |
| `reports.export` | Export CSV |
| `integrations.view` / `integrations.manage` | See status / connect, configure, disconnect |
| `team.view` / `team.manage` | See members / invite, change role, suspend, edit role permissions |
| `audit.view` | Organization audit log |
| `settings.view` / `settings.manage` | Read / change organization settings and approval policies |
| `remittance.manage` | Change the bank/remittance details used in outgoing communication |

Record-level history ("who changed this invoice") is visible to anyone who can view the record; it is distinct from the organization audit log.

## 3. Default matrix

● granted · ○ not granted · ◐ granted with limits · 🔒 cannot be granted to this role in MVP

| Permission | Owner | AR Specialist (default) | Owner can change AR default? |
|---|:-:|:-:|:-:|
| `dashboard.executive` | ● | ○ | Yes |
| `dashboard.operational` | ● | ● | No (always on) |
| `customers.view` | ● | ● | No |
| `customers.manage` | ● | ● | Yes |
| `invoices.view` | ● | ● | No |
| `invoices.manage` | ● | ● | Yes |
| `invoices.import` | ● | ● | Yes |
| `payments.view` | ● | ● | No |
| `payments.manage` | ● | ● | Yes |
| `payments.import` | ● | ● | Yes |
| `reconciliation.run` | ● | ● | Yes |
| `reconciliation.allocate` | ● | ● | Yes |
| `investigations.view` | ● | ● | No |
| `investigations.manage` | ● | ● | Yes |
| `investigations.assign` | ● | ◐ self-assign and reassign own | Yes |
| `collections.view` / `collections.draft` | ● | ● | Yes |
| `collections.send` | ● | ○ (sends go to approval) | Yes |
| `disputes.view` / `disputes.manage` | ● | ● | Yes |
| `documents.view` / `documents.upload` | ● | ● | Yes |
| `adjustments.request` | ● | ● | Yes |
| `approvals.view_own` | ● | ● | No |
| `approvals.decide` | ● | 🔒 | No |
| `analytics.view` | ● | ◐ operational pages | Yes |
| `reports.operational` | ● | ● | Yes |
| `reports.financial` | ● | ○ | Yes |
| `reports.export` | ● | ● | Yes |
| `integrations.view` | ● | ● (status only) | Yes |
| `integrations.manage` | ● | 🔒 | No |
| `team.view` | ● | ● (names and roles) | Yes |
| `team.manage` | ● | 🔒 | No |
| `audit.view` | ● | ○ | Yes |
| `settings.view` | ● | ○ | Yes |
| `settings.manage` | ● | 🔒 | No |
| `remittance.manage` | ● + re-authentication | 🔒 | No |

## 4. Mapping to the brief's operation table

| Operation | Owner | AR Specialist | Enforced by |
|---|---|---|---|
| View financial dashboard | Yes | Operational view | `dashboard.executive` vs `dashboard.operational` |
| View invoices | Yes | Yes | `invoices.view` |
| Import records | Yes | If authorized (default yes) | `invoices.import`, `payments.import` |
| Match payments | Yes | Yes | `reconciliation.allocate` |
| Investigate discrepancies | Yes | Yes | `investigations.manage` |
| Draft collection emails | Yes | Yes | `collections.draft` |
| Send collection emails | Configurable | Configurable (default: via approval) | `collections.send` + approval policy |
| Approve write-offs | Yes | No | `approvals.decide` |
| Issue refunds (record a refund decision) | Yes | Request only | `adjustments.request` + approval; `approvals.decide` |
| Change bank details | Restricted | No | `remittance.manage` + re-auth |
| Invite employees / change roles | Yes | No | `team.manage` |
| Manage integrations | Yes | No | `integrations.manage` |
| View audit logs | Yes | Restricted (off by default) | `audit.view` |
| Change organization settings | Yes | No | `settings.manage` |

## 5. Approval policies (separate from permissions)

A permission says *who may attempt* an action. A policy says *whether the attempt needs a second person*.

| Action type | Default policy | Configurable |
|---|---|---|
| `write_off` | Always requires approval by a user with `approvals.decide` | Threshold may be raised from 0 by Owner |
| `refund_record` | Always requires approval | No |
| `credit` / `discount` | Requires approval above threshold (default 0.00 = always) | Threshold per currency |
| `collection_email` standard reminder | Requires approval unless sender has `collections.send` | Via the permission |
| `collection_email` final notice / escalation | Always requires approval | No |
| `allocation_reversal` on a closed period or > 30 days old | Requires approval | Days configurable |
| `remittance_change` | Owner only, re-authentication, all owners notified | No |
| `invoice_cancel` with payments allocated | Blocked: allocations must be removed first | No |

### Separation of duties

- A requester cannot decide their own request.
- **Exception:** an organization with exactly one active Owner. That Owner's sensitive actions skip the queue but require a typed confirmation and are logged as `owner_direct_action`.
- Decisions are immutable; a wrong decision is corrected by a new, linked request.

## 6. Membership rules

1. An organization must always have ≥ 1 active Owner. Demoting, suspending or removing the last Owner is rejected.
2. Suspending a member takes effect on their next request (membership status is checked per request, not cached in the token).
3. Role or permission changes are audit-logged with before/after.
4. An invitation carries a role; the role is applied only at acceptance and can be changed by an Owner before acceptance.
5. Assigned work of a suspended member is surfaced to Owners for reassignment.

## 7. Data scoping for AR Specialists

MVP: AR Specialists see all customers and invoices in their organization (small teams share work). "Assigned to me" is a default filter, not a security boundary. Per-customer or per-portfolio data restrictions are post-MVP.

## 8. Enforcement points

| Layer | Mechanism |
|---|---|
| API | `require_permission("key")` dependency on every route; missing permission → `403` with code `permission_denied` |
| Service | Policy check before any adjustment, send or sensitive change; creates an approval request instead of executing when required |
| Database | RLS policy on every tenant table: `organization_id = current_setting('app.org_id')::uuid`; audit table has no UPDATE/DELETE grant |
| Frontend | Hide or disable controls from the permission list; show "Requires approval" affordances |
| Tests | A generated test iterates every route × role and asserts allow/deny against this matrix |
