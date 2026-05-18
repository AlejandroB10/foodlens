// FoodLens F-25 — Recently Viewed History
// Vanilla JS, no build step. ES modules.

export const RECENTLY_VIEWED_KEY = 'foodlens.recentlyViewed';
const MAX_ITEMS = 10;

// ─── bootstrap guard ─────────────────────────────────────────────────────────
// Flag set to true during bootstrap so trackView() can detect we're still in
// the initial sample-product load and skip recording those products.
let _bootstrapping = false;

/**
 * Return true if we're still bootstrapping (initial sample products loading).
 * trackView() calls this to decide whether to skip the call.
 */
export function isBootstrapping() {
  return _bootstrapping;
}

/**
 * Mark the start of bootstrap.  trackView() will skip all calls while this
 * flag is true.  Call endBootstrap() once bootstrap finishes.
 */
export function startBootstrap() {
  _bootstrapping = true;
}

/**
 * Mark the end of bootstrap.  trackView() will resume normal operation.
 */
export function endBootstrap() {
  _bootstrapping = false;
}

// ─── storage ─────────────────────────────────────────────────────────────────

/**
 * Load recently viewed list from localStorage.
 * Returns [] if absent or malformed.
 */
export function loadRecentlyViewed() {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Persist recently viewed list to localStorage.
 */
function saveRecentlyViewed(items) {
  try {
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(items));
  } catch {
    /* localStorage full or disabled */
  }
}

// ─── core logic ──────────────────────────────────────────────────────────────

/**
 * Track a product view. Called by app.js after a product is successfully loaded.
 *
 * @param {string} code        — product barcode
 * @param {object} productData — { code, name, image, nutriScore, ecoScore }
 */
// Guard: skip tracking during bootstrap's sample-product load.
export function trackView(code, productData) {
  if (!code || !productData) return;
  if (_bootstrapping) return;

  const items = loadRecentlyViewed();

  // Remove if already present (will be re-added at top)
  const existing = items.findIndex((i) => i.code === code);
  if (existing !== -1) items.splice(existing, 1);

  // Pick the primary brand from whichever shape the caller passes.
  let brand = null;
  if (typeof productData.brand === 'string') brand = productData.brand;
  else if (Array.isArray(productData.brands) && productData.brands.length) brand = productData.brands[0];
  else if (typeof productData.brands === 'string' && productData.brands) brand = productData.brands.split(',')[0].trim();

  // Prepend new entry
  items.unshift({
    code,
    name: productData.name || productData.product_name || 'Unnamed product',
    brand: brand || null,
    image: productData.image || productData.image_small_url || null,
    healthGrade: productData.nutriScore?.grade ?? 'unknown',
    ecoGrade: productData.ecoScore?.grade ?? 'unknown',
    viewedAt: Date.now(),
  });

  // Trim to MAX_ITEMS
  if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;

  saveRecentlyViewed(items);
}

/**
 * Clear all recently viewed history.
 */
export function clearHistory() {
  try {
    localStorage.removeItem(RECENTLY_VIEWED_KEY);
  } catch {
    /* ignore */
  }
}

// ─── DOM helpers (mirror app.js / onboarding.js style) ───────────────────────

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

// ─── badge renderer (copied from app.js — kept in sync) ───────────────────────

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

function renderBadge(scope, score) {
  const grade = score?.grade || score || 'unknown';
  const color = scope === 'nutri' ? NUTRI_COLORS[grade] : ECO_COLORS[grade];
  const label = GRADE_LABELS[grade] || '?';
  const axisName = scope === 'nutri' ? 'Nutri' : 'Eco';
  return el(
    'div',
    {
      class: `badge badge--${scope} badge--grade-${grade} badge--mini`,
      style: { '--badge-color': color },
    },
    el('span', { class: 'badge__axis' }, axisName),
    el('span', { class: 'badge__letter' }, label),
  );
}

// Lightweight relative-time formatter — no Intl.RelativeTimeFormat dep.
function formatTimeAgo(ts) {
  if (!ts) return '';
  const now = Date.now();
  const diff = Math.max(0, now - ts);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 30) return 'just now';
  if (seconds < 60) return seconds + 's ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── rendering ───────────────────────────────────────────────────────────────

let isExpanded = false;

function buildItemImage(image, name) {
  if (image) {
    return el('img', {
      class: 'recent-item__thumb',
      src: image,
      alt: name,
      loading: 'lazy',
      onError: (e) => {
        // Fall back to placeholder on broken image
        e.target.replaceWith(buildPlaceholder(name));
      },
    });
  }
  return buildPlaceholder(name);
}

function buildPlaceholder(name) {
  const initial = (name || '?')[0].toUpperCase();
  return el('span', { class: 'recent-item__placeholder' }, initial);
}

function buildHistoryItem(item, onOpen, index) {
  const ordinal = String(index + 1).padStart(2, '0');
  return el(
    'li',
    {
      class: 'recent-item',
      role: 'listitem',
      dataset: { code: item.code },
      onClick: () => onOpen(item.code),
      onKeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(item.code);
        }
      },
      tabindex: '0',
      'aria-label': item.name,
    },
    el('span', { class: 'recent-item__ordinal', 'aria-hidden': 'true' }, ordinal),
    el('div', { class: 'recent-item__image-wrap' }, buildItemImage(item.image, item.name)),
    el('div', { class: 'recent-item__body' },
      el('span', { class: 'recent-item__name' }, item.name),
      item.brand
        ? el('span', { class: 'recent-item__brand' }, item.brand)
        : null,
    ),
    el('div', { class: 'recent-item__badges' },
      renderBadge('nutri', item.healthGrade),
      renderBadge('eco', item.ecoGrade),
    ),
    el('span', { class: 'recent-item__time' }, formatTimeAgo(item.viewedAt || item.savedAt)),
  );
}

/**
 * Render the full recently-viewed section.
 * Mounts inside the provided container element.
 *
 * @param {HTMLElement} container
 * @param {function} onOpenProduct — callback(code) when user clicks an entry
 */
export function renderRecentlyViewed(container, onOpenProduct) {
  if (!container) return;

  const items = loadRecentlyViewed();

  // No items → hide section
  if (items.length === 0) {
    container.innerHTML = '';
    container.hidden = true;
    container.classList.remove('is-expanded');
    return;
  }

  container.hidden = false;

  // Ensure the container has the right base structure
  if (!container.querySelector('.recently-viewed__header')) {
    // First render — build full structure
    container.innerHTML = '';
    container.setAttribute('aria-label', 'Recently viewed products');

    // Header — two independent buttons inside an <header>, never button-in-button.
    const toggleBtn = el('button', {
      type: 'button',
      class: 'recently-viewed__toggle',
      'aria-expanded': 'true',
      'aria-controls': 'recently-viewed-list',
    },
      el('span', { class: 'recently-viewed__chevron', 'aria-hidden': 'true',
        html: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 8,11 13,6"/></svg>',
      }),
      el('span', { class: 'recently-viewed__title' }, 'Recently viewed'),
      el('span', { class: 'recently-viewed__count' }, `(${items.length})`),
    );
    toggleBtn.addEventListener('click', () => {
      isExpanded = !isExpanded;
      container.classList.toggle('is-expanded', isExpanded);
      toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    });

    const clearBtn = el('button', {
      type: 'button',
      class: 'recently-viewed__clear',
      'aria-label': 'Clear history',
      onClick: (e) => {
        e.stopPropagation();
        clearHistory();
        renderRecentlyViewed(container, onOpenProduct);
      },
    }, 'Clear');

    const header = el('header', { class: 'recently-viewed__header' }, toggleBtn, clearBtn);

    // Clicking anywhere on the header (the toggle area but also the gap
    // between toggle and clear) collapses/expands — except the Clear button.
    header.addEventListener('click', (e) => {
      if (e.target.closest('.recently-viewed__clear')) return;
      if (e.target.closest('.recently-viewed__toggle')) return; // already handled
      toggleBtn.click();
    });

    // List
    const list = el('ol', { id: 'recently-viewed-list', class: 'recently-viewed__list', role: 'list' });

    container.appendChild(header);
    container.appendChild(list);

    // Expand on first render
    isExpanded = true;
    container.classList.add('is-expanded');
  }

  // Update list contents
  const list = container.querySelector('.recently-viewed__list');
  const countEl = container.querySelector('.recently-viewed__count');
  if (countEl) countEl.textContent = `(${items.length})`;

  list.innerHTML = '';
  items.forEach((item, index) => {
    list.appendChild(buildHistoryItem(item, onOpenProduct, index));
  });
}