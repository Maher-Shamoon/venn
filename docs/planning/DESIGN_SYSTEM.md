# Venn — Design System

Status: Phase 1 draft · Last updated 2026-11-13

The Phase 2 HTML prototype implements these tokens as CSS variables; Phase 3 maps the same variables into Tailwind and shadcn/ui. Reference products (Ramp, Stripe, Linear, Billtrust, HighRadius) inform principles only; nothing is copied.

## 1. Principles

1. **Numbers first.** Amounts are the content. Tabular figures, right-aligned, never truncated.
2. **Calm surface, loud exceptions.** Neutral by default; colour is reserved for status and the one primary action.
3. **Every figure is a link.** KPIs and chart segments drill down to records.
4. **Show the basis.** Wherever Venn states something, the source is one click away.
5. **Fact ≠ guess, visibly.** Confirmed, possible, unverified and missing each have their own treatment.
6. **Dense but breathable.** Operational tables are compact; detail pages have room.
7. **No decoration.** No gradients, glass, neon, ornamental charts or motion for its own sake.

## 2. Colour tokens

### 2.1 Brand and neutrals (as specified)

| Token | Hex | Use |
|---|---|---|
| `--navy-900` | `#14213D` | Sidebar, headings |
| `--blue-600` | `#3157D5` | Primary actions, links |
| `--blue-500` | `#4169E1` | Hover/active of primary |
| `--blue-50` | `#EEF3FF` | Selected rows, active nav background |
| `--teal-600` | `#0F9D8A` | Verified positive outcomes (icons, fills) |
| `--bg` | `#F6F8FC` | App background |
| `--surface` | `#FFFFFF` | Cards, panels, tables |
| `--text` | `#172033` | Primary text |
| `--text-muted` | `#64748B` | Secondary text |
| `--border` | `#E2E8F0` | Dividers, input borders |
| `--success` | `#16A34A` | Success |
| `--warning` | `#D97706` | Warning |
| `--danger` | `#DC2626` | Critical |
| `--info` | `#2563EB` | Informational |

### 2.2 Additions needed for accessibility (flag for approval, D-12)

**Measured in Phase 2 (2026-11-13, WCAG relative-luminance formula, computed in the browser):** teal `#0F9D8A` on white 3.38:1, success `#16A34A` 3.30:1, warning `#D97706` 3.19:1, spec muted `#64748B` on `--bg` 4.48:1, spec border `#E2E8F0` 1.23:1 — all below the thresholds for their use as small text or control boundaries. The replacements pass: `--teal-700` on teal-50 4.70:1, `--success-700` on success-50 4.76:1, `--warning-700` on warning-50 4.71:1, `--text-muted-strong` on `--bg` 5.81:1, danger-700 on danger-50 5.91:1, info on info-50 4.75:1, body text on white 16.27:1, white on primary blue 6.08:1, sidebar text on navy 10.29:1. **`--border-strong` was changed from `#94A3B8` (2.56:1, fails 3:1) to `#7B8AA0` (3.51:1 on white, 3.30:1 on `--bg`).**

Earlier approximate ratios against white, kept for the record. Several specified colours do not reach 4.5:1 as small text:

| Colour | On white (approx.) | Consequence | Addition |
|---|---|---|---|
| Teal `#0F9D8A` | ~3.4:1 | Not for small text | `--teal-700 #0B7A6B` for text |
| Success `#16A34A` | ~3.3:1 | Not for small text | `--success-700 #15803D` for text |
| Warning `#D97706` | ~3.2:1 | Not for small text | `--warning-700 #B45309` for text |
| Muted `#64748B` | ~4.8:1 on white, lower on `--bg` | Borderline on the page background | Muted text sits on white surfaces; on `--bg` use `--text-muted-strong #556277` |
| Border `#E2E8F0` | ~1.2:1 | Too faint for input boundaries (3:1 needed) | `--border-strong #7B8AA0` for form controls (revised from `#94A3B8`, which measured 2.56:1) |

Status tints (badge backgrounds): `--success-50 #ECFDF3`, `--warning-50 #FFF7E6`, `--danger-50 #FEF2F2`, `--info-50 #EFF6FF`, `--teal-50 #E6F6F3`, `--neutral-100 #F1F5F9`.

Sidebar on navy: text `#C7D0E0`, active item white text on `rgba(255,255,255,0.08)` with a 2px `--blue-500` left bar.

Dark mode: out of scope for MVP; tokens are named semantically so it can be added.

### 2.3 Colour meaning (never colour alone — always with a label or icon)

| Meaning | Colour | Examples |
|---|---|---|
| Verified, money received | Teal | "Verified" evidence tier, recovered amount |
| Completed, healthy | Green | Paid, Connected, Approved |
| Needs attention | Amber | Overdue, Partially allocated, Awaiting approval, Needs review |
| Problem | Red | Critical priority, Error, Rejected, Reversed |
| Informational / in progress | Blue | Issued, Investigating, Under review |
| Inactive | Neutral | Draft, Cancelled, Dismissed, Not connected |
| Unverified / AI-proposed | Neutral with dashed border | Possible explanation, unverified claim |

## 3. Typography

Font: **Inter** (variable), fallback `system-ui`. Numerals: `font-variant-numeric: tabular-nums` on all amounts, dates and IDs. Monospace for references: `ui-monospace`.

| Style | Size / line | Weight | Use |
|---|---|---|---|
| Display | 36 / 44 | 650 | Marketing hero only |
| H1 | 24 / 32 | 600 | Page title |
| H2 | 18 / 28 | 600 | Section title |
| H3 | 15 / 22 | 600 | Card title |
| Body | 14 / 20 | 400 | Default |
| Small | 13 / 18 | 400 | Table cells, helper text |
| Caption | 12 / 16 | 500 | Labels, column headers (sentence case, not all caps) |
| KPI figure | 28 / 34 | 600 | Dashboard values |

Marketing pages use a larger scale (body 16–18).

## 4. Spacing, radius, elevation

- Spacing scale (px): 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Page gutter 24 (16 on mobile). Card padding 20. Table cell padding 12 × 10 (compact 12 × 6).
- Radius: 8 controls and badges-in-cards, 10 cards, 12 modals/drawers. Pills fully rounded for status badges.
- Borders do the separating: 1px `--border` on cards and tables.
- Shadows: none on cards; `0 1px 2px rgba(20,33,61,.06)` on raised controls; `0 12px 32px rgba(20,33,61,.16)` on modals, drawers, popovers.
- Motion: 120–160 ms ease-out for hover, drawer and modal; respects `prefers-reduced-motion`.

## 5. Layout

| Element | Spec |
|---|---|
| Sidebar | 240px, collapsible to 64px icons; navy; sections with small labels |
| Top bar | 56px, white, bottom border: global search (`/` shortcut), notifications, organization name, profile menu |
| Content | Max width 1440; lists full width; detail pages two-column (main + 360px side panel) |
| Breakpoints | 640, 768, 1024, 1280, 1536 |
| < 1024px | Sidebar becomes a drawer; side panels stack below |
| < 768px | Tables switch to priority columns with a row drawer; KPIs 2-up then 1-up |

The marketing site uses a 1200px container and 12-column grid.

## 6. Components

Base: shadcn/ui primitives restyled with the tokens. Icons: Lucide, 16px in tables and buttons, 20px in navigation, 1.5px stroke.

| Component | Rules |
|---|---|
| Button | Variants: primary (blue-600, one per view), secondary (white, border), ghost, danger. Sizes 32/36/40. Loading state keeps width. Destructive actions need a confirm dialog naming the record |
| Inputs | 36px height, `--border-strong`, visible label above, helper/error below, 2px blue focus ring with offset |
| Money input | Right-aligned, currency adornment, accepts typed decimals only, shows formatted value on blur |
| Select / combobox | Searchable for customers and invoices |
| Date picker | Presets: today, last 7/30/90 days, this/last month, this quarter, custom |
| Badge (status) | Pill, tinted background, dark text of the same hue, optional 6px dot. One vocabulary across the app (§7) |
| Table | §8 |
| Tabs | Underline style; counts as muted suffix ("Needs review 12") |
| Card | White, 1px border, 10px radius, title row with optional action |
| KPI card | Label, figure, comparison to previous period (with direction word, not only an arrow), whole card is a link |
| Drawer | Right side, 480/640px, for quick view and create/edit; keeps list context |
| Modal | For confirmations and short forms only; max 560px |
| Toast | Bottom-right; success auto-dismiss 4 s; errors persist until dismissed |
| Banner | Inline page-level notices: integration needs attention, demo data active, remittance details changed |
| Timeline | Vertical; icon + actor + action + time; expandable content; used by investigations, disputes, collections, audit |
| Evidence card | Type icon, title, key facts, source link, tier chip (Verified source / Accounting / Manual / Claim), "cited in findings" marker |
| Finding item | See §9 |
| Stepper | Onboarding and import wizard |
| File upload | Drag-and-drop zone, accepted types and size stated, per-file progress and error |
| Empty state | Icon, one sentence on what belongs here, one primary action, optional link to docs |
| Skeleton | Used for first load of lists and cards; spinners only inside buttons |
| Error state | What failed, whether data is safe, a retry action, request ID for support |
| Permission state | "You don't have access to this. Ask an owner." Never a blank page |
| Charts | Recharts; one blue for single series; categorical palette limited to 5; direct labels where possible; always a table toggle |

## 7. Status vocabulary

| Object | Statuses → colour |
|---|---|
| Invoice | Draft (neutral) · Issued (blue) · Partially paid (amber) · Paid (green) · Overdue (red text on tint) · Disputed (amber, flag icon) · Cancelled (neutral, strikethrough number) |
| Payment | Unmatched (amber) · Partially allocated (amber) · Fully allocated (green) · Under review (blue) · Reversed (red) |
| Match confidence | Exact (teal) · High (green) · Medium (amber) · Low (neutral) |
| Investigation | New (neutral) · Investigating (blue) · Ready for review (amber) · Awaiting approval (amber, lock icon) · Action taken (blue) · Monitoring (blue, clock) · Resolved (green) · Dismissed (neutral) |
| Dispute | Open (amber) · Under review (blue) · Awaiting customer (neutral, clock) · Awaiting internal approval (amber, lock) · Resolved (green) · Rejected (neutral) |
| Approval | Pending (amber) · Info requested (blue) · Approved (green) · Rejected (red) · Stale (neutral) · Withdrawn (neutral) |
| Integration | Connected (green) · Connecting (blue) · Needs attention (amber) · Error (red) · Not connected (neutral) · Coming soon (neutral, disabled) |
| Priority | Critical (red) · High (amber) · Medium (blue) · Low (neutral) |

## 8. Financial tables

- Column order: identifier → customer → dates → amounts → status → actions.
- Amounts right-aligned, tabular numerals, currency code shown when the list mixes currencies; negative values never appear (see business rules) — reversals are labelled.
- Dates as `13 Nov 2026`; relative time only in timelines, with the absolute time on hover.
- Sticky header; first column sticky on horizontal scroll; row height 44 (compact 36).
- Row click opens the record (or quick-view drawer); checkboxes for bulk actions; overflow menu for row actions.
- Filter bar above the table: search, filter chips, "Clear", column chooser, density toggle, export.
- Totals row for filtered amount columns where meaningful.
- Pagination: cursor-based "Load more"/next-prev with page size 25/50/100; total count shown when cheap.
- Keyboard: arrow keys move rows, Enter opens, `/` focuses search, Esc closes drawers.
- Loading: 8 skeleton rows. Empty: empty state. Filtered-empty: "No results for these filters" + clear.

## 9. Investigation workspace patterns

| Element | Treatment |
|---|---|
| Confirmed fact | Solid left border teal, check icon, citation chips `[INV-1042] [PAY-0231]` |
| Calculation | Monospace block: `5,000.00 − 4,000.00 = 1,000.00 outstanding`, labelled "Calculated by Venn" |
| Possible explanation | Dashed neutral border, "Possible" chip, citations, never bold claims |
| Unverified claim | Amber dashed border, quote of the claim with source, "Not confirmed by a payment record" |
| Missing evidence | Neutral list with a "Request" or "Upload" action |
| AI-generated text | Small "AI-drafted · review before relying on it" caption with model run time; never a robot mascot or sparkle-heavy styling |
| Recommendation | Card with primary action button; shows "Requires owner approval" lock when applicable |
| Citation chip | Clicking scrolls to and highlights the evidence card; hovering shows the quoted snippet |

## 10. Content and voice

- Plain, specific, calm. "3 payments need review" not "Uh-oh!".
- Sentence case everywhere. No exclamation marks in the app.
- Name things consistently: *Investigation*, *Discrepancy*, *Allocation*, *Approval request*.
- Buttons are verbs: "Confirm match", "Submit for approval", "Send reminder".
- Error messages say what happened and what to do; never blame the user.
- Uncertainty is explicit: "Possible", "Not verified", "No bank record found".
- Never: "guaranteed", "recover all", "AI found your money".

## 11. Accessibility (WCAG 2.1 AA)

- Text contrast ≥ 4.5:1, UI boundaries ≥ 3:1 (see §2.2).
- Full keyboard operation; visible focus; focus trapped in modals/drawers and returned on close.
- Semantic tables with `<th scope>`; charts have a data-table alternative.
- Status never by colour alone.
- Form errors linked with `aria-describedby`; live regions for toasts and async results.
- Targets ≥ 32px in dense tables, ≥ 44px on touch layouts.
- Automated axe checks in Playwright on every main page.

## 12. Brand

- Wordmark "Venn" in Inter 650, navy. Mark: two overlapping circles whose intersection is filled blue — the overlap of invoices and payments. Draft concept; final logo is a product-owner decision.
- The name, domain and trademark availability are **unverified**; no public claim until checked (D-01).
