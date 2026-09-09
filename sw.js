// Suivi — service worker
// L'app est mise en cache pour s'ouvrir sans reseau. Les appels a l'API
// ne passent pas par ici : le dernier releve est garde par l'app elle-meme.
const SHELL = 'suivi-shell-v5';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.map(k => (k === SHELL ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Navigation : reseau d'abord, cache en secours.
  // Evite de servir un index.html perime apres une mise a jour.
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

  // Le reste (icones, manifest) : cache d'abord, c'est stable.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(SHELL).then(k => k.put(req, c)); }
      return r;
    }))
  );
});