// Service worker: makes the app installable and usable offline.
// Online, every file comes from the network, so all the modules always belong
// to the same version. Each one is saved as it loads, and the saved copy is
// used when there is no connection.

const CACHE = 'gradematrix-v1';

const APP_SHELL = [
    './',
    'index.html',
    'about.html',
    'style.css',
    'manifest.webmanifest',
    'js/app.js',
    'js/cell-colour.js',
    'js/dom.js',
    'js/grading.js',
    'js/insights-view.js',
    'js/matrix-view.js',
    'js/modal.js',
    'js/planner-view.js',
    'js/planner.js',
    'js/policy.js',
    'js/pwa.js',
    'js/report-view.js',
    'js/storage.js',
    'js/theme.js',
    'js/toast.js',
    'js/transcript.js',
    'assets/imgs/logo.svg',
    'assets/imgs/favicon.png',
    'assets/imgs/icon-192.png',
    'assets/imgs/icon-512.png',
    'assets/imgs/icon-maskable-512.png',
    'assets/btns/github-profile-link.png'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

// Drop caches left behind by older versions.
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

    event.respondWith(caches.open(CACHE).then(async cache => {
        try {
            const response = await fetch(request);
            if (response.ok) cache.put(request, response.clone());
            return response;
        } catch {
            const cached = await cache.match(request, { ignoreSearch: true });
            return cached ?? Response.error();
        }
    }));
});
