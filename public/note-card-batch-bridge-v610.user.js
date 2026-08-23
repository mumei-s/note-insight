// ==UserScript==
// @name         無名S note 本番107枚 COMPLETE BRIDGE 6.7
// @namespace    https://github.com/mumei-s/note-insight/batch-bridge-610
// @version      7.0.0
// @description  note標準の画像追加と画像リンク処理を1件ずつ実行する10/107件完全自動化
// @match        https://editor.note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      note.com
// @connect      assets.st-note.com
// @connect      mumei-s.github.io
// ==/UserScript==

(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_IMAGE_LINK_COMPLETE_7000__) return;
  page.__MUMEI_IMAGE_LINK_COMPLETE_7000__ = true;
  // 旧2本の処理は本版に統合済み。重複ロードと旧通知カード処理を起動させない。
  page.__MUMEI_BATCH_BRIDGE_680__ = true;
  page.__MUMEI_BATCH_BRIDGE_670__ = true;
  page.__MUMEI_BATCH_BRIDGE_650__ = true;
  page.__MUMEI_DIRECT_SUCCESS_3230__ = true;
  page.__MUMEI_DIRECT_SUCCESS_3220__ = true;
  try { localStorage.setItem('mumei_note_card_active_articles_v1', '[]'); } catch (_) {}

  const VERSION = '7.0';
  const W = 860;
  const H = 140;
  const CREATOR = '無名S note';
  const FINAL_MANIFEST = 'https://mumei-s.github.io/note-insight/note-summer-107/manifest.json';
  const ACTIVE_KEY = 'mumei_image_link_active_article_v700';
  const RUN_PREFIX = 'mumei_image_link_run_v700';
  const LINK_PROOF = 'note-standard-image-link-v700';
  const TOGGLE = 'mumei-image-link-toggle-v700';
  const PANEL = 'mumei-image-link-panel-v700';
  const STATUS = 'mumei-image-link-status-v700';
  const LIST = 'mumei-image-link-list-v700';
  const STYLE = 'mumei-image-link-style-v700';

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
  function enabled() { return Boolean(articleKey() && openedArticle === articleKey()); }
  function stateKey(selectedMode = mode) {
    return `${RUN_PREFIX}:${articleKey() || 'unknown'}:${selectedMode || 'none'}`;
  }
  function storedRows(selectedMode) {
    const value = getJSON(stateKey(selectedMode), []);
    return Array.isArray(value) ? value : [];
  }
  function saveRows() {
    if (!mode || !rows.length) return;
    setJSON(stateKey(), rows.map((row) => ({
      url: row.url, status: row.status, nodeId: row.nodeId || '',
      owned: Boolean(row.owned), proof: row.proof || '', error: row.error || ''
    })));
  }
  function normalizeUrl(value) {
    try {
      const url = new URL(String(value || ''), location.href);
      url.search = ''; url.hash = ''; return url.href;
    } catch (_) { return String(value || ''); }
  }
  function escapeHtml(value) {
    return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }
  function setStatus(text, bad = false) {
    const element = document.getElementById(STATUS);
    if (!element) return;
    element.textContent = text;
    element.dataset.bad = bad ? '1' : '0';
  }
  function labelFor(row) {
    return ({ done: '⛓ 完了', uploading: '画像追加中', linking: '⛓ 設定中',
      failed: '失敗', deleted: '削除済', ready: '待機' })[row.status] || '待機';
  }
  function renderList() {
    const list = document.getElementById(LIST);
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<div class="mumei-empty">10件または107件を選ぶと、画像とURLの処理一覧が出ます。</div>';
      return;
    }
    const existing = [...list.querySelectorAll('.mumei-row')];
    if (existing.length === rows.length) {
      existing.forEach((element, index) => {
        const row = rows[index];
        element.dataset.state = row.status;
        element.querySelector('.mumei-state').textContent = labelFor(row);
        element.querySelector('[data-action="retry"]').disabled = running;
        element.querySelector('[data-action="delete"]').disabled = running || !row.nodeId || !row.owned;
      });
      return;
    }
    list.innerHTML = rows.map((row, index) => `
      <div class="mumei-row" data-state="${escapeHtml(row.status)}">
        <span class="mumei-num">${String(index + 1).padStart(rows.length > 10 ? 3 : 2, '0')}</span>
        <span class="mumei-title" title="${escapeHtml(row.title)}">${escapeHtml(row.title)}</span>
        <span class="mumei-state">${escapeHtml(labelFor(row))}</span>
        <button type="button" data-action="retry" data-index="${index}" ${running ? 'disabled' : ''}>再</button>
        <button type="button" data-action="delete" data-index="${index}" ${running || !row.nodeId || !row.owned ? 'disabled' : ''}>削除</button>
      </div>`).join('');
  }
  function updateButtons() {
    const panel = document.getElementById(PANEL);
    if (!panel) return;
    panel.querySelectorAll('[data-main-action]').forEach((button) => { button.disabled = running; });
    const stop = panel.querySelector('[data-action="stop"]');
    const retry = panel.querySelector('[data-action="retry-failed"]');
    const clean = panel.querySelector('[data-action="clean-old-cards"]');
    if (stop) stop.disabled = !running;
    if (retry) retry.disabled = running || !rows.some((row) => row.status === 'failed');
    if (clean) clean.disabled = running;
  }
  function updateUi() { renderList(); updateButtons(); }

  function installStyle() {
    if (document.getElementById(STYLE) || !document.head) return;
    const style = document.createElement('style');
    style.id = STYLE;
    style.textContent = `
      #mumei-card-system-toggle,#mumei-direct-success-panel,#mumei-direct-success-btn,
      #mumei-notify-test-panel,#mumei-notify-test-btn,#mumei-notify-clean-btn,
      #mumei-bridge610-panel,#mumei-bridge610-btn,#mumei-bridge107-btn{display:none!important}
      #${TOGGLE}{position:fixed;right:-30px;bottom:18px;z-index:2147483647;border:0;border-radius:999px;
        padding:9px 8px;min-width:46px;background:#4b5563;color:#fff;font:800 10px/1 system-ui;
        box-shadow:0 4px 14px rgba(0,0,0,.3);touch-action:manipulation}
      #${TOGGLE}[data-open="1"]{right:8px;background:#047857;font-size:12px;padding:9px 13px}
      #${PANEL}{position:fixed;right:8px;top:70px;z-index:2147483646;width:min(370px,calc(100vw - 16px));
        max-height:70vh;display:none;flex-direction:column;overflow:hidden;border:1px solid #374151;border-radius:12px;
        background:#111827;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.4);font-family:system-ui,-apple-system,sans-serif}
      #${PANEL}[data-open="1"]{display:flex}
      #${PANEL} .mumei-head{padding:9px 10px 7px;font-size:12px;font-weight:800;background:#0f172a}
      #${PANEL} .mumei-actions{display:flex;gap:6px;flex-wrap:wrap;padding:8px}
      #${PANEL} button{border:0;border-radius:8px;padding:7px 9px;color:#fff;background:#374151;font-weight:800;font-size:11px;touch-action:manipulation}
      #${PANEL} button[data-main-action="10"]{background:#2563eb}
      #${PANEL} button[data-main-action="107"]{background:#059669}
      #${PANEL} button:disabled{opacity:.38}
      #${STATUS}{margin:0 8px 7px;padding:7px 8px;border-radius:8px;background:#064e3b;font-size:11px;line-height:1.35}
      #${STATUS}[data-bad="1"]{background:#991b1b}
      #${LIST}{overflow:auto;overscroll-behavior:contain;border-top:1px solid #374151;background:#0b1220}
      #${LIST} .mumei-empty{padding:14px;color:#cbd5e1;font-size:11px;line-height:1.5}
      #${LIST} .mumei-row{display:grid;grid-template-columns:27px minmax(0,1fr) 58px 28px 38px;gap:4px;
        align-items:center;padding:5px 7px;border-bottom:1px solid #243044;font-size:10px}
      #${LIST} .mumei-row[data-state="done"]{background:#052e2b}
      #${LIST} .mumei-row[data-state="failed"]{background:#3f1118}
      #${LIST} .mumei-num{color:#94a3b8;font-variant-numeric:tabular-nums}
      #${LIST} .mumei-title{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      #${LIST} .mumei-state{color:#d1fae5;text-align:right;white-space:nowrap}
      #${LIST} .mumei-row[data-state="failed"] .mumei-state{color:#fecaca}
      #${LIST} button{padding:5px 2px;border-radius:6px;font-size:10px}
      @media(max-width:600px){#${PANEL}{top:58px;max-height:67vh}}
    `;
    document.head.appendChild(style);
  }
  function closeTool() {
    runToken += 1; running = false; openedArticle = ''; setJSON(ACTIVE_KEY, null);
    const panel = document.getElementById(PANEL), toggle = document.getElementById(TOGGLE);
    if (panel) panel.dataset.open = '0';
    if (toggle) { toggle.dataset.open = '0'; toggle.textContent = '画像⛓'; }
    updateButtons();
  }
  function openTool() {
    const key = articleKey();
    if (!key) { setStatus('記事が保存され、編集URLになってから開いてください', true); return; }
    openedArticle = key; setJSON(ACTIVE_KEY, key);
    const panel = document.getElementById(PANEL), toggle = document.getElementById(TOGGLE);
    if (panel) panel.dataset.open = '1';
    if (toggle) { toggle.dataset.open = '1'; toggle.textContent = '画像⛓をしまう'; }
    setStatus('完全自動7.0｜10件または107件を選択（＋操作不要）');
  }
  function toggleTool() { if (enabled()) closeTool(); else openTool(); }
  function mount() {
    if (!document.body) return;
    installStyle();
    let toggle = document.getElementById(TOGGLE);
    if (!toggle) {
      toggle = document.createElement('button');
      Object.assign(toggle, { id: TOGGLE, type: 'button', textContent: '画像⛓' });
      toggle.dataset.open = '0'; toggle.addEventListener('click', toggleTool); document.body.appendChild(toggle);
    }
    let panel = document.getElementById(PANEL);
    if (!panel) {
      panel = document.createElement('section'); panel.id = PANEL; panel.dataset.open = '0';
      panel.innerHTML = `<div class="mumei-head">note標準 画像追加＋⛓リンク COMPLETE ${VERSION}</div>
        <div class="mumei-actions"><button type="button" data-main-action="10">10件を作り直して通知確認</button>
        <button type="button" data-main-action="107">本番107件</button>
        <button type="button" data-action="retry-failed">失敗だけ再実行</button>
        <button type="button" data-action="clean-old-cards">旧通知カード削除</button>
        <button type="button" data-action="stop" disabled>停止</button></div>
        <div id="${STATUS}" data-bad="0">完全自動7.0｜10件または107件を選択（＋操作不要）</div>
        <div id="${LIST}"><div class="mumei-empty">画像とURLの処理一覧がここに出ます。</div></div>`;
      panel.addEventListener('click', onPanelClick); document.body.appendChild(panel);
    }
    const storedActive = getJSON(ACTIVE_KEY, '');
    if (storedActive === articleKey()) {
      openedArticle = storedActive; panel.dataset.open = '1'; toggle.dataset.open = '1';
      toggle.textContent = '画像⛓をしまう';
    }
  }
  async function onPanelClick(event) {
    const button = event.target.closest('button');
    if (!button || !enabled()) return;
    if (button.dataset.mainAction === '10') return startMode('test10');
    if (button.dataset.mainAction === '107') return startMode('final107');
    if (button.dataset.action === 'stop') return stopRun();
    if (button.dataset.action === 'retry-failed') return retryFailed();
    if (button.dataset.action === 'clean-old-cards') return deleteOldCards();
    const index = Number(button.dataset.index);
    if (!Number.isInteger(index) || !rows[index]) return;
    if (button.dataset.action === 'retry') return retryOne(index);
    if (button.dataset.action === 'delete') return deleteOne(index);
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
    let editorModule, stateModule; try { editorModule = require(94928); } catch (_) {} try { stateModule = require(44044); } catch (_) {}
    let upload = editorModule?.CwN, link = editorModule?.$2m;
    const NodeSelection = stateModule?.qv, Selection = stateModule?.Y1;
    const exports = Object.values(require.c || {}).flatMap((entry) => Object.values(entry?.exports || {}));
    if (typeof upload !== 'function') upload = exports.find((value) => typeof value === 'function' &&
      Function.prototype.toString.call(value).includes('imageUploading') && Function.prototype.toString.call(value).includes('Array.from'));
    if (typeof link !== 'function') link = exports.find((value) => typeof value === 'function' &&
      Function.prototype.toString.call(value).includes('selection.node') && Function.prototype.toString.call(value).includes('nodes.image.create') &&
      Function.prototype.toString.call(value).includes('link:'));
    if (typeof upload !== 'function' || typeof link !== 'function' || typeof NodeSelection?.create !== 'function' ||
      typeof Selection?.atEnd !== 'function') throw new FatalError('note標準の画像追加・⛓処理が見つかりません。公開・更新しないでください');
    return (coreCache = { upload, link, NodeSelection, Selection });
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
  function remoteImage(node) {
    const src = String(node?.attrs?.src || ''); return /^https:\/\//i.test(src) && !/^https:\/\/editor\.note\.com\/icons\//i.test(src);
  }
  function ensureEndParagraph(view) {
    const paragraph = view.state.schema.nodes.paragraph; if (!paragraph) throw new FatalError('本文paragraphなし');
    if (view.state.doc.lastChild?.type !== paragraph) view.dispatch(view.state.tr.insert(view.state.doc.content.size, paragraph.create()));
    view.dispatch(view.state.tr.setSelection(core().Selection.atEnd(view.state.doc)).scrollIntoView()); view.focus();
  }
  async function waitFor(test, timeout, interval = 120) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const value = test(); if (value) return value; await sleep(interval); }
    return null;
  }
  async function uploadOne(view, file, token) {
    ensureEndParagraph(view);
    const before = new Set(imageNodes(view).map((entry) => String(entry.node.attrs?.id || '')));
    if (!core().upload(view, [file], view.state.selection.head)) throw new Error('note標準画像追加が拒否されました');
    const created = await waitFor(() => {
      if (token !== runToken || !enabled()) throw new FatalError('停止しました');
      return imageNodes(view).find((entry) => {
        const id = String(entry.node.attrs?.id || ''); return id && !before.has(id);
      });
    }, 20000);
    if (!created) throw new Error('画像ノードが生成されませんでした');
    const id = String(created.node.attrs.id);
    const uploaded = await waitFor(() => {
      if (token !== runToken || !enabled()) throw new FatalError('停止しました');
      const current = findById(view, id); return current && remoteImage(current.node) ? current : null;
    }, 70000, 180);
    if (!uploaded) throw new Error('画像アップロード完了を確認できませんでした');
    return uploaded;
  }
  async function applyStandardLink(view, hit, url) {
    const current = findById(view, hit.node.attrs?.id) || hit;
    view.dispatch(view.state.tr.setSelection(core().NodeSelection.create(view.state.doc, current.pos)).scrollIntoView()); view.focus();
    const command = core().link(new page.URL(url));
    if (!command(view.state, (transaction) => view.dispatch(transaction))) throw new Error('note標準⛓コマンドが拒否されました');
    const verified = await waitFor(() => {
      const latest = findById(view, current.node.attrs?.id);
      return latest && normalizeUrl(latest.node.attrs?.link) === normalizeUrl(url) ? latest : null;
    }, 5000, 80);
    if (!verified) throw new Error('文書データの⛓URLが一致しません');
    const domVerified = await waitFor(() => {
      let dom; try { dom = view.nodeDOM(verified.pos); } catch (_) { return null; }
      if (!dom || dom.nodeType !== 1) return null;
      const anchor = dom.matches?.('a[href]') ? dom : dom.querySelector?.('a[href]');
      return anchor && normalizeUrl(anchor.getAttribute('href')) === normalizeUrl(url) ? anchor : null;
    }, 5000, 100);
    if (!domVerified) throw new Error('表示DOMの⛓URLが一致しません');
    return verified;
  }

  function rowFrom(item, stored) {
    const proven = stored?.status === 'done' && stored?.proof === LINK_PROOF;
    return { ...item, status: proven ? 'done' : 'ready', nodeId: stored?.nodeId || '',
      owned: Boolean(stored?.owned), proof: proven ? LINK_PROOF : '', error: stored?.error || '' };
  }
  async function prepareMode(selectedMode) {
    mode = selectedMode; items = selectedMode === 'final107' ? await loadFinalItems() : TEST_ITEMS;
    const stored = new Map(storedRows(selectedMode).map((row) => [row.url, row]));
    rows = items.map((item) => rowFrom(item, stored.get(item.url)));
    const view = findView();
    if (view) for (const row of rows) {
      const owned = findById(view, row.nodeId);
      const linked = owned && normalizeUrl(owned.node.attrs?.link) === normalizeUrl(row.url) ? owned : findByLink(view, row.url);
      if (linked && row.proof === LINK_PROOF) {
        row.status = 'done'; if (owned) row.nodeId = String(linked.node.attrs?.id || row.nodeId);
      }
      else if (row.status === 'done') row.status = 'ready';
    }
    saveRows(); updateUi();
  }
  async function processRow(index, token) {
    if (token !== runToken || !enabled()) throw new FatalError('停止しました');
    const row = rows[index], view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
    let hit = findById(view, row.nodeId);
    if (hit && normalizeUrl(hit.node.attrs?.link) === normalizeUrl(row.url) && remoteImage(hit.node)) {
      row.status = 'done'; row.proof = LINK_PROOF; row.error = ''; saveRows(); updateUi(); return;
    }
    if (!hit) {
      row.status = 'uploading'; row.error = ''; updateUi(); setStatus(`${index + 1}/${rows.length}｜画像を1枚だけnote標準追加中…`);
      const file = await fileFor(row); if (token !== runToken || !enabled()) throw new FatalError('停止しました');
      hit = await uploadOne(view, file, token); row.nodeId = String(hit.node.attrs?.id || ''); row.owned = true; saveRows();
    }
    row.status = 'linking'; updateUi(); setStatus(`${index + 1}/${rows.length}｜画像を選択してnote標準⛓にURL設定中…`);
    const linked = await applyStandardLink(view, hit, row.url);
    row.nodeId = String(linked.node.attrs?.id || row.nodeId); row.status = 'done'; row.proof = LINK_PROOF; row.error = '';
    saveRows(); updateUi(); setStatus(`${index + 1}/${rows.length}｜画像追加・標準⛓URL一致 ✅`); await sleep(450);
  }
  async function runIndexes(indexes) {
    if (running || !enabled()) return;
    running = true; const token = ++runToken; updateUi(); let fatal = null;
    for (const index of indexes) {
      if (token !== runToken || !enabled()) break;
      try { await processRow(index, token); }
      catch (error) {
        if (error instanceof FatalError) { fatal = error; break; }
        rows[index].status = 'failed'; rows[index].error = error?.message || String(error); saveRows(); updateUi();
        setStatus(`${index + 1}/${rows.length} 失敗：${rows[index].error}｜次へ進みます`, true); await sleep(700);
      }
    }
    if (token !== runToken) {
      running = false;
      if (enabled()) setStatus('停止しました。完了済みは保持し、残りだけ再開できます', true);
      updateUi();
      return;
    }
    if (token === runToken) {
      running = false;
      const done = rows.filter((row) => row.status === 'done').length, failed = rows.filter((row) => row.status === 'failed').length;
      if (fatal) setStatus(`停止：${fatal.message}（公開・更新しない）`, true);
      else if (failed) setStatus(`標準画像＋⛓ ${done}/${rows.length}｜失敗${failed}件だけ再実行できます`, true);
      else setStatus(`標準画像追加＋標準⛓ ${done}/${rows.length} ✅ ここで公開・更新してください`);
      updateUi();
    }
  }
  async function startMode(selectedMode) {
    if (running) return;
    try {
      setStatus(selectedMode === 'final107' ? '107件一覧を読込中…' : '10件一覧を準備中…');
      await prepareMode(selectedMode); core();
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください');
      if (selectedMode === 'test10') resetTestImages(view);
      const indexes = rows.map((_, index) => index).filter((index) => rows[index].status !== 'done');
      if (!indexes.length) { setStatus(`標準画像追加＋標準⛓ ${rows.length}/${rows.length} ✅ 追加対象なし`); return; }
      runIndexes(indexes);
    } catch (error) { setStatus(`開始停止：${error?.message || String(error)}（公開・更新しない）`, true); running = false; updateUi(); }
  }
  function stopRun() {
    runToken += 1;
    setStatus('現在の1件を止めています…完了済みは保持します', true);
    updateUi();
  }
  async function retryOne(index) {
    if (running || !rows[index]) return;
    rows[index].status = 'ready'; rows[index].error = ''; saveRows(); updateUi(); runIndexes([index]);
  }
  async function retryFailed() {
    if (running) return;
    const indexes = rows.map((row, index) => row.status === 'failed' ? index : -1).filter((index) => index >= 0);
    if (!indexes.length) return;
    indexes.forEach((index) => { rows[index].status = 'ready'; rows[index].error = ''; }); saveRows(); updateUi(); runIndexes(indexes);
  }
  async function deleteOne(index) {
    if (running || !rows[index]) return;
    const row = rows[index];
    try {
      if (!row.owned || !row.nodeId) throw new Error('この自動化が追加した画像ではありません');
      const view = findView(); if (!view) throw new FatalError('EditorViewなし');
      const hit = findById(view, row.nodeId); if (!hit) throw new Error('削除対象画像なし');
      view.dispatch(view.state.tr.delete(hit.pos, hit.pos + hit.node.nodeSize));
      row.status = 'deleted'; row.nodeId = ''; row.owned = false; row.proof = ''; row.error = ''; saveRows();
      setStatus(`${index + 1}/${rows.length} を記事から削除しました。再ボタンでその1件だけ追加できます`); updateUi();
    } catch (error) { setStatus(`削除停止：${error?.message || String(error)}`, true); }
  }
  function resetTestImages(view) {
    const targets = new Set(TEST_ITEMS.map((item) => normalizeUrl(item.url)));
    const hits = imageNodes(view).filter((hit) => targets.has(normalizeUrl(hit.node.attrs?.link)));
    if (hits.length) {
      let transaction = view.state.tr;
      hits.sort((a, b) => b.pos - a.pos).forEach((hit) => {
        transaction = transaction.delete(hit.pos, hit.pos + hit.node.nodeSize);
      });
      view.dispatch(transaction);
    }
    rows.forEach((row) => {
      row.status = 'ready'; row.nodeId = ''; row.owned = false; row.proof = ''; row.error = '';
    });
    saveRows(); updateUi();
    if (hits.length) setStatus(`旧方式の同URL画像 ${hits.length}枚を除去 → 1枚ずつ作り直します`);
  }
  async function deleteOldCards() {
    if (running) return;
    try {
      const view = findView(); if (!view) throw new FatalError('EditorViewなし');
      const targets = new Set((items.length ? items : TEST_ITEMS).map((item) => normalizeUrl(item.url)));
      const hits = [];
      view.state.doc.descendants((node, pos) => {
        if (node.type?.name === 'image') return;
        const src = normalizeUrl(node.attrs?.src || '');
        const service = String(node.attrs?.embeddedService || '').toLowerCase();
        if (targets.has(src) && (node.type?.name === 'embed' || service === 'note')) hits.push({ node, pos });
      });
      if (!hits.length) { setStatus('削除対象の旧通知カードはありません'); return; }
      let transaction = view.state.tr;
      hits.sort((a, b) => b.pos - a.pos).forEach((hit) => {
        transaction = transaction.delete(hit.pos, hit.pos + hit.node.nodeSize);
      });
      view.dispatch(transaction);
      setStatus(`旧通知カード ${hits.length}件を削除しました。極薄画像は残しています`);
    } catch (error) { setStatus(`旧通知カード削除停止：${error?.message || String(error)}`, true); }
  }
  function routeCheck() {
    if (openedArticle && openedArticle !== articleKey()) closeTool();
    if (!document.getElementById(PANEL) || !document.getElementById(TOGGLE)) mount();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
  setInterval(routeCheck, 1800);
})();
