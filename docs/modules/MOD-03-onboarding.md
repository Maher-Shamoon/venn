# MOD-03 Onboarding and first run

Spec: FEATURE_SPECIFICATION §B.1 · Roadmap: M5–M6 · Code: `Auth.tsx` (Onboarding, Opt), `Dash.tsx` (FirstRun, Checklist), `store.ts` (`startFresh`, `finishOnboarding`, `setSetup`)

## 1. Purpose
Get a new organization from an empty account to its first reconciled data, and keep showing the next setup step until it is done.

## 2. Scope
| In | Out |
|---|---|
| 6-step wizard: Organization (required), Financial sources, Email, Import, Team, Preferences (skippable) | Guided product tours |
| First-run dashboard for a workspace with no records; "Finish setting up" checklist on the dashboard | Sample-data mixing into a real organization |
| "Explore with sample records" and "Start with an empty workspace" switches | |

## 3. Actors
New Owner (just verified) · Invited AR (skips organization creation)

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-03-01 | Create the organization | Owner enters name, industry, size, country, currency → Continue | Name empty → "Organization name is required." | Organization created; Owner membership |
| UC-03-02 | Choose sources | Picks CSV (available) and sees planned systems | Skip | Preference recorded |
| UC-03-03 | Connect email | Connect Gmail or skip | Gmail not yet available → skip | — |
| UC-03-04 | Import first data | Opens invoice CSV, payment CSV or PDF review from the step | Skip | Import started in MOD-09 |
| UC-03-05 | Invite the team | Adds emails with roles | Invalid email → inline error; skip | Invitations sent |
| UC-03-06 | Set preferences | Timezone, payment terms, auto-apply exact matches → Finish | — | Settings saved; `onboarded = true`; lands on `/app` |
| UC-03-07 | See the first-run dashboard | Organization has no invoices or payments | — | Setup list with progress, KPI placeholders "Appears after your first import" |
| UC-03-08 | Leave and resume | User closes the browser mid-wizard | — | Returns to the last incomplete step |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-03-01 | Wizard with 6 steps, a step list showing done/current/skippable, Back, Skip for now, Continue/Finish. | Must | UI |
| FR-03-02 | Step 1 required fields validated; organization name starts empty for a new workspace. | Must | UI |
| FR-03-03 | Invited users never see "create organization"; they go straight to the app after accepting. | Must | Partial |
| FR-03-04 | Progress is saved per step on the server so the wizard resumes. | Must | Partial: local only |
| FR-03-05 | Finishing saves company and financial preferences and marks the organization onboarded. | Must | UI |
| FR-03-06 | First-run dashboard appears when the organization has no invoices and no payments, with five setup steps, a progress bar and links to each step. | Must | UI |
| FR-03-07 | Setup steps tick themselves from real state (a source connected, a first import done, an invite sent, preferences saved), not only from clicks. | Should | Partial: ticked on click |
| FR-03-08 | "Finish setting up" checklist on dashboards lists remaining steps and can be dismissed. | Should | UI |
| FR-03-09 | Sample records can be loaded only into a sandbox organization, never mixed into a real one. | Must | Partial |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-03-01 | Median time from verified email to first imported invoice ≤ 5 minutes with a prepared CSV. | Moderated test with 3 users |
| NFR-03-02 | Wizard works at 390 px with the step list as a horizontal scroller. | E2E viewport |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-03-01 | 02 | C | Continue with empty name | Error; stays on step 1 |
| TC-03-02 | 01 | E | Continue, then Skip through steps 2–5, Finish | Lands on `/app`; `onboarded = true` |
| TC-03-03 | 04 | E | Complete step 1, reload | Opens on step 2 |
| TC-03-04 | 03 | E | Accept an invitation | No onboarding wizard |
| TC-03-05 | 06 | E | New account with no data | "Welcome, <name>"; 0 of 5 done |
| TC-03-06 | 07 | A | Import one invoice CSV | Setup "import" step reported done by `/onboarding/state` |
| TC-03-07 | 09 | A | Load sample into a real org | `409 invalid_state` |
| TC-03-08 | 05 | A | Finish with timezone `Europe/London` | Organization timezone saved; overdue computed in that zone |

## 8. Backend contract
- `POST /organizations` · `GET/PATCH /onboarding/state` · `PATCH /settings/company` · `PATCH /settings/financial`
- Tables: `organizations`, `organization_settings`, `onboarding_progress`.

## 9. Gaps
- Setup ticks are click-driven in the prototype; derive them from data (FR-03-07).
