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
  return (ingredients[line.ingredient]?.[mode] || 0) * line.qty;
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
  return unitCost(dish, mode) * (Number(format?.portions) || 1);
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
  return Math.ceil((cost / (1 - target)) * 20) / 20;
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
  if (Array.isArray(dish?.formats) && dish.formats.length) return dish.formats;
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
  return value.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ==========================================================================
 * Profitability helpers (Sprint 1)
 * ========================================================================== */

/** Food cost %: coste / pvp (0..1). <30% excelente, <40% ok, >=40% alto */
function foodCostPct(dish, format = primaryFormat(dish)) {
  const pvp = Number(format?.pvp) || 0;
  if (pvp <= 0) return 0;
  return roundMoney(formatCost(dish, format) / pvp);
}

/** Margen en euros: pvp - coste */
function profitMarginEuros(dish, format = primaryFormat(dish)) {
  return roundMoney(Number(format?.pvp) - formatCost(dish, format));
}

/** Estado visual de rentabilidad */
function profitStatus(dish, format = primaryFormat(dish)) {
  const fc = foodCostPct(dish, format);
  if (fc <= 0.30) return 'rentable';
  if (fc <= 0.40) return 'revisar';
  return 'peligroso';
}

/** Clase CSS para el estado */
function profitStatusClass(status) {
  if (status === 'rentable') return 'profit-good';
  if (status === 'revisar') return 'profit-mid';
  return 'profit-bad';
}

/** Impacto mensual estimado: (precioRecomendado - pvpActual) * ventasSemana * 4 */
function monthlyImpact(dish, targetMargin, ventasSemana, format = primaryFormat(dish)) {
  const rec = suggestedPrice(dish, targetMargin, format);
  const current = Number(format?.pvp) || 0;
  return roundMoney((rec - current) * ventasSemana * 4);
}