(() => {
  "use strict";

  const currentRoute = () => location.hash.replace(/^#\/?/, "") || "home";
  const state = () => history.state || {};
  let synthetic = false;

  function withRoute(route, extra = {}) {
    return { ...state(), mumeiGuard: true, route, ...extra };
  }

  function routeUrl(route) {
    const url = new URL(location.href);
    url.hash = route === "home" ? "" : route;
    return url.toString();
  }

  function activeInsightButton() {
    return document.querySelector(".iv3-nav button.active");
  }

  function insightIsChild() {
    const button = activeInsightButton();
    return Boolean(button && (button.textContent || "").trim() !== "ダッシュボード");
  }

  function openInsightTop() {
    const button = [...document.querySelectorAll(".iv3-nav button")].find((node) => (node.textContent || "").trim() === "ダッシュボード");
    if (button) button.click();
  }

  function pushChild(kind, route) {
    history.pushState(withRoute(route, { [kind]: true }), "", location.href);
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const exit = target.closest(".app-exit-dialog button.danger");
    if (exit) {
      event.preventDefault();
      event.stopImmediatePropagation();
      location.replace("./exit.html");
      return;
    }

    const insightNav = target.closest(".iv3-nav button");
    if (insightNav && currentRoute() === "dashboard" && !synthetic) {
      const label = (insightNav.textContent || "").trim();
      if (label === "ダッシュボード") {
        const next = withRoute("dashboard");
        delete next.mumeiInsightChild;
        history.replaceState(next, "", location.href);
      } else if (!state().mumeiInsightChild) {
        pushChild("mumeiInsightChild", "dashboard");
      } else {
        history.replaceState(withRoute("dashboard", { mumeiInsightChild: true }), "", location.href);
      }
      return;
    }

    const catalogOpen = target.closest(".dir-participant, .dir-card");
    if (catalogOpen && currentRoute() === "catalog" && !document.querySelector(".dir-modal") && !synthetic) {
      if (!state().mumeiCatalogChild) pushChild("mumeiCatalogChild", "catalog");
      return;
    }

    const catalogClose = target.closest(".dir-close") || (target.classList && target.classList.contains("dir-modal") ? target : null);
    if (catalogClose && currentRoute() === "catalog" && state().mumeiCatalogChild && !synthetic) {
      event.preventDefault();
      event.stopImmediatePropagation();
      history.back();
      return;
    }

    const gameOpen = target.closest(".concept-enter");
    if (gameOpen && currentRoute() === "battle" && !document.querySelector(".g5-active") && !synthetic) {
      if (!state().mumeiGameChild) pushChild("mumeiGameChild", "battle");
      return;
    }

    const gameBack = target.closest(".g5-active .mode-back");
    if (gameBack && currentRoute() === "battle" && state().mumeiGameChild && !synthetic) {
      event.preventDefault();
      event.stopImmediatePropagation();
      history.back();
    }
  }, true);

  window.addEventListener("popstate", (event) => {
    if (insightIsChild()) {
      event.stopImmediatePropagation();
      if (currentRoute() !== "dashboard") history.pushState(withRoute("dashboard"), "", routeUrl("dashboard"));
      setTimeout(() => {
        synthetic = true;
        openInsightTop();
        synthetic = false;
      }, 0);
      return;
    }

    if (document.querySelector(".dir-modal")) {
      event.stopImmediatePropagation();
      if (currentRoute() !== "catalog") history.pushState(withRoute("catalog"), "", routeUrl("catalog"));
      setTimeout(() => {
        synthetic = true;
        document.querySelector(".dir-close")?.click();
        synthetic = false;
      }, 0);
      return;
    }

    const gameBack = document.querySelector(".g5-active .mode-back");
    if (gameBack) {
      event.stopImmediatePropagation();
      if (currentRoute() !== "battle") history.pushState(withRoute("battle"), "", routeUrl("battle"));
      setTimeout(() => {
        synthetic = true;
        gameBack.click();
        synthetic = false;
      }, 0);
    }
  }, true);

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function gameMode(game) {
    if (game.classList.contains("g5-command")) return ["COMMAND", "TACTICAL BATTLE", "choice"];
    if (game.classList.contains("g5-tap")) return ["TAP RUSH", "FEVER DRIVE", "tap"];
    if (game.classList.contains("g5-puzzle")) return ["ARCANE PUZZLE", "MAGIC CHAIN", "puzzle"];
    return ["STAR SHOOTER", "COSMIC LOCK ON", "shoot"];
  }

  function decoratePrelude(root) {
    if (!(root instanceof HTMLElement) || !root.classList.contains("g4-prelude")) return;
    const phase = root.classList.contains("is-versus") ? "versus" : "intro";
    if (root.dataset.v17Phase === phase && root.querySelector(".v17-opening-layer")) return;
    root.dataset.v17Phase = phase;
    root.classList.add("v17-force-opening");
    root.querySelector(".v17-opening-layer")?.remove();

    const game = root.closest(".g4-game");
    if (!(game instanceof HTMLElement)) return;
    const [title, kicker, mode] = gameMode(game);
    const versus = phase === "versus";
    const rankedEnemy = game.querySelector(".g4-card.enemy img");
    const mumei = cssVar("--g6-mumei");
    const chibi = cssVar("--g6-chibi");
    const enemyImage = rankedEnemy instanceof HTMLImageElement && rankedEnemy.src ? `url(\"${rankedEnemy.src}\")` : chibi;

    const layer = document.createElement("div");
    layer.className = `v17-opening-layer mode-${mode} ${versus ? "is-versus" : "is-intro"}`;

    const bg = document.createElement("div");
    bg.className = "v17-opening-bg";
    layer.appendChild(bg);

    const left = document.createElement("div");
    left.className = "v17-opening-character v17-mumei";
    left.style.backgroundImage = mumei;
    layer.appendChild(left);

    if (versus) {
      const right = document.createElement("div");
      right.className = "v17-opening-character v17-rival";
      right.style.backgroundImage = enemyImage;
      layer.appendChild(right);
    }

    const copy = document.createElement("div");
    copy.className = "v17-opening-copy";
    copy.innerHTML = versus
      ? `<small>BATTLE ENTRY</small><div><span>無名S note</span><b>VS</b><span>${rankedEnemy ? "RIVAL" : "ちびS"}</span></div><strong>${title}</strong>`
      : `<small>CREATOR WORLD ORIGINAL · ${kicker}</small><strong>${title}</strong><span>無名S note</span>`;
    layer.appendChild(copy);

    const streak = document.createElement("div");
    streak.className = "v17-opening-streak";
    layer.appendChild(streak);
    root.appendChild(layer);
  }

  const observer = new MutationObserver(() => {
    document.querySelectorAll(".g4-prelude").forEach(decoratePrelude);
  });

  function startObserver() {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    document.querySelectorAll(".g4-prelude").forEach(decoratePrelude);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  else startObserver();
})();
