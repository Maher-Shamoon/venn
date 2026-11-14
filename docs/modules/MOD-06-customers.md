# MOD-06 Customers

Spec: FEATURE_SPECIFICATION §B.4 · Roadmap: M7 · Code: `Customers.tsx` (Customers, CustomerDetail, custStats), `store.ts` (`addCustomer`, `updateCustomer`)

## 1. Purpose
Keep one record per paying customer, with the facts needed to match their payments and judge how they pay.

## 2. Scope
| In | Out |
|---|---|
| List with filters (All, Has overdue, Has open issues), search, sort, export | Merging duplicates [P] |
| Create/edit: name, contact, email, payment terms, city, payer aliases, notes | Multiple contacts per customer in the UI (API supports) |
| Detail: KPIs (open balance, overdue, average days to pay, last payment), tabs Overview, Invoices, Payments, Disputes, Investigations, Communication, Documents, Activity | Credit limits, risk scores |

## 3. Actors
Owner · AR (permission `customers.write` to create/edit)

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-06-01 | Find a customer | Search or filter the list, open a row | No match → "No rows match your search." | Detail page |
| UC-06-02 | Add a customer | New customer → fill → Add | Name empty → "Customer name is required."; invalid email → error; duplicate name → warning with link | Customer created; audit row |
| UC-06-03 | Edit a customer | Edit → change → Save | Concurrent edit → "Changed by someone else, reload" (409) | Updated; audit before/after |
| UC-06-04 | Teach venn a payer alias | Add "N. Labs LLC" to payer aliases | — | Reconciliation uses the alias (MOD-10) |
| UC-06-05 | Understand payment behaviour | Open detail → Overview | Customer has no payments → "No payments yet" | Facts with basis ("7 of 9 invoices paid late") |
| UC-06-06 | See everything about a customer | Switch tabs | Empty tab → its empty state | Linked records |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-06-01 | List columns: customer, city, open balance, overdue, open invoices, average days to pay, last payment, issues; sortable; default sort open balance desc. | Must | UI |
| FR-06-02 | Filters: has overdue, has open issues; text search on name and aliases. | Must | UI |
| FR-06-03 | Create and edit with validation (name required, unique per organization case-insensitive; email format; terms 0–365). | Must | Partial: no uniqueness check |
| FR-06-04 | Payer aliases stored as a list; used by reconciliation rule R5/R6 and payer-name suggestions. | Must | UI (stored), used in MOD-10 later |
| FR-06-05 | Detail KPIs computed on the server from records; each states its basis. | Must | Partial: computed locally, no basis text |
| FR-06-06 | Eight tabs with their linked records and empty states. | Must | UI |
| FR-06-07 | Activity tab shows the audit entries for the customer. | Should | Partial |
| FR-06-08 | CSV export of the filtered list. | Should | Partial: Export on invoices, not customers |
| FR-06-09 | Archive (soft delete) a customer with no open balance; archived customers hidden by default. | Should | None |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-06-01 | List of 5,000 customers loads p95 ≤ 300 ms (server pagination). | k6 |
| NFR-06-02 | Average days to pay uses the last 12 months only and organization timezone. | Unit test |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-06-01 | 03 | C | Submit New customer empty | "Customer name is required."; dialog stays |
| TC-06-02 | 03 | E | Add "Orchard Bay Studios" with valid email | Row appears; count +1; audit row |
| TC-06-03 | 03 | A | Create "northwind labs" when "Northwind Labs" exists | `409 duplicate` |
| TC-06-04 | 03 | A | PATCH with stale version | `409 version_conflict` |
| TC-06-05 | 02 | E | Filter "Has overdue" | Only customers with overdue balance |
| TC-06-06 | 05 | A | Customer with 9 invoices, 7 paid late | Overview says "7 of 9 invoices paid late" |
| TC-06-07 | 04 | A | Payment payer "N. Labs LLC", alias set | R5 suggestion for Northwind Labs |
| TC-06-08 | 06 | E | Open each tab of a customer with no disputes | "No disputes" empty state |
| TC-06-09 | NFR-G-02 | A | Read customer of org B as org A | `404` |

## 8. Backend contract
`GET /customers?q=&filter=&sort=&cursor=` · `POST /customers` ⟳ · `GET/PATCH /customers/{id}` · `GET /customers/{id}/stats` · `GET /customers/{id}/activity`. Tables: `customers`, `customer_contacts`, `customer_aliases`.
