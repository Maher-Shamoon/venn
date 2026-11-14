# MOD-13 Collections

Spec: FEATURE_SPECIFICATION §B.9 · Roadmap: M12 (drafts, mark sent), M13 (live sending) · Code: `Workflows.tsx` (Collections, CollectionDetail), `store.ts` (`sendCollection`, `setStage`)

## 1. Purpose
Follow up on overdue invoices with messages drafted only from recorded facts, sent with a person's approval of the wording, and tracked to a promise or payment.

## 2. Scope
| In | Out |
|---|---|
| Queue with filters All, Due today, Reminder 1, Reminder 2, Final notice, Promise to pay; priority explained ("balance weighted by days overdue") | Multi-step cadences [P], SMS, phone dialler |
| Case detail: stage switch (reminder 1, reminder 2, final notice, promise to pay, paused), invoices in case, compose (template, tone, message), Draft from records, Send, Schedule, timeline | Legal escalation workflows |
| Final notice needs approval (MOD-12) | |

## 3. Actors
AR (`collections.work`, `email.send`) · Owner · Mail provider (system)

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-13-01 | Work today's follow-ups | Queue → Due today → open case | — | Case detail |
| UC-13-02 | Draft a reminder | Pick template and tone → Draft from records | — | Message using only case facts (invoice numbers, amounts, due dates) |
| UC-13-03 | Send | Edit if needed → Send | No mailbox connected → "Copy and mark sent"; draft contains an amount or invoice number not in the case → blocked with the offending value | Email sent; timeline entry; stage advances; next date set |
| UC-13-04 | Schedule | Schedule for a date/time | — | Queued send; cancellable |
| UC-13-05 | Record a promise | Stage → Promise to pay with date and amount | Promise date passes unpaid → broken-promise flag, case back in queue | Case paused until the date |
| UC-13-06 | Send a final notice | Stage final notice → request approval | Approval rejected → stays at reminder 2 | Sent after approval |
| UC-13-07 | Pause a disputed case | Dispute opened on the invoice | — | Case paused automatically |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-13-01 | One case per overdue invoice, grouped by customer; created by a nightly job. | Must | Partial: seeded cases |
| FR-13-02 | Priority score deterministic and explained on hover. | Must | UI |
| FR-13-03 | Drafts from templates + case facts; tone presets friendly/firm/final; inserted facts highlighted. | Must | Partial: no fact highlighting |
| FR-13-04 | Post-generation check: every amount, date and invoice number in the draft must exist in case facts; otherwise send is blocked. | Must | None |
| FR-13-05 | Send through the connected mailbox (outbox pattern); without one, copy and mark sent. | Must | Partial: simulated send |
| FR-13-06 | Stage advances on send; next action date set from settings. | Must | UI |
| FR-13-07 | Promise to pay with date and amount; broken promise detection. | Must | Partial: stage only |
| FR-13-08 | Final notice requires approval. | Must | Partial |
| FR-13-09 | Disputed invoices pause their case. | Must | None |
| FR-13-10 | Timeline: sent, replies (linked emails), notes, promises, stage changes. | Must | UI |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-13-01 | A sent email and its timeline/audit entry cannot diverge (outbox, at-least-once with dedupe). | Fault-injection test |
| NFR-13-02 | No send without an explicit user click; scheduled sends show who scheduled them. | Review + E2E |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-13-01 | 03 | E | Draft from records on COL-001 | Message names INV-1050, $4,300.00, due 7 Nov (verified) |
| TC-13-02 | 06 | E | Send | Stage reminder 1 → reminder 2; timeline +1 (verified) |
| TC-13-03 | 04 | U | Draft with "$4,999.00" not in facts | Validator blocks with the value |
| TC-13-04 | 05 | A | Send with no mailbox | Mark-sent path; no provider call |
| TC-13-05 | 07 | A | Promise date passes, no payment | Broken-promise flag; case in queue |
| TC-13-06 | 08 | E | Final notice as AR | Approval request created, not sent |
| TC-13-07 | 09 | A | Open dispute on a collected invoice | Case paused |
| TC-13-08 | NFR-13-01 | A | Mail provider fails after DB commit | Retry sends once; timeline shows one send |

## 8. Backend contract
`GET /collections?filter=` · `GET /collections/{id}` · `PATCH /collections/{id}` (stage, next date, promise) · `POST /collections/{id}/drafts` · `POST /collections/{id}/send` ⟳ · `POST /collections/{id}/schedule` ⟳. Tables: `collection_cases`, `collection_events`, `outbox_messages`, `message_templates`.
