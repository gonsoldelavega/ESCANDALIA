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
  document.querySelector(".avatar").textContent = business.ownerInitials;
  document.querySelector("[data-screen='home'] .hero h1").textContent = business.name;
  const kpis = document.querySelectorAll("[data-screen='home'] .kpi strong");
  kpis[0].textContent = percent(averageMargin); kpis[1].textContent = dishes.length; kpis[2].textContent = alert.affected.length;
  document.querySelector(".alert-card h2").textContent = `Aceite de oliva +${Math.round(alert.rise * 100)}%`;
  document.querySelector(".alert-card p").textContent = `${alert.affected.length} platos han bajado su margen por debajo del 65%`;
  document.querySelector(".dish-list").innerHTML = dishes.map((dish) => `<article class="dish-card" data-go="dish-detail" data-dish-id="${dish.id}" role="button" tabindex="0"><div class="dish-thumb ${dish.icon}"></div><div class="dish-info"><h3>${dish.name}</h3><p>Coste: <b>${currency(dishCost(dish))}</b> · PVP: ${currency(dish.pvp)}</p></div><span class="margin-badge ${marginClass(dishMargin(dish))}">${percent(dishMargin(dish))}</span></article>`).join("");
}

function renderDetail() {
  const dish = selectedDish(); if (!dish) return;
  const screen = document.querySelector("[data-screen='dish-detail']");
  const margin = dishMargin(dish);
  screen.querySelector("h1").innerHTML = dish.name.replace(" de ", " de<br />");
  screen.querySelector(".muted-on-dark").textContent = `${dish.servings} ración${dish.servings > 1 ? "es" : ""} · Actualizado hoy`;
  screen.querySelector(".status-pill strong").textContent = percent(margin);
  screen.querySelector(".status-pill span").textContent = margin >= 0.7 ? "margen bruto ✓ Saludable" : "margen bruto · Revisar";
  screen.querySelector(".ingredient-list").innerHTML = dish.recipe.map((line) => `<div><span>${ingredients[line.ingredient]?.name || "Ingrediente"}</span><em>${line.qty} ${ingredients[line.ingredient]?.unit || ""}</em><b>${currency(ingredientCost(line))}</b></div>`).join("");
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

function renderIngredientAlert() {
  const alert = oilAlert();
  const screen = document.querySelector("[data-screen='ingredient-alert']");
  const oil = Object.values(ingredients).find((item) => item.name === "Aceite de oliva") || { before: 0, current: 0 };
  screen.querySelector("h1").textContent = `Aceite de oliva +${Math.round(alert.rise * 100)}%`;
  screen.querySelector(".impact-grid").innerHTML = `<div><span>Antes</span><b>${currency(oil.before * 1000)}/L</b></div><div><span>Ahora</span><b>${currency(oil.current * 1000)}/L</b></div><div><span>Impacto</span><b>${alert.affected.length} platos</b></div>`;
  screen.querySelectorAll(".affected-card").forEach((node) => node.remove());
  screen.querySelector(".section-title").insertAdjacentHTML("afterend", alert.affected.map((item) => `<article class="affected-card"><h3>${item.dish.name}</h3><p>Antes ${percent(item.before)} · Ahora <b>${percent(item.current)}</b></p><strong>PVP sugerido: ${currency(item.suggested)}</strong></article>`).join(""));
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
  document.querySelector("[data-screen='public-menu'] .content").innerHTML = `<div class="category-tabs"><button class="is-selected">Tapas</button><button>Bocadillos</button><button>Bebidas</button></div>${dishes.filter((dish) => dish.published).map((dish) => `<article class="menu-item"><div><h3>${dish.name}</h3><p>${dish.description || "Descripción pendiente."}</p><span>${dish.allergens}</span></div><strong>${currency(dish.pvp)}</strong></article>`).join("")}`;
}