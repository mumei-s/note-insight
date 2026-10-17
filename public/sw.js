const CACHE_NAME = "mumei-note-insight-v103-no-recovery-panel-20261013";
const SCOPE = new URL(self.registration.scope);
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg", "./recovery.html", "./insight-editor-isolation.js"];
const shellPaths = new Set(APP_SHELL.map(path => new URL(path, SCOPE).pathname));
const indexUrl = new URL("./index.html", SCOPE).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const path of APP_SHELL) {
      try {
        const url = new URL(path, SCOPE).href;
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await cache.put(url, response);
      } catch {
        // One optional shell file must never prevent the recovery worker from installing.
      }
    }
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
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;

  const relative = url.pathname.slice(SCOPE.pathname.length);
  const updateResource = relative === "insight-release.json" || relative === "insight-owner-nav.js" || relative === "insight-editor-isolation.js" || relative.endsWith(".user.js") || /^(?:notification|dashboard|tool)-(?:setup|update|install|browser-install|entry).*\.(?:html|js)$/.test(relative);
  if (updateResource) {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(url.origin + url.pathname)) || new Response("", { status: 503 });
    }));
    return;
  }

  const appNavigation = url.pathname === SCOPE.pathname || url.pathname === new URL(indexUrl).pathname;
  const cacheable = shellPaths.has(url.pathname) || /^assets\/[a-zA-Z0-9_-]+[.-][a-zA-Z0-9_-]+\.(?:js|css|woff2?|png|svg)$/.test(relative);
  // Vite changes this URL whenever the file contents change. Reuse an exact
  // fingerprint rather than downloading the same bundle on every app opening.
  // HTML, release checks, readers and API responses still go to the network.
  const immutableAsset = /^assets\/[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]{8}\.(?:js|css|woff2?|png|svg)$/.test(relative);
  const key = appNavigation ? indexUrl : url.origin + url.pathname;

  event.respondWith((async () => {
    if (immutableAsset) {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(key);
        if (cached?.ok) return cached;
      } catch {
        // Unavailable/full Cache Storage must not prevent an online startup.
      }
    }
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
        const shell = await cache.match(indexUrl);
        if (shell) return shell;
        const recovery = await cache.match(new URL("./recovery.html", SCOPE).href);
        if (recovery) return recovery;
      }
      return new Response("オフラインです。通信を確認して再度開いてください。表示データは削除していません。", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
      });
    }
  })());
});
