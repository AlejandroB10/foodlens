// frontend/js/views/categories.js

/**
 * Module to handle the Category Browser (F-22).
 * Exposes functions to render and manage the selected category state.
 */

// Internal state of the module
let currentCategory = null;
const categories = [
    { id: 'all', label: 'All Products' },
    { id: 'en:plant-based-milks', label: 'Plant Milks' },
    { id: 'en:cereals', label: 'Cereals' },
    { id: 'en:snacks', label: 'Snacks' },
    { id: 'en:beverages', label: 'Drinks' }
];

// Callback to notify app.js when the category changes
let onCategoryChangeCallback = null;

/**
 * Initializes the component in the provided container.
 * @param {HTMLElement} container - DOM element where chips will be injected.
 * @param {Function} onChange - Function to execute when a category is selected.
 */
export function initCategoryBrowser(container, onChange) {
    if (!container) return;
    
    onCategoryChangeCallback = onChange;
    currentCategory = 'all'; // Default category
    
    renderCategoryChips(container);
}

/**
 * Generates the HTML and adds event listeners to the chips.
 */
function renderCategoryChips(container) {
    // 1. Clear the container
    container.innerHTML = '';
    
    // 2. Add a scrollable wrapper (for accessibility and mobile layout)
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'category-scroll-wrapper';
    scrollWrapper.setAttribute('role', 'tablist');
    scrollWrapper.setAttribute('aria-label', 'Product categories');
    
    // 3. Generate the chips
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `category-chip ${currentCategory === cat.id ? 'active' : ''}`;
        btn.textContent = cat.label;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', currentCategory === cat.id);
        
        // Click event listener
        btn.addEventListener('click', () => handleCategoryClick(cat.id, container));
        
        scrollWrapper.appendChild(btn);
    });
    
    container.appendChild(scrollWrapper);
}

/**
 * Handles state changes and triggers a re-render.
 */
function handleCategoryClick(categoryId, container) {
    if (currentCategory === categoryId) return; // Prevent unnecessary re-renders
    
    currentCategory = categoryId;
    renderCategoryChips(container); // Re-render to update 'active' classes
    
    // Notify the main application to fetch new products
    if (onCategoryChangeCallback) {
        onCategoryChangeCallback(currentCategory);
    }
}