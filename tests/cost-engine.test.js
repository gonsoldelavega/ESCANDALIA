#!/usr/bin/env node
/**
 * cost-engine.test.js — Tests mínimos de lógica de costes
 *
 * Ejecutar: node tests/cost-engine.test.js
 * Sin dependencias externas.
 */

// ============================================================
// 1. Setup: simular estado global que cost-engine.js espera
// ============================================================
const ingredients = {
  ing_patatas: { name: 'Patatas', unit: 'g', current: 0.00065, before: 0.00065 },
  ing_huevos:  { name: 'Huevos', unit: 'uds', current: 0.23, before: 0.23 },
  ing_aceite:  { name: 'Aceite de oliva', unit: 'ml', current: 0.00684, before: 0.00580 },
  ing_cebolla: { name: 'Cebolla', unit: 'g', current: 0.00080, before: 0.00080 },
  ing_gambas:  { name: 'Gambas', unit: 'g', current: 0.028, before: 0.028 },
  ing_ajo:     { name: 'Ajo', unit: 'g', current: 0.004, before: 0.004 },
};

const business = { targetMargin: 0.75 };

// Tortilla de patatas (receta realista)
const tortilla = {
  id: 'tortilla',
  name: 'Tortilla de patatas',
  servings: 1,
  pvp: 3,
  recipe: [
    { ingredient: 'ing_patatas', qty: 200 },
    { ingredient: 'ing_huevos', qty: 1.5 },
    { ingredient: 'ing_aceite', qty: 20 },
    { ingredient: 'ing_cebolla', qty: 50 },
  ],
};

const gambas = {
  id: 'gambas',
  name: 'Gambas al ajillo',
  servings: 1,
  pvp: 7.5,
  recipe: [
    { ingredient: 'ing_gambas', qty: 180 },
    { ingredient: 'ing_ajo', qty: 12 },
    { ingredient: 'ing_aceite', qty: 35 },
  ],
};

const platoVacio = { id: 'vacio', name: 'Sin receta', servings: 1, pvp: 0 };

// ============================================================
// 2. Cargar cost-engine.js (se ejecuta con globals simulados)
// ============================================================
const fs = require('fs');
const vm = require('vm');

const costEngineCode = fs.readFileSync('./cost-engine.js', 'utf8');
const sandbox = { ingredients, business };
vm.createContext(sandbox);
vm.runInContext(costEngineCode, sandbox);
const {
  baseRecipeCost, ingredientCost, unitCost, dishCost, dishMargin,
  formatCost, formatMargin, suggestedPrice, yieldCount,
  roundMoney, numberFromInput, currency, percent, marginClass,
  defaultFormats, primaryFormat, slugify,
} = sandbox;

// ============================================================
// 3. Tests
// ============================================================
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(actual, expected, label) {
  const a = typeof actual === 'number' ? Math.round(actual * 1e6) / 1e6 : actual;
  const e = typeof expected === 'number' ? Math.round(expected * 1e6) / 1e6 : expected;
  if (a !== e) throw new Error(`esperado ${JSON.stringify(e)}, recibido ${JSON.stringify(a)} — ${label || ''}`);
}

function assertClose(actual, expected, tolerance = 0.001) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`esperado ~${expected}, recibido ${actual}`);
  }
}

console.log('\n🧪 cost-engine.js — Suite de tests\n');
console.log('──────────────────────────────────────');

// --- Test 1: ingredientCost ---
test('ingredientCost: 200g patatas @ 0.00065 = 0.13', () => {
  assert(ingredientCost({ ingredient: 'ing_patatas', qty: 200 }), 0.13);
});

// --- Test 2: baseRecipeCost ---
test('baseRecipeCost: tortilla = 0.13 + 0.345 + 0.1368 + 0.04 = 0.6518', () => {
  assert(baseRecipeCost(tortilla), 0.6518);
});

test('baseRecipeCost: plato sin recipe = 0', () => {
  assert(baseRecipeCost(platoVacio), 0);
});

test('baseRecipeCost: dish null = 0', () => {
  assert(baseRecipeCost(null), 0);
});

// --- Test 3: yieldCount ---
test('yieldCount: tortilla servings=1 → 1', () => {
  assert(yieldCount(tortilla), 1);
});

test('yieldCount: servings=0 → 1 (fallback)', () => {
  assert(yieldCount({ servings: 0 }), 1);
});

test('yieldCount: sin servings → 1', () => {
  assert(yieldCount({}), 1);
});

// --- Test 4: unitCost ---
test('unitCost: 0.6518 / 1 = 0.6518', () => {
  assert(unitCost(tortilla), 0.6518);
});

test('unitCost: gambas, mode=current', () => {
  // 180*0.028 + 12*0.004 + 35*0.00684 = 5.04 + 0.048 + 0.2394 = 5.3274
  const expected = 5.3274;
  assert(unitCost(gambas), expected);
});

// --- Test 5: formatCost ---
test('formatCost: media racion (portions=2.5) = unitCost * 2.5', () => {
  const format = { id: 'media', name: 'Media racion', portions: 2.5, pvp: 3.5 };
  assert(formatCost(tortilla, format), 0.6518 * 2.5);
});

// --- Test 6: formatMargin ---
test('formatMargin: tapa pvp=3, cost=0.6518 → (3-0.6518)/3 = 0.7827', () => {
  const format = { id: 'tapa', name: 'Tapa', portions: 1, pvp: 3 };
  assertClose(formatMargin(tortilla, format), 0.7827);
});

// --- Test 7: dishCost (via primaryFormat) ---
test('dishCost: tortilla = 0.6518 (primary format portions=1)', () => {
  assert(dishCost(tortilla), 0.6518);
});

// --- Test 8: dishMargin ---
test('dishMargin: tortilla pvp=3 → 0.7827', () => {
  assertClose(dishMargin(tortilla), 0.7827);
});

// --- Test 9: suggestedPrice ---
test('suggestedPrice: tortilla target=75% → ceil((0.6518/0.25)*20)/20 = ceil(52.144)/20 = 2.65', () => {
  assertClose(suggestedPrice(tortilla, 0.75), 2.65, 0.01);
});

// --- Test 10: roundMoney ---
test('roundMoney: 1.234 → 1.23', () => {
  assert(roundMoney(1.234), 1.23);
});

test('roundMoney: 1.235 → 1.24', () => {
  assert(roundMoney(1.235), 1.24);
});

test('roundMoney: null → 0', () => {
  assert(roundMoney(null), 0);
});

// --- Test 11: numberFromInput ---
test('numberFromInput: "1,50€" → 1.5', () => {
  assert(numberFromInput('1,50€'), 1.5);
});

test('numberFromInput: "3.50" → 3.5', () => {
  assert(numberFromInput('3.50'), 3.5);
});

test('numberFromInput: texto inválido → fallback 0', () => {
  assert(numberFromInput('abc'), 0);
});

test('numberFromInput: vacío → fallback 0', () => {
  assert(numberFromInput(''), 0);
});

// --- Test 12: currency / percent ---
test('currency(0.6518) → "0,65€"', () => {
  assert(currency(0.6518), '0,65€');
});

test('percent(0.7827) → "78%"', () => {
  assert(percent(0.7827), '78%');
});

// --- Test 13: marginClass ---
test('marginClass(0.75) → "good-bg"', () => {
  assert(marginClass(0.75), 'good-bg');
});

test('marginClass(0.65) → "mid-bg"', () => {
  assert(marginClass(0.65), 'mid-bg');
});

test('marginClass(0.5) → "low-bg"', () => {
  assert(marginClass(0.5), 'low-bg');
});

// --- Test 14: defaultFormats ---
test('defaultFormats: tortilla pvp=3 → tapa {portions:1, pvp:3}', () => {
  const formats = defaultFormats(tortilla);
  assert(formats[0].id, 'tapa');
  assert(formats[0].pvp, 3);
});

test('defaultFormats: media racion pvp = round(3*2.2) = 6.60', () => {
  const formats = defaultFormats(tortilla);
  assert(formats[1].pvp, 6.60);
});

// --- Test 15: slugify ---
test('slugify: "Tortilla de patatas" → "tortilla-de-patatas"', () => {
  assert(slugify('Tortilla de patatas'), 'tortilla-de-patatas');
});

test('slugify: "Gambas al ajillo" → "gambas-al-ajillo"', () => {
  assert(slugify('Gambas al ajillo'), 'gambas-al-ajillo');
});

// ============================================================
// 4. Resultados
// ============================================================
console.log('\n──────────────────────────────────────');
console.log(`\n📊 Resultados: ${passed} passed, ${failed} failed de ${passed + failed} tests\n`);

process.exit(failed > 0 ? 1 : 0);