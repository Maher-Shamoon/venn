# Stage E: documents and investigations (E1 to E3). E4 (AI analysis) is BLOCKED

Date: 2026-11-15 · Reviewed by: the assistant (owner instruction: build, test and approve each gate)

## What is done and what is not
| Checkpoint | State |
|---|---|
| E1 Documents | Done, with three documented shortcuts below |
| E2 PDF review of imports | Not done. The import wizard still reads CSV only; PDF text is extracted and stored, but nothing turns it into rows yet |
| E3 Investigations without AI | Done |
| E4 AI analysis | **BLOCKED: no LLM API key has been provided.** Nothing AI-related was written and no key was invented |

## Evidence
| Command | Result |
|---|---|
| `cd services/api && uv run pytest` | 141 passed (default run) |
| `uv run ruff check . && uv run mypy app` | clean (strict) |
| `cd apps/web && npx vitest run` | 44 passed |
| `npx playwright test e2e/documents.spec.ts e2e/investigations.spec.ts --project=desktop` (real Supabase project, real API, hosted PostgreSQL) | 2 passed |

## Acceptance
| Module | Requirement highlights | Verdict |
|---|---|---|
| MOD-11 open (FR-01) | cases open by themselves from short payment, overpayment, duplicate payment and currency mismatch discrepancies, one case per discrepancy, and by hand from an invoice or payment | PASS (missing-payment claims need email, Stage G) |
| MOD-11 board and table (FR-02) | board with drag and drop and a keyboard "Move" select, table with search and sort, filters All, Assigned to me, Ready for review, Awaiting approval, Monitoring; each move is audited and shown in the timeline | PASS |
| MOD-11 findings (FR-03) | five kinds (confirmed, calculated, possible, unverified claim, missing evidence); every confirmed or calculated finding cites a record; calculations are labelled "Calculated by venn, not by AI". Produced by pure rules, not a model | PASS |
| MOD-11 versions (FR-04) | every re-run is a new immutable version; earlier versions are listed; notes are never overwritten | PASS |
| MOD-11 insufficient evidence (FR-06) | a shortfall that is not tiny stays at "insufficient evidence" with no recommendation; re-running without new evidence is refused (409); linking a document or message allows a new analysis | PASS |
| MOD-11 stale (FR-07) | a changed balance, allocation or evidence marks the analysis stale on read | PASS |
| MOD-11 actions (FR-08) | recommendations come only from a closed catalog; write-off, credit and refund create an approval request and move the case to Awaiting approval; the requester cannot approve it | PASS |
| MOD-11 priority (FR-09) | from exposure and age, with a manual override that is remembered | PASS |
| MOD-11 evidence (FR-10) | add and remove documents, messages and notes with a tier; the invoice and payment that opened the case cannot be removed | PASS |
| MOD-11 resolution (FR-11) | resolving records the outcome and the invoice balance read from the records at that moment ("Verified from records"). It does not yet wait for a payment to arrive | PARTIAL |
| MOD-16 documents | type decided from the bytes (PDF, PNG, JPEG, CSV, text), 20 MB limit, same file twice returns the existing one, file names cleaned, PDF text extracted and searchable, authenticated download with `nosniff`, delete blocked while the document is evidence in an open case, forced RLS, cross-organization reads return 404 | PASS with the shortcuts below |

## Shortcuts, stated plainly
- **Files are stored in PostgreSQL**, not object storage with signed links. Fine for pilot volumes; move to object storage before large uploads become common.
- **No virus scan.** Only content-type checking and download headers protect against hostile files. A scanner (ClamAV) must be added before real customer uploads.
- **No OCR.** Images and scanned PDFs are stored without text and say so in the interface.
- No embeddings or semantic search yet (they only matter once the AI step exists).

## Defects found by testing and fixed
- Timeline entries written in one transaction shared one timestamp and came back in random order. Entries now take the clock time of each write.
- A reconciliation test helper allocated the payment before the run, which hid the short-payment path. The rules now take the shortfall from the discrepancy exposure.

## Known gaps carried forward
- E4: needs an Anthropic API key (and an embeddings key if semantic retrieval is wanted). The deterministic path is complete without it and the interface already has the slots (analysis versions, recommendation, gate).
- A case whose approval is later decided is not moved automatically; the person resolves it.
- Collections, disputes and notifications are still prototype screens in real organizations (Stage F).

**Gate E: partially approved (self-review). E1 and E3 pass. E2 and E4 are open. Continuing with Stage H (dashboards), because a real organization still sees the prototype dashboard, then Stage F.**
