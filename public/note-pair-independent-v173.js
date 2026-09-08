(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_NOTE_PAIR_INDEPENDENT_173__) return;
  page.__MUMEI_NOTE_PAIR_INDEPENDENT_173__ = true;

  const VERSION = '17.3.0';
  const BASE_VERSION = '16.0.0';
  const PANEL_ID = 'mumei-note-source-picker-v163';
  const STATUS_ID = 'mumei-note-source-status-v163';
  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const CONTROL_PREFIX = 'mumei_note_source_control_v163';
  const STYLE_ID = 'mumei-note-pair-independent-v173-style';
  const CHUNK_ROWS = 40;
  const CARD_W = 430;
  const CARD_H = 184;
  const INNER_GAP = 16;
  const IMAGE_CHOICE_SELECTOR = 'button,[role="button"],label,[role="menuitem"],li';

  let busy = false;
  let viewCache = null;
  let selectionCache = null;
  let arm = null;
  let observer = null;
  let clickListener = null;
  let pointerListener = null;
  let nativeInputClick = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  class FatalError extends Error {}

  function articleKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }
  function enabled() {
    return /^\/notes\/n[a-z0-9]{8,}\/edit\/?$/i.test(location.pathname) && Boolean(articleKey());
  }
  function runKey() { return `${RUN_PREFIX}:${articleKey() || 'unknown'}`; }
  function controlKey() { return `${CONTROL_PREFIX}:${articleKey() || 'unknown'}`; }
  function getJSON(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch (_) { return fallback; }
  }
  function setJSON(key, value) {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
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
  function isPaused() { return Boolean(getJSON(controlKey(), {})?.paused); }
  function setPaused(value) {
    const current = getJSON(controlKey(), {});
    setJSON(controlKey(), { ...current, paused: Boolean(value), at: Date.now() });
  }
  function setStatus(text, bad = false) {
    const node = document.getElementById(STATUS_ID);
    if (!node) return;
    node.textContent = text;
    node.dataset.bad = bad ? '1' : '0';
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
    const id = 998000000 + Math.floor(Math.random() * 1000000);
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
  function imageNodes(view) {
    const out = [];
    view.state.doc.descendants((node, pos) => {
      if (node.type?.name === 'image') out.push({ node, pos });
    });
    return out;
  }
  function emptyParagraphNodes(view) {
    const out = [];
    view.state.doc.descendants((node, pos) => {
      if (node.type?.name === 'paragraph' && !String(node.textContent || '').trim()) out.push({ node, pos });
    });
    return out;
  }
  function remoteImage(node) {
    const src = String(node?.attrs?.src || '');
    return /^https:\/\//i.test(src) && !/^https:\/\/editor\.note\.com\/icons\//i.test(src);
  }
  function imageRecord(hit) {
    return {
      id: String(hit?.node?.attrs?.id || ''),
      src: String(hit?.node?.attrs?.src || ''),
      linkedAt: Date.now(),
      mode: 'pair173'
    };
  }
  function refindImage(view, record) {
    if (!record) return null;
    return imageNodes(view).find((hit) => {
      const id = String(hit.node.attrs?.id || '');
      const src = String(hit.node.attrs?.src || '');
      return (record.id && String(record.id) === id) || (record.src && String(record.src) === src);
    }) || null;
  }
  function findTrackedImage(view, record, url) {
    const hit = refindImage(view, record);
    return hit && remoteImage(hit.node) && normalizeUrl(hit.node.attrs?.link) === normalizeUrl(url) ? hit : null;
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
  function missingRows(view, dataset, run) {
    return (dataset.rows || []).filter((row) => !findTrackedImage(view, run.images?.[row.url], row.url));
  }
  function ensureEndSelection(view) {
    const paragraph = view.state.schema.nodes.paragraph;
    if (!paragraph) throw new FatalError('paragraph nodeなし');
    const last = view.state.doc.lastChild;
    if (!last || last.type !== paragraph || last.textContent !== '') {
      view.dispatch(view.state.tr.insert(view.state.doc.content.size, paragraph.create()));
    }
    view.dispatch(view.state.tr.setSelection(selectionApi().atEnd(view.state.doc)).scrollIntoView());
    view.focus();
  }
  async function setAndVerifyLink(view, hit, url) {
    const wanted = normalizeUrl(url);
    const seed = imageRecord(hit);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const current = refindImage(view, seed) || hit;
      view.dispatch(view.state.tr.setNodeMarkup(
        current.pos,
        current.node.type,
        { ...current.node.attrs, link: wanted },
        current.node.marks
      ));
      await sleep(160);
      const verify = refindImage(view, seed);
      if (verify && normalizeUrl(verify.node.attrs?.link) === wanted) return verify;
    }
    throw new FatalError(`個別URL埋め込みNG: ${wanted}`);
  }
  function verifyAll(view, dataset, run) {
    const failures = [];
    for (const row of dataset.rows || []) {
      if (!findTrackedImage(view, run.images?.[row.url], row.url)) failures.push(row.url);
    }
    return { ok: failures.length === 0, failures };
  }

  function xhr(url, responseType = 'text', timeout = 45000) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, responseType, timeout,
        headers: { Accept: responseType === 'blob' ? 'image/avif,image/webp,image/png,image/jpeg,*/*' : '*/*' },
        onload: (r) => r.status >= 200 && r.status < 300 ? resolve(r.response) : reject(new Error(`GET ${r.status}`)),
        onerror: () => reject(new Error('通信失敗')),
        ontimeout: () => reject(new Error('通信タイムアウト'))
      });
    });
  }
  async function bitmap(blob) {
    if (typeof page.createImageBitmap === 'function') return page.createImageBitmap(blob);
    return new Promise((resolve, reject) => {
      const img = new page.Image();
      const objectUrl = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('画像読込失敗')); };
      img.src = objectUrl;
    });
  }
  function roundedRect(ctx, x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function textLines(ctx, text, maxWidth, maxLines) {
    const chars = [...String(text || '')], lines = [];
    let cursor = 0;
    for (let n = 0; n < maxLines && cursor < chars.length; n += 1) {
      let line = '';
      while (cursor < chars.length) {
        const test = line + chars[cursor];
        if (line && ctx.measureText(test).width > maxWidth) break;
        line = test;
        cursor += 1;
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
  async function makeHalfFile(row, side) {
    let image = null;
    if (row.thumbUrl) {
      try { image = await bitmap(await xhr(row.thumbUrl, 'blob', 30000)); } catch (_) { image = null; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const gapLeft = side === 'right' ? INNER_GAP : 0;
    const gapRight = side === 'left' ? INNER_GAP : 0;
    const x = gapLeft;
    const cardW = CARD_W - gapLeft - gapRight;
    const y = 3, cardH = CARD_H - 6;

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#d8dee6';
    ctx.lineWidth = 1.4;
    roundedRect(ctx, x + 1, y + 1, cardW - 2, cardH - 2, 11);
    ctx.fill();
    ctx.stroke();

    const pad = 12;
    const thumbW = 126, thumbH = 158;
    const thumbX = x + cardW - pad - thumbW, thumbY = 13;
    const textX = x + pad;
    const textW = Math.max(115, cardW - thumbW - pad * 3);

    ctx.textBaseline = 'top';
    ctx.fillStyle = '#171b21';
    ctx.font = '750 15px system-ui,-apple-system,sans-serif';
    textLines(ctx, row?.title || '記事', textW, 4).forEach((line, i) => ctx.fillText(line, textX, 16 + i * 20));
    ctx.fillStyle = '#69717d';
    ctx.font = '650 11px system-ui,-apple-system,sans-serif';
    ctx.fillText(fitText(ctx, row?.creator || '', textW), textX, 145);

    ctx.fillStyle = '#f3f4f6';
    roundedRect(ctx, thumbX, thumbY, thumbW, thumbH, 8);
    ctx.fill();
    if (image) {
      const iw = image.width || image.naturalWidth || 1;
      const ih = image.height || image.naturalHeight || 1;
      const scale = Math.max(thumbW / iw, thumbH / ih);
      const sw = thumbW / scale, sh = thumbH / scale;
      const sx = Math.max(0, (iw - sw) / 2), sy = Math.max(0, (ih - sh) / 2);
      ctx.save();
      roundedRect(ctx, thumbX, thumbY, thumbW, thumbH, 8);
      ctx.clip();
      ctx.drawImage(image, sx, sy, sw, sh, thumbX, thumbY, thumbW, thumbH);
      ctx.restore();
      if (typeof image.close === 'function') image.close();
    } else {
      ctx.fillStyle = '#8b95a1';
      ctx.font = '800 20px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('note', thumbX + thumbW / 2, thumbY + 62);
      ctx.textAlign = 'start';
    }

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('横並びサムネ生成失敗')), 'image/png', 1);
    });
    return new page.File([blob], `note-${side}-${Date.now()}.png`, { type: 'image/png' });
  }

  async function saveOnce(label) {
    setStatus(label);
    await sleep(2500);
    const button = [...document.querySelectorAll('button')].find((node) => {
      const text = node.textContent?.trim();
      return (text === '一時保存' || text === '下書き保存') && node.getClientRects().length;
    });
    if (button && !button.disabled) button.click();
    await sleep(4500);
  }

  function imageInput(input) {
    if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return false;
    const accept = String(input.accept || '').toLowerCase();
    return !accept || accept.includes('image') || accept.includes('.png') || accept.includes('.jpg') ||
      accept.includes('.jpeg') || accept.includes('.webp');
  }
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
    if (!arm || arm.consumed || arm.imageChoiceSelected || arm.nativeMenuReady) return false;
    for (const root of roots) {
      const found = findVisibleImageChoice(root);
      if (found) {
        arm.nativeMenuReady = true;
        arm.nativeImageChoice = found;
        return true;
      }
    }
    return false;
  }
  function uninstallBridge() {
    try { observer?.disconnect(); } catch (_) {}
    observer = null;
    if (clickListener) document.removeEventListener('click', clickListener, true);
    if (pointerListener) document.removeEventListener('pointerdown', pointerListener, true);
    clickListener = null;
    pointerListener = null;
    if (nativeInputClick && page.HTMLInputElement?.prototype) {
      try { page.HTMLInputElement.prototype.click = nativeInputClick; } catch (_) {}
    }
    nativeInputClick = null;
  }
  function cancelArm() {
    if (arm?.timer) clearTimeout(arm.timer);
    arm = null;
    uninstallBridge();
  }
  function installNativeInputInterceptor() {
    if (nativeInputClick) return;
    const prototype = page.HTMLInputElement?.prototype;
    if (!prototype) return;
    nativeInputClick = prototype.click;
    prototype.click = function interceptedImageClick(...args) {
      if (arm && arm.imageChoiceSelected && imageInput(this)) {
        if (!arm.consumed) void consumeInput(this);
        return;
      }
      return nativeInputClick.apply(this, args);
    };
  }
  function installBridge() {
    if (observer || !document.documentElement) return;
    pointerListener = (event) => {
      if (!arm || arm.consumed || arm.imageChoiceSelected || !event.isTrusted || !arm.nativeMenuReady) return;
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
      const trigger = path.find((node) => exactImageChoice(node));
      if (!trigger || !arm.nativeImageChoice || !(path.includes(arm.nativeImageChoice) || arm.nativeImageChoice.contains?.(event.target))) return;
      arm.imageChoiceSelected = true;
      installNativeInputInterceptor();
      setStatus(`${arm.workRows.length}件｜画像入力接続。横2列を構築します…`);
    };
    document.addEventListener('pointerdown', pointerListener, true);

    clickListener = (event) => {
      if (!arm || arm.consumed) return;
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
      const directInput = path.find((node) => imageInput(node));
      if (arm.imageChoiceSelected && directInput) {
        event.preventDefault();
        event.stopPropagation();
        void consumeInput(directInput);
      }
    };
    document.addEventListener('click', clickListener, true);

    observer = new MutationObserver((mutations) => {
      if (!arm || arm.consumed) return;
      const roots = [];
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) if (node instanceof Element) roots.push(node);
      }
      if (!arm.imageChoiceSelected) {
        markNativeImageMenuReady(roots.length ? roots : [document.body]);
        return;
      }
      for (const node of roots) {
        if (imageInput(node)) { void consumeInput(node); return; }
        for (const input of node.querySelectorAll?.('input[type="file"]') || []) {
          if (imageInput(input)) { void consumeInput(input); return; }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function waitNewImages(view, beforeIds, expected, timeout = 240000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const fresh = imageNodes(view).filter((hit) => {
        const id = String(hit.node.attrs?.id || '');
        return id && !beforeIds.has(id) && remoteImage(hit.node);
      }).sort((a, b) => a.pos - b.pos);
      if (fresh.length >= expected) return fresh.slice(0, expected);
      setStatus(`画像アップロード ${fresh.length}/${expected}…`);
      await sleep(400);
    }
    return null;
  }

  function betweenEmptyParagraphs(view, left, right) {
    const start = left.pos + left.node.nodeSize;
    const end = right.pos;
    return emptyParagraphNodes(view).filter((p) => p.pos >= start && p.pos < end);
  }
  function removeSpacersInsidePairs(view, pairs) {
    const deleteList = [];
    for (const [left, right] of pairs) {
      if (!right) continue;
      deleteList.push(...betweenEmptyParagraphs(view, left, right));
    }
    if (deleteList.length) deleteHits(view, deleteList);
  }
  function ensureBreaksBetweenPairs(view, records) {
    const paragraph = view.state.schema.nodes.paragraph;
    if (!paragraph) throw new FatalError('paragraph nodeなし');
    const inserts = [];
    for (let i = 1; i < records.length - 1; i += 2) {
      const right = refindImage(view, records[i]);
      const nextLeft = refindImage(view, records[i + 1]);
      if (!right || !nextLeft) continue;
      const spaces = betweenEmptyParagraphs(view, right, nextLeft);
      if (!spaces.length) inserts.push(right.pos + right.node.nodeSize);
    }
    if (!inserts.length) return;
    let tr = view.state.tr;
    [...inserts].sort((a, b) => b - a).forEach((pos) => {
      try { tr = tr.insert(pos, paragraph.create()); } catch (_) {}
    });
    if (tr.docChanged) view.dispatch(tr.scrollIntoView());
  }
  function pairRects(view, records) {
    const out = [];
    for (let i = 0; i < records.length; i += 2) {
      const left = refindImage(view, records[i]);
      const right = refindImage(view, records[i + 1]);
      if (!left || !right) continue;
      let a = null, b = null;
      try {
        a = view.nodeDOM(left.pos)?.getBoundingClientRect?.() || null;
        b = view.nodeDOM(right.pos)?.getBoundingClientRect?.() || null;
      } catch (_) {}
      if (a && b) out.push({ a, b });
    }
    return out;
  }
  async function normalizeAndVerifyPairs(view, workRows, created, run) {
    if (created.length !== workRows.length) throw new FatalError(`画像数不一致 ${created.length}/${workRows.length}`);
    const records = [];
    for (let i = 0; i < workRows.length; i += 1) {
      const linked = await setAndVerifyLink(view, created[i], workRows[i].url);
      const rec = imageRecord(linked);
      run.images = run.images || {};
      run.images[workRows[i].url] = rec;
      records.push(rec);
      setStatus(`個別URL埋め込み ${i + 1}/${workRows.length}…`);
    }
    setJSON(runKey(), run);

    let pairNodes = [];
    for (let i = 0; i < records.length; i += 2) {
      const left = refindImage(view, records[i]);
      const right = refindImage(view, records[i + 1]);
      if (left) pairNodes.push([left, right || null]);
    }
    removeSpacersInsidePairs(view, pairNodes);
    await sleep(120);
    ensureBreaksBetweenPairs(view, records);
    await sleep(600);

    for (let i = 0; i < workRows.length; i += 1) {
      const hit = findTrackedImage(view, run.images[workRows[i].url], workRows[i].url);
      if (!hit) throw new FatalError(`構造変更後の個別URL確認NG: ${i + 1}`);
    }
    for (let i = 0; i + 1 < workRows.length; i += 2) {
      const left = findTrackedImage(view, run.images[workRows[i].url], workRows[i].url);
      const right = findTrackedImage(view, run.images[workRows[i + 1].url], workRows[i + 1].url);
      if (!left || !right) throw new FatalError(`左右ペア確認NG: ${Math.floor(i / 2) + 1}`);
      if (normalizeUrl(left.node.attrs?.link) === normalizeUrl(right.node.attrs?.link) &&
          normalizeUrl(workRows[i].url) !== normalizeUrl(workRows[i + 1].url)) {
        throw new FatalError(`左右が同じURLになっています: ペア${Math.floor(i / 2) + 1}`);
      }
    }

    const rects = pairRects(view, records);
    if (rects.length) {
      const bad = rects.filter(({ a, b }) => {
        const verticalOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return !(b.left >= a.left && verticalOverlap > Math.min(a.height, b.height) * 0.35);
      });
      if (bad.length) throw new FatalError(`横並び検証NG ${bad.length}ペア`);
    }
    return records;
  }

  async function cleanupLegacyTracked(view, run) {
    const entries = Object.entries(run.images || {});
    const legacy = entries.filter(([, rec]) => rec && rec.mode !== 'pair173');
    if (!legacy.length) return 0;
    const hits = [];
    for (const [, rec] of legacy) {
      const hit = refindImage(view, rec);
      if (hit) hits.push(hit);
    }
    const removed = deleteHits(view, hits);
    for (const [url] of legacy) delete run.images[url];
    run.pending = null;
    run.stage = 'extracted';
    setJSON(runKey(), run);
    if (removed) await saveOnce(`旧レイアウト${removed}枚を整理中…`);
    return removed;
  }

  async function consumeInput(input) {
    if (!arm || arm.consumed || !imageInput(input)) return;
    arm.consumed = true;
    const currentArm = arm;
    try {
      const { dataset, run, view, workRows } = currentArm;
      if (isPaused()) {
        setStatus('停止中です。「再開」を押してください');
        return;
      }
      run.pending = { mode: 'pair173-bulk', workUrls: workRows.map((r) => r.url), at: Date.now() };
      run.stage = 'images_building';
      setJSON(runKey(), run);

      setStatus(`${workRows.length}枚を一括アップロード → 2枚ずつ整列中…`);
      const files = [];
      for (let i = 0; i < workRows.length; i += 2) {
        files.push(await makeHalfFile(workRows[i], 'left'));
        if (workRows[i + 1]) files.push(await makeHalfFile(workRows[i + 1], 'right'));
      }

      ensureEndSelection(view);
      const beforeIds = new Set(imageNodes(view).map((hit) => String(hit.node.attrs?.id || '')).filter(Boolean));
      const transfer = new page.DataTransfer();
      files.forEach((file) => transfer.items.add(file));
      input.files = transfer.files;
      input.dispatchEvent(new page.Event('input', { bubbles: true }));
      input.dispatchEvent(new page.Event('change', { bubbles: true }));

      const created = await waitNewImages(view, beforeIds, files.length, 600000);
      if (!created || created.length !== files.length) {
        const partial = imageNodes(view).filter((hit) => {
          const id = String(hit.node.attrs?.id || '');
          return id && !beforeIds.has(id) && remoteImage(hit.node);
        });
        if (partial.length) deleteHits(view, partial);
        throw new FatalError(`アップロード画像数NG ${partial.length}/${files.length}。未完成分は自動削除しました`);
      }

      await normalizeAndVerifyPairs(view, workRows, created, run);
      run.pending = null;
      run.stage = 'images_ready';
      setJSON(runKey(), run);

      const missing = missingRows(view, dataset, run);
      if (missing.length) {
        await saveOnce(`横2列＋個別URL ${dataset.count - missing.length}/${dataset.count} 保存中…`);
        setStatus(`横2列＋個別🔗 ${dataset.count - missing.length}/${dataset.count} ✅ 残り${missing.length} →「画」`);
      } else {
        const verify = verifyAll(view, dataset, run);
        if (!verify.ok) throw new FatalError(`最終URL検証NG ${verify.failures.length}件`);
        await saveOnce(`横2列＋個別URL ${dataset.count}/${dataset.count} 保存中…`);
        setStatus(`完成 ✅ 横2列 ${dataset.count}枚｜中央${INNER_GAP * 2}px｜個別URL ${dataset.count}件`);
        page.alert(`横2列サムネ完了\n\n画像: ${dataset.count}枚\n2枚ずつ横並び\n中央余白: ${INNER_GAP * 2}px\n各画像へ別URL: ${dataset.count}件確認済み\n番号なし\n\n次は「送」。`);
      }
    } catch (error) {
      setStatus(`画像停止：${error?.message || String(error)}`, true);
    } finally {
      try { input.files = new page.DataTransfer().files; input.value = ''; } catch (_) {}
      busy = false;
      cancelArm();
    }
  }

  async function startPairImages() {
    if (busy || !enabled()) return;
    const dataset = getJSON(DATA_KEY, null);
    const run = getJSON(runKey(), null);
    if (!dataset || dataset.version !== BASE_VERSION || !Array.isArray(dataset.rows) ||
        !run || run.datasetId !== dataset.datasetId) {
      setStatus('先に「抽」で対象を取得してください', true);
      return;
    }
    if (Array.isArray(run.cardKeys) && run.cardKeys.length) {
      setStatus('通知カードが残っています。先に「削」', true);
      return;
    }

    const view = findView();
    if (!view) {
      setStatus('EditorViewなし。編集画面を再読み込みしてください', true);
      return;
    }
    selectionApi();
    setPaused(false);
    busy = true;
    try {
      const removed = await cleanupLegacyTracked(view, run);
      if (removed) setStatus(`旧画像${removed}枚を整理 ✅ 横2列版を準備中…`);

      for (let i = 0; i < dataset.rows.length; i += 2) {
        const a = dataset.rows[i], b = dataset.rows[i + 1];
        const ah = a ? findTrackedImage(view, run.images?.[a.url], a.url) : null;
        const bh = b ? findTrackedImage(view, run.images?.[b.url], b.url) : null;
        if ((ah && b && !bh) || (!ah && bh)) {
          deleteHits(view, [ah, bh].filter(Boolean));
          if (a) delete run.images[a.url];
          if (b) delete run.images[b.url];
        }
      }
      setJSON(runKey(), run);

      const missing = missingRows(view, dataset, run);
      if (!missing.length) {
        const verify = verifyAll(view, dataset, run);
        setStatus(verify.ok ? `完成済み ✅ 横2列＋個別URL ${dataset.count}/${dataset.count}` :
          `個別URL不一致 ${verify.failures.length}件`, !verify.ok);
        busy = false;
        return;
      }

      const workRows = [];
      for (let i = 0; i < dataset.rows.length && workRows.length < CHUNK_ROWS; i += 2) {
        const a = dataset.rows[i], b = dataset.rows[i + 1] || null;
        const ah = a ? findTrackedImage(view, run.images?.[a.url], a.url) : null;
        const bh = b ? findTrackedImage(view, run.images?.[b.url], b.url) : null;
        if (ah && (!b || bh)) continue;
        if (a) workRows.push(a);
        if (b) workRows.push(b);
      }
      if (!workRows.length) throw new FatalError('処理対象が見つかりません');

      ensureEndSelection(view);
      arm = {
        dataset, run, view, workRows,
        consumed: false, nativeMenuReady: false, nativeImageChoice: null,
        imageChoiceSelected: false, timer: null
      };
      installBridge();
      markNativeImageMenuReady([document.body]);
      arm.timer = setTimeout(() => {
        if (!arm || arm.consumed) return;
        setStatus('画像選択待機が10分を超えました。もう一度「画」', true);
        busy = false;
        cancelArm();
      }, 600000);
      setStatus(`${workRows.length}件準備 ✅ 「＋」→「画像」を1回｜横2列＋左右別URL`);
    } catch (error) {
      busy = false;
      setStatus(`画像準備停止：${error?.message || String(error)}`, true);
    }
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID) || !document.head) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{width:180px!important;padding:5px!important;border-radius:9px!important}
      #${PANEL_ID}>.title{min-height:22px!important;margin-bottom:3px!important;font-size:8px!important;gap:3px!important}
      #${PANEL_ID} .mumei-title-text-v164{font-size:8px!important}
      #${PANEL_ID} .mumei-min-btn-v164{flex-basis:23px!important;width:23px!important;height:22px!important;line-height:20px!important;font-size:13px!important}
      #${PANEL_ID} .grid2,#${PANEL_ID} .grid3{gap:2px!important;margin-bottom:2px!important}
      #${PANEL_ID} button{padding:3px 2px!important;font-size:8px!important;border-radius:5px!important}
      #${PANEL_ID} input{padding:4px!important;font-size:8px!important;margin-bottom:2px!important;border-radius:5px!important}
      #${PANEL_ID} input[data-amount]{font-size:12px!important}
      #${PANEL_ID} [data-hint]{font-size:7px!important;margin-bottom:2px!important}
      #${PANEL_ID} .actions,#${PANEL_ID} .resume{gap:2px!important;margin-top:2px!important}
      #${PANEL_ID} .actions button{padding:5px 1px!important;font-size:9px!important}
      #${STATUS_ID}{font-size:7px!important;margin-top:3px!important;line-height:1.2!important}
      #${PANEL_ID}.mumei-ui-minimized-v164{width:116px!important;padding:4px!important}
      #${PANEL_ID}.mumei-ui-minimized-v164 #${STATUS_ID}{max-width:106px!important;font-size:6px!important}
    `;
    document.head.appendChild(style);
  }
  function relabelVersion() {
    const panel = document.getElementById(PANEL_ID);
    const title = panel?.querySelector('.mumei-title-text-v164');
    if (title && !/17\.3/.test(title.textContent || '')) {
      title.textContent = String(title.textContent || '極薄＋通知')
        .replace(/v(?:16\.[345]|17\.[012])/i, 'v17.3');
    }
  }

  function interceptAction(event, action) {
    const button = event.target?.closest?.(`#${PANEL_ID} button[data-a="${action}"]`);
    if (!button) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }

  document.addEventListener('click', (event) => {
    if (interceptAction(event, 'image')) {
      void startPairImages();
      return;
    }
    if (event.target?.closest?.(`#${PANEL_ID} button[data-a="resume"]`)) {
      const run = getJSON(runKey(), null);
      if (run && ['images_building','images_paused','images_ready'].includes(run.stage)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void startPairImages();
      }
    }
  }, true);

  page.__MUMEI_START_PAIR_173__ = startPairImages;

  setInterval(() => { installStyle(); relabelVersion(); }, 400);
  installStyle();
})();