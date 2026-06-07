// js/comparison.js

export const selectedProducts = new Map();
const MAX_PRODUCTS = 5;
import { downloadCSV, buildComparisonRows } from './export.js';

// Lightweight toast mirroring the app.js pattern (shared #toast-host + .toast
// styles live in style.css). comparison.js is a standalone module, so we keep a
// local non-blocking notifier instead of pulling in app.js.
function toast(message) {
  let host = document.querySelector('#toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'toast-host';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('is-visible'));
  setTimeout(() => {
    t.classList.remove('is-visible');
    t.addEventListener('transitionend', () => t.remove(), { once: true });
  }, 2400);
}

export function toggleProductSelection(productId, productObj, isChecked, checkboxElement) {
  if (isChecked) {
    if (selectedProducts.size >= MAX_PRODUCTS) {
      toast(`For a clear comparison, maximum is ${MAX_PRODUCTS} products.`);
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

// Read the persisted health/eco slider weight (0..1) so the ranked list honours
// the SAME weighting as the search results. We read localStorage directly to
// avoid a circular import with app.js (which imports this module).
function getHealthWeight() {
  try {
    const raw = localStorage.getItem('foodlens.state');
    const parsed = raw ? JSON.parse(raw) : null;
    const hw = parsed && typeof parsed.healthWeight === 'number' ? parsed.healthWeight : 70;
    return Math.max(0, Math.min(100, hw)) / 100;
  } catch {
    return 0.7;
  }
}

// Slider-weighted overall score, identical to the results list (app.js rerenderResults).
function overallScore(product, hw) {
  return (product.nutriScore?.numeric ?? 0) * hw + (product.ecoScore?.numeric ?? 0) * (1 - hw);
}

// Average of a per-100g nutrient across products that report it (number only).
function groupAverage(products, key) {
  const values = products
    .map((p) => p.nutrients?.[key])
    .filter((v) => typeof v === 'number');
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// F-19 (H5): rank the selected products by the slider-weighted score and build a
// one-line justification per product. The justification cites at most one
// verifiable number (H3) and never invents data (missing values are skipped).
function buildRankedList(products) {
  const hw = getHealthWeight();
  const avgSugar = groupAverage(products, 'sugars_100g');

  const ranked = [...products].sort((a, b) => overallScore(b, hw) - overallScore(a, hw));

  return ranked.map((p, index) => {
    const reasons = [];

    const nutri = p.nutriScore?.grade;
    if (typeof nutri === 'string' && /^[a-e]$/.test(nutri)) {
      reasons.push(`Nutri-Score ${nutri.toUpperCase()}`);
    }
    const eco = p.ecoScore?.grade;
    if (typeof eco === 'string' && /^[a-e]$/.test(eco)) {
      reasons.push(`Eco-Score ${eco.toUpperCase()}`);
    }

    const sugar = p.nutrients?.sugars_100g;
    if (typeof sugar === 'number' && typeof avgSugar === 'number' && avgSugar > 0) {
      const pct = Math.round(((sugar - avgSugar) / avgSugar) * 100);
      if (Math.abs(pct) >= 5) {
        const dir = pct < 0 ? 'less' : 'more';
        reasons.push(`${Math.abs(pct)}% ${dir} sugar than the group average`);
      }
    }

    let justification;
    if (reasons.length === 0) {
      justification = 'No comparable score or nutrient data.';
    } else if (index === 0) {
      justification = `Best overall: ${reasons.join(', ')}.`;
    } else {
      justification = `${reasons.join(', ')}.`;
    }

    return { product: p, rank: index + 1, justification };
  });
}

function renderRankedSummary(container, products) {
  if (!container) return;
  container.innerHTML = '';
  if (products.length < 2) return;

  const heading = document.createElement('h3');
  heading.className = 'ranked-summary__title';
  heading.textContent = 'Ranked for your health / eco priority';
  container.appendChild(heading);

  const list = document.createElement('ol');
  list.className = 'ranked-summary__list';

  buildRankedList(products).forEach(({ product, rank, justification }) => {
    const li = document.createElement('li');
    li.className = 'ranked-summary__item';

    const name = document.createElement('span');
    name.className = 'ranked-summary__name';
    name.textContent = `${rank}. ${product.name || product.code || 'Unknown'}`;

    const why = document.createElement('span');
    why.className = 'ranked-summary__why';
    why.textContent = justification;

    li.appendChild(name);
    li.appendChild(why);
    list.appendChild(li);
  });

  container.appendChild(list);
}

function renderComparisonTable() {
  const tableHeaderRow = document.getElementById('table-header-row');
  const tableBody = document.getElementById('table-body');
  if (!tableHeaderRow || !tableBody) return;

  const products = Array.from(selectedProducts.values());

  renderRankedSummary(document.getElementById('comparison-ranked'), products);

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

  const rowsData = buildComparisonRows();

  rowsData.forEach(row => {
    const tr = document.createElement('tr');

    const thAttr = document.createElement('th');
    thAttr.scope = 'row';
    thAttr.className = 'attr-col';
    thAttr.textContent = row.label;
    tr.appendChild(thAttr);

    // Winner detection: collect finite raw values, find the best per direction.
    // Only highlight when there is a meaningful comparison (2+ values) and the
    // winner is strictly better than at least one other value (no all-tie glow).
    let winningValue = null;
    if (row.better && products.length > 1) {
      const values = products.map(p => row.raw(p)).filter(v => v != null);
      if (values.length > 1) {
        const best = row.better === 'lower' ? Math.min(...values) : Math.max(...values);
        if (values.some(v => v !== best)) winningValue = best;
      }
    }

    products.forEach(p => {
      const td = document.createElement('td');
      td.textContent = row.getText(p);
      if (winningValue != null && row.raw(p) === winningValue) {
        td.classList.add('cell--winner');
      }
      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });

  // Nutrient-levels chips row (F-34): low/moderate/high for fat/salt/
  // saturated-fat/sugars. Missing data renders as "no data", never invented.
  renderNutrientLevelsRow(tableBody, products);
}

const NUTRIENT_LEVEL_FIELDS = [
  { key: 'fat', label: 'Fat' },
  { key: 'saturatedFat', label: 'Sat. fat' },
  { key: 'sugars', label: 'Sugars' },
  { key: 'salt', label: 'Salt' },
];

function renderNutrientLevelsRow(tableBody, products) {
  const tr = document.createElement('tr');

  const thAttr = document.createElement('th');
  thAttr.scope = 'row';
  thAttr.className = 'attr-col';
  thAttr.textContent = 'Nutrient levels';
  tr.appendChild(thAttr);

  products.forEach(p => {
    const td = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'cell-chips';

    NUTRIENT_LEVEL_FIELDS.forEach(field => {
      const level = p.nutrientLevels?.[field.key];
      const chip = document.createElement('span');
      if (level === 'low' || level === 'moderate' || level === 'high') {
        chip.className = `cell-chip cell-chip--${level}`;
        chip.textContent = `${field.label}: ${level}`;
      } else {
        chip.className = 'cell-chip cell-chip--unknown';
        chip.textContent = `${field.label}: no data`;
      }
      wrap.appendChild(chip);
    });

    td.appendChild(wrap);
    tr.appendChild(td);
  });

  tableBody.appendChild(tr);
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

  document.getElementById('export-comparison-btn')?.addEventListener('click', () => {
    const products = Array.from(selectedProducts.values());
    if (products.length === 0) return;

    // Construir matriz bidimensional para el CSV
    // Fila 0: Cabeceras
    const headers = ['Attribute', ...products.map(p => p.name || p.code || 'Unknown')];
    const csvData = [headers];

    // Mismas filas que la tabla HTML (fuente única en export.js)
    const rowsData = buildComparisonRows();

    rowsData.forEach(row => {
      const csvRow = [row.label, ...products.map(p => row.getText(p))];
      csvData.push(csvRow);
    });

    // Generar timestamp para el nombre del archivo
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(csvData, `foodlens_comparison_${dateStr}.csv`);
  });
});

