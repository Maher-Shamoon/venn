# MOD-11 Investigations (flagship)

Spec: FEATURE_SPECIFICATION §B.8, AI_AGENT_ARCHITECTURE · Roadmap: M11 · Code: `Reconcile.tsx` (Investigations, Board, InvestigationDetail), `store.ts` (`openInvg`, `setInvgStatus`, `assignInvg`, `addEvidence`, `addInvgNote`, `rerun`, `actOnInvg`)

## 1. Purpose
Turn each discrepancy into a case file that separates confirmed facts from claims, calculates in code, recommends one action from a fixed list, and hands consequential actions to an approver.

## 2. Scope
| In | Out |
|---|---|
| List as Board (columns New, In progress, Ready for review, Awaiting approval, Monitoring, Resolved; drag to move; keyboard "Move" select) or Table; filters All, Assigned to me, Ready for review, Awaiting approval, Monitoring | Free-form chat with the AI |
| Detail: status/priority/exposure/analysis pills; What happened; Findings in five groups (confirmed, calculated, possible, unverified claim, missing evidence); Recommendation with its approval gate; Approval link; Resolution; Activity tab; Evidence panel with type filter and preview drawer | Actions outside the closed action catalog |
| Actions: Re-run analysis (4-step progress), Assign, Add note, Add evidence, Dismiss (reason), Mark resolved; stale-analysis banner | |
| Analysis states: running, completed (versioned), failed (retry), insufficient evidence (re-run blocked until evidence added) | |

## 3. Actors
Owner · AR (`investigations.work`) · AI analysis service (system) · Approver (MOD-12)

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-11-01 | Triage the queue | Open board, filter, drag a card to In progress | Keyboard user uses "Move" select | Status changed; audit |
| UC-11-02 | Read a case | Open detail: summary, findings, evidence | — | Clear view of facts vs claims |
| UC-11-03 | Inspect evidence | Click evidence → drawer (invoice, payment, email, PDF) | — | Link to the source record |
| UC-11-04 | Re-run analysis | Re-run → 4 steps → new version | Records changed → stale banner prompts re-run | Version +1; prior versions kept |
| UC-11-05 | Recover from failed analysis | Banner "Analysis failed… No records were changed" → Try again | Fails again → stays failed; user can still work manually | Findings after success |
| UC-11-06 | Supply missing evidence | Banner "Not enough evidence" → Add evidence → Re-run | Re-run without new evidence → "Still not enough evidence" | Recommendation appears |
| UC-11-07 | Act on the recommendation | Click the recommended action | Needs approval and user is AR → "Submit for approval" | Action done or approval request |
| UC-11-08 | Assign / note | Assign to a teammate; add an internal note | — | Timeline entries |
| UC-11-09 | Close | Mark resolved, or Dismiss with a reason | — | Read-only case |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-11-01 | Investigations open automatically for short payment, duplicate payment, missing payment claimed, overpayment; manually from invoices and payments. | Must | Partial: manual only |
| FR-11-02 | Board and table views over the same filtered set; drag-and-drop and keyboard move both change status with an audit entry. | Must | UI |
| FR-11-03 | Findings grouped in the five kinds, each finding citing evidence IDs; calculations produced by code, labelled "Calculated by venn, not by AI". | Must | UI (seeded findings) |
| FR-11-04 | Analysis is versioned; re-run keeps earlier versions; human notes never overwritten. | Must | Partial: version counter only |
| FR-11-05 | Failed analysis state with retry; nothing guessed; workspace stays usable. | Must | UI |
| FR-11-06 | Insufficient-evidence state; re-run blocked until a document or email is linked. | Must | UI |
| FR-11-07 | Stale banner when linked records changed after the last analysis. | Must | UI |
| FR-11-08 | Recommendation chosen only from the action catalog; shows the gate (no approval / approval required). | Must | UI |
| FR-11-09 | Priority critical/high/medium/low from exposure and age; user can override. | Must | Partial: fixed priority |
| FR-11-10 | Evidence add/remove with type filter and preview; tier label (bank, accounting, manual, claim). | Must | Partial: no tier labels |
| FR-11-11 | Resolution records the outcome and, when money arrives, "Verified: amount received on date (payment)". | Must | Partial |
| FR-11-12 | Exposure updates when linked balances change. | Must | UI (on re-run) |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-11-01 | Analysis completes in ≤ 60 s p95; UI polls job status. | Job metrics |
| NFR-11-02 | AI cannot write financial records (import-linter: `ai` cannot import write services). | CI layering check |
| NFR-11-03 | Every AI sentence cites at least one evidence ID; uncited sentences are dropped. | AI evaluation suite |
| NFR-11-04 | Prompt and model versions recorded per analysis version. | DB check |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-11-01 | 02 | E | Drag INVG-0003 to Ready for review | Status changes; toast; audit (verified in prototype) |
| TC-11-02 | 02 | E | Keyboard: focus card select, choose Monitoring | Card moves |
| TC-11-03 | 05 | E | Open INVG-0006, Try again | Findings appear; pill "analysis v1" (verified) |
| TC-11-04 | 06 | E | INVG-0005 Re-run without evidence | "Still not enough evidence" (verified) |
| TC-11-05 | 06 | E | Add a document, Re-run | Banner gone; recommendation shown (verified) |
| TC-11-06 | 03 | U | Findings validator with an uncited sentence | Rejected |
| TC-11-07 | 08 | U | Model returns an action outside the catalog | Rejected; falls back to no recommendation |
| TC-11-08 | 04 | A | Re-run twice | Versions 1..3 retrievable |
| TC-11-09 | 07 | A | Change invoice balance after analysis | `stale = true` on GET |
| TC-11-10 | 09 | E | Dismiss with empty reason | Button disabled |
| TC-11-11 | NFR-11-02 | CI | import-linter contract | Passes |

## 8. Backend contract
`GET /investigations?view=&filter=` · `POST /investigations` ⟳ · `GET /investigations/{id}` · `PATCH /investigations/{id}` (status, assignee, priority; If-Match) · `POST /investigations/{id}/evidence` · `POST /investigations/{id}/notes` · `POST /investigations/{id}/analysis` → job · `GET /investigations/{id}/analysis/{version}` · `POST /investigations/{id}/actions` ⟳. Tables: `investigations`, `investigation_evidence`, `investigation_findings`, `analysis_runs`, `investigation_events`.
