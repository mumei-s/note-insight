// ==UserScript==
// @name         無名S note 通知10件 FINAL 8.0
// @namespace    https://github.com/mumei-s/note-insight/notify-final-800
// @version      8.0.0
// @description  10件だけを対象に、note正規カード生成→保存→通知後に極薄10枚一括追加＋リンク＋標準カード削除まで行う確定テスト版
// @match        https://editor.note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      note.com
// @connect      assets.st-note.com
// ==/UserScript==

(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_NOTIFY_FINAL_8000__) return;
  page.__MUMEI_NOTIFY_FINAL_8000__ = true;

  // 旧版は起動させない。今回の10件テストはこの1本だけで処理する。
  page.__MUMEI_NOTIFY_COMPLETE_7200__ = true;
  page.__MUMEI_NOTIFY_COMPLETE_7100__ = true;
  page.__MUMEI_BATCH_BRIDGE_680__ = true;
  page.__MUMEI_BATCH_BRIDGE_670__ = true;
  page.__MUMEI_BATCH_BRIDGE_650__ = true;
  page.__MUMEI_DIRECT_SUCCESS_3230__ = true;
  page.__MUMEI_DIRECT_SUCCESS_3220__ = true;

  const VERSION = '8.0';
  const W = 860;
  const H = 140;
  const CREATOR = '無名S note';
  const TEST_ITEMS = [
    ['https://note.com/ss_yr/n/nc14eb3f2ea9f', '【言葉と行動、その間にあるもの】 第2回スキ動画コンテスト『夏の陣』🏖'],
    ['https://note.com/ss_yr/n/na8cf287a7152', '忘れたくない夏を、ひとつ増やした。【#あいびよりあそび】'],
    ['https://note.com/ss_yr/n/nafb8a53d1fe7', '『営業パパ クリエイター図鑑』│無名S note【クリエイター名鑑〇〇編】'],
    ['https://note.com/ss_yr/n/nca7a49a69d3c', '【時を閉じ込める番人】│コングラ◯◯冠⁉️『クリエイター名鑑』'],
    ['https://note.com/ss_yr/n/n752f333ddd80', '鬼もほどける艶ポーズ👹【スイ式 AI創作レシピ】で描くヨガ道場'],
    ['https://note.com/ss_yr/n/n426982b5d60b', '彗星、縫ってます。☄️そのフォロー外し… 見えてるよ🧐'],
    ['https://note.com/ss_yr/n/n20f58cb3ec59', '【TEnGU】'],
    ['https://note.com/ss_yr/n/n5cda670acdcf', '【書いた言葉が、朝の部屋から飛び立つまで】 210000PV＆32000スキ達成'],
    ['https://note.com/ss_yr/n/n2dfac2d0b184', "( 'ω'o[おしらせ]o【業界保有数No.1⁉️】"],
    ['https://note.com/ss_yr/n/na51322616876', '【企画📝】あなたが、まだ名前をつけていないもの。 共同マガジンの引き継ぎのお知らせ']
  ].map(([url, title], index) => ({ index: index + 1, url, title }));

  const URLS = TEST_ITEMS.map((item) => item.url);
  const TOGGLE = 'mumei-final800-toggle';
  const PANEL = 'mumei-final800-panel';
  const STATUS = 'mumei-final800-status';
  const STYLE = 'mumei-final800-style';
  const STATE_PREFIX = 'mumei_final800';
  const API_PROOF = new Map();

  let opened = false;
  let running = false;
  let runToken = 0;
  let viewCache = null;
  let coreCache = null;
  let networkInstalled = false;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  class FatalError extends Error {}

  function articleKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }
  function isEditPage() {
    return /^\/notes\/n[a-z0-9]{8,}\/edit\/?$/i.test(location.pathname);
  }
  function editor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') || document.querySelector('.ProseMirror');
  }
  function normalizeUrl(value) {
    try {
      const url = new URL(String(value || ''), location.href);
      url.search = '';
      url.hash = '';
      return url.href;
    } catch (_) {
      return String(value || '');
    }
  }
  function stateKey(name) {
    return `${STATE_PREFIX}:${articleKey() || 'unknown'}:${name}`;
  }
  function setJSON(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }
  function getJSON(key, fallback = null) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    } catch (_) {
      return fallback;
    }
  }
  function setStatus(text, bad = false) {
    const node = document.getElementById(STATUS);
    if (!node) return;
    node.textContent = text;
    node.dataset.bad = bad ? '1' : '0';
  }
  function setRunning(value) {
    running = value;
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    panel.querySelectorAll('button[data-action]').forEach((button) => {
      if (button.dataset.action === 'stop') button.disabled = !running;
      else button.disabled = running;
    });
  }

  function installStyle() {
    if (!document.head || document.getElementById(STYLE)) return;
    const style = document.createElement('style');
    style.id = STYLE;
    style.textContent = `
      #mumei-card-system-toggle,#mumei-direct-success-panel,#mumei-direct-success-btn,
      #mumei-notify-test-panel,#mumei-notify-test-btn,#mumei-notify-clean-btn,
      #mumei-bridge610-panel,#mumei-bridge610-btn,#mumei-bridge107-btn,
      #mumei-notify-toggle-v720,#mumei-notify-panel-v720{display:none!important}
      #${TOGGLE}{position:fixed;right:5px;bottom:76px;z-index:2147483647;width:34px;height:34px;border:0;
        border-radius:999px;background:#374151;color:#fff;font:800 15px/34px system-ui;padding:0;
        box-shadow:0 3px 10px rgba(0,0,0,.3);touch-action:manipulation}
      #${PANEL}{position:fixed;right:5px;bottom:76px;z-index:2147483647;display:none;gap:3px;align-items:center;
        height:38px;padding:4px;border-radius:10px;background:#111827;box-shadow:0 3px 12px rgba(0,0,0,.34)}
      #${PANEL}[data-open="1"]{display:flex}
      #${PANEL} button{height:30px;border:0;border-radius:7px;padding:0 8px;color:#fff;background:#374151;
        font:800 10px/30px system-ui;touch-action:manipulation;white-space:nowrap}
      #${PANEL} button[data-action="notify"]{background:#2563eb}
      #${PANEL} button[data-action="clean"]{background:#7c3aed}
      #${PANEL} button[data-action="reset"]{background:#92400e}
      #${PANEL} button:disabled{opacity:.4}
      #${STATUS}{position:fixed;right:5px;bottom:119px;z-index:2147483647;display:none;max-width:min(310px,calc(100vw - 16px));
        padding:6px 8px;border-radius:7px;background:#064e3b;color:#fff;font:700 10px/1.4 system-ui;
        box-shadow:0 2px 8px rgba(0,0,0,.25)}
      #${PANEL}[data-open="1"] #${STATUS}{display:block}
      #${STATUS}[data-bad="1"]{background:#991b1b}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    if (!document.body || !isEditPage()) return;
    installStyle();
    let toggle = document.getElementById(TOGGLE);
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.id = TOGGLE;
      toggle.type = 'button';
      toggle.textContent = '⛓';
      toggle.title = '通知10件 FINAL 8.0';
      toggle.addEventListener('click', () => {
        opened = !opened;
        const panel = document.getElementById(PANEL);
        if (panel) panel.dataset.open = opened ? '1' : '0';
        toggle.style.display = opened ? 'none' : 'block';
      });
      document.body.appendChild(toggle);
    }
    let panel = document.getElementById(PANEL);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL;
      panel.dataset.open = '0';
      panel.innerHTML = `
        <button type="button" data-action="notify">10通知</button>
        <button type="button" data-action="clean">削→極薄</button>
        <button type="button" data-action="reset">初</button>
        <button type="button" data-action="stop" disabled>止</button>
        <button type="button" data-action="close">×</button>
        <div id="${STATUS}" data-bad="0">FINAL 8.0｜10件専用</div>`;
      panel.addEventListener('click', onPanelClick);
      document.body.appendChild(panel);
    }
  }

  function onPanelClick(event) {
    const button = event.target?.closest?.('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'close') {
      opened = false;
      const panel = document.getElementById(PANEL);
      const toggle = document.getElementById(TOGGLE);
      if (panel) panel.dataset.open = '0';
      if (toggle) toggle.style.display = 'block';
      return;
    }
    if (action === 'stop') {
      runToken += 1;
      setStatus('停止しました', true);
      setRunning(false);
      return;
    }
    if (action === 'notify') startNotification();
    if (action === 'clean') cleanupToThin();
    if (action === 'reset') resetTargets();
  }

  function bodyFields(body) {
    const output = {};
    try {
      if (body && typeof body.entries === 'function') {
        for (const [key, value] of body.entries()) {
          if (typeof value === 'string') output[key] = value;
        }
      } else if (typeof body === 'string') {
        try { Object.assign(output, JSON.parse(body)); } catch (_) {}
      }
    } catch (_) {}
    return output;
  }
  function isEmbedEndpoint(url, method) {
    return /\/api\/v1\/embed(?:\?|$)/.test(String(url || '')) && String(method || 'GET').toUpperCase() === 'POST';
  }
  function embeddedPayload(json) {
    return json?.data?.embedded_content || json?.embedded_content || null;
  }
  function recordApiProof(fields, json) {
    const embedded = embeddedPayload(json);
    if (!embedded?.key) return;
    const url = normalizeUrl(embedded.url || fields?.url || '');
    if (!url) return;
    API_PROOF.set(url, {
      key: String(embedded.key),
      sourceKey: String(fields?.embeddable_key || ''),
      at: Date.now()
    });
  }
  function installNetworkProof() {
    if (networkInstalled) return;
    networkInstalled = true;

    const nativeFetch = page.fetch?.bind(page);
    if (nativeFetch) {
      page.fetch = async function final800Fetch(input, init) {
        const url = input instanceof page.Request ? input.url : String(input);
        const method = init?.method || (input instanceof page.Request ? input.method : 'GET');
        const wanted = isEmbedEndpoint(url, method);
        let fields = wanted ? bodyFields(init?.body) : {};
        if (wanted && input instanceof page.Request && !Object.keys(fields).length) {
          try {
            const clone = input.clone();
            const type = clone.headers.get('content-type') || '';
            if (type.includes('form')) fields = bodyFields(await clone.formData());
            else if (type.includes('json')) fields = await clone.json();
          } catch (_) {}
        }
        const response = await nativeFetch(input, init);
        if (wanted && response.ok) {
          try { recordApiProof(fields, await response.clone().json()); } catch (_) {}
        }
        return response;
      };
    }

    const proto = page.XMLHttpRequest?.prototype;
    if (proto) {
      const nativeOpen = proto.open;
      const nativeSend = proto.send;
      proto.open = function final800Open(method, url, ...rest) {
        this.__mumei800 = { method: String(method || 'GET'), url: String(url || '') };
        return nativeOpen.call(this, method, url, ...rest);
      };
      proto.send = function final800Send(body) {
        const meta = this.__mumei800;
        if (meta && isEmbedEndpoint(meta.url, meta.method)) {
          const fields = bodyFields(body);
          this.addEventListener('load', () => {
            if (this.status < 200 || this.status >= 300) return;
            try { recordApiProof(fields, JSON.parse(this.responseText || '{}')); } catch (_) {}
          }, { once: true });
        }
        return nativeSend.call(this, body);
      };
    }
  }
  installNetworkProof();

  function webpackRequire() {
    const chunks = page.webpackChunk_N_E;
    if (!chunks || typeof chunks.push !== 'function') return null;
    let req = null;
    const id = 980000000 + Math.floor(Math.random() * 10000000);
    try { chunks.push([[id], {}, (runtimeRequire) => { req = runtimeRequire; }]); } catch (_) {}
    return req;
  }
  function core() {
    if (coreCache) return coreCache;
    const req = webpackRequire();
    if (!req) throw new FatalError('note内部処理を取得できません。画面を再読込してください');
    let editorModule, stateModule, schemaModule, htmlModule;
    try { editorModule = req(94928); } catch (_) {}
    try { stateModule = req(44044); } catch (_) {}
    try { schemaModule = req(35130); } catch (_) {}
    try { htmlModule = req(51910); } catch (_) {}
    const upload = editorModule?.CwN;
    const link = editorModule?.$2m;
    const keymap = editorModule?.Btr;
    const NodeSelection = stateModule?.qv;
    const Selection = stateModule?.Y1;
    const TextSelection = stateModule?.Bs;
    const serialize = schemaModule?.BF;
    const normalizeDOM = htmlModule?.zc;
    const cleanHTML = htmlModule?.jF;
    if (typeof upload !== 'function' || typeof link !== 'function' || typeof keymap !== 'function' ||
      typeof NodeSelection?.create !== 'function' || typeof Selection?.atEnd !== 'function' ||
      typeof TextSelection?.create !== 'function' || typeof serialize !== 'function' ||
      typeof normalizeDOM !== 'function' || typeof cleanHTML !== 'function') {
      throw new FatalError('note内部モジュールが現在の画面と一致しません。公開・更新しないでください');
    }
    coreCache = { upload, link, keymap, NodeSelection, Selection, TextSelection, serialize, normalizeDOM, cleanHTML };
    return coreCache;
  }

  function looksLikeView(value) {
    try {
      return Boolean(value && typeof value === 'object' && value.state?.doc && value.state?.schema &&
        typeof value.dispatch === 'function' && value.dom && typeof value.posAtDOM === 'function');
    } catch (_) {
      return false;
    }
  }
  function findView() {
    if (looksLikeView(viewCache) && viewCache.dom?.isConnected) return viewCache;
    const root = editor();
    if (!root) return null;

    // まず浅い探索。Androidで長時間固まらせない。
    const seeds = [];
    let node = root;
    for (let i = 0; i < 5 && node; i += 1, node = node.parentElement) seeds.push(node);
    for (const seed of seeds) {
      let keys = [];
      try { keys = Object.getOwnPropertyNames(seed); } catch (_) {}
      for (const key of keys) {
        let value;
        try { value = seed[key]; } catch (_) { continue; }
        if (looksLikeView(value)) return (viewCache = value);
        if (looksLikeView(value?.view)) return (viewCache = value.view);
        if (looksLikeView(value?.editorView)) return (viewCache = value.editorView);
      }
    }

    // 必要時だけ制限付き探索。
    const seen = new Set();
    const queue = seeds.map((seed) => [seed, 0]);
    let steps = 0;
    while (queue.length && steps < 4500) {
      steps += 1;
      const [value, depth] = queue.shift();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      if (looksLikeView(value)) return (viewCache = value);
      let keys = [];
      try { keys = Object.getOwnPropertyNames(value); } catch (_) { continue; }
      for (const key of keys) {
        if (['window', 'document', 'ownerDocument', 'parentNode', 'children', 'childNodes', 'style'].includes(key)) continue;
        let next;
        try { next = value[key]; } catch (_) { continue; }
        if (looksLikeView(next)) return (viewCache = next);
        if (depth < 6 && next && (typeof next === 'object' || typeof next === 'function') && next !== page && next !== document) {
          queue.push([next, depth + 1]);
        }
      }
    }
    return null;
  }

  function imageNodes(view) {
    const output = [];
    view.state.doc.descendants((node, pos) => {
      if (node.type?.name === 'image') output.push({ node, pos });
    });
    return output;
  }
  function embedNodes(view) {
    const output = [];
    view.state.doc.descendants((node, pos) => {
      if (node.type?.name === 'embed') output.push({ node, pos });
    });
    return output;
  }
  function officialCards(view, url) {
    const wanted = normalizeUrl(url);
    return embedNodes(view).filter((entry) => normalizeUrl(entry.node.attrs?.src) === wanted &&
      Boolean(entry.node.attrs?.htmlForEmbed) && Boolean(entry.node.attrs?.embeddedContentKey));
  }
  function findLinkedImage(view, url) {
    const wanted = normalizeUrl(url);
    return imageNodes(view).find((entry) => normalizeUrl(entry.node.attrs?.link) === wanted) || null;
  }
  function exactUrlParagraphs(view, url) {
    const wanted = normalizeUrl(url);
    const output = [];
    view.state.doc.descendants((node, pos) => {
      if (node.isTextblock && normalizeUrl((node.textContent || '').trim()) === wanted) output.push({ node, pos });
    });
    return output;
  }
  function deleteBlocks(view, hits) {
    const unique = new Map();
    for (const hit of hits) if (hit?.node) unique.set(`${hit.pos}:${hit.node.nodeSize}`, hit);
    if (!unique.size) return 0;
    let tr = view.state.tr;
    [...unique.values()].sort((a, b) => b.pos - a.pos).forEach((hit) => {
      tr = tr.delete(hit.pos, hit.pos + hit.node.nodeSize);
    });
    view.dispatch(tr.scrollIntoView());
    return unique.size;
  }
  function ensureFreshParagraph(view) {
    const paragraph = view.state.schema.nodes.paragraph;
    if (!paragraph) throw new FatalError('本文paragraphなし');
    if (view.state.doc.lastChild?.type !== paragraph || view.state.doc.lastChild.textContent !== '') {
      view.dispatch(view.state.tr.insert(view.state.doc.content.size, paragraph.create()));
    }
    view.dispatch(view.state.tr.setSelection(core().Selection.atEnd(view.state.doc)).scrollIntoView());
    view.focus();
  }
  async function waitFor(test, timeout, interval = 140) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const value = test();
      if (value) return value;
      await sleep(interval);
    }
    return null;
  }

  async function createOfficialCard(view, item, token) {
    const url = item.url;
    const existing = officialCards(view, url);
    if (existing.length === 1) {
      const card = existing[0];
      const proof = API_PROOF.get(normalizeUrl(url));
      if (proof && proof.key === String(card.node.attrs?.embeddedContentKey || '')) return card;
      deleteBlocks(view, existing);
    } else if (existing.length > 1) {
      deleteBlocks(view, existing);
    }
    deleteBlocks(view, exactUrlParagraphs(view, url));
    API_PROOF.delete(normalizeUrl(url));

    ensureFreshParagraph(view);
    let tr = view.state.tr.insertText(url);
    tr = tr.setSelection(core().TextSelection.create(tr.doc, tr.selection.head));
    view.dispatch(tr.scrollIntoView());
    view.focus();

    const enter = core().keymap(view.state.schema)?.Enter;
    if (typeof enter !== 'function') throw new FatalError('note正規Enterコマンドなし');
    const handled = enter(view.state, (next) => view.dispatch(next), view);
    if (!handled) throw new Error(`${item.index}/10 note正規Enterが拒否されました`);

    const result = await waitFor(() => {
      if (token !== runToken) throw new FatalError('停止しました');
      const cards = officialCards(view, url);
      if (cards.length !== 1) return null;
      const card = cards[0];
      const key = String(card.node.attrs?.embeddedContentKey || '');
      const proof = API_PROOF.get(normalizeUrl(url));
      if (!proof || proof.key !== key) return null;
      if (exactUrlParagraphs(view, url).length) return null;
      return card;
    }, 45000, 160);
    if (!result) throw new FatalError(`${item.index}/10 正規カードまたはAPI登録を確認できません`);
    return result;
  }

  function serializedBody(view) {
    const fragment = core().serialize(view.state);
    const holder = document.createElement('div');
    holder.appendChild(fragment);
    core().normalizeDOM(holder);
    return core().cleanHTML(holder.innerHTML);
  }
  function verifyNotification(view) {
    const keys = new Set();
    const bad = [];
    for (const item of TEST_ITEMS) {
      const cards = officialCards(view, item.url);
      const raw = exactUrlParagraphs(view, item.url);
      const linked = findLinkedImage(view, item.url);
      if (cards.length !== 1 || raw.length || linked) {
        bad.push(item.index);
        continue;
      }
      const key = String(cards[0].node.attrs?.embeddedContentKey || '');
      if (!key || keys.has(key)) bad.push(item.index);
      keys.add(key);
    }
    if (bad.length) throw new FatalError(`通知本文不一致: ${bad.join(',')}`);
    const body = serializedBody(view);
    const absent = TEST_ITEMS.filter((item) => !body.includes(item.url));
    if (absent.length) throw new FatalError(`保存HTMLカード不足: ${absent.map((x) => x.index).join(',')}`);
    return body;
  }
  function verifyFinal(view) {
    const bad = [];
    for (const item of TEST_ITEMS) {
      if (officialCards(view, item.url).length || exactUrlParagraphs(view, item.url).length || !findLinkedImage(view, item.url)) {
        bad.push(item.index);
      }
    }
    if (bad.length) throw new FatalError(`最終状態不一致: ${bad.join(',')}`);
    return serializedBody(view);
  }
  async function saveDraft(view, token, verifier, label) {
    verifier(view);
    setStatus(label);
    const save = await waitFor(() => typeof page.noteEditor?.registerNoteDraft === 'function' ? page.noteEditor.registerNoteDraft : null, 12000, 200);
    if (token !== runToken) throw new FatalError('停止しました');
    if (save) {
      const result = await save('auto');
      if (!result || result.result !== true) throw new FatalError('下書き保存の成功応答なし');
    } else {
      const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === '一時保存');
      if (!button || button.disabled) throw new FatalError('保存処理を取得できません');
      button.click();
      await sleep(5000);
    }
    if (token !== runToken) throw new FatalError('停止しました');
    verifier(view);
  }

  function contamination(view) {
    const bad = [];
    for (const item of TEST_ITEMS) {
      if (officialCards(view, item.url).length || exactUrlParagraphs(view, item.url).length || findLinkedImage(view, item.url)) bad.push(item.index);
    }
    return bad;
  }

  async function startNotification() {
    if (running) return;
    setRunning(true);
    const token = ++runToken;
    try {
      const view = findView();
      if (!view) throw new FatalError('EditorViewなし。画面を再読込してください');
      core();
      const dirty = contamination(view);
      if (dirty.length) throw new FatalError(`既存テストURLあり(${dirty.join(',')})。「初」→保存→公開更新→戻って10通知`);
      API_PROOF.clear();
      const keys = [];
      for (let i = 0; i < TEST_ITEMS.length; i += 1) {
        if (token !== runToken) throw new FatalError('停止しました');
        setStatus(`${i + 1}/10｜note正規カード＋API登録中…`);
        const card = await createOfficialCard(view, TEST_ITEMS[i], token);
        keys.push(String(card.node.attrs?.embeddedContentKey || ''));
        await sleep(180);
      }
      if (new Set(keys).size !== 10) throw new FatalError('埋め込みキーが10件固有ではありません');
      await saveDraft(view, token, verifyNotification, '10/10｜正規カードだけを保存中…');
      setJSON(stateKey('notify'), { at: Date.now(), keys, proof: 'api+card+save' });
      setStatus('10/10｜正規カード＋API登録＋保存 ✅ 公開して通知確認');
    } catch (error) {
      setStatus(`停止：${error?.message || String(error)}（公開しない）`, true);
    } finally {
      setRunning(false);
    }
  }

  function xhr(url, responseType = 'text') {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, responseType, timeout: 25000,
        onload: (response) => response.status >= 200 && response.status < 300 ? resolve(response.response) : reject(new Error(`取得失敗 ${response.status}`)),
        onerror: () => reject(new Error('通信失敗')),
        ontimeout: () => reject(new Error('通信タイムアウト'))
      });
    });
  }
  function metaContent(html, property) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.querySelector(`meta[property="${property}"]`)?.content || doc.querySelector(`meta[name="${property}"]`)?.content || '';
  }
  async function bitmap(blob) {
    if (typeof page.createImageBitmap === 'function') return page.createImageBitmap(blob);
    return new Promise((resolve, reject) => {
      const image = new page.Image();
      const objectUrl = URL.createObjectURL(blob);
      image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('画像読込失敗')); };
      image.src = objectUrl;
    });
  }
  function roundedRect(ctx, x, y, w, h, r) {
    const q = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + q, y);
    ctx.arcTo(x + w, y, x + w, y + h, q);
    ctx.arcTo(x + w, y + h, x, y + h, q);
    ctx.arcTo(x, y + h, x, y, q);
    ctx.arcTo(x, y, x + w, y, q);
    ctx.closePath();
  }
  function textLines(ctx, text, maxWidth, maxLines) {
    const output = [];
    let line = '';
    for (const ch of [...text]) {
      const test = line + ch;
      if (line && ctx.measureText(test).width > maxWidth) {
        output.push(line);
        line = ch;
        if (output.length === maxLines - 1) break;
      } else line = test;
    }
    if (output.length < maxLines && line) {
      let rest = [...text].slice(output.join('').length).join('');
      if (ctx.measureText(rest).width > maxWidth) {
        while (rest && ctx.measureText(`${rest}…`).width > maxWidth) rest = rest.slice(0, -1);
        rest += '…';
      }
      output.push(rest);
    }
    return output.slice(0, maxLines);
  }
  async function makeCard(item) {
    const html = await xhr(item.url, 'text');
    const thumb = metaContent(html, 'og:image');
    if (!thumb) throw new Error(`${item.index} サムネ取得失敗`);
    const image = await bitmap(await xhr(thumb, 'blob'));
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
    const tw = 320, th = 124, tx = W - tw - 8, ty = 8, textX = 16, textWidth = tx - textX - 12;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#171b21';
    ctx.font = '700 18px system-ui,-apple-system,sans-serif';
    textLines(ctx, item.title, textWidth, 3).forEach((line, index) => ctx.fillText(line, textX, 12 + index * 24));
    ctx.fillStyle = '#626975';
    ctx.font = '14px system-ui,-apple-system,sans-serif';
    ctx.fillText(CREATOR, textX, 110);
    const iw = image.width || image.naturalWidth;
    const ih = image.height || image.naturalHeight;
    const scale = Math.min(tw / iw, th / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.fillStyle = '#f7f8fa';
    roundedRect(ctx, tx, ty, tw, th, 8);
    ctx.fill();
    ctx.save();
    roundedRect(ctx, tx, ty, tw, th, 8);
    ctx.clip();
    ctx.drawImage(image, tx + (tw - dw) / 2, ty + (th - dh) / 2, dw, dh);
    ctx.restore();
    if (image.close) image.close();
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('カード生成失敗')), 'image/png', 1));
    return new page.File([blob], `${String(item.index).padStart(2, '0')}_thin.png`, { type: 'image/png' });
  }

  function remoteImage(node) {
    const src = String(node?.attrs?.src || '');
    return /^https:\/\//i.test(src) && !/^https:\/\/editor\.note\.com\/icons\//i.test(src);
  }
  async function makeFiles(token) {
    const files = [];
    for (let i = 0; i < TEST_ITEMS.length; i += 1) {
      if (token !== runToken) throw new FatalError('停止しました');
      setStatus(`${i + 1}/10｜極薄画像を準備中…`);
      files.push(await makeCard(TEST_ITEMS[i]));
    }
    return files;
  }
  async function uploadBatch(view, files, token) {
    ensureFreshParagraph(view);
    const beforeIds = new Set(imageNodes(view).map((entry) => String(entry.node.attrs?.id || '')));
    const ok = core().upload(view, files, view.state.selection.head);
    if (!ok) throw new FatalError('note標準の10枚一括画像追加が拒否されました');
    const created = await waitFor(() => {
      if (token !== runToken) throw new FatalError('停止しました');
      const list = imageNodes(view).filter((entry) => {
        const id = String(entry.node.attrs?.id || '');
        return id && !beforeIds.has(id);
      }).sort((a, b) => a.pos - b.pos);
      return list.length >= 10 ? list.slice(0, 10) : null;
    }, 25000, 180);
    if (!created) throw new FatalError('極薄画像ノード10枚を確認できません');

    const ids = created.map((entry) => String(entry.node.attrs?.id || ''));
    const uploaded = await waitFor(() => {
      if (token !== runToken) throw new FatalError('停止しました');
      const now = ids.map((id) => imageNodes(view).find((entry) => String(entry.node.attrs?.id || '') === id));
      return now.every((entry) => entry && remoteImage(entry.node)) ? now : null;
    }, 90000, 220);
    if (!uploaded) throw new FatalError('極薄画像10枚のアップロード完了を確認できません');
    return uploaded.sort((a, b) => a.pos - b.pos);
  }
  async function applyLink(view, hit, url) {
    const id = String(hit.node.attrs?.id || '');
    const latest = imageNodes(view).find((entry) => String(entry.node.attrs?.id || '') === id) || hit;
    view.dispatch(view.state.tr.setSelection(core().NodeSelection.create(view.state.doc, latest.pos)).scrollIntoView());
    view.focus();
    const command = core().link(new page.URL(url));
    if (!command(view.state, (tr) => view.dispatch(tr))) throw new FatalError('note標準リンク設定が拒否されました');
    const verified = await waitFor(() => {
      const current = imageNodes(view).find((entry) => String(entry.node.attrs?.id || '') === id);
      return current && normalizeUrl(current.node.attrs?.link) === normalizeUrl(url) ? current : null;
    }, 5000, 100);
    if (!verified) throw new FatalError('極薄画像のリンク確定を確認できません');
    return verified;
  }
  function compactBatchGaps(view, ids) {
    const idSet = new Set(ids);
    const top = [];
    view.state.doc.forEach((node, offset) => top.push({ node, pos: offset }));
    const isTargetImage = (entry) => entry?.node?.type?.name === 'image' && idSet.has(String(entry.node.attrs?.id || ''));
    const deletions = [];
    for (let i = 0; i < top.length; i += 1) {
      const entry = top[i];
      if (entry.node.type?.name !== 'paragraph' || entry.node.textContent !== '') continue;
      let p = i - 1;
      while (p >= 0 && top[p].node.type?.name === 'paragraph' && top[p].node.textContent === '') p -= 1;
      let n = i + 1;
      while (n < top.length && top[n].node.type?.name === 'paragraph' && top[n].node.textContent === '') n += 1;
      if (isTargetImage(top[p]) && isTargetImage(top[n])) deletions.push(entry);
    }
    if (!deletions.length) return 0;
    let tr = view.state.tr;
    deletions.sort((a, b) => b.pos - a.pos).forEach((entry) => {
      tr = tr.delete(entry.pos, entry.pos + entry.node.nodeSize);
    });
    view.dispatch(tr);
    return deletions.length;
  }

  async function cleanupToThin() {
    if (running) return;
    setRunning(true);
    const token = ++runToken;
    try {
      const view = findView();
      if (!view) throw new FatalError('EditorViewなし。画面を再読込してください');
      core();
      const invalid = TEST_ITEMS.filter((item) => officialCards(view, item.url).length !== 1);
      if (invalid.length) throw new FatalError(`標準カード不足(${invalid.map((x) => x.index).join(',')})。通知確認後の本文で実行してください`);
      const existingLinked = TEST_ITEMS.filter((item) => findLinkedImage(view, item.url));
      if (existingLinked.length) throw new FatalError(`極薄リンクが既にあります(${existingLinked.map((x) => x.index).join(',')})。「初」で整理してください`);

      const files = await makeFiles(token);
      setStatus('10/10｜極薄10枚を一括追加中…');
      let images = await uploadBatch(view, files, token);
      const ids = images.map((entry) => String(entry.node.attrs?.id || ''));
      for (let i = 0; i < 10; i += 1) {
        if (token !== runToken) throw new FatalError('停止しました');
        setStatus(`${i + 1}/10｜極薄リンク設定中…`);
        images[i] = await applyLink(view, images[i], TEST_ITEMS[i].url);
      }
      const cards = TEST_ITEMS.flatMap((item) => officialCards(view, item.url));
      const raws = TEST_ITEMS.flatMap((item) => exactUrlParagraphs(view, item.url));
      const removed = deleteBlocks(view, [...cards, ...raws]);
      if (removed < 10) throw new FatalError(`標準カード削除数不足 ${removed}/10`);
      compactBatchGaps(view, ids);
      await saveDraft(view, token, verifyFinal, '標準カード削除＋極薄10枚リンクを保存中…');
      setJSON(stateKey('final'), { at: Date.now(), ids });
      setStatus('標準カード10件削除＋極薄10枚リンク＋保存 ✅ 更新できます');
    } catch (error) {
      setStatus(`停止：${error?.message || String(error)}（更新しない）`, true);
    } finally {
      setRunning(false);
    }
  }

  async function resetTargets() {
    if (running) return;
    setRunning(true);
    const token = ++runToken;
    try {
      const view = findView();
      if (!view) throw new FatalError('EditorViewなし。画面を再読込してください');
      core();
      const hits = [];
      for (const item of TEST_ITEMS) {
        hits.push(...officialCards(view, item.url));
        hits.push(...exactUrlParagraphs(view, item.url));
        const linked = findLinkedImage(view, item.url);
        if (linked) hits.push(linked);
      }
      const removed = deleteBlocks(view, hits);
      ensureFreshParagraph(view);
      await saveDraft(view, token, () => {
        const dirty = contamination(view);
        if (dirty.length) throw new FatalError(`初期化残り: ${dirty.join(',')}`);
        return serializedBody(view);
      }, 'テストURLを消して保存中…');
      API_PROOF.clear();
      setJSON(stateKey('notify'), null);
      setJSON(stateKey('final'), null);
      setStatus(`初期化＋保存 ✅（${removed}ブロック削除）公開更新→戻って「10通知」`);
    } catch (error) {
      setStatus(`初期化停止：${error?.message || String(error)}`, true);
    } finally {
      setRunning(false);
    }
  }

  function route() {
    if (!isEditPage()) return;
    if (!document.getElementById(TOGGLE) || !document.getElementById(PANEL)) mount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
  setInterval(route, 700);
})();
