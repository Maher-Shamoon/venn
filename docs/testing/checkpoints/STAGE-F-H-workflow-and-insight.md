# Stages F and H: collections, disputes, notifications, dashboards and reports

Date: 2026-11-15 · Reviewed by: the assistant (owner instruction: build, test and approve each gate). Stage H was built before Stage F because a real organization still showed the prototype dashboard.

## Evidence
| Command | Result |
|---|---|
| `cd services/api && uv run pytest` | 161 passed (default run) |
| `uv run pytest -m slow` | passed: reconciliation of 1,000 payments in 6.3 s; owner dashboard over 20,000 invoices in about 0.2 s |
| `uv run ruff check . && uv run mypy app` | clean (strict) |
| `cd apps/web && npx vitest run` | 44 passed |
| `npx playwright test --project=desktop` (real Supabase project, real API, hosted PostgreSQL) | see the last line of this file for the final full run |

## Stage H: dashboards and analytics (MOD-05, MOD-15)
| Requirement | Verdict |
|---|---|
| FR-05-01 KPIs (total receivable, overdue, unmatched, open exposure, verified recovered) from stored records; each links to a filtered list | PASS. Unit test: total equals the sum of open balances to the cent |
| FR-05-02 range switch shared by the dashboard, analytics and every report | PASS |
| FR-05-03 trend whose past points never change | PASS by a different design: the history is rebuilt from invoices, allocations with their void times and adjustments, so no snapshot table is needed. A test shows the live point equals today's figures, including a cancelled invoice that carried an adjustment (a defect found while building this) |
| FR-05-04 five aging buckets | PASS. They cover all open invoices, so they add up to the total receivable (the spec said "issued in the range", which would not add up) |
| FR-05-05 overdue by customer for invoices that fell due in the range | PASS |
| FR-05-06 pending approvals with one-click approve | PASS (the separation-of-duties rule applies there too) |
| FR-05-09 other currencies | PARTIAL: figures are in the default currency and the number of other currencies is stated. No breakdown screen, no conversion |
| FR-15-01 six reports with definitions, customer filter, table | PASS. The seventh (collections activity) is not built |
| FR-15-04 financial reports locked for AR in the interface and the API | PASS |
| FR-15-05 CSV export respects the range, is permission-checked, audited, and safe from spreadsheet formula injection | PASS |
| FR-15-08 verified recovered counts only source-verified payments applied after a case was opened | PASS. It is zero for every organization until a bank or accounting integration exists, and the page says what it measures |
| NFR-05-01 dashboard p95 800 ms at 100k invoices | MEASURED at 20,000 invoices: about 0.2 s locally. 100k is not measured |
| App frame | Real organizations no longer see the prototype's company name, a fixed person, sample notifications, sample search results or sample badge counts. Names, counts and search come from the API |

## Stage F: collections, disputes, notifications (MOD-13, MOD-14, MOD-21)
| Requirement | Verdict |
|---|---|
| FR-13-01 a case per overdue customer | PASS with two changes: one case per customer rather than per invoice, and the queue refreshes when it is viewed because there is no nightly job yet |
| FR-13-02 deterministic, explained priority | PASS (balance × (1 + days overdue / 30), shown on the case) |
| FR-13-03, 13-04 drafts from case facts and a check of every amount, date and invoice number before sending | PASS. A message with an amount, number or date that is not in the case is refused with the offending value |
| FR-13-05 send | PARTIAL: sending records the message, advances the stage and logs the email through the development mailer. Real delivery needs the mail settings of a deployment, and there is no outbox with retries yet. "Mark as sent" is the supported path for now |
| FR-13-06 stage advance and next date | PASS (seven days) |
| FR-13-07 promise to pay and broken promise | PASS (broken promises return the case to the queue and notify) |
| FR-13-08 final notice needs approval | PASS: it cannot be sent until a request is approved, and the approval covers one send |
| FR-13-09 and FR-14-07 a dispute pauses collections and resolution resumes them | PASS |
| MOD-14 disputes: categories, amount at most the invoice total, customer words labelled unverified, append-only notes, one open dispute per invoice | PASS |
| FR-14-05 credit outcome closes the dispute only after the approval | PASS, including rejection reopening it |
| MOD-21 notifications: produced once per event per person (dedupe key), for approval requests and decisions, assignments, disputes and broken promises; bell, page, mark read | PASS. Email notifications and per-user preferences are not built |
| MOD-21 tasks: add, tick | PASS. System-created tasks are not built |
| MOD-17 integrations | The real page now says that nothing is connected and why, instead of showing sample connections (see the blocked items) |

## Defects found by testing and fixed
- A blank task title returned a 500 instead of a validation message. Text inputs that must not be blank are now trimmed and checked when they are read.
- The outstanding-balance history subtracted adjustments of cancelled invoices, so its last point disagreed with the live figure by the adjusted amount.
- The first history query took 2 to 3 s at 20,000 invoices; rewriting it as aggregates took it to 0.2 s.
- The app frame of a real organization showed "Brightpath Digital" and "Dana W." from the prototype data.

## Known gaps carried forward
- No email can leave the system (no SMTP, no outbox with retries). Blocked until a mail provider is chosen.
- Documents have no virus scan and no OCR. Imports from PDF (E2) are not built.
- AI analysis (E4) is blocked on an LLM key.
- Gmail, QuickBooks and Stripe (Stage G) are blocked on accounts and credentials.
- Dashboard and report latency at 100k invoices is not measured. Large reconciliation runs are synchronous.
- Real-organization profile, notification preferences and the audit view of some new event names use the existing screens.
