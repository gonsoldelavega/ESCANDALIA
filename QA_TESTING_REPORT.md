# Informe de testing y mejoras — Escandalia

Testeo de la app "actuando como un negocio" (un bar real dando de alta platos,
recetas, costes, compras, ventas y carta pública). Se simuló el recorrido
completo en un navegador móvil (390×844) además de los tests unitarios y de
humo existentes. A continuación, los errores encontrados, su gravedad y la
solución aplicada en esta rama.

## Resumen

- **19 comprobaciones** de flujo de negocio; **8 fallaban** antes de los cambios.
- Tras los arreglos: **18/19 en verde**. El único restante es un artefacto del
  entorno local (no existe `/api` al servir con un servidor estático); en
  producción (Vercel) esos endpoints sí responden.
- Tests existentes siguen pasando: `cost-engine` 46/46 y `sprint3-smoke` 18/18.

## Errores encontrados y soluciones

### Críticos

1. **Toda la sección de Ventas/Compras era inalcanzable.**
   Las pantallas `stats` (Estadísticas: ventas, caja, tapas más vendidas) y
   `purchases` (Compras) existían pero la barra inferior solo tenía 3 botones
   (Inicio/Platos/Costes). El código intentaba reconvertir un botón "Ajustes"
   que no existía en la barra, así que nunca se generaba el acceso.
   → **Solución:** añadida la pestaña **Ventas** (`data-go="stats"`) a la barra
   inferior y ajustado el grid a 4 columnas. Compras es accesible desde Ventas.

2. **La pantalla "Revisar compra" corrompía los costes a 0.**
   El editor de costes mostraba los ingredientes en gramos/ml sin escalar a
   kg/L (aparecía "0,00" para las patatas) y al guardar los interpretaba en la
   unidad base, dejando el coste en **0 €**. Esto falseaba todos los escandallos.
   → **Solución:** display y guardado usan el mismo factor de escala
   (`displayScale`): g/ml se muestran y editan por kg/L y se reconvierten a la
   unidad base al guardar.

3. **XSS almacenado (inyección de HTML/JS).**
   Nombres y descripciones de platos e ingredientes se insertaban con
   `innerHTML` sin escapar. Un nombre como `<img src=x onerror=...>` ejecutaba
   JavaScript, incluida la **carta pública** que ven los clientes.
   → **Solución:** helper `escapeHtml` aplicado a todo texto controlado por el
   usuario en dashboard, detalle, escandallos, costes, alertas, compras, ventas
   y carta pública.

### Altos

4. **Colisión de IDs por slug.**
   "Café solo" y "Cafe solo" (o cualquier par que normalice igual) generaban el
   mismo `id`, produciendo dos platos con identificador idéntico: editar o
   borrar uno afectaba al otro.
   → **Solución:** helper `uniqueId` que añade sufijo incremental
   (`cafe-solo`, `cafe-solo-2`, …).

5. **Comprar en formato grande (L/kg) disparaba los escandallos.**
   Registrar "5 L de aceite por 40 €" guardaba 8 €/L como si fuera €/ml, y el
   coste de las gambas pasaba de ~1 € a **285 €**.
   → **Solución:** helper `normalizePurchaseUnit` convierte la compra a la
   unidad base (g/ml) antes de actualizar el coste del ingrediente.

6. **"Aplicar precios sugeridos" solo corregía 1 plato.**
   Desde la alerta de ingrediente, el botón en plural aplicaba el nuevo PVP
   únicamente al primer plato afectado; el resto seguía por debajo de margen.
   → **Solución:** desde la pantalla de alerta ahora aplica el PVP sugerido a
   **todos** los platos afectados; desde ai-price/detalle sigue afectando a uno.

7. **No se podían publicar los platos nuevos.**
   Los platos se creaban con `published:false` y no había ningún control para
   sacarlos a la carta pública.
   → **Solución:** botón **Publicar / Quitar de la carta** en el detalle del
   plato, sincronizado con Supabase cuando hay sesión.

### Medios

8. **Sin persistencia al trabajar sin sesión.**
   En modo local (el que se ve por defecto sin login), recargar la página
   perdía todo el trabajo introducido.
   → **Solución:** persistencia en `localStorage` para el modo local; el estado
   de Supabase no se ve afectado.

9. **Escaneo de factura mostraba un error técnico crudo.**
   Si el backend no respondía JSON, el usuario veía `Unexpected token '<'`.
   → **Solución:** mensaje claro ("El escaneo no está disponible ahora mismo,
   puedes editar los costes a mano").

## Pendientes / recomendaciones (no incluidas en este cambio)

- **Calibración del margen objetivo (75% bruto):** con costes de materia prima
  altos genera PVP poco realistas (p. ej. gambas → 21,55 €). Conviene un tope de
  cordura o avisar cuando la sugerencia se dispara respecto al PVP actual.
- **Arquitectura de parches:** hay funciones redefinidas varias veces
  (`numberFromInput`, `currency`, múltiples capas de `applyRecommendedPrice`) y
  dos `setInterval` mutando la barra de navegación cada 500/700 ms. Sería sano
  consolidar en módulos y eliminar el código muerto.
- **Botón "Platos" de la barra** abre directamente el detalle del plato
  seleccionado en vez de una lista; conviene una pantalla de listado.
