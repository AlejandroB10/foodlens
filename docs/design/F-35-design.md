# F-35 · Geolocation-based seasonal hints design

**Files.**
- `frontend/index.html`
- `frontend/css/style.css`
- `frontend/js/app.js`

**Interaction.**
- Render a compact "Seasonal context" banner near the state banners.
- The default state explains that location is optional.
- The user clicks "Use location" to call `navigator.geolocation.getCurrentPosition`.
- The app maps approximate coordinates to a coarse region: Balearic Islands, Spain, Europe, or "your area".
- It maps the current month to a season and displays a one-sentence produce seasonality hint.

**Persistence.** Store the last message and dismissed state in `localStorage.foodlens.seasonalHint`.

**Copy rules.**
- Never moralise.
- Never claim a specific product is imported unless OFF data says so.
- Never alter Nutri-Score or Eco-Score; the hint is contextual only.
