(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_INSIGHT_ALL_LIKES_180__) return;
  page.__MUMEI_INSIGHT_ALL_LIKES_180__ = true;

  const VERSION = '18.0.0';
  const BASE_VERSION = '16.0.0';
  const BASE_SOURCE_KEY = 'n08825c632afd';
  const PANEL = 'mumei-note-source-picker-v163';
  const STATUS = 'mumei-note-source-status-v163';
  const BASE_STATUS = 'mumei-likers-thin-status-v160';
  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const MODE_KEY = 'mumei_insight_all_likes_mode_v180';
  const CHOICE_KEY = 'mumei_insight_all_likes_choice_v180';
  const BOOST_INDEX_KEY = 'mumei_insight_all_likes_boost_index_v180';
  const BOOST_LIKED_KEY = 'mumei_insight_all_likes_boost_liked_v180';
  const BOOST_HISTORY_KEY = 'mumei_insight_all_likes_boost_history_v180';
  const EXPORT_URL = 'https://mumei-s.github.io/note-insight/insight-likes-export.html';
  const INSIGHT_ORIGIN = 'https://mumei-s.github.io';
  const BOOST_PANEL = 'mumei-insight-boost-slide-v180';

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
    try {
      const u = new URL(String(value || '').trim());
      u.search = '';
      u.hash = '';
      return u.href;
    } catch (_) { return String(value || '').trim(); }
  }
  function noteKey(url) {
    return String(url || '').match(/\/n\/(n[a-f0-9]{12})(?:[/?#]|$)/i)?.[1] || '';
  }
  function setStatus(text, bad = false) {
    for (const id of [STATUS, BASE_STATUS]) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.textContent = text;
      el.dataset.bad = bad ? '1' : '0';
    }
  }
  function modeOn() { return localStorage.getItem(MODE_KEY) === '1'; }
  function setMode(on) {
    if (on) localStorage.setItem(MODE_KEY, '1');
    else localStorage.removeItem(MODE_KEY);
    syncPanelMode();
  }
  function activeChoice() {
    const panel = document.getElementById(PANEL);
    if (localStorage.getItem(CHOICE_KEY) === 'auto') return 'auto';
    return panel?.querySelector('button[data-choice].active')?.dataset.choice || 'latest';
  }
  function choiceLabel(choice) {
    if (choice === 'fixed') return '固定';
    if (choice === 'oldest') return '最初';
    if (choice === 'auto') return '自動';
    return '最新';
  }

  function xhr(method, url, data = null, responseType = 'text', timeout = 45000) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        data,
        responseType,
        timeout,
        anonymous: false,
        headers: method === 'POST'
          ? { Accept:'application/json,text/plain,*/*', 'Content-Type':'application/json', 'X-Requested-With':'XMLHttpRequest' }
          : { Accept: responseType === 'blob' ? 'image/avif,image/webp,image/png,image/jpeg,*/*' : 'application/json,text/html,*/*' },
        onload: (r) => {
          if (r.status >= 200 && r.status < 300) return resolve(r.response);
          const e = new Error(`HTTP ${r.status}`);
          e.status = r.status;
          e.body = typeof r.responseText === 'string' ? r.responseText.slice(0,300) : '';
          reject(e);
        },
        onerror: () => reject(new Error('通信失敗')),
        ontimeout: () => reject(new Error('通信タイムアウト')),
      });
    });
  }
  async function xhrJSON(url) {
    const raw = await xhr('GET', url, null, 'text');
    try { return JSON.parse(String(raw || '')); }
    catch (_) { throw new Error('JSON解析失敗'); }
  }

  function contentList(payload) {
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    return Array.isArray(data.contents) ? data.contents : Array.isArray(data.notes) ? data.notes : [];
  }
  function articleFromRaw(raw, creator) {
    const note = raw?.note && typeof raw.note === 'object' ? raw.note : raw;
    if (!note || typeof note !== 'object') return null;
    const key = String(note?.key || '').trim();
    if (!/^n[a-f0-9]{12}$/i.test(key)) return null;
    const user = note?.user || note?.author || {};
    const urlname = String(creator?.urlname || user?.urlname || '').trim();
    if (!urlname) return null;
    const url = normalizeUrl(note?.noteUrl || note?.url || `https://note.com/${urlname}/n/${key}`);
    return {
      ...creator,
      likerKey: String(creator?.likerKey || urlname),
      urlname,
      creator: String(creator?.creator || user?.nickname || user?.name || urlname).trim(),
      actorUrl: String(creator?.actorUrl || `https://note.com/${urlname}`),
      actorImageUrl: String(creator?.actorImageUrl || user?.user_profile_image_url || user?.profileImageUrl || user?.profile_image_url || '').trim(),
      url,
      title: String(note?.name || note?.title || '無題の記事').trim(),
      latestKey: key,
      publishAt: String(note?.publishAt || note?.publish_at || note?.published_at || '').trim() || null,
    };
  }
  async function creatorContents(urlname, pageNo = 1, disabledPinned = true) {
    return xhrJSON(`https://note.com/api/v2/creators/${encodeURIComponent(urlname)}/contents?kind=note&page=${pageNo}&disabled_pinned=${disabledPinned ? 'true' : 'false'}&with_notes=false`);
  }
  async function oldestForCreator(creator) {
    const first = await creatorContents(creator.urlname, 1, true);
    const firstList = contentList(first);
    if (!firstList.length) return null;
    const data = first?.data && typeof first.data === 'object' ? first.data : {};
    const total = Number(data.totalCount || data.total_count || 0);
    const per = Math.max(1, firstList.length);
    if (total > 0) {
      const lastPage = Math.min(500, Math.max(1, Math.ceil(total / per)));
      const last = lastPage === 1 ? first : await creatorContents(creator.urlname, lastPage, true);
      const rows = contentList(last).map((raw) => articleFromRaw(raw, creator)).filter(Boolean);
      if (rows.length) {
        rows.sort((a,b) => new Date(a.publishAt || 0).getTime() - new Date(b.publishAt || 0).getTime());
        return rows[0];
      }
    }
    let previous = firstList;
    for (let p = 2; p <= 200; p += 1) {
      const next = await creatorContents(creator.urlname, p, true);
      const list = contentList(next);
      if (!list.length) break;
      previous = list;
      if (list.length < per) break;
      await sleep(20);
    }
    const rows = previous.map((raw) => articleFromRaw(raw, creator)).filter(Boolean);
    rows.sort((a,b) => new Date(a.publishAt || 0).getTime() - new Date(b.publishAt || 0).getTime());
    return rows[0] || null;
  }
  async function chooseArticle(creator, choice) {
    try {
      if (choice === 'oldest') return await oldestForCreator(creator);
      if (choice === 'fixed') {
        const payload = await creatorContents(creator.urlname, 1, false);
        return articleFromRaw(contentList(payload)[0], creator);
      }
      if (choice === 'auto') {
        const [withPinned, latest] = await Promise.all([
          creatorContents(creator.urlname, 1, false),
          creatorContents(creator.urlname, 1, true),
        ]);
        const pinned = articleFromRaw(contentList(withPinned)[0], creator);
        const newest = articleFromRaw(contentList(latest)[0], creator);
        if (pinned && newest && pinned.latestKey !== newest.latestKey) return pinned;
        if (newest) return newest;
        if (pinned) return pinned;
        return await oldestForCreator(creator);
      }
      const payload = await creatorContents(creator.urlname, 1, true);
      return articleFromRaw(contentList(payload)[0], creator);
    } catch (_) { return null; }
  }
  async function enrichArticle(row) {
    let thumbUrl = row.actorImageUrl || '';
    let title = row.title || '無題の記事';
    let creator = row.creator || row.urlname;
    try {
      const payload = await xhrJSON(`https://note.com/api/v3/notes/${encodeURIComponent(row.latestKey)}`);
      const note = payload?.data || payload || {};
      title = String(note?.name || note?.title || title).trim();
      creator = String(note?.user?.nickname || note?.user?.name || creator).trim();
      const candidates = [
        note?.eyecatch_url, note?.eyecatch, note?.image_url,
        note?.user?.profileImageUrl, note?.user?.profile_image_url, row.actorImageUrl,
      ].map((v) => String(v || '').trim()).filter(Boolean);
      thumbUrl = candidates[0] || thumbUrl;
      if (thumbUrl.startsWith('//')) thumbUrl = `https:${thumbUrl}`;
    } catch (_) {}
    return { ...row, title, creator, thumbUrl };
  }

  function requestInsightLikes(count) {
    return new Promise((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const url = new URL(EXPORT_URL);
      url.searchParams.set('request', requestId);
      url.searchParams.set('count', String(Math.min(300, count)));
      url.searchParams.set('unique', '1');
      const popup = window.open(url.href, '_blank');
      if (!popup) return reject(new Error('INSIGHT取得画面を開けません。ポップアップを許可してください'));
      const timer = setTimeout(() => {
        if (bridgeWaiter?.requestId === requestId) bridgeWaiter = null;
        reject(new Error('INSIGHT取得がタイムアウトしました'));
      }, 90000);
      bridgeWaiter = { requestId, resolve, reject, timer };
    });
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== INSIGHT_ORIGIN) return;
    const data = event.data;
    if (!data || data.type !== 'MUMEI_INSIGHT_LIKES_V1' || !bridgeWaiter || data.requestId !== bridgeWaiter.requestId) return;
    const waiter = bridgeWaiter;
    bridgeWaiter = null;
    clearTimeout(waiter.timer);
    if (data.ok !== true) waiter.reject(new Error(String(data.error || 'INSIGHT取得失敗')));
    else waiter.resolve(data);
  });

  async function mapLimit(values, limit, worker) {
    const output = new Array(values.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (cursor < values.length) {
        const i = cursor++;
        output[i] = await worker(values[i], i);
      }
    });
    await Promise.all(runners);
    return output;
  }

  async function extractInsight() {
    if (busy || !enabled()) return;
    const currentRun = getJSON(runKey(), null);
    const imageCount = currentRun?.images && typeof currentRun.images === 'object' ? Object.keys(currentRun.images).length : 0;
    const cardCount = Array.isArray(currentRun?.cardKeys) ? currentRun.cardKeys.length : 0;
    if (cardCount) return setStatus(`通知カードが${cardCount}件残っています。先に「削」`, true);
    if (imageCount) return setStatus(`前回の極薄画像🔗が${imageCount}件あります。作り直すなら「初」`, true);

    const panel = document.getElementById(PANEL);
    const requested = Math.max(1, Math.min(300, Math.floor(Number(panel?.querySelector('input[data-amount]')?.value || 100))));
    const choice = activeChoice();
    const fetchCount = Math.min(300, requested + Math.min(100, Math.ceil(requested * 0.8)));
    busy = true;
    lockPanel(true);
    try {
      setStatus(`INSIGHT全記事の直近スキを取得中… 目標${requested}人`);
      const payload = await requestInsightLikes(fetchCount);
      const memberId = String(payload?.member?.noteId || '').toLowerCase();
      const creators = (Array.isArray(payload?.rows) ? payload.rows : [])
        .map((raw) => ({
          likerKey: String(raw?.likerKey || raw?.urlname || ''),
          urlname: String(raw?.urlname || ''),
          creator: String(raw?.creator || raw?.urlname || 'noteクリエイター'),
          actorUrl: String(raw?.actorUrl || (raw?.urlname ? `https://note.com/${raw.urlname}` : '')),
          actorImageUrl: String(raw?.actorImageUrl || ''),
          likedAt: raw?.likedAt || null,
          likedArticleKey: String(raw?.likedArticleKey || ''),
        }))
        .filter((x) => x.urlname && x.urlname.toLowerCase() !== memberId);
      if (!creators.length) throw new Error('INSIGHTにスキ履歴がありません');

      setStatus(`INSIGHT ${creators.length}人取得 ✅ ${choiceLabel(choice)}記事を確認中…`);
      const chosen = await mapLimit(creators, 5, async (creator, index) => {
        if (index % 5 === 0) setStatus(`記事選択 ${Math.min(index + 1, creators.length)}/${creators.length}｜${choiceLabel(choice)}`);
        return chooseArticle(creator, choice);
      });
      const rows = [];
      const seenCreators = new Set();
      const seenUrls = new Set();
      for (const row of chosen) {
        if (!row || rows.length >= requested) continue;
        const creatorKey = String(row.likerKey || row.urlname || '');
        const url = normalizeUrl(row.url);
        if (!creatorKey || !url || seenCreators.has(creatorKey) || seenUrls.has(url)) continue;
        seenCreators.add(creatorKey);
        seenUrls.add(url);
        rows.push(row);
      }
      if (!rows.length) throw new Error('紹介できる公開記事が0件です');

      setStatus(`記事情報・サムネ ${rows.length}件を確認中…`);
      const enriched = await mapLimit(rows, 5, async (row, index) => {
        if (index % 5 === 0) setStatus(`記事情報 ${Math.min(index + 1, rows.length)}/${rows.length}`);
        return enrichArticle(row);
      });
      const finalRows = enriched.map((row, index) => ({ ...row, index: index + 1 }));
      const datasetId = `insight-all-likes:${choice}:${Date.now()}:${finalRows.length}`;
      setJSON(DATA_KEY, {
        version: BASE_VERSION,
        datasetId,
        sourceKey: BASE_SOURCE_KEY,
        sourceUrl: 'https://mumei-s.github.io/note-insight/',
        sourceMode: 'insight-all-likes',
        actualSourceKey: 'insight-all-likes',
        amountMode: 'number',
        requestedCount: requested,
        articleChoice: choice,
        extractedAt: new Date().toISOString(),
        skippedNoArticle: creators.length - finalRows.length,
        count: finalRows.length,
        rows: finalRows,
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
        sourceMode: 'insight-all-likes',
        sourceUrl: 'https://mumei-s.github.io/note-insight/',
        amountMode: 'number',
        requestedCount: requested,
        articleChoice: choice,
      });
      localStorage.setItem(BOOST_INDEX_KEY, '0');
      setStatus(`INSIGHT全体スキ → ${finalRows.length}人 ✅ 次は「画」／「巡回」`);
      page.alert(`INSIGHT全体スキ取得完了\n\n直近スキから: ${creators.length}人確認\n紹介対象: ${finalRows.length}人\n記事: ${choiceLabel(choice)}\n\n「画」で極薄🔗、「巡回」でBOOSTパネル。`);
      renderBoost();
    } catch (error) {
      setStatus(`INSIGHT取得停止：${error?.message || String(error)}`, true);
    } finally {
      busy = false;
      lockPanel(false);
    }
  }

  function lockPanel(value) {
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    panel.querySelectorAll('button,input').forEach((el) => { el.disabled = Boolean(value); });
  }

  function addInsightControls(panel) {
    if (panel.querySelector('[data-insight-all-likes]')) return;
    const modeGrid = panel.querySelector('.grid2');
    if (modeGrid) {
      modeGrid.style.gridTemplateColumns = 'repeat(3,1fr)';
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.insightAllLikes = '1';
      button.textContent = 'INSIGHT全体';
      modeGrid.appendChild(button);
    }
    const choiceGrid = panel.querySelector('.grid3');
    if (choiceGrid) {
      choiceGrid.style.gridTemplateColumns = 'repeat(4,1fr)';
      const auto = document.createElement('button');
      auto.type = 'button';
      auto.dataset.insightAutoChoice = '1';
      auto.textContent = '自動';
      choiceGrid.appendChild(auto);
    }
    const resume = panel.querySelector('.resume');
    if (resume) {
      resume.style.gridTemplateColumns = 'repeat(4,1fr)';
      const boost = document.createElement('button');
      boost.type = 'button';
      boost.dataset.insightBoost = '1';
      boost.textContent = '巡回';
      boost.style.background = '#7c2d12';
      boost.style.color = '#fff';
      resume.appendChild(boost);
    }
    const title = panel.querySelector('.title');
    if (title) title.textContent = '極薄＋通知｜セレクト v18.0';
    syncPanelMode();
  }

  function syncPanelMode() {
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    const insight = modeOn();
    const special = panel.querySelector('[data-insight-all-likes]');
    if (special) special.classList.toggle('active', insight);
    if (insight) {
      panel.querySelectorAll('button[data-mode]').forEach((b) => b.classList.remove('active'));
      const source = panel.querySelector('input[data-source]');
      if (source) source.style.display = 'none';
      const hint = panel.querySelector('[data-hint]');
      if (hint) hint.textContent = 'INSIGHT保存済み｜自分の記事全体についた直近スキから100人';
      const amount = panel.querySelector('input[data-amount]');
      if (amount && !amount.dataset.insightTouched) amount.value = '100';
      const numberButton = panel.querySelector('button[data-amount-mode="number"]');
      const allButton = panel.querySelector('button[data-amount-mode="all"]');
      numberButton?.classList.add('active');
      allButton?.classList.remove('active');
      if (amount) amount.style.display = 'block';
    } else {
      const source = panel.querySelector('input[data-source]');
      if (source) source.style.display = 'block';
    }
    const auto = panel.querySelector('[data-insight-auto-choice]');
    if (auto) auto.classList.toggle('active', localStorage.getItem(CHOICE_KEY) === 'auto');
  }

  document.addEventListener('input', (event) => {
    const amount = event.target?.closest?.(`#${PANEL} input[data-amount]`);
    if (amount && modeOn()) amount.dataset.insightTouched = '1';
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const insightButton = target.closest(`#${PANEL} [data-insight-all-likes]`);
    if (insightButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setMode(true);
      setStatus('INSIGHT全体スキ｜100人｜記事種別を選んで「抽」');
      return;
    }
    const regularMode = target.closest(`#${PANEL} button[data-mode]`);
    if (regularMode) {
      setMode(false);
      return;
    }
    const autoChoice = target.closest(`#${PANEL} [data-insight-auto-choice]`);
    if (autoChoice) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      localStorage.setItem(CHOICE_KEY, 'auto');
      const panel = document.getElementById(PANEL);
      panel?.querySelectorAll('button[data-choice]').forEach((b) => b.classList.remove('active'));
      autoChoice.classList.add('active');
      return;
    }
    const regularChoice = target.closest(`#${PANEL} button[data-choice]`);
    if (regularChoice) localStorage.removeItem(CHOICE_KEY);

    const extract = target.closest(`#${PANEL} button[data-a="extract"]`);
    if (extract && modeOn()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void extractInsight();
      return;
    }
    const boost = target.closest(`#${PANEL} [data-insight-boost]`);
    if (boost) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleBoost();
    }
  }, true);

  function boostDataset() {
    const d = getJSON(DATA_KEY, null);
    return d && d.version === BASE_VERSION && Array.isArray(d.rows) ? d : null;
  }
  function likedMap() { return getJSON(BOOST_LIKED_KEY, {}); }
  function markLiked(key) {
    const map = likedMap();
    map[key] = Date.now();
    setJSON(BOOST_LIKED_KEY, map);
    const history = getJSON(BOOST_HISTORY_KEY, []);
    const next = Array.isArray(history) ? history.filter((x) => Date.now() - Number(x || 0) < 86400000) : [];
    next.push(Date.now());
    setJSON(BOOST_HISTORY_KEY, next);
  }
  function likeLimit() {
    const now = Date.now();
    const history = (getJSON(BOOST_HISTORY_KEY, []) || []).map(Number).filter((t) => now - t < 86400000);
    setJSON(BOOST_HISTORY_KEY, history);
    const hour = history.filter((t) => now - t < 3600000).length;
    return { ok: hour < 18 && history.length < 80, hour, day: history.length };
  }

  function ensureBoostStyle() {
    if (document.getElementById(`${BOOST_PANEL}-style`) || !document.head) return;
    const style = document.createElement('style');
    style.id = `${BOOST_PANEL}-style`;
    style.textContent = `
      #${BOOST_PANEL}{position:fixed;left:6px;bottom:72px;z-index:2147483647;width:min(306px,calc(100vw - 12px));background:#fff;color:#111;border:1px solid #d5d9df;border-radius:14px;box-shadow:0 14px 38px rgba(0,0,0,.28);padding:9px;font-family:system-ui,-apple-system,sans-serif}
      #${BOOST_PANEL} .btop{display:flex;align-items:center;gap:7px;margin-bottom:7px}#${BOOST_PANEL} .btop b{font-size:12px;flex:1}#${BOOST_PANEL} .btop span{font-size:10px;color:#666}#${BOOST_PANEL} .bclose{border:0;background:#eee;border-radius:8px;width:28px;height:28px;font-weight:900}
      #${BOOST_PANEL} .bcard{display:flex;gap:8px;align-items:flex-start}#${BOOST_PANEL} img{width:92px;height:58px;object-fit:cover;border-radius:8px;background:#eee}#${BOOST_PANEL} .btxt{min-width:0;flex:1}#${BOOST_PANEL} .bcreator{font-size:11px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#${BOOST_PANEL} .btitle{font-size:12px;font-weight:800;line-height:1.3;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}#${BOOST_PANEL} .btime{font-size:9px;color:#777;margin-top:3px}
      #${BOOST_PANEL} .bactions{display:grid;grid-template-columns:.55fr 1fr .7fr .8fr;gap:5px;margin-top:8px}#${BOOST_PANEL} .bactions button{padding:8px 3px;border:1px solid #ddd;border-radius:8px;background:#fff;font-weight:900;font-size:11px}#${BOOST_PANEL} .bactions .like{background:#fff1f4}#${BOOST_PANEL} .bactions .open{background:#eef7ff}#${BOOST_PANEL} .bmeter{font-size:9px;color:#666;margin-top:6px;text-align:right}
    `;
    document.head.appendChild(style);
  }
  function toggleBoost() {
    const existing = document.getElementById(BOOST_PANEL);
    if (existing) { existing.remove(); return; }
    const dataset = boostDataset();
    if (!dataset?.rows?.length) {
      setStatus('先に「INSIGHT全体」→「抽」で100人を取得してください', true);
      return;
    }
    renderBoost();
  }
  function renderBoost() {
    const dataset = boostDataset();
    if (!dataset?.rows?.length || !document.body) return;
    ensureBoostStyle();
    let host = document.getElementById(BOOST_PANEL);
    if (!host) {
      host = document.createElement('div');
      host.id = BOOST_PANEL;
      document.body.appendChild(host);
    }
    let index = Math.max(0, Math.min(dataset.rows.length - 1, Number(localStorage.getItem(BOOST_INDEX_KEY) || 0)));
    localStorage.setItem(BOOST_INDEX_KEY, String(index));
    const row = dataset.rows[index];
    const key = String(row.latestKey || noteKey(row.url) || '');
    const liked = Boolean(likedMap()[key]);
    const limit = likeLimit();
    const when = row.likedAt ? new Date(row.likedAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '日時不明';
    host.innerHTML = `
      <div class="btop"><b>巡回BOOST｜INSIGHTスキ100</b><span>${index + 1}/${dataset.rows.length}</span><button class="bclose" data-b="close">×</button></div>
      <div class="bcard">
        ${row.thumbUrl ? `<img src="${escapeHtml(row.thumbUrl)}" alt="">` : '<div style="width:92px;height:58px;background:#eee;border-radius:8px"></div>'}
        <div class="btxt"><div class="bcreator">${escapeHtml(row.creator || row.urlname)} <small>@${escapeHtml(row.urlname || '')}</small></div><div class="btitle">${escapeHtml(row.title || '無題の記事')}</div><div class="btime">あなたの記事へスキ：${escapeHtml(when)}</div></div>
      </div>
      <div class="bactions"><button data-b="prev">←</button><button class="like" data-b="like" ${liked || !limit.ok ? 'disabled' : ''}>${liked ? '❤️済み' : '♡ スキ'}</button><button data-b="next">次 →</button><button class="open" data-b="open">📖 記事</button></div>
      <div class="bmeter">スキ安全値 ❤️ ${limit.hour}/18h・${limit.day}/80日</div>`;

    host.onclick = (event) => {
      const button = event.target.closest('button[data-b]');
      if (!button) return;
      const action = button.dataset.b;
      if (action === 'close') return host.remove();
      if (action === 'prev') {
        index = (index - 1 + dataset.rows.length) % dataset.rows.length;
        localStorage.setItem(BOOST_INDEX_KEY, String(index));
        return renderBoost();
      }
      if (action === 'next') {
        index = (index + 1) % dataset.rows.length;
        localStorage.setItem(BOOST_INDEX_KEY, String(index));
        return renderBoost();
      }
      if (action === 'open') return window.open(row.url, '_blank');
      if (action === 'like') void likeRow(row, index, dataset.rows.length);
    };
  }
  async function likeRow(row, index, total) {
    const key = String(row.latestKey || noteKey(row.url) || '');
    if (!key) return setStatus('記事IDを取得できません', true);
    const limit = likeLimit();
    if (!limit.ok) return setStatus(`スキ安全値到達：${limit.hour}/18h・${limit.day}/80日`, true);
    setStatus(`巡回BOOST ${index + 1}/${total}｜♡ スキ中…`);
    try {
      await xhr('POST', `https://note.com/api/v3/notes/${encodeURIComponent(key)}/likes`, '{}', 'text', 30000);
      markLiked(key);
      localStorage.setItem(BOOST_INDEX_KEY, String((index + 1) % total));
      setStatus(`❤️ スキ完了 ${index + 1}/${total} → 次へ`);
      setTimeout(renderBoost, 220);
    } catch (error) {
      const status = Number(error?.status || 0);
      if (status === 403 || status === 429) setStatus(`⛔ note側制限 ${status}。巡回を停止してください`, true);
      else setStatus(`スキ失敗 ${status || ''}｜「📖記事」から確認`, true);
    }
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function mountPatch() {
    if (!enabled()) return;
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    addInsightControls(panel);
  }
  setInterval(mountPatch, 350);
  mountPatch();
})();
