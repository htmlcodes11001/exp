/**
 * service-worker.js
 * Cachea los archivos de la app para que funcione sin internet una vez instalada.
 * Los datos de las fichas NO viven aquí (viven en IndexedDB, ver db.js) — este
 * archivo solo guarda copia de la interfaz (HTML/CSS/JS) para poder abrir la app offline.
 */
const CACHE_NAME = 'expedientes-cache-v1';
const ARCHIVOS_A_CACHEAR = [
  './',
  './index.html',
  './css/style.css',
  './js/db.js',
  './js/pdf.js',
  './js/app.js',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_A_CACHEAR))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((respuestaCache) => {
      return (
        respuestaCache ||
        fetch(event.request).catch(() => caches.match('./index.html'))
      );
    })
  );
});
