# F-27 — Settings Page Requirements

## Meta

| Field | Value |
|-------|-------|
| Feature | F-27 · Settings page |
| Hook | KI-5 (personalisation + autonomy) |
| Persona | All |
| Owner | Alejandro Bordón |
| Branch | feat/F-27-settings |

## Goal

Allow users to configure app preferences: units, slider default, and profile management. Persisted in `localStorage.foodlens.settings`.

---

## Features & behaviour

### F-27.1 Unit system toggle

- **UI**: Radio group with two options: `Metric` (kg, cm) and `Imperial` (lb, in)
- **Default**: Metric
- **Persistence**: `localStorage.foodlens.settings.unitSystem = 'metric' | 'imperial'`
- **Effect**: Weight/height displayed in the selected unit throughout the app (focused product, onboarding, profile). Values stored internally in metric — conversion is display-only.
- **Conversion**: 1 kg = 2.20462 lb; 1 cm = 0.393701 in

### F-27.2 Language preference (placeholder)

- **UI**: Dropdown/select with a single option: `English`
- **Persistence**: `localStorage.foodlens.settings.language = 'en'`
- **Note**: Actual i18n is F-33. This step just wires the storage key so F-33 can read it.

### F-27.3 Default slider weight

- **UI**: Slider (range input, 0–100, step 5) labelled "Eco weight" / "Health weight"
- **Default**: 50
- **Persistence**: `localStorage.foodlens.settings.defaultSliderWeight = number`
- **Effect**: Sets the default position of the dual-axis weighting slider on load. Overrides hardcoded default of 50.

### F-27.4 Clear my profile

- **UI**: Destructive button "Clear my profile"
- **Behaviour**: Shows a confirmation dialog ("This will reset your profile, history, and saved products. Are you sure?"). On confirm: clears `foodlens.profile`, `foodlens.favourites`, `foodlens.recentlyViewed`, `foodlens.settings`, `foodlens.onboarding`, `hasSeenOnboarding`. Redirects to fresh app state (as if first visit).
- **Accessibility**: Destructive button must have `aria-describedby` with warning text and `type="button"` (not submit).

---

## Storage schema

```js
// localStorage.foodlens.settings
{
  version: 1,
  unitSystem: 'metric' | 'imperial',
  language: 'en',
  defaultSliderWeight: number,   // 0–100
  createdAt: ISO8601,
  updatedAt: ISO8601
}
```

---

## Acceptance Criteria (AC)

| # | Criterion | Test |
|---|-----------|------|
| AC1 | Settings panel opens from a settings/cog button in the header | Settings icon visible; click opens panel |
| AC2 | Default settings are created on first load (unitSystem: metric, defaultSliderWeight: 50) | Check localStorage after fresh load |
| AC3 | Unit system toggle persists to localStorage on change | Toggle → reload → value retained |
| AC4 | Slider weight persists to localStorage on change | Move slider → reload → value retained |
| AC5 | Clear profile button shows confirmation dialog | Click → confirm dialog appears |
| AC6 | Confirming dialog clears all localStorage keys | Confirm → reload → all keys gone, onboarding reappears |
| AC7 | Cancelling dialog leaves localStorage unchanged | Cancel → localStorage intact |
| AC8 | Settings panel closes on outside click or close button | Test both |
| AC9 | Language dropdown is visible and defaults to English (placeholder for F-33) | Dropdown visible, value 'en', disabled for now |
| AC10 | No console errors during normal settings interactions | Error monitoring |

---

## Design guidelines (from H1–H7 + KI-5)

- **KI-5**: Settings must feel like "you're in control" — avoid alarming language. The "clear" button must use warm-but-clear copy, not aggressive red styling.
- **H1–H7**: Settings do not affect Nutri-Score/Eco-Score display logic. Slider weight (AC4) is the only axis-adjacent setting.
- No data leaves the browser (purely localStorage).
- Mobile-first, consistent with existing FoodLens design language (CSS tokens from style.css).

---

## Files to create/modify

| File | Action |
|------|--------|
| `frontend/js/views/settings.js` | Module — unit conversion, settings state, DOM |
| `frontend/css/settings.css` | Styles |
| `frontend/tests/settings.spec.js` | Playwright tests (AC1–AC10) |
| `frontend/index.html` | Add settings trigger button + settings panel |
| `frontend/js/app.js` | Import settings module, wire settings trigger |
| `docs/feature-backlog.md` | Mark R+D done |

---

## Out of scope

- Actual language switching (F-33)
- Backend integration
- Import/export profile data