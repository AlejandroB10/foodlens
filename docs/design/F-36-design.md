# F-36 · PWA design

**Files.**
- `frontend/manifest.webmanifest`
- `frontend/sw.js`
- `frontend/index.html`
- `frontend/js/app.js`

**Manifest.** Use `display: "standalone"`, `start_url: "./index.html"`, `scope: "./"`, and the existing SVG favicon as a scalable icon. The paper-toned theme colour matches the current UI background.

**Service worker strategy.**
- Install: pre-cache the static shell, CSS, JS modules, favicon, manifest, and `data/sample_products.json`.
- Activate: delete old FoodLens caches and claim clients.
- Fetch:
  - Same-origin navigation requests use network first, then cached `index.html`.
  - Same-origin static assets use cache first, then network and runtime cache.
  - Cross-origin requests, including Open Food Facts and CDNs, stay untouched.

**Why.** The prototype remains frontend-only and works with any static server while becoming installable in Chrome and Edge.
