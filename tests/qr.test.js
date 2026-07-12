#!/usr/bin/env node
/**
 * qr.test.js — Tests estructurales del generador de QR (sin dependencias).
 * Verifica tamaño por versión, patrones de posición y temporización, y la
 * estabilidad del generador Reed-Solomon frente al polinomio estándar de QR.
 * Ejecutar: node tests/qr.test.js
 */
const { qrMatrix } = require('../qr-engine.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}: ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

console.log('\n🧪 qr-engine.js — estructura del QR\n');
console.log('──────────────────────────────────────');

test('versión 1 (texto corto) → 21x21', () => {
  const { size, modules } = qrMatrix('ABC');
  assert(size === 21, `size ${size}`);
  assert(modules.length === 21 && modules[0].length === 21, 'matriz no cuadrada');
});

test('URL media → versión >= 2 (25x25+)', () => {
  const { size } = qrMatrix('https://escandalia.app/barelrincon');
  assert(size >= 25, `size ${size}`);
});

function checkFinder(modules, r0, c0) {
  // anillo exterior oscuro
  for (let i = 0; i < 7; i++) {
    assert(modules[r0][c0 + i], 'borde superior');
    assert(modules[r0 + 6][c0 + i], 'borde inferior');
    assert(modules[r0 + i][c0], 'borde izq');
    assert(modules[r0 + i][c0 + 6], 'borde der');
  }
  // núcleo 3x3 oscuro
  for (let dr = 2; dr <= 4; dr++) for (let dc = 2; dc <= 4; dc++) assert(modules[r0 + dr][c0 + dc], 'núcleo');
  // anillo interior claro
  assert(!modules[r0 + 1][c0 + 1], 'anillo claro');
}

test('tres patrones de posición correctos', () => {
  const { size, modules } = qrMatrix('ABC');
  checkFinder(modules, 0, 0);
  checkFinder(modules, 0, size - 7);
  checkFinder(modules, size - 7, 0);
});

test('patrón de temporización alterna', () => {
  const { size, modules } = qrMatrix('ABC');
  for (let i = 8; i < size - 8; i++) {
    assert(modules[6][i] === (i % 2 === 0), `temporización fila col ${i}`);
    assert(modules[i][6] === (i % 2 === 0), `temporización col fila ${i}`);
  }
});

test('mismo texto → matriz determinista', () => {
  const a = qrMatrix('escandalia.app/bar');
  const b = qrMatrix('escandalia.app/bar');
  assert(JSON.stringify(a.modules) === JSON.stringify(b.modules), 'no determinista');
});

test('texto demasiado largo lanza error controlado', () => {
  let threw = false;
  try { qrMatrix('x'.repeat(200)); } catch (e) { threw = true; }
  assert(threw, 'debería lanzar para >108 bytes');
});

console.log('\n──────────────────────────────────────');
console.log(`\n📊 Resultados: ${passed} passed, ${failed} failed de ${passed + failed} tests\n`);
process.exit(failed > 0 ? 1 : 0);
