# MOD-16 Documents and email intelligence

Spec: FEATURE_SPECIFICATION §B.18 · Roadmap: M11 (documents), M13 (email) · Code: `Insight.tsx` (Documents), `Import.tsx` (PdfReview), `store.ts` (`addDoc`)

## 1. Purpose
Store the documents and emails that explain payments, read them, and attach them to the right customer, invoice or investigation as evidence, never as proof of payment.

## 2. Scope
| In | Out |
|---|---|
| Documents library: type filter, upload with "link next upload to" record, preview drawer, status, size | Document editing, e-signature |
| Extraction: text layer, OCR fallback, typed fields for remittance advice | Full invoice line-item extraction [P] |
| Email (Gmail): filtered sync of financial mail, classification, entity extraction, linking with confidence, review list for uncertain links | Outlook [P] |

## 3. Actors
Owner · AR (`documents.write`) · Extraction and email workers (system)

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-16-01 | Upload a document | Choose link target → Upload | Over size or wrong type → error; malware detected → rejected | Stored privately; extraction queued |
| UC-16-02 | Preview | Click a document | — | Drawer with page preview and extracted text |
| UC-16-03 | Use as evidence | From investigation → Add evidence → pick document | — | Linked; tier 4 (supporting only) |
| UC-16-04 | Sync email | Gmail connected → worker syncs matching messages | Token revoked → integration needs attention | Emails stored, classified, linked |
| UC-16-05 | Review uncertain links | Open review list → confirm or change link | — | Link confirmed |
| UC-16-06 | Payment claim email | Email classified `payment_claim` | No verified payment within grace → `missing_payment_claimed` discrepancy | Evidence only, never a payment |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-16-01 | Upload PDF/PNG/JPG/CSV ≤ 20 MB with MIME sniffing and extension check. | Must | Partial: 5 MB limit, no sniffing |
| FR-16-02 | Malware scan before the file is available. | Must | None |
| FR-16-03 | Private storage; signed short-lived URLs for preview. | Must | None |
| FR-16-04 | Types: invoice, contract, purchase order, remittance advice, statement, other; filter by type. | Must | UI |
| FR-16-05 | Link to invoice, customer or investigation at upload or later. | Must | UI |
| FR-16-06 | Text extraction with OCR fallback; chunks embedded for retrieval within the same organization only. | Must | None |
| FR-16-07 | Gmail sync limited to the financial filter; store headers, snippet, body text, IDs, attachment metadata. | Should | None |
| FR-16-08 | Classification and extraction (invoice numbers, amounts, dates, references) with confidence; uncertain links to a review list. | Should | None |
| FR-16-09 | Emails appear in the customer Communication tab and as investigation evidence. | Should | Partial: sample email in evidence drawer |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-16-01 | Retrieval never crosses organizations (vector search filtered by `organization_id`). | Cross-tenant RAG test |
| NFR-16-02 | Extraction of a 5-page PDF ≤ 30 s p95. | Job metrics |
| NFR-16-03 | Gmail scopes limited to `gmail.readonly` and `gmail.send`. | OAuth config review |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-16-01 | 01 | E | Upload 2 KB PDF | Listed; linked target set (verified) |
| TC-16-02 | 01 | E | Upload 6 MB file | Error (prototype limit 5 MB; target 20 MB) |
| TC-16-03 | 01 | A | Upload a PNG renamed `.pdf` | Detected as PNG; stored with correct type or rejected per policy |
| TC-16-04 | 02 | A | EICAR test file | Rejected |
| TC-16-05 | 06 | A | Org A retrieval query | Never returns org B chunks |
| TC-16-06 | 08 | U | Classify sample "we sent the remaining $1,000" | `payment_claim`, amount 1000, invoice INV-1042 |
| TC-16-07 | UC-16-06 | A | Claim email, no payment in 5 business days | Discrepancy created; no payment row |

## 8. Backend contract
`POST /documents` (multipart) ⟳ · `GET /documents?type=&link=` · `GET /documents/{id}` (signed URL) · `PATCH /documents/{id}` (links) · `GET /emails?customer_id=` · `POST /emails/{id}/links` · `GET /email-review`. Tables: `documents`, `document_chunks` (pgvector), `emails`, `email_links`, `extracted_fields`.

## 9. Gaps
- Upload limit is 5 MB in the prototype, 20 MB in the spec (FR-16-01).
