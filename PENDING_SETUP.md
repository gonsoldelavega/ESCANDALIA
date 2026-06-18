# ⏳ Pendiente de configuración

## Traducción de la carta con IA — activar en producción

La función de **traducir la carta con IA** (Google Translate) ya está
implementada en el código, pero **no funcionará en producción** hasta completar
estos pasos manuales:

1. **Google Cloud** → activar la **"Cloud Translation API"** en el proyecto.
2. **Vercel** → añadir la variable de entorno **`GOOGLE_TRANSLATE_API_KEY`**
   (o reutilizar `GOOGLE_VISION_API_KEY` si esa clave tiene Translation activado).
3. **(Después) Persistencia** → para que las traducciones lleguen a cualquier
   cliente que escanee el QR (no solo al dispositivo del dueño), guardar
   `dish.translations` en Supabase (columna nueva `translations` tipo `jsonb`).

> Mientras esto no esté hecho: el botón "Traducir carta con IA" dará el error
> "Falta GOOGLE_TRANSLATE_API_KEY", y las traducciones solo se cachean en el
> dispositivo del dueño.

**Cuando esté hecho:** borra este archivo y el hook `SessionStart` de
`.claude/settings.json` para dejar de recibir el recordatorio.
