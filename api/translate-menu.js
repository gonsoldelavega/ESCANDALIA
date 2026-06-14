// api/translate-menu.js — Traducción de la carta con Google Cloud Translation.
// Recibe los platos de la carta y un idioma destino (en/fr/de) y devuelve los
// textos traducidos (nombre, descripción, alérgenos). Una sola llamada por
// idioma: aplana todos los campos en un array y los reparte de vuelta.

const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";
const ALLOWED_TARGETS = { en: true, fr: true, de: true };
const FIELDS = ["name", "description", "allergens"];
const MAX_SEGMENTS = 300; // límite de seguridad por llamada

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Falta GOOGLE_TRANSLATE_API_KEY en el servidor." });
  }

  try {
    const { items, target, source = "es" } = req.body || {};
    if (!ALLOWED_TARGETS[target]) {
      return res.status(400).json({ error: "Idioma de destino no soportado." });
    }
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "No hay textos que traducir." });
    }

    // Aplana los campos con texto en un solo array y guarda dónde va cada uno.
    const segments = [];
    const map = [];
    items.forEach((item, i) => {
      FIELDS.forEach((field) => {
        const value = item && typeof item[field] === "string" ? item[field].trim() : "";
        if (value) {
          segments.push(value);
          map.push({ i, field });
        }
      });
    });

    if (!segments.length) {
      return res.status(200).json({ translations: items.map(() => ({})) });
    }
    if (segments.length > MAX_SEGMENTS) {
      return res.status(413).json({ error: "Carta demasiado larga para traducir de una vez." });
    }

    const gRes = await fetch(`${TRANSLATE_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: segments, target, source, format: "text" }),
    });

    if (!gRes.ok) {
      const detail = await gRes.text();
      console.error("translate-menu Google error", gRes.status, detail);
      return res.status(502).json({ error: "No se pudo traducir la carta. Inténtalo de nuevo." });
    }

    const data = await gRes.json();
    const translated = (data && data.data && data.data.translations) ? data.data.translations.map((t) => t.translatedText) : [];

    const out = items.map(() => ({}));
    map.forEach((slot, idx) => {
      out[slot.i][slot.field] = translated[idx] || "";
    });
    return res.status(200).json({ translations: out });
  } catch (error) {
    console.error("translate-menu error", error);
    return res.status(500).json({ error: "Error traduciendo la carta." });
  }
}
