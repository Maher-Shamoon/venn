# MOD-08 Payments and allocations

Spec: FEATURE_SPECIFICATION §A.4–A.5, §B.6 · Roadmap: M8 · Code: `Payments.tsx` (Payments, PaymentDetail, payState), `store.ts` (`allocate`, `undoAlloc`, `setPayStatus`, `confirmSugg`, `rejectSugg`, `openInvg`)

## 1. Purpose
Record money received, apply it to invoices, and keep every application traceable and reversible without losing history.

## 2. Scope
| In | Out |
|---|---|
| List tabs All, Unallocated, Allocated, Under review, Duplicates; search; sort | Outgoing payments other than refund linking |
| Detail: facts (amount, allocated, unallocated, reference, source, customer), suggested match (confirm/reject), manual allocation, allocations table with void, history | Payment initiation, bank transfers |
| Status actions: Mark under review / Clear review, Mark reversed, Open investigation | |

## 3. Actors
Owner · AR (`payments.write`, `allocations.write`)

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-08-01 | Review a payment | Open from list | — | Facts, suggestion, allocations |
| UC-08-02 | Accept a suggested match | Confirm | Invoice balance changed since the suggestion → refreshed suggestion and warning | Allocation(s) created; suggestion confirmed |
| UC-08-03 | Reject a suggestion | Reject | — | Suggestion rejected with reason; payment stays unmatched |
| UC-08-04 | Allocate manually | Choose open invoice, amount → Allocate | No invoice → "Choose an invoice."; amount > unallocated or > invoice balance → error; different currency → blocked | Allocation; both balances update |
| UC-08-05 | Void an allocation | Void → confirm | — | Allocation voided; invoice reopened |
| UC-08-06 | Flag a payment | Mark under review | Clear review | Payment excluded from auto-apply while under review |
| UC-08-07 | Reverse a payment | Mark reversed → confirm | — | All allocations voided in one transaction; invoices reopened |
| UC-08-08 | Investigate | Open investigation | One already open → opens it | Investigation (MOD-11) |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-08-01 | Payment fields: date, amount, currency, method, reference, payer as received, customer (nullable), source, external ID, verification level, memo. | Must | Partial: no currency/verification fields shown |
| FR-08-02 | Computed status unmatched / partially allocated / fully allocated, plus flags under review and reversed. | Must | UI |
| FR-08-03 | Unallocated = amount − Σ active allocations ≥ 0. | Must | UI |
| FR-08-04 | Manual allocation validates invoice chosen, 0 < amount ≤ min(unallocated, invoice balance), same currency, invoice not cancelled. | Must | Partial: currency not checked |
| FR-08-05 | Allocations are void + new, never edited; voided rows visible in history. | Must | UI |
| FR-08-06 | Reversal voids all allocations atomically and requires a reason. | Must | Partial: no reason prompt |
| FR-08-07 | Confirming a suggestion re-validates balances server-side at confirm time. | Must | Partial |
| FR-08-08 | Verification level shown: bank/gateway = verified; manual = unverified until matched. | Must | None |
| FR-08-09 | Duplicates tab lists payments flagged by rule R7 with the payment they duplicate. | Must | UI |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-08-01 | Allocation writes lock payment then invoices in ID order (no deadlocks). | Concurrency test with 50 parallel allocations |
| NFR-08-02 | Every allocation and void is audited with before/after balances. | API test |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-08-01 | 04 | E | Allocate with no invoice chosen | "Choose an invoice." |
| TC-08-02 | 04 | E | Allocate 1,000 of PAY-0016 to INV-1042 | INV-1042 paid +1,000; PAY-0016 unallocated 1,150 |
| TC-08-03 | 04 | A | Allocate more than the invoice balance | `422 allocation_exceeds_balance` |
| TC-08-04 | 04 | A | Allocate USD payment to EUR invoice | `422 currency_mismatch` |
| TC-08-05 | 05 | E | Void an allocation | Row shows voided; balances restored; audit row |
| TC-08-06 | 06 | A | Reverse a payment with 2 allocations | Both voided in one transaction; invoices reopened |
| TC-08-07 | 07 | A | Confirm a suggestion after the invoice was paid elsewhere | `409 invalid_state` with refreshed data |
| TC-08-08 | NFR-08-01 | A | 50 parallel allocations on one payment | Σ never exceeds amount; no deadlock |
| TC-08-09 | 03 | U | Property test: random allocate/void sequences | Unallocated always ≥ 0 |

## 8. Backend contract
`GET /payments` · `POST /payments` ⟳ (manual) · `GET /payments/{id}` · `POST /payments/{id}/allocations` ⟳ · `POST /allocations/{id}/void` ⟳ · `POST /payments/{id}/review` · `POST /payments/{id}/reverse` ⟳ · `POST /suggestions/{id}/confirm|reject` ⟳. Tables: `payments`, `payment_allocations`, `match_suggestions`.
