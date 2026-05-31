// api/scan-invoice.js — OCR de facturas de proveedor con Claude (visión).
// Recibe una imagen de factura + la lista de ingredientes del negocio,
// y devuelve las líneas detectadas ya emparejadas con ingredientes existentes.

const MODEL = "claude-sonnet-4-6";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB tras decodificar base64

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Falta ANTHROPIC_API_KEY en el servidor." });
  }

  try {
    const { image, mediaType, ingredients } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "Falta la imagen de la factura." });
    }
    const cleanBase64 = image.includes(",") ? image.split(",").pop() : image;
    const approxBytes = Math.floor(cleanBase64.length * 0.75);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "La imagen es demasiado grande. Usa una foto de menos de 5 MB." });
    }
    const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const type = supportedTypes.includes(mediaType) ? mediaType : "image/jpeg";

    const ingredientList = Array.isArray(ingredients) ? ingredients : [];
    const catalog = ingredientList
      .map((ing) => `- id="${ing.id}" | "${ing.name}" | unidad de precio: ${ing.displayUnit}`)
      .join("\n");

    const systemPrompt = `Eres un asistente de hostelería que lee facturas de proveedores de un bar o restaurante y extrae los precios de los productos.

Tienes el catálogo de ingredientes que el negocio ya tiene registrados:
${catalog || "(sin ingredientes registrados todavía)"}

Tu tarea:
1. Lee la factura de la imagen.
2. Por cada línea de producto, extrae: nombre del producto en la factura, precio unitario y su unidad (kg, L, ud, etc.).
3. Normaliza el precio a la unidad de precio del ingrediente correspondiente del catálogo (por ejemplo: si la factura da €/caja de 12 ud y el ingrediente se mide por "ud", calcula el €/ud; si da €/garrafa de 5 L y el ingrediente se mide por "L", calcula el €/L).
4. Empareja cada línea con un ingrediente del catálogo por id usando coincidencia semántica (p.ej. "A.O.V.E. Picual 5L" → "Aceite de oliva"). Si no hay coincidencia clara, deja matchedId en null.

Responde SOLO con JSON válido, sin texto adicional, con esta forma exacta:
{"lines":[{"invoiceName":"texto de la factura","matchedId":"id o null","matchedName":"nombre del catálogo o null","pricePerUnit":number,"unit":"kg|L|ud|...","confidence":0.0-1.0}]}`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: type, data: cleanBase64 } },
              { type: "text", text: "Extrae las líneas de producto y sus precios de esta factura. Responde solo con el JSON indicado." },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error("Anthropic error", anthropicRes.status, detail);
      return res.status(502).json({ error: "No se pudo procesar la factura. Inténtalo de nuevo." });
    }

    const data = await anthropicRes.json();
    const text = (data.content || []).map((block) => block.text || "").join("").trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: "No se pudieron leer datos de la factura." });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
    return res.status(200).json({ lines });
  } catch (error) {
    console.error("scan-invoice error", error);
    return res.status(500).json({ error: "Error procesando la factura." });
  }
}
