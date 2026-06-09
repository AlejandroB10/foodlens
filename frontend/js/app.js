// FoodLens entrypoint. Wires the DOM to the api, xai and rendering layers.
// Keeps state in a single object that survives the session via localStorage.

import {
  getProductByBarcode,
  searchProducts,
  getAllSampleProducts,
  getCatalogProducts,
  getAlternativesFromBackend,
  getExplainFromBackend,
  getCategoryScatter,
  postTelemetryEvent,
  getProductIngredients,
} from './api.js';
import {
  generateContrastiveSentence,
  buildCategoryAverageReference,
  weightedNutrientDistance,
  formatAlternativeDelta,
} from './xai.js';
import { init as initOnboarding } from './views/onboarding.js';
import { trackView, renderRecentlyViewed, loadRecentlyViewed, startBootstrap, endBootstrap, RECENTLY_VIEWED_KEY } from './views/history.js';
import { loadSettings as _loadSettings, show as showSettings, toggleTheme, getTheme } from './views/settings.js';
import { init as initTooltips } from './views/tooltips.js';
import { toggleFavourite, isFavourite, getFavourites, renderFavourites, buildHeartButton, clearFavourites } from './views/favourites.js';
import { initCategoryBrowser } from './views/categories.js';
import { initFilters } from './views/filters.js';
import { toggleProductSelection, renderComparisonView } from './views/comparison.js';
import { initI18n, setLang, t } from './views/i18n.js';

const STORAGE_KEY = 'foodlens.state';
const SEASONAL_HINT_KEY = 'foodlens.seasonalHint';
// Page size for the catalogue/category listing: fetch (and draw) this many cards
// per page; "Load more" appends another page. Kept small (20) so the listing is
// digestible; the full catalogue stays reachable via Load more / search / chips.
const CATALOG_RENDER_CAP = 20;
const ZXING_BROWSER_URL = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm';
const CHART_JS_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
const DEFAULT_STATE = {
  healthWeight: 70,
  preset: 'balanced',
};

const NUTRI_COLORS = {
  a: 'var(--color-nutri-a)',
  b: 'var(--color-nutri-b)',
  c: 'var(--color-nutri-c)',
  d: 'var(--color-nutri-d)',
  e: 'var(--color-nutri-e)',
  unknown: 'var(--color-grade-na)',
  'not-applicable': 'var(--color-grade-na)',
};

const ECO_COLORS = {
  a: 'var(--color-eco-a)',
  b: 'var(--color-eco-b)',
  c: 'var(--color-eco-c)',
  d: 'var(--color-eco-d)',
  e: 'var(--color-eco-e)',
  unknown: 'var(--color-grade-na)',
  'not-applicable': 'var(--color-grade-na)',
};

const GRADE_LABELS = {
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
  e: 'E',
  unknown: '?',
  'not-applicable': '—',
};

// F-18: usual products are stored PER CATEGORY inside the onboarding profile
// object (foodlens.profile) under a `usualByCategory` map, so a usual cola is
// only ever compared against other colas. The legacy single global key
// (foodlens.usualProduct) is migrated on first read.
const PROFILE_KEY = 'foodlens.profile';
const LEGACY_USUAL_PRODUCT_KEY = 'foodlens.usualProduct';

const state = loadState();
let lastResults = [];
let focusedProduct = null;
let currentFilters = [];

// ─── listing pagination (universal "Load more") ───────────────────────
// Source-aware model so EVERY paginable listing can offer "Load more", not
// only the catalogue. The active `listingSource` decides how the next page is
// fetched and when the button hides:
//   'catalogue' → getCatalogProducts({ offset })            (exact total)
//   'category'  → getCatalogProducts({ category, offset })  (exact total)
//   'search'    → searchProducts(query, { page })           (no total; infer)
//   null/barcode → never paginates (single or sample result set).
const OFF_PAGE_SIZE = 20; // mirrors searchProducts default pageSize
let listingSource = null; // null | 'catalogue' | 'category' | 'search'
let listingOffset = 0; // products already loaded (index sources)
let listingTotal = 0; // exact total for index sources
let listingCategory = null; // the en:* tag when source === 'category'
let listingQuery = ''; // free-text query when source === 'search'
let listingIngredient = ''; // ingredient filter carried into 'search' paging
let listingCategoryTag = ''; // category tag carried into 'search' paging (OFF fallback)
let listingPage = 1; // OFF page number for source === 'search'
let listingHasMore = false; // authoritative "show button?" flag for 'search'
let loadingMore = false; // re-entrancy guard while a page is in flight

// ─── telemetry (F-45) ──────────────────────────────────────────────────

const TELEMETRY_KEY = 'foodlens.telemetry_opt_in';

const telemetry = {
  isOptedIn() {
    return localStorage.getItem(TELEMETRY_KEY) === 'true';
  },
  optIn() {
    localStorage.setItem(TELEMETRY_KEY, 'true');
  },
  optOut() {
    localStorage.setItem(TELEMETRY_KEY, 'false');
  },
  send(payload) {
    if (!this.isOptedIn()) return;
    postTelemetryEvent(payload);
  },
};

// Timestamp set when search completes — used to compute decision_time.
let _searchCompletedAt = null;

// True for ONE rerenderFocused pass triggered by a fresh in-app focusProduct
// click — gates the scrollIntoView so it never yanks the viewport on a
// deep-link/back-forward restore (where we want top-of-view instead).
let _focusedShouldScroll = false;

// Monotonic request token. Each runSearch call claims the next epoch; only the
// latest claimant is allowed to commit results. This makes concurrent searches
// last-CALL-wins (the user's most recent action) instead of last-RESOLVE-wins,
// so a slow initial catalogue load can never clobber a freshly clicked category
// shelf (or vice versa).
let _searchEpoch = 0;

// ─── DOM lookups ──────────────────────────────────────────────────────

const els = {
  searchForm: document.querySelector('#search-form'),
  searchInput: document.querySelector('#search-input'),
  ingredientInput: document.querySelector('#ingredient-input'),
  resultsRegion: document.querySelector('#results'),
  resultsList: document.querySelector('#results-list'),
  resultsCount: document.querySelector('#results-count'),
  loadMore: document.querySelector('#results-more'),
  sourceBadge: document.querySelector('#source-badge'),
  seasonalHint: document.querySelector('#seasonal-hint'),
  seasonalHintText: document.querySelector('#seasonal-hint-text'),
  seasonalHintEnable: document.querySelector('#seasonal-hint-enable'),
  seasonalHintDismiss: document.querySelector('#seasonal-hint-dismiss'),
  weightSlider: document.querySelector('#weight-slider'),
  weightHealthLabel: document.querySelector('#weight-health-label'),
  weightEcoLabel: document.querySelector('#weight-eco-label'),
  presetButtons: document.querySelectorAll('[data-preset]'),
  focusedView: document.querySelector('#focused'),
  emptyState: document.querySelector('#empty-state'),
  loading: document.querySelector('#loading'),
  scanButton: document.querySelector('#barcode-scan'),
  recentlyViewed: document.querySelector('#recently-viewed'),
  settingsBtn: document.querySelector('[data-action="settings"]'),
  favouritesSection: document.querySelector('#favourites'),
  evaluationSection: document.querySelector('#evaluation'),
  homeView: document.querySelector('#home'),
  compareView: document.querySelector('#compare'),
  aboutTrigger: document.querySelector('#about-trigger'),
  aboutModal: document.querySelector('#about-modal'),
  closeAboutModal: document.querySelector('#close-about-modal'),
  homeRecent: document.querySelector('#home-recent'),
  homeRecentRail: document.querySelector('#home-recent-rail'),
  homeCtaInspect: document.querySelector('#home-cta-inspect'),
  homeCtaBrowse: document.querySelector('#home-cta-browse'),
  searchSection: document.querySelector('.search'),
  controlsBar: document.querySelector('.search-controls-bar'),
  weightingSection: document.querySelector('.weighting'),
  navHome: document.querySelector('#nav-home'),
  navDiscover: document.querySelector('#nav-discover'),
  navSaved: document.querySelector('#nav-saved'),
  navCompare: document.querySelector('#nav-compare'),
  homeAboutLink: document.querySelector('#home-about-link'),
  footerAboutLink: document.querySelector('#footer-about-link'),
  footerEvalLink: document.querySelector('#footer-eval-link'),
  aboutEvalLink: document.querySelector('#about-eval-link'),
  compareBackBtn: document.querySelector('#compare-back-btn'),
  themeToggle: document.querySelector('#theme-toggle'),
  savedBadge: document.querySelector('#saved-badge'),
  categoryBrowser: document.getElementById('category-browser'),
  filtersBrowser: document.getElementById('filters-browser'),
};

// ─── state persistence ──────────────────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage disabled, ignore */
  }
}

// ─── slider + presets ───────────────────────────────────────────────────

function applyWeightToUI() {
  if (els.weightSlider) {
    els.weightSlider.value = String(state.healthWeight);
    els.weightSlider.style.setProperty('--track-pct', `${state.healthWeight}%`);
  }
  if (els.weightHealthLabel) {
    els.weightHealthLabel.textContent = `${state.healthWeight}%`;
  }
  if (els.weightEcoLabel) {
    els.weightEcoLabel.textContent = `${100 - state.healthWeight}%`;
  }
  for (const btn of els.presetButtons) {
    btn.classList.toggle('is-active', btn.dataset.preset === state.preset);
    btn.setAttribute('aria-pressed', btn.dataset.preset === state.preset ? 'true' : 'false');
  }
}

function setWeight(percent, preset) {
  state.healthWeight = Math.max(0, Math.min(100, Math.round(percent)));
  state.preset = preset || null;
  saveState();
  applyWeightToUI();
  if (focusedProduct) {
    rerenderFocused();
  }
  rerenderResults();
}

// ─── rendering primitives ──────────────────────────────────────────────

function setHidden(node, hidden) {
  if (!node) return;
  node.hidden = hidden;
}

function clear(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') {
      node.className = value;
    } else if (key === 'dataset') {
      for (const [k, v] of Object.entries(value)) node.dataset[k] = v;
    } else if (key === 'style') {
      for (const [k, v] of Object.entries(value)) node.style.setProperty(k, v);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') {
      node.innerHTML = value;
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      node.appendChild(document.createTextNode(String(child)));
    } else {
      node.appendChild(child);
    }
  }
  return node;
}

// ─── badges ─────────────────────────────────────────────────────────────

function renderBadge(scope, score) {
  const grade = score?.grade || 'unknown';
  const color = scope === 'nutri' ? NUTRI_COLORS[grade] : ECO_COLORS[grade];
  const label = GRADE_LABELS[grade] || '?';
  const axisName = scope === 'nutri' ? 'Nutri-Score' : 'Eco-Score';
  const caption = grade === 'not-applicable'
    ? 'Score does not apply to this category'
    : grade === 'unknown'
      ? 'Insufficient data'
      : null;

  // F-28 AC10: only attach tooltips to scored badges (a-e). Unknown / not-applicable
  // grades have no methodology to explain.
  const isScored = ['a', 'b', 'c', 'd', 'e'].includes(grade);
  const attrs = {
    class: `badge badge--${scope} badge--grade-${grade}`,
    role: isScored ? 'button' : 'img',
    tabindex: isScored ? '0' : null,
    'aria-label': `${axisName}: ${label}${caption ? `. ${caption}` : '. Open score methodology'}`,
    style: { '--badge-color': color },
  };
  if (isScored) attrs.dataset = { tooltip: scope };

  return el(
    'div',
    attrs,
    el('span', { class: 'badge__axis' }, axisName),
    el('span', { class: 'badge__letter' }, label),
    caption ? el('span', { class: 'badge__caption' }, caption) : null,
  );
}

function renderNutrientChips(levels) {
  const entries = [
    { key: 'fat', label: 'fat' },
    { key: 'saturatedFat', label: 'sat. fat' },
    { key: 'sugars', label: 'sugar' },
    { key: 'salt', label: 'salt' },
  ];
  return el(
    'ul',
    { class: 'chips', 'aria-label': 'Nutrient levels' },
    ...entries.map((e) => {
      const v = levels?.[e.key];
      const cls = v ? `chip chip--${v}` : 'chip chip--missing';
      return el('li', { class: cls }, el('strong', {}, e.label), v ? ` ${v}` : ' no data');
    }),
  );
}

function renderNutrientTable(nutrients) {
  const rows = [
    ['Energy', 'energyKcal_100g', 'kcal'],
    ['Sugars', 'sugars_100g', 'g'],
    ['Fat', 'fat_100g', 'g'],
    ['Saturated fat', 'saturatedFat_100g', 'g'],
    ['Salt', 'salt_100g', 'g'],
    ['Fibre', 'fiber_100g', 'g'],
    ['Protein', 'proteins_100g', 'g'],
  ];
  return el(
    'table',
    { class: 'nutrient-table', 'aria-label': 'Nutrients per 100g' },
    el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Per 100g'), el('th', { scope: 'col' }, 'Amount'))),
    el(
      'tbody',
      {},
      ...rows.map(([label, key, unit]) => {
        const v = nutrients?.[key];
        const value = typeof v === 'number' ? `${v.toFixed(unit === 'kcal' ? 0 : 1)} ${unit}` : 'no data';
        return el('tr', {}, el('th', { scope: 'row' }, label), el('td', { class: 'num' }, value));
      }),
    ),
  );
}

// ─── print product card ──────────────────────────────────────────────
// `<details>` elements ignore CSS-driven open/close in print; we have to
// programmatically expand them, take the snapshot, then restore the state
// the user actually had. Without this the nutrient table is missing from
// every printout — which is what the F-30 user complained about.
async function printFocusedCard() {
  const focused = document.getElementById('focused');
  if (!focused) {
    window.print();
    return;
  }
  const detailsList = focused.querySelectorAll('details');
  const wasOpen = new Map();
  detailsList.forEach((d) => {
    wasOpen.set(d, d.hasAttribute('open'));
    // Setting the `open` attribute fires the native `toggle` event, which
    // for the SHAP `<details>` kicks off its on-demand fetch + chart render.
    d.setAttribute('open', '');
  });

  // Mark the focused product with a stamp the print stylesheet can use
  // for an "as of YYYY-MM-DD" footnote.
  const stamp = new Date().toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  focused.dataset.printedAt = stamp;

  // Restore state once the print dialog is dismissed.
  const restore = () => {
    detailsList.forEach((d) => {
      if (!wasOpen.get(d)) d.removeAttribute('open');
    });
    delete focused.dataset.printedAt;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);

  // Wait for the on-demand SHAP chart to finish painting before printing.
  // Opening the `.card__advanced` <details> above already triggered its
  // toggle handler (fetch + renderShapChart). We poll for the rendered
  // canvas; if the backend is absent or SHAP is unavailable the poll
  // resolves on the "unavailable" message or the timeout, so the
  // no-backend path is never blocked — printing still proceeds.
  await waitForShapReady(focused, 2500);

  // The product photo is loading="lazy"; img.complete can read true before the
  // bitmap is decoded, which captures an empty image box in the printout.
  // Force-decode it first so the photo actually paints into the tear-sheet.
  await waitForFocusedImage(focused, 1500);

  // One extra frame so the just-painted canvas is flushed into print layout
  // before opening the print dialog.
  requestAnimationFrame(() => window.print());
}

// Force-decode the focused product photo so it is painted in the print
// snapshot. Never rejects: a missing/broken image or the timeout resolves it.
function waitForFocusedImage(focused, timeoutMs) {
  const img = focused.querySelector('.card__image');
  if (!img) return Promise.resolve();
  const decoded = typeof img.decode === 'function'
    ? img.decode().catch(() => {})
    : Promise.resolve();
  const timeout = new Promise((resolve) => { setTimeout(resolve, timeoutMs); });
  return Promise.race([decoded, timeout]);
}

// Resolve as soon as the SHAP canvas exists AND has been painted, OR the
// advanced block reported "unavailable", OR the timeout elapses. This
// promise NEVER rejects, so a missing/slow backend cannot block printing.
function waitForShapReady(focused, timeoutMs) {
  const advanced = focused.querySelector('.card__advanced');
  if (!advanced) return Promise.resolve(); // alternatives have no SHAP block
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const canvas = advanced.querySelector('.card__shap-canvas');
      const unavailable = advanced.querySelector('.card__advanced-unavailable');
      // Chart.js registers the instance on the canvas once it has rendered;
      // a painted canvas also reports a positive intrinsic width.
      const painted = canvas && ((window.Chart && window.Chart.getChart && window.Chart.getChart(canvas)) || canvas.width > 0);
      if (painted || unavailable || performance.now() - start > timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

// ─── share product ─────────────────────────────────────────────────────

async function shareProduct(product) {
  const url = `https://world.openfoodfacts.org/product/${product.code}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied to clipboard');
  } catch {
    toast('Could not copy link — try again or copy manually from the product page');
  }
}

// ─── SHAP waterfall chart (F-24) ──────────────────────────────────────

const _shapChartInstances = new WeakMap();
let chartJsPromise = null;

function ensureChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (!chartJsPromise) {
    chartJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CHART_JS_URL;
      script.async = true;
      script.onload = () => resolve(window.Chart);
      script.onerror = () => reject(new Error('Chart.js failed to load'));
      document.head.appendChild(script);
    });
  }
  return chartJsPromise;
}

async function renderShapChart(canvas, shapData) {
  const Chart = await ensureChartJs();
  // Destroy any previous chart on this canvas to avoid Canvas reuse warning.
  const existing = _shapChartInstances.get(canvas);
  if (existing) existing.destroy();

  const features = shapData.features.slice(0, 7); // top-7 most impactful
  const labels = features.map((f) => `${f.name} (${f.feature_value}g)`);
  const values = features.map((f) => f.shap_value);
  const colors = values.map((v) =>
    v >= 0 ? 'rgba(231, 76, 60, 0.75)' : 'rgba(46, 204, 113, 0.75)',
  );

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'SHAP contribution',
        data: values,
        backgroundColor: colors,
        borderWidth: 0,
        borderRadius: 3,
      }],
    },
    options: {
      // Paint synchronously (no animation) so the chart is fully rendered on
      // the first frame — required for the print snapshot in printFocusedCard.
      animation: false,
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.raw;
              const dir = v >= 0 ? 'pushes toward' : 'opposes';
              return ` ${dir} grade ${shapData.predicted_class.toUpperCase()} (${v > 0 ? '+' : ''}${v.toFixed(3)})`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'SHAP value (contribution to predicted grade)' },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
        y: { grid: { display: false } },
      },
    },
  });

  _shapChartInstances.set(canvas, chart);
}

function renderAdvancedToggle(product) {
  const details = el('details', { class: 'card__advanced' },
    el('summary', { class: 'card__advanced-summary', dataset: { i18n: 'card.adv_expl' } }, t('card.adv_expl', 'Advanced explanation (SHAP)')),
  );

  const body = el('div', { class: 'card__advanced-body' });
  details.appendChild(body);

  let loaded = false;
  details.addEventListener('toggle', async () => {
    if (!details.open || loaded) return;
    loaded = true;

    const spinner = el('p', { class: 'card__advanced-loading' }, 'Loading SHAP explanation…');
    body.appendChild(spinner);

    const data = await getExplainFromBackend(product.code);

    body.removeChild(spinner);

    if (!data || !data.shap_waterfall) {
      body.appendChild(
        el('p', { class: 'card__advanced-unavailable' },
          'Advanced explanation requires the FoodLens backend. Start it and set the backend URL in index.html.',
        ),
      );
      return;
    }

    const wf = data.shap_waterfall;
    const caption = el('p', { class: 'card__advanced-caption' },
      `Predicted grade: ${wf.predicted_class.toUpperCase()} (${Math.round(wf.predicted_proba * 100)}% confidence). ` +
      'Red bars push the model toward this grade; green bars oppose it.',
    );
    const canvas = el('canvas', { class: 'card__shap-canvas', role: 'img', 'aria-label': 'SHAP feature contributions' });
    body.appendChild(caption);
    body.appendChild(canvas);
    try {
      await renderShapChart(canvas, wf);
    } catch {
      canvas.replaceWith(
        el('p', { class: 'card__advanced-unavailable' }, 'Chart library could not load. The advanced explanation is unavailable.'),
      );
    }
  });

  return details;
}

// ─── Nutri × Eco scatter plot (F-43) ──────────────────────────────────

const _scatterChartInstances = new WeakMap();

async function renderScatterPlot(container, scatterData, focusedProduct) {
  const Chart = await ensureChartJs();
  const existing = _scatterChartInstances.get(container);
  if (existing) existing.destroy();

  const focusedCode = focusedProduct?.code;

  // Add small jitter so overlapping points (same integer scores) are visible.
  const jitter = () => (Math.random() - 0.5) * 0.25;

  const regular = [];
  const focused = [];

  for (const p of scatterData.products) {
    const x = p.eco_numeric != null ? p.eco_numeric + jitter() : null;
    const y = p.nutri_numeric != null ? p.nutri_numeric + jitter() : null;
    if (x == null || y == null) continue;
    const point = { x, y, label: p.name, nutri: p.nutri_grade, eco: p.eco_grade };
    if (p.code === focusedCode) focused.push(point);
    else regular.push(point);
  }

  const canvas = el('canvas', { role: 'img', 'aria-label': `Nutri-Score vs Eco-Score scatter for ${scatterData.category}` });
  container.appendChild(canvas);

  const chart = new Chart(canvas, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Category products',
          data: regular,
          backgroundColor: 'rgba(99, 179, 237, 0.65)',
          pointRadius: 6,
          pointHoverRadius: 8,
        },
        {
          label: 'This product',
          data: focused,
          backgroundColor: 'rgba(237, 100, 54, 1)',
          pointRadius: 10,
          pointHoverRadius: 12,
          pointStyle: 'star',
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const p = ctx.raw;
              return ` ${p.label}  |  Nutri: ${(p.nutri || '?').toUpperCase()}  Eco: ${(p.eco || '?').toUpperCase()}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Eco-Score (1 = worst · 5 = best)' },
          min: 0.5, max: 5.5,
          ticks: { stepSize: 1, callback: (v) => ['', 'E', 'D', 'C', 'B', 'A'][Math.round(v)] || '' },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
        y: {
          title: { display: true, text: 'Nutri-Score (1 = worst · 5 = best)' },
          min: 0.5, max: 5.5,
          ticks: { stepSize: 1, callback: (v) => ['', 'E', 'D', 'C', 'B', 'A'][Math.round(v)] || '' },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
      },
    },
  });

  _scatterChartInstances.set(container, chart);
}

// ─── product card ──────────────────────────────────────────────────────

function pickReference(product, products) {
  // F-18: when the user has set a "usual" for THIS product's category, the
  // contrastive sentence re-anchors on that usual instead of the category
  // average. A usual from a different category is never used here.
  const usual = getUsualProduct(product);
  if (usual && usual.code !== product.code && usualCategoryKey(usual) === usualCategoryKey(product)) {
    return { kind: 'usual', ...usual };
  }
  const sameCategory = products.filter((p) => p.code !== product.code && p.category === product.category);
  if (sameCategory.length >= 2) {
    return buildCategoryAverageReference(sameCategory, product.category);
  }
  return null;
}

// Turn an OFF category tag (e.g. "en:diet-cola-soft-drink") into a short,
// human-readable label. Never invents a category: returns '' when absent.
function categoryDisplayName(product) {
  const cat = product?.category;
  if (typeof cat !== 'string' || cat.length === 0) return '';
  return cat.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ').trim();
}

// Build the "Set as my usual <category>" button label, falling back to a plain
// "Set as usual" when the product carries no category. Uses t() so the framing
// stays translatable.
function usualButtonLabel(product) {
  const name = categoryDisplayName(product);
  if (!name) {
    return t('card.set_usual', 'Set as usual');
  }
  return t('card.set_usual_category', 'Set as my usual {category}').replace('{category}', name);
}

// Editorial line-icon (share node), stroke=currentColor so it inverts in dark
// mode. aria-hidden because the surrounding button carries the accessible name.
const ICON_SHARE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="18" cy="5" r="3"/>
  <circle cx="6" cy="12" r="3"/>
  <circle cx="18" cy="19" r="3"/>
  <line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/>
  <line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>
</svg>`;

// Left-arrow used by the product view's "Back to results" control. Matches the
// 16x16 stroke=currentColor icon style of the site-nav buttons.
const ICON_BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16">
  <path d="M19 12H5"/>
  <path d="m12 19-7-7 7-7"/>
</svg>`;

/**
 * Render a product card.
 *
 * Two contexts diverge here:
 * - LISTING (isFocused=false): compact single-line icon-button action row
 *   (favourite + share). The add-to-compare checkbox stays as the first child.
 *   Print / set-as-usual / compare-with-usual are intentionally NOT rendered —
 *   they only make sense once a product is actually selected.
 * - FOCUSED (isFocused=true): the full text-label action row (heart, print,
 *   set-as-usual, share, compare-with-usual). No capability is removed here.
 *
 * H7 stays satisfied in both contexts (the card always closes into an action).
 *
 * @param {object} product
 * @param {object} reference   — comparison anchor for the contrastive sentence
 * @param {boolean} isAlternative — alternatives grid uses renderAlternativeCard;
 *   when true the action row / compare toggle / SHAP toggle are suppressed.
 * @param {boolean} isFocused  — true only for the "Selected product" detail card.
 */
// Number of main ingredients shown on the focused card before "+N more".
const INGREDIENTS_TOP_N = 6;

/**
 * "Main ingredients" section — FOCUSED card only.
 *
 * The backend index carries no ingredient data, so we fetch them lazily for the
 * single focused barcode via getProductIngredients (OFF /product, on demand). The
 * section renders synchronously in a loading state and fills itself async, mirroring
 * renderAdvancedToggle. Shows the localised "no data" copy when OFF has nothing —
 * never invents ingredient names.
 *
 * Returns null for listing / alternative cards so it appears on the focused card only.
 */
function renderIngredientsSection(product, isFocused) {
  if (!isFocused || !product?.code) return null;

  const body = el('div', { class: 'card__ingredients-body' },
    el('span', { class: 'card__ingredients-loading' }, t('card.ingredients_loading', 'Loading ingredients…')),
  );

  const section = el('section', { class: 'card__ingredients' },
    el('h4', { class: 'card__ingredients-title', dataset: { i18n: 'card.ingredients_title' } },
      t('card.ingredients_title', 'Main ingredients')),
    body,
  );

  getProductIngredients(product.code).then(({ ingredients }) => {
    clear(body);
    if (!ingredients || ingredients.length === 0) {
      body.appendChild(
        el('span', { class: 'card__ingredients-empty card__no-data' }, t('card.no_data', 'no data')),
      );
      return;
    }
    const shown = ingredients.slice(0, INGREDIENTS_TOP_N);
    const list = el('ul', { class: 'card__ingredients-list', 'aria-label': t('card.ingredients_title', 'Main ingredients') });
    for (const name of shown) {
      list.appendChild(el('li', { class: 'card__ingredients-chip' }, name));
    }
    const remaining = ingredients.length - shown.length;
    if (remaining > 0) {
      // "+N more" is a real button: clicking it reveals the rest of the
      // ingredients in place and removes itself.
      const moreLi = el('li', { class: 'card__ingredients-more-wrap' });
      const moreBtn = el('button', {
        type: 'button',
        class: 'card__ingredients-more',
        'aria-expanded': 'false',
      }, t('card.ingredients_more', '+{n} more').replace('{n}', String(remaining)));
      moreBtn.addEventListener('click', () => {
        for (const name of ingredients.slice(INGREDIENTS_TOP_N)) {
          list.insertBefore(el('li', { class: 'card__ingredients-chip' }, name), moreLi);
        }
        moreLi.remove();
      });
      moreLi.appendChild(moreBtn);
      list.appendChild(moreLi);
    }
    body.appendChild(list);
  });

  return section;
}

function renderProductCard(product, reference, isAlternative = false, isFocused = false) {
  const { sentence } = generateContrastiveSentence(product, reference);

  const figure = product.image
    ? el('img', { class: 'card__image', src: product.image, alt: product.name || product.code, loading: 'lazy' })
    : el('div', { class: 'card__image card__image--placeholder', 'aria-hidden': 'true' }, product.name?.[0] || '?');

  // Control de selección para comparar usando la función t() de i18n
  const compareAction = !isAlternative 
    ? el(
        'label',
        { class: 'card-compare-action', title: 'Select to compare' },
        el('input', { 
          type: 'checkbox', 
          class: 'compare-checkbox', 
          dataset: { productId: product.code },
          onChange: (e) => toggleProductSelection(product.code, product, e.target.checked, e.target)
        }),
        // Pasamos los textos traducidos a los atributos que el CSS leerá
        el('span', { 
          class: 'compare-custom-toggle', 
          'aria-hidden': 'true',
          'data-text-add': t('card.compare_add', '+ Add to comparison'),
          'data-text-selected': t('card.compare_sel', '☑ Selected')
        })
      )
    : null;

  return el(
    'article',
    {
      class: `card${isAlternative ? ' card--alt' : ''}${!isAlternative ? (isFocused ? ' card--focused' : ' card--listing') : ''}`,
      dataset: { code: product.code },
    },
    compareAction,
    el(
      'header',
      { class: 'card__header' },
      figure,
      el(
        'div',
        { class: 'card__title-block' },
        el('h3', { class: 'card__title' }, product.name || 'Unnamed product'),
        product.brands?.length > 0
          ? el('p', { class: 'card__brand' }, product.brands.join(' · '))
          : null,
        product.source === 'sample'
          ? el('span', { class: 'card__source-tag' }, 'sample data')
          : null,
      ),
    ),
    el(
      'div',
      { class: 'card__scores' },
      renderBadge('nutri', product.nutriScore),
      renderBadge('eco', product.ecoScore),
    ),
    renderNutrientChips(product.nutrientLevels),
    el(
      'p',
      { class: 'card__sentence' },
      sentence,
    ),
    renderIngredientsSection(product, isFocused),
    // "See numbers" + the SHAP advanced explanation are drill-downs (H3): they
    // live on the focused product page only, not on every listing card. Clicking
    // a listing card routes to /product, where the full detail is shown. Keeping
    // them off the listing also keeps the grid cards aligned (no in-place expand).
    isFocused ? el(
      'details',
      { class: 'card__drilldown' },
      el('summary', { dataset: { i18n: 'card.see_numbers' } }, t('card.see_numbers', 'See numbers')),
      renderNutrientTable(product.nutrients),
    ) : null,
    isFocused ? renderAdvancedToggle(product) : null,
    !isAlternative ? renderCardActions(product, isFocused) : null,
  );
}

// Heart toggle reused by both action rows: re-syncs every heart on the page so
// the same product's favourite state stays consistent across listing + focused.
function buildCardHeartButton(product) {
  return buildHeartButton(product.code, product, () => {
    document.querySelectorAll('.heart-btn').forEach((btn) => {
      const card = btn.closest('[data-code]');
      if (card && card.dataset.code) {
        const saved = isFavourite(card.dataset.code);
        btn.classList.toggle('is-saved', saved);
        btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
        btn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save product');
      }
    });
    updateSavedBadge();
  });
}

/**
 * Action row for a product card.
 *
 * Listing context → compact icon-button row (favourite + share) that stays on a
 * single line. Focused context → the full text-label row including Print,
 * Set-as-usual and Compare-with-usual, which only operate on a selected product.
 */
function renderCardActions(product, isFocused) {
  if (!isFocused) {
    return el(
      'div',
      { class: 'card__actions card__actions--compact' },
      buildCardHeartButton(product),
      el(
        'button',
        {
          type: 'button',
          class: 'icon-btn',
          'aria-label': t('aria.share', 'Share product'),
          title: t('aria.share', 'Share product'),
          html: ICON_SHARE,
          onClick: () => shareProduct(product),
        },
      ),
    );
  }

  return el(
    'div',
    { class: 'card__actions' },
    buildCardHeartButton(product),
    el(
      'button',
      { type: 'button', class: 'btn btn--print', dataset: { i18n: 'card.print' }, onClick: () => printFocusedCard() },
      t('card.print', 'Print card'),
    ),
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn--ghost',
        onClick: async () => {
          // Si hacemos clic desde la lista izquierda, lo enfocamos primero
          if (focusedProduct?.code !== product.code) {
            await focusProduct(product);
          }
          setUsualProduct(product);
        },
      },
      usualButtonLabel(product),
    ),
    el(
      'button',
      { type: 'button', class: 'btn btn--share', dataset: { i18n: 'card.share' }, onClick: () => shareProduct(product) },
      t('card.share', 'Share product'),
    ),
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn--primary',
        onClick: async () => {
          // Pull the usual for THIS product's category so we never compare
          // across shelves (e.g. a usual cola against a yoghurt).
          const usual = getUsualProduct(product);

          if (!usual) {
            toast(t('compare.no_usual_saved', 'You haven\'t set a usual product yet. Click "Set as usual" on any product first!'));
            return;
          }
          if (usual.code === product.code) {
            toast(t('compare.same_usual', 'This is already your usual product! Inspect a different one to compare.'));
            return;
          }

          // Si el usuario clicó en la lista lateral, esperamos a que el producto cargue
          if (focusedProduct?.code !== product.code) {
            await focusProduct(product);
          }

          toast(t('compare.scrolling', 'Showing comparison below…'));
          // Ahora es seguro hacer scroll porque sabemos que la sección existe
          const sectionTitle = document.getElementById('usual-comparison-section');
          if (sectionTitle) sectionTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      },
      t('card.compare_usual', 'Compare with usual'),
    ),
  );
}

function renderAlternativeCard(product, alternative) {
  // formatAlternativeDelta now returns '' when there is no nutrient delta; fall
  // back to the translated "similar profile" copy rather than an empty line.
  const delta = formatAlternativeDelta(product, alternative)
    || t('compare.similar', 'Very similar profile to your usual.');
  return el(
    'article',
    {
      class: 'alt-card',
      dataset: { code: alternative.code },
      'aria-label': `Open ${alternative.name || alternative.code} as the focused product`,
      onClick: () => {
      telemetry.send({
        event: 'alternative_click',
        viewed_barcode: product?.code,
        clicked_barcode: alternative?.code,
      });
      focusProduct(alternative);
    },
      role: 'button',
      tabindex: '0',
      onKeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          focusProduct(alternative);
        }
      },
    },
    el(
      'header',
      { class: 'alt-card__head' },
      el('h4', { class: 'alt-card__title' }, alternative.name || alternative.code),
      el(
        'div',
        { class: 'alt-card__badges' },
        renderBadge('nutri', alternative.nutriScore),
        renderBadge('eco', alternative.ecoScore),
      ),
    ),
    el('p', { class: 'alt-card__delta' }, delta),
  );
}

// ─── rendering flows ───────────────────────────────────────────────────

async function focusProduct(product, { skipTrack = false, route = true } = {}) {
  if (_searchCompletedAt && product?.code) {
    telemetry.send({
      event: 'decision_time',
      barcode: product.code,
      ms: Date.now() - _searchCompletedAt,
    });
  }
  focusedProduct = product;
  if (!skipTrack) {
    trackView(product.code, product);
    renderRecentlyViewed(els.recentlyViewed, (code) => runSearch(code));
  }

  if (route) {
    // Route to the product deep-dive: push /product?code=NNN, flip currentView,
    // show #focused and hide the siblings. We render the assembly here and AWAIT
    // it (so callers that scroll to #usual-comparison-section after the await
    // find a painted DOM), then tell showView to skip its own re-render.
    _focusedShouldScroll = true;
    await rerenderFocused();
    showView('product', { code: product?.code, skipFocusedRender: true });
  } else {
    // Bootstrap / pre-render path: prime focusedProduct WITHOUT routing or
    // showing #focused, so the listing stays clean (no inline injection) while a
    // later /product?code restore or click is instant. The assembly is rebuilt
    // on demand by the product branch, so we don't paint it into a hidden node.
    if (currentView !== 'product') setHidden(els.focusedView, true);
    else await rerenderFocused();
  }
}

async function rerenderFocused() {
  if (!focusedProduct) {
    setHidden(els.focusedView, true);
    return;
  }
  
  // F-18: the usual is keyed by the focused product's category, so we only ever
  // surface a usual that belongs to the same shelf.
  const usualProduct = getUsualProduct(focusedProduct);

  const reference = pickReference(focusedProduct, lastResults);
  
  const [alternatives, scatterData] = await Promise.all([
    computeAlternatives(focusedProduct, lastResults),
    getCategoryScatter(focusedProduct.category)
  ]);

  setHidden(els.focusedView, false);
  clear(els.focusedView);

  // 0. Back-to-results control — appended FIRST so DOM order = tab order: it is
  // the first focusable element on the product view. Returns to the listing
  // (or wherever the user came from) without losing lastResults/pagination,
  // which live in module scope and are repainted by rerenderResults.
  const backLabel = t('nav.back_to_results', 'Back to results');
  els.focusedView.appendChild(
    el(
      'button',
      {
        type: 'button',
        class: 'focused__back',
        'aria-label': backLabel,
        // Icon (left chevron) + label, matching the site-nav icon style. Built
        // as an innerHTML string so the SVG is parsed in the correct namespace
        // (createElement does not namespace SVG); the label span carries
        // data-i18n so a later setLang() pass re-translates it in place.
        html: `${ICON_BACK}<span data-i18n="nav.back_to_results">${backLabel}</span>`,
        onClick: () => {
          // history.back() returns to the prior view (search/saved/evaluation)
          // and replays the kept list. The fallback covers a deep-link entry
          // where there is no back stack to pop.
          if (window.history.length > 1) window.history.back();
          else { showView('discover'); ensureCatalogueLoaded(); }
        },
      },
    ),
  );

  // 1. Tarjeta principal
  els.focusedView.appendChild(
    el('h2', { class: 'section__title focused-title', tabindex: '-1' }, t('ui.selected_product', 'Selected product')),
  );
  els.focusedView.appendChild(renderProductCard(focusedProduct, reference, false, /* isFocused */ true));

  // 2. F-18: Renderizado del Producto Habitual (Comparación Real).
  // Guard by SHELF KEY (not just code, and not the over-granular leaf tag) so a
  // usual from one shelf is never compared against a product from another, while
  // same-shelf products with different leaf tags still match.
  if (
    usualProduct &&
    usualProduct.code !== focusedProduct.code &&
    usualCategoryKey(usualProduct) === usualCategoryKey(focusedProduct)
  ) {
    els.focusedView.appendChild(
      el('h3', { id: 'usual-comparison-section', class: 'section__subtitle' }, t('compare.usual_title', 'Compared to your usual choice')),
    );

    // 1. Translate the structured delta string. formatAlternativeDelta emits an
    // English form "<grams> <less|more> <nutrient>, ... per 100g." where nutrient
    // is one of the NUTRIENT_DISPLAY_NAMES (sugar|fat|saturated fat|salt|protein|
    // fibre). Translating direction + nutrient as separate tokens covers BOTH
    // directions for every nutrient (so "more sugar"/"less fibre" no longer leak
    // English into ES/CA), and is order-safe — unlike the previous .replace chain
    // which only handled the favourable direction and could partially match
    // "fat" inside "saturated fat".
    let deltaText = formatAlternativeDelta(usualProduct, focusedProduct);
    if (deltaText) {
      deltaText = deltaText.replace(
        /\b(less|more) (saturated fat|sugar|fat|salt|protein|fibre)\b/g,
        (_, dir, nut) =>
          `${t(`compare.dir_${dir}`, dir)} ${t(`compare.nut_${nut}`, nut)}`,
      );
      deltaText = deltaText.replace('per 100g', t('compare.per_100g', 'per 100g'));
    }

    const currentName = focusedProduct.name || 'Current product';
    const usualName = usualProduct.name || 'Usual product';

    // 2. Construimos la frase de conclusión con el nombre en negrita
    const deltaParagraph = el('p', { class: 'alt-card__delta', style: { color: 'var(--color-ink)', marginTop: '0.5rem' } });

    if (deltaText) {
       deltaParagraph.append(
         `${t('compare.compared_to_usual', 'Compared to this,')} `,
         el('strong', {}, currentName),
         ` ${t('compare.has', 'has')} ${deltaText}`
       );
    } else {
       deltaParagraph.append(
         el('strong', {}, currentName),
         ` ${t('compare.is_similar', 'has a very similar profile.')}`
       );
    }

    // 2. Construimos la tarjeta con doble cabecera (Actual arriba, Habitual abajo)
    const comparisonCard = el(
      'article',
      { 
        class: 'alt-card', 
        style: { borderLeft: '4px solid var(--color-ink)' } 
      }, 
      // Cabecera Producto ACTUAL
      el(
        'header',
        { class: 'alt-card__head', style: { borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem', marginBottom: '0.5rem' } },
        el('div', {}, 
            el('span', { style: { fontSize: '0.7rem', textTransform: 'uppercase', opacity: '0.6', display: 'block' } }, t('compare.current_label', 'Current:')),
            el('h4', { class: 'alt-card__title', style: { margin: 0 } }, currentName)
        ),
        el('div', { class: 'alt-card__badges' },
          renderBadge('nutri', focusedProduct.nutriScore),
          renderBadge('eco', focusedProduct.ecoScore),
        )
      ),
      // Cabecera Producto HABITUAL
      el(
        'header',
        { class: 'alt-card__head', style: { opacity: '0.8' } },
        el('div', {}, 
            el('span', { style: { fontSize: '0.7rem', textTransform: 'uppercase', opacity: '0.6', display: 'block' } }, t('compare.your_usual', 'Your usual choice:')),
            el('h4', { class: 'alt-card__title', style: { margin: 0 } }, usualName)
        ),
        el('div', { class: 'alt-card__badges' },
          renderBadge('nutri', usualProduct.nutriScore),
          renderBadge('eco', usualProduct.ecoScore),
        )
      ),
      // Conclusión
      deltaParagraph
    );

    els.focusedView.appendChild(comparisonCard);
  }

  // 3. Alternativas
  if (alternatives.length > 0) {
    els.focusedView.appendChild(
      el('h3', { class: 'section__subtitle' }, t('ui.better_alternatives', 'Better alternatives in this category')),
    );
    const grid = el('div', { class: 'alt-grid' });
    for (const alt of alternatives) {
      grid.appendChild(renderAlternativeCard(focusedProduct, alt));
    }
    els.focusedView.appendChild(grid);
  } else {
    els.focusedView.appendChild(
      el('p', { class: 'alt-grid__empty' }, t('ui.best_in_category', 'This is already among the best in its category.')),
    );
  }

  // 4. Scatter plot
  if (scatterData) {
    els.focusedView.appendChild(
      el('h3', { class: 'section__subtitle' }, t('ui.health_vs_eco', 'Health vs Eco in this category')),
    );
    els.focusedView.appendChild(
      el('p', { class: 'section__hint' }, t('ui.scatter_hint', 'Top-right corner = best on both axes. The orange star is this product.')),
    );
    const chartWrap = el('div', { class: 'scatter-wrap' });
    els.focusedView.appendChild(chartWrap);
    try {
      await renderScatterPlot(chartWrap, scatterData, focusedProduct);
    } catch {
      chartWrap.appendChild(
        el('p', { class: 'section__hint' }, t('ui.chart_error', 'Chart library could not load, but the product scores above are still available.')),
      );
    }
  }

  // Only scroll on a fresh in-app focusProduct click. On a deep-link / back-
  // forward restore we want top-of-view, and a forced scroll would fight the
  // restore (and the compare/set-usual handlers that target #usual-comparison).
  if (_focusedShouldScroll) {
    els.focusedView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    _focusedShouldScroll = false;
  }
}

function computeAlternativesJS(product, pool) {
  // In-browser KNN fallback — unchanged from the original implementation.
  // Used when BACKEND_URL is not set, the backend is unreachable, or returns an error.
  const candidates = pool.filter((p) => {
    if (p.code === product.code) return false;
    if (p.category !== product.category) return false;
    const nutriOk = (p.nutriScore?.numeric ?? 0) >= (product.nutriScore?.numeric ?? 0);
    const ecoOk = (p.ecoScore?.numeric ?? 0) >= (product.ecoScore?.numeric ?? 0);
    return nutriOk || ecoOk;
  });
  const healthWeight = state.healthWeight / 100;
  candidates.sort((a, b) => {
    return weightedNutrientDistance(product, a, healthWeight) - weightedNutrientDistance(product, b, healthWeight);
  });
  return candidates.slice(0, 3);
}

async function computeAlternatives(product, pool) {
  // Try backend first if BACKEND_URL is configured. On any failure, fall back silently.
  if (product.code) {
    const fromBackend = await getAlternativesFromBackend(product.code, {
      k: 3,
      weight: state.healthWeight / 100,
    });
    if (fromBackend && Array.isArray(fromBackend.alternatives) && fromBackend.alternatives.length > 0) {
      // backend returns alternatives[i].product in the same normalised shape.
      return fromBackend.alternatives.map((a) => a.product);
    }
  }
  // Fallback: existing in-browser KNN path, untouched.
  return computeAlternativesJS(product, pool);
}

// True while the active source still has a next page to offer.
function listingHasNextPage() {
  if (listingSource === 'catalogue' || listingSource === 'category') {
    return listingOffset < listingTotal;
  }
  if (listingSource === 'search') return listingHasMore;
  return false; // null / barcode → never paginates
}

// Fetch the next page for the ACTIVE source and APPEND it to lastResults, then
// re-render so the new cards re-enter the active filter/sort order and keep both
// badges (H1). Each source knows how to fetch its own next page and when to stop.
async function loadMoreListing() {
  if (loadingMore || !listingSource) return;
  if (!listingHasNextPage()) return;
  loadingMore = true;
  renderLoadMore(); // reflect the loading state (disabled button)
  try {
    if (listingSource === 'catalogue' || listingSource === 'category') {
      const page = await getCatalogProducts({
        limit: CATALOG_RENDER_CAP,
        offset: listingOffset,
        category: listingSource === 'category' ? listingCategory : null,
      });
      if (page && page.products.length > 0) {
        lastResults = lastResults.concat(page.products);
        listingOffset += page.products.length;
        listingTotal = page.total; // trust the latest reported total
        rerenderResults(); // respects filters/sort and re-renders both badges
      } else {
        // No more products (or backend dropped): stop offering "Load more".
        listingTotal = listingOffset;
      }
    } else if (listingSource === 'search') {
      // OFF /search gives no reliable total, so we page until a short/empty
      // page comes back. A full page (>= page_size) means probably more.
      listingPage += 1;
      const next = await searchProducts(listingQuery, {
        ingredient: listingIngredient,
        categoryTag: listingCategoryTag,
        page: listingPage,
      });
      if (next && next.length > 0) {
        lastResults = lastResults.concat(next);
        listingHasMore = next.length >= OFF_PAGE_SIZE;
        rerenderResults();
      } else {
        listingHasMore = false;
      }
    }
  } finally {
    loadingMore = false;
    renderLoadMore();
  }
}

// Single source of truth for the "Load more" control. Renders a real <button>
// only while the active source has another page remaining.
function renderLoadMore() {
  if (!els.loadMore) return;
  clear(els.loadMore);
  if (!listingHasNextPage()) return;
  const label = loadingMore
    ? t('ui.loading_more', 'Loading…')
    : t('ui.load_more', 'Load more');
  const button = el(
    'button',
    {
      type: 'button',
      class: 'btn btn--ghost',
      'aria-label': label,
      disabled: loadingMore,
      onClick: loadMoreListing,
    },
    label
  );
  els.loadMore.appendChild(button);
}

function rerenderResults() {
  if (!els.resultsList) return;
  clear(els.resultsList);
  let filteredResults = lastResults.filter(p => passesFilters(p, currentFilters));
  console.log(
    `[HCI Filters] Displaying ${filteredResults.length} of ${lastResults.length} products`
  );
  const ranked = [...filteredResults];
  const hw = state.healthWeight / 100;
  ranked.sort((a, b) => {
    const aScore = (a.nutriScore?.numeric ?? 0) * hw + (a.ecoScore?.numeric ?? 0) * (1 - hw);
    const bScore = (b.nutriScore?.numeric ?? 0) * hw + (b.ecoScore?.numeric ?? 0) * (1 - hw);
    return bScore - aScore;
  });
  for (const product of ranked) {
    const ref = pickReference(product, lastResults);
    const card = renderProductCard(product, ref, false);
    card.addEventListener('click', (e) => {
      // Only focus when clicking outside interactive elements.
      if (e.target.closest('button, a, summary, details, input, label, [role="button"]')) return;
      focusProduct(product);
    });
    els.resultsList.appendChild(card);
  }
  if (els.resultsCount) {
    // Report the FILTERED count so the number is truthful when filters hide rows.
    if (filteredResults.length === 0) {
      els.resultsCount.textContent = 'No results';
    } else {
      const noun = filteredResults.length === 1 ? 'result' : 'results';
      // On an index-backed listing (catalogue or category) with no filter hiding
      // rows, show "X of N" so the user sees how much of the scope is loaded
      // (announced via aria-live). Search has no exact total → plain count only.
      const indexBacked =
        listingSource === 'catalogue' || listingSource === 'category';
      const showProgress =
        indexBacked && filteredResults.length === lastResults.length;
      els.resultsCount.textContent = showProgress
        ? t('catalogue.showing', '{loaded} of {total}')
            .replace('{loaded}', String(lastResults.length))
            .replace('{total}', String(listingTotal))
        : `${filteredResults.length} ${noun}`;
    }
  }
  setHidden(els.emptyState, filteredResults.length > 0);
  if (els.sourceBadge) {
    const isSample = lastResults.some((p) => p.source === 'sample');
    els.sourceBadge.hidden = !isSample;
  }
}

// ─── search ────────────────────────────────────────────────────────────

async function runSearch(query, opts = {}) {
  const myEpoch = ++_searchEpoch;
  const ingredient = (opts.ingredient || '').trim();
  const categoryTag = (opts.categoryTag || '').trim();
  setHidden(els.loading, false);
  // Reset listing pagination so a new search never inherits a stale offset, a
  // stale source, or a lingering "Load more" button from a previous listing.
  listingSource = null;
  listingOffset = 0;
  listingTotal = 0;
  listingCategory = null;
  listingQuery = '';
  listingIngredient = '';
  listingCategoryTag = '';
  listingPage = 1;
  listingHasMore = false;
  loadingMore = false;
  renderLoadMore();
  // A pure category listing is a chip click: a category tag with no free-text
  // query and no ingredient. Those are served from the index, not OFF.
  const isPureCategory = Boolean(categoryTag) && !query && !ingredient;
  try {
    let results;
    if (/^\d{8,13}$/.test(query)) {
      const single = await getProductByBarcode(query);
      results = single ? [single] : [];
      if (single) {
        trackView(single.code, single);
        renderRecentlyViewed(els.recentlyViewed, (code) => runSearch(code));
      }
      // Single result: listingSource stays null → never shows "Load more".
    } else if (isPureCategory) {
      // Category chip: serve the shelf FROM THE INDEX (reliable, has a real
      // total) instead of OFF /search, which 503s and falls back to the
      // 10-sample set that lacks cheese/bread/chocolate.
      const idxPage = await getCatalogProducts({
        category: categoryTag,
        limit: CATALOG_RENDER_CAP,
        offset: 0,
      });
      if (idxPage && idxPage.products.length > 0) {
        results = idxPage.products;
        listingSource = 'category';
        listingCategory = categoryTag;
        listingTotal = idxPage.total; // exact → precise hide via offset>=total
        listingOffset = idxPage.products.length;
      } else {
        // Index empty for this tag (or backend absent): fall back to OFF.
        results = await searchProducts(query, { ingredient, categoryTag });
        listingSource = 'search';
        listingQuery = query;
        listingIngredient = ingredient;
        listingCategoryTag = categoryTag;
        listingPage = 1;
        listingHasMore = (results?.length || 0) >= OFF_PAGE_SIZE;
      }
    } else if (query || ingredient || categoryTag) {
      // Keyword / ingredient search (OFF). No reliable total, so infer "more"
      // from whether the first page came back full.
      results = await searchProducts(query, { ingredient, categoryTag });
      listingSource = 'search';
      listingQuery = query;
      listingIngredient = ingredient;
      listingCategoryTag = categoryTag;
      listingPage = 1;
      listingHasMore = (results?.length || 0) >= OFF_PAGE_SIZE;
    } else {
      // Empty query / "All categories": pull the real index catalogue when the
      // backend is reachable, otherwise fall back to the 10-sample dataset.
      const firstPage = await getCatalogProducts({ limit: CATALOG_RENDER_CAP, offset: 0 });
      if (firstPage && firstPage.products.length > 0) {
        results = firstPage.products;
        // Enable incremental "Load more" only for this catalogue path.
        listingSource = 'catalogue';
        listingTotal = firstPage.total;
        listingOffset = firstPage.products.length;
      } else {
        // Backend absent: 10-sample fallback, no pagination / no button.
        results = await getAllSampleProducts();
      }
    }
    // A newer search was started while this one was awaiting its fetch. Bail out
    // before committing so a stale in-flight call can never overwrite the grid,
    // steal focus, or rebuild "Load more" for results the user no longer wants.
    if (myEpoch !== _searchEpoch) return;
    lastResults = results || [];
    _searchCompletedAt = Date.now();
    rerenderResults();
    renderLoadMore();
    // Phase 2: do NOT auto-focus the top product. Entering /discover must show
    // the LIST; the user clicks a card to reach /product (Phase 1). The product
    // deep-dive rebuilds focusedProduct on demand via restoreFocusedByCode, so
    // dropping the pre-render keeps deep-links working. We only reset the focused
    // state when the listing is empty so a stale deep-dive cannot linger.
    if (lastResults.length === 0) {
      focusedProduct = null;
      setHidden(els.focusedView, true);
    }
  } finally {
    // Only the latest search owns the loader. A superseded call must not hide it
    // while the winning call is still fetching.
    if (myEpoch === _searchEpoch) {
      setHidden(els.loading, true);
    }
  }
}

// ─── toast ─────────────────────────────────────────────────────────────

function toast(message) {
  let host = document.querySelector('#toast-host');
  if (!host) {
    host = el('div', { id: 'toast-host', class: 'toast-host', 'aria-live': 'polite' });
    document.body.appendChild(host);
  }
  const t = el('div', { class: 'toast' }, message);
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('is-visible'));
  setTimeout(() => {
    t.classList.remove('is-visible');
    t.addEventListener('transitionend', () => t.remove(), { once: true });
  }, 2400);
}

// ─── saved badge update ───────────────────────────────────────────

// Barcode scanner (F-21)
let zxingModulePromise = null;
let activeScannerControls = null;

function loadZxingModule() {
  if (!zxingModulePromise) {
    zxingModulePromise = import(ZXING_BROWSER_URL);
  }
  return zxingModulePromise;
}

function stopActiveScanner() {
  if (!activeScannerControls) return;
  activeScannerControls.stop();
  activeScannerControls = null;
}

function isBarcodeCandidate(value) {
  return /^\d{8,13}$/.test(String(value || '').trim());
}

function renderScannerDialog() {
  const video = el('video', {
    class: 'scanner__video',
    autoplay: '',
    muted: '',
    playsinline: '',
  });
  const status = el(
    'p',
    { class: 'scanner__status', role: 'status', 'aria-live': 'polite' },
    'Camera starts only for this scan.',
  );
  const manualInput = el('input', {
    class: 'scanner__manual-input',
    type: 'text',
    inputmode: 'numeric',
    pattern: '[0-9]*',
    autocomplete: 'off',
    placeholder: 'Paste barcode manually',
    'aria-label': 'Manual barcode',
  });

  const closeDialog = () => {
    stopActiveScanner();
    dialog.remove();
    els.scanButton?.focus();
  };

  const submitBarcode = (value) => {
    const code = String(value || '').trim();
    if (!isBarcodeCandidate(code)) {
      status.textContent = 'Enter an 8 to 13 digit barcode.';
      manualInput.focus();
      return;
    }
    closeDialog();
    if (els.searchInput) els.searchInput.value = code;
    showView('discover');
    runSearch(code);
  };

  const dialog = el(
    'div',
    {
      class: 'scanner',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'scanner-title',
    },
    el('div', { class: 'scanner__panel' },
      el('div', { class: 'scanner__header' },
        el('h2', { id: 'scanner-title', class: 'scanner__title' }, 'Scan barcode'),
        el('button', {
          type: 'button',
          class: 'scanner__close',
          'aria-label': 'Close scanner',
          onClick: closeDialog,
        }, 'Close'),
      ),
      el('div', { class: 'scanner__viewport' }, video),
      status,
      el('form', {
        class: 'scanner__manual',
        onSubmit: (e) => {
          e.preventDefault();
          submitBarcode(manualInput.value);
        },
      },
        manualInput,
        el('button', { type: 'submit', class: 'btn btn--primary' }, 'Use barcode'),
      ),
    ),
  );

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeDialog();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDialog();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button, input, video, [tabindex]:not([tabindex="-1"])')]
      .filter((node) => !node.disabled && node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  return { dialog, video, status, manualInput, submitBarcode };
}

async function openBarcodeScanner() {
  if (!els.scanButton) return;

  const { dialog, video, status, manualInput, submitBarcode } = renderScannerDialog();
  document.body.appendChild(dialog);
  manualInput.focus();

  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = 'Camera scanning is not available in this browser. Paste the barcode manually.';
    return;
  }

  try {
    status.textContent = 'Requesting camera permission...';
    const { BrowserMultiFormatReader } = await loadZxingModule();
    const reader = new BrowserMultiFormatReader();
    activeScannerControls = await reader.decodeFromVideoDevice(undefined, video, (result, error, controls) => {
      activeScannerControls = controls;
      if (result) {
        submitBarcode(result.getText());
        return;
      }
      if (error?.name === 'NotAllowedError') {
        status.textContent = 'Camera permission was denied. Paste the barcode manually.';
      } else {
        status.textContent = 'Point the barcode at the camera, or paste it manually.';
      }
    });
    status.textContent = 'Point the barcode at the camera, or paste it manually.';
  } catch (err) {
    console.warn('Barcode scanner unavailable', err);
    stopActiveScanner();
    status.textContent = 'Camera scanning is unavailable here. Paste the barcode manually.';
  }
}

// Seasonal hints (F-35)
function getSeasonName(monthIndex) {
  if ([11, 0, 1].includes(monthIndex)) return 'winter';
  if ([2, 3, 4].includes(monthIndex)) return 'spring';
  if ([5, 6, 7].includes(monthIndex)) return 'summer';
  return 'autumn';
}

function getRegionLabel(coords) {
  const { latitude, longitude } = coords;
  if (latitude >= 38 && latitude <= 40.5 && longitude >= 1 && longitude <= 5) {
    return 'the Balearic Islands';
  }
  if (latitude >= 35 && latitude <= 44 && longitude >= -10 && longitude <= 5) {
    return 'Spain';
  }
  if (latitude >= 35 && latitude <= 72 && longitude >= -25 && longitude <= 45) {
    return 'Europe';
  }
  return 'your area';
}

function buildSeasonalHint(coords, date = new Date()) {
  const season = getSeasonName(date.getMonth());
  const region = getRegionLabel(coords);
  const seasonalProduce = {
    winter: 'citrus, cabbage and root vegetables',
    spring: 'strawberries, asparagus and artichokes',
    summer: 'tomatoes, peppers and stone fruit',
    autumn: 'apples, squash and mushrooms',
  };
  const produce = seasonalProduce[season];
  return `Around ${region}, ${produce} are usually in season in ${season}; for produce-heavy products, check the origin label when Eco data is unknown.`;
}

function persistSeasonalHint(value) {
  try {
    localStorage.setItem(SEASONAL_HINT_KEY, JSON.stringify(value));
  } catch {
    /* localStorage disabled, ignore */
  }
}

function readSeasonalHintState() {
  try {
    const raw = localStorage.getItem(SEASONAL_HINT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setSeasonalHintText(text) {
  if (!els.seasonalHintText) return;
  els.seasonalHintText.textContent = text;
}

function initSeasonalHint() {
  if (!els.seasonalHint) return;
  const saved = readSeasonalHintState();
  if (saved.dismissed) {
    setHidden(els.seasonalHint, true);
    return;
  }
  if (saved.message) {
    setSeasonalHintText(saved.message);
  }
  els.seasonalHintEnable?.addEventListener('click', requestSeasonalLocation);
  els.seasonalHintDismiss?.addEventListener('click', () => {
    persistSeasonalHint({ ...readSeasonalHintState(), dismissed: true });
    setHidden(els.seasonalHint, true);
  });
}

function initCategories() {
  if (!els.categoryBrowser) return;

  initCategoryBrowser(els.categoryBrowser, (selectedCategory) => {
    console.log('[HCI System Feedback] Category changed:', selectedCategory);

    // 'all' clears the category filter and shows the full sample set.
    // Otherwise route the OFF category tag (e.g. "en:cereals") through the
    // categories_tags param so results are scoped correctly, not free-text.
    const categoryTag = selectedCategory === 'all' ? '' : selectedCategory;
    runSearch('', { categoryTag });
  }, t);
}

// Tokenise an OFF *_tags string ("en:milk en:gluten") into bare tokens
// (["milk", "gluten"]). The "en:" / "xx:" language prefix is stripped so we
// compare on the meaningful tag, not the locale.
function tagTokens(tagString) {
  if (!tagString) return [];
  return tagString
    .split(/\s+/)
    .map((token) => token.includes(':') ? token.slice(token.indexOf(':') + 1) : token)
    .filter(Boolean);
}

// Map each allergen chip to the exact OFF allergen tokens it must exclude.
// Matching is EXACT against tokens, never substring, so "coconut" never trips
// the "nuts" filter and "nutmeg" never trips it either.
const ALLERGEN_TOKENS = {
  'no-gluten': ['gluten'],
  'no-lactose': ['milk'],
  'no-nuts': ['nuts', 'peanuts'],
  'no-soy': ['soybeans', 'soya', 'soy'],
  'no-egg': ['eggs'],
  'no-fish': ['fish'],
};

function passesFilters(product, filters) {
  if (!filters || filters.length === 0) return true;

  for (const filterId of filters) {
    // ─── Allergens (F-32): exact token match; '' allergens = unknown, never hide ───
    if (filterId in ALLERGEN_TOKENS) {
      const tokens = tagTokens(product.allergens);
      if (tokens.length === 0) continue; // unknown allergens -> do not exclude
      const banned = ALLERGEN_TOKENS[filterId];
      if (tokens.some((token) => banned.includes(token))) return false;
      continue;
    }

    switch (filterId) {
      // ─── Diet & Ethics ───
      case 'high-protein': {
        // Missing protein data is unknown, not "0" — do not exclude on absence.
        const protein = product.nutrients?.proteins_100g;
        if (protein != null && protein < 8) return false;
        break;
      }

      case 'low-sodium': {
        // Missing salt data is unknown — do not exclude on absence.
        const salt = product.nutrients?.salt_100g;
        if (salt != null && salt > 0.12) return false;
        break;
      }

      case 'plastic-free': {
        // Only hide products whose packaging ACTUALLY indicates plastic.
        // Unknown packaging ('') must NOT be hidden (unknown != plastic).
        const tokens = tagTokens(product.packaging);
        if (tokens.some((token) => token.includes('plastic'))) return false;
        break;
      }

      // ─── Eco (F-20) ───
      case 'low-co2': {
        // Use the eco grade as a CO2 proxy: keep only a/b. Unknown grade is not
        // a value, so do not exclude on absence.
        const grade = product.ecoScore?.grade;
        if (grade && grade !== 'a' && grade !== 'b') return false;
        break;
      }

      case 'organic': {
        // OFF exposes organic via labels_tags (e.g. "en:organic"). If labels
        // data is absent we treat it as unknown and do not exclude — we never
        // invent an "organic" status the API did not provide.
        const tokens = tagTokens(product.labels);
        if (tokens.length === 0) continue; // unknown labels -> do not exclude
        if (!tokens.some((token) => token.includes('organic'))) return false;
        break;
      }
    }
  }

  return true;
}

function initProductFilters() {
  if (!els.filtersBrowser) return;

  initFilters(els.filtersBrowser, (activeFilters) => {
    // 1. Store the currently selected filters
    currentFilters = activeFilters;

    // 2. Telemetry (optional, but useful for HCI evaluation)
    console.log('[HCI System Feedback] Filters applied:', currentFilters);

    // 3. The magic: force the UI to re-render using the products already in memory
    rerenderResults();
  }, t);
}

// --- F-18: usual products stored per category inside foodlens.profile ---

// Canonical shelves, ordered most-specific-first so the right shelf wins when a
// product belongs to several (e.g. soft-drinks vs fruit-juices). These match the
// category chips served from the prebuilt index plus a few common neighbours.
const CANONICAL_SHELVES = [
  'en:yogurts',
  'en:cheeses',
  'en:breads',
  'en:fruit-juices',
  'en:chocolates',
  'en:breakfast-cereals',
  'en:soft-drinks',
  'en:biscuits-and-cakes',
  'en:chips-and-fries',
];

// Normalise a product into a STABLE shelf key so two products on the same shelf
// (e.g. en:emmental and en:cheese-spreads, both under en:cheeses) compare as the
// same "usual" bucket. We scan the product's full categories list for a canonical
// shelf; only when none is present do we fall back to the leaf tag. Missing
// category data is never invented: such products land in a shared "uncategorised"
// bucket so the feature still works without claiming a category the API did not
// provide.
function usualCategoryKey(product) {
  const cats = Array.isArray(product?.categories) ? product.categories : [];
  for (const shelf of CANONICAL_SHELVES) {
    if (cats.includes(shelf)) return shelf;
  }
  const leaf = product?.category;
  return typeof leaf === 'string' && leaf.length > 0 ? leaf : '__uncategorised__';
}

function loadProfileObject() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// Read the per-category usual map, migrating the legacy single-key value once.
function getUsualByCategory() {
  const profile = loadProfileObject();
  const map = profile.usualByCategory && typeof profile.usualByCategory === 'object'
    ? profile.usualByCategory
    : {};

  // One-time migration of the old global key into this category-keyed map.
  try {
    const legacyRaw = localStorage.getItem(LEGACY_USUAL_PRODUCT_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy && legacy.code) {
        const key = usualCategoryKey(legacy);
        if (!map[key]) {
          map[key] = legacy;
          profile.usualByCategory = map;
          try {
            localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
          } catch {
            /* storage disabled, ignore */
          }
        }
      }
      localStorage.removeItem(LEGACY_USUAL_PRODUCT_KEY);
    }
  } catch {
    /* malformed legacy value, ignore */
  }

  return map;
}

// Persist the whole product object under its category key.
function setUsualProduct(productObj) {
  const profile = loadProfileObject();
  const map = profile.usualByCategory && typeof profile.usualByCategory === 'object'
    ? { ...profile.usualByCategory }
    : {};
  map[usualCategoryKey(productObj)] = productObj;
  profile.usualByCategory = map;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage disabled, ignore */
  }
  toast(t('toast.usual_set', 'Saved! Now select a different product to compare.'));
  rerenderFocused();
}

// Return the usual for a given product's category (the focused product's
// category when comparing). Without a category we still expose any single
// stored usual so the legacy/uncategorised case keeps working.
function getUsualProduct(forProduct) {
  const map = getUsualByCategory();
  if (forProduct) {
    return map[usualCategoryKey(forProduct)] || null;
  }
  const entries = Object.values(map);
  return entries.length === 1 ? entries[0] : null;
}

function requestSeasonalLocation() {
  if (!navigator.geolocation) {
    setSeasonalHintText('Location is not available in this browser; you can still compare products with the visible Health and Eco scores.');
    return;
  }
  setSeasonalHintText('Requesting approximate location for a seasonal context note...');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const message = buildSeasonalHint(position.coords);
      persistSeasonalHint({ message, dismissed: false });
      setSeasonalHintText(message);
    },
    () => {
      setSeasonalHintText('Location permission was not granted; manual search and barcode lookup still work normally.');
    },
    { enableHighAccuracy: false, maximumAge: 86400000, timeout: 8000 },
  );
}

// Evaluation forms (F-46)
const EVALUATION_RESULTS_KEY = 'foodlens.evaluationResults';

const SUS_ITEMS = [
  'I think that I would like to use FoodLens frequently.',
  'I found FoodLens unnecessarily complex.',
  'I thought FoodLens was easy to use.',
  'I think that I would need support to use FoodLens.',
  'I found the different FoodLens functions well integrated.',
  'I thought there was too much inconsistency in FoodLens.',
  'I would imagine that most people would learn to use FoodLens quickly.',
  'I found FoodLens cumbersome to use.',
  'I felt confident using FoodLens.',
  'I needed to learn a lot before I could use FoodLens.',
];

const ESS_ITEMS = [
  'The explanation helped me understand why the product was ranked there.',
  'The explanation gave enough detail for the decision I was making.',
  'The explanation was clear.',
  'The explanation made the product comparison feel trustworthy.',
  'The explanation let me judge the Health and Eco trade-off myself.',
  'The explanation used data I could verify.',
];

function readEvaluationResults() {
  try {
    const raw = localStorage.getItem(EVALUATION_RESULTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEvaluationResult(result) {
  const results = readEvaluationResults();
  results.unshift(result);
  localStorage.setItem(EVALUATION_RESULTS_KEY, JSON.stringify(results));
}

function getCheckedValues(form, prefix, count) {
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const checked = form.querySelector(`input[name="${prefix}-${index}"]:checked`);
    if (!checked) return null;
    values.push(Number(checked.value));
  }
  return values;
}

function computeSusScore(values) {
  const raw = values.reduce((sum, value, index) => {
    const isPositiveItem = index % 2 === 0;
    return sum + (isPositiveItem ? value - 1 : 5 - value);
  }, 0);
  return Math.round(raw * 2.5 * 10) / 10;
}

function computeAverage(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

function buildLikertGroup(prefix, index, label) {
  return el(
    'fieldset',
    { class: 'evaluation__item' },
    el('legend', { class: 'evaluation__prompt' }, `${index + 1}. ${label}`),
    el(
      'div',
      { class: 'evaluation__scale', role: 'radiogroup' },
      ...[1, 2, 3, 4, 5].map((value) =>
        el(
          'label',
          { class: 'evaluation__choice' },
          el('input', { type: 'radio', name: `${prefix}-${index}`, value: String(value), required: '' }),
          el('span', { class: 'evaluation__choice-label' }, String(value)),
        ),
      ),
    ),
  );
}

function exportEvaluationResults() {
  const results = readEvaluationResults();
  const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'foodlens-evaluation-results.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderEvaluationView() {
  if (!els.evaluationSection) return;
  clear(els.evaluationSection);

  const resultPanel = el('aside', {
    class: 'evaluation__result',
    role: 'status',
    'aria-live': 'polite',
    hidden: '',
  });

  const form = el(
    'form',
    {
      class: 'evaluation__form',
      onSubmit: (event) => {
        event.preventDefault();
        const susAnswers = getCheckedValues(form, 'sus', SUS_ITEMS.length);
        const explanationAnswers = getCheckedValues(form, 'ess', ESS_ITEMS.length);
        if (!susAnswers || !explanationAnswers) {
          resultPanel.hidden = false;
          resultPanel.textContent = 'Answer every item before scoring the response.';
          return;
        }

        const susScore = computeSusScore(susAnswers);
        const explanationAverage = computeAverage(explanationAnswers);
        saveEvaluationResult({
          createdAt: new Date().toISOString(),
          susAnswers,
          explanationAnswers,
          susScore,
          explanationAverage,
        });

        resultPanel.hidden = false;
        clear(resultPanel);
        resultPanel.append(
          el('p', { class: 'evaluation__result-label' }, 'Current response'),
          el(
            'div',
            { class: 'evaluation__scores' },
            el('p', {}, el('span', {}, 'SUS'), el('strong', {}, susScore.toFixed(1))),
            el('p', {}, el('span', {}, 'Explanation satisfaction'), el('strong', {}, explanationAverage.toFixed(1))),
          ),
        );
      },
    },
    el('h2', { class: 'evaluation__title', tabindex: '-1' }, 'Evaluate FoodLens'),
    el('p', { class: 'evaluation__intro' },
      'Use these WA5 instruments after a participant completes the search, comparison or barcode flow.',
    ),
    el('section', { class: 'evaluation__block', 'aria-labelledby': 'sus-title' },
      el('h3', { id: 'sus-title', class: 'evaluation__section-title' }, 'System Usability Scale'),
      el('p', { class: 'evaluation__hint' }, '1 means strongly disagree. 5 means strongly agree.'),
      ...SUS_ITEMS.map((item, index) => buildLikertGroup('sus', index, item)),
    ),
    el('section', { class: 'evaluation__block', 'aria-labelledby': 'ess-title' },
      el('h3', { id: 'ess-title', class: 'evaluation__section-title' }, 'Explanation Satisfaction Scale'),
      el('p', { class: 'evaluation__hint' }, 'Rate the explanation shown during the task.'),
      ...ESS_ITEMS.map((item, index) => buildLikertGroup('ess', index, item)),
    ),
    el('div', { class: 'evaluation__actions' },
      el('button', { type: 'submit', class: 'btn btn--primary' }, 'Score response'),
      el('button', { type: 'button', class: 'btn btn--ghost', onClick: exportEvaluationResults }, 'Export JSON'),
    ),
  );

  els.evaluationSection.append(form, resultPanel);
}

function updateSavedBadge() {
  if (!els.savedBadge) return;
  const count = getFavourites().length;
  if (count > 0) {
    els.savedBadge.textContent = count;
    els.savedBadge.hidden = false;
    els.savedBadge.setAttribute('aria-hidden', 'false');
  } else {
    els.savedBadge.hidden = true;
    els.savedBadge.setAttribute('aria-hidden', 'true');
  }
}

// ─── Home landing: recently-viewed rail (Phase 2) ─────────────────
// A compact, read-only rail that reuses the existing recently-viewed data
// (loadRecentlyViewed). It is NOT the heavy collapsible widget — Home stays a
// thin orienting screen. The whole rail hides when there is no history.

function renderHomeRecentRail() {
  if (!els.homeRecent || !els.homeRecentRail) return;
  const items = loadRecentlyViewed();
  if (!items || items.length === 0) {
    setHidden(els.homeRecent, true);
    clear(els.homeRecentRail);
    return;
  }
  setHidden(els.homeRecent, false);
  clear(els.homeRecentRail);
  for (const item of items) {
    const figure = item.image
      ? el('img', { class: 'home-tile__thumb', src: item.image, alt: item.name || item.code, loading: 'lazy' })
      : el('span', { class: 'home-tile__thumb home-tile__thumb--placeholder', 'aria-hidden': 'true' }, (item.name || '?')[0]);
    const tile = el(
      'button',
      {
        type: 'button',
        class: 'home-tile',
        'aria-label': `Open ${item.name || item.code}`,
        onClick: () => openProductFromHome(item.code, item),
      },
      figure,
      el('span', { class: 'home-tile__name' }, item.name || item.code),
      // H1: both axes always shown, even unknown/not-applicable.
      el('div', { class: 'home-tile__badges' },
        renderBadge('nutri', { grade: item.healthGrade }),
        renderBadge('eco', { grade: item.ecoGrade }),
      ),
    );
    els.homeRecentRail.appendChild(tile);
  }
}

// Open a product picked from the Home rail: enter /discover lazily (so the
// listing exists behind the deep-dive), then focus the product — focusProduct
// routes to /product (Phase 1). Resolves the product from the in-memory list
// first, then the stored rail item, then a barcode fetch.
async function openProductFromHome(code, item) {
  showView('discover');
  await ensureCatalogueLoaded();
  let product = (lastResults || []).find((p) => p.code === code);
  if (!product) product = await getProductByBarcode(code);
  if (product) {
    focusProduct(product);
  } else if (item && item.code) {
    // No live data for this code (offline / removed) — keep the user on the
    // discover listing rather than a blank product view.
    showView('discover');
  }
}

// ─── view navigation ─────────────────────────────────────────────

let currentView = 'home'; // 'home' | 'discover' | 'saved' | 'evaluation' | 'product' | 'about' | 'compare'

// ─── catalogue lazy-load (Phase 2) ─────────────────────────────────────────
// The catalogue is no longer fetched eagerly on boot. It loads only when the
// user ENTERS /discover (a CTA, the Discover nav, a search submit, a /discover
// deep-link, or a popstate into discover). Idempotent: a guard flag plus a
// "already have results" check prevent a double catalogue load when both a CTA
// and the nav fire. A fresh real search simply replaces lastResults afterwards.
let _catalogueLoaded = false;

async function ensureCatalogueLoaded() {
  if (_catalogueLoaded || lastResults.length > 0) {
    _catalogueLoaded = true;
    return;
  }
  _catalogueLoaded = true;
  // The empty-query branch of runSearch carries the EXACT index/sample-fallback
  // path, so the 503/offline behaviour is preserved.
  await runSearch('');
}

// The discovery-only blocks (search, controls, weighting slider, seasonal hint,
// source badge, recently-viewed, results listing) are toggled as a group so
// Home and /discover own clearly separate regions.
function setDiscoverRegionsHidden(hidden) {
  setHidden(els.searchSection, hidden);
  setHidden(els.controlsBar, hidden);
  setHidden(els.weightingSection, hidden);
  setHidden(els.recentlyViewed, hidden);
  setHidden(els.seasonalHint, hidden);
  setHidden(els.resultsRegion, hidden);
}

// ─── routing ───────────────────────────────────────────────────────────────
// Map view name ↔ URL path. The app keeps a single HTML file (index.html)
// but uses History API so URLs reflect the current view and back/forward work.
const VIEW_PATHS = {
  home: '/',
  discover: '/discover',
  saved: '/saved',
  evaluation: '/evaluation',
  about: '/about',
  compare: '/compare',
  // The product deep-dive is its own routed view. The product is identified by
  // a ?code querystring (e.g. /product?code=NNN), NOT a path segment — this is
  // the lowest-risk option given the served-from-sub-path base-prefix logic.
  product: '/product',
};

function viewFromPath(path) {
  if (!path) return 'home';
  // Tolerate trailing slash and case differences.
  const clean = path.toLowerCase().replace(/\/+$/, '') || '/';
  if (clean === '/discover') return 'discover';
  if (clean === '/saved') return 'saved';
  if (clean === '/evaluation') return 'evaluation';
  if (clean === '/about') return 'about';
  if (clean === '/compare') return 'compare';
  if (clean === '/product') return 'product';
  return 'home'; // "/" and unknown paths land on Home
}

// The focused product's barcode is carried in the querystring, parsed
// separately from viewFromPath (which only reads location.pathname).
function codeFromSearch() {
  return new URLSearchParams(window.location.search).get('code');
}

function pushViewHistory(view, replace = false, code = null) {
  const path = VIEW_PATHS[view] || '/';
  // Preserve the directory prefix if the app is served from a sub-path
  // (e.g. http://localhost:8090/foodlens/). We only override the final segment.
  // /product must be stripped too, otherwise leaving the product view would
  // leave a stale /product in the computed base prefix.
  const base = window.location.pathname.replace(/\/((discover|saved|evaluation|product|about|compare)\/?)?$/i, '') || '';
  const newPath = (base + path).replace(/\/{2,}/g, '/');
  // The product view carries ?code; every other view drops it so search/saved/
  // evaluation never inherit a stale code from a previous product deep-dive.
  const search = view === 'product' && code ? `?code=${encodeURIComponent(code)}` : '';
  const url = newPath + search + window.location.hash;
  // No-op if we already are on this exact URL — avoids polluting the history
  // stack. For the product view, two consecutive products share the same
  // pathname but differ by ?code, so we must compare the search too (otherwise
  // back/forward between products would break).
  const samePath = window.location.pathname.replace(/\/$/, '') === newPath.replace(/\/$/, '');
  const sameSearch = window.location.search === search;
  if (samePath && sameSearch) return;
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({ view, code: code || null }, '', url);
}

function showView(view, opts = {}) {
  const { updateHistory = true, replace = false, code = null, skipFocusedRender = false } = opts;
  currentView = view;

  if (updateHistory) pushViewHistory(view, replace, code);

  // Toggle nav active states. Primary nav is now Home / Discover / Saved /
  // Compare (Evaluate demoted to the footer + /about). aria-current uses the
  // valid "page" token (an empty string is not a valid aria-current value).
  const navItems = [
    { el: els.navHome, view: 'home' },
    { el: els.navDiscover, view: 'discover' },
    { el: els.navSaved, view: 'saved' },
    { el: els.navCompare, view: 'compare' },
  ];
  for (const { el: navEl, view: navView } of navItems) {
    if (!navEl) continue;
    const active = view === navView;
    navEl.classList.toggle('is-active', active);
    if (active) navEl.setAttribute('aria-current', 'page');
    else navEl.removeAttribute('aria-current');
  }

  // The routed /about and /compare regions are <main> siblings: hide them by
  // default for EVERY view, then the matching branch below re-shows its own.
  setHidden(els.compareView, true);

  // Show/hide sections
  if (view === 'home') {
    // Thin orienting landing: show ONLY the hero. No catalogue is loaded here —
    // Home never fetches; entering /discover is what loads the shelf.
    setHidden(els.homeView, false);
    setDiscoverRegionsHidden(true);
    setHidden(els.focusedView, true);
    setHidden(els.favouritesSection, true);
    setHidden(els.evaluationSection, true);
    setHidden(els.sourceBadge, true);
    renderHomeRecentRail();
  } else if (view === 'saved') {
    setHidden(els.homeView, true);
    setHidden(els.resultsRegion, true);
    setHidden(els.focusedView, true);
    setHidden(els.favouritesSection, false);
    setHidden(els.evaluationSection, true);
    renderFavourites(els.favouritesSection, openSavedProductInSearch, () => {
      updateSavedBadge();
      if (currentView === 'saved') {
        renderFavourites(els.favouritesSection, openSavedProductInSearch, () => updateSavedBadge());
      }
    });
  } else if (view === 'evaluation') {
    setHidden(els.homeView, true);
    setHidden(els.resultsRegion, true);
    setHidden(els.focusedView, true);
    setHidden(els.favouritesSection, true);
    setHidden(els.evaluationSection, false);
    renderEvaluationView();
  } else if (view === 'product') {
    // The focused product deep-dive is now its OWN routed view: it owns the
    // screen and hides the listing/saved/evaluation siblings. focusedProduct is
    // set by focusProduct (before this call) or restored by restoreFocusedByCode.
    setHidden(els.homeView, true);
    setHidden(els.resultsRegion, true);
    setHidden(els.favouritesSection, true);
    setHidden(els.evaluationSection, true);
    setHidden(els.focusedView, false);
    // focusProduct already awaited the render; restore/popstate/saved paths did
    // not, so render here unless the caller signals it is already painted.
    if (!skipFocusedRender) rerenderFocused();
  } else if (view === 'compare') {
    // Routed Compare: the promoted comparison render (ranked summary + transposed
    // table + Export CSV). The tray on /discover still accumulates selections.
    setHidden(els.homeView, true);
    setHidden(els.favouritesSection, true);
    setHidden(els.evaluationSection, true);
    setHidden(els.focusedView, true);
    setHidden(els.sourceBadge, true);
    setDiscoverRegionsHidden(true);
    setHidden(els.compareView, false);
    // Reveal the region first, then render so comparison.js finds its DOM nodes.
    renderComparisonView();
  } else {
    // discover (de-overloaded former search view): controls + results listing.
    setHidden(els.homeView, true);
    setHidden(els.favouritesSection, true);
    setHidden(els.evaluationSection, true);
    // #focused is shown ONLY on the product view now — hide it here so the
    // listing view no longer double-renders the deep-dive above the results
    // (the old long-scroll "inline injection" overload).
    setHidden(els.focusedView, true);
    setDiscoverRegionsHidden(false);
    rerenderResults();
  }

  // Micro-UX: move focus to the new view's title so keyboard/SR users are not
  // stranded at the top of the body after a client-side route change. Each title
  // carries tabindex="-1"; preventScroll keeps the viewport stable (the product
  // view does its own gated scrollIntoView).
  focusViewTitle(view);
}

// Map a view to its focusable title node and focus it. Resolves lazily because
// the evaluation / product titles are JS-rendered after showView's branch runs.
function focusViewTitle(view) {
  const selectors = {
    home: '#home-hero-title',
    discover: '#results-title',
    saved: '.saved__title, #favourites h2',
    evaluation: '.evaluation__title',
    product: '#focused .focused-title, #focused h2',
    about: '#about-title',
    compare: '#compare-title',
  };
  const sel = selectors[view];
  if (!sel) return;
  const node = document.querySelector(sel);
  if (!node) return;
  if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
  try {
    node.focus({ preventScroll: true });
  } catch {
    node.focus();
  }
}

// Click on a saved product card: go back to the search view, KEEP the existing
// results list (so the user can still see everything), and focus the picked
// product on top. If the product is not in the current list, fetch it and
// prepend it so the focused card has data to render.
async function openSavedProductInSearch(code) {
  // Ensure the listing has data to return to (first visit / fresh reload while
  // on /saved), so the back-link from the product view lands on a populated
  // list instead of a blank page. We populate lastResults but do NOT switch to
  // the search view first — focusProduct routes straight to /product, avoiding
  // a wasted listing flash.
  if (!lastResults || lastResults.length === 0) {
    lastResults = await getAllSampleProducts();
  }

  let product = lastResults.find((p) => p.code === code);
  if (!product) {
    product = await getProductByBarcode(code);
    if (product) lastResults = [product, ...lastResults];
  }

  if (product) {
    focusProduct(product);
  } else {
    // Unknown code — fall back to the listing gracefully rather than a blank view.
    showView('discover');
    ensureCatalogueLoaded();
  }
}

// Restore the focused product from a barcode (deep-link on load, or back/
// forward to a /product?code entry). Single restore path used by popstate AND
// bootstrap. Never throws on a bad/missing code — falls back to the listing.
async function restoreFocusedByCode(code, { updateHistory = false, replace = false } = {}) {
  if (!code) {
    // Bad/missing code -> graceful listing, no blank page.
    await ensureCatalogueLoaded();
    showView('discover', { updateHistory, replace });
    return;
  }
  // Prefer the in-memory list (no network call, works offline with samples).
  let product = (lastResults || []).find((p) => p.code === code);
  if (!product) {
    try {
      product = await getProductByBarcode(code);
    } catch {
      product = null;
    }
  }
  if (!product) {
    await ensureCatalogueLoaded();
    showView('discover', { updateHistory, replace });
    return;
  }
  focusedProduct = product;
  // The URL is already /product?code on a restore, so do not re-push (the
  // caller decides via updateHistory). _focusedShouldScroll stays false so the
  // viewport is not yanked — restores land at top-of-view.
  showView('product', { updateHistory, replace, code });
}

// ─── event wiring ───────────────────────────────────────────────────────

// Mirror the current theme onto the header toggle's aria-pressed. Pressed = dark.
// CSS swaps the sun/moon icon via [data-theme] on <html>, so no per-icon JS here.
function syncThemeToggle(theme) {
  if (!els.themeToggle) return;
  els.themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
}

function wireEvents() {
  els.searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = els.searchInput.value.trim();
    const ingredient = els.ingredientInput?.value.trim() || '';
    showView('discover');
    runSearch(q, { ingredient });
  });

  // Home CTAs: both enter /discover. "Inspect" focuses the search field; both
  // lazily load the catalogue (idempotent — runs once even if the user clicks
  // both, thanks to the _catalogueLoaded guard).
  els.homeCtaInspect?.addEventListener('click', () => {
    showView('discover');
    ensureCatalogueLoaded();
    els.searchInput?.focus();
  });
  els.homeCtaBrowse?.addEventListener('click', () => {
    showView('discover');
    ensureCatalogueLoaded();
  });

  // H4: the first axis stays health/eco. The price lever remains behind the
  // Settings "Advanced" surface and is intentionally NOT surfaced this iteration
  // (approved) — no price slider on the public weighting control.
  els.weightSlider?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    setWeight(v, null);
    telemetry.send({ event: 'slider_change', value: v });
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const selectedLang = e.currentTarget.dataset.lang;
      setLang(selectedLang);
    });
  });

  for (const btn of els.presetButtons) {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const map = { 'health-first': 90, balanced: 70, 'eco-first': 30 };
      const value = map[preset] ?? 70;
      setWeight(value, preset);
    });
  }

  els.settingsBtn?.addEventListener('click', showSettings);
  // F-18: when a usual is cleared from the settings panel, refresh the focused
  // card so its comparison disappears and it falls back to the category average.
  document.addEventListener('foodlens:usuals-changed', () => { rerenderFocused(); });
  els.scanButton?.addEventListener('click', openBarcodeScanner);

  // Header theme toggle: flips the SAME foodlens.settings.theme the Settings
  // drawer writes. toggleTheme() persists + applies; syncThemeToggle only mirrors
  // the button's aria-pressed (no re-write, so no infinite loop).
  els.themeToggle?.addEventListener('click', () => {
    const next = toggleTheme();
    syncThemeToggle(next);
  });
  // Keep the header button in sync when the theme changes from the drawer radios.
  document.addEventListener('foodlens:theme-changed', (e) => {
    syncThemeToggle(e.detail?.theme);
  });

  // comparison.js dispatches this instead of importing app.js (one-way import:
  // app.js imports comparison.js, never the reverse). Routes to /compare.
  document.addEventListener('foodlens:open-compare', () => showView('compare'));

  // Nav anchors are real <a href> for progressive enhancement (open-in-new-tab
  // pre-routes to the correct URL). Intercept plain left-clicks for the History
  // API; let modified clicks / middle-clicks fall through to the browser.
  const interceptNav = (anchor, run) => {
    anchor?.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      run();
    });
  };
  interceptNav(els.navHome, () => showView('home'));
  interceptNav(els.navDiscover, () => { showView('discover'); ensureCatalogueLoaded(); });
  interceptNav(els.navSaved, () => showView('saved'));
  interceptNav(els.navCompare, () => showView('compare'));

  // About + Evaluate entry points (home link, footer links, in-about link).
  const openAboutModal = () => { els.aboutModal?.showModal(); };
  interceptNav(els.homeAboutLink, openAboutModal);
  interceptNav(els.footerAboutLink, openAboutModal);
  els.aboutTrigger?.addEventListener('click', openAboutModal);
  
  els.closeAboutModal?.addEventListener('click', () => { els.aboutModal?.close(); });
  els.aboutModal?.addEventListener('click', (e) => {
    const dim = els.aboutModal.getBoundingClientRect();
    if (e.clientX < dim.left || e.clientX > dim.right || e.clientY < dim.top || e.clientY > dim.bottom) els.aboutModal.close();
  });

  interceptNav(els.footerEvalLink, () => showView('evaluation'));
  interceptNav(els.aboutEvalLink, () => showView('evaluation'));
  els.compareBackBtn?.addEventListener('click', () => { showView('discover'); ensureCatalogueLoaded(); });

  // Re-render the JS-built Home rail title/tiles on language change, mirroring
  // categories.js / filters.js. The hero/CTAs use data-i18n(-html) so updateDOM
  // handles them automatically.
  window.addEventListener('languageChanged', () => {
    // Re-render the views whose generated text (contrastive sentence, deltas) is
    // built in JS rather than via data-i18n, so it follows the new language.
    if (currentView === 'home') renderHomeRecentRail();
    else if (currentView === 'discover') rerenderResults();
    else if (currentView === 'product' && focusedProduct) rerenderFocused();
  });

  // Back/forward buttons: read the URL and switch view without pushing again.
  window.addEventListener('popstate', async () => {
    const target = viewFromPath(window.location.pathname);
    if (target === 'product') {
      await ensureCatalogueLoaded();
      await restoreFocusedByCode(codeFromSearch(), { updateHistory: false });
    } else if (target === 'discover') {
      await ensureCatalogueLoaded();
      showView('discover', { updateHistory: false });
    } else {
      showView(target, { updateHistory: false });
    }
  });
}

// ─── telemetry consent banner (F-45) ───────────────────────────────────

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const host = location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  if (isLocal) {
    // This project only ever runs locally. Never register the SW, and tear
    // down any registration + caches left from a previous visit so edits to
    // app.js / style.css are never served stale.
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((reg) => reg.unregister()));
    if (window.caches) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  });
}

function renderTelemetryBanner() {
  // Only show if the user hasn't decided yet.
  if (localStorage.getItem(TELEMETRY_KEY) !== null) return;

  const banner = el(
    'aside',
    { class: 'telemetry-banner', role: 'complementary', 'aria-label': 'Usage tracking consent' },
    el(
      'p',
      { class: 'telemetry-banner__text' },
      'Help improve FoodLens: allow anonymous usage tracking? ',
      el('span', { class: 'telemetry-banner__detail' },
        '(decision time, clicked alternatives, slider changes — no personal data)',
      ),
    ),
    el(
      'div',
      { class: 'telemetry-banner__actions' },
      el('button', {
        type: 'button',
        class: 'btn btn--primary btn--sm',
        onClick: () => {
          telemetry.optIn();
          banner.remove();
          toast('Usage tracking enabled. Thank you!');
        },
      }, 'Allow'),
      el('button', {
        type: 'button',
        class: 'btn btn--ghost btn--sm',
        onClick: () => {
          telemetry.optOut();
          banner.remove();
        },
      }, 'No thanks'),
    ),
  );

  document.body.appendChild(banner);
}

// ─── bootstrap ─────────────────────────────────────────────────────────

async function bootstrap() {
  _loadSettings();
  initI18n();
  registerServiceWorker();
  initTooltips();
  applyWeightToUI();
  wireEvents();
  initSeasonalHint();
  initOnboarding();
  initCategories();
  initProductFilters();
  // Suppress all trackView calls during bootstrap so a deep-link restore never
  // records a product as "recently viewed".
  startBootstrap();
  renderTelemetryBanner();

  // Phase 2: the catalogue is NOT loaded eagerly. Home ("/") is a thin landing
  // that fetches nothing; the shelf loads only when the user enters /discover.
  // The recently-viewed widget renders empty on first visit (it self-hides).
  renderRecentlyViewed(els.recentlyViewed, (code) => runSearch(code));

  // NOW end bootstrap so real user navigation (product clicks) tracks.
  endBootstrap();

  // Route to the view the URL indicates. replace:true so we don't add a junk
  // entry at the start of the history.
  const initialView = viewFromPath(window.location.pathname);
  if (initialView === 'product') {
    // Deep link to a product. Load the catalogue first so restoreFocusedByCode
    // usually resolves in-memory (and the listing exists behind the deep-dive).
    await ensureCatalogueLoaded();
    await restoreFocusedByCode(codeFromSearch(), { updateHistory: true, replace: true });
  } else if (initialView === 'discover') {
    // Deep link to /discover: load the shelf, then show the listing.
    await ensureCatalogueLoaded();
    showView('discover', { replace: true });
  } else if (initialView === 'saved' || initialView === 'evaluation' || initialView === 'compare') {
    // Saved / Evaluation / Compare: no catalogue load needed. Compare
    // renders from the (initially empty) tray selection.
    showView(initialView, { replace: true });
  } else if (initialView === 'about') {
    // Redirige enlaces directos a /about mostrando la Home y abriendo el modal
    showView('home', { replace: true });
    els.aboutModal?.showModal();
  } else {
    // "/" and unknown paths → Home. No catalogue load.
    showView('home', { replace: true });
  }

  // Keep the header theme toggle's aria-pressed in step with the restored theme.
  syncThemeToggle(getTheme());

  // Initialize saved badge count
  updateSavedBadge();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
