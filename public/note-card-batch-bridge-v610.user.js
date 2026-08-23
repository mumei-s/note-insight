// ==UserScript==
// @name         無名S note 通知確定 COMPLETE 7.1
// @namespace    https://github.com/mumei-s/note-insight/batch-bridge-610
// @version      7.1.0
// @description  極薄画像リンクとnote正規紹介カードを1件ずつ生成し、サーバー保存完了まで確認する10/107件自動化
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
  if (page.__MUMEI_NOTIFY_COMPLETE_7100__) return;
  page.__MUMEI_NOTIFY_COMPLETE_7100__ = true;
  // 旧2本の処理は本版に統合済み。重複ロードと旧通知カード処理を起動させない。
  page.__MUMEI_BATCH_BRIDGE_680__ = true;
  page.__MUMEI_BATCH_BRIDGE_670__ = true;
  page.__MUMEI_BATCH_BRIDGE_650__ = true;
  page.__MUMEI_DIRECT_SUCCESS_3230__ = true;
  page.__MUMEI_DIRECT_SUCCESS_3220__ = true;
  try { localStorage.setItem('mumei_note_card_active_articles_v1', '[]'); } catch (_) {}

  const VERSION = '7.1';
  const W = 860;
  const H = 140;
  const CREATOR = '無名S note';
  const FINAL_MANIFEST = 'https://mumei-s.github.io/note-insight/note-summer-107/manifest.json';
  const ACTIVE_KEY = 'mumei_notify_active_article_v710';
  const RUN_PREFIX = 'mumei_notify_run_v710';
  const COMPLETE_PROOF = 'note-image-link-official-card-saved-v710';
  const TOGGLE = 'mumei-notify-toggle-v710';
  const PANEL = 'mumei-notify-panel-v710';
  const STATUS = 'mumei-notify-status-v710';
  const STYLE = 'mumei-notify-style-v710';

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
  function isEditPage() { return /^\/notes\/n[a-z0-9]{8,}\/edit\/?$/i.test(location.pathname); }
  function isPublishPage() { return /\/publish\/?$/i.test(location.pathname); }
  function enabled() { return Boolean(isEditPage() && articleKey() && openedArticle === articleKey()); }
  function stateKey(selectedMode = mode) {
    return `${RUN_PREFIX}:${articleKey() || 'unknown'}:${selectedMode || 'none'}`;
  }
  function storedRows(selectedMode) {
    const value = getJSON(stateKey(selectedMode), []);
    return Array.isArray(value) ? value : [];
  }
  function legacyRows(selectedMode) {
    const value = getJSON(`mumei_image_link_run_v700:${articleKey() || 'unknown'}:${selectedMode || 'none'}`, []);
    return Array.isArray(value) ? value : [];
  }
  function saveRows() {
    if (!mode || !rows.length) return;
    setJSON(stateKey(), rows.map((row) => ({
      url: row.url, status: row.status, nodeId: row.nodeId || '',
      owned: Boolean(row.owned), cardKey: row.cardKey || '', proof: row.proof || '', error: row.error || ''
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
    panel.querySelectorAll('[data-main-action]').forEach((button) => { button.disabled = running; });
    const stop = panel.querySelector('[data-action="stop"]');
    const retry = panel.querySelector('[data-action="retry-failed"]');
    if (stop) stop.disabled = !running;
    if (retry) retry.disabled = running || !rows.length || !rows.some((row) => row.status !== 'done');
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
      #${TOGGLE}{position:fixed;right:4px;bottom:78px;z-index:2147483647;width:32px;height:32px;border:0;
        border-radius:999px;padding:0;background:#374151;color:#fff;font:800 15px/32px system-ui;
        box-shadow:0 2px 8px rgba(0,0,0,.28);touch-action:manipulation}
      #${TOGGLE}[data-open="1"]{display:none}
      #${PANEL}{position:fixed;right:4px;bottom:76px;z-index:2147483647;display:none;align-items:center;gap:3px;
        height:36px;padding:3px;border-radius:10px;background:#111827;color:#fff;box-shadow:0 3px 12px rgba(0,0,0,.32);
        font-family:system-ui,-apple-system,sans-serif}
      #${PANEL}[data-open="1"]{display:flex}
      #${PANEL} button{height:30px;min-width:30px;border:0;border-radius:7px;padding:0 7px;color:#fff;background:#374151;
        font:800 10px/30px system-ui;touch-action:manipulation}
      #${PANEL} button[data-main-action="10"]{background:#2563eb}
      #${PANEL} button[data-main-action="107"]{background:#059669}
      #${PANEL} button[data-action="close"]{padding:0;width:30px}
      #${PANEL} button:disabled{opacity:.35}
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
    const panel = document.getElementById(PANEL), toggle = document.getElementById(TOGGLE);
    if (panel) panel.dataset.open = '0';
    if (toggle) { toggle.dataset.open = '0'; toggle.textContent = '⛓'; }
    updateButtons();
  }
  function openTool() {
    const key = articleKey();
    if (!isEditPage() || !key) return;
    openedArticle = key; setJSON(ACTIVE_KEY, key);
    const panel = document.getElementById(PANEL), toggle = document.getElementById(TOGGLE);
    if (panel) panel.dataset.open = '1';
    if (toggle) { toggle.dataset.open = '1'; toggle.textContent = '⛓'; }
    setStatus('通知確定7.1｜正規カード生成＋保存確認');
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
      panel.innerHTML = `<button type="button" data-main-action="10" title="10件通知テスト">10</button>
        <button type="button" data-main-action="107" title="本番107件">107</button>
        <button type="button" data-action="retry-failed" title="失敗だけ再開">再</button>
        <button type="button" data-action="stop" title="停止" disabled>止</button>
        <button type="button" data-action="close" title="しまう">×</button>
        <div id="${STATUS}" data-bad="0">通知確定7.1</div>`;
      panel.addEventListener('click', onPanelClick); document.body.appendChild(panel);
    }
    const storedActive = getJSON(ACTIVE_KEY, '');
    if (storedActive === articleKey()) {
      openedArticle = storedActive; panel.dataset.open = '1'; toggle.dataset.open = '1';
      toggle.textContent = '⛓';
    }
  }
  async function onPanelClick(event) {
    const button = event.target.closest('button');
    if (!button || !enabled()) return;
    if (button.dataset.mainAction === '10') return startMode('test10');
    if (button.dataset.mainAction === '107') return startMode('final107');
    if (button.dataset.action === 'stop') return stopRun();
    if (button.dataset.action === 'retry-failed') return retryFailed();
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
    let editorModule, stateModule, schemaModule, htmlModule;
    try { editorModule = require(94928); } catch (_) {}
    try { stateModule = require(44044); } catch (_) {}
    try { schemaModule = require(35130); } catch (_) {}
    try { htmlModule = require(51910); } catch (_) {}
    let upload = editorModule?.CwN, link = editorModule?.$2m, embed = editorModule?.fjT;
    const NodeSelection = stateModule?.qv, Selection = stateModule?.Y1, TextSelection = stateModule?.Bs;
    const serialize = schemaModule?.BF, normalizeDOM = htmlModule?.zc, cleanHTML = htmlModule?.jF;
    const exports = Object.values(require.c || {}).flatMap((entry) => Object.values(entry?.exports || {}));
    if (typeof upload !== 'function') upload = exports.find((value) => typeof value === 'function' &&
      Function.prototype.toString.call(value).includes('imageUploading') && Function.prototype.toString.call(value).includes('Array.from'));
    if (typeof link !== 'function') link = exports.find((value) => typeof value === 'function' &&
      Function.prototype.toString.call(value).includes('selection.node') && Function.prototype.toString.call(value).includes('nodes.image.create') &&
      Function.prototype.toString.call(value).includes('link:'));
    if (typeof upload !== 'function' || typeof link !== 'function' || typeof embed !== 'function' ||
      typeof NodeSelection?.create !== 'function' || typeof Selection?.atEnd !== 'function' ||
      typeof TextSelection?.create !== 'function' || typeof serialize !== 'function' ||
      typeof normalizeDOM !== 'function' || typeof cleanHTML !== 'function') {
      throw new FatalError('note正規の画像・⛓・カード・保存処理が揃いません。公開・更新しないでください');
    }
    return (coreCache = { upload, link, embed, NodeSelection, Selection, TextSelection, serialize, normalizeDOM, cleanHTML });
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
  async function uploadOne(view, file, token) {
    ensureFreshParagraph(view);
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

  async function createOfficialCard(view, url, token) {
    const existing = findOfficialCard(view, url);
    if (existing) return existing;
    ensureFreshParagraph(view);
    let transaction = view.state.tr.insertText(url);
    transaction = transaction.setSelection(core().TextSelection.create(transaction.doc, transaction.selection.head));
    view.dispatch(transaction.scrollIntoView()); view.focus();
    if (!core().embed(url)(view.state, (next) => view.dispatch(next), view)) {
      throw new Error('note正規URL→Enter処理が拒否されました');
    }
    const result = await waitFor(() => {
      if (token !== runToken || !enabled()) throw new FatalError('停止しました');
      const card = findOfficialCard(view, url); if (card) return { card };
      const fallback = findFallbackLink(view, url); if (fallback) return { fallback };
      return null;
    }, 90000, 180);
    if (!result) throw new Error('note正規カード生成が90秒以内に完了しませんでした');
    if (result.fallback) throw new Error('URLが通常リンクになり、通知対象カードになりませんでした');
    return result.card;
  }

  function serializedBody(view) {
    const fragment = core().serialize(view.state), holder = document.createElement('div');
    holder.appendChild(fragment); core().normalizeDOM(holder);
    return core().cleanHTML(holder.innerHTML);
  }
  function verifyCompleteDocument(view) {
    const missing = [];
    for (const row of rows) {
      const image = findById(view, row.nodeId) || findByLink(view, row.url);
      const imageOK = image && remoteImage(image.node) && normalizeUrl(image.node.attrs?.link) === normalizeUrl(row.url);
      const card = findOfficialCard(view, row.url);
      if (!imageOK || !card) missing.push(row.index);
    }
    if (missing.length) throw new FatalError(`文書内の画像リンク＋正規カード不足: ${missing.slice(0, 8).join(',')}`);
    const body = serializedBody(view), parsed = new DOMParser().parseFromString(body, 'text/html');
    const hrefs = [...parsed.querySelectorAll('a[href]')].map((node) => normalizeUrl(node.getAttribute('href')));
    const sources = [...parsed.querySelectorAll('figure[src],figure[data-src],figure[embedded-service]')]
      .flatMap((node) => [node.getAttribute('src'), node.getAttribute('data-src'), node.innerHTML])
      .filter(Boolean).map((value) => String(value));
    const absent = rows.filter((row) => !hrefs.includes(normalizeUrl(row.url)) ||
      (!sources.some((value) => value.includes(row.url)) && !body.includes(row.url)));
    if (absent.length) throw new FatalError(`保存HTMLのURL不足: ${absent.slice(0, 8).map((row) => row.index).join(',')}`);
    return body;
  }
  async function saveToServer(view, token) {
    if (!view) throw new FatalError('EditorViewなし。画面を再読込してください');
    verifyCompleteDocument(view);
    setStatus(`${rows.length}/${rows.length}｜サーバーに保存中…`);
    const save = await waitFor(() => typeof page.noteEditor?.registerNoteDraft === 'function' ?
      page.noteEditor.registerNoteDraft : null, 12000, 200);
    if (token !== runToken || !enabled()) throw new FatalError('停止しました');
    if (save) {
      const result = await save('auto');
      if (!result || result.result !== true) throw new FatalError('サーバーが下書き保存の成功を返しませんでした');
    } else {
      const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === '一時保存');
      if (!button || button.disabled) throw new FatalError('noteの保存処理を取得できませんでした');
      button.click();
      await sleep(6500);
    }
    if (token !== runToken || !enabled()) throw new FatalError('停止しました');
    verifyCompleteDocument(view);
    rows.forEach((row) => { row.proof = COMPLETE_PROOF; row.status = 'done'; row.error = ''; });
    saveRows();
  }

  function rowFrom(item, stored) {
    const proven = stored?.status === 'done' && stored?.proof === COMPLETE_PROOF;
    return { ...item, status: proven ? 'done' : 'ready', nodeId: stored?.nodeId || '',
      owned: Boolean(stored?.owned), cardKey: stored?.cardKey || '', proof: proven ? COMPLETE_PROOF : '', error: stored?.error || '' };
  }
  async function prepareMode(selectedMode) {
    mode = selectedMode; items = selectedMode === 'final107' ? await loadFinalItems() : TEST_ITEMS;
    const stored = new Map(legacyRows(selectedMode).map((row) => [row.url, row]));
    storedRows(selectedMode).forEach((row) => stored.set(row.url, row));
    rows = items.map((item) => rowFrom(item, stored.get(item.url)));
    const view = findView();
    if (view) for (const row of rows) {
      const owned = findById(view, row.nodeId);
      const linked = owned && normalizeUrl(owned.node.attrs?.link) === normalizeUrl(row.url) ? owned : findByLink(view, row.url);
      const card = findOfficialCard(view, row.url);
      if (linked && remoteImage(linked.node) && card) {
        row.status = 'done'; if (owned) row.nodeId = String(linked.node.attrs?.id || row.nodeId);
        row.cardKey = String(card.node.attrs?.embeddedContentKey || '');
      }
      else if (row.status === 'done') row.status = 'ready';
    }
    saveRows(); updateUi();
  }
  async function processRow(index, token) {
    if (token !== runToken || !enabled()) throw new FatalError('停止しました');
    const row = rows[index], view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください'); core();
    let hit = findById(view, row.nodeId);
    if (!hit) hit = findByLink(view, row.url);
    if (!hit) {
      row.status = 'uploading'; row.error = ''; updateUi(); setStatus(`${index + 1}/${rows.length}｜極薄画像を1枚追加中…`);
      const file = await fileFor(row); if (token !== runToken || !enabled()) throw new FatalError('停止しました');
      hit = await uploadOne(view, file, token); row.nodeId = String(hit.node.attrs?.id || ''); row.owned = true; saveRows();
    } else if (!remoteImage(hit.node)) {
      const id = String(hit.node.attrs?.id || '');
      hit = await waitFor(() => {
        if (token !== runToken || !enabled()) throw new FatalError('停止しました');
        const current = findById(view, id); return current && remoteImage(current.node) ? current : null;
      }, 70000, 180);
      if (!hit) throw new Error('既存画像のアップロード完了を確認できませんでした');
    }
    if (normalizeUrl(hit.node.attrs?.link) !== normalizeUrl(row.url)) {
      row.status = 'linking'; updateUi(); setStatus(`${index + 1}/${rows.length}｜極薄画像に⛓URL確定中…`);
      hit = await applyStandardLink(view, hit, row.url);
    }
    row.nodeId = String(hit.node.attrs?.id || row.nodeId);
    row.status = 'embedding'; updateUi(); setStatus(`${index + 1}/${rows.length}｜URL→Enterの正規通知カード生成中…`);
    const card = await createOfficialCard(view, row.url, token);
    row.cardKey = String(card.node.attrs?.embeddedContentKey || ''); row.status = 'ready'; row.proof = ''; row.error = '';
    saveRows(); updateUi(); setStatus(`${index + 1}/${rows.length}｜画像⛓＋正規カード ✅`); await sleep(350);
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
      const currentView = findView();
      const done = currentView ? rows.filter((row) => Boolean(findByLink(currentView, row.url) && findOfficialCard(currentView, row.url))).length : 0;
      const failed = rows.filter((row) => row.status === 'failed').length;
      if (!fatal && !failed) {
        try { await saveToServer(currentView, token); }
        catch (error) { fatal = error instanceof FatalError ? error : new FatalError(error?.message || String(error)); }
      }
      if (fatal) setStatus(`停止：${fatal.message}（公開・更新しない）`, true);
      else if (failed) setStatus(`標準画像＋⛓ ${done}/${rows.length}｜失敗${failed}件だけ再実行できます`, true);
      else setStatus(`${rows.length}/${rows.length}｜正規カード＋サーバー保存 ✅ 公開に進めます`);
      updateUi();
    }
  }
  async function startMode(selectedMode) {
    if (running) return;
    try {
      setStatus(selectedMode === 'final107' ? '107件一覧を読込中…' : '10件一覧を準備中…');
      await prepareMode(selectedMode); core();
      const view = findView(); if (!view) throw new FatalError('EditorViewなし。画面を再読込してください');
      const indexes = rows.map((_, index) => index).filter((index) => rows[index].status !== 'done');
      if (!indexes.length) {
        const token = ++runToken; running = true; updateUi();
        await saveToServer(view, token); running = false; updateUi();
        setStatus(`${rows.length}/${rows.length}｜正規カード＋サーバー保存 ✅ 公開に進めます`); return;
      }
      runIndexes(indexes);
    } catch (error) { setStatus(`開始停止：${error?.message || String(error)}（公開・更新しない）`, true); running = false; updateUi(); }
  }
  function stopRun() {
    runToken += 1;
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
    if (openedArticle && openedArticle !== articleKey()) closeTool();
    if (!document.getElementById(PANEL) || !document.getElementById(TOGGLE)) mount();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('button');
    if (button?.textContent?.trim() === '公開に進む' && document.body) document.body.dataset.mumeiNotePublish = '1';
  }, true);
  setInterval(routeCheck, 500);
})();
