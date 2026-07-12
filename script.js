let business = { name: "Bar El Rincón", slug: "barelrincón", ownerInitials: "JM", targetMargin: 0.75, languages: ["ES", "EN", "FR", "DE"], taxRate: 0.10, laborRatePerHour: 0, overheadRate: 0 };
let ingredients = {};
let dishes = [];
let selectedDishId = "";
let selectedIngredientId = "";
let supabase = null;
let session = null;
let businessId = null;
let useSupabase = false;

const ingredientSeed = [
  ["Patatas", "g", 0.00065, 0.00065], ["Huevos", "uds", 0.23, 0.23], ["Aceite de oliva", "ml", 0.00684, 0.0058], ["Cebolla", "g", 0.0008, 0.0008], ["Sal", "receta", 0.01, 0.01], ["Gambas", "g", 0.028, 0.028], ["Ajo", "g", 0.004, 0.004], ["Lechuga", "g", 0.003, 0.003], ["Atún", "g", 0.011, 0.011], ["Jamón", "g", 0.012, 0.012], ["Leche", "ml", 0.00124, 0.00124], ["Harina", "g", 0.0016, 0.0016]
];

const dishSeed = [
  { name: "Tortilla de patatas", category: "Tapas", servings: 1, pvp: 3, icon: "egg", published: true, description: "Jugosa tortilla casera con patata pochada y huevo de corral.", allergens: "Contiene huevo", recipe: [["Patatas", 200], ["Huevos", 1.5], ["Aceite de oliva", 20], ["Cebolla", 50], ["Sal", 1]] },
  { name: "Gambas al ajillo", category: "Tapas", servings: 1, pvp: 7.5, icon: "prawn", published: true, description: "Gambas salteadas con ajo, aceite de oliva y un punto de guindilla.", allergens: "Marisco", recipe: [["Gambas", 180], ["Ajo", 12], ["Aceite de oliva", 35]] },
  { name: "Ensalada mixta", category: "Tapas", servings: 1, pvp: 5, icon: "olive-thumb", published: true, description: "Lechuga fresca, tomate, cebolla, aceitunas y atún.", allergens: "Disponible hoy", recipe: [["Lechuga", 180], ["Atún", 95], ["Aceite de oliva", 22], ["Cebolla", 40]] },
  { name: "Croquetas de jamón", category: "Tapas", servings: 6, pvp: 3, icon: "prawn", published: false, description: "", allergens: "Contiene gluten y leche", recipe: [["Jamón", 80], ["Leche", 250], ["Harina", 80], ["Aceite de oliva", 28]] }
];

const screens = [...document.querySelectorAll(".app-screen")];
const navButtons = [...document.querySelectorAll(".bottom-nav button")];
const nav = document.querySelector(".bottom-nav");
const fab = document.querySelector(".fab");
const shell = document.querySelector(".phone-shell");

/* slugify moved to cost-engine.js */
function selectedDish() { return dishes.find((dish) => dish.id === selectedDishId) || dishes[0]; }
function getCostAlerts() {
  return Object.entries(ingredients)
    .filter(([, ing]) => ing.before > 0 && ing.current > ing.before)
    .map(([id, ing]) => {
      const rise = (ing.current - ing.before) / ing.before;
      const affected = dishes
        .map((dish) => ({ dish, before: dishMargin(dish, "before"), current: dishMargin(dish), suggested: suggestedPrice(dish) }))
        .filter((item) => item.dish.recipe.some((line) => line.ingredient === id) && item.current < business.targetMargin);
      return { ingredientId: id, ingredient: ing, rise, affected };
    })
    .filter((a) => a.affected.length > 0)
    .sort((a, b) => b.affected.length - a.affected.length);
}

function oilAlert() {
  const alerts = getCostAlerts();
  const oilId = Object.keys(ingredients).find((id) => ingredients[id].name === "Aceite de oliva");
  const entry = alerts.find((a) => a.ingredientId === oilId) || alerts[0];
  return entry ? { rise: entry.rise, affected: entry.affected } : { rise: 0, affected: [] };
}

function showSync(message) {
  let note = document.querySelector(".sync-note");
  if (!note) { note = document.createElement("div"); note.className = "sync-note is-hidden"; document.body.appendChild(note); }
  note.textContent = message;
  note.classList.remove("is-hidden");
  clearTimeout(showSync.timer);
  showSync.timer = setTimeout(() => note.classList.add("is-hidden"), 2600);
}

function renderAuthOverlay(message = "") {
  let overlay = document.querySelector(".auth-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "auth-overlay";
    overlay.innerHTML = `<section class="auth-panel"><div class="auth-head"><div class="auth-logo">Escan<span>d</span>alia</div><h2>Accede a tu bar</h2><p>Guarda platos, ingredientes y márgenes en la nube.</p></div><div class="auth-body"><label>Email<input class="auth-email" type="email" autocomplete="email" placeholder="tu@email.com" /></label><label>Contraseña<input class="auth-password" type="password" autocomplete="current-password" placeholder="Mínimo 6 caracteres" /></label><div class="auth-actions"><button class="primary-button auth-login" type="button">Entrar</button><button class="secondary-button auth-signup" type="button">Crear cuenta</button></div><p class="auth-message"></p></div></section>`;
    document.body.appendChild(overlay);
  }
  overlay.querySelector(".auth-message").textContent = message;
}

function hideAuthOverlay() { document.querySelector(".auth-overlay")?.remove(); }
function renderSessionChip() {
  document.querySelector(".session-chip")?.remove();
  if (!session?.user) return;
  const chip = document.createElement("div");
  chip.className = "session-chip";
  chip.innerHTML = `<span>Conectado a <strong>Supabase</strong></span><button type="button" class="logout-button">Salir</button>`;
  document.body.appendChild(chip);
}

async function initSupabase() {
  try {
    const config = await fetch("/api/config", { cache: "no-store" }).then((res) => res.json());
    if (!config.connected) throw new Error("Faltan variables de Supabase en Vercel.");
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    useSupabase = true;
    const result = await supabase.auth.getSession();
    session = result.data.session;
    supabase.auth.onAuthStateChange(async (_event, nextSession) => { session = nextSession; await bootData(); });
  } catch (error) {
    console.warn(error);
    seedLocalFallback();
  }
}

const LOCAL_STATE_KEY = "escandalia.local.v1";

/** Guarda el estado en el navegador cuando se trabaja sin sesión de Supabase. */
function saveLocalState() {
  if (useSupabase) return;
  try {
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify({ business, ingredients, dishes, selectedDishId }));
  } catch (error) {
    /* localStorage puede fallar en modo privado; no bloquea la app. */
  }
}

/** Recupera el estado local guardado. Devuelve true si lo aplicó. */
function loadLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_STATE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.dishes) || !saved.ingredients) return false;
    business = { ...business, ...saved.business };
    ingredients = saved.ingredients;
    dishes = saved.dishes;
    selectedDishId = dishes.some((dish) => dish.id === saved.selectedDishId) ? saved.selectedDishId : dishes[0]?.id || "";
    return true;
  } catch (error) {
    return false;
  }
}

function seedLocalFallback() {
  useSupabase = false;
  if (loadLocalState()) return;
  const byName = Object.fromEntries(ingredientSeed.map(([name, unit, current, before]) => [name, slugify(name)]));
  ingredients = Object.fromEntries(ingredientSeed.map(([name, unit, current, before]) => [byName[name], { name, unit, current, before }]));
  dishes = dishSeed.map((dish) => ({ ...dish, id: slugify(dish.name), recipe: dish.recipe.map(([name, qty]) => ({ ingredient: byName[name], qty })) }));
  selectedDishId = dishes[0]?.id || "";
}

async function ensureSeedData() {
  const { data: existingBusiness } = await supabase.from("businesses").select("id").limit(1).maybeSingle();
  if (existingBusiness?.id) return;
  const { data: createdBusiness, error: businessError } = await supabase.from("businesses").insert({ owner_id: session.user.id, name: business.name, slug: business.slug, target_margin: business.targetMargin }).select("id").single();
  if (businessError) throw businessError;
  const createdIngredients = [];
  for (const [name, unit, current, before] of ingredientSeed) {
    const { data, error } = await supabase.from("ingredients").insert({ business_id: createdBusiness.id, name, unit, current_cost: current, previous_cost: before }).select("id,name").single();
    if (error) throw error;
    createdIngredients.push(data);
  }
  const ingredientIds = Object.fromEntries(createdIngredients.map((item) => [item.name, item.id]));
  for (const dish of dishSeed) {
    const { data: createdDish, error } = await supabase.from("dishes").insert({ business_id: createdBusiness.id, name: dish.name, category: dish.category, servings: dish.servings, pvp: dish.pvp, published: dish.published, description: dish.description, allergens: dish.allergens, image_key: dish.icon }).select("id").single();
    if (error) throw error;
    const lines = dish.recipe.map(([name, qty], index) => ({ dish_id: createdDish.id, ingredient_id: ingredientIds[name], quantity: qty, sort_order: index }));
    const { error: lineError } = await supabase.from("dish_ingredients").insert(lines);
    if (lineError) throw lineError;
  }
  await supabase.from("menu_languages").insert(business.languages.map((language_code) => ({ business_id: createdBusiness.id, language_code, is_active: true })));
}

async function loadFromSupabase() {
  const { data: biz, error: bizError } = await supabase.from("businesses").select("id,name,slug,target_margin").limit(1).single();
  if (bizError) throw bizError;
  businessId = biz.id;
  business = { ...business, name: biz.name, slug: biz.slug, targetMargin: Number(biz.target_margin) };
  const { data: ing, error: ingError } = await supabase.from("ingredients").select("id,name,unit,current_cost,previous_cost").eq("business_id", businessId).order("name");
  if (ingError) throw ingError;
  ingredients = Object.fromEntries(ing.map((item) => [item.id, { name: item.name, unit: item.unit, current: Number(item.current_cost), before: Number(item.previous_cost ?? item.current_cost) }]));
  const { data: rows, error: dishError } = await supabase.from("dishes").select("id,name,category,servings,pvp,published,description,allergens,image_key,dish_ingredients(quantity,sort_order,ingredient_id)").eq("business_id", businessId).order("created_at");
  if (dishError) throw dishError;
  dishes = rows.map((dish) => ({ id: dish.id, name: dish.name, category: dish.category, servings: Number(dish.servings), pvp: Number(dish.pvp), icon: dish.image_key || "olive-thumb", published: dish.published, description: dish.description || "", allergens: dish.allergens || "", recipe: [...(dish.dish_ingredients || [])].sort((a, b) => a.sort_order - b.sort_order).map((line) => ({ ingredient: line.ingredient_id, qty: Number(line.quantity) })) }));
  selectedDishId = dishes.some((dish) => dish.id === selectedDishId) ? selectedDishId : dishes[0]?.id;
}

async function bootData() {
  if (!useSupabase) { seedLocalFallback(); renderAll(); return; }
  if (!session) { seedLocalFallback(); renderAll(); renderAuthOverlay(); renderSessionChip(); return; }
  hideAuthOverlay();
  renderSessionChip();
  try {
    await ensureSeedData();
    await loadFromSupabase();
    showSync("Datos sincronizados con Supabase");
  } catch (error) {
    console.error(error);
    showSync("No se pudo leer Supabase. Revisa RLS o el SQL.");
  }
  renderAll();
}

// ─── Render Engine ──────────────────────────────────────────────────
// Functions: renderHome, renderDetail, renderQr, renderIngredientAlert,
//            renderAiPrice, renderPublicMenu
// moved to render-engine.js (loaded before this file).
// renderAll() and showScreen() remain here as orchestrators.

function renderAll() {
  renderHome();
  renderDetail();
  renderQr();
  renderIngredientAlert();
  renderAiPrice();
  renderPublicMenu();
  if (typeof renderIngredientList === "function") renderIngredientList();
  if (typeof renderIngredientEdit === "function") renderIngredientEdit();
  saveLocalState();
}

function showScreen(name) {
  renderAll();
  screens.forEach((screen) => screen.classList.toggle("is-active", screen.dataset.screen === name));
  const navTarget = { "add-dish": "dish-detail", "edit-recipe": "dish-detail", "ai-price": "dish-detail", "ingredient-edit": "ingredient-list", "ingredient-alert": "ingredient-list", "ingredient-costs": "ingredient-list", "purchases": "stats" }[name] || name;
  navButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.go === navTarget));
  const publicView = name === "public-menu";
  nav.style.display = publicView ? "none" : "grid";
  fab.style.display = name === "home" ? "block" : "none";
  shell.classList.toggle("nav-hidden", publicView);
  if (location.hash.slice(1) !== name) history.replaceState(null, "", `#${name}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function createDishFromForm() {
  const inputs = document.querySelectorAll("[data-screen='add-dish'] input");
  const name = inputs[0].value.trim();
  const category = inputs[1].value.trim() || "Tapas";
  const servings = Number(inputs[2].value.replace(",", ".")) || 1;
  const pvp = Number(inputs[3].value.replace("€", "").replace(",", ".")) || 0;
  if (!name || dishes.some((dish) => dish.name.toLowerCase() === name.toLowerCase())) return;
  const baseIngredientNames = ["Jamón", "Leche", "Harina"];
  const recipe = baseIngredientNames.map((name) => ({ ingredient: Object.keys(ingredients).find((id) => ingredients[id].name === name), qty: name === "Leche" ? 250 : 80 })).filter((line) => line.ingredient);
  if (useSupabase && session) {
    const { data, error } = await supabase.from("dishes").insert({ business_id: businessId, name, category, servings, pvp, published: false, description: "", allergens: "Pendiente de revisar", image_key: "prawn" }).select("id").single();
    if (error) return showSync(error.message);
    await supabase.from("dish_ingredients").insert(recipe.map((line, index) => ({ dish_id: data.id, ingredient_id: line.ingredient, quantity: line.qty, sort_order: index })));
    selectedDishId = data.id;
    await loadFromSupabase();
  } else {
    const id = slugify(name); dishes.push({ id, name, category, servings, pvp, icon: "prawn", published: false, description: "", allergens: "Pendiente de revisar", recipe }); selectedDishId = id;
  }
  renderAll(); showSync("Plato guardado");
}

async function saveIngredientPrice(ingId, displayPrice) {
  const ing = ingredients[ingId];
  if (!ing) return;
  const parsed = parseFloat(String(displayPrice).replace(",", "."));
  if (isNaN(parsed) || parsed <= 0) return showSync("Introduce un precio válido");
  const newPrice = (ing.unit === "g" || ing.unit === "ml") ? parsed / 1000 : parsed;
  ing.before = ing.current;
  ing.current = newPrice;
  if (useSupabase && session) {
    const { error } = await supabase.from("ingredients").update({ current_cost: newPrice, previous_cost: ing.before }).eq("id", ingId);
    if (error) return showSync(error.message);
  }
  renderAll();
  showSync(`${ing.name} actualizado`);
}

async function applyRecommendedPrice() {
  // Deprecated/delegation candidate: apply-price-action.js is the planned owner
  // for the full apply recommended price flow.
  if (typeof applyRecommendedPriceFromCurrentContext === "function") {
    return applyRecommendedPriceFromCurrentContext();
  }
  const dish = oilAlert().affected[0]?.dish || selectedDish(); if (!dish) return;
  dish.pvp = suggestedPrice(dish); selectedDishId = dish.id;
  if (useSupabase && session) await supabase.from("dishes").update({ pvp: dish.pvp }).eq("id", dish.id);
  renderAll(); showSync("Precio actualizado");
}

document.addEventListener("click", async (event) => {
  const authButton = event.target.closest(".auth-login,.auth-signup,.logout-button");
  if (authButton) {
    if (authButton.classList.contains("logout-button")) { await supabase.auth.signOut(); return; }
    const email = document.querySelector(".auth-email")?.value.trim();
    const password = document.querySelector(".auth-password")?.value;
    if (!email || !password) return renderAuthOverlay("Introduce email y contraseña.");
    const action = authButton.classList.contains("auth-signup") ? supabase.auth.signUp({ email, password }) : supabase.auth.signInWithPassword({ email, password });
    const { error } = await action;
    if (error) renderAuthOverlay(error.message); else renderAuthOverlay("Revisa tu email si Supabase pide confirmación. Si no, entrarás en unos segundos.");
    return;
  }
  const button = event.target.closest("button");
  const action = button?.dataset.action;
  if (action === "save-dish" || button?.textContent.trim() === "Guardar plato") await createDishFromForm();
  if (button?.textContent.trim() === "Aplicar nuevo precio" || button?.textContent.trim() === "Aplicar precios sugeridos") await applyRecommendedPrice();
  if (action === "save-ingredient-price") {
    const input = document.querySelector(".ing-price-input");
    await saveIngredientPrice(selectedIngredientId, input?.value);
    showScreen("ingredient-list");
    return;
  }
  const trigger = event.target.closest("[data-go]");
  if (!trigger) return;
  if (trigger.dataset.dishId) selectedDishId = trigger.dataset.dishId;
  if (trigger.dataset.ingId) selectedIngredientId = trigger.dataset.ingId;
  showScreen(trigger.dataset.go);
});

document.addEventListener("keydown", (event) => { if (event.key !== "Enter" && event.key !== " ") return; const trigger = event.target.closest("[data-go]"); if (!trigger) return; event.preventDefault(); if (trigger.dataset.dishId) selectedDishId = trigger.dataset.dishId; showScreen(trigger.dataset.go); });
document.addEventListener("click", (event) => { const option = event.target.closest(".language-row button, .category-tabs button"); if (!option) return; [...option.parentElement.children].forEach((item) => item.classList.toggle("is-selected", item === option)); });

(async function start() { seedLocalFallback(); renderAll(); await initSupabase(); await bootData(); const initialScreen = location.hash.slice(1); if (screens.some((screen) => screen.dataset.screen === initialScreen)) showScreen(initialScreen); })();
