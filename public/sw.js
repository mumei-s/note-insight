const CACHE_NAME = "mumei-note-insight-v25";
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg"];
const ROOT_URL = new URL("./", self.registration.scope).href;

function staleNotificationEntry(url) {
  const u = new URL(url);
  if (u.pathname.endsWith("/notification-setup.html")) return u.searchParams.get("from") !== "insight";
  if (u.pathname.endsWith("/notification-import.html")) return u.searchParams.get("from") !== "setup";
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(windows.map(async (client) => {
      if (!staleNotificationEntry(client.url)) return;
      try { await client.navigate(ROOT_URL); } catch { /* browser may reject navigation while backgrounded */ }
    }));
  })());
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== "GET" || requestUrl.origin !== self.location.origin) return;
  if (event.request.mode === "navigate" && staleNotificationEntry(requestUrl.href)) {
    event.respondWith(Promise.resolve(Response.redirect(ROOT_URL, 302)));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./"))),
  );
});
