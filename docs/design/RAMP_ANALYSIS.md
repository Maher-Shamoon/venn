# ramp.com design analysis (reference for venn design v2)

Observed 2026-11-13 by opening https://ramp.com in the browser pane at 1024px wide and reading computed styles and CSS custom properties from the live page, plus screenshots of the home page. Values below are measured, not guessed. Things I could not observe are listed at the end.

## 1. Overall design sense

- **Editorial, not "SaaS dashboard".** Huge light-weight headlines on a white page, very little chrome, long vertical rhythm, one neon accent used only for the primary call to action.
- **Warm neutrals.** Greys are slightly warm (`#f4f2f0`, `#d2cecb`, `#6e6a68`), text is a warm near-black (`#0c0a08`), never pure black or cool blue-grey.
- **Two-tone headlines.** A sentence starts in black and continues in muted grey (`#0c0a0899`). This is used for every section title and every card title.
- **Product shown, not described.** Large rounded grey panels hold realistic UI fragments (receipts, a black card, an admin window) that are cropped at the bottom edge.
- **Live-data touches.** A mono ticker in the hero ("payments processed: 0.98…") and a persistent bottom bar of counters ("agents at work today") that tick.
- **Quiet motion.** Short colour transitions, a few floating objects, scroll reveals. No heavy parallax.

## 2. Tokens

| Token | Value (measured) |
|---|---|
| Text primary | `#0c0a08` (computed ≈ `lab(2.8 0.4 1.0)`) |
| Text hushed | `#0c0a0899` (60% black) |
| Black (buttons, dark surfaces) | `#1a1919` |
| Page background | `#ffffff` |
| Gray light (cards, panels) | `#f4f2f0` |
| Gray medium (borders, tracks) | `#d2cecb` |
| Gray dark | `#6e6a68` |
| Accent "solar" | `#e4f222`, light `#f5ff78` |
| Dark green "smolder" | `#17332d` |
| Blue "spring" / light | `#5683d2` / `#e4ebf6` |
| Orange "blaze" | `#e96516` |
| Border | `rgba(33,33,33,0.1)`, width `0.8px` |
| Black alpha scale | `rgba(33,33,33, .025 … .9)`; white alpha scale likewise |
| Radius | buttons 6px (nav) and 8px (hero); cards 12px; hero panel larger (~16–24px) |
| Spacing | `--spacer-m: 40px`, `--spacer-l: 80px`; section padding 64px / 128px |
| Nav height | 62px (plus a ~40px announcement bar) |
| z-index scale | header 300, overlay 400, modal 500, popover 600, tooltip 700, toast 800, navmenu 900 |

## 3. Typography

- **Body/headings:** Lausanne (a commercial typeface), fallback Arial. Weights loaded: 300, 350, 400, 700. **Everything visible is weight 400**, including buttons and headings. Hierarchy comes from size and colour, not weight.
- **Mono:** IBM Plex Mono (400, 500) for the live labels and counters, uppercase, small.
- **Scale (measured):** hero h1 64px / line-height 64px / letter-spacing ≈ −0.01px; section h2 40px / 42px; sub-headline 28px / 32px; body 16px / 24px; nav and button text 14px.
- Hero h1 line-height is 1.0, which gives the tight, poster-like block.

## 4. Components

| Component | Measured style |
|---|---|
| Announcement bar | Black, centred one-liner with an underlined "Learn more" and a close (X) |
| Nav | Logo left, dropdown triggers (Products, Solutions, Partners, Resources), Pricing, then right-aligned "Sign in" (text), "See a demo" (accent), "Get started" (black). Items: 14px, 12px side padding, 6px radius, colour transition 0.24s `cubic-bezier(.45,.05,.55,.95)`. A soft accent-coloured glow sits behind the nav while hovering |
| Primary button | Black `#1a1919`, white text, 6px radius, 12px padding, 0.3s `cubic-bezier(.4,0,.2,1)` transition on colour, background, border, shadow, transform |
| Accent button | `#e4f222` background, near-black text, same radius and transition; large variant 8px radius, 20px side padding, 16px text |
| Secondary button | `#f4f2f0` background |
| Ghost/glass | `rgba(255,255,255,.05)` with a 2px inner white highlight |
| Email capture | A grey rounded container holding a borderless input and the accent button, pill-like, in the hero and again at the page end |
| Bento card | `#f4f2f0`, 12px radius, 0.8px hairline border, title top-left in two-tone, small white square arrow button top-right, UI mock cropped at the bottom |
| Hero visual | Very large rounded grey panel with a faint dot grid and floating document/card pieces with small black selection handles at corners |
| Mono label | Uppercase IBM Plex Mono, ~11px, on a light grey chip for the value |
| Fixed bottom bar | White, hairline top border, row of mono counters that tick |
| Marquee | Horizontally scrolling logo row (keyframe present) |

## 5. Layout

Full-width sections, content left-aligned in a wide (~1200–1280px) container with ~40px side padding. Hero: label, h1, sub-line, email form, then the big panel. Then a stat/proof section, a heading with button, a bento grid (2 large cards, then 3 small), a form section, a tall scroll-driven story ("Systems that never spoke"), a video panel with quote, a two-column feature pair, a testimonial wall, and a closing CTA. Total page height ≈ 12,400px at 1024px.

## 6. Motion (from the live stylesheet)

Keyframes found: `arrow-slide`, `accordion-down/up`, `slideDownAndFade`/`slideUpAndFade`/`slideLeftAndFade`/`slideRightAndFade`, `spin`, `ping`, `pulse`, `enter`/`exit`, `nav-in`/`nav-out`, nav-content `FadeIn`/`RiseIn`/`EnterFromStart`/`EnterFromEnd`/`ExitToStart`/`ExitToEnd`, overlay/content `Show`, `scroll`, `marquee`, `personalization-border-trace`, `personalization-status-wash`, `cloudDrift`, `cloudBob` (plus mobile variants), `contentFadeIn`, `crane-lower-translate`/`-fade`, `platform-card-arrow-out-45`.

What this implies:
- **Hover:** colour/background transitions 0.24–0.3s; card arrow slides out at 45° and re-enters.
- **Menus:** dropdown content fades and rises; accordion height animates.
- **Ambient:** floating "cloud" objects drift and bob; numbers pulse/tick; logos marquee.
- **Scroll:** sections reveal; the long story section is scroll-driven (a "crane" lowering sequence).
- No GSAP, Lenis, Three.js or Lottie globals were found on `window`. The `transition` values include Tailwind's `--tw-gradient-*` properties, so the site is styled with Tailwind, and the keyframe names (`accordion-down`, `slideDownAndFade`) are the Radix UI conventions.

## 7. How venn design v2 maps to this

| ramp pattern | venn v2 (`design-v2/`) |
|---|---|
| Lausanne 400 everywhere | Inter Tight (free, similar grotesque), weight 400 everywhere |
| IBM Plex Mono labels | IBM Plex Mono, same use |
| Warm greys, `#0c0a08`, `#1a1919` | Same measured values as CSS variables |
| Neon "solar" accent, only for the primary CTA | `--lime: #e4f222` (same value; change in one place) |
| Announcement bar, nav dropdowns, 3-button right cluster | Built with shadcn `NavigationMenu`, `Sheet` for mobile |
| Hero ticker + email pill + dotted hero panel with floating cards | Built; content is venn's own invoice, bank payment, email claim and finding |
| Bottom live counter bar | Built; labelled "demo data" |
| Bento grid (2 + 3) with arrow buttons | Built, with venn's own mock windows |
| Two-tone headings | `TwoTone` component |
| Scroll-driven "systems" story | Built with a scroll-progress sticky section |
| Dark/black card element | Dark investigation-engine panel |
| Accordion | shadcn `Accordion` |
| Testimonials / customer counts | **Not used**: venn has no customers; no invented quotes or statistics |
| Scroll reveal, floating objects, arrow-out hover, 0.3s transitions | Implemented; all disabled under `prefers-reduced-motion` |

## 8. What was deliberately not copied

The ramp logo and wordmark, all copy, product imagery, card artwork, testimonials, customer names and statistics, and the Lausanne typeface (commercial licence). venn's marks, copy and mock artwork are original. The colour values and layout patterns follow ramp closely at your request; if you want more distance for legal or brand reasons, swap `--lime` and the two headline sizes first.

## 8b. Second pass (pricing and accounts-receivable pages, measured)

- **Nav:** `position: fixed`, transparent at the top; once scrolled the bar is `rgba(255,255,255,.5)` with `backdrop-filter: blur(25px)` and a `0.8px` bottom border `rgba(33,33,33,.05)`. venn v2 copies this and adds saturation for the liquid-glass feel.
- **Pricing page:** headline "Start for free. Scale with…", three tier cards with small tags above (grey, lime for the middle card, black), email field plus button inside each card, bullet lists grouped by module, then a "Compare features" table. venn v2 follows this structure with its own plans (illustrative prices).
- **Product page (AR):** h1, "old way / new way" pair, then alternating feature sections with UI panels, a cross-link grid to other products, an FAQ. Page height ≈ 13,500px. venn's content pages follow this order.
- **Footer:** very large link footer (≈270 links). venn keeps a smaller one.
- Only these two extra pages were opened; the remaining ramp pages were not.

## 9. Not observed / limits

- Only the home page was inspected, at 1024px wide. Other pages, the mega-menu contents, and mobile behaviour were not.
- Scroll-triggered animation timings and the "crane" sequence were inferred from keyframe names and screenshots, not measured frame by frame.
- Easing and durations for scroll reveals were not read; venn uses a 0.8s ease-out rise as a reasonable stand-in.
- Computed colours came back in `lab()`; hex values are from the site's own CSS variables.
