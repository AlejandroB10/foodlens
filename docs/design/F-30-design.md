# F-30 Print-Friendly Product Card — Design

> Prototype: [`docs/prototypes/F-30-print.html`](F-30-print.html)

## Visual Prototype Description

The design document describes what the printed output looks like on A4 paper. Open `F-30-print.html` in a browser and use Chrome's Print → Save as PDF to preview.

### Layout (single focused card, centered on A4)

```
┌─────────────────────────────────────┐
│  (20mm margin top)                  │
│                                     │
│  COCA-COLA ZERO SANS SUCROSE        │
│  Coca-Cola · France                 │
│                                     │
│  [Nutri-Score C]  [Eco —]           │
│                                     │
│  ● fat: low  ● sat.fat: low         │
│  ● sugar: moderate  ● salt: low     │
│                                     │
│  ─────────────────────────────────  │
│  This product has 10g less sugar    │
│  per 100ml than the average cola,   │
│  but a worse Nutri-Score (C vs B).  │
│  ─────────────────────────────────  │
│                                     │
│  ▶ See numbers (expanded)           │
│  ┌──────────────────────────────┐   │
│  │ Per 100g               │     │   │
│  ├──────────────────────────────┤   │
│  │ Energy              1 kcal   │   │
│  │ Sugars                  0 g   │   │
│  │ Fat                     0 g   │   │
│  │ Saturated fat           0 g   │   │
│  │ Salt                0.04 g   │   │
│  │ Fibre                   0 g   │   │
│  │ Protein                 0 g   │   │
│  └──────────────────────────────┘   │
│                                     │
│  (20mm margin bottom)               │
└─────────────────────────────────────┘
```

## CSS Rules (@media print)

```css
@media print {
  @page { size: A4; margin: 20mm 15mm; }

  /* Hide: chrome */
  .site-header, .site-footer,
  .search, .weighting,
  #recently-viewed,
  .source-badge, .loading,
  #results, #empty-state,
  #settings-backdrop, #settings-panel,
  .toast-host { display: none !important; }

  /* Show: focused product card */
  #focused { display: block !important; }
  #focused > .section__title { display: none; }

  /* Card: clean single-column layout */
  #focused .card {
    display: block !important;
    padding: 0; margin: 0; border: none;
    background: #fff; gap: 0.75rem;
  }

  /* Image hidden to save ink */
  .card__image { display: none; }

  /* Badges: keep colours via --badge-color */
  .card__scores { display: flex !important; gap: 1rem; }
  .badge { min-height: auto; padding: 0.25rem 0.5rem; }

  /* Sentence: styled with border to separate from rest */
  .card__sentence {
    border-left: 3px solid var(--color-accent);
    padding-left: 0.75rem;
    font-style: italic;
  }

  /* Nutrient table: full width, clean */
  .nutrient-table { width: 100%; font-size: 10pt; }
  .nutrient-table th, .nutrient-table td { padding: 0.2rem 0.4rem; }

  /* Chips: keep visible but smaller */
  .chips { display: flex; gap: 0.5rem; font-size: 9pt; }

  /* Action buttons hidden */
  .card__actions { display: none !important; }
}
```

## Design Decisions

1. **Image hidden in print** — saves ink, and the product name/brand is sufficient identification on paper.
2. **Nutrient table forced open** — `details` element would collapse in print; add `details[open]` rule to force expansion.
3. **Badge colours via `--badge-color` custom property** — already defined in `:root`, works in both screen and print.
4. **No background colours on body** — the paper is already white; background colours would waste ink.
5. **Font sizes slightly reduced in print (9-14pt)** — fits more product data on one page.
6. **Contrastive sentence has a left border accent** — visually separates it from the product data without using background colour.

## Files involved

- `frontend/css/print.css` — the `@media print` rules (new file)
- `frontend/index.html` — already links `print.css` (confirmed in line 30)
- `frontend/js/app.js` — button "Print card" calls `window.print()` (line 328)