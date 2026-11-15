# Stage B: identity, tenancy, audit (B1, B2 done; B3 to B5 pending)

Date: 2026-11-15

## Commands and results
| Command | Result |
|---|---|
| `cd services/api && uv run pytest` | 29 passed (embedded PostgreSQL); also 6 earlier tests passed against the Docker Compose database |
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
| B3 | Frontend sign-up, verification, sign-in and reset through real Supabase Auth | NOT STARTED: blocked, see below |

## Defect found by the tests and fixed
- **Cross-organization permission leak (security).** The `own_memberships` policy lets a user read their memberships in every organization. The membership check did not filter by the requested organization, so a user who named an organization they did not belong to was treated as a member using the permissions of a different organization. Fixed by filtering on `organization_id` explicitly; covered by `test_organization_header_is_required_and_checked` and `test_cross_tenant_access_is_denied`.

## Blocker
The C: drive of this machine is full (1.5 GB free). Docker Desktop's virtual disk turned read-only while pulling the local Supabase images (about 3 to 4 GB), so the local Supabase stack could not start. Options: free at least 10 GB on C:, or give me a Supabase cloud project (URL and anon key) so no local images are needed.

## Notes
- The API connects as the migration user and runs each request as `SET LOCAL ROLE venn_app`. Production must grant `venn_app` to the application's database user.
- Row ids use `gen_random_uuid()` (v4). The architecture asks for UUIDv7; decide before the first large table.
- The client IP in audit entries is the direct peer; behind a proxy it needs trusted `X-Forwarded-For` handling (Stage J).
