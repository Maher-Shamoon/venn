# Venn — User Personas and Use Cases

Status: Phase 1 draft · Last updated 2026-11-13

> Personas are **design hypotheses**, not research findings. No interviews have been run. Validate with 5–8 target customers before or during the prototype review (see Risk R-01).

## 1. Personas

### P1 — Business Owner / Finance Manager ("Owner")

| | |
|---|---|
| Typical titles | Founder, Managing Director, Head of Finance, Finance Manager, Controller |
| Company | 10–200 person B2B service firm |
| Time in Venn | 10–20 minutes a day, plus a weekly review |
| Goals | Know what is owed and what is at risk; make sure nothing is written off or refunded without their say; trust that the team is following up |
| Frustrations | Learns about a short payment months later; cannot tell whether a "we paid" email is true; approvals happen in chat with no record |
| Needs from Venn | A dashboard they can trust and drill into; a short approval queue with evidence attached; control over who can do what; an audit trail |
| Success looks like | Overdue balance trending down; no surprise write-offs; approvals handled in minutes |

### P2 — AR Specialist / Finance Team Member ("AR Specialist")

| | |
|---|---|
| Typical titles | Accounts Receivable Specialist, Credit Controller, Bookkeeper, Finance Associate |
| Time in Venn | Several hours a day; it is their work queue |
| Goals | Clear the unmatched-payment list; chase the right invoices first; answer "what happened with invoice X?" quickly |
| Frustrations | Hunting through inboxes and PDFs for proof; re-typing the same reminder; waiting on approvals with no visibility |
| Needs from Venn | A prioritised queue; fast keyboard-friendly tables; evidence already gathered; drafts they can edit; a clear "submitted for approval" state |
| Success looks like | Fewer open items at the end of the day; no investigation stalled without a next step |

### P3 — Solo operator (Owner who is also the AR Specialist)

A one- or two-person finance function. Has every permission. Venn must not block them with approvals they would have to give themselves: single-owner organizations confirm sensitive actions with an explicit confirmation step that is audit-logged as an owner direct action.

### External actor — Customer contact (not a Venn user in MVP)

The accounts-payable contact at the customer. Receives collection emails sent from the organization's own mailbox and replies there. Becomes a portal user post-MVP.

## 2. Jobs to be done

| # | When… | I want to… | So that… | Persona |
|---|---|---|---|---|
| J1 | payments arrive | have them matched to invoices with the uncertain ones flagged | my receivables are right without manual ticking | AR |
| J2 | a customer pays less than invoiced | see why, with proof | I can either collect the rest or record a justified adjustment | AR, Owner |
| J3 | a customer says "we already paid" | check that against actual received money | I do not chase wrongly or stop chasing wrongly | AR |
| J4 | invoices go overdue | know which to chase first and have the message drafted | follow-up is consistent | AR |
| J5 | a customer disputes an invoice | keep the claim, evidence and decision in one place | it gets resolved rather than forgotten | AR |
| J6 | someone wants to write off, credit or refund | see the evidence and approve or reject | money decisions are deliberate and recorded | Owner |
| J7 | I review the business | see receivables, aging and risk and click through to records | I trust the numbers | Owner |
| J8 | I add a team member | give them only the access they need | duties are separated | Owner |
| J9 | an auditor or partner asks "who did this?" | look it up | we can answer in minutes | Owner |

## 3. Core use cases

Each use case names its trigger, main path, important alternatives and the business rule that governs it.

### UC-01 Sign up and create an organization
- **Actor:** Owner. **Trigger:** clicks "Get started".
- **Main path:** signup → verify email → organization details → optional steps (connect sources, import, invite, preferences) → dashboard with an empty-state checklist.
- **Alternatives:** email already registered → sign in; unverified email → resend; abandons onboarding → resumes at the same step next login.
- **Rules:** creating an org makes the creator its Owner. An org always has at least one active Owner.

### UC-02 Invite an AR Specialist
- **Actor:** Owner. **Main path:** Settings → Team → Invite → email + role → invitation email → invitee accepts → creates account or signs in → membership created in the *inviting* org.
- **Alternatives:** invitation expired (7 days) → resend; invitee signs up with a different email → invitation not matched, shown an explanation; already a member → no duplicate.
- **Rules:** accepting an invitation never creates an organization. Token is single-use and stored hashed.

### UC-03 Import invoices
- **Actor:** AR (if permitted) or Owner. **Main path:** upload CSV → map columns (remembered per org) → validation preview (valid / warning / error rows) → confirm → background import → summary.
- **Alternatives:** duplicate invoice number for the same customer → row skipped and listed, never overwritten; same file uploaded twice → detected by file hash, user warned; unknown customer → created as new or mapped to existing on the preview.
- **Rules:** FR-06, integrity rules 6 and 7.

### UC-04 Upload an invoice or contract PDF
- **Main path:** upload → virus/type check → text extraction (OCR if scanned) → AI extraction into fields with per-field source snippets → human reviews and confirms → record created/linked.
- **Rules:** extracted values are *proposed* until a human confirms. The PDF is stored as evidence.

### UC-05 Import payments and reconcile
- **Main path:** import bank/gateway CSV → reconciliation run starts automatically → results: auto-applied exact matches, suggestions needing review, unmatched payments, discrepancies.
- **Alternatives:** payment for an unknown payer → stays unmatched with suggested customers; reversed payment row → reverses allocations and reopens invoice balance.
- **Rules:** rules R1–R8 in the feature spec; uncertain matches are never finalised automatically.

### UC-06 Review and confirm a suggested match
- **Actor:** AR. **Main path:** open suggestion → see payment, candidate invoices, why it was suggested → confirm, edit allocation amounts, or reject.
- **Rules:** allocation total ≤ payment amount; allocation to an invoice ≤ its open balance; both enforced in the database.

### UC-07 Investigate a discrepancy
- **Main path:** discrepancy appears → open investigation (automatic for configured types, or manual) → engine gathers evidence and produces narrative, findings and a recommendation → AR reviews, adds notes or evidence → chooses the action → if policy requires, submits for approval.
- **Alternatives:** insufficient evidence → engine says what is missing and recommends requesting it; AR disagrees → overrides recommendation with a reason; evidence changes → "re-run analysis" keeps the previous version.

### UC-08 Approve or reject a restricted action
- **Actor:** Owner. **Main path:** notification → Approval Center → request with requester, reason, financial impact, evidence → approve / reject / request more evidence → requester notified → approved action recorded or executed (non-monetary actions only).
- **Rules:** a user cannot approve their own request unless they are the organization's only active Owner.

### UC-09 Verify an outcome
- **Main path:** after an action (e.g. customer asked for the remaining balance), the investigation enters *Monitoring* → a later import contains the payment → reconciliation allocates it → investigation shows the verified amount and moves to *Resolved – recovered* after AR confirmation.
- **Alternatives:** no payment by the follow-up date → task created; partial payment → *partially recovered* and stays open.

### UC-10 Chase overdue invoices
- **Main path:** collections queue sorted by priority → open case → AI draft using invoice facts and prior communication → edit → send (if permitted) or submit for approval → logged on the timeline → follow-up scheduled.
- **Rules:** drafts state only facts from records; no legal threats; final-notice templates always need Owner approval.

### UC-11 Handle a dispute
- **Main path:** create dispute from an invoice, an email or an investigation → category + customer explanation → attach evidence → assign → status updates → resolve (upheld / partially upheld / rejected) → if money changes, an adjustment approval is raised.
- **Rules:** an open dispute pauses automated reminders for that invoice and marks it Disputed.

### UC-12 Connect an integration
- **Actor:** Owner. **Main path:** Integrations → Connect → provider OAuth consent → connection stored (tokens encrypted) → first sync job → status and last-sync shown.
- **Alternatives:** consent denied; token revoked later → status *Needs attention* with a reconnect button.
- **Rules:** a connection is never shown as connected unless a live API call has succeeded.

### UC-13 Review analytics and export
- **Main path:** choose report → date range and filters → chart and table → click a figure → underlying records → export CSV (permission `reports.export`; export is audit-logged).

### UC-14 Manage team and permissions
- **Main path:** Team → member → change role / toggle configurable permissions / suspend → confirmation → audit entry → takes effect on the member's next request.

### UC-15 Review audit log
- **Main path:** Audit Logs → filter by actor, action, record, date → open entry → before/after values and request context.

## 4. Use case × persona

| Use case | Owner | AR Specialist |
|---|:-:|:-:|
| UC-01 | ● | |
| UC-02 | ● | |
| UC-03, UC-04, UC-05 | ● | ● (import permission) |
| UC-06, UC-07, UC-09, UC-10, UC-11 | ● | ● |
| UC-08 | ● | requests only |
| UC-12, UC-14, UC-15 | ● | |
| UC-13 | ● | operational reports |
