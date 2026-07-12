const opsState = {
  purchases: [],
  sales: [],
  cashClosings: [],
};

function normalizeProductName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function ingredientKeyByName(name) {
  const normalized = normalizeProductName(name);
  return Object.keys(ingredients).find((id) => normalizeProductName(ingredients[id]?.name) === normalized);
}

function yieldLabel(dish) {
  const unit = dish?.yieldUnit || 'tapa';
  if (unit === 'media') return 'medias raciones';
  if (unit === 'racion') return 'raciones';
  if (unit === 'kg') return 'kilos finales';
  if (unit === 'unidad') return 'unidades';
  return 'tapas';
}

function formatUnitLabel(dish) {
  const unit = dish?.yieldUnit || 'tapa';
  if (unit === 'media') return 'medias';
  if (unit === 'racion') return 'raciones';
  if (unit === 'kg') return 'kg';
  if (unit === 'unidad') return 'unidades';
  return 'tapas';
}

function buildYieldOptions(selected) {
  const options = [
    ['tapa', 'Tapas'],
    ['media', 'Medias raciones'],
    ['racion', 'Raciones'],
    ['kg', 'Kilos finales'],
    ['unidad', 'Unidades/piezas'],
  ];
  return options.map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
}

async function createOrReuseIngredient({ name, unit, cost }) {
  const cleanName = String(name || '').trim();
  if (!cleanName) return null;
  const existingId = ingredientKeyByName(cleanName);
  if (existingId) return existingId;
  const id = useSupabase && session && supabase ? null : slugify(cleanName);
  const item = { name: cleanName, unit: unit || 'g', current: Number(cost) || 0, before: Number(cost) || 0 };
  if (useSupabase && session && supabase) {
    const { data, error } = await supabase.from('ingredients').insert({ business_id: businessId, name: item.name, normalized_name: normalizeProductName(item.name), unit: item.unit, current_cost: item.current, previous_cost: item.before }).select('id').single();
    if (error) {
      const fallbackId = ingredientKeyByName(cleanName);
      if (fallbackId) return fallbackId;
      showSync?.(error.message);
      return null;
    }
    ingredients[data.id] = item;
    return data.id;
  }
  ingredients[id] = item;
  return id;
}

async function loadOpsFromSupabase() {
  if (!useSupabase || !session || !supabase || !businessId) return;
  const [purchases, sales, cash] = await Promise.all([
    supabase.from('purchase_lines').select('*').eq('business_id', businessId).order('purchased_at', { ascending: false }).limit(25),
    supabase.from('sales_lines').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(100),
    supabase.from('cash_closings').select('*').eq('business_id', businessId).order('day', { ascending: false }).limit(20),
  ]);
  if (!purchases.error) opsState.purchases = purchases.data.map((item) => ({ name: item.product_name, qty: Number(item.quantity), unit: item.unit, total: Number(item.total_cost), unitCost: Number(item.unit_cost), supplier: item.supplier || '', date: item.purchased_at }));
  if (!sales.error) opsState.sales = sales.data.map((item) => ({ dishId: item.dish_id, dishName: item.dish_name, format: item.sale_format, qty: Number(item.quantity), slot: item.time_slot, date: item.created_at }));
  if (!cash.error) opsState.cashClosings = cash.data.map((item) => ({ total: Number(item.cash_total), slot: item.time_slot, date: item.day }));
}

const previousBootDataOps = bootData;
bootData = async function bootDataWithOps() {
  await previousBootDataOps();
  await loadOpsFromSupabase();
  renderStatsScreen();
  renderPurchaseList();
};

function ensureOpsScreens() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;
  const settingsButton = [...nav.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Ajustes' || button.dataset.go === 'settings');
  if (settingsButton) {
    settingsButton.dataset.go = 'stats';
    settingsButton.innerHTML = '<span class="nav-icon gear"></span>Estadísticas';
  }
  if (!document.querySelector('[data-screen="purchases"]')) {
    nav.insertAdjacentHTML('beforebegin', `<section class="app-screen" data-screen="purchases"><header class="hero hero-rust compact-hero"><button class="back" type="button" data-go="home">← Volver</button><h1>Compras</h1><p>Registra lo que compras y a qué precio.</p></header><div class="content"><article class="ops-form"><label>Producto<input class="purchase-name" placeholder="Aceite de oliva" /></label><div class="split"><label>Cantidad<input class="purchase-qty" inputmode="decimal" placeholder="5" /></label><label>Unidad<input class="purchase-unit" placeholder="L, kg, uds" /></label></div><div class="split"><label>Total pagado<input class="purchase-total" inputmode="decimal" placeholder="34,20" /></label><label>Proveedor<input class="purchase-supplier" placeholder="Opcional" /></label></div><button class="primary-button save-purchase" type="button">Guardar compra</button></article><div class="section-title">Últimas compras</div><div class="purchase-list"></div></div></section>`);
  }
  if (!document.querySelector('[data-screen="stats"]')) {
    nav.insertAdjacentHTML('beforebegin', `<section class="app-screen" data-screen="stats"><header class="hero hero-dark compact-hero"><button class="back" type="button" data-go="home">← Volver</button><h1>Estadísticas</h1><p>Ventas, caja y tapas más fuertes.</p></header><div class="content stats-content"><div class="stats-kpis"></div><article class="ops-form"><div class="section-title">Registrar ventas del día</div><label>Plato<select class="sale-dish"></select></label><div class="split"><label>Formato<select class="sale-format"><option value="tapa">Tapa</option><option value="media">Media ración</option><option value="racion">Ración</option></select></label><label>Unidades<input class="sale-qty" inputmode="numeric" placeholder="12" /></label></div><div class="split"><label>Franja<select class="sale-slot"><option>Comida</option><option>Tardeo</option><option>Cena</option></select></label><label>Caja del día<input class="cash-total" inputmode="decimal" placeholder="850" /></label></div><button class="primary-button save-sale" type="button">Guardar ventas</button></article><div class="section-title">Más vendidas</div><div class="top-sales"></div><div class="section-title">Compras y costes</div><button class="secondary-button" type="button" data-go="purchases">Registrar compra</button></div></section>`);
  }
}

function renderPurchaseList() {
  const list = document.querySelector('.purchase-list');
  if (!list) return;
  if (!opsState.purchases.length) {
    list.innerHTML = '<div class="empty-note">Aún no hay compras registradas. La próxima compra actualizará el coste del producto.</div>';
    return;
  }
  list.innerHTML = opsState.purchases.slice(0, 8).map((item) => `<article class="ops-row"><div><strong>${item.name}</strong><span>${item.qty} ${item.unit} · ${currency(item.unitCost)} por unidad</span></div><b>${currency(item.total)}</b></article>`).join('');
}

function renderStatsScreen() {
  const dishSelect = document.querySelector('.sale-dish');
  if (dishSelect) dishSelect.innerHTML = dishes.map((dish) => `<option value="${dish.id}">${dish.name}</option>`).join('');
  const totalSold = opsState.sales.reduce((sum, item) => sum + item.qty, 0);
  const cash = opsState.cashClosings[0]?.total || 0;
  const best = [...opsState.sales].reduce((acc, item) => {
    acc[item.dishName] = (acc[item.dishName] || 0) + item.qty;
    return acc;
  }, {});
  const top = Object.entries(best).sort((a, b) => b[1] - a[1]);
  const statsKpis = document.querySelector('.stats-kpis');
  if (statsKpis) statsKpis.innerHTML = `<article><strong>${totalSold}</strong><span>unidades vendidas</span></article><article><strong>${currency(cash)}</strong><span>última caja</span></article><article><strong>${top[0]?.[0] || 'Sin datos'}</strong><span>más vendida</span></article>`;
  const topNode = document.querySelector('.top-sales');
  if (topNode) topNode.innerHTML = top.length ? top.map(([name, qty]) => `<article class="ops-row"><div><strong>${name}</strong><span>${qty} ventas registradas</span></div><b>${qty}</b></article>`).join('') : '<div class="empty-note">Registra ventas del día para ver tus tapas más vendidas.</div>';
}

const previousRenderRecipeEditor = renderRecipeEditor;
renderRecipeEditor = function renderRecipeEditorWithManualProducts() {
  previousRenderRecipeEditor();
  const dish = selectedDish?.();
  const list = document.querySelector('.edit-list');
  if (!dish || !list || list.querySelector('.manual-product-card')) return;
  const yieldRow = list.querySelector('.yield-row');
  if (yieldRow && !list.querySelector('.yield-unit-row')) {
    yieldRow.insertAdjacentHTML('beforebegin', `<label class="yield-unit-row"><div><strong>¿Cómo quieres medir lo que sale?</strong><span>Elige tapas, medias raciones, raciones, kilos o piezas.</span></div><select class="yield-unit-select">${buildYieldOptions(dish.yieldUnit || 'tapa')}</select></label>`);
    yieldRow.querySelector('strong').textContent = `¿Cuántas ${yieldLabel(dish)} salen?`;
    yieldRow.querySelector('span').textContent = 'Ejemplo: de una olla pueden salir 18 tapas o 8 raciones.';
  }
  list.querySelector('.add-recipe-line')?.insertAdjacentHTML('afterend', `<article class="manual-product-card"><div class="section-title">Producto nuevo</div><label>Nombre<input class="new-ingredient-name" placeholder="Carrillera, aceite oliva, patata agria..." /></label><div class="split"><label>Unidad<input class="new-ingredient-unit" placeholder="g, ml, kg, L, uds" /></label><label>Coste unidad<input class="new-ingredient-cost" inputmode="decimal" placeholder="0,00" /></label></div><button class="secondary-button add-manual-ingredient" type="button">Crear producto y añadir</button><p>Escandalia reconoce duplicados aunque cambies mayúsculas, minúsculas o tildes.</p></article>`);
  list.querySelector('.format-helper').textContent = `Cada formato usa una cantidad de ${formatUnitLabel(dish)} de la receta base. Cambia equivalencia y PVP para calcular margen real.`;
};

const previousApplyFormatChanges = applyFormatChanges;
applyFormatChanges = function applyFormatChangesWithYieldUnit(dish) {
  previousApplyFormatChanges(dish);
  const unitSelect = document.querySelector('.yield-unit-select');
  if (unitSelect) dish.yieldUnit = unitSelect.value;
};

const previousUpdateDishWithFormats = typeof updateDishWithFormats === 'function' ? updateDishWithFormats : null;
updateDishWithFormats = async function updateDishWithYieldUnit(dish) {
  if (!useSupabase || !session || !supabase || !dish) return;
  const payload = {
    servings: dish.servings,
    pvp: dish.pvp,
    yield_unit: dish.yieldUnit || 'tapa',
    sale_formats: ensureDishFormats(dish),
  };
  const { error } = await supabase.from('dishes').update(payload).eq('id', dish.id);
  if (!error) return;
  if (previousUpdateDishWithFormats) return previousUpdateDishWithFormats(dish);
  await supabase.from('dishes').update({ servings: dish.servings, pvp: dish.pvp }).eq('id', dish.id);
};

const previousShowScreenOps = showScreen;
showScreen = function showScreenWithOps(name) {
  previousShowScreenOps(name);
  if (name === 'stats') {
    activateDynamicScreen(name);
    renderStatsScreen();
  }
  if (name === 'purchases') {
    activateDynamicScreen(name);
    renderPurchaseList();
  }
};

ensureOpsScreens();

document.addEventListener('click', async (event) => {
  const addManual = event.target.closest('.add-manual-ingredient');
  if (addManual) {
    event.preventDefault();
    const dish = selectedDish?.();
    const name = document.querySelector('.new-ingredient-name')?.value;
    const unit = document.querySelector('.new-ingredient-unit')?.value || 'g';
    const cost = numberFromInput(document.querySelector('.new-ingredient-cost')?.value, 0);
    const id = await createOrReuseIngredient({ name, unit, cost });
    if (!id || !dish) return;
    if (!dish.recipe.some((line) => line.ingredient === id)) dish.recipe.push({ ingredient: id, qty: 1 });
    renderRecipeEditor();
    showSync?.('Producto añadido a la receta');
    return;
  }

  const savePurchase = event.target.closest('.save-purchase');
  if (savePurchase) {
    event.preventDefault();
    const name = document.querySelector('.purchase-name')?.value;
    const qty = numberFromInput(document.querySelector('.purchase-qty')?.value, 0);
    const unit = document.querySelector('.purchase-unit')?.value || 'uds';
    const total = numberFromInput(document.querySelector('.purchase-total')?.value, 0);
    const supplier = document.querySelector('.purchase-supplier')?.value || '';
    if (!name || !qty || !total) return showSync?.('Completa producto, cantidad y total');
    // Coste por unidad tal cual se compró (para el histórico de compras) y coste
    // por unidad base (g/ml) para que los escandallos no se disparen al comprar
    // en formatos grandes como litros o kilos.
    const unitCostValue = total / qty;
    const { base: baseUnit, factor } = normalizePurchaseUnit(unit);
    const baseCost = total / (qty * factor);
    const id = await createOrReuseIngredient({ name, unit: baseUnit, cost: baseCost });
    if (id && ingredients[id]) {
      ingredients[id].before = ingredients[id].current;
      ingredients[id].current = baseCost;
      ingredients[id].unit = baseUnit;
      if (useSupabase && session && supabase) await supabase.from('ingredients').update({ normalized_name: normalizeProductName(ingredients[id].name), previous_cost: ingredients[id].before, current_cost: baseCost, unit: baseUnit }).eq('id', id);
    }
    const purchase = { name: ingredients[id]?.name || name, qty, unit, total, unitCost: unitCostValue, supplier, date: new Date().toISOString() };
    opsState.purchases.unshift(purchase);
    if (useSupabase && session && supabase && businessId) {
      await supabase.from('purchase_lines').insert({ business_id: businessId, ingredient_id: id, product_name: purchase.name, normalized_name: normalizeProductName(purchase.name), quantity: qty, unit, total_cost: total, supplier });
    }
    renderAll();
    renderPurchaseList();
    showSync?.('Compra registrada y coste actualizado');
    return;
  }

  const saveSale = event.target.closest('.save-sale');
  if (saveSale) {
    event.preventDefault();
    const dishId = document.querySelector('.sale-dish')?.value;
    const dish = dishes.find((item) => item.id === dishId);
    const format = document.querySelector('.sale-format')?.value || 'tapa';
    const qty = numberFromInput(document.querySelector('.sale-qty')?.value, 0);
    const slot = document.querySelector('.sale-slot')?.value || 'Comida';
    const cash = numberFromInput(document.querySelector('.cash-total')?.value, 0);
    if (!dish || !qty) return showSync?.('Elige plato y unidades vendidas');
    const sale = { dishId, dishName: dish.name, format, qty, slot, date: new Date().toISOString() };
    opsState.sales.unshift(sale);
    if (cash) opsState.cashClosings.unshift({ total: cash, slot, date: new Date().toISOString() });
    if (useSupabase && session && supabase && businessId) {
      await supabase.from('sales_lines').insert({ business_id: businessId, dish_id: dishId, dish_name: dish.name, sale_format: format, quantity: qty, time_slot: slot });
      if (cash) await supabase.from('cash_closings').upsert({ business_id: businessId, day: new Date().toISOString().slice(0, 10), time_slot: slot, cash_total: cash }, { onConflict: 'business_id,day,time_slot' });
    }
    renderStatsScreen();
    showSync?.('Ventas registradas');
  }
}, true);
