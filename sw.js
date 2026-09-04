const VERSION = "playhub-v4";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const CORE = ["/", "/index.html", "/style.css", "/app.js", "/games.js", "/favicon.svg", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, RUNTIME]);
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("playhub-") && !keep.has(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Always prefer fresh HTML/JS/CSS and fall back to cache when offline.
  const isDocument = req.mode === "navigate" || req.destination === "document";
  const isCode = ["script", "style"].includes(req.destination);
  event.respondWith((async () => {
    if (isDocument || isCode) {
      try {
        const fresh = await fetch(req);
        if (fresh.ok) {
          const cache = await caches.open(RUNTIME);
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match("/");
      }
    }

    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh.ok) {
        caches.open(RUNTIME).then(c => c.put(req, fresh.clone())).catch(() => {});
      }
      return fresh;
    } catch {
      return cached || Response.error();
    }
  })());
});
