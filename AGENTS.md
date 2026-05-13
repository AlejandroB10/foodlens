# AGENTS.md — Project guidance for AI coding agents

> Open-standard agent context file. Works with Cursor, Aider, Continue, Codex CLI and any other agent that follows the [agents.md](https://agents.md) convention. For Claude Code specifically, the same content lives in [`CLAUDE.md`](CLAUDE.md) and that one is loaded automatically.

If you are an agent: **prefer `CLAUDE.md` if you can read it** — it has the same content and is the canonical version. This file exists so non-Claude agents are not blind.

## TL;DR for any agent

You are working on **FoodLens**, the WA4 prototype of a UIB HCI project. Stack: **vanilla HTML + CSS + JS** (no framework, no build step) talking to the public Open Food Facts API. There is no backend in the base. Optional Python/Flask appears later as features F-23 and F-24 only.

The project is constrained by user research (six interviews, WA3) that produced **seven design hooks (H1–H7)** and **five key insights (KI-1 to KI-5)**. These are not suggestions — they are acceptance criteria.

## The seven hooks you must respect

1. **H1 Dual-axis default.** Never hide the Eco badge. `"not-applicable"` renders with a caption, it does not disappear.
2. **H2 Reasoning IS the recommendation.** The contrastive sentence is open by default. Collapsing is an explicit user gesture.
3. **H3 One sentence, one number.** Every explanation defaults to a single sentence with exactly one verifiable number and units.
4. **H4 Configurable first axis.** Slider order: health / eco. Price lives behind "Advanced".
5. **H5 Compare-this-shelf.** Comparison flows take N products in, return a ranked list with one-line justifications.
6. **H6 Minimal onboarding.** Goals + age + gender only. No lifestyle questions.
7. **H7 Close into action.** Every product card terminates in at least one action button.

## The five UX rules of thumb

- **KI-1** Visible reasoning before trust. Hidden reasoning = treated as opacity.
- **KI-2** Value-action gap is contextual — never moralise in copy.
- **KI-3** Single-axis labels create false confidence. Always show conflicts.
- **KI-4** Contrastive beats absolute. *"30% less sugar than X"* > *"healthiness 70/100"*.
- **KI-5** Default to no configuration. Expose presets. Hide sliders behind "Advanced".

## Personas (use them by name when reasoning)

- **Marc Vidal** (P01): software engineer, ~25, time-poor, will not configure. Default user.
- **Pau Estarellas** (P02): maths undergrad, ~22, sceptical, demands numbers.
- **Lluís Tomàs** (P03): marketing pro, ~26, resists moralising, wants contrastive comparisons.

## What you must never do

- Hide the eco badge (H1).
- Put the explanation on another screen (H2).
- Write moralising copy ("you should …", "this is unhealthy") (KI-2).
- Invent product data. Missing field → render `"no data"` or `"unknown"`.
- Use emojis in code, comments or UI copy unless the user explicitly asks.
- Add React, Tailwind, build steps or bundlers without explicit user approval.
- Recalculate Nutri-Score locally — the official algorithm is per-category complex. If `nutriscore_grade` is missing, mark as `unknown`.
- Skip the `User-Agent` header in Open Food Facts calls (format: `FoodLens-MVP/0.1 (team-contact)`).
- Push to `main` directly.

## What you must do

- Read the relevant doc first: `docs/architecture.md`, `docs/api-reference.md`, `docs/user-flows.md`.
- Follow the four phases per feature: **R**equirements → **D**esign → **C**ode → **T**est. Detail in `docs/contributing.md`.
- One feature per branch, named `feat/F-NN-slug`. One feature per PR.
- Conventional Commits with feature scope: `feat(F-07): add dual-axis display`.
- ES modules, `const` by default, arrow functions, semicolons, 2-space indent.
- Mobile-first CSS; custom properties in `:root`; no `!important` without justification.
- When the user asks something ambiguous, **recommend** — do not present a menu of options.

## Open Food Facts crib sheet

- Base: `https://world.openfoodfacts.org/api/v2/`
- `/product/{barcode}` — stable, 100 req/min
- `/search?categories_tags=...` — intermittent 503, 10 req/min, fall back to `frontend/data/sample_products.json`
- Eco field: read `environmental_score_grade` first, fallback to `ecoscore_grade`
- Use `nutrient_levels` for free XAI (low/moderate/high per nutrient — no model required)
- CORS open, call from the browser directly

## Where to look in this repo

| Need | File |
|---|---|
| Architecture and data flow | `docs/architecture.md` |
| OFF API endpoints, rate limits, JSON schema | `docs/api-reference.md` |
| User flows per persona | `docs/user-flows.md` |
| Feature list to pick from | `docs/feature-backlog.md` |
| Process (branches, PRs, the 4 phases) | `docs/contributing.md` |
| Code style | `docs/conventions.md` |
| Full Claude-specific guidance | `CLAUDE.md` |
