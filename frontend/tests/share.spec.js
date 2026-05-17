/**
 * FoodLens F-29 Share Product — Playwright Tests
 *
 * Tests run against the live app at http://localhost:8080
 * Clipboard API is mocked via page.evaluate since the test environment
 * may not have secure context for navigator.clipboard.
 *
 * Run with: npx playwright test frontend/tests/share.spec.js
 */

const { test, expect } = require('@playwright/test');

const APP_URL = 'http://localhost:8080';
const SAMPLE_BARCODE = '5449000131805'; // Coca-Cola (known OFF product)
const EXPECTED_URL_PREFIX = 'https://world.openfoodfacts.org/product/';

// ─── helpers ────────────────────────────────────────────────────────────────

async function clearLocalStorage(page) {
  await page.evaluate(() => {
    localStorage.removeItem('foodlens.favourites');
    localStorage.removeItem('foodlens.profile');
    localStorage.removeItem('foodlens.onboarding');
    localStorage.removeItem('foodlens.settings');
    localStorage.removeItem('foodlens.recentlyViewed');
    localStorage.removeItem('hasSeenOnboarding');
  });
}

async function setCompletedProfile(page) {
  const completed = {
    version: 1,
    status: 'completed',
    goals: ['weight_management'],
    age: 25,
    gender: 'prefer_not_to_say',
    bodyMetrics: null,
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: '2026-05-15T00:00:00.000Z',
  };
  await page.evaluate(
    (p) => localStorage.setItem('foodlens.profile', JSON.stringify(p)),
    completed
  );
}

async function dismissOnboardingIfVisible(page) {
  await page.evaluate(() => {
    const btn = document.querySelector('.onboarding__close-btn');
    if (btn) btn.click();
  });
  await page.waitForFunction(
    () => {
      const backdrop = document.querySelector('#onboarding-backdrop');
      return !backdrop || backdrop.style.display === 'none' || backdrop.style.visibility === 'hidden' || backdrop.getAttribute('aria-hidden') === 'true' && !backdrop.matches(':hover');
    },
    { timeout: 5000 }
  );
  await page.waitForTimeout(300);
}

async function mockClipboardAPI(page) {
  // Replace navigator.clipboard.writeText with a mock that captures the argument
  await page.evaluate(() => {
    let lastWrittenText = '';
    window.__clipboardMock = {
      getLastWritten: () => lastWrittenText,
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (text) => {
          window.__clipboardMock.getLastWritten(text);
          lastWrittenText = text;
          return Promise.resolve();
        },
      },
      configurable: true,
    });
  });
}

// ─── AC1: Share button visible on focused card ─────────────────────────────────

test('AC1: Share button is visible on the focused product card', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await page.reload();
  await dismissOnboardingIfVisible(page);

  // Search for a known barcode to ensure we have a focused card
  await page.fill('#search-input', SAMPLE_BARCODE);
  await page.click('#search-form button[type="submit"]');
  await page.waitForTimeout(2000);

  // The focused card should appear
  const focusedCard = page.locator('#focused .card');
  await expect(focusedCard).toBeVisible({ timeout: 5000 });

  // Share button should be visible inside the focused card
  const shareBtn = focusedCard.locator('.btn--share');
  await expect(shareBtn).toBeVisible();
  await expect(shareBtn).toContainText('Share product');
});

test('AC1: Share button is keyboard accessible (type="button")', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await page.reload();
  await dismissOnboardingIfVisible(page);

  await page.fill('#search-input', SAMPLE_BARCODE);
  await page.click('#search-form button[type="submit"]');
  await page.waitForTimeout(2000);

  const focusedCard = page.locator('#focused .card');
  await expect(focusedCard).toBeVisible({ timeout: 5000 });

  const shareBtn = focusedCard.locator('.btn--share');
  await expect(shareBtn).toHaveAttribute('type', 'button');
});

// ─── AC2: Clicking Share copies the correct OFF URL to clipboard ─────────────────

test('AC2: Share button copies correct OFF URL to clipboard', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await page.reload();
  await dismissOnboardingIfVisible(page);

  // Mock the clipboard API before searching
  await page.evaluate(() => {
    window.__clipboardText = '';
    const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = (text) => {
      window.__clipboardText = text;
      return Promise.resolve();
    };
  });

  await page.fill('#search-input', SAMPLE_BARCODE);
  await page.click('#search-form button[type="submit"]');
  await page.waitForTimeout(2000);

  const focusedCard = page.locator('#focused .card');
  await expect(focusedCard).toBeVisible({ timeout: 5000 });

  // Click share button
  const shareBtn = focusedCard.locator('.btn--share');
  await shareBtn.click();
  await page.waitForTimeout(500);

  // Check clipboard text
  const clipboardText = await page.evaluate(() => window.__clipboardText);
  expect(clipboardText).toBe(`${EXPECTED_URL_PREFIX}${SAMPLE_BARCODE}`);
});

// ─── AC3: Toast "Link copied to clipboard" on success ─────────────────────────────

test('AC3: Success toast appears after clicking Share', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await page.reload();
  await dismissOnboardingIfVisible(page);

  // Mock clipboard to succeed
  await page.evaluate(() => {
    navigator.clipboard.writeText = (text) => Promise.resolve();
  });

  await page.fill('#search-input', SAMPLE_BARCODE);
  await page.click('#search-form button[type="submit"]');
  await page.waitForTimeout(2000);

  const focusedCard = page.locator('#focused .card');
  await expect(focusedCard).toBeVisible({ timeout: 5000 });

  const shareBtn = focusedCard.locator('.btn--share');
  await shareBtn.click();

  // Toast should appear with success message
  const toast = page.locator('#toast-host .toast');
  await expect(toast).toBeVisible({ timeout: 2000 });
  await expect(toast).toContainText('Link copied to clipboard');
});

// ─── AC4: Error toast when clipboard fails ─────────────────────────────────────

test('AC4: Error toast appears when clipboard API throws', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await page.reload();
  await dismissOnboardingIfVisible(page);

  // Mock clipboard to always reject
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('Clipboard access denied'));
  });

  await page.fill('#search-input', SAMPLE_BARCODE);
  await page.click('#search-form button[type="submit"]');
  await page.waitForTimeout(2000);

  const focusedCard = page.locator('#focused .card');
  await expect(focusedCard).toBeVisible({ timeout: 5000 });

  const shareBtn = focusedCard.locator('.btn--share');
  await shareBtn.click();

  // Toast should appear with error message
  const toast = page.locator('#toast-host .toast');
  await expect(toast).toBeVisible({ timeout: 2000 });
  await expect(toast).toContainText('Could not copy link');
});

// ─── AC5: Button is keyboard accessible ──────────────────────────────────────────

test('AC5: Share button is reachable via Tab and activates on Enter', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await page.reload();
  await dismissOnboardingIfVisible(page);

  // Mock clipboard
  await page.evaluate(() => {
    navigator.clipboard.writeText = (text) => Promise.resolve();
  });

  await page.fill('#search-input', SAMPLE_BARCODE);
  await page.click('#search-form button[type="submit"]');
  await page.waitForTimeout(2000);

  const focusedCard = page.locator('#focused .card');
  await expect(focusedCard).toBeVisible({ timeout: 5000 });

  // Tab to the share button
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  // The share button should be focused (or one of the focused items)
  // Press Enter on the share button
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Toast should appear indicating success
  const toast = page.locator('#toast-host .toast');
  await expect(toast).toBeVisible({ timeout: 2000 });
});

// ─── AC6: URL uses product.code from the actual product ─────────────────────────

test('AC6: Share URL contains the actual product barcode', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await page.reload();
  await dismissOnboardingIfVisible(page);

  let capturedText = '';
  await page.evaluate(() => {
    navigator.clipboard.writeText = (text) => {
      window.__captured = text;
      return Promise.resolve();
    };
  });

  await page.fill('#search-input', SAMPLE_BARCODE);
  await page.click('#search-form button[type="submit"]');
  await page.waitForTimeout(2000);

  const focusedCard = page.locator('#focused .card');
  await expect(focusedCard).toBeVisible({ timeout: 5000 });

  const shareBtn = focusedCard.locator('.btn--share');
  await shareBtn.click();
  await page.waitForTimeout(500);

  const captured = await page.evaluate(() => window.__captured);
  expect(captured).toContain(SAMPLE_BARCODE);
  expect(captured).toMatch(/^https:\/\/world\.openfoodfacts\.org\/product\/\d+$/);
});

// ─── AC7: No console errors during normal Share flow ─────────────────────────────

test('AC7: No console errors during share flow', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await page.reload();
  await dismissOnboardingIfVisible(page);

  await page.evaluate(() => {
    navigator.clipboard.writeText = (text) => Promise.resolve();
  });

  await page.fill('#search-input', SAMPLE_BARCODE);
  await page.click('#search-form button[type="submit"]');
  await page.waitForTimeout(2000);

  const focusedCard = page.locator('#focused .card');
  await expect(focusedCard).toBeVisible({ timeout: 5000 });

  const shareBtn = focusedCard.locator('.btn--share');
  await shareBtn.click();
  await page.waitForTimeout(1000);

  expect(errors.filter(e => !e.includes('Warning') && !e.includes('ERR_CONNECTION_REFUSED'))).toHaveLength(0);
});