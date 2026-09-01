(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_NOTE_FLOATING_UI_164__) return;
  page.__MUMEI_NOTE_FLOATING_UI_164__ = true;

  const PANEL_ID = 'mumei-note-source-picker-v163';
  const STATE_KEY = 'mumei_note_floating_ui_v164';
  const STYLE_ID = 'mumei-note-floating-ui-v164-style';
  const MIN_CLASS = 'mumei-ui-minimized-v164';
  const LONG_PRESS_MS = 430;
  const MOVE_CANCEL_PX = 12;

  let dragging = false;
  let pressTimer = null;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;
  let mountedPanel = null;

  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
      return value && typeof value === 'object' ? value : {};
    } catch (_) { return {}; }
  }

  function writeState(patch) {
    const next = { ...readState(), ...patch, updatedAt: Date.now() };
    try { localStorage.setItem(STATE_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  }

  function viewport() {
    const vv = page.visualViewport;
    return {
      width: Math.max(240, Math.floor(vv?.width || page.innerWidth || document.documentElement.clientWidth || 360)),
      height: Math.max(320, Math.floor(vv?.height || page.innerHeight || document.documentElement.clientHeight || 640))
    };
  }

  function clampPosition(panel, left, top) {
    const vp = viewport();
    const rect = panel.getBoundingClientRect();
    const width = Math.min(rect.width || panel.offsetWidth || 232, vp.width - 8);
    const height = Math.min(rect.height || panel.offsetHeight || 48, vp.height - 8);
    return {
      left: Math.max(4, Math.min(Number(left) || 4, Math.max(4, vp.width - width - 4))),
      top: Math.max(4, Math.min(Number(top) || 4, Math.max(4, vp.height - height - 4)))
    };
  }

  function applyPosition(panel, state = readState()) {
    if (!Number.isFinite(Number(state.left)) || !Number.isFinite(Number(state.top))) return;
    const pos = clampPosition(panel, Number(state.left), Number(state.top));
    panel.style.setProperty('left', `${Math.round(pos.left)}px`, 'important');
    panel.style.setProperty('top', `${Math.round(pos.top)}px`, 'important');
    panel.style.setProperty('right', 'auto', 'important');
    panel.style.setProperty('bottom', 'auto', 'important');
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID) || !document.head) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{transition:width .16s ease,box-shadow .16s ease;max-width:calc(100vw - 8px)!important}
      #${PANEL_ID}>.title{display:flex!important;align-items:center!important;gap:6px!important;user-select:none!important;-webkit-user-select:none!important;touch-action:none!important;cursor:grab!important;min-height:28px!important;margin-bottom:6px!important}
      #${PANEL_ID}>.title.mumei-dragging-v164{cursor:grabbing!important;outline:1px solid #38bdf8!important;border-radius:7px!important}
      #${PANEL_ID} .mumei-title-text-v164{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #${PANEL_ID} .mumei-min-btn-v164{flex:0 0 30px!important;width:30px!important;height:28px!important;padding:0!important;margin:0!important;border:1px solid #475569!important;border-radius:7px!important;background:#111827!important;color:#fff!important;font-size:17px!important;line-height:26px!important;font-weight:900!important;touch-action:manipulation!important}
      #${PANEL_ID}.${MIN_CLASS}{width:154px!important;padding:6px 7px!important;overflow:hidden!important}
      #${PANEL_ID}.${MIN_CLASS}>:not(.title):not(#mumei-note-source-status-v163){display:none!important}
      #${PANEL_ID}.${MIN_CLASS}>.title{margin-bottom:0!important}
      #${PANEL_ID}.${MIN_CLASS} #mumei-note-source-status-v163{display:block!important;max-width:140px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;margin-top:2px!important;font-size:8px!important;opacity:.82!important}
      #mumei-direct-success-panel,#mumei-direct-success-btn,#mumei-notify-test-panel,#mumei-notify-test-btn,#mumei-notify-clean-btn,#mumei-card-system-toggle{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function setMinimized(panel, minimized, save = true) {
    panel.classList.toggle(MIN_CLASS, Boolean(minimized));
    const button = panel.querySelector('.mumei-min-btn-v164');
    if (button) {
      button.textContent = minimized ? '□' : '−';
      button.title = minimized ? '元の大きさに戻す' : '最小化（処理は継続）';
      button.setAttribute('aria-label', button.title);
    }
    if (save) writeState({ minimized: Boolean(minimized) });
    page.requestAnimationFrame(() => {
      const state = readState();
      if (Number.isFinite(Number(state.left)) && Number.isFinite(Number(state.top))) {
        const pos = clampPosition(panel, state.left, state.top);
        panel.style.setProperty('left', `${Math.round(pos.left)}px`, 'important');
        panel.style.setProperty('top', `${Math.round(pos.top)}px`, 'important');
        if (save) writeState(pos);
      }
    });
  }

  function cancelLongPress() {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  }

  function stopDrag(save = true) {
    cancelLongPress();
    if (!mountedPanel) return;
    const title = mountedPanel.querySelector(':scope > .title');
    title?.classList.remove('mumei-dragging-v164');
    if (dragging && save) {
      const rect = mountedPanel.getBoundingClientRect();
      const pos = clampPosition(mountedPanel, rect.left, rect.top);
      writeState(pos);
      mountedPanel.style.setProperty('left', `${Math.round(pos.left)}px`, 'important');
      mountedPanel.style.setProperty('top', `${Math.round(pos.top)}px`, 'important');
    }
    dragging = false;
    pointerId = null;
  }

  function onPointerMove(event) {
    if (pointerId == null || event.pointerId !== pointerId || !mountedPanel) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!dragging) {
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) cancelLongPress();
      return;
    }
    event.preventDefault();
    const pos = clampPosition(mountedPanel, originLeft + dx, originTop + dy);
    mountedPanel.style.setProperty('left', `${Math.round(pos.left)}px`, 'important');
    mountedPanel.style.setProperty('top', `${Math.round(pos.top)}px`, 'important');
    mountedPanel.style.setProperty('right', 'auto', 'important');
  }

  function onPointerUp(event) {
    if (pointerId == null || event.pointerId !== pointerId) return;
    stopDrag(true);
  }

  function attach(panel) {
    if (!panel || panel.dataset.mumeiFloating164 === '1') return;
    panel.dataset.mumeiFloating164 = '1';
    mountedPanel = panel;

    const title = panel.querySelector(':scope > .title');
    if (!title) return;
    const original = String(title.textContent || '極薄＋通知').trim();
    title.textContent = '';
    const text = document.createElement('span');
    text.className = 'mumei-title-text-v164';
    text.textContent = original.replace(/v16\.3/i, 'v16.4');
    const min = document.createElement('button');
    min.type = 'button';
    min.className = 'mumei-min-btn-v164';
    title.append(text, min);

    min.addEventListener('pointerdown', (event) => event.stopPropagation());
    min.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setMinimized(panel, !panel.classList.contains(MIN_CLASS), true);
    });

    title.addEventListener('pointerdown', (event) => {
      if (event.button != null && event.button !== 0) return;
      if (event.target?.closest?.('.mumei-min-btn-v164')) return;
      stopDrag(false);
      mountedPanel = panel;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      const rect = panel.getBoundingClientRect();
      originLeft = rect.left;
      originTop = rect.top;
      cancelLongPress();
      pressTimer = setTimeout(() => {
        if (pointerId !== event.pointerId) return;
        dragging = true;
        title.classList.add('mumei-dragging-v164');
        panel.style.setProperty('left', `${Math.round(originLeft)}px`, 'important');
        panel.style.setProperty('top', `${Math.round(originTop)}px`, 'important');
        panel.style.setProperty('right', 'auto', 'important');
        try { page.navigator?.vibrate?.(25); } catch (_) {}
      }, LONG_PRESS_MS);
    });

    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);

    const state = readState();
    setMinimized(panel, Boolean(state.minimized), false);
    page.requestAnimationFrame(() => applyPosition(panel, state));
  }

  function mount() {
    installStyle();
    const panel = document.getElementById(PANEL_ID);
    if (panel) attach(panel);
  }

  page.addEventListener('resize', () => {
    if (!mountedPanel?.isConnected) return;
    const rect = mountedPanel.getBoundingClientRect();
    const pos = clampPosition(mountedPanel, rect.left, rect.top);
    mountedPanel.style.setProperty('left', `${Math.round(pos.left)}px`, 'important');
    mountedPanel.style.setProperty('top', `${Math.round(pos.top)}px`, 'important');
    writeState(pos);
  }, { passive: true });

  setInterval(mount, 500);
  mount();
})();
