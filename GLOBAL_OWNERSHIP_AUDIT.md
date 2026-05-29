# Global Ownership Audit

## 1. Contexto

- Rama: `sprint3/global-ownership-audit`.
- App vanilla HTML/CSS/JS.
- Sin `package.json`.
- Tests actuales: `node tests/cost-engine.test.js`.
- Resultado actual: `46 passed, 0 failed`.

## 2. Funciones globales

| Funcion/global | Definida en | Sobrescrita/envuelta en | Riesgo | Propietario recomendado |
| --- | --- | --- | --- | --- |
| `renderHome` | `render-engine.js` | `product-actions.js` | Alto: sustituye el render principal de KPIs y lista de platos sin preservar contrato explicito. | `render-engine.js` |
| `renderDetail` | `render-engine.js` | `product-actions.js` | Alto: cambia la pantalla de detalle completa y acopla formatos/rendimiento al render. | `render-engine.js` |
| `renderAiPrice` | `render-engine.js` | `product-actions.js` | Medio-alto: la sugerencia de precio depende del patch cargado. | `render-engine.js` |
| `showScreen` | `script.js` | `product-actions.js`, `ops-actions.js` | Muy alto: doble wrapper; el orden de carga decide que comportamiento vive. | `script.js` |
| `loadFromSupabase` | `script.js` | `yield-persistence.js` | Alto: se reemplaza la carga completa de negocio, ingredientes y platos. | `script.js` ahora; futuro `data-actions.js` |
| `bootData` | `script.js` | `ops-actions.js` | Alto: el arranque de datos queda encadenado a ops y al orden de scripts. | `script.js` |
| `updateDishWithFormats` | `yield-persistence.js` | `ops-actions.js` | Alto: cambia `yield_unit`, `sale_formats` y fallback de persistencia. | `yield-persistence.js` |
| `renderRecipeEditor` | `product-actions.js` | `ops-actions.js` | Alto: el editor base y el bloque de producto manual compiten en el mismo DOM. | `product-actions.js` |
| `applyFormatChanges` | `product-actions.js` | `ops-actions.js` | Medio: wrapper pequeno, pero oculto y dependiente del orden. | `product-actions.js` |
| `saveRecipeQuantities` | `product-actions.js` | `yield-persistence.js` | Alto: dos caminos de guardado para receta/rendimiento/formatos. | `yield-persistence.js` |
| `createDishFromForm` | `script.js` | `product-actions.js` | Medio-alto: cambia receta inicial por plato vacio y altera UX de creacion. | `product-actions.js` |
| `applyRecommendedPrice` | `script.js` | `product-actions.js`, `yield-persistence.js`, listener en `apply-price-action.js` | Muy alto: triple implementacion mas listener con captura y `stopImmediatePropagation`. | Un unico propietario: `apply-price-action.js` o `product-actions.js` |
| `loadOpsFromSupabase` | `ops-actions.js` | `ops-editable.js` | Medio: segunda version anade ids para editar/borrar compras y ventas. | `ops-actions.js` |
| `renderPurchaseList` | `ops-actions.js` | `ops-editable.js` | Medio: render base reemplazado por render editable. | `ops-actions.js` |
| `renderStatsScreen` | `ops-actions.js` | `ops-editable.js` | Medio: render base reemplazado por render editable. | `ops-actions.js` |
| `createOrReuseIngredient` | `ops-actions.js` | `ops-fallback.js` | Medio: fallback de Supabase vive fuera del propietario principal. | `ops-actions.js` |

## 3. Intervals y listeners globales

| Archivo | Mecanismo | Proposito | Riesgo | Alternativa segura |
| --- | --- | --- | --- | --- |
| `product-actions.js` | `setInterval(..., 500)` | Elimina chip de sesion, hace KPIs clicables y corrige boton Ajustes. | Alto: parche permanente que pisa DOM cada medio segundo. | `syncHomeInteractions()` llamada tras `renderHome()` o `showScreen('home')`. |
| `ops-actions.js` | `setInterval(..., 700)` | Fuerza boton Ajustes a Estadisticas. | Alto: parche de navegacion dependiente de texto visible. | Resolver la navegacion una sola vez en `ensureOpsScreens()`. |
| `script.js` | `document.addEventListener('click', ...)` | Auth, guardar plato, aplicar precio y navegacion `[data-go]`. | Alto: router global mezcla muchas responsabilidades. | Router unico con subhandlers por `data-action` y `data-go`. |
| `product-actions.js` | `document.addEventListener('click', ..., true)` | KPIs, costes, receta, revisar manualmente, guardar cambios. | Alto: captura eventos antes que el router base y usa textos de botones. | Subrouter `handleProductAction(event)` llamado desde router unico. |
| `ops-actions.js` | `document.addEventListener('click', ..., true)` | Crear producto manual, registrar compra, registrar venta. | Alto: captura global adicional y muta datos/render. | Subrouter `handleOpsAction(event)` con selectores estables. |
| `ops-editable.js` | `document.addEventListener('click', ..., true)` | Editar, borrar y cancelar compras/ventas. | Medio-alto: tercer handler en captura para la misma zona de ops. | Integrarlo en `handleOpsAction(event)`. |
| `manual-price-action.js` | `document.addEventListener('click', ..., true)` | Boton `Editar manualmente` desde sugerencia de precio. | Medio: usa texto visible como selector y captura global. | `data-action="edit-price-manually"` gestionado por router unico. |
| `apply-price-action.js` | `document.addEventListener('click', ..., true)` | Aplicar nuevo precio o precios sugeridos. | Muy alto: compite con `applyRecommendedPrice` y corta propagacion. | Unificar la accion de precio en un solo propietario. |

## 4. Top 5 riesgos

1. `applyRecommendedPrice`: hay funcion base, dos sobrescrituras y un listener independiente que usa captura y `stopImmediatePropagation`.
2. `showScreen`: dos wrappers encadenados hacen que la navegacion dependa del orden exacto de carga.
3. `setInterval` como parche: oculta fallos de ownership y puede pisar estado visual continuamente.
4. `renderRecipeEditor` / `saveRecipeQuantities` / `updateDishWithFormats`: editor, rendimiento, formatos y persistencia estan repartidos.
5. Orden de carga: `start()` se ejecuta en `script.js` antes de cargar los patches posteriores, y el comportamiento final depende de timing y wrappers.

## 5. Sprint 3.4 recomendado

1. Documentar ownership global en este archivo y mantenerlo como referencia del sprint.
2. Anadir comentarios de ownership al inicio de cada archivo, sin cambiar comportamiento.
3. Sustituir `setInterval` por llamadas explicitas solo si es seguro y se valida visualmente.
4. Unificar acciones de precio para que exista una sola ruta de `applyRecommendedPrice`.
5. Definir convencion de propietarios:
   - `render-engine.js`: render puro de pantallas.
   - `script.js`: estado base, arranque y navegacion.
   - `product-actions.js`: receta, formatos y acciones de producto.
   - `yield-persistence.js`: persistencia de receta, rendimiento y formatos.
   - `ops-actions.js`: compras, ventas, caja y estadisticas.
   - `ops-editable.js`: si se mantiene, solo extension editable de ops, sin sobrescribir renders completos.

## 6. Que NO hacer todavia

- Migrar a modulos ES.
- Tocar Supabase/RLS.
- Anadir `package.json`.
- Migrar a framework.
- Reescribir `script.js` entero.
- Cambiar esquema de datos.
- Anadir features grandes encima de la bomba de globals.

## 7. Recomendacion final

Primero documentar. Despues hacer un refactor pequeno y quirurgico centrado en dos puntos: eliminar `setInterval` seguros y unificar acciones de precio. No iniciar features grandes hasta cerrar esa estabilizacion minima.
