# Contributing to FoodLens

> How we work together so we don't block each other. Read this once before picking up your first feature.

## The four phases per feature

Each feature in [`feature-backlog.md`](feature-backlog.md) runs through **four phases**, owned by the same person from start to finish:

1. **R — Requirements**: write the user story and acceptance criteria
2. **D — Design**: sketch the UI / API contract / data shape before coding
3. **C — Code**: implement it
4. **T — Test**: manual walkthrough + assertion-style checks

The phases are sequential per feature but **parallel across features**. Pau can be in phase C of F-05 while Alejandro is in phase D of F-12 — no coordination needed unless their features have a dependency.

### Phase 1 — Requirements (~20 min)

Open the feature's entry in `feature-backlog.md`. Write under it a short block:

```markdown
#### F-07 · Requirements (owner: Pau, 2026-05-14)

**User story.** As Marc (Time-Strapped Pragmatist), I want to see both
Health and Eco scores side by side on every product card so that I can
weigh the trade-off in under three seconds without expanding any panel.

**Acceptance criteria.**
- AC1: Both badges are visible on every card, even when one of them is "not-applicable"
- AC2: There is no toggle that hides the Eco badge (strict H1)
- AC3: On viewports below 400px wide, badges stack vertically with no overflow
- AC4: A caption explains the "not-applicable" state when present

**Out of scope.** Slider, alternatives, drill-down. These belong to F-12, F-15, F-10.
```

Tick the `R` checkbox in the feature header. Commit this as `feat(F-07): requirements`.

### Phase 2 — Design (~30 min)

Sketch the UI on paper or in a Figma / Excalidraw board. Drop the image (or a link) into `docs/design/F-07.md`. For features that are mostly logic (no UI), write a contract block instead:

```markdown
#### F-09 · Design (owner: Aleix, 2026-05-15)

**Module.** `frontend/js/xai.js`

**Public API.**
- `generateContrastiveSentence(product, reference, locale = 'en') → string`

**Input shape.**
- `product`: normalised product (see architecture.md schema)
- `reference`: normalised product OR `{kind: 'category-average', stats: {...}}`

**Output examples.**
- *"This yogurt has 30% less sugar per 100g than the category average,
   with the same protein content."*
- *"Insufficient data to compare on the eco axis."*

**Rules.**
- Always exactly one sentence
- Exactly one verifiable number
- Never moralises ("you should …" forbidden)
- Locale `'en'` for now; `'es'` is a F-XX follow-up
```

Tick the `D` checkbox. Commit as `feat(F-09): design`.

When uncertain, invoke the `frontend-design` skill (UI features) — it produces concrete style guidance instead of generic "looks good" output.

### Phase 3 — Code (~1–3 hours)

Branch off `main`:

```bash
git checkout main
git pull
git checkout -b feat/F-07-dual-axis-display
```

Write the code. Tick `C`. Open a draft PR pointing to `main`. PR title format:

```
feat(F-07): dual-axis display side-by-side
```

PR description template:

```markdown
## What
Side-by-side rendering of Nutri-Score and Environmental Score on every card.

## Why
Hook H1 (dual-axis default). Insight KI-3 (single-axis blindness).

## Acceptance criteria
- [x] AC1: Both badges visible on every card
- [x] AC2: No toggle hides the eco badge
- [x] AC3: Stacks below 400px wide
- [x] AC4: Caption for not-applicable state

## How to test
1. Open `frontend/index.html`
2. Search for "coca cola zero" — verify the eco badge shows "—" with caption
3. Resize the browser to 360px — badges stack, no overflow

## Screenshots
[before / after]
```

### Phase 4 — Test (~30 min)

Run through the acceptance criteria yourself in the browser. Tick `T` only when:

- [ ] All ACs pass
- [ ] No console errors
- [ ] Tested on Chrome and Firefox at desktop and mobile widths (use DevTools device mode)
- [ ] Works offline (sample fallback kicks in)

If your feature touches an interactive flow, also walk through the relevant entry in [`user-flows.md`](user-flows.md) end to end.

When all four ticks are green, mark the PR ready for review and request review from one teammate (round-robin from the team list).

## Branch naming

| Type | Format | Example |
|---|---|---|
| Feature | `feat/F-NN-short-slug` | `feat/F-07-dual-axis-display` |
| Fix | `fix/F-NN-short-slug` | `fix/F-04-handle-404-properly` |
| Docs | `docs/topic` | `docs/api-reference-rate-limits` |
| Chore | `chore/topic` | `chore/gitignore-update` |

**Never push to `main` directly.** Always go through a PR, even for typos.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/). The feature ID goes in the scope:

```
feat(F-07): add dual-axis display side-by-side
fix(F-04): handle 5xx errors with sample fallback
docs(F-09): document contrastive sentence API
test(F-15): add manual test plan for alternative engine
chore: ignore .vscode/ in git
refactor(F-12): extract slider into its own module
```

One feature per PR. If you discover an unrelated bug while working on F-07, open a separate `fix/` branch.

## PR review

- One approval is enough for P2 features.
- P0 features need two approvals (these are the base; we cannot afford bugs).
- Reviewer focuses on:
  1. Does the code do what the ACs say?
  2. Does it respect the WA3 hooks (no toggle hiding eco, reasoning open by default, etc.)?
  3. Is the code readable to someone who did not write it?
  4. Are there console errors?
- Reviewer does **not** rewrite the code. Comments only. The author decides.

## Definition of done

A feature is done when:

1. All four phase checkboxes are ticked in `feature-backlog.md`
2. The PR is merged into `main`
3. The feature behaves correctly when running `python3 -m http.server` from `frontend/`
4. The author has updated `architecture.md` or `api-reference.md` if their feature changed any documented behaviour

## When a feature is blocked

If your feature depends on F-XX that is not merged yet:

1. Mock the dependency at the module boundary (return hardcoded data).
2. Document the mock in your PR description ("currently mocks F-XX, will be replaced when merged").
3. Open a follow-up issue/task to swap the mock once F-XX lands.

Do not wait. Mock and move on.

## How to ask for help

In order of cost:

1. **Read the relevant doc first.** `architecture.md`, `api-reference.md`, `user-flows.md`. The answer to 70% of questions is in `architecture.md`.
2. **Search the repo.** `rg "your-keyword"` in the project root.
3. **Ask in the team chat.** Tag the owner of the related feature.
4. **Ask an AI agent.** Read [`CLAUDE.md`](../CLAUDE.md) for context — Claude Code, Cursor and similar tools should pick up the project conventions automatically.

## Working with AI agents

If you use Claude Code, Cursor, GitHub Copilot or similar, the project has both `CLAUDE.md` and `AGENTS.md` at the root. These give the agent the context it needs to work productively without hallucinating about the project structure. The agent is expected to:

- Read the WA3 design hooks before suggesting UI changes
- Never hide the eco badge
- Never moralise in copy
- Never invent data (always show "no data" instead of guessing)
- Invoke the `frontend-design` skill before writing UI code
- Use the personas (Marc, Pau, Lluís) by name when reasoning about UX

If the agent breaks any of these rules, push back. Read [`conventions.md`](conventions.md) for the full code style.

## Schedule snapshot

| Milestone | Date | What |
|---|---|---|
| WA4 kickoff | TBA | Team picks features in `feature-backlog.md` |
| WA4 base merge | TBA | F-01 to F-10 merged (the core prototype) |
| WA4 paper draft | TBA | Drafted in parallel by P1 (Alejandro Bordón) |
| WA4 submission | TBA | Tag `wa4-final`, prepare paper PDF |
| WA5 evaluation | next semester | User study with SUS + Explanation Satisfaction Scale |
