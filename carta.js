/* ==========================================================================
 * carta.js — Carta pública mejorada + QR real.
 *
 *   - Genera un QR real (qr-engine.js) que apunta a la carta pública y permite
 *     descargarlo como PNG.
 *   - Categorías dinámicas: las pestañas de la carta pública salen de las
 *     categorías reales de los platos publicados y filtran de verdad.
 *   - Alérgenos como chips en lugar de texto plano.
 *
 * Depende de: dishes, business, currency, escapeHtml, renderQr,
 * renderPublicMenu, qrMatrix, renderQrInto. Carga DESPUÉS de render-engine.js.
 * ========================================================================== */

let publicMenuCategory = 'Todas';

function publicMenuUrl() {
  if (typeof location === 'undefined') return `https://escandalia.app/${business.slug}`;
  return `${location.origin}${location.pathname}#public-menu`;
}

function splitAllergens(text) {
  return String(text || '')
    .split(/[,;·|/]| y /i)
    .map((part) => part.trim())
    .filter(Boolean);
}

// ── QR real en la pantalla de carta ──────────────────────────────────
if (typeof renderQr === 'function') {
  const previousRenderQr = renderQr;
  renderQr = function renderQrWithRealCode() {
    previousRenderQr();
    const box = document.querySelector('[data-screen="qr"] .qr-box');
    if (box && typeof renderQrInto === 'function') renderQrInto(box, publicMenuUrl());
  };
}

function downloadQr() {
  const canvas = document.querySelector('[data-screen="qr"] .qr-box canvas');
  if (!canvas) return showSync?.('El QR aún no está listo');
  const link = document.createElement('a');
  link.download = `carta-${business.slug || 'escandalia'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showSync?.('QR descargado');
}

// ── Carta pública con categorías reales y alérgenos en chips ──────────
if (typeof renderPublicMenu === 'function') {
  renderPublicMenu = function renderPublicMenuByCategory() {
    const header = document.querySelector('.public-header h1');
    if (header) header.textContent = business.name;
    const content = document.querySelector('[data-screen="public-menu"] .content');
    if (!content) return;
    const published = dishes.filter((dish) => dish.published);
    const categories = [...new Set(published.map((dish) => dish.category || 'Otros'))];
    const tabs = ['Todas', ...categories];
    if (!tabs.includes(publicMenuCategory)) publicMenuCategory = 'Todas';
    const visible = published.filter((dish) => publicMenuCategory === 'Todas' || (dish.category || 'Otros') === publicMenuCategory);
    const items = visible.length
      ? visible.map((dish) => {
          const allergens = splitAllergens(dish.allergens);
          const chips = allergens.length
            ? `<div class="menu-allergens">${allergens.map((a) => `<span class="allergen-chip">${escapeHtml(a)}</span>`).join('')}</div>`
            : '';
          return `<article class="menu-item"><div><h3>${escapeHtml(dish.name)}</h3><p>${escapeHtml(dish.description || 'Descripción pendiente.')}</p>${chips}</div><strong>${currency(dish.pvp)}</strong></article>`;
        }).join('')
      : '<div class="empty-note">No hay platos en esta categoría.</div>';
    content.innerHTML = `<div class="category-tabs">${tabs.map((cat) => `<button class="${cat === publicMenuCategory ? 'is-selected' : ''}" type="button" data-public-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`).join('')}</div>${items}`;
  };
}

document.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-public-category]');
  if (tab) {
    event.preventDefault();
    publicMenuCategory = tab.dataset.publicCategory || 'Todas';
    renderPublicMenu();
    return;
  }
  const dl = event.target.closest('[data-screen="qr"] .primary-button');
  if (dl && dl.textContent.trim() === 'Descargar QR') {
    event.preventDefault();
    downloadQr();
  }
});

if (typeof renderAll === 'function') renderAll();
