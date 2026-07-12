/* ==========================================================================
 * cost-engine.js — Pure cost logic (no DOM, no events, no side effects)
 *
 * Dependencies (globals):
 *   ingredients  — { [id]: { name, unit, current, before } }
 *   business     — { targetMargin }
 *
 * Load BEFORE script.js and product-actions.js.
 * ========================================================================== */

/** Coste base de un plato: suma de costes de ingredientes en una receta */
function baseRecipeCost(dish, mode = 'current') {
  return (dish?.recipe || []).reduce((total, line) => total + ingredientCost(line, mode), 0);
}

/** Coste de una línea de ingrediente */
function ingredientCost(line, mode = 'current') {
  const qty = Number(line?.qty) || 0;
  return (ingredients[line?.ingredient]?.[mode] || 0) * qty;
}

/** Coste unitario por ración */
function unitCost(dish, mode = 'current') {
  return baseRecipeCost(dish, mode) / yieldCount(dish);
}

/** Coste total del plato (vía formato principal) */
function dishCost(dish, mode = 'current') {
  return formatCost(dish, primaryFormat(dish), mode);
}

/** Margen bruto del plato (0..1) */
function dishMargin(dish, mode = 'current') {
  return formatMargin(dish, primaryFormat(dish), mode);
}

/** Coste de un formato específico (tapa, media, ración) */
function formatCost(dish, format, mode = 'current') {
  const portions = Number(format?.portions);
  return unitCost(dish, mode) * (Number.isFinite(portions) && portions > 0 ? portions : 1);
}

/** Margen de un formato específico (0..1) */
function formatMargin(dish, format, mode = 'current') {
  const pvp = Number(format?.pvp) || 0;
  const cost = formatCost(dish, format, mode);
  return pvp > 0 ? (pvp - cost) / pvp : 0;
}

/** Precio de venta sugerido para alcanzar un margen objetivo */
function suggestedPrice(dish, target = business?.targetMargin || 0.75, format = primaryFormat(dish)) {
  const cost = formatCost(dish, format);
  const rawTarget = Number(target);
  const safeTarget = Number.isFinite(rawTarget) ? Math.min(Math.max(rawTarget, 0), 0.95) : 0.75;
  return Math.ceil((cost / (1 - safeTarget)) * 20) / 20;
}

/** Número de raciones (mínimo 1) */
function yieldCount(dish) {
  return Math.max(Number(dish?.servings) || 1, 1);
}

/** Redondeo a 2 decimales */
function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Parseo seguro de input monetario (acepta € , → .) */
function numberFromInput(value, fallback = 0) {
  const parsed = Number(String(value || '').replace('€', '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Formato moneda: "1,23€" */
function currency(value) {
  return `${Number(value || 0).toFixed(2).replace('.', ',')}€`;
}

/** Formato porcentaje: "75%" */
function percent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

/** Clase CSS según nivel de margen */
function marginClass(margin) {
  if (margin >= 0.7) return 'good-bg';
  if (margin >= 0.62) return 'mid-bg';
  return 'low-bg';
}

/** Formatos por defecto de un plato */
function defaultFormats(dish) {
  const basePvp = Number(dish?.pvp) || 0;
  if (Array.isArray(dish?.formats) && dish.formats.length) {
    return dish.formats.map((format, index) => {
      const portions = Number(format?.portions);
      return {
        id: format?.id || `format-${index + 1}`,
        name: format?.name || `Formato ${index + 1}`,
        portions: Number.isFinite(portions) && portions > 0 ? portions : 1,
        pvp: roundMoney(format?.pvp),
      };
    });
  }
  return [
    { id: 'tapa', name: 'Tapa', portions: 1, pvp: basePvp },
    { id: 'media', name: 'Media racion', portions: 2.5, pvp: roundMoney(basePvp * 2.2) },
    { id: 'racion', name: 'Racion', portions: 4, pvp: roundMoney(basePvp * 3.5) },
  ];
}

/** Formato principal (el primero) */
function primaryFormat(dish) {
  return defaultFormats(dish)[0] || { id: 'tapa', name: 'Tapa', portions: 1, pvp: Number(dish?.pvp) || 0 };
}

/** Slugify: normaliza texto para IDs */
function slugify(value) {
  return String(value || '').toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

numberFromInput = function numberFromInput(value, fallback = 0) {
  const normalized = String(value || '')
    .trim()
    .replace(/€|â‚¬/g, '')
    .replace(/\s/g, '');
  const decimalValue = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized;
  const parsed = Number(decimalValue);
  return Number.isFinite(parsed) ? parsed : fallback;
};

currency = function currency(value) {
  return `${Number(value || 0).toFixed(2).replace('.', ',')}€`;
};

/** Escapa texto para insertarlo con seguridad dentro de innerHTML. */
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Genera un id a partir de un texto que no colisione con los ya usados. */
function uniqueId(base, existingIds = []) {
  const used = new Set(existingIds);
  let root = slugify(base);
  if (!root) root = 'item';
  if (!used.has(root)) return root;
  let index = 2;
  while (used.has(`${root}-${index}`)) index += 1;
  return `${root}-${index}`;
}

/** Convierte g/ml a su unidad de venta legible (kg/L) para mostrar/editar. */
function displayScale(unit) {
  return unit === 'g' || unit === 'ml' ? 1000 : 1;
}

/**
 * Normaliza la unidad de una compra a la unidad base con la que se calculan
 * los escandallos (g/ml) y su factor de conversión. Comprar 5 L a 40€ debe
 * quedar guardado como 0,008 €/ml, no como 8 €/L (que multiplicaría x1000 el
 * coste de cada receta que use ese ingrediente).
 */
function normalizePurchaseUnit(unit) {
  const u = String(unit || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (['kg', 'kgs', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(u)) return { base: 'g', factor: 1000 };
  if (['g', 'gr', 'grs', 'gramo', 'gramos'].includes(u)) return { base: 'g', factor: 1 };
  if (['l', 'lt', 'ltr', 'litro', 'litros'].includes(u)) return { base: 'ml', factor: 1000 };
  if (['ml', 'mililitro', 'mililitros', 'cc'].includes(u)) return { base: 'ml', factor: 1 };
  return { base: unit || 'uds', factor: 1 };
}
