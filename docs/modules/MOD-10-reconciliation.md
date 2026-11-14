# MOD-10 Reconciliation

Spec: FEATURE_SPECIFICATION §B.7 (rules R1–R8) · Roadmap: M9 · Code: `Reconcile.tsx` (Reconciliation, ReconRun), `store.ts` (`runRecon`, `confirmSugg`, `rejectSugg`, `undoAlloc`)

## 1. Purpose
Match payments to invoices with deterministic rules, apply only exact matches automatically, and put everything else in front of a person with the reason in plain words.

## 2. Scope
| In | Out |
|---|---|
| Rules R1–R8 and scheduled detections (missing payment claimed, misallocation, duplicate invoice) | Machine-learned matching |
| Workspace: KPI tiles, tabs Needs review / Unmatched / Auto-applied (undo) / Discrepancies, Run reconciliation, run history and run detail with rule breakdown | |
| Keyboard review: J/K move, C confirm, R reject | |
| Optional AI ranking of the deterministic candidate set with a one-line rationale [M-Complete] | |

## 3. Actors
Owner · AR (`reconciliation.review`) · System job

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-10-01 | Run reconciliation | Click Run reconciliation (or after an import) | A run already in progress → shows it | Job runs; counts per outcome; run detail |
| UC-10-02 | Review suggestions | Needs review tab → read "why" → Confirm or Reject (or C/R) | Balance changed since suggestion → refreshed | Allocations or rejected suggestion |
| UC-10-03 | Undo an auto-applied match | Auto-applied tab → Undo | — | Allocation voided; payment back to unmatched; audit |
| UC-10-04 | Work unmatched payments | Unmatched tab → open payment → allocate or investigate | — | MOD-08 / MOD-11 |
| UC-10-05 | Act on a discrepancy | Discrepancies tab → open → investigation | — | Investigation linked |
| UC-10-06 | Audit a run | Open run detail | — | Payments read, auto-applied, needs review, unmatched, rules fired |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-10-01 | Implement R1–R8 exactly as the spec table, same-currency candidates only, deterministic order. | Must | Partial: seeded suggestions, rule engine not implemented |
| FR-10-02 | Auto-apply only R1 exact matches, only when the organization setting `auto_apply_exact` is on and the payment is not under review. | Must | Partial |
| FR-10-03 | Each suggestion shows rule, confidence and a plain-language reason. | Must | UI |
| FR-10-04 | Confirm/reject one at a time or with keyboard (J/K/C/R); keys ignored while typing in inputs. | Must | UI |
| FR-10-05 | Undo for auto-applied matches. | Must | UI |
| FR-10-06 | Discrepancy types: short payment (after grace days), overpayment, duplicate payment, currency mismatch, missing payment claimed, misallocation, duplicate invoice; each with exposure. | Must | Partial: list from seed |
| FR-10-07 | Run history with counts; run detail with rule breakdown. | Must | UI |
| FR-10-08 | R6 subset search capped at 6 invoices and a time budget; ties never auto-selected. | Must | None |
| FR-10-09 | AI may only reorder the candidate set and add a rationale citing fields; cannot add candidates or apply. | Should | None |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-10-01 | 10,000 payments reconciled in ≤ 2 min. | Benchmark |
| NFR-10-02 | Same input → same suggestions (pure, deterministic). | Golden-file tests |
| NFR-10-03 | Runs are idempotent; re-running does not duplicate suggestions or allocations. | API test |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-10-01 | 01 | U | R1: reference "INV-1047", amount = balance | Exact match |
| TC-10-02 | 01 | U | R2: amount < balance | Partial suggestion; short-payment discrepancy after 7 days |
| TC-10-03 | 01 | U | R3: amount > balance | Allocate up to balance; overpayment discrepancy |
| TC-10-04 | 01 | U | R4: "INV-1047 INV-1048", amount = sum | Multi-invoice suggestion, high |
| TC-10-05 | 01 | U | R5: alias payer, single equal invoice | High suggestion |
| TC-10-06 | 08 | U | R6: two subsets sum to amount | No suggestion (not unique) |
| TC-10-07 | 01 | U | R7: same amount and reference within 14 days | Duplicate discrepancy; payment under review |
| TC-10-08 | 01 | U | R8: reference to EUR invoice from USD payment | Currency mismatch |
| TC-10-09 | 02 | A | Setting off; R1 match | Suggestion only |
| TC-10-10 | 04 | E | J, K, C on Needs review | Allocation created for the focused row (tested in prototype) |
| TC-10-11 | 04 | E | Type "c" in the search box | No confirm |
| TC-10-12 | 05 | E | Undo an auto-applied match | Payment unmatched; audit row |
| TC-10-13 | NFR-10-03 | A | Run twice | Second run creates nothing new |

## 8. Backend contract
`POST /reconciliation/runs` ⟳ → job · `GET /reconciliation/runs/{id}` · `GET /suggestions?status=` · `POST /suggestions/{id}/confirm|reject` ⟳ · `GET /discrepancies?status=` · `POST /allocations/{id}/void` (undo). Tables: `reconciliation_runs`, `match_suggestions`, `discrepancies`.
