// FoodLens F-26 — Favourites / Saved Products
// Vanilla JS, no build step. ES modules.

export const FAVOURITES_KEY = 'foodlens.favourites';

// ─── storage ─────────────────────────────────────────────────────────────────

/**
 * Load favourites list from localStorage.
 * Returns [] if absent or malformed.
 */
export function getFavourites() {
  try {
    const raw = localStorage.getItem(FAVOURITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Persist favourites list to localStorage.
 */
function saveFavourites(items) {
  try {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(items));
  } catch {
    /* localStorage full or disabled */
  }
}

// ─── core logic ──────────────────────────────────────────────────────────────

/**
 * Toggle a product in/out of favourites.
 *
 * @param {string} code        — product barcode
 * @param {object} productData — { code, name, image, healthGrade, ecoGrade }
 * @returns {boolean}          — true if now saved, false if removed
 */
export function toggleFavourite(code, productData) {
  if (!code || !productData) return false;

  const items = getFavourites();
  const existing = items.findIndex((i) => i.code === code);

  if (existing !== -1) {
    // Already saved — remove it
    items.splice(existing, 1);
    saveFavourites(items);
    return false;
  }

  // Not saved — add it (newest first)
  items.unshift({
    code,
    name: productData.name || productData.product_name || 'Unnamed product',
    image: productData.image || productData.image_small_url || null,
    healthGrade: productData.healthGrade ?? productData.nutriScore?.grade ?? 'unknown',
    ecoGrade: productData.ecoGrade ?? productData.ecoScore?.grade ?? 'unknown',
    savedAt: Date.now(),
  });

  saveFavourites(items);
  return true;
}

/**
 * Return true if the product code is currently saved.
 *
 * @param {string} code
 * @returns {boolean}
 */
export function isFavourite(code) {
  if (!code) return false;
  return getFavourites().some((i) => i.code === code);
}

/**
 * Clear all saved products.
 */
export function clearFavourites() {
  try {
    localStorage.removeItem(FAVOURITES_KEY);
  } catch {
    /* ignore */
  }
}

// ─── DOM helpers (mirrors app.js / history.js style) ────────────────────────

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

// ─── badge renderer (mirrored from app.js — kept in sync) ───────────────────

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
  return el(
    'span',
    { class: `badge badge--${scope} badge--grade-${grade}`, style: { '--badge-color': color } },
    label,
  );
}

// ─── heart button ───────────────────────────────────────────────────────────

const HEART_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
</svg>`;

/**
 * Build a heart toggle button for a product.
 *
 * @param {string} code
 * @param {object} productData — full product object (for toggleFavourite)
 * @param {function} onToggle  — called after toggle with (code, nowSaved)
 * @returns {HTMLElement}
 */
export function buildHeartButton(code, productData, onToggle) {
  const saved = isFavourite(code);
  const btn = el('button', {
    type: 'button',
    class: `heart-btn${saved ? ' is-saved' : ''}`,
    'aria-label': saved ? 'Remove from saved' : 'Save product',
    'aria-pressed': saved ? 'true' : 'false',
  });
  btn.innerHTML = HEART_SVG;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const nowSaved = toggleFavourite(code, productData);
    // Update visual state
    btn.classList.toggle('is-saved', nowSaved);
    btn.setAttribute('aria-pressed', nowSaved ? 'true' : 'false');
    btn.setAttribute('aria-label', nowSaved ? 'Remove from saved' : 'Save product');
    if (onToggle) onToggle(code, nowSaved);
  });

  return btn;
}

// ─── card builder (same layout as search results) ──────────────────────────

function buildItemImage(image, name) {
  if (image) {
    return el('img', {
      class: 'card__image',
      src: image,
      alt: name || '',
      loading: 'lazy',
      onError: (e) => {
        e.target.replaceWith(buildPlaceholder(name));
      },
    });
  }
  return buildPlaceholder(name);
}

function buildPlaceholder(name) {
  const initial = (name || '?')[0].toUpperCase();
  return el('div', { class: 'card__image card__image--placeholder', 'aria-hidden': 'true' }, initial);
}

function buildFavItem(item, onOpenProduct, onToggleHeart) {
  const saved = isFavourite(item.code);

  const article = el(
    'article',
    {
      class: 'card',
      role: 'listitem',
      dataset: { code: item.code },
      onClick: () => onOpenProduct(item.code),
      onKeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenProduct(item.code);
        }
      },
      tabindex: '0',
      'aria-label': item.name,
    },
  );

  // header: image + title-block + heart button
  const header = el('div', { class: 'card__header' },
    el('div', { class: 'card__image-wrap' }, buildItemImage(item.image, item.name)),
    el('div', { class: 'card__title-block' },
      el('h3', { class: 'card__title' }, item.name),
    ),
  );

  // heart button (separate from title-block for H7 compliance)
  const heartBtn = buildHeartButton(item.code, item, onToggleHeart);

  // scores
  const scores = el('div', { class: 'card__scores' },
    renderBadge('nutri', item.healthGrade),
    renderBadge('eco', item.ecoGrade),
  );

  article.appendChild(header);
  header.appendChild(heartBtn);
  article.appendChild(scores);

  return article;
}

// ─── empty state ─────────────────────────────────────────────────────────────

function buildEmptyState() {
  return el('div', { class: 'saved-empty' },
    el('svg', {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.5',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    },
      el('path', { d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' }),
    ),
    el('p', {}, 'No saved products yet. Tap the heart on any product to save it.'),
  );
}

// ─── main render ────────────────────────────────────────────────────────────

/**
 * Render the full Saved / Favourites section.
 * Mounts inside the provided container element.
 *
 * @param {HTMLElement} container
 * @param {function} onOpenProduct — callback(code) when user clicks a card
 * @param {function} [onToggleHeart] — optional callback(code, nowSaved) after heart toggle
 */
export function renderFavourites(container, onOpenProduct, onToggleHeart) {
  if (!container) return;

  const items = getFavourites();

  // Always ensure base structure exists
  if (!container.querySelector('.saved__header')) {
    container.innerHTML = '';
    container.setAttribute('aria-label', 'Saved products');

    // Header
    const header = el('div', { class: 'saved__header' },
      el('h2', { class: 'saved__title' }, 'Saved'),
      el('span', { class: 'saved__count' }),
      el('button', {
        type: 'button',
        class: 'saved__clear',
        'aria-label': 'Clear all saved products',
        onClick: () => {
          clearFavourites();
          renderFavourites(container, onOpenProduct, onToggleHeart);
          // Also re-render all heart buttons on the page
          document.querySelectorAll('.heart-btn').forEach((btn) => {
            const code = btn.closest('[data-code]')?.dataset.code;
            if (code) {
              const saved = isFavourite(code);
              btn.classList.toggle('is-saved', saved);
              btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
              btn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save product');
            }
          });
        },
      }, 'Clear all'),
    );
    container.appendChild(header);

    // Empty state
    container.appendChild(buildEmptyState());

    // Grid list
    const grid = el('div', { class: 'saved-grid', role: 'list' });
    container.appendChild(grid);
  }

  const countEl = container.querySelector('.saved__count');
  const clearBtn = container.querySelector('.saved__clear');
  const emptyEl = container.querySelector('.saved-empty');
  const grid = container.querySelector('.saved-grid');

  if (items.length === 0) {
    grid.innerHTML = '';
    grid.hidden = true;
    emptyEl.hidden = false;
    clearBtn.hidden = true;
    if (countEl) countEl.textContent = '';
    container.hidden = false;
    return;
  }

  // Populate
  grid.hidden = false;
  emptyEl.hidden = true;
  clearBtn.hidden = false;
  if (countEl) countEl.textContent = `${items.length} product${items.length !== 1 ? 's' : ''}`;

  grid.innerHTML = '';
  for (const item of items) {
    grid.appendChild(buildFavItem(item, onOpenProduct, onToggleHeart));
  }

  container.hidden = false;
}
