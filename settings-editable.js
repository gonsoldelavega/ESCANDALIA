/* ==========================================================================
 * settings-editable.js — Ajustes editables del negocio.
 *
 * Convierte la pantalla de Ajustes (antes solo lectura) en un formulario para
 * editar nombre, URL de carta, margen objetivo, IVA, tarifa de personal y
 * gastos fijos. Guarda en Supabase (si hay sesión) y en localStorage.
 *
 * Depende de: business, session, percent, slugify, renderAll, saveLocalState,
 * showSync, useSupabase, supabase, businessId.
 * Carga DESPUÉS de product-actions.js.
 * ========================================================================== */

function settingsFieldValue(id) {
  const node = document.querySelector(`[data-setting="${id}"]`);
  return node ? node.value : '';
}

async function saveBusinessSettings() {
  const name = settingsFieldValue('name').trim() || business.name;
  const slugRaw = settingsFieldValue('slug').trim();
  const slug = slugRaw ? slugify(slugRaw) : business.slug;
  const targetMargin = Math.min(Math.max(numberFromInput(settingsFieldValue('target'), business.targetMargin * 100) / 100, 0), 0.95);
  const taxRate = Math.min(Math.max(numberFromInput(settingsFieldValue('tax'), businessTaxRate() * 100) / 100, 0), 0.5);
  const laborRatePerHour = Math.max(numberFromInput(settingsFieldValue('labor'), business.laborRatePerHour || 0), 0);
  const overheadRate = Math.min(Math.max(numberFromInput(settingsFieldValue('overhead'), (business.overheadRate || 0) * 100) / 100, 0), 0.6);

  Object.assign(business, { name, slug, targetMargin, taxRate, laborRatePerHour, overheadRate });

  if (typeof useSupabase !== 'undefined' && useSupabase && session && supabase && businessId) {
    // target_margin existe; el resto de columnas puede no existir → ignorar error.
    await supabase.from('businesses').update({ name, slug, target_margin: targetMargin }).eq('id', businessId).then(() => {}, () => {});
    await supabase.from('businesses').update({ tax_rate: taxRate, labor_rate_per_hour: laborRatePerHour, overhead_rate: overheadRate }).eq('id', businessId).then(() => {}, () => {});
  }
  if (typeof saveLocalState === 'function') saveLocalState();
  renderAll();
  showSync?.('Ajustes guardados');
}

function renderSettingsForm() {
  const content = document.querySelector('[data-screen="settings"] .settings-content');
  if (!content) return;
  const email = session?.user?.email || 'Sin sesión (modo local)';
  const cloud = session?.user ? 'Datos guardados en la nube' : 'Trabajando sin sesión: los datos se guardan en este dispositivo';
  content.innerHTML = `
    <article class="settings-card">
      <span class="settings-kicker">Negocio</span>
      <label class="settings-field">Nombre del bar<input data-setting="name" value="${escapeHtml(business.name)}" /></label>
      <label class="settings-field">URL de la carta<div class="settings-url"><span>escandalia.app/</span><input data-setting="slug" value="${escapeHtml(business.slug)}" /></div></label>
    </article>
    <article class="settings-card">
      <span class="settings-kicker">Rentabilidad</span>
      <label class="settings-field">Margen objetivo (%)<input data-setting="target" inputmode="decimal" value="${Math.round(business.targetMargin * 100)}" /></label>
      <p class="settings-hint">Escandalia avisa cuando un plato baja de este margen bruto.</p>
      <label class="settings-field">IVA aplicado (%)<input data-setting="tax" inputmode="decimal" value="${Math.round(businessTaxRate() * 100)}" /></label>
      <p class="settings-hint">Hostelería en España suele ser 10%. Se usa para el margen real.</p>
    </article>
    <article class="settings-card">
      <span class="settings-kicker">Costes de estructura (opcional)</span>
      <label class="settings-field">Coste de personal por hora (€)<input data-setting="labor" inputmode="decimal" value="${business.laborRatePerHour || 0}" /></label>
      <label class="settings-field">Gastos fijos imputados (% de venta)<input data-setting="overhead" inputmode="decimal" value="${Math.round((business.overheadRate || 0) * 100)}" /></label>
      <p class="settings-hint">Si los defines, el margen real de cada plato descuenta también personal y gastos fijos.</p>
    </article>
    <button class="primary-button save-settings" type="button">Guardar ajustes</button>
    <article class="settings-card settings-account">
      <div><span class="settings-kicker">Cuenta y nube</span><h3>${escapeHtml(cloud)}</h3><p>${escapeHtml(email)}</p></div>
      ${session?.user ? '<button class="secondary-button logout-button" type="button">Salir</button>' : ''}
    </article>`;
}

// Reemplaza el render de solo-lectura anterior.
renderSettingsScreen = function renderSettingsScreenEditable() {
  renderSettingsForm();
};

document.addEventListener('click', async (event) => {
  if (event.target.closest('.save-settings')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await saveBusinessSettings();
  }
}, true);
