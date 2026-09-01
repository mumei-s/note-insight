(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_NOTE_SOURCE_PICKER_163__) return;
  page.__MUMEI_NOTE_SOURCE_PICKER_163__ = true;

  const VERSION = '16.3.0';
  const BASE_VERSION = '16.0.0';
  const BASE_SOURCE_KEY = 'n08825c632afd';
  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const PREF_KEY = 'mumei_note_source_picker_v163';
  const WORK_PREFIX = 'mumei_note_source_work_v163';
  const CONTROL_PREFIX = 'mumei_note_source_control_v163';
  const PANEL = 'mumei-note-source-picker-v163';
  const STATUS = 'mumei-note-source-status-v163';
  const BASE_PANEL = 'mumei-likers-thin-panel-v160';
  const BASE_STATUS = 'mumei-likers-thin-status-v160';

  let busy = false;
  let ownStatusAt = 0;
  let viewCache = null;
  let selectionCache = null;
  let noteUrlCommand = null;
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
  function workKey() { return `${WORK_PREFIX}:${articleKey() || 'unknown'}`; }
  function controlKey() { return `${CONTROL_PREFIX}:${articleKey() || 'unknown'}`; }

  function prefs() {
    const p = getJSON(PREF_KEY, {});
    return {
      mode: p?.mode === 'magazine' ? 'magazine' : 'likes',
      likesUrl: String(p?.likesUrl || 'https://note.com/ss_yr/n/n08825c632afd'),
      magazineUrl: String(p?.magazineUrl || ''),
      amountMode: p?.amountMode === 'all' ? 'all' : 'number',
      amount: Math.min(3000, Math.max(1, Number(p?.amount || 30))),
      articleChoice: ['fixed', 'oldest'].includes(p?.articleChoice) ? p.articleChoice : 'latest'
    };
  }
  function savePrefs(next) { setJSON(PREF_KEY, next); }
  function control() {
    return getJSON(controlKey(), { paused: false, at: 0 });
  }
  function setPaused(value) {
    const c = control();
    c.paused = Boolean(value);
    c.at = Date.now();
    setJSON(controlKey(), c);
  }
  function isPaused() { return Boolean(control().paused); }

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
    if (!panel) return;
    panel.querySelectorAll('button,input').forEach((node) => {
      if (node.dataset?.a === 'pause') return;
      node.disabled = value;
    });
  }

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
  function articleFromRaw(raw, creator) {
    const note = raw?.note && typeof raw.note === 'object' ? raw.note : raw;
    if (!note || typeof note !== 'object') return null;
    const key = String(note?.key || '').trim();
    if (!/^n[a-f0-9]{12}$/i.test(key)) return null;
    const user = note?.user || note?.author || {};
    const urlname = String(creator?.urlname || user?.urlname || '').trim();
    const url = normalizeUrl(note?.noteUrl || note?.url || (urlname ? `https://note.com/${urlname}/n/${key}` : ''));
    if (!url) return null;
    return {
      ...(creator || {}),
      likerKey: String(creator?.likerKey || user?.key || user?.id || urlname || key),
      urlname,
      creator: String(creator?.creator || user?.nickname || user?.name || urlname || 'noteクリエイター').trim(),
      actorUrl: String(creator?.actorUrl || (urlname ? `https://note.com/${urlname}` : '')),
      actorImageUrl: String(creator?.actorImageUrl || user?.user_profile_image_url || user?.profileImageUrl || user?.profile_image_url || '').trim(),
      url,
      title: String(note?.name || note?.title || '無題の記事').trim(),
      latestKey: key,
      publishAt: String(note?.publishAt || note?.publish_at || '').trim() || null
    };
  }
  async function creatorContents(urlname, pageNo = 1, disabledPinned = true) {
    return xhrJSON(`https://note.com/api/v2/creators/${encodeURIComponent(urlname)}/contents?kind=note&page=${pageNo}&disabled_pinned=${disabledPinned ? 'true' : 'false'}&with_notes=false`);
  }
  async function chooseCreatorArticle(creator, choice) {
    try {
      if (choice === 'fixed') {
        const payload = await creatorContents(creator.urlname, 1, false);
        return articleFromRaw(contentList(payload)[0], creator);
      }
      if (choice === 'oldest') {
        const first = await creatorContents(creator.urlname, 1, true);
        const firstList = contentList(first);
        if (!firstList.length) return null;
        const data = first?.data && typeof first.data === 'object' ? first.data : {};
        const total = Number(data.totalCount || 0);
        const per = Math.max(1, firstList.length);
        let lastPage = total > 0 ? Math.max(1, Math.ceil(total / per)) : 1;
        lastPage = Math.min(500, lastPage);
        const lastPayload = lastPage === 1 ? first : await creatorContents(creator.urlname, lastPage, true);
        const lastList = contentList(lastPayload);
        const candidates = (lastList.length ? lastList : firstList).map((raw) => articleFromRaw(raw, creator)).filter(Boolean);
        if (!candidates.length) return null;
        candidates.sort((a, b) => {
          const at = new Date(a.publishAt || 0).getTime();
          const bt = new Date(b.publishAt || 0).getTime();
          return at - bt;
        });
        return candidates[0];
      }
      const payload = await creatorContents(creator.urlname, 1, true);
      return articleFromRaw(contentList(payload)[0], creator);
    } catch (_) { return null; }
  }

  function parseMagazineCreator(raw) {
    const note = raw?.note && typeof raw.note === 'object' ? raw.note : raw;
    const user = note?.user || note?.author || {};
    const urlname = String(user?.urlname || '').trim();
    const likerKey = String((user?.key ?? user?.id ?? urlname) || '').trim();
    if (!urlname || !likerKey) return null;
    return {
      likerKey,
      urlname,
      creator: String(user?.nickname || user?.name || urlname).trim(),
      actorUrl: `https://note.com/${urlname}`,
      actorImageUrl: String(user?.user_profile_image_url || user?.profileImageUrl || user?.profile_image_url || '').trim()
    };
  }

  async function collectLikeCreators(sourceKey, work) {
    const seen = new Set(work.seenCreatorKeys || []);
    const pageNo = Math.max(1, Number(work.cursor || 1));
    if (isPaused()) {
      work.stage = 'extract_paused';
      setJSON(workKey(), work);
      return work;
    }
    setStatus(`スキした人を取得 ${work.creators.length}人… page ${pageNo}`);
    const payload = await xhrJSON(`https://note.com/api/v3/notes/${encodeURIComponent(sourceKey)}/likes?page=${pageNo}&per=50`);
    const list = Array.isArray(payload?.data?.likes) ? payload.data.likes : [];
    for (const item of list) {
      const creator = parseLiker(item);
      if (!creator || seen.has(creator.likerKey)) continue;
      seen.add(creator.likerKey);
      work.creators.push(creator);
    }
    work.cursor = pageNo + 1;
    work.seenCreatorKeys = [...seen];
    if (!list.length || list.length < 50) work.sourceDone = true;
    setJSON(workKey(), work);
    await sleep(50);
    return work;
  }

  async function collectMagazineCreators(sourceKey, work) {
    const seen = new Set(work.seenCreatorKeys || []);
    const start = Math.max(0, Number(work.cursor || 0));
    const apiLimit = 100;
    if (isPaused()) {
      work.stage = 'extract_paused';
      setJSON(workKey(), work);
      return work;
    }
    setStatus(`マガジン参加者を取得 ${work.creators.length}人…`);
    const payload = await xhrJSON(`https://note.com/api/v1/magazines/${encodeURIComponent(sourceKey)}/notes?start=${start}&limit=${apiLimit}`);
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    const list = Array.isArray(data.notes) ? data.notes : [];
    for (const raw of list) {
      const creator = parseMagazineCreator(raw);
      if (!creator || seen.has(creator.likerKey)) continue;
      seen.add(creator.likerKey);
      work.creators.push(creator);
    }
    work.cursor = start + list.length;
    work.seenCreatorKeys = [...seen];
    if (!list.length || list.length < apiLimit) work.sourceDone = true;
    setJSON(workKey(), work);
    await sleep(70);
    return work;
  }

  async function resolveCreatorArticles(work) {
    const seenUrls = new Set(work.seenUrls || []);
    let index = Math.max(0, Number(work.creatorIndex || 0));
    const amount = work.amountMode === 'number' ? work.amount : Infinity;

    while (index < work.creators.length && work.rows.length < amount) {
      if (isPaused()) {
        work.creatorIndex = index;
        work.seenUrls = [...seenUrls];
        work.stage = 'extract_paused';
        setJSON(workKey(), work);
        return work;
      }
      const batch = work.creators.slice(index, index + 5);
      const chosen = await Promise.all(batch.map((creator) => chooseCreatorArticle(creator, work.articleChoice)));
      for (const row of chosen) {
        if (!row) {
          work.noArticle = Number(work.noArticle || 0) + 1;
          continue;
        }
        const url = normalizeUrl(row.url);
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);
        work.rows.push({ ...row, url });
        if (work.rows.length >= amount) break;
      }
      index += batch.length;
      work.creatorIndex = index;
      work.seenUrls = [...seenUrls];
      setJSON(workKey(), work);
      setStatus(`記事選択 ${work.rows.length}/${work.amountMode === 'number' ? work.amount : '全件'}｜${index}/${work.creators.length}人`);
    }

    const needMoreNumber = work.amountMode === 'number' && work.rows.length < work.amount && !work.sourceDone;
    const needMoreAll = work.amountMode === 'all' && !work.sourceDone;
    if (needMoreNumber || needMoreAll) {
      work.stage = 'collecting_source';
      setJSON(workKey(), work);
      return work;
    }
    work.stage = 'articles_ready';
    setJSON(workKey(), work);
    return work;
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
    const articleChoice = panel?.querySelector('button[data-choice].active')?.dataset.choice || current.articleChoice;
    return { mode, url, amountMode, amount, articleChoice };
  }

  function currentBaseRun() { return getJSON(runKey(), null); }
  function baseAction(action) {
    const button = document.querySelector(`#${BASE_PANEL} button[data-a="${action}"]`);
    if (!button) {
      setStatus('成功版16.0本体を取得できません。編集画面を再読込してください', true);
      return false;
    }
    button.click();
    return true;
  }

  function freshWork(input) {
    return {
      version: VERSION,
      articleKey: articleKey(),
      mode: input.mode,
      sourceUrl: normalizeUrl(input.url),
      actualSourceKey: input.mode === 'likes' ? noteKey(input.url) : magazineKey(input.url),
      amountMode: input.amountMode,
      amount: input.amount,
      articleChoice: input.articleChoice,
      stage: 'collecting_source',
      cursor: input.mode === 'likes' ? 1 : 0,
      sourceDone: false,
      creators: [],
      seenCreatorKeys: [],
      creatorIndex: 0,
      rows: [],
      seenUrls: [],
      noArticle: 0,
      createdAt: new Date().toISOString()
    };
  }

  async function finalizeDataset(work) {
    if (!work.rows.length) throw new FatalError('紹介対象記事が0件です');
    setStatus(`${work.rows.length}件の記事情報・サムネを準備中…`);
    const enriched = [];
    for (let i = 0; i < work.rows.length; i += 5) {
      if (isPaused()) {
        work.stage = 'enrich_paused';
        work.enrichIndex = i;
        work.enrichedRows = enriched;
        setJSON(workKey(), work);
        return false;
      }
      const batch = await Promise.all(work.rows.slice(i, i + 5).map(enrichArticle));
      enriched.push(...batch);
      setStatus(`記事情報 ${Math.min(i + 5, work.rows.length)}/${work.rows.length}…`);
    }
    const rows = enriched.map((row, index) => ({ ...row, index: index + 1 }));
    const datasetId = `${work.mode}:${work.actualSourceKey}:${work.articleChoice}:${work.amountMode}:${work.amountMode === 'all' ? 'all' : work.amount}:${Date.now()}:${rows.length}`;

    setJSON(DATA_KEY, {
      version: BASE_VERSION,
      datasetId,
      sourceKey: BASE_SOURCE_KEY,
      sourceUrl: work.sourceUrl,
      sourceMode: work.mode,
      actualSourceKey: work.actualSourceKey,
      amountMode: work.amountMode,
      requestedCount: work.amountMode === 'number' ? work.amount : null,
      articleChoice: work.articleChoice,
      extractedAt: new Date().toISOString(),
      skippedNoArticle: work.noArticle,
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
      sourceMode: work.mode,
      sourceUrl: work.sourceUrl,
      amountMode: work.amountMode,
      requestedCount: work.amountMode === 'number' ? work.amount : null,
      articleChoice: work.articleChoice
    });
    work.stage = 'done';
    work.finalCount = rows.length;
    setJSON(workKey(), work);
    setStatus(`抽出 ${rows.length}件 ✅ 次は「画」`);
    page.alert(`抽出完了\n\n入力元: ${work.mode === 'likes' ? 'スキから' : 'マガジン'}\n記事: ${choiceLabel(work.articleChoice)}\n指定: ${work.amountMode === 'all' ? '全件' : `${work.amount}件`}\n作成対象: ${rows.length}件\n記事なし等: ${work.noArticle}人\n\n次は「画」。`);
    return true;
  }

  async function runExtraction(work) {
    setPaused(false);
    setBusy(true);
    try {
      while (true) {
        if (isPaused()) {
          work.stage = 'extract_paused';
          setJSON(workKey(), work);
          setStatus('停止しました ✅ 「再開」で続きから');
          return;
        }

        if (work.stage === 'collecting_source' || work.stage === 'extract_paused') {
          work.stage = 'collecting_source';
          setJSON(workKey(), work);
          if (!work.sourceDone) {
            work = work.mode === 'likes'
              ? await collectLikeCreators(work.actualSourceKey, work)
              : await collectMagazineCreators(work.actualSourceKey, work);
          }
          if (isPaused()) {
            setStatus('停止しました ✅ 「再開」で続きから');
            return;
          }
          work.stage = 'choosing_articles';
          setJSON(workKey(), work);
        }

        if (work.stage === 'choosing_articles') {
          work = await resolveCreatorArticles(work);
          if (isPaused()) {
            setStatus('停止しました ✅ 「再開」で続きから');
            return;
          }
          if (work.stage === 'collecting_source') continue;
        }

        if (work.stage === 'articles_ready') {
          await finalizeDataset(work);
          return;
        }

        if (work.stage === 'enrich_paused') {
          work.stage = 'articles_ready';
          setJSON(workKey(), work);
          continue;
        }

        if (work.stage === 'done') {
          setStatus(`抽出済み ${work.finalCount || work.rows.length}件 ✅ 次は「画」`);
          return;
        }
      }
    } catch (error) {
      setStatus(`抽出停止：${error?.message || String(error)}`, true);
    } finally { setBusy(false); }
  }

  async function startExtraction() {
    if (busy || !enabled()) return;
    const existing = currentBaseRun();
    if (Array.isArray(existing?.cardKeys) && existing.cardKeys.length) {
      setStatus(`通知カードが${existing.cardKeys.length}件残っています。先に「削」`, true);
      return;
    }
    const existingImages = existing?.images && typeof existing.images === 'object' ? Object.keys(existing.images).length : 0;
    if (existingImages) {
      setStatus(`前回の極薄画像🔗が${existingImages}件あります。対象を作り直すなら「初」で安全に戻してください`, true);
      return;
    }
    const input = selectedInput();
    if (!input.url) {
      setStatus('抽出元URLを入力してください', true);
      return;
    }
    const sourceKey = input.mode === 'likes' ? noteKey(input.url) : magazineKey(input.url);
    if (!sourceKey) {
      setStatus(input.mode === 'likes' ? 'noteの記事URLを入れてください' : 'noteのマガジンURLを入れてください', true);
      return;
    }

    const p = prefs();
    p.mode = input.mode;
    p.amountMode = input.amountMode;
    p.amount = input.amount;
    p.articleChoice = input.articleChoice;
    if (input.mode === 'likes') p.likesUrl = input.url; else p.magazineUrl = input.url;
    savePrefs(p);

    const work = freshWork(input);
    setJSON(workKey(), work);
    setPaused(false);
    await runExtraction(work);
  }

  function editor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') || document.querySelector('.ProseMirror');
  }
  function looksLikeView(value) {
    try {
      return Boolean(value && typeof value === 'object' && value.state?.doc && value.state?.schema &&
        typeof value.dispatch === 'function' && value.dom && typeof value.posAtDOM === 'function');
    } catch (_) { return false; }
  }
  function findView() {
    if (looksLikeView(viewCache) && viewCache.dom?.isConnected) return viewCache;
    const root = editor();
    if (!root) return null;
    const seen = new Set(), queue = [];
    let seed = root;
    for (let i = 0; i < 6 && seed; i += 1, seed = seed.parentElement) queue.push([seed, 0]);
    let steps = 0;
    while (queue.length && steps++ < 14000) {
      const [value, depth] = queue.shift();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      if (looksLikeView(value)) return (viewCache = value);
      let keys = [];
      try { keys = Object.getOwnPropertyNames(value); } catch (_) { continue; }
      for (const key of keys) {
        if (['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(key)) continue;
        let next;
        try { next = value[key]; } catch (_) { continue; }
        if (looksLikeView(next)) return (viewCache = next);
        if (depth < 7 && next && (typeof next === 'object' || typeof next === 'function') && next !== page && next !== document) {
          queue.push([next, depth + 1]);
        }
      }
    }
    return null;
  }
  function webpackRequire() {
    const chunks = page.webpackChunk_N_E;
    if (!chunks || typeof chunks.push !== 'function') return null;
    let req = null;
    const id = 995000000 + Math.floor(Math.random() * 4000000);
    try { chunks.push([[id], {}, (runtimeRequire) => { req = runtimeRequire; }]); } catch (_) {}
    return req;
  }
  function selectionApi() {
    if (selectionCache) return selectionCache;
    const req = webpackRequire();
    if (!req) throw new FatalError('note内部Selectionを取得できません');
    let mod;
    try { mod = req(44044); } catch (_) {}
    const Selection = mod?.Y1;
    if (typeof Selection?.atEnd !== 'function') throw new FatalError('note Selectionが見つかりません');
    selectionCache = Selection;
    return Selection;
  }
  function noteUrlCommandFactory() {
    if (typeof noteUrlCommand === 'function') return noteUrlCommand;
    const req = webpackRequire();
    if (!req) throw new FatalError('note内部URL処理を取得できません');
    let mod;
    try { mod = req(94928); } catch (_) {}
    let candidate = typeof mod?.fjT === 'function' ? mod.fjT : null;
    const looksRight = (value) => {
      if (typeof value !== 'function') return false;
      let source = '';
      try { source = Function.prototype.toString.call(value); } catch (_) {}
      return source.includes('state.selection') && source.includes('nodeBefore') &&
        source.includes('replaceRangeWith') && source.includes('.then');
    };
    if (!looksRight(candidate)) {
      const loaded = Object.values(req.c || {}).flatMap((entry) => {
        const exp = entry?.exports;
        if (typeof exp === 'function') return [exp];
        return exp && typeof exp === 'object' ? Object.values(exp) : [];
      });
      candidate = loaded.find(looksRight) || null;
    }
    if (!looksRight(candidate)) throw new FatalError('note正規URLコマンドが見つかりません');
    noteUrlCommand = candidate;
    return noteUrlCommand;
  }
  function embedNodes(view) {
    const out = [];
    view.state.doc.descendants((node, pos) => { if (node.type?.name === 'embed') out.push({ node, pos }); });
    return out;
  }
  function imageNodes(view) {
    const out = [];
    view.state.doc.descendants((node, pos) => { if (node.type?.name === 'image') out.push({ node, pos }); });
    return out;
  }
  function cardKey(hit) { return String(hit?.node?.attrs?.embeddedContentKey || ''); }
  function cardUrl(hit) { return normalizeUrl(hit?.node?.attrs?.src); }
  function remoteImage(node) {
    const src = String(node?.attrs?.src || '');
    return /^https:\/\//i.test(src) && !/^https:\/\/editor\.note\.com\/icons\//i.test(src);
  }
  function findTrackedImage(view, record, url) {
    const wanted = normalizeUrl(url);
    if (!record) return null;
    return imageNodes(view).find((hit) => {
      const id = String(hit.node.attrs?.id || '');
      const src = String(hit.node.attrs?.src || '');
      const link = normalizeUrl(hit.node.attrs?.link);
      const matched = (record.id && String(record.id) === id) || (record.src && String(record.src) === src);
      return matched && link === wanted && remoteImage(hit.node);
    }) || null;
  }
  function verifiedImageCount(view, dataset, run) {
    let count = 0;
    for (const row of dataset.rows || []) {
      if (findTrackedImage(view, run.images?.[row.url], row.url)) count += 1;
    }
    return count;
  }
  function genuineCard(hit, url) {
    const key = cardKey(hit);
    const html = String(hit?.node?.attrs?.htmlForEmbed || '');
    return cardUrl(hit) === normalizeUrl(url) && /^emb[a-z0-9]+$/i.test(key) && html.includes('note-embed');
  }
  function ensureEndSelection(view) {
    const paragraph = view.state.schema.nodes.paragraph;
    if (!paragraph) throw new FatalError('paragraph nodeなし');
    if (view.state.doc.lastChild?.type !== paragraph || view.state.doc.lastChild.textContent !== '') {
      view.dispatch(view.state.tr.insert(view.state.doc.content.size, paragraph.create()));
    }
    view.dispatch(view.state.tr.setSelection(selectionApi().atEnd(view.state.doc)).scrollIntoView());
    view.focus();
  }
  function insertUrlAtEnd(view, url) {
    ensureEndSelection(view);
    const paragraph = view.state.schema.nodes.paragraph;
    view.dispatch(view.state.tr.insert(view.state.doc.content.size, paragraph.create(null, view.state.schema.text(url))));
    view.dispatch(view.state.tr.setSelection(selectionApi().atEnd(view.state.doc)).scrollIntoView());
    view.focus();
  }
  function exactUrlParagraphs(view, url) {
    const wanted = normalizeUrl(url), out = [];
    view.state.doc.descendants((node, pos) => {
      if (node.isTextblock && normalizeUrl((node.textContent || '').trim()) === wanted) out.push({ node, pos });
    });
    return out;
  }
  function deleteHits(view, hits) {
    const unique = new Map();
    (hits || []).forEach((hit) => hit?.node && unique.set(`${hit.pos}:${hit.node.nodeSize}`, hit));
    if (!unique.size) return 0;
    let tr = view.state.tr;
    [...unique.values()].sort((a, b) => b.pos - a.pos).forEach((hit) => {
      tr = tr.delete(hit.pos, hit.pos + hit.node.nodeSize);
    });
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return unique.size;
  }
  function deleteLastExactUrl(view, url) {
    const list = exactUrlParagraphs(view, url).sort((a, b) => b.pos - a.pos);
    if (list[0]) deleteHits(view, [list[0]]);
  }
  async function waitForNewCard(view, url, beforeKeys, timeout = 45000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const hit = embedNodes(view).find((entry) => {
        const key = cardKey(entry);
        return key && !beforeKeys.has(key) && genuineCard(entry, url);
      });
      if (hit) return hit;
      await sleep(250);
    }
    return null;
  }
  async function saveOnce(label) {
    setStatus(label);
    await sleep(4200);
    const button = [...document.querySelectorAll('button')].find((node) => {
      const text = node.textContent?.trim();
      return (text === '一時保存' || text === '下書き保存') && node.getClientRects().length;
    });
    if (button && !button.disabled) button.click();
    await sleep(6500);
  }

  async function resumableSend() {
    if (busy || !enabled()) return;
    const dataset = getJSON(DATA_KEY, null);
    const run = currentBaseRun();
    if (!dataset || dataset.version !== BASE_VERSION || !run || run.datasetId !== dataset.datasetId) {
      setStatus('先に「抽」→「画」', true);
      return;
    }
    setPaused(false);
    setBusy(true);
    try {
      const view = findView();
      if (!view) throw new FatalError('EditorViewなし。画面を再読込してください');
      selectionApi();
      noteUrlCommandFactory();
      const imageCount = verifiedImageCount(view, dataset, run);
      if (imageCount !== dataset.count) {
        throw new FatalError(`極薄画像🔗不足 ${imageCount}/${dataset.count}。先に「画」または「再開」`);
      }

      const tracked = Array.isArray(run.cardKeys) ? run.cardKeys : [];
      for (const entry of tracked) {
        if (!embedNodes(view).some((hit) => cardKey(hit) === entry.key && genuineCard(hit, entry.url))) {
          throw new FatalError('途中カードの記録と本文が一致しません。「初」でやり直してください');
        }
      }

      let index = tracked.length;
      run.stage = 'cards_building';
      run.cardKeys = tracked;
      setJSON(runKey(), run);

      for (; index < dataset.rows.length; index += 1) {
        if (isPaused()) {
          run.stage = 'cards_paused';
          setJSON(runKey(), run);
          await saveOnce(`途中保存 ${run.cardKeys.length}/${dataset.count}…`);
          setStatus(`停止・保存済み ${run.cardKeys.length}/${dataset.count} ✅ 「再開」で続きから`);
          return;
        }
        const row = dataset.rows[index];
        const beforeKeys = new Set(embedNodes(view).map(cardKey).filter(Boolean));
        insertUrlAtEnd(view, row.url);
        setStatus(`本物通知カード ${index + 1}/${dataset.count} 生成中…`);
        const command = noteUrlCommandFactory()(row.url);
        const handled = command(view.state, (transaction) => view.dispatch(transaction), view);
        if (!handled) {
          deleteLastExactUrl(view, row.url);
          throw new FatalError(`${index + 1}/${dataset.count} note正規URLコマンド未処理`);
        }
        const hit = await waitForNewCard(view, row.url, beforeKeys);
        if (!hit) {
          deleteLastExactUrl(view, row.url);
          throw new FatalError(`${index + 1}/${dataset.count} 新規embカード確認タイムアウト`);
        }
        deleteLastExactUrl(view, row.url);
        run.cardKeys.push({ url: row.url, key: cardKey(hit) });
        setJSON(runKey(), run);
        setStatus(`本物通知カード ${index + 1}/${dataset.count} ✅`);
        if (index < dataset.rows.length - 1) await sleep(900);
      }

      run.stage = 'cards_ready';
      setJSON(runKey(), run);
      await saveOnce(`通知カード ${dataset.count}件を保存中…`);
      setStatus(`通知カード ${dataset.count}/${dataset.count} 完成・保存 ✅ このまま公開/更新`);
      page.alert(`準備完了\n\n通知カード: ${dataset.count}件\n途中再開対応: ON\n\nそのまま公開/更新。通知後「削」。`);
    } catch (error) {
      setStatus(`送信停止：${error?.message || String(error)}（「再開」または「削」）`, true);
    } finally { setBusy(false); }
  }

  async function resetAll() {
    if (busy || !enabled()) return;
    setPaused(false);
    setBusy(true);
    try {
      const run = currentBaseRun();
      const view = findView();
      let removedCards = 0;
      let removedImages = 0;
      if (view && run) {
        const wantedKeys = new Set((run.cardKeys || []).map((x) => x.key).filter(Boolean));
        if (wantedKeys.size) {
          const hits = embedNodes(view).filter((hit) => wantedKeys.has(cardKey(hit)));
          removedCards = deleteHits(view, hits);
        }
        const trackedImages = Object.values(run.images || {});
        if (trackedImages.length) {
          const hits = imageNodes(view).filter((hit) => trackedImages.some((rec) => {
            const id = String(hit.node.attrs?.id || '');
            const src = String(hit.node.attrs?.src || '');
            return (rec?.id && String(rec.id) === id) || (rec?.src && String(rec.src) === src);
          }));
          removedImages = deleteHits(view, hits);
        }
        if (removedCards || removedImages) await saveOnce(`初期化 ${removedCards + removedImages}件を保存中…`);
      }
      setJSON(DATA_KEY, null);
      setJSON(runKey(), null);
      setJSON(workKey(), null);
      setJSON(controlKey(), null);
      setStatus(`最初に戻しました ✅ 削除: 通知${removedCards} / 極薄${removedImages}｜元本文は保持`);
    } catch (error) {
      setStatus(`初期化停止：${error?.message || String(error)}`, true);
    } finally { setBusy(false); }
  }

  async function resumeAny() {
    if (busy || !enabled()) return;
    setPaused(false);
    const work = getJSON(workKey(), null);
    const run = currentBaseRun();
    if (work && work.version === VERSION && ['extract_paused','collecting_source','choosing_articles','articles_ready','enrich_paused'].includes(work.stage)) {
      await runExtraction(work);
      return;
    }
    if (run && ['cards_building','cards_paused'].includes(run.stage)) {
      await resumableSend();
      return;
    }
    const dataset = getJSON(DATA_KEY, null);
    if (dataset && run && run.datasetId === dataset.datasetId) {
      setStatus('画像工程を再開します…');
      baseAction('image');
      return;
    }
    setStatus('再開する途中データはありません');
  }

  function choiceLabel(value) {
    if (value === 'fixed') return '固定';
    if (value === 'oldest') return '最古';
    return '最新';
  }
  function switchMode(mode) {
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    const p = prefs();
    p.mode = mode;
    savePrefs(p);
    panel.querySelectorAll('button[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    const input = panel.querySelector('input[data-source]');
    if (input) {
      input.value = mode === 'likes' ? p.likesUrl : p.magazineUrl;
      input.placeholder = mode === 'likes' ? 'スキ元の記事URL' : 'マガジンURL';
    }
    const hint = panel.querySelector('[data-hint]');
    if (hint) hint.textContent = mode === 'likes' ? 'スキした人を抽出 → 選んだ記事' : 'マガジン掲載者を抽出 → 選んだ記事';
  }
  function switchAmountMode(mode) {
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    const p = prefs();
    p.amountMode = mode;
    savePrefs(p);
    panel.querySelectorAll('button[data-amount-mode]').forEach((b) => b.classList.toggle('active', b.dataset.amountMode === mode));
    const input = panel.querySelector('input[data-amount]');
    if (input) input.style.display = mode === 'all' ? 'none' : 'block';
  }
  function switchChoice(choice) {
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    const p = prefs();
    p.articleChoice = choice;
    savePrefs(p);
    panel.querySelectorAll('button[data-choice]').forEach((b) => b.classList.toggle('active', b.dataset.choice === choice));
  }

  function installStyle() {
    if (document.getElementById(`${PANEL}-style`) || !document.head) return;
    const style = document.createElement('style');
    style.id = `${PANEL}-style`;
    style.textContent = `
      #${BASE_PANEL},#mumei-note-source-picker-v161,#mumei-note-source-picker-v162{display:none!important}
      #${PANEL}{position:fixed;right:6px;top:18%;z-index:2147483647;width:232px;background:#0b1220;color:#fff;border:1px solid #334155;border-radius:12px;padding:8px;box-shadow:0 12px 34px rgba(0,0,0,.38);font-family:system-ui,-apple-system,sans-serif}
      #${PANEL} .title{font-size:11px;font-weight:900;margin-bottom:6px}
      #${PANEL} .grid2{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:5px}
      #${PANEL} .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:5px}
      #${PANEL} button{background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:7px;padding:6px 3px;font-size:10px;font-weight:900}
      #${PANEL} button.active{background:#0f766e;color:#fff;border-color:#14b8a6}
      #${PANEL} input{box-sizing:border-box;width:100%;border:1px solid #475569;border-radius:7px;background:#020617;color:#fff;padding:7px 6px;font-size:11px;margin-bottom:5px}
      #${PANEL} input[data-amount]{font-size:16px;font-weight:900;text-align:center}
      #${PANEL} [data-hint]{font-size:9px;color:#94a3b8;margin-bottom:6px;line-height:1.3}
      #${PANEL} .actions{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:5px}
      #${PANEL} .actions button{color:#fff;font-size:12px;padding:8px 2px}
      #${PANEL} .actions button[data-a="extract"]{background:#0f766e}
      #${PANEL} .actions button[data-a="image"]{background:#2563eb}
      #${PANEL} .actions button[data-a="send"]{background:#7c3aed}
      #${PANEL} .actions button[data-a="delete"]{background:#b91c1c}
      #${PANEL} .resume{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:5px}
      #${PANEL} .resume button[data-a="pause"]{background:#92400e;color:#fff}
      #${PANEL} .resume button[data-a="resume"]{background:#0369a1;color:#fff}
      #${PANEL} .resume button[data-a="reset"]{background:#7f1d1d;color:#fff}
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
      <div class="title">極薄＋通知｜セレクト v16.3</div>
      <div class="grid2"><button data-mode="likes">スキから</button><button data-mode="magazine">マガジン</button></div>
      <input data-source type="url" inputmode="url" autocomplete="off">
      <div data-hint></div>
      <div class="grid3"><button data-choice="fixed">固定</button><button data-choice="latest">最新</button><button data-choice="oldest">最古</button></div>
      <div class="grid2"><button data-amount-mode="number">件数指定</button><button data-amount-mode="all">全件</button></div>
      <input data-amount type="number" min="1" max="3000" step="1" inputmode="numeric" value="${p.amount}">
      <div class="actions"><button data-a="extract">抽</button><button data-a="image">画</button><button data-a="send">送</button><button data-a="delete">削</button></div>
      <div class="resume"><button data-a="pause">停</button><button data-a="resume">再開</button><button data-a="reset">初</button></div>
      <div id="${STATUS}">URL・記事種別・件数を決めて「抽」</div>`;

    panel.addEventListener('click', (event) => {
      const modeButton = event.target.closest('button[data-mode]');
      if (modeButton && !busy) { switchMode(modeButton.dataset.mode); return; }
      const amountButton = event.target.closest('button[data-amount-mode]');
      if (amountButton && !busy) { switchAmountMode(amountButton.dataset.amountMode); return; }
      const choiceButton = event.target.closest('button[data-choice]');
      if (choiceButton && !busy) { switchChoice(choiceButton.dataset.choice); return; }
      const button = event.target.closest('button[data-a]');
      if (!button) return;
      if (button.dataset.a === 'pause') {
        setPaused(true);
        setStatus('停止要求 ✅ 現在の1件/1工程が終わった位置で保存して止まります');
        return;
      }
      if (busy) return;
      if (button.dataset.a === 'extract') void startExtraction();
      if (button.dataset.a === 'image') {
        setPaused(false);
        baseAction('image');
      }
      if (button.dataset.a === 'send') void resumableSend();
      if (button.dataset.a === 'delete') baseAction('delete');
      if (button.dataset.a === 'resume') void resumeAny();
      if (button.dataset.a === 'reset') void resetAll();
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
    switchChoice(p.articleChoice);
    switchAmountMode(p.amountMode);

    const run = currentBaseRun();
    const work = getJSON(workKey(), null);
    if (run?.stage === 'cards_paused') setStatus(`通知カード ${run.cardKeys?.length || 0}件で停止済み ✅ 「再開」`);
    else if (work?.stage?.includes('paused')) setStatus('抽出途中で停止済み ✅ 「再開」');
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