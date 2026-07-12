/* ==========================================================================
 * menu-engineering.js — Análisis de carta (Menu Engineering).
 *
 * Cruza POPULARIDAD (unidades vendidas) con RENTABILIDAD (margen real) y
 * clasifica cada plato en los cuatro cuadrantes clásicos:
 *   ⭐ Estrella          — popular y rentable → mantener y destacar
 *   🐎 Caballo de batalla — popular pero poco rentable → subir PVP / bajar coste
 *   🧩 Puzzle            — rentable pero poco vendido → promocionar / reubicar
 *   🐕 Perro             — ni se vende ni deja margen → rediseñar o retirar
 *
 * Regla de popularidad estándar: un plato es "popular" si su cuota de ventas
 * alcanza al menos el 70% de la cuota media (1/N). Rentabilidad: por encima o
 * por debajo del margen real medio de la carta.
 *
 * Depende de: dishes, opsState (sales), realMargin, primaryFormat, realProfit,
 * currency, percent, escapeHtml, showScreen, activateDynamicScreen.
 * Carga DESPUÉS de ops-editable.js.
 * ========================================================================== */

function salesByDish() {
  const counts = {};
  (typeof opsState !== 'undefined' ? opsState.sales : []).forEach((sale) => {
    counts[sale.dishId] = (counts[sale.dishId] || 0) + (Number(sale.qty) || 0);
  });
  return counts;
}

const MENU_QUADRANTS = {
  star: { key: 'star', emoji: '⭐', label: 'Estrella', tip: 'Popular y rentable. Mantenlo tal cual y dale protagonismo en la carta.', cls: 'good-bg' },
  plow: { key: 'plow', emoji: '🐎', label: 'Caballo de batalla', tip: 'Se vende mucho pero deja poco margen. Sube ligeramente el PVP o baja el coste sin tocar la calidad.', cls: 'mid-bg' },
  puzzle: { key: 'puzzle', emoji: '🧩', label: 'Puzzle', tip: 'Buen margen pero se vende poco. Promociónalo, cámbialo de sitio en la carta o sugiérelo en sala.', cls: 'mid-bg' },
  dog: { key: 'dog', emoji: '🐕', label: 'Perro', tip: 'Ni se vende ni deja margen. Rediséñalo, cámbialo de receta o retíralo de la carta.', cls: 'low-bg' },
};

function classifyMenu() {
  const counts = salesByDish();
  const totalSold = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const items = dishes.map((dish) => {
    const format = primaryFormat(dish);
    const margin = realMargin(dish, format);
    const units = counts[dish.id] || 0;
    return { dish, format, margin, units, profit: realProfit(dish, format) };
  });
  const avgMargin = items.length ? items.reduce((sum, it) => sum + it.margin, 0) / items.length : 0;
  const popularityThreshold = items.length ? (1 / items.length) * 0.7 : 0;
  return items.map((item) => {
    const share = totalSold > 0 ? item.units / totalSold : 0;
    const popular = totalSold > 0 ? share >= popularityThreshold : null;
    const profitable = item.margin >= avgMargin;
    let quadrant;
    if (popular === null) quadrant = profitable ? 'puzzle' : 'dog';
    else if (popular && profitable) quadrant = 'star';
    else if (popular && !profitable) quadrant = 'plow';
    else if (!popular && profitable) quadrant = 'puzzle';
    else quadrant = 'dog';
    return { ...item, share, popular, profitable, quadrant };
  }).sort((a, b) => b.profit - a.profit);
}

function ensureMenuEngineeringScreen() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav || document.querySelector('[data-screen="menu-engineering"]')) return;
  nav.insertAdjacentHTML('beforebegin', `<section class="app-screen" data-screen="menu-engineering"><header class="hero hero-dark compact-hero"><div class="orb orb-rust"></div><button class="back" type="button" data-go="stats">← Volver</button><h1>Análisis de carta</h1><p>Qué destacar, qué subir de precio y qué retirar.</p></header><div class="content menu-eng-content"></div></section>`);
}

function renderMenuEngineering() {
  const content = document.querySelector('.menu-eng-content');
  if (!content) return;
  const items = classifyMenu();
  if (!items.length) {
    content.innerHTML = '<div class="empty-note">Añade platos para analizar tu carta.</div>';
    return;
  }
  const totalSold = items.reduce((sum, it) => sum + it.units, 0);
  const groups = { star: [], plow: [], puzzle: [], dog: [] };
  items.forEach((item) => groups[item.quadrant].push(item));
  const noSales = totalSold === 0;
  const counter = (key) => groups[key].length;
  const matrix = `<div class="menu-matrix">${['star', 'puzzle', 'plow', 'dog'].map((key) => {
    const q = MENU_QUADRANTS[key];
    return `<article class="menu-quadrant ${q.cls}"><div class="menu-quadrant-head"><span class="menu-emoji">${q.emoji}</span><div><strong>${q.label}</strong><em>${counter(key)} plato${counter(key) !== 1 ? 's' : ''}</em></div></div><div class="menu-quadrant-list">${groups[key].length ? groups[key].map((it) => `<span class="menu-chip" data-go="dish-detail" data-dish-id="${it.dish.id}" role="button" tabindex="0">${escapeHtml(it.dish.name)}</span>`).join('') : '<span class="menu-quadrant-empty">—</span>'}</div></article>`;
  }).join('')}</div>`;

  const banner = noSales
    ? '<div class="menu-banner">Aún no has registrado ventas: clasificamos solo por rentabilidad. Registra ventas del día en Estadísticas para activar el eje de popularidad.</div>'
    : '';

  const detailRows = items.map((it) => {
    const q = MENU_QUADRANTS[it.quadrant];
    return `<article class="menu-eng-row" data-go="dish-detail" data-dish-id="${it.dish.id}" role="button" tabindex="0"><div class="menu-eng-row-main"><span class="menu-eng-badge ${q.cls}">${q.emoji} ${q.label}</span><h3>${escapeHtml(it.dish.name)}</h3><p>${q.tip}</p></div><div class="menu-eng-row-metrics"><div><span>Margen real</span><strong>${percent(it.margin)}</strong></div><div><span>Ventas</span><strong>${noSales ? '—' : it.units}</strong></div><div><span>Beneficio/ud</span><strong>${currency(it.profit)}</strong></div></div></article>`;
  }).join('');

  content.innerHTML = `${banner}${matrix}<div class="section-title" style="margin-top:22px">Recomendaciones por plato</div>${detailRows}`;
}

// ── Enlace de entrada desde Estadísticas ─────────────────────────────
function ensureMenuEngineeringEntry() {
  const stats = document.querySelector('[data-screen="stats"] .stats-content');
  if (!stats || stats.querySelector('.menu-eng-entry')) return;
  const kpis = stats.querySelector('.stats-kpis');
  const entry = `<button class="menu-eng-entry" type="button" data-go="menu-engineering">📊 Análisis de carta<small>Estrellas, caballos de batalla y platos a retirar</small></button>`;
  if (kpis) kpis.insertAdjacentHTML('afterend', entry);
  else stats.insertAdjacentHTML('afterbegin', entry);
}

if (typeof showScreen === 'function') {
  const previousShowScreenMenu = showScreen;
  showScreen = function showScreenWithMenuEngineering(name) {
    previousShowScreenMenu(name);
    if (name === 'menu-engineering') {
      if (typeof activateDynamicScreen === 'function') activateDynamicScreen(name);
      renderMenuEngineering();
    }
    if (name === 'stats') ensureMenuEngineeringEntry();
  };
}

ensureMenuEngineeringScreen();
setTimeout(ensureMenuEngineeringEntry, 800);
