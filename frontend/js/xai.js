// Contrastive explanation generator.
// One sentence, one verifiable number. Never moralises. Never invents.
// See WA3 hooks H2 (reasoning is the recommendation) and H3 (one sentence + one number).

import { t } from './views/i18n.js';

// English display names double as the fallback when an i18n key is missing.
const NUTRIENT_DISPLAY_NAMES = {
  sugars_100g: 'sugar',
  fat_100g: 'fat',
  saturatedFat_100g: 'saturated fat',
  salt_100g: 'salt',
  fiber_100g: 'fibre',
  proteins_100g: 'protein',
  energyKcal_100g: 'calories',
};

const GRADE_RANK = { a: 5, b: 4, c: 3, d: 2, e: 1 };

function isNumericGrade(grade) {
  return typeof grade === 'string' && GRADE_RANK[grade] !== undefined;
}

function gradeCompare(a, b) {
  // Positive number => a is better than b. Null if either is non-numeric.
  if (!isNumericGrade(a) || !isNumericGrade(b)) return null;
  return GRADE_RANK[a] - GRADE_RANK[b];
}

function pctChange(productValue, referenceValue) {
  if (
    typeof productValue !== 'number' ||
    typeof referenceValue !== 'number' ||
    referenceValue === 0
  ) {
    return null;
  }
  return ((productValue - referenceValue) / referenceValue) * 100;
}

function pickMostDifferentiatingNutrient(product, reference) {
  const candidates = ['sugars_100g', 'saturatedFat_100g', 'fat_100g', 'salt_100g', 'proteins_100g', 'fiber_100g'];
  let best = null;
  let bestAbs = 0;
  for (const key of candidates) {
    const p = product.nutrients?.[key];
    const r = reference.nutrients?.[key];
    if (typeof p !== 'number' || typeof r !== 'number') continue;
    const delta = pctChange(p, r);
    if (delta === null) continue;
    if (Math.abs(delta) > bestAbs && Math.abs(delta) >= 5) {
      bestAbs = Math.abs(delta);
      best = { key, productValue: p, referenceValue: r, deltaPct: delta };
    }
  }
  return best;
}

function formatPct(value) {
  const rounded = Math.round(Math.abs(value));
  return `${rounded}%`;
}

function formatGrams(value) {
  if (value === null || value === undefined) return null;
  if (value < 1) return `${value.toFixed(2)}g`;
  if (value < 10) return `${value.toFixed(1)}g`;
  return `${Math.round(value)}g`;
}

// Translate the nutrient key for the current UI language; English name = fallback.
function nutrientName(key) {
  return t('xai.nutrient.' + key, NUTRIENT_DISPLAY_NAMES[key] || key);
}

// Fill a translated template by replacing {placeholder} tokens. The template is
// pulled from i18n for the current language; `fallback` is the English string.
function fillTemplate(key, vars, fallback) {
  let s = t(key, fallback);
  for (const name in vars) {
    s = s.split('{' + name + '}').join(String(vars[name]));
  }
  return s;
}

function referenceLabel(reference, fallbackName) {
  if (reference.kind === 'category-average') {
    return t('xai.ref.category_average', 'the category average');
  }
  if (reference.kind === 'usual') {
    // KI-4 / user-flows.md (Lluís): the on-card contrastive sentence must NAME
    // the usual ("...18% less added sugar than Alpro"), not anonymise it.
    // pickReference spreads the usual product into the reference, so its name
    // is available here; fall back to the generic phrase only when nameless.
    return reference.name || t('xai.ref.usual_generic', 'your usual choice');
  }
  return reference.name || fallbackName || t('xai.ref.alternative', 'an alternative');
}

/**
 * Generate the contrastive sentence for a product against a reference.
 *
 * @param {object} product - Normalised product (see architecture.md schema)
 * @param {object} reference - Either:
 *   - { kind: 'product', ...normalisedProduct }
 *   - { kind: 'category-average', nutrients: {...}, label?: string }
 *   - { kind: 'usual', ...normalisedProduct }
 * @returns {{ sentence: string, hasComparison: boolean }}
 */
export function generateContrastiveSentence(product, reference) {
  if (!product) {
    return { sentence: t('xai.no_product', 'No product to explain.'), hasComparison: false };
  }

  if (!reference) {
    return {
      sentence: t('xai.insufficient_data', 'Insufficient data to compare this product against a reference.'),
      hasComparison: false,
    };
  }

  const refLabel = referenceLabel(reference, reference.name);
  const productGradeNutri = product.nutriScore?.grade;
  const refGradeNutri = reference.nutriScore?.grade;
  const productGradeEco = product.ecoScore?.grade;
  const refGradeEco = reference.ecoScore?.grade;

  const nutrientDelta = pickMostDifferentiatingNutrient(product, reference);
  const nutriDiff = gradeCompare(productGradeNutri, refGradeNutri);
  const ecoDiff = gradeCompare(productGradeEco, refGradeEco);

  // Preferred shape: one nutrient delta + one score comparison.
  if (nutrientDelta) {
    const dir = t(nutrientDelta.deltaPct < 0 ? 'xai.dir.less' : 'xai.dir.more', nutrientDelta.deltaPct < 0 ? 'less' : 'more');
    const pct = formatPct(nutrientDelta.deltaPct);
    const base = fillTemplate(
      'xai.s.base',
      { pct, dir, nutrient: nutrientName(nutrientDelta.key), ref: refLabel },
      'This product has {pct} {dir} {nutrient} per 100g than {ref}',
    );

    if (nutriDiff !== null && nutriDiff !== 0) {
      const cmp = t(nutriDiff > 0 ? 'xai.cmp.better' : 'xai.cmp.worse', nutriDiff > 0 ? 'better' : 'worse');
      return {
        sentence: base + fillTemplate(
          'xai.s.suffix_nutri',
          { cmp, a: productGradeNutri.toUpperCase(), b: refGradeNutri.toUpperCase() },
          ', with a {cmp} Nutri-Score ({a} vs {b}).',
        ),
        hasComparison: true,
      };
    }
    if (ecoDiff !== null && ecoDiff !== 0) {
      const cmp = t(ecoDiff > 0 ? 'xai.cmp.better' : 'xai.cmp.worse', ecoDiff > 0 ? 'better' : 'worse');
      return {
        sentence: base + fillTemplate(
          'xai.s.suffix_eco',
          { cmp, a: productGradeEco.toUpperCase(), b: refGradeEco.toUpperCase() },
          ', with a {cmp} Environmental Score ({a} vs {b}).',
        ),
        hasComparison: true,
      };
    }
    return { sentence: `${base}.`, hasComparison: true };
  }

  // Fallback 1: grades differ but no nutrient delta.
  if (nutriDiff !== null && nutriDiff !== 0) {
    const cmp = t(nutriDiff > 0 ? 'xai.cmp.better' : 'xai.cmp.worse', nutriDiff > 0 ? 'better' : 'worse');
    return {
      sentence: fillTemplate(
        'xai.s.nutri_only',
        { cmp, ref: refLabel, a: productGradeNutri.toUpperCase(), b: refGradeNutri.toUpperCase() },
        'This product has a {cmp} Nutri-Score than {ref} ({a} vs {b}).',
      ),
      hasComparison: true,
    };
  }
  if (ecoDiff !== null && ecoDiff !== 0) {
    const cmp = t(ecoDiff > 0 ? 'xai.cmp.better' : 'xai.cmp.worse', ecoDiff > 0 ? 'better' : 'worse');
    return {
      sentence: fillTemplate(
        'xai.s.eco_only',
        { cmp, ref: refLabel, a: productGradeEco.toUpperCase(), b: refGradeEco.toUpperCase() },
        'This product has a {cmp} Environmental Score than {ref} ({a} vs {b}).',
      ),
      hasComparison: true,
    };
  }

  // Fallback 2: nothing comparable.
  return {
    sentence: fillTemplate('xai.insufficient_comparable', { ref: refLabel }, 'Insufficient comparable data between this product and {ref}.'),
    hasComparison: false,
  };
}

/**
 * Build a category-average reference from a list of products in the same category.
 * Returns null if the list is empty or no numeric nutrients are available.
 */
export function buildCategoryAverageReference(products, category) {
  const sameCategory = products.filter((p) => p.category === category);
  if (sameCategory.length === 0) return null;

  const keys = ['sugars_100g', 'fat_100g', 'saturatedFat_100g', 'salt_100g', 'proteins_100g', 'fiber_100g', 'energyKcal_100g'];
  const sums = {};
  const counts = {};

  for (const p of sameCategory) {
    for (const k of keys) {
      const v = p.nutrients?.[k];
      if (typeof v === 'number') {
        sums[k] = (sums[k] || 0) + v;
        counts[k] = (counts[k] || 0) + 1;
      }
    }
  }

  const averaged = {};
  let hasAny = false;
  for (const k of keys) {
    if (counts[k]) {
      averaged[k] = sums[k] / counts[k];
      hasAny = true;
    } else {
      averaged[k] = null;
    }
  }

  if (!hasAny) return null;

  return {
    kind: 'category-average',
    name: t('xai.ref.category_average', 'the category average'),
    nutrients: averaged,
    nutriScore: { grade: null, numeric: null },
    ecoScore: { grade: null, numeric: null, sourceField: null },
  };
}

/**
 * Compute a weighted distance from product to candidate, in min-max scaled
 * nutrient space, biased by the slider weighting (0 = full eco, 1 = full health).
 * Lower is closer. Used by the alternative engine.
 */
export function weightedNutrientDistance(productA, productB, healthWeight) {
  const keys = ['sugars_100g', 'fat_100g', 'saturatedFat_100g', 'salt_100g', 'proteins_100g'];
  let sum = 0;
  let count = 0;
  for (const k of keys) {
    const a = productA.nutrients?.[k];
    const b = productB.nutrients?.[k];
    if (typeof a === 'number' && typeof b === 'number') {
      sum += (a - b) * (a - b);
      count += 1;
    }
  }
  if (count === 0) return Infinity;
  const euclid = Math.sqrt(sum / count);

  // Health weight pushes the comparison towards nutrients; eco weight uses the score grade gap.
  const ecoGap = (productA.ecoScore?.numeric ?? 3) - (productB.ecoScore?.numeric ?? 3);
  const ecoTerm = Math.max(0, -ecoGap) * (1 - healthWeight) * 20; // 20 ≈ rough scale of grams

  return healthWeight * euclid + ecoTerm;
}

const FALLBACK_DELTAS = ['sugars_100g', 'fat_100g', 'saturatedFat_100g', 'salt_100g', 'proteins_100g', 'fiber_100g'];

/**
 * Return a one-line delta string for an alternative card. E.g.
 * "4.1g less sugar, 3.7g more protein per 100g."
 */
export function formatAlternativeDelta(product, alternative) {
  const parts = [];
  for (const key of FALLBACK_DELTAS) {
    const p = product.nutrients?.[key];
    const a = alternative.nutrients?.[key];
    if (typeof p !== 'number' || typeof a !== 'number') continue;
    const delta = a - p;
    if (Math.abs(delta) < 0.2) continue;
    const dir = t(delta < 0 ? 'xai.dir.less' : 'xai.dir.more', delta < 0 ? 'less' : 'more');
    const formatted = formatGrams(Math.abs(delta));
    if (!formatted) continue;
    parts.push(fillTemplate('xai.delta.item', { grams: formatted, dir, nutrient: nutrientName(key) }, '{grams} {dir} {nutrient}'));
    if (parts.length >= 2) break;
  }
  // Return an empty string (falsy) when there is no nutrient delta to report so
  // callers can fall back to their own "similar profile" copy.
  if (parts.length === 0) return '';
  return parts.join(', ') + t('xai.delta.per100g', ' per 100g.');
}
