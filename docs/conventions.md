# Conventions — FoodLens

> The opinionated minimum. Keep the code legible to teammates who did not write it.

## File and folder naming

- All filenames in `kebab-case`: `product-card.js`, `weighting-slider.css`, `compare-this-shelf.html`.
- Folder names also `kebab-case`: `frontend/js/components/`, `frontend/data/`.
- No spaces. No CamelCase folders. No PascalCase except for class names *inside* JS files.

## Repository structure (target)

```
foodlens/
├── README.md
├── CLAUDE.md
├── AGENTS.md
├── .gitignore
├── docs/                       ← all design and process docs
└── frontend/
    ├── index.html
    ├── data/
    │   └── sample_products.json
    ├── css/
    │   ├── style.css           ← base + tokens
    │   └── components/         ← optional: one file per component
    └── js/
        ├── app.js              ← entry, wires DOM + events
        ├── api.js              ← OFF client, fallback, normalisation
        ├── xai.js              ← contrastive sentence generator
        ├── components/         ← optional: one module per component
        │   ├── product-card.js
        │   ├── weighting-slider.js
        │   └── ...
        └── views/              ← optional: one module per top-level view
            ├── search.js
            ├── compare.js
            └── onboarding.js
```

Backend (`backend/`) only appears if a teammate picks up F-23 or F-24. Until then, it does not exist.

## HTML

- Semantic tags: `<header>`, `<main>`, `<section>`, `<article>`, `<nav>`, `<footer>`. No `<div>` soup.
- Headings start at `<h1>` for the page title (only one `<h1>` per page) and descend in order. No skipping levels.
- `alt` attribute on every `<img>`. If the image is purely decorative, `alt=""`.
- Form inputs always have a `<label>` (associated by `for` / `id`, not visually-hidden tricks unless absolutely needed).
- Buttons that submit forms are `<button type="submit">`. Buttons that do not, `<button type="button">`. Never use a `<div>` as a button.
- Two-space indent.

## CSS

- **Mobile-first**: write the base styles for mobile, layer desktop in `@media (min-width: 768px)` blocks.
- **Custom properties at `:root`** for design tokens:

  ```css
  :root {
    /* Nutri-Score */
    --color-nutri-a: #2ecc71;
    --color-nutri-b: #a8d635;
    --color-nutri-c: #f7b731;
    --color-nutri-d: #f39c12;
    --color-nutri-e: #e74c3c;
    --color-nutri-na: #999999;

    /* Environmental Score */
    --color-eco-a: #1b7339;
    --color-eco-b: #4caf50;
    --color-eco-c: #cddc39;
    --color-eco-d: #ff9800;
    --color-eco-e: #795548;
    --color-eco-na: #999999;

    /* Spacing scale (4px base) */
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --space-6: 1.5rem;
    --space-8: 2rem;

    /* Typography */
    --font-display: 'Newsreader', Georgia, 'Times New Roman', serif;
    --font-body: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  }
  ```

- No `!important` unless you write a comment explaining why.
- Class names: `BEM-lite`. Block: `.product-card`. Element: `.product-card__badge`. Modifier: `.product-card--featured`. Avoid deep nesting; never go past two underscores.
- No CSS reset. Use a minimal normalise (e.g. set `box-sizing: border-box` globally and reset margins on headings).
- No CSS-in-JS. No inline styles in HTML (except for genuine one-off values that have no business being in the stylesheet).

## JavaScript

- **ES modules**. Every file uses `import` / `export`. No global scripts.
- `const` by default. `let` only when reassignment is necessary. `var` is forbidden.
- Arrow functions for everything except cases where `this` binding matters (rare in this codebase).
- **Semicolons required**. We are not in the no-semi camp.
- Two-space indent.
- Strings: single quotes for code, backticks for templates and multi-line. Double quotes only inside JSX-like HTML attributes (we have no JSX, so this almost never applies).
- Trailing commas on multi-line arrays and objects.
- Equality: `===` and `!==`. Never `==` or `!=`.
- `async`/`await` over raw promise chains.
- No classes unless representing genuine stateful objects. Prefer modules of pure functions and small factory functions.

### Example module

```js
// frontend/js/api.js
import { sampleProducts } from './data/sample-products-loader.js'

const BASE_URL = 'https://world.openfoodfacts.org/api/v2'
const USER_AGENT = 'FoodLens-MVP/0.1 (team@uib.cat)'
const PRODUCT_FIELDS = [
  'code', 'product_name', 'brands', 'image_front_url',
  'nutriscore_grade', 'environmental_score_grade', 'ecoscore_grade',
  'nutrient_levels', 'nutriments', 'categories_tags',
].join(',')

export async function getProductByBarcode(barcode) {
  if (!isValidBarcode(barcode)) {
    return null
  }

  try {
    const res = await fetch(
      `${BASE_URL}/product/${barcode}?fields=${PRODUCT_FIELDS}`,
      { headers: { 'User-Agent': USER_AGENT } },
    )

    if (!res.ok) {
      return fallbackToSample(barcode)
    }

    const data = await res.json()
    if (data.status === 0) {
      return null
    }

    return { source: 'api', product: normalise(data.product) }
  } catch (err) {
    console.warn('OFF API unreachable, using sample data', err)
    return fallbackToSample(barcode)
  }
}

function isValidBarcode(barcode) {
  return typeof barcode === 'string' && /^\d{8}(\d{4,5})?$/.test(barcode)
}

function fallbackToSample(barcode) {
  const product = sampleProducts.find(p => p.code === barcode)
  return product ? { source: 'sample', product } : null
}

function normalise(raw) {
  // ... mapping to the normalised shape from architecture.md
}
```

### Naming

- `camelCase` for variables, functions, methods.
- `PascalCase` for classes (if any) and module-level factories returning component-like objects.
- `SCREAMING_SNAKE_CASE` for module-level constants.
- Functions are verbs: `getProductByBarcode`, `renderCard`, `computeAlternatives`. Not nouns.
- Booleans read like questions: `isLoading`, `hasNutriScore`, `canSubmit`.
- Avoid abbreviations unless they are domain-standard (`API`, `URL`, `JSON`, `XAI`). `searchInput` not `srchIn`.

### Avoid

- jQuery, Lodash, Underscore. Native browser APIs cover everything we need.
- `eval`, `Function` constructor, `innerHTML` with untrusted strings. Use `textContent` or DOM API.
- Premature abstraction. Three similar lines is fine. Extract on the fourth.
- TODO comments without a feature ID and an owner: `// TODO(F-15, Pau): handle empty alternatives` is fine; `// TODO: fix` is not.

## Python (only if F-23 / F-24 land)

- Python 3.11+.
- 4-space indent.
- `black` for formatting (line length 100).
- `ruff` for linting.
- Type hints on public functions, not required on private helpers.
- Functions over classes.
- `pathlib.Path` over `os.path` string concatenation.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) with **feature scope**.

```
feat(F-07): add dual-axis display side-by-side
fix(F-04): handle 5xx errors with sample fallback
docs(api): clarify environmental_score_grade fallback
test(F-15): manual test plan for alternative engine
refactor(F-12): extract slider into its own module
chore: ignore .vscode/ in git
```

Allowed types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`, `style`.

**The commit message is the audit trail of the project.** Write it for the teammate who reviews your PR six months from now. Bad: `update`. Good: `fix(F-06): fall back to ecoscore_grade when environmental_score_grade is null`.

## Pull requests

- One feature per PR. Multiple PRs from the same person is fine; one PR with five features is not.
- PR title = main commit subject.
- PR description follows the template in `contributing.md`.
- Screenshots for UI changes (mobile + desktop).
- Link the relevant feature ID in the description (`F-07`).
- **Never** merge your own PR for a P0 feature. Request review.

## Documentation alongside code

When a feature changes:

- An API contract → update `api-reference.md` in the same PR.
- A data shape → update `architecture.md` in the same PR.
- A user-facing flow → update `user-flows.md` in the same PR.

These updates are not a follow-up. They are part of the feature.

## What we do not enforce (yet)

- A linter or formatter (we trust the team; add when the codebase grows).
- Automated tests beyond manual walkthroughs (Playwright comes in if a feature is complex enough to warrant it).
- A CI pipeline (this is a course prototype; CI is a WA5 concern).

Add these only when their absence causes real pain — not preemptively.

## On AI-generated code

Many of us will use Claude Code, Cursor or similar. Two rules:

1. **You own the code you commit.** If a bug ships, the author cannot blame the AI. Read what you commit.
2. **Strip AI tells before committing.** Remove generic comments, "best practices" lectures in code, em-dashes in commit messages, emoji unless explicitly wanted. The project should not read as machine-written. The `humanizer` skill helps for prose.
