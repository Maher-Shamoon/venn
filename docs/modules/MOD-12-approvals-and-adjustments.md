# MOD-12 Approvals and adjustments

Spec: FEATURE_SPECIFICATION §B.11, ROLE_PERMISSION_MATRIX §5 · Roadmap: M10 · Code: `Workflows.tsx` (Approvals, ApprovalDetail), `store.ts` (`requestApproval`, `decide`, `withdraw`), settings tab Approvals

## 1. Purpose
Make sure no write-off, credit, refund record or final notice happens without an authorised person deciding, with the reason and impact on record.

## 2. Scope
| In | Out |
|---|---|
| Owner queue tabs Pending, Info requested, Decided; AR "My requests" with withdraw | Multi-step approval chains [P] |
| Detail: request (ID, customer, record, reason), impact (before/after balance), evidence, history, decision panel with comment | Delegation while away [P] |
| Decisions: approve, reject (reason required), request more information (comment required) | |
| Adjustments: write-off, credit, refund due; executed on approval | |
| Approval policies (thresholds per type) in Settings | |

## 3. Actors
Requester (AR or Owner) · Approver (`approvals.decide`) · System (expiry, staleness)

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-12-01 | Request an adjustment | From invoice or investigation: type, amount, reason → Submit | Below the auto-approve threshold → applied directly (policy) | Pending approval; requester notified on decision |
| UC-12-02 | Approve | Approver opens request → reviews impact → Approve (optional comment) | Underlying balance changed → "stale" warning, must re-confirm | Adjustment executed; balances updated; audit |
| UC-12-03 | Reject | Reject with a reason | No reason → "Give a reason for rejecting." | Rejected; requester notified |
| UC-12-04 | Ask for information | Request more information with a comment | No comment → error | Status info requested; requester can reply/resubmit |
| UC-12-05 | Withdraw | Requester withdraws a pending request | — | Withdrawn |
| UC-12-06 | Expire | Pending > 30 days | — | Expired; requester notified |
| UC-12-07 | Set policy | Owner sets thresholds per type | — | Applied to new requests |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-12-01 | Request types: write-off, credit, refund due, final notice; each with amount (where relevant), reason and linked record. | Must | UI |
| FR-12-02 | Decisions immutable; approve, reject (reason required), request info (comment required). | Must | UI (reason rule fixed 2026-11-14) |
| FR-12-03 | Separation of duties: a person cannot approve their own request. | Must | None |
| FR-12-04 | Staleness check at execution: if the invoice balance changed since the request, block and ask to re-confirm. | Must | None |
| FR-12-05 | Impact panel shows balance before and after. | Must | UI |
| FR-12-06 | Requester view with status, decision, comment; withdraw while pending. | Must | UI |
| FR-12-07 | Expiry after 30 days (configurable). | Should | None |
| FR-12-08 | Approval policy thresholds per type editable by Owner. | Must | UI |
| FR-12-09 | Dashboard quick-approve uses the same endpoint and rules. | Must | UI |
| FR-12-10 | Notifications to approver on request and to requester on decision. | Must | Partial: in-app only |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-12-01 | Decision and its execution are one transaction; on failure nothing changes. | Fault-injection test |
| NFR-12-02 | Double-click on Approve executes once (idempotency key). | API test |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-12-01 | 02 | E | Reject with empty comment | Toast "Give a reason for rejecting."; still pending (verified) |
| TC-12-02 | 02 | E | Reject with reason | Status rejected; comment shown |
| TC-12-03 | 03 | A | Requester approves own request | `403 permission_denied` (separation of duties) |
| TC-12-04 | 04 | A | Pay the invoice, then approve its write-off | `409 approval_stale` |
| TC-12-05 | 05 | E | Approve a 50 write-off on balance 700 | Balance 650; impact panel matched |
| TC-12-06 | 06 | E | AR withdraws a pending request | Status withdrawn |
| TC-12-07 | 07 | A | Clock + 31 days | Status expired |
| TC-12-08 | NFR-12-02 | A | Same approve with same idempotency key twice | One adjustment |

## 8. Backend contract
`GET /approvals?tab=` · `GET /approvals/{id}` · `POST /approvals/{id}/decision` ⟳ `{ decision, comment }` · `POST /approvals/{id}/withdraw` ⟳ · `POST /adjustments` ⟳ · `GET/PUT /settings/approval-policies`. Tables: `approval_requests`, `approval_decisions`, `adjustments`, `approval_policies`.
