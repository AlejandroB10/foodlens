# F-35 · Geolocation-based seasonal hints requirements

**Owner.** Alejandro Rodriguez Arguimbau

**User story.** As Lluís Tomàs, I want optional seasonal context based on my approximate location so that Eco-Score gaps feel contextual rather than moralising.

**Acceptance criteria.**
- AC1: The page shows a seasonal context banner without requesting location automatically.
- AC2: Geolocation permission is requested only after the user clicks the location button.
- AC3: A successful location lookup shows a short local seasonality hint.
- AC4: Denied or unavailable geolocation keeps the app usable and shows a graceful message.
- AC5: The hint does not invent product-specific data or recalculate Eco-Score.

**Out of scope.** Real-time supermarket inventory, exact farm origin, and changing any product ranking based on geolocation.
