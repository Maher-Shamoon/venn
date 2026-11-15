# Stage C: core ledger (C1 to C5)

Date: 2026-11-15 · Reviewed by: the assistant (owner instruction: build, test and approve each gate)

## Evidence
| Command | Result |
|---|---|
| `cd services/api && uv run pytest` | 94 passed (+1 slow 5,000-row import test: passed) |
| `uv run ruff check . && uv run mypy app` | clean (strict) |
| `cd apps/web && npx vitest run` | 44 passed |
| `npx playwright test` (real Supabase project, real API, real hosted PostgreSQL) | 34 passed, 10 skipped by design (mobile or shared-data) |
| GitHub Actions | web, e2e (public smoke), api, secrets: all green |

## Acceptance
| Module | Requirement highlights | Verdict |
|---|---|---|
| MOD-06 Customers | create, edit with versions, duplicate names, aliases, search by alias, filters, sort, server paging, stats (open balance, overdue, avg days to pay, last payment) | PASS. Not done: archive action, 8-tab detail (only Invoices, Payments, Aliases, Notes now; the rest arrive with their modules) |
| MOD-07 Invoices | exact totals from lines, sequential numbers, status precedence with secondary badges, overdue in the organization time zone, cancel blocked while payments are applied, manual payment bounded by balance | PASS. Not done: PDF upload (Stage E), Start investigation / Open dispute / Request adjustment buttons (their modules) |
| MOD-08 Payments | manual payments (unverified), allocate with lock ordering, void and reverse (reason required), review flag, currency check, 2 parallel allocations cannot overspend | PASS. Not done: suggested matches panel (Stage D), duplicates tab (R7) |
| MOD-09 Import | column auto-mapping and manual mapping, ambiguous dates need confirmation, valid / warning / error / duplicate classes, nothing saved until confirmed, single transaction, same file twice adds nothing, problem-row CSV with formula neutralising, 5,000 rows | PASS. Not done: background job and progress for very large files (synchronous up to 20,000 rows), PDF review (Stage E) |
| Money and balances | Decimal end to end, floats rejected, balance CHECK plus commit-time triggers against allocations | PASS (property tests, DB tests that bypass the app) |
| G-3 / G-6 | every new tenant table has forced RLS and a policy; cross-tenant tests for customers, invoices, payments, imports | PASS |
| G-4 | audit rows for every ledger mutation; imports write one `import.committed` entry plus `import.validated` (rows are traceable by `import_batch_id`, not audited one by one) | PASS with that documented choice |

## Defects found by testing and fixed
- **A failed commit returned success.** Session cleanup ran after the response was sent, so a constraint failure at commit would have produced 200 with nothing saved. Sessions now use `scope="function"`; a test proves a commit failure is reported as 500.
- Deferred trigger compared a stale NEW value after several changes in one transaction. The guards re-read the row.
- Problem-row CSV lost the column order (jsonb sorts keys). The job's header order is used.
- Allocation picker showed only the oldest 100 open invoices. It now offers the payer's own invoices.
- Per-request latency was 1.4 to 2 s against the hosted database (about 8 round trips). Tenancy, membership and permissions, and the audit link now take one statement each.

## Known gaps carried forward
- **The dashboard in a real organization still renders the local sample/first-run page.** Real KPIs are Stage H. Until then a real organization with data sees the empty-workspace dashboard. This must not ship.
- Lists use page numbers and `total` instead of cursors (fine to ~100k rows; revisit in Stage I).
- Latency to the hosted database is high from this machine (about 210 ms per round trip); production co-locates API and database.

**Gate C: approved (self-review). Proceeding to Stage D.**
