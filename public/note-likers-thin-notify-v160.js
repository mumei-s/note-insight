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
    await Promise.all(runners);
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
  function imageNodes(view) {
    const out = [];
    view.state.doc.descendants((node, pos) => { if (node.type?.name === 'image') out.push({ node, pos }); });
    return out;
  }
  function embedNodes(view) {
    const out = [];
    view.state.doc.descendants((node, pos) => { if (node.type?.name === 'embed') out.push({ node, pos }); });
    return out;
  }
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
    [...unique.values()].sort((a, b) => b.pos - a.pos).forEach((hit) => { tr = tr.delete(hit.pos, hit.pos + hit.node.nodeSize); });
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
  async function bitmap(blob) {
    if (typeof page.createImageBitmap === 'function') return page.createImageBitmap(blob);
    return new Promise((resolve, reject) => {
      const img = new page.Image(), objectUrl = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('画像読込失敗')); };
      img.src = objectUrl;
    });
  }
  async function makeThinFile(row) {
    let image = null;
    if (row.thumbUrl) {
      try { image = await bitmap(await xhr(row.thumbUrl, 'blob', 30000)); } catch (_) { image = null; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#d9dde3'; ctx.lineWidth = 1.5; roundedRect(ctx, 1, 1, W - 2, H - 2, 12); ctx.stroke();
    const tw = 320, th = 124, tx = 532, ty = 8, textX = 16, textWidth = 504;
    ctx.textBaseline = 'top'; ctx.fillStyle = '#171b21'; ctx.font = '700 18px system-ui,-apple-system,sans-serif';
    textLines(ctx, row.title, textWidth, 3).forEach((line, i) => ctx.fillText(line, textX, 12 + i * 24));
    ctx.fillStyle = '#626975'; ctx.font = '14px system-ui,-apple-system,sans-serif';
    ctx.fillText(fitText(ctx, row.creator, textWidth), textX, 110);
    ctx.fillStyle = '#f7f8fa'; roundedRect(ctx, tx, ty, tw, th, 8); ctx.fill();
    if (image) {
      const iw = image.width || image.naturalWidth || 1, ih = image.height || image.naturalHeight || 1;
      const scale = Math.min(tw / iw, th / ih), dw = iw * scale, dh = ih * scale;
      ctx.save(); roundedRect(ctx, tx, ty, tw, th, 8); ctx.clip();
      ctx.drawImage(image, tx + (tw - dw) / 2, ty + (th - dh) / 2, dw, dh); ctx.restore();
      if (typeof image.close === 'function') image.close();
    } else {
      ctx.fillStyle = '#6b7280'; ctx.font = '800 28px system-ui,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('note', tx + tw / 2, 48); ctx.textAlign = 'start';
    }
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('極薄カード生成失敗')), 'image/png', 1));
    return new page.File([blob], `${String(row.index).padStart(3, '0')}_thin.png`, { type: 'image/png' });
  }

  function findImageByState(view, record, url) {
    const wanted = normalizeUrl(url);
    const images = imageNodes(view);
    if (record?.id) {
      const byId = images.find((hit) => String(hit.node.attrs?.id || '') === String(record.id));
      if (byId) return byId;
    }
    if (record?.src) {
      const bySrc = images.find((hit) => String(hit.node.attrs?.src || '') === String(record.src) && normalizeUrl(hit.node.attrs?.link) === wanted);
      if (bySrc) return bySrc;
    }
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
  async function linkCreatedImages(view, workRows, created, run) {
    if (created.length !== workRows.length) throw new FatalError(`新規画像数不一致 ${created.length}/${workRows.length}`);
    const chunkSize = created.length > 40 ? 24 : created.length;
    for (let start = 0; start < created.length; start += chunkSize) {
      let tr = view.state.tr;
      const end = Math.min(start + chunkSize, created.length);
      for (let i = start; i < end; i += 1) {
        const hit = created[i], row = workRows[i];
        tr = tr.setNodeMarkup(hit.pos, hit.node.type, { ...hit.node.attrs, link: row.url }, hit.node.marks);
      }
      view.dispatch(tr);
      setStatus(`画像🔗付与 ${end}/${created.length}…`);
      if (end < created.length) await sleep(60);
    }
    const after = imageNodes(view);
    for (let i = 0; i < workRows.length; i += 1) {
      const row = workRows[i], createdId = String(created[i]?.node?.attrs?.id || '');
      const hit = (createdId ? after.find((entry) => String(entry.node.attrs?.id || '') === createdId) : null) ||
        after.find((entry) => normalizeUrl(entry.node.attrs?.link) === normalizeUrl(row.url) && remoteImage(entry.node));
      if (!hit || normalizeUrl(hit.node.attrs?.link) !== normalizeUrl(row.url)) throw new FatalError(`画像🔗確認NG: ${row.index}`);
      run.images[row.url] = { id: String(hit.node.attrs?.id || ''), src: String(hit.node.attrs?.src || '') };
    }
    run.pending = null;
    setRun(run);
  }
  async function waitNewRemoteImages(view, beforeIds, expected, timeout = 180000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const fresh = imageNodes(view).filter((hit) => {
        const id = String(hit.node.attrs?.id || '');
        return id && !beforeIds.has(id) && remoteImage(hit.node);
      }).sort((a, b) => a.pos - b.pos);
      if (fresh.length >= expected) return fresh.slice(0, expected);
      setStatus(`画像アップロード ${Math.min(fresh.length, expected)}/${expected}…`);
      await sleep(500);
    }
    return null;
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
    if (reason && arm?.reject) arm.reject(new FatalError(reason));
  }
  function installNativeInputInterceptor() {
    if (nativeInputClick) return;
    const prototype = page.HTMLInputElement?.prototype;
    if (!prototype) return;
    nativeInputClick = prototype.click;
    prototype.click = function interceptedImageClick(...args) {
      const arm = imageArm;
      if (arm && arm.imageChoiceSelected && imageInput(this)) {
        if (!arm.consumed) void injectImageInput(this);
        return;
      }
      return nativeInputClick.apply(this, args);
    };
  }
  async function injectImageInput(input) {
    const arm = imageArm;
    if (!arm || arm.consumed || !imageInput(input)) return false;
    arm.consumed = true;
    try {
      const transfer = new page.DataTransfer();
      arm.files.forEach((file) => transfer.items.add(file));
      arm.run.pending = { workUrls: arm.workRows.map((r) => r.url), beforeIds: [...arm.beforeIds], at: Date.now() };
      setRun(arm.run);
      input.files = transfer.files;
      input.dispatchEvent(new page.Event('input', { bubbles: true }));
      input.dispatchEvent(new page.Event('change', { bubbles: true }));
      setStatus(`${arm.files.length}枚を一括挿入・アップロード中…`);
      const created = await waitNewRemoteImages(arm.view, arm.beforeIds, arm.workRows.length, 900000);
      if (!created) throw new FatalError(`画像アップロード完了 ${arm.workRows.length}枚を確認できませんでした`);
      await linkCreatedImages(arm.view, arm.workRows, created, arm.run);
      await saveOnce(`極薄画像🔗 ${verifiedImageCount(arm.view, arm.dataset, arm.run)}/${arm.dataset.count} を保存中…`);
      arm.resolve(true);
    } catch (error) {
      arm.reject(error);
    } finally {
      try { input.files = new page.DataTransfer().files; input.value = ''; } catch (_) {}
      arm.files.length = 0;
    }
    return true;
  }
  function installImageInputBridge() {
    if (inputObserver || !document.documentElement) return;
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
      if (arm.imageChoiceSelected && directInput) {
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
        if (!markNativeImageMenuReady(roots)) scheduleNativeMenuProbe(roots);
        return;
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
  async function recoverPending(view, dataset, run) {
    const pending = run.pending;
    if (!pending?.workUrls?.length || !Array.isArray(pending.beforeIds)) return 0;
    const workRows = pending.workUrls.map((url) => dataset.rows.find((r) => r.url === url)).filter(Boolean);
    const before = new Set(pending.beforeIds.map(String));
    const fresh = imageNodes(view).filter((hit) => {
      const id = String(hit.node.attrs?.id || '');
      return id && !before.has(id) && remoteImage(hit.node) && !normalizeUrl(hit.node.attrs?.link);
    }).sort((a, b) => a.pos - b.pos).slice(0, workRows.length);
    if (!fresh.length) { run.pending = null; setRun(run); return 0; }
    const rows = workRows.slice(0, fresh.length);
    setStatus(`中断画像 ${fresh.length}枚を回収して🔗付与中…`);
    await linkCreatedImages(view, rows, fresh, run);
    await saveOnce(`中断画像 ${fresh.length}枚を復旧保存中…`);
    return fresh.length;
  }

  async function insertThinImages() {
    if (busy || !enabled()) return;
    const dataset = getDataset(), run = getRun();
    if (!dataset || !run || run.datasetId !== dataset.datasetId) {
      setStatus('先に「抽」で対象を取得してください', true); return;
    }
    if (run.cardKeys?.length) { setStatus('通知カードが残っています。先に「削」', true); return; }
    setBusy(true);
    try {
      const view = findView();
      if (!view) throw new FatalError('EditorViewなし。画面を再読込してください');
      selectionApi();
      if (run.pending) await recoverPending(view, dataset, run);
      const missing = missingRows(view, dataset, run);
      if (!missing.length) {
        setStatus(`極薄画像🔗 ${dataset.count}/${dataset.count} 完成済み ✅ 次は「送」`); return;
      }
      const workRows = missing.slice(0, IMAGE_CHUNK);
      setStatus(`極薄画像 ${workRows.length}枚を生成中…`);
      const files = await mapLimit(workRows, 4, async (row, index) => {
        const file = await makeThinFile(row);
        setStatus(`極薄生成 ${index + 1}/${workRows.length}（860×140）…`);
        return file;
      });
      ensureEndSelection(view);
      const completion = new Promise((resolve, reject) => {
        imageArm = {
          dataset, run, view, workRows, files, resolve, reject,
          consumed: false, nativeMenuReady: false, nativeImageChoice: null, menuProbeScheduled: false, imageChoiceSelected: false,
          beforeIds: new Set(imageNodes(view).map((hit) => String(hit.node.attrs?.id || '')).filter(Boolean)),
          beforeInputs: new Set(document.querySelectorAll('input[type="file"]'))
        };
      });
      installImageInputBridge();
      imageArm.timer = setTimeout(() => imageArm?.reject(new FatalError('画像選択待機が10分を超えました')), 600000);
      setStatus(`${workRows.length}枚 準備OK｜note本文の「＋」→「画像」を1回`);
      await completion;
      const left = missingRows(view, dataset, run).length;
      if (left) setStatus(`極薄画像🔗 ${dataset.count - left}/${dataset.count} ✅ 残り${left}件 → もう一度「画」`);
      else setStatus(`極薄画像🔗 ${dataset.count}/${dataset.count} 完成 ✅ 次は「送」`);
    } catch (error) {
      setStatus(`画像停止：${error?.message || String(error)}（「画」で再開）`, true);
    } finally {
      cancelImageArm();
      setBusy(false);
    }
  }

  async function sendCards() {
    if (busy || !enabled()) return;
    const dataset = getDataset(), run = getRun();
    if (!dataset || !run || run.datasetId !== dataset.datasetId) { setStatus('先に「抽」→「画」', true); return; }
    setBusy(true);
    try {
      const view = findView();
      if (!view) throw new FatalError('EditorViewなし。画面を再読込してください');
      selectionApi(); noteUrlCommandFactory();
      const imageCount = verifiedImageCount(view, dataset, run);
      if (imageCount !== dataset.count) throw new FatalError(`極薄画像🔗不足 ${imageCount}/${dataset.count}。先に「画」`);
      const existingTracked = (run.cardKeys || []).filter((entry) => embedNodes(view).some((hit) => cardKey(hit) === entry.key));
      if (existingTracked.length) throw new FatalError(`今回の通知カードが${existingTracked.length}件残っています。先に「削」`);
      run.cardKeys = [];
      run.stage = 'cards_building'; setRun(run);
      for (let i = 0; i < dataset.rows.length; i += 1) {
        const row = dataset.rows[i];
        const beforeKeys = new Set(embedNodes(view).map(cardKey).filter(Boolean));
        insertUrlAtEnd(view, row.url);
        setStatus(`本物通知カード ${i + 1}/${dataset.count} 生成中…`);
        const command = noteUrlCommandFactory()(row.url);
        const handled = command(view.state, (transaction) => view.dispatch(transaction), view);
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
        if (i < dataset.rows.length - 1) await sleep(900);
      }
      if (new Set(run.cardKeys.map((x) => x.key)).size !== dataset.count) throw new FatalError(`embキー数不一致 ${run.cardKeys.length}/${dataset.count}`);
      for (const entry of run.cardKeys) {
        if (!embedNodes(view).some((hit) => cardKey(hit) === entry.key && genuineCard(hit, entry.url))) {
          throw new FatalError(`通知カード再確認NG: ${entry.url}`);
        }
      }
      run.stage = 'cards_ready'; setRun(run);
      await saveOnce(`通知カード ${dataset.count}件を1回保存中…`);
      setStatus(`通知カード ${dataset.count}/${dataset.count} 完成・保存 ✅ このまま公開/更新`);
      page.alert(`準備完了\n\n極薄画像🔗: ${dataset.count}件\n本物通知カード: ${dataset.count}件\n\nそのまま「公開に進む」→公開/更新。\n通知後、編集へ戻って「削」を1回。`);
    } catch (error) {
      setStatus(`送信停止：${error?.message || String(error)}（公開しない。必要なら「削」）`, true);
    } finally { setBusy(false); }
  }

  async function deleteCardsOnly() {
    if (busy || !enabled()) return;
    const dataset = getDataset(), run = getRun();
    if (!run || !Array.isArray(run.cardKeys) || !run.cardKeys.length) {
      setStatus('今回生成した通知カード記録は0件です'); return;
    }
    setBusy(true);
    try {
      const view = findView();
      if (!view) throw new FatalError('EditorViewなし。画面を再読込してください');
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
      setStatus(`削除停止：${error?.message || String(error)}（更新しない）`, true);
    } finally { setBusy(false); }
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

  setInterval(mount, 600);
  mount();
})();
