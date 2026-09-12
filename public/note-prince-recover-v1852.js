(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_PRINCE_RECOVER_1852__) return;
  page.__MUMEI_PRINCE_RECOVER_1852__ = true;

  const VERSION = '18.5.2';
  const BASE_VERSION = '16.0.0';
  const BASE_SOURCE_KEY = 'n08825c632afd';
  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const PANEL = 'mumei-note-source-picker-v163';
  const STATUS = 'mumei-note-source-status-v163';
  const SPECIAL = 'mumei-prince-special-v184';
  let viewCache = null;
  let attempted = false;

  function articleKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }
  function enabled() {
    return /^\/notes\/n[a-z0-9]{8,}\/edit\/?$/i.test(location.pathname) && Boolean(articleKey());
  }
  function runKey() { return `${RUN_PREFIX}:${articleKey() || 'unknown'}`; }
  function getJSON(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch (_) { return fallback; }
  }
  function setJSON(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
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
  function isNoteArticleUrl(value) {
    return /^https?:\/\/(?:www\.)?note\.com\/[^/?#]+\/n\/n[a-f0-9]{12}(?:[/?#]|$)/i.test(String(value || ''));
  }
  function noteKey(value) {
    return String(value || '').match(/\/n\/(n[a-f0-9]{12})(?:[/?#]|$)/i)?.[1] || '';
  }
  function urlname(value) {
    return String(value || '').match(/^https?:\/\/(?:www\.)?note\.com\/([^/?#]+)\/n\//i)?.[1] || '';
  }
  function status(text, bad = false) {
    for (const id of [STATUS, 'mumei-likers-thin-status-v160']) {
      const el = document.getElementById(id);
      if (el) { el.textContent = text; el.dataset.bad = bad ? '1' : '0'; }
    }
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
  function genuineCard(hit) {
    const key = cardKey(hit), html = String(hit?.node?.attrs?.htmlForEmbed || '');
    return isNoteArticleUrl(cardUrl(hit)) && /^emb[a-z0-9]+$/i.test(key) && html.includes('note-embed');
  }
  function remoteImage(node) {
    const src = String(node?.attrs?.src || '');
    return /^https:\/\//i.test(src) && !/^https:\/\/editor\.note\.com\/icons\//i.test(src);
  }
  function validState() {
    const dataset = getJSON(DATA_KEY, null), run = getJSON(runKey(), null);
    return Boolean(dataset?.version === BASE_VERSION && Array.isArray(dataset?.rows) && dataset.rows.length && run?.datasetId === dataset.datasetId);
  }

  function recoverFromDocument(showAlert = false) {
    if (!enabled()) return false;
    if (validState()) return true;
    const view = findView();
    if (!view) return false;

    const cards = embedNodes(view).filter(genuineCard);
    const cardMap = new Map();
    for (const hit of cards) {
      const url = cardUrl(hit);
      if (url && !cardMap.has(url)) cardMap.set(url, hit);
    }

    const pairs = [];
    const seen = new Set();
    for (const hit of imageNodes(view).sort((a, b) => a.pos - b.pos)) {
      if (!remoteImage(hit.node)) continue;
      const url = normalizeUrl(hit.node.attrs?.link);
      if (!isNoteArticleUrl(url) || seen.has(url)) continue;
      const card = cardMap.get(url);
      if (!card) continue;
      seen.add(url);
      pairs.push({ image: hit, card, url });
    }
    if (!pairs.length) return false;

    const rows = pairs.map((pair, index) => {
      const name = urlname(pair.url);
      return {
        index: index + 1,
        url: pair.url,
        latestKey: noteKey(pair.url),
        urlname: name,
        likerKey: name || noteKey(pair.url),
        creator: name || 'noteクリエイター',
        actorUrl: name ? `https://note.com/${name}` : '',
        actorImageUrl: '',
        title: '#王子ごっこ 既存記事',
        publishAt: null,
        thumbUrl: String(pair.image.node.attrs?.src || ''),
        combinedSource: 'hashtag-recovered'
      };
    });
    const images = {};
    const cardKeys = [];
    for (const pair of pairs) {
      images[pair.url] = {
        id: String(pair.image.node.attrs?.id || ''),
        src: String(pair.image.node.attrs?.src || '')
      };
      cardKeys.push({ url: pair.url, key: cardKey(pair.card) });
    }

    const datasetId = `prince-recovered:${Date.now()}:${rows.length}`;
    setJSON(DATA_KEY, {
      version: BASE_VERSION,
      datasetId,
      sourceKey: BASE_SOURCE_KEY,
      sourceUrl: 'https://note.com/hashtag/%E7%8E%8B%E5%AD%90%E3%81%94%E3%81%A3%E3%81%93',
      sourceMode: 'prince-hashtag-recovered',
      actualSourceKey: '王子ごっこ',
      amountMode: 'all',
      requestedCount: null,
      articleChoice: 'tag-direct',
      extractedAt: new Date().toISOString(),
      recoveredAt: new Date().toISOString(),
      count: rows.length,
      rows
    });
    setJSON(runKey(), {
      version: BASE_VERSION,
      articleKey: articleKey(),
      datasetId,
      stage: 'cards_ready',
      images,
      cardKeys,
      pending: null,
      createdAt: new Date().toISOString(),
      recoveredAt: new Date().toISOString(),
      sourceMode: 'prince-hashtag-recovered',
      sourceUrl: 'https://note.com/hashtag/%E7%8E%8B%E5%AD%90%E3%81%94%E3%81%A3%E3%81%93',
      amountMode: 'all',
      requestedCount: null,
      articleChoice: 'tag-direct'
    });
    status(`#王子ごっこ状態を本文から復元 ${rows.length}件 ✅ INSIGHT500を追加できます`);
    if (showAlert) page.alert(`#王子ごっこ状態を本文から復元しました。\n\n極薄画像＋URL: ${rows.length}件\n通知カード: ${cardKeys.length}件\n\nこの状態を保持したままINSIGHT500を追加できます。`);
    return true;
  }

  function ensureRecoveryButton() {
    if (!enabled() || validState()) return;
    const panel = document.getElementById(PANEL), box = panel?.querySelector(`.${SPECIAL}`);
    if (!panel || !box) return;
    const row = box.querySelector('.row');
    if (!row || row.querySelector('[data-prince-recover]')) return;
    row.innerHTML = '<button data-prince-recover type="button">♻ 今ある#カードを復元</button>';
    row.style.gridTemplateColumns = '1fr';
    row.querySelector('[data-prince-recover]').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!recoverFromDocument(true)) status('本文内の「極薄画像リンク＋対応noteカード」の組を見つけられませんでした', true);
    });
    const label = box.querySelector('.label');
    if (label) label.textContent = '👑 #は本文にある｜♻ 状態復元';
    const mini = box.querySelector('.mini');
    if (mini) mini.textContent = '更新前の作業データが無くても、本文に残っている極薄画像リンク＋対応カードから復元します。';
  }

  function mount() {
    if (!enabled()) return;
    if (!attempted) {
      attempted = true;
      setTimeout(() => {
        if (!validState()) recoverFromDocument(false);
      }, 1800);
    }
    if (!validState()) ensureRecoveryButton();
  }

  setInterval(mount, 500);
  mount();
})();
