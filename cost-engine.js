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

/**
 * Factor de merma de un ingrediente (0..0.95). Una merma del 20% (pelado,
 * limpieza, recorte) significa que necesitas comprar más producto del que
 * acaba en el plato: factor = 1/(1-merma). Sin merma definida → factor 1.
 */
function wasteFactor(ingredientId) {
  const raw = Number(ingredients[ingredientId]?.waste) || 0;
  const safe = Math.min(Math.max(raw, 0), 0.95);
  return 1 / (1 - safe);
}

/** Coste de una línea de ingrediente (incluye merma si está definida) */
function ingredientCost(line, mode = 'current') {
  const qty = Number(line?.qty) || 0;
  const id = line?.ingredient;
  return (ingredients[id]?.[mode] || 0) * qty * wasteFactor(id);
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

/** Parseo seguro de input monetario (acepta €, formato español 1.234,56 y espacios) */
function numberFromInput(value, fallback = 0) {
  const normalized = String(value || '')
    .trim()
    .replace(/€|â‚¬/g, '')
    .replace(/\s/g, '');
  const decimalValue = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized;
  const parsed = Number(decimalValue);
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

/* ==========================================================================
 * Rentabilidad real (IVA + personal + costes indirectos)
 *
 * El "margen bruto" clásico (dishMargin/formatMargin) compara PVP con la
 * materia prima. La rentabilidad REAL de un plato descuenta además el IVA del
 * precio de carta, el coste de personal por ración y una parte de los gastos
 * fijos. Todas estas funciones son aditivas: con IVA 0, personal 0 y overhead
 * 0 devuelven exactamente el margen bruto de siempre.
 * ========================================================================== */

/** Tipo de IVA aplicable (por defecto 10% de hostelería en España). */
function businessTaxRate() {
  const raw = Number(business?.taxRate);
  return Number.isFinite(raw) && raw >= 0 ? raw : 0.10;
}

/** Ingreso neto de IVA a partir de un PVP de carta (que ya incluye IVA). */
function netRevenue(pvp) {
  const price = Number(pvp) || 0;
  return price / (1 + businessTaxRate());
}

/** Coste de personal imputado a una ración, según minutos de elaboración. */
function laborCost(dish) {
  const minutes = Number(dish?.laborMinutes) || 0;
  const perHour = Number(business?.laborRatePerHour) || 0;
  if (minutes <= 0 || perHour <= 0) return 0;
  return (minutes / 60) * perHour;
}

/** Costes indirectos imputados a un formato como % del ingreso neto. */
function overheadCost(dish, format = primaryFormat(dish)) {
  const rate = Number(business?.overheadRate) || 0;
  if (rate <= 0) return 0;
  return netRevenue(format?.pvp) * rate;
}

/** Coste real total de un formato: materia prima (con merma) + personal + indirectos. */
function realCost(dish, format = primaryFormat(dish)) {
  return formatCost(dish, format) + laborCost(dish) + overheadCost(dish, format);
}

/** Margen real (0..1): (ingreso neto − coste real) / ingreso neto. */
function realMargin(dish, format = primaryFormat(dish)) {
  const net = netRevenue(format?.pvp);
  if (net <= 0) return 0;
  return (net - realCost(dish, format)) / net;
}

/** Food cost % clásico: materia prima / ingreso neto. */
function foodCostPercent(dish, format = primaryFormat(dish)) {
  const net = netRevenue(format?.pvp);
  if (net <= 0) return 0;
  return formatCost(dish, format) / net;
}

/** Beneficio real en euros por ración vendida en este formato. */
function realProfit(dish, format = primaryFormat(dish)) {
  return netRevenue(format?.pvp) - realCost(dish, format);
}

/**
 * PVP recomendado teniendo en cuenta IVA, personal e indirectos para alcanzar
 * un margen NETO objetivo. Redondea al múltiplo de 0,05 superior.
 */
function suggestedPriceReal(dish, target = business?.targetMargin || 0.7, format = primaryFormat(dish)) {
  const rawTarget = Number(target);
  const safeTarget = Number.isFinite(rawTarget) ? Math.min(Math.max(rawTarget, 0), 0.95) : 0.7;
  const materia = formatCost(dish, format);
  const labor = laborCost(dish);
  const overheadRate = Number(business?.overheadRate) || 0;
  const tax = businessTaxRate();
  // net = (materia + labor) / (1 - target - overheadRate) ; pvp = net * (1+IVA)
  const denom = 1 - safeTarget - overheadRate;
  const net = denom > 0 ? (materia + labor) / denom : (materia + labor);
  const pvp = net * (1 + tax);
  return Math.ceil(pvp * 20) / 20;
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
