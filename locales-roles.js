/* ==========================================================================
 * locales-roles.js — Varios locales por cuenta y roles de usuario.
 *
 * LOCALES (modo local / sin sesión): permite tener varios negocios en el mismo
 * dispositivo, cada uno con su propia carta, costes y ventas, y cambiar entre
 * ellos. Cada local guarda su propia instantánea en localStorage.
 *
 * ROLES: dueño / encargado / cocina, con permisos distintos. El rol se guarda
 * por dispositivo y oculta las acciones no permitidas.
 *
 * Depende de: business, ingredients, dishes, opsState, saveLocalState,
 * loadLocalState, seedLocalFallback, renderAll, showSync, escapeHtml, uniqueId.
 * Carga DESPUÉS de settings-editable.js.
 * ========================================================================== */

const ACTIVE_KEY = 'escandalia.local.v1';        // slot de trabajo (lo usa script.js)
const LOCALS_REGISTRY_KEY = 'escandalia.locals';  // [{id,name}]
const CURRENT_LOCAL_KEY = 'escandalia.currentLocal';
const ROLE_KEY = 'escandalia.role';
const SNAP_PREFIX = 'escandalia.local.snapshot.';
const OPS_PREFIX = 'escandalia.local.ops.';

const ROLES = {
  owner: { label: 'Dueño', desc: 'Control total: ajustes, precios, publicar y locales.' },
  manager: { label: 'Encargado', desc: 'Gestiona platos, costes y ventas. Sin ajustes de negocio ni locales.' },
  kitchen: { label: 'Cocina', desc: 'Consulta escandallos y recetas, registra compras/mermas. No edita precios.' },
};

const ROLE_PERMS = {
  owner: { settings: true, prices: true, publish: true, delete: true, sales: true, locales: true },
  manager: { settings: false, prices: true, publish: true, delete: true, sales: true, locales: false },
  kitchen: { settings: false, prices: false, publish: false, delete: false, sales: false, locales: false },
};

function lsGet(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch (e) { return fallback; } }
function lsSet(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* modo privado */ } }
function lsJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; } }

let currentRole = lsGet(ROLE_KEY, 'owner');
if (!ROLES[currentRole]) currentRole = 'owner';

function can(action) { return Boolean(ROLE_PERMS[currentRole]?.[action]); }

function applyRoleClass() {
  const body = document.body;
  if (!body) return;
  ['role-owner', 'role-manager', 'role-kitchen'].forEach((c) => body.classList.remove(c));
  body.classList.add(`role-${currentRole}`);
}

function setRole(role) {
  if (!ROLES[role]) return;
  currentRole = role;
  lsSet(ROLE_KEY, role);
  applyRoleClass();
  if (typeof renderAll === 'function') renderAll();
  showSync?.(`Rol: ${ROLES[role].label}`);
}

// ── Registro de locales ──────────────────────────────────────────────
function loadLocalsRegistry() {
  let registry = lsJSON(LOCALS_REGISTRY_KEY, null);
  if (!Array.isArray(registry) || !registry.length) {
    // Primer arranque: el negocio actual se convierte en el primer local.
    const id = 'local-1';
    registry = [{ id, name: business?.name || 'Mi bar' }];
    lsSet(LOCALS_REGISTRY_KEY, JSON.stringify(registry));
    lsSet(CURRENT_LOCAL_KEY, id);
  }
  return registry;
}

function currentLocalId() {
  const id = lsGet(CURRENT_LOCAL_KEY, null);
  const registry = loadLocalsRegistry();
  return registry.some((l) => l.id === id) ? id : registry[0].id;
}

function updateCurrentLocalName(name) {
  const registry = loadLocalsRegistry();
  const id = currentLocalId();
  const entry = registry.find((l) => l.id === id);
  if (entry && name) { entry.name = name; lsSet(LOCALS_REGISTRY_KEY, JSON.stringify(registry)); }
}

function snapshotOpsFor(id) {
  const ops = typeof opsState !== 'undefined' ? opsState : { purchases: [], sales: [], cashClosings: [] };
  lsSet(OPS_PREFIX + id, JSON.stringify(ops));
}

function persistActiveInto(id) {
  if (typeof saveLocalState === 'function') saveLocalState();
  lsSet(SNAP_PREFIX + id, lsGet(ACTIVE_KEY, '') || '');
  snapshotOpsFor(id);
}

function restoreOpsFrom(id) {
  if (typeof opsState === 'undefined') return;
  const ops = lsJSON(OPS_PREFIX + id, { purchases: [], sales: [], cashClosings: [] });
  opsState.purchases = ops.purchases || [];
  opsState.sales = ops.sales || [];
  opsState.cashClosings = ops.cashClosings || [];
}

function switchLocal(id) {
  if (typeof useSupabase !== 'undefined' && useSupabase && session) {
    return showSync?.('Los locales múltiples están disponibles en modo local (sin sesión).');
  }
  const from = currentLocalId();
  if (id === from) return;
  persistActiveInto(from);
  lsSet(CURRENT_LOCAL_KEY, id);
  const snap = lsGet(SNAP_PREFIX + id, null);
  if (snap) {
    lsSet(ACTIVE_KEY, snap);
    loadLocalState();
  } else {
    try { localStorage.removeItem(ACTIVE_KEY); } catch (e) { /* noop */ }
    seedLocalFallback();
    saveLocalState?.();
  }
  restoreOpsFrom(id);
  renderAll();
  if (typeof renderStatsScreen === 'function') renderStatsScreen();
  if (typeof renderPurchaseList === 'function') renderPurchaseList();
  const entry = loadLocalsRegistry().find((l) => l.id === id);
  showSync?.(`Local: ${entry?.name || 'nuevo'}`);
}

function createLocal(name) {
  if (!can('locales')) return showSync?.('Solo el dueño puede crear locales');
  const registry = loadLocalsRegistry();
  const id = uniqueId(name || 'local', registry.map((l) => l.id));
  registry.push({ id, name: name || 'Nuevo local' });
  lsSet(LOCALS_REGISTRY_KEY, JSON.stringify(registry));
  switchLocal(id);
  // El local nuevo arranca con datos semilla; el dueño edita su nombre en Ajustes.
  if (business) { business.name = name || 'Nuevo local'; updateCurrentLocalName(business.name); saveLocalState?.(); renderAll(); }
}

function deleteLocal(id) {
  if (!can('locales')) return showSync?.('Solo el dueño puede borrar locales');
  let registry = loadLocalsRegistry();
  if (registry.length <= 1) return showSync?.('Debe quedar al menos un local');
  const wasCurrent = id === currentLocalId();
  registry = registry.filter((l) => l.id !== id);
  lsSet(LOCALS_REGISTRY_KEY, JSON.stringify(registry));
  try { localStorage.removeItem(SNAP_PREFIX + id); localStorage.removeItem(OPS_PREFIX + id); } catch (e) { /* noop */ }
  if (wasCurrent) switchLocal(registry[0].id);
  else renderSettingsScreen?.();
  showSync?.('Local eliminado');
}

// ── UI dentro de Ajustes ─────────────────────────────────────────────
function renderLocalesAndRoles() {
  const content = document.querySelector('[data-screen="settings"] .settings-content');
  if (!content || content.querySelector('.locales-card')) return;
  const registry = loadLocalsRegistry();
  const activeId = currentLocalId();

  const rolesCard = `<article class="settings-card roles-card"><span class="settings-kicker">Tu rol</span>
    <div class="role-options">${Object.entries(ROLES).map(([key, r]) => `<button type="button" class="role-chip ${key === currentRole ? 'is-active' : ''}" data-role="${key}">${r.label}</button>`).join('')}</div>
    <p class="settings-hint">${escapeHtml(ROLES[currentRole].desc)}</p></article>`;

  const localesCard = `<article class="settings-card locales-card"><span class="settings-kicker">Locales</span>
    <div class="locales-list">${registry.map((l) => `<div class="locale-row ${l.id === activeId ? 'is-active' : ''}"><button type="button" class="locale-switch" data-locale="${l.id}">${escapeHtml(l.name)}${l.id === activeId ? ' ·  actual' : ''}</button>${registry.length > 1 ? `<button type="button" class="locale-delete danger-button" data-locale-del="${l.id}" aria-label="Borrar local">×</button>` : ''}</div>`).join('')}</div>
    <div class="locale-new"><input class="new-locale-name" placeholder="Nombre del nuevo local" /><button type="button" class="secondary-button create-locale">＋ Añadir local</button></div>
    <p class="settings-hint">Cada local guarda su propia carta, costes y ventas en este dispositivo.</p></article>`;

  content.insertAdjacentHTML('beforeend', rolesCard + localesCard);
}

if (typeof renderSettingsScreen === 'function') {
  const prevRenderSettings = renderSettingsScreen;
  renderSettingsScreen = function renderSettingsWithLocalesRoles() {
    prevRenderSettings();
    renderLocalesAndRoles();
  };
}

// Mantener el nombre del local sincronizado al guardar ajustes.
if (typeof saveBusinessSettings === 'function') {
  const prevSaveBusinessSettings = saveBusinessSettings;
  saveBusinessSettings = async function saveBusinessSettingsWithLocalName() {
    await prevSaveBusinessSettings();
    updateCurrentLocalName(business.name);
  };
}

// ── Bloqueo de acciones por rol (guard en captura) ───────────────────
document.addEventListener('click', (event) => {
  const role = event.target.closest('.role-chip');
  if (role) { event.preventDefault(); setRole(role.dataset.role); return; }

  const sw = event.target.closest('.locale-switch');
  if (sw) { event.preventDefault(); switchLocal(sw.dataset.locale); return; }

  const del = event.target.closest('[data-locale-del]');
  if (del) { event.preventDefault(); deleteLocal(del.dataset.localeDel); return; }

  const create = event.target.closest('.create-locale');
  if (create) {
    event.preventDefault();
    const input = document.querySelector('.new-locale-name');
    createLocal((input?.value || '').trim() || 'Nuevo local');
    return;
  }

  // Guard de permisos: bloquea acciones restringidas antes de que las procese
  // cualquier otro handler.
  const blocked = event.target.closest('.save-settings,.publish-toggle,[data-action="apply-recommended-price"],[data-action="edit-price-manually"],.delete-purchase,.delete-sale,.save-sale');
  if (!blocked) return;
  const needs = blocked.matches('.save-settings') ? 'settings'
    : blocked.matches('.publish-toggle,[data-action="apply-recommended-price"],[data-action="edit-price-manually"]') ? 'prices'
    : blocked.matches('.delete-purchase,.delete-sale') ? 'delete'
    : 'sales';
  if (!can(needs)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    showSync?.(`Tu rol (${ROLES[currentRole].label}) no puede hacer esta acción`);
  }
}, true);

applyRoleClass();
loadLocalsRegistry();
if (typeof renderAll === 'function') renderAll();
