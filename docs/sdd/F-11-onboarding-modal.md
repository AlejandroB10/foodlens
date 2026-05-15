# F-11 Onboarding Modal — Software Design Document

## 1. Overview

| Field | Value |
|---|---|
| Feature ID | F-11 |
| Title | Onboarding modal |
| Hook | H6 — Minimal onboarding: goals + age + gender only |
| Personas | Marc Vidal, Pau Estarellas |
| Priority | P1 |
| Dependencies | F-01 Bootstrap base layout |
| Implementation | Vanilla HTML, CSS, JavaScript — no framework, no build step |

## 2. Module Responsibilities

The onboarding module (`frontend/js/onboarding.js`) owns the first-visit modal experience. It:

- Detects whether the user has completed or skipped onboarding via `localStorage`.
- Renders a 3-step modal with a visible skip action on every step.
- Persists the user profile under the `foodlens.profile` key.
- Exposes a minimal public API (`init`, `show`, `hide`, `isCompleted`, `getProfile`, `clearProfile`) for integration with `app.js`.
- Never blocks the user — skip is always available.
- Never sends data to Open Food Facts or any backend.

## 3. Exported Functions

All functions live in `frontend/js/onboarding.js` and are imported by name.

### `init(onComplete?: () => void): void`
Initialises the module. Reads `foodlens.profile` from `localStorage`. If the profile is missing or invalid, calls `show()`. If a callback is provided it is stored and invoked after the user completes or skips the modal — allowing `app.js` to resume its own initialisation (e.g. running a default search).

### `show(): void`
Appends the modal backdrop and step-1 section to `document.body` and sets focus to the first interactive element. Sets `aria-hidden="true"` on the main app content.

### `hide(): void`
Removes the modal backdrop and all step sections from the DOM. Restores `aria-hidden` on main content. Returns focus to the trigger element (or `<body>`).

### `isCompleted(): boolean`
Returns `true` if `localStorage` contains a `foodlens.profile` entry with `status === "completed"` or `status === "skipped"`. Returns `false` for missing, null, or malformed entries.

### `getProfile(): Profile | null`
Parses and returns the current `foodlens.profile` value, or `null` if absent or malformed. Does not throw.

### `clearProfile(): void`
Deletes the `foodlens.profile` key from `localStorage`. Used exclusively in development / testing.

---

## 4. localStorage Schema

| Key | Value |
|---|---|
| `foodlens.profile` | JSON object (see below) |

### Profile object (completed)

```json
{
  "version": 1,
  "status": "completed",
  "goals": ["weight_management", "eco_priorities"],
  "age": 25,
  "gender": "prefer_not_to_say",
  "bodyMetrics": {
    "heightCm": 172,
    "weightKg": 68
  },
  "createdAt": "2026-05-15T00:00:00.000Z",
  "updatedAt": "2026-05-15T00:00:00.000Z"
}
```

### Profile object (skipped at step 1 or 2)

```json
{
  "version": 1,
  "status": "skipped",
  "goals": [],
  "age": null,
  "gender": null,
  "bodyMetrics": null,
  "createdAt": "2026-05-15T00:00:00.000Z",
  "updatedAt": "2026-05-15T00:00:00.000Z"
}
```

### Field constraints

| Field | Type | Constraints |
|---|---|---|
| `version` | integer | Always `1` |
| `status` | string | `"completed"` or `"skipped"` |
| `goals` | string[] | Zero or more of: `"weight_management"`, `"dietary_preferences"`, `"eco_priorities"` |
| `age` | integer or `null` | Whole number 13–120; `null` when skipped |
| `gender` | string or `null` | `"female"`, `"male"`, `"non_binary"`, `"prefer_not_to_say"`, or `null` when skipped |
| `bodyMetrics.heightCm` | integer or `null` | Whole number 100–250; `null` when skipped or incomplete |
| `bodyMetrics.weightKg` | integer or `null` | Whole number 30–250; `null` when skipped or incomplete |
| `createdAt` | ISO 8601 string | Set on first persistence |
| `updatedAt` | ISO 8601 string | Updated on every save |

**Error handling:** If `localStorage` is unavailable or `JSON.parse` throws, the module catches the error and continues without persisting. The profile is treated as unsaved for that session. Malformed JSON in storage causes `isCompleted()` to return `false` so the modal re-appears.

## 5. Step Navigation

The modal has exactly 3 steps. Progress is shown with 3 bar indicators at the top of the modal.

### Step 1 — Goals (multi-select)

- **Heading:** "What brings you here?"
- **Subtitle:** "Select all that apply. You can skip this entirely."
- **Fields:** 3 checkbox cards — `weight_management`, `dietary_preferences`, `eco_priorities`.
- **Validation:** None; empty selection is valid.
- **Navigation:** "Skip for now" → save `status: "skipped"` and call `hide()`. "Continue" → advance to Step 2.

### Step 2 — Age + Gender

- **Heading:** "Help us personalise your view"
- **Subtitle:** "All fields are optional — skip anytime."
- **Fields:**
  - `age` — number input, `min="13"`, `max="120"`, `inputmode="numeric"`. Inline error if value is out of range: "Enter a whole number between 13 and 120".
  - `gender` — radio group: `female`, `male`, `non_binary`, `prefer_not_to_say`.
- **Validation:** Age is validated on input; invalid values show the error message and apply `.has-error` class. No data is guessed or inferred.
- **Navigation:** "Skip for now" → save `status: "skipped"` and call `hide()`. "Continue" → advance to Step 3.

### Step 3 — Body Metrics (optional)

- **Heading:** "One more thing"
- **Subtitle:** "Optional — helps us scale calorie context."
- **Rationale box:** "We use this to scale calorie ranges. You can skip it." — styled as a left-accent callout (`.rationale`).
- **Fields:**
  - `heightCm` — number input, `min="100"`, `max="250"`.
  - `weightKg` — number input, `min="30"`, `max="250"`.
- **Validation:** Inline errors identical to Step 2 pattern.
- **Navigation:** "Skip for now" → save `status: "completed"` with `bodyMetrics: null` and call `hide()`. "Finish" → save `status: "completed"` with all collected values and call `hide()`.

### Close button

Each step header contains a close button (×). Its behaviour is identical to "Skip for now" — it saves the current progress as `status: "skipped"` if no required fields are complete, or as `status: "completed"` if only Step 3 is pending.

## 6. Accessibility Requirements

- The modal backdrop has `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` referencing the step heading.
- Each step `<section>` has a unique `aria-label` (e.g., `"Step 1: Your goals"`).
- Focus is moved to the first focusable element inside the modal on open; returned to the trigger element (or `<body>`) on close.
- All form controls have associated `<label>` elements.
- Radio groups use `<fieldset>` + `<legend>`.
- The rationale box has `role="note"`.
- Error messages use `role="alert"` and are shown/hidden via CSS (`.has-error + .field__error { display: block }`).
- Skip and primary buttons are always visible and keyboard-accessible.
- The modal is appended to `document.body` to avoid z-index or overflow issues.
- If `localStorage` is unavailable the modal still renders and functions; persistence silently fails.

## 7. Integration with app.js

### Module initialisation

In `frontend/js/app.js`, import and call `onboarding.init()` before any other user-facing render:

```js
import { init as initOnboarding } from './onboarding.js';

// After state is loaded, before showing UI
initOnboarding(() => {
  // optional: run a default search once onboarding is resolved
  runSearch('');
});
```

The callback fires when the user completes, skips, or closes the modal. If the profile is already present, the callback is not called and the app proceeds immediately.

### Profile consumption

Other modules may call `getProfile()` to read the stored profile synchronously. This is read-only; there is no profile editor in F-11.

### Show-once enforcement

`app.js` does not need to track whether to show the modal — `onboarding.init()` handles this internally. Calling `show()` directly is only used by `init()`.

## 8. File Structure

```
frontend/js/
  onboarding.js   # module implementation (this SDD)
  app.js         # imports onboarding; wires main app
```

The modal markup is embedded directly in `onboarding.js` (no separate HTML file dependency at runtime). The design prototype in `frontend/design/F-11-onboarding-modal.html` is a reference for visual/layout verification only and is not loaded at runtime.

## 9. Acceptance Criteria Checklist

| ID | Criterion |
|---|---|
| AC1 | On a browser with no `foodlens.profile` key, the modal opens on first page load |
| AC2 | Goals are presented as a multi-select with at least `weight_management`, `dietary_preferences`, `eco_priorities` |
| AC3 | Age is collected with numeric validation (13–120) and inline error feedback |
| AC4 | Gender is a radio group with a visible **Prefer not to say** option |
| AC5 | Optional body metrics are on a separate step with a rationale explaining calorie-range scaling |
| AC6 | The user can skip any step and still reach the main app flow |
| AC7 | Completing onboarding saves JSON to `localStorage` under `foodlens.profile` with `status: "completed"` |
| AC8 | Skipping required-field steps saves JSON to `localStorage` under `foodlens.profile` with `status: "skipped"` |
| AC9 | After completion or skip, reloading the page does not show the modal again |
| AC10 | Malformed stored profile JSON does not crash the app; the modal is shown again |
| AC11 | The modal asks no lifestyle questions (income, family status, exercise, schedule, cooking time, budget) |
| AC12 | The feature uses vanilla HTML, CSS, and JavaScript only |

## 10. Constraints

- H6 Minimal onboarding: goals, age, and gender only; body metrics optional with inline rationale.
- Must not moralise in copy (avoid "you should", "unhealthy", etc.).
- Must not invent or derive health values from profile data.
- Must not send profile data to Open Food Facts or any backend in F-11.
- Out of scope: settings page, profile editing post-onboarding, language preferences, unit-system preferences, recommender weighting, product comparison behaviour.