(() => {
  "use strict";

  // Older cached HTML may still request this recovery-only navigation script.
  // Keep its URL available, but retire the extra controls from every route.
  function removeRecoveryNavigation() {
    document.getElementById("mumei-insight-owner-route-nav")?.remove();
    document.getElementById("mumei-insight-owner-route-nav-style")?.remove();
  }

  removeRecoveryNavigation();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", removeRecoveryNavigation, { once: true });
  }
  window.addEventListener("pageshow", removeRecoveryNavigation);
})();
