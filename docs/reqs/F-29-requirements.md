# F-29 — Share Product Requirements

## Meta

| Field | Value |
|-------|-------|
| Feature | F-29 · Share Product |
| Hook | H7 (Close into action — every product card terminates in at least one action button) |
| Persona | All |
| Owner | Alejandro Bordón |
| Branch | feat/F-28-educational-tooltips |

## Goal

Allow users to copy the Open Food Facts URL for a focused product to the clipboard, enabling easy sharing via messaging apps, social media, or email. A toast confirms success or failure.

---

## Features & behaviour

### F-29.1 Share button on focused product card

- **Location**: Action bar of the focused product card (`renderProductCard` in `app.js`)
- **Label**: "Share product"
- **Icon**: External link or share icon (SVG inline)
- **URL format**: `https://world.openfoodfacts.org/product/{barcode}`
- **Barcode source**: `product.code` — the unique Open Food Facts barcode
- **Clipboard method**: `navigator.clipboard.writeText(url)` — falls back to `document.execCommand('copy')` only if clipboard API is unavailable (async clipboard API required for secure context; in HTTP dev, silently degrade)

### F-29.2 Toast confirmation

- **On success**: Toast message "Link copied to clipboard" + the URL is written to clipboard
- **On failure** (permission denied, insecure context, or any error): Toast message "Could not copy link — try again or copy manually from the product page"

### F-29.3 H7 compliance

- The focused product card always terminates in at least one actionable button
- Share button is always visible on the focused card (not behind a menu)
- Button is keyboard-accessible (`type="button"`, proper focus order)

---

## UX copy guidelines (from H1–H7 + KI-2)

- **KI-2**: No moralising. Do not say "Share this healthy choice" — just describe the action.
- Button label is neutral and action-oriented: "Share product"
- Toast messages are brief, factual, and non-judgemental

---

## Technical approach

- **Vanilla JS** — no framework, no build step, ES modules via `<script type="module">`
- Clipboard: `navigator.clipboard.writeText()` with try/catch
- Toast: reuse existing `toast()` function from `app.js`
- All state is in-memory; no persistence needed

---

## Acceptance Criteria (AC)

| # | Criterion | Test |
|---|-----------|------|
| AC1 | Share button is visible on the focused product card | Button labelled "Share product" present |
| AC2 | Clicking Share copies `https://world.openfoodfacts.org/product/{barcode}` to clipboard | Check clipboard contents after click (mock clipboard API in test) |
| AC3 | On success: toast "Link copied to clipboard" appears | Toast visible with correct message |
| AC4 | On failure: toast "Could not copy link — try again or copy manually from the product page" appears | Toast visible with error message |
| AC5 | Button is keyboard-accessible (Tab + Enter) | `tabindex`, `type="button"`, `onKeydown` handler not needed for `<button>` |
| AC6 | URL uses actual product barcode from `product.code` | Barcode in URL matches product.code |
| AC7 | No console errors during normal Share flow | Error monitoring |

---

## Files to create/modify

| File | Action |
|------|--------|
| `docs/reqs/F-29-requirements.md` | Requirements document |
| `frontend/design/F-29-share.html` | Design prototype |
| `frontend/js/app.js` | Add Share button to `renderProductCard`; clipboard logic |
| `frontend/css/style.css` | Add `.btn--share` styles if needed |
| `frontend/tests/` | Playwright test (F-29 spec) |
| `docs/feature-backlog.md` | Mark R+D done |

---

## Out of scope

- Actual sharing via Web Share API (native OS share sheet) — F-29 uses clipboard only
- Backend integration
- Sharing to specific platforms (WhatsApp, Twitter, etc.)