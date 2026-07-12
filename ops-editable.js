let editingPurchaseIndex = null;
let editingSaleIndex = null;

function editableDishOptions(selectedId) {
  return dishes.map((dish) => `<option value="${dish.id}" ${dish.id === selectedId ? 'selected' : ''}>${escapeHtml(dish.name)}</option>`).join('');
}

async function refreshOps() {
  await loadOpsFromSupabase?.();
  renderPurchaseList();
  renderStatsScreen();
}

loadOpsFromSupabase = async function loadEditableOpsFromSupabase() {
  if (!useSupabase || !session || !supabase || !businessId) return;
  const [purchases, sales, cash] = await Promise.all([
    supabase.from('purchase_lines').select('*').eq('business_id', businessId).order('purchased_at', { ascending: false }).limit(50),
    supabase.from('sales_lines').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(150),
    supabase.from('cash_closings').select('*').eq('business_id', businessId).order('day', { ascending: false }).limit(30),
  ]);
  if (!purchases.error) opsState.purchases = purchases.data.map((item) => ({ id: item.id, ingredientId: item.ingredient_id, name: item.product_name, qty: Number(item.quantity), unit: item.unit, total: Number(item.total_cost), unitCost: Number(item.unit_cost), supplier: item.supplier || '', date: item.purchased_at }));
  if (!sales.error) opsState.sales = sales.data.map((item) => ({ id: item.id, dishId: item.dish_id, dishName: item.dish_name, format: item.sale_format, qty: Number(item.quantity), slot: item.time_slot, date: item.created_at }));
  if (!cash.error) opsState.cashClosings = cash.data.map((item) => ({ id: item.id, total: Number(item.cash_total), slot: item.time_slot, date: item.day }));
};

renderPurchaseList = function renderEditablePurchaseList() {
  const list = document.querySelector('.purchase-list');
  if (!list) return;
  if (!opsState.purchases.length) {
    list.innerHTML = '<div class="empty-note">Aún no hay compras registradas. La próxima compra actualizará el coste del producto.</div>';
    return;
  }
  list.innerHTML = opsState.purchases.slice(0, 12).map((item, index) => {
    if (editingPurchaseIndex === index) {
      return `<article class="ops-edit-card"><label>Producto<input class="edit-purchase-name" value="${item.name}" /></label><div class="split"><label>Cantidad<input class="edit-purchase-qty" value="${item.qty}" inputmode="decimal" /></label><label>Unidad<input class="edit-purchase-unit" value="${item.unit}" /></label></div><div class="split"><label>Total pagado<input class="edit-purchase-total" value="${currency(item.total).replace('€','')}" inputmode="decimal" /></label><label>Proveedor<input class="edit-purchase-supplier" value="${item.supplier || ''}" /></label></div><div class="ops-actions"><button class="primary-button update-purchase" type="button" data-index="${index}">Guardar</button><button class="secondary-button cancel-edit" type="button">Cancelar</button></div></article>`;
    }
    return `<article class="ops-row"><div><strong>${escapeHtml(item.name)}</strong><span>${item.qty} ${escapeHtml(item.unit)} · ${currency(item.unitCost)} por unidad</span></div><b>${currency(item.total)}</b><div class="ops-actions"><button class="secondary-button edit-purchase" type="button" data-index="${index}">Editar</button><button class="danger-button delete-purchase" type="button" data-index="${index}">Borrar</button></div></article>`;
  }).join('');
};

renderStatsScreen = function renderEditableStatsScreen() {
  const dishSelect = document.querySelector('.sale-dish');
  if (dishSelect) dishSelect.innerHTML = dishes.map((dish) => `<option value="${dish.id}">${escapeHtml(dish.name)}</option>`).join('');
  const totalSold = opsState.sales.reduce((sum, item) => sum + item.qty, 0);
  const cash = opsState.cashClosings[0]?.total || 0;
  const best = [...opsState.sales].reduce((acc, item) => {
    acc[item.dishName] = (acc[item.dishName] || 0) + item.qty;
    return acc;
  }, {});
  const top = Object.entries(best).sort((a, b) => b[1] - a[1]);
  const statsKpis = document.querySelector('.stats-kpis');
  if (statsKpis) statsKpis.innerHTML = `<article><strong>${totalSold}</strong><span>unidades vendidas</span></article><article><strong>${currency(cash)}</strong><span>última caja</span></article><article><strong>${escapeHtml(top[0]?.[0] || 'Sin datos')}</strong><span>más vendida</span></article>`;
  const topNode = document.querySelector('.top-sales');
  if (!topNode) return;
  const salesRows = opsState.sales.length ? opsState.sales.slice(0, 20).map((item, index) => {
    if (editingSaleIndex === index) {
      return `<article class="ops-edit-card"><label>Plato<select class="edit-sale-dish">${editableDishOptions(item.dishId)}</select></label><div class="split"><label>Formato<select class="edit-sale-format"><option value="tapa" ${item.format === 'tapa' ? 'selected' : ''}>Tapa</option><option value="media" ${item.format === 'media' ? 'selected' : ''}>Media ración</option><option value="racion" ${item.format === 'racion' ? 'selected' : ''}>Ración</option></select></label><label>Unidades<input class="edit-sale-qty" value="${item.qty}" inputmode="decimal" /></label></div><label>Franja<select class="edit-sale-slot"><option ${item.slot === 'Comida' ? 'selected' : ''}>Comida</option><option ${item.slot === 'Tardeo' ? 'selected' : ''}>Tardeo</option><option ${item.slot === 'Cena' ? 'selected' : ''}>Cena</option></select></label><div class="ops-actions"><button class="primary-button update-sale" type="button" data-index="${index}">Guardar</button><button class="secondary-button cancel-edit" type="button">Cancelar</button></div></article>`;
    }
    return `<article class="ops-row"><div><strong>${escapeHtml(item.dishName)}</strong><span>${item.qty} ${escapeHtml(item.format)} · ${escapeHtml(item.slot)}</span></div><b>${item.qty}</b><div class="ops-actions"><button class="secondary-button edit-sale" type="button" data-index="${index}">Editar</button><button class="danger-button delete-sale" type="button" data-index="${index}">Borrar</button></div></article>`;
  }).join('') : '<div class="empty-note">Registra ventas del día para ver tus tapas más vendidas.</div>';
  const topRows = top.length ? `<div class="mini-heading">Resumen</div>${top.map(([name, qty]) => `<article class="ops-row compact"><div><strong>${escapeHtml(name)}</strong><span>${qty} ventas registradas</span></div><b>${qty}</b></article>`).join('')}` : '';
  topNode.innerHTML = `${topRows}<div class="mini-heading">Últimas ventas</div>${salesRows}`;
};

async function updatePurchase(index) {
  const item = opsState.purchases[index];
  if (!item) return;
  const name = document.querySelector('.edit-purchase-name')?.value.trim();
  const qty = numberFromInput(document.querySelector('.edit-purchase-qty')?.value, item.qty);
  const unit = document.querySelector('.edit-purchase-unit')?.value.trim() || item.unit;
  const total = numberFromInput(document.querySelector('.edit-purchase-total')?.value, item.total);
  const supplier = document.querySelector('.edit-purchase-supplier')?.value.trim() || '';
  const unitCost = qty ? total / qty : 0;
  Object.assign(item, { name, qty, unit, total, supplier, unitCost });
  if (useSupabase && session && supabase && item.id) {
    await supabase.from('purchase_lines').update({ product_name: name, normalized_name: normalizeProductName(name), quantity: qty, unit, total_cost: total, supplier }).eq('id', item.id);
  }
  if (item.ingredientId && ingredients[item.ingredientId]) {
    ingredients[item.ingredientId].current = unitCost;
    ingredients[item.ingredientId].unit = unit;
    if (useSupabase && session && supabase) await supabase.from('ingredients').update({ current_cost: unitCost, unit }).eq('id', item.ingredientId);
  }
  editingPurchaseIndex = null;
  renderAll();
  renderPurchaseList();
  showSync?.('Compra corregida');
}

async function deletePurchase(index) {
  const item = opsState.purchases[index];
  if (!item) return;
  if (useSupabase && session && supabase && item.id) await supabase.from('purchase_lines').delete().eq('id', item.id);
  opsState.purchases.splice(index, 1);
  renderPurchaseList();
  showSync?.('Compra borrada');
}

async function updateSale(index) {
  const item = opsState.sales[index];
  if (!item) return;
  const dishId = document.querySelector('.edit-sale-dish')?.value;
  const dish = dishes.find((entry) => entry.id === dishId);
  const format = document.querySelector('.edit-sale-format')?.value || item.format;
  const qty = numberFromInput(document.querySelector('.edit-sale-qty')?.value, item.qty);
  const slot = document.querySelector('.edit-sale-slot')?.value || item.slot;
  Object.assign(item, { dishId, dishName: dish?.name || item.dishName, format, qty, slot });
  if (useSupabase && session && supabase && item.id) {
    await supabase.from('sales_lines').update({ dish_id: dishId, dish_name: item.dishName, sale_format: format, quantity: qty, time_slot: slot }).eq('id', item.id);
  }
  editingSaleIndex = null;
  renderStatsScreen();
  showSync?.('Venta corregida');
}

async function deleteSale(index) {
  const item = opsState.sales[index];
  if (!item) return;
  if (useSupabase && session && supabase && item.id) await supabase.from('sales_lines').delete().eq('id', item.id);
  opsState.sales.splice(index, 1);
  renderStatsScreen();
  showSync?.('Venta borrada');
}

document.addEventListener('click', async (event) => {
  const editPurchase = event.target.closest('.edit-purchase');
  if (editPurchase) { event.preventDefault(); editingPurchaseIndex = Number(editPurchase.dataset.index); renderPurchaseList(); return; }
  const deletePurchaseButton = event.target.closest('.delete-purchase');
  if (deletePurchaseButton) { event.preventDefault(); await deletePurchase(Number(deletePurchaseButton.dataset.index)); return; }
  const updatePurchaseButton = event.target.closest('.update-purchase');
  if (updatePurchaseButton) { event.preventDefault(); await updatePurchase(Number(updatePurchaseButton.dataset.index)); return; }

  const editSale = event.target.closest('.edit-sale');
  if (editSale) { event.preventDefault(); editingSaleIndex = Number(editSale.dataset.index); renderStatsScreen(); return; }
  const deleteSaleButton = event.target.closest('.delete-sale');
  if (deleteSaleButton) { event.preventDefault(); await deleteSale(Number(deleteSaleButton.dataset.index)); return; }
  const updateSaleButton = event.target.closest('.update-sale');
  if (updateSaleButton) { event.preventDefault(); await updateSale(Number(updateSaleButton.dataset.index)); return; }

  if (event.target.closest('.cancel-edit')) {
    event.preventDefault();
    editingPurchaseIndex = null;
    editingSaleIndex = null;
    renderPurchaseList();
    renderStatsScreen();
  }
}, true);
