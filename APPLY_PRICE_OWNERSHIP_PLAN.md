# Apply Price Ownership Plan

## 1. Contexto

- Rama: `sprint3/apply-price-ownership-plan`.
- App vanilla HTML/CSS/JS.
- Sin `package.json`.
- Tests actuales: `node tests/cost-engine.test.js`.
- Resultado actual esperado: `46 passed, 0 failed`.
- Riesgo principal: el flujo "aplicar precio recomendado" tiene funcion base, varias sobrescrituras y un listener independiente que corta la propagacion.

## 2. Estado actual

| Elemento | Archivo | Rol actual |
| --- | --- | --- |
| `applyRecommendedPrice` base | `script.js` | Delegador legacy con fallback base para carga inicial. |
| `applyRecommendedPrice` patch | `product-actions.js` | Delegador legacy; llama al propietario si existe y si no delega al wrapper previo. |
| `applyRecommendedPrice` con formatos | `yield-persistence.js` | Delegador legacy final; llama al propietario si existe y conserva el unico fallback rico con `updateDishWithFormats(dish)`. |
| Listener de aplicar precio | `apply-price-action.js` | Intercepta clicks en captura para `Aplicar nuevo precio` y `Aplicar precios sugeridos`. |
| Listener manual | `manual-price-action.js` | Intercepta `Editar manualmente`; no aplica precio, pero compite en la misma pantalla. |
| Botones origen | `index.html` | Botones con texto visible, sin `data-action` especifico. |

## 3. Donde se define, sobrescribe e intercepta

- `script.js`: define `async function applyRecommendedPrice()`.
- `product-actions.js`: reasigna `applyRecommendedPrice = async function patchedApplyRecommendedPrice()`.
- `yield-persistence.js`: reasigna `applyRecommendedPrice = async function applyRecommendedPriceWithFormats()`.
- `apply-price-action.js`: no usa la funcion global; implementa su propio flujo dentro de un listener `document.addEventListener('click', ..., true)`.
- `manual-price-action.js`: intercepta `Editar manualmente` con otro listener de captura.

## 4. Flujo actual al pulsar aplicar precio

1. El click entra primero por el listener de captura de `apply-price-action.js`.
2. El handler comprueba el texto del boton: `Aplicar nuevo precio` o `Aplicar precios sugeridos`.
3. Si coincide, ejecuta `preventDefault()` y `stopImmediatePropagation()`.
4. Selecciona plato con `oilAlert().affected[0]?.dish || selectedDish?.()`.
5. Asegura formatos con `ensureDishFormats?.(dish)`.
6. Calcula `nextPvp` con `suggestedPrice(dish, business.targetMargin, format)`.
7. Actualiza `dish.formats[0].pvp`, `dish.pvp` y `selectedDishId`.
8. Si hay Supabase, intenta persistir con `updateDishWithFormats(dish)`; si no existe, hace update simple de `pvp`.
9. Si hay Supabase, llama a `loadFromSupabase()`.
10. Ejecuta `renderAll()`, navega a `dish-detail` y muestra `Nuevo PVP aplicado`.
11. El router global de `script.js` no llega a ejecutar su rama de aplicar precio porque la propagacion queda cortada.

## 5. Riesgos concretos

- Legacy residual: hay tres puntos `applyRecommendedPrice`, pero ahora funcionan como delegadores/fallbacks y el flujo real vive en `apply-price-action.js`.
- Ownership confuso: leer la funcion global no explica lo que ocurre en produccion.
- Dependencia de microcopy: el handler detecta botones por texto visible.
- Riesgo de plato equivocado: `oilAlert().affected[0]` puede tener prioridad sobre el plato que el usuario cree estar editando.
- `stopImmediatePropagation`: bloquea el router base y cualquier listener futuro.
- Persistencia mezclada con UI: el handler decide precio, persiste, recarga datos, renderiza, navega y muestra feedback.
- Orden de carga fragil: las sobrescrituras dependen de `index.html` y del orden de scripts.

## 6. Propietario recomendado

Propietario unico recomendado: `apply-price-action.js`.

Motivo:

- Es el archivo mas especifico para la accion de aplicar precio.
- Ya contiene el flujo que realmente gana hoy por captura.
- Permite dejar `product-actions.js` centrado en receta/formato/editor.
- Permite dejar `yield-persistence.js` centrado en persistencia de formatos.
- Permite simplificar `script.js` como router/base sin decision de precio.

## 7. Plan por fases

### Fase A: documentacion y ownership

- Crear este documento.
- Enlazarlo desde `GLOBAL_OWNERSHIP_AUDIT.md`.
- Anadir comentario de ownership en `apply-price-action.js`.
- Marcar las implementaciones de `applyRecommendedPrice` en `script.js`, `product-actions.js` y `yield-persistence.js` como candidatas a delegacion/deprecated.
- No cambiar comportamiento.

### Fase B: handler unico

- Extraer en `apply-price-action.js` una funcion unica, por ejemplo `applyRecommendedPriceFromCurrentContext()`.
- Hacer que el listener de `apply-price-action.js` llame a esa funcion.
- Hacer que cualquier llamada legacy a `applyRecommendedPrice()` delegue en esa funcion unica, sin duplicar logica.
- Mantener `updateDishWithFormats(dish)` como dependencia de persistencia, no como propietario de la accion.

Estado: implementada en `sprint3/apply-price-handler-unification`. `apply-price-action.js` contiene `applyRecommendedPriceFromCurrentContext()`, el listener actual delega en ella y las implementaciones legacy conservan fallback pero delegan en la funcion unica cuando esta disponible.

### Fase C: eliminar duplicados

- Retirar las implementaciones duplicadas o dejarlas como wrappers temporales minimos.
- Sustituir deteccion por texto visible por `data-action="apply-recommended-price"` cuando se permita tocar HTML.
- Eliminar `stopImmediatePropagation` solo cuando el router unico este preparado para no duplicar acciones.

Estado: iniciada en `sprint3/apply-price-data-action`. Los botones principales usan `data-action`, los handlers priorizan `data-action` y mantienen fallback por texto visible durante la transicion.

### Fase D: limpieza legacy conservadora

- `apply-price-action.js` se mantiene como propietario operativo del flujo.
- `product-actions.js` ya no duplica la logica de aplicar precio; conserva un delegador legacy que llama al propietario si existe y, si no, delega al wrapper previo por orden de carga.
- `yield-persistence.js` conserva el ultimo fallback rico para escenarios donde el propietario no este disponible, porque es el punto que conoce `updateDishWithFormats(dish)` tras cargarse la persistencia de formatos.
- `script.js` mantiene su fallback base por compatibilidad de carga inicial.
- `stopImmediatePropagation` se conserva mientras el router global siga detectando botones por texto visible.
- `tests/sprint3-functional-smoke.test.js` cubre `data-action`, propietario y delegadores legacy.

## 8. Manual checks necesarios

- `node tests/cost-engine.test.js`.
- Pulsar `Aplicar nuevo precio` desde la pantalla de precio recomendado.
- Pulsar `Aplicar precios sugeridos` desde la alerta de ingrediente.
- Confirmar que vuelve al detalle del plato correcto.
- Confirmar que cambia el PVP visible y el margen.
- Confirmar que cambia el formato principal si el plato tiene formatos.
- Confirmar modo local sin Supabase.
- Confirmar modo Supabase con `sale_formats`.
- Confirmar que `Editar manualmente` sigue navegando al editor y no aplica precio.

## 9. Que no tocar todavia

- Supabase/RLS.
- Esquema de datos.
- `package.json`.
- Migracion a modulos ES.
- Router global completo.
- Calculo de `suggestedPrice`.
- UX nueva de precios por formato.
- HTML de botones hasta que se apruebe usar `data-action`.
