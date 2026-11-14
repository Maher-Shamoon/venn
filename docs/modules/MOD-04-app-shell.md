# MOD-04 App shell and navigation

Roadmap: M6 · Code: `components/app/Shell.tsx`, `ui.tsx` (Title, Box, Seg, DataTable, Modal, Drawer, Loading, PageSkeleton, Empty, Locked), `ErrorBoundary.tsx`, `System.tsx`, `venn/SkipLink.tsx`, `App.tsx` (lazy routes)

## 1. Purpose
Give every signed-in screen the same frame: navigation, search, notifications, account, loading/error handling and shared building blocks.

## 2. Scope
| In | Out |
|---|---|
| Sidebar with grouped links and live counts (desktop), sheet menu (mobile), top bar with search, bell, account menu | Multi-organization switcher UI (API ready, UI later) |
| Command palette (Ctrl/⌘ K): pages, invoices, customers, payments, investigations | Saved searches |
| Page-shaped loading skeletons, error boundary (500 page), offline banner, page titles, skip link, focus ring | Dark mode |
| Shared components: DataTable (search, sort, pagination, empty), Modal, Drawer, Seg, Kpi, Pill, Empty, Locked | |
| System pages: 404, 500, maintenance | |

## 3. Actors
Owner · AR

## 4. Use cases
| ID | Use case | Main flow | Alternatives | Result |
|---|---|---|---|---|
| UC-04-01 | Move between areas | Click a sidebar link | Mobile: open menu, pick link, menu closes | Page loads; active link marked; title "<h1> · venn" |
| UC-04-02 | Find a record fast | Ctrl K, type part of a number or name, Enter | No match → "No results." | Opens the record |
| UC-04-03 | See what needs attention | Sidebar counts for reconciliation, investigations, collections, disputes, approvals | Zero → no badge | — |
| UC-04-04 | Read notifications | Open bell popover → item → "See all" | — | Notification marked read; opens its record |
| UC-04-05 | Manage own account | Account menu → Profile / Sign out | — | — |
| UC-04-06 | Recover from errors | A screen throws | — | 500 page with "Try again"; error reported with request ID |
| UC-04-07 | Work offline briefly | Network drops | — | Amber "You are offline" banner; mutations disabled; banner clears on reconnect |
| UC-04-08 | Skip navigation | Keyboard user presses Tab first | — | "Skip to content" focuses `main` |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-04-01 | Sidebar groups: Receivables, Resolve, Insight, Admin; AR sees "My requests" instead of "Approvals". | Must | UI |
| FR-04-02 | Sidebar counts come from one `GET /navigation/counts` call, refreshed after mutations and every 60 s. | Must | Partial: local counts |
| FR-04-03 | Command palette searches server-side (`GET /search?q=`) after 2 characters with 200 ms debounce; keyboard navigable; opens with Ctrl/⌘ K and from the search button. | Must | Partial: local search, works |
| FR-04-04 | Notification popover shows the latest 5, unread dot, "Mark all read", "See all". | Must | UI |
| FR-04-05 | Routes are lazy-loaded; a thin progress bar shows while a chunk loads; a page skeleton shows on first entry to a section. | Must | UI |
| FR-04-06 | Error boundary renders the 500 page for render errors; API errors show a toast with the request ID. | Must | Partial: no request ID yet |
| FR-04-07 | Offline banner from `online`/`offline` events. | Should | UI |
| FR-04-08 | DataTable: client search for ≤ 200 rows, server search/sort/cursor pagination above; URL keeps filters, sort and page. | Must | Partial: client only, URL not synced |
| FR-04-09 | Locked state for screens outside the role; 403 page for direct API denials. | Must | UI |
| FR-04-10 | Every screen has loading, empty and error states (NFR-G-07). | Must | Partial: error states missing (no API yet) |
| FR-04-11 | Page title from the `h1`; skip link; visible focus ring. | Must | UI |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-04-01 | Entry bundle ≤ 300 kB gzip; each route chunk ≤ 150 kB gzip except charts. | Build report in CI |
| NFR-04-02 | Navigation between cached screens renders in ≤ 100 ms. | Performance trace |
| NFR-04-03 | Shell has no layout shift when counts arrive (fixed badge slot). | CLS ≤ 0.05 in app |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-04-01 | 01 | E | Click each sidebar link as Owner and AR | Each page has an `h1`; active link highlighted |
| TC-04-02 | 03 | E | Ctrl K, type `northw`, Enter | Opens INV-1042 (regression for the palette crash) |
| TC-04-03 | 03 | C | Render CommandDialog with items | Input and items render inside the cmdk root (test exists) |
| TC-04-04 | 04 | E | Open bell, "Mark all read" | Unread count 0 |
| TC-04-05 | 06 | C | Render a child that throws inside ErrorBoundary | 500 page shown |
| TC-04-06 | 07 | E | Set browser offline | Banner visible; disappears online |
| TC-04-07 | 08 | E | Sort and page a list, reload | Same sort and page after reload |
| TC-04-08 | 09 | E | AR opens `/app/settings` | Locked state |
| TC-04-09 | 11 | E | Tab once on any app page, Enter | Focus moves to `main` |
| TC-04-10 | NFR-04-01 | CI | `npm run build` size check | Under budget |

## 8. Backend contract
`GET /me` · `GET /navigation/counts` · `GET /search?q=&types=` · `GET /notifications?limit=5`

## 9. Gaps
- URL-synced table state and server pagination (FR-04-08) are needed before real data volumes.
