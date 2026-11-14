# MOD-17 Integrations

Spec: FEATURE_SPECIFICATION §B.13 · Roadmap: M13 (Gmail), M15 (QuickBooks, Stripe) · Code: `Admin.tsx` (Integrations, IntegrationDetail), `store.ts` (`setInteg`, `syncInteg`)

## 1. Purpose
Connect the systems venn reads from, show exactly what access was granted, and make sync health visible.

## 2. Scope
| In | Out |
|---|---|
| Integration Center grouped by category; cards with status connected / available / planned / needs attention; Connect, Manage, Join waitlist; AR read-only ("Owner manages") | Write-back to accounting systems |
| Detail: permissions granted, status (account, last sync), sync history, Sync now, Disconnect (keep data); Connect or Join waitlist when not connected | Outlook, Xero, bank feeds (planned cards only) |
| Providers: CSV, PDF, manual (built in); Gmail; QuickBooks Online (read); Stripe (read) | |

## 3. Actors
Owner (`integrations.manage`) · AR (view) · Provider APIs · Sync worker

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-17-01 | Connect a provider | Connect → OAuth consent at provider → callback | User cancels → back to Integrations, unchanged; error → "needs attention" with message | Connected only after a successful real API call |
| UC-17-02 | Check health | Open detail | Last sync failed → error row with message | Sync history |
| UC-17-03 | Sync now | Sync now | Rate-limited by provider → retry later message | New records imported via MOD-09 rules (duplicates skipped) |
| UC-17-04 | Disconnect | Disconnect → confirm (keep or delete synced data) | — | Token revoked at provider; stored tokens deleted |
| UC-17-05 | Ask for a planned integration | Join waitlist | — | Interest recorded |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-17-01 | Cards by category with statuses as listed; planned cards visibly disabled. | Must | UI |
| FR-17-02 | Detail shows scopes in plain language, account, last successful sync, last error, history. | Must | UI |
| FR-17-03 | Detail actions follow status: Connect (available), Join waitlist (planned), Sync now + Disconnect (connected/needs attention). | Must | UI (fixed 2026-11-14) |
| FR-17-04 | OAuth with PKCE/state; tokens encrypted at rest; refresh handled by the worker. | Must | None |
| FR-17-05 | Connected status only after a verified API call. | Must | None |
| FR-17-06 | Scheduled sync every 15 min (Stripe, QuickBooks) and incremental Gmail sync; manual Sync now. | Should | Partial: simulated |
| FR-17-07 | Disconnect revokes at provider and offers keep/delete synced data. | Must | Partial: keep only |
| FR-17-08 | Sync failures raise a notification and set "needs attention". | Must | None |
| FR-17-09 | AR sees statuses but cannot connect or disconnect. | Must | UI |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-17-01 | Tokens never reach the browser or logs. | Log scan, review |
| NFR-17-02 | Sync is idempotent by `(source, external_id)`. | Re-sync test |
| NFR-17-03 | Provider outages do not block the app; backoff with jitter. | Fault-injection test |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-17-01 | 03 | E | Open `/app/integrations/pdf` while available | Connect button, no Disconnect (verified after fix) |
| TC-17-02 | 05 | A | OAuth callback with an invalid token | Status needs attention, not connected |
| TC-17-03 | 04 | A | Inspect stored token | Encrypted; not in API responses |
| TC-17-04 | 07 | A | Disconnect with delete | Synced rows removed; audit row |
| TC-17-05 | NFR-17-02 | A | Sync the same Stripe charges twice | No duplicates |
| TC-17-06 | 09 | E | AR opens Integrations | "Owner manages"; no Connect |

## 8. Backend contract
`GET /integrations` · `POST /integrations/{provider}/connect` → redirect URL · `GET /integrations/{provider}/callback` · `POST /integrations/{id}/sync` ⟳ · `DELETE /integrations/{id}?data=keep|delete` · `POST /integrations/{provider}/waitlist`. Tables: `integrations`, `integration_tokens` (encrypted), `sync_runs`.
