# Venn — Risks, Assumptions and Decisions

Status: Phase 1 draft · Last updated 2026-11-13

## 1. Decisions requiring product-owner approval

Each has a recommendation so that "approve as recommended" is a valid answer. **Blocking** = needed before the named phase can start.

| ID | Decision | Recommendation | Blocks |
|---|---|---|---|
| **D-01** | **Product name.** Research found an existing Canadian SMB fintech called Venn (venn.ca) with invoicing and AI features, Venn Software holding venn.com, and Venn by Two Sigma. No trademark or domain search has been done | Keep "Venn" as the working name for the prototype. Commission trademark and domain searches before any public use. Keep the name in one config value so it can change cheaply | Public launch (not Phase 2) |
| **D-02** | Hosting for API/workers and web | Managed Supabase for DB/Auth/Storage; containers for API and workers on a simple container host; web on a Next.js-capable host. Choose the vendors at M17 | M17 |
| **D-03** | **Venn never moves money.** "Issue refunds" becomes "record an approved refund decision", executed by the user in their bank or gateway (challenge C-1) | Approve | Phase 2 |
| **D-04** | LLM and embedding providers | Anthropic Claude as primary chat model, an OpenAI-compatible model as fallback, a separate embedding provider (Anthropic has no embeddings API). Confirm exact models and costs at M11 | M11 |
| **D-05** | First live integrations and order | Gmail → QuickBooks Online → Stripe (read-only). Outlook, Xero, bank feeds after MVP | M13 |
| **D-06** | Auto-apply exact matches (rule R1) by default | On by default, visible in an "Auto-applied" tab with undo, switchable off per organization | M9 |
| **D-07** | Roadmap reorder and the other challenges C-2…C-9 in PRODUCT_REQUIREMENTS §10 (computed invoice status; remittance-change lockdown; three AI workflows first; no FX in MVP; Gmail later; no `bank_transactions` table yet; audit at M5 and approvals at M10; investigations before email) | Approve as a set | Phase 2 |
| **D-08** | Pricing model | Do not decide yet. Pricing page shows "Early access — talk to us". Leading hypothesis: tiers by monthly invoice volume with unlimited users. Percentage-of-recovery pricing is rejected because it conflicts with the no-guarantee rule | Public launch |
| **D-09** | MFA required for Owners | Required before general availability; optional for AR Specialists | M16 |
| **D-10** | Budget for external verification: Google restricted-scope security assessment, penetration test, legal review of privacy/terms/DPA | Plan for all three before paid launch; get quotes during M11–M12 | M13 / launch |
| **D-11** | In-app "demo data" option during onboarding | Include, clearly labelled, removable in one action | Phase 2 |
| **D-12** | Additional colour tokens for accessible text (darker teal/green/amber, stronger input border) alongside the specified palette | Approve; the specified brand colours stay for fills and icons | Phase 2 |
| **D-13** | Legal pages | Prototype uses clearly marked placeholders; counsel-reviewed text before launch | Launch |
| **D-14** | One extra planning document, `SYSTEM_ARCHITECTURE.md`, beyond the 18 listed | Keep | — |
| **D-15** | Single-owner organizations can perform sensitive actions without a second approver, with typed confirmation and an audit entry | Approve; otherwise solo operators cannot use adjustments at all | M10 |
| **D-16** | Customer discovery: personas and segment are hypotheses with no interviews behind them | Run 5–8 conversations with target finance leads using the prototype | Recommended during Phase 2 |

## 2. Assumptions

| ID | Assumption | If wrong |
|---|---|---|
| A-01 | Target firms can export invoices and payments as CSV from their accounting system and bank | Onboarding stalls; QuickBooks connector moves earlier |
| A-02 | Payment references often contain invoice numbers, so deterministic matching resolves a meaningful share | More goes to manual review; AI ranking and customer-alias learning gain priority |
| A-03 | Owners will accept approving in a web app rather than chat | Add email/Slack approval links post-MVP |
| A-04 | A two-role model is enough for 10–200 person firms | Custom roles move up |
| A-05 | Most target customers invoice in one currency, some in two or three | FX reporting moves up |
| A-06 | Customers accept their financial documents being processed by a third-party LLM under no-training terms | AI-off mode must be fully usable (it is designed to be); private-deployment models considered later |
| A-07 | Supabase Auth meets needs through MVP | Auth is behind a thin adapter (JWT verification + profile sync), limiting migration cost |
| A-08 | One developer workstation runs the Docker stack on Windows | Use a hosted dev database; verified at M4.1 |
| A-09 | Third-party terms and verification requirements described in these documents are as at research time | Each is re-verified from provider documentation at its milestone |
| A-10 | Service-business discrepancies (short pays, missing payments, duplicates) are frequent enough to justify a dedicated tool | Core value proposition weakens; validate via D-16 |

## 3. Risks

Likelihood / impact: H, M, L.

### Product and market
| ID | Risk | L | I | Mitigation |
|---|---|:-:|:-:|---|
| R-01 | Building for unvalidated personas | M | H | D-16 interviews; prototype review with real prospects |
| R-02 | Differentiation is thin: several funded competitors (Monk, Fazeshift, Stuut, HighRadius) already claim AI dispute investigation; Monk names the same verticals and integrates QuickBooks and Stripe | H | H | Compete on what was not found elsewhere: service-business evidence, visible fact/assumption separation, self-serve from CSV with no sales call, transparent pricing. Do not claim uniqueness for "AI investigation" or "human-in-the-loop" |
| R-03 | Basic cash application is free elsewhere (Ramp AR for Ramp customers; built-ins in QuickBooks/Stripe) | H | M | Position on the cross-source investigation, not on matching |
| R-04 | Name collision forces a rebrand | M | M | D-01; name kept configurable |
| R-05 | Scope creep toward a full AR suite | H | H | Scope doc and vertical-slice rule; post-MVP backlog stays unordered until feedback |
| R-06 | Users treat "verified recovered" as proof Venn caused the payment | M | M | Label describes what is measured; definition shown beside the number |

### Technical
| ID | Risk | L | I | Mitigation |
|---|---|:-:|:-:|---|
| R-10 | Cross-tenant data leak | L | Critical | Double enforcement, forced RLS, automated suite on every build |
| R-11 | Incorrect balances or allocations | L | Critical | DB constraints, property-based tests, row locking, nightly integrity job |
| R-12 | AI states something untrue as fact | M | H | Facts generated by code; citation and numeric validators; evaluation gates; manual mode |
| R-13 | Prompt injection via email or PDF | M | H | No write tools; closed action catalog; human approval; injection test corpus |
| R-14 | Wrong automatic match | L | H | Auto-apply only rule R1; undo; zero-wrong-auto-apply gate on fixtures |
| R-15 | Messy real-world CSVs break imports | H | M | Mapping UI, validation preview, error export, exploratory tests with real export formats |
| R-16 | OCR quality on scanned documents | M | M | Human confirmation of every extraction; low-confidence highlighting |
| R-17 | RLS and per-request permission loading hurt performance | M | M | Composite indexes led by organization; measured at M16 on 100k-invoice dataset |
| R-18 | Async API + sync workers duplicate data-access code | M | L | Thin shared services; fallback to sync endpoints decided at M4 |
| R-19 | LangGraph and provider APIs change | M | M | Provider adapters; graphs kept small; docs re-read at M11; versions pinned |
| R-20 | LLM cost growth | M | M | Per-organization budgets, smaller models for classification, caching, cost recorded per run |

### External dependencies
| ID | Risk | L | I | Mitigation |
|---|---|:-:|:-:|---|
| R-30 | Google restricted-scope verification takes months and has a recurring assessment cost | H | H | Start early; testing mode with allow-listed users; product fully usable without Gmail |
| R-31 | Intuit production approval or Stripe platform review delays | M | M | Sandbox development; CSV path always available |
| R-32 | Provider outage or rate limiting | M | M | Backoff, resumable cursors, status shown honestly |
| R-33 | Supabase platform limits or pricing changes | L | M | Standard Postgres + S3 interfaces; auth behind an adapter |

### Legal and compliance
| ID | Risk | L | I | Mitigation |
|---|---|:-:|:-:|---|
| R-40 | Marketing or security claims that are not true | M | H | Claims review in acceptance criteria; guardrails in COMPETITIVE_POSITIONING §8 |
| R-41 | Privacy obligations for email content of third parties | M | H | Minimised sync, DPA, deletion on disconnect, counsel review |
| R-42 | Collection emails cross into regulated territory (consumer debts, legal threats) | L | H | B2B first-party positioning; template rules; final notices need approval |
| R-43 | Future pressure to add payments triggers regulation | M | H | D-03; regulatory review before any such feature |

### Delivery
| ID | Risk | L | I | Mitigation |
|---|---|:-:|:-:|---|
| R-50 | M11 (Investigation Engine) is the largest and least certain milestone | H | H | Nine checkpoints; deterministic parts first; fake provider; manual mode means the slice closes even if AI quality lags |
| R-51 | Tests reported as passing without live credentials | M | H | PASSED/FAILED/BLOCKED rule; evidence files quote commands |
| R-52 | Prototype and specification drift apart | M | M | Any change in the prototype review updates the spec before Phase 3 |
| R-53 | No git history or backup of the working folder today | M | M | `git init` and a private remote at M4.1 (or earlier on request) |

## 4. Open questions (non-blocking)

1. Which countries are in scope for the first customers? (Drives currency list, date formats, legal review.)
2. Should accountants/bookkeepers managing several client organizations be a supported user type early? The data model allows multi-organization users.
3. What is the expected largest customer size for MVP (invoices per month)? Performance targets assume up to ~100k invoices per organization.
4. Should Owners be able to approve from an email link without opening the app?
5. Is there an existing brand asset (logo, domain) to respect?

## 5. What was not done in Phase 1

- No customer interviews, no hands-on trials of competitor products; competitor facts come from vendor pages read through an automated summariser, and several cells remain "Not verified".
- No trademark, domain or app-store search.
- Local tooling (Docker, Node, Python versions) not checked.
- Contrast ratios in DESIGN_SYSTEM are approximate and will be measured in Phase 2.
- Third-party requirements (Google, Intuit, Stripe, LLM provider terms and model details) are stated from general knowledge and must be confirmed from current documentation at the relevant milestone.
- No legal review.
