(function () {
  'use strict';
  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_THIN_IMAGE_CACHE__) return;
  const NAME = 'mumei-thin-png-v1882', MAX_ENTRIES = 512, MAX_BYTES = 128 * 1024, TTL = 12 * 60 * 60 * 1000;
  let opening = null, queue = Promise.resolve(), disabled = false;
  function limited(promise) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('cache timeout')), 1500);
      Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
    });
  }
  function key(row) {
    // Includes all rendered content; a different title, article or image never reuses the previous PNG.
    const value = JSON.stringify(['860x140-png-1882', row.url, row.title, row.creator, row.thumbUrl || '', row.actorImageUrl || '']);
    return value.length <= 12000 ? location.origin + '/__mumei_thin_cache__/' + encodeURIComponent(value) : null;
  }
  async function open() {
    if (disabled || !page.caches || !page.Response) return null;
    if (!opening) opening = limited((async () => {
      const cache = await page.caches.open(NAME), requests = await cache.keys();
      const keys = new Set(requests.map(request => request.url));
      while (keys.size > MAX_ENTRIES) { const first = keys.values().next().value; await cache.delete(first); keys.delete(first); }
      return { cache, keys };
    })()).catch(() => { disabled = true; return null; });
    return opening;
  }
  async function get(row) {
    const url = key(row); if (!url) return null;
    try {
      const state = await open(); if (!state) return null;
      const response = await limited(state.cache.match(url));
      const at = Number(response?.headers.get('x-mumei-at'));
      if (!response || !at || Date.now() - at > TTL || response.headers.get('content-type') !== 'image/png') return null;
      const blob = await limited(response.blob());
      return blob.size > 0 && blob.size <= MAX_BYTES ? blob : null;
    } catch (_) { disabled = true; return null; }
  }
  function put(row, blob) {
    const url = key(row);
    if (!url || !blob || blob.type !== 'image/png' || !blob.size || blob.size > MAX_BYTES) return Promise.resolve(false);
    // Serialize writes/eviction. Cache failure never prevents image creation or article saving.
    const task = queue.then(async () => {
      const state = await open(); if (!state || disabled) return false;
      while (!state.keys.has(url) && state.keys.size >= MAX_ENTRIES) {
        const first = state.keys.values().next().value;
        await limited(state.cache.delete(first)); state.keys.delete(first);
      }
      await limited(state.cache.put(url, new page.Response(blob, { headers: { 'content-type': 'image/png', 'x-mumei-at': String(Date.now()) } })));
      state.keys.add(url); return true;
    }).catch(() => { disabled = true; return false; });
    queue = task; return task;
  }
  page.__MUMEI_THIN_IMAGE_CACHE__ = { get, put };
})();
