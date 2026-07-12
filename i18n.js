/* ==========================================================================
 * i18n.js — Traducción real de la carta pública (ES / EN / FR).
 *
 * Cada plato puede llevar `translations: { EN:{name,description}, FR:{...} }`.
 * El selector de idioma de la carta pública cambia de verdad el contenido
 * mostrado, con recurso al español cuando falta una traducción. Incluye un
 * editor de traducciones en "Editar receta" y traducciones de ejemplo para los
 * platos semilla.
 *
 * Depende de: dishes, business, currency, escapeHtml, renderPublicMenu,
 * renderRecipeEditor, saveLocalState, selectedDish. Carga DESPUÉS de carta.js.
 * ========================================================================== */

let publicMenuLang = 'ES';

const CATEGORY_GLOSSARY = {
  Tapas: { EN: 'Tapas', FR: 'Tapas' },
  Bocadillos: { EN: 'Sandwiches', FR: 'Sandwichs' },
  Bebidas: { EN: 'Drinks', FR: 'Boissons' },
  Otros: { EN: 'Others', FR: 'Autres' },
  Postres: { EN: 'Desserts', FR: 'Desserts' },
};

const UI_STRINGS = {
  ES: { carta: 'Carta', pending: 'Descripción pendiente.', todas: 'Todas' },
  EN: { carta: 'Menu', pending: 'Description coming soon.', todas: 'All' },
  FR: { carta: 'Carte', pending: 'Description à venir.', todas: 'Tout' },
};

// Traducciones de ejemplo para los platos semilla (por nombre en español).
const SEED_TRANSLATIONS = {
  'Tortilla de patatas': {
    EN: { name: 'Spanish potato omelette', description: 'Juicy homemade omelette with slow-cooked potato and free-range egg.' },
    FR: { name: 'Tortilla de pommes de terre', description: 'Tortilla maison moelleuse, pomme de terre confite et œuf fermier.' },
  },
  'Gambas al ajillo': {
    EN: { name: 'Garlic prawns', description: 'Prawns sautéed with garlic, olive oil and a touch of chilli.' },
    FR: { name: 'Crevettes à l’ail', description: 'Crevettes sautées à l’ail, huile d’olive et pointe de piment.' },
  },
  'Ensalada mixta': {
    EN: { name: 'Mixed salad', description: 'Fresh lettuce, tomato, onion, olives and tuna.' },
    FR: { name: 'Salade mixte', description: 'Laitue fraîche, tomate, oignon, olives et thon.' },
  },
  'Croquetas de jamón': {
    EN: { name: 'Ham croquettes', description: 'Creamy homemade croquettes with Iberian ham.' },
    FR: { name: 'Croquettes au jambon', description: 'Croquettes maison crémeuses au jambon ibérique.' },
  },
};

function applySeedTranslations() {
  dishes.forEach((dish) => {
    const seed = SEED_TRANSLATIONS[dish.name];
    if (seed && !dish.translations) dish.translations = JSON.parse(JSON.stringify(seed));
  });
}

function dishText(dish, field) {
  if (publicMenuLang === 'ES') return dish[field] || '';
  const t = dish.translations?.[publicMenuLang];
  return (t && t[field]) || dish[field] || '';
}

function translateCategory(cat) {
  if (publicMenuLang === 'ES') return cat;
  return CATEGORY_GLOSSARY[cat]?.[publicMenuLang] || cat;
}

// ── Carta pública multilingüe (envuelve la de carta.js) ──────────────
if (typeof renderPublicMenu === 'function') {
  renderPublicMenu = function renderPublicMenuI18n() {
    const strings = UI_STRINGS[publicMenuLang] || UI_STRINGS.ES;
    const header = document.querySelector('.public-header h1');
    if (header) header.textContent = business.name;
    const subtitle = document.querySelector('.public-header p');
    if (subtitle) subtitle.textContent = strings.carta;
    const content = document.querySelector('[data-screen="public-menu"] .content');
    if (!content) return;
    const published = dishes.filter((dish) => dish.published);
    const categories = [...new Set(published.map((dish) => dish.category || 'Otros'))];
    const tabs = [UI_STRINGS.ES.todas, ...categories]; // valor interno "Todas" en ES
    if (typeof publicMenuCategory === 'undefined' || !tabs.includes(publicMenuCategory)) publicMenuCategory = UI_STRINGS.ES.todas;
    const activeCat = publicMenuCategory;
    const visible = published.filter((dish) => activeCat === UI_STRINGS.ES.todas || (dish.category || 'Otros') === activeCat);
    const items = visible.length
      ? visible.map((dish) => {
          const allergens = String(dish.allergens || '').split(/[,;·|/]| y /i).map((a) => a.trim()).filter(Boolean);
          const chips = allergens.length ? `<div class="menu-allergens">${allergens.map((a) => `<span class="allergen-chip">${escapeHtml(a)}</span>`).join('')}</div>` : '';
          return `<article class="menu-item"><div><h3>${escapeHtml(dishText(dish, 'name'))}</h3><p>${escapeHtml(dishText(dish, 'description') || strings.pending)}</p>${chips}</div><strong>${currency(dish.pvp)}</strong></article>`;
        }).join('')
      : `<div class="empty-note">—</div>`;
    const tabLabel = (cat) => (cat === UI_STRINGS.ES.todas ? strings.todas : translateCategory(cat));
    content.innerHTML = `<div class="category-tabs">${tabs.map((cat) => `<button class="${cat === activeCat ? 'is-selected' : ''}" type="button" data-public-category="${escapeHtml(cat)}">${escapeHtml(tabLabel(cat))}</button>`).join('')}</div>${items}`;
  };
}

// ── Selector de idioma de la carta pública ───────────────────────────
document.addEventListener('click', (event) => {
  const langBtn = event.target.closest('.public-header .language-row button, [data-screen="public-menu"] .language-row button');
  if (!langBtn) return;
  const lang = langBtn.textContent.trim().toUpperCase();
  if (!['ES', 'EN', 'FR'].includes(lang)) return;
  publicMenuLang = lang;
  [...langBtn.parentElement.children].forEach((b) => b.classList.toggle('is-selected', b === langBtn));
  if (typeof renderPublicMenu === 'function') renderPublicMenu();
});

// ── Editor de traducciones en "Editar receta" ────────────────────────
if (typeof renderRecipeEditor === 'function') {
  const prevRenderRecipeEditorI18n = renderRecipeEditor;
  renderRecipeEditor = function renderRecipeEditorWithI18n() {
    prevRenderRecipeEditorI18n();
    const dish = typeof selectedDish === 'function' ? selectedDish() : null;
    const list = document.querySelector('.edit-list');
    if (!dish || !list || list.querySelector('.i18n-card')) return;
    const t = dish.translations || {};
    list.insertAdjacentHTML('beforeend', `<div class="section-title">Traducción de la carta</div><article class="i18n-card"><div class="i18n-lang"><span class="i18n-flag">EN</span><label>Nombre<input class="i18n-name" data-lang="EN" value="${escapeHtml(t.EN?.name || '')}" placeholder="Nombre en inglés" /></label><label>Descripción<input class="i18n-desc" data-lang="EN" value="${escapeHtml(t.EN?.description || '')}" placeholder="Descripción en inglés" /></label></div><div class="i18n-lang"><span class="i18n-flag">FR</span><label>Nombre<input class="i18n-name" data-lang="FR" value="${escapeHtml(t.FR?.name || '')}" placeholder="Nombre en francés" /></label><label>Descripción<input class="i18n-desc" data-lang="FR" value="${escapeHtml(t.FR?.description || '')}" placeholder="Descripción en francés" /></label></div><p class="settings-hint">Se muestran en la carta pública al cambiar de idioma. Vacío = se usa el español.</p></article>`);
  };
}

// Capturar traducciones al guardar la receta.
if (typeof applyFormatChanges === 'function') {
  const prevApplyFormatChangesI18n = applyFormatChanges;
  applyFormatChanges = function applyFormatChangesWithI18n(dish) {
    prevApplyFormatChangesI18n(dish);
    const names = document.querySelectorAll('.i18n-name');
    if (!names.length) return;
    const translations = dish.translations || {};
    ['EN', 'FR'].forEach((lang) => {
      const name = document.querySelector(`.i18n-name[data-lang="${lang}"]`)?.value.trim() || '';
      const description = document.querySelector(`.i18n-desc[data-lang="${lang}"]`)?.value.trim() || '';
      if (name || description) translations[lang] = { name, description };
      else delete translations[lang];
    });
    dish.translations = translations;
  };
}

applySeedTranslations();
if (typeof renderAll === 'function') renderAll();
