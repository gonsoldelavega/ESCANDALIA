/* cost functions moved to cost-engine.js */

function ensureDishFormats(dish) {
  if (!dish) return [];
  dish.formats = defaultFormats(dish).map((format) => ({
    id: format.id,
    name: format.name,
    portions: Number(format.portions) || 1,
    pvp: roundMoney(format.pvp),
  }));
  return dish.formats;
}

function ensureProductScreens() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;
  if (!document.querySelector('[data-screen="ingredient-costs"]')) {
    nav.insertAdjacentHTML('beforebegin', `<section class="app-screen" data-screen="ingredient-costs"><header class="hero hero-rust compact-hero"><button class="back" type="button" data-go="ingredient-alert">← Volver</button><h1>Revisar compra</h1><p>Edita el coste actual de cada producto.</p></header><div class="content"><div class="section-title">Costes de ingredientes</div><div class="cost-editor"></div><button class="primary-button save-costs" type="button">Guardar costes</button></div></section>`);
  }
  if (!document.querySelector('[data-screen="settings"]')) {
    nav.insertAdjacentHTML('beforebegin', `<section class="app-screen" data-screen="settings"><header class="hero hero-dark compact-hero"><button class="back" type="button" data-go="home">← Volver</button><h1>Ajustes</h1><p>Tu negocio, margen objetivo y cuenta en la nube.</p></header><div class="content settings-content"><article class="settings-card settings-main"><span class="settings-kicker">Negocio</span><h3 class="settings-business">Bar El Rincón</h3><p>Estos datos se usan en el dashboard, carta QR y escandallos.</p></article><article class="settings-card"><div><span class="settings-kicker">Margen objetivo</span><h3 class="settings-margin">75%</h3><p>Escandalia te avisará cuando un plato quede por debajo.</p></div></article><article class="settings-card"><div><span class="settings-kicker">Carta pública</span><h3 class="settings-menu-url">escandalia.app/barelrincón</h3><p>URL que verán tus clientes al escanear el QR.</p></div></article><article class="settings-card settings-account"><div><span class="settings-kicker">Cuenta y nube</span><h3 class="settings-cloud">Guardado en Supabase</h3><p class="settings-email">Sesión activa.</p></div><button class="secondary-button logout-button" type="button">Salir</button></article></div></section>`);
  }
}

function activateDynamicScreen(name) {
  const screen = document.querySelector(`[data-screen="${name}"]`);
  if (!screen) return;
  document.querySelectorAll('.app-screen').forEach((item) => item.classList.toggle('is-active', item === screen));
  // The bottom nav must stay reachable from every screen so switching tabs is
  // always one tap away. Only the public customer menu hides it. The active-tab
  // highlight is set by the base showScreen (which maps sub-screens like
  // edit-recipe / ingredient-costs to their parent tab), so we don't override
  // it here.
  const isPublic = name === 'public-menu';
  const bottomNav = document.querySelector('.bottom-nav');
  const quickAdd = document.querySelector('.fab');
  const phoneShell = document.querySelector('.phone-shell');
  if (bottomNav) bottomNav.style.display = isPublic ? 'none' : 'grid';
  if (quickAdd) quickAdd.style.display = name === 'home' ? 'block' : 'none';
  phoneShell?.classList.toggle('nav-hidden', isPublic);
}

function renderCostEditor() {
  const editor = document.querySelector('.cost-editor');
  if (!editor || typeof ingredients === 'undefined') return;
  editor.innerHTML = Object.entries(ingredients).map(([id, item]) => {
    const scale = displayScale(item.unit);
    const unitLabel = item.unit === 'g' ? 'kg' : item.unit === 'ml' ? 'L' : item.unit;
    return `<label class="cost-row"><div><strong>${escapeHtml(item.name)}</strong><span>Antes: ${currency((item.before || item.current) * scale)}/${unitLabel}</span></div><input data-ingredient-cost="${id}" value="${currency(item.current * scale).replace('€','')}" inputmode="decimal" /></label>`;
  }).join('');
}

function ingredientOptions(selectedId) {
  return Object.entries(ingredients).map(([id, item]) => `<option value="${id}" ${id === selectedId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
}

function formatRows(dish) {
  return ensureDishFormats(dish).map((format, index) => `<label class="format-row"><div><strong>${format.name}</strong><span>Coste: ${currency(formatCost(dish, format))} · Margen ${percent(formatMargin(dish, format))}</span></div><input data-format-portions="${index}" value="${format.portions}" inputmode="decimal" aria-label="Porciones de ${format.name}" /><input data-format-pvp="${index}" value="${currency(format.pvp).replace('€','')}" inputmode="decimal" aria-label="PVP de ${format.name}" /></label>`).join('');
}

function renderRecipeEditor() {
  const dish = selectedDish?.();
  const list = document.querySelector('.edit-list');
  if (!dish || !list) return;
  const recipeRows = dish.recipe.length ? dish.recipe.map((line, index) => {
    const item = ingredients[line.ingredient] || { name: 'Ingrediente', unit: '' };
    return `<label class="edit-row recipe-row"><select data-recipe-ingredient="${index}">${ingredientOptions(line.ingredient)}</select><div><input data-recipe-index="${index}" value="${line.qty}" inputmode="decimal" /><span>${item.unit} · ${currency(ingredientCost(line))}</span></div><button class="icon-button remove-recipe-line" type="button" data-remove-line="${index}" aria-label="Quitar ingrediente">×</button></label>`;
  }).join('') : `<div class="empty-note">Este plato todavía no tiene ingredientes. Añade ingredientes para calcular el coste real.</div>`;
  list.innerHTML = `<div class="section-title">Receta base</div>${recipeRows}<button class="secondary-button add-recipe-line" type="button">Añadir ingrediente</button><div class="section-title">Rendimiento</div><label class="yield-row"><div><strong>¿Cuántas tapas salen?</strong><span>Ejemplo: una tortilla entera puede salir en 8 tapas.</span></div><input class="yield-input" value="${yieldCount(dish)}" inputmode="decimal" /></label><div class="section-title">Formatos de venta</div><div class="format-helper">Cada formato usa una cantidad de tapas base. Cambia porciones y PVP para calcular margen real.</div>${formatRows(dish)}`;
  document.querySelector('.sticky-summary').innerHTML = `<span>Coste receta <b>${currency(baseRecipeCost(dish))}</b></span><span>Coste tapa <b>${currency(unitCost(dish))}</b></span>`;
}

function renderSettingsScreen() {
  const name = business?.name || 'Tu negocio';
  const margin = Math.round((business?.targetMargin || 0.75) * 100);
  const slug = business?.slug || 'tu-bar';
  const email = session?.user?.email || 'Sin sesión activa';
  const businessNode = document.querySelector('.settings-business');
  const marginNode = document.querySelector('.settings-margin');
  const urlNode = document.querySelector('.settings-menu-url');
  const emailNode = document.querySelector('.settings-email');
  const cloudNode = document.querySelector('.settings-cloud');
  if (businessNode) businessNode.textContent = name;
  if (marginNode) marginNode.textContent = `${margin}% de margen bruto objetivo`;
  if (urlNode) urlNode.textContent = `escandalia.app/${slug}`;
  if (emailNode) emailNode.textContent = email;
  if (cloudNode) cloudNode.textContent = session?.user ? 'Datos guardados en la nube' : 'Modo sin sesión';
}

function prepareEmptyDishForm() {
  const screen = document.querySelector('[data-screen="add-dish"]');
  if (!screen) return;
  const inputs = screen.querySelectorAll('input');
  inputs.forEach((input) => { input.value = ''; });
  screen.querySelectorAll('.editable-row').forEach((row) => row.classList.add('is-hidden'));
  const summary = screen.querySelector('.summary-panel');
  if (summary) summary.innerHTML = `<span>Coste receta</span><strong>0,00€</strong><span>Coste por tapa</span><strong class="good-text">--</strong>`;
}

let escandallosFilter = 'all';

function escandalloState(margin) {
  if (margin >= 0.7) return 'good';
  if (margin >= 0.62) return 'mid';
  return 'low';
}

function escandalloBadgeLabel(margin) {
  if (margin >= 0.7) return 'Margen bueno';
  if (margin >= 0.62) return 'Margen medio';
  return 'Margen bajo';
}

function renderEscandallosOverview() {
  const list = document.querySelector('.escandallos-list');
  if (!list) return;
  const rows = [...dishes].map((dish) => {
    const format = primaryFormat(dish);
    const margin = formatMargin(dish, format);
    const hasRecipe = Boolean(dish.recipe?.length);
    return { dish, format, margin, hasRecipe, state: hasRecipe ? escandalloState(margin) : 'low' };
  }).sort((a, b) => a.margin - b.margin);
  if (!rows.length) {
    list.innerHTML = '<div class="empty-note">Sin datos. Añade platos para ver escandallos.</div>';
    return;
  }
  const visibleRows = escandallosFilter === 'all' ? rows : rows.filter((item) => item.state === escandallosFilter);
  const reviewCount = rows.filter((item) => item.state === 'low').length;
  const goodCount = rows.filter((item) => item.state === 'good').length;
  const averageMargin = rows.length ? rows.reduce((sum, item) => sum + item.margin, 0) / rows.length : 0;
  const filters = [
    ['all', 'Todos'],
    ['low', 'Margen bajo'],
    ['mid', 'Margen medio'],
    ['good', 'Margen bueno']
  ];
  list.innerHTML = `<div class="escandallos-summary"><article><strong>${reviewCount}</strong><span>platos a revisar</span></article><article><strong>${goodCount}</strong><span>margen saludable</span></article><article><strong>${percent(averageMargin)}</strong><span>margen medio estimado</span></article></div><div class="escandallos-priority">Revisar estos platos primero</div><div class="escandallos-filters" aria-label="Filtros de margen">${filters.map(([value, label]) => `<button class="${escandallosFilter === value ? 'is-active' : ''}" type="button" data-escandallo-filter="${value}">${label}</button>`).join('')}</div>${visibleRows.length ? visibleRows.map(({ dish, format, margin, hasRecipe }) => {
    const cost = formatCost(dish, format);
    const pvp = Number(format.pvp) || 0;
    const foodCost = pvp > 0 ? cost / pvp : 0;
    const badgeClass = marginClass(margin);
    return `<article class="escandallo-card ${badgeClass}" data-dish-id="${dish.id}"><div class="escandallo-main"><span class="escandallo-kicker">${hasRecipe ? escandalloBadgeLabel(margin) : 'Pendiente de receta'}</span><h3>${escapeHtml(dish.name)}</h3><p>Coste del plato <b>${hasRecipe ? currency(cost) : 'Sin datos'}</b> · PVP actual <b>${currency(pvp)}</b></p></div><div class="escandallo-metrics"><div><span>Margen estimado</span><strong>${hasRecipe ? percent(margin) : '--'}</strong></div><div><span>Food cost</span><strong>${hasRecipe && pvp > 0 ? percent(foodCost) : '--'}</strong></div></div><div class="escandallo-actions"><button class="secondary-button compact-action" type="button" data-go="dish-detail" data-dish-id="${dish.id}">Ver detalle</button><button class="primary-button compact-action" type="button" data-go="ai-price" data-dish-id="${dish.id}">Revisar precio</button></div></article>`;
  }).join('') : '<div class="empty-note">No hay platos en este filtro.</div>'}`;
}

renderHome = function patchedRenderHome() {
  const margins = dishes.map((dish) => dishMargin(dish));
  const averageMargin = margins.length ? margins.reduce((sum, item) => sum + item, 0) / margins.length : 0;
  const alerts = typeof getCostAlerts === "function" ? getCostAlerts() : [];
  document.querySelector('.avatar').textContent = business.ownerInitials;
  document.querySelector("[data-screen='home'] .hero h1").textContent = business.name;
  const kpis = document.querySelectorAll("[data-screen='home'] .kpi strong");
  kpis[0].textContent = percent(averageMargin);
  kpis[1].textContent = dishes.filter((d) => d.published !== false).length;
  kpis[2].textContent = alerts.length;
  kpis[2]?.closest('.kpi')?.classList.toggle('kpi-alert', alerts.length > 0);
  const alertsList = document.querySelector('.alerts-list');
  if (alertsList) {
    alertsList.innerHTML = alerts.length === 0
      ? '<div class="no-alerts"><span class="no-alerts-check">✓</span> Todo en orden · Sin alertas activas</div>'
      : alerts.map((a) => `<article class="alert-card" role="button" tabindex="0" data-go="ingredient-alert" data-ing-id="${a.ingredientId}"><div class="food-icon olive"></div><div><h2>${escapeHtml(a.ingredient.name)} +${Math.round(a.rise * 100)}%</h2><p>${a.affected.length} plato${a.affected.length !== 1 ? "s" : ""} por debajo del margen objetivo</p></div></article>`).join('');
  }
  document.querySelector('.dish-list').innerHTML = dishes.map((dish) => {
    const format = primaryFormat(dish);
    return `<article class="dish-card" data-go="dish-detail" data-dish-id="${dish.id}" role="button" tabindex="0"><div class="dish-thumb ${dish.icon}"></div><div class="dish-info"><h3>${escapeHtml(dish.name)}</h3><p>${escapeHtml(format.name)}: coste <b>${currency(formatCost(dish, format))}</b> · PVP ${currency(format.pvp)}</p><small>Receta base: ${yieldCount(dish)} tapas</small></div><span class="margin-badge ${marginClass(dishMargin(dish))}">${percent(dishMargin(dish))}</span></article>`;
  }).join('');
  renderEscandallosOverview();
  // Los KPIs del dashboard son accionables (margen / platos activos / alertas).
  // Se configura aquí en cada render en vez de con un setInterval.
  document.querySelectorAll('[data-screen="home"] .kpi').forEach((card, index) => {
    card.tabIndex = 0;
    card.dataset.action = index === 1 ? 'active-dishes' : index === 2 ? 'alerts' : 'margin';
  });
  document.querySelector('.session-chip')?.remove();
};

renderDetail = function patchedRenderDetail() {
  const dish = selectedDish(); if (!dish) return;
  const screen = document.querySelector("[data-screen='dish-detail']");
  const format = primaryFormat(dish);
  const margin = formatMargin(dish, format);
  screen.querySelector('h1').innerHTML = escapeHtml(dish.name).replace(' de ', ' de<br />');
  screen.querySelector('.muted-on-dark').textContent = `Receta base · salen ${yieldCount(dish)} tapas · Actualizado hoy`;
  screen.querySelector('.status-pill strong').textContent = percent(margin);
  screen.querySelector('.status-pill span').textContent = margin >= 0.7 ? `${format.name} · margen saludable` : `${format.name} · revisar precio`;
  screen.querySelector('.ingredient-list').innerHTML = dish.recipe.length ? dish.recipe.map((line) => `<div><span>${escapeHtml(ingredients[line.ingredient]?.name || 'Ingrediente')}</span><em>${line.qty} ${escapeHtml(ingredients[line.ingredient]?.unit || '')}</em><b>${currency(ingredientCost(line))}</b></div>`).join('') : `<div class="empty-note">Este plato todavía no tiene receta base.</div>`;
  screen.querySelector('.total-card span').textContent = 'Coste receta base';
  screen.querySelector('.total-card strong').textContent = currency(baseRecipeCost(dish));
  screen.querySelector('.price-row').innerHTML = `<span>Coste por tapa base</span><strong>${currency(unitCost(dish))}</strong>`;
  screen.querySelector('.format-summary')?.remove();
  screen.querySelector('.price-row').insertAdjacentHTML('afterend', `<div class="format-summary">${defaultFormats(dish).map((item) => `<article><span>${item.name}</span><b>${currency(item.pvp)}</b><em>${currency(formatCost(dish, item))} coste · ${percent(formatMargin(dish, item))}</em></article>`).join('')}</div>`);
  document.querySelector('.sticky-summary').innerHTML = `<span>Coste receta <b>${currency(baseRecipeCost(dish))}</b></span><span>Tapa base <b>${currency(unitCost(dish))}</b></span>`;
  const publishBtn = screen.querySelector('.publish-toggle');
  if (publishBtn) {
    publishBtn.textContent = dish.published ? 'Quitar de la carta' : 'Publicar en la carta';
    publishBtn.classList.toggle('is-published', Boolean(dish.published));
  }
};

async function toggleDishPublished() {
  const dish = selectedDish?.();
  if (!dish) return;
  dish.published = !dish.published;
  if (useSupabase && session && supabase) {
    await supabase.from('dishes').update({ published: dish.published }).eq('id', dish.id);
  }
  renderAll();
  showSync?.(dish.published ? 'Plato publicado en la carta' : 'Plato retirado de la carta');
}

renderAiPrice = function patchedRenderAiPrice() {
  const dish = oilAlert().affected[0]?.dish || selectedDish(); if (!dish) return;
  const format = primaryFormat(dish);
  const recommended = suggestedPrice(dish, business.targetMargin, format);
  const marginWithNewPrice = (recommended - formatCost(dish, format)) / recommended;
  const screen = document.querySelector("[data-screen='ai-price']");
  screen.querySelector('.hero p').textContent = `${dish.name} · ${format.name}`;
  screen.querySelector('.recommendation strong').textContent = currency(recommended);
  screen.querySelector('.compare-list').innerHTML = `<div><span>PVP actual</span><b>${currency(format.pvp)}</b></div><div><span>Coste ${format.name}</span><b>${currency(formatCost(dish, format))}</b></div><div><span>Margen actual</span><b>${percent(formatMargin(dish, format))}</b></div><div><span>Con nuevo PVP</span><b>${percent(marginWithNewPrice)}</b></div>`;
};

function resolveDishFormats(dish) {
  if (!dish) return [];
  if (dish.formats?.length) return dish.formats;
  return ensureDishFormats(dish);
}

function applyFormatChanges(dish) {
  const yieldInput = document.querySelector('.yield-input');
  if (yieldInput) dish.servings = Math.max(numberFromInput(yieldInput.value, yieldCount(dish)), 1);
  document.querySelectorAll('[data-format-portions]').forEach((input) => {
    const index = Number(input.dataset.formatPortions);
    if (dish.formats[index]) dish.formats[index].portions = Math.max(numberFromInput(input.value, dish.formats[index].portions), 0.01);
  });
  document.querySelectorAll('[data-format-pvp]').forEach((input) => {
    const index = Number(input.dataset.formatPvp);
    if (dish.formats[index]) dish.formats[index].pvp = roundMoney(numberFromInput(input.value, dish.formats[index].pvp));
  });
  dish.pvp = primaryFormat(dish).pvp;
}

async function saveIngredientCosts() {
  const inputs = [...document.querySelectorAll('[data-ingredient-cost]')];
  for (const input of inputs) {
    const id = input.dataset.ingredientCost;
    const item = ingredients[id];
    if (!item) continue;
    const raw = Number(input.value.replace('€', '').replace(',', '.')) || 0;
    const nextCost = raw / displayScale(item.unit);
    item.before = item.current;
    item.current = nextCost;
    if (typeof useSupabase !== 'undefined' && useSupabase && session && supabase) {
      await supabase.from('ingredients').update({ previous_cost: item.before, current_cost: item.current }).eq('id', id);
    }
  }
  if (typeof loadFromSupabase === 'function' && useSupabase && session) await loadFromSupabase();
  renderAll();
  renderCostEditor();
  showSync?.('Costes de compra actualizados');
}

async function saveRecipeQuantities() {
  const dish = selectedDish?.();
  if (!dish) return;
  dish.recipe = [...document.querySelectorAll('[data-recipe-index]')].map((input) => {
    const index = Number(input.dataset.recipeIndex);
    const ingredientInput = document.querySelector(`[data-recipe-ingredient="${index}"]`);
    return { ingredient: ingredientInput?.value, qty: Math.max(numberFromInput(input.value, dish.recipe[index]?.qty || 1), 0.0001) };
  }).filter((line) => line.ingredient);
  ensureDishFormats(dish);
  applyFormatChanges(dish);
  if (typeof useSupabase !== 'undefined' && useSupabase && session && supabase) {
    await supabase.from('dishes').update({ servings: dish.servings, pvp: dish.pvp }).eq('id', dish.id);
    await supabase.from('dish_ingredients').delete().eq('dish_id', dish.id);
    if (dish.recipe.length) {
      await supabase.from('dish_ingredients').insert(dish.recipe.map((line, index) => ({ dish_id: dish.id, ingredient_id: line.ingredient, quantity: line.qty, sort_order: index })));
    }
    await loadFromSupabase();
  }
  renderAll();
  renderRecipeEditor();
  showSync?.('Receta, rendimiento y formatos actualizados');
}

const originalShowScreen = showScreen;
showScreen = function patchedShowScreen(name) {
  originalShowScreen(name);
  activateDynamicScreen(name);
  if (name === 'ingredient-costs') renderCostEditor();
  if (name === 'edit-recipe') renderRecipeEditor();
  if (name === 'settings') renderSettingsScreen();
  if (name === 'add-dish') prepareEmptyDishForm();
};

const originalRenderSessionChip = renderSessionChip;
renderSessionChip = function settingsOnlySessionState() {
  document.querySelector('.session-chip')?.remove();
  renderSettingsScreen();
};

createDishFromForm = async function createBlankDishFromForm() {
  const inputs = document.querySelectorAll('[data-screen="add-dish"] input');
  const name = inputs[0]?.value.trim();
  const category = inputs[1]?.value.trim() || 'Tapas';
  const servings = Math.max(numberFromInput(inputs[2]?.value, 1), 1);
  const pvp = roundMoney(numberFromInput(inputs[3]?.value, 0));
  if (!name) return showSync?.('Pon un nombre al plato');
  if (dishes.some((dish) => dish.name.toLowerCase() === name.toLowerCase())) return showSync?.('Ese plato ya existe');
  if (useSupabase && session && supabase) {
    const { data, error } = await supabase.from('dishes').insert({ business_id: businessId, name, category, servings, pvp, published: false, description: '', allergens: 'Pendiente de revisar', image_key: 'olive-thumb' }).select('id').single();
    if (error) return showSync?.(error.message);
    selectedDishId = data.id;
    await loadFromSupabase();
  } else {
    const id = uniqueId(name, dishes.map((dish) => dish.id));
    dishes.push({ id, name, category, servings, pvp, icon: 'olive-thumb', published: false, description: '', allergens: 'Pendiente de revisar', recipe: [], formats: defaultFormats({ pvp }) });
    selectedDishId = id;
  }
  renderAll();
  showScreen('dish-detail');
  showSync?.('Plato creado. Ahora añade la receta base.');
};

const previousApplyRecommendedPriceForProductActions = applyRecommendedPrice;
applyRecommendedPrice = async function patchedApplyRecommendedPrice() {
  // Legacy delegator: apply-price-action.js owns the real user action.
  // Keep this wrapper for older callers and load-order fallback only.
  if (typeof applyRecommendedPriceFromCurrentContext === 'function') {
    return applyRecommendedPriceFromCurrentContext();
  }
  return previousApplyRecommendedPriceForProductActions();
};

ensureProductScreens();
document.querySelector('.session-chip')?.remove();


document.addEventListener('click', async (event) => {
  const escandalloFilter = event.target.closest('[data-escandallo-filter]');
  if (escandalloFilter) {
    event.preventDefault();
    escandallosFilter = escandalloFilter.dataset.escandalloFilter || 'all';
    renderEscandallosOverview();
    return;
  }
  if (event.target.closest('[data-action="toggle-publish"]')) { event.preventDefault(); event.stopImmediatePropagation(); await toggleDishPublished(); return; }
  const kpi = event.target.closest('.kpi');
  if (kpi?.dataset.action === 'alerts') { event.preventDefault(); showScreen('ingredient-alert'); return; }
  if (kpi?.dataset.action === 'active-dishes') { event.preventDefault(); showScreen('home'); setTimeout(() => document.querySelector('.dish-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); return; }
  if (kpi?.dataset.action === 'margin') { event.preventDefault(); showScreen('ai-price'); return; }
  if (event.target.closest('.save-costs')) { event.preventDefault(); await saveIngredientCosts(); return; }
  if (event.target.closest('.add-recipe-line')) {
    event.preventDefault();
    const dish = selectedDish?.();
    const firstIngredient = Object.keys(ingredients)[0];
    if (dish && firstIngredient) dish.recipe.push({ ingredient: firstIngredient, qty: 1 });
    renderRecipeEditor();
    return;
  }
  const remove = event.target.closest('[data-remove-line]');
  if (remove) {
    event.preventDefault();
    const dish = selectedDish?.();
    if (dish) dish.recipe.splice(Number(remove.dataset.removeLine), 1);
    renderRecipeEditor();
    return;
  }
  const manual = event.target.closest('button');
  const action = manual?.dataset.action;
  const isReviewCostsAction = action === 'review-costs-manually' || manual?.textContent.trim() === 'Revisar manualmente';
  const isSaveRecipeAction = action === 'save-recipe' || manual?.textContent.trim() === 'Guardar cambios';
  if (isReviewCostsAction) { event.preventDefault(); event.stopImmediatePropagation(); showScreen('ingredient-costs'); return; }
  if (isSaveRecipeAction && document.querySelector('[data-screen="edit-recipe"].is-active')) { event.preventDefault(); event.stopImmediatePropagation(); await saveRecipeQuantities(); return; }
}, true);

if (typeof renderAll === 'function') renderAll();
