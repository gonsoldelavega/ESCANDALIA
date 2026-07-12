// Ownership note: this file is the planned single owner for the
// "apply recommended price" flow. Current duplicated implementations in other
// files are delegation candidates until Phase B/C remove the overlap.
async function applyNewPriceToDish(dish) {
  ensureDishFormats?.(dish);
  const format = primaryFormat?.(dish) || dish.formats?.[0];
  const nextPvp = suggestedPrice(dish, business.targetMargin, format);
  if (dish.formats?.[0]) dish.formats[0].pvp = nextPvp;
  dish.pvp = nextPvp;
  if (useSupabase && session && supabase) {
    if (typeof updateDishWithFormats === 'function') {
      await updateDishWithFormats(dish);
    } else {
      await supabase.from('dishes').update({ pvp: nextPvp }).eq('id', dish.id);
    }
  }
  return nextPvp;
}

async function applyRecommendedPriceFromCurrentContext() {
  // Desde la pantalla de alerta el botón dice "Aplicar precios sugeridos"
  // (plural) y debe corregir TODOS los platos afectados por esa alerta. Desde
  // ai-price / detalle solo afecta al plato en pantalla.
  const onAlertScreen = Boolean(document.querySelector('[data-screen="ingredient-alert"].is-active'));
  const alerts = typeof getCostAlerts === 'function' ? getCostAlerts() : [];
  const activeAlert = alerts.find((a) => a.ingredientId === selectedIngredientId) || alerts[0];

  try {
    if (onAlertScreen && activeAlert?.affected?.length) {
      const targets = activeAlert.affected.map((item) => item.dish);
      for (const dish of targets) await applyNewPriceToDish(dish);
      if (useSupabase && session && supabase && typeof loadFromSupabase === 'function') await loadFromSupabase();
      selectedDishId = targets[0].id;
      renderAll();
      showScreen('home');
      showSync?.(`${targets.length} precio${targets.length !== 1 ? 's' : ''} actualizado${targets.length !== 1 ? 's' : ''}`);
      return;
    }

    const dish = activeAlert?.affected?.[0]?.dish || selectedDish?.();
    if (!dish) {
      showSync?.('No encuentro el plato para actualizar');
      return;
    }
    const nextPvp = await applyNewPriceToDish(dish);
    selectedDishId = dish.id;
    if (useSupabase && session && supabase && typeof loadFromSupabase === 'function') await loadFromSupabase();
    renderAll();
    showScreen('dish-detail');
    showSync?.(`Nuevo PVP aplicado: ${currency(nextPvp)}`);
  } catch (error) {
    console.error(error);
    showSync?.('No se pudo guardar el nuevo precio');
  }
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const label = button.textContent.trim();
  const isApplyPriceAction = button.dataset.action === 'apply-recommended-price';
  const isLegacyApplyPriceLabel = label === 'Aplicar nuevo precio' || label === 'Aplicar precios sugeridos';
  if (!isApplyPriceAction && !isLegacyApplyPriceLabel) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  await applyRecommendedPriceFromCurrentContext();
}, true);
