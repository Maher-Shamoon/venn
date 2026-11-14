# Venn — interactive HTML prototype (Phase 2)

**Demo only.** All companies, people and amounts are fictional. No real authentication, email, banking or network calls to any financial service. Not production code: it is a design reference and is kept for the Phase 3 build.

## Run

Any static server, from the repository root:

```bash
python -m http.server 5173 --directory prototype
```

Then open <http://localhost:5173/index.html>. (Opening the files directly from disk also works in a normal browser. The page loads the Inter font from Google Fonts and falls back to the system font offline.)

## Entry points

| File | What |
|---|---|
| `index.html` | Marketing website: `#/`, `#/product`, `#/solutions`, `#/security`, `#/pricing`, `#/about`, `#/contact`, `#/privacy`, `#/terms` |
| `auth.html` | `#/login`, `#/signup`, `#/verify`, `#/forgot`, `#/reset`, `#/invite/demo`, `#/onboarding/1..6` |
| `app.html` | The application. Use the **Owner / AR Specialist** switch in the dark bar at the top |

## Try the main story

1. In `app.html` as **AR Specialist**, open *Investigations → INVG-0001* (short payment, Northwind Labs). Notice confirmed facts, calculations, possible explanations, unverified claims and missing evidence are separate; click a citation chip (E3) to jump to its evidence.
2. Choose **Draft request** → *Submit for approval* (AR cannot send directly).
3. Switch to **Owner** → *Approvals* → open the newest pending request → Approve. The investigation moves to *Monitoring*.
4. In the Resolution block press **Prototype control: simulate next bank import**. A bank-verified payment arrives, rule R1 allocates it, and *Verified recovered* shows 1,000.00. Try *Resolve → Recovered* **before** that step: it is refused.
5. *Reconciliation → Needs review*: confirm, edit or reject suggestions (keys `C`, `R`, `J`, `K`). *Auto-applied* has Undo.
6. As **Owner**, open *Approvals → APR-0001* (write-off of 340.00 on INV-1037, requested by Priya) and approve it; the invoice balance reaches zero and it becomes Paid. As AR, *Request adjustment* on any invoice creates a new request; as Owner, adjustments apply directly after typing `APPLY` (single-owner rule).
7. On an investigation use **Prototype: show state** to see: running, failed (manual mode), insufficient evidence, stale analysis.

## Notes for reviewers

- Balances, statuses, KPIs and reports are **derived** from the same allocations, so figures agree across pages.
- Integration connection states are simulated and labelled as such. The real product shows "Connected" only after a live API call.
- State lives in memory: reload the page to reset the demo data.
- The prototype stores money as JS numbers for convenience. The real product uses Decimal/NUMERIC.
