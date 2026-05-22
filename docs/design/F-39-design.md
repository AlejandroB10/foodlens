# F-39 · Paper-night dark mode design

**Files.**
- `frontend/js/views/settings.js`
- `frontend/css/style.css`
- `frontend/css/settings.css`

**State.** Extend `foodlens.settings` with:

```json
{ "theme": "light" }
```

Allowed values are `"light"` and `"dark"`. Unknown values fall back to `"light"`.

**Theme application.** `loadSettings()` applies `document.documentElement.dataset.theme` immediately. `saveSettings("theme", value)` persists and reapplies the theme. The browser `theme-color` meta tag is updated so installed/PWA chrome follows the selected palette.

**Settings UI.** Add a fourth settings section using the existing segmented-control pattern:

- Paper
- Paper-night

The reset section moves to section 05.

**CSS.** Use `[data-theme="dark"]` variable overrides in `style.css`, not per-component rewrites. Component CSS continues to read from the existing tokens.
