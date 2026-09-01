(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_NOTE_SOURCE_PICKER_162__) return;
  page.__MUMEI_NOTE_SOURCE_PICKER_162__ = true;

  const VERSION = '16.2.0';
  const BASE_VERSION = '16.0.0';
  const BASE_SOURCE_KEY = 'n08825c632afd';
  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const PREF_KEY = 'mumei_note_source_picker_v162';
  const PANEL = 'mumei-note-source-picker-v162';
  const STATUS = 'mumei-note-source-status-v162';
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
  function runKey() { return `${RUN_PREFIX}:${articleKey() || 'unknown'}`; }
  function setStatus(text, bad = false) {
    const node = document.getElementById(STATUS);
    if (node) {
      node.textContent = text;
      node.dataset.bad = bad ? '1' : '0';
    }
    const base = document.getElementById(BASE_STATUS);
    if (base) {
      base.textContent = text;
      base.dataset.bad = bad ? '1' : '0';
    }
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
      magazineUrl: String(p?.magazineUrl || ''),
      amountMode: p?.amountMode === 'all' ? 'all' : 'number',
      amount: Math.min(3000, Math.max(1, Number(p?.amount || 30)))
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
    if (!values.length) return [];
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
      if (!url) continue;
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

  async function collectLikesTargets(sourceKey, amountMode, amount) {
    const likerSeen = new Set();
    const articleSeen = new Set();
    const rows = [];
    let checkedLikers = 0;
    let noArticle = 0;

    for (let pageNo = 1; pageNo <= 100; pageNo += 1) {
      setStatus(`スキから抽出 ${rows.length}${amountMode === 'number' ? `/${amount}` : ''}件… page ${pageNo}`);
      const payload = await xhrJSON(`https://note.com/api/v3/notes/${encodeURIComponent(sourceKey)}/likes?page=${pageNo}&per=50`);
      const list = Array.isArray(payload?.data?.likes) ? payload.data.likes : [];
      const likers = [];
      for (const item of list) {
        const liker = parseLiker(item);
        if (!liker || likerSeen.has(liker.likerKey)) continue;
        likerSeen.add(liker.likerKey);
        likers.push(liker);
      }
      if (!likers.length && !list.length) break;

      const latest = await mapLimit(likers, 5, async (liker, index) => {
        const row = await latestForLiker(liker);
        setStatus(`スキから最新記事確認 ${rows.length}/${amountMode === 'number' ? amount : '全件'}｜${index + 1}/${likers.length}`);
        return row;
      });
      checkedLikers += likers.length;

      for (const row of latest) {
        if (!row) { noArticle += 1; continue; }
        const url = normalizeUrl(row.url);
        if (!url || articleSeen.has(url)) continue;
        articleSeen.add(url);
        rows.push({ ...row, url });
        if (amountMode === 'number' && rows.length >= amount) break;
      }

      if (amountMode === 'number' && rows.length >= amount) break;
      if (!list.length || list.length < 50) break;
      await sleep(60);
    }

    return { rows, checkedLikers, noArticle };
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
      publishAt: String(note?.publish_at || note?.publishAt || '').trim() || null
    };
  }
  async function collectMagazineTargets(key, amountMode, amount) {
    const rows = [];
    const seen = new Set();
    let start = 0;
    const apiLimit = 100;

    for (let pageNo = 1; pageNo <= 200; pageNo += 1) {
      setStatus(`マガジン抽出 ${rows.length}${amountMode === 'number' ? `/${amount}` : ''}件…`);
      const payload = await xhrJSON(`https://note.com/api/v1/magazines/${encodeURIComponent(key)}/notes?start=${start}&limit=${apiLimit}`);
      const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
      const list = Array.isArray(data.notes) ? data.notes : [];
      if (!list.length) break;

      let added = 0;
      for (const raw of list) {
        const row = parseMagazineArticle(raw);
        if (!row) continue;
        const url = normalizeUrl(row.url);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        rows.push({ ...row, url });
        added += 1;
        if (amountMode === 'number' && rows.length >= amount) break;
      }

      if (amountMode === 'number' && rows.length >= amount) break;
      if (list.length < apiLimit || added === 0) break;
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
    const current = prefs();
    const mode = panel?.querySelector('button[data-mode].active')?.dataset.mode || current.mode;
    const url = String(panel?.querySelector('input[data-source]')?.value || '').trim();
    const amountMode = panel?.querySelector('button[data-amount-mode].active')?.dataset.amountMode || current.amountMode;
    const rawAmount = Number(panel?.querySelector('input[data-amount]')?.value || current.amount || 30);
    const amount = Math.min(3000, Math.max(1, Math.floor(rawAmount || 1)));
    return { mode, url, amountMode, amount };
  }
  function baseRun() { return getJSON(runKey(), null); }
  function baseAction(action) {
    const button = document.querySelector(`#${BASE_PANEL} button[data-a="${action}"]`);
    if (!button) {
      setStatus('成功版16.0本体を取得できません。編集画面を再読込してください', true);
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

    const { mode, url, amountMode, amount } = selectedInput();
    if (!url) { setStatus('抽出元URLを入力してください', true); return; }
    setBusy(true);
    try {
      let sourceKey = '';
      let sourceRows = [];
      let checkedLikers = 0;
      let skipped = 0;

      if (mode === 'likes') {
        sourceKey = noteKey(url);
        if (!sourceKey) throw new FatalError('スキ元はnoteの記事URLを入れてください');
        const result = await collectLikesTargets(sourceKey, amountMode, amount);
        sourceRows = result.rows;
        checkedLikers = result.checkedLikers;
        skipped = result.noArticle;
      } else {
        sourceKey = magazineKey(url);
        if (!sourceKey) throw new FatalError('マガジン元はnoteのマガジンURLを入れてください');
        sourceRows = await collectMagazineTargets(sourceKey, amountMode, amount);
      }

      if (!sourceRows.length) throw new FatalError('紹介対象記事が0件です');
      if (amountMode === 'number' && sourceRows.length < amount) {
        setStatus(`指定${amount}件に対して取得可能${sourceRows.length}件。取得できた分で準備中…`);
      } else {
        setStatus(`${sourceRows.length}件の記事情報・サムネを準備中…`);
      }

      const enriched = await mapLimit(sourceRows, 5, async (row, index) => {
        const item = await enrichArticle(row);
        setStatus(`記事情報 ${index + 1}/${sourceRows.length}…`);
        return item;
      });
      const rows = enriched.map((row, index) => ({ ...row, index: index + 1 }));
      const datasetId = `${mode}:${sourceKey}:${amountMode}:${amountMode === 'all' ? 'all' : amount}:${Date.now()}:${rows.length}`;

      // v16.0成功済み本体へ対象だけ渡す互換形式。
      setJSON(DATA_KEY, {
        version: BASE_VERSION,
        datasetId,
        sourceKey: BASE_SOURCE_KEY,
        sourceUrl: normalizeUrl(url),
        sourceMode: mode,
        actualSourceKey: sourceKey,
        amountMode,
        requestedCount: amountMode === 'number' ? amount : null,
        extractedAt: new Date().toISOString(),
        checkedLikers: mode === 'likes' ? checkedLikers : null,
        skippedNoArticle: mode === 'likes' ? skipped : 0,
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
        sourceUrl: normalizeUrl(url),
        amountMode,
        requestedCount: amountMode === 'number' ? amount : null
      });

      const p = prefs();
      p.mode = mode;
      p.amountMode = amountMode;
      p.amount = amount;
      if (mode === 'likes') p.likesUrl = url; else p.magazineUrl = url;
      savePrefs(p);

      if (mode === 'likes') {
        const requested = amountMode === 'all' ? '全件' : `${amount}件`;
        setStatus(`スキから ${rows.length}件抽出（指定 ${requested}）✅ 次は「画」`);
        page.alert(`抽出完了\n\n入力元: スキから\n指定: ${requested}\n紹介する記事: ${rows.length}件\n確認したスキ: ${checkedLikers}人\n記事なし等: ${skipped}人\n\n次は「画」。`);
      } else {
        const requested = amountMode === 'all' ? '全件' : `${amount}件`;
        setStatus(`マガジンから ${rows.length}件抽出（指定 ${requested}）✅ 次は「画」`);
        page.alert(`抽出完了\n\n入力元: マガジン\n指定: ${requested}\n紹介する記事: ${rows.length}件\n\n次は「画」。`);
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
    if (hint) hint.textContent = mode === 'likes' ? 'スキした人 → 各人の最新記事' : 'マガジン掲載記事 → 指定数';
  }
  function switchAmountMode(amountMode) {
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    const p = prefs();
    p.amountMode = amountMode;
    savePrefs(p);
    panel.querySelectorAll('button[data-amount-mode]').forEach((button) => button.classList.toggle('active', button.dataset.amountMode === amountMode));
    const amountInput = panel.querySelector('input[data-amount]');
    if (amountInput) amountInput.style.display = amountMode === 'all' ? 'none' : 'block';
  }

  function installStyle() {
    if (document.getElementById(`${PANEL}-style`) || !document.head) return;
    const style = document.createElement('style');
    style.id = `${PANEL}-style`;
    style.textContent = `
      #${BASE_PANEL},#mumei-note-source-picker-v161{display:none!important}
      #${PANEL}{position:fixed;right:6px;top:27%;z-index:2147483647;width:220px;background:#0b1220;color:#fff;border:1px solid #334155;border-radius:12px;padding:8px;box-shadow:0 12px 34px rgba(0,0,0,.38);font-family:system-ui,-apple-system,sans-serif}
      #${PANEL} .title{font-size:11px;font-weight:900;margin-bottom:6px}
      #${PANEL} .modes,#${PANEL} .amountModes{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:5px}
      #${PANEL} .modes button,#${PANEL} .amountModes button{background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:7px;padding:6px 3px;font-size:11px;font-weight:900}
      #${PANEL} .modes button.active,#${PANEL} .amountModes button.active{background:#0f766e;color:#fff;border-color:#14b8a6}
      #${PANEL} input{box-sizing:border-box;width:100%;border:1px solid #475569;border-radius:7px;background:#020617;color:#fff;padding:7px 6px;font-size:11px;margin-bottom:5px}
      #${PANEL} input[data-amount]{font-size:16px;font-weight:900;text-align:center}
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
      <div class="title">極薄＋通知｜入力元選択 v16.2</div>
      <div class="modes"><button data-mode="likes">スキから</button><button data-mode="magazine">マガジン</button></div>
      <input data-source type="url" inputmode="url" autocomplete="off">
      <div data-hint></div>
      <div class="amountModes"><button data-amount-mode="number">件数指定</button><button data-amount-mode="all">全件</button></div>
      <input data-amount type="number" min="1" max="3000" step="1" inputmode="numeric" value="${p.amount}">
      <div class="actions"><button data-a="extract">抽</button><button data-a="image">画</button><button data-a="send">送</button><button data-a="delete">削</button></div>
      <div id="${STATUS}">入力元・URL・件数を決めて「抽」</div>`;

    panel.addEventListener('click', (event) => {
      const modeButton = event.target.closest('button[data-mode]');
      if (modeButton && !busy) { switchMode(modeButton.dataset.mode); return; }
      const amountButton = event.target.closest('button[data-amount-mode]');
      if (amountButton && !busy) { switchAmountMode(amountButton.dataset.amountMode); return; }
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
    panel.querySelector('input[data-amount]').addEventListener('change', () => {
      const current = prefs();
      const raw = Number(panel.querySelector('input[data-amount]').value || current.amount || 30);
      current.amount = Math.min(3000, Math.max(1, Math.floor(raw || 1)));
      panel.querySelector('input[data-amount]').value = String(current.amount);
      savePrefs(current);
    });

    document.body.appendChild(panel);
    switchMode(p.mode);
    switchAmountMode(p.amountMode);
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
