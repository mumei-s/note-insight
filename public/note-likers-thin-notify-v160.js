(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_LIKERS_THIN_NOTIFY_160__) return;
  page.__MUMEI_LIKERS_THIN_NOTIFY_160__ = true;

  const VERSION = '16.0.0';
  const SOURCE_KEY = 'n08825c632afd';
  const SOURCE_URL = `https://note.com/ss_yr/n/${SOURCE_KEY}`;
  const W = 860;
  const H = 140;
  const IMAGE_CHUNK = 80;
  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const PANEL = 'mumei-likers-thin-panel-v160';
  const STATUS = 'mumei-likers-thin-status-v160';
  const STYLE = 'mumei-likers-thin-style-v160';

  let busy = false;
  let viewCache = null;
  let selectionCache = null;
  let noteUrlCommand = null;
  let imageArm = null;
  let inputObserver = null;
  let imageChoiceClickListener = null;
  let imageChoicePointerListener = null;
  let nativeInputClick = null;
  const UPLOAD_DIAG_PREFIX = 'mumei_upload_diag_v160';
  const uploadNetFailures = [];
  const uploadRequests = new Set();
  let lastUploadActivityAt = 0, uploadSequence = 0;
  const UPLOAD_QUIET_MS = 20000;
  const UPLOAD_PAGE_TOKEN = `${Date.now()}-${Math.random()}`;
  function uploadBody(body) {
    const imageFile = value => value && typeof value === 'object' &&
      (/^image\//i.test(String(value.type || '')) || /\.(png|jpe?g|webp|gif|avif)$/i.test(String(value.name || '')));
    if (imageFile(body)) return true;
    if (body && typeof body.entries === 'function') {
      try { for (const [, value] of body.entries()) if (imageFile(value)) return true; } catch (_) {}
    }
    return false;
  }
  function beginUploadRequest(body, url) {
    const presign = /^https:\/\/note\.com\/api\/v3\/images\/upload\/presigned_post$/.test(cleanNetUrl(url));
    if (!imageArm?.consumed || !(presign || uploadBody(body))) return null;
    const ticket = { id: ++uploadSequence, url: cleanNetUrl(url), at: Date.now() };
    uploadRequests.add(ticket); lastUploadActivityAt = Date.now(); return ticket;
  }
  function endUploadRequest(ticket, status, message = '', retryAfter = '') {
    if (!ticket) return;
    uploadRequests.delete(ticket); lastUploadActivityAt = Date.now();
    if (!status || status >= 400) {
      const seconds = Number(retryAfter);
      const retryAt = retryAfter ? (Number.isFinite(seconds) ? Date.now() + Math.max(0, seconds) * 1000 : Date.parse(retryAfter)) : 0;
      recordNetFailure('image-upload', ticket.url, status, message, retryAt);
      page.__MUMEI_CARD_SAFETY__?.observeHttp(status, retryAfter);
    }
  }

  const safety = () => { if (!page.__MUMEI_CARD_SAFETY__) throw new Error('本文保護機能を読み込めません。ツールを18.8.2へ更新してください'); return page.__MUMEI_CARD_SAFETY__; };
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
  function uploadDiagKey() { return `${UPLOAD_DIAG_PREFIX}:${articleKey() || 'unknown'}`; }
  function cleanNetUrl(value) {
    try { const u = new URL(String(value || ''), location.href); return `${u.origin}${u.pathname}`; }
    catch (_) { return String(value || '').split('?')[0].slice(0, 240); }
  }
  function recordUploadDiag(entry) {
    const row = { at: new Date().toISOString(), ...entry };
    try {
      const prev = getJSON(uploadDiagKey(), []);
      const next = [...(Array.isArray(prev) ? prev : []), row].slice(-20);
      setJSON(uploadDiagKey(), next);
    } catch (_) {}
    return row;
  }
  function recordNetFailure(kind, url, status = 0, message = '', retryAt = 0) {
    const item = { at: Date.now(), kind, url: cleanNetUrl(url), status: Number(status || 0), message: String(message || '').slice(0, 160), retryAt: Number.isFinite(retryAt) ? retryAt : 0 };
    uploadNetFailures.push(item);
    if (uploadNetFailures.length > 30) uploadNetFailures.splice(0, uploadNetFailures.length - 30);
  }
  function recentNetFailure(since) {
    return [...uploadNetFailures].reverse().find((x) => x.at >= since) || null;
  }
  function uploadFailureText(net) {
    if (!net) return '';
    if (net.kind === 'note-alert') return 'noteの画像処理が失敗（HTTP状態は取得できません）';
    let host = '', phase = '画像送信';
    try { const u = new URL(net.url); host = u.host; if (u.pathname.endsWith('/images/upload/presigned_post')) phase = '画像受付'; } catch (_) {}
    return `${phase}${host ? ` ${host}` : ''}：${net.status ? `HTTP ${net.status}` : '応答なし（HTTP状態不明）'}`;
  }
  function visibleUploadErrors() {
    const errors = [];
    for (const node of document.querySelectorAll('[role="alert"],[role="status"],[aria-live]')) {
      if (!node.getClientRects?.().length || node.closest?.('#mumei-note-source-picker-v163,#mumei-likers-thin-panel-v160,.ProseMirror')) continue;
      const value = String(node.textContent || '').replace(/\s+/g, ' ').trim();
      if (value.length <= 300 && /(?:画像|写真).*アップロード.*(?:失敗|できません)|アップロード.*(?:失敗|できません)/.test(value)) errors.push({ node, text: value });
    }
    return errors;
  }
  function installUploadNetworkProbe() {
    if (page.__MUMEI_UPLOAD_NETWORK_PROBE_160__) return;
    page.__MUMEI_UPLOAD_NETWORK_PROBE_160__ = true;
    const rawFetch = typeof page.fetch === 'function' ? page.fetch.bind(page) : null;
    if (rawFetch) {
      page.fetch = async function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        const ticket = beginUploadRequest(args[1]?.body, url);
        try {
          const response = await rawFetch(...args);
          endUploadRequest(ticket, response.status, response.statusText, response.headers?.get?.('Retry-After')); return response;
        } catch (error) {
          endUploadRequest(ticket, 0, error?.message || String(error)); throw error;
        }
      };
    }
    const rawAlert = typeof page.alert === 'function' ? page.alert.bind(page) : null;
    if (rawAlert) page.alert = function (message) {
      if (imageArm?.consumed && /画像.*アップロード.*失敗/.test(String(message)) &&
          !recentNetFailure(imageArm.currentUploadStartedAt || imageArm.uploadStartedAt)) {
        recordNetFailure('note-alert', '', 0, message);
      }
      return rawAlert(message);
    };
    const proto = page.XMLHttpRequest?.prototype;
    if (proto && !proto.__mumeiUploadProbe160) {
      const rawOpen = proto.open, rawSend = proto.send;
      proto.open = function (method, url, ...rest) {
        this.__mumeiUploadUrl160 = url; return rawOpen.call(this, method, url, ...rest);
      };
      proto.send = function (...args) {
        const ticket = beginUploadRequest(args[0], this.__mumeiUploadUrl160);
        if (ticket) this.addEventListener('loadend', () => endUploadRequest(ticket, this.status, this.statusText, this.getResponseHeader?.('Retry-After')), { once: true });
        try { return rawSend.apply(this, args); } catch (error) { endUploadRequest(ticket, 0, error?.message); throw error; }
      };
      proto.__mumeiUploadProbe160 = true;
    }
  }
  const optimizedImageDOM = new WeakSet();
  function optimizeUploadedImages(view, run = getRun()) {
    if (!document.head || typeof view.nodeDOM !== 'function') return;
    const id = 'mumei-owned-image-memory-v1881';
    if (!document.getElementById(id)) {
      const style = document.createElement('style'); style.id = id;
      style.textContent = '.mumei-owned-thin-image-v1881{content-visibility:auto;contain-intrinsic-size:auto 140px}';
      document.head.appendChild(style);
    }
    for (const rec of Object.values(run?.images || {})) {
      const hit = safety().tracked(view, rec); if (!hit) continue;
      const dom = view.nodeDOM(hit.pos), image = dom?.tagName === 'IMG' ? dom : dom?.querySelector?.('img');
      if (image && !optimizedImageDOM.has(image)) { image.loading = 'lazy'; image.decoding = 'async'; optimizedImageDOM.add(image); }
      (dom?.closest?.('figure') || dom)?.classList?.add('mumei-owned-thin-image-v1881');
    }
  }
  function getDataset() {
    const value = getJSON(DATA_KEY, null);
    return value?.version === VERSION && value?.sourceKey === SOURCE_KEY && Array.isArray(value.rows) ? value : null;
  }
  function setDataset(value) { setJSON(DATA_KEY, value); }
  function getRun() {
    const value = getJSON(runKey(), null);
    return value && value.version === VERSION && value.articleKey === articleKey() ? value : null;
  }
  function setRun(value) { setJSON(runKey(), value); }
  function setStatus(text, bad = false) {
    const el = document.getElementById(STATUS);
    if (!el) return;
    el.textContent = text;
    el.dataset.bad = bad ? '1' : '0';
  }
  function updateButtons() {
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    panel.querySelectorAll('button').forEach((button) => { button.disabled = busy; });
  }
  function setBusy(value) { busy = value; updateButtons(); }

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
    const output = new Array(values.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor++;
        output[index] = await worker(values[index], index);
      }
    });
    const outcomes = await Promise.allSettled(runners);
    const failure = outcomes.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    return output;
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
  async function collectLikers() {
    const map = new Map();
    for (let p = 1; p <= 30; p += 1) {
      setStatus(`スキした人を取得 ${map.size}人… page ${p}`);
      const payload = await xhrJSON(`https://note.com/api/v3/notes/${SOURCE_KEY}/likes?page=${p}&per=50`);
      const list = Array.isArray(payload?.data?.likes) ? payload.data.likes : [];
      const before = map.size;
      list.forEach((item) => {
        const row = parseLiker(item);
        if (row) map.set(row.likerKey, row);
      });
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
      const title = String(note?.name || note?.title || '無題の記事').trim();
      return { ...liker, url, title, latestKey: key, publishAt: String(note?.publishAt || note?.publish_at || '').trim() || null };
    }
    return null;
  }
  async function latestForLiker(liker) {
    try {
      const payload = await xhrJSON(`https://note.com/api/v2/creators/${encodeURIComponent(liker.urlname)}/contents?kind=note&page=1`);
      return parseLatest(payload, liker);
    } catch (_) { return null; }
  }
  async function enrichArticle(row) {
    let thumbUrl = row.actorImageUrl || '';
    let creator = row.creator;
    let title = row.title;
    try {
      const payload = await xhrJSON(`https://note.com/api/v3/notes/${row.latestKey}`);
      const note = payload?.data || payload || {};
      title = String(note?.name || note?.title || title).trim();
      creator = String(note?.user?.nickname || note?.user?.name || creator).trim();
      const candidates = [
        note?.eyecatch_url, note?.eyecatch, note?.image_url,
        note?.user?.profileImageUrl, note?.user?.profile_image_url, row.actorImageUrl
      ].map((v) => String(v || '').trim()).filter(Boolean);
      thumbUrl = candidates[0] || thumbUrl;
      if (thumbUrl.startsWith('//')) thumbUrl = `https:${thumbUrl}`;
    } catch (_) {}
    return { ...row, title, creator, thumbUrl };
  }

  async function extractTargets() {
    if (busy || !enabled()) return;
    const current = getRun();
    if (current?.cardKeys?.length || Object.keys(current?.images || {}).length) {
      setStatus('この編集記事には前回の追跡データがあります。カードが残る場合は先に「削」', true);
      return;
    }
    setBusy(true);
    try {
      const likers = await collectLikers();
      if (!likers.length) throw new FatalError('スキした人を取得できませんでした');
      setStatus(`${likers.length}人取得 ✅ 最新記事を確認中…`);
      const latest = await mapLimit(likers, 5, async (liker, index) => {
        const row = await latestForLiker(liker);
        setStatus(`最新記事 ${index + 1}/${likers.length}…`);
        return row;
      });
      const available = latest.filter(Boolean);
      const unique = [];
      const seen = new Set();
      for (const row of available) {
        const url = normalizeUrl(row.url);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        unique.push(row);
      }
      if (!unique.length) throw new FatalError('紹介できる公開記事が0件です');
      setStatus(`${unique.length}件の記事情報・サムネを準備中…`);
      const enriched = await mapLimit(unique, 5, async (row, index) => {
        const item = await enrichArticle(row);
        setStatus(`記事情報 ${index + 1}/${unique.length}…`);
        return item;
      });
      const rows = enriched.map((row, index) => ({ ...row, index: index + 1 }));
      const datasetId = `${SOURCE_KEY}:${Date.now()}:${rows.length}`;
      const dataset = {
        version: VERSION, datasetId, sourceKey: SOURCE_KEY, sourceUrl: SOURCE_URL,
        extractedAt: new Date().toISOString(), likerCount: likers.length,
        skippedNoArticle: likers.length - available.length,
        duplicateArticleCount: available.length - unique.length,
        count: rows.length, rows
      };
      setDataset(dataset);
      setRun({ version: VERSION, articleKey: articleKey(), datasetId, stage: 'extracted', images: {}, cardKeys: [], pending: null, createdAt: new Date().toISOString() });
      setStatus(`抽出 ${likers.length}人 → 最新記事 ${rows.length}件 ✅ 次は「画」`);
      page.alert(`抽出完了\n\nスキした人: ${likers.length}人\n紹介する最新記事: ${rows.length}件\n記事なし等スキップ: ${dataset.skippedNoArticle}人\n\n次は「画」→ noteの「＋」→「画像」を1回。`);
    } catch (error) {
      setStatus(`抽出停止：${error?.message || String(error)}`, true);
    } finally { setBusy(false); }
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
    if (looksLikeView(viewCache) && viewCache.dom?.isConnected) return safety().attach(viewCache);
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
      if (looksLikeView(value)) return safety().attach(viewCache = value);
      let keys = [];
      try { keys = Object.getOwnPropertyNames(value); } catch (_) { continue; }
      for (const key of keys) {
        if (['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(key)) continue;
        let next;
        try { next = value[key]; } catch (_) { continue; }
        if (looksLikeView(next)) return safety().attach(viewCache = next);
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
    const id = 994000000 + Math.floor(Math.random() * 5000000);
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
  function preparedImageCommand() {
    const req = webpackRequire(); let command;
    try { command = req?.(94928)?.CwN; } catch (_) {}
    // Same native command as note's file-drop handler, inspected against the current editor.
    const code = typeof command === 'function' ? Function.prototype.toString.call(command) : '';
    return command?.length === 4 && /Array\.from/.test(code) && /imageUploading/.test(code) && /entries/.test(code) ? command : null;
  }
  function imageNodes(view) { return safety().index(view).images; }
  function embedNodes(view) { return safety().index(view).embeds; }
  function cardKey(hit) { return String(hit?.node?.attrs?.embeddedContentKey || ''); }
  function cardUrl(hit) { return normalizeUrl(hit?.node?.attrs?.src); }
  function genuineCard(hit, url) {
    const key = cardKey(hit), html = String(hit?.node?.attrs?.htmlForEmbed || '');
    return cardUrl(hit) === normalizeUrl(url) && /^emb[a-z0-9]+$/i.test(key) && html.includes('note-embed');
  }
  function remoteImage(node) {
    const src = String(node?.attrs?.src || '');
    return /^https:\/\//i.test(src) && !/^https:\/\/editor\.note\.com\/icons\//i.test(src);
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
  let insertedUrlNode = null, conversionError = null;
  function insertUrlAtEnd(view, url) {
    conversionError = null;
    safety().check(view);
    ensureEndSelection(view);
    const paragraph = view.state.schema.nodes.paragraph;
    const pos = view.state.doc.content.size;
    view.dispatch(view.state.tr.insert(pos, paragraph.create(null, view.state.schema.text(url))));
    // note assigns an ID via appendTransaction; retain the resulting node.
    insertedUrlNode = view.state.doc.nodeAt(pos);
    if (insertedUrlNode?.type !== paragraph || insertedUrlNode.textContent !== url) throw new FatalError('挿入したURLを確認できません。本文を保持して停止しました');
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
  function deleteHits(view, hits) { return safety().remove(view, hits || []); }
  function deleteLastExactUrl(view, url) {
    const list = exactUrlParagraphs(view, url).filter(hit => hit.node === insertedUrlNode).sort((a, b) => b.pos - a.pos);
    if (list[0]) deleteHits(view, [list[0]]);
  }
  async function waitForNewCard(view, url, beforeKeys, timeout = 45000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (conversionError) throw conversionError;
      const hit = embedNodes(view).find((entry) => {
        const key = cardKey(entry);
        return key && !beforeKeys.has(key) && genuineCard(entry, url);
      });
      if (hit) return hit;
      safety().check(view);
      await sleep(80);
    }
    return null;
  }

  async function saveOnce(label) {
    return safety().save(findView(), label);
  }

  function roundedRect(ctx, x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function textLines(ctx, text, maxWidth, maxLines) {
    const chars = [...String(text || '')], lines = [];
    let cursor = 0;
    for (let n = 0; n < maxLines && cursor < chars.length; n += 1) {
      let line = '';
      while (cursor < chars.length) {
        const test = line + chars[cursor];
        if (line && ctx.measureText(test).width > maxWidth) break;
        line = test; cursor += 1;
      }
      if (n === maxLines - 1 && cursor < chars.length) {
        while (line && ctx.measureText(`${line}…`).width > maxWidth) line = [...line].slice(0, -1).join('');
        line += '…';
        cursor = chars.length;
      }
      lines.push(line);
    }
    return lines;
  }
  function fitText(ctx, text, maxWidth) {
    let value = String(text || '');
    if (ctx.measureText(value).width <= maxWidth) return value;
    while (value && ctx.measureText(`${value}…`).width > maxWidth) value = [...value].slice(0, -1).join('');
    return `${value}…`;
  }
  async function bitmap(blob, resizeWidth) {
    if (typeof page.createImageBitmap === 'function') { try { return await page.createImageBitmap(blob, { resizeWidth, resizeQuality: 'high' }); } catch (_) { return page.createImageBitmap(blob); } }
    return new Promise((resolve, reject) => {
      const img = new page.Image(), objectUrl = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('画像読込失敗')); };
      img.src = objectUrl;
    });
  }
  function drawCircleCover(ctx, image, cx, cy, diameter) {
    const iw = image?.width || image?.naturalWidth || 1;
    const ih = image?.height || image?.naturalHeight || 1;
    const scale = Math.max(diameter / iw, diameter / ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, diameter / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  }
  async function makeThinFile(row) {
    const cache = page.__MUMEI_THIN_IMAGE_CACHE__;
    const filename = `${String(row.index).padStart(3, '0')}_thin.png`;
    const prepared = page.__MUMEI_PREPARED_BATCH__;
    if (row.preparedBatchId) {
      if (!prepared) throw new FatalError('完成データの読込機能がありません。最新版に更新してください');
      const blob = await prepared.image(row);
      return new page.File([blob], filename, { type: 'image/png' });
    }
    const cached = await cache?.get(row);
    if (cached) return new page.File([cached], filename, { type: 'image/png' });
    const load = async (url, width) => { if (!url) return null; try { return await bitmap(await xhr(url, 'blob', 30000), width); } catch (_) { return null; } };
    const [image, avatar] = await Promise.all([load(row.thumbUrl, 640), load(row.actorImageUrl, 84)]);

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#d9dde3'; ctx.lineWidth = 1.5; roundedRect(ctx, 1, 1, W - 2, H - 2, 12); ctx.stroke();

    const tw = 320, th = 124, tx = 532, ty = 8;
    const textX = 16, textWidth = 504;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#171b21';
    ctx.font = '700 19px system-ui,-apple-system,sans-serif';
    textLines(ctx, row.title, textWidth, 3).forEach((line, i) => ctx.fillText(line, textX, 9 + i * 22));

    // Creator area: exact profile icon + readable name. Title stays visually dominant.
    const avatarD = 42, avatarX = 16, avatarY = 88;
    const nameX = avatarX + avatarD + 10;
    const nameWidth = textWidth - avatarD - 10;
    if (avatar) {
      ctx.fillStyle = '#f3f4f6';
      ctx.beginPath(); ctx.arc(avatarX + avatarD / 2, avatarY + avatarD / 2, avatarD / 2 + 1, 0, Math.PI * 2); ctx.fill();
      drawCircleCover(ctx, avatar, avatarX + avatarD / 2, avatarY + avatarD / 2, avatarD);
      ctx.strokeStyle = '#d7dce2'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(avatarX + avatarD / 2, avatarY + avatarD / 2, avatarD / 2, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = '#eef1f4';
      ctx.beginPath(); ctx.arc(avatarX + avatarD / 2, avatarY + avatarD / 2, avatarD / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9aa1aa';
      ctx.beginPath(); ctx.arc(avatarX + avatarD / 2, avatarY + 13, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(avatarX + avatarD / 2, avatarY + 35, 14, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = '#343a43';
    ctx.font = '700 16px system-ui,-apple-system,sans-serif';
    const creatorLines = textLines(ctx, row.creator || 'noteクリエイター', nameWidth, 2);
    creatorLines.forEach((line, i) => ctx.fillText(line, nameX, 91 + i * 18));

    ctx.fillStyle = '#f7f8fa'; roundedRect(ctx, tx, ty, tw, th, 8); ctx.fill();
    if (image) {
      const iw = image.width || image.naturalWidth || 1, ih = image.height || image.naturalHeight || 1;
      const scale = Math.min(tw / iw, th / ih), dw = iw * scale, dh = ih * scale;
      ctx.save(); roundedRect(ctx, tx, ty, tw, th, 8); ctx.clip();
      ctx.drawImage(image, tx + (tw - dw) / 2, ty + (th - dh) / 2, dw, dh); ctx.restore();
    } else {
      ctx.fillStyle = '#6b7280'; ctx.font = '800 28px system-ui,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('note', tx + tw / 2, 48); ctx.textAlign = 'start';
    }

    if (typeof image?.close === 'function') image.close();
    if (typeof avatar?.close === 'function') avatar.close();

    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('極薄カード生成失敗')), 'image/png', 1));
    canvas.width = 1; canvas.height = 1;
    if ((!row.thumbUrl || image) && (!row.actorImageUrl || avatar)) await cache?.put(row, blob);
    return new page.File([blob], filename, { type: 'image/png' });
  }

  function findImageByState(view, record, url) {
    const wanted = normalizeUrl(url);
    const hit = safety().tracked(view, record, url);
    if (hit && (record?.id || normalizeUrl(hit.node.attrs?.link) === wanted)) return hit;
    return null;
  }
  function verifiedImageCount(view, dataset, run) {
    let count = 0;
    for (const row of dataset.rows) {
      const hit = findImageByState(view, run.images?.[row.url], row.url);
      if (hit && remoteImage(hit.node) && normalizeUrl(hit.node.attrs?.link) === normalizeUrl(row.url)) count += 1;
    }
    return count;
  }
  function missingRows(view, dataset, run) {
    return dataset.rows.filter((row) => {
      const hit = findImageByState(view, run.images?.[row.url], row.url);
      return !(hit && remoteImage(hit.node) && normalizeUrl(hit.node.attrs?.link) === normalizeUrl(row.url));
    });
  }
  function confirmationRow(dataset) {
    const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
    const row = rows[rows.length - 1];
    if (!row || !row.finalMarker) throw new FatalError('確認用サブ垢記事が最後にありません');
    return row;
  }
  function verifyConfirmationImage(view, dataset, run) {
    const row = confirmationRow(dataset);
    const hit = findImageByState(view, run.images?.[row.url], row.url);
    if (!hit || !remoteImage(hit.node) || normalizeUrl(hit.node.attrs?.link) !== normalizeUrl(row.url)) {
      throw new FatalError('確認用「実績の算数」の極薄サムネイル🔗がありません');
    }
    return row;
  }

  async function linkCreatedImages(view, workRows, created, run) {
    if (created.length !== workRows.length) throw new FatalError(`新規画像数不一致 ${created.length}/${workRows.length}`);
    const ordered = created.map((hit, i) => ({ hit, row: workRows[i] })).sort((a, b) => a.hit.pos - b.hit.pos);
    created = ordered.map(x => x.hit); workRows = ordered.map(x => x.row);
    const chunkSize = created.length > 40 ? 24 : created.length;
    for (let start = 0; start < created.length; start += chunkSize) {
      let tr = view.state.tr;
      const end = Math.min(start + chunkSize, created.length);
      for (let i = end - 1; i >= start; i -= 1) {
        const row = workRows[i], hit = safety().tracked(view, created[i].node.attrs);
        if (!hit) throw new FatalError("画像の対応を確認できません");
        tr = page.__MUMEI_CARD_CREATOR__ ? page.__MUMEI_CARD_CREATOR__.apply(view, hit, row, tr) : safety().relink(view, hit, row.url, tr);
      }
      view.dispatch(tr);
      setStatus(`画像🔗付与 ${end}/${created.length}…`);
      if (end < created.length) await sleep(60);
    }
    const afterIndex = safety().index(view), after = afterIndex.images;
    for (let i = 0; i < workRows.length; i += 1) {
      const row = workRows[i], createdId = String(created[i]?.node?.attrs?.id || '');
      const hit = (createdId ? afterIndex.byId.get(createdId) : null) ||
        after.find((entry) => normalizeUrl(entry.node.attrs?.link) === normalizeUrl(row.url) && remoteImage(entry.node));
      if (!hit || normalizeUrl(hit.node.attrs?.link) !== normalizeUrl(row.url)) throw new FatalError(`画像🔗確認NG: ${row.index}`);
      if (page.__MUMEI_CARD_CREATOR__ && hit.node.textContent !== page.__MUMEI_CARD_CREATOR__.caption(row)) throw new FatalError(`キャプション確認NG: ${row.index}`);
      run.images[row.url] = { id: String(hit.node.attrs?.id || ''), src: String(hit.node.attrs?.src || '') };
    }
    setRun(run);
    optimizeUploadedImages(view, run);
  }
  async function waitNewRemoteImages(view, beforeIds, expected, timeout = 1800000, baselineErrors = new Map()) {
    const startedAt = Date.now(), deadline = startedAt + timeout;
    let lastCount = 0, lastGrowthAt = startedAt, firstErrorAt = 0;
    while (Date.now() < deadline) {
      safety().check(view);
      const allNew = imageNodes(view).filter(hit => hit.node.attrs?.id && !beforeIds.has(String(hit.node.attrs.id))).sort((a,b) => a.pos-b.pos);
      const running = imageArm?.run || getRun();
      if (running?.pending && allNew.length === expected && !running.pending.slots) {
        running.pending.slots = allNew.map(hit => String(hit.node.attrs.id)); setRun(running);
        if (imageArm) imageArm.run.pending = running.pending;
      }
      const fresh = allNew.filter(hit => remoteImage(hit.node));
      if (fresh.length > lastCount) { lastCount = fresh.length; lastGrowthAt = Date.now(); }
      if (fresh.length === expected) return { fresh, failed: false, reason: '', net: null };
      if (fresh.length > expected) return { fresh: [], failed: true, reason: '投入枚数を超える画像を検出。順序を確認するため停止', net: null };
      const uiError = visibleUploadErrors().find(entry => baselineErrors.get(entry.node) !== entry.text)?.text || '';
      const net = recentNetFailure(imageArm?.currentUploadStartedAt || startedAt);
      if ((uiError || net) && !firstErrorAt) firstErrorAt = Date.now();
      // Keep waiting while the native image queue is active; unrelated requests and old toasts do not stop it.
      if (firstErrorAt && !uploadRequests.size && Date.now() - Math.max(lastGrowthAt, lastUploadActivityAt, firstErrorAt) >= UPLOAD_QUIET_MS) {
        return { fresh, failed: true, reason: uiError || '画像アップロード通信エラー', net };
      }
      const completed = imageArm?.nativeCommand ? verifiedImageCount(view, imageArm.dataset, imageArm.run) : null;
      setStatus(completed !== null ? `画像 ${completed}/${imageArm.dataset.count}｜${firstErrorAt ? '失敗を確認中' : '次の1枚を処理中'}` : `画像アップロード ${fresh.length}/${expected}｜処理中${uploadRequests.size}件${firstErrorAt ? '｜成功分を回収中' : ''}`);
      await sleep(500);
    }
    const fresh = imageNodes(view).filter(hit => hit.node.attrs?.id && !beforeIds.has(String(hit.node.attrs.id)) && remoteImage(hit.node)).sort((a,b) => a.pos-b.pos);
    return { fresh, failed: true, reason: '画像アップロード完了待ちタイムアウト', net: recentNetFailure(startedAt) };
  }
  function imageInput(input) {
    if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return false;
    const accept = String(input.accept || '').toLowerCase();
    return !accept || accept.includes('image') || accept.includes('.png') || accept.includes('.jpg') || accept.includes('.jpeg') || accept.includes('.webp');
  }
  const IMAGE_CHOICE_SELECTOR = 'button,[role="button"],label,[role="menuitem"],li';
  function exactImageChoice(node, visible = true) {
    if (!(node instanceof Element) || !node.matches?.(IMAGE_CHOICE_SELECTOR)) return false;
    const label = String(node.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/^(?:画像|写真|画像を追加|写真を追加)$/.test(label)) return false;
    return !visible || Boolean(node.getClientRects().length);
  }
  function findVisibleImageChoice(root) {
    if (!(root instanceof Element)) return null;
    if (exactImageChoice(root)) return root;
    return [...(root.querySelectorAll?.(IMAGE_CHOICE_SELECTOR) || [])].find((node) => exactImageChoice(node)) || null;
  }
  function markNativeImageMenuReady(roots) {
    const arm = imageArm;
    if (!arm || arm.consumed || arm.imageChoiceSelected || arm.nativeMenuReady) return false;
    let found = null;
    for (const root of roots) {
      found = findVisibleImageChoice(root);
      if (found) break;
    }
    if (!found) return false;
    arm.nativeMenuReady = true;
    arm.nativeImageChoice = found;
    return true;
  }
  function scheduleNativeMenuProbe(roots = [document.body]) {
    const arm = imageArm;
    if (!arm || arm.consumed || arm.imageChoiceSelected || arm.nativeMenuReady || arm.menuProbeScheduled) return;
    arm.menuProbeScheduled = true;
    page.requestAnimationFrame(() => {
      const current = imageArm;
      if (!current || current !== arm) return;
      current.menuProbeScheduled = false;
      markNativeImageMenuReady(roots.filter(Boolean));
    });
  }
  function uninstallImageInputBridge() {
    try { inputObserver?.disconnect(); } catch (_) {}
    inputObserver = null;
    if (imageChoiceClickListener) {
      document.removeEventListener('click', imageChoiceClickListener, true);
      imageChoiceClickListener = null;
    }
    if (imageChoicePointerListener) {
      document.removeEventListener('pointerdown', imageChoicePointerListener, true);
      imageChoicePointerListener = null;
    }
    if (nativeInputClick && page.HTMLInputElement?.prototype) {
      try { page.HTMLInputElement.prototype.click = nativeInputClick; } catch (_) {}
    }
    nativeInputClick = null;
  }
  function cancelImageArm(reason = '') {
    const arm = imageArm;
    imageArm = null;
    if (arm?.timer) clearTimeout(arm.timer);
    uninstallImageInputBridge();
    if (arm && !arm.consumed) { arm.files.length = 0; arm.beforeInputs?.clear(); }
    if (reason && arm?.reject) arm.reject(new FatalError(reason));
  }
  function installNativeInputInterceptor() {
    if (nativeInputClick) return;
    const prototype = page.HTMLInputElement?.prototype;
    if (!prototype) return;
    nativeInputClick = prototype.click;
    prototype.click = function interceptedImageClick(...args) {
      const arm = imageArm;
      if (arm && imageInput(this)) {
        if (!arm.consumed) void injectImageInput(this);
        return;
      }
      return nativeInputClick.apply(this, args);
    };
  }
  async function injectPreparedImages(arm) {
    let unsaved = false;
    try {
      for (let i = 0; i < arm.workRows.length; i++) {
        safety().check(arm.view);
        if (safety().stopped()) throw new FatalError('画像作成を停止しました');
        const row = arm.workRows[i];
        ensureEndSelection(arm.view);
        const before = new Set(imageNodes(arm.view).map(hit => String(hit.node.attrs?.id || '')).filter(Boolean));
        arm.currentUploadStartedAt = Date.now();
        arm.run.pending = { workUrls: [row.url], beforeIds: [...before], at: Date.now(), stage: 'uploading', runtime: '18.8.6', pageToken: UPLOAD_PAGE_TOKEN };
        setRun(arm.run);
        const baseline = new Map(visibleUploadErrors().map(entry => [entry.node, entry.text]));
        const transfer = new page.DataTransfer(); transfer.items.add(arm.files[i]);
        const last = confirmationRow(arm.dataset);
        const anchor = row.url === last.url ? null : findImageByState(arm.view, arm.run.images?.[last.url], last.url);
        const pos = anchor ? anchor.pos : arm.view.state.selection.from;
        if (!Number.isInteger(pos) || pos < 0) throw new FatalError('画像の挿入位置を確認できません');
        arm.phase = 'アップロード';
        if (arm.nativeCommand(arm.view, transfer.files, pos - 1, 'image') !== true) throw new FatalError('noteの正規画像処理が開始されませんでした');
        // note returns before its upload finishes. Never start another file until this one is remote.
        const result = await waitNewRemoteImages(arm.view, before, 1, 120000, baseline);
        if (result.failed || result.fresh.length !== 1) {
          arm.run.pending.stage = 'failed'; arm.run.pending.failure = result.reason;
          arm.run.pending.retryAt = result.net?.retryAt || 0; setRun(arm.run);
          const completed = verifiedImageCount(arm.view, arm.dataset, arm.run);
          const net = uploadFailureText(result.net);
          recordUploadDiag({runtime:'18.8.6', requested:1, succeededThisBatch:0, completedAfter:completed, network:result.net, reason:result.reason});
          throw new FatalError(`累計${completed}/${arm.dataset.count}｜対象 ${row.creator || row.index}｜${net || result.reason}｜成功分を保持`);
        }
        arm.phase = 'リンク付与';
        await linkCreatedImages(arm.view, [row], result.fresh, arm.run);
        arm.run.pending = null; setRun(arm.run); unsaved = true;
        arm.files[i] = null;
        // Pace successful requests as well; HTTP errors stop the queue without automatic retries.
        await sleep(750);
      }
    } finally {
      if (unsaved) {
        arm.phase = '下書き保存確認';
        await saveOnce(`成功分を保存中｜画像 ${verifiedImageCount(arm.view, arm.dataset, arm.run)}/${arm.dataset.count}…`);
      }
    }
  }
  async function injectImageInput(input) {
    const arm = imageArm;
    if (!arm || arm.consumed || !(arm.nativeCommand || imageInput(input))) return false;
    arm.consumed = true;
    arm.nativeInput = input;
    arm.phase = '画像投入';
    if (arm.timer) clearTimeout(arm.timer);
    arm.timer = null;
    arm.uploadStartedAt = Date.now();
    const baselineErrors = new Map(visibleUploadErrors().map(entry => [entry.node, entry.text]));
    const doneBefore = verifiedImageCount(arm.view, arm.dataset, arm.run);
    try {
      if (arm.nativeCommand) { await injectPreparedImages(arm); arm.resolve(true); return true; }
      const transfer = new page.DataTransfer();
      arm.files.forEach((file) => transfer.items.add(file));
      arm.run.pending = { workUrls: arm.workRows.map((r) => r.url), beforeIds: [...arm.beforeIds], at: Date.now(), stage: 'uploading', runtime: '18.8.6', pageToken: UPLOAD_PAGE_TOKEN };
      setRun(arm.run);
      input.files = transfer.files;
      input.dispatchEvent(new page.Event('input', { bubbles: true }));
      input.dispatchEvent(new page.Event('change', { bubbles: true }));
      const inserted = imageNodes(arm.view).filter(hit => hit.node.attrs?.id && !arm.beforeIds.has(String(hit.node.attrs.id))).sort((a,b) => a.pos-b.pos);
      if (inserted.length === arm.workRows.length) { arm.run.pending.slots = inserted.map(hit => String(hit.node.attrs.id)); setRun(arm.run); }
      arm.phase = 'アップロード';
      setStatus(`${arm.files.length}枚を一括挿入・アップロード中…`);
      const result = await waitNewRemoteImages(arm.view, arm.beforeIds, arm.workRows.length, 1800000, baselineErrors);
      const created = result.fresh || [];
      if (result.failed && arm.run.pending) {
        arm.run.pending.stage = 'failed'; arm.run.pending.failedAt = Date.now();
        arm.run.pending.failure = result.reason; setRun(arm.run);
      }
      if (created.length) {
        const slots = arm.run.pending?.slots;
        if (created.length !== arm.workRows.length && (!slots || slots.length !== arm.workRows.length)) throw new FatalError('一部画像の順序を確認できません。誤ったリンクを付けず本文と投入記録を保持して停止しました');
        const rows = created.map((hit, i) => arm.workRows[slots ? slots.indexOf(String(hit.node.attrs.id)) : i]);
        if (rows.some(row => !row)) throw new FatalError('画像の投入記録が一致しません');
        arm.phase = 'リンク付与';
        await linkCreatedImages(arm.view, rows, created, arm.run);
        if (created.length === arm.workRows.length) { arm.run.pending = null; setRun(arm.run); }
        arm.phase = '下書き保存確認';
        await saveOnce(`途中成功分も確定保存｜極薄画像🔗 ${verifiedImageCount(arm.view, arm.dataset, arm.run)}/${arm.dataset.count}…`);
      }
      if (result.failed || created.length < arm.workRows.length) {
        const doneNow = verifiedImageCount(arm.view, arm.dataset, arm.run);
        const left = Math.max(0, arm.dataset.count - doneNow);
        const netText = result.net ? `｜${uploadFailureText(result.net)}` : '';
        arm.phase = 'アップロード';
        const reason = result.reason || 'note側画像アップロード失敗';
        recordUploadDiag({
          requested: arm.workRows.length,
          succeededThisBatch: created.length,
          completedBefore: doneBefore,
          completedAfter: doneNow,
          remaining: left,
          reason,
          network: result.net || null
        });
        throw new FatalError(`note側アップロード失敗｜今回 ${created.length}/${arm.workRows.length}｜累計 ${doneNow}/${arm.dataset.count}｜残り${left}｜${reason}${netText}`);
      }
      arm.resolve(true);
    } catch (error) {
      if (arm.run.pending) { arm.run.pending.stage = 'failed'; arm.run.pending.failure = error?.message || String(error); setRun(arm.run); }
      recordUploadDiag({ runtime: '18.8.6', phase: arm.phase, requested: arm.workRows.length, completedBefore: doneBefore, completedAfter: Object.keys(arm.run.images || {}).length, reason: error?.message || String(error), network: recentNetFailure(arm.uploadStartedAt) });
      const failure = new FatalError(`${arm.phase}｜開始時${doneBefore}枚｜${error?.message || String(error)}`);
      failure.cause = error; arm.reject(failure);
    } finally {
      try { input.files = new page.DataTransfer().files; input.value = ''; } catch (_) {}
      arm.files.length = 0;
      arm.beforeInputs?.clear();
      optimizeUploadedImages(arm.view, arm.run);
    }
    return true;
  }
  function installImageInputBridge() {
    if (inputObserver || !document.documentElement) return;
    // note may reuse the same hidden file input/menu on the 3rd+ batch.
    // Install the interceptor immediately and probe already-mounted UI.
    installNativeInputInterceptor();
    markNativeImageMenuReady([document.body]);
    imageChoicePointerListener = (event) => {
      const arm = imageArm;
      if (!arm || arm.consumed || arm.imageChoiceSelected || !event.isTrusted || !arm.nativeMenuReady) return;
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
      const trigger = path.find((node) => exactImageChoice(node));
      if (!trigger || !arm.nativeImageChoice || !(path.includes(arm.nativeImageChoice) || arm.nativeImageChoice.contains?.(event.target))) return;
      arm.imageChoiceSelected = true;
      installNativeInputInterceptor();
      setStatus(`${arm.files.length}枚｜「画像」を選択。自動接続中…`);
    };
    document.addEventListener('pointerdown', imageChoicePointerListener, true);
    imageChoiceClickListener = (event) => {
      const arm = imageArm;
      if (!arm || arm.consumed) return;
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
      const directInput = path.find((node) => imageInput(node));
      if (directInput) {
        event.preventDefault(); event.stopPropagation(); void injectImageInput(directInput); return;
      }
      if (event.isTrusted && !arm.nativeMenuReady) scheduleNativeMenuProbe([document.body]);
    };
    document.addEventListener('click', imageChoiceClickListener, true);
    inputObserver = new MutationObserver((mutations) => {
      const arm = imageArm;
      if (!arm || arm.consumed) return;
      const roots = [];
      for (const mutation of mutations) for (const node of mutation.addedNodes) {
        if (node instanceof Element) roots.push(node);
      }
      if (!arm.imageChoiceSelected) {
        markNativeImageMenuReady(roots);
      }
      for (const node of roots) {
        if (imageInput(node)) { void injectImageInput(node); return; }
        for (const input of node.querySelectorAll?.('input[type="file"]') || []) {
          if (imageInput(input)) { void injectImageInput(input); return; }
        }
      }
    });
    inputObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
  async function prepareReset() {
    if (imageArm && !imageArm.consumed) cancelImageArm('初期化へ切り替えます');
    safety().stop();
    const deadline = Date.now() + 60000;
    while (busy && Date.now() < deadline) await sleep(100);
    if (busy || uploadRequests.size) throw new FatalError('画像通信の完了を待っています。処理が終わってから初期化してください');
  }
  function resetImageIds(view, run) {
    if (uploadRequests.size) throw new FatalError('画像通信中のため初期化を待っています');
    const pending = run?.pending;
    if (!pending) return [];
    if (lastUploadActivityAt && Date.now() - lastUploadActivityAt < UPLOAD_QUIET_MS && pending.stage === 'failed') throw new FatalError('画像通信の停止確認中です。少し待って初期化してください');
    const before = new Set((pending.beforeIds || []).map(String));
    const slots = new Set((pending.slots || []).map(String));
    const tracked = new Set(Object.values(run.images || {}).map(rec => String(rec.id || '')).filter(Boolean));
    const unknown = imageNodes(view).filter(hit => {
      const id = String(hit.node.attrs?.id || '');
      return !before.has(id) && !slots.has(id) && !tracked.has(id);
    });
    if (unknown.length) throw new FatalError('投入記録にない画像があります。元画像を守るため初期化を止めました');
    return [...slots].filter(id => !before.has(id));
  }
  page.__MUMEI_THIN_UPLOAD__ = { prepareReset, resetImageIds };

  async function recoverPending(view, dataset, run) {
    const pending = run.pending;
    if (!pending?.workUrls?.length || !Array.isArray(pending.beforeIds)) throw new FatalError('画像の投入記録が不完全です。本文の控えを確認してください');
    const workRows = pending.workUrls.map(url => dataset.rows.find(row => row.url === url));
    if (workRows.some(row => !row)) throw new FatalError('画像の対象一覧が一致しません');
    if (Number(pending.retryAt || 0) > Date.now()) throw new FatalError(`noteの通信制限待ちです。あと${Math.ceil((pending.retryAt - Date.now()) / 1000)}秒後に「画」を押してください`);
    const before = new Set(pending.beforeIds.map(String));
    // Saved image IDs may change when the editor is reopened; verify source and link before rebasing.
    for (const row of dataset.rows) {
      if (pending.workUrls.includes(row.url)) continue;
      const hit = findImageByState(view, run.images?.[row.url], row.url);
      if (hit && remoteImage(hit.node) && normalizeUrl(hit.node.attrs.link) === normalizeUrl(row.url)) before.add(String(hit.node.attrs.id));
    }
    const collect = () => imageNodes(view).filter(hit => hit.node.attrs?.id && !before.has(String(hit.node.attrs.id))).sort((a,b) => a.pos-b.pos);
    let all = collect();
    const complete = all.length === workRows.length && all.every(hit => remoteImage(hit.node));
    let retry = false;
    if (!complete) {
      const recordedFailure = pending.stage === 'failed' || getJSON(uploadDiagKey(), []).some(row =>
        Date.parse(row.at) >= Number(pending.at || 0) && row.requested === workRows.length && row.succeededThisBatch < row.requested);
      const abandonedEmpty = !all.length && pending.pageToken !== UPLOAD_PAGE_TOKEN && !lastUploadActivityAt && !imageArm;
      if ((!recordedFailure && !abandonedEmpty) || uploadRequests.size) throw new FatalError('前回の画像アップロードが未完了です。本文と投入記録を保持しています。noteの処理完了後に「追加＋カード続き」で回収します');
      const signature = () => JSON.stringify(collect().map(hit => [hit.node.attrs.id, hit.node.attrs.src]));
      const initial = signature();
      await sleep(2000); safety().check(view);
      if (uploadRequests.size || signature() !== initial || (lastUploadActivityAt && Date.now() - lastUploadActivityAt < UPLOAD_QUIET_MS)) throw new FatalError('前回のアップロードが動いています。完了後に「追加＋カード続き」を押してください');
      all = collect(); retry = true;
    }
    const slots = pending.slots;
    if (all.length && (!slots || slots.length !== workRows.length) && !complete) throw new FatalError('一部画像の順序が未確認です。誤ったリンクを防ぐため本文と投入記録を保持しました');
    if (slots && (new Set(slots).size !== slots.length || all.some(hit => !slots.includes(String(hit.node.attrs.id))))) throw new FatalError('画像IDが投入記録と一致しません');
    const ready = all.filter(hit => remoteImage(hit.node));
    const rows = ready.map((hit, i) => workRows[slots ? slots.indexOf(String(hit.node.attrs.id)) : i]);
    if (rows.some(row => !row)) throw new FatalError('前回の画像順序を確認できません');
    if (ready.length) await linkCreatedImages(view, rows, ready, run);
    if (retry) {
      const placeholders = all.filter(hit => !remoteImage(hit.node));
      if (placeholders.length) safety().remove(view, placeholders);
    }
    await saveOnce(retry ? `成功${ready.length}枚を保持｜失敗分だけ再準備します…` : `中断画像 ${ready.length}枚を復旧保存中…`);
    run.pending = null; setRun(run); optimizeUploadedImages(view, run);
    return ready.length;
  }

  async function insertThinImages() {
    if (busy || !enabled()) return false;
    const dataset = getDataset(), run = getRun();
    if (!dataset || !run || run.datasetId !== dataset.datasetId) {
      setStatus('先に対象を取得してください', true); return false;
    }
    if (run.cardKeys?.length && !dataset.preparedBatch) { setStatus('通知カードが残っています。先に「削」', true); return false; }
    let operation;
    setBusy(true);
    try {
      const view = findView();
      if (!view) throw new FatalError('編集画面の準備ができていません。本文を保持したまま少し待って再操作してください');
      operation = safety().begin('画像作成', view);
      if (dataset.preparedBatch) await page.__MUMEI_PREPARED_BATCH__?.sync?.(dataset, run);
      selectionApi();
      if (page.__MUMEI_CARD_CREATOR__) {
        await page.__MUMEI_CARD_CREATOR__.verifyRows(dataset.rows, (n, total) => setStatus(`投稿者名の照合 ${n}/${total}…`));
        setJSON(DATA_KEY, dataset);
        const oldRows = [], oldImages = [];
        for (const row of dataset.rows) {
          const hit = findImageByState(view, run.images?.[row.url], row.url);
          if (hit && remoteImage(hit.node) && hit.node.textContent !== row.caption) { oldRows.push(row); oldImages.push(hit); }
        }
        if (oldRows.length) await linkCreatedImages(view, oldRows, oldImages, run);
      }
      if (run.pending) await recoverPending(view, dataset, run);
      optimizeUploadedImages(view, run);
      const nativeCommand = dataset.preparedBatch ? preparedImageCommand() : null;
      let reusableInput = null;
      for (;;) {
      const completedNow = verifiedImageCount(view, dataset, run);
      const missing = missingRows(view, dataset, run);
      if (!missing.length) {
        verifyConfirmationImage(view, dataset, run);
        await saveOnce('極薄画像の保存状態を確認中…');
        setStatus(`極薄画像🔗 ${dataset.count}/${dataset.count} 完成済み ✅ 最後の実績の算数も確認済み`); return true;
      }
      const workRows = missing.slice(0, dataset.preparedBatch ? (nativeCommand ? 10 : 1) : IMAGE_CHUNK);
      setStatus(`極薄画像 ${workRows.length}枚を生成中…`);
      const files = await mapLimit(workRows, 4, async (row, index) => {
        if (safety().stopped()) throw new FatalError('画像準備を停止しました');
        const file = await makeThinFile(row);
        setStatus(`極薄生成 ${index + 1}/${workRows.length}（860×140）…`);
        return file;
      });
      safety().check(view);
      if (safety().stopped()) throw new FatalError('画像準備を停止しました');
      ensureEndSelection(view);
      const completion = new Promise((resolve, reject) => {
        imageArm = {
          dataset, run, view, workRows, files, resolve, reject, nativeCommand,
          consumed: false, nativeMenuReady: false, nativeImageChoice: null, menuProbeScheduled: false, imageChoiceSelected: false,
          beforeIds: new Set(imageNodes(view).map((hit) => String(hit.node.attrs?.id || '')).filter(Boolean)),
          beforeInputs: new Set(document.querySelectorAll('input[type="file"]'))
        };
      });
      installImageInputBridge();
      if (!nativeCommand) imageArm.timer = setTimeout(() => imageArm?.reject(new FatalError('画像選択待機が10分を超えました')), 600000);
      setStatus(`${workRows.length}枚 準備OK｜note本文の「＋」→「画像」を1回`);
      if (nativeCommand) { setStatus(`完成画像 ${completedNow + 1}〜${completedNow + workRows.length}/${dataset.count}を投入中…`); void injectImageInput(null); }
      else if (dataset.preparedBatch && reusableInput?.isConnected && imageInput(reusableInput)) void injectImageInput(reusableInput);
      await completion;
      reusableInput = imageArm?.nativeInput || null;
      cancelImageArm();
      if (safety().stopped()) { setStatus('画像投入と保存を終えて停止しました。自動再開はしません'); return false; }
      const left = missingRows(view, dataset, run).length;
      const completedAfter = dataset.count - left;
      if (left) setStatus(`極薄画像🔗 ${completedAfter}/${dataset.count} ✅ 残り${left}件 → 同じ画面のまま「追加＋カード続き」で続行`);
      else { verifyConfirmationImage(view, dataset, run); setStatus(`極薄画像🔗＋名前さん ${dataset.count}/${dataset.count} 完成 ✅ 最後の実績の算数も確認済み｜次は「送」`); }
      if (!dataset.preparedBatch || !left) break;
      await sleep(80);
      }
      return missingRows(view, dataset, run).length === 0;
    } catch (error) {
      page.__MUMEI_CARD_SAFETY__?.stop();
      const message = `画像追加停止 ${Object.keys(run.images || {}).length}/${dataset.count}｜${error?.message || String(error)}｜カード作成には進みません。自動再開なし`;
      setStatus(message, true); page.__MUMEI_CARD_SAFETY__?.status(message, true);
      return false;
    } finally {
      cancelImageArm();
      page.__MUMEI_CARD_SAFETY__?.end(operation);
      setBusy(false);
    }
  }

  async function sendCards() {
    if (busy || !enabled()) return;
    const dataset = getDataset(), run = getRun();
    if (!dataset || !run || run.datasetId !== dataset.datasetId) { setStatus('先に「抽」→「画」', true); return; }
    let operation;
    setBusy(true);
    try {
      const view = findView();
      if (!view) throw new FatalError('編集画面の準備ができていません。本文を保持したまま少し待って再操作してください');
      operation = safety().begin('通知カード作成', view);
      selectionApi(); noteUrlCommandFactory();
      const imageCount = verifiedImageCount(view, dataset, run);
      if (imageCount !== dataset.count) throw new FatalError(`極薄画像🔗不足 ${imageCount}/${dataset.count}。先に「画」`);
      const confirmRow = verifyConfirmationImage(view, dataset, run);
      const existingTracked = (run.cardKeys || []).filter((entry) => embedNodes(view).some((hit) => cardKey(hit) === entry.key));
      if (existingTracked.length) throw new FatalError(`今回の通知カードが${existingTracked.length}件残っています。先に「削」`);
      run.cardKeys = [];
      run.stage = 'cards_building'; setRun(run);
      for (let i = 0; i < dataset.rows.length; i += 1) {
        if (safety().stopped()) throw new FatalError('通知カード作成を停止しました。続きは「送」');
        const row = dataset.rows[i];
        const beforeKeys = new Set(embedNodes(view).map(cardKey).filter(Boolean));
        insertUrlAtEnd(view, row.url);
        setStatus(`本物通知カード ${i + 1}/${dataset.count} 生成中…`);
        const command = noteUrlCommandFactory()(row.url);
        const handled = command(view.state, (transaction) => { try { safety().dispatch(view, transaction, [insertedUrlNode]); } catch (e) { conversionError = e; } }, view);
        if (!handled) {
          deleteLastExactUrl(view, row.url);
          throw new FatalError(`${i + 1}/${dataset.count} note正規URLコマンド未処理`);
        }
        const hit = await waitForNewCard(view, row.url, beforeKeys);
        if (!hit) {
          deleteLastExactUrl(view, row.url);
          throw new FatalError(`${i + 1}/${dataset.count} 新規embカード確認タイムアウト`);
        }
        deleteLastExactUrl(view, row.url);
        run.cardKeys.push({ url: row.url, key: cardKey(hit) });
        setRun(run);
        setStatus(`本物通知カード ${i + 1}/${dataset.count} ✅`);
        if (i < dataset.rows.length - 1) await sleep(60);
      }
      if (new Set(run.cardKeys.map((x) => x.key)).size !== dataset.count) throw new FatalError(`embキー数不一致 ${run.cardKeys.length}/${dataset.count}`);
      const confirmCard = run.cardKeys.find((x) => normalizeUrl(x.url) === normalizeUrl(confirmRow.url));
      if (!confirmCard) throw new FatalError('確認用「実績の算数」の通知カードがありません');
      for (const entry of run.cardKeys) {
        if (!embedNodes(view).some((hit) => cardKey(hit) === entry.key && genuineCard(hit, entry.url))) {
          throw new FatalError(`通知カード再確認NG: ${entry.url}`);
        }
      }
      run.stage = 'cards_ready'; setRun(run);
      await saveOnce(`通知カード ${dataset.count}件を1回保存中…`);
      setStatus(`通知カード ${dataset.count}/${dataset.count} 完成・保存 ✅ 最後の実績の算数も極薄🔗＋カード確認済み`);
      page.alert(`準備完了\n\n極薄画像🔗: ${dataset.count}件\n本物通知カード: ${dataset.count}件\n確認用「実績の算数」: 最後の1件で極薄🔗＋カード確認済み\n\nそのまま「公開に進む」→公開/更新。\n通知後、編集へ戻って「削」を1回。`);
    } catch (error) {
      page.__MUMEI_CARD_SAFETY__?.stop();
      setStatus(`送信停止：${error?.message || String(error)}（公開しない。必要なら「削」）`, true);
    } finally { page.__MUMEI_CARD_SAFETY__?.end(operation); setBusy(false); }
  }

  async function deleteCardsOnly() {
    if (busy || !enabled()) return;
    const dataset = getDataset(), run = getRun();
    if (!run || !Array.isArray(run.cardKeys) || !run.cardKeys.length) {
      setStatus('今回生成した通知カード記録は0件です'); return;
    }
    let operation;
    setBusy(true);
    try {
      const view = findView();
      if (!view) throw new FatalError('編集画面の準備ができていません。本文を保持したまま少し待って再操作してください');
      operation = safety().begin('通知カード削除', view);
      const wanted = new Set(run.cardKeys.map((x) => x.key).filter(Boolean));
      const hits = embedNodes(view).filter((hit) => wanted.has(cardKey(hit)));
      const removed = deleteHits(view, hits);
      const remaining = embedNodes(view).filter((hit) => wanted.has(cardKey(hit)));
      if (remaining.length) throw new FatalError(`今回カード削除残り ${remaining.length}件`);
      await saveOnce(`今回の通知カード ${removed}件だけ一括削除・保存中…`);
      run.cardKeys = []; run.stage = 'cards_deleted'; setRun(run);
      const images = dataset && run.datasetId === dataset.datasetId ? verifiedImageCount(view, dataset, run) : Object.keys(run.images || {}).length;
      setStatus(`通知カード ${removed}件 一括削除 ✅ 極薄画像🔗 ${images}件は保持`);
      page.alert(`通知カードだけ一括削除完了\n\n削除: ${removed}件\n極薄画像🔗: 保持\n既存本文・既存カード: 変更なし\n\nそのまま「公開に進む」→更新。`);
    } catch (error) {
      page.__MUMEI_CARD_SAFETY__?.stop();
      setStatus(`削除停止：${error?.message || String(error)}（更新しない）`, true);
    } finally { page.__MUMEI_CARD_SAFETY__?.end(operation); setBusy(false); }
  }

  function installStyle() {
    if (document.getElementById(STYLE) || !document.head) return;
    const style = document.createElement('style');
    style.id = STYLE;
    style.textContent = `
      #${PANEL}{position:fixed;right:6px;top:39%;z-index:2147483647;width:166px;background:#0b1220;color:#fff;border:1px solid #334155;border-radius:12px;padding:8px;box-shadow:0 12px 34px rgba(0,0,0,.38);font-family:system-ui,-apple-system,sans-serif}
      #${PANEL} .title{font-size:11px;font-weight:900;margin-bottom:3px}#${PANEL} .src{font-size:9px;color:#94a3b8;margin-bottom:7px}
      #${PANEL} .row{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}#${PANEL} button{border:0;border-radius:8px;padding:8px 2px;color:#fff;font-size:12px;font-weight:900;background:#0f766e}
      #${PANEL} button:nth-child(2){background:#2563eb}#${PANEL} button:nth-child(3){background:#7c3aed}#${PANEL} button:nth-child(4){background:#b91c1c}#${PANEL} button:disabled{opacity:.45}
      #${STATUS}{font-size:9px;line-height:1.35;margin-top:7px;color:#d1fae5;word-break:break-word}#${STATUS}[data-bad="1"]{color:#fecaca}
      #mumei-new108-panel-v159,#mumei-oldflow-onecard-v158,#mumei-summer107-cardonly-v156,#mumei-summer107-mathcheck-v157{display:none!important}`;
    document.head.appendChild(style);
  }
  function mount() {
    if (!enabled() || !document.body) return;
    installStyle();
    if (document.getElementById(PANEL)) return;
    const panel = document.createElement('div');
    panel.id = PANEL;
    panel.innerHTML = `<div class="title">スキ返礼・極薄通知 v16.0</div><div class="src">n08825c632afd のスキした人</div><div class="row"><button data-a="extract">抽</button><button data-a="image">画</button><button data-a="send">送</button><button data-a="delete">削</button></div><div id="${STATUS}">「抽」でスキした人→最新記事を自動取得</div>`;
    panel.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-a]');
      if (!button || busy) return;
      if (button.dataset.a === 'extract') void extractTargets();
      if (button.dataset.a === 'image') void insertThinImages();
      if (button.dataset.a === 'send') void sendCards();
      if (button.dataset.a === 'delete') void deleteCardsOnly();
    });
    document.body.appendChild(panel);
    const dataset = getDataset(), run = getRun();
    if (dataset && run?.datasetId === dataset.datasetId) {
      const imageCount = Object.keys(run.images || {}).length;
      const cardCount = Array.isArray(run.cardKeys) ? run.cardKeys.length : 0;
      setStatus(`対象${dataset.count}件｜画像🔗記録${imageCount}｜通知カード記録${cardCount}`);
    }
  }

  setInterval(() => { try { const v = findView(); if (v) safety().capture(); } catch (_) {} }, 2000);
  page.__MUMEI_THIN_IMAGES__ = { run: insertThinImages };
  page.addEventListener('mumei-card-stop', () => { if (imageArm && !imageArm.consumed) imageArm.reject(new FatalError('画像選択待機を停止しました')); });
  installUploadNetworkProbe();
  // Safety invariant: this tool must never reload or navigate away from the editor automatically.
  // Unsaved article text and inserted images belong to the current editor session.
  setInterval(mount, 600);
  mount();
})();
