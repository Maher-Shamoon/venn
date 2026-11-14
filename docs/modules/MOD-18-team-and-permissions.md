# MOD-18 Team and permissions

Spec: FEATURE_SPECIFICATION §B.14, ROLE_PERMISSION_MATRIX · Roadmap: M5 · Code: `Admin.tsx` (Team, MemberDetail), settings tab Roles, `store.ts` (`invite`, `setMember`, `setPerm`)

## 1. Purpose
Let Owners bring people in, give them the right role and permissions, and remove access immediately when needed.

## 2. Scope
| In | Out |
|---|---|
| Members table, pending invitations (resend, revoke), invite dialog (work email, role) | Custom roles [E], SCIM |
| Member detail: role, configurable AR permissions, suspend/reactivate, recent activity | |
| Roles & permissions editor with locked items | |

## 3. Actors
Owner (`team.manage`) · Invited person · Member

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-18-01 | Invite | Invite → email, role → Send invitation | Invalid email → "Enter a valid email address."; already a member or invited → "already on the team." | Invitation emailed, 7-day expiry |
| UC-18-02 | Resend / revoke | From pending invitations | — | New token / token invalid |
| UC-18-03 | Change a role | Member detail → role | Removing the last Owner → blocked (`last_owner`) | Applies on the member's next request |
| UC-18-04 | Adjust AR permissions | Toggle allowed items; locked items cannot change | — | Permission set saved |
| UC-18-05 | Suspend | Suspend → confirm | Suspending yourself → blocked | Sessions revoked; access denied immediately |
| UC-18-06 | Reactivate | Reactivate | — | Access restored |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-18-01 | Members table: name, email, role, status, last active. | Must | UI |
| FR-18-02 | Invite with email validation and duplicate check (members and pending). | Must | UI |
| FR-18-03 | Invitation email with a single-use 7-day token; resend replaces the token; revoke invalidates it. | Must | Partial: resend only, no email |
| FR-18-04 | At least one active Owner always exists. | Must | None |
| FR-18-05 | Suspension revokes sessions and takes effect on the next request. | Must | Partial: status only |
| FR-18-06 | Permission editor for AR with locked items shown as locked; changes audited. | Must | UI |
| FR-18-07 | Only Owners see Team; AR gets the locked state. | Must | UI |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-18-01 | Invitation tokens are random 256-bit, stored hashed. | Code review + test |
| NFR-18-02 | Invite endpoint rate-limited 10/min per Owner. | API test |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-18-01 | 02 | E | Send invitation empty | "Enter a valid email address." (verified) |
| TC-18-02 | 02 | E | Invite an existing invitee | "already on the team." (verified) |
| TC-18-03 | 04 | A | Demote the only Owner | `422 business_rule_violation: last_owner` |
| TC-18-04 | 05 | A | Suspend a member, call API with their token | `403 membership_suspended` |
| TC-18-05 | 03 | A | Accept a revoked invitation | Expired page |
| TC-18-06 | 06 | A | Remove `approvals.decide` from AR, AR approves | `403` |

## 8. Backend contract
`GET /members` · `POST /invitations` ⟳ · `POST /invitations/{id}/resend` · `DELETE /invitations/{id}` · `GET/PATCH /members/{id}` (role, status) · `GET/PUT /roles/ar/permissions`. Tables: `memberships`, `invitations`, `role_permissions`.
