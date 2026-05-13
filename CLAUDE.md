# CLAUDE.md — Project guidance for Claude Code

> This file is loaded automatically when Claude Code opens this repository. It encodes the constraints from the WA3 research so the agent does not need to re-derive them from scratch.

## What FoodLens is (one paragraph)

FoodLens is the WA4 prototype of a UIB HCI course project on **transparent multi-objective food recommendations**. The app scores food products on two axes — Health (Nutri-Score) and Eco (Environmental Score) — and explains its reasoning with contrastive sentences anchored on verifiable numbers from the Open Food Facts API. The research phase (WA3, six interviews, thematic analysis) produced **five Key Insights** and **seven Design Hooks** that are non-negotiable constraints for any UI you produce here.

Authoritative context: read [`docs/architecture.md`](docs/architecture.md), [`docs/api-reference.md`](docs/api-reference.md), [`docs/user-flows.md`](docs/user-flows.md) before generating non-trivial code.

## The seven design hooks (hard constraints)

| Hook | What it means for the code you write |
|---|---|
| **H1** Dual-axis default | Never produce UI that hides the Eco badge. Even `"not-applicable"` must render with a caption — not be suppressed. |
| **H2** Reasoning IS the recommendation | The contrastive sentence is **open by default** on every product card. Collapsing it requires an explicit user gesture. Reasoning never lives on a separate screen. |
| **H3** One sentence, one number | Every explanation defaults to a single contrastive sentence with exactly one verifiable number and units. Charts are drill-downs, not the entry point. |
| **H4** Configurable first axis | The slider is health / eco (default) with price behind an "Advanced" toggle — never the other way around. |
| **H5** Compare-this-shelf | When designing comparison flows, support N products in / ranked list out, with a one-line justification per product. |
| **H6** Minimal onboarding | Goals + age + gender only. Body metrics optional with inline rationale. **No lifestyle questions** (income, family, etc.). |
| **H7** Close into action | Every product card terminates in at least one action button: *see recipe* / *add to shopping list* / *compare with my usual*. |

If the user asks you to do something that violates one of these hooks, push back and cite the hook by ID. Do not silently comply.

## The five key insights (UX rules of thumb)

- **KI-1** Visible reasoning is a prerequisite for trust. Never hide the "why".
- **KI-2** The value-action gap is contextual (time, fatigue, budget) — **never moralise** in copy. No "you should eat better".
- **KI-3** Single-axis labels create false confidence. Always show both axes, including conflicts.
- **KI-4** Users prefer contrastive ("30% less sugar than X") over absolute ("70/100 healthiness score").
- **KI-5** Personalisation desire is high; tolerance for complexity varies. Default to **no configuration**, expose presets, hide sliders behind "Advanced".

## Hard rules for code you generate

### Stack (no exceptions without explicit user approval)

- **Frontend**: vanilla HTML5 + CSS3 + JavaScript (ES modules). No React, no Vue, no build step, no bundler.
- **CSS**: hand-written. Editorial typography stack: **Newsreader** (display serif italic) + **Bricolage Grotesque** (body) + **JetBrains Mono** (numeric data). All three from Google Fonts. No Tailwind unless the user explicitly opts in.
- **Charts** (when needed): Chart.js via CDN.
- **Backend**: does **not exist** in the base. If a feature genuinely requires Python (KNN at scale, SHAP), introduce Flask only inside the scope of features F-23 or F-24.

### Personas to reason about

When making UX trade-offs, name the persona affected:

- **Marc Vidal** (P01) — software engineer, ~25, high tech proficiency. Time-poor, will not configure. Default user.
- **Pau Estarellas** (P02) — maths undergrad, ~22, sceptical. Demands verifiable numbers. Needs the drill-down.
- **Lluís Tomàs** (P03) — marketing pro, ~26, marketing-aware. Resists moralising. Wants contrastive comparisons against his usual purchase.

If a request would harm one persona's experience to help another, raise the trade-off.

### Things you must never do

- Hide the eco badge (violates H1)
- Put the explanation on a separate screen (violates H2)
- Write moralising copy ("you should…", "this is unhealthy") — violates KI-2
- Invent product data. If a field is missing, render `"no data"` or `"unknown"`, not a guess.
- Use emojis in UI copy, code comments, or commit messages **unless the user explicitly asks for them**
- Use Tailwind, React, or any framework without explicit user approval
- Recalculate Nutri-Score locally. The official algorithm has per-category nuances; if `nutriscore_grade` is missing, mark as `unknown` and move on.
- Skip the `User-Agent` header in OFF API calls (the API can return 403 without it). Format: `FoodLens-MVP/0.1 (team-contact)`
- Push to `main` directly. Branch first, PR always.

### Things you should do

- Read the relevant doc first: `architecture.md`, `api-reference.md`, `user-flows.md`.
- When picking up a feature, follow the four phases in [`docs/contributing.md`](docs/contributing.md): Requirements → Design → Code → Test.
- Use the **`frontend-design`** skill before writing UI code so the styling does not look generically AI-generated.
- Use the **`playwright`** or **`webapp-testing`** skill for end-to-end tests if a feature warrants them.
- Use the **`humanizer`** skill if you spot inflated AI-written copy in any text file.
- When you discover a non-obvious gotcha (a rate limit, a renamed field, a 503), document it in `api-reference.md` so the next teammate doesn't hit the same wall.

## Open Food Facts API — agent crib sheet

- **Base URL**: `https://world.openfoodfacts.org/api/v2/`
- **Product by barcode**: `GET /product/{barcode}?fields=...` — stable, **100 req/min**
- **Search**: `GET /search?categories_tags=...` — intermittent 503s, **10 req/min**
- **Eco field**: read `environmental_score_grade` **first**, fallback to legacy `ecoscore_grade`
- **Grade values**: `a|b|c|d|e` are scored; `unknown` and `not-applicable` are valid — handle them, don't crash
- **`nutrient_levels`**: contains `fat|salt|saturated-fat|sugars` each `low|moderate|high` — **use this for free XAI** without training a model
- **Failure mode**: when `/search` returns 503, fall back to `frontend/data/sample_products.json`
- **CORS**: open (`access-control-allow-origin: *`) — call directly from the browser

Full reference in [`docs/api-reference.md`](docs/api-reference.md).

## Repository conventions in one screen

| Topic | Convention |
|---|---|
| Branch names | `feat/F-NN-slug`, `fix/F-NN-slug`, `docs/topic`, `chore/topic` |
| Commit format | Conventional Commits with feature scope: `feat(F-07): add dual-axis display` |
| File naming | `kebab-case.js`, `kebab-case.css`, modules import each other via relative paths |
| JS style | ES modules, `const` by default, arrow functions, no semicolon-skipping (use semicolons), no class hierarchies (composition over inheritance) |
| Indentation | 2 spaces (HTML/CSS/JS), 4 spaces (Python if any) |
| CSS | Custom properties for colours/spacing in `:root`. Mobile-first. No `!important` unless documented. |
| Tests | Manual walkthroughs of `user-flows.md`; Playwright when behaviour is complex. No unit-test obsession. |

Full version in [`docs/conventions.md`](docs/conventions.md).

## When the user asks something ambiguous

1. Check the seven hooks first — does one of them already answer?
2. Check the relevant doc.
3. If still ambiguous, raise the trade-off in one sentence and **make a recommendation**. Don't paralyse the user with a menu of options.

## Skills to invoke proactively

When you start a task that matches one of these patterns, invoke the matching skill **before** generating code:

| Task pattern | Skill to invoke |
|---|---|
| Designing or writing any UI (HTML/CSS, components, layouts, visual polish) | `frontend-design` |
| Writing end-to-end browser tests | `playwright` or `webapp-testing` |
| Generating sample data / spreadsheets | `xlsx` if XLSX output, otherwise plain JSON |
| Polishing AI-sounding prose in docs | `humanizer` |
| Creating a new agent-facing skill for this repo | `skill-creator` |

You do **not** need to install anything from `github.com/anthropics/skills` — the relevant skills are already loaded in this environment.
