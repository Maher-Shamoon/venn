# Venn — UI Page Inventory

Status: Phase 1 draft · Last updated 2026-11-13

This is the build list for the Phase 2 prototype and the Phase 3 frontend. Every page lists its purpose, main content, key interactions and the states it must show. "Std states" = loading skeleton, empty, filtered-empty, error with retry, permission-denied.

Role column: **O** Owner, **A** AR Specialist, **P** public.

## 1. Route map

```
Public            /  /product  /solutions  /security  /pricing  /about  /contact  /privacy  /terms
Auth              /login  /signup  /verify-email  /forgot-password  /reset-password  /invite/[token]
Onboarding        /onboarding/organization  /sources  /email  /import  /team  /preferences
App (/app)        /dashboard
                  /customers  /customers/[id]
                  /invoices  /invoices/[id]  /invoices/import
                  /payments  /payments/[id]  /payments/import
                  /reconciliation  /reconciliation/runs/[id]
                  /investigations  /investigations/[id]
                  /collections  /collections/[id]
                  /disputes  /disputes/[id]
                  /approvals  /approvals/[id]
                  /analytics  /reports  /reports/[slug]
                  /documents
                  /integrations  /integrations/[provider]
                  /team  /team/[memberId]
                  /audit-log
                  /settings/(company|financial|approvals|notifications|roles|remittance|security|data)
                  /notifications  /tasks  /profile
System            404, 403, 500, maintenance, session-expired
```

Prototype note: in Phase 2 these are HTML pages under `prototype/` with a persistent **role switcher** (Owner / AR Specialist) in a clearly marked "Prototype controls" bar, and a "Demo data" label. No real auth.

## 2. Public website

Shared: sticky nav (logo, Product, Solutions, Security, Pricing, About · Log in · **Book a demo**), footer (product links, company, legal, contact; no social proof that does not exist).

| Route | Purpose | Sections |
|---|---|---|
| `/` | Communicate value, drive demo/signup | 1 Nav · 2 Hero: "Find the revenue slipping through the cracks." + supporting line · 3 Positioning strip (who it is for) · 4 Primary CTA "Book a demo" · 5 Secondary CTA "See how it works" · 6 Product preview (real UI from the prototype with demo data, labelled) · 7 The leakage problem (fragmented sources → missed short payments; described qualitatively, no invented statistics) · 8 How Venn works (Connect → Detect → Investigate → Approve → Verify) · 9 Capabilities grid · 10 Investigation Engine showcase (annotated workspace: facts vs possibilities vs missing evidence) · 11 Workflow visual · 12 Integrations (available vs "planned", honestly labelled) · 13 Security and trust (controls that exist) · 14 Use cases (agency, MSP, staffing, consultancy) · 15 Benefits · 16 FAQ · 17 Final CTA · 18 Footer |
| `/product` | Depth on modules | Reconciliation, Investigations, Collections, Disputes, Approvals, Analytics; each with screenshot and 3 bullets |
| `/solutions` | By segment and by role | Agency / IT consulting / MSP / staffing / professional services; "For owners", "For AR teams" |
| `/security` | Trust | Tenant isolation, encryption, access control, audit trail, AI data handling, human approval, sub-processors list, responsible disclosure contact. No certification claims unless held |
| `/pricing` | Set expectations | Until D-08 is decided: "Early access — talk to us", what is included, FAQ |
| `/about` | Mission and principles | Mission, product principles (evidence, human approval, no guaranteed-recovery claims). No invented team bios |
| `/contact` | Demo request | Form: name, work email, company, size, message; consent text; success state. Honeypot + rate limit |
| `/privacy`, `/terms` | Legal | Placeholder structure marked "Draft — pending legal review" |

FAQ topics: Is Venn an accounting system? Does Venn move money? How does the AI avoid making things up? What happens to my email data? Which integrations are live? Can I use it without connecting anything? Who can approve what?

## 3. Authentication

| Route | Content | States |
|---|---|---|
| `/login` | Email, password, "Forgot password", link to signup | invalid credentials (generic), rate-limited, unverified → resend, suspended membership, MFA challenge step |
| `/signup` | Full name, work email, password with strength hints, terms consent | validation, generic "check your email" result |
| `/verify-email` | Waiting screen, resend (cooldown), change email | link expired, verified → continue |
| `/forgot-password` | Email | always the same confirmation |
| `/reset-password` | New password + confirm | token expired, success → login |
| `/invite/[token]` | Org name, inviter, role; create account (email locked) or sign in | expired, used, revoked, wrong signed-in account |

Layout: centred card on `--bg`, logo above, short trust line below ("Your data is isolated per organization").

## 4. Onboarding (O)

Left: stepper with 6 steps and "skippable" tags. Right: step form. Footer: Back · Skip for now · Continue.

| Step | Fields / content |
|---|---|
| 1 Organization | Name*, industry*, company size*, country*, default currency* (preselected from country), website |
| 2 Financial sources | Cards: Upload CSV (available) · QuickBooks · Stripe · Xero (status per integration stage) |
| 3 Email | Gmail / Outlook cards with the scopes explained in plain language before consent |
| 4 Import | Invoice CSV, payment CSV, PDF upload, or "Explore with demo data" |
| 5 Team | Repeating row: email + role; send invitations |
| 6 Preferences | Timezone, default payment terms, auto-apply exact matches, approval defaults (summary with link to full settings) |

End: dashboard with a dismissible setup checklist showing what was skipped.

## 5. Application shell (O, A)

- Sidebar per USER_FLOWS §4, with counts on Reconciliation (needs review), Investigations (assigned to me / ready for review), Approvals or My requests.
- Top bar: global search (invoices, customers, payments, investigations by number/name), notifications popover, organization name (switcher if several), profile menu (Profile, Sign out).
- Banners: demo data active · integration needs attention · email not connected (on collections) · remittance details changed in last 24h.

## 6. Application pages

### 6.1 Dashboard — Owner (O) `/app/dashboard`
- Header: greeting, date range picker, currency selector (if >1).
- Row 1 KPI cards: Total AR · Overdue · Unmatched payments · Unresolved discrepancies (exposure) · Verified recovered.
- Row 2: Receivables aging (stacked bar + table toggle) · Outstanding balance trend (line).
- Row 3: Pending approvals (list, approve from here opens detail) · Investigations summary (by status, top 5 by exposure) · Open disputes.
- Row 4: Overdue by customer (top 10 horizontal bars) · Recent financial activity · Integration health.
- Interactions: every KPI/segment links to a filtered list. States: Std; first-run empty state = setup checklist.

### 6.2 Dashboard — AR Specialist (A) `/app/dashboard`
- "My work today": tasks due, follow-ups due, investigations ready for review.
- Cards: Unmatched payments (count, open reconciliation) · Invoices needing attention (overdue without a case action, disputed) · My investigations (queue) · My open disputes · My requests (pending/decided) · Recent activity.
- No organization-wide financial totals beyond operational counts.

### 6.3 Customers `/app/customers`, `/[id]`
- List: name, open balance, overdue, open invoices, avg days to pay, last payment, open issues (disputes + investigations). Filters: has overdue, has open issues, currency. Action: New customer.
- Detail: header (name, balance, overdue, terms, risk facts); tabs Overview · Invoices · Payments · Disputes · Investigations · Communication · Documents · Activity. Side panel: contacts, payer aliases, notes.
- Drawer: create/edit customer, add contact.

### 6.4 Invoices `/app/invoices`, `/[id]`, `/import`
- List columns: number, customer, issue date, due date, total, paid, balance, status (+ secondary chips), days overdue. Filter bar per FEATURE_SPEC §5. Bulk: export, open collection cases. Actions: New invoice, Import CSV, Upload PDF.
- Detail main: amounts panel (total − payments − adjustments = balance, shown as the equation), line items, payments & allocations table, adjustments, documents. Side: status, dates, PO, customer link, related investigation/dispute/collection case, history timeline.
- Actions: Record payment, Open investigation, Open dispute, Request adjustment (write-off/credit/discount → approval), Cancel invoice (guarded).
- Import wizard: Upload → Map columns → Review (tabs Valid / Warnings / Errors / Duplicates, row counts) → Importing (progress) → Summary (created, skipped, download error file).
- PDF review screen: PDF viewer left, extracted fields right with confidence and highlight-on-hover of the source region; Confirm / Edit / Discard.

### 6.5 Payments `/app/payments`, `/[id]`, `/import`
- List: date, payer (as received), customer, reference, amount, allocated, unallocated, status, source + verification chip.
- Detail: facts, allocations table (invoice, amount, by, when, void), "Suggested matches" with reasons and Confirm, add allocation combobox, evidence, history. Actions: Allocate, Mark under review, Mark reversed (guarded), Open investigation.
- Import wizard as invoices, plus the signed-amount question.

### 6.6 Reconciliation `/app/reconciliation`
- Summary strip: last run time, auto-applied, needs review, unmatched, discrepancies. Button: Run reconciliation.
- Tabs:
  - **Needs review** — split view: list of suggestions left; right panel shows payment vs candidate invoice(s), rule and plain-language reason, editable allocation amounts, Confirm / Reject / Skip. Keyboard: `C` confirm, `R` reject, `J/K` next/previous.
  - **Unmatched** — payments with customer suggestions and manual search-and-allocate.
  - **Auto-applied** — list with Undo (voids allocation, audited).
  - **Discrepancies** — type, customer, invoice, exposure, age, linked investigation or "Open investigation".
- `/runs/[id]`: run details, counts, rule breakdown.

### 6.7 Investigations `/app/investigations`, `/[id]`
- List: ID, type, customer, invoice, exposure, priority, status, assignee, age. Views: Assigned to me · Ready for review · Awaiting approval · Monitoring · All. Board view by status [P].
- **Workspace** (three areas):
  - Header: ID, title, status, priority, exposure, assignee, actions (Re-run analysis, Assign, Add note, Dismiss).
  - Main column: What happened? → Findings (five groups, design system §9) → Recommendation card → Approval block → Resolution block.
  - Right column: Evidence panel with type filters (Invoices, Payments, Documents, Emails, Notes), add evidence (upload / link record), each card expandable to a preview drawer (PDF page, email body).
  - Bottom/secondary tab: Activity timeline (status changes, analysis versions, notes, approvals).
- States: analysis running (stepper: loading records, retrieving documents, checking calculations, drafting findings); analysis failed (manual mode banner); insufficient evidence; stale analysis ("records changed since this analysis — re-run"); read-only when resolved.

### 6.8 Collections `/app/collections`, `/[id]`
- Queue: customer, invoices overdue, total overdue, oldest days overdue, stage, next action date, last contact, priority (with explanation popover). Filters: stage, owner, due today, promise broken, paused.
- Case detail: left facts (invoices in case, balances, promises); centre timeline (sent, received, notes); right composer: template + tone → AI draft → editable → fact check list ("Amounts and dates in this draft match records ✓") → Send / Submit for approval / Schedule. Banner when mailbox not connected.

### 6.9 Disputes `/app/disputes`, `/[id]`
- List: ID, customer, invoice, category, disputed amount, status, assignee, age, due.
- Detail: header; customer explanation (quoted, with source); evidence panel; timeline; internal notes; resolution form (outcome, note, optional adjustment → approval). Create-dispute drawer from invoice, email or investigation.

### 6.10 Approvals `/app/approvals` (O), "My requests" (A)
- Owner queue: type, record, requester, amount/impact, age, status. Tabs: Pending · Info requested · Decided.
- Detail: request summary, before/after impact panel, reason, evidence (reused cards), linked record preview, history, decision bar (Approve · Reject · Request more information) with comment; stale warning when the record changed.
- AR view: same list filtered to own requests, no decision bar, Withdraw.

### 6.11 Analytics and reports `/app/analytics`, `/app/reports/[slug]`
- Analytics overview: 6 chart cards linking to full reports.
- Report page: title, definition ("How this is calculated"), filters (date range, customer, currency), chart, table, Export CSV.
- AR Specialists see operational reports only (reconciliation performance, investigation resolution time, own collections activity).

### 6.12 Documents `/app/documents`
- Library: name, type, linked record, uploaded by, date, extraction status. Upload, preview drawer, link to record.

### 6.13 Integrations (O) `/app/integrations`, `/[provider]`
- Grid by category (Email, Accounting, Payments & Banking, Imports). Card: logo placeholder/name, description, status badge, primary action.
- Detail: connection status, connected account, permissions granted (plain language), last sync, sync history table (time, records, result, error), settings (sync window, mail filter), Sync now, Disconnect (confirm + data choice).
- AR view: read-only status grid.

### 6.14 Team (O) `/app/team`, `/[memberId]`
- Members table and Pending invitations table; Invite dialog (emails, role).
- Member detail: role select, configurable permissions (toggles; locked ones with lock icon and reason), suspend/reactivate, recent activity. Last-owner protections explained inline.

### 6.15 Audit log (O) `/app/audit-log`
- Table: time, actor, action, record, summary. Filters: actor, action group, record type, date. Row drawer: before/after diff, request ID, IP. Export CSV.

### 6.16 Settings (O) `/app/settings/*`
| Tab | Content |
|---|---|
| Company | Name, legal name, address, industry, size, website, logo |
| Financial | Default currency, timezone, default terms, auto-apply exact matches, short-payment grace days, claim grace days |
| Approvals | Policy table per action type with thresholds; explanation of separation of duties |
| Notifications | Organization defaults; per-user preferences live in Profile |
| Roles | AR Specialist permission editor |
| Remittance | Bank/remittance details used in emails; change requires re-authentication; change history |
| Security | Require MFA, active sessions, password policy summary |
| Data | Export data, remove demo data, request organization deletion |

### 6.17 Notifications, tasks, profile (O, A)
- `/notifications`: list with read/unread, filters. `/tasks`: my tasks with due dates and linked records. `/profile`: name, password change, MFA setup, notification preferences.

## 7. Cross-cutting UI states

| State | Where |
|---|---|
| First-run empty | Every list (invoices: "Import your first invoices") |
| Demo data banner | Whole app while sample data exists |
| Background job progress | Imports, reconciliation run, investigation analysis, sync |
| Optimistic concurrency conflict | "This record changed while you were editing — reload" on save |
| Requires approval | Any restricted action: button label becomes "Submit for approval" with a lock |
| Read-only | Resolved investigations, decided approvals, cancelled invoices |
| Session expired | Modal to sign in again, returns to the same page |
| Offline / API unreachable | Non-blocking banner; mutations disabled |

## 8. Prototype coverage checklist (Phase 2 exit)

Marketing (9 pages) · Auth (6) · Onboarding (6 steps) · Owner dashboard · AR dashboard · Customers (list, detail) · Invoices (list, detail, import wizard, PDF review) · Payments (list, detail, import) · Reconciliation (4 tabs) · Investigations (list, workspace with all states) · Collections (queue, case) · Disputes (list, detail) · Approvals (queue, detail, My requests) · Analytics + one full report · Documents · Integrations (grid, detail) · Team (list, member, invite) · Audit log · Settings (8 tabs) · Notifications/tasks/profile · System pages. Role switcher changes navigation, dashboards and available actions throughout.
