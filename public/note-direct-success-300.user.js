// ==UserScript==
// @name         無名S note DIRECT SUCCESS 3.0
// @namespace    https://github.com/mumei-s/note-insight/direct-success-300
// @version      3.16.0
// @description  極薄10枚DIRECT URL＋note本来のEnter処理で通知カード10件を正規生成＋一括削除
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.__MUMEI_DIRECT_SUCCESS_3160__) return;
  window.__MUMEI_DIRECT_SUCCESS_3160__ = true;

  const URLS = [
    'https://note.com/ss_yr/n/nc14eb3f2ea9f',
    'https://note.com/ss_yr/n/na8cf287a7152',
    'https://note.com/ss_yr/n/nafb8a53d1fe7',
    'https://note.com/ss_yr/n/nca7a49a69d3c',
    'https://note.com/ss_yr/n/n752f333ddd80',
    'https://note.com/ss_yr/n/n426982b5d60b',
    'https://note.com/ss_yr/n/n20f58cb3ec59',
    'https://note.com/ss_yr/n/n5cda670acdcf',
    'https://note.com/ss_yr/n/n2dfac2d0b184',
    'https://note.com/ss_yr/n/na51322616876'
  ];

  const PANEL = 'mumei-direct-success-panel';
  const BTN = 'mumei-direct-success-btn';
  const N_PANEL = 'mumei-notify-test-panel';
  const N_BTN = 'mumei-notify-test-btn';
  const N_CLEAN = 'mumei-notify-clean-btn';
  const REG = 'mumei_registry_v316';
  const LEGACY_REG = 'mumei_registry_v315';
  const LEGACY_CAP = 'mumei_capture_v315';
  let busy = false;
  let notifyBusy = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function editor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') ||
      document.querySelector('.ProseMirror');
  }

  function status(text, bad = false) {
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    panel.textContent = text;
    panel.style.background = bad ? '#991b1b' : '#065f46';
  }

  function nstatus(text, bad = false) {
    const panel = document.getElementById(N_PANEL);
    if (!panel) return;
    panel.textContent = text;
    panel.style.background = bad ? '#991b1b' : '#1f2937';
  }

  function emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function getJSON(key, fallback = null) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function setJSON(key, value) {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }

  function registry() {
    const value = getJSON(REG, []);
    return Array.isArray(value) ? value : [];
  }

  function saveRegistry(items) {
    const output = [];
    const seen = new Set();
    for (const item of items) {
      if (!item?.url || !item?.type) continue;
      const key = `${item.url}|${item.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push({ url: item.url, type: item.type });
    }
    setJSON(REG, output);
    updateCleanButton();
    return output;
  }

  function remember(url, type) {
    return saveRegistry([
      ...registry().filter((item) => item.url !== url),
      { url, type }
    ]);
  }

  function normalizeUrl(value) {
    try {
      const url = new URL(value, location.href);
      url.search = '';
      url.hash = '';
      return url.href;
    } catch (_) {
      return String(value || '');
    }
  }

  function sameSrc(a, b) {
    const first = normalizeUrl(a);
    const second = normalizeUrl(b);
    if (first === second) return true;
    const firstName = first.split('/').pop();
    const secondName = second.split('/').pop();
    return Boolean(firstName && secondName &&
      firstName.split('?')[0] === secondName.split('?')[0]);
  }

  function isThin(image) {
    if (!(image instanceof HTMLImageElement)) return false;
    const rect = image.getBoundingClientRect();
    const width = image.naturalWidth || rect.width;
    const height = image.naturalHeight || rect.height;
    return height > 0 && width / height > 4.5;
  }

  function cards() {
    const root = editor();
    return root
      ? [...root.querySelectorAll('img')].filter(isThin).slice(-10)
      : [];
  }

  function mount() {
    if (!document.body) return;

    let panel = document.getElementById(PANEL);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL;
      document.body.appendChild(panel);
    }
    panel.textContent = panel.textContent || 'DIRECT SUCCESS 3.16';
    Object.assign(panel.style, {
      position: 'fixed', right: '8px', top: '72px', zIndex: '2147483646',
      maxWidth: '340px', padding: '6px 8px', borderRadius: '8px',
      background: '#065f46', color: '#fff', fontSize: '11px',
      lineHeight: '1.3', boxShadow: '0 4px 12px rgba(0,0,0,.25)',
      pointerEvents: 'none', display: 'block'
    });

    let linkButton = document.getElementById(BTN);
    if (!linkButton) {
      linkButton = document.createElement('button');
      linkButton.id = BTN;
      linkButton.type = 'button';
      linkButton.textContent = 'DIRECT SUCCESS 3.0';
      linkButton.addEventListener('click', runLinks);
      document.body.appendChild(linkButton);
    }
    Object.assign(linkButton.style, {
      position: 'fixed', right: '8px', top: '110px', zIndex: '2147483647',
      border: '0', borderRadius: '10px', padding: '10px 13px',
      background: '#059669', color: '#fff', fontSize: '13px',
      fontWeight: '800', boxShadow: '0 4px 14px rgba(0,0,0,.28)',
      touchAction: 'manipulation'
    });

    let notifyPanel = document.getElementById(N_PANEL);
    if (!notifyPanel) {
      notifyPanel = document.createElement('div');
      notifyPanel.id = N_PANEL;
      notifyPanel.textContent = '正規通知カード10件 READY';
      document.body.appendChild(notifyPanel);
    }
    Object.assign(notifyPanel.style, {
      position: 'fixed', right: '8px', bottom: '170px', zIndex: '2147483646',
      maxWidth: '330px', padding: '6px 8px', borderRadius: '8px',
      background: '#1f2937', color: '#fff', fontSize: '10px',
      lineHeight: '1.3', boxShadow: '0 3px 12px rgba(0,0,0,.25)',
      pointerEvents: 'none', display: 'block'
    });

    let notifyButton = document.getElementById(N_BTN);
    if (!notifyButton) {
      notifyButton = document.createElement('button');
      notifyButton.id = N_BTN;
      notifyButton.type = 'button';
      notifyButton.textContent = '通知カード10件 正規生成';
      notifyButton.addEventListener('click', notify10);
      document.body.appendChild(notifyButton);
    }
    Object.assign(notifyButton.style, {
      position: 'fixed', right: '8px', bottom: '125px', zIndex: '2147483647',
      border: '0', borderRadius: '10px', padding: '10px 13px',
      background: '#2563eb', color: '#fff', fontSize: '13px',
      fontWeight: '800', boxShadow: '0 4px 14px rgba(0,0,0,.28)',
      touchAction: 'manipulation', display: 'block', visibility: 'visible', opacity: '1'
    });

    let cleanButton = document.getElementById(N_CLEAN);
    if (!cleanButton) {
      cleanButton = document.createElement('button');
      cleanButton.id = N_CLEAN;
      cleanButton.type = 'button';
      cleanButton.addEventListener('click', cleanCards);
      document.body.appendChild(cleanButton);
    }
    Object.assign(cleanButton.style, {
      position: 'fixed', right: '8px', bottom: '80px', zIndex: '2147483647',
      border: '0', borderRadius: '10px', padding: '9px 12px',
      background: '#b45309', color: '#fff', fontSize: '12px',
      fontWeight: '800', boxShadow: '0 4px 14px rgba(0,0,0,.28)',
      touchAction: 'manipulation'
    });
    updateCleanButton();
  }

  function updateCleanButton() {
    const button = document.getElementById(N_CLEAN);
    if (!button) return;
    const count = registry().length;
    button.textContent = count
      ? `通知カード一括削除（${count}件）`
      : '通知カード一括削除';
    button.style.display = count ? 'block' : 'none';
  }

  mount();
  setInterval(mount, 700);

  function looksLikeView(value) {
    try {
      return Boolean(value && typeof value === 'object' && value.state?.doc &&
        value.state?.schema && typeof value.dispatch === 'function' &&
        value.dom && typeof value.posAtDOM === 'function');
    } catch (_) {
      return false;
    }
  }

  function findView() {
    const root = editor();
    if (!root) return null;
    const seeds = [];
    let node = root;
    for (let i = 0; i < 6 && node; i += 1, node = node.parentElement) seeds.push(node);

    const seen = new Set();
    const queue = [];
    const push = (value, depth = 0) => {
      if (!value || seen.has(value) || depth > 7) return;
      if (typeof value !== 'object' && typeof value !== 'function') return;
      seen.add(value);
      queue.push([value, depth]);
    };
    seeds.forEach((seed) => push(seed));

    let steps = 0;
    while (queue.length && steps < 12000) {
      steps += 1;
      const [value, depth] = queue.shift();
      if (looksLikeView(value)) return value;
      let keys = [];
      try { keys = Object.getOwnPropertyNames(value); } catch (_) { continue; }
      for (const key of keys) {
        if (['window', 'document', 'ownerDocument', 'parentNode', 'children',
          'childNodes', 'style'].includes(key)) continue;
        let next;
        try { next = value[key]; } catch (_) { continue; }
        if (looksLikeView(next)) return next;
        if (depth < 7 && next && (typeof next === 'object' || typeof next === 'function') &&
          next !== window && next !== document) push(next, depth + 1);
      }
    }
    return null;
  }

  function findNodeForImage(view, image) {
    let domPos = null;
    try { domPos = view.posAtDOM(image, 0); } catch (_) {}
    const candidates = [];
    const doc = view.state.doc;
    if (Number.isInteger(domPos)) {
      for (const pos of [domPos, domPos - 1, domPos + 1]) {
        if (pos < 0 || pos > doc.content.size) continue;
        try {
          const candidate = doc.nodeAt(pos);
          if (candidate) candidates.push({ node: candidate, pos });
        } catch (_) {}
      }
    }

    let exact = null;
    doc.descendants((candidate, pos) => {
      if (exact || !candidate.attrs) return;
      for (const [key, value] of Object.entries(candidate.attrs)) {
        if (typeof value === 'string' && /src|image|url/i.test(key) &&
          sameSrc(value, image.src)) {
          exact = { node: candidate, pos };
          return false;
        }
      }
    });
    if (exact) return exact;
    for (const candidate of candidates) {
      const name = candidate.node.type?.name || '';
      if (/image|picture|photo/i.test(name)) return candidate;
      if (candidate.node.attrs && Object.keys(candidate.node.attrs)
        .some((key) => /src|image/i.test(key))) return candidate;
    }
    return candidates[0] || null;
  }

  function parentCandidates(view, pos) {
    const output = [];
    try {
      const resolved = view.state.doc.resolve(Math.max(0,
        Math.min(pos, view.state.doc.content.size)));
      for (let depth = resolved.depth; depth >= 1; depth -= 1) {
        const node = resolved.node(depth);
        let before;
        try { before = resolved.before(depth); } catch (_) { continue; }
        output.push({ node, pos: before });
      }
    } catch (_) {}
    return output;
  }

  function nodeList(view, image) {
    const hit = findNodeForImage(view, image);
    return hit ? [hit, ...parentCandidates(view, hit.pos)] : [];
  }

  function nodeHasLink(node, url) {
    if (!node) return false;
    for (const mark of node.marks || []) {
      if (/link/i.test(mark.type?.name || '') &&
        Object.values(mark.attrs || {}).map(String).includes(url)) return true;
    }
    for (const [key, value] of Object.entries(node.attrs || {})) {
      if (/href|link|url/i.test(key) && String(value) === url) return true;
    }
    return false;
  }

  function alreadyLinked(view, image, url) {
    return nodeList(view, image).some((candidate) => nodeHasLink(candidate.node, url));
  }

  function linkMarkType(schema) {
    if (schema.marks?.link) return schema.marks.link;
    for (const [name, type] of Object.entries(schema.marks || {})) {
      if (/link/i.test(name)) return type;
    }
    return null;
  }

  function buildLinkAttrs(type, url) {
    const spec = type?.spec?.attrs || {};
    const attrs = {};
    for (const key of Object.keys(spec)) {
      if (/href|url|link/i.test(key)) attrs[key] = url;
      else if ('default' in spec[key]) attrs[key] = spec[key].default;
      else attrs[key] = null;
    }
    if (!Object.keys(attrs).some((key) => /href|url|link/i.test(key))) attrs.href = url;
    return attrs;
  }

  function trySetAttr(view, pos, node, url) {
    const keys = new Set([
      ...Object.keys(node.attrs || {}),
      ...Object.keys(node.type?.spec?.attrs || {})
    ]);
    for (const key of [...keys].filter((name) => /href|link|url/i.test(name))) {
      try {
        view.dispatch(view.state.tr.setNodeMarkup(pos, node.type,
          { ...node.attrs, [key]: url }, node.marks));
        if (nodeHasLink(view.state.doc.nodeAt(pos), url)) return true;
      } catch (_) {}
    }
    return false;
  }

  function trySetMark(view, pos, node, url) {
    const type = linkMarkType(view.state.schema);
    if (!type) return false;
    let mark;
    try { mark = type.create(buildLinkAttrs(type, url)); } catch (_) { return false; }
    try {
      const marks = (node.marks || []).filter((item) => item.type !== type).concat(mark);
      view.dispatch(view.state.tr.setNodeMarkup(pos, node.type, node.attrs, marks));
      return nodeHasLink(view.state.doc.nodeAt(pos), url);
    } catch (_) {
      return false;
    }
  }

  function setDirect(view, image, url) {
    const candidates = nodeList(view, image);
    for (const candidate of candidates) {
      if (trySetAttr(view, candidate.pos, candidate.node, url)) return true;
    }
    for (const candidate of candidates) {
      if (trySetMark(view, candidate.pos, candidate.node, url)) return true;
    }
    return false;
  }

  async function ensureLinks(view, images) {
    for (let i = 0; i < 10; i += 1) {
      if (alreadyLinked(view, images[i], URLS[i])) continue;
      status(`URL書き込み ${i + 1}/10…`);
      let ok = false;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        ok = setDirect(view, images[i], URLS[i]);
        if (ok) break;
        await sleep(250);
      }
      if (!ok) return { index: i + 1 };
      await sleep(60);
    }
    return null;
  }

  async function runLinks() {
    if (busy) return;
    busy = true;
    const button = document.getElementById(BTN);
    if (button) button.disabled = true;
    try {
      const images = cards();
      if (images.length !== 10) {
        status(`カード ${images.length}/10`, true);
        return;
      }
      const view = findView();
      if (!view) {
        status('DIRECT停止：EditorViewなし', true);
        return;
      }
      const error = await ensureLinks(view, images);
      if (error) {
        status(`URL ${error.index}/10で停止`, true);
        return;
      }
      status('URL完了 10/10 ✅');
      emit('mumei-direct-success-done', { ok: 10 });
    } catch (error) {
      status(`DIRECTエラー：${error?.message || String(error)}`, true);
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  }

  function nodeCarriesUrl(node, url) {
    try {
      const json = JSON.stringify(node.toJSON ? node.toJSON() : node.attrs || {});
      return json.includes(url) || json.includes(url.split('/').pop());
    } catch (_) {
      return false;
    }
  }

  function visibleDom(view, pos) {
    try {
      const dom = view.nodeDOM(pos);
      if (!(dom instanceof Element) || !dom.isConnected) return null;
      const rect = dom.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0 ? dom : null;
    } catch (_) {
      return null;
    }
  }

  function containsThin(dom) {
    if (!dom) return false;
    if (dom instanceof HTMLImageElement && isThin(dom)) return true;
    return [...dom.querySelectorAll('img')].some(isThin);
  }

  function notifyHits(view, url, type = null) {
    const output = [];
    view.state.doc.descendants((node, pos) => {
      const name = node.type?.name || '';
      if (type && name !== type) return;
      if (node.isTextblock || /image|picture|photo/i.test(name) ||
        !nodeCarriesUrl(node, url)) return;
      const dom = visibleDom(view, pos);
      if (!dom || containsThin(dom)) return;
      const score = (node.isAtom ? 100 : 0) +
        (/embed|card|bookmark|oembed|external|preview|iframe/i.test(name) ? 80 : 0);
      if (score > 0) output.push({ node, pos, dom, score });
    });
    return output.sort((a, b) => b.pos - a.pos);
  }

  function findNotify(view, url, type = null) {
    return notifyHits(view, url, type)[0] || null;
  }

  function exactUrlParagraphs(view, url = null) {
    const output = [];
    view.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      const value = (node.textContent || '').trim();
      if ((url && value === url) || (!url && URLS.includes(value))) {
        output.push({ node, pos });
      }
    });
    return output;
  }

  function deleteBlocks(view, hits) {
    if (!hits.length) return 0;
    let transaction = view.state.tr;
    const unique = [];
    const seen = new Set();
    for (const hit of hits.sort((a, b) => b.pos - a.pos)) {
      const key = `${hit.pos}:${hit.node.nodeSize}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(hit);
      transaction = transaction.delete(hit.pos, hit.pos + hit.node.nodeSize);
    }
    view.dispatch(transaction);
    return unique.length;
  }

  function removeRawUrls(view, url = null) {
    return deleteBlocks(view, exactUrlParagraphs(view, url));
  }

  function registeredHit(view, item) {
    return findNotify(view, item.url, item.type);
  }

  function normalizeRegistry(view) {
    return saveRegistry(registry().filter((item) => registeredHit(view, item)));
  }

  function clearFailed315Cards(view) {
    const current = normalizeRegistry(view);
    const keep = new Set(current.map((item) => `${item.url}|${item.type}`));
    const old = getJSON(LEGACY_REG, []);
    const legacy = Array.isArray(old) ? old : [];
    const hits = [];

    for (const item of legacy) {
      const hit = findNotify(view, item.url, item.type);
      if (hit && !keep.has(`${item.url}|${item.type}`)) hits.push(hit);
    }

    // 3.15で見た目だけ作られた対象カードが、旧記録を失っていても残らないようにする。
    // 3.16で正規生成済みとして記録されたカードだけは再開用に保持する。
    for (const url of URLS) {
      if (current.some((item) => item.url === url)) continue;
      const hit = findNotify(view, url);
      if (hit) hits.push(hit);
    }

    const removed = deleteBlocks(view, hits);
    removeRawUrls(view);
    setJSON(LEGACY_REG, null);
    setJSON(LEGACY_CAP, null);
    return removed;
  }

  function setCursorAtEnd(view) {
    const Selection = view.state.selection.constructor;
    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
    view.focus();
  }

  function insertUrlParagraph(view, url) {
    removeRawUrls(view, url);
    const paragraph = view.state.schema.nodes.paragraph;
    if (!paragraph) throw new Error('paragraphなし');
    const node = paragraph.create(null, view.state.schema.text(url));
    view.dispatch(view.state.tr.insert(view.state.doc.content.size, node));
    setCursorAtEnd(view);
  }

  function keyEvent(type) {
    return new KeyboardEvent(type, {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13, charCode: 13,
      bubbles: true, cancelable: true, composed: true
    });
  }

  function inputEvent(type) {
    try {
      return new InputEvent(type, {
        inputType: 'insertParagraph', data: null,
        bubbles: true, cancelable: true, composed: true
      });
    } catch (_) {
      return new Event(type, { bubbles: true, cancelable: true });
    }
  }

  // 手動Enterと同じ順番で、EditorViewのDOMイベント経路を通す。
  // API直送やカードJSON複製は一切行わない。
  async function runNativeEnter(view) {
    view.focus();
    await sleep(120);

    const before = view.state.doc;
    const down = keyEvent('keydown');
    view.dom.dispatchEvent(down);

    // 通常のDOM経路が合成イベントを無視した場合だけ、同じEditorViewに
    // 登録されているhandleKeyDownを直接呼ぶ。カードを組み立てる処理ではなく、
    // 手動Enter時にEditorViewが使うコマンド経路そのものを実行する。
    if (!down.defaultPrevented && view.state.doc.eq(before) &&
      typeof view.someProp === 'function') {
      try {
        const handled = view.someProp('handleKeyDown', (handler) =>
          handler(view, down));
        if (handled) down.preventDefault();
      } catch (_) {}
    }

    // Androidのソフトキーボードはkeydownではなくbeforeinputが本経路になる場合がある。
    if (!down.defaultPrevented && view.state.doc.eq(before)) {
      const beforeInput = inputEvent('beforeinput');
      view.dom.dispatchEvent(beforeInput);
      if (!beforeInput.defaultPrevented && view.state.doc.eq(before) &&
        typeof view.someProp === 'function') {
        try {
          view.someProp('handleDOMEvents', (handlers) => {
            if (typeof handlers?.beforeinput !== 'function') return false;
            return handlers.beforeinput(view, beforeInput);
          });
        } catch (_) {}
      }
      if (!beforeInput.defaultPrevented && view.state.doc.eq(before) &&
        typeof document.execCommand === 'function') {
        document.execCommand('insertParagraph', false, null);
      }
    }

    view.dom.dispatchEvent(keyEvent('keyup'));
  }

  async function waitForNativeCard(view, url, timeout = 20000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const hit = findNotify(view, url);
      if (hit) return hit;
      await sleep(250);
    }
    return null;
  }

  async function createNativeCard(view, url, index) {
    const saved = registry().find((item) => item.url === url);
    if (saved) {
      const existing = registeredHit(view, saved);
      if (existing) return existing;
    }

    const unregistered = findNotify(view, url);
    if (unregistered) deleteBlocks(view, [unregistered]);
    insertUrlParagraph(view, url);
    nstatus(`正規Enter処理 ${index}/10…`);
    await runNativeEnter(view);

    const hit = await waitForNativeCard(view, url);
    if (!hit) {
      removeRawUrls(view, url);
      throw new Error(`${index}/10 正規カード化失敗`);
    }

    removeRawUrls(view, url);
    remember(url, hit.node.type.name);
    return hit;
  }

  async function notify10() {
    if (notifyBusy) return;
    notifyBusy = true;
    const button = document.getElementById(N_BTN);
    if (button) button.disabled = true;

    try {
      const view = findView();
      if (!view) throw new Error('EditorViewなし');
      const images = cards();
      if (images.length !== 10) throw new Error(`極薄画像 ${images.length}/10。先に緑の10枚`);

      const linkError = await ensureLinks(view, images);
      if (linkError) throw new Error(`極薄URL ${linkError.index}/10で停止`);

      const removed = clearFailed315Cards(view);
      if (removed) nstatus(`旧3.15カード ${removed}件を除去 → 正規生成中…`);

      for (let i = 0; i < URLS.length; i += 1) {
        await createNativeCard(view, URLS[i], i + 1);
        nstatus(`正規通知カード ${i + 1}/10 ✅`);
        await sleep(700);
      }

      const count = registry().filter((item) => registeredHit(view, item)).length;
      if (count !== 10) throw new Error(`正規カード確認 ${count}/10`);
      nstatus('正規通知カード 10/10 ✅ 公開して通知確認');
    } catch (error) {
      nstatus(`停止：${error?.message || String(error)}（同じ青ボタンで再開）`, true);
    } finally {
      notifyBusy = false;
      if (button) button.disabled = false;
    }
  }

  function cleanCards() {
    const button = document.getElementById(N_CLEAN);
    if (button) button.disabled = true;
    try {
      const view = findView();
      if (!view) throw new Error('EditorViewなし');
      const hits = [];
      for (const item of registry()) {
        const hit = registeredHit(view, item);
        if (hit) hits.push(hit);
      }
      if (!hits.length) throw new Error('削除対象カードなし');
      const removed = deleteBlocks(view, hits);
      saveRegistry([]);
      nstatus(`通知カード ${removed}/${removed} 一括削除 ✅ 極薄10枚は残しました`);
    } catch (error) {
      nstatus(`削除停止：${error?.message || String(error)}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  }
})();
