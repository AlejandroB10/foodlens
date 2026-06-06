// frontend/js/views/filters.js

const filterGroups = {
  criteria: {
    titleKey: 'filter.group.criteria',
    items: [
      { id: 'high-protein', labelKey: 'filter.high_protein' },
      { id: 'low-sodium', labelKey: 'filter.low_sodium' },
      { id: 'plastic-free', labelKey: 'filter.plastic_free' }
    ]
  },
  allergens: {
    titleKey: 'filter.group.allergens',
    items: [
      { id: 'no-gluten', labelKey: 'filter.no_gluten' },
      { id: 'no-lactose', labelKey: 'filter.no_lactose' },
      { id: 'no-nuts', labelKey: 'filter.no_nuts' }
    ]
  }
};

const activeFilters = new Set();
let onFilterChangeCallback = null;
let translator = null; // Guardamos el traductor aquí

function getCheckboxSVG(isActive) {
  if (isActive) {
    return `<svg class="checkbox-icon" viewBox="0 0 24 24" width="16" height="16" stroke="var(--color-paper)" fill="var(--color-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; flex-shrink: 0;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="var(--color-ink)"></rect><polyline points="9 11 12 14 22 4"></polyline></svg>`;
  }
  return `<svg class="checkbox-icon empty" viewBox="0 0 24 24" width="16" height="16" stroke="var(--color-ink-mute)" fill="none" stroke-width="2" style="margin-right:8px; flex-shrink: 0;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;
}

// Añadimos tFunc como tercer parámetro
export function initFilters(container, onChange, tFunc) {
  if (!container) return;
  onFilterChangeCallback = onChange;
  translator = tFunc; 

  window.addEventListener('languageChanged', () => {
      renderFilters(container);
  });

  renderFilters(container);
}

function renderFilters(container) {
  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'filters-dropdown-wrapper';

  Object.entries(filterGroups).forEach(([groupKey, groupData]) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'filter-dropdown';

    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'filter-dropdown__trigger';
    
    // Traducimos el título del grupo
    const groupTitle = translator ? translator(groupData.titleKey, groupKey) : groupData.title;

    const updateTriggerText = () => {
       let count = 0;
       groupData.items.forEach(item => { if (activeFilters.has(item.id)) count++; });
       const badge = count > 0 ? `<span class="filter-badge">${count}</span>` : '';
       triggerBtn.innerHTML = `${groupTitle} ${badge} <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" style="margin-left:4px;"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
    };
    updateTriggerText();

    const menuEl = document.createElement('div');
    menuEl.className = 'filter-dropdown__menu';

    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.filter-dropdown__menu').forEach(m => { if (m !== menuEl) m.classList.remove('open'); });
      menuEl.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!groupEl.contains(e.target)) menuEl.classList.remove('open');
    });

    groupData.items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'filter-dropdown__item';
      
      // Traducimos el label del item
      const itemLabel = translator ? translator(item.labelKey, item.id) : item.label;

      const renderItemState = () => {
        const isActive = activeFilters.has(item.id);
        btn.innerHTML = `${getCheckboxSVG(isActive)}<span>${itemLabel}</span>`;
        isActive ? btn.classList.add('active') : btn.classList.remove('active');
      };
      renderItemState();

      btn.addEventListener('click', (e) => {
         e.stopPropagation();
         if (activeFilters.has(item.id)) activeFilters.delete(item.id);
         else activeFilters.add(item.id);
         renderItemState();
         updateTriggerText();
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