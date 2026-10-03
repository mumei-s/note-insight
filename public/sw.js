const CACHE_NAME = "mumei-note-insight-v90-participant-play-20261003";
const SCOPE = new URL(self.registration.scope);
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg", "./recovery.html"];
const shellPaths = new Set(APP_SHELL.map(path => new URL(path, SCOPE).pathname));
const indexUrl = new URL("./index.html", SCOPE).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async path => {
      const url = new URL(path, SCOPE).href;
      const response = await fetch(url, { cache: "reload" });
      if (!response.ok) throw new Error("APP_SHELL_" + response.status);
      await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("mumei-note-insight-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const relative = url.pathname.slice(SCOPE.pathname.length);
  // Release manifests, userscripts and installers must never report a cached release as current.
  const updateResource = relative === "insight-release.json" || relative.endsWith(".user.js") || /^(?:notification|dashboard|tool)-(?:setup|update|install|browser-install|entry).*\.(?:html|js)$/.test(relative);
  if (updateResource) { event.respondWith(fetch(request, { cache: "no-store" })); return; }
  const appNavigation = url.pathname === SCOPE.pathname || url.pathname === new URL(indexUrl).pathname;
  const cacheable = shellPaths.has(url.pathname) || /^assets\/[a-zA-Z0-9_-]+[.-][a-zA-Z0-9_-]+\.(?:js|css|woff2?|png|svg)$/.test(relative);
  const key = appNavigation ? indexUrl : url.origin + url.pathname;
  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: "no-store" });
      if (response.ok && cacheable) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(key, copy)).catch(() => {}));
      }
      return response;
    } catch {
      const cache = await caches.open(CACHE_NAME);
      const cached = cacheable ? await cache.match(key) : undefined;
      if (cached) return cached;
      if (request.mode === "navigate" && appNavigation) {
        const shell = await cache.match(indexUrl); if (shell) return shell;
      }
      return new Response("オフラインです。通信を確認して再度開いてください。更新は完了していません。", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    }
  })());
});
