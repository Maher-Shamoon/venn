# MOD-15 Analytics and reports

Spec: FEATURE_SPECIFICATION §B.12 · Roadmap: M14 · Code: `Insight.tsx` (Analytics, Report, Chart), `charts.tsx`, `ranges.ts`

## 1. Purpose
Answer recurring questions about receivables with fixed, defined reports whose every number traces to records.

## 2. Scope
| In | Out |
|---|---|
| Analytics grid of report cards with mini charts and the shared range switch | Natural-language "ask" [P], custom report builder |
| 7 reports: receivables aging, outstanding balance trend, overdue by customer, verified recovered (Owner only); reconciliation performance, investigation resolution time, collections activity | Scheduled email reports [P] |
| Report page: range switch, customer filter (aging, overdue), chart, "How this is calculated", data table, CSV export | |

## 3. Actors
Owner (all) · AR (operational reports)

## 4. Use cases
| ID | Use case | Main flow | Alternatives | Result |
|---|---|---|---|---|
| UC-15-01 | Browse reports | Open Analytics; change range | AR sees only operational reports | Mini charts for the range |
| UC-15-02 | Read a report | Open a report; read definition; filter by customer | No data → "No data for this filter" | Chart + table |
| UC-15-03 | Export | Export CSV | — | File named `<report>-<range>.csv`; audit row |
| UC-15-04 | Drill down | Click a bar or table row | — | Filtered record list |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-15-01 | Seven reports with the definitions on each page. | Must | UI |
| FR-15-02 | Range 7D/30D/90D/12M shared with dashboards; 7D daily, 30D last five weeks, 90D 13 weeks, 12M months; weekly and monthly series consistent. | Must | UI (static series, consistency tested) |
| FR-15-03 | Trend and recovered series from `daily_ar_snapshots`; history does not change when records are edited. | Must | None |
| FR-15-04 | Owner-only reports locked for AR (UI and API). | Must | UI |
| FR-15-05 | CSV export respects range and filters, is permission-checked and audited. | Must | Partial: not audited |
| FR-15-06 | Drill-down from chart elements to records. | Should | None |
| FR-15-07 | Add the spec's discrepancy categories and collection effectiveness reports. | Should | None |
| FR-15-08 | Verified recovered uses the spec formula and lists its component allocations. | Must | Partial |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-15-01 | Report API p95 ≤ 800 ms on 100k invoices. | k6 |
| NFR-15-02 | No AI-generated numbers anywhere in reports. | Review |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-15-01 | 02 | E | Switch ranges on reconciliation performance | 7/5/13/12 rows (verified) |
| TC-15-02 | 02 | U | Weekly Oct sums equal monthly Oct | Equal (test exists) |
| TC-15-03 | 04 | E | AR opens `/app/reports/aging` | Locked |
| TC-15-04 | 05 | E | Export CSV on 30D | File `…-30d.csv` with the table rows |
| TC-15-05 | 03 | A | Edit an old invoice, re-query trend | Past points unchanged |
| TC-15-06 | 08 | A | Payment before first venn action | Not counted as recovered |

## 8. Backend contract
`GET /reports` · `GET /reports/{slug}?range=&customer_id=` → `{ series, table, definition }` · `GET /reports/{slug}.csv`. Tables: `daily_ar_snapshots` and live aggregates.
