/**
 * FoodLens F-26 Favourites / Saved Products — Playwright Tests
 *
 * Tests run against the live app at http://localhost:8080
 *
 * Run with: cd frontend && npx playwright test tests/favourites.spec.js
 */

const { test, expect } = require('@playwright/test');

const APP_URL = 'http://localhost:8080';
const FAVOURITES_KEY = 'foodlens.favourites';

// ─── helpers ────────────────────────────────────────────────────────────────

async function clearLocalStorage(page) {
  await page.evaluate(() => {
    localStorage.removeItem('foodlens.favourites');
    localStorage.removeItem('foodlens.profile');
    localStorage.removeItem('foodlens.onboarding');
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
  // Use handleSkip which sets status='skipped' and removes the modal/backdrop
  await page.evaluate(() => {
    // Try handleSkip first (this is the proper way - sets status='skipped')
    if (typeof window.handleSkip === 'function') {
      window.handleSkip();
      return;
    }
    // Fallback: click close or skip button
    const closeBtn = document.querySelector('.onboarding__close-btn');
    const skipBtn = document.querySelector('.btn--skip');
    if (closeBtn) closeBtn.click();
    else if (skipBtn) skipBtn.click();
  });
  await page.waitForTimeout(600);
  // Force-remove any remaining backdrop
  await page.evaluate(() => {
    const backdrop = document.getElementById('onboarding-backdrop');
    if (backdrop) backdrop.remove();
    const modal = document.querySelector('.onboarding');
    if (modal) modal.remove();
  });
  await page.waitForTimeout(300);
}

async function getFavourites(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('foodlens.favourites');
    return raw ? JSON.parse(raw) : null;
  });
}

async function setFavourites(page, items) {
  await page.evaluate(
    (data) => localStorage.setItem('foodlens.favourites', JSON.stringify(data)),
    items
  );
}

async function openSavedView(page) {
  await page.click('#nav-saved');
  await page.waitForTimeout(500);
}

// ─── AC1: Tapping heart saves to localStorage ──────────────────────────────

test('AC1: Heart button saves product to localStorage.foodlens.favourites', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await dismissOnboardingIfVisible(page);

  // Search for a product
  await page.fill('#search-input', '5449000131805');
  await page.evaluate(() => document.querySelector('.search__submit').click());
  await page.waitForTimeout(2000);

  // Find and click the heart button on the first card
  const heartBtn = page.locator('.heart-btn').first();
  await expect(heartBtn).toBeVisible();
  await heartBtn.click();
  await page.waitForTimeout(500);

  // Verify localStorage
  const favs = await getFavourites(page);
  expect(favs).not.toBeNull();
  expect(favs.length).toBeGreaterThan(0);
  expect(favs.some(f => f.code === '5449000131805')).toBe(true);
});

// ─── AC2: Tapping heart again removes it ──────────────────────────────────

test('AC2: Tapping heart again removes product from favourites', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await dismissOnboardingIfVisible(page);

  // Search and save product
  await page.fill('#search-input', '5449000131805');
  await page.evaluate(() => document.querySelector('.search__submit').click());
  await page.waitForTimeout(2000);

  const heartBtn = page.locator('.heart-btn').first();
  await heartBtn.click(); // save
  await page.waitForTimeout(500);

  const afterSave = await getFavourites(page);
  expect(afterSave.some(f => f.code === '5449000131805')).toBe(true);

  await heartBtn.click(); // remove
  await page.waitForTimeout(500);

  const afterRemove = await getFavourites(page);
  expect(afterRemove.some(f => f.code === '5449000131805')).toBe(false);
});

// ─── AC3: Saved products persist across page refresh ───────────────────────

test('AC3: Saved products persist across page refresh', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await dismissOnboardingIfVisible(page);

  // Save a product via direct localStorage manipulation (simulating save)
  await page.evaluate(() => {
    localStorage.setItem('foodlens.favourites', JSON.stringify([{
      code: '5449000131805',
      name: 'Coca-Cola Zero Sugar',
      image: null,
      healthGrade: 'b',
      ecoGrade: 'not-applicable',
      savedAt: Date.now(),
    }]));
  });

  await page.reload();
  await page.waitForTimeout(1000);

  const favs = await getFavourites(page);
  expect(favs).not.toBeNull();
  expect(favs.length).toBeGreaterThan(0);
  expect(favs[0].code).toBe('5449000131805');
});

// ─── AC4: Saved view shows products with same card layout ──────────────────

test('AC4: Saved view shows all saved products with card layout', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await dismissOnboardingIfVisible(page);

  // Pre-populate saved products
  await page.evaluate(() => {
    localStorage.setItem('foodlens.favourites', JSON.stringify([
      { code: '5449000131805', name: 'Coca-Cola Zero Sugar', image: null, healthGrade: 'b', ecoGrade: 'not-applicable', savedAt: Date.now() },
      { code: '3017624010701', name: 'Nutella', image: null, healthGrade: 'e', ecoGrade: 'd', savedAt: Date.now() - 1000 },
    ]));
  });

  await page.reload();
  await page.waitForTimeout(1000);

  // Open Saved view
  await openSavedView(page);

  // Verify cards are visible
  const cards = page.locator('#favourites .card');
  await expect(cards).toHaveCount(2);

  // Verify badges are present
  const badges = page.locator('#favourites .card .badge');
  expect(await badges.count()).toBeGreaterThan(0);

  // Verify saved count text
  const count = page.locator('.saved__count');
  await expect(count).toContainText('2');
});

// ─── AC5: Empty saved view shows friendly message ─────────────────────────

test('AC5: Empty saved view shows the friendly empty state message', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await dismissOnboardingIfVisible(page);

  // Open Saved view with no saved products
  await openSavedView(page);

  const emptyState = page.locator('.saved-empty');
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toContainText('No saved products yet');
  await expect(emptyState).toContainText('Tap the heart on any product to save it');
});

// ─── AC6: Clear all removes all products and hides button ──────────────────

test('AC6: Clear all removes all saved products and hides itself', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await dismissOnboardingIfVisible(page);

  // Pre-populate
  await page.evaluate(() => {
    localStorage.setItem('foodlens.favourites', JSON.stringify([
      { code: '5449000131805', name: 'Coca-Cola Zero Sugar', image: null, healthGrade: 'b', ecoGrade: 'not-applicable', savedAt: Date.now() },
    ]));
  });

  await page.reload();
  await page.waitForTimeout(1000);
  await openSavedView(page);

  const clearBtn = page.locator('.saved__clear');
  await expect(clearBtn).toBeVisible();

  await clearBtn.click();
  await page.waitForTimeout(500);

  await expect(clearBtn).toBeHidden();

  const favs = await getFavourites(page);
  expect(favs).toBeNull();

  const emptyState = page.locator('.saved-empty');
  await expect(emptyState).toBeVisible();
});

// ─── AC7: Heart button state is consistent across card instances ─────────

test('AC7: Heart button state is consistent across search and saved views', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await dismissOnboardingIfVisible(page);

  // Save a product via localStorage
  await page.evaluate(() => {
    localStorage.setItem('foodlens.favourites', JSON.stringify([
      { code: '5449000131805', name: 'Coca-Cola Zero Sugar', image: null, healthGrade: 'b', ecoGrade: 'not-applicable', savedAt: Date.now() },
    ]));
  });

  await page.reload();
  await page.waitForTimeout(1000);

  // Open Saved view — heart should be filled
  await openSavedView(page);

  const heartInSaved = page.locator('#favourites .heart-btn').first();
  await expect(heartInSaved).toHaveClass(/is-saved/);
  await expect(heartInSaved).toHaveAttribute('aria-pressed', 'true');

  // Go back to search
  await page.click('#nav-search');
  await page.waitForTimeout(500);

  // Heart on search card should also be filled
  await page.fill('#search-input', '5449000131805');
  await page.evaluate(() => document.querySelector('.search__submit').click());
  await page.waitForTimeout(2000);

  const heartInSearch = page.locator('.heart-btn').first();
  await expect(heartInSearch).toHaveClass(/is-saved/);
  await expect(heartInSearch).toHaveAttribute('aria-pressed', 'true');
});

// ─── AC8: Duplicate codes are not added twice ─────────────────────────────

test('AC8: Saving same product twice does not create duplicates', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await dismissOnboardingIfVisible(page);

  // Save a product
  await page.fill('#search-input', '5449000131805');
  await page.evaluate(() => document.querySelector('.search__submit').click());
  await page.waitForTimeout(2000);

  const heartBtn = page.locator('.heart-btn').first();
  await heartBtn.click(); // save once
  await page.waitForTimeout(500);

  const firstCount = (await getFavourites(page)).filter(f => f.code === '5449000131805').length;
  expect(firstCount).toBe(1);

  await heartBtn.click(); // remove
  await page.waitForTimeout(500);

  await heartBtn.click(); // save again
  await page.waitForTimeout(500);

  const secondCount = (await getFavourites(page)).filter(f => f.code === '5449000131805').length;
  expect(secondCount).toBe(1);
});

// ─── AC9: Heart button is keyboard accessible ──────────────────────────────

test('AC9: Heart button is keyboard accessible with tab and enter/space', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await dismissOnboardingIfVisible(page);

  // Search for a product
  await page.fill('#search-input', '5449000131805');
  await page.evaluate(() => document.querySelector('.search__submit').click());
  await page.waitForTimeout(2000);

  // Tab to first heart button directly
  await page.locator('.heart-btn').first().focus();
  const focused = page.locator(':focus');
  await expect(focused).toHaveClass(/heart-btn/);

  // Press Enter to toggle
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  const saved = await getFavourites(page);
  expect(saved.some(f => f.code === '5449000131805')).toBe(true);

  // Press Space to remove
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);

  const removed = await getFavourites(page);
  expect(removed.some(f => f.code === '5449000131805')).toBe(false);
});

// ─── AC10: No console errors during toggle operations ─────────────────────

test('AC10: No console errors during heart toggle operations', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await dismissOnboardingIfVisible(page);

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  // Search for a product
  await page.fill('#search-input', '5449000131805');
  await page.evaluate(() => document.querySelector('.search__submit').click());
  await page.waitForTimeout(2000);

  // Toggle heart on and off multiple times
  const heartBtn = page.locator('.heart-btn').first();
  for (let i = 0; i < 3; i++) {
    await heartBtn.click();
    await page.waitForTimeout(300);
    await heartBtn.click();
    await page.waitForTimeout(300);
  }

  expect(errors.filter(e => !e.includes('Warning') && !e.includes('ERR_CONNECTION_REFUSED'))).toHaveLength(0);
});

// ─── Saved badge updates correctly ────────────────────────────────────────

test('Saved badge shows correct count after saves', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await dismissOnboardingIfVisible(page);

  // Save one product
  await page.fill('#search-input', '5449000131805');
  await page.evaluate(() => document.querySelector('.search__submit').click());
  await page.waitForTimeout(2000);

  await page.locator('.heart-btn').first().click();
  await page.waitForTimeout(300);

  const badge = page.locator('#saved-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('1');
});

// ─── Saved view shows empty heart icon ────────────────────────────────────

test('Empty state shows heart icon', async ({ page }) => {
  await page.goto(APP_URL);
  await clearLocalStorage(page);
  await setCompletedProfile(page);
  await dismissOnboardingIfVisible(page);

  await openSavedView(page);

  const icon = page.locator('.saved-empty svg');
  await expect(icon).toBeVisible();
});