# Sprint 3 Audit

## 1. Estado actual del proyecto

Escandalia es una app vanilla HTML/CSS/JS orientada a controlar escandallos, costes, márgenes y rentabilidad de platos, tapas y raciones.

El proyecto está actualmente en fase de consolidación técnica antes de construir funciones grandes como Carta QR real, planes de pago o SaaS multiempresa.

Estado actual:

- App sin `package.json`.
- Preview local mediante servidor estático.
- Test unitario principal centrado en `cost-engine.js`.
- Lógica de costes separada en `cost-engine.js`.
- Render y acciones distribuidos entre varios scripts.
- Supabase existe en el proyecto, pero no se debe tocar en este bloque.

## 2. Cómo ejecutar preview local

```bash
python -m http.server 5173
```

Después abrir:

```text
http://localhost:5173
```

## 3. Cómo ejecutar tests

```bash
node tests/cost-engine.test.js
```

## 4. Resultado base actual

```text
46 passed, 0 failed
```

## 5. Riesgos detectados

- Acoplamiento DOM/globales: muchos scripts dependen de variables y funciones globales.
- Funciones sobrescritas entre scripts: `renderHome`, `renderDetail`, `renderAiPrice`, `showScreen`, `loadFromSupabase`, `saveRecipeQuantities`, `applyRecommendedPrice` y `updateDishWithFormats` se redefinen o envuelven en distintos archivos.
- `setInterval` usados como parche para corregir navegación, chips de sesión o acciones después del render.
- Mojibake en textos visibles y comentarios: pueden aparecer secuencias rotas de tildes, símbolos de euro o flechas.
- Falta de `.low-bg` en CSS aunque `marginClass()` puede devolver esa clase.
- Huecos de tests en `cost-engine.js`, especialmente en casos límite de precios, formatos, targets de margen y entradas inválidas.

## 6. Cambios mínimos aprobados para Sprint 3

- Corregir mojibake en textos visibles, JS, tests y documentación técnica.
- Añadir `.low-bg` en CSS.
- Ampliar tests críticos de `cost-engine.js` sin introducir dependencias ni `package.json`.
- Documentar ownership de funciones globales y orden de carga de scripts.
- Reducir `setInterval` solo si es seguro y no cambia comportamiento funcional.

## 7. Cambios explícitamente NO aprobados

- Supabase/RLS.
- Carta QR real.
- Stripe.
- Planes Starter/Pro/Premium.
- Multiempresa.
- `package.json`.
- React/Vite.
- Refactor grande a módulos ES.

## 8. Checklist visual para validar

- Home.
- KPIs.
- Lista de platos.
- Badges.
- Detalle escandallo.
- Editor receta.
- Simulador/PVP recomendado.
- Compras/ventas/caja.
- Móvil 375px.
- Móvil 430px.
- Textos mojibakeados.

## 9. Próximo bloque recomendado

Bloque 2 recomendado: estabilización mínima sin nuevas features.

Orden sugerido:

1. Corregir mojibake de textos visibles y utilidades afectadas.
2. Añadir `.low-bg`.
3. Ampliar tests críticos de `cost-engine.js`.
4. Documentar ownership de funciones globales y orden de carga.
5. Revisar `setInterval` y sustituir solo los casos seguros por llamadas explícitas tras render.
