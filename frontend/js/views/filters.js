// frontend/js/views/filters.js

const filterGroups = {
  criteria: {
    title: 'Diet & Ethics',
    items: [
      { id: 'high-protein', label: 'High Protein' },
      { id: 'low-sodium', label: 'Low Sodium' },
      { id: 'plastic-free', label: 'Plastic-free' }
    ]
  },
  allergens: {
    title: 'Allergens',
    items: [
      { id: 'no-gluten', label: 'Gluten-free' },
      { id: 'no-lactose', label: 'Lactose-free' },
      { id: 'no-nuts', label: 'Nut-free' }
    ]
  }
};

const activeFilters = new Set();
let onFilterChangeCallback = null;

// Helper: Genera el icono de checkbox marcado o vacío
function getCheckboxSVG(isActive) {
  if (isActive) {
    return `<svg class="checkbox-icon" viewBox="0 0 24 24" width="16" height="16" stroke="var(--color-paper)" fill="var(--color-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; flex-shrink: 0;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="var(--color-ink)"></rect><polyline points="9 11 12 14 22 4"></polyline></svg>`;
  }
  return `<svg class="checkbox-icon empty" viewBox="0 0 24 24" width="16" height="16" stroke="var(--color-ink-mute)" fill="none" stroke-width="2" style="margin-right:8px; flex-shrink: 0;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;
}

export function initFilters(container, onChange) {
  if (!container) return;
  onFilterChangeCallback = onChange;
  renderFilters(container);
}

function renderFilters(container) {
  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'filters-dropdown-wrapper';

  Object.entries(filterGroups).forEach(([groupKey, groupData]) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'filter-dropdown';

    // 1. El Botón que abre el desplegable
    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'filter-dropdown__trigger';
    
    // Función para pintar el contador de filtros activos en el botón
    const updateTriggerText = () => {
       let count = 0;
       groupData.items.forEach(item => { if (activeFilters.has(item.id)) count++; });
       const badge = count > 0 ? `<span class="filter-badge">${count}</span>` : '';
       triggerBtn.innerHTML = `${groupData.title} ${badge} <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" style="margin-left:4px;"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
    };
    updateTriggerText();

    // 2. El Menú Desplegable
    const menuEl = document.createElement('div');
    menuEl.className = 'filter-dropdown__menu';

    // Lógica para abrir/cerrar
    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Cerramos otros menús abiertos
      document.querySelectorAll('.filter-dropdown__menu').forEach(m => {
        if (m !== menuEl) m.classList.remove('open');
      });
      menuEl.classList.toggle('open');
    });

    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!groupEl.contains(e.target)) {
        menuEl.classList.remove('open');
      }
    });

    // 3. Los Checkboxes internos
    groupData.items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'filter-dropdown__item';
      
      const renderItemState = () => {
        const isActive = activeFilters.has(item.id);
        btn.innerHTML = `${getCheckboxSVG(isActive)}<span>${item.label}</span>`;
        isActive ? btn.classList.add('active') : btn.classList.remove('active');
      };
      renderItemState();

      // Al hacer clic en un checkbox
      btn.addEventListener('click', (e) => {
         e.stopPropagation(); // Evita que se cierre el desplegable
         if (activeFilters.has(item.id)) {
             activeFilters.delete(item.id);
         } else {
             activeFilters.add(item.id);
         }
         
         renderItemState(); // Actualiza el checkbox visual
         updateTriggerText(); // Actualiza el número del botón (Badge)
         
         if (onFilterChangeCallback) onFilterChangeCallback(Array.from(activeFilters));
      });
      
      menuEl.appendChild(btn);
    });

    groupEl.appendChild(triggerBtn);
    groupEl.appendChild(menuEl);
    wrapper.appendChild(groupEl);
  });

  container.appendChild(wrapper);
}