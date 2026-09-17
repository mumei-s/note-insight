(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_IMAGE_AUTOBATCH_188__) return;
  page.__MUMEI_IMAGE_AUTOBATCH_188__ = true;
  // 旧v17.9の「1バッチごとに＋→画像」を止め、この実装に一本化する。
  page.__MUMEI_SAFE_UPLOAD_179__ = true;

  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const CONTROL_PREFIX = 'mumei_note_source_control_v163';
  const BASE_PANEL = 'mumei-likers-thin-panel-v160';
  const STATUS = 'mumei-note-source-status-v163';
  const CHUNK = 10;
  const W = 860, H = 140;

  let busy = false, viewCache = null, selectionCache = null;
  let arm = null, observer = null, nativeInputClick = null;
  let imagePointer = null, imageClick = null;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  class FatalError extends Error {}

  function articleKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }
  function runKey() { return `${RUN_PREFIX}:${articleKey() || 'unknown'}`; }
  function controlKey() { return `${CONTROL_PREFIX}:${articleKey() || 'unknown'}`; }
  function getJSON(k, f = null) {
    try { return JSON.parse(localStorage.getItem(k) || 'null') ?? f; } catch (_) { return f; }
  }
  function setJSON(k, v) {
    if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v));
  }
  function dataset() { return getJSON(DATA_KEY, null); }
  function run() { return getJSON(runKey(), null); }
  function saveRun(v) { setJSON(runKey(), v); }
  function isPaused() { return Boolean(getJSON(controlKey(), {})?.paused); }
  function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try { const u = new URL(raw, location.href); u.search = ''; u.hash = ''; return u.href; }
    catch (_) { return raw; }
  }
  function setStatus(text, bad = false) {
    for (const id of [STATUS, 'mumei-likers-thin-status-v160']) {
      const s = document.getElementById(id);
      if (s) { s.textContent = text; s.dataset.bad = bad ? '1' : '0'; }
    }
  }
  function xhr(url, responseType = 'text', timeout = 45000) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, responseType, timeout,
        headers: { Accept: responseType === 'blob' ? 'image/avif,image/webp,image/png,image/jpeg,*/*' : 'application/json,text/html,*/*' },
        onload: (r) => r.status >= 200 && r.status < 300 ? resolve(r.response) : reject(new Error(`GET ${r.status}`)),
        onerror: () => reject(new Error('通信失敗')),
        ontimeout: () => reject(new Error('通信タイムアウト'))
      });
    });
  }
  function editor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') || document.querySelector('.ProseMirror');
  }
  function looksLikeView(v) {
    try { return !!(v && v.state?.doc && v.state?.schema && typeof v.dispatch === 'function' && v.dom && typeof v.posAtDOM === 'function'); }
    catch (_) { return false; }
  }
  function findView() {
    if (looksLikeView(viewCache) && viewCache.dom?.isConnected) return viewCache;
    const root = editor(); if (!root) return null;
    const seen = new Set(), q = []; let seed = root;
    for (let i = 0; i < 6 && seed; i++, seed = seed.parentElement) q.push([seed, 0]);
    let steps = 0;
    while (q.length && steps++ < 14000) {
      const [v, d] = q.shift(); if (!v || seen.has(v)) continue;
      seen.add(v); if (looksLikeView(v)) return (viewCache = v);
      let keys = []; try { keys = Object.getOwnPropertyNames(v); } catch (_) { continue; }
      for (const k of keys) {
        if (['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k)) continue;
        let n; try { n = v[k]; } catch (_) { continue; }
        if (looksLikeView(n)) return (viewCache = n);
        if (d < 7 && n && (typeof n === 'object' || typeof n === 'function') && n !== page && n !== document) q.push([n, d + 1]);
      }
    }
    return null;
  }
  function webpackRequire() {
    const chunks = page.webpackChunk_N_E; if (!chunks || typeof chunks.push !== 'function') return null;
    let req = null; const id = 996000000 + Math.floor(Math.random() * 3000000);
    try { chunks.push([[id], {}, (r) => { req = r; }]); } catch (_) {}
    return req;
  }
  function selectionApi() {
    if (selectionCache) return selectionCache;
    const req = webpackRequire(); if (!req) throw new FatalError('note内部Selection取得失敗');
    let mod; try { mod = req(44044); } catch (_) {}
    const Selection = mod?.Y1; if (typeof Selection?.atEnd !== 'function') throw new FatalError('note Selectionなし');
    return (selectionCache = Selection);
  }
  function imageNodes(view) {
    const out = []; view.state.doc.descendants((node, pos) => { if (node.type?.name === 'image') out.push({ node, pos }); });
    return out;
  }
  function remoteImage(node) {
    const src = String(node?.attrs?.src || '');
    return /^https:\/\//i.test(src) && !/^https:\/\/editor\.note\.com\/icons\//i.test(src);
  }
  function ensureEnd(view) {
    const paragraph = view.state.schema.nodes.paragraph; if (!paragraph) throw new FatalError('paragraph nodeなし');
    if (view.state.doc.lastChild?.type !== paragraph || view.state.doc.lastChild.textContent !== '') {
      view.dispatch(view.state.tr.insert(view.state.doc.content.size, paragraph.create()));
    }
    view.dispatch(view.state.tr.setSelection(selectionApi().atEnd(view.state.doc)).scrollIntoView()); view.focus();
  }
  function findTracked(view, rec, url) {
    if (!rec) return null; const wanted = normalizeUrl(url);
    return imageNodes(view).find((h) => {
      const id = String(h.node.attrs?.id || ''), src = String(h.node.attrs?.src || '');
      const matched = (rec.id && String(rec.id) === id) || (rec.src && String(rec.src) === src);
      return matched && remoteImage(h.node) && normalizeUrl(h.node.attrs?.link) === wanted;
    }) || null;
  }
  function missingRows(view, d, r) {
    return (d.rows || []).filter((row) => !findTracked(view, r.images?.[row.url], row.url));
  }
  function roundedRect(ctx, x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function textLines(ctx, text, maxWidth, maxLines) {
    const chars = [...String(text || '')], lines = []; let cursor = 0;
    for (let n = 0; n < maxLines && cursor < chars.length; n++) {
      let line = '';
      while (cursor < chars.length) {
        const test = line + chars[cursor]; if (line && ctx.measureText(test).width > maxWidth) break;
        line = test; cursor++;
      }
      if (n === maxLines - 1 && cursor < chars.length) {
        while (line && ctx.measureText(`${line}…`).width > maxWidth) line = [...line].slice(0, -1).join('');
        line += '…'; cursor = chars.length;
      }
      lines.push(line);
    }
    return lines;
  }
  function fitText(ctx, text, maxWidth) {
    let value = String(text || ''); if (ctx.measureText(value).width <= maxWidth) return value;
    while (value && ctx.measureText(`${value}…`).width > maxWidth) value = [...value].slice(0, -1).join('');
    return `${value}…`;
  }
  async function bitmap(blob) {
    if (typeof page.createImageBitmap === 'function') return page.createImageBitmap(blob);
    return new Promise((resolve, reject) => {
      const img = new page.Image(), u = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(u); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(u); reject(new Error('画像読込失敗')); }; img.src = u;
    });
  }
  async function makeThinFile(row) {
    let image = null;
    if (row.thumbUrl) { try { image = await bitmap(await xhr(row.thumbUrl, 'blob', 30000)); } catch (_) {} }
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#d9dde3'; ctx.lineWidth = 1.5; roundedRect(ctx, 1, 1, W - 2, H - 2, 12); ctx.stroke();
    const tw = 320, th = 124, tx = 532, ty = 8, textX = 16, textWidth = 504;
    ctx.textBaseline = 'top'; ctx.fillStyle = '#171b21'; ctx.font = '700 18px system-ui,-apple-system,sans-serif';
    textLines(ctx, row.title, textWidth, 3).forEach((line, i) => ctx.fillText(line, textX, 12 + i * 24));
    ctx.fillStyle = '#626975'; ctx.font = '14px system-ui,-apple-system,sans-serif'; ctx.fillText(fitText(ctx, row.creator, textWidth), textX, 110);
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
    const blob = await new Promise((resolve, reject) => canvas.toBlob((v) => v ? resolve(v) : reject(new Error('極薄生成失敗')), 'image/png', 1));
    return new page.File([blob], `thin_${row.latestKey || Math.random().toString(36).slice(2)}.png`, { type: 'image/png' });
  }
  async function mapLimit(items, limit, fn) {
    const out = new Array(items.length); let next = 0;
    async function worker() { while (true) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i], i); } }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)); return out;
  }
  function uploadFailureVisible() {
    return [...document.querySelectorAll('div,span,p')].some((node) => {
      if (!node.getClientRects().length) return false;
      return /画像のアップロードに失敗|画像をアップロードできません|アップロードに失敗/.test(String(node.textContent || ''));
    });
  }
  async function waitFresh(view, beforeIds, expected, timeout = 180000) {
    const deadline = Date.now() + timeout; let failSeenAt = 0; const started = Date.now(); let hadClear = !uploadFailureVisible();
    while (Date.now() < deadline) {
      const fresh = imageNodes(view).filter((h) => {
        const id = String(h.node.attrs?.id || ''); return id && !beforeIds.has(id) && remoteImage(h.node);
      }).sort((a, b) => a.pos - b.pos);
      if (fresh.length >= expected) return { fresh: fresh.slice(0, expected), failed: false };
      const failedNow = uploadFailureVisible(); if (!failedNow) hadClear = true;
      if (failedNow && (hadClear || Date.now() - started > 8000)) {
        if (!failSeenAt) failSeenAt = Date.now();
        if (Date.now() - failSeenAt > 3000) return { fresh, failed: true };
      } else failSeenAt = 0;
      setStatus(`画像アップロード ${fresh.length}/${expected}…`); await sleep(450);
    }
    const fresh = imageNodes(view).filter((h) => {
      const id = String(h.node.attrs?.id || ''); return id && !beforeIds.has(id) && remoteImage(h.node);
    }).sort((a, b) => a.pos - b.pos);
    return { fresh, failed: true };
  }
  async function linkFresh(view, rows, fresh, r) {
    const count = Math.min(rows.length, fresh.length); if (!count) return 0;
    let tr = view.state.tr;
    for (let i = 0; i < count; i++) {
      const hit = fresh[i], row = rows[i];
      tr = tr.setNodeMarkup(hit.pos, hit.node.type, { ...hit.node.attrs, link: normalizeUrl(row.url) }, hit.node.marks);
    }
    view.dispatch(tr); await sleep(220);
    const after = imageNodes(view); r.images ||= {};
    for (let i = 0; i < count; i++) {
      const row = rows[i], id = String(fresh[i].node.attrs?.id || '');
      const hit = (id ? after.find((h) => String(h.node.attrs?.id || '') === id) : null) ||
        after.find((h) => normalizeUrl(h.node.attrs?.link) === normalizeUrl(row.url) && remoteImage(h.node));
      if (!hit || normalizeUrl(hit.node.attrs?.link) !== normalizeUrl(row.url)) throw new FatalError(`画像🔗確認NG ${row.index || i + 1}`);
      r.images[row.url] = { id: String(hit.node.attrs?.id || ''), src: String(hit.node.attrs?.src || '') };
    }
    r.pending = null; saveRun(r); return count;
  }
  async function saveOnce(label) {
    setStatus(label); await sleep(1500);
    const b = [...document.querySelectorAll('button')].find((n) => {
      const t = n.textContent?.trim(); return (t === '一時保存' || t === '下書き保存') && n.getClientRects().length;
    });
    if (b && !b.disabled) b.click(); await sleep(4500);
  }
  async function recoverPending(view, d, r) {
    const p = r?.pending; if (!p?.workUrls?.length || !Array.isArray(p.beforeIds)) return 0;
    const workRows = p.workUrls.map((u) => d.rows.find((x) => x.url === u)).filter(Boolean);
    const before = new Set(p.beforeIds.map(String));
    const fresh = imageNodes(view).filter((h) => {
      const id = String(h.node.attrs?.id || ''); return id && !before.has(id) && remoteImage(h.node) && !normalizeUrl(h.node.attrs?.link);
    }).sort((a, b) => a.pos - b.pos).slice(0, workRows.length);
    if (!fresh.length) { r.pending = null; saveRun(r); return 0; }
    setStatus(`中断分 ${fresh.length}枚を🔗復旧中…`);
    const linked = await linkFresh(view, workRows.slice(0, fresh.length), fresh, r);
    await saveOnce(`中断分 ${linked}枚を復旧保存中…`); return linked;
  }

  function imageInput(input) {
    if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return false;
    const accept = String(input.accept || '').toLowerCase();
    return !accept || accept.includes('image') || accept.includes('.png') || accept.includes('.jpg') || accept.includes('.jpeg') || accept.includes('.webp');
  }
  const IMAGE_SELECTOR = 'button,[role="button"],label,[role="menuitem"],li';
  function imageChoice(node) {
    if (!(node instanceof Element) || !node.matches?.(IMAGE_SELECTOR)) return false;
    const label = String(node.textContent || '').replace(/\s+/g, ' ').trim();
    return /^(?:画像|写真|画像を追加|写真を追加)$/.test(label) && !!node.getClientRects().length;
  }
  function cleanupBridge() {
    try { observer?.disconnect(); } catch (_) {} observer = null;
    if (imagePointer) document.removeEventListener('pointerdown', imagePointer, true);
    if (imageClick) document.removeEventListener('click', imageClick, true);
    imagePointer = imageClick = null;
    if (nativeInputClick && page.HTMLInputElement?.prototype) {
      try { page.HTMLInputElement.prototype.click = nativeInputClick; } catch (_) {}
    }
    nativeInputClick = null;
  }
  async function pushBatch(input, a, rows) {
    const files = await mapLimit(rows, 3, async (row, i) => {
      const f = await makeThinFile(row); setStatus(`極薄生成 ${i + 1}/${rows.length}…`); return f;
    });
    const beforeIds = new Set(imageNodes(a.view).map((h) => String(h.node.attrs?.id || '')).filter(Boolean));
    a.run.pending = { workUrls: rows.map((x) => x.url), beforeIds: [...beforeIds], at: Date.now(), chunk: rows.length };
    saveRun(a.run);
    const dt = new page.DataTransfer(); files.forEach((f) => dt.items.add(f));
    try { input.value = ''; } catch (_) {}
    input.files = dt.files;
    input.dispatchEvent(new page.Event('input', { bubbles: true }));
    input.dispatchEvent(new page.Event('change', { bubbles: true }));
    const result = await waitFresh(a.view, beforeIds, rows.length, 180000);
    const linked = await linkFresh(a.view, rows.slice(0, result.fresh.length), result.fresh, a.run);
    if (linked) await saveOnce(`極薄画像🔗 ${Object.keys(a.run.images || {}).length}/${a.dataset.count} 保存中…`);
    try { input.files = new page.DataTransfer().files; input.value = ''; } catch (_) {}
    if (result.failed || linked < rows.length) {
      throw new FatalError(`画像アップロード失敗を回収：${linked}/${rows.length}枚保存済み。もう一度「画」→＋→画像で残りから再開`);
    }
  }
  async function inject(input) {
    const a = arm; if (!a || a.started || !imageInput(input)) return;
    a.started = true;
    try {
      while (true) {
        if (isPaused()) {
          setStatus(`停止・保存済み ${Object.keys(a.run.images || {}).length}/${a.dataset.count} ✅ 「再開」で続きから`);
          break;
        }
        const missing = missingRows(a.view, a.dataset, a.run);
        if (!missing.length) {
          setStatus(`極薄画像🔗 ${a.dataset.count}/${a.dataset.count} 完成 ✅ 次は「送」`);
          break;
        }
        const rows = missing.slice(0, CHUNK);
        setStatus(`残り${missing.length}件｜${rows.length}枚を自動処理中…`);
        await pushBatch(input, a, rows);
        const done = Object.keys(a.run.images || {}).length;
        setStatus(`極薄画像🔗 ${done}/${a.dataset.count} ✅ 次の${Math.min(CHUNK, a.dataset.count - done)}枚へ自動継続`);
        await sleep(900);
      }
      a.resolve();
    } catch (e) {
      try { a.run.pending = null; saveRun(a.run); } catch (_) {}
      a.reject(e);
    }
  }
  function installBridge() {
    if (!arm) return;
    imagePointer = (event) => {
      if (!arm || arm.started || !event.isTrusted) return;
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
      if (!path.some((n) => imageChoice(n))) return;
      arm.choiceSelected = true;
      if (!nativeInputClick) {
        const proto = page.HTMLInputElement?.prototype;
        if (proto) {
          nativeInputClick = proto.click;
          proto.click = function (...args) {
            if (arm && arm.choiceSelected && imageInput(this)) { void inject(this); return; }
            return nativeInputClick.apply(this, args);
          };
        }
      }
    };
    document.addEventListener('pointerdown', imagePointer, true);
    imageClick = (event) => {
      if (!arm || arm.started) return;
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
      const direct = path.find((n) => imageInput(n));
      if (arm.choiceSelected && direct) {
        event.preventDefault(); event.stopPropagation(); void inject(direct);
      }
    };
    document.addEventListener('click', imageClick, true);
    observer = new MutationObserver((ms) => {
      if (!arm || arm.started || !arm.choiceSelected) return;
      for (const m of ms) for (const n of m.addedNodes) {
        if (!(n instanceof Element)) continue;
        if (imageInput(n)) { void inject(n); return; }
        for (const i of n.querySelectorAll?.('input[type="file"]') || []) {
          if (imageInput(i)) { void inject(i); return; }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  async function prepare() {
    if (busy) return;
    const d = dataset(), r = run();
    if (!d?.rows?.length || !r || r.datasetId !== d.datasetId) {
      setStatus('先に「開始」で対象を取得してください', true); return;
    }
    busy = true;
    try {
      const view = findView(); if (!view) throw new FatalError('EditorViewなし'); selectionApi();
      if (r.pending) await recoverPending(view, d, r);
      const missing = missingRows(view, d, r);
      if (!missing.length) { setStatus(`極薄画像🔗 ${d.count}/${d.count} 完成 ✅ 次は「送」`); return; }
      ensureEnd(view);
      await new Promise((resolve, reject) => {
        arm = { dataset: d, run: r, view, resolve, reject, started: false, choiceSelected: false };
        installBridge();
        setStatus(`残り${missing.length}件｜最初の1回だけ ＋→画像｜以降10枚ずつ自動`);
      });
    } catch (e) {
      setStatus(`画像工程停止：${e?.message || e}｜成功済みは保持`, true);
    } finally {
      cleanupBridge(); arm = null; busy = false;
    }
  }

  document.addEventListener('click', (event) => {
    const btn = event.target?.closest?.(`#${BASE_PANEL} button[data-a="image"]`);
    if (!btn) return;
    event.preventDefault(); event.stopImmediatePropagation(); void prepare();
  }, true);

  setTimeout(async () => {
    try {
      const d = dataset(), r = run(), view = findView();
      if (d?.rows?.length && r?.pending && view) {
        busy = true; const n = await recoverPending(view, d, r);
        setStatus(`再読込復旧 ${n}枚 ✅ 「画」から残りを再開できます`);
      }
    } catch (e) {
      setStatus(`再読込復旧停止：${e?.message || e}`, true);
    } finally { busy = false; }
  }, 1800);
})();
