const CACHE_NAME = 'reservas-proyectores-v3';

// Archivos propios de la app (rutas relativas: funcionan también en subcarpetas, ej. GitHub Pages)
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// Librerías externas que conviene tener disponibles sin conexión
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js',
  'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js'
];

// Hosts cuyos archivos se guardan en caché al usarse (Firebase Realtime DB y QR NO se tocan)
const HOSTS_CACHEABLES = ['cdnjs.cloudflare.com', 'www.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // Si un CDN falla, no se cancela la instalación
    await Promise.allSettled(CDN.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Páginas: primero red (siempre la versión más nueva), y si no hay internet, la copia guardada
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && url.origin === location.origin) {
          const cache = await caches.open(CACHE_NAME);
          cache.put('./index.html', res.clone());
        }
        return res;
      } catch {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  // Archivos estáticos propios y de CDN: caché primero, actualizando en segundo plano
  const cacheable = url.origin === location.origin || HOSTS_CACHEABLES.includes(url.hostname);
  if (!cacheable) return; // Firebase, API de QR, etc.: directo a la red

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const guardado = await cache.match(req);
    const red = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }).catch(() => guardado);
    return guardado || red;
  })());
});
