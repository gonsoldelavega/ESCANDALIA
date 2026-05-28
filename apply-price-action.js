(() => {
  const style = document.createElement('style');
  style.textContent = `
    .profit-card {
      background: linear-gradient(145deg, #191916, #2d2118) !important;
      color: #fffaf5 !important;
    }
    .profit-metric,
    .profit-sim-input {
      background: rgba(255, 250, 245, 0.07) !important;
      border-color: rgba(232, 221, 208, 0.14) !important;
    }
    .profit-card-title,
    .profit-sim-label {
      color: rgba(255, 250, 245, 0.62) !important;
      letter-spacing: 0.1em;
    }
    .profit-metric-label,
    .profit-impact-sub {
      color: rgba(255, 250, 245, 0.56) !important;
    }
    .dish-card {
      grid-template-rows: auto auto;
    }
    .dish-card > .profit-badge-inline {
      grid-column: 2;
      grid-row: 2;
      justify-self: start;
      align-self: start;
      margin: -12px 0 0;
      max-width: 100%;
      white-space: nowrap;
    }
    .profit-good,
    .badge-good {
      background: #35521f !important;
      color: #d8efc9 !important;
    }
    .profit-mid,
    .badge-mid {
      background: #8a641d !important;
      color: #fff0bd !important;
    }
    .profit-bad,
    .badge-bad {
      background: #8e2d25 !important;
      color: #ffe2dc !important;
    }
  `;
  document.head.appendChild(style);
})();

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const label = button.textContent.trim();
  if (label !== 'Aplicar nuevo precio' && label !== 'Aplicar precios sugeridos') return;

  event.preventDefault();
  event.stopImmediatePropagation();

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
}, true);
