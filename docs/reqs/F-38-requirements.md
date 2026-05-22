# F-38 · Performance pass requirements

**Owner.** Alejandro Rodriguez Arguimbau

**User story.** As Marc Vidal, I want FoodLens to load quickly so that I can inspect a product without waiting for optional visualisation code.

**Acceptance criteria.**
- AC1: Product images keep lazy loading.
- AC2: Non-critical chart code does not block the first render.
- AC3: The Google Fonts request includes only weights used by the interface.
- AC4: Existing SHAP and scatter chart features still load when opened.
- AC5: The feature does not add a framework, bundler, or backend requirement.

**Out of scope.** CDN self-hosting, image transcoding, and a full Lighthouse certification run in CI.
