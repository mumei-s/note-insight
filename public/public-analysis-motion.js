(() => {
  const fallback = new URL('./?insightMode=analysis#dashboard', location.href);
  let back = fallback;
  try {
    const candidate = new URL(new URL(location.href).searchParams.get('return') || fallback.href, location.href);
    if (candidate.origin === location.origin && /\/note-insight\/(?:index\.html)?$/.test(candidate.pathname)) back = candidate;
  } catch {}
  back.searchParams.set('insightMode', 'analysis'); back.searchParams.delete('analysisPanel'); back.hash = 'dashboard';
  const link = document.getElementById('analysisBack');
  if (link) link.href = back.href;
  const close = document.getElementById('close');
  if (close) close.onclick = () => { location.href = back.href; };

  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)'), scenes = new Set(), visible = new WeakMap();
  const paint = node => { node.dataset.motion = visible.get(node) && !media?.matches && document.visibilityState !== 'hidden' ? 'on' : 'off'; };
  const intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => entries.forEach(entry => { visible.set(entry.target, entry.isIntersecting); paint(entry.target); }), { threshold: .08 });
  function connect() {
    scenes.forEach(node => { if (!node.isConnected) { intersection?.unobserve(node); scenes.delete(node); } });
    document.querySelectorAll('.public-donut,.spark,.chart').forEach(node => {
      if (scenes.has(node)) return;
      scenes.add(node); visible.set(node, !intersection); paint(node); intersection?.observe(node);
    });
  }
  const refresh = () => scenes.forEach(paint);
  media?.addEventListener?.('change', refresh); document.addEventListener('visibilitychange', refresh);
  new MutationObserver(connect).observe(document.getElementById('content') || document.body, { childList: true, subtree: true });
  connect();
})();
