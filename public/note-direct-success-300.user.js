// ==UserScript==
// @name         無名S note DIRECT SUCCESS 3.0
// @namespace    https://github.com/mumei-s/note-insight/direct-success-300
// @version      3.23.0
// @description  note正規URLコマンドで10/107件を完全自動カード化＋記事別収納＋一括削除
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.__MUMEI_DIRECT_SUCCESS_3230__) return;
  window.__MUMEI_DIRECT_SUCCESS_3230__ = true;

  const TEST_URLS = [
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
  const FINAL_MANIFEST = 'https://mumei-s.github.io/note-insight/note-summer-107/manifest.json';
  let finalUrlsCache = [];

  const PANEL = 'mumei-direct-success-panel';
  const BTN = 'mumei-direct-success-btn';
  const N_PANEL = 'mumei-notify-test-panel';
  const N_BTN = 'mumei-notify-test-btn';
  const N_CLEAN = 'mumei-notify-clean-btn';
  const TOGGLE = 'mumei-card-system-toggle';
  const ACTIVE_ARTICLES = 'mumei_note_card_active_articles_v1';
  const REG_PREFIX = 'mumei_registry_v319';
  const PREVIOUS_REG = 'mumei_registry_v316';
  const LEGACY_REG = 'mumei_registry_v315';
  const LEGACY_CAP = 'mumei_capture_v315';
  const REQUESTED_BATCH = 'mumeiRequestedBatch';
  const OFFICIAL_PROOF = 'note-ePJ-v323';
  let busy = false;
  let notifyBusy = false;
  let observerInstalled = false;
  let runToken = 0;
  const officialEmbeds = new Map();
  let noteUrlCommand = null;

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
    const value = getJSON(`${REG_PREFIX}:${sourceNoteKey() || 'unknown'}`, []);
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
      output.push({
        url: item.url,
        type: item.type,
        ...(item.key ? { key: String(item.key) } : {}),
        ...(item.sourceKey ? { sourceKey: String(item.sourceKey) } : {}),
        ...(item.proof ? { proof: String(item.proof) } : {})
      });
    }
    setJSON(`${REG_PREFIX}:${sourceNoteKey() || 'unknown'}`, output);
    updateCleanButton();
    return output;
  }

  function remember(url, type, proof = {}) {
    return saveRegistry([
      ...registry().filter((item) => item.url !== url),
      { url, type, ...proof }
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

  function thinCards() {
    const root = editor();
    return root ? [...root.querySelectorAll('img')].filter(isThin) : [];
  }

  function validFinalUrls(values) {
    return Array.isArray(values) && values.length === 107 &&
      new Set(values).size === 107 && values.every((url) =>
        /^https:\/\/note\.com\/[^/]+\/n\/n[a-z0-9]+$/i.test(String(url || '')));
  }

  function finalUrls() {
    if (validFinalUrls(finalUrlsCache)) return finalUrlsCache;
    try {
      const fromWindow = window.__MUMEI_SUMMER_107_MANIFEST__?.items?.map((item) => item?.url);
      if (validFinalUrls(fromWindow)) finalUrlsCache = fromWindow;
    } catch (_) {}
    try {
      const raw = document.documentElement?.dataset?.mumeiFinal107Urls;
      const fromPage = raw ? JSON.parse(raw) : [];
      if (validFinalUrls(fromPage)) finalUrlsCache = fromPage;
    } catch (_) {}
    return validFinalUrls(finalUrlsCache) ? finalUrlsCache : [];
  }

  function currentBatch() {
    const images = thinCards();
    const final = finalUrls();
    const requested = document.documentElement?.dataset?.[REQUESTED_BATCH] || '';
    if (requested === '107' && final.length === 107) {
      return { urls: final, images: images.slice(-107), count: 107, final: true };
    }
    if (requested === '10') {
      return { urls: TEST_URLS, images: images.slice(-10), count: 10, final: false };
    }
    if (final.length === 107 && images.length >= 107) {
      return { urls: final, images: images.slice(-107), count: 107, final: true };
    }
    return { urls: TEST_URLS, images: images.slice(-10), count: 10, final: false };
  }

  function knownTargetUrls() {
    return [...new Set([...TEST_URLS, ...finalUrls()])];
  }

  async function prefetchFinalUrls() {
    if (validFinalUrls(finalUrlsCache)) return;
    try {
      const response = await fetch(FINAL_MANIFEST, { cache: 'no-store' });
      if (!response.ok) return;
      const manifest = await response.json();
      const urls = manifest?.items?.map((item) => item?.url);
      if (!validFinalUrls(urls)) return;
      finalUrlsCache = urls;
      if (document.documentElement) {
        document.documentElement.dataset.mumeiFinal107Urls = JSON.stringify(urls);
      }
      mount();
    } catch (_) {}
  }

  function activeArticleKeys() {
    const value = getJSON(ACTIVE_ARTICLES, []);
    return new Set(Array.isArray(value) ? value.filter(Boolean) : []);
  }

  function isEnabled() {
    const key = sourceNoteKey();
    return Boolean(key && activeArticleKeys().has(key));
  }

  function setEnabled(enabled) {
    const key = sourceNoteKey();
    if (!key) return false;
    // 同時にONにできる編集記事は1本だけ。別記事では自動的にOFFになる。
    setJSON(ACTIVE_ARTICLES, enabled ? [key] : []);
    return true;
  }

  function hideWorkingUi() {
    for (const id of [PANEL, BTN, N_PANEL, N_BTN, N_CLEAN]) {
      const element = document.getElementById(id);
      if (element) element.style.display = 'none';
    }
  }

  function toggleSystem() {
    const next = !isEnabled();
    if (!setEnabled(next)) return;
    if (!next) {
      runToken += 1;
      officialEmbeds.clear();
      hideWorkingUi();
      document.dispatchEvent(new CustomEvent('mumei-card-system-cancel'));
    } else {
      installOfficialEmbedObserver();
      prefetchFinalUrls();
    }
    document.dispatchEvent(new CustomEvent('mumei-card-system-toggle', {
      detail: { enabled: next, articleKey: sourceNoteKey() }
    }));
    mount();
  }

  function mount() {
    if (!document.body) return;

    let toggle = document.getElementById(TOGGLE);
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.id = TOGGLE;
      toggle.type = 'button';
      toggle.addEventListener('click', toggleSystem);
      document.body.appendChild(toggle);
    }
    const enabled = isEnabled();
    toggle.textContent = enabled ? '通知ツールをしまう' : '通知';
    toggle.title = enabled ? 'この画面の通知ツールをしまう' : 'この記事で通知ツールを開く';
    Object.assign(toggle.style, {
      position: 'fixed', right: enabled ? '8px' : '-28px', bottom: '18px',
      zIndex: '2147483647', minWidth: enabled ? 'auto' : '42px',
      border: '0', borderRadius: '999px', padding: enabled ? '8px 12px' : '8px 7px',
      background: enabled ? '#047857' : '#4b5563', color: '#fff',
      fontSize: enabled ? '12px' : '10px', fontWeight: '800',
      boxShadow: '0 4px 14px rgba(0,0,0,.28)', touchAction: 'manipulation',
      display: 'block', visibility: 'visible', opacity: '1'
    });

    if (!enabled) {
      hideWorkingUi();
      return;
    }
    installOfficialEmbedObserver();
    const bridgeControlsLinks = Boolean(document.getElementById('mumei-bridge610-btn'));

    let panel = document.getElementById(PANEL);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL;
      document.body.appendChild(panel);
    }
    panel.textContent = panel.textContent || 'DIRECT SUCCESS 3.23｜この記事だけ展開中';
    Object.assign(panel.style, {
      position: 'fixed', right: '8px', top: '72px', zIndex: '2147483646',
      maxWidth: '340px', padding: '6px 8px', borderRadius: '8px',
      background: '#065f46', color: '#fff', fontSize: '11px',
      lineHeight: '1.3', boxShadow: '0 4px 12px rgba(0,0,0,.25)',
      pointerEvents: 'none', display: bridgeControlsLinks ? 'none' : 'block'
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
      touchAction: 'manipulation', display: bridgeControlsLinks ? 'none' : 'block',
      pointerEvents: bridgeControlsLinks ? 'none' : 'auto'
    });

    let notifyPanel = document.getElementById(N_PANEL);
    if (!notifyPanel) {
      notifyPanel = document.createElement('div');
      notifyPanel.id = N_PANEL;
      notifyPanel.textContent = 'note正規処理を直接実行｜コピー・Enter不要';
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
      notifyButton.addEventListener('click', notifyAll);
      document.body.appendChild(notifyButton);
    }
    if (!notifyBusy) {
      const count = currentBatch().count;
      notifyButton.textContent = `通知カード${count}件（完全自動）`;
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
      touchAction: 'manipulation', display: 'block'
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
    button.style.display = isEnabled() ? 'block' : 'none';
  }

  mount();
  setInterval(mount, 700);
  document.addEventListener('mumei-final-107-ready', (event) => {
    const urls = event.detail?.items?.map((item) => item?.url) || event.detail?.urls;
    if (validFinalUrls(urls)) finalUrlsCache = urls;
    mount();
  });
  if (isEnabled()) prefetchFinalUrls();

  function sourceNoteKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }

  function isEmbedEndpoint(url, method = 'GET') {
    return /\/api\/v1\/embed(?:\?|$)/.test(String(url || '')) &&
      String(method || 'GET').toUpperCase() === 'POST';
  }

  function bodyFields(body) {
    const output = {};
    try {
      if (body instanceof FormData || body instanceof URLSearchParams) {
        for (const [key, value] of body.entries()) {
          if (typeof value === 'string') output[key] = value;
        }
      } else if (typeof body === 'string') {
        try { Object.assign(output, JSON.parse(body)); } catch (_) {}
      }
    } catch (_) {}
    return output;
  }

  function embedPayload(json) {
    return json?.data?.embedded_content || json?.embedded_content || null;
  }

  function recordOfficialEmbed(fields, json) {
    if (!isEnabled()) return;
    const embedded = embedPayload(json);
    if (!embedded?.key) return;
    const url = normalizeUrl(embedded.url || fields.url || '');
    if (!url) return;
    officialEmbeds.set(url, {
      url,
      key: String(embedded.key),
      identifier: String(embedded.identifier || url.split('/').pop() || ''),
      service: String(embedded.service || ''),
      embeddableType: String(embedded.embeddable_type || fields.embeddable_type || ''),
      sourceKey: String(fields.embeddable_key || '')
    });
  }

  let originalFetch;
  let originalXhrOpen;
  let originalXhrSend;
  function installOfficialEmbedObserver() {
    if (observerInstalled) return;
    observerInstalled = true;
    originalFetch = window.fetch.bind(window);
    window.fetch = async function observedFetch(input, init) {
      const url = input instanceof Request ? input.url : String(input);
      const method = init?.method || (input instanceof Request ? input.method : 'GET');
      const wanted = isEmbedEndpoint(url, method);
      let fields = wanted ? bodyFields(init?.body) : {};
      if (wanted && input instanceof Request && !Object.keys(fields).length) {
        try { fields = bodyFields(await input.clone().formData()); } catch (_) {}
      }
      const response = await originalFetch(input, init);
      if (wanted && response.ok) {
        try { recordOfficialEmbed(fields, await response.clone().json()); } catch (_) {}
      }
      return response;
    };

    const proto = XMLHttpRequest.prototype;
    originalXhrOpen = proto.open;
    originalXhrSend = proto.send;
    proto.open = function observedOpen(method, url, ...rest) {
      this.__mumei318 = { method: String(method || 'GET'), url: String(url || '') };
      return originalXhrOpen.call(this, method, url, ...rest);
    };
    proto.send = function observedSend(body) {
      const request = this.__mumei318;
      if (request && isEmbedEndpoint(request.url, request.method)) {
        const fields = bodyFields(body);
        this.addEventListener('load', () => {
          if (this.status < 200 || this.status >= 300) return;
          try { recordOfficialEmbed(fields, JSON.parse(this.responseText || '{}')); } catch (_) {}
        }, { once: true });
      }
      return originalXhrSend.call(this, body);
    };
  }

  if (isEnabled()) installOfficialEmbedObserver();

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

  // noteエディタ自身がURL→Enter/Pasteで呼ぶ正規コマンド。
  // 現行エディタの webpack module 94928 / export fjT は、URLごとに
  // /api/v1/embed を実行し、新しい embeddedContentKey を持つembedを挿入する。
  function webpackRequire() {
    const chunks = window.webpackChunk_N_E;
    if (!chunks || typeof chunks.push !== 'function') return null;
    let require = null;
    const chunkId = 930000000 + Math.floor(Math.random() * 60000000);
    try {
      chunks.push([[chunkId], {}, (runtimeRequire) => {
        require = runtimeRequire;
      }]);
    } catch (_) {}
    return require;
  }

  function noteUrlCommandFactory() {
    if (typeof noteUrlCommand === 'function') return noteUrlCommand;
    const require = webpackRequire();
    if (!require) throw new Error('note内部処理を取得できません');
    let module;
    try { module = require(94928); } catch (_) {}
    let candidate = typeof module?.fjT === 'function' ? module.fjT : null;
    const looksRight = (value) => {
      if (typeof value !== 'function') return false;
      let source = '';
      try { source = Function.prototype.toString.call(value); } catch (_) {}
      return source.includes('state.selection') && source.includes('nodeBefore') &&
        source.includes('replaceRangeWith') && source.includes('.then');
    };
    if (!looksRight(candidate)) {
      const loaded = Object.values(require.c || {}).flatMap((entry) =>
        Object.values(entry?.exports || {}));
      candidate = loaded.find(looksRight) || null;
    }
    if (typeof candidate !== 'function') {
      throw new Error('note正規URLコマンドが見つかりません');
    }
    noteUrlCommand = candidate;
    return noteUrlCommand;
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

  async function ensureLinks(view, images, urls) {
    const total = urls.length;
    for (let i = 0; i < total; i += 1) {
      if (alreadyLinked(view, images[i], urls[i])) continue;
      status(`URL書き込み ${i + 1}/${total}…`);
      emit('mumei-direct-progress', { index: i + 1, total });
      let ok = false;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        ok = setDirect(view, images[i], urls[i]);
        if (ok) break;
        await sleep(250);
      }
      if (!ok) return { index: i + 1 };
      await sleep(60);
    }
    return null;
  }

  async function runLinks() {
    if (busy || !isEnabled()) return;
    busy = true;
    const button = document.getElementById(BTN);
    if (button) button.disabled = true;
    try {
      const batch = currentBatch();
      const { images, urls, count } = batch;
      if (images.length !== count) {
        status(`カード ${images.length}/${count}`, true);
        emit('mumei-direct-stopped', {
          index: 0, total: count, reason: `カード ${images.length}/${count}`
        });
        return;
      }
      const view = findView();
      if (!view) {
        status('DIRECT停止：EditorViewなし', true);
        emit('mumei-direct-stopped', { index: 0, reason: 'EditorViewなし' });
        return;
      }
      const error = await ensureLinks(view, images, urls);
      if (error) {
        status(`URL ${error.index}/${count}で停止`, true);
        emit('mumei-direct-stopped', {
          index: error.index, total: count, reason: 'URL書き込み停止'
        });
        return;
      }
      status(`URL完了 ${count}/${count} ✅`);
      emit('mumei-direct-success-done', { ok: count, total: count });
    } catch (error) {
      status(`DIRECTエラー：${error?.message || String(error)}`, true);
      emit('mumei-direct-stopped', { index: 0, reason: error?.message || String(error) });
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

  function officialProof(view, url) {
    const normalized = normalizeUrl(url);
    const embed = officialEmbeds.get(normalized);
    if (!embed) return { ok: false, reason: 'note公式embed応答なし' };
    const hit = findNotify(view, url);
    if (!hit) return { ok: false, reason: '本文カードなし' };
    const targetKey = url.split('/').pop();
    const sourceKey = sourceNoteKey();
    const json = JSON.stringify(hit.node.toJSON ? hit.node.toJSON() : hit.node.attrs || {});
    if (embed.service.toLowerCase() !== 'note') {
      return { ok: false, reason: 'embed service不一致' };
    }
    if (embed.embeddableType.toLowerCase() !== 'note') {
      return { ok: false, reason: 'embeddable_type不一致' };
    }
    if (embed.identifier !== targetKey) {
      return { ok: false, reason: '対象記事キー不一致' };
    }
    if (embed.sourceKey && sourceKey && embed.sourceKey !== sourceKey) {
      return { ok: false, reason: '埋め込み先記事キー不一致' };
    }
    if (!/^emb[a-z0-9]+$/i.test(embed.key) || !json.includes(embed.key)) {
      return { ok: false, reason: '公式embedded-content-key未保存' };
    }
    if (!json.includes(url) && !json.includes(targetKey)) {
      return { ok: false, reason: '本文URL不一致' };
    }
    return { ok: true, hit, embed };
  }

  function exactUrlParagraphs(view, url = null) {
    const output = [];
    const targets = new Set(knownTargetUrls());
    view.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      const value = (node.textContent || '').trim();
      if ((url && value === url) || (!url && targets.has(value))) {
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
    if (item?.proof !== OFFICIAL_PROOF || !item?.key) return null;
    if (item.sourceKey && item.sourceKey !== sourceNoteKey()) return null;
    const hit = findNotify(view, item.url, item.type);
    if (!hit) return null;
    const json = JSON.stringify(hit.node.toJSON ? hit.node.toJSON() : hit.node.attrs || {});
    return json.includes(item.key) ? hit : null;
  }

  function allTargetCardHits(view, urls = knownTargetUrls()) {
    const output = [];
    const seen = new Set();
    for (const url of urls) {
      for (const hit of notifyHits(view, url)) {
        const key = `${hit.pos}:${hit.node.nodeSize}`;
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(hit);
      }
    }
    return output;
  }

  function normalizeRegistry(view) {
    return saveRegistry(registry().filter((item) => registeredHit(view, item)));
  }

  function storedOfficialProof(view, url) {
    const item = registry().find((entry) => entry.url === url &&
      entry.proof === OFFICIAL_PROOF && entry.key);
    const hit = item ? registeredHit(view, item) : null;
    return hit ? { ok: true, item, hit } : { ok: false };
  }

  function clearFailedCards(view, urls) {
    const current = normalizeRegistry(view);
    const keep = new Set(current.map((item) => `${item.url}|${item.type}`));
    const old = getJSON(LEGACY_REG, []);
    const legacy = Array.isArray(old) ? old : [];
    const previous = getJSON(PREVIOUS_REG, []);
    const previousItems = Array.isArray(previous) ? previous : [];
    const hits = [];

    for (const item of [...legacy, ...previousItems]) {
      const hit = findNotify(view, item.url, item.type);
      if (hit && !keep.has(`${item.url}|${item.type}`)) hits.push(hit);
    }

    // 3.15で見た目だけ作られた対象カードが、旧記録を失っていても残らないようにする。
    // 3.16で正規生成済みとして記録されたカードだけは再開用に保持する。
    for (const url of urls) {
      if (current.some((item) => item.url === url)) continue;
      const hit = findNotify(view, url);
      if (hit) hits.push(hit);
    }

    const removed = deleteBlocks(view, hits);
    removeRawUrls(view);
    setJSON(LEGACY_REG, null);
    setJSON(LEGACY_CAP, null);
    setJSON(PREVIOUS_REG, null);
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

  function nativeCardProof(view, url) {
    const hit = findNotify(view, url);
    if (!hit) return { ok: false, reason: '本文カードなし' };
    const targetKey = url.split('/').pop();
    const json = JSON.stringify(hit.node.toJSON ? hit.node.toJSON() : hit.node.attrs || {});
    if (!json.includes(url) && !json.includes(targetKey)) {
      return { ok: false, reason: '本文URL不一致' };
    }
    return { ok: true, hit };
  }

  async function waitForNativeCard(view, url, timeout = 25000) {
    const deadline = Date.now() + timeout;
    let last = { ok: false, reason: '待機中' };
    while (Date.now() < deadline) {
      last = nativeCardProof(view, url);
      if (last.ok) return last;
      await sleep(250);
    }
    return last;
  }

  async function waitForOfficialCard(view, url, timeout = 45000) {
    const deadline = Date.now() + timeout;
    let last = { ok: false, reason: 'note正規登録待機中' };
    while (Date.now() < deadline) {
      last = officialProof(view, url);
      if (last.ok) return last;
      await sleep(250);
    }
    return last;
  }

  async function createOfficialCard(view, url, index, total) {
    const existing = findNotify(view, url);
    if (existing) deleteBlocks(view, [existing]);
    officialEmbeds.delete(normalizeUrl(url));
    insertUrlParagraph(view, url);
    nstatus(`${index}/${total} note正規URLコマンド実行中…`);

    const factory = noteUrlCommandFactory();
    const command = factory(url);
    const handled = command(view.state, (transaction) => view.dispatch(transaction), view);
    if (!handled) {
      removeRawUrls(view, url);
      throw new Error(`${index}/${total} note正規URLコマンド未処理`);
    }

    const proof = await waitForOfficialCard(view, url);
    if (!proof.ok) {
      removeRawUrls(view, url);
      throw new Error(`${index}/${total} ${proof.reason}`);
    }
    removeRawUrls(view, url);
    remember(url, proof.hit.node.type.name, {
      key: proof.embed.key,
      sourceKey: sourceNoteKey(),
      proof: OFFICIAL_PROOF
    });
    return proof.hit;
  }

  async function notifyAll() {
    if (notifyBusy || !isEnabled()) return;
    notifyBusy = true;
    const token = ++runToken;
    const button = document.getElementById(N_BTN);
    if (button) button.disabled = true;

    try {
      const view = findView();
      if (!view) throw new Error('EditorViewなし');
      const batch = currentBatch();
      const { images, urls, count } = batch;
      if (images.length !== count) {
        throw new Error(`極薄画像 ${images.length}/${count}。先に緑の${count}枚`);
      }

      const linkError = await ensureLinks(view, images, urls);
      if (linkError) throw new Error(`極薄URL ${linkError.index}/${count}で停止`);

      noteUrlCommandFactory();
      officialEmbeds.clear();
      const removed = clearFailedCards(view, urls);
      if (removed) nstatus(`通知対象外の旧カード ${removed}件を除去 → 正規登録開始…`);

      for (let i = 0; i < urls.length; i += 1) {
        if (token !== runToken || !isEnabled()) throw new Error('システムOFFで中止');
        if (storedOfficialProof(view, urls[i]).ok) {
          nstatus(`note正規登録 ${i + 1}/${count} ✅（確認済みを保持）`);
        } else {
          await createOfficialCard(view, urls[i], i + 1, count);
          nstatus(`note正規登録 ${i + 1}/${count} ✅`);
        }
        emit('mumei-notify-progress', { index: i + 1, total: count });
        await sleep(count === 107 ? 900 : 500);
      }

      const confirmed = urls.filter((url) => storedOfficialProof(view, url).ok).length;
      if (confirmed !== count) throw new Error(`note正規登録確認 ${confirmed}/${count}`);
      nstatus(`note正規登録 ${count}/${count} ✅ 公開・更新して通知確認`);
      emit('mumei-notify-done', { ok: count, total: count });
    } catch (error) {
      if (token === runToken) {
        nstatus(`停止：${error?.message || String(error)}（公開・更新しない）`, true);
        emit('mumei-notify-stopped', {
          reason: error?.message || String(error),
          total: currentBatch().count
        });
      }
    } finally {
      notifyBusy = false;
      if (button) button.disabled = false;
    }
  }

  document.addEventListener('mumei-notify-run-request', () => notifyAll());

  function cleanCards() {
    if (!isEnabled()) return;
    const button = document.getElementById(N_CLEAN);
    if (button) button.disabled = true;
    try {
      const view = findView();
      if (!view) throw new Error('EditorViewなし');
      // 記録が消えた旧版カードも、対象10/107URLの標準カードなら復旧削除する。
      // notifyHitsは極薄画像を必ず除外するため、860×140画像は残る。
      const urls = [...new Set([
        ...knownTargetUrls(),
        ...registry().map((item) => item?.url).filter(Boolean)
      ])];
      const hits = allTargetCardHits(view, urls);
      if (!hits.length) throw new Error('削除対象カードなし');
      const removed = deleteBlocks(view, hits);
      saveRegistry([]);
      nstatus(`通知カード ${removed}件 一括削除 ✅ 極薄画像は残しました`);
    } catch (error) {
      nstatus(`削除停止：${error?.message || String(error)}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  }
})();
