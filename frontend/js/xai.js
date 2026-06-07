// Contrastive explanation generator.
// One sentence, one verifiable number. Never moralises. Never invents.
// See WA3 hooks H2 (reasoning is the recommendation) and H3 (one sentence + one number).

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

function referenceLabel(reference, fallbackName) {
  if (reference.kind === 'category-average') {
    return 'the category average';
  }
  if (reference.kind === 'usual') {
    return 'your usual choice';
  }
  return reference.name || fallbackName || 'an alternative';
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
    return { sentence: 'No product to explain.', hasComparison: false };
  }

  if (!reference) {
    return {
      sentence: 'Insufficient data to compare this product against a reference.',
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
    const direction = nutrientDelta.deltaPct < 0 ? 'less' : 'more';
    const nutrientName = NUTRIENT_DISPLAY_NAMES[nutrientDelta.key] || nutrientDelta.key;
    const pct = formatPct(nutrientDelta.deltaPct);
    const base = `This product has ${pct} ${direction} ${nutrientName} per 100g than ${refLabel}`;

    if (nutriDiff !== null && nutriDiff !== 0) {
      const compare = nutriDiff > 0 ? 'better' : 'worse';
      return {
        sentence: `${base}, with a ${compare} Nutri-Score (${productGradeNutri.toUpperCase()} vs ${refGradeNutri.toUpperCase()}).`,
        hasComparison: true,
      };
    }
    if (ecoDiff !== null && ecoDiff !== 0) {
      const compare = ecoDiff > 0 ? 'better' : 'worse';
      return {
        sentence: `${base}, with a ${compare} Environmental Score (${productGradeEco.toUpperCase()} vs ${refGradeEco.toUpperCase()}).`,
        hasComparison: true,
      };
    }
    return { sentence: `${base}.`, hasComparison: true };
  }

  // Fallback 1: grades differ but no nutrient delta.
  if (nutriDiff !== null && nutriDiff !== 0) {
    const compare = nutriDiff > 0 ? 'better' : 'worse';
    return {
      sentence: `This product has a ${compare} Nutri-Score than ${refLabel} (${productGradeNutri.toUpperCase()} vs ${refGradeNutri.toUpperCase()}).`,
      hasComparison: true,
    };
  }
  if (ecoDiff !== null && ecoDiff !== 0) {
    const compare = ecoDiff > 0 ? 'better' : 'worse';
    return {
      sentence: `This product has a ${compare} Environmental Score than ${refLabel} (${productGradeEco.toUpperCase()} vs ${refGradeEco.toUpperCase()}).`,
      hasComparison: true,
    };
  }

  // Fallback 2: nothing comparable.
  return {
    sentence: `Insufficient comparable data between this product and ${refLabel}.`,
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
    name: 'the category average',
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
    const direction = delta < 0 ? 'less' : 'more';
    const formatted = formatGrams(Math.abs(delta));
    if (!formatted) continue;
    parts.push(`${formatted} ${direction} ${NUTRIENT_DISPLAY_NAMES[key] || key}`);
    if (parts.length >= 2) break;
  }
  // Return an empty string (falsy) when there is no nutrient delta to report so
  // callers can fall back to their own TRANSLATED "similar profile" copy instead
  // of leaking this English sentence. See app.js rerenderFocused (`if (deltaText)`).
  if (parts.length === 0) return '';
  return `${parts.join(', ')} per 100g.`;
}
