// js/comparison.js

export const selectedProducts = new Map();
const MAX_PRODUCTS = 4;

export function toggleProductSelection(productId, productObj, isChecked, checkboxElement) {
  if (isChecked) {
    if (selectedProducts.size >= MAX_PRODUCTS) {
      alert(`For a clear comparison, maximum is ${MAX_PRODUCTS} products.`);
      checkboxElement.checked = false; 
      return;
    }
    selectedProducts.set(productId, productObj);
  } else {
    selectedProducts.delete(productId);
  }
  updateTrayUI();
}

export function clearSelection() {
  selectedProducts.clear();
  document.querySelectorAll('.compare-checkbox').forEach(cb => cb.checked = false);
  updateTrayUI();
}

function updateTrayUI() {
  const trayElement = document.getElementById('comparison-tray');
  const trayCountElement = document.getElementById('tray-count');
  if (!trayElement || !trayCountElement) return; // Salvaguarda anti-crashes

  const count = selectedProducts.size;
  trayCountElement.textContent = `${count} item${count !== 1 ? 's' : ''} selected`;
  
  if (count > 0) {
    trayElement.classList.remove('hidden');
    void trayElement.offsetWidth;
    trayElement.classList.add('visible');
  } else {
    trayElement.classList.remove('visible');
    setTimeout(() => trayElement.classList.add('hidden'), 300);
  }
}

function renderComparisonTable() {
  const tableHeaderRow = document.getElementById('table-header-row');
  const tableBody = document.getElementById('table-body');
  if (!tableHeaderRow || !tableBody) return;

  const products = Array.from(selectedProducts.values());
  
  while (tableHeaderRow.children.length > 1) {
    tableHeaderRow.removeChild(tableHeaderRow.lastChild);
  }
  tableBody.innerHTML = '';
  
  products.forEach(p => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = p.name || p.code || 'Unknown';
    tableHeaderRow.appendChild(th);
  });

  const rowsData = [
    { label: 'Nutri-Score', getValue: p => p.nutriScore?.grade ? p.nutriScore.grade.toUpperCase() : '?' },
    { label: 'Eco-Score', getValue: p => p.ecoScore?.grade ? p.ecoScore.grade.toUpperCase() : '?' },
    { label: 'Energy (kcal)', getValue: p => p.nutrients?.energyKcal_100g ? Math.round(p.nutrients.energyKcal_100g) : '-' },
    { label: 'Sugars (g)', getValue: p => p.nutrients?.sugars_100g ? p.nutrients.sugars_100g.toFixed(1) : '-' },
    { label: 'Fat (g)', getValue: p => p.nutrients?.fat_100g ? p.nutrients.fat_100g.toFixed(1) : '-' },
    { label: 'Saturated Fat (g)', getValue: p => p.nutrients?.saturatedFat_100g ? p.nutrients.saturatedFat_100g.toFixed(1) : '-' },
    { label: 'Salt (g)', getValue: p => p.nutrients?.salt_100g ? p.nutrients.salt_100g.toFixed(1) : '-' }
  ];

  rowsData.forEach(row => {
    const tr = document.createElement('tr');
    
    const thAttr = document.createElement('th');
    thAttr.scope = 'row';
    thAttr.className = 'attr-col';
    thAttr.textContent = row.label;
    tr.appendChild(thAttr);
    
    products.forEach(p => {
      const td = document.createElement('td');
      td.textContent = row.getValue(p);
      tr.appendChild(td);
    });
    
    tableBody.appendChild(tr);
  });
}

// Iniciar eventos de UI cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('open-comparison-btn')?.addEventListener('click', () => {
    renderComparisonTable();
    document.getElementById('comparison-modal')?.showModal();
  });

  document.getElementById('close-modal-btn')?.addEventListener('click', () => {
    document.getElementById('comparison-modal')?.close();
  });

  document.getElementById('clear-comparison-btn')?.addEventListener('click', clearSelection);

  const modalElement = document.getElementById('comparison-modal');
  modalElement?.addEventListener('click', (e) => {
    const rect = modalElement.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) {
      modalElement.close();
    }
  });
});