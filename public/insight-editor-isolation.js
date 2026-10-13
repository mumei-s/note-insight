// INSIGHT owns its UI even when an older editor userscript remains installed.
(() => {
  "use strict";
  if (!location.pathname.startsWith("/note-insight/") || window.__MUMEI_EDITOR_ISOLATION_V1__) return;
  window.__MUMEI_EDITOR_ISOLATION_V1__ = true;
  const selector = "#mumei-like300-bridge,#mumei-like300-fix,#mumei-like300-fix-editor,#mumei-like300-fix-editor-v221,#mumei-profile-card-paster-v1,#mumei-profile-card-paster-v1-mini";

  // Consume the retired launch flag before a document-idle userscript sees it.
  const url = new URL(location.href);
  if (url.searchParams.has("like300prep")) {
    url.searchParams.delete("like300prep");
    history.replaceState(history.state, "", url.href);
  }

  function removePanels(node) {
    if (!(node instanceof Element)) return;
    if (node.matches(selector)) { node.remove(); return; }
    node.querySelectorAll(selector).forEach(panel => panel.remove());
  }
  removePanels(document.documentElement);
  // Inspect only added elements. Ordinary INSIGHT updates do not trigger writes.
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) removePanels(node);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
