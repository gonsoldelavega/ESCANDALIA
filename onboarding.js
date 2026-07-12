/* ==========================================================================
 * onboarding.js — Bienvenida y primer alta.
 *
 * En el primer arranque (una vez por dispositivo) muestra un panel para
 * configurar el negocio (nombre, margen objetivo, IVA) y orientar al usuario
 * hacia su primer plato. No se vuelve a mostrar una vez completado u omitido.
 *
 * Depende de: business, saveLocalState, renderAll, showScreen, showSync,
 * escapeHtml, numberFromInput, businessTaxRate. Carga la última.
 * ========================================================================== */

const ONBOARDED_KEY = 'escandalia.onboarded';

function onboardingDone() {
  try { return localStorage.getItem(ONBOARDED_KEY) === '1'; } catch (e) { return false; }
}
function markOnboarded() {
  try { localStorage.setItem(ONBOARDED_KEY, '1'); } catch (e) { /* modo privado */ }
}

function closeOnboarding() {
  document.querySelector('.onboarding-overlay')?.remove();
}

function renderOnboardingStep(step) {
  let overlay = document.querySelector('.onboarding-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    document.body.appendChild(overlay);
  }
  const dots = [0, 1].map((i) => `<span class="ob-dot ${i === step ? 'is-active' : ''}"></span>`).join('');
  if (step === 0) {
    overlay.innerHTML = `<section class="onboarding-panel"><h2>Bienvenido a Escandalia</h2><p class="ob-sub">Controla tus escandallos, márgenes y carta en un momento. Empecemos por tu negocio.</p>
      <label>Nombre del bar<input class="ob-name" value="${escapeHtml(business.name || '')}" placeholder="Bar El Rincón" /></label>
      <div class="ob-split">
        <label>Margen objetivo (%)<input class="ob-margin" inputmode="decimal" value="${Math.round((business.targetMargin || 0.7) * 100)}" /></label>
        <label>IVA (%)<input class="ob-tax" inputmode="decimal" value="${Math.round(businessTaxRate() * 100)}" /></label>
      </div>
      <div class="ob-actions"><button class="primary-button ob-continue" type="button">Continuar</button></div>
      <div class="ob-dots">${dots}</div>
      <div style="text-align:center"><button class="ob-skip" type="button">Saltar por ahora</button></div></section>`;
  } else {
    const count = dishes.length;
    overlay.innerHTML = `<section class="onboarding-panel"><h2>¡Todo listo, ${escapeHtml(business.name || 'chef')}!</h2><p class="ob-sub">${count ? `Tienes ${count} platos de ejemplo para empezar: ábrelos para ver su escandallo o crea los tuyos.` : 'Crea tu primer plato y Escandalia calculará su coste y margen al instante.'}</p>
      <div class="ob-actions">
        <button class="primary-button ob-goto-dishes" type="button">Ver mis platos</button>
        <button class="secondary-button ob-goto-add" type="button">Crear un plato nuevo</button>
      </div>
      <div class="ob-dots">${dots}</div></section>`;
  }
}

function startOnboarding() {
  if (onboardingDone()) return;
  if (document.querySelector('.auth-overlay')) return; // no solapar con el login
  renderOnboardingStep(0);
}

document.addEventListener('click', (event) => {
  if (event.target.closest('.ob-skip')) {
    markOnboarded();
    closeOnboarding();
    return;
  }
  if (event.target.closest('.ob-continue')) {
    const name = document.querySelector('.ob-name')?.value.trim();
    const margin = Math.min(Math.max(numberFromInput(document.querySelector('.ob-margin')?.value, 70) / 100, 0), 0.95);
    const tax = Math.min(Math.max(numberFromInput(document.querySelector('.ob-tax')?.value, 10) / 100, 0), 0.5);
    if (name) business.name = name;
    business.targetMargin = margin;
    business.taxRate = tax;
    if (typeof updateCurrentLocalName === 'function' && name) updateCurrentLocalName(name);
    if (typeof saveLocalState === 'function') saveLocalState();
    if (typeof renderAll === 'function') renderAll();
    renderOnboardingStep(1);
    return;
  }
  if (event.target.closest('.ob-goto-dishes')) {
    markOnboarded();
    closeOnboarding();
    showScreen('dishes');
    return;
  }
  if (event.target.closest('.ob-goto-add')) {
    markOnboarded();
    closeOnboarding();
    showScreen('add-dish');
  }
});

// Arrancar tras dejar que la app haga su primer render.
if (document.readyState === 'complete') {
  setTimeout(startOnboarding, 400);
} else {
  window.addEventListener('load', () => setTimeout(startOnboarding, 400));
}
