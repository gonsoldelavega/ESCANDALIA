# Sprint 3.7 Functional Validation

Objetivo: validar los flujos criticos de UI antes de eliminar legacy o tocar mas globals.

Esta validacion no sustituye a Playwright/Cypress. Es una puerta ligera y local para confirmar que las rutas principales siguen siendo navegables, que los botones criticos usan `data-action`, y que la UI movil basica no queda fuera del marco de 430px.

## Alcance

- Aplicar nuevo precio desde `ai-price`.
- Aplicar precios sugeridos desde alerta de ingredientes.
- Editar manualmente precio/rendimiento.
- Ver detalle de plato.
- Volver al home.
- Registro basico de compra y venta.
- Comprobacion movil en 375px y 430px.

Fuera de alcance en este sprint:

- Carta QR.
- Supabase/RLS.
- Migracion de framework.
- Eliminacion de legacy.
- Cambios de logica de negocio.

## Smoke Test Local

Ejecutar desde la raiz del repo:

```powershell
node tests/cost-engine.test.js
node tests/sprint3-functional-smoke.test.js
```

El smoke test revisa de forma estatica:

- Pantallas base presentes.
- Botones `Aplicar nuevo precio` y `Aplicar precios sugeridos` con `data-action="apply-recommended-price"`.
- Boton `Editar manualmente` con `data-action="edit-price-manually"`.
- Fallback legacy por texto mantenido en los handlers.
- Orden de scripts compatible con los handlers de precio.
- Pantallas dinamicas de compras/estadisticas declaradas por `ops-actions.js`.
- Guardado de compra y venta presente.
- Meta viewport y limites moviles principales.

## Checklist Manual

Servidor local recomendado, sin dependencias nuevas:

```powershell
python -m http.server 4173
```

Abrir:

```text
http://localhost:4173
```

### 1. Ver detalle de plato

1. Entrar en Home.
2. Pulsar un plato de la lista.
3. Confirmar que abre `dish-detail`.
4. Confirmar que se ven ingredientes, coste, formatos y acciones.

Resultado esperado: el detalle se muestra sin errores visuales ni consola roja.

### 2. Volver al home

1. Desde `dish-detail`, pulsar `Volver`.
2. Confirmar que vuelve a Home.
3. Confirmar que la navegacion inferior se ve correctamente.

Resultado esperado: Home queda activo y la lista de platos sigue visible.

### 3. Aplicar nuevo precio

1. Desde `dish-detail`, pulsar `Calcular precio recomendado`.
2. Confirmar que abre `ai-price`.
3. Pulsar `Aplicar nuevo precio`.
4. Confirmar que vuelve a `dish-detail`.
5. Confirmar que aparece una notificacion de precio aplicado.

Resultado esperado: el handler principal usa `data-action` y no depende solo del texto.

### 4. Editar manualmente

1. Desde `ai-price`, pulsar `Editar manualmente`.
2. Confirmar que abre `edit-recipe`.
3. Confirmar que se ven receta base, rendimiento y formatos de venta.

Resultado esperado: el usuario aterriza en el editor manual sin aplicar precio.

### 5. Aplicar precios sugeridos

1. Desde Home, pulsar la alerta de margen.
2. Confirmar que abre `ingredient-alert`.
3. Pulsar `Aplicar precios sugeridos`.
4. Confirmar que vuelve a `dish-detail`.

Resultado esperado: el mismo handler cubre el flujo de alerta y el flujo de precio IA.

### 6. Registrar venta

1. Ir a `Estadisticas`.
2. Seleccionar plato, formato y unidades.
3. Pulsar `Guardar ventas`.
4. Confirmar que se actualiza el resumen o la lista de mas vendidas.

Resultado esperado: se registra venta en modo local sin romper navegacion.

### 7. Registrar compra

1. Desde `Estadisticas`, pulsar `Registrar compra`.
2. Rellenar producto, cantidad, unidad y total.
3. Pulsar `Guardar compra`.
4. Confirmar que aparece en ultimas compras y que vuelve a calcular costes.

Resultado esperado: la compra se guarda en estado local y actualiza el coste del ingrediente.

### 8. Movil 375px y 430px

Probar con DevTools o con el navegador redimensionado:

- 375 x 812.
- 430 x 932.

Comprobar:

- No hay scroll horizontal.
- Bottom nav visible en Home y QR.
- Botones principales no se cortan.
- Las tarjetas de plato no rompen layout.
- `ai-price`, `edit-recipe`, `stats` y `purchases` son usables.

## Riesgos Pendientes

- La validacion sigue siendo estatica/manual; no detecta eventos rotos en runtime como lo haria Playwright.
- Hay handlers legacy por texto en `script.js`; se conservan como fallback hasta que el flujo este cubierto por tests de navegador.
- Las pantallas `stats` y `purchases` se inyectan dinamicamente desde `ops-actions.js`, por lo que un futuro cambio de orden de scripts podria romperlas.
- La prueba movil real queda en checklist porque no se han anadido dependencias de navegador.

## Criterio de Aprobacion Sprint 3.7

- `node tests/cost-engine.test.js` pasa.
- `node tests/sprint3-functional-smoke.test.js` pasa.
- Checklist manual completada en desktop, 375px y 430px.
- Sin cambios en Carta QR, Supabase/RLS o logica de negocio.
