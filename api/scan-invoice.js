// api/scan-invoice.js — OCR de facturas de proveedor.
// Lee el texto con Google Cloud Vision (1.000 gratis/mes) y empareja las
// líneas con los ingredientes del negocio mediante coincidencia de texto
// pura (sin IA, coste 0). El usuario revisa y corrige antes de aplicar.

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB tras decodificar base64
const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Falta GOOGLE_VISION_API_KEY en el servidor." });
  }

  try {
    const { image, ingredients } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "Falta la imagen de la factura." });
    }
    const cleanBase64 = image.includes(",") ? image.split(",").pop() : image;
    const approxBytes = Math.floor(cleanBase64.length * 0.75);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "La imagen es demasiado grande. Usa una foto de menos de 8 MB." });
    }

    const visionRes = await fetch(`${VISION_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: cleanBase64 },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: { languageHints: ["es", "en"] },
          },
        ],
      }),
    });

    if (!visionRes.ok) {
      const detail = await visionRes.text();
      console.error("Vision error", visionRes.status, detail);
      return res.status(502).json({ error: "No se pudo leer la factura. Inténtalo de nuevo." });
    }

    const data = await visionRes.json();
    const fullText = data?.responses?.[0]?.fullTextAnnotation?.text || "";
    if (!fullText.trim()) {
      return res.status(200).json({ lines: [], rawText: "" });
    }

    const catalog = Array.isArray(ingredients) ? ingredients : [];
    const lines = parseInvoiceLines(fullText, catalog);
    return res.status(200).json({ lines, rawText: fullText });
  } catch (error) {
    console.error("scan-invoice error", error);
    return res.status(500).json({ error: "Error procesando la factura." });
  }
}

// ─── Parsing de líneas ──────────────────────────────────────────────────

function parseNumber(raw) {
  let n = raw.replace(/\s/g, "");
  // 1.234,56 → 1234.56 ; 1,234.56 → 1234.56 ; 7,20 → 7.20
  if (n.includes(",") && n.includes(".")) {
    n = n.lastIndexOf(",") > n.lastIndexOf(".") ? n.replace(/\./g, "").replace(",", ".") : n.replace(/,/g, "");
  } else if (n.includes(",")) {
    n = n.replace(",", ".");
  }
  return parseFloat(n);
}

/** Precios de una línea: solo números con 2 decimales (descarta 5L, 2KG, 40/60). */
function extractPrices(text) {
  const matches = text.match(/\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}|\d+[.,]\d{2}/g) || [];
  return matches.map(parseNumber).filter((n) => Number.isFinite(n) && n > 0);
}

/** Cualquier número de la línea (para detectar que hay datos de precio). */
function hasAnyDecimal(text) {
  return /\d+[.,]\d{2}/.test(text);
}

/** Parte el texto OCR en líneas-candidato {invoiceName, prices, raw}. */
function parseInvoiceLines(fullText, catalog) {
  const rawLines = fullText.split("\n").map((l) => l.trim()).filter(Boolean);
  const results = [];
  let key = 0;
  for (const raw of rawLines) {
    const letters = (raw.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/g) || []).length;
    if (letters < 3) continue; // descarta líneas sin nombre de producto
    if (!hasAnyDecimal(raw)) continue; // sin precio con decimales no es línea de producto
    const prices = extractPrices(raw);
    if (!prices.length) continue;
    const invoiceName = raw
      .replace(/\d[\d.,/]*\s*(kg|kgs|gr|g|gramos|l|lt|ltr|litros|ml|cl|ud|uds|unid|u|caja|cajas|bote|botes|pack|docena)?\b/gi, " ")
      .replace(/[€$%]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (invoiceName.length < 3) continue;
    const match = bestMatch(invoiceName, catalog);
    // Precio unitario: el menor de los precios con decimales de la línea
    // (en facturas el unitario suele ser < total). El usuario lo corrige.
    const candidate = Math.min(...prices);
    results.push({
      key: key++,
      invoiceName,
      matchedId: match?.id || null,
      matchedName: match?.name || null,
      pricePerUnit: round2(candidate),
      unit: match?.displayUnit || "",
      confidence: match?.score || 0,
      allPrices: prices.map(round2),
    });
  }
  return results;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// ─── Emparejado fuzzy contra el catálogo ────────────────────────────────

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text) {
  return normalize(text).split(" ").filter((t) => t.length >= 3);
}

/** Mejor ingrediente del catálogo para un nombre de factura, o null. */
function bestMatch(invoiceName, catalog) {
  const invTokens = tokens(invoiceName);
  const invNorm = normalize(invoiceName);
  if (!invTokens.length || !catalog.length) return null;
  let best = null;
  for (const ing of catalog) {
    const ingTokens = tokens(ing.name);
    if (!ingTokens.length) continue;
    let score = 0;
    // Coincidencia de tokens en ambos sentidos
    for (const it of ingTokens) {
      if (invNorm.includes(it)) score += 1;
    }
    for (const it of invTokens) {
      if (normalize(ing.name).includes(it)) score += 0.5;
    }
    // Normaliza por tamaño del nombre del ingrediente
    const ratio = score / ingTokens.length;
    if (!best || ratio > best.ratio) {
      best = { id: ing.id, name: ing.name, displayUnit: ing.displayUnit, ratio, score: Math.min(ratio, 1) };
    }
  }
  // Umbral: al menos una coincidencia fuerte de token
  return best && best.ratio >= 0.5 ? best : null;
}
