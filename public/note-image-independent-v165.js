(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_NOTE_IMAGE_INDEPENDENT_165__) return;
  page.__MUMEI_NOTE_IMAGE_INDEPENDENT_165__ = true;

  const VERSION = '16.5.0';
  const BASE_VERSION = '16.0.0';
  const PANEL_ID = 'mumei-note-source-picker-v163';
  const STATUS_ID = 'mumei-note-source-status-v163';
  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const CONTROL_PREFIX = 'mumei_note_source_control_v163';
  const STYLE_ID = 'mumei-note-image-independent-v165-style';
  const CHUNK = 80;
  const W = 860;
  const H = 140;
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
  function isPaused() { return Boolean(getJSON(controlKey(), {})?.paused); }
  function setPaused(value) {
    const current = getJSON(controlKey(), {});
    setJSON(controlKey(), { ...current, paused: Boolean(value), at: Date.now() });
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
    const id = 996000000 + Math.floor(Math.random() * 3000000);
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
  function remoteImage(node) {
    const src = String(node?.attrs?.src || '');
    return /^https:\/\//i.test(src) && !/^https:\/\/editor\.note\.com\/icons\//i.test(src);
  }
  function imageRecord(hit) {
    return {
      id: String(hit?.node?.attrs?.id || ''),
      src: String(hit?.node?.attrs?.src || ''),
      linkedAt: Date.now()
    };
  }
  function findTrackedImage(view, record, url) {
    const wanted = normalizeUrl(url);
    if (!record) return null;
    return imageNodes(view).find((hit) => {
      const id = String(hit.node.attrs?.id || '');
      const src = String(hit.node.attrs?.src || '');
      const link = normalizeUrl(hit.node.attrs?.link);
      const same = (record.id && String(record.id) === id) || (record.src && String(record.src) === src);
      return same && remoteImage(hit.node) && link === wanted;
    }) || null;
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
  function ensureSpacer(view) {
    const paragraph = view.state.schema.nodes.paragraph;
    if (!paragraph) throw new FatalError('paragraph nodeなし');
    const last = view.state.doc.lastChild;
    if (!last || last.type !== paragraph || last.textContent !== '') {
      view.dispatch(view.state.tr.insert(view.state.doc.content.size, paragraph.create()));
    }
    view.dispatch(view.state.tr.setSelection(selectionApi().atEnd(view.state.doc)).scrollIntoView());
    view.focus();
  }
  async function waitNewImage(view, beforeIds, timeout = 90000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const fresh = imageNodes(view).filter((hit) => {
        const id = String(hit.node.attrs?.id || '');
        return id && !beforeIds.has(id) && remoteImage(hit.node);
      }).sort((a, b) => a.pos - b.pos);
      if (fresh.length === 1) return fresh[0];
      if (fresh.length > 1) throw new FatalError(`1枚ずつ挿入のはずが新規画像${fresh.length}枚を検出しました`);
      await sleep(300);
    }
    return null;
  }
  function refindImage(view, record) {
    return imageNodes(view).find((hit) => {
      const id = String(hit.node.attrs?.id || '');
      const src = String(hit.node.attrs?.src || '');
      return (record.id && record.id === id) || (record.src && record.src === src);
    }) || null;
  }
  async function setAndVerifyLink(view, hit, url) {
    const wanted = normalizeUrl(url);
    const seed = imageRecord(hit);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const current = refindImage(view, seed) || hit;
      const attrs = { ...current.node.attrs, link: wanted };
      view.dispatch(view.state.tr.setNodeMarkup(current.pos, current.node.type, attrs, current.node.marks));
      await sleep(180);
      const verify = refindImage(view, { id: String(attrs.id || seed.id), src: String(attrs.src || seed.src) });
      if (verify && normalizeUrl(verify.node.attrs?.link) === wanted) return verify;
    }
    throw new FatalError(`画像リンク検証NG: ${wanted}`);
  }
  function trackedTopLevelGrouping(view, dataset, run) {
    const trackedIds = new Set();
    const trackedSrcs = new Set();
    for (const row of dataset.rows || []) {
      const rec = run.images?.[row.url];
      if (rec?.id) trackedIds.add(String(rec.id));
      if (rec?.src) trackedSrcs.add(String(rec.src));
    }
    let grouped = 0;
    view.state.doc.forEach((topNode) => {
      let count = 0;
      topNode.descendants((node) => {
        if (node.type?.name !== 'image') return;
        const id = String(node.attrs?.id || '');
        const src = String(node.attrs?.src || '');
        if (trackedIds.has(id) || trackedSrcs.has(src)) count += 1;
      });
      if (count > 1) grouped += 1;
    });
    return grouped;
  }
  function verifyAllProcessed(view, dataset, run) {
    const failures = [];
    for (const row of dataset.rows || []) {
      const hit = findTrackedImage(view, run.images?.[row.url], row.url);
      if (!hit) failures.push(row.url);
    }
    return { ok: failures.length === 0, failures, grouped: trackedTopLevelGrouping(view, dataset, run) };
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
    const chars = [...String(text || '')];
    const lines = [];
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
  async function makeThinFile(row) {
    let image = null;
    if (row.thumbUrl) {
      try { image = await bitmap(await xhr(row.thumbUrl, 'blob', 30000)); } catch (_) { image = null; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#d9dde3';
    ctx.lineWidth = 1.5;
    roundedRect(ctx, 1, 1, W - 2, H - 2, 12);
    ctx.stroke();

    const tw = 320, th = 124, tx = 532, ty = 8, textX = 16, textWidth = 504;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#171b21';
    ctx.font = '700 18px system-ui,-apple-system,sans-serif';
    textLines(ctx, row.title, textWidth, 3).forEach((line, i) => ctx.fillText(line, textX, 12 + i * 24));
    ctx.fillStyle = '#626975';
    ctx.font = '14px system-ui,-apple-system,sans-serif';
    ctx.fillText(fitText(ctx, row.creator, textWidth), textX, 110);

    ctx.fillStyle = '#f7f8fa';
    roundedRect(ctx, tx, ty, tw, th, 8);
    ctx.fill();
    if (image) {
      const iw = image.width || image.naturalWidth || 1;
      const ih = image.height || image.naturalHeight || 1;
      const scale = Math.min(tw / iw, th / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.save();
      roundedRect(ctx, tx, ty, tw, th, 8);
      ctx.clip();
      ctx.drawImage(image, tx + (tw - dw) / 2, ty + (th - dh) / 2, dw, dh);
      ctx.restore();
      if (typeof image.close === 'function') image.close();
    } else {
      ctx.fillStyle = '#6b7280';
      ctx.font = '800 28px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('note', tx + tw / 2, 48);
      ctx.textAlign = 'start';
    }

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('極薄サムネ生成失敗')), 'image/png', 1);
    });
    return new page.File([blob], 'thin-note.png', { type: 'image/png' });
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
    return !accept || accept.includes('image') || accept.includes('.png') || accept.includes('.jpg') || accept.includes('.jpeg') || accept.includes('.webp');
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
      setStatus(`${arm.workRows.length}枚｜「画像」を選択。1枚ずつ独立挿入します…`);
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

  async function consumeInput(input) {
    if (!arm || arm.consumed || !imageInput(input)) return;
    arm.consumed = true;
    const currentArm = arm;
    try {
      const { dataset, run, view, workRows } = currentArm;
      run.pending = { mode: 'sequential165', workUrls: workRows.map((r) => r.url), index: 0, at: Date.now() };
      setJSON(runKey(), run);

      for (let i = 0; i < workRows.length; i += 1) {
        if (isPaused()) {
          run.pending.index = i;
          run.stage = 'images_paused';
          setJSON(runKey(), run);
          await saveOnce(`画像途中保存 ${Object.keys(run.images || {}).length}/${dataset.count}…`);
          setStatus(`画像停止・保存済み ✅ ${Object.keys(run.images || {}).length}/${dataset.count}｜「再開」`);
          return;
        }

        if (!input.isConnected && i > 0) {
          run.pending.index = i;
          run.stage = 'images_paused';
          setJSON(runKey(), run);
          await saveOnce(`画像途中保存 ${Object.keys(run.images || {}).length}/${dataset.count}…`);
          throw new FatalError('noteの画像入力が閉じました。保存済みなので「再開」→「＋→画像」で続けられます');
        }

        const row = workRows[i];
        ensureEndSelection(view);
        const beforeIds = new Set(imageNodes(view).map((hit) => String(hit.node.attrs?.id || '')).filter(Boolean));
        setStatus(`独立サムネ ${i + 1}/${workRows.length} 生成中…`);
        const file = await makeThinFile(row);
        const transfer = new page.DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new page.Event('input', { bubbles: true }));
        input.dispatchEvent(new page.Event('change', { bubbles: true }));

        const hit = await waitNewImage(view, beforeIds);
        if (!hit) throw new FatalError(`${i + 1}/${workRows.length} 画像アップロード確認タイムアウト`);
        const linked = await setAndVerifyLink(view, hit, row.url);
        const rec = imageRecord(linked);
        run.images = run.images || {};
        run.images[row.url] = rec;
        run.pending.index = i + 1;
        run.stage = 'images_building';
        setJSON(runKey(), run);

        ensureSpacer(view);
        await sleep(260);
        setStatus(`独立画像＋個別🔗 ${i + 1}/${workRows.length} ✅`);

        try {
          input.files = new page.DataTransfer().files;
          input.value = '';
        } catch (_) {}
      }

      run.pending = null;
      run.stage = 'images_ready';
      setJSON(runKey(), run);

      const verify = verifyAllProcessed(view, dataset, run);
      if (verify.grouped > 0) {
        throw new FatalError(`連結画像ブロックを${verify.grouped}個検出。保存しません。「初」で作り直してください`);
      }

      const left = missingRows(view, dataset, run).length;
      if (left > 0) {
        await saveOnce(`独立極薄画像🔗 ${dataset.count - left}/${dataset.count} を保存中…`);
        setStatus(`独立極薄画像🔗 ${dataset.count - left}/${dataset.count} ✅ 残り${left}件 → もう一度「画」`);
      } else {
        if (!verify.ok) throw new FatalError(`個別🔗検証NG ${verify.failures.length}件。保存しません`);
        await saveOnce(`独立極薄画像🔗 ${dataset.count}/${dataset.count} を保存中…`);
        setStatus(`独立極薄画像🔗 ${dataset.count}/${dataset.count} 完成 ✅ 次は「送」`);
        page.alert(`極薄サムネ完了\n\n独立画像: ${dataset.count}件\n個別リンク: ${dataset.count}件確認済み\n通し番号: なし\n\n次は「送」。`);
      }
    } catch (error) {
      setStatus(`画像停止：${error?.message || String(error)}`, true);
    } finally {
      try { input.files = new page.DataTransfer().files; input.value = ''; } catch (_) {}
      busy = false;
      cancelArm();
    }
  }

  async function startSequentialImages() {
    if (busy || !enabled()) return;
    const dataset = getJSON(DATA_KEY, null);
    const run = getJSON(runKey(), null);
    if (!dataset || dataset.version !== BASE_VERSION || !run || run.datasetId !== dataset.datasetId) {
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
    const missing = missingRows(view, dataset, run);
    if (!missing.length) {
      const verify = verifyAllProcessed(view, dataset, run);
      if (verify.grouped > 0) {
        setStatus(`連結画像ブロック${verify.grouped}個あり。「初」で消して作り直してください`, true);
      } else if (!verify.ok) {
        setStatus(`個別🔗不一致 ${verify.failures.length}件。「初」で作り直してください`, true);
      } else {
        setStatus(`独立極薄画像🔗 ${dataset.count}/${dataset.count} 完成済み ✅ 次は「送」`);
      }
      return;
    }

    setPaused(false);
    busy = true;
    const workRows = missing.slice(0, CHUNK);
    ensureEndSelection(view);
    arm = {
      dataset,
      run,
      view,
      workRows,
      consumed: false,
      nativeMenuReady: false,
      nativeImageChoice: null,
      imageChoiceSelected: false,
      timer: null
    };
    installBridge();
    markNativeImageMenuReady([document.body]);
    arm.timer = setTimeout(() => {
      if (!arm || arm.consumed) return;
      setStatus('画像選択待機が10分を超えました。もう一度「画」', true);
      busy = false;
      cancelArm();
    }, 600000);
    setStatus(`${workRows.length}枚準備 ✅ 「＋」→「画像」を1回。以後1枚ずつ独立処理`);
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID) || !document.head) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{width:196px!important;padding:6px!important;border-radius:10px!important}
      #${PANEL_ID}>.title{min-height:24px!important;margin-bottom:4px!important;font-size:9px!important;gap:4px!important}
      #${PANEL_ID} .mumei-title-text-v164{font-size:9px!important}
      #${PANEL_ID} .mumei-min-btn-v164{flex-basis:25px!important;width:25px!important;height:24px!important;line-height:22px!important;font-size:14px!important}
      #${PANEL_ID} .grid2,#${PANEL_ID} .grid3{gap:3px!important;margin-bottom:3px!important}
      #${PANEL_ID} button{padding:4px 2px!important;font-size:9px!important;border-radius:6px!important}
      #${PANEL_ID} input{padding:5px!important;font-size:9px!important;margin-bottom:3px!important;border-radius:6px!important}
      #${PANEL_ID} input[data-amount]{font-size:13px!important}
      #${PANEL_ID} [data-hint]{font-size:8px!important;margin-bottom:3px!important}
      #${PANEL_ID} .actions,#${PANEL_ID} .resume{gap:3px!important;margin-top:3px!important}
      #${PANEL_ID} .actions button{padding:6px 1px!important;font-size:10px!important}
      #${STATUS_ID}{font-size:8px!important;margin-top:4px!important;line-height:1.25!important}
      #${PANEL_ID}.mumei-ui-minimized-v164{width:128px!important;padding:5px!important}
      #${PANEL_ID}.mumei-ui-minimized-v164 #${STATUS_ID}{max-width:116px!important;font-size:7px!important}
    `;
    document.head.appendChild(style);
  }

  function relabelVersion() {
    const panel = document.getElementById(PANEL_ID);
    const title = panel?.querySelector('.mumei-title-text-v164');
    if (title && !/16\.5/.test(title.textContent || '')) {
      title.textContent = String(title.textContent || '極薄＋通知').replace(/v16\.4|v16\.3/i, 'v16.5');
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.(`#${PANEL_ID} button[data-a="image"]`);
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void startSequentialImages();
  }, true);

  setInterval(() => {
    installStyle();
    relabelVersion();
  }, 500);
  installStyle();
})();