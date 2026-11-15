# Stage D: reconciliation and approvals (D1 to D3)

Date: 2026-11-15 · Reviewed by: the assistant (owner instruction: build, test and approve each gate)

## Evidence
| Command | Result |
|---|---|
| `cd services/api && uv run pytest` | 122 passed (default run) |
| `uv run pytest -m slow tests/test_reconciliation_api.py` | passed: 1,000 payments against 1,000 invoices reconciled in 6.3 s (900 auto-applied, 100 suggested) on the embedded PostgreSQL |
| `uv run ruff check . && uv run mypy app` | clean (strict) |
| `cd apps/web && npx vitest run` | 44 passed |
| `npx playwright test --project=desktop` (real Supabase project, real API, hosted PostgreSQL) | 24 passed (desktop project, 5.0 min), 0 failed; mobile project covers the public pages in CI |

## Acceptance
| Module | Requirement highlights | Verdict |
|---|---|---|
| MOD-10 rules (D1) | R1 exact reference and amount (auto-applied only when the organization setting is on and nothing else is wrong), R2 partial, R3 overpayment, R4 several references adding up, R5 known customer with one invoice of that amount, R6 unique combination of up to 6 of that customer's invoices, R7 duplicate payment or reference to an invoice already paid, R8 currency mismatch. Pure functions; 13 unit and property tests, including "never guess when two answers fit" and determinism | PASS |
| MOD-10 workspace (D2) | run reconciliation, review suggestions with the keyboard (C, R, J, K), reject needs a reason and a rejected suggestion does not return, auto-applied tab with undo, discrepancies tab with resolve, run history, suggestions go stale when balances move (409 `stale`), re-running is idempotent | PASS. Not done: scheduled runs (needs the job runner, Stage I), run detail page, the "unmatched" tab only links to the payments list |
| MOD-12 approvals (D3) | request write-off, credit, refund due from an invoice; separation of duties (403); reject and ask-for-information need words; decisions cannot change; staleness check with "approve anyway"; expiry after 30 days (configurable per type); withdraw; reply to a request for information; per-type auto-approve limit (never for refunds); requesters see only their own requests | PASS. Not done: final notice type (Stage F), notifications (Stage F), idempotency key on the decision (a second approve returns 409 instead of executing twice, which gives the same safety) |
| Database guards | decisions and adjustments are append-only (update and delete refused even for a superuser), `amount_adjusted` must equal the sum of balance-reducing adjustments, forced RLS on all seven new tables | PASS (tests that bypass the application) |
| Gate D scenario | run reconciliation on real data, undo an auto-match, request a write-off, see a self-approval refused | PASS in the end-to-end run on the real stack. The "second person approves" step cannot be driven through the browser with one test user; it is covered by API tests with an owner and an AR specialist |

## Defects found by testing and fixed
- Reconciliation of 1,000 payments took 74 s. The regular expression built per invoice overflowed Python's pattern cache. Plain string search with token boundaries made it 6.3 s.
- A 403 from the approval decision showed the generic "You do not have permission" text, hiding the real reason (you cannot decide your own request). The detail page now shows the server's message for that case.
- Payment allocation returned a freshly loaded payment on every call, which a bulk run does not need. A separate `apply_allocation` skips it.

## Known gaps carried forward
- A run is synchronous. At the measured speed 10,000 payments would take over a minute, so large organizations need the background job runner (Stage I). The 10k benchmark of the plan is therefore not met as a request, only as a measured projection.
- The real dashboard still renders the local first-run page (Stage H).
- Approval notifications and emails wait for Stage F.
- Real-organization investigations, collections and disputes are still prototype screens (Stages E and F).

**Gate D: approved (self-review). Proceeding to Stage E.**
