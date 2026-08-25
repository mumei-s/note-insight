// ==UserScript==
// @name         無名S note 極薄ワンタップ COMPLETE 13.0
// @namespace    https://github.com/mumei-s/note-insight/batch-bridge-610
// @version      13.0.0
// @description  10枚／全107枚を画像選択1回で一括挿入し、各画像へ対応URLを自動付与。小型パネルは×以外で消えない
// @match        https://editor.note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js?v=13.0.0
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js?v=13.0.0
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
  if (page.__MUMEI_NOTE_THIN_BATCH_13000__) return;
  const OLD_FLAGS = [
    '__MUMEI_NOTE_NEW10_SEND_12100__', '__MUMEI_NOTE_NEW10_SEND_12000__',
    '__MUMEI_NOTE_CLEAN_NOTIFY_11100__',
    '__MUMEI_NOTE_CLEAN_NOTIFY_11000__',
    '__MUMEI_NOTE_LIST_FALLBACK_10000__',
    '__MUMEI_NOTIFY_MANUAL_QUEUE_9000__',
    '__MUMEI_NOTIFY_COMPLETE_8300__', '__MUMEI_NOTIFY_COMPLETE_8200__', '__MUMEI_NOTIFY_COMPLETE_8100__',
    '__MUMEI_NOTIFY_FINAL_8000__', '__MUMEI_NOTIFY_COMPLETE_8000__',
    '__MUMEI_NOTIFY_COMPLETE_7200__', '__MUMEI_NOTIFY_COMPLETE_7100__', '__MUMEI_NOTIFY_COMPLETE_7000__',
    '__MUMEI_BATCH_BRIDGE_680__', '__MUMEI_BATCH_BRIDGE_670__', '__MUMEI_BATCH_BRIDGE_650__',
    '__MUMEI_BATCH_BRIDGE_620__', '__MUMEI_DIRECT_SUCCESS_3230__', '__MUMEI_DIRECT_SUCCESS_3220__',
    '__MUMEI_DIRECT_SUCCESS_3200__'
  ];
  page.__MUMEI_NOTE_THIN_BATCH_13000__ = true;
  OLD_FLAGS.forEach((key) => { page[key] = true; });
  try { localStorage.setItem('mumei_note_card_active_articles_v1', '[]'); } catch (_) {}

  const VERSION = '13.0';
  const W = 860;
  const H = 140;
  const CREATOR = '無名S note';
  const FINAL_MANIFEST = 'https://mumei-s.github.io/note-insight/note-summer-107/manifest.json';
  const ACTIVE_KEY = 'mumei_thin_panel_open_v1300';
  const RUN_PREFIX = 'mumei_thin_run_v1300';
  const MODE_PREFIX = 'mumei_thin_mode_v1300';
  const RESET_PREFIX = 'mumei_thin_reset_v1300';
  const DIAG_PREFIX = 'mumei_notify_diag3_v1110';
  const NEW10_MODE = 'new10send';
  const NEW10_STATE_PREFIX = 'mumei_new10_state_v120';
  const NEW10_ROWS_PREFIX = 'mumei_new10_rows_v120';
  const DELETE_PROOF = 'notification-cards-and-url-list-deleted-v1100';
  const FINAL_PROOF = 'batch-thin-image-linked-saved-v1100';
  const TOGGLE = 'mumei-thin-toggle-v1300';
  const PANEL = 'mumei-thin-panel-v1300';
  const STATUS = 'mumei-thin-status-v1300';
  const STYLE = 'mumei-thin-style-v1300';

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

  const DIAG_ITEMS = [
    ['https://note.com/ss_yr/n/nbeaa82005066', 'ちび創作大賞🏆 結果発表‼️＆〖告知〗', 'clean'],
    ['https://note.com/ss_yr/n/n5dec637983d0', '100円noteでつながる購入応援企画‼️高評価noteも紹介📔〖Monetize Crew〗💰', 'image-live'],
    ['https://note.com/ss_yr/n/n40a631eb54c4', '結果発表🎙️#noteスキ動画コンテスト👑', 'image-history']
  ].map(([url, title, diagRole], index) => ({ index: index + 1, url, title, diagRole, width: W, height: H }));

  let activeArticle = '';
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
  let routeTimer = null;
  let noteApiOriginCache = '';
  let notificationShutdown = false;
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
  function enabled() { return Boolean(isEditPage() && articleKey()); }
  function stateKey(selectedMode = mode) { return `${RUN_PREFIX}:${articleKey() || 'unknown'}:${selectedMode || 'none'}`; }
  function modeKey() { return `${MODE_PREFIX}:${articleKey() || 'unknown'}`; }
  function resetKey() { return `${RESET_PREFIX}:${articleKey() || 'unknown'}:${mode || getJSON(modeKey(), 'none')}`; }
  function diagKey() { return `${DIAG_PREFIX}:${articleKey() || 'unknown'}`; }
  function diagState() { return getJSON(diagKey(), { stage: 'start', at: 0 }); }
  function setDiagStage(stage, extra = {}) { setJSON(diagKey(), { stage, at: Date.now(), ...extra }); }
  function new10StateKey() { return `${NEW10_STATE_PREFIX}:${articleKey() || 'unknown'}`; }
  function new10RowsKey() { return `${NEW10_ROWS_PREFIX}:${articleKey() || 'unknown'}`; }
  function getNew10State() { return getJSON(new10StateKey(), { stage: 'idle', at: 0 }); }
  function setNew10State(stage, extra = {}) { setJSON(new10StateKey(), { stage, at: Date.now(), ...extra }); }
  function isNew10Mode() { return mode === NEW10_MODE; }
  function storedRows(selectedMode) {
    const value = getJSON(selectedMode === NEW10_MODE ? new10RowsKey() : stateKey(selectedMode), []);
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
    setJSON(mode === NEW10_MODE ? new10RowsKey() : stateKey(), rows.map((row) => ({
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
  function renderList() {}
  function updateButtons() {
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    panel.querySelectorAll('button').forEach((button) => {
      button.disabled = running && button.dataset.action !== 'close';
    });
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
      #mumei-notify-toggle-v900,#mumei-notify-panel-v900,
      #mumei-notify-toggle-v1000,#mumei-notify-panel-v1000,
      #mumei-notify-toggle-v1100,#mumei-notify-panel-v1100,
      #mumei-notify-toggle-v1200,#mumei-notify-panel-v1200,
      #mumei-notify-toggle-v1210,#mumei-notify-panel-v1210{display:none!important}
      #${TOGGLE}{position:fixed;right:5px;bottom:73px;z-index:2147483647;width:30px;height:30px;border:0;
        border-radius:999px;padding:0;background:#0f766e;color:#fff;font:800 14px/30px system-ui;
        box-shadow:0 2px 8px rgba(0,0,0,.28);touch-action:manipulation}
      #${TOGGLE}[data-open="1"]{display:none}
      #${PANEL}{position:fixed;right:5px;bottom:72px;z-index:2147483647;display:none;align-items:center;gap:2px;
        height:34px;padding:2px;border-radius:9px;background:#111827;color:#fff;box-shadow:0 3px 12px rgba(0,0,0,.32);
        font-family:system-ui,-apple-system,sans-serif}
      #${PANEL}[data-open="1"]{display:flex}
      #${PANEL} button{height:30px;min-width:30px;border:0;border-radius:7px;padding:0 6px;color:#fff;background:#374151;
        font:800 10px/30px system-ui;white-space:nowrap;touch-action:manipulation}
      #${PANEL} button[data-main-action="10"]{background:#2563eb}
      #${PANEL} button[data-main-action="107"]{background:#059669}
      #${PANEL} button[data-action="reset"]{background:#92400e}
      #${PANEL} button[data-action="delete"]{background:#7c3aed}
      #${PANEL} button[data-action="send-new10"]{background:#dc2626}
      #${PANEL} button[data-action="close"]{padding:0;width:28px;min-width:28px}
      #${PANEL} button:disabled{opacity:.55}
      #${STATUS}{position:fixed;right:5px;bottom:110px;z-index:2147483647;display:none;max-width:min(300px,calc(100vw - 16px));
        padding:5px 7px;border-radius:7px;background:#064e3b;color:#fff;font:700 10px/1.35 system-ui;
        box-shadow:0 2px 8px rgba(0,0,0,.25)}
      #${PANEL}[data-open="1"] #${STATUS}{display:block}
      #${STATUS}[data-bad="1"]{background:#991b1b}
      body[data-mumei-note-publish="1"] #${TOGGLE},body[data-mumei-note-publish="1"] #${PANEL}{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function removeKnownLegacyTools() {
    const ids = [
      'mumei-card-system-toggle', 'mumei-direct-success-panel', 'mumei-direct-success-btn',
      'mumei-notify-test-panel', 'mumei-notify-test-btn', 'mumei-notify-clean-btn',
      'mumei-bridge610-panel', 'mumei-bridge610-btn', 'mumei-bridge107-btn',
      'mumei-final800-toggle', 'mumei-final800-panel',
      'mumei-notify-toggle-v710', 'mumei-notify-panel-v710',
      'mumei-notify-toggle-v720', 'mumei-notify-panel-v720',
      'mumei-notify-toggle-v810', 'mumei-notify-panel-v810',
      'mumei-notify-toggle-v820', 'mumei-notify-panel-v820',
      'mumei-notify-toggle-v900', 'mumei-notify-panel-v900',
      'mumei-notify-toggle-v1000', 'mumei-notify-panel-v1000',
      'mumei-notify-toggle-v1100', 'mumei-notify-panel-v1100',
      'mumei-notify-toggle-v1200', 'mumei-notify-panel-v1200',
      'mumei-notify-toggle-v1210', 'mumei-notify-panel-v1210'
    ];
    ids.forEach((id) => document.getElementById(id)?.remove());
  }

  function shutdownForManualNotification(count, diag = false) {
    notificationShutdown = true;
    runToken += 1; running = false; setJSON(ACTIVE_KEY, false);
    if (waitCancel) waitCancel('通知工程へ移行');
    waitCancel = null; cancelImageArm();
    removeKnownLegacyTools();
    document.removeEventListener('click', publishClickHandler, true);
    if (routeTimer) clearInterval(routeTimer);
    routeTimer = null;
    document.getElementById(PANEL)?.remove();
    document.getElementById(TOGGLE)?.remove();
    page.__MUMEI_NOTE_MANUAL_NOTIFICATION_CLEAN__ = true;
    if (diag) {
      page.alert(`3件切り分け準備完了。URL3件をコピーしました。\n\n① 完全クリーン\n② 画像🔗を残した状態\n③ 画像🔗を一度保存・更新後に削除済み\n\nツールは完全停止済みです。\n本文末尾へ3件を貼付 → 各URL末尾で実Enter → 更新 → 通知確認。`);
    } else {
      page.alert(`${count}件URL一覧コピー済み。\n通知工程では現行・旧版ツールを完全停止しました。\n\n本文へ1回貼付 → 各URL末尾で実Enter。\n通知確認後は編集画面を再読み込み →「削」→「10画」。`);
    }
  }

  function closeTool() {
    runToken += 1; running = false; setJSON(ACTIVE_KEY, false);
    if (waitCancel) waitCancel('ツールを閉じたため停止');
    waitCancel = null; cancelImageArm();
    const panel = document.getElementById(PANEL), toggle = document.getElementById(TOGGLE);
    if (panel) panel.dataset.open = '0';
    if (toggle) { toggle.dataset.open = '0'; toggle.textContent = '画'; }
    updateButtons();
  }

  function restoreLastMode() {
    if (running || mode || rows.length) return;
    const last = getJSON(modeKey(), '');
    if (!['test10', 'final107'].includes(last)) return;
    mode = last;
    setStatus(`${last === 'final107' ? '全107枚' : '10枚'}を選択中｜画像ボタンで貼り直せます`);
  }

  function openTool() {
    const key = articleKey();
    if (!isEditPage() || !key) return;
    activeArticle = key; setJSON(ACTIVE_KEY, true);
    const panel = document.getElementById(PANEL), toggle = document.getElementById(TOGGLE);
    if (panel) panel.dataset.open = '1';
    if (toggle) { toggle.dataset.open = '1'; toggle.textContent = '画'; }
    setStatus(`極薄 ${VERSION}｜10画／全画 → 本文 → ＋ → 画像（1回）`);
    restoreLastMode();
  }
  function toggleTool() {
    const panel = document.getElementById(PANEL);
    if (panel?.dataset.open === '1') closeTool(); else openTool();
  }

  function mount() {
    if (notificationShutdown || !document.body || !isEditPage()) return;
    document.body.dataset.mumeiNotePublish = '0';
    installStyle();
    removeKnownLegacyTools();
    let toggle = document.getElementById(TOGGLE);
    if (!toggle) {
      toggle = document.createElement('button');
      Object.assign(toggle, { id: TOGGLE, type: 'button', textContent: '画', title: '極薄画像ツール' });
      toggle.dataset.open = '0'; toggle.addEventListener('click', toggleTool); document.body.appendChild(toggle);
    }
    let panel = document.getElementById(PANEL);
    if (!panel) {
      panel = document.createElement('section'); panel.id = PANEL; panel.dataset.open = '0';
      panel.innerHTML = `<button type="button" data-main-action="10" title="10枚を一括準備。次に＋→画像を1回">10画</button>
        <button type="button" data-main-action="107" title="全107枚を一括準備。次に＋→画像を1回">全画</button>
        <button type="button" data-action="send-new10" title="通知用URL一覧をコピーしてツールを完全停止">送</button>
        <button type="button" data-action="delete" title="対象のURLカードと生URLだけを一括削除">削</button>
        <button type="button" data-action="reset" title="対象画像・カード・URLを全消去して初期化">初</button>
        <button type="button" data-action="close" title="しまう">×</button>
        <div id="${STATUS}" data-bad="0">極薄 ${VERSION}</div>`;
      panel.addEventListener('click', onPanelClick); document.body.appendChild(panel);
    }
    activeArticle = articleKey();
    if (getJSON(ACTIVE_KEY, false) === true) {
      panel.dataset.open = '1'; toggle.dataset.open = '1'; restoreLastMode();
    }
  }

  async function onPanelClick(event) {
    const button = event.target.closest('button');
    if (!button || !enabled()) return;
    if (running && button.dataset.action !== 'close') return;
    if (button.dataset.mainAction === '10') return startFreshImageBatch('test10');
    if (button.dataset.mainAction === '107') return startFreshImageBatch('final107');
    if (button.dataset.action === 'reset') return resetCurrentTargets();
    if (button.dataset.action === 'send-new10') return prepareManualNotification();
    if (button.dataset.action === 'delete') return deleteCurrentNotificationBlocks();
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
        item.height !== H || !item.title || !item.url || !item.cardPath ||
        !/^https:\/\/note\.com\/[^/]+\/n\/n[a-z0-9]+$/i.test(item.url) ||
        !new RegExp(`/cards/${String(index + 1).padStart(3, '0')}\\.png$`).test(item.cardPath))) {
      throw new FatalError('107件データ不整合');
    }
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
    const name = `${String(item.index).padStart(3, '0')}.png`;
    const blob = await xhr(new URL(`./cards/${name}`, FINAL_MANIFEST).href, 'blob');
    if (!blob || blob.size < 100) throw new Error('画像取得失敗');
    const bytes = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
    const png = bytes.length === 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const width = png ? ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0 : 0;
    const height = png ? ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0 : 0;
    if (!png || width !== W || height !== H) throw new FatalError(`${name} 寸法不一致 ${width}x${height}`);
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
  function remoteImage(node) {
    const src = String(node?.attrs?.src || '');
    return /^https:\/\//i.test(src) && !/^https:\/\/editor\.note\.com\/icons\//i.test(src);
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
  function verifyDiagBase(view) {
    for (const row of rows) {
      if (officialCards(view, row.url).length || exactUrlParagraphs(view, row.url).length || findByLink(view, row.url)) {
        throw new FatalError(`3件初期化残り: ${row.index}`);
      }
    }
    if (targetUrlTextblocks(view).length) throw new FatalError('3件URL一覧が残っています');
    return serializedBody(view);
  }
  function verifyDiagImages(view) {
    const one = rows[0], two = rows[1], three = rows[2];
    if (findByLink(view, one.url)) throw new FatalError('①に画像リンクが残っています');
    if (!findByLink(view, two.url)) throw new FatalError('②の画像リンクがありません');
    if (!findByLink(view, three.url)) throw new FatalError('③の画像リンクがありません');
    if (rows.some((row) => officialCards(view, row.url).length || exactUrlParagraphs(view, row.url).length) || targetUrlTextblocks(view).length) {
      throw new FatalError('3件準備中に標準カード/URLが混在しています');
    }
    return serializedBody(view);
  }
  function verifyDiagReady(view) {
    const one = rows[0], two = rows[1], three = rows[2];
    if (findByLink(view, one.url)) throw new FatalError('①は完全クリーンではありません');
    if (!findByLink(view, two.url)) throw new FatalError('②の画像🔗がありません');
    if (findByLink(view, three.url)) throw new FatalError('③の画像🔗がまだ残っています');
    if (rows.some((row) => officialCards(view, row.url).length || exactUrlParagraphs(view, row.url).length) || targetUrlTextblocks(view).length) {
      throw new FatalError('標準カード/URLが先に入っています');
    }
    return serializedBody(view);
  }

  async function saveDraftToServer(view, token, verifier, progressText) {
    if (!view) throw new FatalError('EditorViewなし。画面を再読込してください');
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

  function rowFrom(item, stored) {
    const proof = [DELETE_PROOF, FINAL_PROOF].includes(stored?.proof) ? stored.proof : '';
    return { ...item, status: proof ? 'done' : 'ready', nodeId: stored?.nodeId || '',
      owned: Boolean(stored?.owned), trusted: Boolean(stored?.trusted), cardKey: stored?.cardKey || '',
      proof, error: stored?.error || '' };
  }

  async function prepareMode(selectedMode) {
    mode = selectedMode; setJSON(modeKey(), selectedMode);
    items = selectedMode === 'final107' ? await loadFinalItems() : selectedMode === 'diag3' ? DIAG_ITEMS : TEST_ITEMS;
    const stored = new Map(legacyRows(selectedMode).map((row) => [row.url, row]));
    storedRows(selectedMode).forEach((row) => stored.set(row.url, row));
    rows = items.map((item) => rowFrom(item, stored.get(item.url)));
    if (selectedMode === 'diag3') { saveRows(); updateUi(); return; }
    const view = findView();
    if (view) for (const row of rows) {
      const cards = officialCards(view, row.url);
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
      shutdownForManualNotification(rows.length);
    } catch (error) {
      setStatus(`一覧コピー停止：${error?.message || String(error)}`, true);
    } finally { running = false; updateUi(); }
  }

  async function copyCurrentList() {
    const selectedMode = mode || getJSON(modeKey(), '');
    if (selectedMode === 'diag3') return runDiag3();
    if (!['test10', 'final107'].includes(selectedMode)) {
      setStatus('先に「3」「10」「107」のどれかを押してください', true); return;
    }
    return copyUrlListMode(selectedMode);
  }

  function new10StageStatus() {
    const stage = getNew10State().stage;
    const messages = {
      idle: '新10未開始｜「新10」を押してください',
      new10_ready: '新10準備完了 ✅ 次は「画」',
      images_ready: '画像🔗 10/10 完成 ✅ 次は「送」',
      cards_ready: '標準カード 10/10 完成 ✅ 新規記事を公開してください',
      published_wait: '公開済み｜本アカで通知確認後「削」',
      cards_deleted: '通知カード削除済み ✅ 画像🔗10件は保持'
    };
    setStatus(messages[stage] || `新10状態: ${stage}`);
  }

  async function startNew10Mode(restoring = false) {
    if (running || !enabled()) return;
    running = true; ++runToken; updateUi();
    try {
      mode = NEW10_MODE;
      setJSON(modeKey(), NEW10_MODE);
      items = TEST_ITEMS;
      const stored = new Map(storedRows(NEW10_MODE).map((row) => [row.url, row]));
      rows = items.map((item) => rowFrom(item, stored.get(item.url)));
      const state = getNew10State();
      if (!restoring && state.stage === 'idle') {
        rows.forEach((row) => {
          row.status = 'ready'; row.proof = ''; row.error = '';
        });
        saveRows();
        setNew10State('new10_ready');
      }
      new10StageStatus();
    } catch (error) {
      setStatus(`新10準備停止：${error?.message || String(error)}`, true);
    } finally { running = false; updateUi(); }
  }

  function verifyNew10ImageLinks(view, allowCards = false) {
    if (rows.length !== 10) throw new FatalError('新10の対象が10件ではありません');
    const bad = [];
    for (const row of rows) {
      const image = findById(view, row.nodeId) || findByLink(view, row.url);
      const imageOK = Boolean(image && remoteImage(image.node) &&
        normalizeUrl(image.node.attrs?.link) === normalizeUrl(row.url));
      if (!imageOK) bad.push(row.index);
      if (!allowCards && officialCards(view, row.url).length) {
        throw new FatalError(`画像工程中に標準カードが混在: ${row.index}`);
      }
      if (exactUrlParagraphs(view, row.url).length) {
        throw new FatalError(`新10工程中に生URLが混在: ${row.index}`);
      }
    }
    if (targetUrlTextblocks(view).length) throw new FatalError('新10工程中にURL一覧が残っています');
    if (bad.length) throw new FatalError(`画像リンク不足: ${bad.join(',')}`);
    return serializedBody(view);
  }

  function verifyNew10Images(view) { return verifyNew10ImageLinks(view, false); }

  async function finishNew10Images(arm) {
    const created = await waitBatchImages(arm);
    if (created.length !== arm.workRows.length) {
      throw new FatalError(`画像アップロード数不一致 ${created.length}/${arm.workRows.length}`);
    }
    setStatus(`画像${created.length}枚アップロード済み｜URL一括付与中…`);
    await linkAndCompactImages(arm, created);
    arm.linked = true;
    await saveDraftToServer(arm.view, arm.token, verifyNew10Images, '画像🔗10件を保存中…');
    rows.forEach((row) => { row.status = 'done'; row.proof = FINAL_PROOF; row.error = ''; });
    saveRows(); setNew10State('images_ready');
    setStatus('画像🔗 10/10 完成 ✅ 次は「送」');
  }

  async function armNew10Images() {
    if (running || !enabled()) return;
    if (!isNew10Mode()) { setStatus('先に「新10」を押してください', true); return; }
    const stage = getNew10State().stage;
    if (!['new10_ready', 'images_ready'].includes(stage)) {
      setStatus(`新10状態不一致: ${stage}`, true); return;
    }
    running = true; ++runToken; updateUi();
    try {
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
      const workRows = missingImageRows(view);
      if (!workRows.length) {
        await saveDraftToServer(view, runToken, verifyNew10Images, '画像🔗10件を確認・保存中…');
        setNew10State('images_ready'); setStatus('画像🔗 10/10 完成済み ✅ 次は「送」'); return;
      }
      setStatus(`${workRows.length}枚の画像を準備中…`);
      await armImagesForRows(workRows, 'new10');
      setNew10State('images_ready'); setStatus('画像🔗 10/10 完成 ✅ 次は「送」');
    } catch (error) {
      setStatus(`新10画像停止：${error?.message || String(error)}`, true);
    } finally { cancelImageArm(); running = false; updateUi(); }
  }

  function currentHostNoteKey() {
    const key = articleKey();
    if (!/^n[a-z0-9]{8,}$/i.test(key)) throw new FatalError('新規記事のnote keyを取得できません');
    return key;
  }

  function firstValidStorageValue(exactKey, keyPattern, valuePattern) {
    try {
      const exact = localStorage.getItem(exactKey) || '';
      if (valuePattern.test(exact)) return exact;
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || '';
        if (!keyPattern.test(key)) continue;
        const value = localStorage.getItem(key) || '';
        if (valuePattern.test(value)) return value;
      }
    } catch (_) {}
    return '';
  }

  function nativeApiHeaders() {
    const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    const clientCode = firstValidStorageValue('note-client-code', /note.*client.*code/i, /^[a-f0-9]{64}$/i);
    const csrf = document.querySelector('meta[name="csrf-token"],meta[name="csrf_token"],meta[name="xsrf-token"]')
      ?.getAttribute('content') || firstValidStorageValue('csrf-token', /(?:csrf|xsrf)/i, /^.{16,512}$/);
    if (clientCode) headers['X-Note-Client-Code'] = clientCode;
    if (csrf) headers['X-CSRF-Token'] = csrf;
    return headers;
  }

  async function probeNoteApiOrigin(origin) {
    try {
      const response = await page.fetch(`${origin}/api/v2/current_user`, {
        method: 'GET', credentials: 'include', cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) return { origin, ok: false, status: response.status };
      const json = await response.json();
      const user = json?.data;
      return { origin, ok: Boolean(user && typeof user === 'object'), status: response.status };
    } catch (_) {
      return { origin, ok: false, status: '通信不可' };
    }
  }

  async function resolveNoteApiOrigins() {
    if (noteApiOriginCache) return [noteApiOriginCache];
    const candidates = [...new Set([location.origin, 'https://note.com'])];
    const results = [];
    for (const candidate of candidates) {
      const result = await probeNoteApiOrigin(candidate);
      results.push(result);
    }
    const authenticated = results.filter((item) => item.ok).map((item) => item.origin);
    if (authenticated.length) return authenticated;
    throw new FatalError(`noteログイン確認失敗 ${results.map((item) =>
      `${new URL(item.origin).host}:${item.status}`).join(' / ')}`);
  }

  function makeNativeEmbedForm(targetUrl, hostKey) {
    const form = new page.FormData();
    form.append('url', targetUrl);
    form.append('height', '211');
    form.append('embeddable_type', 'Note');
    form.append('embeddable_key', hostKey);
    return form;
  }

  async function fetchNativeEmbed(targetUrl, hostKey) {
    const apiOrigins = await resolveNoteApiOrigins();
    const failures = [];
    for (let index = 0; index < apiOrigins.length; index += 1) {
      const apiOrigin = apiOrigins[index], endpoint = `${apiOrigin}/api/v1/embed`;
      try {
        const response = await page.fetch(endpoint, {
          method: 'POST', credentials: 'include', body: makeNativeEmbedForm(targetUrl, hostKey),
          headers: nativeApiHeaders()
        });
        if (response.status === 429) throw new FatalError('note側429。カード生成を停止します');
        if (response.status === 401 || response.status === 403) {
          failures.push(`${new URL(apiOrigin).host}:${response.status}`);
          if (index < apiOrigins.length - 1) continue;
          throw new FatalError(`note認証エラー ${failures.join(' / ')}`);
        }
        if (response.status === 400 || response.status === 422) throw new FatalError(`note埋め込みpayload不整合 ${response.status}`);
        if (!response.ok) throw new Error(`embed HTTP ${response.status}`);
        const json = await response.json();
        const embedded = json?.data?.embedded_content;
        const key = String(embedded?.key || ''), html = String(embedded?.html_for_embed || '');
        if (!/^emb[a-z0-9]+$/i.test(key)) throw new Error('embedded_content.key不正');
        if (!html.includes('note-embed')) throw new Error('html_for_embedがnote純正形式ではありません');
        if (embedded?.url && normalizeUrl(embedded.url) !== normalizeUrl(targetUrl)) {
          throw new Error('embedded_content.url不一致');
        }
        noteApiOriginCache = apiOrigin;
        return { url: targetUrl, key, html };
      } catch (error) {
        if (error instanceof FatalError) throw error;
        failures.push(`${new URL(apiOrigin).host}:${error?.message || String(error)}`);
        if (index < apiOrigins.length - 1) continue;
      }
    }
    noteApiOriginCache = '';
    throw new FatalError(`note純正埋め込み取得失敗: ${failures.join(' / ')}`);
  }

  function buildEmbedAttrs(embedType, data) {
    const attrs = {}, specs = embedType?.spec?.attrs || {};
    for (const [name, spec] of Object.entries(specs)) {
      attrs[name] = Object.prototype.hasOwnProperty.call(spec, 'default') ? spec.default : null;
    }
    if ('src' in specs) attrs.src = data.url;
    if ('htmlForEmbed' in specs) attrs.htmlForEmbed = data.html;
    if ('embeddedContentKey' in specs) attrs.embeddedContentKey = data.key;
    for (const name of Object.keys(specs)) {
      if (/^(src|url|dataSrc)$/i.test(name)) attrs[name] = data.url;
      if (/html.*embed/i.test(name)) attrs[name] = data.html;
      if (/embedded.*content.*key/i.test(name)) attrs[name] = data.key;
      if (/service/i.test(name)) attrs[name] = 'note';
      if (/height/i.test(name)) attrs[name] = 211;
    }
    return attrs;
  }

  function buildNativeEmbedNode(view, data) {
    const embedType = view.state.schema.nodes.embed;
    if (!embedType) throw new FatalError('ProseMirror embed nodeがありません');
    const attrs = buildEmbedAttrs(embedType, data);
    let node;
    try { node = embedType.create(attrs); } catch (_) { node = embedType.createAndFill(attrs); }
    if (!node || normalizeUrl(node.attrs?.src) !== normalizeUrl(data.url) ||
      !node.attrs?.htmlForEmbed || String(node.attrs?.embeddedContentKey || '') !== data.key) {
      throw new FatalError('純正embed node属性を生成できません');
    }
    return node;
  }

  function verifyNew10Cards(view) {
    verifyNew10ImageLinks(view, true);
    const invalid = [];
    for (const row of rows) {
      const cards = officialCards(view, row.url);
      if (cards.length !== 1) invalid.push(row.index);
      if (exactUrlParagraphs(view, row.url).length) {
        throw new FatalError(`標準カード生成後に生URLが残っています: ${row.index}`);
      }
    }
    if (targetUrlTextblocks(view).length) throw new FatalError('標準カード生成後にURL一覧が残っています');
    if (invalid.length) throw new FatalError(`標準カード数不一致: ${invalid.join(',')}`);
    return serializedBody(view);
  }

  async function sendNew10Cards() {
    if (running || !enabled()) return;
    if (!isNew10Mode()) { setStatus('先に「新10」→「画」を完了してください', true); return; }
    if (getNew10State().stage !== 'images_ready') {
      setStatus('先に画像🔗10件を完成させてください', true); return;
    }
    running = true; const token = ++runToken; updateUi();
    let view = null, inserted = false;
    try {
      view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
      verifyNew10Images(view);
      const existing = rows.flatMap((row) => officialCards(view, row.url));
      if (existing.length) throw new FatalError(`既に標準カードが${existing.length}件あります。先に「削」`);
      const hostKey = currentHostNoteKey(), prepared = [];
      for (let index = 0; index < rows.length; index += 1) {
        if (token !== runToken || !enabled()) throw new FatalError('停止しました');
        setStatus(`note純正カード準備 ${index + 1}/10…`);
        prepared.push(await fetchNativeEmbed(rows[index].url, hostKey));
        if (index < rows.length - 1) await sleep(350);
      }
      if (prepared.length !== 10) throw new FatalError(`埋め込み準備数不一致 ${prepared.length}/10`);
      const paragraph = view.state.schema.nodes.paragraph;
      if (!paragraph) throw new FatalError('paragraph nodeなし');
      const nodes = prepared.map((data) => buildNativeEmbedNode(view, data));
      let transaction = view.state.tr, pos = transaction.doc.content.size;
      for (const node of nodes) {
        transaction = transaction.insert(pos, node); pos += node.nodeSize;
      }
      view.dispatch(transaction.scrollIntoView()); inserted = true;
      ensureFreshParagraph(view); verifyNew10Cards(view);
      await saveDraftToServer(view, token, verifyNew10Cards, '標準カード10件を保存中…');
      setNew10State('cards_ready');
      setStatus('標準カード 10/10 完成 ✅ 新規記事を公開してください');
      page.alert('新10送の準備完了。\n\n上：画像リンク10件\n下：note純正標準カード10件\n\nnoteの「公開に進む」→「公開」で新規投稿してください。\n本アカ側で通知確認後、編集へ戻って「削」。');
    } catch (error) {
      let rollbackError = '';
      if (inserted && view) {
        try {
          deleteBlocks(view, rows.flatMap((row) => officialCards(view, row.url)));
          verifyNew10Images(view);
          if (token === runToken && enabled()) {
            await saveDraftToServer(view, token, verifyNew10Images, '失敗したカードを全撤回・保存中…');
          }
        } catch (rollback) {
          rollbackError = `／撤回保存失敗: ${rollback?.message || String(rollback)}`;
        }
      }
      setNew10State('images_ready', { lastError: error?.message || String(error) });
      setStatus(`新10カード停止：${error?.message || String(error)}${rollbackError}（公開しないでください）`, true);
    } finally { running = false; updateUi(); }
  }

  async function deleteNew10CardsOnly() {
    if (running || !enabled()) return;
    if (!isNew10Mode()) { setStatus('新10モードではありません', true); return; }
    if (!['cards_ready', 'published_wait', 'cards_deleted'].includes(getNew10State().stage)) {
      setStatus('標準カード作成後に「削」を使ってください', true); return;
    }
    running = true; const token = ++runToken; updateUi();
    try {
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
      const cards = rows.flatMap((row) => officialCards(view, row.url));
      if (getNew10State().stage === 'cards_deleted' && !cards.length) {
        verifyNew10Images(view);
        setStatus('通知カードは削除済み ✅ 画像🔗10件は保持'); return;
      }
      if (cards.length !== 10) throw new FatalError(`削除前カード数不一致 ${cards.length}/10`);
      const hits = [...cards, ...rows.flatMap((row) => exactUrlParagraphs(view, row.url)), ...targetUrlTextblocks(view)];
      deleteBlocks(view, hits); verifyNew10Images(view);
      await saveDraftToServer(view, token, verifyNew10Images, `通知カード${cards.length}件を削除・保存中…`);
      setNew10State('cards_deleted');
      setStatus(`通知カード ${cards.length}/10 削除 ✅ 画像🔗10件は保持`);
    } catch (error) {
      setStatus(`新10削除停止：${error?.message || String(error)}（公開・更新しない）`, true);
    } finally { running = false; updateUi(); }
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
      rows.forEach((row) => deletions.push(...officialCards(view, row.url)));
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
      if (isNew10Mode()) {
        setNew10State('new10_ready');
        setStatus('新10初期化＋保存 ✅ 公開→更新後、編集へ戻って「画」');
      } else {
        setStatus('初期化＋保存 ✅ 公開に進み「更新」→編集へ戻って10/107');
      }
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
    if (!mode || !rows.length || !enabled()) { setStatus('先に「3」「10」「107」で対象を読み込んでください', true); return; }
    running = true; const token = ++runToken; updateUi();
    try {
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
      const hits = rows.flatMap((row) => officialCards(view, row.url));
      hits.push(...targetUrlTextblocks(view));
      const removed = deleteBlocks(view, hits);
      await saveDraftToServer(view, token, verifyCardsDeleted, `カード/URL一覧 ${removed}ブロックを一括削除・保存中…`);
      rows.forEach((row) => { row.status = 'done'; row.proof = DELETE_PROOF; row.cardKey = ''; row.error = ''; });
      saveRows();
      if (mode === 'diag3') {
        setStatus(removed ? `3件テストカード/URL ${removed}ブロック削除済み ✅ 全テスト跡を消すなら「初」` : '3件テストカード/URLは0件 ✅ 全テスト跡を消すなら「初」');
      } else {
        setStatus(removed ? `カード/URL一覧 ${removed}ブロック 一括削除＋保存 ✅ 次は「画」` : '対象カード/URL一覧は既に0件 ✅ 次は「画」');
      }
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
        if (imageInput(node)) { injectImageInput(node); return; }
        for (const input of node.querySelectorAll?.('input[type="file"]') || []) {
          if (imageInput(input)) { injectImageInput(input); return; }
        }
      }
    });
    inputObserver.observe(document.documentElement, { childList: true, subtree: true });
    const prototype = page.HTMLInputElement?.prototype;
    if (!prototype) return;
    nativeInputClick = prototype.click;
    prototype.click = function interceptedImageClick(...args) {
      const arm = imageArm;
      if (arm && imageInput(this)) {
        if (!arm.consumed) injectImageInput(this);
        return;
      }
      return nativeInputClick.apply(this, args);
    };
  }
  async function waitBatchImages(arm, timeout = 900000) {
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
      transaction = transaction.setNodeMarkup(hit.pos, hit.node.type, { ...hit.node.attrs, link: row.url }, hit.node.marks);
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
    if (arm.kind === 'new10') return finishNew10Images(arm);
    const created = await waitBatchImages(arm);
    setStatus(`${created.length}/${arm.workRows.length}枚アップロード済み｜URL一括付与＋余白除去中…`);
    await linkAndCompactImages(arm, created);
    arm.linked = true;
    if (arm.kind === 'diag') {
      await saveDraftToServer(arm.view, arm.token, verifyDiagImages, '②③の画像🔗を保存中…');
      setDiagStage('images_saved');
      page.alert('②③の画像🔗を保存しました。\n\n次に「公開に進む」→「更新」。\n編集へ戻ったら、もう一度「3」を押してください。');
    } else {
      await saveDraftToServer(arm.view, arm.token, verifyFinalDocument, `${rows.length}枚の極薄リンクを通常保存中…`);
      rows.forEach((row) => { row.status = 'done'; row.proof = FINAL_PROOF; row.error = ''; });
      saveRows();
    }
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
    if (!arm || arm.consumed || !imageInput(input)) return false;
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

  async function prepareImageFiles(workRows, token = runToken) {
    return mapLimit(workRows, 6, async (row, index) => {
      if (token !== runToken || !enabled()) throw new FatalError('停止しました');
      const file = await fileFor(row);
      setStatus(`画像検査 ${index + 1}/${workRows.length}（860×140）…`); return file;
    });
  }

  async function armImagesForRows(workRows, kind = 'normal', preparedFiles = null) {
    const token = runToken;
    const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
    const files = preparedFiles || await prepareImageFiles(workRows, token);
    if (files.length !== workRows.length || files.some((file) => !(file instanceof page.File))) {
      throw new FatalError(`画像準備数不一致 ${files.length}/${workRows.length}`);
    }
    const completion = new Promise((resolve, reject) => {
      imageArm = {
        token, view, workRows, files, resolve, reject, consumed: false, linked: false, input: null, kind,
        beforeIds: new Set(imageNodes(view).map((entry) => String(entry.node.attrs?.id || '')).filter(Boolean)),
        beforeInputs: new Set(document.querySelectorAll('input[type="file"]')), timer: null
      };
    });
    installImageInputBridge();
    imageArm.timer = setTimeout(() => imageArm?.reject(new Error('画像選択待機が10分を超えました')), 600000);
    setStatus(`${files.length}枚 準備OK｜本文→「＋」→「画像」を1回だけ`);
    await completion;
  }

  async function armBatchImages() {
    if (running) { setStatus('処理中です。「止」で止めてから画像工程へ進んでください', true); return; }
    if (!mode || !rows.length || !enabled()) { setStatus('先に「10」または「107」で対象を読み込んでください', true); return; }
    running = true; ++runToken; updateUi();
    try {
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
      const blockingCards = rows.flatMap((row) => officialCards(view, row.url));
      const blockingUrls = targetUrlTextblocks(view);
      if (blockingCards.length || blockingUrls.length) {
        throw new FatalError(`通知カード/URL一覧が残っています(${blockingCards.length + blockingUrls.length}ブロック)。先に「削」`);
      }
      rows.forEach((row) => { if (row.proof !== FINAL_PROOF) { row.status = 'done'; row.proof = DELETE_PROOF; } });
      saveRows();
      const workRows = missingImageRows(view);
      if (!workRows.length) {
        await saveDraftToServer(view, runToken, verifyFinalDocument, `${rows.length}枚の極薄リンクを通常保存中…`);
        rows.forEach((row) => { row.status = 'done'; row.proof = FINAL_PROOF; }); saveRows();
        setStatus(`${rows.length}/${rows.length}枚｜極薄画像＋URLは完成済み ✅`); return;
      }
      setStatus(`${workRows.length}枚の極薄画像を並列準備中…`);
      await armImagesForRows(workRows, 'normal');
      setStatus(`${rows.length}/${rows.length}枚を一括挿入＋URL付与＋余白除去＋保存 ✅`);
    } catch (error) {
      setStatus(`画像工程停止：${error?.message || String(error)}（途中分は「画」で再開）`, true);
    } finally { cancelImageArm(); running = false; updateUi(); }
  }

  function selectedImageMode(fallback = 'test10') {
    const value = mode || getJSON(modeKey(), '');
    return ['test10', 'final107'].includes(value) ? value : fallback;
  }

  function collectTargetHits(view, includeImages) {
    const targets = new Set(rows.map((row) => normalizeUrl(row.url)));
    const trackedIds = new Set(rows.map((row) => String(row.nodeId || '')).filter(Boolean));
    const hits = [];
    if (includeImages) {
      imageNodes(view).forEach((hit) => {
        const id = String(hit.node.attrs?.id || '');
        const linked = normalizeUrl(hit.node.attrs?.link);
        if (trackedIds.has(id) || targets.has(linked)) hits.push(hit);
      });
    }
    rows.forEach((row) => hits.push(...officialCards(view, row.url), ...exactUrlParagraphs(view, row.url)));
    hits.push(...targetUrlTextblocks(view));
    return hits;
  }

  function resetRowTracking() {
    rows.forEach((row) => {
      row.status = 'ready'; row.nodeId = ''; row.owned = false; row.trusted = false;
      row.cardKey = ''; row.proof = ''; row.error = '';
    });
    saveRows();
  }

  async function startFreshImageBatch(selectedMode) {
    if (running || !enabled()) return;
    running = true; const token = ++runToken; updateUi();
    try {
      setStatus(selectedMode === 'final107' ? 'マガジン107件を検査中…' : '10件を検査中…');
      await prepareMode(selectedMode);
      if (token !== runToken) throw new FatalError('停止しました');
      const files = await prepareImageFiles(rows, token);
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
      const removed = deleteBlocks(view, collectTargetHits(view, true));
      resetRowTracking();
      setStatus(`${rows.length}枚検査OK${removed ? `｜旧対象${removed}ブロック整理済み` : ''}｜本文→＋→画像を1回`);
      await armImagesForRows(rows, 'normal', files);
      verifyFinalDocument(view);
      setStatus(`${rows.length}/${rows.length}枚｜860×140・URL自動付与・余白除去・保存 完了 ✅`);
    } catch (error) {
      setStatus(`画像貼付け停止：${error?.message || String(error)}（完成扱いにしていません）`, true);
    } finally {
      cancelImageArm(); running = false; updateUi();
    }
  }

  async function resetCurrentTargets() {
    if (running || !enabled()) return;
    running = true; const token = ++runToken; updateUi();
    try {
      await prepareMode(selectedImageMode());
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
      const removed = deleteBlocks(view, collectTargetHits(view, true));
      resetRowTracking();
      await saveDraftToServer(view, token, verifyResetDocument, `対象${removed}ブロックを初期化・保存中…`);
      setStatus(`${rows.length}件の対象画像・カード・URLを初期化済み ✅`);
    } catch (error) {
      setStatus(`初期化停止：${error?.message || String(error)}（完成扱いにしていません）`, true);
    } finally { running = false; updateUi(); }
  }

  async function deleteCurrentNotificationBlocks() {
    if (running || !enabled()) return;
    running = true; const token = ++runToken; updateUi();
    try {
      await prepareMode(selectedImageMode());
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
      const removed = deleteBlocks(view, collectTargetHits(view, false));
      await saveDraftToServer(view, token, verifyCardsDeleted, `URLカード／生URL ${removed}ブロックを削除・保存中…`);
      setStatus(`URLカード／生URL ${removed}ブロック削除 ✅ 画像は保持`);
    } catch (error) {
      setStatus(`削除停止：${error?.message || String(error)}（完成扱いにしていません）`, true);
    } finally { running = false; updateUi(); }
  }

  async function prepareManualNotification() {
    if (running || !enabled()) return;
    running = true; const token = ++runToken; updateUi();
    try {
      await prepareMode('test10');
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
      deleteBlocks(view, collectTargetHits(view, true));
      resetRowTracking();
      await saveDraftToServer(view, token, verifyResetDocument, '通知前の対象画像・カード・URLを完全初期化して保存中…');
      copyPreparedUrlList();
      shutdownForManualNotification(10);
    } catch (error) {
      setStatus(`通知準備停止：${error?.message || String(error)}（ツールは停止していません）`, true);
    } finally { running = false; updateUi(); }
  }

  function setDiagStatus() {
    const stage = diagState().stage;
    const map = {
      start: '3件切り分け｜次の「3」で3URLを完全初期化',
      base_saved: '3件初期化を保存済み｜先に公開→更新して戻る',
      base_updated: '①クリーン確定｜次の「3」で②③画像準備',
      images_saved: '②③画像🔗保存済み｜先に公開→更新して戻る',
      images_updated: '画像🔗履歴確定｜次の「3」で③だけ削除',
      third_deleted_saved: '③画像削除保存済み｜先に公開→更新して戻る',
      third_deleted_updated: '①②③条件完成｜次の「3」でURLコピー＋完全停止',
      cards_pending: '3件URLコピー済み｜貼付＋実Enter＋更新＋通知確認',
      cleanup_saved: '3件テスト跡を削除保存済み｜公開→更新で後片付け完了',
      cleanup_updated: '3件テスト後片付け完了'
    };
    setStatus(map[stage] || `3件切り分け｜${stage}`);
  }

  async function resetDiag3(userRequested = false) {
    if (running && !userRequested) return;
    if (mode !== 'diag3' || !rows.length) await prepareMode('diag3');
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
      rows.forEach((row) => deletions.push(...officialCards(view, row.url), ...exactUrlParagraphs(view, row.url)));
      deletions.push(...targetUrlTextblocks(view));
      deleteBlocks(view, deletions);
      rows.forEach((row) => { row.nodeId = ''; row.proof = ''; row.error = ''; }); saveRows();
      await saveDraftToServer(view, token, verifyDiagBase, '3件の既存画像🔗・カード・URLを完全初期化して保存中…');
      setDiagStage(userRequested ? 'cleanup_saved' : 'base_saved');
      if (userRequested) {
        page.alert('3件テストの画像・カード・URLを削除しました。\n「公開に進む」→「更新」で後片付け完了です。');
      } else {
        page.alert('3件を完全クリーンにして保存しました。\n\n次に「公開に進む」→「更新」。\n編集へ戻ったら、もう一度「3」を押してください。');
      }
      setDiagStatus();
    } catch (error) {
      setStatus(`3件初期化停止：${error?.message || String(error)}（公開・更新しない）`, true);
    } finally { running = false; updateUi(); }
  }

  async function prepareDiagImages() {
    running = true; ++runToken; updateUi();
    try {
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
      verifyDiagBase(view);
      const workRows = [rows[1], rows[2]];
      setStatus('②③の極薄画像2枚を準備中…');
      await armImagesForRows(workRows, 'diag');
      setDiagStatus();
    } catch (error) {
      setStatus(`②③画像準備停止：${error?.message || String(error)}`, true);
    } finally { cancelImageArm(); running = false; updateUi(); }
  }

  async function deleteThirdDiagImage() {
    running = true; const token = ++runToken; updateUi();
    try {
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
      verifyDiagImages(view);
      const hit = findByLink(view, rows[2].url) || findById(view, rows[2].nodeId);
      if (!hit) throw new FatalError('③の削除対象画像がありません');
      deleteBlocks(view, [hit]); rows[2].nodeId = ''; saveRows();
      await saveDraftToServer(view, token, verifyDiagReady, '③だけ画像🔗を削除して保存中…');
      setDiagStage('third_deleted_saved');
      page.alert('③の画像🔗だけ削除して保存しました。\n②の画像🔗は残っています。\n\n次に「公開に進む」→「更新」。\n編集へ戻ったら、もう一度「3」を押してください。');
      setDiagStatus();
    } catch (error) {
      setStatus(`③画像削除停止：${error?.message || String(error)}`, true);
    } finally { running = false; updateUi(); }
  }

  async function runDiag3() {
    if (running || !enabled()) return;
    try {
      if (mode !== 'diag3' || !rows.length) await prepareMode('diag3');
      const stage = diagState().stage;
      if (stage === 'start' || stage === 'cleanup_updated') return resetDiag3(false);
      if (stage === 'base_saved') { setStatus('先に「公開に進む」→「更新」してください。更新前には進めません', true); return; }
      if (stage === 'base_updated') return prepareDiagImages();
      if (stage === 'images_saved') { setStatus('先に「公開に進む」→「更新」してください。画像🔗履歴を確定させます', true); return; }
      if (stage === 'images_updated') return deleteThirdDiagImage();
      if (stage === 'third_deleted_saved') { setStatus('先に「公開に進む」→「更新」してください。③削除履歴を確定させます', true); return; }
      if (stage === 'third_deleted_updated') {
        const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
        verifyDiagReady(view);
        copyPreparedUrlList(); setDiagStage('cards_pending');
        shutdownForManualNotification(3, true); return;
      }
      if (stage === 'cards_pending') {
        copyPreparedUrlList(); shutdownForManualNotification(3, true); return;
      }
      if (stage === 'cleanup_saved') { setStatus('後片付けは保存済み。公開→更新で完了です', true); return; }
      setStatus(`3件テスト状態を確認できません: ${stage}`, true);
    } catch (error) {
      setStatus(`3件切り分け停止：${error?.message || String(error)}`, true);
    }
  }

  function stopRun() {
    runToken += 1;
    if (waitCancel) waitCancel('停止しました'); waitCancel = null;
    cancelImageArm('停止しました');
    setStatus('現在の処理を停止しています…完了済みは保持します', true);
    updateUi();
  }

  function routeCheck() {
    if (notificationShutdown || !document.body) return;
    document.body.dataset.mumeiNotePublish = isPublishPage() ? '1' : '0';
    if (!isEditPage()) return;
    removeKnownLegacyTools();
    const key = articleKey();
    if (activeArticle && key && activeArticle !== key) {
      runToken += 1; running = false; cancelImageArm();
      mode = ''; items = []; rows = []; coreCache = null; viewCache = null;
    }
    activeArticle = key;
    if (!document.getElementById(PANEL) || !document.getElementById(TOGGLE)) mount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();

  function publishClickHandler(event) {
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
      const activeMode = mode || getJSON(modeKey(), '');
      if (activeMode === NEW10_MODE && getNew10State().stage === 'cards_ready') {
        setNew10State('published_wait');
      }
      const diag = diagState();
      const next = {
        base_saved: 'base_updated',
        images_saved: 'images_updated',
        third_deleted_saved: 'third_deleted_updated',
        cleanup_saved: 'cleanup_updated'
      }[diag.stage];
      if (next) setDiagStage(next, { submittedFrom: diag.stage });
    }
  }

  document.addEventListener('click', publishClickHandler, true);
  routeTimer = setInterval(routeCheck, 1000);
})();
