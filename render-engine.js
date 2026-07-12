/* ==========================================================================
 * render-engine.js — UI render functions (no state, no events, no side effects)
 *
 * Dependencies (globals from script.js):
 *   dishes, ingredients, business, selectedDishId, screens, navButtons, nav, fab, shell
 *
 * Dependencies (functions from cost-engine.js / script.js):
 *   dishMargin, suggestedPrice, currency, percent, marginClass, dishCost,
 *   ingredientCost, primaryFormat, formatCost, formatMargin, oilAlert, selectedDish
 *
 * Load AFTER cost-engine.js and script.js (so globals are available).
 * ========================================================================== */

function renderHome() {
  const margins = dishes.map((dish) => dishMargin(dish));
  const averageMargin = margins.length ? margins.reduce((sum, item) => sum + item, 0) / margins.length : 0;
  const alert = oilAlert();
  // Nota: esta es la renderHome base. product-actions.js la sustituye por la
  // versión definitiva (alertas dinámicas). Los selectores que el rediseño
  // eliminó (.alert-card) se guardan con ?. para evitar el crash en el primer
  // render síncrono, antes de que se cargue el parche.
  const avatar = document.querySelector(".avatar");
  if (avatar) avatar.textContent = business.ownerInitials;
  const homeTitle = document.querySelector("[data-screen='home'] .hero h1");
  if (homeTitle) homeTitle.textContent = business.name;
  const kpis = document.querySelectorAll("[data-screen='home'] .kpi strong");
  if (kpis[0]) kpis[0].textContent = percent(averageMargin);
  if (kpis[1]) kpis[1].textContent = dishes.length;
  if (kpis[2]) kpis[2].textContent = alert.affected.length;
  const alertHeading = document.querySelector(".alert-card h2");
  if (alertHeading) alertHeading.textContent = `Aceite de oliva +${Math.round(alert.rise * 100)}%`;
  const alertBody = document.querySelector(".alert-card p");
  if (alertBody) alertBody.textContent = `${alert.affected.length} platos han bajado su margen por debajo del 65%`;
  const dishList = document.querySelector(".dish-list");
  if (dishList) dishList.innerHTML = dishes.map((dish) => `<article class="dish-card" data-go="dish-detail" data-dish-id="${dish.id}" role="button" tabindex="0"><div class="dish-thumb ${dish.icon}"></div><div class="dish-info"><h3>${escapeHtml(dish.name)}</h3><p>Coste: <b>${currency(dishCost(dish))}</b> · PVP: ${currency(dish.pvp)}</p></div><span class="margin-badge ${marginClass(dishMargin(dish))}">${percent(dishMargin(dish))}</span></article>`).join("");
}

function renderDetail() {
  const dish = selectedDish(); if (!dish) return;
  const screen = document.querySelector("[data-screen='dish-detail']");
  const margin = dishMargin(dish);
  screen.querySelector("h1").innerHTML = escapeHtml(dish.name).replace(" de ", " de<br />");
  screen.querySelector(".muted-on-dark").textContent = `${dish.servings} ración${dish.servings > 1 ? "es" : ""} · Actualizado hoy`;
  screen.querySelector(".status-pill strong").textContent = percent(margin);
  screen.querySelector(".status-pill span").textContent = margin >= 0.7 ? "margen bruto ✓ Saludable" : "margen bruto · Revisar";
  screen.querySelector(".ingredient-list").innerHTML = dish.recipe.map((line) => `<div><span>${escapeHtml(ingredients[line.ingredient]?.name || "Ingrediente")}</span><em>${line.qty} ${escapeHtml(ingredients[line.ingredient]?.unit || "")}</em><b>${currency(ingredientCost(line))}</b></div>`).join("");
  screen.querySelector(".total-card strong").textContent = currency(dishCost(dish));
  screen.querySelector(".price-row strong").textContent = currency(dish.pvp);
  document.querySelector(".edit-list").innerHTML = screen.querySelector(".ingredient-list").innerHTML;
  document.querySelector(".sticky-summary").innerHTML = `<span>Coste total <b>${currency(dishCost(dish))}</b></span><span>Margen <b>${percent(margin)}</b></span>`;
}

function renderQr() {
  const published = dishes.filter((dish) => dish.published);
  const missingDescriptions = dishes.filter((dish) => !dish.description).length;
  document.querySelectorAll("[data-screen='qr'] .hero p, .qr-card p").forEach((node) => { node.innerHTML = `escandalia.app/<b>${business.slug}</b>`; });
  document.querySelector(".state-list").innerHTML = `<article><div class="state-icon check"></div><div><h3>${published.length} platos publicados</h3><p>Última actualización: hoy</p></div></article><article><div class="state-icon globe"></div><div><h3>Traducción IA activa</h3><p>Español · Inglés · Francés</p></div></article><article><div class="state-icon spark"></div><div><h3>${missingDescriptions} platos sin descripción</h3><p>La IA puede completarlos.</p></div></article>`;
}

function ingDisplayPrice(ing) {
  if (ing.unit === "g") return `${currency(ing.current * 1000)}/kg`;
  if (ing.unit === "ml") return `${currency(ing.current * 1000)}/L`;
  return `${currency(ing.current)}/${ing.unit}`;
}

function ingDisplayUnit(ing) {
  if (ing.unit === "g") return "kg";
  if (ing.unit === "ml") return "L";
  return ing.unit;
}

function renderIngredientAlert() {
  const screen = document.querySelector("[data-screen='ingredient-alert']");
  if (!screen) return;
  const alerts = typeof getCostAlerts === "function" ? getCostAlerts() : [];
  const ingId = typeof selectedIngredientId !== "undefined" ? selectedIngredientId : "";
  const alert = alerts.find((a) => a.ingredientId === ingId) || alerts[0];
  if (!alert) return;
  const ing = alert.ingredient;
  screen.querySelector("h1").textContent = `${ing.name} +${Math.round(alert.rise * 100)}%`;
  screen.querySelector(".impact-grid").innerHTML = `<div><span>Antes</span><b>${ingDisplayPrice({ ...ing, current: ing.before })}</b></div><div><span>Ahora</span><b>${ingDisplayPrice(ing)}</b></div><div><span>Impacto</span><b>${alert.affected.length} plato${alert.affected.length !== 1 ? "s" : ""}</b></div>`;
  screen.querySelectorAll(".affected-card").forEach((node) => node.remove());
  screen.querySelector(".section-title").insertAdjacentHTML("afterend", alert.affected.map((item) => `<article class="affected-card"><h3>${escapeHtml(item.dish.name)}</h3><p>Antes ${percent(item.before)} · Ahora <b>${percent(item.current)}</b></p><strong>PVP sugerido: ${currency(item.suggested)}</strong></article>`).join(""));
}

function renderIngredientList() {
  const screen = document.querySelector("[data-screen='ingredient-list']");
  if (!screen) return;
  const list = screen.querySelector(".ing-list");
  if (!list) return;
  const alerts = typeof getCostAlerts === "function" ? getCostAlerts() : [];
  const alertedIds = new Set(alerts.map((a) => a.ingredientId));
  const sorted = Object.entries(ingredients).sort(([idA], [idB]) => {
    if (alertedIds.has(idA) && !alertedIds.has(idB)) return -1;
    if (!alertedIds.has(idA) && alertedIds.has(idB)) return 1;
    return (ingredients[idA]?.name || "").localeCompare(ingredients[idB]?.name || "");
  });
  list.innerHTML = sorted.map(([id, ing]) => {
    const rise = ing.before > 0 ? (ing.current - ing.before) / ing.before : 0;
    const isAlert = alertedIds.has(id);
    const changeBadge = Math.abs(rise) > 0.001 ? `<span class="ing-change ${rise > 0 ? "ing-up" : "ing-down"}">${rise > 0 ? "+" : ""}${Math.round(rise * 100)}%</span>` : "";
    return `<article class="ing-row${isAlert ? " ing-alert" : ""}" data-go="ingredient-edit" data-ing-id="${id}" role="button" tabindex="0"><div class="ing-info"><h3>${escapeHtml(ing.name)}</h3><p>${ingDisplayPrice(ing)}</p></div><div class="ing-right">${changeBadge}<span class="ing-arrow">›</span></div></article>`;
  }).join("");
}

function renderIngredientEdit() {
  const screen = document.querySelector("[data-screen='ingredient-edit']");
  if (!screen) return;
  const id = typeof selectedIngredientId !== "undefined" ? selectedIngredientId : "";
  const ing = ingredients[id];
  if (!ing) return;
  const displayUnit = ingDisplayUnit(ing);
  const displayPrice = (ing.unit === "g" || ing.unit === "ml") ? ing.current * 1000 : ing.current;
  const prevDisplay = (ing.unit === "g" || ing.unit === "ml") ? ing.before * 1000 : ing.before;
  screen.querySelector(".ing-edit-name").textContent = ing.name;
  screen.querySelector(".ing-edit-unit").textContent = `Precio por ${displayUnit}`;
  const input = screen.querySelector(".ing-price-input");
  if (input) { input.value = displayPrice.toFixed(3).replace(/\.?0+$/, ""); input.step = "0.01"; }
  const prev = screen.querySelector(".ing-price-prev");
  if (prev) prev.textContent = `Anterior: ${currency(prevDisplay)} / ${displayUnit}`;
  const preview = screen.querySelector(".impact-preview");
  if (!preview) return;
  const alerts = typeof getCostAlerts === "function" ? getCostAlerts() : [];
  const myAlert = alerts.find((a) => a.ingredientId === id);
  preview.innerHTML = myAlert?.affected.length ? `<div class="section-title" style="margin-top:24px">Platos afectados</div>${myAlert.affected.map((item) => `<article class="affected-card"><h3>${escapeHtml(item.dish.name)}</h3><p>Margen actual: <b>${percent(item.current)}</b></p><strong>PVP sugerido: ${currency(item.suggested)}</strong></article>`).join("")}` : "";
}

function renderAiPrice() {
  const dish = oilAlert().affected[0]?.dish || selectedDish(); if (!dish) return;
  const recommended = suggestedPrice(dish);
  const marginWithNewPrice = (recommended - dishCost(dish)) / recommended;
  const screen = document.querySelector("[data-screen='ai-price']");
  screen.querySelector(".hero p").textContent = dish.name;
  screen.querySelector(".recommendation strong").textContent = currency(recommended);
  screen.querySelector(".compare-list").innerHTML = `<div><span>PVP actual</span><b>${currency(dish.pvp)}</b></div><div><span>Coste actual</span><b>${currency(dishCost(dish))}</b></div><div><span>Margen actual</span><b>${percent(dishMargin(dish))}</b></div><div><span>Con nuevo PVP</span><b>${percent(marginWithNewPrice)}</b></div>`;
}

function renderPublicMenu() {
  document.querySelector(".public-header h1").textContent = business.name;
  document.querySelector("[data-screen='public-menu'] .content").innerHTML = `<div class="category-tabs"><button class="is-selected">Tapas</button><button>Bocadillos</button><button>Bebidas</button></div>${dishes.filter((dish) => dish.published).map((dish) => `<article class="menu-item"><div><h3>${escapeHtml(dish.name)}</h3><p>${escapeHtml(dish.description || "Descripción pendiente.")}</p><span>${escapeHtml(dish.allergens)}</span></div><strong>${currency(dish.pvp)}</strong></article>`).join("")}`;
}