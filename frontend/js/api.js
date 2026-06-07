// Open Food Facts API client with graceful fallback to sample data.
// See docs/api-reference.md for the full contract.

const BASE_URL = 'https://world.openfoodfacts.org/api/v2';
const USER_AGENT = 'FoodLens-MVP/0.1 (team@uib.cat)';

// MVP-only: backend integration. Default null = disabled (no behaviour change).
// Set via <meta name="foodlens-backend-url" content="http://localhost:5000"> in index.html,
// or by editing this constant for local dev.
const BACKEND_URL = (
  document.querySelector('meta[name="foodlens-backend-url"]')?.content || null
);

const PRODUCT_FIELDS = [
  'code',
  'product_name',
  'brands',
  'image_front_url',
  'nutriscore_grade',
  'environmental_score_grade',
  'ecoscore_grade',
  'nutrient_levels',
  'nutriments',
  'categories_tags',
  'allergens_tags',
  'packaging_tags',
  'labels_tags',
].join(',');

const GRADE_TO_NUMERIC = { a: 5, b: 4, c: 3, d: 2, e: 1 };
const NUTRIENT_LEVEL_KEY_MAP = {
  fat: 'fat',
  salt: 'salt',
  'saturated-fat': 'saturatedFat',
  sugars: 'sugars',
};

let sampleProductsCache = null;

async function loadSampleProducts() {
  if (sampleProductsCache) return sampleProductsCache;
  const res = await fetch('./data/sample_products.json');
  const data = await res.json();
  sampleProductsCache = data.products;
  return sampleProductsCache;
}

function isValidBarcode(barcode) {
  return typeof barcode === 'string' && /^\d{8,13}$/.test(barcode);
}

function normaliseGrade(raw) {
  if (!raw || typeof raw !== 'string') return { grade: 'unknown', numeric: null };
  const lower = raw.toLowerCase();
  if (['a', 'b', 'c', 'd', 'e'].includes(lower)) {
    return { grade: lower, numeric: GRADE_TO_NUMERIC[lower] };
  }
  if (lower === 'not-applicable' || lower === 'unknown') {
    return { grade: lower, numeric: null };
  }
  return { grade: 'unknown', numeric: null };
}

function readEcoScore(rawProduct) {
  const newField = rawProduct.environmental_score_grade;
  if (newField) {
    const { grade, numeric } = normaliseGrade(newField);
    return { grade, numeric, sourceField: 'environmental_score_grade' };
  }
  const legacy = rawProduct.ecoscore_grade;
  if (legacy) {
    const { grade, numeric } = normaliseGrade(legacy);
    return { grade, numeric, sourceField: 'ecoscore_grade' };
  }
  return { grade: 'unknown', numeric: null, sourceField: null };
}

function readNutrientLevels(raw) {
  const levels = raw || {};
  const result = { fat: null, salt: null, saturatedFat: null, sugars: null };
  for (const [offKey, ourKey] of Object.entries(NUTRIENT_LEVEL_KEY_MAP)) {
    const v = levels[offKey];
    if (v === 'low' || v === 'moderate' || v === 'high') {
      result[ourKey] = v;
    }
  }
  return result;
}

function readNutrients(raw) {
  const n = raw || {};
  const pickNumeric = (key) => {
    const v = n[key];
    return typeof v === 'number' ? v : null;
  };
  return {
    energyKcal_100g: pickNumeric('energy-kcal_100g'),
    fat_100g: pickNumeric('fat_100g'),
    saturatedFat_100g: pickNumeric('saturated-fat_100g'),
    sugars_100g: pickNumeric('sugars_100g'),
    salt_100g: pickNumeric('salt_100g'),
    fiber_100g: pickNumeric('fiber_100g'),
    proteins_100g: pickNumeric('proteins_100g'),
  };
}

function pickCategory(categoriesTags) {
  if (!Array.isArray(categoriesTags) || categoriesTags.length === 0) return null;
  // The most specific tag is the last one in OFF's hierarchical array.
  return categoriesTags[categoriesTags.length - 1];
}

function splitBrands(brands) {
  if (!brands || typeof brands !== 'string') return [];
  return brands.split(',').map((b) => b.trim()).filter(Boolean);
}

// OFF *_tags arrays (e.g. ["en:milk", "en:gluten"]) -> a single lowercase,
// space-separated string for cheap token matching downstream. When the field
// is absent we return '' (empty = "unknown"), never a guessed value.
function joinTags(tags) {
  if (!Array.isArray(tags)) return '';
  return tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean).join(' ');
}

export function normaliseProduct(raw) {
  if (!raw) return null;
  return {
    source: 'api',
    code: raw.code || null,
    name: raw.product_name || null,
    brands: splitBrands(raw.brands),
    image: raw.image_front_url || null,
    category: pickCategory(raw.categories_tags),
    nutriScore: normaliseGrade(raw.nutriscore_grade),
    ecoScore: readEcoScore(raw),
    nutrientLevels: readNutrientLevels(raw.nutrient_levels),
    nutrients: readNutrients(raw.nutriments),
    // Lowercase, space-separated tag strings. '' means "unknown" (field absent),
    // which passesFilters must treat as "do not hide", never as a value.
    allergens: joinTags(raw.allergens_tags),
    packaging: joinTags(raw.packaging_tags),
    labels: joinTags(raw.labels_tags),
  };
}

async function fallbackByBarcode(barcode) {
  const sample = await loadSampleProducts();
  const match = sample.find((p) => p.code === barcode);
  return match ? { ...match, source: 'sample' } : null;
}

async function fallbackBySearch(query, opts = {}) {
  const sample = await loadSampleProducts();
  const q = (query || '').toLowerCase().trim();
  const ingredient = (opts.ingredient || '').toLowerCase().trim();
  // Category tag matched against the sample product's category bucket, with the
  // "en:" prefix stripped so "en:cereals" matches a sample category of "cereals".
  const categoryTag = (opts.categoryTag || '').toLowerCase().trim();
  const categoryNeedle = categoryTag.includes(':')
    ? categoryTag.slice(categoryTag.indexOf(':') + 1)
    : categoryTag;
  if (!q && !ingredient && !categoryNeedle) {
    return sample.map((p) => ({ ...p, source: 'sample' }));
  }
  const filtered = sample.filter((p) => {
    const haystack = [p.name, p.category, ...p.brands].filter(Boolean).join(' ').toLowerCase();
    const matchesQuery = !q || haystack.includes(q);
    const matchesIngredient = !ingredient || haystack.includes(ingredient);
    const matchesCategory = !categoryNeedle || (p.category || '').toLowerCase().includes(categoryNeedle);
    return matchesQuery && matchesIngredient && matchesCategory;
  });
  return filtered.map((p) => ({ ...p, source: 'sample' }));
}

function normaliseIngredientTag(value) {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes(':')) return raw;
  return `en:${raw.replace(/\s+/g, '-')}`;
}

export async function getProductByBarcode(barcode) {
  if (!isValidBarcode(barcode)) return null;

  const url = `${BASE_URL}/product/${barcode}?fields=${PRODUCT_FIELDS}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
      return fallbackByBarcode(barcode);
    }
    const data = await res.json();
    if (data.status === 0 || !data.product) {
      return fallbackByBarcode(barcode);
    }
    return normaliseProduct(data.product);
  } catch (err) {
    console.warn('OFF API unreachable, using sample data', err);
    return fallbackByBarcode(barcode);
  }
}

export async function searchProducts(query, opts = {}) {
  const { categoryTag = null, ingredient = null, pageSize = 20, page = 1 } = opts;
  const ingredientTag = normaliseIngredientTag(ingredient);

  const params = new URLSearchParams({
    fields: PRODUCT_FIELDS,
    page_size: String(pageSize),
    page: String(page),
  });
  if (categoryTag) params.set('categories_tags', categoryTag);
  if (ingredientTag) params.set('ingredients_tags', ingredientTag);
  if (query) params.set('search_terms', query);

  const url = `${BASE_URL}/search?${params.toString()}`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
      return fallbackBySearch(query, { ingredient, categoryTag });
    }
    const data = await res.json();
    const products = Array.isArray(data.products) ? data.products : [];
    if (products.length === 0) {
      return fallbackBySearch(query, { ingredient, categoryTag });
    }
    return products.map(normaliseProduct).filter(Boolean);
  } catch (err) {
    console.warn('OFF API unreachable, using sample data', err);
    return fallbackBySearch(query, { ingredient, categoryTag });
  }
}

export async function getAllSampleProducts() {
  const sample = await loadSampleProducts();
  return sample.map((p) => ({ ...p, source: 'sample' }));
}

/**
 * Fetch alternatives for a barcode from the FoodLens backend.
 *
 * Returns the parsed response object on success, or null on any failure
 * (network error, timeout, 4xx, 5xx, JSON parse error, BACKEND_URL not set).
 * NEVER throws — the caller can always treat null as "fall back to JS KNN".
 *
 * @param {string} barcode
 * @param {object} opts
 * @param {number} [opts.k=3] - Number of alternatives to request (1..10).
 * @param {number} [opts.weight=0.5] - Health weight (0..1).
 * @param {number} [opts.timeoutMs=1500] - Abort timeout in milliseconds.
 * @returns {Promise<object|null>}
 */
/**
 * Fetch SHAP explanation for a barcode from the FoodLens backend (F-24).
 *
 * Returns the parsed response (including shap_waterfall) or null on any failure.
 * NEVER throws.
 *
 * @param {string} barcode
 * @param {object} opts
 * @param {number} [opts.weight=0.7]     - Health weight (0..1).
 * @param {number} [opts.timeoutMs=2000] - Abort timeout in milliseconds.
 * @returns {Promise<object|null>}
 */
/**
 * Fetch all products in a category for the Nutri × Eco scatter plot (F-43).
 *
 * Returns null when the backend is unavailable or the category has no data.
 *
 * @param {string} category  - OFF category tag, e.g. "en:yogurts"
 * @param {number} [timeoutMs=2000]
 * @returns {Promise<object|null>}
 */
/**
 * Send a telemetry event to the backend (F-45).
 * Fire-and-forget — never throws, never blocks the UI.
 *
 * @param {object} payload - Must include an "event" string field.
 */
export function postTelemetryEvent(payload) {
  if (!BACKEND_URL) return;
  fetch(`${BACKEND_URL}/api/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => { /* silently ignore */ });
}

export async function getCategoryScatter(category, timeoutMs = 2000) {
  if (!BACKEND_URL || !category) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${BACKEND_URL}/api/scatter?cat=${encodeURIComponent(category)}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.count > 0 ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getExplainFromBackend(barcode, opts = {}) {
  if (!BACKEND_URL) return null;
  const { weight = 0.7, timeoutMs = 2000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${BACKEND_URL}/api/explain/${encodeURIComponent(barcode)}?weight=${weight}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.shap_waterfall ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getAlternativesFromBackend(barcode, opts = {}) {
  if (!BACKEND_URL) return null;
  const { k = 3, weight = 0.5, timeoutMs = 1500 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${BACKEND_URL}/api/alternatives/${encodeURIComponent(barcode)}?k=${k}&weight=${weight}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.alternatives)) return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
