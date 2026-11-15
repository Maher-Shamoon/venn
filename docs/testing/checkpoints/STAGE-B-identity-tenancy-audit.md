# Stage B: identity, tenancy, audit (B1, B2 done; B3 to B5 pending)

Date: 2026-11-15

## Commands and results
| Command | Result |
|---|---|
| `cd services/api && uv run pytest` | 33 passed (embedded PostgreSQL); also 6 earlier tests passed against the Docker Compose database |
| `uv run ruff check .` / `uv run mypy app` | clean / strict, no issues |
| GitHub Actions on the B1 commit | web, e2e, api, secrets all green |

## Acceptance
| ID | Check | Result |
|---|---|---|
| B1 | Every tenant table has forced RLS and a policy (G-3) | PASSED (`test_every_tenant_table_has_forced_rls_and_a_policy`) |
| B1 | With no organization set, no rows are visible; another organization's rows cannot be read or written | PASSED (`test_rls.py`; mutation check confirmed the test fails when RLS is disabled) |
| B1 | JWT verification (HS256 secret or JWKS), expiry, forged signature, unverified email | PASSED (`test_identity_api.py`) |
| B1 | `X-Organization-Id` verified against an active membership; suspension applies on the next request | PASSED |
| B1 | Permission dependency denies a member without the permission; AR defaults follow the matrix | PASSED |
| B1 | Last active owner cannot be removed (deferred constraint trigger) | PASSED |
| B2 | audit_events append-only for everyone including the owner (UPDATE, DELETE, TRUNCATE rejected) | PASSED |
| B2 | Hash chain per organization, concurrent writers keep one linear chain (16 parallel writers), tampering detected at the first bad row | PASSED |
| B2 | Sensitive keys redacted; viewer filters, cursor paging, `audit.view` required, no cross-tenant entries | PASSED |
| B3 | Real sign-in, wrong password, sign-out, return to login after sign-out, existing member lands in the app with the organization selected, browser to API through the dev proxy with a real ES256 token | PASSED (Playwright against the hosted Supabase project, 3 tests; API live tests 4 passed) |
| B3 | Sign-up and the verification and reset email links | NOT TESTED: needs an inbox I can read. Supabase accepts only real addresses and its built-in sender allows a few emails an hour |
| B4 | Onboarding creates the organization through the API | Implemented; API side tested (`POST /organizations`), the onboarding screen path is not exercised by an automated test yet |

## Defect found by the tests and fixed
- **Cross-organization permission leak (security).** The `own_memberships` policy lets a user read their memberships in every organization. The membership check did not filter by the requested organization, so a user who named an organization they did not belong to was treated as a member using the permissions of a different organization. Fixed by filtering on `organization_id` explicitly; covered by `test_organization_header_is_required_and_checked` and `test_cross_tenant_access_is_denied`.

## Defects found by live testing and fixed
- Supabase exposed `permissions` to the browser key through its REST API. Migration 0004 revokes `anon` and `authenticated` access; verified: the browser key now gets 401 on every application table.
- Signing out cleared only the app store, not the Supabase session, so a reload signed the user straight back in. Sign-out now ends the Supabase session; covered by an e2e test.
- The `.env` had been saved in `apps/web/services/api/`; moved to `services/api/` and the database password URL-encoded (it contained `@`).

## Resolved blocker (disk space)
Switched to a hosted Supabase project, so no local images are needed. The earlier notes follow.

## Blocker (history)
The C: drive of this machine is full (1.5 GB free). Docker Desktop's virtual disk turned read-only while pulling the local Supabase images (about 3 to 4 GB), so the local Supabase stack could not start. Options: free at least 10 GB on C:, or give me a Supabase cloud project (URL and anon key) so no local images are needed.

## Notes
- The API connects as the migration user and runs each request as `SET LOCAL ROLE venn_app`. Production must grant `venn_app` to the application's database user.
- Row ids use `gen_random_uuid()` (v4). The architecture asks for UUIDv7; decide before the first large table.
- The client IP in audit entries is the direct peer; behind a proxy it needs trusted `X-Forwarded-For` handling (Stage J).

---

## Gate B self-review (2026-11-15)
The owner instructed me to build, test and approve each gate myself and continue. This is that review, with what it does and does not cover.

| Area | Evidence | Verdict |
|---|---|---|
| B1 tenancy, RBAC | 47 API tests (RLS, cross-tenant, permissions, last owner), live hosted-DB tests | PASS |
| B2 audit | append-only, hash chain, tamper detection, 16 concurrent writers, viewer API, real viewer screen with paging | PASS |
| B3 auth | real sign-in, sign-out (session ended), wrong password, token verified by API with ES256 | PASS for sign-in and sign-out. Sign-up and emailed links NOT TESTED (no inbox) |
| B4 onboarding | organization created through the API from onboarding; role comes from the server; view-as switcher removed in real organizations | PASS by API tests and e2e login routing; the onboarding screen itself has no automated test |
| B4 sandbox | `/demo` keeps working with browser-only data, so it cannot touch real data | DEVIATION from P3-D6: no server-side sandbox organization. Browser-local isolation is stronger for privacy and needs no cleanup job; revisit if demo data must be shared |
| B5 team | members list, invite (validation, duplicates), revoke, resend, accept page, role change, suspend, last-owner guard, AR permission editor with locks | PASS (9 API tests, 3 e2e, 4 component tests) |
| B5 settings | company and financial on the API with validation and If-Match conflicts; other tabs (approvals, notifications, remittance, security, data) still local | PARTIAL, by design: those tabs belong to later stages |
| Quality gates | CI green: lint, types, 43 unit and component tests, 47 API tests, 29 e2e (5 skipped by design), secret scan, type drift check | PASS |

Known gaps carried forward (tracked, not hidden):
- Sign-up verification email and password-reset email links need an inbox to test. Do once with a real address.
- API responses for identity endpoints are bare objects; the spec envelope `{data: ...}` is used by list endpoints only. Align when the generated client replaces hand-written calls.
- Rate limiting on invitation and auth-adjacent endpoints is not implemented (Stage I).
- Invitation emails go through a development mailer that sends nothing; a real SMTP adapter arrives with notifications (Stage F). Until then the link is not delivered.

**Gate B: approved (self-review). Proceeding to Stage C.**
