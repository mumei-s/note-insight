(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_PRINCE_SPECIAL_184__) return;
  page.__MUMEI_PRINCE_SPECIAL_184__ = true;

  const VERSION = '18.4.0';
  const PANEL = 'mumei-note-source-picker-v163';
  const STATUS = 'mumei-note-source-status-v163';
  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const EXPORT_URL = 'https://mumei-s.github.io/note-insight/insight-likes-export.html';
  const INSIGHT_ORIGIN = 'https://mumei-s.github.io';
  const PREF_KEY = 'mumei_prince_special_v184';
  const STYLE = 'mumei-prince-special-v184-style';
  const UI_CLASS = 'mumei-prince-special-v184';
  const DEFAULT_TAG = '王子ごっこ';
  const TARGET = 500;
  const INSIGHT_CANDIDATES = 1500;

  let busy = false;
  let bridgeWaiter = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function articleKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }
  function enabled() {
    return /^\/notes\/n[a-z0-9]{8,}\/edit\/?$/i.test(location.pathname) && Boolean(articleKey());
  }
  function runKey() { return `${RUN_PREFIX}:${articleKey() || 'unknown'}`; }
  function getJSON(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch (_) { return fallback; }
  }
  function setJSON(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }
  function prefs() {
    const p = getJSON(PREF_KEY, {});
    return { tag: String(p?.tag || DEFAULT_TAG).replace(/^#+/, '').trim() || DEFAULT_TAG };
  }
  function savePrefs(next) { setJSON(PREF_KEY, next); }
  function normalizeUrl(value) {
    try {
      const u = new URL(String(value || '').trim(), location.href);
      u.search = '';
      u.hash = '';
      return u.href;
    } catch (_) { return String(value || '').trim(); }
  }
  function normUser(value) { return String(value || '').trim().replace(/^@/, '').toLowerCase(); }
  function noteKey(url) { return String(url || '').match(/\/n\/(n[a-f0-9]{12})(?:[/?#]|$)/i)?.[1] || ''; }
  function parseTime(value) {
    const t = Date.parse(String(value || ''));
    return Number.isFinite(t) && t > 0 ? t : 0;
  }
  function boolPick(obj, keys) {
    for (const key of keys) if (obj && typeof obj[key] === 'boolean') return obj[key];
    return null;
  }
  function status(text, bad = false) {
    for (const id of [STATUS, 'mumei-likers-thin-status-v160']) {
      const el = document.getElementById(id);
      if (el) { el.textContent = text; el.dataset.bad = bad ? '1' : '0'; }
    }
  }
  function setBusy(value) {
    busy = Boolean(value);
    const box = document.querySelector(`.${UI_CLASS}`);
    if (!box) return;
    box.querySelectorAll('button,input').forEach((node) => { node.disabled = busy; });
  }
  function gm(method, url, data = null, timeout = 45000) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method, url, data, timeout, responseType: 'text', anonymous: false,
        headers: method === 'POST'
          ? { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json,text/plain,*/*' }
          : { Accept: 'application/json,text/plain,*/*' },
        onload: (r) => {
          if (r.status >= 200 && r.status < 300) return resolve(r);
          const error = new Error(`HTTP ${r.status}`);
          error.status = r.status;
          error.body = String(r.responseText || '').slice(0, 500);
          reject(error);
        },
        onerror: () => reject(new Error('通信失敗')),
        ontimeout: () => reject(new Error('通信タイムアウト'))
      });
    });
  }
  async function jsonGet(url) {
    const r = await gm('GET', url);
    try { return JSON.parse(String(r.responseText || '')); }
    catch (_) { throw new Error(`JSON解析失敗: ${url}`); }
  }
  async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        out[index] = await fn(items[index], index);
      }
    });
    await Promise.all(workers);
    return out;
  }

  function contentList(payload) {
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    return Array.isArray(data.contents) ? data.contents : Array.isArray(data.notes) ? data.notes : [];
  }
  function thumbOf(note) {
    const candidates = [
      note?.eyecatch_url, note?.eyecatch, note?.image_url, note?.imageUrl,
      note?.thumbnail_url, note?.thumbnailUrl, note?.eyecatch?.url, note?.image?.url
    ].map((v) => typeof v === 'string' ? v : '').filter(Boolean);
    return candidates[0] || '';
  }
  function articleFromRaw(raw, creator = null) {
    const note = raw?.note && typeof raw.note === 'object' ? raw.note : raw;
    if (!note || typeof note !== 'object') return null;
    const key = String(note?.key || '').trim();
    if (!/^n[a-f0-9]{12}$/i.test(key)) return null;
    const user = note?.user || note?.author || {};
    const urlname = normUser(creator?.urlname || user?.urlname || user?.url_name);
    if (!urlname) return null;
    let thumbUrl = thumbOf(note) || String(creator?.actorImageUrl || user?.profileImageUrl || user?.profile_image_url || user?.user_profile_image_url || '');
    if (thumbUrl.startsWith('//')) thumbUrl = `https:${thumbUrl}`;
    return {
      ...(creator || {}),
      likerKey: String(creator?.likerKey || user?.key || user?.id || urlname),
      urlname,
      creator: String(creator?.creator || user?.nickname || user?.name || urlname).trim(),
      actorUrl: String(creator?.actorUrl || `https://note.com/${urlname}`),
      actorImageUrl: String(creator?.actorImageUrl || user?.profileImageUrl || user?.profile_image_url || user?.user_profile_image_url || '').trim(),
      url: normalizeUrl(note?.noteUrl || note?.url || `https://note.com/${urlname}/n/${key}`),
      title: String(note?.name || note?.title || '無題の記事').trim(),
      latestKey: key,
      publishAt: String(note?.publishAt || note?.publish_at || note?.published_at || note?.publishedAt || note?.created_at || note?.createdAt || '').trim() || null,
      thumbUrl,
      liked: boolPick(note, ['isLiked','is_liked','liked','hasLiked']) === true
    };
  }
  async function creatorContents(urlname, pageNo = 1, disabledPinned = true) {
    const payload = await jsonGet(`https://note.com/api/v2/creators/${encodeURIComponent(urlname)}/contents?kind=note&page=${pageNo}&disabled_pinned=${disabledPinned ? 'true' : 'false'}&with_notes=false`);
    await sleep(60);
    return payload;
  }
  async function trueOldest(creator) {
    const plain = await creatorContents(creator.urlname, 1, true);
    const pinned = await creatorContents(creator.urlname, 1, false);
    const first = contentList(plain);
    const withPin = contentList(pinned);
    if (!first.length && !withPin.length) return null;
    const data = plain?.data && typeof plain.data === 'object' ? plain.data : {};
    const total = Number(data.totalCount || data.total_count || 0);
    const per = Math.max(1, first.length || 1);
    let last = first;
    if (total > per) {
      const lastPage = Math.min(500, Math.max(1, Math.ceil(total / per)));
      if (lastPage > 1) {
        try { last = contentList(await creatorContents(creator.urlname, lastPage, true)); }
        catch (_) {}
      }
    }
    const map = new Map();
    for (const raw of [...withPin, ...last, ...first]) {
      const article = articleFromRaw(raw, creator);
      if (article && !map.has(article.latestKey)) map.set(article.latestKey, article);
    }
    return [...map.values()].sort((a, b) => {
      const at = parseTime(a.publishAt), bt = parseTime(b.publishAt);
      if (at && bt) return at - bt;
      if (at) return -1;
      if (bt) return 1;
      return 0;
    })[0] || null;
  }
  async function chooseArticle(creator, mode) {
    try {
      if (mode === 'oldest') return await trueOldest(creator);
      if (mode === 'fixed') {
        const payload = await creatorContents(creator.urlname, 1, false);
        return articleFromRaw(contentList(payload)[0], creator);
      }
      if (mode === 'auto') {
        const pinned = await creatorContents(creator.urlname, 1, false);
        const plain = await creatorContents(creator.urlname, 1, true);
        const a = articleFromRaw(contentList(pinned)[0], creator);
        const b = articleFromRaw(contentList(plain)[0], creator);
        return a && b && a.latestKey !== b.latestKey ? a : (b || a);
      }
      const payload = await creatorContents(creator.urlname, 1, true);
      return articleFromRaw(contentList(payload)[0], creator);
    } catch (_) { return null; }
  }

  function currentChoice() {
    const panel = document.getElementById(PANEL);
    if (panel?.querySelector('[data-lite-auto].active')) return 'auto';
    return panel?.querySelector('button[data-choice].active')?.dataset.choice || localStorage.getItem('mumei_insight_lite_choice_v183') || 'latest';
  }
  function choiceLabel(value) {
    return value === 'fixed' ? '固定' : value === 'oldest' ? '最古' : value === 'auto' ? '自動' : '最新';
  }
  function canStart() {
    if (!enabled()) { status('note編集画面で使ってください', true); return false; }
    if (busy) return false;
    const run = getJSON(runKey(), null);
    const cards = Array.isArray(run?.cardKeys) ? run.cardKeys.length : 0;
    const images = run?.images && typeof run.images === 'object' ? Object.keys(run.images).length : 0;
    if (cards) { status(`通知カードが${cards}件残っています。先に「削」`, true); return false; }
    if (images) { status(`前回の極薄画像が${images}件あります。別対象へ切り替えるなら「初」`, true); return false; }
    return true;
  }
  function saveDataset(rows, meta) {
    const datasetId = `${meta.sourceMode}:${Date.now()}:${rows.length}`;
    const finalRows = rows.map((row, index) => ({ ...row, index: index + 1 }));
    setJSON(DATA_KEY, {
      version: '16.0.0', datasetId,
      sourceKey: String(meta.sourceKey || ''),
      sourceUrl: String(meta.sourceUrl || ''),
      sourceMode: meta.sourceMode,
      actualSourceKey: String(meta.sourceKey || ''),
      amountMode: meta.amountMode || 'all',
      requestedCount: meta.requestedCount ?? null,
      articleChoice: meta.articleChoice || 'direct',
      extractedAt: new Date().toISOString(),
      count: finalRows.length,
      rows: finalRows
    });
    setJSON(runKey(), {
      version: '16.0.0', articleKey: articleKey(), datasetId,
      stage: 'extracted', images: {}, cardKeys: [], pending: null,
      createdAt: new Date().toISOString(), sourceMode: meta.sourceMode,
      requestedCount: meta.requestedCount ?? null, articleChoice: meta.articleChoice || 'direct'
    });
    return finalRows.length;
  }
  function startImages() {
    setTimeout(() => document.querySelector(`#${PANEL} button[data-a="image"]`)?.click(), 120);
  }

  async function extractHashtag() {
    if (!canStart()) return;
    const input = document.querySelector(`.${UI_CLASS} input[data-prince-tag]`);
    const tag = String(input?.value || prefs().tag || DEFAULT_TAG).replace(/^#+/, '').trim() || DEFAULT_TAG;
    savePrefs({ tag });
    setBusy(true);
    try {
      const rows = [];
      const seen = new Set();
      let pageNo = 1;
      let expected = 0;
      while (pageNo <= 500) {
        status(`#${tag} 全記事を取得中… page ${pageNo}｜${rows.length}件`);
        const payload = await jsonGet(`https://note.com/api/v3/hashtags/${encodeURIComponent(tag)}/notes?order=new&page=${pageNo}&paid_only=false`);
        const data = payload?.data && typeof payload.data === 'object' ? payload.data : (payload || {});
        const list = Array.isArray(data?.notes) ? data.notes : [];
        if (!expected) expected = Number(data?.count || data?.totalCount || data?.total_count || 0);
        for (const raw of list) {
          const row = articleFromRaw(raw, null);
          if (!row) continue;
          const identity = row.latestKey || normalizeUrl(row.url);
          if (!identity || seen.has(identity)) continue;
          seen.add(identity);
          rows.push(row);
        }
        const last = data?.is_last_page === true || data?.isLastPage === true;
        if (!list.length || last || (expected > 0 && rows.length >= expected)) break;
        pageNo += 1;
        await sleep(90);
      }
      if (!rows.length) throw new Error(`#${tag} の記事を取得できませんでした`);
      const count = saveDataset(rows, {
        sourceMode: 'hashtag-all', sourceKey: tag,
        sourceUrl: `https://note.com/hashtag/${encodeURIComponent(tag)}`,
        amountMode: 'all', requestedCount: null, articleChoice: 'tag-direct'
      });
      status(`#${tag} 全件 ${count}記事 ✅ 極薄画像を準備中…`);
      startImages();
    } catch (error) {
      status(`#王子系 抽出停止：${error?.message || String(error)}`, true);
    } finally { setBusy(false); }
  }

  function requestInsightCandidates() {
    return new Promise((resolve, reject) => {
      const requestId = `prince500-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const url = new URL(EXPORT_URL);
      url.searchParams.set('request', requestId);
      url.searchParams.set('count', String(INSIGHT_CANDIDATES));
      url.searchParams.set('unique', '1');
      const popup = window.open(url.href, '_blank');
      if (!popup) return reject(new Error('INSIGHT取得画面を開けません'));
      const timer = setTimeout(() => {
        if (bridgeWaiter?.requestId === requestId) bridgeWaiter = null;
        reject(new Error('INSIGHT取得タイムアウト'));
      }, 120000);
      bridgeWaiter = { requestId, resolve, reject, timer };
    });
  }
  window.addEventListener('message', (event) => {
    if (event.origin !== INSIGHT_ORIGIN || !bridgeWaiter) return;
    const data = event.data;
    if (!data || data.type !== 'MUMEI_INSIGHT_LIKES_V1' || data.requestId !== bridgeWaiter.requestId) return;
    const waiter = bridgeWaiter;
    bridgeWaiter = null;
    clearTimeout(waiter.timer);
    data.ok === true ? waiter.resolve(data) : waiter.reject(new Error(String(data.error || 'INSIGHT取得失敗')));
  });

  async function extractInsight500() {
    if (!canStart()) return;
    setBusy(true);
    try {
      const mode = currentChoice();
      status(`INSIGHT直近スキ候補を取得中｜人物重複なし｜目標${TARGET}人｜${choiceLabel(mode)}`);
      const payload = await requestInsightCandidates();
      const me = normUser(payload?.member?.noteId);
      const candidates = [];
      const seenPeople = new Set();
      for (const raw of Array.isArray(payload?.rows) ? payload.rows : []) {
        const urlname = normUser(raw?.urlname || String(raw?.actorUrl || '').match(/^https?:\/\/(?:www\.)?note\.com\/([^/?#]+)/i)?.[1]);
        const identity = String(raw?.likerKey || urlname).trim();
        if (!urlname || urlname === me || !identity || seenPeople.has(identity)) continue;
        seenPeople.add(identity);
        candidates.push({
          urlname, likerKey: identity,
          creator: String(raw?.creator || urlname),
          actorUrl: String(raw?.actorUrl || `https://note.com/${urlname}`),
          actorImageUrl: String(raw?.actorImageUrl || ''),
          likedAt: raw?.likedAt || null,
          likedArticleKey: String(raw?.likedArticleKey || '')
        });
      }
      if (!candidates.length) throw new Error('INSIGHTに対象スキ履歴がありません');

      const rows = [];
      const usedPeople = new Set();
      const usedUrls = new Set();
      const batchSize = 5;
      for (let start = 0; start < candidates.length && rows.length < TARGET; start += batchSize) {
        const batch = candidates.slice(start, start + batchSize);
        const chosen = await mapLimit(batch, 5, (creator) => chooseArticle(creator, mode));
        for (const row of chosen) {
          if (!row) continue;
          const person = normUser(row.urlname);
          const url = normalizeUrl(row.url);
          if (!person || usedPeople.has(person) || !url || usedUrls.has(url)) continue;
          usedPeople.add(person);
          usedUrls.add(url);
          rows.push({ ...row, url });
          if (rows.length >= TARGET) break;
        }
        status(`記事判定 ${Math.min(start + batchSize, candidates.length)}/${candidates.length}人｜採用 ${rows.length}/${TARGET}`);
        await sleep(0);
      }
      if (!rows.length) throw new Error('公開記事を持つ対象者が0人です');
      const count = saveDataset(rows, {
        sourceMode: 'insight-recent-likes-500', sourceKey: 'insight-recent-likes',
        sourceUrl: 'https://mumei-s.github.io/note-insight/',
        amountMode: 'number', requestedCount: TARGET, articleChoice: mode
      });
      status(`INSIGHT 人物重複なし ${count}/${TARGET}人 ✅ 極薄画像を準備中…`);
      if (count < TARGET) {
        page.alert(`INSIGHTから人物重複なし ${count}人を確保しました。\n500人に満たないのは、現在の保存履歴内で「公開記事あり」の対象が${count}人だったためです。\n\nこの${count}件で極薄画像→カード送信へ進みます。`);
      }
      startImages();
    } catch (error) {
      status(`INSIGHT500 抽出停止：${error?.message || String(error)}`, true);
    } finally { setBusy(false); }
  }

  function installStyle() {
    if (document.getElementById(STYLE) || !document.head) return;
    const style = document.createElement('style');
    style.id = STYLE;
    style.textContent = `
      #${PANEL}{width:min(330px,calc(100vw - 12px))!important}
      #${PANEL} .mumei-lite-note{display:none!important}
      #${PANEL} button[data-a="extract"]{display:none!important}
      #${PANEL} button[data-a="image"]{display:block!important}
      #${PANEL} .actions{grid-template-columns:repeat(3,1fr)!important}
      #${PANEL} .${UI_CLASS}{background:#111827;border:1px solid #7c3aed;border-radius:10px;padding:8px;margin-bottom:7px}
      #${PANEL} .${UI_CLASS} .label{font-size:10px;font-weight:900;color:#e9d5ff;margin-bottom:5px}
      #${PANEL} .${UI_CLASS} .row{display:grid;grid-template-columns:1fr 1fr;gap:5px}
      #${PANEL} .${UI_CLASS} button{padding:9px 4px;font-size:11px;background:#312e81;color:#fff;border-color:#6d28d9}
      #${PANEL} .${UI_CLASS} button[data-prince-insight]{background:#9f1239;border-color:#fb7185}
      #${PANEL} .${UI_CLASS} input{display:block!important;width:100%!important;margin:0 0 5px!important;background:#020617!important}
      #${PANEL} .${UI_CLASS} .mini{font-size:9px;line-height:1.35;color:#c4b5fd;margin-top:5px}
    `;
    document.head.appendChild(style);
  }
  function installUI() {
    if (!enabled()) return false;
    const panel = document.getElementById(PANEL);
    if (!panel) return false;
    installStyle();
    const title = panel.querySelector('.mumei-title-text-v164') || panel.querySelector(':scope > .title');
    if (title) title.textContent = '王子全件＋INSIGHT500｜極薄＋通知';
    let box = panel.querySelector(`.${UI_CLASS}`);
    if (!box) {
      const p = prefs();
      box = document.createElement('div');
      box.className = UI_CLASS;
      box.innerHTML = `
        <div class="label">👑 王子記事／❤️ 直近スキ500</div>
        <input data-prince-tag type="text" value="${p.tag.replace(/"/g, '&quot;')}" placeholder="王子ごっこ">
        <div class="row"><button data-prince-tag-all>👑 #全件</button><button data-prince-insight>❤️ INSIGHT500</button></div>
        <div class="mini">#全件＝タグ記事そのものを全取得｜INSIGHT500＝直近スキ人物を重複なしで500人、下の「固定/最新/最古/自動」で1記事ずつ</div>`;
      const grid = panel.querySelector('.grid3');
      if (grid) grid.before(box); else panel.prepend(box);
      box.querySelector('input[data-prince-tag]').addEventListener('change', (event) => {
        const tag = String(event.target.value || '').replace(/^#+/, '').trim() || DEFAULT_TAG;
        event.target.value = tag;
        savePrefs({ tag });
      });
      box.querySelector('[data-prince-tag-all]').addEventListener('click', (event) => {
        event.preventDefault(); event.stopPropagation();
        void extractHashtag();
      });
      box.querySelector('[data-prince-insight]').addEventListener('click', (event) => {
        event.preventDefault(); event.stopPropagation();
        void extractInsight500();
      });
    }
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (installUI() || tries > 60) clearInterval(timer);
  }, 500);
  installUI();
})();
