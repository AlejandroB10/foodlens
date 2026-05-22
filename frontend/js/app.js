// FoodLens entrypoint. Wires the DOM to the api, xai and rendering layers.
// Keeps state in a single object that survives the session via localStorage.

import {
  getProductByBarcode,
  searchProducts,
  getAllSampleProducts,
  getAlternativesFromBackend,
  getExplainFromBackend,
  getCategoryScatter,
  postTelemetryEvent,
} from './api.js';
import {
  generateContrastiveSentence,
  buildCategoryAverageReference,
  weightedNutrientDistance,
  formatAlternativeDelta,
} from './xai.js';
import { init as initOnboarding } from './views/onboarding.js';
import { trackView, renderRecentlyViewed, startBootstrap, endBootstrap, RECENTLY_VIEWED_KEY } from './views/history.js';
import { loadSettings as _loadSettings, show as showSettings } from './views/settings.js';
import { init as initTooltips } from './views/tooltips.js';
import { toggleFavourite, isFavourite, getFavourites, renderFavourites, buildHeartButton, clearFavourites } from './views/favourites.js';

const STORAGE_KEY = 'foodlens.state';
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

const state = loadState();
let lastResults = [];
let focusedProduct = null;

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

// ─── DOM lookups ──────────────────────────────────────────────────────

const els = {
  searchForm: document.querySelector('#search-form'),
  searchInput: document.querySelector('#search-input'),
  ingredientInput: document.querySelector('#ingredient-input'),
  resultsRegion: document.querySelector('#results'),
  resultsList: document.querySelector('#results-list'),
  resultsCount: document.querySelector('#results-count'),
  sourceBadge: document.querySelector('#source-badge'),
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
  navSearch: document.querySelector('#nav-search'),
  navSaved: document.querySelector('#nav-saved'),
  savedBadge: document.querySelector('#saved-badge'),
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
  const axisName = scope === 'nutri' ? 'Nutri-Score' : 'Eco';
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
    el('thead', {}, el('tr', {}, el('th', {}, 'Per 100g'), el('th', {}, ''))),
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
function printFocusedCard() {
  const focused = document.getElementById('focused');
  if (!focused) {
    window.print();
    return;
  }
  const detailsList = focused.querySelectorAll('details');
  const wasOpen = new Map();
  detailsList.forEach((d) => {
    wasOpen.set(d, d.hasAttribute('open'));
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

  // Give the browser one frame to flush the open state into layout
  // before opening the print dialog.
  requestAnimationFrame(() => window.print());
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
    el('summary', { class: 'card__advanced-summary' }, 'Advanced explanation (SHAP)'),
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
    const canvas = el('canvas', { class: 'card__shap-canvas', 'aria-label': 'SHAP feature contributions' });
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

  const canvas = el('canvas', { 'aria-label': `Nutri-Score vs Eco-Score scatter for ${scatterData.category}` });
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
  const sameCategory = products.filter((p) => p.code !== product.code && p.category === product.category);
  if (sameCategory.length >= 2) {
    return buildCategoryAverageReference(sameCategory, product.category);
  }
  return null;
}

function renderProductCard(product, reference, isAlternative = false) {
  const { sentence } = generateContrastiveSentence(product, reference);

  const figure = product.image
    ? el('img', { class: 'card__image', src: product.image, alt: product.name || product.code, loading: 'lazy' })
    : el('div', { class: 'card__image card__image--placeholder', 'aria-hidden': 'true' }, product.name?.[0] || '?');

  return el(
    'article',
    { class: `card${isAlternative ? ' card--alt' : ''}`, dataset: { code: product.code } },
    el(
      'header',
      { class: 'card__header' },
      figure,
      el(
        'div',
        { class: 'card__title-block' },
        el('h3', { class: 'card__title' }, product.name || 'Unnamed product'),
        product.brands.length > 0
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
    el(
      'details',
      { class: 'card__drilldown' },
      el('summary', {}, 'See numbers'),
      renderNutrientTable(product.nutrients),
    ),
    !isAlternative ? renderAdvancedToggle(product) : null,
    !isAlternative
      ? el(
          'div',
          { class: 'card__actions' },
          buildHeartButton(product.code, product, () => {
            // re-render all heart buttons on page to reflect new favourite state
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
          }),
          el(
            'button',
            { type: 'button', class: 'btn btn--print', onClick: () => printFocusedCard() },
            'Print card',
          ),
          el(
            'button',
            { type: 'button', class: 'btn btn--share', onClick: () => shareProduct(product) },
            'Share product',
          ),
          el(
            'button',
            { type: 'button', class: 'btn btn--ghost', onClick: () => toast('Recipe view coming soon (F-17).') },
            'See recipe',
          ),
          el(
            'button',
            { type: 'button', class: 'btn btn--ghost', onClick: () => toast('Shopping list coming soon (F-17).') },
            'Add to list',
          ),
          el(
            'button',
            { type: 'button', class: 'btn btn--primary', onClick: () => toast('Compare with usual coming soon (F-18).') },
            'Compare with usual',
          ),
        )
      : null,
  );
}

function renderAlternativeCard(product, alternative) {
  const delta = formatAlternativeDelta(product, alternative);
  return el(
    'article',
    {
      class: 'alt-card',
      dataset: { code: alternative.code },
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

function focusProduct(product, { skipTrack = false } = {}) {
  // decision_time: ms from search completion to product selection (F-45).
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
  rerenderFocused();
}

async function rerenderFocused() {
  if (!focusedProduct) {
    setHidden(els.focusedView, true);
    return;
  }
  const reference = pickReference(focusedProduct, lastResults);
  const [alternatives, scatterData] = await Promise.all([
    computeAlternatives(focusedProduct, lastResults),
    getCategoryScatter(focusedProduct.category),
  ]);

  setHidden(els.focusedView, false);
  clear(els.focusedView);

  els.focusedView.appendChild(
    el('h2', { class: 'section__title' }, 'Selected product'),
  );
  els.focusedView.appendChild(renderProductCard(focusedProduct, reference, false));

  if (alternatives.length > 0) {
    els.focusedView.appendChild(
      el('h3', { class: 'section__subtitle' }, 'Better alternatives in this category'),
    );
    const grid = el('div', { class: 'alt-grid' });
    for (const alt of alternatives) {
      grid.appendChild(renderAlternativeCard(focusedProduct, alt));
    }
    els.focusedView.appendChild(grid);
  } else {
    els.focusedView.appendChild(
      el('p', { class: 'alt-grid__empty' }, 'This is already among the best in its category.'),
    );
  }

  // Scatter plot (F-43) — only when backend has category data.
  if (scatterData) {
    els.focusedView.appendChild(
      el('h3', { class: 'section__subtitle' }, 'Health vs Eco in this category'),
    );
    els.focusedView.appendChild(
      el('p', { class: 'section__hint' }, 'Top-right corner = best on both axes. The orange star is this product.'),
    );
    const chartWrap = el('div', { class: 'scatter-wrap' });
    els.focusedView.appendChild(chartWrap);
    try {
      await renderScatterPlot(chartWrap, scatterData, focusedProduct);
    } catch {
      chartWrap.appendChild(
        el('p', { class: 'section__hint' }, 'Chart library could not load, but the product scores above are still available.'),
      );
    }
  }

  els.focusedView.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

function rerenderResults() {
  if (!els.resultsList) return;
  clear(els.resultsList);
  const ranked = [...lastResults];
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
      if (e.target.closest('button, a, summary, details, input, [role="button"]')) return;
      focusProduct(product);
    });
    els.resultsList.appendChild(card);
  }
  if (els.resultsCount) {
    els.resultsCount.textContent = lastResults.length === 0
      ? 'No results'
      : `${lastResults.length} ${lastResults.length === 1 ? 'result' : 'results'}`;
  }
  setHidden(els.emptyState, lastResults.length > 0);
  if (els.sourceBadge) {
    const isSample = lastResults.some((p) => p.source === 'sample');
    els.sourceBadge.hidden = !isSample;
  }
}

// ─── search ────────────────────────────────────────────────────────────

async function runSearch(query, opts = {}) {
  const ingredient = (opts.ingredient || '').trim();
  setHidden(els.loading, false);
  try {
    let results;
    if (/^\d{8,13}$/.test(query)) {
      const single = await getProductByBarcode(query);
      results = single ? [single] : [];
      if (single) {
        trackView(single.code, single);
        renderRecentlyViewed(els.recentlyViewed, (code) => runSearch(code));
      }
    } else if (query || ingredient) {
      results = await searchProducts(query, { ingredient });
    } else {
      results = await getAllSampleProducts();
    }
    lastResults = results || [];
    _searchCompletedAt = Date.now();
    rerenderResults();
    if (lastResults.length > 0) {
      // Auto-focus the top-ranked product so reasoning is visible (H2).
      focusProduct(lastResults[0]);
    } else {
      focusedProduct = null;
      setHidden(els.focusedView, true);
    }
  } finally {
    setHidden(els.loading, true);
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
    showView('search');
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
    if (e.key === 'Escape') closeDialog();
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

// ─── view navigation ─────────────────────────────────────────────

let currentView = 'search'; // 'search' | 'saved'

// ─── routing ───────────────────────────────────────────────────────────────
// Map view name ↔ URL path. The app keeps a single HTML file (index.html)
// but uses History API so URLs reflect the current view and back/forward work.
const VIEW_PATHS = {
  search: '/',
  saved: '/saved',
};

function viewFromPath(path) {
  if (!path) return 'search';
  // Tolerate trailing slash and case differences.
  const clean = path.toLowerCase().replace(/\/+$/, '') || '/';
  if (clean === '/saved') return 'saved';
  return 'search';
}

function pushViewHistory(view, replace = false) {
  const path = VIEW_PATHS[view] || '/';
  // Preserve the directory prefix if the app is served from a sub-path
  // (e.g. http://localhost:8090/foodlens/). We only override the final segment.
  const base = window.location.pathname.replace(/\/(saved\/?)?$/i, '') || '';
  const newPath = (base + path).replace(/\/{2,}/g, '/');
  const url = newPath + window.location.search + window.location.hash;
  // No-op if we already are on this URL — avoids polluting the history stack.
  if (window.location.pathname.replace(/\/$/, '') === newPath.replace(/\/$/, '')) return;
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({ view }, '', url);
}

function showView(view, opts = {}) {
  const { updateHistory = true, replace = false } = opts;
  currentView = view;

  if (updateHistory) pushViewHistory(view, replace);

  // Toggle nav active states
  if (els.navSearch) {
    els.navSearch.classList.toggle('is-active', view === 'search');
    els.navSearch.setAttribute('aria-pressed', view === 'search' ? 'true' : 'false');
  }
  if (els.navSaved) {
    els.navSaved.classList.toggle('is-active', view === 'saved');
    els.navSaved.setAttribute('aria-pressed', view === 'saved' ? 'true' : 'false');
  }

  // Show/hide sections
  if (view === 'saved') {
    setHidden(els.resultsRegion, true);
    setHidden(els.focusedView, true);
    setHidden(els.favouritesSection, false);
    renderFavourites(els.favouritesSection, openSavedProductInSearch, () => {
      updateSavedBadge();
      if (currentView === 'saved') {
        renderFavourites(els.favouritesSection, openSavedProductInSearch, () => updateSavedBadge());
      }
    });
  } else {
    setHidden(els.favouritesSection, true);
    setHidden(els.resultsRegion, false);
    rerenderResults();
  }
}

// Click on a saved product card: go back to the search view, KEEP the existing
// results list (so the user can still see everything), and focus the picked
// product on top. If the product is not in the current list, fetch it and
// prepend it so the focused card has data to render.
async function openSavedProductInSearch(code) {
  showView('search');

  // If the results list is empty (first visit / fresh reload while on /saved),
  // restore the sample-products view so the user is not dumped on a blank page.
  if (!lastResults || lastResults.length === 0) {
    lastResults = await getAllSampleProducts();
  }

  let product = lastResults.find((p) => p.code === code);
  if (!product) {
    product = await getProductByBarcode(code);
    if (product) lastResults = [product, ...lastResults];
  }

  rerenderResults();
  if (product) {
    focusProduct(product);
  }
}

// ─── event wiring ───────────────────────────────────────────────────────

function wireEvents() {
  els.searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = els.searchInput.value.trim();
    const ingredient = els.ingredientInput?.value.trim() || '';
    showView('search');
    runSearch(q, { ingredient });
  });

  els.weightSlider?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    setWeight(v, null);
    telemetry.send({ event: 'slider_change', value: v });
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
  els.scanButton?.addEventListener('click', openBarcodeScanner);
  els.navSearch?.addEventListener('click', () => showView('search'));
  els.navSaved?.addEventListener('click', () => showView('saved'));

  // Back/forward buttons: read the URL and switch view without pushing again.
  window.addEventListener('popstate', () => {
    const target = viewFromPath(window.location.pathname);
    showView(target, { updateHistory: false });
  });
}

// ─── telemetry consent banner (F-45) ───────────────────────────────────

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
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
  registerServiceWorker();
  initTooltips();
  applyWeightToUI();
  wireEvents();
  initOnboarding();

  // Suppress all trackView calls during bootstrap so no sample product
  // (loaded via runSearch('')) gets recorded as "recently viewed".
  startBootstrap();
  renderTelemetryBanner();
  // Show all sample products on first load so the UI is never empty.
  await runSearch('');

  renderRecentlyViewed(els.recentlyViewed, (code) => runSearch(code));
  if (lastResults.length > 0) {
    focusProduct(lastResults[0], { skipTrack: true });
  }

  // NOW end bootstrap so real user navigation (product clicks) tracks.
  endBootstrap();

  // Route to the view the URL indicates (e.g. someone opens /saved directly).
  // replace:true so we don't add a junk entry at the start of the history.
  const initialView = viewFromPath(window.location.pathname);
  if (initialView !== 'search') {
    showView(initialView, { replace: true });
  } else {
    // Make sure the initial state has { view: 'search' } so popstate works.
    pushViewHistory('search', true);
  }

  // Initialize saved badge count
  updateSavedBadge();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
