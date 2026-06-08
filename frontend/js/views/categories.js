// frontend/js/views/categories.js
import { t } from './i18n.js';

let currentCategory = null;
// Chip ids are coarse OFF tags that the rebuilt KNN index now covers
// (DEFAULT_CATEGORIES in build_knn_index.py). index_store slugifies the
// lookup, so these resolve to real indexed products via /api/scatter.
const categories = [
    { id: 'all', labelKey: 'cat.all', label: 'All Products' },
    { id: 'en:yogurts', labelKey: 'cat.yogurts', label: 'Yogurts' },
    { id: 'en:cheeses', labelKey: 'cat.cheeses', label: 'Cheeses' },
    { id: 'en:breads', labelKey: 'cat.breads', label: 'Breads' },
    { id: 'en:fruit-juices', labelKey: 'cat.fruit_juices', label: 'Fruit Juices' },
    { id: 'en:chocolates', labelKey: 'cat.chocolates', label: 'Chocolates' },
    { id: 'en:breakfast-cereals', labelKey: 'cat.breakfast_cereals', label: 'Breakfast Cereals' }
];

let onCategoryChangeCallback = null;
let translator = null;

// Escucha el cambio de idioma global para redibujar
window.addEventListener('languageChanged', () => {
    const container = document.getElementById('category-browser');
    if (container) renderCategoryChips(container);
});

export function initCategoryBrowser(container, onChange, tFunc) {
    if (!container) return;
    onCategoryChangeCallback = onChange;
    translator = tFunc; 
    currentCategory = 'all'; 
    renderCategoryChips(container);
}

function renderCategoryChips(container) {
    container.innerHTML = '';
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'category-scroll-wrapper';
    
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `category-chip ${currentCategory === cat.id ? 'active' : ''}`;
        
        // Uso del traductor de forma segura
        btn.textContent = translator ? translator(cat.labelKey, cat.label) : cat.label;
        
        btn.addEventListener('click', () => {
            currentCategory = cat.id;
            renderCategoryChips(container); // Redibujar para actualizar el botón activo
            if (onCategoryChangeCallback) onCategoryChangeCallback(currentCategory);
        });
        
        scrollWrapper.appendChild(btn);
    });
    container.appendChild(scrollWrapper);
}