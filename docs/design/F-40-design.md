# F-40 · Search by ingredient design

**Files.**
- `frontend/index.html`
- `frontend/css/style.css`
- `frontend/js/app.js`
- `frontend/js/api.js`
- `docs/api-reference.md`

**UI.** Add a compact secondary field beside the main search bar:

- Main field: product name or barcode.
- Secondary field: ingredient.

The form still has one submit button so Marc keeps a simple path, while Pau gets a more precise filter.

**API contract.** Extend `searchProducts(query, opts)` with:

```js
searchProducts('yogurt', { ingredient: 'almonds' })
```

`api.js` converts simple values to OFF tags:

```text
almonds -> en:almonds
oat flour -> en:oat-flour
```

If the value already includes a taxonomy prefix, it is passed through unchanged.

**Fallback.** `sample_products.json` does not currently include ingredient arrays, so offline matching filters against product name, category, and brand text. It is conservative and never invents ingredient data.
