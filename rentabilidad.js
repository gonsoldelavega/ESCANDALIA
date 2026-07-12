/* ==========================================================================
 * rentabilidad.js — Capa de UI para rentabilidad real.
 *
 * Añade a las pantallas existentes:
 *   - Merma (%) por ingrediente (pantalla de coste de ingrediente).
 *   - Minutos de elaboración por plato (editor de receta) → coste de personal.
 *   - Panel de rentabilidad real en el detalle del plato (food cost, margen
 *     neto de IVA, beneficio €/ración).
 *
 * Depende de cost-engine.js (wasteFactor, realMargin, foodCostPercent,
 * realProfit, netRevenue, laborCost, currency, percent, escapeHtml) y de los
 * renders ya parcheados en render-engine.js / product-actions.js.
 * Carga DESPUÉS de product-actions.js.
 * ========================================================================== */

const WASTE_OPTIONS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5];

async function persistIngredientWaste(id, waste) {
  const ing = ingredients[id];
  if (!ing) return;
  ing.waste = waste;
  if (typeof useSupabase !== 'undefined' && useSupabase && session && supabase) {
    // La columna waste puede no existir en instalaciones antiguas: ignoramos el error.
    await supabase.from('ingredients').update({ waste }).eq('id', id).then(() => {}, () => {});
  }
  if (typeof saveLocalState === 'function') saveLocalState();
}

function renderMermaCard() {
  const screen = document.querySelector("[data-screen='ingredient-edit']");
  if (!screen) return;
  const id = typeof selectedIngredientId !== 'undefined' ? selectedIngredientId : '';
  const ing = ingredients[id];
  const anchor = screen.querySelector('.price-edit-card');
  if (!ing || !anchor) return;
  let card = screen.querySelector('.merma-card');
  if (!card) {
    card = document.createElement('div');
    card.className = 'merma-card';
    anchor.insertAdjacentElement('afterend', card);
  }
  const current = Number(ing.waste) || 0;
  card.innerHTML = `<div class="merma-head"><strong>Merma / desperdicio</strong><span>Parte que se pierde al limpiar, pelar o recortar. Sube el coste real del plato.</span></div>
    <div class="merma-options">${WASTE_OPTIONS.map((value) => `<button type="button" class="merma-chip ${Math.abs(value - current) < 1e-9 ? 'is-active' : ''}" data-merma="${value}">${Math.round(value * 100)}%</button>`).join('')}</div>
    <p class="merma-effect">${current > 0 ? `Coste efectivo ×${(1 / (1 - Math.min(current, 0.95))).toFixed(2)}` : 'Sin merma: coste = precio de compra'}</p>`;
}

function renderLaborRow() {
  const dish = typeof selectedDish === 'function' ? selectedDish() : null;
  const list = document.querySelector('.edit-list');
  if (!dish || !list) return;
  const yieldRow = list.querySelector('.yield-row');
  if (!yieldRow || list.querySelector('.labor-row')) return;
  yieldRow.insertAdjacentHTML('afterend', `<label class="labor-row"><div><strong>Minutos de elaboración</strong><span>Tiempo de cocina por tanda. Se usa para imputar el coste de personal si defines una tarifa/hora en Ajustes.</span></div><input class="labor-input" value="${Number(dish.laborMinutes) || 0}" inputmode="decimal" aria-label="Minutos de elaboración" /></label>`);
}

function renderRentabilidadPanel() {
  const screen = document.querySelector("[data-screen='dish-detail']");
  const dish = typeof selectedDish === 'function' ? selectedDish() : null;
  if (!screen || !dish) return;
  const format = primaryFormat(dish);
  const priceRow = screen.querySelector('.price-row');
  if (!priceRow) return;
  screen.querySelector('.rentabilidad-panel')?.remove();
  const foodCost = foodCostPercent(dish, format);
  const grossMargin = formatMargin(dish, format);
  const netMargin = realMargin(dish, format);
  const profit = realProfit(dish, format);
  const foodClass = foodCost <= 0.3 ? 'good-text' : foodCost <= 0.38 ? 'mid-text' : 'low-text';
  const netClass = netMargin >= 0.65 ? 'good-text' : netMargin >= 0.5 ? 'mid-text' : 'low-text';
  const laborEuros = laborCost(dish);
  const anchor = screen.querySelector('.format-summary') || priceRow;
  anchor.insertAdjacentHTML('afterend', `<div class="rentabilidad-panel"><div class="section-title">Rentabilidad real</div>
    <div class="rentabilidad-grid">
      <article><span>Food cost</span><strong class="${foodClass}">${percent(foodCost)}</strong><em>materia prima / venta neta</em></article>
      <article><span>Margen bruto</span><strong>${percent(grossMargin)}</strong><em>solo materia prima</em></article>
      <article><span>Margen real</span><strong class="${netClass}">${percent(netMargin)}</strong><em>tras IVA${laborEuros > 0 ? ' y personal' : ''}</em></article>
      <article><span>Beneficio/ración</span><strong class="${profit >= 0 ? 'good-text' : 'low-text'}">${currency(profit)}</strong><em>venta neta − coste real</em></article>
    </div>
    <p class="rentabilidad-note">IVA aplicado: ${Math.round(businessTaxRate() * 100)}%${laborEuros > 0 ? ` · Personal: ${currency(laborEuros)}/ración` : ''}. Ajusta IVA, tarifa de personal y gastos fijos en Ajustes.</p></div>`);
}

// ── Enganche con los renders existentes ──────────────────────────────
if (typeof renderIngredientEdit === 'function') {
  const previousRenderIngredientEdit = renderIngredientEdit;
  renderIngredientEdit = function renderIngredientEditWithMerma() {
    previousRenderIngredientEdit();
    renderMermaCard();
  };
}

if (typeof renderRecipeEditor === 'function') {
  const previousRenderRecipeEditorRent = renderRecipeEditor;
  renderRecipeEditor = function renderRecipeEditorWithLabor() {
    previousRenderRecipeEditorRent();
    renderLaborRow();
  };
}

if (typeof renderDetail === 'function') {
  const previousRenderDetailRent = renderDetail;
  renderDetail = function renderDetailWithRentabilidad() {
    previousRenderDetailRent();
    renderRentabilidadPanel();
  };
}

// Capturar minutos de elaboración al guardar la receta.
if (typeof applyFormatChanges === 'function') {
  const previousApplyFormatChangesRent = applyFormatChanges;
  applyFormatChanges = function applyFormatChangesWithLabor(dish) {
    previousApplyFormatChangesRent(dish);
    const laborInput = document.querySelector('.labor-input');
    if (laborInput) dish.laborMinutes = Math.max(numberFromInput(laborInput.value, dish.laborMinutes || 0), 0);
  };
}

document.addEventListener('click', async (event) => {
  const chip = event.target.closest('.merma-chip');
  if (!chip) return;
  event.preventDefault();
  const id = typeof selectedIngredientId !== 'undefined' ? selectedIngredientId : '';
  await persistIngredientWaste(id, Number(chip.dataset.merma) || 0);
  if (typeof renderAll === 'function') renderAll();
  renderMermaCard();
  showSync?.('Merma actualizada');
}, true);

if (typeof renderAll === 'function') renderAll();
