// ==UserScript==
// @name         無名S note 夏の陣107 COMPLETE 15.0
// @namespace    https://github.com/mumei-s/note-insight/batch-bridge-610
// @version      15.0.0
// @description  夏の陣107件専用：加工済み860x140画像→URLリンク→note正規カード107件→投稿前確認→カードのみ一括削除
// @match        https://editor.note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js?v=15.0.0
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js?v=15.0.0
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      mumei-s.github.io
// ==/UserScript==

(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_SUMMER107_15000__) return;
  page.__MUMEI_SUMMER107_15000__ = true;

  [
    '__MUMEI_NOTE_THIN_BATCH_14300__','__MUMEI_NOTE_THIN_BATCH_14200__',
    '__MUMEI_NOTE_THIN_BATCH_14100__','__MUMEI_NOTE_THIN_BATCH_14000__',
    '__MUMEI_NOTE_THIN_BATCH_13200__','__MUMEI_NOTE_THIN_BATCH_13100__',
    '__MUMEI_NOTE_THIN_BATCH_13000__','__MUMEI_NOTE_NEW10_SEND_12100__',
    '__MUMEI_NOTE_NEW10_SEND_12000__','__MUMEI_NOTE_CLEAN_NOTIFY_11100__',
    '__MUMEI_NOTE_CLEAN_NOTIFY_11000__','__MUMEI_NOTIFY_MANUAL_QUEUE_9000__',
    '__MUMEI_NOTIFY_COMPLETE_8300__','__MUMEI_NOTIFY_COMPLETE_8200__',
    '__MUMEI_NOTIFY_COMPLETE_8100__','__MUMEI_DIRECT_SUCCESS_3230__',
    '__MUMEI_DIRECT_SUCCESS_3220__','__MUMEI_DIRECT_SUCCESS_3200__'
  ].forEach((key) => { page[key] = true; });

  const VERSION = '15.0';
  const EXPECTED = 107;
  const W = 860;
  const H = 140;
  const MAGAZINE_URL = 'https://note.com/ai_naoyuki/m/m7ffeddfdfb3c';
  const MANIFEST_URL = 'https://mumei-s.github.io/note-insight/note-summer-107/manifest.json';
  const ASSET_ORIGIN = 'https://mumei-s.github.io/note-insight';

  const TOGGLE = 'summer107-toggle-v1500';
  const PANEL = 'summer107-panel-v1500';
  const STATUS = 'summer107-status-v1500';
  const STYLE = 'summer107-style-v1500';
  const STATE_PREFIX = 'mumei_summer107_state_v1500';

  let rows = [];
  let manifest = null;
  let running = false;
  let runToken = 0;
  let viewCache = null;
  let selectionCache = null;
  let noteUrlCommand = null;
  let imageArm = null;
  let inputObserver = null;
  let nativeInputClick = null;
  let routeTimer = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  class FatalError extends Error {}

  function articleKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }
  function isEditPage() {
    return /^\/notes\/n[a-z0-9]{8,}\/edit\/?$/i.test(location.pathname);
  }
  function enabled() {
    return Boolean(isEditPage() && articleKey());
  }
  function editor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') ||
      document.querySelector('.ProseMirror');
  }
  function stateKey() {
    return `${STATE_PREFIX}:${articleKey() || 'unknown'}`;
  }
  function getState() {
    try {
      return JSON.parse(localStorage.getItem(stateKey()) || 'null') ||
        { stage: 'idle', rows: [], at: 0 };
    } catch (_) {
      return { stage: 'idle', rows: [], at: 0 };
    }
  }
  function setState(stage, extra = {}) {
    const savedRows = rows.map((row) => ({
      url: row.url,
      nodeId: row.nodeId || '',
      cardKey: row.cardKey || ''
    }));
    localStorage.setItem(stateKey(), JSON.stringify({
      stage, rows: savedRows, at: Date.now(), ...extra
    }));
  }
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
  }
  function updateButtons() {
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    panel.querySelectorAll('button').forEach((button) => {
      button.disabled = running && button.dataset.action !== 'close';
    });
  }
  function setRunning(value) {
    running = value;
    updateButtons();
  }

  function request(url, responseType = 'text') {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType,
        timeout: 45000,
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve(res.response);
          else reject(new Error(`GET ${res.status}: ${url}`));
        },
        onerror: () => reject(new Error(`通信失敗: ${url}`)),
        ontimeout: () => reject(new Error(`通信タイムアウト: ${url}`))
      });
    });
  }

  async function loadManifest() {
    if (manifest && rows.length === EXPECTED) return rows;

    setStatus('夏の陣 manifest 107件を確認中…');
    const text = await request(MANIFEST_URL, 'text');
    let data;
    try { data = JSON.parse(text); } catch (_) {
      throw new FatalError('manifest.jsonを解析できません');
    }

    if (normalizeUrl(data?.magazineUrl) !== normalizeUrl(MAGAZINE_URL)) {
      throw new FatalError('夏の陣マガジンURLが一致しません');
    }
    if (Number(data?.count) !== EXPECTED || !Array.isArray(data?.items) ||
      data.items.length !== EXPECTED) {
      throw new FatalError(`manifest件数不一致 ${data?.items?.length || 0}/${EXPECTED}`);
    }
    if (Number(data?.width) !== W || Number(data?.height) !== H) {
      throw new FatalError(`manifest画像寸法不一致 ${data?.width}x${data?.height}`);
    }

    const urls = new Set();
    const expectedPaths = new Set();
    const prior = new Map((getState().rows || []).map((row) => [normalizeUrl(row.url), row]));

    const mapped = data.items.map((item, i) => {
      const index = i + 1;
      const url = normalizeUrl(item?.url);
      const expectedPath = `/note-summer-107/cards/${String(index).padStart(3, '0')}.png`;

      if (Number(item?.index) !== index) {
        throw new FatalError(`manifest index不一致: ${index}`);
      }
      if (!/^https:\/\/note\.com\/[^/]+\/n\/n[a-z0-9]+$/i.test(url)) {
        throw new FatalError(`記事URL不正: ${index}`);
      }
      if (urls.has(url)) {
        throw new FatalError(`URL重複: ${index}`);
      }
      urls.add(url);

      if (item?.cardPath !== expectedPath) {
        throw new FatalError(`加工サムネイルpath不一致: ${index}`);
      }
      if (expectedPaths.has(expectedPath)) {
        throw new FatalError(`加工サムネイルpath重複: ${index}`);
      }
      expectedPaths.add(expectedPath);

      if (Number(item?.width) !== W || Number(item?.height) !== H) {
        throw new FatalError(`画像寸法不一致: ${index}`);
      }

      const old = prior.get(url) || {};
      return {
        index,
        key: String(item?.key || ''),
        url,
        title: String(item?.title || ''),
        creator: String(item?.creator || ''),
        cardPath: expectedPath,
        cardUrl: ASSET_ORIGIN + expectedPath,
        nodeId: String(old.nodeId || ''),
        cardKey: String(old.cardKey || '')
      };
    });

    if (urls.size !== EXPECTED || expectedPaths.size !== EXPECTED) {
      throw new FatalError('manifestのURL/画像一意性確認に失敗');
    }

    manifest = data;
    rows = mapped;
    setState(getState().stage || 'ready', {
      manifestGeneratedAt: data.generatedAt || '',
      magazineUrl: MAGAZINE_URL
    });
    setStatus(`夏の陣 ${EXPECTED}/${EXPECTED} 読込OK｜加工画像860×140・URL一意 ✅`);
    return rows;
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
    for (let i = 0; i < 6 && seed; i += 1, seed = seed.parentElement) {
      queue.push([seed, 0]);
    }

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
          next !== page && next !== document) {
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
    const id = 970000000 + Math.floor(Math.random() * 20000000);
    try { chunks.push([[id], {}, (runtimeRequire) => { req = runtimeRequire; }]); } catch (_) {}
    return req;
  }
  function selectionApi() {
    if (selectionCache) return selectionCache;
    const req = webpackRequire();
    if (!req) throw new FatalError('note内部処理を取得できません。再読込してください');
    let stateModule;
    try { stateModule = req(44044); } catch (_) {}
    const Selection = stateModule?.Y1;
    if (typeof Selection?.atEnd !== 'function') {
      throw new FatalError('note Selectionを取得できません。再読込してください');
    }
    selectionCache = Selection;
    return Selection;
  }
  function noteUrlCommandFactory() {
    if (typeof noteUrlCommand === 'function') return noteUrlCommand;
    const req = webpackRequire();
    if (!req) throw new FatalError('note内部URL処理を取得できません。再読込してください');

    let module;
    try { module = req(94928); } catch (_) {}
    let candidate = typeof module?.fjT === 'function' ? module.fjT : null;

    const looksRight = (value) => {
      if (typeof value !== 'function') return false;
      let source = '';
      try { source = Function.prototype.toString.call(value); } catch (_) {}
      return source.includes('state.selection') &&
        source.includes('nodeBefore') &&
        source.includes('replaceRangeWith') &&
        source.includes('.then');
    };

    if (!looksRight(candidate)) {
      const loaded = Object.values(req.c || {}).flatMap((entry) => {
        const exp = entry?.exports;
        if (typeof exp === 'function') return [exp];
        return exp && typeof exp === 'object' ? Object.values(exp) : [];
      });
      candidate = loaded.find(looksRight) || null;
    }
    if (!looksRight(candidate)) {
      throw new FatalError('note正規URLコマンドが見つかりません');
    }
    noteUrlCommand = candidate;
    return noteUrlCommand;
  }

  function imageNodes(view) {
    const list = [];
    view.state.doc.descendants((node, pos) => {
      if (node.type?.name === 'image') list.push({ node, pos });
    });
    return list;
  }
  function embedNodes(view) {
    const list = [];
    view.state.doc.descendants((node, pos) => {
      if (node.type?.name === 'embed') list.push({ node, pos });
    });
    return list;
  }
  function officialCards(view, url) {
    const target = normalizeUrl(url);
    return embedNodes(view).filter(({ node }) =>
      normalizeUrl(node.attrs?.src) === target &&
      node.attrs?.htmlForEmbed &&
      node.attrs?.embeddedContentKey
    );
  }
  function validOfficialCardFromList(cards) {
    if (cards.length !== 1) return null;
    const card = cards[0];
    const key = String(card.node.attrs?.embeddedContentKey || '');
    const html = String(card.node.attrs?.htmlForEmbed || '');
    if (!/^emb[a-z0-9]+$/i.test(key) || !html.includes('note-embed')) return null;
    return { ...card, key };
  }
  function validOfficialCard(view, row) {
    return validOfficialCardFromList(officialCards(view, row.url));
  }
  function exactUrlParagraphs(view, url) {
    const target = normalizeUrl(url);
    const list = [];
    view.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      if (normalizeUrl((node.textContent || '').trim()) === target) list.push({ node, pos });
    });
    return list;
  }
  function targetUrlTextblocks(view) {
    const target = new Set(rows.map((row) => normalizeUrl(row.url)));
    const list = [];
    view.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      const text = node.textBetween(0, node.content.size, '\n', '\n').trim();
      const tokens = text.split(/\s+/).filter(Boolean);
      if (tokens.length && tokens.every((token) => target.has(normalizeUrl(token)))) {
        list.push({ node, pos });
      }
    });
    return list;
  }
  function findImageByLink(view, url) {
    const target = normalizeUrl(url);
    return imageNodes(view).find(({ node }) =>
      normalizeUrl(node.attrs?.link) === target) || null;
  }
  function findImageById(view, id) {
    if (!id) return null;
    return imageNodes(view).find(({ node }) =>
      String(node.attrs?.id || '') === String(id)) || null;
  }
  function remoteImage(node) {
    const src = String(node?.attrs?.src || '');
    return /^https:\/\//i.test(src) && !/^https:\/\/editor\.note\.com\/icons\//i.test(src);
  }
  function ensureFreshParagraph(view) {
    const paragraph = view.state.schema.nodes.paragraph;
    if (!paragraph) throw new FatalError('本文paragraphなし');
    if (view.state.doc.lastChild?.type !== paragraph || view.state.doc.lastChild.textContent !== '') {
      view.dispatch(view.state.tr.insert(view.state.doc.content.size, paragraph.create()));
    }
    view.dispatch(view.state.tr
      .setSelection(selectionApi().atEnd(view.state.doc))
      .scrollIntoView());
    view.focus();
  }
  function deleteBlocks(view, hits) {
    const unique = new Map();
    (hits || []).forEach((hit) => {
      if (hit?.node) unique.set(`${hit.pos}:${hit.node.nodeSize}`, hit);
    });
    if (!unique.size) return 0;
    let tr = view.state.tr;
    [...unique.values()]
      .sort((a, b) => b.pos - a.pos)
      .forEach((hit) => {
        tr = tr.delete(hit.pos, hit.pos + hit.node.nodeSize);
      });
    view.dispatch(tr.scrollIntoView());
    ensureFreshParagraph(view);
    return unique.size;
  }
  async function waitFor(test, timeout, interval = 120) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = test();
      if (value) return value;
      await sleep(interval);
    }
    return null;
  }

  async function saveDraftToServer(view, token, verifier, progressText) {
    if (!view) throw new FatalError('EditorViewなし。再読込してください');
    verifier(view);
    setStatus(progressText);
    await sleep(4200);
    if (token !== runToken || !enabled()) throw new FatalError('停止しました');

    const button = [...document.querySelectorAll('button')].find((node) =>
      node.textContent?.trim() === '一時保存' && node.getClientRects().length);

    if (button && !button.disabled) button.click();
    await sleep(6500);

    if (token !== runToken || !enabled()) throw new FatalError('停止しました');
    verifier(view);
  }

  function verifyImageDocument(view) {
    if (rows.length !== EXPECTED) throw new FatalError(`対象不足 ${rows.length}/${EXPECTED}`);

    const targetSet = new Set(rows.map((row) => normalizeUrl(row.url)));
    const targetImages = imageNodes(view).filter(({ node }) =>
      targetSet.has(normalizeUrl(node.attrs?.link)));

    if (targetImages.length !== EXPECTED) {
      throw new FatalError(`加工画像リンク ${targetImages.length}/${EXPECTED}`);
    }

    const links = targetImages.map(({ node }) => normalizeUrl(node.attrs?.link));
    const expected = rows.map((row) => normalizeUrl(row.url));

    for (let i = 0; i < EXPECTED; i += 1) {
      if (links[i] !== expected[i]) {
        throw new FatalError(`加工画像の順番不一致: ${i + 1}`);
      }
    }

    for (const row of rows) {
      const image = findImageById(view, row.nodeId) || findImageByLink(view, row.url);
      if (!image || !remoteImage(image.node) ||
        normalizeUrl(image.node.attrs?.link) !== normalizeUrl(row.url)) {
        throw new FatalError(`加工画像リンク不足: ${row.index}`);
      }
    }
    return true;
  }
  function verifyNoCardsYet(view) {
    verifyImageDocument(view);
    const targetCards = rows.reduce((sum, row) => sum + officialCards(view, row.url).length, 0);
    if (targetCards) throw new FatalError(`標準カードが先に${targetCards}件入っています`);
    return true;
  }
  function verifyCardDocument(view) {
    verifyImageDocument(view);

    const filteredCards = embedNodes(view).filter(({ node }) =>
      rows.some((row) => normalizeUrl(row.url) === normalizeUrl(node.attrs?.src)));

    if (filteredCards.length !== EXPECTED) {
      throw new FatalError(`note正規カード ${filteredCards.length}/${EXPECTED}`);
    }

    const actualOrder = filteredCards.map(({ node }) => normalizeUrl(node.attrs?.src));
    const expectedOrder = rows.map((row) => normalizeUrl(row.url));

    for (let i = 0; i < EXPECTED; i += 1) {
      if (actualOrder[i] !== expectedOrder[i]) {
        throw new FatalError(`標準カード順番不一致: ${i + 1}`);
      }
      const valid = validOfficialCardFromList([filteredCards[i]]);
      if (!valid) throw new FatalError(`標準カード真正性NG: ${i + 1}`);
    }

    const invalid = [];
    for (const row of rows) {
      const card = validOfficialCard(view, row);
      if (!card || exactUrlParagraphs(view, row.url).length) invalid.push(row.index);
    }
    if (targetUrlTextblocks(view).length) {
      throw new FatalError('通知用の生URLブロックが残っています');
    }
    if (invalid.length) {
      throw new FatalError(`note正規カード不一致: ${invalid.slice(0, 8).join(',')}`);
    }
    return true;
  }
  function verifyDeleted(view) {
    verifyImageDocument(view);
    let cards = 0;
    let urls = 0;
    for (const row of rows) {
      cards += officialCards(view, row.url).length;
      urls += exactUrlParagraphs(view, row.url).length;
    }
    urls += targetUrlTextblocks(view).length;
    if (cards || urls) throw new FatalError(`削除残り card=${cards} url=${urls}`);
    return true;
  }

  async function downloadCardFile(row, current, total, token) {
    if (token !== runToken || !enabled()) throw new FatalError('停止しました');
    setStatus(`加工サムネイル取得 ${current}/${total}…`);
    const blob = await request(row.cardUrl, 'blob');
    if (!(blob instanceof Blob) || blob.size < 1000) {
      throw new FatalError(`加工サムネイル取得失敗: ${row.index}`);
    }
    return new page.File(
      [blob],
      `${String(row.index).padStart(3, '0')}_summer107.png`,
      { type: blob.type || 'image/png' }
    );
  }

  function imageInput(input) {
    if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return false;
    const accept = String(input.accept || '').toLowerCase();
    return !accept || accept.includes('image') || accept.includes('.png') ||
      accept.includes('.jpg') || accept.includes('.jpeg') || accept.includes('.webp');
  }
  function uninstallInputBridge() {
    try { inputObserver?.disconnect(); } catch (_) {}
    inputObserver = null;
    if (nativeInputClick && page.HTMLInputElement?.prototype) {
      try { page.HTMLInputElement.prototype.click = nativeInputClick; } catch (_) {}
    }
    nativeInputClick = null;
  }
  function cancelImageArm() {
    const arm = imageArm;
    imageArm = null;
    if (arm?.timer) clearTimeout(arm.timer);
    uninstallInputBridge();
  }
  function installInputBridge() {
    if (inputObserver || nativeInputClick || !document.documentElement) return;

    inputObserver = new MutationObserver((mutations) => {
      const arm = imageArm;
      if (!arm || arm.used) return;
      for (const mutation of mutations) {
        for (const added of mutation.addedNodes) {
          if (!(added instanceof Element)) continue;
          if (imageInput(added)) {
            injectImageInput(added);
            return;
          }
          for (const input of added.querySelectorAll?.('input[type="file"]') || []) {
            if (imageInput(input)) {
              injectImageInput(input);
              return;
            }
          }
        }
      }
    });
    inputObserver.observe(document.documentElement, { childList: true, subtree: true });

    const proto = page.HTMLInputElement?.prototype;
    if (!proto) return;
    nativeInputClick = proto.click;
    proto.click = function (...args) {
      const arm = imageArm;
      if (arm && !arm.used && imageInput(this)) {
        injectImageInput(this);
        return;
      }
      return nativeInputClick.apply(this, args);
    };
  }
  async function waitUploadedImages(arm) {
    const deadline = Date.now() + 360000;
    while (Date.now() < deadline) {
      if (!imageArm || arm.token !== runToken || !enabled()) {
        throw new FatalError('停止しました');
      }

      const candidates = imageNodes(arm.view).filter(({ node }) => {
        const id = String(node.attrs?.id || '');
        const src = String(node.attrs?.src || '');
        if (id && !arm.beforeIds.has(id)) return true;
        if (src && !arm.beforeSrcs.has(src)) return true;
        return false;
      }).sort((a, b) => a.pos - b.pos);

      if (candidates.length >= arm.workRows.length) {
        const fresh = candidates.slice(0, arm.workRows.length);
        if (fresh.every(({ node }) => remoteImage(node))) return fresh;
      }
      await sleep(300);
    }
    throw new FatalError(`画像アップロード確認タイムアウト 0/${arm.workRows.length}`);
  }

  async function injectImageInput(input) {
    const arm = imageArm;
    if (!arm || arm.used || !imageInput(input)) return;
    arm.used = true;

    try {
      const dt = new page.DataTransfer();
      arm.files.forEach((file) => dt.items.add(file));
      input.files = dt.files;
      input.dispatchEvent(new page.Event('input', { bubbles: true }));
      input.dispatchEvent(new page.Event('change', { bubbles: true }));

      setStatus(`加工サムネイル ${arm.workRows.length}枚をnoteへアップロード中…`);
      const created = await waitUploadedImages(arm);

      if (created.length !== arm.workRows.length) {
        throw new FatalError(`画像アップロード数不一致 ${created.length}/${arm.workRows.length}`);
      }

      let tr = arm.view.state.tr;
      created.forEach((hit, i) => {
        const row = arm.workRows[i];
        tr = tr.setNodeMarkup(
          hit.pos,
          hit.node.type,
          { ...hit.node.attrs, link: row.url },
          hit.node.marks
        );
        row.nodeId = String(hit.node.attrs?.id || '');
      });
      arm.view.dispatch(tr.scrollIntoView());
      ensureFreshParagraph(arm.view);

      setState('images_linked');
      await saveDraftToServer(
        arm.view,
        arm.token,
        verifyNoCardsYet,
        `加工サムネイル＋⛓‍💥 ${EXPECTED}/${EXPECTED} を保存中…`
      );

      setState('images_ready');
      setStatus(`加工サムネイル＋⛓‍💥 ${EXPECTED}/${EXPECTED} 完成 ✅ 次は「送」`);
    } catch (error) {
      setStatus(`画像工程停止：${error?.message || String(error)}（投稿しない）`, true);
    } finally {
      cancelImageArm();
      setRunning(false);
    }
  }

  async function prepareSummer() {
    if (running || !enabled()) return;
    setRunning(true);
    const token = ++runToken;
    try {
      await loadManifest();
      if (token !== runToken || !enabled()) throw new FatalError('停止しました');
      setState('ready');
      setStatus(`夏の陣107件 準備OK ✅ 次は「画」`);
    } catch (error) {
      setStatus(`夏107準備停止：${error?.message || String(error)}`, true);
    } finally {
      setRunning(false);
    }
  }

  async function armSummerImages() {
    if (running || !enabled()) return;
    setRunning(true);
    const token = ++runToken;

    try {
      await loadManifest();
      const view = findView();
      if (!view) throw new FatalError('EditorViewなし。再読込してください');
      selectionApi();

      const missing = rows.filter((row) => {
        const hit = findImageById(view, row.nodeId) || findImageByLink(view, row.url);
        return !hit || !remoteImage(hit.node) ||
          normalizeUrl(hit.node.attrs?.link) !== normalizeUrl(row.url);
      });

      if (!missing.length) {
        verifyNoCardsYet(view);
        setState('images_ready');
        setStatus(`加工サムネイル＋⛓‍💥 ${EXPECTED}/${EXPECTED} 完成済み ✅ 次は「送」`);
        setRunning(false);
        return;
      }

      if (missing.length < EXPECTED) {
        setStatus(`途中再開｜完成済み ${EXPECTED - missing.length}/${EXPECTED}・残り${missing.length}枚を準備中…`);
      }

      const files = [];
      for (let i = 0; i < missing.length; i += 1) {
        files.push(await downloadCardFile(missing[i], i + 1, missing.length, token));
      }

      if (files.length !== missing.length) {
        throw new FatalError(`画像準備数不一致 ${files.length}/${missing.length}`);
      }

      const before = imageNodes(view);
      imageArm = {
        view,
        token,
        workRows: missing,
        files,
        used: false,
        beforeIds: new Set(before.map(({ node }) => String(node.attrs?.id || '')).filter(Boolean)),
        beforeSrcs: new Set(before.map(({ node }) => String(node.attrs?.src || '')).filter(Boolean)),
        timer: null
      };
      installInputBridge();
      imageArm.timer = setTimeout(() => {
        if (imageArm) {
          setStatus('画像選択待機が5分を超えました。もう一度「画」', true);
          cancelImageArm();
          setRunning(false);
        }
      }, 300000);

      setStatus(`画像 ${missing.length}枚 準備完了｜本文→「＋」→「画像」を1回`);
    } catch (error) {
      cancelImageArm();
      setRunning(false);
      setStatus(`画像準備停止：${error?.message || String(error)}`, true);
    }
  }

  function insertUrlParagraphForCard(view, url) {
    deleteBlocks(view, exactUrlParagraphs(view, url));
    const paragraph = view.state.schema.nodes.paragraph;
    if (!paragraph) throw new FatalError('URLカード用paragraphなし');
    const node = paragraph.create(null, view.state.schema.text(url));
    view.dispatch(view.state.tr.insert(view.state.doc.content.size, node));
    view.dispatch(view.state.tr
      .setSelection(selectionApi().atEnd(view.state.doc))
      .scrollIntoView());
    view.focus();
  }

  async function createOfficialCardWithNote(view, row, index, total, token) {
    const existing = validOfficialCard(view, row);
    if (existing) {
      row.cardKey = existing.key;
      setState('cards_building');
      return existing;
    }

    const old = officialCards(view, row.url);
    if (old.length) deleteBlocks(view, old);

    insertUrlParagraphForCard(view, row.url);
    setStatus(`note本物カード ${index}/${total} 生成中…`);

    const command = noteUrlCommandFactory()(row.url);
    const handled = command(
      view.state,
      (transaction) => view.dispatch(transaction),
      view
    );

    if (!handled) {
      deleteBlocks(view, exactUrlParagraphs(view, row.url));
      throw new FatalError(`${index}/${total} note正規URLコマンド未処理`);
    }

    const proof = await waitFor(() => {
      if (token !== runToken || !enabled()) throw new FatalError('停止しました');
      return validOfficialCard(view, row);
    }, 45000, 250);

    if (!proof) {
      deleteBlocks(view, exactUrlParagraphs(view, row.url));
      throw new FatalError(`${index}/${total} note本物カード確認タイムアウト`);
    }

    deleteBlocks(view, exactUrlParagraphs(view, row.url));
    row.cardKey = proof.key;
    setState('cards_building');
    return proof;
  }

  async function generateOfficialCards() {
    if (running || !enabled()) return;
    setRunning(true);
    const token = ++runToken;

    try {
      await loadManifest();
      const view = findView();
      if (!view) throw new FatalError('EditorViewなし。再読込してください');
      selectionApi();
      verifyImageDocument(view);
      noteUrlCommandFactory();

      for (let i = 0; i < rows.length; i += 1) {
        if (token !== runToken || !enabled()) throw new FatalError('停止しました');
        await createOfficialCardWithNote(view, rows[i], i + 1, rows.length, token);
        setStatus(`note本物カード ${i + 1}/${rows.length} ✅`);
        if (i < rows.length - 1) await sleep(900);
      }

      verifyCardDocument(view);
      await saveDraftToServer(
        view,
        token,
        verifyCardDocument,
        `note本物カード ${EXPECTED}/${EXPECTED} を保存中…`
      );

      setState('cards_ready');
      setStatus(`note本物カード ${EXPECTED}/${EXPECTED} 完成・保存 ✅ 次は「確認」`);
    } catch (error) {
      setStatus(`カード生成停止：${error?.message || String(error)}（投稿しない。「送」で続きから再開）`, true);
    } finally {
      setRunning(false);
    }
  }

  async function prePublishCheck() {
    if (running || !enabled()) return;
    setRunning(true);
    const token = ++runToken;

    try {
      await loadManifest();
      const view = findView();
      if (!view) throw new FatalError('EditorViewなし。再読込してください');
      selectionApi();

      verifyCardDocument(view);

      await saveDraftToServer(
        view,
        token,
        verifyCardDocument,
        '投稿前の最終保存・再確認中…'
      );

      verifyCardDocument(view);
      setState('prepublish_ok', { checkedAt: new Date().toISOString() });
      setStatus(`投稿前確認 OK ${EXPECTED}/${EXPECTED} ✅ この状態で「公開に進む」`);
      page.alert(
        `投稿前確認 OK ${EXPECTED}/${EXPECTED}\n\n` +
        `加工サムネイル＋URLリンク: ${EXPECTED}/${EXPECTED}\n` +
        `note本物カード: ${EXPECTED}/${EXPECTED}\n` +
        `生URL残り: 0\n` +
        `URL重複: 0\n\n` +
        `この状態でnote純正の「公開に進む」→「公開」。\n` +
        `通知確認後、編集へ戻って「削」を押してください。`
      );
    } catch (error) {
      setStatus(`投稿前確認 NG：${error?.message || String(error)}（公開しない）`, true);
    } finally {
      setRunning(false);
    }
  }

  async function deleteCardsOnly() {
    if (running || !enabled()) return;
    setRunning(true);
    const token = ++runToken;

    try {
      await loadManifest();
      const view = findView();
      if (!view) throw new FatalError('EditorViewなし。再読込してください');
      selectionApi();
      verifyImageDocument(view);

      const hits = [];
      for (const row of rows) {
        hits.push(...officialCards(view, row.url), ...exactUrlParagraphs(view, row.url));
      }
      hits.push(...targetUrlTextblocks(view));

      const removed = deleteBlocks(view, hits);
      verifyDeleted(view);

      await saveDraftToServer(
        view,
        token,
        verifyDeleted,
        `通知カードだけ一括削除・保存中…`
      );

      setState('cards_deleted', { removed });
      setStatus(`カードのみ一括削除 ✅ 加工サムネイル＋⛓‍💥 ${EXPECTED}/${EXPECTED} 保持｜更新してください`);
      page.alert(
        `削除完了。\n\n` +
        `note本物カード／生URLだけ削除しました。\n` +
        `加工サムネイル＋URLリンク ${EXPECTED}件は保持しています。\n\n` +
        `この状態で記事を更新してください。`
      );
    } catch (error) {
      setStatus(`カード削除停止：${error?.message || String(error)}（更新しない）`, true);
    } finally {
      setRunning(false);
    }
  }

  function installStyle() {
    if (!document.head || document.getElementById(STYLE)) return;
    const style = document.createElement('style');
    style.id = STYLE;
    style.textContent = `
      #mumei-card-system-toggle,#mumei-direct-success-panel,#mumei-direct-success-btn,
      #mumei-notify-test-panel,#mumei-notify-test-btn,#mumei-notify-clean-btn,
      #mumei-bridge610-panel,#mumei-bridge610-btn,#mumei-bridge107-btn,
      #mumei-final800-toggle,#mumei-final800-panel,
      #mumei-notify-toggle-v710,#mumei-notify-panel-v710,
      #mumei-notify-toggle-v720,#mumei-notify-panel-v720,
      #mumei-notify-toggle-v810,#mumei-notify-panel-v810,
      #mumei-notify-toggle-v820,#mumei-notify-panel-v820,
      #mumei-notify-toggle-v900,#mumei-notify-panel-v900,
      #mumei-notify-toggle-v1000,#mumei-notify-panel-v1000,
      #mumei-notify-toggle-v1100,#mumei-notify-panel-v1100,
      #mumei-notify-toggle-v1200,#mumei-notify-panel-v1200,
      #mumei-notify-toggle-v1210,#mumei-notify-panel-v1210,
      #mumei-thin-toggle-v1300,#mumei-thin-panel-v1300,
      #ntb-one-tap-toggle-v1400,#ntb-one-tap-panel-v1400,
      #ntb-one-tap-status-v1400,#ntb-one-tap-toggle-v1430,
      #ntb-one-tap-panel-v1430,#ntb-one-tap-status-v1430{display:none!important}
      #${TOGGLE}{
        position:fixed;right:5px;top:42%;z-index:2147483647;
        width:36px;height:36px;border:0;border-radius:999px;
        background:#0f766e;color:#fff;font:900 12px/36px system-ui;
        padding:0;box-shadow:0 3px 12px rgba(0,0,0,.3)
      }
      #${PANEL}{
        position:fixed;right:45px;top:42%;z-index:2147483647;
        display:none;gap:4px;padding:5px;border-radius:10px;
        background:rgba(17,24,39,.95);box-shadow:0 3px 14px rgba(0,0,0,.35)
      }
      #${PANEL}[data-open="1"]{display:flex}
      #${PANEL} button{
        height:32px;min-width:34px;border:0;border-radius:7px;
        color:#fff;background:#374151;padding:0 6px;
        font:800 10px/32px system-ui;white-space:nowrap
      }
      #${PANEL} button[data-action="prepare"]{background:#0f766e}
      #${PANEL} button[data-action="images"]{background:#2563eb}
      #${PANEL} button[data-action="send"]{background:#dc2626}
      #${PANEL} button[data-action="check"]{background:#059669}
      #${PANEL} button[data-action="delete"]{background:#7c3aed}
      #${PANEL} button[data-action="close"]{min-width:28px;width:28px;padding:0}
      #${PANEL} button:disabled{opacity:.55}
      #${STATUS}{
        position:fixed;right:48px;top:calc(42% + 43px);z-index:2147483647;
        display:none;max-width:min(340px,calc(100vw - 70px));
        padding:6px 8px;border-radius:8px;background:#064e3b;color:#fff;
        font:800 10px/1.4 system-ui;box-shadow:0 3px 12px rgba(0,0,0,.28)
      }
      #${STATUS}[data-open="1"]{display:block}
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
      toggle.textContent = '夏';
      toggle.title = `夏の陣107 COMPLETE ${VERSION}`;
      toggle.addEventListener('click', () => {
        const panel = document.getElementById(PANEL);
        const status = document.getElementById(STATUS);
        const open = panel?.dataset.open !== '1';
        if (panel) panel.dataset.open = open ? '1' : '0';
        if (status) status.dataset.open = open ? '1' : '0';
        if (open) setStatus(`夏の陣107 ${VERSION}｜夏→画→送→確認→公開→通知確認→削→更新`);
      });
      document.body.appendChild(toggle);
    }

    let panel = document.getElementById(PANEL);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL;
      panel.dataset.open = '0';
      panel.innerHTML = `
        <button type="button" data-action="prepare" title="夏の陣107件manifest確認">夏107</button>
        <button type="button" data-action="images" title="加工サムネ107枚を一括貼付＋URLリンク">画</button>
        <button type="button" data-action="send" title="note本物カード107件を自動生成">送</button>
        <button type="button" data-action="check" title="投稿前107/107最終確認">確認</button>
        <button type="button" data-action="delete" title="通知後：カードだけ一括削除">削</button>
        <button type="button" data-action="close" title="閉じる">×</button>`;
      panel.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button || button.disabled) return;
        const action = button.dataset.action;
        if (action === 'prepare') prepareSummer();
        else if (action === 'images') armSummerImages();
        else if (action === 'send') generateOfficialCards();
        else if (action === 'check') prePublishCheck();
        else if (action === 'delete') deleteCardsOnly();
        else if (action === 'close') {
          panel.dataset.open = '0';
          const status = document.getElementById(STATUS);
          if (status) status.dataset.open = '0';
        }
      });
      document.body.appendChild(panel);
    }

    let status = document.getElementById(STATUS);
    if (!status) {
      status = document.createElement('div');
      status.id = STATUS;
      status.dataset.open = '0';
      status.dataset.bad = '0';
      document.body.appendChild(status);
    }
    updateButtons();
  }

  function routeCheck() {
    if (isEditPage()) {
      mount();
    } else {
      cancelImageArm();
      document.getElementById(TOGGLE)?.remove();
      document.getElementById(PANEL)?.remove();
      document.getElementById(STATUS)?.remove();
    }
  }

  routeTimer = setInterval(routeCheck, 500);
  routeCheck();
})();
