# F-28 — Educational Tooltips

## Meta

| Field | Value |
|-------|-------|
| Feature | F-28 · Educational Tooltips |
| Hook | KI-1 (visible reasoning before trust) |
| Persona | All (especially Pau, who demands numbers) |
| Owner | Alejandro Bordón |
| Branch | feat/F-28-educational-tooltips |

## Goal

Hovering or clicking a Nutri-Score or Eco badge shows a popover that explains the score's methodology in plain language. One paragraph + official source link. No moralising copy.

---

## Features & Behaviour

### F-28.1 Tooltip trigger

- Every `.badge` (both `.badge--nutri` and `.badge--eco`) receives a `data-tooltip` attribute: `"nutri"` or `"eco"`.
- No other elements receive this attribute.
- The badge must remain interactive (clickable/focusable for the tooltip only).

### F-28.2 Tooltip content

| Badge | Title | Paragraph | Link |
|-------|-------|-----------|------|
| Nutri-Score | "About Nutri-Score" | "Nutri-Score is a front-of-pack nutrition label devised by Santé Publique France, based on a modified Atwater index. It grades products A–E using energy, saturated fat, sodium, sugar, fibre, and protein per 100 g or 100 kcal. The algorithm includes category-specific adjustments (e.g. cheese vs. beverages)." | [official Nutri-Score page](https://www.santepubliquefrance.fr/nos-avis/reponse-a-la-commission-d-enquete-sur-les-conditions-de-mise-sur-le-marche-et-les-conditionnements-des-pesticides-et-leur-utilisation/#articles) |
| Eco-Score | "About Eco-Score" | "Eco-Score is an environmental label designed by ADEME and adapted from the Agribalyse LCA database. It grades products A–E across five impact categories: climate change, biodiversity, water stress, ozone depletion, and acidification. The score is computed from per-category base scores and production-transport adjustments." | [official Eco-Score page](https://www.ecoscore.fr) |

Paragraph is factual only — no "you should eat", "healthy for you", or similar prescriptive framing.
Max paragraph length: ~200 characters.

### F-28.3 Open / close

- **Desktop**: hover shows after 150 ms, hides when mouse leaves both badge and popover.
- **Mobile**: tap toggles open; tap outside popover closes it.
- **Keyboard**: focus badge + Enter/Space toggles; Escape closes.
- Popover must trap focus (focus stays inside popover while open).
- Popover closes on outside click (any click not inside badge or popover).

### F-28.4 Popover appearance

- Appears below or above the badge, whichever has more room in the viewport (auto-flip).
- Contains: `<button>` close `[×]`, `<h3>` title, `<p>` paragraph, `<a>` link (external, `rel="noopener noreferrer"`).
- Arrow pointing to the badge.
- Z-index: above all content.

### F-28.5 Accessibility

- `role="tooltip"` on the popover.
- `aria-describedby` on the badge pointing to the popover id.
- `aria-hidden` on popover when closed.
- Focus trap while open.
- Close button has `aria-label="Close tooltip"`.

---

## Mobile-first design

- **Touch target**: badge is already ≥44×44 px (min-height 4.5rem). No extra padding needed.
- **Tap area**: entire badge is tappable (no separate icon needed).
- **Popover width**: `max-width: 280px`; min `200px`; full-width on screens < 300px.
- **Popover position**: defaults to below badge; flips to above if within 8px of viewport edge.
- **Font sizes**: follow `--text-xs` (0.75rem) for body, `--text-sm` (0.875rem) for title.
- **Backdrop**: none (overlay popover).

---

## Out of scope

- Tooltip on the `?` or `—` state badges (unknown / not-applicable).
- Tooltip on badge in the alt-card (better alternatives grid).
- Any badge outside the main product card / results list.
- Modifying Nutri-Score or Eco-Score computation.

---

## Files to create/modify

| File | Action |
|------|--------|
| `docs/reqs/F-28-requirements.md` | This document |
| `frontend/design/F-28-tooltips.html` | Design prototype |
| `frontend/js/views/tooltips.js` | Tooltip controller (open/close/focus-trap/mobile-flip) |
| `frontend/css/tooltips.css` | Popover styles |
| `frontend/index.html` | Link `tooltips.css`; add `tooltips.js` module import |
| `frontend/js/app.js` | Add `data-tooltip` attributes in `renderBadge()` |
| `frontend/tests/tooltips.spec.js` | Playwright tests |

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC1 | Hover on Nutri-Score badge shows popover after 150 ms | Mouse over badge, wait 200 ms, popover visible |
| AC2 | Hover on Eco badge shows popover after 150 ms | Same for eco badge |
| AC3 | Popover has correct title, paragraph, and link for each badge type | Check content |
| AC4 | Moving mouse off badge AND popover hides popover within 100 ms | Mouse leave both |
| AC5 | On mobile, single tap opens popover; tap outside closes | Touch simulation |
| AC6 | Escape key closes open popover | keyboard test |
| AC7 | Focus trap: Tab cycles inside popover only while open | keyboard test |
| AC8 | Popover positions above badge when near viewport bottom | Resize viewport |
| AC9 | Official source link opens in new tab with correct rel attributes | Click link |
| AC10 | Unknown / not-applicable badges do not trigger tooltip | Hover '?' or '—' badge |
| AC11 | No console errors during normal interactions | Error monitoring |