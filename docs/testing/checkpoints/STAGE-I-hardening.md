# Stage I: hardening (what was done, what was not)

Date: 2026-11-15 · Reviewed by: the assistant (owner instruction: build, test and approve each gate)

## Done and tested
| Item | Evidence |
|---|---|
| Rate limiting on the API: per caller (token or address), 600 requests a minute normally, 30 for imports, uploads, reconciliation runs and CSV exports, 120 for callers without a token; `429` problem response with `Retry-After`; health checks never limited | unit tests for the window, the buckets and recovery; an API test for the `429` |
| Every migration can be applied, undone and applied again | `tests/test_migrations_roundtrip.py`, run in CI |
| Audit log hash chain can be verified through the API | `GET /api/v1/audit-events/verify` and a test; the runbook uses it after migrations |
| Accessibility of every signed-in screen (19 routes): no serious or critical axe findings, one `h1`, no horizontal scroll at desktop width; and no horizontal scroll at 390 px | `e2e/a11y-app.spec.ts` against the real stack. It found charts without an accessible name, now fixed |
| Dependency audit | `pip-audit`: no known vulnerabilities. `npm audit --omit=dev`: 6 findings, none high (2 low, 4 moderate, in transitive packages); CI fails only on high |
| Runbook: configuration, deploy, rollback, backup and restore, secrets, checks | `docs/deployment/RUNBOOK.md` |
| Performance measured | 1,000 payments reconciled in 6.3 s; owner dashboard over 20,000 invoices in about 0.2 s; import of 5,000 rows within the existing slow test |

## Not done
| Item | Why |
|---|---|
| Counters shared between API instances (Redis) | one instance is assumed until deployment; stated in the runbook |
| Background job runner (reconciliation, nightly case refresh, notification email, outbox) | needs a decision on queue infrastructure; today these run when the page asks |
| k6 load tests at 100,000 invoices, p95 targets | not run; only the 20,000 and 1,000 figures above exist |
| Website pre-rendering for search engines and the SEO audit | not started |
| Full security review (threat model walk-through, penetration test) | not started. The controls that exist: forced RLS on every tenant table (a test enumerates them), permission checks on every route, uploads decided by content, formula-safe CSV, append-only history tables |
| Soak and failure tests (database restart, provider outage) | not run |
| CSP and other security headers on the web host | belong to the hosting configuration, which does not exist yet |

**Gate I: partially approved (self-review). The items that can be built and measured on this machine are done; the rest wait for hosting and a job runner.**
