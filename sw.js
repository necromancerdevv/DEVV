/* Името на кеша е ключът за инвалидация — вдига се при всеки нов билд на index.html. */
const CACHE = "taxi-empire-v21";
const FILES = ["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./icon-maskable.png"];

self.addEventListener("install", e => {
  // addAll е all-or-nothing: един липсващ файл проваля цялата инсталация.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // Документът и манифестът: мрежата първа, за да стига нов деплой веднага.
  // Кешът е резервният вариант офлайн.
  const isDoc = req.mode === "navigate" || req.destination === "document" ||
                /\/$|\.html$|\.webmanifest$/.test(new URL(req.url).pathname);
  if (isDoc) {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return r;
      }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // Икони и останалите статични файлове: кешът първи.
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
