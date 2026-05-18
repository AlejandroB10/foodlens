# F-26 · Requirements — Favourites / Saved

## Feature概述
Heart toggle on every card. Save codes to `localStorage.foodlens.favourites`. New "Saved" view lists them with the same card layout as search results.

**Hook**: H7 (Close into action — every product card terminates in at least one action button)
**Persona**: Marc, Lluís

---

## 1. Functional Requirements

### FR-1: localStorage schema
- Key: `localStorage.foodlens.favourites`
- Value: JSON array of product objects, newest first
- Each item: `{ code: string, name: string, image: string, healthGrade: string, ecoGrade: string, savedAt: number (timestamp) }`
- No max count limit (intentional — user controls their own list)
- Duplicate codes are not allowed — if already saved, do not add again

### FR-2: Heart toggle — Card button
- Each product card (search result, focused view, recently-viewed entry) shows a heart icon button
- States: empty heart (not saved) / filled heart (saved)
- Click toggles the product in/out of favourites
- Filled heart: primary brand colour (--color-accent or --color-heart), e.g. #e63946 or #d62828
- Empty heart: muted grey, e.g. --color-text-muted
- H7 compliant: heart button IS the action button on the card

### FR-3: Favourites toggle integration
- `toggleFavourite(code, productData)` — pure function in `frontend/js/views/favourites.js`
- Export `isFavourite(code)` — returns boolean
- Export `getFavourites()` — returns array

### FR-4: UI — Saved view
- Render in `frontend/index.html` as a `<section id="favourites">` in the main content area
- Accessible via a nav link/tab: "Saved" (heart icon + label)
- Shows all saved products in the same card layout as search results (dual-axis badges + contrastive sentence + action buttons)
- Empty state: heart icon + "No saved products yet. Tap the heart on any product to save it."
- "Clear all" button at the top of the section (only shown when ≥1 item)
- Clicking a card opens the product (same as search result click)

### FR-5: Click to open product
- Clicking any saved entry calls `app.openProduct(code)` (same as search result click)
- Product opens in the main view

### FR-6: Accessibility
- `role="list"` on the entries container
- `role="listitem"` on each entry
- Heart button: `aria-label="Save product"` / `aria-label="Remove from saved"`
- `aria-pressed` on the heart button to indicate toggle state
- Keyboard navigable (tab + enter/space on heart button)
- aria-label on the section: "Saved products"

---

## 2. UI / Interaction Details

| State | Display |
|-------|---------|
| Product not saved | Empty heart outline, muted |
| Product saved | Filled heart, accent colour |
| Saved view empty | Centered message + heart icon |
| Saved view has items | Grid/list of product cards with heart buttons |
| Heart hover | Scale 1.1 + colour fill transition |
| Heart click | Brief scale pulse animation (0.9 → 1.0) |

Heart icon: inline SVG preferred. No emoji.

---

## 3. Data Flow

```
User taps heart button on card
        ↓
toggleFavourite(code, productData)
        ↓
localStorage.foodlens.favourites updated
        ↓
All heart buttons re-render (fill/empty state reflects new favourite status)
        ↓
If saved view is open → re-render the saved list
```

```
User opens "Saved" view
        ↓
getFavourites() → load from localStorage
        ↓
render product cards (same as search results)
        ↓
Each card has working heart toggle
```

---

## 4. Files to create / modify

| File | Action |
|------|--------|
| `frontend/js/views/favourites.js` | New — `toggleFavourite()`, `isFavourite()`, `getFavourites()`, `renderFavourites()`, `clearFavourites()` |
| `frontend/css/favourites.css` | New — heart button, saved view layout |
| `frontend/index.html` | Add `<section id="favourites">` markup + nav link; link `favourites.css` |
| `frontend/js/app.js` | Import `toggleFavourite`, wire heart button in product cards; call `renderFavourites()` when saved view is shown |

---

## 5. Relationship with other features

- **F-25 (Recently Viewed)**: independent data store (`foodlens.recentlyViewed`), no sharing
- **F-17 (Close-the-loop action buttons)**: the heart toggle IS the H7 action on cards. F-17 stubs ("See recipe", "Add to shopping list") remain available on focused cards
- **F-29 (Share product)**: separate action button — do not conflate

---

## 6. Out of scope

- Backend persistence — purely localStorage
- Sync across devices
- Sort/filter within saved view (chronological only)
- Offline support for cached products
- Share the saved list as a link

---

## 7. Acceptance Criteria

- [ ] AC1: Tapping the heart on a product saves it to `localStorage.foodlens.favourites`
- [ ] AC2: Tapping the heart again removes it from favourites
- [ ] AC3: Saved products persist across page refresh
- [ ] AC4: "Saved" view shows all saved products with the same card layout as search results
- [ ] AC5: Empty saved view shows the friendly empty state message
- [ ] AC6: "Clear all" button removes all saved products and hides itself
- [ ] AC7: Heart button state is consistent across all card instances (search + focused + recently-viewed)
- [ ] AC8: Duplicate codes are not added twice to favourites
- [ ] AC9: Heart button is keyboard accessible (tab + enter/space)
- [ ] AC10: No console errors during toggle operations