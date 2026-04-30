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

function renderRecipeEditor() {
  const dish = selectedDish?.();
  const list = document.querySelector('.edit-list');
  if (!dish || !list) return;
  list.innerHTML = dish.recipe.length ? dish.recipe.map((line, index) => {
    const item = ingredients[line.ingredient] || { name: 'Ingrediente', unit: '' };
    return `<label class="edit-row"><div><strong>${item.name}</strong><span>${currency(ingredientCost(line))} · ${item.unit}</span></div><input data-recipe-index="${index}" value="${line.qty}" inputmode="decimal" /></label>`;
  }).join('') : `<div class="empty-note">Este plato todavía no tiene ingredientes. Añade ingredientes para calcular el coste real.</div>`;
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
  if (summary) summary.innerHTML = `<span>Coste estimado</span><strong>0,00€</strong><span>Margen previsto</span><strong class="good-text">--</strong>`;
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
  document.querySelectorAll('[data-recipe-index]').forEach((input) => {
    const index = Number(input.dataset.recipeIndex);
    if (dish.recipe[index]) dish.recipe[index].qty = Number(input.value.replace(',', '.')) || dish.recipe[index].qty;
  });
  if (typeof useSupabase !== 'undefined' && useSupabase && session && supabase) {
    await supabase.from('dish_ingredients').delete().eq('dish_id', dish.id);
    if (dish.recipe.length) {
      await supabase.from('dish_ingredients').insert(dish.recipe.map((line, index) => ({ dish_id: dish.id, ingredient_id: line.ingredient, quantity: line.qty, sort_order: index })));
    }
    await loadFromSupabase();
  }
  renderAll();
  renderRecipeEditor();
  showSync?.('Receta actualizada');
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
  const servings = Number(inputs[2]?.value.replace(',', '.')) || 1;
  const pvp = Number(inputs[3]?.value.replace('€', '').replace(',', '.')) || 0;
  if (!name) return showSync?.('Pon un nombre al plato');
  if (dishes.some((dish) => dish.name.toLowerCase() === name.toLowerCase())) return showSync?.('Ese plato ya existe');
  if (useSupabase && session && supabase) {
    const { data, error } = await supabase.from('dishes').insert({ business_id: businessId, name, category, servings, pvp, published: false, description: '', allergens: 'Pendiente de revisar', image_key: 'olive-thumb' }).select('id').single();
    if (error) return showSync?.(error.message);
    selectedDishId = data.id;
    await loadFromSupabase();
  } else {
    const id = slugify(name);
    dishes.push({ id, name, category, servings, pvp, icon: 'olive-thumb', published: false, description: '', allergens: 'Pendiente de revisar', recipe: [] });
    selectedDishId = id;
  }
  renderAll();
  showScreen('dish-detail');
  showSync?.('Plato creado. Ahora añade la receta.');
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
  const manual = event.target.closest('button');
  if (manual?.textContent.trim() === 'Revisar manualmente') { event.preventDefault(); event.stopImmediatePropagation(); showScreen('ingredient-costs'); return; }
  if (manual?.textContent.trim() === 'Guardar cambios' && document.querySelector('[data-screen="edit-recipe"].is-active')) { event.preventDefault(); event.stopImmediatePropagation(); await saveRecipeQuantities(); return; }
}, true);
