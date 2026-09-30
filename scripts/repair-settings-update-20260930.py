#!/usr/bin/env python3
"""Guarded, one-time repair. No backend, credentials, or participant data changes."""
from pathlib import Path
import subprocess
import json
from datetime import datetime, timezone

EXPECTED = {
 'src/insight-top-install-v16.ts': '31d7fa13da1ff6c73c6d0dc73a75a7e1fe8eaedc',
 'src/member-insight-live-v2.tsx': '4cff88d7b435ca65954d86be3796a53d2db4454c',
 'src/insight-inline-updates-v1.ts': 'be9bdee6da565d5980ca150b19331e9a91c037e2',
 'src/api.ts': '560483d1bd839b7fc64ece4a6e336b4cc63fe264',
 'public/sw.js': 'bfa3b97c293c75e7380c8491fdc2418c7ceff2a3',
 'src/insight-release.ts': '4545310b5eab80c0afa689e4816ca7bb5decba5e',
 'public/insight-release.json': '10b4535bc9100bacb8169d2f41404cff37cbbb42',
}
for path, expected in EXPECTED.items():
 actual = subprocess.check_output(['git', 'hash-object', path], text=True).strip()
 if actual != expected:
  raise SystemExit(f'SOURCE_CHANGED: {path}; re-read and reconcile before applying')

def replace_once(text, before, after):
 if text.count(before) != 1:
  raise SystemExit('PATCH_ANCHOR_MISMATCH: ' + before[:120])
 return text.replace(before, after, 1)

path = Path('src/insight-top-install-v16.ts')
s = path.read_text()
s = replace_once(s, 'function ensureNoticeControls(){', '''function paintSettings(link:HTMLElement,card:HTMLElement,kind:"dashboard"|"notice"){
  const pending=card.classList.contains("needs-update"),missing=card.classList.contains("needs-install");
  const label=kind==="dashboard"?"分析":"本人通知";
  textIfChanged(link,pending?"更新":"設定");
  const description=pending?`${label}の設定・更新：更新があります。押して更新画面へ`:missing?`${label}の設定：このブラウザへツールを導入`:`${label}の設定・更新`;
  for(const [name,value]of[["title",description],["aria-label",description],["data-update-state",pending?"available":missing?"missing":"current"]]){if(link.getAttribute(name)!==value)link.setAttribute(name,value)}
}
function ensureNoticeControls(){''')
s = replace_once(s,
 'textIfChanged(link,card.classList.contains("needs-update")?"更新あり":card.classList.contains("needs-install")?"＋ インストール":"設定");link.title=card.classList.contains("needs-update")?"本人通知の更新があります":card.classList.contains("needs-install")?"本人通知をこの端末へインストール":"本人通知の設定・更新";',
 'paintSettings(link,card,"notice");')
s = replace_once(s,
 'if(settings){textIfChanged(settings,card.classList.contains("needs-update")?"更新":"設定");if(settings.title!=="ダッシュボードの設定・更新")settings.title="ダッシュボードの設定・更新"}',
 'if(settings)paintSettings(settings,card,"dashboard");')
s = replace_once(s,
 '/* The analysis card itself is the update action; keep the indicator steady. */',
 '/* Feature cards open their feature. Only the round settings link announces a tool update. */')
s = replace_once(s,
 '.miv5-update .miv5-source-card.dashboard.needs-update>.miv5-source-main{border:2px solid #b6ff38!important;background:linear-gradient(145deg,#173324,#0a2025)!important;box-shadow:0 0 13px #b6ff3860,inset 0 0 12px #b6ff381c!important}',
 '.miv5-update .miv5-source-card.dashboard.needs-update>.miv5-source-main,.miv5-update .miv5-source-card.dashboard.needs-install>.miv5-source-main{border:1px solid #416a83!important;background:#0a1823!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.015)!important}')
s = replace_once(s,
 '.miv5-update .miv5-source-card.dashboard.needs-install>.miv5-source-main{border-color:#dfb664!important;background:#231e10!important;box-shadow:0 0 0 1px #dfb66445!important}',
 '''.miv5-update .miv5-source-card.notice.needs-update>.miv5-source-main,.miv5-update .miv5-source-card.notice.needs-install>.miv5-source-main{border:1px solid #77633a!important;background:#241b0c!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.015)!important}
.miv5-update .miv5-source-card.dashboard>.miv5-source-main em,.miv5-update .miv5-source-card.notice>.miv5-source-main em{display:none!important}
.miv5-update .miv5-source-card.needs-update a.${CANONICAL}{border:2px solid #b6ff38!important;background:#b6ff38!important;color:#101700!important;box-shadow:0 0 0 2px rgba(182,255,56,.18),0 0 12px rgba(182,255,56,.6)!important;animation:none!important;transition:none!important;font-weight:950!important}
.miv5-update a.${CANONICAL}:focus-visible{outline:2px solid #ffffff!important;outline-offset:2px!important}''')
path.write_text(s)

path = Path('src/member-insight-live-v2.tsx')
s = path.read_text()
s = replace_once(s,
 '{dashboardUpdateAvailable||dashboardMissing?<a className="miv5-source-main" href={dashboardSetupHref} aria-label={dashboardUpdateAvailable?"分析：ダッシュボード同期を更新":"分析：ダッシュボード同期を導入"}>{dashboardCardContent}</a>:<button className="miv5-source-main" onClick={()=>openMode("analysis")}>{dashboardCardContent}</button>}',
 '<button className="miv5-source-main" onClick={()=>openMode("analysis")} aria-label="分析を開く。設定・更新は下の丸いボタンです">{dashboardCardContent}</button>')
s = replace_once(s,
 'await Promise.all(regs.filter(r=>r.scope.includes("/note-insight/")).map(r=>r.update().catch(()=>undefined)));',
 'await Promise.race([Promise.all(regs.filter(r=>r.scope===new URL(import.meta.env.BASE_URL,window.location.origin).href).map(r=>r.update().catch(()=>undefined))),sleep(6000)]);')
s = replace_once(s,
 'sessionStorage.setItem(APP_UPDATE_RESULT_KEY,latestVersion);\n      window.location.reload();',
 'sessionStorage.setItem(APP_UPDATE_RESULT_KEY,latestVersion);\n      const target=new URL(window.location.href);\n      target.searchParams.set("insightAppVersion",latestVersion);\n      window.location.replace(target.href);')
s = replace_once(s,
 'if(expected&&expected===CURRENT_INSIGHT_APP_VERSION){sessionStorage.removeItem(APP_UPDATE_RESULT_KEY);return`✅ INSIGHT本体 v${CURRENT_INSIGHT_APP_VERSION} 更新完了・最新版`;}return""',
 'if(expected&&expected===CURRENT_INSIGHT_APP_VERSION){sessionStorage.removeItem(APP_UPDATE_RESULT_KEY);return`✅ INSIGHT本体 v${CURRENT_INSIGHT_APP_VERSION} 更新完了・最新版`;}if(expected)return`⚠ 更新を完了できていません。現在 v${CURRENT_INSIGHT_APP_VERSION}／更新先 v${expected}。通信を確認して本体更新を再試行してください。`;return""')
s = replace_once(s,
 'window.addEventListener("focus",refresh);window.addEventListener("pageshow",refresh);window.addEventListener("mumei-notification-version-changed",refresh);document.addEventListener("visibilitychange",refresh);',
 'const storageRefresh=(event:StorageEvent)=>{if(event.key===NOTIFICATION_VERSION_STORAGE_KEY||event.key===DASHBOARD_VERSION_STORAGE_KEY)refresh()};\n    window.addEventListener("online",refresh);window.addEventListener("storage",storageRefresh);\n    window.addEventListener("focus",refresh);window.addEventListener("pageshow",refresh);window.addEventListener("mumei-notification-version-changed",refresh);document.addEventListener("visibilitychange",refresh);')
s = replace_once(s,
 'return()=>{window.clearInterval(timer);window.removeEventListener("focus",refresh);',
 'return()=>{window.clearInterval(timer);window.removeEventListener("online",refresh);window.removeEventListener("storage",storageRefresh);window.removeEventListener("focus",refresh);')
path.write_text(s)

Path('src/insight-inline-updates-v1.ts').write_text('''export {};
// This layer only explains feature actions. The canonical top controls own update styling.
let timer=0;
function paint(){
  for(const kind of ["normal","notice","dashboard"]){
    const card=document.querySelector<HTMLElement>(`.miv5-source-card.${kind}`);
    const main=card?.querySelector<HTMLElement>(".miv5-source-main");if(!main)continue;
    const title=kind==="normal"?"公開データを再取得。INSIGHT本体の更新とは別です":kind==="dashboard"?"分析を開く。設定・更新は下の丸いボタンです":"本人通知を開く。設定・更新は下の丸いボタンです";
    if(main.title!==title)main.title=title;
  }
}
function schedule(ms=160){window.clearTimeout(timer);timer=window.setTimeout(paint,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule()).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","aria-busy"]});
window.addEventListener("pageshow",()=>schedule(20));window.addEventListener("focus",()=>schedule(20));
''')

path = Path('src/api.ts')
s = path.read_text()
old = '''export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
'''
new = '''export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  let registration: ServiceWorkerRegistration | null = null;
  let registering: Promise<void> | null = null;
  let checking = false, lastCheck = 0;
  const start = () => {
    if (registration) return Promise.resolve();
    if (registering) return registering;
    registering = navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: "none" })
      .then((value) => { registration = value; })
      .catch(() => { /* Offline/blocked SW must not block the app or erase sessions. */ })
      .finally(() => { registering = null; });
    return registering;
  };
  const refresh = async () => {
    if (document.visibilityState !== "visible" || navigator.onLine === false || checking || Date.now() - lastCheck < 60_000) return;
    checking = true; lastCheck = Date.now();
    try { await start(); if (registration) await registration.update(); }
    catch { /* A later foreground/online event retries. Never force-reload active work. */ }
    finally { checking = false; }
  };
  if (document.readyState === "complete") void start();
  else window.addEventListener("load", () => { void start(); }, { once: true });
  window.addEventListener("pageshow", () => { void refresh(); });
  window.addEventListener("focus", () => { void refresh(); });
  window.addEventListener("online", () => { lastCheck = 0; void refresh(); });
  document.addEventListener("visibilitychange", () => { void refresh(); });
}
'''
s = replace_once(s, old, new)
path.write_text(s)

Path('public/sw.js').write_text('''const CACHE_NAME = "mumei-note-insight-v67-settings-update-20260930";
const SCOPE = new URL(self.registration.scope);
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg", "./recovery.html"];
const shellPaths = new Set(APP_SHELL.map(path => new URL(path, SCOPE).pathname));
const indexUrl = new URL("./index.html", SCOPE).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async path => {
      const url = new URL(path, SCOPE).href;
      const response = await fetch(url, { cache: "reload" });
      if (!response.ok) throw new Error("APP_SHELL_" + response.status);
      await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("mumei-note-insight-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const relative = url.pathname.slice(SCOPE.pathname.length);
  // Release manifests, userscripts and installers must never report a cached release as current.
  const updateResource = relative === "insight-release.json" || relative.endsWith(".user.js") || /^(?:notification|dashboard|tool)-(?:setup|update|install|browser-install|entry).*\\.(?:html|js)$/.test(relative);
  if (updateResource) { event.respondWith(fetch(request, { cache: "no-store" })); return; }
  const appNavigation = url.pathname === SCOPE.pathname || url.pathname === new URL(indexUrl).pathname;
  const cacheable = shellPaths.has(url.pathname) || /^assets\\/[a-zA-Z0-9_-]+[.-][a-zA-Z0-9_-]+\\.(?:js|css|woff2?|png|svg)$/.test(relative);
  const key = appNavigation ? indexUrl : url.origin + url.pathname;
  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: "no-store" });
      if (response.ok && cacheable) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(key, copy)).catch(() => {}));
      }
      return response;
    } catch {
      const cache = await caches.open(CACHE_NAME);
      const cached = cacheable ? await cache.match(key) : undefined;
      if (cached) return cached;
      if (request.mode === "navigate" && appNavigation) {
        const shell = await cache.match(indexUrl); if (shell) return shell;
      }
      return new Response("オフラインです。通信を確認して再度開いてください。更新は完了していません。", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    }
  })());
});
''')

path = Path('src/insight-release.ts')
path.write_text(replace_once(path.read_text(), 'CURRENT_INSIGHT_APP_VERSION = "2026.09.30.7"', 'CURRENT_INSIGHT_APP_VERSION = "2026.09.30.8"'))
path = Path('public/insight-release.json')
p = json.loads(path.read_text())
p.update(appVersion='2026.09.30.8', releasedAt=datetime.now(timezone.utc).isoformat(), note='Pro復旧後の更新。分析・本人通知の更新表示を丸い設定ボタンへ統一。本体更新URL・Service Worker・再接続時の更新確認を改善。通知3.6.20／Dashboard1.6.4／DM1.4.9は変更なし。ログインと保存履歴は保持。')
path.write_text(json.dumps(p, ensure_ascii=False, indent=2) + '\n')
print('Patched exactly:', ', '.join(EXPECTED))
