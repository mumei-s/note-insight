// ==UserScript==
// @name         無名S note 表彰式→極薄＋通知 1.1
// @namespace    https://github.com/mumei-s/note-insight/award-thin-copy
// @version      1.1.0
// @description  指定note表彰記事から「賞名・順位／クリエイター名／記事URL」を順序保持で抽出。860x140極薄リンク＋note本物通知カードを生成し、通知後は今回カードだけ一括削除
// @match        https://note.com/*/n/*
// @match        https://editor.note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-award-thin-copy.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-award-thin-copy.user.js
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      note.com
// @connect      assets.st-note.com
// ==/UserScript==

(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_AWARD_THIN_COPY_110__) return;
  page.__MUMEI_AWARD_THIN_COPY_110__ = true;

  const VERSION = '1.1.0';
  const SOURCE_KEY = 'nde66a065c21c';
  const SOURCE_URL = `https://note.com/sekaiayumu25/n/${SOURCE_KEY}`;
  const DATA_KEY = 'mumei_award_thin_dataset_v100';
  const RUN_PREFIX = 'mumei_award_thin_run_v100';
  const PANEL = 'mumei-award-thin-panel-v110';
  const STATUS = 'mumei-award-thin-status-v110';
  const W = 860;
  const H = 140;

  let busy = false;
  let viewCache = null;
  let selectionCache = null;
  let noteUrlCommand = null;
  let imageArm = null;
  let inputObserver = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  class FatalError extends Error {}

  function articleKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }
  function editing() {
    return /^\/notes\/n[a-z0-9]{8,}\/edit\/?$/i.test(location.pathname);
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
  function getDataset() {
    const value = getJSON(DATA_KEY, null);
    return value?.sourceKey === SOURCE_KEY && Array.isArray(value.rows) ? value : null;
  }
  function getRun() {
    const value = getJSON(runKey(), null);
    return value && value.articleKey === articleKey() ? value : null;
  }
  function setRun(value) { setJSON(runKey(), value); }
  function ensureRun() {
    return getRun() || { version: VERSION, articleKey: articleKey(), cardKeys: [], imagesReady: false, createdAt: new Date().toISOString() };
  }
  function setStatus(text, bad = false) {
    const el = document.getElementById(STATUS);
    if (!el) return;
    el.textContent = text;
    el.dataset.bad = bad ? '1' : '0';
  }
  function setBusy(value) {
    busy = value;
    const panel = document.getElementById(PANEL);
    if (panel) panel.querySelectorAll('button').forEach((b) => { b.disabled = busy; });
  }
  function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const u = new URL(raw, 'https://note.com/');
      u.search = ''; u.hash = '';
      return u.href;
    } catch (_) { return raw; }
  }
  function isOwnSource(key) { return String(key || '').toLowerCase() === SOURCE_KEY.toLowerCase(); }

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
    const text = await xhr(url, 'text');
    try { return JSON.parse(String(text || '')); }
    catch (_) { throw new Error(`JSON解析失敗: ${url}`); }
  }
  async function mapLimit(values, limit, worker) {
    const output = new Array(values.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, values.length || 1) }, async () => {
      while (cursor < values.length) {
        const i = cursor++;
        output[i] = await worker(values[i], i);
      }
    });
    await Promise.all(runners);
    return output;
  }

  function sourceBody(payload) {
    const d = payload?.data || payload || {};
    const candidates = [d.body, d.note?.body, d.noteBody, d.body_html, d.note_draft?.body, d.noteDraft?.body];
    return candidates.find((v) => typeof v === 'string' && v.trim()) || '';
  }
  function exactText(el) {
    return String(el?.textContent || '').replace(/[\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }
  function candidateKeys(el) {
    const set = new Set();
    const values = [];
    if (el?.getAttributeNames) {
      for (const name of el.getAttributeNames()) values.push(el.getAttribute(name));
    }
    values.push(el?.outerHTML || '', el?.textContent || '');
    for (const value of values) {
      const s = String(value || '');
      const re = /(?:https?:\/\/note\.com\/[^\s"'<>]+\/n\/|\/[^\s"'<>]+\/n\/|\/notes\/)(n[a-f0-9]{12})/ig;
      let m;
      while ((m = re.exec(s))) if (!isOwnSource(m[1])) set.add(m[1]);
    }
    return [...set];
  }
  function parseAwardBody(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const rows = [];
    let award = '';
    let current = null;
    const ordered = [...doc.body.querySelectorAll('h2,h3,a,iframe,[data-url],[data-href],[data-note-key],figure')];
    const seenElements = new Set();

    for (const el of ordered) {
      if (!el || seenElements.has(el)) continue;
      seenElements.add(el);
      const tag = String(el.tagName || '').toUpperCase();
      if (tag === 'H2') {
        const text = exactText(el);
        if (text && (text.includes('🏆') || text.includes('賞') || /(?:第?\s*\d+\s*位|\d+位)/.test(text))) award = text;
        current = null;
        continue;
      }
      if (tag === 'H3') {
        const creator = exactText(el);
        if (!award || !creator) { current = null; continue; }
        current = { award, creator, keys: [], sourceOrder: rows.length };
        candidateKeys(el.closest('a') || el).forEach((k) => current.keys.push(k));
        rows.push(current);
        continue;
      }
      if (!current) continue;
      for (const key of candidateKeys(el)) if (!current.keys.includes(key)) current.keys.push(key);
    }

    const headings = [...doc.body.querySelectorAll('h3')];
    for (const h3 of headings) {
      const creator = exactText(h3);
      const row = rows.find((r) => r.creator === creator && r.keys.length === 0);
      if (!row) continue;
      let n = h3.nextElementSibling;
      let guard = 0;
      while (n && guard++ < 20 && !/^H[23]$/i.test(n.tagName || '')) {
        for (const key of candidateKeys(n)) if (!row.keys.includes(key)) row.keys.push(key);
        n = n.nextElementSibling;
      }
    }
    return rows;
  }

  async function articleMeta(key) {
    try {
      const payload = await xhrJSON(`https://note.com/api/v3/notes/${key}`);
      const d = payload?.data || payload || {};
      const user = d.user || d.note?.user || {};
      const urlname = String(user.urlname || user.url_name || '').trim();
      const canonical = normalizeUrl(d.noteUrl || d.note_url || d.url || (urlname ? `https://note.com/${urlname}/n/${key}` : ''));
      const title = String(d.name || d.title || d.note?.name || d.note?.title || 'note記事').trim();
      let thumbUrl = String(d.eyecatch_url || d.eyecatch || d.image_url || d.note?.eyecatch_url || user.profileImageUrl || user.profile_image_url || '').trim();
      if (thumbUrl.startsWith('//')) thumbUrl = `https:${thumbUrl}`;
      const creatorName = String(user.nickname || user.name || user.display_name || '').trim();
      return { key, canonical, title, thumbUrl, urlname, creatorName };
    } catch (_) { return { key, canonical: '', title: 'note記事', thumbUrl: '', urlname: '', creatorName: '' }; }
  }

  function normalizeCreatorName(value) {
    return String(value || '')
      .replace(/^[\s　]*(?:[①-⑳㉑-㊿]|\(\d+\)|\d+[.)．、])+/g, '')
      .replace(/[\s　]+/g, '')
      .replace(/さん(?:★.*)?$/u, '')
      .replace(/[♡♥💗🌷♪]+/g, '')
      .toLowerCase();
  }

  async function extractSource() {
    if (busy) return;
    setBusy(true);
    try {
      setStatus('表彰記事の本文HTMLを取得中…');
      const payload = await xhrJSON(`https://note.com/api/v3/notes/${SOURCE_KEY}`);
      const body = sourceBody(payload);
      if (!body) throw new FatalError('元記事の本文HTMLを取得できませんでした');
      const rawRows = parseAwardBody(body);
      if (!rawRows.length) throw new FatalError('賞名／クリエイター構造を検出できませんでした');

      const globalKeys = candidateKeys(new DOMParser().parseFromString(body, 'text/html').body);
      const allKeys = [...new Set([...rawRows.flatMap((r) => r.keys), ...globalKeys].filter(Boolean))];
      setStatus(`見出し ${rawRows.length}件 / URL候補 ${allKeys.length}件。記事情報を照合中…`);
      const metas = await mapLimit(allKeys, 5, (key) => articleMeta(key));
      const metaMap = new Map(metas.map((m) => [m.key, m]));
      const rows = [];
      const used = new Set();

      for (const raw of rawRows) {
        const creatorNorm = normalizeCreatorName(raw.creator);
        const byContext = raw.keys.find((k) => !used.has(k) && metaMap.get(k)?.canonical) || raw.keys.find((k) => metaMap.get(k)?.canonical) || '';
        const byName = metas.find((m) => !used.has(m.key) && m.canonical && creatorNorm && normalizeCreatorName(m.creatorName) === creatorNorm)?.key || '';
        const key = byContext || byName;
        const meta = key ? metaMap.get(key) : null;
        if (key) used.add(key);
        rows.push({ index: rows.length + 1, award: raw.award, creator: raw.creator, key, url: meta?.canonical || '', title: meta?.title || '記事URL未検出', thumbUrl: meta?.thumbUrl || '' });
      }

      const linked = rows.filter((r) => r.url);
      const missing = rows.filter((r) => !r.url);
      const dataset = { version: VERSION, sourceKey: SOURCE_KEY, sourceUrl: SOURCE_URL, extractedAt: new Date().toISOString(), count: rows.length, linkedCount: linked.length, missingCount: missing.length, rows };
      setJSON(DATA_KEY, dataset);
      const oldRun = getRun();
      setRun({ version: VERSION, articleKey: articleKey(), cardKeys: oldRun?.cardKeys || [], imagesReady: oldRun?.imagesReady || false, extractedAt: new Date().toISOString() });
      setStatus(`抽出 ${rows.length}名 / 記事URL ${linked.length}件 / URL未検出 ${missing.length}件 ✅`, missing.length > 0);
      page.alert(`表彰式の抜き取り完了\n\n受賞者見出し: ${rows.length}名\n記事URL取得: ${linked.length}件\nURL未検出: ${missing.length}件\n\n編集画面で「画」→「送」。\n「送」でnote本物の標準カードを作ります。`);
    } catch (error) {
      setStatus(`抽出停止：${error?.message || String(error)}`, true);
    } finally { setBusy(false); }
  }

  function editor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') || document.querySelector('.ProseMirror');
  }
  function looksLikeView(value) {
    try { return Boolean(value && typeof value === 'object' && value.state?.doc && value.state?.schema && typeof value.dispatch === 'function' && value.dom); }
    catch (_) { return false; }
  }
  function findView() {
    if (looksLikeView(viewCache) && viewCache.dom?.isConnected) return viewCache;
    const root = editor();
    if (!root) return null;
    const seen = new Set();
    const queue = [];
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
        if (depth < 7 && next && (typeof next === 'object' || typeof next === 'function') && next !== page && next !== document) queue.push([next, depth + 1]);
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
      return source.includes('state.selection') && source.includes('nodeBefore') && source.includes('replaceRangeWith') && source.includes('.then');
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
    return /^https?:\/\//i.test(src) && !src.startsWith('blob:') && !src.startsWith('data:');
  }
  function linkedImageCount(view, rows) {
    const links = new Set(imageNodes(view).filter((hit) => remoteImage(hit.node)).map((hit) => normalizeUrl(hit.node.attrs?.link)).filter(Boolean));
    return rows.filter((r) => links.has(normalizeUrl(r.url))).length;
  }
  async function waitFreshImages(view, beforeIds, expected, timeout = 120000) {
    const start = Date.now();
    const before = new Set([...beforeIds].map(String));
    while (Date.now() - start < timeout) {
      const fresh = imageNodes(view).filter((hit) => {
        const id = String(hit.node.attrs?.id || '');
        return remoteImage(hit.node) && (!id || !before.has(id));
      }).sort((a, b) => a.pos - b.pos);
      if (fresh.length >= expected) return fresh.slice(-expected);
      setStatus(`画像アップロード ${Math.min(fresh.length, expected)}/${expected}…`);
      await sleep(500);
    }
    throw new FatalError(`画像アップロード待機がタイムアウトしました (${expected}枚)`);
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

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function textLines(ctx, text, maxWidth, maxLines) {
    const chars = [...String(text || '')];
    const lines = []; let line = '';
    for (const ch of chars) {
      const next = line + ch;
      if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = ch; if (lines.length >= maxLines) break; }
      else line = next;
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length === maxLines && chars.join('').length > lines.join('').length) {
      let last = lines[maxLines - 1];
      while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
    return lines;
  }
  async function bitmap(blob) {
    if (typeof page.createImageBitmap === 'function') return page.createImageBitmap(blob);
    return new Promise((resolve, reject) => {
      const img = new page.Image(); const objectUrl = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('画像読込失敗')); };
      img.src = objectUrl;
    });
  }
  async function makeThinFile(row, serial) {
    let image = null;
    if (row.thumbUrl) {
      try { image = await bitmap(await xhr(row.thumbUrl, 'blob', 30000)); } catch (_) { image = null; }
    }
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#d9dde3'; ctx.lineWidth = 1.5; roundedRect(ctx, 1, 1, W - 2, H - 2, 12); ctx.stroke();
    const tx = 620, ty = 8, tw = 232, th = 124;
    ctx.textBaseline = 'top'; ctx.fillStyle = '#171b21'; ctx.font = '700 19px system-ui,-apple-system,sans-serif';
    textLines(ctx, row.title, 580, 3).forEach((line, i) => ctx.fillText(line, 18, 14 + i * 25));
    ctx.fillStyle = '#69717d'; ctx.font = '600 14px system-ui,-apple-system,sans-serif';
    ctx.fillText(`🔗 ${row.creator.replace(/^\S+\s*/, '') || row.creator}`, 18, 99);
    ctx.fillStyle = '#8a929e'; ctx.font = '500 12px system-ui,-apple-system,sans-serif';
    ctx.fillText('タップで受賞記事を開く', 18, 120);
    if (image) {
      const iw = image.width || 1, ih = image.height || 1, scale = Math.max(tw / iw, th / ih);
      const sw = tw / scale, sh = th / scale, sx = Math.max(0, (iw - sw) / 2), sy = Math.max(0, (ih - sh) / 2);
      ctx.save(); roundedRect(ctx, tx, ty, tw, th, 10); ctx.clip(); ctx.drawImage(image, sx, sy, sw, sh, tx, ty, tw, th); ctx.restore();
      if (typeof image.close === 'function') image.close();
    } else {
      ctx.fillStyle = '#f3f4f6'; roundedRect(ctx, tx, ty, tw, th, 10); ctx.fill();
      ctx.fillStyle = '#6b7280'; ctx.font = '800 28px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('note', tx + tw / 2, 50); ctx.textAlign = 'start';
    }
    const blob = await new Promise((resolve, reject) => canvas.toBlob((v) => v ? resolve(v) : reject(new Error('極薄画像生成失敗')), 'image/png', 0.95));
    return new page.File([blob], `${String(serial).padStart(3, '0')}_award_thin.png`, { type: 'image/png' });
  }

  function headingNode(schema, level, text) {
    const heading = schema.nodes.heading;
    const paragraph = schema.nodes.paragraph;
    const t = schema.text(String(text || ''));
    if (heading) {
      try { return heading.create({ level }, t); } catch (_) { try { return heading.create(null, t); } catch (_) {} }
    }
    if (!paragraph) throw new FatalError('note見出しノードを作れません');
    return paragraph.create(null, t);
  }
  function paragraphNode(schema, text = '') {
    const p = schema.nodes.paragraph;
    if (!p) throw new FatalError('note段落ノードを作れません');
    return text ? p.create(null, schema.text(text)) : p.create();
  }
  function structureLinkedImages(view, linkedRows, fresh) {
    if (fresh.length !== linkedRows.length) throw new FatalError(`画像数不一致: ${fresh.length}/${linkedRows.length}`);
    const schema = view.state.schema;
    const linkedNodes = fresh.map((hit, i) => hit.node.type.create({ ...hit.node.attrs, link: linkedRows[i].url }, hit.node.content, hit.node.marks));
    let tr = view.state.tr;
    for (let i = fresh.length - 1; i >= 0; i -= 1) tr = tr.delete(fresh[i].pos, fresh[i].pos + fresh[i].node.nodeSize);
    const blocks = [];
    let lastAward = null;
    linkedRows.forEach((row, i) => {
      if (row.award !== lastAward) { blocks.push(headingNode(schema, 2, row.award)); lastAward = row.award; }
      blocks.push(headingNode(schema, 3, row.creator));
      blocks.push(linkedNodes[i]);
    });
    blocks.push(paragraphNode(schema));
    tr = tr.insert(tr.doc.content.size, blocks);
    view.dispatch(tr.scrollIntoView());
  }

  function imageInput(input) {
    if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return false;
    const accept = String(input.accept || '').toLowerCase();
    return !accept || accept.includes('image') || accept.includes('.png') || accept.includes('.jpg') || accept.includes('.jpeg') || accept.includes('.webp');
  }
  async function injectImageInput(input) {
    const arm = imageArm;
    if (!arm || arm.consumed || !imageInput(input)) return false;
    arm.consumed = true;
    try {
      const transfer = new page.DataTransfer();
      arm.files.forEach((file) => transfer.items.add(file));
      input.files = transfer.files;
      input.dispatchEvent(new page.Event('input', { bubbles: true }));
      input.dispatchEvent(new page.Event('change', { bubbles: true }));
      setStatus(`${arm.files.length}枚を一括アップロード中…`);
      const fresh = await waitFreshImages(arm.view, arm.beforeIds, arm.files.length);
      setStatus('画像へ記事URLを付与し、賞名・順位・名前の順へ整列中…');
      structureLinkedImages(arm.view, arm.rows, fresh);
      const run = ensureRun();
      run.version = VERSION; run.imagesReady = true; run.imageCount = arm.rows.length; run.finishedAt = new Date().toISOString();
      run.cardKeys = Array.isArray(run.cardKeys) ? run.cardKeys : [];
      setRun(run);
      setStatus(`極薄 ${arm.rows.length}件完成 ✅ 次は「送」で本物通知カード`);
      page.alert(`極薄貼り付け完了\n\n${arm.rows.length}件を元記事と同じ賞名・順位／クリエイター名の順で追加しました。\n\n次は「送」。\nnote本物の標準カードを全件生成します。`);
      arm.resolve(true);
    } catch (error) {
      setStatus(`貼付停止：${error?.message || String(error)}`, true);
      arm.reject(error);
    } finally {
      try { input.files = new page.DataTransfer().files; input.value = ''; } catch (_) {}
      arm.files.length = 0; imageArm = null;
    }
    return true;
  }
  function installImageInputBridge() {
    if (inputObserver) return;
    const scan = (root) => {
      if (root?.nodeType === 1 && root.matches?.('input[type="file"]')) injectImageInput(root);
      root?.querySelectorAll?.('input[type="file"]').forEach((input) => injectImageInput(input));
    };
    inputObserver = new MutationObserver((records) => {
      if (!imageArm) return;
      for (const rec of records) for (const node of rec.addedNodes) scan(node);
    });
    inputObserver.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('click', () => {
      if (!imageArm) return;
      setTimeout(() => document.querySelectorAll('input[type="file"]').forEach((input) => injectImageInput(input)), 30);
    }, true);
  }

  async function armImages() {
    if (busy || !editing()) return;
    const dataset = getDataset();
    if (!dataset) { setStatus('先に「抽」で表彰記事を抜き取ってください', true); return; }
    const rows = dataset.rows.filter((r) => r.url);
    if (!rows.length) { setStatus('記事URL取得済みの受賞者が0件です', true); return; }
    const view = findView();
    if (!view) { setStatus('note編集本文がまだ読み込まれていません', true); return; }
    const run = ensureRun();
    if ((run.cardKeys || []).some((entry) => embedNodes(view).some((hit) => cardKey(hit) === entry.key))) {
      setStatus('今回の通知カードが残っています。先に「削」', true); return;
    }
    setBusy(true);
    try {
      const files = [];
      for (let i = 0; i < rows.length; i += 1) {
        setStatus(`極薄画像生成 ${i + 1}/${rows.length}…`);
        files.push(await makeThinFile(rows[i], i + 1));
      }
      const beforeIds = new Set(imageNodes(view).map((hit) => String(hit.node.attrs?.id || '')).filter(Boolean));
      installImageInputBridge();
      await new Promise((resolve, reject) => {
        imageArm = { files, rows, view, beforeIds, consumed: false, resolve, reject };
        setStatus(`準備完了 ${rows.length}件 ✅ noteの「＋」→「画像」を1回`);
      });
    } catch (error) {
      setStatus(`準備停止：${error?.message || String(error)}`, true);
      imageArm = null;
    } finally { setBusy(false); }
  }

  async function sendCards() {
    if (busy || !editing()) return;
    const dataset = getDataset();
    if (!dataset) { setStatus('先に「抽」→「画」', true); return; }
    const rows = dataset.rows.filter((r) => r.url);
    const run = ensureRun();
    setBusy(true);
    try {
      const view = findView();
      if (!view) throw new FatalError('EditorViewなし。画面を再読み込みしてください');
      selectionApi(); noteUrlCommandFactory();
      const imageCount = linkedImageCount(view, rows);
      if (imageCount !== rows.length) throw new FatalError(`極薄画像🔗不足 ${imageCount}/${rows.length}。先に「画」`);
      const existingTracked = (run.cardKeys || []).filter((entry) => embedNodes(view).some((hit) => cardKey(hit) === entry.key));
      if (existingTracked.length) throw new FatalError(`今回の通知カードが${existingTracked.length}件残っています。先に「削」`);
      run.cardKeys = [];
      run.stage = 'cards_building'; setRun(run);
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const beforeKeys = new Set(embedNodes(view).map(cardKey).filter(Boolean));
        insertUrlAtEnd(view, row.url);
        setStatus(`本物通知カード ${i + 1}/${rows.length} 生成中…`);
        const command = noteUrlCommandFactory()(row.url);
        const handled = command(view.state, (transaction) => view.dispatch(transaction), view);
        if (!handled) {
          deleteLastExactUrl(view, row.url);
          throw new FatalError(`${i + 1}/${rows.length} note正規URLコマンド未処理`);
        }
        const hit = await waitForNewCard(view, row.url, beforeKeys);
        if (!hit) {
          deleteLastExactUrl(view, row.url);
          throw new FatalError(`${i + 1}/${rows.length} 新規embカード確認タイムアウト`);
        }
        deleteLastExactUrl(view, row.url);
        run.cardKeys.push({ url: row.url, key: cardKey(hit) });
        setRun(run);
        setStatus(`本物通知カード ${i + 1}/${rows.length} ✅`);
        if (i < rows.length - 1) await sleep(900);
      }
      if (new Set(run.cardKeys.map((x) => x.key)).size !== rows.length) throw new FatalError(`embキー数不一致 ${run.cardKeys.length}/${rows.length}`);
      for (const entry of run.cardKeys) {
        if (!embedNodes(view).some((hit) => cardKey(hit) === entry.key && genuineCard(hit, entry.url))) throw new FatalError(`通知カード再確認NG: ${entry.url}`);
      }
      run.stage = 'cards_ready'; setRun(run);
      await saveOnce(`通知カード ${rows.length}件を保存中…`);
      setStatus(`標準通知カード ${rows.length}/${rows.length} 完成・保存 ✅ 公開/更新へ`);
      page.alert(`通知準備完了\n\n極薄リンク: ${rows.length}件\nnote本物の標準カード: ${rows.length}件\n\nこの状態で「公開に進む」→公開/更新。\n通知後、編集へ戻って「削」を1回。\n「削」は今回生成した標準カードだけを消します。`);
    } catch (error) {
      setStatus(`送停止：${error?.message || String(error)}（公開しない。必要なら「削」）`, true);
    } finally { setBusy(false); }
  }

  async function deleteCardsOnly() {
    if (busy || !editing()) return;
    const run = getRun();
    if (!run || !Array.isArray(run.cardKeys) || !run.cardKeys.length) { setStatus('今回生成した通知カード記録は0件です'); return; }
    setBusy(true);
    try {
      const view = findView();
      if (!view) throw new FatalError('EditorViewなし。画面を再読み込みしてください');
      const wanted = new Set(run.cardKeys.map((x) => x.key).filter(Boolean));
      const hits = embedNodes(view).filter((hit) => wanted.has(cardKey(hit)));
      const removed = deleteHits(view, hits);
      const remaining = embedNodes(view).filter((hit) => wanted.has(cardKey(hit)));
      if (remaining.length) throw new FatalError(`今回カード削除残り ${remaining.length}件`);
      await saveOnce(`今回の通知カード ${removed}件だけ一括削除・保存中…`);
      run.cardKeys = []; run.stage = 'cards_deleted'; setRun(run);
      setStatus(`通知カード ${removed}件だけ削除 ✅ 賞名・名前・極薄リンクは保持`);
      page.alert(`通知カードだけ一括削除完了\n\n削除: ${removed}件\n保持: 賞名・順位／クリエイター名／極薄リンク画像\n既存本文・既存カード: 変更なし\n\nそのまま再度公開/更新してください。`);
    } catch (error) {
      setStatus(`削除停止：${error?.message || String(error)}（更新しない）`, true);
    } finally { setBusy(false); }
  }

  function reset() {
    if (imageArm) { setStatus('画像投入待ち中はリセットできません', true); return; }
    const run = getRun();
    if (run?.cardKeys?.length) { setStatus('通知カード記録が残っています。先に「削」', true); return; }
    setJSON(DATA_KEY, null); setJSON(runKey(), null);
    setStatus('抽出データをリセットしました');
  }

  function mount() {
    if (document.getElementById(PANEL)) return;
    const style = document.createElement('style');
    style.textContent = `#${PANEL}{position:fixed;right:10px;bottom:76px;z-index:2147483646;background:#111827;color:#fff;border:1px solid #374151;border-radius:14px;padding:10px;width:min(350px,calc(100vw - 20px));box-shadow:0 8px 30px #0005;font:13px/1.4 system-ui,-apple-system,sans-serif}#${PANEL} .ttl{font-weight:800;margin-bottom:7px}#${PANEL} .row{display:flex;gap:6px;flex-wrap:wrap}#${PANEL} button{border:0;border-radius:9px;padding:8px 11px;background:#fff;color:#111827;font-weight:800}#${PANEL} button[data-a="send"]{background:#7c3aed;color:#fff}#${PANEL} button[data-a="delete"]{background:#b91c1c;color:#fff}#${PANEL} button:disabled{opacity:.45}#${STATUS}{margin-top:7px;color:#d1fae5;white-space:pre-wrap;word-break:break-word}#${STATUS}[data-bad="1"]{color:#fecaca}`;
    document.head.appendChild(style);
    const box = document.createElement('div'); box.id = PANEL;
    box.innerHTML = `<div class="ttl">🏆 表彰式→極薄＋通知 v${VERSION}</div><div class="row"><button data-a="extract">抽</button>${editing() ? '<button data-a="images">画</button><button data-a="send">送</button><button data-a="delete">削</button>' : ''}<button data-a="reset">初</button></div><div id="${STATUS}">元記事固定：キザ笑い選手権大会（夏）</div>`;
    box.addEventListener('click', (e) => {
      const action = e.target?.dataset?.a;
      if (action === 'extract') extractSource();
      else if (action === 'images') armImages();
      else if (action === 'send') sendCards();
      else if (action === 'delete') deleteCardsOnly();
      else if (action === 'reset') reset();
    });
    document.body.appendChild(box);
    const dataset = getDataset();
    const run = getRun();
    if (dataset && editing()) setStatus(`対象${dataset.linkedCount ?? dataset.rows.filter((r) => r.url).length}件｜通知カード記録${run?.cardKeys?.length || 0}`);
  }

  function boot() {
    if (!document.body) { setTimeout(boot, 100); return; }
    mount();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
