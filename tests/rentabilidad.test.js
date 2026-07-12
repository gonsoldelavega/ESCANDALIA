#!/usr/bin/env node
/**
 * rentabilidad.test.js — Tests de rentabilidad real (merma, IVA, personal,
 * costes indirectos). Ejecutar: node tests/rentabilidad.test.js
 */
const fs = require('fs');
const vm = require('vm');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}: ${e.message}`); failed++; }
}
function close(actual, expected, tol = 0.001, label = '') {
  if (Math.abs(actual - expected) > tol) throw new Error(`esperado ~${expected}, recibido ${actual} ${label}`);
}

function loadEngine(business, ingredients) {
  const sandbox = { business, ingredients };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('./cost-engine.js', 'utf8'), sandbox);
  return sandbox;
}

console.log('\n🧪 rentabilidad.js — merma, IVA, personal, indirectos\n');
console.log('──────────────────────────────────────');

// ── Merma ────────────────────────────────────────────────────────────
test('merma 0 no cambia el coste (compatibilidad)', () => {
  const s = loadEngine({ targetMargin: 0.75 }, { p: { name: 'P', unit: 'g', current: 0.001 } });
  close(s.ingredientCost({ ingredient: 'p', qty: 100 }), 0.1);
});

test('merma 20% eleva el coste efectivo: 0.1 → 0.125', () => {
  const s = loadEngine({ targetMargin: 0.75 }, { p: { name: 'P', unit: 'g', current: 0.001, waste: 0.2 } });
  close(s.ingredientCost({ ingredient: 'p', qty: 100 }), 0.125);
});

test('merma se topa en 0.95 (no divide por 0)', () => {
  const s = loadEngine({ targetMargin: 0.75 }, { p: { name: 'P', unit: 'g', current: 0.001, waste: 1.5 } });
  const c = s.ingredientCost({ ingredient: 'p', qty: 100 });
  if (!Number.isFinite(c)) throw new Error('coste no finito');
});

// ── IVA ──────────────────────────────────────────────────────────────
test('netRevenue descuenta el IVA (10€ con IVA 10% → 9.09€)', () => {
  const s = loadEngine({ taxRate: 0.10 }, {});
  close(s.netRevenue(10), 9.0909, 0.001);
});

test('taxRate por defecto 10% si no se define', () => {
  const s = loadEngine({}, {});
  close(s.businessTaxRate(), 0.10);
});

test('taxRate 0 respeta el PVP como neto', () => {
  const s = loadEngine({ taxRate: 0 }, {});
  close(s.netRevenue(10), 10);
});

// ── Personal e indirectos ────────────────────────────────────────────
const dishBase = { id: 'd', name: 'Plato', servings: 1, pvp: 10, laborMinutes: 6, recipe: [{ ingredient: 'p', qty: 100 }] };

test('laborCost: 6 min a 12€/h = 1.20€', () => {
  const s = loadEngine({ laborRatePerHour: 12 }, { p: { name: 'P', unit: 'g', current: 0.001 } });
  close(s.laborCost(dishBase), 1.2);
});

test('laborCost 0 si no hay tarifa', () => {
  const s = loadEngine({}, { p: { name: 'P', unit: 'g', current: 0.001 } });
  close(s.laborCost(dishBase), 0);
});

test('realMargin < margen bruto cuando hay IVA y personal', () => {
  const ings = { p: { name: 'P', unit: 'g', current: 0.001 } };
  const s = loadEngine({ taxRate: 0.10, laborRatePerHour: 12, overheadRate: 0.1, targetMargin: 0.7 }, ings);
  const format = s.primaryFormat(dishBase);
  const bruto = s.formatMargin(dishBase, format);
  const real = s.realMargin(dishBase, format);
  if (!(real < bruto)) throw new Error(`real ${real} debería ser < bruto ${bruto}`);
});

test('realMargin == margen bruto con IVA/personal/overhead a 0', () => {
  const ings = { p: { name: 'P', unit: 'g', current: 0.001 } };
  const s = loadEngine({ taxRate: 0, laborRatePerHour: 0, overheadRate: 0 }, ings);
  const format = s.primaryFormat(dishBase);
  close(s.realMargin(dishBase, format), s.formatMargin(dishBase, format), 1e-9);
});

test('suggestedPriceReal alcanza el margen neto objetivo', () => {
  const ings = { p: { name: 'P', unit: 'g', current: 0.001 } };
  const s = loadEngine({ taxRate: 0.10, laborRatePerHour: 12, overheadRate: 0.1, targetMargin: 0.6 }, ings);
  const format = { id: 'tapa', name: 'Tapa', portions: 1, pvp: 0 };
  const price = s.suggestedPriceReal(dishBase, 0.6, format);
  const achieved = s.realMargin(dishBase, { ...format, pvp: price });
  if (achieved < 0.6 - 0.02) throw new Error(`margen ${achieved} por debajo del objetivo 0.6`);
});

test('foodCostPercent: materia/ingreso neto', () => {
  const ings = { p: { name: 'P', unit: 'g', current: 0.001 } };
  const s = loadEngine({ taxRate: 0.10 }, ings);
  const format = s.primaryFormat(dishBase); // pvp 10 → neto 9.09; materia 0.1
  close(s.foodCostPercent(dishBase, format), 0.1 / 9.0909, 0.001);
});

console.log('\n──────────────────────────────────────');
console.log(`\n📊 Resultados: ${passed} passed, ${failed} failed de ${passed + failed} tests\n`);
process.exit(failed > 0 ? 1 : 0);
