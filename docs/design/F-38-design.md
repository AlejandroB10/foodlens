# F-38 · Performance pass design

**Files.**
- `frontend/index.html`
- `frontend/js/app.js`

**Font request.** Keep the existing three-family typography system, but remove unused weights from the Google Fonts URL:

- Newsreader: 400, 500, italic 400, italic 500
- Bricolage Grotesque: 400, 500, 600, 700
- JetBrains Mono: 400, 500, 600

**Chart loading.** Remove the blocking Chart.js script tag from `index.html`. Load Chart.js only when:

- the SHAP advanced explanation is opened, or
- backend scatter data exists and the scatter plot is rendered.

The loader appends an async script once, memoises the promise, and reuses `window.Chart` afterward.

**Failure mode.** If the chart library fails to load, the app keeps the product card, badges, explanation, and nutrient table visible and shows a short unavailable message in the chart area.
