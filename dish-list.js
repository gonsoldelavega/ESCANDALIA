/* ==========================================================================
 * dish-list.js — Pantalla de listado de platos con búsqueda.
 *
 * La pestaña "Platos" abría directamente el detalle del último plato. Ahora
 * abre un listado real, buscable, que enlaza a cada plato. Reutiliza el estilo
 * de dish-card y las funciones de coste/margen existentes.
 *
 * Depende de: dishes, primaryFormat, formatCost, dishMargin, marginClass,
 * currency, percent, yieldCount, escapeHtml, showScreen, activateDynamicScreen.
 * Carga DESPUÉS de product-actions.js.
 * ========================================================================== */

let dishListSearch = '';

function ensureDishesScreen() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav || document.querySelector('[data-screen="dishes"]')) return;
  nav.insertAdjacentHTML('beforebegin', `<section class="app-screen" data-screen="dishes"><header class="hero hero-brown compact-hero"><div class="orb orb-soft"></div><div class="topbar"><div class="brand">Escandali<span>a</span></div></div><h1>Tus platos</h1><p>Busca, revisa márgenes y edita recetas.</p></header><div class="content"><label class="dish-search"><input class="dish-search-input" type="search" placeholder="Buscar plato o categoría…" aria-label="Buscar plato" /></label><div class="section-row"><div class="section-title">Todos los platos</div><button class="text-action" type="button" data-go="add-dish">Añadir</button></div><div class="dishes-full-list"></div></div></section>`);
}

function renderDishesList() {
  const list = document.querySelector('.dishes-full-list');
  if (!list) return;
  const query = dishListSearch.trim().toLowerCase();
  const filtered = dishes.filter((dish) => {
    if (!query) return true;
    return `${dish.name} ${dish.category || ''}`.toLowerCase().includes(query);
  });
  if (!dishes.length) {
    list.innerHTML = '<div class="empty-note">Aún no tienes platos. Pulsa “Añadir” para crear el primero.</div>';
    return;
  }
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-note">Ningún plato coincide con la búsqueda.</div>';
    return;
  }
  // Agrupar por categoría para una lista más legible.
  const groups = {};
  filtered.forEach((dish) => {
    const cat = dish.category || 'Otros';
    (groups[cat] = groups[cat] || []).push(dish);
  });
  list.innerHTML = Object.entries(groups).map(([cat, group]) => {
    const cards = group.map((dish) => {
      const format = primaryFormat(dish);
      const margin = dishMargin(dish);
      const hasRecipe = Boolean(dish.recipe?.length);
      return `<article class="dish-card" data-go="dish-detail" data-dish-id="${dish.id}" role="button" tabindex="0"><div class="dish-thumb ${dish.icon}"></div><div class="dish-info"><h3>${escapeHtml(dish.name)}${dish.published ? '' : ' <span class="dish-draft">borrador</span>'}</h3><p>${hasRecipe ? `Coste <b>${currency(formatCost(dish, format))}</b> · PVP ${currency(format.pvp)}` : 'Sin receta · añade ingredientes'}</p></div><span class="margin-badge ${marginClass(margin)}">${hasRecipe ? percent(margin) : '--'}</span></article>`;
    }).join('');
    return `<div class="dishes-group"><div class="dishes-group-title">${escapeHtml(cat)} · ${group.length}</div>${cards}</div>`;
  }).join('');
}

if (typeof showScreen === 'function') {
  const prevShowScreenDishes = showScreen;
  showScreen = function showScreenWithDishes(name) {
    prevShowScreenDishes(name);
    if (name === 'dishes') {
      if (typeof activateDynamicScreen === 'function') activateDynamicScreen(name);
      renderDishesList();
    }
  };
}

document.addEventListener('input', (event) => {
  const input = event.target.closest('.dish-search-input');
  if (!input) return;
  dishListSearch = input.value;
  renderDishesList();
});

ensureDishesScreen();
