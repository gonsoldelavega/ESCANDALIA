# Escandalia

Prototipo cloud-first de Escandalia, una app mobile-first para bares, cafeterías y restaurantes que ayuda a controlar escandallos, márgenes, alertas de subida de ingredientes y carta QR pública.

## Estado actual

- Prototipo visual navegable en HTML, CSS y JavaScript.
- Dirección visual premium, cálida y mediterránea.
- Pantallas incluidas: Dashboard, detalle de escandallo, Carta QR, añadir plato, editar receta, alerta de ingrediente, sugerencia IA y carta pública.
- Primer motor de cálculo en frontend para costes, márgenes, alertas y PVP recomendado.
- Esquema inicial de Supabase preparado en `supabase/schema.sql`.

## Funcionalidades

- **Escandallos y rentabilidad real:** coste por materia prima con **merma**,
  **IVA de hostelería**, coste de **personal** (minutos de elaboración) y gastos
  fijos → food cost %, margen bruto, margen real y beneficio por ración.
- **Análisis de carta (menu engineering):** clasifica cada plato en Estrella /
  Caballo de batalla / Puzzle / Perro cruzando ventas y rentabilidad.
- **Centro de avisos proactivos:** platos bajo margen, food cost alto, sin
  receta, publicados sin descripción, ingredientes sin actualizar y estimación
  del sobrecoste del periodo.
- **Costes y compras:** edición manual, registro de compras con conversión de
  unidades (L/kg → ml/g) y escaneo de facturas por OCR (Google Vision).
- **Ventas y caja:** registro diario y tapas más vendidas.
- **Listado de platos:** pantalla buscable con los platos agrupados por
  categoría, márgenes y estado (borrador/publicado).
- **Carta pública + QR:** QR real generado en el cliente (sin dependencias),
  categorías dinámicas, alérgenos en chips y **carta multilingüe** (ES/EN/FR)
  con traducciones editables por plato.
- **Onboarding:** panel de bienvenida en el primer arranque para configurar
  negocio, margen e IVA y crear el primer plato.
- **Ajustes editables:** negocio, URL, margen objetivo, IVA, personal y gastos.
- **Multi-local y roles:** varios negocios por dispositivo y roles
  dueño / encargado / cocina con permisos.
- **PWA:** instalable y con funcionamiento offline (service worker).

## Tests

Sin dependencias externas: `node tests/cost-engine.test.js`,
`node tests/rentabilidad.test.js`, `node tests/qr.test.js` y
`node tests/sprint3-functional-smoke.test.js`. Se ejecutan también en CI
(GitHub Actions) en cada push y PR.

## Web pública

https://escandalia.vercel.app/

## Supabase

1. Crear un proyecto nuevo en Supabase.
2. Abrir SQL Editor.
3. Ejecutar `supabase/schema.sql` y luego las migraciones de `supabase/`
   (`ops-migration.sql`, `recipe-yields-migration.sql` y
   `enhancements-migration.sql` para IVA/merma/personal y roles multi-usuario).
4. En Project Settings > API, copiar:
   - Project URL
   - anon public key
5. Configurar esas variables en Vercel cuando conectemos la app real:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

Importante: no compartir ni guardar en el repositorio la `service_role key`.

## Cómo editar

Clonar el repositorio con GitHub Desktop, hacer cambios, commit y push a `main`. Vercel redespliega automáticamente.
