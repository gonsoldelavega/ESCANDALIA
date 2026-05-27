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
  document.querySelector(".dish-list").innerHTML = dishes.map((dish) => `<article class="dish-card" data-go="dish-detail" data-dish-id="${dish.id}" role="button" tabindex="0"><div class="dish-thumb ${dish.icon}"></div><div class="dish-info"><h3>${dish.name}</h3><p>Coste: <b>${currency(dishCost(dish))}</b> · PVP: ${currency(dish.pvp)}</p></div><span class="margin-badge ${marginClass(dishMargin(dish))}">${percent(dishMargin(dish))}</span>${profitBadgeHtml(dish)}</article>`).join("");
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
  renderProfitCard(dish);
}

function renderProfitCard(dish) {
  const fmt = primaryFormat(dish);
  const cost = formatCost(dish, fmt);
  const pvp = Number(fmt?.pvp) || 0;
  const marginEur = profitMarginEuros(dish, fmt);
  const marginPct = dishMargin(dish);
  const fc = foodCostPct(dish, fmt);
  const status = profitStatus(dish, fmt);
  const statusClass = profitStatusClass(status);
  const targetMargin = business?.targetMargin || 0.75;
  const recPvp = suggestedPrice(dish, targetMargin, fmt);
  const ventasSemana = 20;
  const impact = monthlyImpact(dish, targetMargin, ventasSemana, fmt);

  // Microcopy del impacto: si el PVP actual ya está por encima del recomendado
  const alreadyAbove = pvp >= recPvp;
  let impactText, impactSubText;
  if (alreadyAbove) {
    impactText = `+${currency(Math.abs(impact))}`;
    impactSubText = `Ya estás por encima del PVP recomendado (${currency(recPvp)})`;
  } else {
    impactText = `${impact >= 0 ? '+' : ''}${currency(impact)}`;
    impactSubText = `subiendo PVP de ${currency(pvp)} a ${currency(recPvp)} con ${ventasSemana} ventas/sem`;
  }

  const html = `
    <div class="profit-card" id="profit-card">
      <div class="profit-card-header">
        <span class="profit-card-title">Rentabilidad</span>
        <span class="profit-status-badge ${statusClass}">${status}</span>
      </div>
      <div class="profit-metrics-grid">
        <div class="profit-metric">
          <div class="profit-metric-label">Coste ración</div>
          <div class="profit-metric-value neutral">${currency(cost)}</div>
        </div>
        <div class="profit-metric">
          <div class="profit-metric-label">PVP actual</div>
          <div class="profit-metric-value neutral">${currency(pvp)}</div>
        </div>
        <div class="profit-metric">
          <div class="profit-metric-label">Margen €</div>
          <div class="profit-metric-value ${marginEur >= 0 ? 'positive' : 'negative'}">${currency(marginEur)}</div>
        </div>
        <div class="profit-metric">
          <div class="profit-metric-label">Margen %</div>
          <div class="profit-metric-value ${marginPct >= 0.7 ? 'positive' : marginPct >= 0.62 ? 'neutral' : 'negative'}">${percent(marginPct)}</div>
        </div>
        <div class="profit-metric">
          <div class="profit-metric-label">Food cost</div>
          <div class="profit-metric-value ${fc <= 0.3 ? 'positive' : fc <= 0.4 ? 'neutral' : 'negative'}">${percent(fc)}</div>
        </div>
        <div class="profit-metric">
          <div class="profit-metric-label">PVP recomendado</div>
          <div class="profit-metric-value positive">${currency(recPvp)}</div>
        </div>
      </div>
      <div class="profit-sim-label">Simulador</div>
      <div class="profit-sim-row">
        <input class="profit-sim-input" id="sim-margen" type="number" placeholder="Margen objetivo %" value="${Math.round(targetMargin * 100)}" min="10" max="95" />
        <input class="profit-sim-input" id="sim-ventas" type="number" placeholder="Ventas/sem" value="${ventasSemana}" min="1" max="500" />
      </div>
      <div class="profit-impact-box ${alreadyAbove ? 'profit-impact-already' : ''}">
        <div class="profit-impact-label">${alreadyAbove ? 'Estado actual' : 'Impacto mensual estimado'}</div>
        <div class="profit-impact-value">${alreadyAbove ? '✓ Por encima de objetivo' : impactText}</div>
        <div class="profit-impact-sub">${impactSubText}</div>
      </div>
    </div>`;

  // Insertar después de price-row, antes del botón editar
  const detailScreen = document.querySelector("[data-screen='dish-detail']");
  const priceRow = detailScreen?.querySelector(".price-row");
  if (priceRow) {
    // Eliminar profit-card anterior si existe
    detailScreen.querySelector("#profit-card")?.remove();
    priceRow.insertAdjacentHTML("afterend", html);
  }

  // Bind inputs del simulador
  const margenInput = detailScreen?.querySelector("#sim-margen");
  const ventasInput = detailScreen?.querySelector("#sim-ventas");
  const recalculate = () => {
    const tm = (Number(margenInput?.value) || 75) / 100;
    const vs = Number(ventasInput?.value) || 0;
    const newRec = suggestedPrice(dish, tm, fmt);
    const newImpact = monthlyImpact(dish, tm, vs, fmt);
    const impactBox = detailScreen?.querySelector("#profit-card .profit-impact-box");
    if (impactBox) {
      const simAlreadyAbove = pvp >= newRec;
      const newImpactText = simAlreadyAbove ? "✓ Por encima de objetivo" : `${newImpact >= 0 ? '+' : ''}${currency(newImpact)}`;
      const newImpactSub = simAlreadyAbove
        ? `Ya estás por encima del PVP recomendado (${currency(newRec)})`
        : `subiendo PVP de ${currency(pvp)} a ${currency(newRec)} con ${vs} ventas/sem`;
      impactBox.querySelector(".profit-impact-value").textContent = newImpactText;
      impactBox.querySelector(".profit-impact-sub").textContent = newImpactSub;
      impactBox.querySelector(".profit-impact-label").textContent = simAlreadyAbove ? "Estado actual" : "Impacto mensual estimado";
      impactBox.classList.toggle("profit-impact-already", simAlreadyAbove);
    }
    // Actualizar PVP recomendado en la grid
    const recEl = detailScreen?.querySelector("#profit-card .profit-metric-value.positive");
    if (recEl) recEl.textContent = currency(newRec);
  };
  margenInput?.addEventListener("input", recalculate);
  ventasInput?.addEventListener("input", recalculate);
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