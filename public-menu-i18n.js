/* Public QR menu — multilingual layer.
 *
 * Lets a diner switch the public carta between ES / EN / FR / DE.
 * - Static chrome (subtitle, category tabs, fallbacks) comes from MENU_UI.
 * - Dish text is resolved by translateDish(): it prefers a per-dish translation
 *   (dish.translations[lang], to be filled later by AI or by hand), then a
 *   built-in translation for the demo dishes, and finally falls back to the
 *   original Spanish so the menu never renders empty.
 *
 * Loaded before script.js so the globals exist when the first render runs.
 */

const MENU_LANGS = ['es', 'en', 'fr', 'de'];
let menuLang = 'es';

const MENU_UI = {
  es: { subtitle: 'Carta', descPending: 'Descripción pendiente.', categories: { Tapas: 'Tapas', Bocadillos: 'Bocadillos', Bebidas: 'Bebidas' } },
  en: { subtitle: 'Menu', descPending: 'Description coming soon.', categories: { Tapas: 'Tapas', Bocadillos: 'Sandwiches', Bebidas: 'Drinks' } },
  fr: { subtitle: 'Carte', descPending: 'Description à venir.', categories: { Tapas: 'Tapas', Bocadillos: 'Sandwichs', Bebidas: 'Boissons' } },
  de: { subtitle: 'Speisekarte', descPending: 'Beschreibung folgt.', categories: { Tapas: 'Tapas', Bocadillos: 'Sandwiches', Bebidas: 'Getränke' } },
};

// Built-in translations for the demo dishes so the carta demos fully in 4
// languages. Real bars' dishes use dish.translations (Fase 2: traducir con IA).
const DISH_TRANSLATIONS = {
  'Tortilla de patatas': {
    en: { name: 'Spanish Potato Omelette', description: 'Juicy homemade omelette with slow-cooked potato and free-range egg.', allergens: 'Contains egg' },
    fr: { name: 'Tortilla de pommes de terre', description: 'Omelette maison moelleuse aux pommes de terre confites et œufs fermiers.', allergens: 'Contient des œufs' },
    de: { name: 'Spanisches Kartoffelomelett', description: 'Saftiges hausgemachtes Omelett mit confierten Kartoffeln und Freilandei.', allergens: 'Enthält Ei' },
  },
  'Gambas al ajillo': {
    en: { name: 'Garlic Prawns', description: 'Prawns sautéed with garlic, olive oil and a touch of chilli.', allergens: 'Shellfish' },
    fr: { name: "Gambas à l'ail", description: "Gambas sautées à l'ail, huile d'olive et une pointe de piment.", allergens: 'Crustacés' },
    de: { name: 'Knoblauchgarnelen', description: 'In Knoblauch, Olivenöl und etwas Chili gebratene Garnelen.', allergens: 'Schalentiere' },
  },
  'Ensalada mixta': {
    en: { name: 'Mixed Salad', description: 'Fresh lettuce, tomato, onion, olives and tuna.', allergens: 'Available today' },
    fr: { name: 'Salade mixte', description: 'Laitue fraîche, tomate, oignon, olives et thon.', allergens: "Disponible aujourd'hui" },
    de: { name: 'Gemischter Salat', description: 'Frischer Kopfsalat, Tomate, Zwiebel, Oliven und Thunfisch.', allergens: 'Heute verfügbar' },
  },
  'Croquetas de jamón': {
    en: { name: 'Ham Croquettes', description: '', allergens: 'Contains gluten and milk' },
    fr: { name: 'Croquettes de jambon', description: '', allergens: 'Contient gluten et lait' },
    de: { name: 'Schinkenkroketten', description: '', allergens: 'Enthält Gluten und Milch' },
  },
};

function menuUi(lang = menuLang) {
  return MENU_UI[lang] || MENU_UI.es;
}

// Returns { name, description, allergens } for a dish in the active language,
// always falling back to the original value so nothing renders blank.
function translateDish(dish, lang = menuLang) {
  const base = { name: dish.name, description: dish.description, allergens: dish.allergens };
  if (lang === 'es') return base;
  const stored = dish.translations && dish.translations[lang];
  const demo = DISH_TRANSLATIONS[dish.name] && DISH_TRANSLATIONS[dish.name][lang];
  const source = stored || demo;
  if (!source) return base;
  return {
    name: source.name || base.name,
    description: source.description || base.description,
    allergens: source.allergens || base.allergens,
  };
}

function setMenuLanguage(lang) {
  if (!MENU_LANGS.includes(lang) || lang === menuLang) return;
  menuLang = lang;
  if (typeof renderPublicMenu === 'function') renderPublicMenu();
}

const LANG_LABEL_TO_CODE = { ES: 'es', EN: 'en', FR: 'fr', DE: 'de' };

// A diner tapping a flag on the public carta switches the whole menu language.
document.addEventListener('click', (event) => {
  const button = event.target.closest('.language-row button');
  if (!button) return;
  const code = LANG_LABEL_TO_CODE[button.textContent.trim().toUpperCase()];
  if (code) setMenuLanguage(code);
});
