# MOD-20 Settings and profile

Spec: FEATURE_SPECIFICATION §B.16 · Roadmap: M5 (company, security), M9 (financial), M10 (approvals) · Code: `Admin.tsx` (Settings, Profile), `store.ts` (`saveSettings`, `reset`, `startFresh`)

## 1. Purpose
Let Owners set how the organization works, and let each person manage their own account.

## 2. Scope
| In | Out |
|---|---|
| Settings tabs: Company, Financial (currency, timezone, terms, auto-apply exact, short-payment and claim grace days), Approvals (thresholds), Notifications, Roles, Remittance (bank details behind re-authentication), Security (require MFA, sessions with End), Data (export, reset sample, empty workspace, request deletion with typed confirmation) | Billing/subscription [P] |
| Profile: change password, two-step verification, personal notification preferences | Avatar upload |

## 3. Actors
Owner (`settings.manage`) · Every user (profile)

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-20-01 | Update company details | Company → edit → Save changes | Name empty → error | Saved; sidebar name updates |
| UC-20-02 | Tune matching | Financial → grace days, auto-apply → Save | Terms ≤ 0 → "Payment terms must be above zero." | Next reconciliation uses them |
| UC-20-03 | Change remittance details | Change details → password → bank, account | Wrong password → denied | Saved; all Owners notified; audited with redaction |
| UC-20-04 | End a session | Security → End on a session | — | Session revoked |
| UC-20-05 | Export data | Data → Export | — | Job builds a ZIP of CSVs; link by email |
| UC-20-06 | Request organization deletion | Type organization name → Request deletion | Name mismatch → button disabled | Request logged; support process |
| UC-20-07 | Change own password | Profile → new + confirm → Update | Weak or mismatch → error | Other sessions ended |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-20-01 | Eight settings tabs with URL per tab (`/app/settings/:tab`). | Must | UI |
| FR-20-02 | Validation per field; Save shows success or field errors from the API. | Must | Partial: few validations |
| FR-20-03 | Financial settings feed reconciliation and collections. | Must | Partial |
| FR-20-04 | Remittance change needs re-authentication, notifies all Owners and is audited with redaction (fraud control). | Must | Partial: password prompt only |
| FR-20-05 | Security: require MFA for Owners/all; active sessions list with End. | Should | Partial: UI rows |
| FR-20-06 | Data export as a background job. | Must | Partial: immediate CSV |
| FR-20-07 | "Reset sample" and "Start with an empty workspace" exist only for sandbox organizations. | Must | Partial: always shown |
| FR-20-08 | Profile: password change with policy (MOD-02), MFA enrolment, notification preferences. | Must | Partial |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-20-01 | Settings changes apply on the next request (no cache longer than 60 s). | API test |
| NFR-20-02 | Remittance changes cannot be made with a session older than 5 minutes without re-auth. | API test `403 reauthentication_required` |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-20-01 | 01 | E | Click each tab | URL changes; no skeleton flash after first (verified) |
| TC-20-02 | 02 | E | Save company name "Brightpath Studio" | Sidebar shows the new name (verified) |
| TC-20-03 | 02 | E | Financial terms 0 → Save | "Payment terms must be above zero." |
| TC-20-04 | 04 | A | Change remittance without re-auth | `403 reauthentication_required` |
| TC-20-05 | 04 | A | Change remittance | All Owners get a notification; audit shows redacted values |
| TC-20-06 | 06 | A | Request data export | Job completes; ZIP has one CSV per entity |
| TC-20-07 | 07 | E | Real organization Data tab | No reset/empty-workspace buttons |

## 8. Backend contract
`GET/PATCH /settings/{company|financial|notifications|security}` · `PUT /settings/approval-policies` · `POST /settings/remittance` (re-auth) · `GET /sessions` · `DELETE /sessions/{id}` · `POST /exports` → job · `POST /organization/deletion-request`. Tables: `organization_settings`, `approval_policies`, `remittance_details` (encrypted), `export_jobs`.
