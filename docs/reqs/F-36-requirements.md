# F-36 · PWA requirements

**Owner.** Alejandro Rodriguez Arguimbau

**User story.** As Marc Vidal, I want FoodLens to be installable and reopen quickly so that I can use the prototype like a lightweight shopping companion.

**Acceptance criteria.**
- AC1: The app exposes a web app manifest with name, short name, theme colour, standalone display mode, start URL, and icon.
- AC2: The static shell is cached by a service worker after first load.
- AC3: `sample_products.json` is cached so the offline fallback still has product data.
- AC4: Navigation requests fall back to `index.html` when offline.
- AC5: The feature does not add a framework, bundler, backend requirement, or install-time dependency.

**Out of scope.** Push notifications, background sync, user accounts, and cross-device persistence.
