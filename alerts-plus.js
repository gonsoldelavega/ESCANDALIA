/* ==========================================================================
 * alerts-plus.js — Centro de avisos proactivos y accionables.
 *
 * Amplía las alertas de subida de coste con una revisión de salud del negocio:
 *   - Platos por debajo del margen objetivo (pierdes rentabilidad).
 *   - Platos con food cost alto o margen negativo (pierdes dinero).
 *   - Platos publicados sin descripción (carta pública incompleta).
 *   - Platos sin receta (no se puede calcular el escandallo).
 *   - Ingredientes sin actualizar hace más de 30 días.
 * Y estima el sobrecoste del periodo (ventas × subida de coste).
 *
 * Depende de: dishes, ingredients, business, opsState, getCostAlerts,
 * realMargin, foodCostPercent, primaryFormat, formatCost, currency, percent,
 * escapeHtml, showScreen, activateDynamicScreen, renderHome.
 * Carga DESPUÉS de menu-engineering.js.
 * ========================================================================== */

const STALE_INGREDIENT_DAYS = 30;

function daysSince(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86400000);
}

/** Sobrecoste estimado del periodo: unidades vendidas × subida de coste/ración. */
function estimatedExtraCost() {
  const sales = typeof opsState !== 'undefined' ? opsState.sales : [];
  let total = 0;
  const byDish = {};
  sales.forEach((sale) => { byDish[sale.dishId] = (byDish[sale.dishId] || 0) + (Number(sale.qty) || 0); });
  dishes.forEach((dish) => {
    const units = byDish[dish.id] || 0;
    if (!units) return;
    const format = primaryFormat(dish);
    const delta = formatCost(dish, format, 'current') - formatCost(dish, format, 'before');
    if (delta > 0) total += delta * units;
  });
  return total;
}

function buildBusinessAlerts() {
  const target = Number(business?.targetMargin) || 0.7;
  const alerts = [];

  // 1. Subidas de coste (reutiliza el motor existente).
  const costAlerts = typeof getCostAlerts === 'function' ? getCostAlerts() : [];
  costAlerts.forEach((a) => {
    alerts.push({
      type: 'cost-rise', severity: 'high', icon: '📈',
      title: `${a.ingredient.name} +${Math.round(a.rise * 100)}%`,
      detail: `${a.affected.length} plato${a.affected.length !== 1 ? 's' : ''} por debajo del margen objetivo`,
      action: { go: 'ingredient-alert', ingId: a.ingredientId },
    });
  });

  dishes.forEach((dish) => {
    const format = primaryFormat(dish);
    const hasRecipe = Boolean(dish.recipe?.length);
    // El objetivo del negocio se expresa en margen bruto (materia prima), así
    // que el aviso "bajo objetivo" compara contra el margen bruto. La pérdida
    // real (food cost / margen negativo) usa las cifras netas de IVA.
    const grossMargin = formatMargin(dish, format);
    const realM = realMargin(dish, format);
    const food = foodCostPercent(dish, format);

    // 2. Margen negativo / food cost muy alto → pierdes dinero.
    if (hasRecipe && (realM < 0 || food > 0.4)) {
      alerts.push({
        type: 'loss', severity: 'high', icon: '🔻',
        title: `${dish.name}: food cost ${percent(food)}`,
        detail: realM < 0 ? 'Estás vendiendo por debajo de coste.' : 'Food cost por encima del 40%: margen muy justo.',
        action: { go: 'ai-price', dishId: dish.id },
      });
    } else if (hasRecipe && grossMargin < target) {
      // 3. Por debajo del margen objetivo (bruto).
      alerts.push({
        type: 'below-target', severity: 'mid', icon: '⚠️',
        title: `${dish.name} al ${percent(grossMargin)}`,
        detail: `Por debajo de tu objetivo (${percent(target)}). Revisa PVP o receta.`,
        action: { go: 'ai-price', dishId: dish.id },
      });
    }

    // 4. Sin receta.
    if (!hasRecipe) {
      alerts.push({
        type: 'no-recipe', severity: 'mid', icon: '🍳',
        title: `${dish.name} sin receta`,
        detail: 'Añade ingredientes para calcular su escandallo y margen real.',
        action: { go: 'edit-recipe', dishId: dish.id },
      });
    }

    // 5. Publicado sin descripción.
    if (dish.published && !String(dish.description || '').trim()) {
      alerts.push({
        type: 'no-description', severity: 'low', icon: '📝',
        title: `${dish.name} sin descripción`,
        detail: 'Está en la carta pública sin texto. Complétala para vender mejor.',
        action: { go: 'edit-recipe', dishId: dish.id },
      });
    }
  });

  // 6. Ingredientes sin actualizar hace mucho.
  Object.entries(ingredients).forEach(([id, ing]) => {
    const age = daysSince(ing.updatedAt);
    if (age !== null && age >= STALE_INGREDIENT_DAYS) {
      alerts.push({
        type: 'stale', severity: 'low', icon: '🕒',
        title: `${ing.name} sin actualizar`,
        detail: `Último cambio hace ${age} días. Revisa el precio con tu última factura.`,
        action: { go: 'ingredient-edit', ingId: id },
      });
    }
  });

  const order = { high: 0, mid: 1, low: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

function ensureAlertsCenterScreen() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav || document.querySelector('[data-screen="alerts-center"]')) return;
  nav.insertAdjacentHTML('beforebegin', `<section class="app-screen" data-screen="alerts-center"><header class="hero hero-rust compact-hero"><div class="orb orb-soft"></div><button class="back" type="button" data-go="home">← Volver</button><h1>Avisos</h1><p>Todo lo que conviene revisar hoy.</p></header><div class="content alerts-center-content"></div></section>`);
}

function renderAlertsCenter() {
  const content = document.querySelector('.alerts-center-content');
  if (!content) return;
  const alerts = buildBusinessAlerts();
  const extra = estimatedExtraCost();
  const summary = extra > 0
    ? `<div class="alerts-loss-card"><span>Sobrecoste estimado del periodo</span><strong>${currency(extra)}</strong><em>por subidas de coste sobre lo que has vendido</em></div>`
    : '';
  if (!alerts.length) {
    content.innerHTML = `${summary}<div class="no-alerts"><span class="no-alerts-check">✓</span> Todo en orden · Sin avisos activos</div>`;
    return;
  }
  const sevLabel = { high: 'Prioritario', mid: 'A revisar', low: 'Mejora' };
  content.innerHTML = `${summary}${alerts.map((a) => {
    const data = [a.action.dishId ? `data-dish-id="${a.action.dishId}"` : '', a.action.ingId ? `data-ing-id="${a.action.ingId}"` : ''].join(' ');
    return `<article class="alert-item sev-${a.severity}" data-go="${a.action.go}" ${data} role="button" tabindex="0"><div class="alert-item-icon">${a.icon}</div><div class="alert-item-body"><div class="alert-item-top"><h3>${escapeHtml(a.title)}</h3><span class="alert-sev">${sevLabel[a.severity]}</span></div><p>${escapeHtml(a.detail)}</p></div><span class="alert-item-arrow">›</span></article>`;
  }).join('')}`;
}

function renderHomeAvisos() {
  const home = document.querySelector("[data-screen='home'] .alerts-list");
  if (!home) return;
  const alerts = buildBusinessAlerts();
  const nonCost = alerts.filter((a) => a.type !== 'cost-rise');
  home.parentElement.querySelector('.avisos-summary')?.remove();
  if (!nonCost.length) return;
  const high = nonCost.filter((a) => a.severity === 'high').length;
  const card = `<article class="avisos-summary" data-go="alerts-center" role="button" tabindex="0"><div class="avisos-icon">🔔</div><div><h3>${nonCost.length} aviso${nonCost.length !== 1 ? 's' : ''} de tu negocio</h3><p>${high ? `${high} prioritario${high !== 1 ? 's' : ''} · ` : ''}platos bajo margen, sin receta o carta incompleta</p></div><span class="alert-item-arrow">›</span></article>`;
  home.insertAdjacentHTML('afterend', card);
}

// ── Marcado de fecha de actualización de ingredientes ────────────────
function stampIngredientDates(ids) {
  const now = new Date().toISOString();
  (Array.isArray(ids) ? ids : Object.keys(ingredients)).forEach((id) => {
    if (ingredients[id]) ingredients[id].updatedAt = now;
  });
}
if (typeof saveIngredientPrice === 'function') {
  const prevSaveIngredientPrice = saveIngredientPrice;
  saveIngredientPrice = async function saveIngredientPriceStamped(id, price) {
    const result = await prevSaveIngredientPrice(id, price);
    stampIngredientDates([id]);
    if (typeof saveLocalState === 'function') saveLocalState();
    return result;
  };
}

// ── Enganche con renders y navegación ────────────────────────────────
if (typeof renderHome === 'function') {
  const prevRenderHomeAlerts = renderHome;
  renderHome = function renderHomeWithAvisos() {
    prevRenderHomeAlerts();
    renderHomeAvisos();
  };
}
if (typeof showScreen === 'function') {
  const prevShowScreenAlerts = showScreen;
  showScreen = function showScreenWithAlertsCenter(name) {
    prevShowScreenAlerts(name);
    if (name === 'alerts-center') {
      if (typeof activateDynamicScreen === 'function') activateDynamicScreen(name);
      renderAlertsCenter();
    }
  };
}

ensureAlertsCenterScreen();
if (typeof renderAll === 'function') renderAll();
