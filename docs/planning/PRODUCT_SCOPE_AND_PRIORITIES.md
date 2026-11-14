# Venn — Product Scope and Priorities

Status: Phase 1 draft · Last updated 2026-11-13

## 1. Scoping principle

Build one complete workflow before building breadth:

> Import financial records → detect discrepancy → retrieve evidence → generate investigation → recommend action → obtain approval → perform authorized action → verify outcome.

Anything that does not serve this slice waits until the slice works end to end on real imported data.

## 2. Release stages

| Stage | Purpose | Exit condition |
|---|---|---|
| **MVP-Core** (roadmap M4–M11) | The vertical slice on CSV/PDF/manual data | End-to-end scenarios A–F, I, J pass |
| **MVP-Complete** (M12–M17) | Collections, disputes, analytics, first live integrations, hardening | All scenarios A–J pass; security checklist complete |
| **Post-MVP** | Breadth: more integrations, portal, FX, custom roles | Driven by customer feedback |
| **Enterprise** | SSO, ERPs, residency, advanced controls | Driven by sales demand |

## 3. Feature priority table

Legend: ● in scope, ◐ reduced scope, ○ not in stage.

| Area | Capability | MVP-Core | MVP-Complete | Post-MVP | Enterprise |
|---|---|:-:|:-:|:-:|:-:|
| Auth | Email/password, verification, reset | ● | | | |
| Auth | MFA (TOTP) for owners | ○ | ● | | |
| Auth | SSO/SAML, SCIM | ○ | ○ | ○ | ● |
| Org | Create org, profile, currency, timezone | ● | | | |
| Org | Invitations, memberships, suspend | ● | | | |
| Org | Multiple organizations per user (switcher) | ◐ data model only | ● | | |
| Org | Multi-entity under one parent | ○ | ○ | ○ | ● |
| RBAC | Owner + AR Specialist system roles, configurable permission toggles | ● | | | |
| RBAC | Custom roles | ○ | ○ | ● | |
| Customers | Profiles, contacts, balances, history | ● | | | |
| Customers | Data-derived risk indicators | ◐ avg days late, overdue share | ● | | |
| Invoices | CSV import, manual entry, duplicate detection | ● | | | |
| Invoices | PDF upload + AI extraction with human review | ● | | | |
| Invoices | Line items | ◐ stored when present, not required | ● | | |
| Payments | CSV import, manual entry, allocations | ● | | | |
| Payments | Reversal handling | ● | | | |
| Reconciliation | Deterministic rules R1–R8, suggestions, discrepancies | ● | | | |
| Reconciliation | AI ranking of ambiguous candidates | ◐ | ● | | |
| Reconciliation | Learned per-customer matching rules | ○ | ○ | ● | |
| Investigations | Full workspace on records + uploaded documents | ● | | | |
| Investigations | Email evidence | ○ | ● | | |
| Investigations | Contract-term analysis (late fees, payment terms clauses) | ○ | ◐ extraction + citation only | ● | |
| Approvals | Policies, queue, decisions, history | ● | | | |
| Approvals | Multi-step chains, amount tiers, delegation | ○ | ○ | ● | |
| Audit | Append-only log + viewer | ● | | | |
| Audit | Tamper-evident hash chain, export API | ◐ hash chain | ● export CSV | | ● API/SIEM |
| Collections | Queue, priority, drafts, approval, timeline | ○ | ● | | |
| Collections | Scheduled sequences (cadences) | ○ | ◐ single scheduled follow-up | ● | |
| Disputes | Create, categorise, evidence, timeline, resolve | ○ | ● | | |
| Dashboards | Owner + AR dashboards with drill-down | ◐ core KPIs | ● | | |
| Analytics | Aging, trends, categories, resolution time, recovery; CSV export | ○ | ● | | |
| Reports | Scheduled email reports, PDF | ○ | ○ | ● | |
| Integrations | CSV, PDF, manual | ● | | | |
| Integrations | Gmail | ○ | ● | | |
| Integrations | QuickBooks Online (read) | ○ | ● | | |
| Integrations | Stripe (read) | ○ | ● | | |
| Integrations | Outlook, Xero | ○ | ○ | ● | |
| Integrations | Bank feeds | ○ | ○ | ● | |
| Integrations | Accounting write-back | ○ | ○ | ● | |
| Integrations | NetSuite, SAP, Dynamics | ○ | ○ | ○ | ● |
| Portal | Customer-facing dispute/proof portal | ○ | ○ | ● | |
| Currency | Per-record currency, same-currency matching | ● | | | |
| Currency | FX rates and converted reporting | ○ | ○ | ● | |
| Notifications | In-app + email for approvals, assignments | ◐ in-app | ● | | |
| Website | Marketing site, all public routes | ○ | ● | | |
| Billing | Subscription billing for Venn itself | ○ | ○ (manual invoicing of pilots) | ● | |

## 4. Mandatory controls — in every stage, never descoped

1. Decimal money, explicit currency.
2. `organization_id` on every tenant table, enforced in repository layer and RLS.
3. Backend permission check on every protected endpoint.
4. Audit row in the same transaction as every financial or permission change.
5. Idempotent imports and mutations.
6. No auto-finalisation of uncertain matches.
7. Email claims never mark an invoice paid.
8. AI output validated against a schema; every finding cites stored evidence; arithmetic recomputed in code.
9. Secrets only in environment/secret store; OAuth tokens encrypted at rest.
10. Mock or unavailable integrations are labelled as such in the UI.

## 5. Explicitly deferred, with reason

| Deferred | Reason |
|---|---|
| Moving money (refund execution, payment initiation) | Regulatory and fraud exposure; not needed to prove the product |
| Customer portal | Second user type, second auth model; investigate value after internal workflow works |
| Bank feeds | Aggregator contracts, per-connection cost, regional coverage; CSV export from the bank covers MVP |
| FX | Needs a rate-source decision and accounting policy per customer |
| Custom roles and multi-step approvals | Two roles and single-step approval cover the target segment |
| Venn subscription billing | Pilot customers can be invoiced manually; avoids building billing before pricing is validated |
| "Financial Reporting Assistant" chat | Risk of ungrounded numbers; analytics are deterministic queries first |

## 6. Sequencing rationale

1. **Foundation with controls first** (auth, orgs, RBAC, audit, approval core): every later feature depends on them and they are expensive to retrofit.
2. **Data in** (customers, invoices, payments via CSV): no external credentials needed, fully testable.
3. **Reconciliation**: deterministic, the source of all discrepancies.
4. **Investigation Engine v1**: the differentiator, proven on local data.
5. **Collections and disputes**: reuse evidence, drafting and approval components.
6. **Live integrations last**: each needs third-party app review; none blocks the core.
