/* ==========================================================================
 * sw.js — Service Worker de Escandalia (PWA offline).
 *
 * Estrategia:
 *   - App shell (HTML/CSS/JS/manifest/icono): precache + cache-first, para que
 *     la app abra al instante y funcione sin conexión en la barra.
 *   - /api/*: siempre red (nunca cachear config ni escaneo de facturas).
 *   - Navegaciones: cache-first sobre index.html con fallback a red.
 * ========================================================================== */

const CACHE = 'escandalia-v2';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './auth.css',
  './product-actions.css',
  './manifest.webmanifest',
  './icon.svg',
  './cost-engine.js',
  './render-engine.js',
  './script.js',
  './auth-fix.js',
  './product-actions.js',
  './yield-persistence.js',
  './ops-actions.js',
  './ops-fallback.js',
  './ops-editable.js',
  './manual-price-action.js',
  './apply-price-action.js',
  './invoice-scan.js',
  './rentabilidad.js',
  './menu-engineering.js',
  './qr-engine.js',
  './settings-editable.js',
  './carta.js',
  './alerts-plus.js',
  './dish-list.js',
  './i18n.js',
  './locales-roles.js',
  './onboarding.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Cacheamos uno a uno para que un fichero ausente no invalide todo el shell.
      .then((cache) => Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // dejar pasar terceros (fuentes, esm.sh)
  if (url.pathname.includes('/api/')) return;       // API siempre a red

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
