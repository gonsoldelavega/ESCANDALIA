// Ownership note: this file is the planned single owner for the
// "apply recommended price" flow. Current duplicated implementations in other
// files are delegation candidates until Phase B/C remove the overlap.
async function applyRecommendedPriceFromCurrentContext() {
  const dish = oilAlert().affected[0]?.dish || selectedDish?.();
  if (!dish) {
    showSync?.('No encuentro el plato para actualizar');
    return;
  }

  ensureDishFormats?.(dish);
  const format = primaryFormat?.(dish) || dish.formats?.[0];
  const nextPvp = suggestedPrice(dish, business.targetMargin, format);

  if (dish.formats?.[0]) dish.formats[0].pvp = nextPvp;
  dish.pvp = nextPvp;
  selectedDishId = dish.id;

  try {
    if (useSupabase && session && supabase) {
      if (typeof updateDishWithFormats === 'function') {
        await updateDishWithFormats(dish);
      } else {
        await supabase.from('dishes').update({ pvp: nextPvp }).eq('id', dish.id);
      }
      if (typeof loadFromSupabase === 'function') await loadFromSupabase();
    }

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
