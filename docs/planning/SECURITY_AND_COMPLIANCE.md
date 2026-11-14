# Venn — Security and Compliance

Status: Phase 1 draft · Last updated 2026-11-13

> This is an engineering plan, not legal advice. Items marked **(counsel)** need review by a qualified professional before launch. Venn holds no certifications today and must not claim any.

## 1. Assets and threat summary

| Asset | Main threats | Primary controls |
|---|---|---|
| Tenant financial data | Cross-tenant access, broken access control, injection | Double tenancy enforcement (code + RLS), permission checks, parameterised queries |
| OAuth tokens (mailbox, accounting, Stripe) | Theft → mailbox takeover | Envelope encryption, never logged or returned, minimal scopes, revoke on disconnect |
| Remittance (bank) details in outgoing email | Insider or account-takeover invoice fraud | Owner-only, step-up auth, owner notifications, visible change banner, audit |
| Approval integrity | Self-approval, replay, stale approval | DB CHECK requester ≠ decider, idempotency, snapshot + staleness check |
| Audit trail | Tampering | Append-only grants, trigger, hash chain, verification endpoint |
| Accounts | Credential stuffing, phishing, session theft | Supabase Auth protections, MFA for owners, rate limits, HTTP-only cookies |
| AI workflows | Prompt injection, data leakage | Read-only tools, validators, tenant-bound context (see AI doc §8) |
| Uploaded files | Malware, parser exploits, oversized input | Type sniffing, size caps, scanning, isolated processing |

## 2. Authentication

- Supabase Auth: email/password, verified email required, password reset with single-use expiring links.
- Password policy: minimum 12 characters, leaked-password protection enabled, no composition rules.
- MFA (TOTP): available to all; required for Owners before general availability (D-09).
- Sessions: short-lived access token (≤ 1 h), rotating refresh tokens, stored in `HttpOnly; Secure; SameSite=Lax` cookies by the Next.js server. Tokens are not kept in `localStorage`.
- API verifies the JWT signature (JWKS), issuer, audience and expiry. Asymmetric signing keys are used so the API holds no shared secret.
- Step-up: sensitive operations (`remittance.manage`, disabling MFA requirement, organization deletion request) require re-authentication within the last 5 minutes.
- Account enumeration: signup, reset and invitation responses do not reveal whether an email exists.
- Brute force: provider limits plus API/IP rate limits; CAPTCHA can be enabled in Supabase if abuse appears.

## 3. Authorization and tenancy

1. Organization comes from `X-Organization-Id`, **verified** against an active membership on every request. Body/query organization IDs are ignored.
2. Membership status and permissions are read from the database per request (cached for the request only).
3. Every route declares `require_permission`. A CI test fails if a route under `/api/v1` has neither a permission nor an explicit `public`/`authenticated_only` marker.
4. Repositories are constructed with the organization ID and add it to every query; there is no un-scoped repository method for tenant tables.
5. PostgreSQL RLS (forced) is the backstop; the app role cannot bypass it (DATABASE_DESIGN §6).
6. Object-level checks: fetching a record in another tenant returns `404`.
7. Object storage keys are prefixed by organization and reachable only via signed URLs issued after a permission check.
8. Background jobs carry the organization ID and set the same DB context; a job cannot run without one.
9. Caches and Redis keys are namespaced by organization.

**Required test:** the cross-tenant suite creates Org A and Org B, then calls every read and write endpoint with B's credentials against A's IDs and asserts `404/403` and no change. A second test connects as `venn_app` with B's context and attempts raw SQL against A's rows, expecting zero rows.

## 4. Data protection

| Topic | Control |
|---|---|
| In transit | TLS 1.2+ everywhere; HSTS on the web app; internal service traffic encrypted where the platform supports it |
| At rest | Managed disk encryption for Postgres and storage (provider) |
| Field-level | OAuth tokens and remittance details encrypted with AES-256-GCM using a data key wrapped by a master key from the secret manager; `key_version` stored for rotation |
| Secrets | Environment/secret manager only; `.env` git-ignored; `.env.example` has names, never values; secret scanning in CI (gitleaks) |
| Logging | Structured logs with request ID, user ID, organization ID, route, status. Never: tokens, passwords, email bodies, document text, full bank details. A log-scrubbing filter and a test that greps logs for seeded secrets |
| Backups | Encrypted, PITR; restore tested before launch |
| Data minimisation | Email sync limited by filter to financial correspondence; raw provider payloads kept only where needed for reconciliation |
| Deletion | Disconnect offers deletion of synced data; organization deletion purges after a grace period |

## 5. Application security

| Risk | Control |
|---|---|
| Injection | SQLAlchemy parameter binding; no string-built SQL; allow-listed sort/filter fields |
| XSS | React escaping; no `dangerouslySetInnerHTML` for user/AI/email content; email bodies shown as sanitised text; strict Content-Security-Policy (no inline scripts except hashed) |
| CSRF | API uses bearer tokens in the `Authorization` header, not ambient cookies, so classic CSRF does not apply to it. Next.js Server Actions/route handlers that rely on cookies check `Origin` and use SameSite cookies |
| CORS | API allows only the web app's origins; no wildcard with credentials |
| SSRF | No user-supplied URLs are fetched server-side; integration endpoints are fixed hosts |
| Mass assignment | Explicit Pydantic input models; `extra = "forbid"` |
| File upload | ≤ 20 MB; extension + magic-byte allow-list (PDF, PNG, JPG, CSV); malware scan (ClamAV container) before processing; PDFs parsed in a worker with CPU/memory/time limits; files never served from the app origin |
| CSV injection | Exports prefix cells starting with `= + - @` with a single quote |
| Rate limiting | Redis sliding window per user, organization and IP (API_SPECIFICATION §1.6) |
| Security headers | CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'` |
| Dependencies | Lockfiles; automated updates; `pip-audit` and `npm audit` in CI; pinned base images |
| Error handling | No stack traces or SQL in responses; request ID for correlation |
| Open redirects | OAuth and login `next` parameters restricted to same-origin paths |

## 6. Integrations and webhooks

- OAuth 2.0 authorization code with PKCE where supported; `state` is signed, single-use, bound to user and organization, 10-minute expiry.
- Minimum scopes; scopes shown to the user in plain language before redirect and afterwards in the integration detail.
- Refresh handled by a worker with a per-connection lock; refresh failure → status `needs_attention`, owners notified.
- Webhooks: signature verification with the provider secret, timestamp tolerance, event-ID idempotency, 2xx only after the event is persisted.
- Disconnect: revoke at provider (best effort), delete tokens, audit.
- Outbound email is sent only through the user-connected mailbox, only for messages a human sent or approved; recipients are restricted to contacts of the related customer unless a user explicitly adds another address (which is audit-logged).

## 7. Financial integrity controls (security-relevant)

See FEATURE_SPECIFICATION §A and DATABASE_DESIGN §4. In addition:
- Imports and mutations are idempotent; replays cannot double-apply.
- Financial rows are never hard-deleted or silently overwritten.
- Approval execution re-validates against current state.
- Nightly integrity job recomputes balances and verifies the audit hash chain; discrepancies page the operator.
- Exports are permission-checked and audit-logged.

## 8. Audit logging

Scope, fields and immutability are in FEATURE_SPECIFICATION §15 and DATABASE_DESIGN §3.11. Additional rules:
- Written in the same transaction as the change; if the audit insert fails, the change fails.
- Failed permission checks on sensitive endpoints are logged (rate-limited) as security events.
- Sensitive values are redacted in `before/after` (tokens, bank details → fingerprint).
- Platform-operator access to production data requires a named account and is itself logged (operational policy; tooling at enterprise stage).

## 9. Operational security

- Private Git repository; branch protection; required review and CI for the main branch.
- Environments separated (dev/staging/prod) with separate credentials and Supabase projects; no production data in lower environments (fixtures are synthetic).
- Least-privilege cloud and database roles; MFA on all provider accounts.
- Monitoring: error tracking, uptime checks, alerts on auth failure spikes, 5xx rate, job failure rate, integrity-job failures.
- Incident response: a short runbook (triage, contain, notify, review) written at M16; breach notification obligations **(counsel)**.
- Vulnerability disclosure contact published on `/security`.
- Pre-launch: independent penetration test recommended before onboarding paying customers (budget decision, D-10).

## 10. Compliance posture

| Area | Position | Action |
|---|---|---|
| SOC 2 | Not held. Controls here are designed to be compatible with a later audit | Do not claim. Decide timing with first enterprise prospect |
| GDPR / UK GDPR | Venn is a processor for customer data; controller for account data. Applies if EU/UK customers or data subjects are in scope | DPA template, sub-processor list, data-subject request process, records of processing **(counsel)** |
| US state privacy laws (e.g. CCPA/CPRA) | Likely service-provider role | Contract terms **(counsel)** |
| PCI DSS | Out of scope by design: Venn never receives or stores card numbers. Stripe data is read via API without PAN | Keep it that way; never accept card data in uploads knowingly |
| Money transmission / payments regulation | Out of scope by design: Venn does not hold or move funds (challenge C-1) | Any future payment feature requires a regulatory review first **(counsel)** |
| Debt-collection regulation | Venn's users contact their **own business customers** about their own invoices (first-party, B2B). Consumer-debt rules such as the US FDCPA target third-party consumer collection | Restrict positioning and templates to B2B first-party use; no consumer collections; confirm per launch country **(counsel)** |
| Email rules (CAN-SPAM, etc.) | Collection emails are transactional/relationship messages sent from the customer's own mailbox | Templates identify the sender; no marketing content **(counsel)** |
| Google API Services User Data Policy | Gmail read scopes are restricted: verification, Limited Use compliance, and a recurring independent security assessment are expected before public launch | Start verification early (lead time of weeks to months; cost of the assessment is an external expense). Verify current requirements with Google before M13 |
| Microsoft / Intuit / Stripe platform terms | App registration, publisher verification, Intuit production-key assessment | Checklist per provider at M15 |
| AI provider terms | No training on customer data; retention settings | Confirm in provider agreements; list sub-processors |
| Accessibility | WCAG 2.1 AA target | Tested per TESTING_STRATEGY |
| Record retention | Financial record retention periods vary by country | Default: keep while the organization is active; configurable later **(counsel)** |

## 11. Marketing and trust claims

The `/security` page and all marketing copy may state only what is implemented and verified. Prohibited until true: "SOC 2 compliant", "bank-grade", "end-to-end encrypted", any uptime figure, any recovery statistic. The acceptance criteria for the website include a claims review against this document.

## 12. Security requirements by stage

| Stage | Must have |
|---|---|
| MVP-Core | Everything in §2–§5, §7, §8; cross-tenant suite; RBAC matrix test; secret scanning |
| MVP-Complete | Owner MFA; OAuth token encryption with rotation procedure; webhook verification; malware scanning; rate limiting; incident runbook; restore drill; dependency and container scanning; external penetration test (recommended) |
| Post-MVP | Custom roles review, customer-portal threat model, data-retention settings, DPA workflow |
| Enterprise | SSO/SAML, SCIM, audit export to SIEM, IP allow-lists, customer-managed keys, SOC 2 Type II, data residency |
