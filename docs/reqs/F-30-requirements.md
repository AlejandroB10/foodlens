# F-30 Print-Friendly Product Card — Requirements

> Owner: Alejandro Bordón · Hook: H7 · Persona: Marc

## User Story

Como Marc, quiero poder imprimir una ficha de producto limpia para pegarla en la nevera o compartirla en papel.

## Acceptance Criteria

| ID | Criteria | Notes |
|----|----------|-------|
| AC1 | Al pulsar Ctrl+P o el botón "Imprimir", header/footer/search/slider se ocultan | Solo queda la tarjeta del producto |
| AC2 | La tarjeta del producto SÍ aparece centrada con nombre, imagen, badges, sentence, tabla nutricional | Elementos principales visibles |
| AC3 | Márgenes A4 (2cm mínimo) | 20mm top/bottom, 15mm left/right |
| AC4 | Colores de badges se imprimen correctamente | Usar `--badge-color` directamente en print |
| AC5 | Botón "Imprimir ficha" en la tarjeta expandida abre diálogo de impresión | `window.print()` en el click handler |

## Scope

- Pure CSS `@media print` — no JS para el printing propiamente dicho
- `window.print()` invocado desde el botón "Imprimir ficha"
- Elementos visibles: card header, dual-axis badges, chips, contrastive sentence, nutrient drill-down table
- Elementos ocultos: header, footer, search bar, weighting slider, recently-viewed, results grid, action buttons, alternatives

## Hooks compliance

- **H7 (close into action):** El botón Print forma parte del card terminator. Cuando se imprime, el botón se oculta y queda la ficha limpia.
- **H1 (dual-axis default):** Ambos badges (Nutri-Score + Eco) permanecen visibles en print. Jamás se oculta el eje eco.
- **H3 (one sentence, one number):** La contrastive sentence es el elemento central de la ficha impresa.

## Technical approach

- `@page { size: A4; margin: 20mm 15mm; }` para márgenes A4
- `display: none` en elementos de navegación
- `display: block` forzado en `#focused .card` para que siempre sea visible
- Badges usan `--badge-color` como color de fondo (mantiene los colores oficiales en print)
- Image hidden en print para ahorrar tinta
- No se introduce layout nuevo — el card ya existe en el DOM

## Dependencies

- F-07 (dual-axis badges) — existente
- F-10 (contrastive sentence) — existente
- Focused card rendering — existente en app.js