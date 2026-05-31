# Sprint 3.9 Router Listener Audit

## 1. Contexto

- Rama: `codex/sprint3-9-router-listener-audit`.
- Objetivo: mapear la deuda tecnica restante en router global, listeners, wrappers y parches de render.
- Alcance: auditoria y documentacion. Sin cambios funcionales.
- Tests base:
  - `node tests/cost-engine.test.js` -> `46 passed, 0 failed`.
  - `node tests/sprint3-functional-smoke.test.js` -> `12 passed, 0 failed`.

## 2. Mapa de listeners click

| Archivo | Listener | Capture | Responsabilidad actual | Riesgo |
| --- | --- | --- | --- | --- |
| `script.js` | `document.addEventListener("click", async ...)` | No | Auth, logout, guardar plato, aplicar precio legacy y navegacion `[data-go]`. | Alto: router global mezcla dominios y depende de texto visible. |
| `script.js` | `document.addEventListener("click", ...)` | No | Seleccion de idioma/categoria. | Bajo: acotado a `.language-row` y `.category-tabs`. |
| `product-actions.js` | `document.addEventListener('click', async ..., true)` | Si | KPIs, guardar costes, editar receta, revisar manualmente y guardar cambios. | Alto: captura antes del router base y usa textos visibles. |
| `ops-actions.js` | `document.addEventListener('click', async ..., true)` | Si | Producto manual, compras, ventas y caja. | Alto: tercer router de dominio con mutaciones de datos y render. |
| `ops-editable.js` | `document.addEventListener('click', async ..., true)` | Si | Editar/borrar compras y ventas. | Medio-alto: compite con `ops-actions.js` en el mismo dominio. |
| `manual-price-action.js` | `document.addEventListener('click', ..., true)` | Si | Editar manualmente desde precio recomendado. | Medio: ya prioriza `data-action`, pero conserva fallback por texto y corta propagacion. |
| `apply-price-action.js` | `document.addEventListener('click', async ..., true)` | Si | Aplicar precio recomendado. | Medio: propietario operativo correcto, pero conserva fallback por texto y `stopImmediatePropagation`. |

## 3. Mapa de setInterval

| Archivo | Intervalo | Proposito | Riesgo | Alternativa segura |
| --- | --- | --- | --- | --- |
| `product-actions.js` | `setInterval(..., 500)` | Elimina `.session-chip`, hace KPIs focusables/clicables y cambia Ajustes a settings si aparece. | Alto: parche permanente que pisa DOM y oculta problemas de render ownership. | Extraer `syncProductDecorations()` y llamarlo desde `renderHome()`/`showScreen()`. |
| `ops-actions.js` | `setInterval(..., 700)` | Convierte el boton Ajustes a Estadisticas si vuelve a aparecer. | Alto: depende de texto visible y reescribe nav repetidamente. | Hacer que `ensureOpsScreens()` sea idempotente y se llame despues de crear/actualizar nav. |

## 4. Mapa de wrappers showScreen/render

| Funcion | Definicion base | Wrapper/sobrescritura | Responsabilidad anadida | Riesgo |
| --- | --- | --- | --- | --- |
| `showScreen` | `script.js` | `product-actions.js` | Activa pantallas dinamicas y renderiza coste/editor/settings/add dish. | Alto: wrapper depende de `originalShowScreen` y orden de scripts. |
| `showScreen` | wrapper de `product-actions.js` | `ops-actions.js` | Activa stats/purchases y renderiza ops. | Alto: wrapper sobre wrapper; dificil razonar efectos laterales. |
| `renderHome` | `render-engine.js` | `product-actions.js` | KPIs/lista con formatos y rendimiento. | Medio-alto: render completo reemplazado. |
| `renderDetail` | `render-engine.js` | `product-actions.js` | Detalle con receta base, formatos y coste por tapa. | Medio-alto: render completo reemplazado. |
| `renderAiPrice` | `render-engine.js` | `product-actions.js` | Sugerencia por formato principal. | Medio: reemplazo acotado al flujo de precio. |

## 5. stopImmediatePropagation

| Archivo | Uso | Motivo actual | Riesgo |
| --- | --- | --- | --- |
| `apply-price-action.js` | Aplicar precio recomendado | Evita doble aplicacion por router base legacy. | Medio: necesario hasta consolidar router, bloquea listeners futuros. |
| `manual-price-action.js` | Editar manualmente | Evita que otros routers interpreten el click. | Medio: correcto temporalmente, pero debe moverse a router unico. |
| `product-actions.js` | Revisar manualmente | Evita que el router base navegue por otro camino. | Medio-alto: depende de texto visible. |
| `product-actions.js` | Guardar cambios en editor | Evita doble accion con router base. | Medio-alto: mezcla accion de formulario y router global. |

## 6. Dependencias por texto visible

| Archivo | Texto usado | Uso | Recomendacion |
| --- | --- | --- | --- |
| `script.js` | `Guardar plato` | Crear plato. | Migrar a `data-action="save-dish"`. |
| `script.js` | `Aplicar nuevo precio`, `Aplicar precios sugeridos` | Fallback legacy de apply price. | Mantener hasta retirar router legacy de precio. |
| `product-actions.js` | `Ajustes` | Reescritura nav/settings. | Reemplazar por `data-go`/estado de nav. |
| `product-actions.js` | `Revisar manualmente` | Ir a editor de costes. | Migrar a `data-action="review-costs-manually"`. |
| `product-actions.js` | `Guardar cambios` | Guardar receta activa. | Migrar a `data-action="save-recipe"`. |
| `ops-actions.js` | `Ajustes` | Reescritura nav a Estadisticas. | Reemplazar por inicializacion idempotente de nav. |
| `manual-price-action.js` | `Editar manualmente` | Fallback legacy. | Mantener hasta retirar fallback. |
| `apply-price-action.js` | `Aplicar nuevo precio`, `Aplicar precios sugeridos` | Fallback legacy. | Mantener hasta router unico. |

## 7. Acciones con data-action

| Accion | Donde vive | Estado |
| --- | --- | --- |
| `apply-recommended-price` | `index.html`, `apply-price-action.js`, smoke test | Operativo; fallback por texto se conserva. |
| `edit-price-manually` | `index.html`, `manual-price-action.js`, smoke test | Operativo; fallback por texto se conserva. |
| `save-dish` | `index.html`, `script.js`, smoke test | Operativo; fallback por texto se conserva. |
| `review-costs-manually` | `index.html`, `product-actions.js`, smoke test | Operativo; fallback por texto se conserva. |
| `save-recipe` | `index.html`, `product-actions.js`, smoke test | Operativo; fallback por texto se conserva. |
| KPIs home | `product-actions.js` asigna `dataset.action` en runtime | Parcial; depende de `setInterval`. |

## 8. Riesgos por prioridad

1. `showScreen` wrapper sobre wrapper: es el punto mas fragil porque orquesta render, nav, pantallas dinamicas y side effects.
2. `setInterval` de nav/KPIs: parchea el DOM continuamente y hace dificil saber que render es propietario.
3. Listeners capture multiples: `product-actions.js`, `ops-actions.js`, `ops-editable.js`, `manual-price-action.js` y `apply-price-action.js` compiten antes del router base.
4. Router por texto visible: rompe si cambia microcopy y oculta contratos de accion.
5. Render wrappers completos: `renderHome`, `renderDetail` y `renderAiPrice` se sustituyen en vez de componerse.

## 9. Propuesta de fases

### Fase A: data-action de bajo riesgo

- Anadir `data-action` a `Guardar plato`, `Revisar manualmente` y `Guardar cambios`.
- Hacer que los handlers prioricen `data-action` y mantengan fallback por texto.
- Ampliar smoke tests.

### Fase B: eliminar setInterval seguro de KPIs/nav

- Extraer funcion idempotente para decorar KPIs.
- Llamarla desde `renderHome()`/`showScreen()` sin cambiar UX.
- Reemplazar reescritura repetida de nav por inicializacion idempotente.

### Fase C: router de acciones acotado

- Crear funciones `handleBaseAction`, `handleProductAction`, `handleOpsAction`.
- Mantener listeners existentes al principio, pero delegar en funciones nombradas.
- Solo despues retirar listeners duplicados.

### Fase D: showScreen ownership

- Documentar contrato de `showScreen`.
- Reducir wrappers a registro de callbacks por pantalla o lista explicita de renders post-navegacion.
- No hacerlo hasta tener tests/preview manual de navegacion.

## 10. Que atacar primero

El primer bloque de menor riesgo es Fase A: `data-action` para acciones que hoy dependen de texto visible en `script.js` y `product-actions.js`, manteniendo fallback. Es pequeno, testeable con smoke tests y no cambia estructura global.

## 11. Que NO tocar todavia

- No eliminar `stopImmediatePropagation` todavia.
- No eliminar wrappers `showScreen`.
- No borrar listeners capture.
- No cambiar orden de scripts.
- No tocar Supabase/RLS, SQL, `.env`, dependencias, framework, Carta QR ni Stripe.
- No reescribir `script.js`, `product-actions.js` u `ops-actions.js` completos.

## 12. Recomendacion ejecutiva

Sprint 3.9 debe cerrar como auditoria. El siguiente bloque deberia ser una fase pequena de `data-action` para `Guardar plato`, `Revisar manualmente` y `Guardar cambios`, con fallback por texto y smoke tests. No conviene tocar `showScreen` ni retirar intervals hasta que esas acciones tengan contratos explicitos.
