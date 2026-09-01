(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_NOTE_SOURCE_PICKER_161__) return;
  page.__MUMEI_NOTE_SOURCE_PICKER_161__ = true;

  const VERSION = '16.1.0';
  const BASE_VERSION = '16.0.0';
  // v16.0の成功済み画像・通知・削除処理へ対象リストだけ渡す。
  // base側の互換チェックを通すためsourceKeyは固定値を保持し、実際の入力元はsourceUrl/sourceModeへ保存する。
  const BASE_SOURCE_KEY = 'n08825c632afd';
  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const PREF_KEY = 'mumei_note_source_picker_v161';
  const PANEL = 'mumei-note-source-picker-v161';
  const STATUS = 'mumei-note-source-status-v161';
  const BASE_PANEL = 'mumei-likers-thin-panel-v160';
  const BASE_STATUS = 'mumei-likers-thin-status-v160';

  let busy = false;
  let ownStatusAt = 0;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  class FatalError extends Error {}

  function articleKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }
  function enabled() {
    return /^\/notes\/n[a-z0-9]{8,}\/edit\/?$/i.test(location.pathname) && Boolean(articleKey());
  }
  function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const u = new URL(raw, location.href);
      u.search = '';
      u.hash = '';
      return u.href;
    } catch (_) { return raw; }
  }
  function noteKey(url) {
    return String(url || '').match(/\/n\/(n[a-f0-9]{12})(?:[/?#]|$)/i)?.[1] || '';
  }
  function magazineKey(url) {
    return String(url || '').match(/\/(?:m|magazines)\/(m[a-z0-9]+)(?:[/?#]|$)/i)?.[1] || '';
  }
  function getJSON(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch (_) { return fallback; }
  }
  function setJSON(key, value) {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }
  function runKey() {
    return `${RUN_PREFIX}:${articleKey() || 'unknown'}`;
  }
  function setStatus(text, bad = false) {
    const node = document.getElementById(STATUS);
    if (!node) return;
    node.textContent = text;
    node.dataset.bad = bad ? '1' : '0';
    ownStatusAt = Date.now();
  }
  function setBusy(value) {
    busy = value;
    const panel = document.getElementById(PANEL);
    if (panel) panel.querySelectorAll('button,input').forEach((node) => { node.disabled = value; });
  }
  function prefs() {
    const p = getJSON(PREF_KEY, {});
    return {
      mode: p?.mode === 'magazine' ? 'magazine' : 'likes',
      likesUrl: String(p?.likesUrl || 'https://note.com/ss_yr/n/n08825c632afd'),
      magazineUrl: String(p?.magazineUrl || '')
    };
  }
  function savePrefs(next) { setJSON(PREF_KEY, next); }

  function xhr(url, responseType = 'text', timeout = 45000) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, responseType, timeout,
        headers: { Accept: responseType === 'blob' ? 'image/avif,image/webp,image/png,image/jpeg,*/*' : 'application/json,text/html,*/*' },
        onload: (r) => r.status >= 200 && r.status < 300 ? resolve(r.response) : reject(new Error(`GET ${r.status}: ${url}`)),
        onerror: () => reject(new Error(`通信失敗: ${url}`)),
        ontimeout: () => reject(new Error(`通信タイムアウト: ${url}`))
      });
    });
  }
  async function xhrJSON(url) {
    const value = await xhr(url, 'text');
    try { return JSON.parse(String(value || '')); }
    catch (_) { throw new Error(`JSON解析失敗: ${url}`); }
  }
  async function mapLimit(values, limit, worker) {
    const out = new Array(values.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor++;
        out[index] = await worker(values[index], index);
      }
    });
    await Promise.all(runners);
    return out;
  }

  function parseLiker(item) {
    const user = item?.user || {};
    const urlname = String(user?.urlname || '').trim();
    const likerKey = String((user?.key ?? user?.id ?? urlname) || '').trim();
    if (!likerKey || !urlname) return null;
    return {
      likerKey,
      urlname,
      creator: String(user?.nickname || user?.name || urlname).trim(),
      actorUrl: `https://note.com/${urlname}`,
      actorImageUrl: String(user?.user_profile_image_url || user?.profileImageUrl || user?.profile_image_url || '').trim(),
      likedAt: String(item?.created_at || item?.createdAt || '').trim() || null
    };
  }
  async function collectLikers(sourceKey) {
    const map = new Map();
    for (let pageNo = 1; pageNo <= 60; pageNo += 1) {
      setStatus(`スキした人を取得 ${map.size}人… page ${pageNo}`);
      const payload = await xhrJSON(`https://note.com/api/v3/notes/${encodeURIComponent(sourceKey)}/likes?page=${pageNo}&per=50`);
      const list = Array.isArray(payload?.data?.likes) ? payload.data.likes : [];
      const before = map.size;
      for (const item of list) {
        const row = parseLiker(item);
        if (row) map.set(row.likerKey, row);
      }
      if (!list.length || list.length < 50 || map.size === before) break;
      await sleep(50);
    }
    return [...map.values()];
  }
  function contentList(payload) {
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    return Array.isArray(data.contents) ? data.contents : Array.isArray(data.notes) ? data.notes : [];
  }
  function parseLatest(payload, liker) {
    for (const raw of contentList(payload)) {
      const note = raw?.note && typeof raw.note === 'object' ? raw.note : raw;
      const key = String(note?.key || '').trim();
      if (!/^n[a-f0-9]{12}$/i.test(key)) continue;
      const url = normalizeUrl(note?.noteUrl || note?.url || `https://note.com/${liker.urlname}/n/${key}`);
      return {
        ...liker,
        url,
        title: String(note?.name || note?.title || '無題の記事').trim(),
        latestKey: key,
        publishAt: String(note?.publishAt || note?.publish_at || '').trim() || null
      };
    }
    return null;
  }
  async function latestForLiker(liker) {
    try {
      const payload = await xhrJSON(`https://note.com/api/v2/creators/${encodeURIComponent(liker.urlname)}/contents?kind=note&page=1`);
      return parseLatest(payload, liker);
    } catch (_) { return null; }
  }

  function parseMagazineArticle(raw) {
    const note = raw?.note && typeof raw.note === 'object' ? raw.note : raw;
    if (!note || typeof note !== 'object') return null;
    const key = String(note?.key || '').trim();
    if (!/^n[a-f0-9]{12}$/i.test(key)) return null;
    const user = note?.user || note?.author || {};
    const urlname = String(user?.urlname || '').trim();
    const url = normalizeUrl(note?.noteUrl || note?.url || (urlname ? `https://note.com/${urlname}/n/${key}` : ''));
    if (!url) return null;
    return {
      likerKey: String((user?.key ?? user?.id ?? urlname ?? key) || key),
      urlname,
      creator: String(user?.nickname || user?.name || urlname || 'noteクリエイター').trim(),
      actorUrl: urlname ? `https://note.com/${urlname}` : '',
      actorImageUrl: String(user?.user_profile_image_url || user?.profileImageUrl || user?.profile_image_url || '').trim(),
      url,
      title: String(note?.name || note?.title || '無題の記事').trim(),
      latestKey: key,
      publishAt: String(note?.publish_at || note?.publishAt || '').trim() || null,
      magazineOrder: null
    };
  }
  async function collectMagazineArticles(key) {
    const rows = [];
    const seen = new Set();
    const limit = 100;
    let start = 0;
    for (let pageNo = 1; pageNo <= 100; pageNo += 1) {
      setStatus(`マガジン記事を取得 ${rows.length}件…`);
      const payload = await xhrJSON(`https://note.com/api/v1/magazines/${encodeURIComponent(key)}/notes?start=${start}&limit=${limit}`);
      const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
      const list = Array.isArray(data.notes) ? data.notes : [];
      let added = 0;
      for (const raw of list) {
        const row = parseMagazineArticle(raw);
        if (!row) continue;
        const url = normalizeUrl(row.url);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        row.magazineOrder = rows.length + 1;
        rows.push(row);
        added += 1;
      }
      if (!list.length || list.length < limit || added === 0) break;
      start += list.length;
      await sleep(70);
    }
    return rows;
  }

  async function enrichArticle(row) {
    let thumbUrl = row.actorImageUrl || '';
    let creator = row.creator;
    let title = row.title;
    try {
      const payload = await xhrJSON(`https://note.com/api/v3/notes/${encodeURIComponent(row.latestKey)}`);
      const note = payload?.data || payload || {};
      title = String(note?.name || note?.title || title || '無題の記事').trim();
      creator = String(note?.user?.nickname || note?.user?.name || creator || 'noteクリエイター').trim();
      const candidates = [
        note?.eyecatch_url, note?.eyecatch, note?.image_url,
        note?.user?.profileImageUrl, note?.user?.profile_image_url, row.actorImageUrl
      ].map((v) => String(v || '').trim()).filter(Boolean);
      thumbUrl = candidates[0] || thumbUrl;
      if (thumbUrl.startsWith('//')) thumbUrl = `https:${thumbUrl}`;
    } catch (_) {}
    return { ...row, title, creator, thumbUrl };
  }

  function selectedInput() {
    const panel = document.getElementById(PANEL);
    const mode = panel?.querySelector('button[data-mode].active')?.dataset.mode || prefs().mode;
    const input = panel?.querySelector('input[data-source]');
    const url = String(input?.value || '').trim();
    return { mode, url };
  }
  function baseRun() { return getJSON(runKey(), null); }
  function baseAction(action) {
    const button = document.querySelector(`#${BASE_PANEL} button[data-a="${action}"]`);
    if (!button) {
      setStatus('成功版16.0本体のボタンを取得できません。編集画面を再読込してください', true);
      return false;
    }
    button.click();
    return true;
  }

  async function extractSelected() {
    if (busy || !enabled()) return;
    const existing = baseRun();
    if (Array.isArray(existing?.cardKeys) && existing.cardKeys.length) {
      setStatus(`前回の通知カード記録が${existing.cardKeys.length}件あります。先に「削」`, true);
      return;
    }
    const { mode, url } = selectedInput();
    if (!url) { setStatus('抽出元URLを入力してください', true); return; }
    setBusy(true);
    try {
      let sourceKey = '';
      let sourceRows = [];
      let sourceCount = 0;
      let skipped = 0;

      if (mode === 'likes') {
        sourceKey = noteKey(url);
        if (!sourceKey) throw new FatalError('スキ元は noteの記事URLを入れてください');
        const likers = await collectLikers(sourceKey);
        if (!likers.length) throw new FatalError('スキした人を取得できませんでした');
        sourceCount = likers.length;
        setStatus(`${likers.length}人取得 ✅ 各人の最新記事を確認中…`);
        const latest = await mapLimit(likers, 5, async (liker, index) => {
          const row = await latestForLiker(liker);
          setStatus(`最新記事 ${index + 1}/${likers.length}…`);
          return row;
        });
        sourceRows = latest.filter(Boolean);
        skipped = likers.length - sourceRows.length;
      } else {
        sourceKey = magazineKey(url);
        if (!sourceKey) throw new FatalError('マガジン元は noteのマガジンURLを入れてください');
        sourceRows = await collectMagazineArticles(sourceKey);
        sourceCount = sourceRows.length;
        if (!sourceRows.length) throw new FatalError('マガジン掲載記事を取得できませんでした');
      }

      const unique = [];
      const seen = new Set();
      for (const row of sourceRows) {
        const normalized = normalizeUrl(row.url);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        unique.push({ ...row, url: normalized });
      }
      if (!unique.length) throw new FatalError('紹介対象記事が0件です');

      setStatus(`${unique.length}件の記事情報・サムネを準備中…`);
      const enriched = await mapLimit(unique, 5, async (row, index) => {
        const item = await enrichArticle(row);
        setStatus(`記事情報 ${index + 1}/${unique.length}…`);
        return item;
      });
      const rows = enriched.map((row, index) => ({ ...row, index: index + 1 }));
      const datasetId = `${mode}:${sourceKey}:${Date.now()}:${rows.length}`;

      // v16.0成功済み本体のgetDataset()互換形式。
      setJSON(DATA_KEY, {
        version: BASE_VERSION,
        datasetId,
        sourceKey: BASE_SOURCE_KEY,
        sourceUrl: normalizeUrl(url),
        sourceMode: mode,
        actualSourceKey: sourceKey,
        extractedAt: new Date().toISOString(),
        likerCount: mode === 'likes' ? sourceCount : null,
        magazineArticleCount: mode === 'magazine' ? sourceCount : null,
        skippedNoArticle: skipped,
        duplicateArticleCount: sourceRows.length - unique.length,
        count: rows.length,
        rows
      });
      setJSON(runKey(), {
        version: BASE_VERSION,
        articleKey: articleKey(),
        datasetId,
        stage: 'extracted',
        images: {},
        cardKeys: [],
        pending: null,
        createdAt: new Date().toISOString(),
        sourceMode: mode,
        sourceUrl: normalizeUrl(url)
      });

      const p = prefs();
      p.mode = mode;
      if (mode === 'likes') p.likesUrl = url;
      else p.magazineUrl = url;
      savePrefs(p);

      if (mode === 'likes') {
        setStatus(`スキ ${sourceCount}人 → 最新記事 ${rows.length}件 ✅ 次は「画」`);
        page.alert(`抽出完了\n\n入力元: スキした人\nスキした人: ${sourceCount}人\n紹介する最新記事: ${rows.length}件\n記事なし等スキップ: ${skipped}人\n\n次は「画」。`);
      } else {
        setStatus(`マガジン掲載記事 ${rows.length}件 抽出 ✅ 次は「画」`);
        page.alert(`抽出完了\n\n入力元: マガジン\n掲載記事: ${rows.length}件\n\n次は「画」。`);
      }
    } catch (error) {
      setStatus(`抽出停止：${error?.message || String(error)}`, true);
    } finally { setBusy(false); }
  }

  function switchMode(mode) {
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    const p = prefs();
    p.mode = mode;
    savePrefs(p);
    panel.querySelectorAll('button[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
    const input = panel.querySelector('input[data-source]');
    if (input) {
      input.value = mode === 'likes' ? p.likesUrl : p.magazineUrl;
      input.placeholder = mode === 'likes' ? 'スキ元の記事URL' : 'マガジンURL';
    }
    const hint = panel.querySelector('[data-hint]');
    if (hint) hint.textContent = mode === 'likes' ? 'スキした人 → 各人の最新記事' : 'マガジン掲載記事 → 全件';
  }

  function installStyle() {
    if (document.getElementById(`${PANEL}-style`) || !document.head) return;
    const style = document.createElement('style');
    style.id = `${PANEL}-style`;
    style.textContent = `
      #${BASE_PANEL}{display:none!important}
      #${PANEL}{position:fixed;right:6px;top:31%;z-index:2147483647;width:214px;background:#0b1220;color:#fff;border:1px solid #334155;border-radius:12px;padding:8px;box-shadow:0 12px 34px rgba(0,0,0,.38);font-family:system-ui,-apple-system,sans-serif}
      #${PANEL} .title{font-size:11px;font-weight:900;margin-bottom:6px}
      #${PANEL} .modes{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:5px}
      #${PANEL} .modes button{background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:7px;padding:6px 3px;font-size:11px;font-weight:900}
      #${PANEL} .modes button.active{background:#0f766e;color:#fff;border-color:#14b8a6}
      #${PANEL} input[data-source]{box-sizing:border-box;width:100%;border:1px solid #475569;border-radius:7px;background:#020617;color:#fff;padding:7px 6px;font-size:10px;margin-bottom:4px}
      #${PANEL} [data-hint]{font-size:9px;color:#94a3b8;margin-bottom:6px;line-height:1.3}
      #${PANEL} .actions{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
      #${PANEL} .actions button{border:0;border-radius:8px;padding:8px 2px;color:#fff;font-size:12px;font-weight:900;background:#0f766e}
      #${PANEL} .actions button[data-a="image"]{background:#2563eb}#${PANEL} .actions button[data-a="send"]{background:#7c3aed}#${PANEL} .actions button[data-a="delete"]{background:#b91c1c}
      #${PANEL} button:disabled,#${PANEL} input:disabled{opacity:.45}
      #${STATUS}{font-size:9px;line-height:1.35;margin-top:7px;color:#d1fae5;word-break:break-word}#${STATUS}[data-bad="1"]{color:#fecaca}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    if (!enabled() || !document.body) return;
    installStyle();
    if (document.getElementById(PANEL)) return;
    const p = prefs();
    const panel = document.createElement('div');
    panel.id = PANEL;
    panel.innerHTML = `
      <div class="title">極薄＋通知｜入力元選択 v16.1</div>
      <div class="modes"><button data-mode="likes">スキから</button><button data-mode="magazine">マガジン</button></div>
      <input data-source type="url" inputmode="url" autocomplete="off">
      <div data-hint></div>
      <div class="actions"><button data-a="extract">抽</button><button data-a="image">画</button><button data-a="send">送</button><button data-a="delete">削</button></div>
      <div id="${STATUS}">入力元を選んでURL→「抽」</div>`;
    panel.addEventListener('click', (event) => {
      const modeButton = event.target.closest('button[data-mode]');
      if (modeButton && !busy) { switchMode(modeButton.dataset.mode); return; }
      const button = event.target.closest('button[data-a]');
      if (!button || busy) return;
      if (button.dataset.a === 'extract') void extractSelected();
      if (button.dataset.a === 'image') baseAction('image');
      if (button.dataset.a === 'send') baseAction('send');
      if (button.dataset.a === 'delete') baseAction('delete');
    });
    panel.querySelector('input[data-source]').addEventListener('change', () => {
      const current = prefs();
      const mode = panel.querySelector('button[data-mode].active')?.dataset.mode || current.mode;
      const value = panel.querySelector('input[data-source]').value.trim();
      if (mode === 'likes') current.likesUrl = value; else current.magazineUrl = value;
      savePrefs(current);
    });
    document.body.appendChild(panel);
    switchMode(p.mode);
  }

  function syncBaseStatus() {
    if (!enabled() || busy || Date.now() - ownStatusAt < 1200) return;
    const base = document.getElementById(BASE_STATUS);
    const ours = document.getElementById(STATUS);
    if (!base || !ours) return;
    const text = String(base.textContent || '').trim();
    if (text && text !== ours.textContent) {
      ours.textContent = text;
      ours.dataset.bad = base.dataset.bad || '0';
    }
  }

  setInterval(() => { mount(); syncBaseStatus(); }, 500);
  mount();
})();
