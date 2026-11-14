# MOD-19 Audit log

Spec: FEATURE_SPECIFICATION §B.15 · Roadmap: M5 (foundation, every later milestone adds events) · Code: `Admin.tsx` (AuditLog), `store.ts` (`log`)

## 1. Purpose
Give Owners and auditors a complete, tamper-evident record of who did what, when, and what changed.

## 2. Scope
| In | Out |
|---|---|
| Viewer: group tabs, search, paginated table (time, actor, action, record), entry drawer (actor, record, group, request ID, before/after), CSV export | External SIEM streaming [E] |
| Events listed in the spec: auth, membership/permission, financial creates/updates/voids, allocations, imports, investigation changes, approvals, email sends, integrations, settings, exports | Editing or deleting entries (never) |

## 3. Actors
Owner (`audit.view`, `audit.export`) · System (writer)

## 4. Use cases
| ID | Use case | Main flow | Alternatives | Result |
|---|---|---|---|---|
| UC-19-01 | Find what happened | Filter by group, search action/actor/record | No match → empty state | Rows |
| UC-19-02 | Inspect a change | Open an entry | — | Before/after, request ID |
| UC-19-03 | Export | Export CSV | — | File; the export itself is audited |
| UC-19-04 | Verify integrity | Run chain check (operator) | Broken chain → alert | Report |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-19-01 | Every mutation in every module writes an entry in the same transaction (NFR-G-04). | Must | Partial: local log for most actions |
| FR-19-02 | Entry fields: id, UTC time, actor (user or system/job), action key, record type and id, before/after JSON with sensitive fields redacted, request id, IP, user agent, previous hash, own hash. | Must | Partial |
| FR-19-03 | Append-only: DB role has INSERT and SELECT only; trigger rejects UPDATE/DELETE. | Must | None |
| FR-19-04 | Viewer filters: group, actor, record, date range; search; pagination. | Must | Partial: no actor/date filter |
| FR-19-05 | Entry drawer with before/after. | Must | UI |
| FR-19-06 | CSV export, Owner only, audited. | Must | Partial: not audited |
| FR-19-07 | Times shown in the organization timezone with UTC on hover. | Should | None |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-19-01 | Hash chain verifiable end to end; daily verification job. | Job test |
| NFR-19-02 | Retention ≥ 7 years; viewer p95 ≤ 500 ms on 10M entries (indexed by org, time). | k6 on seeded data |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-19-01 | 01 | A | For each mutating endpoint, call it | Exactly one matching audit row (generated test) |
| TC-19-02 | 03 | A | `UPDATE audit_events` as app role | Permission denied |
| TC-19-03 | 02 | A | Change remittance bank account | Account number redacted in before/after |
| TC-19-04 | NFR-19-01 | A | Tamper with a row as superuser, run verifier | Break detected at that row |
| TC-19-05 | 06 | E | AR opens audit log | Locked |

## 8. Backend contract
`GET /audit-events?group=&actor=&record=&from=&to=&cursor=` · `GET /audit-events/{id}` · `GET /audit-events.csv`. Table: `audit_events` (partitioned by month).
