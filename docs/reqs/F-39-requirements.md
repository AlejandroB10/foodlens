# F-39 · Paper-night dark mode requirements

**Owner.** Alejandro Rodriguez Arguimbau

**User story.** As Marc Vidal, I want a low-glare paper-night theme so that FoodLens remains comfortable to use in evening shopping or study contexts without changing the scoring model.

**Acceptance criteria.**
- AC1: Settings includes a visible theme control with light and paper-night options.
- AC2: The selected theme persists under `localStorage.foodlens.settings`.
- AC3: The theme is applied on page load before the user opens Settings.
- AC4: Nutri-Score and Eco-Score badges remain visible and distinguishable in dark mode.
- AC5: The feature uses CSS custom properties and does not add a framework or build step.

**Out of scope.** Automatic OS theme detection and additional colour themes.
