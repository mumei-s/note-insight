(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_PRINCE_COMBINED_185__) return;
  page.__MUMEI_PRINCE_COMBINED_185__ = true;

  const VERSION = '18.5.0';
  const BASE_VERSION = '16.0.0';
  const BASE_SOURCE_KEY = 'n08825c632afd';
  const PANEL = 'mumei-note-source-picker-v163';
  const STATUS = 'mumei-note-source-status-v163';
  const SPECIAL = 'mumei-prince-special-v184';
  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const EXPORT_URL = 'https://mumei-s.github.io/note-insight/insight-likes-export.html';
  const INSIGHT_ORIGIN = 'https://mumei-s.github.io';
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
  function normUser(value) { return String(value || '').trim().replace(/^@/, '').toLowerCase(); }
  function parseTime(value) {
    const t = Date.parse(String(value || ''));
    return Number.isFinite(t) && t > 0 ? t : 0;
  }
  function status(text, bad = false) {
    for (const id of [STATUS, 'mumei-likers-thin-status-v160']) {
      const el = document.getElementById(id);
      if (el) { el.textContent = text; el.dataset.bad = bad ? '1' : '0'; }
    }
  }
  function setBusy(value) {
    busy = Boolean(value);
    const box = document.querySelector(`.${SPECIAL}`);
    if (box) box.querySelectorAll('button,input').forEach((node) => { node.disabled = busy; });
  }
  function gm(url, timeout = 45000) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout, responseType: 'text', anonymous: false,
        headers: { Accept: 'application/json,text/plain,*/*' },
        onload: (r) => {
          if (r.status >= 200 && r.status < 300) return resolve(r);
          reject(new Error(`HTTP ${r.status}`));
        },
        onerror: () => reject(new Error('通信失敗')),
        ontimeout: () => reject(new Error('通信タイムアウト'))
      });
    });
  }
  async function jsonGet(url) {
    const r = await gm(url);
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
    const values = [
      note?.eyecatch_url, note?.eyecatch, note?.image_url, note?.imageUrl,
      note?.thumbnail_url, note?.thumbnailUrl, note?.eyecatch?.url, note?.image?.url
    ];
    return values.find((v) => typeof v === 'string' && v.trim()) || '';
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
      thumbUrl
    };
  }
  async function creatorContents(urlname, pageNo = 1, disabledPinned = true) {
    const payload = await jsonGet(`https://note.com/api/v2/creators/${encodeURIComponent(urlname)}/contents?kind=note&page=${pageNo}&disabled_pinned=${disabledPinned ? 'true' : 'false'}&with_notes=false`);
    await sleep(50);
    return payload;
  }
  async function trueOldest(creator) {
    const firstPayload = await creatorContents(creator.urlname, 1, true);
    const first = contentList(firstPayload);
    if (!first.length) return null;
    const data = firstPayload?.data && typeof firstPayload.data === 'object' ? firstPayload.data : {};
    const total = Number(data.totalCount || data.total_count || 0);
    const per = Math.max(1, first.length);
    const lastPage = total > per ? Math.min(500, Math.ceil(total / per)) : 1;
    const last = lastPage > 1 ? contentList(await creatorContents(creator.urlname, lastPage, true)) : first;
    const rows = last.map((raw) => articleFromRaw(raw, creator)).filter(Boolean);
    rows.sort((a, b) => parseTime(a.publishAt) - parseTime(b.publishAt));
    return rows[0] || articleFromRaw(first[first.length - 1], creator);
  }
  async function chooseArticle(creator, mode) {
    try {
      if (mode === 'oldest') return await trueOldest(creator);
      if (mode === 'fixed') {
        return articleFromRaw(contentList(await creatorContents(creator.urlname, 1, false))[0], creator);
      }
      if (mode === 'auto') {
        const pinned = articleFromRaw(contentList(await creatorContents(creator.urlname, 1, false))[0], creator);
        const latest = articleFromRaw(contentList(await creatorContents(creator.urlname, 1, true))[0], creator);
        return pinned && latest && pinned.latestKey !== latest.latestKey ? pinned : (latest || pinned);
      }
      return articleFromRaw(contentList(await creatorContents(creator.urlname, 1, true))[0], creator);
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
  function currentTag() {
    const input = document.querySelector(`.${SPECIAL} input[data-prince-tag]`);
    return String(input?.value || DEFAULT_TAG).replace(/^#+/, '').trim() || DEFAULT_TAG;
  }

  async function collectHashtag(tag) {
    const rows = [];
    const seen = new Set();
    let pageNo = 1;
    let expected = 0;
    while (pageNo <= 500) {
      status(`① #${tag} 全記事取得中… page ${pageNo}｜${rows.length}件`);
      const payload = await jsonGet(`https://note.com/api/v3/hashtags/${encodeURIComponent(tag)}/notes?order=new&page=${pageNo}&paid_only=false`);
      const data = payload?.data && typeof payload.data === 'object' ? payload.data : (payload || {});
      const list = Array.isArray(data?.notes) ? data.notes : [];
      if (!expected) expected = Number(data?.count || data?.totalCount || data?.total_count || 0);
      for (const raw of list) {
        const row = articleFromRaw(raw, null);
        if (!row) continue;
        const id = row.latestKey || normalizeUrl(row.url);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        rows.push({ ...row, combinedSource: 'hashtag' });
      }
      const last = data?.is_last_page === true || data?.isLastPage === true;
      if (!list.length || last || (expected > 0 && rows.length >= expected)) break;
      pageNo += 1;
      await sleep(80);
    }
    if (!rows.length) throw new Error(`#${tag} の記事を取得できませんでした`);
    return rows;
  }

  function requestInsightCandidates() {
    return new Promise((resolve, reject) => {
      const requestId = `prince-combined-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

  async function collectInsight(mode) {
    status(`② INSIGHTスキ候補取得中｜人物重複なし｜目標${TARGET}人｜${choiceLabel(mode)}`);
    const payload = await requestInsightCandidates();
    const me = normUser(payload?.member?.noteId);
    const candidates = [];
    const seenPeople = new Set();
    for (const raw of Array.isArray(payload?.rows) ? payload.rows : []) {
      const fromUrl = String(raw?.actorUrl || '').match(/^https?:\/\/(?:www\.)?note\.com\/([^/?#]+)/i)?.[1] || '';
      const urlname = normUser(raw?.urlname || fromUrl);
      const identity = String(raw?.likerKey || urlname).trim();
      if (!urlname || urlname === me || !identity || seenPeople.has(identity)) continue;
      seenPeople.add(identity);
      candidates.push({
        urlname,
        likerKey: identity,
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
        rows.push({ ...row, url, combinedSource: 'insight' });
        if (rows.length >= TARGET) break;
      }
      status(`② INSIGHT記事判定 ${Math.min(start + batchSize, candidates.length)}/${candidates.length}人｜採用 ${rows.length}/${TARGET}`);
    }
    if (!rows.length) throw new Error('INSIGHT対象者の公開記事が0件です');
    return rows;
  }

  function mergeRows(tagRows, insightRows) {
    const out = [];
    const seenUrls = new Set();
    for (const row of [...tagRows, ...insightRows]) {
      const url = normalizeUrl(row.url);
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);
      out.push({ ...row, url });
    }
    return out;
  }

  function preservedImagesFor(rows) {
    const oldRun = getJSON(runKey(), null);
    const oldImages = oldRun?.images && typeof oldRun.images === 'object' ? oldRun.images : {};
    const allowed = new Set(rows.map((row) => normalizeUrl(row.url)));
    const kept = {};
    for (const [url, record] of Object.entries(oldImages)) {
      const normalized = normalizeUrl(url);
      if (allowed.has(normalized)) kept[normalized] = record;
    }
    return kept;
  }

  function saveCombined(tag, tagRows, insightRows, mode) {
    const rows = mergeRows(tagRows, insightRows);
    if (!rows.length) throw new Error('まとめ対象が0件です');
    const oldRun = getJSON(runKey(), null);
    const images = preservedImagesFor(rows);
    const datasetId = `prince-combined:${tag}:${mode}:${Date.now()}:${rows.length}`;
    const finalRows = rows.map((row, index) => ({ ...row, index: index + 1 }));
    setJSON(DATA_KEY, {
      version: BASE_VERSION,
      datasetId,
      sourceKey: BASE_SOURCE_KEY,
      sourceUrl: `https://note.com/hashtag/${encodeURIComponent(tag)}`,
      sourceMode: 'prince-hashtag-plus-insight-500',
      actualSourceKey: tag,
      amountMode: 'all',
      requestedCount: null,
      articleChoice: mode,
      extractedAt: new Date().toISOString(),
      hashtagCount: tagRows.length,
      insightCount: insightRows.length,
      mergedDuplicateCount: tagRows.length + insightRows.length - finalRows.length,
      count: finalRows.length,
      rows: finalRows
    });
    setJSON(runKey(), {
      version: BASE_VERSION,
      articleKey: articleKey(),
      datasetId,
      stage: Object.keys(images).length ? 'images_partial' : 'extracted',
      images,
      cardKeys: [],
      pending: null,
      createdAt: new Date().toISOString(),
      sourceMode: 'prince-hashtag-plus-insight-500',
      sourceUrl: `https://note.com/hashtag/${encodeURIComponent(tag)}`,
      amountMode: 'all',
      requestedCount: null,
      articleChoice: mode,
      reusedImageCount: Object.keys(images).length,
      previousStage: oldRun?.stage || null
    });
    return { count: finalRows.length, reused: Object.keys(images).length, duplicate: tagRows.length + insightRows.length - finalRows.length };
  }

  function canStartCombined() {
    if (!enabled()) { status('note編集画面で使ってください', true); return false; }
    if (busy) return false;
    const run = getJSON(runKey(), null);
    const cards = Array.isArray(run?.cardKeys) ? run.cardKeys.length : 0;
    if (cards) {
      status(`通知カードが${cards}件残っています。まとめ直す前に「削」または「初」`, true);
      return false;
    }
    return true;
  }

  function startImages() {
    setTimeout(() => document.querySelector(`#${PANEL} button[data-a="image"]`)?.click(), 180);
  }

  async function extractCombined() {
    if (!canStartCombined()) return;
    const tag = currentTag();
    const mode = currentChoice();
    setBusy(true);
    try {
      status(`まとめ処理開始｜#${tag} ＋ INSIGHT500｜${choiceLabel(mode)}`);
      const tagRows = await collectHashtag(tag);
      status(`① #${tag} ${tagRows.length}件 ✅ ② INSIGHT500へ`);
      const insightRows = await collectInsight(mode);
      status(`③ 2系統を統合中｜# ${tagRows.length}件 ＋ スキ ${insightRows.length}人`);
      const saved = saveCombined(tag, tagRows, insightRows, mode);
      status(`まとめ完了 ${saved.count}件 ✅ #${tagRows.length}＋スキ${insightRows.length}−重複${saved.duplicate}｜極薄へ`);
      if (insightRows.length < TARGET) {
        page.alert(`まとめ抽出完了\n\n#${tag}: ${tagRows.length}件\nINSIGHT人物重複なし: ${insightRows.length}/${TARGET}人\n記事URL重複除外: ${saved.duplicate}件\n合計: ${saved.count}件\n既存極薄再利用: ${saved.reused}件\n\nこの1つの対象リストで、極薄画像→通知カード→投稿→カードだけ削除まで進みます。`);
      }
      startImages();
    } catch (error) {
      status(`まとめ抽出停止：${error?.message || String(error)}`, true);
    } finally { setBusy(false); }
  }

  function convertUI() {
    if (!enabled()) return false;
    const panel = document.getElementById(PANEL);
    const box = panel?.querySelector(`.${SPECIAL}`);
    if (!panel || !box) return false;
    const title = panel.querySelector('.mumei-title-text-v164') || panel.querySelector(':scope > .title');
    if (title) title.textContent = '王子＋スキ500｜まとめて極薄＋通知';
    const label = box.querySelector('.label');
    if (label) label.textContent = '👑 #王子ごっこ ＋ ❤️ INSIGHTスキ500';
    const row = box.querySelector('.row');
    if (row && !row.querySelector('[data-prince-combined]')) {
      row.innerHTML = '<button data-prince-combined type="button">👑＋❤️ まとめて取得</button>';
      row.style.gridTemplateColumns = '1fr';
      row.querySelector('[data-prince-combined]').addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void extractCombined();
      });
    }
    const mini = box.querySelector('.mini');
    if (mini) mini.textContent = '#王子ごっこ全記事とINSIGHTの人物重複なし最大500人を最初から1つに統合。重複URLは1回だけ。極薄画像は安全分割、通知カードは同じ投稿でまとめて送る。';
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (convertUI() || tries > 120) clearInterval(timer);
  }, 500);
  convertUI();
})();
