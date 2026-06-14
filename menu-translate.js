/* menu-translate.js — Traducir la carta a EN/FR/DE con IA (Google Translate).
 *
 * Rellena dish.translations[lang] para que el switcher de idioma de la carta
 * pública muestre cada plato traducido. Cachea el resultado en localStorage
 * para no repetir llamadas en el mismo dispositivo.
 *
 * Nota: localStorage es por dispositivo. Para que las traducciones lleguen a
 * cualquier cliente que escanee el QR hay que persistirlas en Supabase
 * (columna dish.translations) — siguiente paso.
 *
 * Depende de globals: dishes, business, renderPublicMenu, showSync.
 * Carga DESPUÉS de script.js, render-engine.js y public-menu-i18n.js.
 */

const TRANSLATE_TARGETS = ["en", "fr", "de"];

function translationCacheKey() {
  const name = (typeof business !== "undefined" && business && business.name) ? business.name : "demo";
  return `escandalia:menu-translations:${name}`;
}

function loadCachedTranslations() {
  try {
    const raw = localStorage.getItem(translationCacheKey());
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function saveCachedTranslations(cache) {
  try {
    localStorage.setItem(translationCacheKey(), JSON.stringify(cache));
  } catch (error) {
    /* almacenamiento no disponible: seguimos solo en memoria */
  }
}

// Vuelca las traducciones guardadas sobre los platos actuales (por id).
function applyCachedTranslations() {
  if (typeof dishes === "undefined" || !Array.isArray(dishes)) return;
  const cache = loadCachedTranslations();
  dishes.forEach((dish) => {
    const cached = cache[dish.id];
    if (cached) dish.translations = { ...(dish.translations || {}), ...cached };
  });
}

function showTranslateStatus(message, busy) {
  const node = document.querySelector(".translate-status");
  if (!node) {
    if (typeof showSync === "function") showSync(message);
    return;
  }
  node.textContent = message;
  node.classList.toggle("is-busy", Boolean(busy));
  node.classList.remove("is-hidden");
}

async function requestMenuTranslation(publishedDishes, target) {
  const items = publishedDishes.map((dish) => ({
    name: dish.name,
    description: dish.description,
    allergens: dish.allergens,
  }));
  const res = await fetch("/api/translate-menu", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items, target }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "No se pudo traducir la carta.");
  return data.translations || [];
}

async function translateMenu() {
  if (typeof dishes === "undefined" || !Array.isArray(dishes)) return;
  const published = dishes.filter((dish) => dish.published);
  if (!published.length) {
    showTranslateStatus("No hay platos publicados que traducir.", false);
    return;
  }
  showTranslateStatus("Traduciendo la carta con IA…", true);
  try {
    const cache = loadCachedTranslations();
    for (const target of TRANSLATE_TARGETS) {
      const translations = await requestMenuTranslation(published, target);
      published.forEach((dish, index) => {
        const translated = translations[index] || {};
        dish.translations = dish.translations || {};
        dish.translations[target] = translated;
        cache[dish.id] = { ...(cache[dish.id] || {}), [target]: translated };
      });
    }
    saveCachedTranslations(cache);
    if (typeof renderPublicMenu === "function") renderPublicMenu();
    showTranslateStatus("Carta traducida a inglés, francés y alemán ✓", false);
  } catch (error) {
    console.error(error);
    showTranslateStatus(error.message || "Error al traducir la carta.", false);
  }
}

document.addEventListener("click", (event) => {
  if (event.target.closest(".translate-menu-trigger")) {
    event.preventDefault();
    translateMenu();
  }
});

applyCachedTranslations();
