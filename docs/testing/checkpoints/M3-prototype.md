# Checkpoint M3 — Interactive HTML prototype

Date: 2026-11-13 · Served locally with `python -m http.server 5173 --directory prototype`, driven in the built-in browser pane. Results are from executed browser scripts and screenshots in this session. Nothing here was verified by a human reviewer or by a dedicated accessibility tool.

## Implemented

`prototype/` — marketing site (9 routes), auth (6) and onboarding (6 steps), and the app: dashboards for both roles, customers, invoices (list, detail, CSV import wizard, PDF review), payments (list, detail, import wizard), reconciliation (4 tabs, run detail), investigations (list, workspace with 5 states), collections (queue, case), disputes, approvals / My requests, analytics, 9 reports, documents, integrations, team and member permissions, audit log, 8 settings tabs, notifications, tasks, profile. About 1,360 lines of HTML/CSS/JS (many are long), no build step.

## Executed checks

| Check | Result |
|---|---|
| Console errors across every route, both roles | None |
| 62 route × role renders contain no `undefined`/`NaN`/`[object` text | PASSED |
| 208 distinct in-app links, both roles, all resolve to a page | PASSED |
| Marketing (9) and auth/onboarding (12) routes render | PASSED |
| Horizontal overflow at 390 px: 31 app routes × 2 roles | PASSED (after fixing grid min-width; first run found 10 failures) |
| Overflow at 768 and 1024 px: 15 routes × 2 roles | PASSED |
| Overflow at 390 px on marketing pages | PASSED |
| Business flows (scripted): write-off approval applies and invoice becomes paid; AR cannot decide; match confirm allocates 2 invoices; over-allocation and currency mismatch rejected; AR submit → Owner approve → Monitoring; verified recovery 0 before / 1,000.00 after simulated import; recovered refused without verified payment; dispute credit by AR creates approval and stays open | 14 of 14 PASSED |
| Role restrictions: AR sees "No access" on Team; cannot open another user's approval; blocked from financial reports; dashboard has no org-wide totals | PASSED |
| Investigation alternate states (failed, insufficient, stale, running → normal) | PASSED |
| Form validation (login, onboarding step 1) shows field errors | PASSED |
| Accessible names: unnamed controls on 27 pages | 3 found, fixed; not re-run after the fix |
| Contrast (WCAG formula, in-browser) | Specified teal/green/amber fail as small text (3.2–3.4:1); -700 variants pass (4.7+). `--border-strong` failed (2.56:1) and was changed to `#7B8AA0` (3.51:1). Recorded in DESIGN_SYSTEM.md |
| Visual inspection (screenshots): Owner dashboard (mobile), investigation workspace (1440), marketing home (1440) | Looked correct; other pages were checked structurally, not by eye |

## Acceptance (AC-M3)

| ID | Status | Note |
|---|---|---|
| AC-M3-1 every inventory page exists, no dead links | PASSED with gaps | System pages: only 404 and "No access" exist. Session-expired, 500 and maintenance pages are not built |
| AC-M3-2 role switcher changes nav, dashboard, actions | PASSED | |
| AC-M3-3 interactions work on mock data | PASSED | Settings "Save" and several actions are toasts only |
| AC-M3-4 investigation states visually distinct, citations work | PASSED | |
| AC-M3-5 demo data consistent | PASSED | Derived from allocations |
| AC-M3-6 prototype marker, no real operations | PASSED | |
| AC-M3-7 tokens match, AA contrast measured | PASSED with a documented change | Colour variants and the border change await your approval (D-12) |
| AC-M3-8 usable at 1440/1024/768/390 | PASSED for overflow; layout inspected by eye at 1440 and 390 only |
| AC-M3-9 marketing has no fabricated claims | Self-reviewed; needs your read | Copy states only designed controls and says no certifications are held |
| AC-M3-10 owner approval | Pending | |

## Known gaps and issues

- No keyboard-only walkthrough, no screen-reader test, no axe run.
- Table rows are clickable but not keyboard-focusable; this needs fixing in Phase 3.
- Not built: saved views, board view, customer edit form, multi-organization switcher, session-expired/500/maintenance pages, dark mode.
- Prototype uses floating-point JS numbers for money.
- The pane loads cached JS/CSS from the local server; changes needed a forced refresh during testing.
- Mermaid diagrams in the Phase 1 docs are still unrendered.
