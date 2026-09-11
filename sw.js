// Suivi — service worker
// L'app est mise en cache pour s'ouvrir sans réseau. Les appels à l'API
// ne passent pas par ici : le dernier relevé est gardé par l'app elle-même.
//
// >>> POUR PUBLIER UNE MISE À JOUR : change UNE SEULE ligne, VERSION ci-dessous
//     (mets la date/heure du jour). Ça suffit à déclencher la bascule
//     automatique sur l'iPhone : il n'y a JAMAIS à réinstaller l'app.
const VERSION = '11/09/2026 à 09h15';

const SHELL = 'suivi-shell-' + VERSION.replace(/[^0-9]/g, '');
const FILES = ['./', './index.html', './manifest.webmanifest'];
const OPTIONAL_FILES = ['./icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL).then(async c => {
      await c.addAll(FILES);
      await Promise.all(OPTIONAL_FILES.map(url =>
        fetch(url, {cache: 'reload'}).then(r => r.ok && c.put(url, r)).catch(() => null)
      ));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.map(k => (k === SHELL ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({type: 'window'}))
      .then(cs => cs.forEach(c => c.postMessage({type: 'VERSION_ACTIVATED', version: VERSION})))
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Bibliothèque de scan (CDN jsDelivr) : cache-first pour l'offline.
  if (req.method === 'GET' && url.href.indexOf('cdn.jsdelivr.net') >= 0 && url.href.indexOf('zxing') >= 0) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        if (r && (r.ok || r.type === 'opaque')) { const c = r.clone(); caches.open(SHELL).then(k => k.put(req, c)); }
        return r;
      }))
    );
    return;
  }

  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => {
          if (r.ok) { const c = r.clone(); caches.open(SHELL).then(k => k.put('./index.html', c)); }
          return r;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(SHELL).then(k => k.put(req, c)); }
      return r;
    }))
  );
});
