const business = {
  name: "Bar El Rincón",
  slug: "barelrincón",
  ownerInitials: "JM",
  targetMargin: 0.75,
  languages: ["ES", "EN", "FR", "DE"],
};

const ingredients = {
  potato: { name: "Patatas", unit: "g", before: 0.00065, current: 0.00065 },
  egg: { name: "Huevos", unit: "uds", before: 0.23, current: 0.23 },
  oil: { name: "Aceite de oliva", unit: "ml", before: 0.0058, current: 0.00684 },
  onion: { name: "Cebolla", unit: "g", before: 0.0008, current: 0.0008 },
  salt: { name: "Sal", unit: "receta", before: 0.01, current: 0.01 },
  prawn: { name: "Gambas", unit: "g", before: 0.028, current: 0.028 },
  garlic: { name: "Ajo", unit: "g", before: 0.004, current: 0.004 },
  lettuce: { name: "Lechuga", unit: "g", before: 0.003, current: 0.003 },
  tuna: { name: "Atún", unit: "g", before: 0.011, current: 0.011 },
  ham: { name: "Jamón", unit: "g", before: 0.012, current: 0.012 },
  milk: { name: "Leche", unit: "ml", before: 0.00124, current: 0.00124 },
  flour: { name: "Harina", unit: "g", before: 0.0016, current: 0.0016 },
};

let dishes = [
  {
    id: "tortilla",
    name: "Tortilla de patatas",
    category: "Tapas",
    servings: 1,
    pvp: 3,
    icon: "egg",
    published: true,
    description: "Jugosa tortilla casera con patata pochada y huevo de corral.",
    allergens: "Contiene huevo",
    recipe: [
      { ingredient: "potato", qty: 200 },
      { ingredient: "egg", qty: 1.5 },
      { ingredient: "oil", qty: 20 },
      { ingredient: "onion", qty: 50 },
      { ingredient: "salt", qty: 1 },
    ],
  },
  {
    id: "gambas",
    name: "Gambas al ajillo",
    category: "Tapas",
    servings: 1,
    pvp: 7.5,
    icon: "prawn",
    published: true,
    description: "Gambas salteadas con ajo, aceite de oliva y un punto de guindilla.",
    allergens: "Marisco",
    recipe: [
      { ingredient: "prawn", qty: 180 },
      { ingredient: "garlic", qty: 12 },
      { ingredient: "oil", qty: 35 },
    ],
  },
  {
    id: "ensalada",
    name: "Ensalada mixta",
    category: "Tapas",
    servings: 1,
    pvp: 5,
    icon: "olive-thumb",
    published: true,
    description: "Lechuga fresca, tomate, cebolla, aceitunas y atún.",
    allergens: "Disponible hoy",
    recipe: [
      { ingredient: "lettuce", qty: 180 },
      { ingredient: "tuna", qty: 95 },
      { ingredient: "oil", qty: 22 },
      { ingredient: "onion", qty: 40 },
    ],
  },
  {
    id: "croquetas",
    name: "Croquetas de jamón",
    category: "Tapas",
    servings: 6,
    pvp: 3,
    icon: "prawn",
    published: false,
    description: "",
    allergens: "Contiene gluten y leche",
    recipe: [
      { ingredient: "ham", qty: 80 },
      { ingredient: "milk", qty: 250 },
      { ingredient: "flour", qty: 80 },
      { ingredient: "oil", qty: 28 },
    ],
  },
];

let selectedDishId = "tortilla";

const screens = [...document.querySelectorAll(".app-screen")];
const navButtons = [...document.querySelectorAll(".bottom-nav button")];
const nav = document.querySelector(".bottom-nav");
const fab = document.querySelector(".fab");
const shell = document.querySelector(".phone-shell");

function currency(value) {
  return `${value.toFixed(2).replace(".", ",")}€`;
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function ingredientCost(line, mode = "current") {
  return ingredients[line.ingredient][mode] * line.qty;
}

function dishCost(dish, mode = "current") {
  return dish.recipe.reduce((total, line) => total + ingredientCost(line, mode), 0);
}

function dishMargin(dish, mode = "current") {
  return (dish.pvp - dishCost(dish, mode)) / dish.pvp;
}

function suggestedPrice(dish, target = business.targetMargin) {
  return Math.ceil((dishCost(dish) / (1 - target)) * 20) / 20;
}

function marginClass(margin) {
  if (margin >= 0.7) return "good-bg";
  if (margin >= 0.62) return "mid-bg";
  return "low-bg";
}

function selectedDish() {
  return dishes.find((dish) => dish.id === selectedDishId) || dishes[0];
}

function oilAlert() {
  const oil = ingredients.oil;
  const rise = (oil.current - oil.before) / oil.before;
  const affected = dishes
    .map((dish) => ({ dish, before: dishMargin(dish, "before"), current: dishMargin(dish), suggested: suggestedPrice(dish) }))
    .filter((item) => item.dish.recipe.some((line) => line.ingredient === "oil") && item.current < 0.65);
  return { rise, affected };
}

function renderHome() {
  const margins = dishes.map((dish) => dishMargin(dish));
  const averageMargin = margins.reduce((sum, item) => sum + item, 0) / margins.length;
  const alert = oilAlert();

  document.querySelector(".avatar").textContent = business.ownerInitials;
  document.querySelector("[data-screen='home'] .hero h1").textContent = business.name;
  const kpis = document.querySelectorAll("[data-screen='home'] .kpi strong");
  kpis[0].textContent = percent(averageMargin);
  kpis[1].textContent = dishes.length;
  kpis[2].textContent = alert.affected.length;

  const alertCard = document.querySelector(".alert-card");
  alertCard.querySelector("h2").textContent = `Aceite de oliva +${Math.round(alert.rise * 100)}%`;
  alertCard.querySelector("p").textContent = `${alert.affected.length} platos han bajado su margen por debajo del 65%`;

  document.querySelector(".dish-list").innerHTML = dishes
    .map((dish) => {
      const margin = dishMargin(dish);
      return `<article class="dish-card" data-go="dish-detail" data-dish-id="${dish.id}" role="button" tabindex="0"><div class="dish-thumb ${dish.icon}"></div><div class="dish-info"><h3>${dish.name}</h3><p>Coste: <b>${currency(dishCost(dish))}</b> · PVP: ${currency(dish.pvp)}</p></div><span class="margin-badge ${marginClass(margin)}">${percent(margin)}</span></article>`;
    })
    .join("");
}

function renderDetail() {
  const dish = selectedDish();
  const screen = document.querySelector("[data-screen='dish-detail']");
  const margin = dishMargin(dish);
  screen.querySelector("h1").innerHTML = dish.name.replace(" de ", " de<br />");
  screen.querySelector(".muted-on-dark").textContent = `${dish.servings} ración${dish.servings > 1 ? "es" : ""} · Actualizado hoy`;
  screen.querySelector(".status-pill strong").textContent = percent(margin);
  screen.querySelector(".status-pill span").textContent = margin >= 0.7 ? "margen bruto ✓ Saludable" : "margen bruto · Revisar";
  screen.querySelector(".ingredient-list").innerHTML = dish.recipe
    .map((line) => `<div><span>${ingredients[line.ingredient].name}</span><em>${line.qty} ${ingredients[line.ingredient].unit}</em><b>${currency(ingredientCost(line))}</b></div>`)
    .join("");
  screen.querySelector(".total-card strong").textContent = currency(dishCost(dish));
  screen.querySelector(".price-row strong").textContent = currency(dish.pvp);
}

function renderQr() {
  const published = dishes.filter((dish) => dish.published);
  const missingDescriptions = dishes.filter((dish) => !dish.description).length;
  document.querySelectorAll("[data-screen='qr'] .hero p, .qr-card p").forEach((node) => {
    node.innerHTML = `escandalia.app/<b>${business.slug}</b>`;
  });
  document.querySelector(".state-list").innerHTML = `<article><div class="state-icon check"></div><div><h3>${published.length} platos publicados</h3><p>Última actualización: hoy</p></div></article><article><div class="state-icon globe"></div><div><h3>Traducción IA activa</h3><p>Español · Inglés · Francés</p></div></article><article><div class="state-icon spark"></div><div><h3>${missingDescriptions} platos sin descripción</h3><p>La IA puede completarlos.</p></div></article>`;
}

function renderIngredientAlert() {
  const alert = oilAlert();
  const screen = document.querySelector("[data-screen='ingredient-alert']");
  screen.querySelector("h1").textContent = `Aceite de oliva +${Math.round(alert.rise * 100)}%`;
  screen.querySelector(".impact-grid").innerHTML = `<div><span>Antes</span><b>${currency(ingredients.oil.before * 1000)}/L</b></div><div><span>Ahora</span><b>${currency(ingredients.oil.current * 1000)}/L</b></div><div><span>Impacto</span><b>${alert.affected.length} platos</b></div>`;
  screen.querySelectorAll(".affected-card").forEach((node) => node.remove());
  const title = screen.querySelector(".section-title");
  title.insertAdjacentHTML(
    "afterend",
    alert.affected
      .map((item) => `<article class="affected-card"><h3>${item.dish.name}</h3><p>Antes ${percent(item.before)} · Ahora <b>${percent(item.current)}</b></p><strong>PVP sugerido: ${currency(item.suggested)}</strong></article>`)
      .join("")
  );
}

function renderAiPrice() {
  const item = oilAlert().affected[0] || { dish: selectedDish(), current: dishMargin(selectedDish()) };
  const dish = item.dish;
  const recommended = suggestedPrice(dish);
  const marginWithNewPrice = (recommended - dishCost(dish)) / recommended;
  const screen = document.querySelector("[data-screen='ai-price']");
  screen.querySelector(".hero p").textContent = dish.name;
  screen.querySelector(".recommendation strong").textContent = currency(recommended);
  screen.querySelector(".compare-list").innerHTML = `<div><span>PVP actual</span><b>${currency(dish.pvp)}</b></div><div><span>Coste actual</span><b>${currency(dishCost(dish))}</b></div><div><span>Margen actual</span><b>${percent(dishMargin(dish))}</b></div><div><span>Con nuevo PVP</span><b>${percent(marginWithNewPrice)}</b></div>`;
}

function renderPublicMenu() {
  document.querySelector(".public-header h1").textContent = business.name.replace("Bar El Rincón", "La Barra de Ana");
  document.querySelector("[data-screen='public-menu'] .content").innerHTML = `<div class="category-tabs"><button class="is-selected">Tapas</button><button>Bocadillos</button><button>Bebidas</button></div>${dishes
    .filter((dish) => dish.published)
    .map((dish) => `<article class="menu-item"><div><h3>${dish.name}</h3><p>${dish.description || "Descripción pendiente."}</p><span>${dish.allergens}</span></div><strong>${currency(dish.pvp)}</strong></article>`)
    .join("")}`;
}

function createDishFromForm() {
  const screen = document.querySelector("[data-screen='add-dish']");
  const inputs = screen.querySelectorAll("input");
  const name = inputs[0].value.trim();
  const category = inputs[1].value.trim() || "Tapas";
  const servings = Number(inputs[2].value.replace(",", ".")) || 1;
  const pvp = Number(inputs[3].value.replace("€", "").replace(",", ".")) || 0;
  if (!name || dishes.some((dish) => dish.name.toLowerCase() === name.toLowerCase())) return;
  dishes.push({
    id: name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"),
    name,
    category,
    servings,
    pvp,
    icon: "prawn",
    published: false,
    description: "",
    allergens: "Pendiente de revisar",
    recipe: [
      { ingredient: "ham", qty: 80 },
      { ingredient: "milk", qty: 250 },
      { ingredient: "flour", qty: 80 },
    ],
  });
  selectedDishId = dishes[dishes.length - 1].id;
  renderAll();
}

function applyRecommendedPrice() {
  const alert = oilAlert();
  const dish = alert.affected[0]?.dish || selectedDish();
  dish.pvp = suggestedPrice(dish);
  selectedDishId = dish.id;
  renderAll();
}

function renderAll() {
  renderHome();
  renderDetail();
  renderQr();
  renderIngredientAlert();
  renderAiPrice();
  renderPublicMenu();
}

function showScreen(name) {
  renderAll();
  screens.forEach((screen) => screen.classList.toggle("is-active", screen.dataset.screen === name));
  navButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.go === name));
  const primaryScreens = ["home", "qr"];
  const publicView = name === "public-menu";
  nav.style.display = primaryScreens.includes(name) && !publicView ? "grid" : "none";
  fab.style.display = primaryScreens.includes(name) && !publicView ? "block" : "none";
  shell.classList.toggle("nav-hidden", !primaryScreens.includes(name) || publicView);
  if (location.hash.slice(1) !== name) history.replaceState(null, "", `#${name}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button?.textContent.trim() === "Guardar plato") createDishFromForm();
  if (button?.textContent.trim() === "Aplicar nuevo precio" || button?.textContent.trim() === "Aplicar precios sugeridos") applyRecommendedPrice();

  const trigger = event.target.closest("[data-go]");
  if (!trigger) return;
  if (trigger.dataset.dishId) selectedDishId = trigger.dataset.dishId;
  showScreen(trigger.dataset.go);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const trigger = event.target.closest("[data-go]");
  if (!trigger) return;
  event.preventDefault();
  if (trigger.dataset.dishId) selectedDishId = trigger.dataset.dishId;
  showScreen(trigger.dataset.go);
});

document.addEventListener("click", (event) => {
  const option = event.target.closest(".language-row button, .category-tabs button");
  if (!option) return;
  [...option.parentElement.children].forEach((item) => item.classList.toggle("is-selected", item === option));
});

renderAll();
const initialScreen = location.hash.slice(1);
if (screens.some((screen) => screen.dataset.screen === initialScreen)) showScreen(initialScreen);
