# Escandalia

Prototipo cloud-first de Escandalia, una app mobile-first para bares, cafeterías y restaurantes que ayuda a controlar escandallos, márgenes, alertas de subida de ingredientes y carta QR pública.

## Estado actual

- Prototipo visual navegable en HTML, CSS y JavaScript.
- Dirección visual premium, cálida y mediterránea.
- Pantallas incluidas: Dashboard, detalle de escandallo, Carta QR, añadir plato, editar receta, alerta de ingrediente, sugerencia IA y carta pública.
- Primer motor de cálculo en frontend para costes, márgenes, alertas y PVP recomendado.
- Esquema inicial de Supabase preparado en `supabase/schema.sql`.

## Web pública

https://escandalia.vercel.app/

## Supabase

1. Crear un proyecto nuevo en Supabase.
2. Abrir SQL Editor.
3. Ejecutar el contenido de `supabase/schema.sql`.
4. En Project Settings > API, copiar:
   - Project URL
   - anon public key
5. Configurar esas variables en Vercel cuando conectemos la app real:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

Importante: no compartir ni guardar en el repositorio la `service_role key`.

## Cómo editar

Clonar el repositorio con GitHub Desktop, hacer cambios, commit y push a `main`. Vercel redespliega automáticamente.
