# venn: everything about the product

One document you can send to anyone: what venn is, what it does, why it is needed, who it helps, how a person uses it from the first click, and how it is built. No technical background needed for sections 1 to 9; section 10 is for engineers.

Live product: https://venn-web-beta.vercel.app
Source code: https://github.com/Maher-Shamoon/venn

---

## 1. What is venn?

**venn finds the revenue that slips through the cracks.**

Every company that sells to other companies sends **invoices** and receives **payments**. Those two lists should match perfectly. In real life they almost never do. venn reads three things:

1. the **invoices** you sent,
2. the **payments** that arrived (bank transfers, card payments),
3. the **emails** your customers wrote about them,

and finds every place where they disagree. For each disagreement it opens a **case file** with the evidence laid out, a recommended next step, and a person who decides what to do.

In one sentence: *venn is an evidence-backed second pair of eyes on a company's accounts receivable.*

**What venn is not**
- Not accounting software. Your accounting system stays the book of record.
- Not a payment processor. venn never moves money.
- Not a debt-collection agency.
- Not a chatbot that guesses about finances. Every number is calculated by code from stored records.

## 2. Why does a product like this need to exist?

### The problem, with real-life examples

| What happens | What it costs |
|---|---|
| A customer pays $4,000 against a $5,000 invoice and says nothing. | $1,000 sits unnoticed for months, or is chased long after the customer thought it was settled. |
| One payment covers three invoices at once. | Someone spends an hour working out which invoice it belongs to, and sometimes gets it wrong. |
| A customer emails "we sent the rest on Friday". | Nobody checks the bank. Either the customer is chased for money they paid, or the missing money is never found. |
| An invoice is accidentally sent twice. | The customer pays one, disputes the other, and trust suffers. |
| A payment arrives with no reference. | It stays "unallocated" and the invoice looks overdue. |
| Someone writes off a balance "to tidy up". | Revenue disappears with no record of who decided it or why. |

### Why the current way does not work

Most small finance teams (one to five people) handle this with spreadsheets, the accounting system's reports and their inbox. That means:

- **It is manual and slow.** Matching payments to invoices by eye does not scale past a few hundred invoices a month.
- **The evidence is scattered.** The invoice is in one system, the payment in the bank, the explanation in an email thread. Nobody sees all three together.
- **Mistakes are silent.** A wrong match looks the same as a right one.
- **There is no accountability.** Who approved that credit note? Often nobody can say.
- **Existing tools are either too small or too big.** Accounting software records transactions but does not investigate. Large enterprise collections platforms are expensive and built for hundreds of staff.

### What venn adds

A system that does the tedious part (reading, matching, spotting gaps, gathering evidence) and leaves the judgment to a person, with a permanent record of every decision.

## 3. Who is it for?

**Primary customer:** small accounts-receivable teams (1 to 5 people) at business-to-business service companies of roughly 10 to 200 employees: agencies, IT consultancies, staffing firms, professional services. They send tens to a few thousand invoices a month, and each invoice is large enough that a discrepancy is worth investigating.

**Two kinds of user inside a company**

| Role | What they do | What they can see and do |
|---|---|---|
| **Owner** | Runs the business or the finance function. | Everything: all data, approvals (write-offs, credits, refunds), team, connections, settings, audit log. |
| **AR specialist** | Works the daily queue: matches payments, investigates gaps, chases customers. | The work queue and the records they need. Cannot approve big adjustments and cannot change settings unless an owner allows it. |

## 4. How does it help? (the value)

1. **Finds money you did not know was missing.** Short payments, duplicates and unmatched payments are surfaced automatically instead of being discovered months later.
2. **Saves hours of matching.** Exact matches can be applied automatically (if you allow it). Everything else arrives as a suggestion with the reason.
3. **Replaces "I think" with evidence.** Each case file separates what is a stored fact, what was calculated, what is only a possible explanation, and what is an unverified claim (for example, something a customer said in an email).
4. **Keeps people in control.** Nothing consequential happens without a person. The big actions need an owner, and nobody can approve their own request.
5. **Creates an audit trail.** Who did what, when, and why is recorded permanently. This helps with year-end, auditors and disputes.
6. **Protects customer relationships.** You stop chasing money that was already paid and stop sending conflicting messages while a dispute is open.
7. **Safe by design.** Each company's data is isolated from every other company's, and connections to Stripe, Gmail and QuickBooks are read-only.

## 5. What is inside (the screens)

| Area | What it does |
|---|---|
| **Dashboard** | Total receivables, overdue balances, payments waiting for review, open cases, trends. Owners and AR specialists see different dashboards. A checklist guides a new company through its first steps. |
| **Customers, Invoices, Payments** | The ledger. Add, import from CSV, search, sort. Void, reverse or cancel anything, always with a reason and an audit entry. |
| **Import** | Upload invoice or payment exports (CSV) or a remittance PDF. You review every row; nothing is saved until you confirm; importing the same file twice adds nothing twice. |
| **Reconciliation** | venn proposes which payment belongs to which invoice, with confidence and reasons. Exact matches can be applied automatically; the rest wait for a person. Applied matches can be undone. |
| **Investigations** | One case file per discrepancy (short payment, duplicate, claimed wire transfer). Shows cited findings and a recommended next step, which goes to approval. |
| **Approvals** | The queue of requests for write-offs, credits and refunds. Owners can set limits under which small items are approved automatically. |
| **Collections and Disputes** | Draft follow-ups from the records, mark them sent, pause them automatically while a dispute is open, track tasks. |
| **Documents** | Upload contracts, remittances, statements. venn reads their text and makes them searchable and linkable to cases. |
| **Reports and Analytics** | Aging, trends, reconciliation performance, CSV exports. |
| **Integrations** | Stripe (card payments), Gmail (customer replies and remittances), QuickBooks Online (unpaid invoices). All read-only. |
| **Team** | Invite teammates by email as owner or AR specialist; resend or withdraw invitations; change roles. |
| **Audit log, Notifications, Tasks, Settings, Profile** | Governance and housekeeping. |

## 6. The complete user flow

### A. A visitor (no account)
1. Opens the **website**: home, product, solutions, security, pricing, about, contact.
2. Clicks **See a demo**: a **sample workspace** with made-up data, clearly labelled "Sample data. Nothing here is real." A switcher lets the visitor see the owner view and the AR specialist view. Nothing they do is saved to any real account, and real data is never mixed in.
3. Clicks **Get started** to create an account.

### B. A new customer
1. **Sign up** with email and password (12+ characters, mixed case, a number and a symbol) or **Continue with Google**.
2. Email accounts confirm their address from a link sent to their inbox. Google accounts are already verified.
3. **Setup**, in short steps, most of them skippable:
   1. Organization details (name, currency, time zone)
   2. Where money arrives (bank, card payments)
   3. Customer email (Gmail)
   4. First data (invoices and payments)
   5. Team (invite colleagues)
   6. Preferences (approval limits, automation)
4. Lands on the **dashboard** of their own organization. It starts empty, with a "Get venn reading your data" checklist.

### C. A returning customer
1. **Sign in** (email and password, or Google). Credentials are always asked; there is no dashboard "flash" first.
2. Goes straight to the dashboard of their organization. Setup is never shown again.

### D. A teammate who was invited
1. An owner invites them by email and picks a role.
2. The teammate opens the invitation link, signs up or signs in **with that exact email address**, accepts, and joins the owner's organization. If the email is not delivered (it can land in spam), the owner also sees a link to copy and send directly.

### E. A normal working day (AR specialist)
1. Opens the dashboard: today's queue, payments to review, cases assigned to them.
2. **Reconciliation:** reviews suggested matches, accepts or rejects, undoes mistakes.
3. **Investigations:** opens a case, reads the evidence, adds notes, requests an adjustment if needed.
4. **Collections:** reviews due follow-ups, sends or snoozes them.
5. Anything beyond their authority goes to an owner as an approval request.

### F. A normal working day (owner)
1. Dashboard: exposure, overdue, trends, what needs a decision.
2. **Approvals:** approves or declines write-offs, credits and refunds (never their own requests).
3. **Team and settings:** invite people, set approval limits, connect Stripe, Gmail or QuickBooks.
4. **Reports and audit log:** month-end review.

### How a single problem travels through venn
*A customer pays $4,000 against a $5,000 invoice.*
1. The payment arrives (imported or synced from Stripe).
2. Reconciliation matches it to the invoice and notices it is $1,000 short.
3. venn opens an **investigation** and gathers the evidence: the invoice, the payment, any email where the customer mentions it.
4. The AR specialist reads the case, drafts a follow-up, or requests a small write-off.
5. The write-off goes to the owner's **approvals** queue.
6. The owner decides. The decision, who made it and when, is written to the audit log.

## 7. The complete web flow (pages and how they connect)

```
Public website
  /               Home
  /product        Product overview          /p/engine   How the engine works
  /solutions      Who it is for             /security   Security
  /pricing        Plans                     /about  /contact  /privacy  /terms
  /demo           → sample workspace (/app, sample data only)

Accounts
  /signup         Create account (email or Google)
  /verify-email   Confirm address
  /login          Sign in (email or Google)
  /forgot-password → /reset-password
  /invite/:token  Accept a team invitation
  /onboarding     First-time setup (new organizations only)

Application (signed in, /app/...)
  /app                    Dashboard (owner and AR views)
  /app/customers          list and detail
  /app/invoices           list, detail, import, PDF review
  /app/payments           list, detail, import
  /app/reconciliation     suggestions and runs
  /app/investigations     case files
  /app/approvals          approval queue and detail
  /app/collections        follow-up queue
  /app/disputes           dispute tracking
  /app/documents          document library
  /app/reports            aging and other reports
  /app/integrations       Stripe, Gmail, QuickBooks
  /app/team               members and invitations
  /app/audit-log          permanent record
  /app/notifications  /app/tasks  /app/settings  /app/profile

System pages
  /403  /500  /maintenance  /session-expired  and a friendly "not found" page
```

**Routing rules the product follows**
- The landing page is always the landing page; nobody is sent into setup without asking.
- Sign-in always asks for credentials.
- The demo never touches real data and never shows setup.
- A person only ever sees their own organization's data, enforced by the server and the database.
- **Loading:** when the whole screen changes (sign-in, sign-up, setup, first load) a small animated venn mark appears over a blurred copy of the screen. Inside the app, moving between sections shows grey placeholder shapes in the layout of the page, never a blank white page.
- The site works on phones, tablets and desktops.

## 8. Trust, security and privacy (plain language)

- **Sign-in** is handled by Supabase, a well-established authentication service. Google sign-in uses the code-exchange flow, so a copied address cannot sign anyone in elsewhere.
- **Every request** is checked on the server: who you are, which organization you belong to and whether your role allows the action.
- **Companies are isolated** from each other at the database level (row-level security), not just in the application.
- **Secrets** (Stripe, Gmail and QuickBooks connections) are stored encrypted. Stripe keys must be read-only; keys that can change data are refused.
- **Connect links** for Gmail and QuickBooks work once and only for people still allowed to manage connections.
- **AI is optional**, off by default for each organization, only writes short cited sentences about stored records, and never chooses or performs an action.
- **Audit trail:** every consequential action is recorded permanently with who, what and when.
- **Browser protections:** strict content security policy, secure-connection enforcement, and rate limiting against abuse.

## 9. What is built and what is not yet

**Built and live**
Accounts and organizations; ledger (customers, invoices, payments); CSV and PDF import; reconciliation; investigations with citations; approvals with separation of duties; collections and disputes; documents; audit log; team and invitations; dashboards, analytics and reports; Stripe, Gmail and QuickBooks connections; a daily follow-up job; email; optional AI; a Docker setup; automated checks on every code change; responsive layout for phones, tablets and desktops.

**Not yet** (none of these stop a company from using venn)
- An independent outside security review.
- Search-engine pre-rendering of the public pages.
- Reading scanned (image-only) documents.
- A load test at 100,000 invoices.
- Backup-and-restore drill and error monitoring (launch readiness).
- A custom domain and a verified email-sending domain (until then, invitation emails come from a shared address and can land in spam; the inviter always sees a copy-able link).

## 10. For engineers: how it is built

| Layer | Technology |
|---|---|
| Website and app | React + TypeScript, Vite, Tailwind CSS, React Query; hosted on Vercel |
| API | Python 3, FastAPI, SQLAlchemy; hosted on Vercel (Tokyo region, next to the database) |
| Database and sign-in | Supabase: PostgreSQL with forced row-level security; JWT sign-in verified through the project's public keys |
| Email | Brevo SMTP |
| Optional AI | Groq |
| Integrations | Stripe (read), Gmail (read-only), QuickBooks Online (read) |
| Local stack | `docker compose up --build` runs the whole product on one machine |
| Tests | Unit tests (web), API tests (pytest), browser tests (Playwright) that drive the real site at phone and desktop sizes, accessibility audits |

Repository layout: `apps/web` (the website and app), `services/api` (the API and its database migrations), `docs` (planning, testing and this guide), `supabase` (local project settings).

## 11. Words you may hear

- **Accounts receivable (AR):** money customers owe you.
- **Reconciliation:** matching payments to the invoices they pay.
- **Short payment:** a customer paid less than the invoice.
- **Remittance:** the note a customer sends saying what a payment covers.
- **Write-off / credit / refund:** the three ways an amount is settled when it will not be collected as invoiced; each needs approval.
- **Case file / investigation:** venn's evidence pack for one discrepancy.
- **Audit log:** the permanent record of who did what.
- **Row-level security:** the database itself refuses to show one company another company's rows.

## 12. Frequently asked questions

**Does venn move my money?** No. It never sends or moves money. People do, in your own systems.

**Can venn change my accounting records?** No. Connections are read-only; venn keeps its own records and your accounting system stays the book of record.

**What if venn is wrong?** Every suggestion shows its reasons and can be rejected, and applied matches can be undone. Nothing consequential happens without a person.

**Who can see my data?** Only members of your organization, according to their role. Other companies cannot, even if the application had a bug, because the database enforces it.

**Can I try it without signing up?** Yes: "See a demo" opens a sample workspace with made-up data.

**What does it cost?** See the pricing page; the product is currently in beta.
