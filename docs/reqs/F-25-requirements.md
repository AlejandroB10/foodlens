# F-25 · Requirements — Recently Viewed History

## Feature概述
Keep the last 10 product codes visited in `localStorage`. Render a sidebar "Recently viewed" with thumbnails and dual-axis badges. Click → opens the product.

**Hook**: KI-5 (Default to no configuration — expose presets, hide sliders behind "Advanced")  
**Persona**: All

---

## 1. Functional Requirements

### FR-1: localStorage schema
- Key: `localStorage.foodlens.recentlyViewed`
- Value: JSON array of objects, newest first, max 10 items
- Each item: `{ code: string, name: string, image: string, healthGrade: string, ecoGrade: string, viewedAt: number (timestamp) }`
- When a product is visited and it's already in the array → move it to the front (update timestamp), don't duplicate
- When count > 10 → remove oldest entry (last item)

### FR-2: Tracking integration
- When `app.js` successfully loads a product (after OFF API response), call `trackView(code, productData)`
- `trackView` should be a pure function in `frontend/js/views/history.js`
- Do NOT track when onboarding modal is shown (not a real product view)
- Do NOT track when viewing from recently-viewed sidebar itself

### FR-3: UI — Sidebar section
- Render in `frontend/index.html` as a `<section id="recently-viewed">` inside the main aside/sidebar
- Initially collapsed (single row "Recently viewed ▶"), click to expand
- Each entry: thumbnail (or placeholder icon), product name (truncated to 1 line), dual-axis badges (same as search results card)
- Maximum display: 10 items, rendered newest-first
- Empty state: nothing rendered (section not shown at all if array is empty)
- "Clear history" link in the section header — clears `localStorage` and re-renders

### FR-4: Click to open product
- Clicking any recently-viewed entry calls `app.openProduct(code)` (same as search result click)
- Product opens in the main view

### FR-5: Accessibility
- `role="list"` on the entries container
- `role="listitem"` on each entry
- Keyboard navigable (tab + enter)
- aria-label on the section: "Recently viewed products"

---

## 2. UI / Interaction Details

| State | Display |
|-------|---------|
| Section empty | Section not rendered at all |
| Section has items | Collapsed header "Recently viewed (N) ▶", expanded shows list |
| Item hover | Subtle background tint, cursor pointer |
| Item click | Opens product, no visual change on the item itself |

---

## 3. Data Flow

```
OFF API response (product loaded)
        ↓
app.js calls trackView(code, productData)
        ↓
history.js: updateRecentlyViewed(code, productData)
        ↓
localStorage.foodlens.recentlyViewed updated
        ↓
UI re-renders recently-viewed section
```

---

## 4. Files to create / modify

| File | Action |
|------|--------|
| `frontend/js/views/history.js` | New — `trackView()`, `updateRecentlyViewed()`, `renderRecentlyViewed()`, `clearHistory()` |
| `frontend/css/history.css` | New — sidebar section styles |
| `frontend/index.html` | Add `<section id="recently-viewed">` markup; link `history.css` |
| `frontend/js/app.js` | Call `trackView()` after successful product load; call `renderRecentlyViewed()` on init |

---

## 5. Out of scope

- Favourites (F-26) — separate feature, no sharing of data structures
- Backend persistence — purely localStorage
- Search/filter within the history — just chronological list
- Offline support for cached products (future F-41)

---

## 6. Acceptance Criteria

- [ ] Opening 12 different products keeps only the last 10 in the history
- [ ] Revisiting a product moves it to the top, doesn't create a duplicate
- [ ] Refreshing the page preserves the history (localStorage persists)
- [ ] "Clear history" removes all entries and hides the section
- [ ] Each history entry shows the correct dual-axis badges for the product
- [ ] Clicking an entry opens that product
- [ ] Empty history shows no section in the sidebar
- [ ] Section is keyboard accessible