# MOD-02 Identity and access

Spec: FEATURE_SPECIFICATION §B.1, ROLE_PERMISSION_MATRIX · Roadmap: M5 · Code: `components/app/Auth.tsx` (Login, Signup, VerifyEmail, Forgot, Reset, Invite), `auth/localAuth.ts`, `App.tsx` (Guard, Demo), `components/app/System.tsx` (403, session expired)

## 1. Purpose
Let people create an account, prove their email, sign in and out, recover a password and join an organization by invitation. Decide what each signed-in user may do.

## 2. Scope
| In | Out |
|---|---|
| Email + password sign-up and sign-in, email verification, password reset, invitation acceptance, sign-out, session expiry, route guard, roles Owner and AR, MFA (TOTP) enrolment | SSO/SAML (enterprise), social login, multiple organizations per user in the UI (API supports it), custom roles |
| Split-screen auth pages with the venn-diagram showcase | |

## 3. Actors
Visitor · Invited person · Owner · AR specialist · Supabase Auth (system) · venn API (system)

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-02-01 | Create an account | Visitor enters name, work email, password meeting the rules, accepts terms → account created → verification email | Weak password, invalid email, terms unticked → inline error. Email already registered → same "check your email" screen (no account enumeration) | Unverified account; user on "Check your email" |
| UC-02-02 | Verify email | User opens the link from the email | Link expired → resend (30 s cooldown) | Verified; continues to onboarding |
| UC-02-03 | Sign in | User enters email and password | Wrong password or unknown email → one generic message; 5 failures in 15 min → locked message; unverified → verification screen; MFA enrolled → TOTP step | Session cookie set; lands on the page they were sent from, or `/app` |
| UC-02-04 | Reset password | User requests a link, opens it, sets a new password twice | Unknown email → same confirmation; expired or used link → "not valid" with a new-link button | Old password stops working; all other sessions end |
| UC-02-05 | Accept an invitation | Invitee opens `/invite/:token`, sets name and password | Token expired/revoked → "invitation has expired"; email already has an account → sign in to accept | Member of the organization with the invited role |
| UC-02-06 | Sign out | User chooses Sign out in the account menu | — | Session revoked; on `/login` |
| UC-02-07 | Session expires | API returns `401 token_expired` and refresh fails | — | `/session-expired`; after sign-in, returns to the same page |
| UC-02-08 | Use the sample workspace | Visitor opens `/demo` or "Continue with the sample workspace" | `/demo?fresh=1` → empty workspace | Signed into the sample organization (read/write, isolated) |
| UC-02-09 | Be denied | User opens a screen or calls an action outside their permissions | — | UI shows the locked state or 403 page; API returns `403 permission_denied` |
| UC-02-10 | Turn on two-step verification | User scans a QR code, enters a TOTP code | Wrong code → retry | MFA required at next sign-in |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-02-01 | Sign-up form: full name, work email, password, terms checkbox; live strength meter and rule checklist. | Must | UI |
| FR-02-02 | Password policy: at least 12 characters, upper and lower case, a number, a symbol; rejected if in a breached-password list. | Must | Partial: UI enforces 10+ characters |
| FR-02-03 | Sign-up never reveals whether an email is registered. | Must | Partial: local service says "already exists" |
| FR-02-04 | Verification email with a 24 h link; resend with 30 s cooldown; no organization data until verified (`403 email_not_verified`). | Must | Partial: screen only, no email |
| FR-02-05 | Sign-in with a generic failure message; lock for 15 min after 5 failures per email (server-side). | Must | UI (local, lockout resets on reload) |
| FR-02-06 | Return to the originally requested route after sign-in (`state.from`). | Must | UI |
| FR-02-07 | Password reset by email link, 30 min expiry, single use; ends other sessions. | Must | Partial: local link, no email |
| FR-02-08 | Invitation acceptance with a 7-day token; email fixed to the invited address; role from the invitation. | Must | Partial: fixed sample invite |
| FR-02-09 | Sign-out revokes the session server-side and clears the cookie. | Must | UI (local) |
| FR-02-10 | `/app/*` is guarded; unauthenticated users go to `/login` with the return path. | Must | UI |
| FR-02-11 | Roles Owner and AR with the default permission matrix; Owner-only screens show a locked state for AR. | Must | UI (role switcher is a prototype affordance) |
| FR-02-12 | The "view as" role switcher exists only in the sample workspace, never for real organizations. | Must | None |
| FR-02-13 | TOTP MFA enrolment and challenge; Owners required to enrol before launch (D-09). | Should | Partial: toggle only |
| FR-02-14 | Session-expired and 403 pages with a way back. | Must | UI |
| FR-02-15 | Sample workspace entry (`/demo`, `/demo?fresh=1`) creates an isolated sandbox organization per visitor and cleans it up after 7 days. | Should | Partial: browser-only |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-02-01 | Sessions in HTTP-only, `Secure`, `SameSite=Lax` cookies; no token in `localStorage`. | Inspect cookies in staging |
| NFR-02-02 | Sign-in timing does not reveal account existence (± 50 ms). | Timing test on 200 attempts |
| NFR-02-03 | Auth endpoints rate-limited 10/min per IP. | API test → `429` |
| NFR-02-04 | Role or suspension changes apply on the next request (permissions loaded per request). | API test |
| NFR-02-05 | Auth pages usable with keyboard only; errors announced (`role="alert"`). | Manual + axe |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-02-01 | 01 | C | Type password `abc` | Meter 1 of 4; rules unticked; submit shows "Choose a stronger password." |
| TC-02-02 | 02 | A | Sign up with `password1234` | Rejected (breached list) |
| TC-02-03 | 03 | E | Sign up twice with the same email | Both end on "Check your email"; one account exists |
| TC-02-04 | 04 | A | Call `GET /invoices` with an unverified user | `403 email_not_verified` |
| TC-02-05 | 05 | C | Wrong password | "The email or password is incorrect." |
| TC-02-06 | 05 | A | 5 wrong passwords, then the right one | 6th returns locked; succeeds after 15 min (clock fake) |
| TC-02-07 | 06 | E | Open `/app/customers` signed out, sign in | Lands on `/app/customers` |
| TC-02-08 | 07 | E | Request reset, open link, set new password, sign in with old and new | Old fails, new succeeds; link reuse shows "not valid" |
| TC-02-09 | 08 | E | Open an expired invite token | "This invitation has expired" |
| TC-02-10 | 09 | A | Sign out, reuse old access token | `401` |
| TC-02-11 | 11 | E | As AR open `/app/team`, `/app/audit-log`, `/app/reports/aging` | Locked state; API calls `403` |
| TC-02-12 | 12 | E | Sign in to a real organization | No "view as" bar |
| TC-02-13 | 13 | E | Enrol TOTP, sign out, sign in | TOTP step required; wrong code rejected |
| TC-02-14 | — | U | `localAuth` suite (already in repo) | 6 tests pass |

## 8. Backend contract
- Supabase Auth: sign-up, sign-in, verify, reset, MFA. Browser talks to Supabase only for auth (A-1).
- `GET /api/v1/me` → profile, memberships, permissions. `POST /auth/invitations/{token}/accept`. `POST /auth/sessions/revoke-others`.
- Tables: `profiles`, `organizations`, `memberships`, `invitations`, `role_permissions`.

## 9. Gaps and decisions
- Password minimum: UI 10, spec 12 → align to 12 (FR-02-02).
- `localAuth.ts` is replaced by Supabase in M5; keep its call shapes (`register`, `verify`, `requestReset`, `completeReset`) as the adapter interface so screens do not change.
- The role switcher must be removed from production organizations (FR-02-12).
