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
  document.querySelectorAll('.bottom-nav button').forEach((button) => button.classList.toggle('is-active', button.dataset.go === name));
  const isPrimary = ['home', 'qr', 'settings'].includes(name);
  const isPublic = name === 'public-menu';
  const bottomNav = document.querySelector('.bottom-nav');
  const quickAdd = document.querySelector('.fab');
  const phoneShell = document.querySelector('.phone-shell');
  if (bottomNav) bottomNav.style.display = isPrimary && !isPublic ? 'grid' : 'none';
  if (quickAdd) quickAdd.style.display = isPrimary && !isPublic ? 'block' : 'none';
  phoneShell?.classList.toggle('nav-hidden', !isPrimary || isPublic);
}

function renderCostEditor() {
  const editor = document.querySelector('.cost-editor');
  if (!editor || typeof ingredients === 'undefined') return;
  editor.innerHTML = Object.entries(ingredients).map(([id, item]) => `<label class="cost-row"><div><strong>${item.name}</strong><span>Antes: ${currency((item.before || item.current) * 1000)}/${item.unit === 'ml' ? 'L' : item.unit}</span></div><input data-ingredient-cost="${id}" value="${currency(item.current * (item.unit === 'ml' ? 1000 : 1)).replace('€','')}" inputmode="decimal" /></label>`).join('');
}

function ingredientOptions(selectedId) {
  return Object.entries(ingredients).map(([id, item]) => `<option value="${id}" ${id === selectedId ? 'selected' : ''}>${item.name}</option>`).join('');
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

renderHome = function patchedRenderHome() {
  const margins = dishes.map((dish) => dishMargin(dish));
  const averageMargin = margins.length ? margins.reduce((sum, item) => sum + item, 0) / margins.length : 0;
  const alert = oilAlert();
  document.querySelector('.avatar').textContent = business.ownerInitials;
  document.querySelector("[data-screen='home'] .hero h1").textContent = business.name;
  const kpis = document.querySelectorAll("[data-screen='home'] .kpi strong");
  kpis[0].textContent = percent(averageMargin); kpis[1].textContent = dishes.length; kpis[2].textContent = alert.affected.length;
  document.querySelector('.alert-card h2').textContent = `Aceite de oliva +${Math.round(alert.rise * 100)}%`;
  document.querySelector('.alert-card p').textContent = `${alert.affected.length} formatos han bajado su margen por debajo del 65%`;
  document.querySelector('.dish-list').innerHTML = dishes.map((dish) => {
    const format = primaryFormat(dish);
    return `<article class="dish-card" data-go="dish-detail" data-dish-id="${dish.id}" role="button" tabindex="0"><div class="dish-thumb ${dish.icon}"></div><div class="dish-info"><h3>${dish.name}</h3><p>${format.name}: coste <b>${currency(formatCost(dish, format))}</b> · PVP ${currency(format.pvp)}</p><small>Receta base: ${yieldCount(dish)} tapas</small></div><span class="margin-badge ${marginClass(dishMargin(dish))}">${percent(dishMargin(dish))}</span></article>`;
  }).join('');
};

renderDetail = function patchedRenderDetail() {
  const dish = selectedDish(); if (!dish) return;
  const screen = document.querySelector("[data-screen='dish-detail']");
  const format = primaryFormat(dish);
  const margin = formatMargin(dish, format);
  screen.querySelector('h1').innerHTML = dish.name.replace(' de ', ' de<br />');
  screen.querySelector('.muted-on-dark').textContent = `Receta base · salen ${yieldCount(dish)} tapas · Actualizado hoy`;
  screen.querySelector('.status-pill strong').textContent = percent(margin);
  screen.querySelector('.status-pill span').textContent = margin >= 0.7 ? `${format.name} · margen saludable` : `${format.name} · revisar precio`;
  screen.querySelector('.ingredient-list').innerHTML = dish.recipe.length ? dish.recipe.map((line) => `<div><span>${ingredients[line.ingredient]?.name || 'Ingrediente'}</span><em>${line.qty} ${ingredients[line.ingredient]?.unit || ''}</em><b>${currency(ingredientCost(line))}</b></div>`).join('') : `<div class="empty-note">Este plato todavía no tiene receta base.</div>`;
  screen.querySelector('.total-card span').textContent = 'Coste receta base';
  screen.querySelector('.total-card strong').textContent = currency(baseRecipeCost(dish));
  screen.querySelector('.price-row').innerHTML = `<span>Coste por tapa base</span><strong>${currency(unitCost(dish))}</strong>`;
  screen.querySelector('.format-summary')?.remove();
  screen.querySelector('.price-row').insertAdjacentHTML('afterend', `<div class="format-summary">${defaultFormats(dish).map((item) => `<article><span>${item.name}</span><b>${currency(item.pvp)}</b><em>${currency(formatCost(dish, item))} coste · ${percent(formatMargin(dish, item))}</em></article>`).join('')}</div>`);
  document.querySelector('.sticky-summary').innerHTML = `<span>Coste receta <b>${currency(baseRecipeCost(dish))}</b></span><span>Tapa base <b>${currency(unitCost(dish))}</b></span>`;
};

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
    const nextCost = item.unit === 'ml' ? raw / 1000 : raw;
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
    const id = slugify(name);
    dishes.push({ id, name, category, servings, pvp, icon: 'olive-thumb', published: false, description: '', allergens: 'Pendiente de revisar', recipe: [], formats: defaultFormats({ pvp }) });
    selectedDishId = id;
  }
  renderAll();
  showScreen('dish-detail');
  showSync?.('Plato creado. Ahora añade la receta base.');
};

applyRecommendedPrice = async function patchedApplyRecommendedPrice() {
  // Deprecated/delegation candidate: apply-price-action.js is the planned owner
  // for the full apply recommended price flow.
  const dish = oilAlert().affected[0]?.dish || selectedDish(); if (!dish) return;
  ensureDishFormats(dish);
  dish.formats[0].pvp = suggestedPrice(dish, business.targetMargin, dish.formats[0]);
  dish.pvp = dish.formats[0].pvp;
  selectedDishId = dish.id;
  if (useSupabase && session) await supabase.from('dishes').update({ pvp: dish.pvp }).eq('id', dish.id);
  renderAll(); showSync('Precio actualizado');
};

ensureProductScreens();
document.querySelector('.session-chip')?.remove();

setInterval(() => {
  document.querySelector('.session-chip')?.remove();
  document.querySelectorAll('[data-screen="home"] .kpi').forEach((card, index) => {
    card.tabIndex = 0;
    card.dataset.action = index === 1 ? 'active-dishes' : index === 2 ? 'alerts' : 'margin';
  });
  const settingsButton = [...document.querySelectorAll('.bottom-nav button')].find((button) => button.textContent.trim() === 'Ajustes');
  if (settingsButton) settingsButton.dataset.go = 'settings';
}, 500);

document.addEventListener('click', async (event) => {
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
  if (manual?.textContent.trim() === 'Revisar manualmente') { event.preventDefault(); event.stopImmediatePropagation(); showScreen('ingredient-costs'); return; }
  if (manual?.textContent.trim() === 'Guardar cambios' && document.querySelector('[data-screen="edit-recipe"].is-active')) { event.preventDefault(); event.stopImmediatePropagation(); await saveRecipeQuantities(); return; }
}, true);
