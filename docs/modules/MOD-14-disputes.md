# MOD-14 Disputes

Spec: FEATURE_SPECIFICATION §B.10 · Roadmap: M12 · Code: `Workflows.tsx` (Disputes, DisputeDetail), `Invoices.tsx` (Open dispute), `store.ts` (`addDispute`, `noteDispute`, `resolveDispute`)

## 1. Purpose
Track a customer's disagreement with an invoice from claim to outcome, keeping their words separate from what the records show.

## 2. Scope
| In | Out |
|---|---|
| List with filters all, open, awaiting customer, resolved; New dispute | AI dispute summaries [P] |
| Detail: customer's explanation (quoted, unverified), timeline and internal notes, resolution (outcome), linked invoice/customer/owner, evidence documents | Customer portal |
| Resolution outcomes; a credit outcome creates an approval request | |

## 3. Actors
AR (`disputes.work`) · Owner

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-14-01 | Log a dispute | From invoice or New dispute: invoice, category, disputed amount, explanation | Amount > invoice total → error | Dispute open; invoice shows Disputed; collection paused |
| UC-14-02 | Work it | Add internal notes; set awaiting customer | — | Timeline |
| UC-14-03 | Resolve | Choose outcome (withdrawn, upheld, partially upheld with credit, rejected) → Resolve | Credit outcome → approval request first | Resolved; read-only |
| UC-14-04 | Link with an investigation | Open investigation from the dispute or vice versa | — | Linked, not merged |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-14-01 | Categories: pricing, quantity/hours, quality/service, duplicate billing, missing PO, not received, tax, payment already made, other. | Must | Partial: shorter list |
| FR-14-02 | Disputed amount ≤ invoice total; required. | Must | Partial |
| FR-14-03 | Customer explanation shown as a quote, labelled unverified. | Must | UI |
| FR-14-04 | Notes timeline; notes are append-only. | Must | UI |
| FR-14-05 | Resolution outcome required; credit outcomes go through approvals before the dispute closes. | Must | Partial: resolves immediately with "(awaiting approval)" |
| FR-14-06 | Due date per dispute; overdue disputes highlighted and in the AR dashboard. | Should | UI |
| FR-14-07 | Open dispute pauses the invoice's collection case; resolution resumes it. | Must | None |
| FR-14-08 | Evidence panel lists documents linked to the invoice or customer. | Must | UI |

## 6. Non-functional requirements
Inherits global NFRs only.

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-14-01 | 02 | A | Dispute 20,000 on a 18,000 invoice | `422 validation_error` |
| TC-14-02 | 01 | E | Open dispute from INV-1055 | Dispute created; invoice Disputed (verified) |
| TC-14-03 | 04 | E | Add internal note | Appears in timeline with author and time |
| TC-14-04 | 05 | E | Resolve as "Customer withdrew the dispute" | Resolved, read-only (verified) |
| TC-14-05 | 05 | A | Resolve with credit | Approval request; dispute closes only after approval |
| TC-14-06 | 07 | A | Open then resolve a dispute on a collected invoice | Case paused then resumed |

## 8. Backend contract
`GET /disputes?status=` · `POST /disputes` ⟳ · `GET /disputes/{id}` · `POST /disputes/{id}/notes` · `POST /disputes/{id}/resolve` ⟳. Tables: `disputes`, `dispute_events`.
