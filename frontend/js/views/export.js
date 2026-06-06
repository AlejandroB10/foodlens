// js/export.js

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