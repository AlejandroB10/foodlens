# F-40 · Search by ingredient requirements

**Owner.** Alejandro Rodriguez Arguimbau

**User story.** As Pau Estarellas, I want to search products by ingredient so that I can inspect foods containing a specific component without relying only on brand or product names.

**Acceptance criteria.**
- AC1: The search area includes a second field labelled for ingredient search.
- AC2: Submitting an ingredient-only search calls Open Food Facts `/search` with `ingredients_tags`.
- AC3: Submitting both a product query and an ingredient narrows the search using both filters.
- AC4: Manual barcode lookup keeps the existing `/product/{barcode}` path.
- AC5: If OFF search fails, the existing sample fallback still returns a safe local result set.

**Out of scope.** Allergen exclusion chips, i18n labels, and full ingredient-list parsing from product details.
