// ====================================================================
// SERVICE WORKER - UANGAING APP PWA (v1.0.0)
// ====================================================================

const CACHE_NAME = 'uangaing-pwa-v3';

// Asset statis lokal yang di-cache saat instalasi
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './login-icon.png'
];

// External CDN yang sering dipakai
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap'
];

// 1. INSTALL EVENT
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache asset lokal terlebih dahulu
      cache.addAll(STATIC_ASSETS);
      // Cache asset external secara best-effort (tanpa gagalkan install jika offline)
      EXTERNAL_ASSETS.forEach(url => {
        fetch(url, { mode: 'no-cors' }).then(res => cache.put(url, res)).catch(() => {});
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. ACTIVATE EVENT (Pembersihan cache versi lama)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH EVENT
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // PENTING: JANGAN PERNAH CACHE PANGGILAN API GOOGLE APPS SCRIPT
  // Selalu jalankan network live request agar data transaksi & saldo selalu realtime!
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'OFFLINE', message: 'Koneksi internet terputus. Bekerja dalam mode offline.' }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Strategy: Stale-While-Revalidate untuk static assets
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Jika offline dan tidak ada di cache, fallback ke index.html untuk SPA routing
        if (req.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./');
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});
