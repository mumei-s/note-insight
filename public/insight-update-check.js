(() => {
  'use strict';

  const BANNER_ID = 'insight-release-banner-v1';
  const STYLE_ID = 'insight-release-banner-style-v1';
  const CONFIRMED_KEY = 'mumei_insight_confirmed_release_v1';
  const HIDDEN_KEY = 'mumei_insight_hidden_release_v1';
  const POLL_MS = 10 * 60 * 1000;

  const scriptUrl = document.currentScript?.src || '';
  const baseUrl = scriptUrl
    ? new URL('.', scriptUrl)
    : new URL('/note-insight/', location.origin);
  const manifestUrl = new URL('insight-release.json', baseUrl);

  let checking = false;

  function fingerprint(release) {
    return [
      String(release?.appVersion || ''),
      String(release?.notificationVersion || ''),
      String(release?.dashboardVersion || '')
    ].join('|');
  }

  function validFingerprint(value) {
    return String(value || '').replace(/\|/g, '').trim().length > 0;
  }

  function cleanUpdateQuery() {
    const url = new URL(location.href);
    let changed = false;
    for (const key of ['insight_updated', '_insight_cb']) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) history.replaceState(history.state, '', url.href);
  }

  async function loadRelease() {
    const url = new URL(manifestUrl);
    url.searchParams.set('_', String(Date.now()));
    const response = await fetch(url.href, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`release ${response.status}`);
    return response.json();
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BANNER_ID}{position:fixed;z-index:2147483647;top:max(8px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(620px,calc(100vw - 16px));background:linear-gradient(135deg,#14210b,#0b1219 55%,#101728);color:#f6ffe2;border:1px solid #83a83b;border-radius:14px;padding:10px 11px;box-shadow:0 14px 34px rgba(0,0,0,.42);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
      #${BANNER_ID} .ir-top{display:flex;align-items:center;gap:8px}
      #${BANNER_ID} .ir-new{flex:0 0 auto;padding:4px 7px;border-radius:999px;background:#cfff64;color:#172104;font-size:10px;font-weight:950;letter-spacing:.04em}
      #${BANNER_ID} .ir-title{font-size:14px;font-weight:950;line-height:1.2}
      #${BANNER_ID} .ir-version{margin-top:5px;color:#d6e6bf;font-size:10px;line-height:1.45;word-break:break-word}
      #${BANNER_ID} .ir-note{margin-top:5px;color:#c8d2dd;font-size:10px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      #${BANNER_ID} .ir-actions{display:grid;grid-template-columns:1fr .72fr;gap:7px;margin-top:8px}
      #${BANNER_ID} button{height:34px;border-radius:9px;border:1px solid #425064;font:900 11px system-ui,-apple-system,sans-serif;touch-action:manipulation}
      #${BANNER_ID} .ir-update{background:#cfff64;color:#172104;border-color:#cfff64}
      #${BANNER_ID} .ir-later{background:#15202c;color:#dbe7f2}
    `;
    document.head?.appendChild(style);
  }

  function releaseDetail(release) {
    const parts = [];
    if (release?.appVersion) parts.push(`${release.appLabel || 'INSIGHT本体'} ${release.appVersion}`);
    if (release?.notificationVersion) parts.push(`${release.notificationLabel || '本人通知'} ${release.notificationVersion}`);
    if (release?.dashboardVersion) parts.push(`${release.dashboardLabel || 'Dashboard'} ${release.dashboardVersion}`);
    return parts.join(' / ');
  }

  function render(release, fp) {
    if (!document.body) return;
    installStyle();
    document.getElementById(BANNER_ID)?.remove();

    const box = document.createElement('aside');
    box.id = BANNER_ID;
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');

    const top = document.createElement('div');
    top.className = 'ir-top';
    const badge = document.createElement('span');
    badge.className = 'ir-new';
    badge.textContent = 'NEW';
    const title = document.createElement('strong');
    title.className = 'ir-title';
    title.textContent = '本体更新があります';
    top.append(badge, title);

    const version = document.createElement('div');
    version.className = 'ir-version';
    version.textContent = releaseDetail(release);

    const note = document.createElement('div');
    note.className = 'ir-note';
    note.textContent = String(release?.note || 'INSIGHTの最新版を利用できます。');

    const actions = document.createElement('div');
    actions.className = 'ir-actions';
    const update = document.createElement('button');
    update.type = 'button';
    update.className = 'ir-update';
    update.textContent = '最新版へ更新';
    const later = document.createElement('button');
    later.type = 'button';
    later.className = 'ir-later';
    later.textContent = 'あとで';
    actions.append(update, later);

    update.addEventListener('click', () => {
      try { sessionStorage.removeItem(HIDDEN_KEY); } catch (_) {}
      const url = new URL(location.href);
      url.searchParams.set('insight_updated', fp);
      url.searchParams.set('_insight_cb', String(Date.now()));
      location.replace(url.href);
    });

    later.addEventListener('click', () => {
      try { sessionStorage.setItem(HIDDEN_KEY, fp); } catch (_) {}
      box.remove();
    });

    box.append(top, version, note, actions);
    document.body.prepend(box);
  }

  async function checkRelease() {
    if (checking) return;
    checking = true;
    try {
      const release = await loadRelease();
      const fp = fingerprint(release);
      if (!validFingerprint(fp)) return;

      const query = new URLSearchParams(location.search);
      if (query.get('insight_updated') === fp) {
        try {
          localStorage.setItem(CONFIRMED_KEY, fp);
          sessionStorage.removeItem(HIDDEN_KEY);
        } catch (_) {}
        document.getElementById(BANNER_ID)?.remove();
        cleanUpdateQuery();
        return;
      }

      let confirmed = '';
      let hidden = '';
      try {
        confirmed = localStorage.getItem(CONFIRMED_KEY) || '';
        hidden = sessionStorage.getItem(HIDDEN_KEY) || '';
      } catch (_) {}

      if (fp === confirmed || fp === hidden) {
        document.getElementById(BANNER_ID)?.remove();
        return;
      }
      render(release, fp);
    } catch (_) {
      // 更新確認失敗時はINSIGHT本体の操作を妨げない。
    } finally {
      checking = false;
    }
  }

  function boot() {
    void checkRelease();
    setInterval(() => void checkRelease(), POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void checkRelease();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
