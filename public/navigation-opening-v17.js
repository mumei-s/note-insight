(() => {
  "use strict";

  const DEMO_MUMEI = "https://xxhaerjvrgmnadxjqetz.supabase.co/storage/v1/object/public/creator-images/opponent/4c6396f2-2304-4a73-a4a7-0d04ec634040/ac7f0338-e27c-434b-b9f1-f6c8fd259bcb.webp";
  const DEMO_CHIBI = "https://xxhaerjvrgmnadxjqetz.supabase.co/storage/v1/object/public/creator-images/opponent/2f315354-5fd1-4583-b8a9-a4aeb4bd7e5c/30febc13-9884-4338-8729-7837c4f6061a.webp";
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

  function gameMode(game) {
    if (game.classList.contains("g5-command")) return ["COMMAND", "TACTICAL BATTLE", "choice"];
    if (game.classList.contains("g5-tap")) return ["TAP RUSH", "FEVER DRIVE", "tap"];
    if (game.classList.contains("g5-puzzle")) return ["ARCANE PUZZLE", "MAGIC CHAIN", "puzzle"];
    return ["STAR SHOOTER", "COSMIC LOCK ON", "shoot"];
  }

  function gameArt(game, side, fallback) {
    const img = game.querySelector(`.g4-card.${side} img`);
    return img instanceof HTMLImageElement && img.src ? img.src : fallback;
  }

  function matchNames(game) {
    const active = game.closest(".g5-active");
    const trial = (active?.querySelector(".g5-game-toolbar small")?.textContent || "").includes("TRIAL");
    if (trial) return ["無名S note", "ちびS"];
    const names = active?.querySelectorAll(".g4-match-label span");
    return [names?.[0]?.textContent?.trim() || "PLAYER", names?.[1]?.textContent?.trim() || "RIVAL"];
  }

  function makeArt(src, className, alt) {
    const frame = document.createElement("div");
    frame.className = `v17-opening-character ${className}`;
    const image = document.createElement("img");
    image.src = src;
    image.alt = alt;
    image.decoding = "async";
    image.loading = "eager";
    frame.appendChild(image);
    const shade = document.createElement("i");
    shade.className = "v17-art-shade";
    frame.appendChild(shade);
    return frame;
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
    const playerSrc = gameArt(game, "player", DEMO_MUMEI);
    const rivalSrc = gameArt(game, "enemy", DEMO_CHIBI);
    const [playerName, rivalName] = matchNames(game);

    const layer = document.createElement("div");
    layer.className = `v17-opening-layer mode-${mode} ${versus ? "is-versus" : "is-intro"}`;

    const bg = document.createElement("div");
    bg.className = "v17-opening-bg";
    bg.style.setProperty("--v17-art-bg", `url(\"${playerSrc}\")`);
    layer.appendChild(bg);

    layer.appendChild(makeArt(playerSrc, "v17-mumei", playerName));
    if (versus) layer.appendChild(makeArt(rivalSrc, "v17-rival", rivalName));

    const copy = document.createElement("div");
    copy.className = "v17-opening-copy";
    copy.innerHTML = versus
      ? `<small>BATTLE ENTRY</small><div><span>${playerName}</span><b>VS</b><span>${rivalName}</span></div><strong>${title}</strong>`
      : `<small>CREATOR WORLD ORIGINAL · ${kicker}</small><strong>${title}</strong><span>${playerName}</span>`;
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
