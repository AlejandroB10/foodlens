# Feature Backlog — FoodLens WA4

> Originally 24 features in 7 batches. As of 2026-05-13 the base MVP (F-01..F-10, F-12..F-17 in batches A–E, plus F-23 backend) is implemented. The remaining work is **30 features** distributed across the four team members below. Pick one, run it through the four phases described in [`contributing.md`](contributing.md), tick the checkboxes as you go.

## Assignment summary (2026-05-13, final)

| Owner | Code | Features | Count | Effort |
|---|---|---|---|---|
| **Alejandro Bordón** | P1 | F-11, F-25, F-26, F-27, F-28, F-29, F-30, F-31 — UI + localStorage only | 8 | ~40h |
| **Pau Girón** | P2 | F-18, F-19, F-20, F-22, F-32, F-33, F-34, F-47 — comparison + filters + i18n + exports | 8 | ~65h |
| **Alejandro Rodríguez Arguimbau** | P3 | F-21, F-35, F-36, F-37, F-38, F-39, F-40, F-46 — integrations + perf + a11y + WA5 forms | 8 | ~75h |
| **Soufyane Youbi (Sufi)** | P4 | F-24, F-41, F-42, F-43, F-44, F-45 — ML core + data viz + telemetry + infra | 6 | ~75h |

**Rationale**: P1 carried the WA3 paper (5 sections + appendices + skeleton wiring) and still owns most of the WA4 paper writing, so his features are intentionally light (UI + localStorage, no ML).

Two iterations on Sufi's count:
1. First rebalance (after "his features are too hard" feedback) moved F-43, F-45, F-46, F-47 out of Sufi → he dropped to 4.
2. Second rebalance returned F-43 (alimentates from F-41's full-catalogue model) and F-45 (F-42 collaborative filtering depends on its telemetry data) to Sufi → he now has 6 cohesive ML/data features.

Final shape is 8/8/8/6 by count and roughly 40/65/75/75h by effort.

## How to read this

| Field | Meaning |
|---|---|
| **ID** | Stable feature code (F-01 … F-24). Use it in branch names: `feat/F-07-eco-badge`. |
| **Hook** | Which WA3 design hook(s) the feature satisfies. See `architecture.md` for the full list. |
| **Persona** | Whose journey is unblocked by this feature. *All* means all three. |
| **Prio** | **P0** = base MVP, must exist for the prototype to be coherent. **P1** = important, makes the prototype evaluable. **P2** = nice-to-have, time-permitting. |
| **Deps** | Features that must be merged before this one starts. |
| **Owner** | Empty = available. Write your name here when you pick it. |
| **Phases** | `[ ] R` requirements · `[ ] D` design · `[ ] C` code · `[ ] T` test. Tick as you go. |

Reference glossary:
- **Hooks**: H1 dual-axis default · H2 reasoning is the recommendation · H3 one sentence + one number · H4 configurable first axis (slider) · H5 compare-this-shelf · H6 onboarding (goals + age + gender) · H7 close into action.
- **Insights**: KI-1 visible reasoning · KI-2 contextual value-action gap · KI-3 single-axis blindness · KI-4 contrastive framing · KI-5 control without complexity.

---

## Batch A — UI base (P0, no dependencies)

These features unblock everyone else. Anyone can start with them.

### F-01 · Bootstrap base layout

- **Hook**: foundational
- **Persona**: All
- **Prio**: P0
- **Deps**: —
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Create `frontend/index.html`, `frontend/css/style.css`, `frontend/js/app.js` with a header (FoodLens logo + tagline "Transparent food recommendations"), an empty main container, and a minimal footer.

**Acceptance.** Opens with a double click. Mobile-first (looks acceptable down to 360px wide). Uses Inter from Google Fonts. No external CSS framework. No build step.

**Suggested tooling.** Invoke the `frontend-design` skill to avoid generic AI styling.

---

### F-02 · Search bar component

- **Hook**: foundational (entry point for F-04)
- **Persona**: All
- **Prio**: P0
- **Deps**: F-01
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Text input + submit button. Three visible states: empty, loading (spinner), error (with retry). Emits a custom event `foodlens:search` with the query string.

**Acceptance.** Submit on Enter, on button click, and on icon click. Empty input is rejected silently (no submit).

---

### F-03 · Sample products fallback

- **Hook**: foundational (offline development + 503 resilience)
- **Persona**: All
- **Prio**: P0
- **Deps**: —
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Curate `frontend/data/sample_products.json` with ~30 real OFF products covering diverse Nutri-Score / Environmental Score combinations (including edge cases: "not-applicable", "unknown", missing image). Document the schema in a header comment.

**Acceptance.** The JSON loads via `fetch` without network access. Includes at least 2 products per Nutri-Score grade and at least one product with missing eco grade.

---

### F-04 · OFF API client (product by barcode)

- **Hook**: foundational (data path for everything else)
- **Persona**: All
- **Prio**: P0
- **Deps**: F-03
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** `frontend/js/api.js` exposes `getProductByBarcode(code, fields?)`. Reads the doc at [`api-reference.md`](api-reference.md), respects the rate limit (100 req/min for `/product/`), sends a proper User-Agent (`FoodLens-MVP/0.1 (team@uib.cat)`), parses the wrapper `{status, product}`. On 4xx/5xx, falls back to `sample_products.json` lookup by code.

**Acceptance.** `getProductByBarcode('5449000131805')` returns a normalised object (see schema in `architecture.md`). Network failure does not throw — returns `{source: 'fallback', product: …}` or `null`.

---

## Batch B — Dual-axis scoring (P0, satisfies H1)

### F-05 · Nutri-Score badge

- **Hook**: H1 dual-axis default
- **Persona**: All
- **Prio**: P0
- **Deps**: F-04
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Visual badge that maps `a|b|c|d|e` to the official five-colour scale (A green → E red) and handles the non-grade values: `unknown` (grey with "?"), `not-applicable` (grey with "—").

**Acceptance.** Renders consistently on cards and on the product detail view. Colour-blind users can still distinguish A from E (letter + colour, never colour alone).

---

### F-06 · Environmental Score badge

- **Hook**: H1
- **Persona**: All
- **Prio**: P0
- **Deps**: F-04
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Same shape as F-05 but reads `environmental_score_grade` **first**, falling back to legacy `ecoscore_grade` when the former is null. Uses an ecology-friendly palette (greens + earth tones) distinct from Nutri-Score.

**Acceptance.** Coca-Cola Zero (barcode `5449000131805`, returns `ecoscore_grade: "not-applicable"`) renders the "—" state. A product with `environmental_score_grade: "b"` ignores legacy field.

---

### F-07 · Dual-axis display

- **Hook**: H1 (strict — no toggle)
- **Persona**: All
- **Prio**: P0
- **Deps**: F-05, F-06
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Side-by-side rendering of Health and Eco badges on every product card. **No toggle hides the eco axis** (this is a hard WA3 constraint — KI-3).

**Acceptance.** Eco axis is shown even when its value is `not-applicable` or missing — never hidden. A short caption explains why the value is unavailable when relevant.

---

## Batch C — Contrastive explanation (P0, satisfies H2 & H3)

### F-08 · Nutrient levels chips

- **Hook**: H3 one number
- **Persona**: Marc, Pau
- **Prio**: P0
- **Deps**: F-04
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Render the `nutrient_levels` field (fat / salt / saturated-fat / sugars, each `low|moderate|high`) as four colour-coded chips below the badges. Coloured but not screaming — these are secondary information.

**Acceptance.** Missing nutrient levels show a discreet "no data" chip; do not silently drop the dimension.

---

### F-09 · Contrastive sentence generator

- **Hook**: H2 reasoning is the recommendation, H3 one sentence + one number
- **Persona**: Marc, Lluís
- **Prio**: P0
- **Deps**: F-04, F-08
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** `frontend/js/xai.js` produces a single contrastive sentence given a product and a reference (either a chosen alternative or, as fallback, the category average from the sample JSON). Template:

> *"This product has **{X}% more {nutrient}** per 100g than {reference}, but a better Nutri-Score ({A} vs {B})."*

**Acceptance.** Sentence is always one sentence, contains exactly one verifiable number, never moralises ("you should…" forbidden). When data is insufficient, falls back to *"Insufficient data to compare on the {axis} axis."* — never invents.

---

### F-10 · Open-by-default reasoning panel

- **Hook**: H2 (strict — open by default)
- **Persona**: All
- **Prio**: P0
- **Deps**: F-09
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Every product card shows the contrastive sentence open by default. A small chevron lets the user collapse it (one-tap), but the default state is always open. Drill-down (nutrient table per 100g) lives behind a "See numbers" link.

**Acceptance.** Reload the page → reasoning is visible without user interaction. Collapsed state persists per-card only (not globally).

---

## Batch D — Personalisation (P1, satisfies H4 & H6)

### F-11 · Onboarding modal

- **Hook**: H6 goals + age + gender
- **Persona**: Marc, Pau
- **Prio**: P1
- **Deps**: F-01
- **Owner**: _available_
- **Phases**: `[x] R [ ] D [ ] C [ ] T`

**Requirements.** [`docs/reqs/F-11-requirements.md`](reqs/F-11-requirements.md)

**What.** First-visit modal: goals (multi-select: weight management, dietary preferences, eco priorities), age (number), gender (radio + "prefer not to say"). Body metrics are an optional second step with inline rationale ("we use this to scale calorie ranges — you can skip it"). No lifestyle questions.

**Acceptance.** Skippable at any step. Profile is saved to `localStorage` under key `foodlens.profile`. Shown once; subsequent visits read the profile silently.

---

### F-12 · Weighting slider

- **Hook**: H4 configurable first axis
- **Persona**: Marc, Pau
- **Prio**: P1
- **Deps**: F-11
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Two-axis slider (health 0 ↔ 100 eco) at the top of the search results. The third axis (price) is hidden behind an "Advanced" toggle that exposes a tri-slider — keeps F-04 of the design hooks satisfied without overwhelming Marc and Lluís.

**Acceptance.** Default is `{health: 70, eco: 30}` (matches the brief example). Slider re-ranks visible results live (debounced 200ms). Settings persist to `localStorage`.

---

### F-13 · Three personalisation presets

- **Hook**: H4 + KI-5 control without complexity
- **Persona**: Lluís
- **Prio**: P1
- **Deps**: F-12
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Three one-tap presets next to the slider: *Health-first*, *Eco-first*, *Balanced*. Selecting a preset moves the slider visually so the user sees the binding. P06 in the research asked for exactly this pattern.

**Acceptance.** Presets are mutually exclusive. Tapping a preset overrides the manual slider. Manually moving the slider deselects the presets.

---

## Batch E — Recommender & alternatives (P1, satisfies H5 & H7)

### F-14 · OFF API client (search + category)

- **Hook**: foundational for F-15+
- **Persona**: All
- **Prio**: P1
- **Deps**: F-04
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Extend `api.js` with `searchProducts(query, opts)` and `getCategoryProducts(category, opts)`. Respects the **10 req/min** rate limit for `/search`. Falls back to `sample_products.json` filtering when the API returns 503 (intermittent, documented in `api-reference.md`).

**Acceptance.** A 503 from OFF does not break the UI — degrades to sample data with a discrete "showing offline samples" indicator.

---

### F-15 · Alternative Engine (Better For You / Better For Earth)

- **Hook**: brief §3 Alternative Engine
- **Persona**: All
- **Prio**: P1
- **Deps**: F-14, F-07
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Given a product, fetch its category siblings, run a simple in-browser nearest-neighbour search on min-max-scaled nutrient features (no scikit-learn — implement KNN in plain JS for ~50 products), filter to strictly better Nutri-Score and/or Environmental Score. Return up to 3 alternatives ranked by weighted distance using the slider from F-12.

**Acceptance.** For Coca-Cola Zero, returns alternatives with Nutri-Score better than C. For a Nutri-Score A product, returns the empty state *"This is already among the best in its category."*

---

### F-16 · Alternative cards with deltas

- **Hook**: H3 one number, H7 close into action
- **Persona**: All
- **Prio**: P1
- **Deps**: F-15
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Render each alternative as a compact card with: name + image + Nutri/Eco badges + a one-line delta (*"4.1g less sugar, 3.7g more protein per 100g"*). Pulled from the recommend_alternatives output of `OFF_ML_Demo.ipynb`.

**Acceptance.** Tapping an alternative opens it as the new focused product (replaces the main card).

---

### F-17 · Close-the-loop action buttons

- **Hook**: H7 close into action
- **Persona**: All
- **Prio**: P1
- **Deps**: F-10
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Three buttons at the bottom of every product card: *"See recipe"*, *"Add to shopping list"*, *"Compare with my usual"*. The first two are stubs (toast "coming soon"); the third is wired to F-18.

**Acceptance.** Buttons never disappear — they are part of the card terminator (H7 explicit).

---

### F-18 · Compare with my usual

- **Hook**: H7 + KI-4 contrastive framing
- **Persona**: Lluís (primarily), All (eventually)
- **Prio**: P1
- **Deps**: F-17, F-11
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** User can mark one product per category as their "usual" (saved in profile). When viewing any product, the comparison is made against the usual instead of the category average. Contrastive sentence updates accordingly.

**Acceptance.** Profile menu lets the user view and clear their "usual" choices. No usual set → silently falls back to category average.

---

### F-19 · Compare this shelf

- **Hook**: H5 shelf-side decision support
- **Persona**: Marc
- **Prio**: P1
- **Deps**: F-15
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** A "Compare these" mode: user pastes up to 5 barcodes (or scans them, F-21) and gets a ranked list with a one-line justification per product, all on a single screen.

**Acceptance.** Works with 2–5 inputs. Ranking respects the current slider weighting from F-12.

---

## Batch F — Advanced filters & navigation (P2)

### F-20 · Multi-criteria search filters

- **Hook**: brief §3 Multi-Criteria Search
- **Persona**: Pau
- **Prio**: P2
- **Deps**: F-14
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Filter chips: *high protein*, *low sodium*, *low CO2*, *plastic-free packaging*, *organic*. Compose with the current query.

**Acceptance.** Chips are togglable, multi-select. Active filters are visible above the result list and dismissable individually.

---

### F-21 · Barcode scan via webcam

- **Hook**: H5 shelf-side
- **Persona**: All
- **Prio**: P2
- **Deps**: F-04
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Use `@zxing/browser` via CDN to scan EAN-13 barcodes from the webcam. Permission requested only when the user clicks the camera icon. Manual barcode entry remains the default.

**Acceptance.** Works in Chrome and Firefox on desktop and Android. Denied permission shows a graceful fallback to manual entry.

---

### F-22 · Category browser

- **Hook**: brief §3
- **Persona**: Pau
- **Prio**: P2
- **Deps**: F-14
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** A hierarchical browser of OFF categories (yogurts, cereals, beverages, …) with click-through into each. Useful for exploration without a specific product in mind.

**Acceptance.** Top 10 categories pre-rendered; further levels lazy-loaded.

---

## Batch G — Backend, infra, advanced XAI (P2, optional)

These features introduce the Python backend and were deliberately kept out of the base. Pick one only if your feature genuinely needs them.

### F-23 · Flask backend skeleton + KNN endpoint

- **Hook**: enables advanced recommender features
- **Persona**: All
- **Prio**: P2
- **Deps**: F-15 (proves the JS KNN works first)
- **Owner**: sdd-orchestrator
- **Phases**: `[x] R [x] D [x] C [x] T`
- **Note**: Implemented via SDD change `backend-flask-mvp` on 2026-05-13. Includes Flask skeleton, OFF client, KNN recommender, contrastive explainer, Docker containerisation, and frontend opt-in integration. See `docs/api-reference.md` for the 5-endpoint contract.

**What.** Spin up `backend/app.py` (Flask + flask-cors), expose `GET /api/alternatives/<barcode>?k=3` backed by scikit-learn KNN over a pre-computed index. Only justified if F-15 hits a performance ceiling.

**Acceptance.** Endpoint returns 200 with three alternatives in under 300ms for any barcode in the index.

---

### F-24 · SHAP-based local explanations

- **Hook**: H2 deep mode
- **Persona**: Pau (the analyst)
- **Prio**: P2
- **Deps**: F-23
- **Owner**: _available_
- **Phases**: `[ ] R [ ] D [ ] C [ ] T`

**What.** Server-side SHAP waterfall plot for the Nutri-Score prediction of a given product. Returned as a base64 PNG or as JSON values that the frontend renders as a chart. Reproduces the waterfall from `off_nutriscore_01.ipynb`.

**Acceptance.** "Advanced" toggle on the reasoning panel reveals the waterfall. Default users never see it. Pau is happy.

---

## Out of scope for WA4 (deferred to WA5)

These were ruled out in the WA3 scope guard and are **not** in this backlog:

- Real-time supermarket inventory integration
- Full personalised diet plans
- Mobile-native barcode scanning (the web prototype with F-21 is sufficient)
- A/B testing of explanation styles (this is what WA5 measures)
- Geolocation-based recommendations (mentioned as another group's idea, not aligned with our hooks — revisit only if Lluís persona work demands it)

## Batch H — Personal data layer (P1 — Alejandro Bordón)

Eight features in localStorage + DOM. No backend, no new dependencies, no ML.

### F-11 · Onboarding modal
- **Hook**: H6 · **Persona**: Marc, Pau · **Owner**: Alejandro Bordón
- First-visit modal: goals (multi-select), age, gender (+ "prefer not to say"). Body metrics in an optional second step. Persist to `localStorage.foodlens.profile`. Shown once, then silent.

### F-25 · Recently viewed history
- **Hook**: KI-5 · **Persona**: All · **Owner**: Alejandro Bordón
- Keep the last 10 product codes visited in `localStorage`. Render a sidebar / collapsed strip "Recently viewed" with thumbnails and dual-axis badges. Click → opens the product.

### F-26 · Favourites / Saved
- **Hook**: H7 · **Persona**: Marc, Lluís · **Owner**: Alejandro Bordón
- Heart toggle on every card. Saves codes to `localStorage.foodlens.favourites`. New "Saved" view lists them with the same card layout as search results.

### F-27 · Settings page
- **Hook**: KI-5 · **Persona**: All · **Owner**: Alejandro Bordón
- Page (or modal) with: unit system (metric/imperial), language preference (placeholder until F-33), default slider weight, "clear my profile" button. Persists to `localStorage.foodlens.settings`.

### F-28 · Educational tooltips on scores
- **Hook**: KI-1 · **Persona**: Pau (analyst) · **Owner**: Alejandro Bordón
- Hover/click on a Nutri or Eco badge opens a popover explaining the score's methodology (one paragraph + link to official source). Closes on outside click.

### F-29 · Share product (copy link to clipboard)
- **Hook**: H7 · **Persona**: All · **Owner**: Alejandro Bordón
- Action button on the focused card. Copies `https://world.openfoodfacts.org/product/<barcode>` to the clipboard via `navigator.clipboard.writeText`. Toast confirms.

### F-30 · Print-friendly product card
- **Hook**: H7 (offline action) · **Persona**: Marc · **Owner**: Alejandro Bordón
- Pure CSS `@media print` rule: hides header/footer/slider/footer, keeps card + contrastive sentence + drill-down table, A4 friendly margins.

### F-31 · Personas showcase block
- **Hook**: storytelling · **Persona**: All (and the TA reading the paper) · **Owner**: Alejandro Bordón
- Static block above the footer with three cards (Marc, Pau, Lluís) summarising who FoodLens serves. Pulled from `docs/user-flows.md`. Decorative — explains the project to a first-time visitor.

---

## Batch I — Comparison & filtering (P2 — Pau Girón)

### F-18 · Compare with my usual
- **Hook**: H7 + KI-4 · **Persona**: Lluís → All · **Owner**: Pau Girón
- User can mark one product per category as "usual" (saved in profile). When viewing any product, the comparison reference becomes the usual instead of the category average. Contrastive sentence updates accordingly. UI: "Set as my usual yogurt" button.

### F-19 · Compare-this-shelf
- **Hook**: H5 · **Persona**: Marc · **Owner**: Pau Girón
- "Add to comparison" toggle on every card, up to 5. New screen "Compare these" with ranked list + one-line justification per product. Ranking respects the current slider weighting.

### F-20 · Multi-criteria filter chips
- **Hook**: brief §3 Multi-Criteria Search · **Persona**: Pau · **Owner**: Pau Girón
- Togglable chips above the result list: "high protein", "low sodium", "low CO₂", "plastic-free", "organic". Compose with the search query. Visible active filters, dismissible individually.

### F-22 · Category browser
- **Hook**: brief §3 · **Persona**: Pau, Lluís · **Owner**: Pau Girón
- Hierarchical browser of the top OFF categories. Pre-render top 10 on the home; further levels lazy-loaded. "Browse by category" entry next to the search bar.

### F-32 · Allergen filter
- **Hook**: KI-2 (real constraint) · **Persona**: All · **Owner**: Pau Girón
- Read the OFF `allergens_tags` field. Filter chips for gluten, lactose, nuts, soy, egg, fish. Hide products matching active allergens. Persists per session.

### F-33 · Internationalisation (ES / EN / CA)
- **Hook**: localisation · **Persona**: All · **Owner**: Pau Girón
- Three JSON dictionaries under `frontend/i18n/`. Toggle in F-27 settings. No Intl, no framework — a single `t(key)` function reading the active dict.

### F-34 · Multi-product comparison table
- **Hook**: KI-4 drill-down from F-19 · **Persona**: Pau · **Owner**: Pau Girón
- Table view of the products selected in F-19. Columns: each product. Rows: nutrients per 100g + grades + chips. Highlight the winner per row.

### F-47 · CSV export of comparisons and favourites
- **Hook**: KI-4 (numbers Pau can verify offline) · **Persona**: Pau · **Owner**: Pau Girón
- Button on F-19 comparison view, F-34 table, and F-26 favourites view → downloads a CSV with all the numeric values per 100g. Pure client-side Blob.

---

## Batch J — External integrations & polish (P3 — Alejandro Rodríguez Arguimbau)

### F-21 · Barcode scan via webcam
- **Hook**: H5 · **Persona**: Marc · **Owner**: Alejandro Rodríguez Arguimbau
- `@zxing/browser` via CDN. Camera icon in the search bar. Permission requested only on click. Manual entry stays default. Works on desktop and Android Chrome.

### F-35 · Geolocation-based seasonal hints
- **Hook**: KI-2 (context) · **Persona**: Lluís · **Owner**: Alejandro Rodríguez Arguimbau
- Inspired by Emmanuel's group's geolocation feature. Use `navigator.geolocation` (opt-in) to detect approximate location. Show a small banner: "Strawberries are out of season in Palma — likely imported from Morocco; Eco-Score drops".

### F-36 · PWA: manifest + service worker
- **Hook**: infra · **Persona**: All · **Owner**: Alejandro Rodríguez Arguimbau
- `manifest.json` (icons, name, theme colour), `sw.js` (cache the static shell + sample_products.json). App becomes installable from Chrome/Edge.

### F-37 · WCAG audit + fixes
- **Hook**: accessibility · **Persona**: All (and Aina-equivalent low-vision users) · **Owner**: Alejandro Rodríguez Arguimbau
- Run axe-core on the page, fix the findings: focus rings, ARIA labels, contrast ratios (Nutri-Score colours border on AA failure for some grades), keyboard navigation on all interactive components.

### F-38 · Performance pass
- **Hook**: performance · **Persona**: Marc (time-poor) · **Owner**: Alejandro Rodríguez Arguimbau
- Lazy-load `<img>`, subset the Google Fonts request to only the weights actually used, `defer` non-critical scripts, audit Lighthouse to >= 90 on all four pillars.

### F-39 · Dark mode "paper-night" theme
- **Hook**: KI-5 · **Persona**: All · **Owner**: Alejandro Rodríguez Arguimbau
- CSS variables already exist. Add `[data-theme="dark"]` overrides. Toggle in F-27 settings. Persist to `localStorage`.

### F-40 · Search by ingredient
- **Hook**: brief §3 Multi-Criteria · **Persona**: Pau · **Owner**: Alejandro Rodríguez Arguimbau
- Second search field: "by ingredient". Uses OFF `/search?ingredients_tags=...`. Useful for the food-allergy case and for "find me everything containing X".

### F-46 · SUS + Explanation Satisfaction Scale forms (WA5 instruments)
- **Hook**: WA5 evaluation · **Persona**: WA5 evaluators · **Owner**: Alejandro Rodríguez Arguimbau
- In-app embeddable forms: Brooke 1996 SUS (10 items, 1–5 scale, score formula) and Hoffman et al. Explanation Satisfaction Scale. Auto-computes the SUS score on submit. Exports results as JSON. Reusable component the team uses during the user study.

---

## Batch K — ML core & infra (P4 — Soufyane Youbi · Sufi)

### F-24 · SHAP-based local explanations
- **Hook**: H2 advanced · **Persona**: Pau · **Owner**: Sufi
- Replace the body of `/api/explain` with a SHAP TreeExplainer over the RandomForest. Return the waterfall as JSON values; frontend renders with Chart.js as a stacked horizontal bar. Only visible behind an "Advanced" toggle on the reasoning panel.

### F-41 · RandomForest over the full OFF catalogue (DuckDB)
- **Hook**: ML scale · **Persona**: All (silent improvement) · **Owner**: Sufi
- Train on the full OFF dump via DuckDB, not the live API. Replace the 60% accuracy of the on-the-fly demo with the 80%+ accuracy the yogurts notebook proved feasible. Pickle the model and ship with `backend/models/nutriscore_rf.pkl` (gitignored).

### F-42 · Collaborative filtering on top of KNN
- **Hook**: recommendation quality · **Persona**: All · **Owner**: Sufi
- Track (anonymised) which alternatives users click after viewing a product (data comes from F-45). Build a co-occurrence matrix, blend it with the current nutrient-space KNN. Improves alternatives over time. Depends on F-45 having shipped first.

### F-43 · Scatter plot Nutri × Eco per category
- **Hook**: KI-3 (visualise the conflict) · **Persona**: Pau · **Owner**: Sufi
- A scatter plot showing every product in a category on the (Nutri, Eco) plane. Hover for product name. Clarifies that "healthy AND eco-friendly" is a small Pareto frontier. Chart.js via CDN. Pairs naturally with F-41's full-catalogue model: more points, more meaningful frontier.

### F-44 · Redis cache layer for the backend
- **Hook**: infra · **Persona**: All (silent) · **Owner**: Sufi
- Replace the in-process `TTLCache` with Redis. Survives restarts and works across workers when gunicorn comes in. The F-23 implementation explicitly notes this as TODO. Add a `redis` service to `docker-compose.yml`.

### F-45 · Telemetry opt-in (decision time + click-through)
- **Hook**: WA5 prep · **Persona**: WA5 evaluators · **Owner**: Sufi
- Optional, explicit opt-in checkbox in F-27 settings. Logs: time from search to action, which alternative was clicked, slider position changes. Necessary to measure "Decision time" in the WA5 user study. Frontend tracking + minimal backend endpoint to persist events as JSON-lines. Direct upstream for F-42.

---

## Out of this round (consider for WA5 or beyond)

These came up while brainstorming but did not make the cut for WA4:
- Voice search (accessibility but tangent)
- Recipe integration via Spoonacular / Edamam (paid API)
- Brand profile pages (deep dive into one brand)
- Push notifications / daily digest (requires backend persistence we do not have)
- Multi-device sync (requires accounts)
- Native mobile (out of WA4 scope by the WA3 paper)
