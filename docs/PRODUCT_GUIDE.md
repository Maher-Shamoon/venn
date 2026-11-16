# venn: the product explained

A plain-language guide for explaining venn to anyone: a friend, a customer, an investor. It covers what the product is, who it is for, how it works, what a person actually does in it, and what is built today.

Live site: https://venn-web-beta.vercel.app · Code: https://github.com/Maher-Shamoon/venn

---

## 1. The one-minute version

**venn finds the revenue that slips through the cracks.**

A service business (an agency, an IT consultancy, a staffing firm) sends invoices and receives payments. The two rarely match perfectly. A customer pays $4,000 against a $5,000 invoice. A payment covers two invoices at once. A customer emails "we sent the rest on Friday" and nobody checks. A duplicate invoice goes out. Money quietly goes missing, or time is wasted chasing money that was already paid.

venn reads the **invoices**, the **bank and card payments** and the **customer emails**, finds every place where they disagree, and opens a **case file** for each one. Each case shows:
- what is a **confirmed fact** (a stored record),
- what was **calculated** by code (the arithmetic),
- what is only a **possible explanation**,
- and what is an **unverified claim** (for example, something said in an email).

A person then decides what to do. venn never moves money, and it never takes a consequential action on its own.

**What venn is not:** it is not accounting software (your accounting system stays the book of record), not a payment processor, not a debt-collection agency, and not a chatbot that guesses about finances.

## 2. Who it is for

Small teams (1 to 5 people) who handle accounts receivable at B2B service companies of roughly 10 to 200 employees. They send tens to a few thousand invoices a month, and each invoice is large enough that a discrepancy is worth investigating.

Two kinds of users:
- **Owner**: sees everything, approves anything consequential (write-offs, credits, refunds), manages the team, connections and settings.
- **AR specialist**: works the day-to-day queue (matching payments, investigating gaps, chasing customers). Sees only what an owner allows.

## 3. The core ideas

1. **Evidence first.** Every statement venn makes is tied to a stored record. Amounts are calculated by code, never guessed.
2. **A person decides.** Anything that changes the books (write-off, credit, refund, applying a doubtful match) needs a person, and the big ones need an owner. No one can approve their own request.
3. **Honest about uncertainty.** Facts, calculations, hypotheses and unverified claims are shown separately.
4. **Everything is logged.** A permanent audit log records who did what and when.
5. **Your data is yours.** Each organization's data is isolated from every other organization's at the database level.

## 4. What is inside (the screens)

| Area | What it does |
|---|---|
| **Dashboard** | Receivables, overdue balances, payments waiting for review, open cases, all calculated from your records. A checklist guides a new organization through first steps. |
| **Customers, Invoices, Payments** | The ledger. Add, import (CSV), search, sort. Void, reverse, cancel, all with a reason and an audit entry. |
| **Import** | Upload invoice or payment exports (CSV) or a remittance PDF. You review every row; nothing is saved until you confirm; repeating an import adds nothing twice. |
| **Reconciliation** | venn proposes which payment belongs to which invoice. Exact matches can be applied automatically (if you allow it); everything else waits for a person. Applied matches can be undone. |
| **Investigations** | One case per discrepancy (short payment, duplicate, claimed wire). Shows cited findings and a recommended next step, which goes to approval. |
| **Approvals** | The queue of requests for write-offs, credits and refunds. Separation of duties is enforced. Owners can set per-type limits under which small items are approved automatically. |
| **Collections and Disputes** | Draft follow-ups from the records, mark them sent, pause them when a dispute opens, track tasks. |
| **Documents** | Upload contracts, remittances, statements. venn reads their text and makes them searchable. |
| **Reports and Analytics** | Aging, trends, reconciliation performance, exports. |
| **Integrations** | Connect Stripe (card payments), Gmail (replies and remittances) and QuickBooks Online (unpaid invoices). All read-only. |
| **Team** | Invite teammates by email as owner or AR specialist; resend, withdraw, change roles. |
| **Audit log, Notifications, Tasks, Settings, Profile** | Governance and housekeeping. |

## 5. The user journey, step by step

### A visitor
1. Lands on the **website** (home, product pages, pricing, about, contact).
2. Can open **See a demo**: a sample workspace with made-up data ("Sample data. Nothing here is real."), with a role switcher (owner / AR specialist) so they can see both views. No sign-up needed. Real data is never mixed in.

### A new customer
1. **Get started** → sign up with email and password, or **Continue with Google**.
2. Email accounts confirm their address from a link in their inbox.
3. **Setup** (six short steps): organization details → money sources → email → first data → team → preferences. Most steps can be skipped.
4. Arrives on the **dashboard** of their own organization, which starts empty with a "Get venn reading your data" checklist.

### A returning customer
1. **Sign in** with email and password or Google.
2. Lands straight on the dashboard of their organization. (No setup is shown again.)

### A teammate who was invited
1. An owner invites them by email with a role.
2. They open the link, sign up or sign in with **that email address**, accept, and join the owner's organization.

### Where loading looks different
- When the **whole screen** changes (sign-in, sign-up, setup, first load), a small animated venn mark shows over a blurred copy of the screen.
- Inside the app, moving between sections shows grey placeholder shapes, never a blank page.

## 6. Security, in plain terms

- **Sign-in** is handled by Supabase (a trusted authentication service). Passwords need 12+ characters with mixed case, a number and a symbol; the sign-in error is the same whether the email exists or not.
- **Google sign-in** uses the code-exchange flow (PKCE). The address after Google contains only a one-time code that works only in the browser that started the sign-in. (Earlier it carried the session token itself, which is why a copied link could sign someone in elsewhere. That was fixed.)
- **Every request** is checked on the server: who you are, which organization you belong to, and whether your role allows the action.
- **Organizations are isolated** at the database level (row-level security), not just in the app.
- **Secrets** (connection keys for Stripe, Gmail, QuickBooks) are stored encrypted. The Stripe key must be a restricted, read-only key.
- **AI is optional** (off by default per organization), only writes cited sentences about stored records, and never chooses an action.
- **Audit trail:** consequential actions are recorded permanently.

## 7. How it is built (for the technically curious)

- **Website and app:** React + TypeScript, served by Vercel.
- **API:** Python (FastAPI), run on Vercel in Tokyo, next to the database.
- **Database and sign-in:** Supabase (PostgreSQL with row-level security).
- **Email:** Brevo (invitations and notifications).
- **AI (optional):** Groq.
- **Also available:** a Docker setup (`docker compose up --build`) that runs the whole stack on one machine.
- **Tests:** unit tests, API tests, and browser tests that drive the real site through sign-in and every main screen at phone and desktop sizes.

## 8. What is built and what is not

**Built and live:** accounts and organizations, ledger, imports (CSV and PDF), reconciliation, investigations with citations, approvals, documents, audit log, team and invitations, dashboard and reports, Stripe/Gmail/QuickBooks connections, daily follow-up job, email, optional AI, Docker, automated checks on every push.

**Still open** (none block use): an outside security review; search-engine pre-rendering of the public pages; reading scanned (image-only) documents; a load test at 100,000 invoices; backups-and-restore drill and error monitoring (launch readiness); a custom domain and a verified sending domain for email (both need a paid domain; today emails come from a shared Brevo address and can land in spam).

## 9. Words you may hear

- **Reconciliation:** matching payments to invoices.
- **Short payment:** a customer paid less than the invoice.
- **Remittance:** the note a customer sends saying what a payment covers.
- **Write-off / credit / refund:** the three ways an unpaid or wrongly-paid amount is settled; each needs approval.
- **Case file / investigation:** venn's evidence pack for one discrepancy.
