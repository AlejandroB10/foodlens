// frontend/js/views/categories.js
import { t } from './i18n.js';

let currentCategory = null;
const categories = [
    { id: 'all', labelKey: 'cat.all', label: 'All Products' },
    { id: 'en:plant-based-milks', labelKey: 'cat.plant_milks', label: 'Plant Milks' },
    { id: 'en:cereals', labelKey: 'cat.cereals', label: 'Cereals' },
    { id: 'en:snacks', labelKey: 'cat.snacks', label: 'Snacks' },
    { id: 'en:beverages', labelKey: 'cat.drinks', label: 'Drinks' }
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