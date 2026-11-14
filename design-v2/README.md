# venn — design v2 (ramp-style redesign)

A second design for confirmation. The first prototype is untouched in `../prototype/`.

React 19 + Vite + Tailwind CSS v4 + shadcn/ui (Base UI components) + Lucide icons + React Router.

## Run

```bash
cd design-v2
npm install
npm run dev
```

No Python or virtual environment is needed; this is a Node project. The browser opens at http://localhost:5174.

- Website: `/`, `/pricing`, and 15 content pages at `/p/<slug>` (reconciliation, investigations, collections, disputes, approvals, reports, owners, ar-specialists, agencies, msps, staffing, engine, security, audit-trail, integrations)
- App: `/app` with 16 screens for both roles (switch **Owner / AR specialist** in the black bar). Team, Integrations, Audit log and Settings are owner-only.

`npm run build` type-checks and builds. All data is fictional demo data; nothing is sent anywhere.

## Where things are

| Path | What |
|---|---|
| `src/index.css` | Design tokens (measured from ramp.com), keyframes, reveal utility |
| `src/components/ui/` | shadcn components (button restyled to the measured ramp buttons) |
| `src/components/venn/kit.tsx` | logo (always lowercase "venn"), `Reveal`, `TwoTone`, ticker hook |
| `src/components/site/` | header, hero, sections, footer |
| `src/components/app/` | app shell and pages |
| `../docs/design/RAMP_ANALYSIS.md` | the analysis this design follows |

## Notes

- The product name is lowercase "venn" everywhere, including mono labels that would otherwise be uppercased.
- The font is Inter Tight standing in for ramp's licensed Lausanne.
- Motion respects `prefers-reduced-motion`.
- The shadcn CLI in this environment needed `tslib` installed and rewrote some imports to a `cn` package; those were corrected to `@/lib/utils`.
