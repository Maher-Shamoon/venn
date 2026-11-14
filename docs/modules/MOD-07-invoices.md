# MOD-07 Invoices

Spec: FEATURE_SPECIFICATION §A.2–A.3, §B.5 · Roadmap: M7 · Code: `Invoices.tsx` (Invoices, InvoiceDetail), `domain/finance.ts` (`invTotal`, `balOf`, `statusOf`, `lateOf`), `store.ts` (`addInvoice`, `cancelInvoice`, `recordPayment`, `requestApproval`, `addDispute`, `openInvg`)

## 1. Purpose
Hold every invoice with a balance that is always derived from allocations and approved adjustments, and give one place to act on it.

## 2. Scope
| In | Out |
|---|---|
| List with status tabs (All, Open, Overdue, Paid, Disputed), customer filter, search, sort, pagination, CSV export, Import CSV, Upload PDF | Sending invoices to customers, invoice PDF generation |
| Create invoice with line items; cancel (void) invoice | Editing an issued invoice's total (use an adjustment) |
| Detail: details, line items, "Balance, calculated" panel, payments and allocations (void), related records; actions: Record payment, Start investigation, Open dispute, Request adjustment, Cancel invoice | Recurring invoices, tax engines |

## 3. Actors
Owner · AR (`invoices.write`, `payments.write` for manual payments, `adjustments.request`)

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-07-01 | Find an invoice | Tab/filter/search the list, open a row | No match → empty state | Detail |
| UC-07-02 | Create an invoice | New invoice → customer, dates, PO, lines → Create | No customer → "Choose a customer."; due before issue → error; line missing description/qty/price → error; duplicate number for the customer → error | Invoice issued; opens detail |
| UC-07-03 | Record a manual payment | Record payment → amount, method, reference | Amount ≤ 0 or > balance → error | Manual payment + allocation; balance reduced; status partial/paid |
| UC-07-04 | Request a write-off or credit | Request adjustment → type, amount, reason | Amount outside 0.01..balance or reason empty → error | Approval request (MOD-12); balance unchanged until approved |
| UC-07-05 | Open a dispute | Open dispute → category, explanation | — | Dispute (MOD-14); invoice shows Disputed |
| UC-07-06 | Start an investigation | Start investigation | Already has an open one → opens it | Investigation (MOD-11) |
| UC-07-07 | Cancel an invoice | Cancel invoice → confirm | Active allocations exist → blocked with explanation | Status cancelled, balance 0, read-only |
| UC-07-08 | Void an allocation | Void on an allocation row → confirm | — | Allocation voided (kept in history); balance restored |
| UC-07-09 | Export | Export → CSV of the filtered list | — | File downloaded; audit row |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-07-01 | Balance = total − active allocations − approved adjustments; never negative; shown with its calculation. | Must | UI |
| FR-07-02 | Display status by precedence Cancelled → Draft → Paid → Disputed → Overdue → Partially paid → Issued, with secondary chips. | Must | Partial: no Draft, secondary chips partial |
| FR-07-03 | Overdue uses the organization's timezone "today". | Must | Partial: fixed date in prototype |
| FR-07-04 | List tabs with counts, customer filter, search on number/customer/PO, sortable columns (invoice, customer, due, total, balance, days late), pagination. | Must | UI |
| FR-07-05 | Create form with dynamic lines (add/remove), validation as UC-07-02; invoice number auto-assigned per organization or entered and unique per customer. | Must | Partial: number auto only |
| FR-07-06 | Record payment validates 0 < amount ≤ balance; creates a `manual` payment marked unverified until matched to a bank record. | Must | Partial: no unverified marker |
| FR-07-07 | Adjustment request validates amount and reason and goes to approvals; balance changes only on approval. | Must | UI |
| FR-07-08 | Cancel blocked while active allocations exist. | Must | Partial: not blocked in prototype |
| FR-07-09 | Allocations never edited; void + new allocation, both audited. | Must | UI |
| FR-07-10 | Detail shows related payments, disputes, investigations, documents and history. | Must | UI |
| FR-07-11 | CSV export respects filters; Owner and AR with `exports.run`. | Should | UI |
| FR-07-12 | Amounts carry a currency; mixed-currency lists show each row's currency. | Must | Partial: USD only |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-07-01 | Balance updates happen in one transaction with a row lock on the invoice. | Concurrency test: 2 parallel allocations cannot exceed balance |
| NFR-07-02 | List of 100k invoices: p95 ≤ 300 ms per page with filters. | k6 |
| NFR-07-03 | Nightly integrity job recomputes stored balances and alerts on any difference. | Job test |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-07-01 | 01 | U | Balance property test with random allocations/adjustments | Never negative; equals formula (Hypothesis) |
| TC-07-02 | 01 | U | `balOf` on seed invoices | Equals total − active allocations (test exists) |
| TC-07-03 | 05 | C | Create invoice with no customer | "Choose a customer." |
| TC-07-04 | 05 | E | Create invoice for Orchard Bay, $1,200 | Opens detail; status current |
| TC-07-05 | 06 | E | Record payment 999999 on $1,200 | "cannot exceed the balance of $1,200.00" |
| TC-07-06 | 06 | E | Record payment 500 | Allocation 500; status partial |
| TC-07-07 | 07 | E | Request write-off 50 with reason | Approval pending; balance unchanged |
| TC-07-08 | 08 | A | Cancel invoice with an active allocation | `409 invalid_state` |
| TC-07-09 | 02 | U | Status precedence table (all flag combinations) | Matches spec order |
| TC-07-10 | NFR-07-01 | A | Two concurrent allocations of 600 on balance 1,000 | One succeeds, one `422 allocation_exceeds_balance` |
| TC-07-11 | 03 | U | Due today in UTC−8 while UTC is tomorrow | Not overdue |

## 8. Backend contract
`GET /invoices` · `POST /invoices` ⟳ · `GET /invoices/{id}` · `POST /invoices/{id}/cancel` ⟳ · `POST /invoices/{id}/payments` ⟳ · `POST /adjustments` ⟳ · `POST /allocations/{id}/void` ⟳ · `GET /invoices/export.csv`. Tables: `invoices`, `invoice_lines`, `adjustments`, `payment_allocations`.

## 9. Gaps
- Cancel must be blocked with active allocations (FR-07-08) – prototype allows it.
- Manual payments need an "unverified" marker (FR-07-06).
