// js/export.js

/**
 * Single source of truth for the comparison rows shared by the on-screen table
 * (comparison.js) and the CSV export. Each descriptor carries:
 *   - label:   row header text
 *   - getText: (p) => display/CSV string. Genuine 0 must render as "0", missing
 *              data as "-". We use explicit null/finite checks, never falsy
 *              checks, so 0 g sugar / 0 kcal are not dropped.
 *   - raw:     (p) => finite number or null, used for winner detection
 *   - better:  'lower' | 'higher' | null — direction of "best" for that nutrient
 *
 * @returns {Array<{label:string,getText:Function,raw:Function,better:?string}>}
 */
export function buildComparisonRows() {
  const num = (v) => (Number.isFinite(v) ? v : null);
  const fixed = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : '-');
  return [
    {
      label: 'Nutri-Score',
      getText: (p) => (p.nutriScore?.grade ? p.nutriScore.grade.toUpperCase() : '?'),
      raw: () => null,
      better: null,
    },
    {
      label: 'Eco-Score',
      getText: (p) => (p.ecoScore?.grade ? p.ecoScore.grade.toUpperCase() : '?'),
      raw: () => null,
      better: null,
    },
    {
      label: 'Energy (kcal)',
      getText: (p) => (Number.isFinite(p.nutrients?.energyKcal_100g) ? String(Math.round(p.nutrients.energyKcal_100g)) : '-'),
      raw: (p) => num(p.nutrients?.energyKcal_100g),
      better: 'lower',
    },
    {
      label: 'Sugars (g)',
      getText: (p) => fixed(p.nutrients?.sugars_100g, 1),
      raw: (p) => num(p.nutrients?.sugars_100g),
      better: 'lower',
    },
    {
      label: 'Fat (g)',
      getText: (p) => fixed(p.nutrients?.fat_100g, 1),
      raw: (p) => num(p.nutrients?.fat_100g),
      better: 'lower',
    },
    {
      label: 'Saturated Fat (g)',
      getText: (p) => fixed(p.nutrients?.saturatedFat_100g, 1),
      raw: (p) => num(p.nutrients?.saturatedFat_100g),
      better: 'lower',
    },
    {
      label: 'Salt (g)',
      getText: (p) => fixed(p.nutrients?.salt_100g, 1),
      raw: (p) => num(p.nutrients?.salt_100g),
      better: 'lower',
    },
    {
      label: 'Fibre (g)',
      getText: (p) => fixed(p.nutrients?.fiber_100g, 1),
      raw: (p) => num(p.nutrients?.fiber_100g),
      better: 'higher',
    },
    {
      label: 'Protein (g)',
      getText: (p) => fixed(p.nutrients?.proteins_100g, 1),
      raw: (p) => num(p.nutrients?.proteins_100g),
      better: 'higher',
    },
  ];
}

/**
 * Convierte un array de arrays (matriz bidimensional) a formato CSV y fuerza la descarga.
 * HCI: Prevención de errores escapando comas y comillas en los textos.
 *
 * @param {Array<Array<string|number>>} data - Los datos a exportar (la fila 0 deben ser las cabeceras).
 * @param {string} filename - El nombre del archivo descargable.
 */
export function downloadCSV(data, filename) {
  // 1. Formatear datos: Escapar textos que contengan comas o comillas dobles
  const csvContent = data.map(row => {
    return row.map(cell => {
      let text = cell === null || cell === undefined ? '' : String(cell);
      // Si el texto tiene comas, saltos de línea o comillas, hay que encerrarlo en comillas dobles
      if (text.includes(',') || text.includes('\n') || text.includes('"')) {
        text = `"${text.replace(/"/g, '""')}"`; // Escapar comillas dobles internas
      }
      return text;
    }).join(',');
  }).join('\n');

  // 2. Crear un Blob (archivo binario en memoria)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  // 3. Crear un enlace temporal y simular el clic para descargar
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}