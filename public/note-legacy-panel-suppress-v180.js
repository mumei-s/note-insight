(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_LEGACY_PANEL_SUPPRESS_180__) return;
  page.__MUMEI_LEGACY_PANEL_SUPPRESS_180__ = true;

  const KEEP = 'mumei-note-source-picker-v163';
  const STYLE_ID = 'mumei-legacy-panel-suppress-v180-style';
  const selectors = [
    '[id^="mumei-likers-thin-panel-"]',
    '[id^="mumei-note-source-picker-v161"]',
    '[id^="mumei-note-source-picker-v162"]',
    '#mumei-direct-success-panel',
    '#mumei-direct-success-btn',
    '#mumei-notify-test-panel',
    '#mumei-notify-test-btn',
    '#mumei-notify-clean-btn',
    '#mumei-card-system-toggle'
  ];

  function installStyle() {
    if (!document.head || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = selectors.map((s) => `${s}{display:none!important;visibility:hidden!important;pointer-events:none!important}`).join('\n');
    document.head.appendChild(style);
  }

  function clean() {
    installStyle();
    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        if (node.id === KEEP) continue;
        node.setAttribute('aria-hidden', 'true');
        node.style.setProperty('display', 'none', 'important');
        node.style.setProperty('visibility', 'hidden', 'important');
        node.style.setProperty('pointer-events', 'none', 'important');
      }
    }
  }

  new MutationObserver(clean).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(clean, 1200);
  clean();
})();
