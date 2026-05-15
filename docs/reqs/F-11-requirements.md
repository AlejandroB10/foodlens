# F-11 Requirements — Onboarding Modal

F-11 adds a first-visit onboarding modal that captures only the profile fields needed for lightweight personalisation. It satisfies H6 by asking for goals, age, and gender, while keeping body metrics optional and skippable so Marc can reach the product flow quickly and Pau still has explicit data boundaries.

## Feature summary

| Field | Value |
|---|---|
| Feature ID | F-11 |
| Title | Onboarding modal |
| Hook | H6 — Minimal onboarding: goals + age + gender only |
| Persona | Marc Vidal, Pau Estarellas |
| Priority | P1 |
| Dependencies | F-01 Bootstrap base layout |
| Branch | `feat/F-11-onboarding-modal` |
| Commit convention | `feat(F-11): add requirements for onboarding modal` |

## User stories

1. As **Marc Vidal**, on my first visit I want a short modal that asks only for goals, age, and gender so that I can start using FoodLens without configuring a full lifestyle profile.
2. As **Marc Vidal**, I want to skip onboarding at any step so that the app never blocks me from searching products.
3. As **Pau Estarellas**, I want the modal to make clear which profile values are saved so that I can trust the recommendation context and inspect assumptions later.
4. As **Pau Estarellas**, I want optional body metrics to include a short rationale so that I understand why the app asks and can still decline.
5. As a first-time user, I want gender to include **Prefer not to say** so that I can complete the flow without sharing a gender value.

## First-visit flow

1. App loads after F-01 base layout is available.
2. The onboarding module checks `localStorage` key `foodlens.profile`.
3. If there is no saved profile or skip marker, the modal opens before normal interaction but keeps a visible skip action.
4. Step 1 asks for goals as a multi-select field.
5. Step 2 asks for age and gender.
6. Step 3 asks for optional body metrics with an inline rationale and a skip action.
7. Submit or skip writes `foodlens.profile` so the modal is not shown again on subsequent visits.
8. Future visits read the stored profile silently and continue to the normal app flow.

## Detailed requirements

### Fields

| Field | Required | Input type | Allowed values / validation | Notes |
|---|---:|---|---|---|
| `goals` | Yes to complete; empty allowed when skipped | Multi-select chips / checkboxes | `weight_management`, `dietary_preferences`, `eco_priorities` | More than one can be selected. No ranking required in F-11. |
| `age` | Yes to complete; omitted when skipped | Number input | Whole number from 13 to 120 | Invalid values show inline error text. Do not infer or guess age. |
| `gender` | Yes to complete; omitted when skipped | Radio group | `female`, `male`, `non_binary`, `prefer_not_to_say` | `prefer_not_to_say` must be visible as a first-class choice. |
| `bodyMetrics.heightCm` | No | Number input | Whole number from 100 to 250 | Optional second step only. |
| `bodyMetrics.weightKg` | No | Number input | Whole number from 30 to 250 | Optional second step only. |

The optional body metrics step must include this rationale or equivalent non-moralising copy: **"We use this to scale calorie ranges. You can skip it."**

### Persistence

- Store profile data in `localStorage` under exactly the key `foodlens.profile`.
- Store JSON only; do not create additional keys for this feature.
- Suggested stored shape:

```json
{
  "version": 1,
  "status": "completed",
  "goals": ["weight_management", "eco_priorities"],
  "age": 25,
  "gender": "prefer_not_to_say",
  "bodyMetrics": {
    "heightCm": null,
    "weightKg": null
  },
  "createdAt": "2026-05-15T00:00:00.000Z",
  "updatedAt": "2026-05-15T00:00:00.000Z"
}
```

- If the user skips before required fields are complete, persist a minimal marker so show-once behavior still works:

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

- If only the optional body metrics step is skipped, persist the completed required fields and set `bodyMetrics` to `null`.
- If `localStorage` is unavailable or full, the app must continue without crashing and should treat the profile as unsaved for that session.
- Do not send profile data to Open Food Facts or any backend in F-11.

### Show-once behavior

- On first visit, show the modal only when `foodlens.profile` is missing or invalid.
- On later visits, do not reopen onboarding when `status` is `completed` or `skipped`.
- If stored JSON is malformed, ignore it and show onboarding again rather than throwing an error.
- Closing, completing, or skipping the modal must return focus to the main FoodLens flow.

### Skip behavior

- A skip action must be visible on every step.
- Skipping Step 1 or Step 2 saves `status: "skipped"` with null or empty values.
- Skipping Step 3 saves `status: "completed"` with required values and `bodyMetrics: null`.
- Skip copy must be neutral, e.g. **"Skip for now"**. Do not use guilt-based or health-judgement language.

## Acceptance criteria

1. **AC1:** On a browser with no `foodlens.profile` key, the onboarding modal opens on first page load.
2. **AC2:** Goals are presented as a multi-select with at least weight management, dietary preferences, and eco priorities.
3. **AC3:** Age is collected with numeric validation and invalid values show inline feedback without saving guessed data.
4. **AC4:** Gender is a radio group and includes a visible **Prefer not to say** option.
5. **AC5:** Optional body metrics are on a separate optional step with a rationale explaining calorie-range scaling.
6. **AC6:** The user can skip any step and still reach the main app flow.
7. **AC7:** Completing onboarding saves JSON to `localStorage` under `foodlens.profile` with `status: "completed"`.
8. **AC8:** Skipping required-field steps saves JSON to `foodlens.profile` with `status: "skipped"`.
9. **AC9:** After completion or skip, reloading the page does not show the modal again.
10. **AC10:** Malformed stored profile JSON does not crash the app; the modal is shown again.
11. **AC11:** The modal asks no lifestyle questions such as income, family status, exercise habits, schedule, cooking time, or shopping budget.
12. **AC12:** The feature is implemented with vanilla HTML, CSS, and JavaScript only, with no framework, bundler, or build step.

## Constraints and out of scope

- Must satisfy **H6 Minimal onboarding**: goals, age, and gender only; body metrics are optional with inline rationale.
- Must not ask lifestyle questions.
- Must not moralise in copy; avoid phrases like "you should" or "unhealthy".
- Must use vanilla HTML/CSS/JS and the existing static frontend architecture.
- Must not add React, Tailwind, a backend dependency, a build step, or a bundler.
- Must not invent or derive health values from profile data in F-11.
- Out of scope: settings page, editing profile after onboarding, language preferences, unit-system preferences, recommender weighting, and product comparison behavior.
