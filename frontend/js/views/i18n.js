// js/i18n.js

const I18N_STORAGE_KEY = 'foodlens.language';

export const translations = {
  en: {
    // ... (Mantén aquí todos los que ya teníamos de en)
    'header.tagline': 'Transparent multi-objective food recommendations. Two scores, side by side. One sentence of reasoning per product.',
    'header.settings': 'Settings',
    'search.label': 'Search products',
    'search.input_label': 'Search a product or barcode',
    'search.placeholder': 'Type a name or paste a barcode…',
    'search.inspect': 'Inspect',
    'search.ingredient_label': 'Search by ingredient',
    'search.ingredient': 'Ingredient',
    'search.ingredient.placeholder': 'e.g. almonds, gluten, oat',
    'weighting.title': 'What weighs more in your decision today?',
    'weighting.health': 'Health',
    'weighting.eco': 'Eco',
    'weighting.preset.eco': 'Eco-first',
    'weighting.preset.balanced': 'Balanced',
    'weighting.preset.health': 'Health-first',
    'nav.search': 'Search',
    'nav.saved': 'Saved',
    'nav.evaluate': 'Evaluate',
    'badge.offline': 'Showing offline sample data. The live Open Food Facts API was unreachable; the team should reload once it recovers.',
    'seasonal.title': 'Seasonal context',
    'seasonal.desc': 'Add approximate location to show a local seasonality hint for produce-heavy products.',
    'seasonal.btn.enable': 'Use location',
    'seasonal.btn.dismiss': 'Dismiss',
    'ui.loading': 'Querying Open Food Facts…',
    'ui.results': 'Results',
    'empty.title': 'No products to inspect yet.',
    'empty.desc': 'Try one of these to begin:',
    'personas.eyebrow': 'Meet the team',
    'personas.title': 'Three ways FoodLens <em>thinks</em> about food',
    'personas.subtitle': 'Every feature is tested against three real people — not abstractions. See who we built this for.',
    'persona.p1.quote': '"I can live with a score I disagree with if I can see why it was given and decide for myself."',
    'persona.p1.desc': 'Time-poor. Cooks weeknights. Trusts algorithms only when the reasoning is visible. Configures once if it saves repeated decision effort. FoodLens shows him the contrastive sentence upfront — top card in under 15 seconds.',
    'persona.p2.quote': '"Tell me: compared to what you usually buy, this one has thirty percent less sugar and almost the same saturated fat."',
    'persona.p2.desc': 'Tight budget, minimal cooking routine. Sceptical of marketing. Demands a number he can verify. Every claim in the contrastive sentence is one tap away from the drill-down nutrient table.',
    'persona.p3.quote': '"What convinces me is a sharp sentence with a data point in it."',
    'persona.p3.desc': 'Knows greenwashing from the inside. Wants a sharp contrastive sentence with a datum. Resists moralising. The system never claims authority — every comparison is grounded in data, never in "our recommendation."',
    'footer.p1': '<span class="small-caps">FoodLens</span> is the WA4 prototype of the <em>Transparent Multi-Objective Food Recommendations</em> project at UIB — Master in Intelligent Systems, course 11755 Human-Computer Interaction.',
    'footer.p2': 'Data sourced from <a href="https://world.openfoodfacts.org" rel="noopener" target="_blank">Open Food Facts</a>, an open, collaborative database of food products from around the world. Scores reflect the official Nutri-Score (French public health authority) and Environmental Score (ADEME) methodologies — we consume them, we do not recompute them.',
    'footer.p3': 'Built with vanilla HTML, CSS and JavaScript. No build step. Open <code>index.html</code> to run.',
    'compare.clear': 'Clear',
    'compare.view': 'View Comparison',
    'compare.modal.title': 'Product Comparison',
    'compare.export': 'Export CSV',
    'compare.attr': 'Attributes',
    
    // --- NUEVOS: Card actions (JS dinámico) ---
    'card.see_numbers': 'See numbers',
    'card.adv_expl': 'Advanced explanation (SHAP)',
    'card.print': 'Print card',
    'card.share': 'Share product',
    'card.recipe': 'See recipe',
    'card.add_list': 'Add to list',
    'card.compare_usual': 'Compare with usual',
    'card.compare_add': '+ Add to comparison',
    'card.compare_sel': '☑ Selected',

    'cat.plant_milks': 'Plant Milks',
    'cat.cereals': 'Cereals',
    'cat.snacks': 'Snacks',
    'cat.drinks': 'Drinks',

    'cat.yogurts': 'Yogurts',
    'cat.cheeses': 'Cheeses',
    'cat.breads': 'Breads',
    'cat.fruit_juices': 'Fruit Juices',
    'cat.chocolates': 'Chocolates',
    'cat.breakfast_cereals': 'Breakfast Cereals',

    // --- Filters & Categories ---
    'cat.all': 'All categories',

    'filter.group.criteria': 'Diet & Ethics',
    'filter.group.allergens': 'Allergens',
    'filter.high_protein': 'High Protein',
    'filter.low_sodium': 'Low Sodium',
    'filter.plastic_free': 'Plastic-free',
    'filter.no_gluten': 'Gluten-free',
    'filter.no_lactose': 'Lactose-free',
    'filter.no_nuts': 'Nut-free',
    'filter.no_soy': 'Soy-free',
    'filter.no_egg': 'Egg-free',
    'filter.no_fish': 'Fish-free',
    'filter.low_co2': 'Low CO2',
    'filter.organic': 'Organic',
    'compare.usual_title': 'Compared to your usual choice',

    'compare.no_usual_saved': 'You haven\'t set a usual product yet. Click "Set as usual" on any product first!',
    'compare.same_usual': 'This is already your usual product! Inspect a different one to compare.',
    'compare.scrolling': 'Showing comparison below…',

    'compare.current_has': 'Current product has:',
    'compare.similar': 'Very similar profile to your usual.',

    'compare.less_sugar': 'less sugar',
    'compare.less_fat': 'less fat',
    'compare.less_satfat': 'less saturated fat',
    'compare.less_salt': 'less salt',
    'compare.more_protein': 'more protein',
    'compare.more_fiber': 'more fiber',
    'compare.per_100g': 'per 100g',
    'compare.better_nutri': 'better Nutri-Score',
    'compare.better_eco': 'better Eco-Score',
    'compare.usual_brand': 'Usual brand:',

    'compare.your_usual': 'Your usual choice:',
    'compare.compared_to_usual': 'Compared to this,',
    'compare.has': 'has',
    'compare.is_similar': 'has a very similar profile.',
    'compare.current_label': 'Current:',

    // --- Card actions / drill-down / chart UI ---
    'card.set_usual': 'Set as usual',
    'card.set_usual_category': 'Set as my usual {category}',
    'toast.usual_set': 'Saved! Now select a different product to compare.',
    'ui.selected_product': 'Selected product',
    'ui.better_alternatives': 'Better alternatives in this category',
    'ui.best_in_category': 'This is already among the best in its category.',
    'ui.health_vs_eco': 'Health vs Eco in this category',
    'ui.scatter_hint': 'Top-right corner = best on both axes. The orange star is this product.',
    'ui.chart_error': 'Chart library could not load, but the product scores above are still available.',
  },
  es: {
    // ... (Mantén aquí todos los que ya teníamos de es)
    'header.tagline': 'Recomendaciones alimentarias transparentes y multiobjetivo. Dos puntuaciones. Una frase de razonamiento por producto.',
    'header.settings': 'Ajustes',
    'search.label': 'Buscar productos',
    'search.input_label': 'Buscar un producto o código de barras',
    'search.placeholder': 'Escribe un nombre o pega un código de barras…',
    'search.inspect': 'Inspeccionar',
    'search.ingredient_label': 'Buscar por ingrediente',
    'search.ingredient': 'Ingrediente',
    'search.ingredient.placeholder': 'ej. almendras, gluten, avena',
    'weighting.title': '¿Qué pesa más en tu decisión hoy?',
    'weighting.health': 'Salud',
    'weighting.eco': 'Eco',
    'weighting.preset.eco': 'Priorizar Eco',
    'weighting.preset.balanced': 'Equilibrado',
    'weighting.preset.health': 'Priorizar Salud',
    'nav.search': 'Buscar',
    'nav.saved': 'Guardados',
    'nav.evaluate': 'Evaluar',
    'badge.offline': 'Mostrando datos de muestra sin conexión. La API de Open Food Facts no estaba accesible.',
    'seasonal.title': 'Contexto estacional',
    'seasonal.desc': 'Añade una ubicación aproximada para mostrar una pista de estacionalidad local para productos agrícolas.',
    'seasonal.btn.enable': 'Usar ubicación',
    'seasonal.btn.dismiss': 'Descartar',
    'ui.loading': 'Consultando Open Food Facts…',
    'ui.results': 'Resultados',
    'empty.title': 'Aún no hay productos para inspeccionar.',
    'empty.desc': 'Prueba uno de estos para empezar:',
    'personas.eyebrow': 'Conoce al equipo',
    'personas.title': 'Tres formas en las que FoodLens <em>piensa</em> sobre la comida',
    'personas.subtitle': 'Cada funcionalidad se prueba con tres personas reales, no abstracciones. Mira para quién construimos esto.',
    'persona.p1.quote': '"Puedo vivir con una puntuación con la que no estoy de acuerdo si veo por qué se dio y decido por mí mismo."',
    'persona.p1.desc': 'Falto de tiempo. Cocina entre semana. Confía en algoritmos solo cuando el razonamiento es visible. Configura una vez si le ahorra esfuerzo. FoodLens le muestra el razonamiento de frente en menos de 15 segundos.',
    'persona.p2.quote': '"Dime: en comparación con lo que compro habitualmente, este tiene un treinta por ciento menos de azúcar y casi las mismas grasas saturadas."',
    'persona.p2.desc': 'Presupuesto ajustado, rutina de cocina mínima. Escéptico del marketing. Exige un número que pueda verificar. Cada afirmación en la explicación está a un toque de la tabla nutricional.',
    'persona.p3.quote': '"Lo que me convence es una frase aguda con un dato."',
    'persona.p3.desc': 'Conoce el greenwashing desde dentro. Quiere una frase contrastiva clara con un dato. Resiste los moralismos. El sistema nunca reclama autoridad: toda comparación se basa en datos.',
    'footer.p1': '<span class="small-caps">FoodLens</span> es el prototipo WA4 del proyecto <em>Transparent Multi-Objective Food Recommendations</em> en la UIB — Máster en Sistemas Inteligentes, asignatura 11755 Interacción Persona-Ordenador.',
    'footer.p2': 'Datos obtenidos de <a href="https://world.openfoodfacts.org" rel="noopener" target="_blank">Open Food Facts</a>, una base de datos abierta y colaborativa mundial. Las puntuaciones reflejan las metodologías oficiales de Nutri-Score y Eco-Score.',
    'footer.p3': 'Construido con HTML, CSS y JavaScript vanilla. Sin pasos de compilación. Abre <code>index.html</code> para ejecutar.',
    'compare.clear': 'Borrar',
    'compare.view': 'Ver Comparación',
    'compare.modal.title': 'Comparación de Productos',
    'compare.export': 'Exportar CSV',
    'compare.attr': 'Atributos',

    // --- NUEVOS: Card actions (JS dinámico) ---
    'card.see_numbers': 'Ver números',
    'card.adv_expl': 'Explicación avanzada (SHAP)',
    'card.print': 'Imprimir tarjeta',
    'card.share': 'Compartir producto',
    'card.recipe': 'Ver receta',
    'card.add_list': 'Añadir a la lista',
    'card.compare_usual': 'Comparar con el habitual',
    'card.compare_add': '+ Añadir a comparar',
    'card.compare_sel': '☑ Seleccionado',

    // --- Filters & Categories ---
    'cat.all': 'Todas las categorías',

    'cat.plant_milks': 'Leches vegetales',
    'cat.cereals': 'Cereales',
    'cat.snacks': 'Snacks',
    'cat.drinks': 'Bebidas',

    'cat.yogurts': 'Yogures',
    'cat.cheeses': 'Quesos',
    'cat.breads': 'Panes',
    'cat.fruit_juices': 'Zumos de fruta',
    'cat.chocolates': 'Chocolates',
    'cat.breakfast_cereals': 'Cereales de desayuno',

    'filter.group.criteria': 'Dieta y Ética',
    'filter.group.allergens': 'Alérgenos',
    'filter.high_protein': 'Alto en proteína',
    'filter.low_sodium': 'Bajo en sodio',
    'filter.plastic_free': 'Sin plástico',
    'filter.no_gluten': 'Sin gluten',
    'filter.no_lactose': 'Sin lactosa',
    'filter.no_nuts': 'Sin frutos secos',
    'filter.no_soy': 'Sin soja',
    'filter.no_egg': 'Sin huevo',
    'filter.no_fish': 'Sin pescado',
    'filter.low_co2': 'Bajo CO2',
    'filter.organic': 'Ecológico',
    'compare.usual_title': 'Comparado con tu elección habitual',

    'compare.no_usual_saved': 'Aún no has fijado un producto habitual. ¡Pulsa primero "Set as usual" en cualquier producto!',
    'compare.same_usual': '¡Este ya es tu producto habitual! Inspecciona uno diferente para comparar.',
    'compare.scrolling': 'Mostrando la comparación abajo…',

    'compare.current_has': 'El producto actual tiene:',
    'compare.similar': 'Perfil muy similar al de tu habitual.',

    'compare.less_sugar': 'menos azúcar',
    'compare.less_fat': 'menos grasa',
    'compare.less_satfat': 'menos grasas saturadas',
    'compare.less_salt': 'menos sal',
    'compare.more_protein': 'más proteína',
    'compare.more_fiber': 'más fibra',
    'compare.per_100g': 'por 100g',
    'compare.better_nutri': 'mejor Nutri-Score',
    'compare.better_eco': 'mejor Eco-Score',

    'compare.your_usual': 'Tu elección habitual:',
    'compare.compared_to_usual': 'En comparación,',
    'compare.has': 'tiene',
    'compare.is_similar': 'tiene un perfil muy similar.',
    'compare.current_label': 'Actual:',

    // --- Card actions / drill-down / chart UI ---
    'card.set_usual': 'Fijar como habitual',
    'card.set_usual_category': 'Fijar como mi {category} habitual',
    'toast.usual_set': '¡Guardado! Ahora selecciona un producto diferente para comparar.',
    'ui.selected_product': 'Producto seleccionado',
    'ui.better_alternatives': 'Mejores alternativas en esta categoría',
    'ui.best_in_category': 'Este ya está entre los mejores de su categoría.',
    'ui.health_vs_eco': 'Salud frente a Eco en esta categoría',
    'ui.scatter_hint': 'Esquina superior derecha = mejor en ambos ejes. La estrella naranja es este producto.',
    'ui.chart_error': 'No se pudo cargar la librería de gráficos, pero las puntuaciones del producto siguen disponibles arriba.',

  },
  ca: {
    // ... (Mantén aquí todos los que ya teníamos de ca)
    'header.tagline': 'Recomanacions alimentàries transparents i multiobjectiu. Dues puntuacions. Una frase de raonament per producte.',
    'header.settings': 'Ajustaments',
    'search.label': 'Cercar productes',
    'search.input_label': 'Cercar un producte o codi de barres',
    'search.placeholder': 'Escriu un nom o enganxa un codi de barres…',
    'search.inspect': 'Inspeccionar',
    'search.ingredient_label': 'Cercar per ingredient',
    'search.ingredient': 'Ingredient',
    'search.ingredient.placeholder': 'ex. ametlles, gluten, civada',
    'weighting.title': 'Què pesa més en la teva decisió avui?',
    'weighting.health': 'Salut',
    'weighting.eco': 'Eco',
    'weighting.preset.eco': 'Prioritzar Eco',
    'weighting.preset.balanced': 'Equilibrat',
    'weighting.preset.health': 'Prioritzar Salut',
    'nav.search': 'Cercar',
    'nav.saved': 'Desats',
    'nav.evaluate': 'Avaluar',
    'badge.offline': 'Mostrant dades de mostra sense connexió. L\'API d\'Open Food Facts no era accessible.',
    'seasonal.title': 'Context estacional',
    'seasonal.desc': 'Afegeix una ubicació aproximada per mostrar una pista d\'estacionalitat local per productes agrícoles.',
    'seasonal.btn.enable': 'Utilitzar ubicació',
    'seasonal.btn.dismiss': 'Descartar',
    'ui.loading': 'Consultant Open Food Facts…',
    'ui.results': 'Resultats',
    'empty.title': 'Encara no hi ha productes per inspeccionar.',
    'empty.desc': 'Prova un d\'aquests per començar:',
    'personas.eyebrow': 'Coneix l\'equip',
    'personas.title': 'Tres maneres en les quals FoodLens <em>pensa</em> sobre el menjar',
    'personas.subtitle': 'Cada funcionalitat es prova amb tres persones reals, no abstraccions. Mira per a qui construïm això.',
    'persona.p1.quote': '"Puc viure amb una puntuació amb la qual no estic d\'acord si veig per què es va donar i decideixo per mi mateix."',
    'persona.p1.desc': 'Mancat de temps. Cuina entre setmana. Confia en algorismes només quan el raonament és visible. Configura un cop si li estalvia esforç. FoodLens li mostra el raonament de cara en menys de 15 segons.',
    'persona.p2.quote': '"Digues-me: en comparació amb el que compro habitualment, aquest té un trenta per cent menys de sucre i gairebé els mateixos greixos saturats."',
    'persona.p2.desc': 'Pressupost ajustat, rutina de cuina mínima. Escèptic del màrqueting. Exigeix un número que pugui verificar. Cada afirmació en l\'explicació està a un toc de la taula nutricional.',
    'persona.p3.quote': '"El que em convenç és una frase aguda amb una dada."',
    'persona.p3.desc': 'Coneix el greenwashing des de dins. Vol una frase contrastiva clara amb una dada. Resisteix els moralismes. El sistema mai reclama autoritat: tota comparació es basa en dades.',
    'footer.p1': '<span class="small-caps">FoodLens</span> és el prototip WA4 del projecte <em>Transparent Multi-Objective Food Recommendations</em> a la UIB — Màster en Sistemes Intel·ligents, assignatura 11755 Interacció Persona-Ordinador.',
    'footer.p2': 'Dades obtingudes d\'<a href="https://world.openfoodfacts.org" rel="noopener" target="_blank">Open Food Facts</a>, una base de dades oberta i col·laborativa mundial. Les puntuacions reflecteixen les metodologies oficials de Nutri-Score i Eco-Score.',
    'footer.p3': 'Construït amb HTML, CSS i JavaScript vanilla. Sense passos de compilació. Obre <code>index.html</code> per executar.',
    'compare.clear': 'Esborrar',
    'compare.view': 'Veure Comparació',
    'compare.modal.title': 'Comparació de Productes',
    'compare.export': 'Exportar CSV',
    'compare.attr': 'Atributs',

    // --- NUEVOS: Card actions (JS dinámico) ---
    'card.see_numbers': 'Veure números',
    'card.adv_expl': 'Explicació avançada (SHAP)',
    'card.print': 'Imprimir targeta',
    'card.share': 'Compartir producte',
    'card.recipe': 'Veure recepta',
    'card.add_list': 'Afegir a la llista',
    'card.compare_usual': 'Comparar amb l\'habitual',
    'card.compare_add': '+ Afegir a comparar',
    'card.compare_sel': '☑ Seleccionat',

    // --- Filters & Categories ---
    'cat.all': 'Totes les categories',

    'cat.plant_milks': 'Llets vegetals',
    'cat.cereals': 'Cereals',
    'cat.snacks': 'Snacks',
    'cat.drinks': 'Begudes',

    'cat.yogurts': 'Iogurts',
    'cat.cheeses': 'Formatges',
    'cat.breads': 'Pans',
    'cat.fruit_juices': 'Sucs de fruita',
    'cat.chocolates': 'Xocolates',
    'cat.breakfast_cereals': 'Cereals d\'esmorzar',

    'filter.group.criteria': 'Dieta i Ètica',
    'filter.group.allergens': 'Al·lèrgens',
    'filter.high_protein': 'Alt en proteïna',
    'filter.low_sodium': 'Baix en sodi',
    'filter.plastic_free': 'Sense plàstic',
    'filter.no_gluten': 'Sense gluten',
    'filter.no_lactose': 'Sense lactosa',
    'filter.no_nuts': 'Sense fruits secs',
    'filter.no_soy': 'Sense soja',
    'filter.no_egg': 'Sense ou',
    'filter.no_fish': 'Sense peix',
    'filter.low_co2': 'Baix CO2',
    'filter.organic': 'Ecològic',
    'compare.usual_title': 'Comparat amb la teva elecció habitual',

    'compare.no_usual_saved': 'Encara no has fixat un producte habitual. Prem primer "Set as usual" en qualsevol producte!',
    'compare.same_usual': 'Aquest ja és el teu producte habitual! Inspecciona un de diferent per comparar.',
    'compare.scrolling': 'Mostrant la comparació a baix…',

    'compare.current_has': 'Aquest producte té:',
    'compare.similar': 'Perfil molt similar al teu habitual.',

    'compare.less_sugar': 'menys sucre',
    'compare.less_fat': 'menys greix',
    'compare.less_satfat': 'menys greixos saturats',
    'compare.less_salt': 'menys sal',
    'compare.more_protein': 'més proteïna',
    'compare.more_fiber': 'més fibra',
    'compare.per_100g': 'per 100g',
    'compare.better_nutri': 'millor Nutri-Score',
    'compare.better_eco': 'millor Eco-Score',
    'compare.usual_brand': 'Marca habitual:',

    'compare.your_usual': 'La teva elecció habitual:',
    'compare.compared_to_usual': 'En comparació,',
    'compare.has': 'té',
    'compare.is_similar': 'té un perfil molt similar.',
    'compare.current_label': 'Actual:',

    // --- Card actions / drill-down / chart UI ---
    'card.set_usual': 'Fixar com a habitual',
    'card.set_usual_category': 'Fixar com el meu {category} habitual',
    'toast.usual_set': 'Desat! Ara selecciona un producte diferent per comparar.',
    'ui.selected_product': 'Producte seleccionat',
    'ui.better_alternatives': 'Millors alternatives en aquesta categoria',
    'ui.best_in_category': 'Aquest ja és entre els millors de la seva categoria.',
    'ui.health_vs_eco': 'Salut enfront d\'Eco en aquesta categoria',
    'ui.scatter_hint': 'Cantonada superior dreta = millor en tots dos eixos. L\'estrella taronja és aquest producte.',
    'ui.chart_error': 'No s\'ha pogut carregar la llibreria de gràfics, però les puntuacions del producte continuen disponibles a dalt.',
  }
};

export function getCurrentLang() {
  const saved = localStorage.getItem(I18N_STORAGE_KEY);
  if (saved && translations[saved]) return saved;
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  if (translations[browserLang]) return browserLang;
  return 'en';
}

// NUEVO: Función auxiliar para traducir textos "al vuelo" en JS
export function t(key, fallback = '') {
  const lang = getCurrentLang();
  return translations[lang]?.[key] || fallback;
}

export function setLang(langCode) {
  if (!translations[langCode]) return;
  localStorage.setItem(I18N_STORAGE_KEY, langCode);
  document.documentElement.lang = langCode;
  updateDOM(langCode);
  updateActiveLangButton(langCode);
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: langCode } }));
}

function updateDOM(lang) {
  const dict = translations[lang];

  // 1. Textos puros y Placeholders (lo que ya teníamos)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (!dict[key]) return;
    if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
      el.setAttribute('placeholder', dict[key]);
    } else {
      el.textContent = dict[key];
    }
  });

  // 2. Elementos con HTML interno (Footer, etc)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (dict[key]) el.innerHTML = dict[key];
  });

  // --- NUEVO: Actualización dinámica de botones de comparar ---
  // Buscamos todos los botones de comparación que creamos en renderProductCard
  document.querySelectorAll('.compare-custom-toggle').forEach(el => {
    if (dict['card.compare_add']) el.dataset.textAdd = dict['card.compare_add'];
    if (dict['card.compare_sel']) el.dataset.textSelected = dict['card.compare_sel'];
  });
}

function updateActiveLangButton(lang) {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    const isActive = btn.dataset.lang === lang;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive);
  });
}

export function initI18n() {
  const lang = getCurrentLang();
  document.documentElement.lang = lang;
  updateDOM(lang);
  updateActiveLangButton(lang);
}