# F-37 Design - WCAG audit and fixes

## Scope

F-37 is a focused accessibility pass over the existing vanilla frontend. It keeps the current editorial visual language and improves semantic markup, focus visibility, keyboard access and contrast.

## Implementation Contract

- Add `axe-core` as a development dependency for WCAG A/AA checks.
- Use a dedicated `--focus-ring` token so focus states are visible in both paper and paper-night themes.
- Darken muted ink in the light theme from `#8C8779` to `#6D675B`, bringing secondary text above AA contrast on paper surfaces.
- Treat scored Nutri/Eco badges as keyboard-activatable controls when they expose methodology tooltips.
- Treat non-interactive score badges in saved/history views as labelled images.
- Add focus traps to modal-like surfaces that did not already keep focus contained.
- Add accessible names to alternative cards, saved/history cards, nutrient table headers and chart canvases.
- Bump the service worker cache version so cached users receive the updated CSS/JS.

## Verification

- Manual Playwright + axe-core check on the loaded home page: 0 WCAG A/AA violations.
- Keyboard check: focus a scored badge, press Enter, verify tooltip opens, press Escape, verify it closes.
- Dialog check: open Settings, press Shift+Tab, verify focus remains inside `#settings-panel`.

## Notes

No backend, API or recommendation contract changed. The changes are presentation and accessibility semantics only.
