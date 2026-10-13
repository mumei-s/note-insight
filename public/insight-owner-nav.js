(() => {
  "use strict";

  const OWNER_KEY = "mumei-unified-owner-token";
  const MEMBER_KEY = "mumei-insight-access-token";
  const OWNER_RETURN_KEY = "mumei-owner-return";
  const NAV_ID = "mumei-insight-owner-route-nav";
  const STYLE_ID = "mumei-insight-owner-route-nav-style";

  function rawRoute() {
    return window.location.hash.replace(/^#\/?/, "") || "home";
  }

  function go(route) {
    const next = route || "home";
    const url = new URL(window.location.href);
    url.hash = next === "home" ? "" : next;
    window.history.pushState({ ...(window.history.state || {}), route: next }, "", url.toString());
    window.dispatchEvent(new Event("mumei-route"));
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function ownerReady() {
    return Boolean(localStorage.getItem(OWNER_KEY));
  }

  function memberReady() {
    return Boolean(localStorage.getItem(MEMBER_KEY));
  }

  function visibleForCurrentRoute() {
    const route = rawRoute();
    return ownerReady() || route === "owner" || route === "manage" || route.startsWith("owner-features/");
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${NAV_ID}{position:fixed;right:8px;top:max(8px,env(safe-area-inset-top,0px));z-index:2147483200;display:flex;gap:4px;padding:4px;border:1px solid rgba(105,205,232,.42);border-radius:12px;background:rgba(5,17,26,.94);backdrop-filter:blur(14px);box-shadow:0 8px 26px rgba(0,0,0,.38);font-family:system-ui,-apple-system,sans-serif}
      #${NAV_ID}[hidden]{display:none!important}
      #${NAV_ID} button{min-height:30px;padding:0 8px;border:1px solid rgba(101,199,225,.30);border-radius:8px;background:#102b3b;color:#dff8ff;font:900 9px/1 system-ui;white-space:nowrap;touch-action:manipulation}
      #${NAV_ID} button[data-route="home"]{color:#a6efff}
      #${NAV_ID} button[data-route="manage"]{border-color:rgba(255,207,90,.55);background:#3b2d0e;color:#ffe18b}
      #${NAV_ID} button.is-current{outline:1px solid #8feaff;outline-offset:1px;background:#1b5268;color:#fff}
      @media(max-width:420px){#${NAV_ID}{right:5px;gap:2px;padding:3px}#${NAV_ID} button{min-height:27px;padding:0 6px;font-size:7.5px}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    if (!document.body) return;
    installStyle();
    let nav = document.getElementById(NAV_ID);
    if (!nav) {
      nav = document.createElement("nav");
      nav.id = NAV_ID;
      nav.setAttribute("aria-label", "OWNER画面ナビゲーション");
      nav.innerHTML = `
        <button type="button" data-route="home">INSIGHT TOP</button>
        <button type="button" data-route="dashboard">INSIGHT</button>
        <button type="button" data-route="manage">管理</button>
      `;
      nav.addEventListener("click", (event) => {
        const button = event.target instanceof Element ? event.target.closest("button[data-route]") : null;
        if (!button) return;
        event.preventDefault();
        const route = String(button.getAttribute("data-route") || "home");
        if (route === "dashboard") {
          go(memberReady() ? "dashboard" : "access/insight");
          return;
        }
        if (route === "manage" && !ownerReady()) {
          sessionStorage.setItem(OWNER_RETURN_KEY, "manage");
          go("owner");
          return;
        }
        go(route);
      });
      document.body.appendChild(nav);
    }
    refresh();
  }

  function refresh() {
    const nav = document.getElementById(NAV_ID);
    if (!nav) return;
    nav.hidden = !visibleForCurrentRoute();
    const route = rawRoute();
    nav.querySelectorAll("button[data-route]").forEach((button) => {
      const target = button.getAttribute("data-route");
      const current = target === "home" ? route === "home" : target === route;
      button.classList.toggle("is-current", current);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();

  window.addEventListener("hashchange", refresh);
  window.addEventListener("popstate", refresh);
  window.addEventListener("mumei-route", refresh);
  window.addEventListener("pageshow", () => { mount(); refresh(); });
  window.addEventListener("storage", (event) => {
    if (event.key === OWNER_KEY || event.key === MEMBER_KEY) refresh();
  });
})();
