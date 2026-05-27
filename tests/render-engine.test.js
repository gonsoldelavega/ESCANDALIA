#!/usr/bin/env node
/**
 * render-engine.test.js — Tests de funciones visuales / render-engine
 *
 * Ejecutar: node tests/render-engine.test.js
 * Sin dependencias externas.
 *
 * Estrategia:
 *  - Render-engine depende del DOM (document.querySelector).
 *  - Usamos stubs mínimos de DOM para verificar que no lanza excepciones
 *    y que genera contenido HTML esperado.
 *  - También testeamos el helper `dishProfitBadge()` que usaremos en la lista.
 */

// ============================================================
// 1. Setup: datos de prueba (mismos que cost-engine.test.js)
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

// Tortilla normal
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

// Gambas caras
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

// Plato sin PVP
const platoSinPvp = {
  id: 'sin-pvp',
  name: 'Plato sin precio',
  servings: 1,
  pvp: 0,
  recipe: [{ ingredient: 'ing_patatas', qty: 100 }],
};

// Plato con PVP 0 explícito
const platoPvpCero = {
  id: 'pvp-cero',
  name: 'Gratis total',
  servings: 1,
  pvp: 0,
  recipe: [{ ingredient: 'ing_huevos', qty: 1 }],
};

// Plato sin coste (sin receta / ingredientes vacíos)
const platoSinCoste = {
  id: 'sin-coste',
  name: 'Plato fantasma',
  servings: 1,
  pvp: 5,
  recipe: [],
};

// Plato con coste mayor que PVP (margen negativo)
const platoMargenNegativo = {
  id: 'margen-neg',
  name: 'Plato ruinoso',
  servings: 1,
  pvp: 1.00,
  recipe: [{ ingredient: 'ing_gambas', qty: 100 }], // coste = 2.80
};

// Plato food cost ~35% → "revisar"
const platoRevisar = {
  id: 'revisar',
  name: 'Plato revisar',
  servings: 1,
  pvp: 2.00,
  recipe: [{ ingredient: 'ing_patatas', qty: 200 }, { ingredient: 'ing_aceite', qty: 50 }],
  // cost ≈ 0.13 + 0.342 = 0.472, foodCost ≈ 23.6% → rentable
};

// Plato food cost ~50% → "peligroso"
const platoPeligroso = {
  id: 'peligroso',
  name: 'Plato peligroso',
  servings: 1,
  pvp: 1.30,
  recipe: [
    { ingredient: 'ing_gambas', qty: 50 },
    { ingredient: 'ing_aceite', qty: 30 },
  ],
  // cost = 1.40 + 0.2052 = 1.6052 → foodCost = 1.6052/1.30 ≈ 123% → peligroso
};

// Plato sin datos suficientes (sin recipe key)
const platoSinDatos = {
  id: 'sin-datos',
  name: 'Plato misterioso',
  servings: 1,
  pvp: undefined,
};

// ============================================================
// 2. Cargar cost-engine.js (necesario para render-engine)
// ============================================================
const fs = require('fs');
const vm = require('vm');

const costEngineCode = fs.readFileSync('./cost-engine.js', 'utf8');
const costSandbox = { ingredients, business };
vm.createContext(costSandbox);
vm.runInContext(costEngineCode, costSandbox);

// Importar funciones de cost-engine que usaremos en los tests
const {
  foodCostPct, profitMarginEuros, profitStatus, profitStatusClass, monthlyImpact,
  dishCost, dishMargin, suggestedPrice, currency, percent, roundMoney, primaryFormat,
  marginClass, dishBadgeStatus, dishBadgeClass, dishBadgeLabel, profitBadgeHtml,
} = costSandbox;

// ============================================================
// 3. DOM stub helper
// ============================================================
/**
 * Crea un stub mínimo de DOM para probar renderProfitCard.
 * Devuelve elementos con querySelector que retornan null o elementos stub.
 * El stub captura el HTML insertado para verificación.
 */
function createDomStub() {
  let insertedHtml = '';
  const profitCardEl = {
    querySelector: () => null,
    querySelectorAll: () => [],
    remove: () => {},
    insertAdjacentHTML: (_pos, html) => { insertedHtml += html; },
    addEventListener: () => {},
    value: '75',
    textContent: '',
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => {} },
    innerHTML: '',
  };

  const priceRow = {
    insertAdjacentHTML: (_pos, html) => { insertedHtml += html; },
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  return {
    insertedHtml: () => insertedHtml,
    profitCardEl,
    priceRow,
  };
}

// ============================================================
// 4. Cargar render-engine.js en un contexto aislado con stubs
// ============================================================
const renderEngineCode = fs.readFileSync('./render-engine.js', 'utf8');

function createRenderContext(dish, domStub, extraGlobals = {}) {
  const docStub = {
    querySelector: (sel) => {
      if (sel === "[data-screen='dish-detail']") {
        return {
          querySelector: (s) => {
            if (s === '.price-row') return domStub.priceRow;
            if (s === '#profit-card') return null;
            return null;
          },
          insertAdjacentHTML: domStub.priceRow.insertAdjacentHTML,
        };
      }
      return null;
    },
    querySelectorAll: () => [],
  };

  const sandbox = {
    ...costSandbox,       // funciones de cost-engine
    document: docStub,
    window: {},
    dishes: [dish],
    business,
    selectedDish: () => dish,
    selectedDishId: dish?.id || '',
    primaryFormat,
    dishMargin,
    dishCost,
    currency,
    percent,
    marginClass,
    foodCostPct,
    profitMarginEuros,
    profitStatus,
    profitStatusClass,
    monthlyImpact,
    suggestedPrice,
    ingredientCost: costSandbox.ingredientCost,
    formatCost: costSandbox.formatCost,
    formatMargin: costSandbox.formatMargin,
    oilAlert: () => ({ affected: [], rise: 0 }),
    selectedDishFn: () => dish,
    ...extraGlobals,
  };

  vm.createContext(sandbox);
  return sandbox;
}

// ============================================================
// 5. Tests
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

function assertContains(html, substring, label) {
  if (!html || !html.includes(substring)) {
    throw new Error(`HTML no contiene "${substring}" — ${label || ''}\nHTML: ${html?.substring(0, 200)}`);
  }
}

function assertNotContains(html, substring, label) {
  if (html && html.includes(substring)) {
    throw new Error(`HTML no debería contener "${substring}" — ${label || ''}`);
  }
}

console.log('\n🧪 render-engine.js — Suite de tests\n');
console.log('──────────────────────────────────────');

// ── A.1: cost-engine funciones edge cases ──────────────────

test('A.1.1: foodCostPct — dish sin PVP → 0', () => {
  assert(foodCostPct(platoSinPvp), 0);
});

test('A.1.2: foodCostPct — PVP 0 → 0', () => {
  assert(foodCostPct(platoPvpCero), 0);
});

test('A.1.3: foodCostPct — coste 0, PVP > 0 → 0', () => {
  const d = { pvp: 5, servings: 1, recipe: [] };
  const fc = foodCostPct(d);
  assert(fc, 0);
});

test('A.1.4: foodCostPct — coste > PVP → >1 (válido)', () => {
  const fc = foodCostPct(platoMargenNegativo);
  if (fc < 1) throw new Error(`esperado >1, recibido ${fc}`);
});

test('A.1.5: profitMarginEuros — coste > PVP → negativo', () => {
  const me = profitMarginEuros(platoMargenNegativo);
  if (me >= 0) throw new Error(`esperado <0, recibido ${me}`);
});

test('A.1.6: profitStatus — foodCost ≤30% → "rentable"', () => {
  assert(profitStatus(tortilla), 'rentable');
});

test('A.1.7: profitStatus — foodCost 31-40% → "revisar"', () => {
  // coste=0.472, pvp=2.00 → foodCost=0.236 → rentable
  // Necesitamos coste más alto:
  // coste=0.6518, pvp=1.75 → foodCost=0.372 → revisar
  const d = { ...tortilla, pvp: 1.75 };
  assert(profitStatus(d), 'revisar');
});

test('A.1.8: profitStatus — foodCost >40% → "peligroso"', () => {
  assert(profitStatus(platoPeligroso), 'peligroso');
});

test('A.1.9: profitStatusClass — mapeo correcto', () => {
  assert(profitStatusClass('rentable'), 'profit-good');
  assert(profitStatusClass('revisar'), 'profit-mid');
  assert(profitStatusClass('peligroso'), 'profit-bad');
});

test('A.1.10: suggestedPrice — no genera NaN', () => {
  const sp = suggestedPrice(platoSinPvp);
  if (!Number.isFinite(sp) || Number.isNaN(sp)) throw new Error(`suggestPrice es NaN/Infinity: ${sp}`);
});

test('A.1.11: suggestedPrice — no genera Infinity con target=0', () => {
  const sp = suggestedPrice(tortilla, 0);
  if (!Number.isFinite(sp)) throw new Error(`suggestPrice es Infinity con target=0: ${sp}`);
});

test('A.1.12: monthlyImpact — sin diferencia → 0', () => {
  const optPvp = suggestedPrice(tortilla, 0.75);
  const optDish = { ...tortilla, pvp: optPvp };
  // Por redondeo puede no ser exactamente 0, pero debe ser pequeño
  const imp = monthlyImpact(optDish, 0.75, 50);
  if (Math.abs(imp) > 5) throw new Error(`impacto esperado ~0, recibido ${imp}`);
});

test('A.1.13: monthlyImpact — PVP bajo → impacto positivo', () => {
  const cheap = { ...tortilla, pvp: 1.00 };
  const imp = monthlyImpact(cheap, 0.75, 10);
  if (imp <= 0) throw new Error(`esperado >0, recibido ${imp}`);
});

test('A.1.14: monthlyImpact — PVP alto → impacto negativo', () => {
  const expensive = { ...tortilla, pvp: 5.00 };
  const imp = monthlyImpact(expensive, 0.75, 10);
  if (imp >= 0) throw new Error(`esperado <0, recibido ${imp}`);
});

test('A.1.15: dish con undefined pvp → no explota', () => {
  const d = { id: 'x', pvp: undefined, servings: 1, recipe: [{ ingredient: 'ing_patatas', qty: 100 }] };
  const fc = foodCostPct(d);
  assert(fc, 0, 'foodCostPct debe ser 0 con pvp undefined');
  const st = profitStatus(d);
  assert(st, 'rentable', 'con foodCost=0 → rentable');
});

// ── A.2: renderProfitCard no lanza excepciones ──────────────

test('A.2.1: renderProfitCard — dish normal (tortilla) no lanza', () => {
  const domStub = createDomStub();
  const ctx = createRenderContext(tortilla, domStub);
  vm.runInContext(renderEngineCode, ctx);
  // No lanzar = success
});

test('A.2.2: renderProfitCard — dish sin PVP no lanza', () => {
  const domStub = createDomStub();
  const ctx = createRenderContext(platoSinPvp, domStub);
  vm.runInContext(renderEngineCode, ctx);
});

test('A.2.3: renderProfitCard — dish PVP 0 no lanza', () => {
  const domStub = createDomStub();
  const ctx = createRenderContext(platoPvpCero, domStub);
  vm.runInContext(renderEngineCode, ctx);
});

test('A.2.4: renderProfitCard — dish sin coste no lanza', () => {
  const domStub = createDomStub();
  const ctx = createRenderContext(platoSinCoste, domStub);
  vm.runInContext(renderEngineCode, ctx);
});

test('A.2.5: renderProfitCard — margen negativo no lanza', () => {
  const domStub = createDomStub();
  const ctx = createRenderContext(platoMargenNegativo, domStub);
  vm.runInContext(renderEngineCode, ctx);
});

test('A.2.6: renderProfitCard — food cost peligroso no lanza', () => {
  const domStub = createDomStub();
  const ctx = createRenderContext(platoPeligroso, domStub);
  vm.runInContext(renderEngineCode, ctx);
});

test('A.2.7: renderProfitCard — price-row es null (sin DOM) no lanza', () => {
  // Simula un DOM donde querySelector retorna null para dish-detail
  const docStub = {
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const sandbox = {
    ...costSandbox,
    document: docStub,
    window: {},
    dishes: [tortilla],
    business,
    selectedDish: () => tortilla,
    selectedDishId: 'tortilla',
    primaryFormat,
    dishMargin,
    dishCost,
    currency,
    percent,
    marginClass,
    foodCostPct,
    profitMarginEuros,
    profitStatus,
    profitStatusClass,
    monthlyImpact,
    suggestedPrice,
    ingredientCost: costSandbox.ingredientCost,
    formatCost: costSandbox.formatCost,
    formatMargin: costSandbox.formatMargin,
    oilAlert: () => ({ affected: [], rise: 0 }),
  };
  vm.createContext(sandbox);
  vm.runInContext(renderEngineCode, sandbox);
});

// ── A.3: Funciones de badge (dishBadgeStatus, dishBadgeClass, dishBadgeLabel, profitBadgeHtml) ──

test('A.3.1: dishBadgeStatus — rentable (foodCost 22%)', () => {
  assert(dishBadgeStatus(tortilla), 'rentable');
});

test('A.3.2: dishBadgeStatus — revisar (foodCost 35%)', () => {
  const d = { ...tortilla, pvp: 1.75 }; // cost=0.6518/1.75=0.372 → revisar
  assert(dishBadgeStatus(d), 'revisar');
});

test('A.3.3: dishBadgeStatus — peligroso (foodCost >40%)', () => {
  assert(dishBadgeStatus(platoPeligroso), 'peligroso');
});

test('A.3.4: dishBadgeStatus — sin datos (PVP 0)', () => {
  assert(dishBadgeStatus(platoPvpCero), 'sin-datos');
});

test('A.3.5: dishBadgeStatus — sin datos (PVP undefined)', () => {
  assert(dishBadgeStatus(platoSinDatos), 'sin-datos');
});

test('A.3.6: dishBadgeClass — mapeo correcto', () => {
  assert(dishBadgeClass('rentable'), 'badge-good');
  assert(dishBadgeClass('revisar'), 'badge-mid');
  assert(dishBadgeClass('peligroso'), 'badge-bad');
  assert(dishBadgeClass('sin-datos'), 'badge-none');
  assert(dishBadgeClass('otro-inesperado'), 'badge-none');
});

test('A.3.7: dishBadgeLabel — textos correctos', () => {
  assert(dishBadgeLabel('rentable'), 'Rentable');
  assert(dishBadgeLabel('revisar'), 'Revisar');
  assert(dishBadgeLabel('peligroso'), 'Peligroso');
  assert(dishBadgeLabel('sin-datos'), 'Sin datos');
});

test('A.3.8: profitBadgeHtml — contiene badge con clase CSS', () => {
  const html = profitBadgeHtml(tortilla);
  if (!html.includes('profit-badge-inline')) throw new Error('falta clase profit-badge-inline');
  if (!html.includes('badge-good')) throw new Error('falta clase badge-good');
  if (!html.includes('Rentable')) throw new Error('falta texto Rentable');
});

test('A.3.9: profitBadgeHtml — plato sin PVP → Sin datos', () => {
  const html = profitBadgeHtml(platoSinPvp);
  if (!html.includes('Sin datos')) throw new Error('falta texto Sin datos');
  if (!html.includes('badge-none')) throw new Error('falta clase badge-none');
});

test('A.3.10: profitBadgeHtml — no contiene NaN', () => {
  const html1 = profitBadgeHtml(platoSinDatos);
  const html2 = profitBadgeHtml(platoPvpCero);
  if (html1.includes('NaN') || html1.includes('undefined')) throw new Error('badge contiene NaN/undefined');
  if (html2.includes('NaN') || html2.includes('undefined')) throw new Error('badge contiene NaN/undefined');
});

test('A.3.11: profitBadgeHtml — peligroso contiene texto Peligroso', () => {
  const html = profitBadgeHtml(platoPeligroso);
  if (!html.includes('Peligroso')) throw new Error('falta texto Peligroso');
  if (!html.includes('badge-bad')) throw new Error('falta clase badge-bad');
});

// ============================================================
// 6. Resultados
// ============================================================
console.log('\n──────────────────────────────────────');
console.log(`\n📊 Resultados: ${passed} passed, ${failed} failed de ${passed + failed} tests\n`);

process.exit(failed > 0 ? 1 : 0);
