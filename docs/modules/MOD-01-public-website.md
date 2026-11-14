# MOD-01 Public website

Spec: FEATURE_SPECIFICATION §B.19 · Roadmap: M16 · Code: `apps/web/src/components/site/*`

## 1. Purpose
Explain what venn does to agencies, consultancies, MSPs and staffing firms, and turn interest into a sign-up, a walkthrough request or an early-access email.

## 2. Scope
| In | Out |
|---|---|
| Home (hero with live sphere, live counters bar, statement, steps, 30 s flow film, platform, engine tabs, systems, roles, orbit, trust, testimonials, pricing band, final CTA) | Blog, docs site, changelog |
| Pricing, 15 product, team and trust pages under `/p/:slug`, About, Contact, Privacy, Terms | Localisation |
| Pinned announcement bar (dismissible), header with mega-menus, mobile menu, footer | Cookie consent banner (only if analytics cookies are added) |
| Early-access email form, contact form | Payments or self-serve checkout |

## 3. Actors
Visitor (anonymous). Marketing owner (edits copy in code).

## 4. Use cases
| ID | Use case | Main flow | Alternatives / exceptions | Result |
|---|---|---|---|---|
| UC-01-01 | Learn what venn does | Visitor lands on `/`, scrolls the sections, opens the flow film | Reduced-motion users get static frames | Visitor understands the evidence → investigation → approval loop |
| UC-01-02 | Explore a product area | Opens Platform / Teams / Trust menu, picks a page `/p/:slug` | Unknown slug → "Page not found" with links home | Page with problem, old way, new way, features |
| UC-01-03 | Request early access | Types a work email in the hero form, submits | Invalid email → inline error; network error → retry message | Lead stored, confirmation shown |
| UC-01-04 | Book a walkthrough | Fills Contact (name, work email, company, size, message, consent) | Missing name/email or consent → inline error; honeypot filled → silently accepted, nothing stored | Request stored, confirmation with reply time |
| UC-01-05 | Go to the product | Clicks Sign in / Get started / See a demo | — | Lands on `/login`, `/signup` or `/demo` |
| UC-01-06 | Dismiss the announcement | Clicks × on the bar | — | Bar hidden for the session; header moves to the top |
| UC-01-07 | Read legal pages | Opens Privacy or Terms | — | Draft text marked "pending legal review" until counsel signs off |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-01-01 | Home renders all sections in the approved order and copy. | Must | UI |
| FR-01-02 | The announcement bar stays pinned at the top at any scroll position until dismissed; the header sits directly below it. | Must | UI |
| FR-01-03 | Header menus open on hover and on click/Enter, close on Escape and outside click; mobile shows a full-screen menu. | Must | UI |
| FR-01-04 | `/p/:slug` renders one of the 15 configured pages from `pagesData.ts`; unknown slugs render a not-found state. `/product`, `/solutions`, `/security` redirect. | Must | UI |
| FR-01-05 | Early-access form validates the email and posts it to `POST /public/leads` (type `early_access`). | Must | Partial: validates, stores nothing |
| FR-01-06 | Contact form validates name, email and consent, has a honeypot, posts to `POST /public/leads` (type `walkthrough`), and shows the confirmation. | Must | Partial: validates, stores nothing |
| FR-01-07 | Lead endpoints are rate-limited per IP and send an internal notification email. | Must | None |
| FR-01-08 | Each page sets its own `<title>` from its heading and has a meta description; home keeps the tagline. | Must | UI |
| FR-01-09 | Marketing routes are pre-rendered to static HTML so search engines and link previews see content without JavaScript. | Should | None |
| FR-01-10 | `sitemap.xml` and `robots.txt` list the public routes. | Should | None |
| FR-01-11 | Pricing shows the approved plans or "Contact us / early access" until pricing decision D-08. | Must | UI |
| FR-01-12 | Testimonials, logos and statistics shown are real and permitted (decision D-13 and owner sign-off). | Must | Partial: needs owner confirmation of each quote |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-01-01 | LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms on home (Lighthouse mobile, 4G). | Lighthouse CI budget |
| NFR-01-02 | WebGL sphere and film degrade gracefully: no WebGL or `prefers-reduced-motion` → static fallback, no console errors. | Manual + E2E with reduced motion |
| NFR-01-03 | Animations run at 60 fps on a mid-range laptop; pause when off-screen. | Performance panel check |
| NFR-01-04 | No third-party trackers until a consent decision exists. | Network panel: no third-party calls |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-01-01 | 01 | E | Open `/` at 1440 and 390 | All sections present in order; no horizontal scroll |
| TC-01-02 | 02 | E | Scroll to 50% and 100% of home | Bar `top = 0`, header `top = 40px` |
| TC-01-03 | 02 | E | Click bar × | Bar removed; header `top = 0` |
| TC-01-04 | 03 | E | Tab to "Platform", press Enter, Escape | Menu opens then closes; focus returns to trigger |
| TC-01-05 | 04 | E | Visit each of the 15 slugs and `/p/nope` | 15 pages with an `h1`; not-found for `nope` |
| TC-01-06 | 05 | C | Submit hero form empty, then `bad`, then valid | Error, error, then confirmation; one POST with the email |
| TC-01-07 | 06 | C | Submit contact without consent | "Please agree to be contacted…"; no request |
| TC-01-08 | 06 | C | Fill honeypot and submit | Confirmation shown; no POST |
| TC-01-09 | 07 | A | 11 lead posts from one IP in a minute | 11th returns `429 rate_limited` |
| TC-01-10 | 08 | E | Visit `/pricing`, `/about` | Titles "… · venn" |
| TC-01-11 | 09 | E | Fetch `/pricing` with JavaScript disabled | HTML contains the pricing heading |
| TC-01-12 | NFR-01-02 | E | Emulate `prefers-reduced-motion` on home | No running animation; content readable |
| TC-01-13 | NFR-G-05 | E | axe on all public routes | 0 serious/critical |

## 8. Backend contract
- `POST /api/v1/public/leads` `{ type: "early_access" | "walkthrough", email, name?, company?, size?, message?, consent }` → `202`. Public, rate-limited, CAPTCHA-free honeypot only.
- Table `public_leads` (not tenant-scoped; no RLS reads from the app role).

## 9. Gaps and decisions
- Architecture names Next.js; the approved build is Vite + React Router. Pre-rendering (FR-01-09) closes the SEO gap without a rewrite. See the delivery plan, decision P3-D1.
- Testimonials need written confirmation that each quote is real and may be published.
