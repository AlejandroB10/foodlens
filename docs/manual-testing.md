# Manual testing — Alejandro Bordón's 8 features

> Quick walkthrough for each feature. Open `http://localhost:8080` after `cd frontend && python3 -m http.server 8080` and follow each block end to end. The whole pass takes ~10 minutes.

## Prep (do this once)

1. Open DevTools (F12) and the **Application** tab → **Local Storage** → `http://localhost:8080`.
2. Clear `foodlens.profile`, `foodlens.favourites`, `foodlens.recentlyViewed`, `foodlens.settings` so you start clean.
3. Reload the page.

---

## F-11 · Onboarding modal

1. On first load you should see a modal on top of the page.
2. **Step 1**: pick 1–3 goals (weight management, dietary preferences, eco priorities). Click **Continue**.
3. **Step 2**: type your age (e.g. 27), pick a gender, click **Continue**.
4. **Step 3**: optionally fill height/weight (or hit **Skip**).
5. Modal closes. Open DevTools → Application → Local Storage → check `foodlens.profile`: `status` should be `"completed"`.
6. Reload the page → **modal should NOT reappear**. If it does, the shown-once guard is broken.
7. Open the modal again via the close button on Step 1: status should turn to `"skipped"`.

**Edge to test**: abandon at Step 2 (close browser tab). Re-open: modal should stay closed (status = `"in-progress"` is enough to suppress it).

---

## F-25 · Recently viewed

1. On the home page, search for `5449000131805` (Coca-Cola Zero) or click any product card.
2. Scroll down — **"Recently viewed"** section appears with that product.
3. Click on a different product → the new one joins the list, the old one stays.
4. Open the section's collapse/expand toggle (top right of the strip).
5. Reload the page → list persists (max 10 entries).
6. Click any history entry → it focuses that product.
7. **Sanity check on bootstrap**: clear `foodlens.recentlyViewed` in DevTools and reload. The auto-loaded sample products should NOT pollute the history (it stays empty until you actively view a product).

---

## F-26 · Favourites

1. On any product card, click the **heart icon** (top right of the card). Heart fills.
2. Click the **Saved** button in the header → new view lists your saved product.
3. Click the heart again on the same card → product disappears from Saved.
4. Save 2–3 products. Refresh the page. Saved view still has them.
5. Empty state: clear all, navigate to Saved → friendly message "No saved products yet. Tap the heart on any product to save it."

---

## F-27 · Settings

1. Click the **gear icon** in the header.
2. Settings panel slides in.
3. Toggle **Unit system** between metric and imperial → DevTools localStorage shows `foodlens.settings.unitSystem` updates.
4. Move the **Default slider weight**. Refresh the page → the slider on the home view starts at that value.
5. Click **Clear my profile** → confirmation dialog. Click **Cancel** → localStorage untouched.
6. Click **Clear my profile** → **Confirm** → page reloads, localStorage cleared, onboarding modal reappears.
7. **Escape key** closes the settings panel (and the confirmation dialog if it was open).

---

## F-28 · Educational tooltips

1. On any product card, **hover** over the **Nutri-Score** badge (the green/yellow/red letter on the left).
2. After ~150 ms a popover appears with a paragraph about the methodology and a link to **santepubliquefrance.fr**. The popover has a clear border, shadow and a small arrow pointing at the badge.
3. Hover over the **Eco-Score** badge → popover with the ADEME explanation and a link to **ecoscore.fr**.
4. **Click** the badge → toggles the popover open/closed.
5. With the popover open, press **Escape** → it closes.
6. With it open, press **Tab** repeatedly → focus cycles inside the popover (close button → link → back to close button).
7. **Edge**: hover over a badge with grade `?` or `—` (unknown / not-applicable) → **no tooltip should appear** (nothing to explain).

---

## F-29 · Share product

1. Open any product (click a card or search a barcode). The focused card shows the action row: favourite heart, *Print card*, *Set/Compare with my usual*, and *Share product*.
2. Click **Share product**.
3. A toast appears at the bottom: **"Link copied to clipboard"**.
4. Paste anywhere (Ctrl+V) → you should get `https://world.openfoodfacts.org/product/<barcode>`.
5. **Keyboard test**: Tab through the card actions → focus reaches the Share button → press Enter → same toast appears.
6. **Failure path**: open DevTools → Application → Cookies → drop clipboard permission, or run in incognito with strict permissions. Click Share → toast says **"Could not copy link — try again or copy manually from the product page"** instead of crashing.

---

## F-30 · Print-friendly card

1. Open any focused product.
2. Click the **Print** button at the bottom of the card actions.
3. Browser print dialog opens.
4. Preview should show **ONLY**:
   - The product name + brand
   - Both badges (Nutri-Score + Eco-Score with their colours)
   - The contrastive sentence
   - The nutrient table (per 100g)
5. The following should be **hidden** in print:
   - Site header (FoodLens title + tagline)
   - Search bar and weighting slider
   - Other product cards in the results
   - Action buttons (heart / Share / Compare with my usual / etc.)
   - Footer
   - Personas showcase block
   - Recently-viewed strip
6. Page size should be A4 with 20 mm top/bottom and 15 mm left/right margins.
7. Cancel the print dialog → page returns to normal view.

---

## F-31 · Personas showcase

1. Scroll all the way down on the home page, **above the footer**.
2. You should see a block titled "**Who FoodLens serves**" (or similar) with three cards:
   - **Marc Vidal** — software engineer · Palma — quote and a short description about the time-poor pragmatist.
   - **Pau Estarellas** — maths undergrad · Barcelona — quote about wanting verifiable numbers.
   - **Lluís Tomàs** — marketing professional · Madrid — quote about resisting moralising.
3. On a mobile-width browser (DevTools → device emulation → iPhone), the three cards stack vertically.
4. On desktop width, the three cards sit side by side.
5. Use Tab to navigate → each card / link is focusable. No keyboard trap.
6. The whole block has `aria-labelledby` pointing to its title — readable by screen readers.

---

## Cross-feature checks (always do at the end)

- Open DevTools → **Console** tab. There should be **NO red errors** during any of the flows above.
- On mobile width (DevTools device emulation, ~360 px), nothing should overflow horizontally. The search bar, slider, cards, badges, and personas block should all reflow.
- Reload the page mid-flow several times → no broken states.

---

## If something looks broken

1. Look at the **Console** tab first — JS errors are the #1 cause of "the button does nothing".
2. Check the **Network** tab — if `style.css`, `app.js`, `api.js`, `xai.js`, or `sample_products.json` are 4xx/5xx, the dev server is serving the wrong directory (must be from `frontend/`).
3. Compare against `docs/feature-backlog.md` for the canonical acceptance criteria of the feature.
4. The Playwright suite at `frontend/tests/*.spec.js` is the source of truth for behaviour. Run `npx playwright test frontend/tests/<feature>.spec.js` to bisect.
