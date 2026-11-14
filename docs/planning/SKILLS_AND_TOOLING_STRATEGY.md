# Venn — Skills and Tooling Strategy

Status: Phase 1 · Inspected 2026-11-13 in the Claude Code desktop session for `D:\Desktop\Venn`

Only skills and tools actually present in this environment are listed. Nothing here is assumed.

## 1. Environment findings

- Repository: `D:\Desktop\Venn` was **empty** and **not a git repository** at inspection. There is no prior code, no dependencies and no existing functionality to preserve.
- No `graphify-out/` directory. The standing instruction to build a knowledge graph first was skipped because there were no files to graph; it applies from Phase 2 onward once code exists.
- No project `CLAUDE.md`, no `.claude/` project skills.
- Docker, Node and Python availability on this machine were **not checked** in Phase 1 (not needed for planning); they are verified in roadmap checkpoint M4.1.

## 2. Skills inspected and selected

| Skill | Relevant? | Phase | Use |
|---|---|---|---|
| `superpowers:brainstorming` | Yes, read in Phase 1 | 1 | Its "understand intent before building" discipline. The brief already answered its questions, so the open items became the decision list in RISKS_AND_ASSUMPTIONS |
| `superpowers:writing-plans` | Yes | 3 | Turn each approved milestone into a step-level implementation plan before coding |
| `superpowers:executing-plans` / `subagent-driven-development` | Yes | 3 | Execute milestone plans; bounded implementation tasks to subagents with a written spec |
| `superpowers:test-driven-development` | Yes | 3 | Mandatory for money, allocation, reconciliation and permission code: test first |
| `superpowers:systematic-debugging` | Yes | 2–3 | Any failing test or unexpected behaviour |
| `superpowers:verification-before-completion` | Yes | 2–3 | Enforces the checkpoint protocol: run the command, read the output, then claim |
| `superpowers:requesting-code-review` / `code-review` | Yes | 3 | Review at the end of each milestone |
| `security-review` | Yes | 3 | At M5 (auth/RBAC), M11 (AI tools), M15 (OAuth), M16 (hardening) |
| `superpowers:dispatching-parallel-agents` | Yes | 1, 3 | Phase 1: competitor research. Phase 3: independent reviews |
| `superpowers:using-git-worktrees` / `finishing-a-development-branch` | Yes | 3 | Branch-per-milestone once the repo is under git |
| `artifact-design`, `artifact-diagramming` | Maybe | 2 | Only if the prototype or diagrams are published as an Artifact for sharing; the prototype itself lives in the repo |
| `dataviz` | Yes | 2–3 | Before building any chart (aging, trends) in the prototype and in Recharts |
| `claude-api` | Yes | 3 | Read before implementing the Anthropic provider adapter (model IDs, structured outputs, tool use, caching) |
| `run` | Yes | 3 | Launch and drive the app for functional and visual verification |
| `graphify` | Yes | 2–3 | Build and query the code knowledge graph once code exists; refresh after each milestone |
| `deep-research` | Considered | 1 | Not used: one focused research subagent was sufficient |
| `ponytail` family (`ponytail-review`, `ponytail-audit`, `ponytail-debt`) | Yes | 3 | Keep the MVP small; audit for bloat at M16 |
| `simplify` | Yes | 3 | After each milestone's implementation |
| `docx`, `pptx`, `xlsx`, `pdf` | Limited | 3 | `xlsx`/`pdf` for generating realistic CSV/PDF **test fixtures** only |
| `docs`, `google-workspace`, `morning`, `schedule`, `loop`, `keybindings-help`, `update-config`, others | No | — | Not relevant to building Venn |

## 3. Tools and MCP integrations

| Tool | Available | Use |
|---|---|---|
| File tools (Read/Write/Edit/Glob/Grep), PowerShell, Bash (Git Bash) | Yes | All phases. Note: Windows host; Celery and Redis run inside Docker, not natively |
| Subagents (`general-purpose`, `Explore`, `Plan`) | Yes | See §4 |
| Web search / fetch | Yes | Phase 1 competitor verification; Phase 3 checking current library and provider documentation instead of relying on memory |
| Built-in browser pane (`Claude_Browser`) | Yes | Phase 2: view the prototype at desktop/tablet/mobile widths. Phase 3: visual verification step of the checkpoint protocol |
| Claude in Chrome | Yes (deferred) | Not planned; built-in browser is sufficient |
| Artifact publishing | Yes | Optional sharing of the prototype or diagrams |
| Scheduled tasks, session tools | Yes | Not needed |
| **Figma MCP / Figma skills** | **Not available** | See §5 |
| Supabase MCP, GitHub MCP, Playwright MCP | **Not available** | See §5 |

## 4. Subagent strategy

| Phase | Subagent task | Guardrail |
|---|---|---|
| 1 | Competitor and naming research with sources → `COMPETITIVE_POSITIONING.md` | Facts labelled Verified/Assumption/Hypothesis; primary agent reviews before the doc is final |
| 2 | Independent UX review of the prototype against `UI_PAGE_INVENTORY.md` (missing states, role leaks) | Reviewer reports; primary agent decides |
| 3 | Per-milestone: code review, security review, test-gap review, tenant-isolation audit | Read-only reviewers; findings verified before fixing |
| 3 | Bounded implementation tasks with a written spec (e.g. a CSV parser, a table component) | Never: money arithmetic, allocation rules, permission checks, RLS policies without a test-first spec written by the primary agent and verified afterwards |

One primary agent owns architectural consistency and all final decisions. Subagents do not change approved requirements.

## 5. Unavailable skills and the alternative workflow

| Wanted | Status | Alternative |
|---|---|---|
| Figma design/creation/design-to-code skills | Not installed, no Figma MCP | Design system is specified in `DESIGN_SYSTEM.md` as tokens; the Phase 2 HTML prototype is the design source of truth. Figma remains optional and can be added later without rework |
| Dedicated Next.js / shadcn / Tailwind skills | Not installed | Follow the official documentation fetched at implementation time; conventions fixed in `SYSTEM_ARCHITECTURE.md` |
| Dedicated FastAPI / SQLAlchemy / Alembic / LangGraph skills | Not installed | Same: current official docs + conventions in the architecture docs. LangGraph APIs change often, so its docs are re-read at M11 |
| Playwright MCP | Not installed | Playwright runs as a normal test dependency from the CLI; the built-in browser covers interactive visual checks |
| Supabase MCP | Not installed | Supabase CLI and local stack via Docker; migrations through Alembic |
| GitHub MCP | Not installed | `gh` CLI once a private remote exists (repository creation is a product-owner action) |

## 6. Rule of use

A skill is invoked when it changes the quality of the result, and its instructions are read in full first. Skills are not invoked to raise a count.
