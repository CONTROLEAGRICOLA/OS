// ===================== NOTIFICAÇÕES (Firebase) =====================
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// COLE AQUI o firebaseConfig copiado do console do Firebase (o mesmo do index)
firebase.initializeApp({
  apiKey: 'AIzaSyD7D6yXV2YlCFX7iotnXUKlqUF9SCveOVc',
  authDomain: 'os-clealco.firebaseapp.com',
  projectId: 'os-clealco',
  storageBucket: 'os-clealco.firebasestorage.app',
  messagingSenderId: '175045739560',
  appId: '1:175045739560:web:14ac6b6e379e6ca9c7e11d'
});
firebase.messaging();   // com o app fechado, o Firebase recebe o push e mostra a notificação

// ===================== OFFLINE =====================
const CACHE_NAME = 'clealco-os-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/dark.css',
  'https://cdn.jsdelivr.net/npm/flatpickr',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/pt.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(ASSETS.map(url => cache.add(url).catch(() => {})))   // se um arquivo falhar, os outros continuam
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Dados do Apps Script, Firebase e envios (POST): sempre direto da internet, nunca do cache
  if (event.request.method !== 'GET' ||
      url.hostname.endsWith('google.com') ||
      url.hostname.endsWith('googleusercontent.com') ||
      url.hostname.endsWith('googleapis.com')) {
    return;
  }

  // A página do app: primeiro da internet (assim o líder sempre pega a versão nova);
  // sem internet, usa a cópia guardada
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(resposta => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copia));
        }
        return resposta;
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Outros arquivos (CSS, scripts, logo): primeiro do cache, senão da internet
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      });
    })
  );
});