#!/usr/bin/env node
/**
 * Sprint 3.7 functional smoke checks.
 *
 * Static, dependency-free checks for critical UI flows before deleting legacy
 * handlers or changing more globals.
 *
 * Run: node tests/sprint3-functional-smoke.test.js
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const files = {
  index: read('index.html'),
  script: read('script.js'),
  styles: read('styles.css'),
  applyPrice: read('apply-price-action.js'),
  manualPrice: read('manual-price-action.js'),
  productActions: read('product-actions.js'),
  yieldPersistence: read('yield-persistence.js'),
  opsActions: read('ops-actions.js'),
};

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  OK ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  FAIL ${name}: ${error.message}`);
    failed += 1;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(file, text) {
  return files[file].includes(text);
}

function indexOf(file, text) {
  return files[file].indexOf(text);
}

function assertIncludes(file, text, label = text) {
  assert(includes(file, text), `${file} missing ${label}`);
}

function assertOrdered(file, first, second) {
  const firstIndex = indexOf(file, first);
  const secondIndex = indexOf(file, second);
  assert(firstIndex >= 0, `${file} missing ${first}`);
  assert(secondIndex >= 0, `${file} missing ${second}`);
  assert(firstIndex < secondIndex, `${file} expected ${first} before ${second}`);
}

console.log('\nSprint 3.7 functional smoke checks\n');
console.log('--------------------------------------------------');

test('base screens exist', () => {
  ['home', 'dish-detail', 'ingredient-alert', 'ai-price', 'edit-recipe', 'add-dish'].forEach((screen) => {
    assertIncludes('index', `data-screen="${screen}"`);
  });
});

test('detail and home navigation anchors exist', () => {
  assertIncludes('index', 'data-go="dish-detail"');
  assertIncludes('index', 'data-go="home"');
  assertIncludes('index', 'data-go="ai-price"');
  assertIncludes('index', 'data-go="edit-recipe"');
});

test('apply new price button uses data-action', () => {
  assertIncludes('index', 'data-action="apply-recommended-price">Aplicar nuevo precio');
});

test('apply suggested prices button uses data-action', () => {
  assertIncludes('index', 'data-action="apply-recommended-price">Aplicar precios sugeridos');
});

test('manual edit button uses data-action', () => {
  assertIncludes('index', 'data-action="edit-price-manually">Editar manualmente');
});

test('core product buttons use data-action', () => {
  assertIncludes('index', 'data-action="save-dish">Guardar plato');
  assertIncludes('index', 'data-action="review-costs-manually">Revisar manualmente');
  assertIncludes('index', 'data-action="save-recipe">Guardar cambios');
});

test('core product handlers prioritize data-action and keep legacy fallback', () => {
  assertOrdered('script', 'action === "save-dish"', 'button?.textContent.trim() === "Guardar plato"');
  assertOrdered('productActions', "action === 'review-costs-manually'", "manual?.textContent.trim() === 'Revisar manualmente'");
  assertOrdered('productActions', "action === 'save-recipe'", "manual?.textContent.trim() === 'Guardar cambios'");
});

test('apply price handler prioritizes data-action and keeps legacy fallback', () => {
  assertIncludes('applyPrice', 'function applyRecommendedPriceFromCurrentContext()');
  assertOrdered('applyPrice', "button.dataset.action === 'apply-recommended-price'", "label === 'Aplicar nuevo precio'");
  assertIncludes('applyPrice', "label === 'Aplicar precios sugeridos'");
  assertIncludes('applyPrice', 'stopImmediatePropagation');
});

test('legacy apply price wrappers delegate to the owner when available', () => {
  assertIncludes('script', 'typeof applyRecommendedPriceFromCurrentContext === "function"');
  assertIncludes('productActions', 'previousApplyRecommendedPriceForProductActions');
  assertIncludes('productActions', 'return applyRecommendedPriceFromCurrentContext()');
  assertIncludes('productActions', 'return previousApplyRecommendedPriceForProductActions()');
  assertIncludes('yieldPersistence', 'previousApplyRecommendedPriceForYieldPersistence');
  assertIncludes('yieldPersistence', 'return applyRecommendedPriceFromCurrentContext()');
});

test('manual price handler prioritizes data-action and keeps legacy fallback', () => {
  assertOrdered('manualPrice', "button.dataset.action === 'edit-price-manually'", "button.textContent.trim() === 'Editar manualmente'");
  assertIncludes('manualPrice', "showScreen('edit-recipe')");
  assertIncludes('manualPrice', 'stopImmediatePropagation');
});

test('script order keeps legacy before focused handlers', () => {
  assertOrdered('index', 'script.js', 'manual-price-action.js');
  assertOrdered('index', 'manual-price-action.js', 'apply-price-action.js');
});

test('purchase and sales screens are dynamically declared', () => {
  assertIncludes('opsActions', 'data-screen="purchases"');
  assertIncludes('opsActions', 'data-screen="stats"');
  assertIncludes('opsActions', 'data-go="purchases"');
});

test('purchase and sales save actions exist', () => {
  assertIncludes('opsActions', '.save-purchase');
  assertIncludes('opsActions', '.save-sale');
  assertIncludes('opsActions', 'Compra registrada');
  assertIncludes('opsActions', 'Ventas registradas');
});

test('mobile shell is constrained for 375px and 430px checks', () => {
  assertIncludes('index', 'name="viewport"');
  assertIncludes('styles', 'width:min(100vw,430px)');
  assertIncludes('styles', '@media (max-width:374px)');
  assertIncludes('styles', 'width:min(100vw,430px)');
});

test('escandallos overview copy exists', () => {
  assertIncludes('index', 'aria-label="Escandallos"');
  assertIncludes('index', 'Ordenado por prioridad de revisión');
  assertIncludes('productActions', 'Margen estimado');
  assertIncludes('productActions', 'Food cost');
  assertIncludes('productActions', 'Revisar precio');
  assertIncludes('productActions', 'Ver detalle');
});

test('escandallos overview uses existing cost helpers and margin badges', () => {
  assertIncludes('productActions', 'function renderEscandallosOverview()');
  assertIncludes('productActions', 'rows = [...dishes].sort');
  assertIncludes('productActions', 'formatCost(dish, format)');
  assertIncludes('productActions', 'formatMargin(dish, format)');
  assertIncludes('productActions', 'marginClass(margin)');
  assertIncludes('styles', '.escandallo-card.low-bg');
  assertIncludes('styles', '.escandallo-card.mid-bg');
  assertIncludes('styles', '.escandallo-card.good-bg');
});

console.log('--------------------------------------------------');
console.log(`${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
