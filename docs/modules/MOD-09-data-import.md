# MOD-09 Data import

Spec: FEATURE_SPECIFICATION §A.6, §B.5, §B.6 · Roadmap: M7 (invoices CSV), M8 (payments CSV), M11 (PDF extraction) · Code: `Import.tsx` (ImportWizard, ImportInvoices, ImportPayments, PdfReview), `store.ts` (`importInvoices`, `importPayments`, `runRecon`)

## 1. Purpose
Bring invoices and payments in from exports without ever silently creating duplicates or overwriting records, and read remittance PDFs with the person confirming every field.

## 2. Scope
| In | Out |
|---|---|
| CSV wizard for invoices and payments: choose file or sample, column mapping, validation (Valid / Warnings / Errors / Duplicates tabs), download problem rows, confirm and save with progress, run reconciliation | Excel files (convert to CSV), scheduled imports |
| PDF remittance review: extracted fields with confidence and source highlight, edit, confirm | Invoice PDF parsing for line items [P] |

## 3. Actors
Owner · AR (`imports.run`)

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-09-01 | Import invoices | Choose CSV → map columns → review rows → Confirm and save | Missing required column → mapping error; ambiguous dates (03/04/2026) → ask format; > 10,000 rows → background job | Valid rows created; problem rows downloadable |
| UC-09-02 | Fix problem rows | Download problem rows, fix in a spreadsheet, re-import | — | Only the fixed rows import; duplicates skipped |
| UC-09-03 | Import payments | Same as UC-09-01 with payment columns; state whether negatives are outgoing | — | Payments created; reconciliation offered |
| UC-09-04 | Re-import changed data | Import a row that exists with different values | — | Conflict row for review, never an overwrite |
| UC-09-05 | Read a remittance PDF | Upload PDF → review fields (low-confidence highlighted) → edit → confirm | Unreadable PDF → extraction failed state | Document stored, fields linked as evidence |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-09-01 | Invoice CSV required columns `invoice_number, customer, issue_date, due_date, total_amount, currency`; optional `po_number, description, tax_amount, external_id`. | Must | Partial: fixed headers, no mapping step |
| FR-09-02 | Payment CSV required `date, amount, currency`; optional `reference, payer_name, method, external_id, memo`. | Must | Partial |
| FR-09-03 | Column mapping screen with auto-detected matches the user can change. | Must | None |
| FR-09-04 | Row validation classes: valid, warning (e.g. unknown customer will be created, extra decimals), error (missing/invalid required field), duplicate (same key in file or in database). | Must | UI |
| FR-09-05 | Duplicate keys: invoice `(customer, invoice_number)`; payment `(source, external_id)` or row fingerprint `(date, amount, currency, reference, payer)`. | Must | Partial: in-file duplicates only |
| FR-09-06 | Problem rows downloadable as CSV with a reason column. | Must | UI |
| FR-09-07 | Import runs as an idempotent job with progress; the same file imported twice creates nothing new. | Must | Partial: progress only |
| FR-09-08 | After a payment import, offer "Run reconciliation". | Must | UI |
| FR-09-09 | Files ≤ 20 MB, `.csv` with text/csv sniffing; formula-injection characters neutralised on export. | Must | Partial |
| FR-09-10 | PDF review shows each extracted field with confidence and the source snippet; fields below 0.8 confidence highlighted; user must confirm. | Must | UI (fixed sample extraction) |
| FR-09-11 | Import history: who, when, file name, counts, link to created records. | Should | None |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-09-01 | 10,000-row CSV validated in ≤ 10 s and saved in ≤ 60 s. | Benchmark in CI nightly |
| NFR-09-02 | No partial imports on failure: a job either commits its batch or rolls back and reports. | Fault-injection test |
| NFR-09-03 | Parsing is streaming; memory ≤ 200 MB for a 20 MB file. | Profiling |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-09-01 | 04 | E | Use the sample invoice file | Counts per tab; Confirm saves only valid + warning rows |
| TC-09-02 | 05 | A | Import the same file twice | Second run: all duplicates, 0 created |
| TC-09-03 | 01 | A | File missing `due_date` column | Mapping error, nothing imported |
| TC-09-04 | 01 | U | Parse `03/04/2026` with format DD/MM | 3 April 2026 |
| TC-09-05 | 06 | E | Download problem rows | CSV has every error row with its reason |
| TC-09-06 | 09 | A | Upload an `.exe` renamed `.csv` | `422` unsupported type |
| TC-09-07 | 09 | U | Export cell `=SUM(A1)` | Written as `'=SUM(A1)` |
| TC-09-08 | 10 | E | Open PDF review | Low-confidence fields highlighted; Confirm stores values |
| TC-09-09 | NFR-09-02 | A | Kill the worker mid-import | No partial rows; job status failed with reason |

## 8. Backend contract
`POST /imports` (multipart, `kind`) → `202 { job_id }` · `GET /imports/{id}` (progress, counts) · `GET /imports/{id}/rows?class=` · `POST /imports/{id}/commit` ⟳ · `GET /imports/{id}/problems.csv` · `POST /documents/{id}/extract` → fields. Tables: `import_jobs`, `import_rows`, `documents`, `extracted_fields`.

## 9. Gaps
- Column mapping (FR-09-03) and database-level duplicate detection (FR-09-05) are not in the prototype.
