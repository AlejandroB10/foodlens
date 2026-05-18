const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './frontend/tests',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  // Serial execution avoids races against the single-threaded
  // `python3 -m http.server 8080` we use as the dev server. Each test still
  // gets its own fresh page context.
  workers: 1,
  fullyParallel: false,
  // One retry absorbs occasional CSS animation / focus timing jitter without
  // hiding a real bug — a flake either disappears on retry or fails twice.
  retries: 1,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
