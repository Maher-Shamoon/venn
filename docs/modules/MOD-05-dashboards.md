# MOD-05 Dashboards

Spec: FEATURE_SPECIFICATION §B.2, §B.3 · Roadmap: M6 (layout), M14 (real KPIs) · Code: `Dash.tsx`, `charts.tsx`, `ranges.ts`

## 1. Purpose
Show the Owner where money is stuck and what needs a decision; show the AR specialist what to work on today.

## 2. Scope
| In | Out |
|---|---|
| Owner dashboard: 5 KPIs with sparklines and deltas, setup checklist, aging (chart/table), outstanding trend, pending approvals with quick approve, investigations by status, top exposure, overdue by customer, open disputes, integration health, verified recovered, recent activity | Custom widgets, drag-and-drop layout |
| AR dashboard: tasks, needs review, my investigations, unmatched payments, reconciliation throughput, follow-ups due, invoices needing attention, my requests, collections activity | |
| Shared time range 7 days / 30 days / 90 days / 12 months; first-run variant (MOD-03) | Multi-currency breakdown UI (Should, see FR-05-09) |

## 3. Actors
Owner · AR

## 4. Use cases
| ID | Use case | Main flow | Alternatives | Result |
|---|---|---|---|---|
| UC-05-01 | Check the state of receivables | Owner opens `/app` | Range changed → all range-based panels refresh | KPIs and charts for the range |
| UC-05-02 | Drill into a figure | Click a KPI or chart bar | — | Pre-filtered list (e.g. overdue invoices) |
| UC-05-03 | Approve from the dashboard | Click ✓ on a pending approval | Lacks permission → button hidden | Approval decided; panel updates |
| UC-05-04 | Plan the day | AR opens `/app` | Nothing due → empty states | Task list, queues, follow-ups |
| UC-05-05 | Tick off a task | AR ticks a task | — | Task done; count updates |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-05-01 | KPI definitions exactly as FEATURE_SPECIFICATION §B.2 (Total AR, Overdue, Unmatched, Open exposure, Verified recovered); each links to a filtered list. | Must | UI (local figures) |
| FR-05-02 | Range switch (7D/30D/90D/12M) shared across dashboard, analytics and reports; choice remembered for the session. | Must | UI |
| FR-05-03 | Trend uses daily snapshots; the last point is live. 7D daily, 30D/90D weekly-ish, 12M monthly. | Must | Partial: generated series |
| FR-05-04 | Aging buckets (current, 1–30, 31–60, 61–90, 90+) for invoices issued in the range; chart/table toggle. | Must | Partial: 4 buckets (60+), spec asks 5 |
| FR-05-05 | Overdue by customer: top 10 for invoices that fell due in the range; empty state when none. | Must | UI |
| FR-05-06 | Pending approvals list with one-click approve (Owner) and link to detail. | Must | UI |
| FR-05-07 | AR dashboard lists show top 5 with "View all". | Must | UI |
| FR-05-08 | Every chart has an accessible table alternative and a text summary for screen readers. | Must | Partial: table only on aging |
| FR-05-09 | When several currencies exist, KPIs show the default currency with "+ n other currencies" opening a breakdown; no conversion. | Should | None |
| FR-05-10 | Setup checklist until onboarding steps are done; dismissible. | Should | UI |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-05-01 | `GET /dashboard/owner?range=` p95 ≤ 800 ms on 100k invoices. | k6 |
| NFR-05-02 | Charts render without layout shift; skeleton matches final layout. | CLS ≤ 0.05 |
| NFR-05-03 | Chart colours meet 3:1 contrast against the background and are distinguishable for colour-blind users (pattern or label). | Manual check |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-05-01 | 01 | A | Seed known invoices; call dashboard API | Total AR = Σ open balances (exact decimal) |
| TC-05-02 | 01 | U | `totals()` on seed | Aging sums equal receivable (test exists) |
| TC-05-03 | 02 | E | Switch range on dashboard, open Analytics | Analytics shows the same range |
| TC-05-04 | 03 | U | `trendData` for each range | Last point equals live figures; point counts 7/10/13/12 (tests exist) |
| TC-05-05 | 04 | A | Invoice 75 days late | Lands in 61–90 |
| TC-05-06 | 05 | E | Range 7D with nothing due | "No invoices fell overdue in the last 7 days." |
| TC-05-07 | 06 | E | Approve from dashboard | Approval status approved; audit row |
| TC-05-08 | 02 | E | Click Overdue KPI | Invoices list filtered to overdue |
| TC-05-09 | 08 | C | Render each chart | Has an accessible name and table/summary |

## 8. Backend contract
`GET /dashboard/owner?range=` · `GET /dashboard/ar?range=` · `GET /reports/trend?range=` (shared with MOD-15). Tables: `daily_ar_snapshots` (nightly job), live aggregates over `invoices`, `payments`, `investigations`.

## 9. Gaps
- Aging needs 5 buckets per spec (FR-05-04).
- Historical series are generated in the prototype; replace with snapshots (FR-05-03).
