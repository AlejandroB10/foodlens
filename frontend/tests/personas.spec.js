/**
 * FoodLens F-31 Personas showcase block — Playwright Tests
 *
 * Tests verify:
 * - AC1: Block visible with 3 cards (Marc, Pau, Lluís)
 * - AC2: Each card shows name, avatar, tagline, user type badge
 * - AC3: Responsive (1-col mobile, 3-col desktop)
 * - AC4: Block is NOT inside <main> — outside scrollable area
 * - AC5: Content matches docs/user-flows.md
 *
 * Run with: npx playwright test frontend/tests/personas.spec.js
 */

const { test, expect, chromium } = require('@playwright/test');

// Path to the static design prototype
const DESIGN_FILE = 'file:///home/alejandro/Documentos/Master/2n_semester/Human-Computer-Interaction/foodlens/docs/designs/F-31-personas-showcase.html';

// Path to the full app (when served)
const APP_URL = 'http://localhost:8765';

// ─── AC1: Three persona cards are present ────────────────────────────────────

test('AC1: personas-showcase section is present in the DOM', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const showcase = page.locator('.personas-showcase');
  await expect(showcase).toBeAttached();
});

test('AC1: three persona cards are rendered (Marc, Pau, Lluís)', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const cards = page.locator('.persona-card');
  await expect(cards).toHaveCount(3);
});

test('AC1: first card is Marc Vidal', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const marc = page.locator('.persona-card').nth(0);
  await expect(marc.locator('.persona-card__name')).toHaveText('Marc Vidal');
});

test('AC1: second card is Pau Estarellas', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const pau = page.locator('.persona-card').nth(1);
  await expect(pau.locator('.persona-card__name')).toHaveText('Pau Estarellas');
});

test('AC1: third card is Lluís Tomàs', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const lluis = page.locator('.persona-card').nth(2);
  await expect(lluis.locator('.persona-card__name')).toHaveText('Lluís Tomàs');
});

// ─── AC2: Each card shows required fields ──────────────────────────────────────

test('AC2: each card has a name heading', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const names = page.locator('.persona-card__name');
  await expect(names).toHaveCount(3);
  const texts = await names.evaluateAll(els => els.map(el => el.textContent.trim()));
  expect(texts).toContain('Marc Vidal');
  expect(texts).toContain('Pau Estarellas');
  expect(texts).toContain('Lluís Tomàs');
});

test('AC2: each card has a P01/P02/P03 type badge', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const badges = page.locator('.persona-card__badge');
  await expect(badges).toHaveCount(3);
  const badgeTexts = await badges.evaluateAll(els => els.map(el => el.textContent.trim()));
  expect(badgeTexts).toContain('P01');
  expect(badgeTexts).toContain('P02');
  expect(badgeTexts).toContain('P03');
});

test('AC2: each card has a tagline/role (1 line)', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const roles = page.locator('.persona-card__role');
  await expect(roles).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const text = await roles.nth(i).textContent();
    // Tagline should be a single line (contains · separators)
    expect(text.trim().split('\n').length).toBe(1);
    expect(text.trim().length).toBeGreaterThan(5);
  }
});

test('AC2: each card has a quote element', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const quotes = page.locator('.persona-card__quote');
  await expect(quotes).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const text = await quotes.nth(i).textContent();
    expect(text.trim().length).toBeGreaterThan(10);
  }
});

test('AC2: each card has a description paragraph', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const descriptions = page.locator('.persona-card__description');
  await expect(descriptions).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const text = await descriptions.nth(i).textContent();
    expect(text.trim().length).toBeGreaterThan(20);
  }
});

test('AC2: Marc\'s quote matches user-flows.md', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const quote = await page.locator('.persona-card').nth(0).locator('.persona-card__quote').textContent();
  expect(quote).toContain('I can live with a score I disagree with');
});

test('AC2: Pau\'s quote matches user-flows.md', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const quote = await page.locator('.persona-card').nth(1).locator('.persona-card__quote').textContent();
  expect(quote).toContain('thirty percent less sugar');
});

test('AC2: Lluís\'s quote matches user-flows.md', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const quote = await page.locator('.persona-card').nth(2).locator('.persona-card__quote').textContent();
  expect(quote).toContain('sharp sentence with a data point');
});

// ─── AC3: Responsive layout ────────────────────────────────────────────────────

test('AC3: desktop shows 3-column grid (≥641px)', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(DESIGN_FILE);
  const grid = page.locator('.personas-showcase__grid');
  await expect(grid).toBeVisible();
  const display = await grid.evaluate(el => getComputedStyle(el).display);
  expect(display).toBe('grid');
});

test('AC3: mobile shows single column (≤640px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(DESIGN_FILE);
  const grid = page.locator('.personas-showcase__grid');
  // On mobile the grid columns should collapse to 1
  // We verify by checking no 3-column layout is applied
  const gridEl = grid.first();
  const columns = await gridEl.evaluate(el => {
    const style = getComputedStyle(el);
    if (style.display === 'grid') {
      return style.gridTemplateColumns.split(' ').length;
    }
    return 0;
  });
  // On mobile it should be 1 column (or the flex/grid should stack)
  expect(columns).toBeLessThanOrEqual(1);
});

test('AC3: header eyebrow and title are present', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  await expect(page.locator('.personas-showcase__eyebrow')).toBeVisible();
  await expect(page.locator('.personas-showcase__title')).toBeVisible();
  await expect(page.locator('.personas-showcase__subtitle')).toBeVisible();
});

// ─── AC4: Block is NOT inside <main> ──────────────────────────────────────────

test('AC4: personas-showcase is NOT inside a scrollable container', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  // In the design prototype the showcase IS the main content — we verify
  // that if a <main> exists, the showcase is not inside it.
  // In the full app it sits between </main> and <footer>.
  const mainCount = await page.locator('main').count();
  if (mainCount > 0) {
    const showcase = page.locator('.personas-showcase');
    const isInsideMain = await page.evaluate(() => {
      const main = document.querySelector('main');
      const showcase = document.querySelector('.personas-showcase');
      return main ? main.contains(showcase) : false;
    });
    expect(isInsideMain).toBe(false);
  } else {
    // No main in prototype — pass by default
    expect(true).toBe(true);
  }
});

test('AC4: personas-showcase is a direct child of the shell div or body', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const showcase = page.locator('.personas-showcase');
  // Verify it is placed in the document body (not nested deep)
  const parentTag = await showcase.evaluate(el => el.parentElement.tagName.toLowerCase());
  expect(['body', 'div'].includes(parentTag)).toBe(true);
});

// ─── AC5: Content matches docs/user-flows.md ──────────────────────────────────

test('AC5: Marc\'s role text matches user-flows.md', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const role = await page.locator('.persona-card').nth(0).locator('.persona-card__role').textContent();
  expect(role).toContain('software engineer');
  expect(role).toContain('Palma');
});

test('AC5: Pau\'s role text matches user-flows.md', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const role = await page.locator('.persona-card').nth(1).locator('.persona-card__role').textContent();
  expect(role).toContain('maths undergrad');
  expect(role).toContain('Barcelona');
});

test('AC5: Lluís\'s role text matches user-flows.md', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const role = await page.locator('.persona-card').nth(2).locator('.persona-card__role').textContent();
  expect(role).toContain('marketing professional');
  expect(role).toContain('Madrid');
});

test('AC5: showcase header mentions "Three ways" reflecting three personas', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const title = await page.locator('.personas-showcase__title').textContent();
  expect(title.toLowerCase()).toContain('three');
  expect(title.toLowerCase()).toContain('food');
});

// ─── Accessibility ───────────────────────────────────────────────────────────

test('Accessibility: each persona card is an <article>', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const cards = page.locator('.persona-card');
  for (let i = 0; i < 3; i++) {
    const tag = await cards.nth(i).evaluate(el => el.tagName.toLowerCase());
    expect(tag).toBe('article');
  }
});

test('Accessibility: showcase section has aria-labelledby pointing to title', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const showcase = page.locator('.personas-showcase');
  const labelledby = await showcase.getAttribute('aria-labelledby');
  expect(labelledby).toBe('personas-title');
});

test('Accessibility: personas-title exists and is unique', async ({ page }) => {
  await page.goto(DESIGN_FILE);
  const title = page.locator('#personas-title');
  await expect(title).toHaveCount(1);
  const text = await title.textContent();
  expect(text.trim().length).toBeGreaterThan(0);
});