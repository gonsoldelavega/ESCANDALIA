/* ==========================================================================
 * invoice-scan.js — Escaneo de facturas de proveedor con OCR (Claude).
 *
 * Flujo: subir foto → /api/scan-invoice → revisar coincidencias → aplicar.
 *
 * Depende de globals: ingredients, currency, ingDisplayUnit, saveIngredientPrice,
 *   showScreen, showSync, renderAll, useSupabase, session, supabase.
 * Carga DESPUÉS de script.js y render-engine.js.
 * ========================================================================== */

let invoiceLines = [];

/** Redimensiona una imagen a un máximo de lado y devuelve base64 JPEG. */
function resizeImageToBase64(file, maxSide = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", quality), mediaType: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Lista de ingredientes en el formato que espera el backend. */
function ingredientCatalogForScan() {
  return Object.entries(ingredients).map(([id, ing]) => ({
    id,
    name: ing.name,
    displayUnit: ingDisplayUnit(ing),
  }));
}

async function handleInvoiceFile(file) {
  if (!file) return;
  showInvoiceStatus("Leyendo la factura…", true);
  try {
    const { dataUrl } = await resizeImageToBase64(file);
    const res = await fetch("/api/scan-invoice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: dataUrl, ingredients: ingredientCatalogForScan() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo leer la factura.");
    invoiceLines = (data.lines || []).map((line, index) => ({
      ...line,
      include: Boolean(line.matchedId) && Number(line.pricePerUnit) > 0,
      key: index,
    }));
    if (!invoiceLines.length) {
      showInvoiceStatus("No se detectaron productos en la imagen. Prueba con una foto más nítida.", false);
      return;
    }
    showScreen("invoice-review");
    renderInvoiceReview();
  } catch (error) {
    console.error(error);
    showInvoiceStatus(error.message || "Error al leer la factura.", false);
  }
}

/** Opciones <option> de ingredientes ordenadas por nombre. */
function ingredientSelectOptions(selectedId) {
  return Object.entries(ingredients)
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([id, ing]) => `<option value="${id}" ${id === selectedId ? "selected" : ""}>${ing.name}</option>`)
    .join("");
}

/** Chips para elegir otro número detectado en la línea, si el heurístico falló. */
function alternatePriceChips(line, current) {
  const others = (line.allPrices || []).filter((p) => Math.abs(p - current) > 0.001);
  if (others.length < 1) return "";
  const unique = [...new Set(others)].slice(0, 4);
  return `<div class="invoice-alt-prices">¿Otro precio? ${unique.map((p) => `<button type="button" class="alt-price-chip" data-alt-price="${line.key}" data-alt-value="${p}">${currency(p)}</button>`).join("")}</div>`;
}

function showInvoiceStatus(message, busy) {
  const node = document.querySelector(".invoice-status");
  if (!node) return showSync?.(message);
  node.textContent = message;
  node.classList.toggle("is-busy", Boolean(busy));
  node.classList.remove("is-hidden");
}

function renderInvoiceReview() {
  const screen = document.querySelector("[data-screen='invoice-review']");
  if (!screen) return;
  const list = screen.querySelector(".invoice-lines");
  if (!invoiceLines.length) {
    list.innerHTML = '<div class="empty-note">Sin líneas para revisar.</div>';
    return;
  }
  list.innerHTML = invoiceLines.map((line) => {
    const ing = line.matchedId ? ingredients[line.matchedId] : null;
    const oldPrice = ing ? (ing.unit === "g" || ing.unit === "ml" ? ing.current * 1000 : ing.current) : null;
    const newPrice = Number(line.pricePerUnit) || 0;
    const unit = ing ? ingDisplayUnit(ing) : line.unit || "";
    const rise = oldPrice && oldPrice > 0 ? (newPrice - oldPrice) / oldPrice : 0;
    const riseBadge = oldPrice ? `<span class="ing-change ${rise > 0 ? "ing-up" : rise < 0 ? "ing-down" : ""}">${rise > 0 ? "+" : ""}${Math.round(rise * 100)}%</span>` : '<span class="ing-change">nuevo</span>';
    const options = `<option value="">— Sin asignar —</option>${ingredientSelectOptions(line.matchedId)}`;
    return `<article class="invoice-line ${line.include ? "" : "is-excluded"}" data-line="${line.key}">
      <label class="invoice-check"><input type="checkbox" data-invoice-include="${line.key}" ${line.include ? "checked" : ""} ${ing ? "" : "disabled"} /></label>
      <div class="invoice-line-body">
        <div class="invoice-line-top"><select class="invoice-match-select" data-invoice-match="${line.key}">${options}</select>${riseBadge}</div>
        <p class="invoice-line-sub">Factura: ${line.invoiceName || "—"}</p>
        <div class="invoice-line-prices">
          ${oldPrice != null ? `<span>${currency(oldPrice)}/${unit}</span><span class="invoice-arrow">→</span>` : ""}
          <input class="invoice-price-input" type="number" inputmode="decimal" step="0.01" value="${newPrice.toFixed(2)}" data-invoice-price="${line.key}" /><span class="invoice-unit">€/${unit}</span>
        </div>
        ${alternatePriceChips(line, newPrice)}
      </div>
    </article>`;
  }).join("");
  const count = invoiceLines.filter((l) => l.include).length;
  const applyBtn = screen.querySelector(".invoice-apply");
  if (applyBtn) applyBtn.textContent = count ? `Aplicar ${count} precio${count !== 1 ? "s" : ""}` : "Selecciona productos";
}

async function applyInvoicePrices() {
  const toApply = invoiceLines.filter((l) => l.include && l.matchedId && Number(l.pricePerUnit) > 0);
  if (!toApply.length) return showSync?.("No hay precios seleccionados.");
  for (const line of toApply) {
    await saveIngredientPrice(line.matchedId, String(line.pricePerUnit));
  }
  invoiceLines = [];
  showScreen("ingredient-list");
  showSync?.(`${toApply.length} precio${toApply.length !== 1 ? "s actualizados" : " actualizado"} desde la factura`);
}

document.addEventListener("change", (event) => {
  const fileInput = event.target.closest("#invoice-file");
  if (fileInput) { handleInvoiceFile(fileInput.files[0]); fileInput.value = ""; return; }
  const include = event.target.closest("[data-invoice-include]");
  if (include) {
    const line = invoiceLines.find((l) => l.key === Number(include.dataset.invoiceInclude));
    if (line) line.include = include.checked;
    renderInvoiceReview();
    return;
  }
  const matchSelect = event.target.closest("[data-invoice-match]");
  if (matchSelect) {
    const line = invoiceLines.find((l) => l.key === Number(matchSelect.dataset.invoiceMatch));
    if (line) {
      line.matchedId = matchSelect.value || null;
      line.include = Boolean(line.matchedId) && Number(line.pricePerUnit) > 0;
    }
    renderInvoiceReview();
    return;
  }
  const price = event.target.closest("[data-invoice-price]");
  if (price) {
    const line = invoiceLines.find((l) => l.key === Number(price.dataset.invoicePrice));
    if (line) line.pricePerUnit = parseFloat(String(price.value).replace(",", ".")) || 0;
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".invoice-scan-trigger")) {
    event.preventDefault();
    document.querySelector("#invoice-file")?.click();
    return;
  }
  const altChip = event.target.closest("[data-alt-price]");
  if (altChip) {
    event.preventDefault();
    const line = invoiceLines.find((l) => l.key === Number(altChip.dataset.altPrice));
    if (line) line.pricePerUnit = parseFloat(altChip.dataset.altValue);
    renderInvoiceReview();
    return;
  }
  if (event.target.closest(".invoice-apply")) {
    event.preventDefault();
    applyInvoicePrices();
  }
});
