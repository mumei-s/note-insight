(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_SUMMER107_151_FIX__) return;
  page.__MUMEI_SUMMER107_151_FIX__ = true;

  const PANEL = 'summer107-panel-v1500';
  const STATUS = 'summer107-status-v1500';
  const TOGGLE = 'summer107-toggle-v1500';
  const MANIFEST_URL = 'https://mumei-s.github.io/note-insight/note-summer-107/manifest.json';
  const EXPECTED = 107;

  let bypass = false;
  let busy = false;
  let targetSet = null;
  let viewCache = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, location.href);
      url.search = '';
      url.hash = '';
      return url.href;
    } catch (_) {
      return raw;
    }
  }

  function setStatus(text, bad = false) {
    const node = document.getElementById(STATUS);
    if (!node) return;
    node.textContent = text;
    node.dataset.bad = bad ? '1' : '0';
    node.dataset.open = '1';
  }

  function request(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'text',
        timeout: 45000,
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve(res.responseText || res.response || '');
          else reject(new Error(`manifest GET ${res.status}`));
        },
        onerror: () => reject(new Error('manifest通信失敗')),
        ontimeout: () => reject(new Error('manifest通信タイムアウト'))
      });
    });
  }

  async function loadTargets() {
    if (targetSet?.size === EXPECTED) return targetSet;
    const text = await request(MANIFEST_URL);
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error('manifest解析失敗'); }
    if (!Array.isArray(data?.items) || data.items.length !== EXPECTED) {
      throw new Error(`manifest件数不一致 ${data?.items?.length || 0}/${EXPECTED}`);
    }
    const set = new Set(data.items.map((item) => normalizeUrl(item?.url)).filter(Boolean));
    if (set.size !== EXPECTED) throw new Error(`manifest URL一意性不一致 ${set.size}/${EXPECTED}`);
    targetSet = set;
    return targetSet;
  }

  function editor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') ||
      document.querySelector('.ProseMirror');
  }

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
        if (depth < 7 && next && (typeof next === 'object' || typeof next === 'function') &&
          next !== page && next !== document) queue.push([next, depth + 1]);
      }
    }
    return null;
  }

  function collectTargetArtifacts(view, targets) {
    const hits = [];
    let cards = 0;
    let urls = 0;

    view.state.doc.descendants((node, pos) => {
      if (node.type?.name === 'embed') {
        const src = normalizeUrl(node.attrs?.src);
        if (targets.has(src) && node.attrs?.htmlForEmbed && node.attrs?.embeddedContentKey) {
          hits.push({ node, pos });
          cards += 1;
        }
        return;
      }

      if (!node.isTextblock) return;
      const text = node.textBetween(0, node.content.size, '\n', '\n').trim();
      if (!text) return;
      const tokens = text.split(/\s+/).filter(Boolean);
      if (tokens.length && tokens.every((token) => targets.has(normalizeUrl(token)))) {
        hits.push({ node, pos });
        urls += tokens.length;
      }
    });

    return { hits, cards, urls };
  }

  function deleteHits(view, hits) {
    const unique = new Map();
    hits.forEach((hit) => {
      if (hit?.node) unique.set(`${hit.pos}:${hit.node.nodeSize}`, hit);
    });
    if (!unique.size) return 0;
    let tr = view.state.tr;
    [...unique.values()].sort((a, b) => b.pos - a.pos).forEach((hit) => {
      tr = tr.delete(hit.pos, hit.pos + hit.node.nodeSize);
    });
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return unique.size;
  }

  async function cleanupThenRun(button) {
    busy = true;
    try {
      const targets = await loadTargets();
      const view = findView();
      if (!view) throw new Error('EditorViewなし。画面を再読込してください');

      const found = collectTargetArtifacts(view, targets);
      if (found.hits.length) {
        deleteHits(view, found.hits);
        setStatus(`夏107対象の既存カード${found.cards}件${found.urls ? `・URL${found.urls}件` : ''}だけ整理 ✅ 既存本文は保持`);
        await sleep(250);
      }

      bypass = true;
      button.click();
      bypass = false;
    } catch (error) {
      bypass = false;
      setStatus(`画像準備停止：${error?.message || String(error)}`, true);
    } finally {
      busy = false;
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.(`#${PANEL} button[data-action="images"]`);
    if (!button || bypass) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy) return;
    cleanupThenRun(button);
  }, true);

  setInterval(() => {
    const toggle = document.getElementById(TOGGLE);
    if (toggle) toggle.title = '夏の陣107 COMPLETE 15.1';
  }, 800);
})();
