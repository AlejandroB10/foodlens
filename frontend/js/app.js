// FoodLens entrypoint. Wires the DOM to the api, xai and rendering layers.
// Keeps state in a single object that survives the session via localStorage.

import {
  getProductByBarcode,
  searchProducts,
  getAllSampleProducts,
  getAlternativesFromBackend,
  getExplainFromBackend,
  getCategoryScatter,
} from './api.js';
import {
  generateContrastiveSentence,
  buildCategoryAverageReference,
  weightedNutrientDistance,
  formatAlternativeDelta,
} from './xai.js';

const STORAGE_KEY = 'foodlens.state';
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

// ─── DOM lookups ──────────────────────────────────────────────────────

const els = {
  searchForm: document.querySelector('#search-form'),
  searchInput: document.querySelector('#search-input'),
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

  return el(
    'div',
    { class: `badge badge--${scope} badge--grade-${grade}`, style: { '--badge-color': color } },
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

// ─── SHAP waterfall chart (F-24) ──────────────────────────────────────

const _shapChartInstances = new WeakMap();

function renderShapChart(canvas, shapData) {
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
    renderShapChart(canvas, wf);
  });

  return details;
}

// ─── Nutri × Eco scatter plot (F-43) ──────────────────────────────────

const _scatterChartInstances = new WeakMap();

function renderScatterPlot(container, scatterData, focusedProduct) {
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
      onClick: () => focusProduct(alternative),
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

function focusProduct(product) {
  focusedProduct = product;
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
    renderScatterPlot(chartWrap, scatterData, focusedProduct);
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

async function runSearch(query) {
  setHidden(els.loading, false);
  try {
    let results;
    if (/^\d{8,13}$/.test(query)) {
      const single = await getProductByBarcode(query);
      results = single ? [single] : [];
    } else if (query) {
      results = await searchProducts(query);
    } else {
      results = await getAllSampleProducts();
    }
    lastResults = results || [];
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

// ─── event wiring ───────────────────────────────────────────────────────

function wireEvents() {
  els.searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = els.searchInput.value.trim();
    runSearch(q);
  });

  els.weightSlider?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    setWeight(v, null);
  });

  for (const btn of els.presetButtons) {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const map = { 'health-first': 90, balanced: 70, 'eco-first': 30 };
      const value = map[preset] ?? 70;
      setWeight(value, preset);
    });
  }
}

// ─── bootstrap ─────────────────────────────────────────────────────────

async function bootstrap() {
  applyWeightToUI();
  wireEvents();
  // Show all sample products on first load so the UI is never empty.
  await runSearch('');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
