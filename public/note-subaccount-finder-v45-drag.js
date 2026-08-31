(() => {
  'use strict';

  const HOST_ID = 'note巡回boost-v4';
  const POS_KEY = 'note巡回BOOST_v4:toolPosition';
  const HOLD_MS = 450;
  let installed = false;

  function readPos() {
    try {
      const v = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? v : null;
    } catch { return null; }
  }

  function savePos(host) {
    const r = host.getBoundingClientRect();
    try { localStorage.setItem(POS_KEY, JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) })); } catch {}
  }

  function clamp(host, x, y) {
    const r = host.getBoundingClientRect();
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const pad = 4;
    const maxX = Math.max(pad, vw - Math.min(r.width, vw - pad * 2) - pad);
    const maxY = Math.max(pad, vh - Math.min(r.height, vh - pad * 2) - pad);
    return {
      x: Math.min(Math.max(pad, x), maxX),
      y: Math.min(Math.max(pad, y), maxY)
    };
  }

  function setPosition(host, x, y) {
    const p = clamp(host, x, y);
    host.style.setProperty('left', `${p.x}px`, 'important');
    host.style.setProperty('top', `${p.y}px`, 'important');
    host.style.setProperty('right', 'auto', 'important');
    host.style.setProperty('bottom', 'auto', 'important');
  }

  function install(host) {
    if (installed || !host) return;
    installed = true;

    const open = host.querySelector('#nb-open');
    const title = host.querySelector('.nb-head b');
    const panel = host.querySelector('#nb-panel');
    if (!open) return;

    const style = document.createElement('style');
    style.textContent = `
      #${CSS.escape(HOST_ID)} #nb-open,
      #${CSS.escape(HOST_ID)} .nb-head b{touch-action:none;-webkit-user-select:none;user-select:none}
      #${CSS.escape(HOST_ID)}.nb-dragging{opacity:.88;filter:drop-shadow(0 10px 20px #0008)}
      #${CSS.escape(HOST_ID)}.nb-dragging #nb-open,
      #${CSS.escape(HOST_ID)}.nb-dragging .nb-head b{cursor:grabbing!important}
    `;
    document.documentElement.appendChild(style);

    const saved = readPos();
    if (saved) requestAnimationFrame(() => setPosition(host, saved.x, saved.y));

    let holdTimer = 0;
    let pointerId = null;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    let dragging = false;
    let suppressClickUntil = 0;
    let activeHandle = null;

    const clearHold = () => {
      if (holdTimer) window.clearTimeout(holdTimer);
      holdTimer = 0;
    };

    const onDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      clearHold();
      pointerId = e.pointerId;
      activeHandle = e.currentTarget;
      startX = e.clientX;
      startY = e.clientY;
      const rect = host.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      holdTimer = window.setTimeout(() => {
        dragging = true;
        suppressClickUntil = Date.now() + 900;
        host.classList.add('nb-dragging');
        setPosition(host, startLeft, startTop);
        try { activeHandle?.setPointerCapture?.(pointerId); } catch {}
        if (navigator.vibrate) { try { navigator.vibrate(25); } catch {} }
      }, HOLD_MS);
    };

    const onMove = (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      e.preventDefault();
      setPosition(host, startLeft + (e.clientX - startX), startTop + (e.clientY - startY));
    };

    const finish = (e) => {
      if (pointerId != null && e?.pointerId != null && e.pointerId !== pointerId) return;
      clearHold();
      if (dragging) {
        dragging = false;
        suppressClickUntil = Date.now() + 900;
        host.classList.remove('nb-dragging');
        savePos(host);
      }
      try { activeHandle?.releasePointerCapture?.(pointerId); } catch {}
      pointerId = null;
      activeHandle = null;
    };

    const handles = [open, title].filter(Boolean);
    for (const handle of handles) {
      handle.addEventListener('pointerdown', onDown, { passive: true });
      handle.addEventListener('contextmenu', e => e.preventDefault());
      handle.title = `${handle.title ? `${handle.title}｜` : ''}長押しで移動`;
    }
    document.addEventListener('pointermove', onMove, { capture: true, passive: false });
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', finish, true);

    document.addEventListener('click', e => {
      if (Date.now() > suppressClickUntil) return;
      if (handles.some(h => h && (e.target === h || h.contains(e.target)))) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);

    const reclamp = () => {
      const r = host.getBoundingClientRect();
      setPosition(host, r.left, r.top);
      savePos(host);
    };
    window.addEventListener('resize', () => setTimeout(reclamp, 60), { passive: true });
    window.visualViewport?.addEventListener('resize', () => setTimeout(reclamp, 60), { passive: true });
    if (panel) new MutationObserver(() => setTimeout(reclamp, 0)).observe(panel, { attributes: true, attributeFilter: ['style'] });
  }

  function wait() {
    const host = document.getElementById(HOST_ID);
    if (host) return install(host);
    const mo = new MutationObserver(() => {
      const found = document.getElementById(HOST_ID);
      if (found) { mo.disconnect(); install(found); }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 20000);
  }

  wait();
})();
