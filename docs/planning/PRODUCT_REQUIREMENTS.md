# Venn — Product Requirements

Status: Phase 1 draft for product-owner review · Last updated 2026-11-13

Related: [scope](PRODUCT_SCOPE_AND_PRIORITIES.md) · [personas](USER_PERSONAS_AND_USE_CASES.md) · [features](FEATURE_SPECIFICATION.md) · [roadmap](DEVELOPMENT_ROADMAP.md)

## 1. Vision

Venn is a B2B SaaS accounts receivable (AR) operations platform. It connects a company's invoices, received payments, documents and customer email, finds the places where they disagree, investigates each disagreement with cited evidence, recommends a next action, and tracks that action through human approval to a verified outcome.

**Mission:** help businesses collect money they are legitimately owed, through evidence-backed investigations and human-approved workflows.

**One-line positioning:** *Find the revenue slipping through the cracks.*

## 2. What Venn is — and is not

| Venn is | Venn is not |
|---|---|
| A system of *investigation and workflow* layered on top of accounting and payment data | A general ledger or accounting system. The accounting system stays the book of record |
| A reconciliation engine using deterministic rules, with AI assistance for ambiguous cases | An AI chatbot that answers finance questions |
| A tool that drafts and sends collection communication under an approval policy | A debt-collection agency or a legal service |
| A recorder of approved financial decisions (write-off, credit, refund) with a full audit trail | A payment processor. **Venn never moves money** (see Decision D-03) |
| Honest about uncertainty: facts, hypotheses and missing evidence are shown separately | A guarantee of recovery. Venn never promises recovered revenue |

## 3. Core problem

Financial information for a service business lives in disconnected places: invoices in accounting software, payments in bank and gateway records, promises and disputes in email threads, terms in contract PDFs, tracking in spreadsheets. The result: short payments nobody chased, payments nobody allocated, duplicates nobody refunded or credited, disputes that stall in an inbox, and overdue invoices followed up inconsistently.

## 4. Target customer (initial)

B2B service businesses of roughly 10–200 employees that issue tens to low thousands of invoices a month and have 1–5 people touching AR: software agencies, IT consultancies, managed service providers, staffing and recruitment firms, professional-services firms.

Why this segment: invoices are high-value and negotiated (time-and-materials, retainers, milestones, POs), so discrepancies are frequent and each is worth investigating; the finance team is small; enterprise AR suites are priced and implemented for much larger companies (see [COMPETITIVE_POSITIONING.md](COMPETITIVE_POSITIONING.md) for what is verified).

## 5. Product goals

| # | Goal | How we will know (measured from stored records, never estimated) |
|---|---|---|
| G1 | A new organization reaches first value quickly | Time from signup to first detected discrepancy after a CSV import: target under 15 minutes |
| G2 | Reconciliation is trustworthy | 0 auto-applied matches that a user later reverses as wrong in the evaluation dataset; every allocation traceable |
| G3 | Investigations are evidence-grounded | 100% of AI findings cite at least one stored evidence item; calculations reproduced by deterministic code |
| G4 | Sensitive actions are controlled | 100% of consequential actions pass a backend permission check and (where policy requires) an approval record |
| G5 | Tenants are isolated | Automated cross-tenant test suite passes on every build |
| G6 | Reported recovery is real | "Verified recovered amount" only counts money backed by a verified payment record allocated after Venn activity on that invoice |

## 6. Non-goals (MVP)

- Issuing invoices to customers (invoices originate in the accounting system or are imported).
- Moving money: executing refunds, initiating payments, storing card or bank credentials for payment.
- Customer-facing payment portal (post-MVP; see scope).
- Credit scoring from external bureaus, credit insurance, factoring.
- Multi-entity consolidation, FX revaluation, tax computation.
- Mobile native apps (the web app is responsive; tables are optimised for ≥1024px).

## 7. Anti-goals (would make Venn a failure even if it "works")

1. A number on screen that cannot be traced to stored records.
2. An AI statement presented as fact without evidence, or an email claim treated as a received payment.
3. An AR Specialist able to perform an Owner-only action by calling the API directly.
4. One organization seeing another organization's data.
5. A silent overwrite of a financial record.
6. A marketing claim, testimonial, logo or statistic that is not true.
7. A simulated integration presented as a live connection.

## 8. Functional requirements (summary)

Detailed behaviour is in [FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md). Priority: **M** = MVP, **P** = post-MVP, **E** = enterprise stage.

| ID | Requirement | Pri |
|---|---|---|
| FR-01 | Email/password signup, email verification, password reset, secure sessions (Supabase Auth) | M |
| FR-02 | Organization creation with profile, default currency, timezone | M |
| FR-03 | Invite employees by email into the *existing* organization with a role; accept as new or existing user | M |
| FR-04 | Role-based access control enforced in the backend; two system roles (Owner, AR Specialist) with configurable permissions | M |
| FR-05 | Customer records with contacts, balances, history | M |
| FR-06 | Invoice import (CSV), manual entry, PDF upload with AI extraction reviewed by a human; duplicate detection | M |
| FR-07 | Payment import (CSV: bank export or gateway export), manual entry; idempotent | M |
| FR-08 | Many-to-many payment-to-invoice allocation with database-enforced limits | M |
| FR-09 | Deterministic reconciliation engine producing matches, suggestions and discrepancies | M |
| FR-10 | Investigation workspace: overview, narrative, evidence, findings, recommendation, approval, resolution | M |
| FR-11 | Approval Center with policies for write-offs, refunds, credits, discounts, sensitive communication, remittance-detail changes | M |
| FR-12 | Append-only audit log of security and financial events | M |
| FR-13 | Collections queue, AI-drafted reminders, approval, sending via connected mailbox, timeline | M |
| FR-14 | Disputes with category, evidence, timeline, resolution | M |
| FR-15 | Owner dashboard and AR dashboard with KPI drill-down to records | M |
| FR-16 | Analytics: aging, overdue trend, discrepancy categories, resolution time, verified recovery; CSV export | M |
| FR-17 | Gmail integration (OAuth, read financial correspondence, send approved messages) | M (late) |
| FR-18 | QuickBooks Online read sync (customers, invoices, payments) | M (late) |
| FR-19 | Stripe read-only sync (charges, payouts, refunds) | M (late) |
| FR-20 | In-app notifications and assigned tasks | M |
| FR-21 | Outlook / Microsoft Graph, Xero | P |
| FR-22 | Bank feeds via an aggregator (Plaid or similar) and `bank_transactions` ledger | P |
| FR-23 | Customer portal for dispute collaboration and payment-proof upload | P |
| FR-24 | Write-back to accounting system (credit notes, payment application) | P |
| FR-25 | Custom roles, multi-step approval chains, amount-tiered approvers | P |
| FR-26 | Multi-currency reporting with FX rates | P |
| FR-27 | SSO/SAML, SCIM, data residency options, multi-entity | E |
| FR-28 | ERP integrations (NetSuite, SAP, Dynamics), custom retention, audit export API | E |

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| Money | `Decimal` end to end; `NUMERIC(19,4)` in PostgreSQL; amounts cross the API as strings; currency always explicit |
| Integrity | Every financial mutation runs in a DB transaction and writes an audit row in the same transaction |
| Idempotency | Imports, webhooks and all `POST` mutations accept an idempotency key; replays return the original result |
| Tenancy | Every organization-scoped table has `organization_id`; enforced by repository layer **and** PostgreSQL row-level security |
| Performance (MVP targets) | List endpoints p95 < 400 ms at 100k invoices per org; CSV import of 10k rows < 60 s in the background; dashboard < 1.5 s |
| Availability | Single region, daily backups with point-in-time recovery, documented restore drill before launch |
| Accessibility | WCAG 2.1 AA for the application and the website |
| Browser support | Latest two versions of Chrome, Edge, Safari, Firefox |
| Observability | Structured logs with request ID and organization ID (never financial payloads or tokens), error tracking, AI run tracing with token/cost |
| AI safety | Documents and emails are data, never instructions; AI has read-only tools; all writes go through approved, deterministic services |

## 10. Requirements I challenged or tightened

These change or sharpen the original brief. Each is listed for approval in [RISKS_AND_ASSUMPTIONS.md](RISKS_AND_ASSUMPTIONS.md).

| # | Original | Problem | Proposed |
|---|---|---|---|
| C-1 | "Issue refunds" as an operation | Executing refunds means moving money: licensing, fraud and liability exposure far beyond an MVP | Venn records an *approved refund decision* and the user executes it in their bank/gateway. Venn verifies it when the refund transaction appears in imported data |
| C-2 | One invoice status list (Draft…Cancelled) | "Overdue", "Disputed" and "Partially Paid" are not mutually exclusive, so a single stored enum goes stale or lies | Store lifecycle (`draft/issued/cancelled`) and compute payment state, overdue and disputed from amounts, dates and open disputes. Show one *display status* by fixed precedence |
| C-3 | "Change bank details" | Changing the remittance details printed on collection emails is the classic invoice-fraud vector | Owner-only, re-authentication required, all owners notified, 24-hour visible banner, audit logged. Not grantable to AR Specialists in MVP |
| C-4 | Eight AI agents | Eight autonomous agents is more surface than the MVP needs and harder to evaluate | Three bounded workflows in MVP (document extraction, investigation, collections drafting) plus a matching assistant; the rest are later and most are single structured calls, not agents |
| C-5 | Currency conversions | Converting currencies needs a rate source, a rate date policy and realised gain/loss handling | MVP: store currency per record, match only within the same currency, flag mismatches, report per currency. FX is post-MVP |
| C-6 | Gmail as early core | Gmail read scopes are "restricted" and need Google verification plus an annual third-party security assessment before public launch | Build Gmail after the core workflow works on imports; run in Google "testing" mode with allow-listed users until verification is complete |
| C-7 | `bank_transactions` and `payments` both in MVP | With CSV and Stripe as the only sources, two tables hold the same rows | MVP uses `payments` with an explicit `verification_level`. `bank_transactions` arrives with bank feeds |
| C-8 | Audit logs at M13 | Financial changes must be auditable from the first financial write | Audit logging is built with the foundation (M5); the approval core is built at M10, before the Investigation Engine that depends on it |
| C-9 | Roadmap order M10 (email) before M11 (investigations) | Delays the flagship behind the riskiest external dependency | Investigation Engine v1 ships on imported records and uploaded documents first; email evidence plugs in afterwards |

## 11. Glossary

| Term | Meaning in Venn |
|---|---|
| Allocation | An explicit record that *X amount* of payment *P* is applied to invoice *I* |
| Discrepancy | A deterministic, typed exception found by reconciliation (e.g. short payment) |
| Investigation | A case opened on a discrepancy: evidence, findings, recommendation, approval, outcome |
| Evidence | A stored, citable item: invoice, payment, document page, email message, note |
| Verified payment | A payment record that came from a bank or gateway source (import or sync), as opposed to a manual entry or an email claim |
| Exposure | Deterministically calculated amount at risk for a discrepancy |
| Verified recovered amount | Sum of verified payments allocated to an invoice after a Venn investigation or collection action on it began |
| Adjustment | An approved non-cash change to what is owed: write-off, credit, discount; or a recorded refund decision |
