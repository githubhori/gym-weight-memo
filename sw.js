// Service Worker。バージョンは js/version.js の APP_VERSION で管理する。
importScripts('js/version.js');

var CACHE = APP_VERSION;
var FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/version.js',
  'js/storage.js',
  'js/app.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // HTTPキャッシュを経由せず、常にサーバーから最新を取得して保存する
      return cache.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
    })
  );
  // 待機はしない: 新しい版は、古い版のタブ/アプリを閉じた次回起動で反映される
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.startsWith('gym-weight-') && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      if (e.request.mode === 'navigate') return caches.match('index.html');
      return fetch(e.request);
    })
  );
});
