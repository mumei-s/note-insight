// ==UserScript==
// @name         無名S note URL一覧＋極薄 COMPLETE 10.0
// @namespace    https://github.com/mumei-s/note-insight/batch-bridge-610
// @version      10.0.0
// @description  10/107 URL一覧を1回コピー、カード/URL一覧を一括削除、極薄画像を＋画像1回で一括完成
// @match        https://editor.note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @connect      note.com
// @connect      assets.st-note.com
// @connect      mumei-s.github.io
// ==/UserScript==

(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_NOTE_LIST_FALLBACK_10000__) return;
  const OLD_FLAGS = [
    '__MUMEI_NOTIFY_MANUAL_QUEUE_9000__',
    '__MUMEI_NOTIFY_COMPLETE_8300__', '__MUMEI_NOTIFY_COMPLETE_8200__', '__MUMEI_NOTIFY_COMPLETE_8100__',
    '__MUMEI_NOTIFY_FINAL_8000__', '__MUMEI_NOTIFY_COMPLETE_8000__',
    '__MUMEI_NOTIFY_COMPLETE_7200__', '__MUMEI_NOTIFY_COMPLETE_7100__', '__MUMEI_NOTIFY_COMPLETE_7000__',
    '__MUMEI_BATCH_BRIDGE_680__', '__MUMEI_BATCH_BRIDGE_670__', '__MUMEI_BATCH_BRIDGE_650__',
    '__MUMEI_BATCH_BRIDGE_620__', '__MUMEI_DIRECT_SUCCESS_3230__', '__MUMEI_DIRECT_SUCCESS_3220__',
    '__MUMEI_DIRECT_SUCCESS_3200__'
  ];
  page.__MUMEI_NOTE_LIST_FALLBACK_10000__ = true;
  // 本版より後に読み込まれる旧版は、本文・入力・画像選択へ介入させない。
  OLD_FLAGS.forEach((key) => { page[key] = true; });
  try { localStorage.setItem('mumei_note_card_active_articles_v1', '[]'); } catch (_) {}

  const VERSION = '10.0';
  const W = 860;
  const H = 140;
  const CREATOR = '無名S note';
  const FINAL_MANIFEST = 'https://mumei-s.github.io/note-insight/note-summer-107/manifest.json';
  const ACTIVE_KEY = 'mumei_notify_active_article_v1000';
  const RUN_PREFIX = 'mumei_notify_run_v1000';
  const MODE_PREFIX = 'mumei_notify_mode_v1000';
  const RESET_PREFIX = 'mumei_notify_reset_v1000';
  const COMPLETE_PROOF = 'manual-url-list-card-saved-v1000';
  const DELETE_PROOF = 'notification-cards-and-url-list-deleted-v1000';
  const FINAL_PROOF = 'batch-thin-image-linked-saved-v1000';
  const TOGGLE = 'mumei-notify-toggle-v1000';
  const PANEL = 'mumei-notify-panel-v1000';
  const STATUS = 'mumei-notify-status-v1000';
  const STYLE = 'mumei-notify-style-v1000';

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
  ].map(([url, title], index) => ({ index: index + 1, url, title, width: W, height: H }));

  let openedArticle = '';
  let mode = '';
  let items = [];
  let rows = [];
  let running = false;
  let runToken = 0;
  let coreCache = null;
  let viewCache = null;
  let finalManifest = null;
  let imageArm = null;
  let inputObserver = null;
  let nativeInputClick = null;
  let waitCancel = null;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  class FatalError extends Error {}

  function articleKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }
  function editor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') || document.querySelector('.ProseMirror');
  }
  function getJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch (_) { return fallback; }
  }
  function setJSON(key, value) {
    if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value));
  }
  function isEditPage() { return /^\/notes\/n[a-z0-9]{8,}\/edit\/?$/i.test(location.pathname); }
  function isPublishPage() { return /\/publish\/?$/i.test(location.pathname); }
  function enabled() { return Boolean(isEditPage() && articleKey() && openedArticle === articleKey()); }
  function stateKey(selectedMode = mode) {
    return `${RUN_PREFIX}:${articleKey() || 'unknown'}:${selectedMode || 'none'}`;
  }
  function modeKey() { return `${MODE_PREFIX}:${articleKey() || 'unknown'}`; }
  function resetKey() { return `${RESET_PREFIX}:${articleKey() || 'unknown'}:${mode || getJSON(modeKey(), 'none')}`; }
  function storedRows(selectedMode) {
    const value = getJSON(stateKey(selectedMode), []);
    return Array.isArray(value) ? value : [];
  }
  function legacyRows(selectedMode) {
    const keys = [
      `mumei_notify_run_v720:${articleKey() || 'unknown'}:${selectedMode || 'none'}`,
      `mumei_notify_run_v710:${articleKey() || 'unknown'}:${selectedMode || 'none'}`,
      `mumei_image_link_run_v700:${articleKey() || 'unknown'}:${selectedMode || 'none'}`
    ];
    const merged = new Map();
    for (const key of keys) {
      const value = getJSON(key, []);
      if (Array.isArray(value)) value.forEach((row) => row?.url && merged.set(row.url, row));
    }
    return [...merged.values()];
  }
  function saveRows() {
    if (!mode || !rows.length) return;
    setJSON(stateKey(), rows.map((row) => ({
      url: row.url, status: row.status, nodeId: row.nodeId || '',
      owned: Boolean(row.owned), trusted: Boolean(row.trusted), cardKey: row.cardKey || '',
      proof: row.proof || '', error: row.error || ''
    })));
  }
  function normalizeUrl(value) {
    try {
      const url = new URL(String(value || ''), location.href);
      url.search = ''; url.hash = ''; return url.href;
    } catch (_) { return String(value || ''); }
  }
  function setStatus(text, bad = false) {
    const element = document.getElementById(STATUS);
    if (!element) return;
    element.textContent = text;
    element.dataset.bad = bad ? '1' : '0';
  }
  function renderList() {
    // 記事を隠さないよう、詳細一覧は表示せず内部にだけ保持する。
  }
  function updateButtons() {
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    const retry = panel.querySelector('[data-action="retry-failed"]');
    if (retry) {
      retry.textContent = running ? '止' : '複';
      retry.title = running ? '停止' : '同じURL一覧をもう一度コピー';
    }
    panel.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  }
  function updateUi() { renderList(); updateButtons(); }

  function installStyle() {
    if (document.getElementById(STYLE) || !document.head) return;
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
      #mumei-notify-toggle-v900,#mumei-notify-panel-v900{display:none!important}
      #${TOGGLE}{position:fixed;right:4px;bottom:78px;z-index:2147483647;width:32px;height:32px;border:0;
        border-radius:999px;padding:0;background:#374151;color:#fff;font:800 15px/32px system-ui;
        box-shadow:0 2px 8px rgba(0,0,0,.28);touch-action:manipulation}
      #${TOGGLE}[data-open="1"]{display:none}
      #${PANEL}{position:fixed;right:4px;bottom:76px;z-index:2147483647;display:none;align-items:center;gap:2px;
        height:36px;padding:3px;border-radius:10px;background:#111827;color:#fff;box-shadow:0 3px 12px rgba(0,0,0,.32);
        font-family:system-ui,-apple-system,sans-serif}
      #${PANEL}[data-open="1"]{display:flex}
      #${PANEL} button{height:30px;min-width:30px;border:0;border-radius:7px;padding:0 7px;color:#fff;background:#374151;
        font:800 10px/30px system-ui;touch-action:manipulation}
      #${PANEL} button[data-main-action="10"]{background:#2563eb}
      #${PANEL} button[data-main-action="107"]{background:#059669}
      #${PANEL} button[data-action="reset"]{background:#92400e}
      #${PANEL} button[data-action="delete"]{background:#7c3aed}
      #${PANEL} button[data-action="images"]{background:#0e7490}
      #${PANEL} button[data-action="close"]{padding:0;width:30px}
      #${PANEL} button:disabled{opacity:1}
      #${STATUS}{position:fixed;right:4px;bottom:116px;z-index:2147483647;display:none;max-width:min(250px,calc(100vw - 16px));
        padding:5px 7px;border-radius:7px;background:#064e3b;color:#fff;font:700 10px/1.35 system-ui;
        box-shadow:0 2px 8px rgba(0,0,0,.25)}
      #${PANEL}[data-open="1"] #${STATUS}{display:block}
      #${STATUS}[data-bad="1"]{background:#991b1b}
      body[data-mumei-note-publish="1"] #${TOGGLE},body[data-mumei-note-publish="1"] #${PANEL}{display:none!important}
    `;
    document.head.appendChild(style);
  }
  function closeTool() {
    runToken += 1; running = false; openedArticle = ''; setJSON(ACTIVE_KEY, null);
    if (waitCancel) waitCancel('ツールを閉じたため停止');
    waitCancel = null; cancelImageArm();
    const panel = document.getElementById(PANEL), toggle = document.getElementById(TOGGLE);
    if (panel) panel.dataset.open = '0';
    if (toggle) { toggle.dataset.open = '0'; toggle.textContent = '⛓'; }
    updateButtons();
  }
  function restoreLastMode() {
    if (running || mode || rows.length) return;
    const last = getJSON(modeKey(), '');
    if (!['test10', 'final107'].includes(last)) return;
    prepareMode(last).catch((error) => setStatus(`再開準備停止：${error?.message || String(error)}`, true));
  }
  function openTool() {
    const key = articleKey();
    if (!isEditPage() || !key) return;
    openedArticle = key; setJSON(ACTIVE_KEY, key);
    const panel = document.getElementById(PANEL), toggle = document.getElementById(TOGGLE);
    if (panel) panel.dataset.open = '1';
    if (toggle) { toggle.dataset.open = '1'; toggle.textContent = '⛓'; }
    setStatus('LIST 10.0｜10/107でURL一覧を1回コピー');
    restoreLastMode();
  }
  function toggleTool() { if (enabled()) closeTool(); else openTool(); }
  function mount() {
    if (!document.body || !isEditPage()) return;
    document.body.dataset.mumeiNotePublish = '0';
    installStyle();
    let toggle = document.getElementById(TOGGLE);
    if (!toggle) {
      toggle = document.createElement('button');
      Object.assign(toggle, { id: TOGGLE, type: 'button', textContent: '⛓', title: '通知ツール' });
      toggle.dataset.open = '0'; toggle.addEventListener('click', toggleTool); document.body.appendChild(toggle);
    }
    let panel = document.getElementById(PANEL);
    if (!panel) {
      panel = document.createElement('section'); panel.id = PANEL; panel.dataset.open = '0';
      panel.innerHTML = `<button type="button" data-main-action="10" title="10件URL一覧をコピー">10</button>
        <button type="button" data-main-action="107" title="107件URL一覧をコピー">107</button>
        <button type="button" data-action="retry-failed" title="同じURL一覧をもう一度コピー">複</button>
        <button type="button" data-action="reset" title="既存URLを全消去して通知を初期化">初</button>
        <button type="button" data-action="delete" title="通知後：カードとURL一覧を一括削除">削</button>
        <button type="button" data-action="images" title="削除後：＋画像1回で極薄画像を一括完成">画</button>
        <button type="button" data-action="close" title="しまう">×</button>
        <div id="${STATUS}" data-bad="0">LIST 10.0</div>`;
      panel.addEventListener('click', onPanelClick); document.body.appendChild(panel);
    }
    const storedActive = getJSON(ACTIVE_KEY, '');
    if (storedActive === articleKey()) {
      openedArticle = storedActive; panel.dataset.open = '1'; toggle.dataset.open = '1';
      toggle.textContent = '⛓';
      restoreLastMode();
    }
  }
  async function onPanelClick(event) {
    const button = event.target.closest('button');
    if (!button || !enabled()) return;
    if (running && button.dataset.action !== 'retry-failed' && button.dataset.action !== 'close') {
      setStatus('処理中です。「止」で止めてから別の操作をしてください', true); return;
    }
    if (button.dataset.mainAction === '10') return copyUrlListMode('test10');
    if (button.dataset.mainAction === '107') return copyUrlListMode('final107');
    if (button.dataset.action === 'retry-failed') return running ? stopRun() : copyCurrentList();
    if (button.dataset.action === 'reset') return resetForNotification();
    if (button.dataset.action === 'delete') return deleteNotificationCards();
    if (button.dataset.action === 'images') return armBatchImages();
    if (button.dataset.action === 'close') return closeTool();
  }

  function xhr(url, responseType = 'text') {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: 'GET', url, responseType, timeout: 30000,
      onload: (r) => r.status >= 200 && r.status < 300 ? resolve(r.response) : reject(new Error(`取得失敗 ${r.status}`)),
      onerror: () => reject(new Error('通信失敗')), ontimeout: () => reject(new Error('通信タイムアウト'))
    }));
  }
  function validateManifest(manifest) {
    const values = Array.isArray(manifest?.items) ? manifest.items : [];
    const urls = values.map((item) => item?.url).filter(Boolean);
    if (manifest?.count !== 107 || manifest?.width !== W || manifest?.height !== H || values.length !== 107 ||
      new Set(urls).size !== 107 || values.some((item, index) => item.index !== index + 1 || item.width !== W ||
        item.height !== H || !item.title || !item.url || !item.cardPath)) throw new FatalError('107件データ不整合');
    return values;
  }
  async function loadFinalItems() {
    if (finalManifest) return validateManifest(finalManifest);
    finalManifest = JSON.parse(await xhr(FINAL_MANIFEST, 'text'));
    return validateManifest(finalManifest);
  }
  function metaContent(html, property) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    return parsed.querySelector(`meta[property="${property}"]`)?.content || parsed.querySelector(`meta[name="${property}"]`)?.content || '';
  }
  async function bitmap(blob) {
    if ('createImageBitmap' in page) return page.createImageBitmap(blob);
    return new Promise((resolve, reject) => {
      const image = new page.Image(), objectUrl = URL.createObjectURL(blob);
      image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('画像読込失敗')); };
      image.src = objectUrl;
    });
  }
  function roundedRect(context, x, y, width, height, radius) {
    const value = Math.min(radius, width / 2, height / 2);
    context.beginPath(); context.moveTo(x + value, y); context.arcTo(x + width, y, x + width, y + height, value);
    context.arcTo(x + width, y + height, x, y + height, value); context.arcTo(x, y + height, x, y, value);
    context.arcTo(x, y, x + width, y, value); context.closePath();
  }
  function textLines(context, text, maxWidth, maxLines) {
    const output = []; let line = '';
    for (const character of [...text]) {
      const test = line + character;
      if (line && context.measureText(test).width > maxWidth) {
        output.push(line); line = character; if (output.length === maxLines - 1) break;
      } else line = test;
    }
    if (output.length < maxLines && line) {
      let rest = [...text].slice(output.join('').length).join('');
      if (context.measureText(rest).width > maxWidth) {
        while (rest && context.measureText(`${rest}…`).width > maxWidth) rest = rest.slice(0, -1);
        rest += '…';
      }
      output.push(rest);
    }
    return output.slice(0, maxLines);
  }
  async function makeTestFile(item) {
    const html = await xhr(item.url, 'text'), thumb = metaContent(html, 'og:image');
    if (!thumb) throw new Error('サムネ取得失敗');
    const image = await bitmap(await xhr(thumb, 'blob'));
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, W, H);
    context.strokeStyle = '#d9dde3'; context.lineWidth = 1.5; roundedRect(context, 1, 1, W - 2, H - 2, 12); context.stroke();
    const tw = 320, th = 124, tx = W - tw - 8, ty = 8, textX = 16, textWidth = tx - textX - 12;
    context.textBaseline = 'top'; context.fillStyle = '#171b21'; context.font = '700 18px system-ui,-apple-system,sans-serif';
    textLines(context, item.title, textWidth, 3).forEach((line, index) => context.fillText(line, textX, 12 + index * 24));
    context.fillStyle = '#626975'; context.font = '14px system-ui,-apple-system,sans-serif'; context.fillText(CREATOR, textX, 110);
    const iw = image.width || image.naturalWidth, ih = image.height || image.naturalHeight, scale = Math.min(tw / iw, th / ih);
    const dw = iw * scale, dh = ih * scale; context.fillStyle = '#f7f8fa'; roundedRect(context, tx, ty, tw, th, 8); context.fill();
    context.save(); roundedRect(context, tx, ty, tw, th, 8); context.clip();
    context.drawImage(image, tx + (tw - dw) / 2, ty + (th - dh) / 2, dw, dh); context.restore();
    if (image.close) image.close();
    const output = await new Promise((resolve, reject) => canvas.toBlob((value) =>
      value ? resolve(value) : reject(new Error('カード生成失敗')), 'image/png', 1));
    return new page.File([output], `${String(item.index).padStart(2, '0')}_compact.png`, { type: 'image/png' });
  }
  async function finalFile(item) {
    // manifestのcardPathはサイトルート表記のため、実ファイルはmanifestと同階層のcardsを使う。
    const name = `${String(item.index).padStart(3, '0')}.png`;
    const blob = await xhr(new URL(`./cards/${name}`, FINAL_MANIFEST).href, 'blob');
    if (!blob || blob.size < 100) throw new Error('画像取得失敗');
    return new page.File([blob], name, { type: blob.type || 'image/png' });
  }
  async function fileFor(item) { return mode === 'final107' ? finalFile(item) : makeTestFile(item); }

  function looksLikeView(value) {
    try { return Boolean(value && typeof value === 'object' && value.state?.doc && value.state?.schema &&
      typeof value.dispatch === 'function' && value.dom && typeof value.posAtDOM === 'function'); } catch (_) { return false; }
  }
  function findView() {
    if (looksLikeView(viewCache) && viewCache.dom?.isConnected) return viewCache;
    const root = editor(); if (!root) return null;
    const seen = new Set(), queue = []; let seed = root;
    for (let index = 0; index < 6 && seed; index += 1, seed = seed.parentElement) queue.push([seed, 0]);
    let steps = 0;
    while (queue.length && steps++ < 14000) {
      const [value, depth] = queue.shift(); if (!value || seen.has(value)) continue; seen.add(value);
      if (looksLikeView(value)) return (viewCache = value);
      let keys = []; try { keys = Object.getOwnPropertyNames(value); } catch (_) { continue; }
      for (const key of keys) {
        if (['window', 'document', 'ownerDocument', 'parentNode', 'children', 'childNodes', 'style'].includes(key)) continue;
        let next; try { next = value[key]; } catch (_) { continue; }
        if (looksLikeView(next)) return (viewCache = next);
        if (depth < 7 && next && (typeof next === 'object' || typeof next === 'function') && next !== page && next !== document) {
          queue.push([next, depth + 1]);
        }
      }
    }
    return null;
  }
  function webpackRequire() {
    const chunks = page.webpackChunk_N_E; if (!chunks || typeof chunks.push !== 'function') return null;
    let require = null; const id = 970000000 + Math.floor(Math.random() * 20000000);
    try { chunks.push([[id], {}, (runtimeRequire) => { require = runtimeRequire; }]); } catch (_) {}
    return require;
  }
  function core() {
    if (coreCache) return coreCache;
    const require = webpackRequire(); if (!require) throw new FatalError('note内部処理を取得できません。画面を再読込してください');
    let stateModule, schemaModule, htmlModule;
    try { stateModule = require(44044); } catch (_) {}
    try { schemaModule = require(35130); } catch (_) {}
    try { htmlModule = require(51910); } catch (_) {}
    const Selection = stateModule?.Y1;
    const serialize = schemaModule?.BF, normalizeDOM = htmlModule?.zc, cleanHTML = htmlModule?.jF;
    if (typeof Selection?.atEnd !== 'function' || typeof serialize !== 'function' ||
      typeof normalizeDOM !== 'function' || typeof cleanHTML !== 'function') {
      throw new FatalError('note本文・保存処理を取得できません。画面を再読込してください');
    }
    return (coreCache = { Selection, serialize, normalizeDOM, cleanHTML });
  }
  function imageNodes(view) {
    const output = [];
    view.state.doc.descendants((node, pos) => { if (node.type?.name === 'image') output.push({ node, pos }); });
    return output;
  }
  function findById(view, id) {
    return id ? imageNodes(view).find((entry) => String(entry.node.attrs?.id || '') === String(id)) || null : null;
  }
  function findByLink(view, url) {
    const wanted = normalizeUrl(url);
    return imageNodes(view).find((entry) => normalizeUrl(entry.node.attrs?.link) === wanted) || null;
  }
  function embedNodes(view) {
    const output = [];
    view.state.doc.descendants((node, pos) => { if (node.type?.name === 'embed') output.push({ node, pos }); });
    return output;
  }
  function findOfficialCard(view, url) {
    const wanted = normalizeUrl(url);
    return embedNodes(view).find((entry) => normalizeUrl(entry.node.attrs?.src) === wanted &&
      Boolean(entry.node.attrs?.htmlForEmbed) && Boolean(entry.node.attrs?.embeddedContentKey)) || null;
  }
  function officialCards(view, url) {
    const wanted = normalizeUrl(url);
    return embedNodes(view).filter((entry) => normalizeUrl(entry.node.attrs?.src) === wanted &&
      Boolean(entry.node.attrs?.htmlForEmbed) && Boolean(entry.node.attrs?.embeddedContentKey));
  }
  function exactUrlParagraphs(view, url) {
    const wanted = normalizeUrl(url), output = [];
    view.state.doc.descendants((node, pos) => {
      if (!node.isTextblock || normalizeUrl((node.textContent || '').trim()) !== wanted) return;
      output.push({ node, pos });
    });
    return output;
  }
  function targetUrlTextblocks(view) {
    const targets = new Set(rows.map((row) => normalizeUrl(row.url)));
    const output = [];
    view.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      const text = node.textBetween(0, node.content.size, '\n', '\n').trim();
      const tokens = text.split(/\s+/).filter(Boolean);
      if (tokens.length && tokens.every((value) => targets.has(normalizeUrl(value)))) output.push({ node, pos });
    });
    return output;
  }
  function deleteBlocks(view, hits) {
    const unique = new Map();
    hits.forEach((hit) => hit?.node && unique.set(`${hit.pos}:${hit.node.nodeSize}`, hit));
    if (!unique.size) return 0;
    let transaction = view.state.tr;
    [...unique.values()].sort((a, b) => b.pos - a.pos).forEach((hit) => {
      transaction = transaction.delete(hit.pos, hit.pos + hit.node.nodeSize);
    });
    view.dispatch(transaction.scrollIntoView());
    ensureFreshParagraph(view);
    return unique.size;
  }
  function findFallbackLink(view, url) {
    const wanted = normalizeUrl(url); let found = null;
    view.state.doc.descendants((node, pos) => {
      if (found || node.type?.name !== 'paragraph' || node.textContent !== url) return;
      const mark = node.firstChild?.marks?.find((value) => value.type?.name === 'link');
      if (normalizeUrl(mark?.attrs?.href) === wanted) found = { node, pos };
    });
    return found;
  }
  function remoteImage(node) {
    const src = String(node?.attrs?.src || ''); return /^https:\/\//i.test(src) && !/^https:\/\/editor\.note\.com\/icons\//i.test(src);
  }
  function ensureFreshParagraph(view) {
    const paragraph = view.state.schema.nodes.paragraph; if (!paragraph) throw new FatalError('本文paragraphなし');
    if (view.state.doc.lastChild?.type !== paragraph || view.state.doc.lastChild.textContent !== '') {
      view.dispatch(view.state.tr.insert(view.state.doc.content.size, paragraph.create()));
    }
    view.dispatch(view.state.tr.setSelection(core().Selection.atEnd(view.state.doc)).scrollIntoView()); view.focus();
  }
  async function waitFor(test, timeout, interval = 120) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const value = test(); if (value) return value; await sleep(interval); }
    return null;
  }
  function serializedBody(view) {
    const fragment = core().serialize(view.state), holder = document.createElement('div');
    holder.appendChild(fragment); core().normalizeDOM(holder);
    return core().cleanHTML(holder.innerHTML);
  }
  function verifyNotificationDocument(view) {
    const invalid = [];
    for (const row of rows) {
      const cards = officialCards(view, row.url);
      const linkedImage = findByLink(view, row.url);
      const raw = exactUrlParagraphs(view, row.url);
      const trackedImage = findById(view, row.nodeId);
      if (cards.length !== 1 || linkedImage || raw.length || trackedImage) invalid.push(row.index);
    }
    if (invalid.length) throw new FatalError(`カード以外の重複URLまたはカード不足: ${invalid.slice(0, 8).join(',')}`);
    const body = serializedBody(view);
    const absent = rows.filter((row) => !body.includes(row.url));
    if (absent.length) throw new FatalError(`保存HTMLの正規カードURL不足: ${absent.slice(0, 8).map((row) => row.index).join(',')}`);
    return body;
  }
  function verifyFinalDocument(view) {
    const invalid = [];
    for (const row of rows) {
      const image = findById(view, row.nodeId) || findByLink(view, row.url);
      const imageOK = image && remoteImage(image.node) && normalizeUrl(image.node.attrs?.link) === normalizeUrl(row.url);
      if (!imageOK || officialCards(view, row.url).length || exactUrlParagraphs(view, row.url).length) invalid.push(row.index);
    }
    if (targetUrlTextblocks(view).length) throw new FatalError('最終本文にURL一覧が残っています。先に「削」');
    if (invalid.length) throw new FatalError(`最終画像リンクまたはカード削除の不一致: ${invalid.slice(0, 8).join(',')}`);
    const body = serializedBody(view), parsed = new DOMParser().parseFromString(body, 'text/html');
    const imageHrefs = [...parsed.querySelectorAll('figure a[href] img')]
      .map((image) => normalizeUrl(image.closest('a[href]')?.getAttribute('href')));
    const absent = rows.filter((row) => !imageHrefs.includes(normalizeUrl(row.url)));
    if (absent.length) throw new FatalError(`保存HTMLの極薄リンク不足: ${absent.slice(0, 8).map((row) => row.index).join(',')}`);
    return body;
  }
  function verifyResetDocument(view) {
    const remaining = [];
    for (const row of rows) {
      if (officialCards(view, row.url).length || findByLink(view, row.url) || exactUrlParagraphs(view, row.url).length ||
        (row.nodeId && findById(view, row.nodeId))) remaining.push(row.index);
    }
    if (targetUrlTextblocks(view).length) throw new FatalError('通知リセット後もURL一覧が残っています');
    if (remaining.length) throw new FatalError(`通知リセット残り: ${remaining.slice(0, 8).join(',')}`);
    return serializedBody(view);
  }
  async function saveDraftToServer(view, token, verifier, progressText) {
    if (!view) throw new FatalError('EditorViewなし。画面を再読込してください');
    verifier(view);
    setStatus(progressText);
    // note内部APIを直呼びせず、通常編集と同じ自動保存時間を通す。
    await sleep(4200);
    if (token !== runToken || !enabled()) throw new FatalError('停止しました');
    const button = [...document.querySelectorAll('button')].find((node) =>
      node.textContent?.trim() === '一時保存' && node.getClientRects().length);
    if (button && !button.disabled) {
      button.click();
    }
    await sleep(6500);
    if (token !== runToken || !enabled()) throw new FatalError('停止しました');
    verifier(view);
  }
  async function saveNotificationToServer(view, token) {
    await saveDraftToServer(view, token, verifyNotificationDocument, `${rows.length}/${rows.length}｜実操作カードだけを通常保存中…`);
    rows.forEach((row) => { row.proof = COMPLETE_PROOF; row.status = 'done'; row.error = ''; });
    saveRows();
  }

  function rowFrom(item, stored) {
    const proof = [COMPLETE_PROOF, DELETE_PROOF, FINAL_PROOF].includes(stored?.proof) ? stored.proof : '';
    return { ...item, status: proof ? 'done' : 'ready', nodeId: stored?.nodeId || '',
      owned: Boolean(stored?.owned), trusted: Boolean(stored?.trusted), cardKey: stored?.cardKey || '',
      proof, error: stored?.error || '' };
  }
  async function prepareMode(selectedMode) {
    mode = selectedMode; setJSON(modeKey(), selectedMode);
    items = selectedMode === 'final107' ? await loadFinalItems() : TEST_ITEMS;
    const stored = new Map(legacyRows(selectedMode).map((row) => [row.url, row]));
    storedRows(selectedMode).forEach((row) => stored.set(row.url, row));
    rows = items.map((item) => rowFrom(item, stored.get(item.url)));
    const view = findView();
    if (view) for (const row of rows) {
      const cards = officialCards(view, row.url);
      const provenCard = cards.length === 1 && String(cards[0].node.attrs?.embeddedContentKey || '') === String(row.cardKey || '');
      if (row.proof === COMPLETE_PROOF && provenCard && row.trusted && !findByLink(view, row.url) &&
        !exactUrlParagraphs(view, row.url).length) continue;
      if (row.proof === DELETE_PROOF && !cards.length && !exactUrlParagraphs(view, row.url).length) continue;
      if (row.proof === FINAL_PROOF) {
        const image = findById(view, row.nodeId) || findByLink(view, row.url);
        if (image && remoteImage(image.node) && normalizeUrl(image.node.attrs?.link) === normalizeUrl(row.url) &&
          !cards.length && !exactUrlParagraphs(view, row.url).length) continue;
      }
      row.status = 'ready'; row.proof = '';
    }
    saveRows(); updateUi();
  }
  function copyPreparedUrlList() {
    if (!rows.length || typeof GM_setClipboard !== 'function') throw new FatalError('URL一覧をコピーできません');
    GM_setClipboard(rows.map((row) => row.url).join('\n\n'), 'text');
    rows.forEach((row) => { row.status = 'ready'; row.error = ''; });
    saveRows();
    setStatus(`${rows.length}件URL一覧コピー済み ✅ 本文へ1回貼付→各URL末尾でEnter`);
  }
  async function copyUrlListMode(selectedMode) {
    if (running || !enabled()) return;
    running = true; ++runToken; updateUi();
    try {
      setStatus(selectedMode === 'final107' ? '107件URL一覧を読込中…' : '10件URL一覧を準備中…');
      await prepareMode(selectedMode);
      copyPreparedUrlList();
    } catch (error) {
      setStatus(`一覧コピー停止：${error?.message || String(error)}`, true);
    } finally { running = false; updateUi(); }
  }
  async function copyCurrentList() {
    const selectedMode = mode || getJSON(modeKey(), '');
    if (!['test10', 'final107'].includes(selectedMode)) {
      setStatus('先に「10」または「107」を押してください', true); return;
    }
    return copyUrlListMode(selectedMode);
  }
  async function waitOfficialCard(view, url, token, timeout = 30000) {
    const result = await waitFor(() => {
      if (token !== runToken || !enabled()) throw new FatalError('停止しました');
      return findOfficialCard(view, url);
    }, timeout, 180);
    if (!result) throw new Error('note正規カード生成を確認できませんでした');
    return result;
  }
  function copyQueueUrl(url) {
    try {
      if (typeof GM_setClipboard !== 'function') return false;
      GM_setClipboard(url, 'text'); return true;
    } catch (_) { return false; }
  }
  function waitManualPasteEnter(view, row, index, token, timeout = 300000) {
    return new Promise((resolve, reject) => {
      let settled = false, pasted = false, timer = null, settleTimer = null;
      const cleanup = () => {
        view.dom.removeEventListener('paste', onPaste, true);
        view.dom.removeEventListener('keydown', onEnter, true);
        view.dom.removeEventListener('beforeinput', onEnter, true);
        view.dom.removeEventListener('input', onEnter, true);
        if (timer) clearTimeout(timer); if (settleTimer) clearTimeout(settleTimer);
        if (waitCancel === cancel) waitCancel = null;
      };
      const finish = (error, value) => {
        if (settled) return; settled = true; cleanup();
        if (error) reject(error); else resolve(value);
      };
      const cancel = (reason = '停止しました') => finish(new FatalError(reason));
      const onPaste = (event) => {
        if (!event.isTrusted || pasted) return;
        if (token !== runToken || !enabled()) return cancel();
        const text = String(event.clipboardData?.getData('text/plain') || '').trim();
        if (normalizeUrl(text) !== normalizeUrl(row.url)) {
          event.preventDefault();
          return finish(new Error(`${index + 1}件目と違うURLです。「再」でやり直してください`));
        }
        pasted = true;
        setStatus(`${index + 1}/${rows.length}｜実貼り付け確認 ✅ そのままEnter`);
      };
      const onEnter = (event) => {
        if (!event.isTrusted) return;
        if ((event.type === 'beforeinput' || event.type === 'input') && event.inputType === 'insertFromPaste') {
          pasted = true;
          setStatus(`${index + 1}/${rows.length}｜実貼り付け確認 ✅ そのままEnter`);
          return;
        }
        if (!pasted) return;
        const keyboard = event.type === 'keydown' && event.key === 'Enter';
        const mobile = event.type === 'beforeinput' && /^(insertParagraph|insertLineBreak)$/i.test(event.inputType || '');
        if (!keyboard && !mobile) return;
        if (token !== runToken || !enabled()) return cancel();
        if (!settleTimer) settleTimer = setTimeout(() => finish(null, true), 220);
      };
      timer = setTimeout(() => finish(new Error(`${index + 1}件目の貼り付け＋Enter待機が5分を超えました`)), timeout);
      waitCancel = cancel;
      view.dom.addEventListener('paste', onPaste, true);
      view.dom.addEventListener('keydown', onEnter, true);
      view.dom.addEventListener('beforeinput', onEnter, true);
      view.dom.addEventListener('input', onEnter, true);
      view.focus();
    });
  }
  async function createManualCard(view, row, index, token) {
    ensureFreshParagraph(view);
    if (!copyQueueUrl(row.url)) throw new FatalError('URLをクリップボードへコピーできません');
    setStatus(`${index + 1}/${rows.length}｜コピー済み → 本文で「貼り付け→Enter」`);
    await waitManualPasteEnter(view, row, index, token);
    return waitOfficialCard(view, row.url, token);
  }
  async function processRow(index, token) {
    if (token !== runToken || !enabled()) throw new FatalError('停止しました');
    const row = rows[index], view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
    const existing = findOfficialCard(view, row.url);
    if (existing && row.trusted && String(existing.node.attrs?.embeddedContentKey || '') === String(row.cardKey || '')) {
      row.status = 'ready'; row.error = ''; saveRows(); return;
    }
    row.status = 'embedding'; row.error = ''; updateUi();
    const card = await createManualCard(view, row, index, token);
    row.cardKey = String(card.node.attrs?.embeddedContentKey || ''); row.trusted = true;
    row.status = 'ready'; row.proof = ''; row.error = '';
    saveRows(); updateUi();
    setStatus(`${index + 1}/${rows.length}｜実貼り付け＋実Enterカード ✅ 次を準備中…`);
    await sleep(1800);
  }
  function contaminatedRows(view) {
    return rows.filter((row) => {
      if (findByLink(view, row.url) || findById(view, row.nodeId) || exactUrlParagraphs(view, row.url).length) return true;
      const cards = officialCards(view, row.url);
      if (!cards.length) return false;
      return cards.length !== 1 || !row.trusted || !row.cardKey ||
        String(cards[0].node.attrs?.embeddedContentKey || '') !== String(row.cardKey);
    });
  }
  async function runIndexes(indexes) {
    if (running || !enabled()) return;
    running = true; const token = ++runToken; updateUi(); let fatal = null;
    for (const index of indexes) {
      if (token !== runToken || !enabled()) break;
      try { await processRow(index, token); }
      catch (error) {
        rows[index].status = 'failed'; rows[index].error = error?.message || String(error); saveRows(); updateUi();
        fatal = error instanceof FatalError ? error : new FatalError(`${index + 1}/${rows.length}｜${rows[index].error}`);
        break;
      }
    }
    if (token !== runToken) {
      running = false;
      if (enabled()) setStatus('停止しました。完了済みは保持し、残りだけ再開できます', true);
      updateUi();
      return;
    }
    if (token === runToken) {
      const currentView = findView();
      const done = currentView ? rows.filter((row) => officialCards(currentView, row.url).length === 1).length : 0;
      const failed = rows.filter((row) => row.status === 'failed').length;
      if (!fatal && !failed) {
        try { await saveNotificationToServer(currentView, token); }
        catch (error) { fatal = error instanceof FatalError ? error : new FatalError(error?.message || String(error)); }
      }
      running = false;
      if (fatal) setStatus(`停止：${fatal.message}（公開・更新しない）`, true);
      else if (failed) setStatus(`正規カード ${done}/${rows.length}｜失敗${failed}件だけ再実行できます`, true);
      else setStatus(`${rows.length}/${rows.length}｜全件 実貼付＋実Enter・通常保存 ✅ 公開に進めます`);
      updateUi();
    }
  }
  async function startMode(selectedMode) {
    if (running) return;
    try {
      setStatus(selectedMode === 'final107' ? '107件一覧を読込中…' : '10件一覧を準備中…');
      await prepareMode(selectedMode); core();
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください');
      const resetState = getJSON(resetKey(), null);
      if (resetState?.state && resetState.state !== 'submitted') {
        throw new FatalError('初期化本文は保存済みです。先に公開更新を完了し、編集画面を開き直してください');
      }
      if (resetState?.state === 'submitted') setJSON(resetKey(), null);
      if (rows.some((row) => row.proof === DELETE_PROOF || row.proof === FINAL_PROOF)) {
        throw new FatalError('前回の削除/画像工程です。再通知は「初」→公開更新→編集へ戻って実行');
      }
      const dirty = contaminatedRows(view);
      if (dirty.length) throw new FatalError(`既存URLあり(${dirty.slice(0, 8).map((row) => row.index).join(',')})。「初」→公開更新→戻って${selectedMode === 'final107' ? '107' : '10'}`);
      const indexes = rows.map((_, index) => index).filter((index) => rows[index].status !== 'done');
      if (!indexes.length) {
        const token = ++runToken; running = true; updateUi();
        await saveNotificationToServer(view, token); running = false; updateUi();
        setStatus(`${rows.length}/${rows.length}｜全件 実貼付＋実Enter・通常保存 ✅ 公開に進めます`); return;
      }
      runIndexes(indexes);
    } catch (error) { setStatus(`開始停止：${error?.message || String(error)}（公開・更新しない）`, true); running = false; updateUi(); }
  }
  async function resetForNotification() {
    if (running || !mode || !rows.length || !enabled()) return;
    running = true; const token = ++runToken; updateUi();
    try {
      cancelImageArm();
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
      const targets = new Set(rows.map((row) => normalizeUrl(row.url)));
      const trackedIds = new Set(rows.map((row) => String(row.nodeId || '')).filter(Boolean));
      const deletions = [];
      for (const hit of imageNodes(view)) {
        const id = String(hit.node.attrs?.id || ''), linked = normalizeUrl(hit.node.attrs?.link);
        if (trackedIds.has(id) || targets.has(linked)) deletions.push(hit);
      }
      rows.forEach((row) => {
        deletions.push(...officialCards(view, row.url));
      });
      deletions.push(...targetUrlTextblocks(view));
      let transaction = view.state.tr;
      const unique = new Map();
      deletions.forEach((hit) => unique.set(`${hit.pos}:${hit.node.nodeSize}`, hit));
      [...unique.values()].sort((a, b) => b.pos - a.pos).forEach((hit) => {
        transaction = transaction.delete(hit.pos, hit.pos + hit.node.nodeSize);
      });
      if (transaction.docChanged) view.dispatch(transaction.scrollIntoView());
      ensureFreshParagraph(view);
      await saveDraftToServer(view, token, verifyResetDocument, '既存カード・極薄画像・URLを消して保存中…');
      rows.forEach((row) => {
        row.status = 'ready'; row.nodeId = ''; row.owned = false; row.trusted = false;
        row.cardKey = ''; row.proof = ''; row.error = '';
      });
      saveRows(); setJSON(resetKey(), { state: 'prepared', at: Date.now() });
      setStatus('初期化＋保存 ✅ 公開に進み「更新」→編集へ戻って10/107');
    } catch (error) {
      setStatus(`初期化停止：${error?.message || String(error)}（公開・更新しない）`, true);
    } finally { running = false; updateUi(); }
  }
  function verifyCardsDeleted(view) {
    const invalid = rows.filter((row) => officialCards(view, row.url).length);
    if (targetUrlTextblocks(view).length) throw new FatalError('一括削除後もURL一覧が残っています');
    if (invalid.length) throw new FatalError(`カード削除後の対象URL残り: ${invalid.slice(0, 8).map((row) => row.index).join(',')}`);
    return serializedBody(view);
  }
  async function deleteNotificationCards() {
    if (running) { setStatus('処理中です。「止」で止めてから削除してください', true); return; }
    if (!mode || !rows.length || !enabled()) { setStatus('先に「10」または「107」で対象を読み込んでください', true); return; }
    running = true; const token = ++runToken; updateUi();
    try {
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
      const hits = rows.flatMap((row) => officialCards(view, row.url));
      hits.push(...targetUrlTextblocks(view));
      const removed = deleteBlocks(view, hits);
      await saveDraftToServer(view, token, verifyCardsDeleted, `カード/URL一覧 ${removed}ブロックを一括削除・保存中…`);
      rows.forEach((row) => { row.status = 'done'; row.proof = DELETE_PROOF; row.cardKey = ''; row.error = ''; });
      saveRows();
      setStatus(removed ? `カード/URL一覧 ${removed}ブロック 一括削除＋保存 ✅ 次は「画」` : '対象カード/URL一覧は既に0件 ✅ 次は「画」');
    } catch (error) {
      setStatus(`カード削除停止：${error?.message || String(error)}（公開・更新しないで「削」を再実行）`, true);
    } finally { running = false; updateUi(); }
  }
  function imageInput(input) {
    if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return false;
    const accept = String(input.accept || '').toLowerCase();
    return !accept || accept.includes('image') || accept.includes('.png') ||
      accept.includes('.jpg') || accept.includes('.jpeg') || accept.includes('.webp');
  }
  async function mapLimit(values, limit, worker) {
    const output = new Array(values.length); let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor; cursor += 1; output[index] = await worker(values[index], index);
      }
    });
    await Promise.all(runners); return output;
  }
  function missingImageRows(view) {
    return rows.filter((row) => {
      const hit = findById(view, row.nodeId) || findByLink(view, row.url);
      return !(hit && remoteImage(hit.node) && normalizeUrl(hit.node.attrs?.link) === normalizeUrl(row.url));
    });
  }
  function uninstallImageInputBridge() {
    try { inputObserver?.disconnect(); } catch (_) {}
    inputObserver = null;
    if (nativeInputClick && page.HTMLInputElement?.prototype) {
      try { page.HTMLInputElement.prototype.click = nativeInputClick; } catch (_) {}
    }
    nativeInputClick = null;
  }
  function cancelImageArm(reason = '') {
    const arm = imageArm; imageArm = null;
    if (arm?.timer) clearTimeout(arm.timer);
    uninstallImageInputBridge();
    if (reason && arm?.reject) arm.reject(new FatalError(reason));
  }
  function installImageInputBridge() {
    if (inputObserver || nativeInputClick || !document.documentElement) return;
    inputObserver = new MutationObserver((mutations) => {
      const arm = imageArm; if (!arm || arm.consumed) return;
      for (const mutation of mutations) for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (imageInput(node) && !arm.beforeInputs.has(node)) { injectImageInput(node); return; }
        for (const input of node.querySelectorAll?.('input[type="file"]') || []) {
          if (imageInput(input) && !arm.beforeInputs.has(input)) { injectImageInput(input); return; }
        }
      }
    });
    inputObserver.observe(document.documentElement, { childList: true, subtree: true });
    const prototype = page.HTMLInputElement?.prototype;
    if (!prototype) return;
    nativeInputClick = prototype.click;
    prototype.click = function interceptedImageClick(...args) {
      const arm = imageArm;
      if (arm && imageInput(this) && !arm.beforeInputs.has(this)) {
        if (!arm.consumed) injectImageInput(this);
        return;
      }
      return nativeInputClick.apply(this, args);
    };
  }
  async function waitBatchImages(arm, timeout = 300000) {
    const result = await waitFor(() => {
      if (arm.token !== runToken || !enabled()) throw new FatalError('停止しました');
      const fresh = imageNodes(arm.view).filter((entry) => {
        const id = String(entry.node.attrs?.id || ''); return id && !arm.beforeIds.has(id);
      }).sort((a, b) => a.pos - b.pos);
      if (fresh.length < arm.workRows.length) return null;
      const selected = fresh.slice(0, arm.workRows.length);
      return selected.every((entry) => remoteImage(entry.node)) ? selected : null;
    }, timeout, 280);
    if (!result) throw new Error(`画像アップロード完了 ${arm.workRows.length}枚を確認できませんでした`);
    return result;
  }
  function compactGeneratedGaps(view, generatedIds) {
    const top = [];
    view.state.doc.forEach((node, offset) => {
      let generated = node.type?.name === 'image' && generatedIds.has(String(node.attrs?.id || ''));
      if (!generated) node.descendants((child) => {
        if (child.type?.name === 'image' && generatedIds.has(String(child.attrs?.id || ''))) {
          generated = true; return false;
        }
      });
      top.push({ node, pos: offset, generated, empty: node.type?.name === 'paragraph' && !node.content.size });
    });
    const generatedIndexes = top.map((item, index) => item.generated ? index : -1).filter((index) => index >= 0);
    if (generatedIndexes.length < 2) return 0;
    const deletions = [];
    for (let index = generatedIndexes[0] + 1; index < generatedIndexes.at(-1); index += 1) {
      if (!top[index].empty) continue;
      let previous = index - 1, next = index + 1;
      while (previous >= 0 && top[previous].empty) previous -= 1;
      while (next < top.length && top[next].empty) next += 1;
      if (top[previous]?.generated && top[next]?.generated) deletions.push(top[index]);
    }
    if (!deletions.length) return 0;
    let transaction = view.state.tr;
    deletions.sort((a, b) => b.pos - a.pos).forEach((item) => {
      transaction = transaction.delete(item.pos, item.pos + item.node.nodeSize);
    });
    view.dispatch(transaction); return deletions.length;
  }
  async function linkAndCompactImages(arm, created) {
    if (created.length !== arm.workRows.length) throw new FatalError(`新規画像数不一致 ${created.length}/${arm.workRows.length}`);
    let transaction = arm.view.state.tr;
    created.forEach((hit, index) => {
      const row = arm.workRows[index];
      transaction = transaction.setNodeMarkup(hit.pos, hit.node.type,
        { ...hit.node.attrs, link: row.url }, hit.node.marks);
      row.nodeId = String(hit.node.attrs?.id || ''); row.owned = true;
    });
    arm.view.dispatch(transaction);
    const generatedIds = new Set(arm.workRows.map((row) => String(row.nodeId || '')).filter(Boolean));
    compactGeneratedGaps(arm.view, generatedIds);
    ensureFreshParagraph(arm.view);
    const invalid = arm.workRows.filter((row) => {
      const hit = findById(arm.view, row.nodeId);
      return !hit || !remoteImage(hit.node) || normalizeUrl(hit.node.attrs?.link) !== normalizeUrl(row.url);
    });
    if (invalid.length) throw new FatalError(`一括URL付与不一致: ${invalid.slice(0, 8).map((row) => row.index).join(',')}`);
    saveRows();
  }
  async function finishBatchImages(arm) {
    const created = await waitBatchImages(arm);
    setStatus(`${created.length}/${arm.workRows.length}枚アップロード済み｜URL一括付与＋余白除去中…`);
    await linkAndCompactImages(arm, created);
    arm.linked = true;
    await saveDraftToServer(arm.view, arm.token, verifyFinalDocument,
      `${rows.length}枚の極薄リンクを通常保存中…`);
    rows.forEach((row) => { row.status = 'done'; row.proof = FINAL_PROOF; row.error = ''; });
    saveRows();
  }
  function removeFreshArmImages(arm) {
    if (!arm?.view) return 0;
    const hits = imageNodes(arm.view).filter((entry) => {
      const id = String(entry.node.attrs?.id || ''); return id && !arm.beforeIds.has(id);
    });
    if (!hits.length) return 0;
    let transaction = arm.view.state.tr;
    hits.sort((a, b) => b.pos - a.pos).forEach((hit) => {
      transaction = transaction.delete(hit.pos, hit.pos + hit.node.nodeSize);
    });
    arm.view.dispatch(transaction); ensureFreshParagraph(arm.view); return hits.length;
  }
  async function injectImageInput(input) {
    const arm = imageArm;
    if (!arm || arm.consumed || !imageInput(input) || arm.beforeInputs.has(input)) return false;
    arm.consumed = true; arm.input = input;
    try {
      const transfer = new page.DataTransfer();
      arm.files.forEach((file) => transfer.items.add(file));
      input.files = transfer.files;
      input.dispatchEvent(new page.Event('input', { bubbles: true }));
      input.dispatchEvent(new page.Event('change', { bubbles: true }));
      setStatus(`${arm.files.length}枚を一括高速挿入・アップロード中…`);
      await finishBatchImages(arm);
      arm.resolve(true);
    } catch (error) {
      if (!arm.linked) removeFreshArmImages(arm);
      arm.reject(error);
    }
    return true;
  }
  async function armBatchImages() {
    if (running) { setStatus('処理中です。「止」で止めてから画像工程へ進んでください', true); return; }
    if (!mode || !rows.length || !enabled()) { setStatus('先に「10」または「107」で対象を読み込んでください', true); return; }
    running = true; const token = ++runToken; updateUi();
    try {
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
      const blockingCards = rows.flatMap((row) => officialCards(view, row.url));
      const blockingUrls = targetUrlTextblocks(view);
      if (blockingCards.length || blockingUrls.length) {
        throw new FatalError(`通知カード/URL一覧が残っています(${blockingCards.length + blockingUrls.length}ブロック)。先に「削」`);
      }
      rows.forEach((row) => {
        if (row.proof !== FINAL_PROOF) { row.status = 'done'; row.proof = DELETE_PROOF; }
      });
      saveRows();
      const workRows = missingImageRows(view);
      if (!workRows.length) {
        await saveDraftToServer(view, token, verifyFinalDocument, `${rows.length}枚の極薄リンクを通常保存中…`);
        rows.forEach((row) => { row.status = 'done'; row.proof = FINAL_PROOF; }); saveRows();
        setStatus(`${rows.length}/${rows.length}枚｜極薄画像＋URLは完成済み ✅`); return;
      }
      setStatus(`${workRows.length}枚の極薄画像を並列準備中…`);
      const files = await mapLimit(workRows, 6, async (row, index) => {
        if (token !== runToken || !enabled()) throw new FatalError('停止しました');
        const file = await fileFor(row);
        setStatus(`画像準備 ${index + 1}/${workRows.length}…`); return file;
      });
      const completion = new Promise((resolve, reject) => {
        imageArm = {
          token, view, workRows, files, resolve, reject, consumed: false, linked: false, input: null,
          beforeIds: new Set(imageNodes(view).map((entry) => String(entry.node.attrs?.id || '')).filter(Boolean)),
          beforeInputs: new Set(document.querySelectorAll('input[type="file"]')), timer: null
        };
      });
      installImageInputBridge();
      imageArm.timer = setTimeout(() => imageArm?.reject(new Error('画像選択待機が3分を超えました')), 180000);
      setStatus(`準備OK｜本文をタップ→「＋」→「画像」を1回だけ`);
      await completion;
      setStatus(`${rows.length}/${rows.length}枚を一括挿入＋URL付与＋余白除去＋保存 ✅`);
    } catch (error) {
      setStatus(`画像工程停止：${error?.message || String(error)}（途中分は「画」で再開）`, true);
    } finally { cancelImageArm(); running = false; updateUi(); }
  }
  function stopRun() {
    runToken += 1;
    if (waitCancel) waitCancel('停止しました'); waitCancel = null;
    cancelImageArm('停止しました');
    setStatus('現在の1件を止めています…完了済みは保持します', true);
    updateUi();
  }
  async function retryFailed() {
    if (running) return;
    const indexes = rows.map((row, index) => row.status !== 'done' ? index : -1).filter((index) => index >= 0);
    if (!indexes.length) return;
    indexes.forEach((index) => { rows[index].status = 'ready'; rows[index].error = ''; }); saveRows(); updateUi(); runIndexes(indexes);
  }
  function routeCheck() {
    if (!document.body) return;
    document.body.dataset.mumeiNotePublish = isPublishPage() ? '1' : '0';
    if (!isEditPage()) return;
    if (openedArticle && openedArticle !== articleKey()) {
      closeTool(); mode = ''; items = []; rows = []; coreCache = null; viewCache = null;
    }
    if (!document.getElementById(PANEL) || !document.getElementById(TOGGLE)) mount();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('button');
    const label = button?.textContent?.trim() || '';
    if (label === '公開に進む' && document.body) {
      document.body.dataset.mumeiNotePublish = '1';
      const reset = getJSON(resetKey(), null);
      if (reset?.state === 'prepared') setJSON(resetKey(), { ...reset, state: 'publish-page' });
    }
    if (isPublishPage() && /^(更新|更新する|投稿|投稿する|公開|公開する)$/.test(label)) {
      const reset = getJSON(resetKey(), null);
      if (reset?.state === 'prepared' || reset?.state === 'publish-page') {
        setJSON(resetKey(), { ...reset, state: 'submitted', at: Date.now() });
      }
    }
  }, true);
  setInterval(routeCheck, 500);
})();
