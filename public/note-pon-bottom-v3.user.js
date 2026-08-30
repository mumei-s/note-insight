// ==UserScript==
// @name         note ポン出し v3｜最下部固定なし＋挿絵自動
// @namespace    https://github.com/mumei-s/note-insight
// @version      3.0.0
// @description  note編集画面のmain最下部に通常配置。旧本文バックアップ、全消し、見出し整形、挿絵マーカー自動挿入。旧ポン出しの横/浮遊UIは強制非表示。
// @author       無名S note
// @match        https://note.com/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-bottom-v3.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-bottom-v3.user.js
// ==/UserScript==

(() => {
  'use strict';

  const HOST_ID = '__mumei_pon_v3_bottom__';
  const BACKUP_PREFIX = 'mumei-note-pon-v3-backup:';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const killLegacyStyle = document.createElement('style');
  killLegacyStyle.id = '__mumei_pon_v3_kill_legacy__';
  killLegacyStyle.textContent = `
    #mumei-note-pon-dashi-fab,
    #mumei-note-pon-dashi-panel,
    #mumei-note-pon-dashi-toast,
    #__mumei_pon_v2_host__,
    #__mumei_pon_v21_host__ {
      display:none !important;
      visibility:hidden !important;
      opacity:0 !important;
      pointer-events:none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(killLegacyStyle);

  const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 80 && r.height > 30 && s.display !== 'none' && s.visibility !== 'hidden';
  }

  function findEditor() {
    const selectors = [
      '.ProseMirror[contenteditable="true"]',
      '[contenteditable="true"][role="textbox"]',
      'article [contenteditable="true"]',
      'main [contenteditable="true"]',
      'div[contenteditable="true"]'
    ];
    const all = [...new Set(selectors.flatMap(sel => [...document.querySelectorAll(sel)]))]
      .filter(visible)
      .filter(el => !el.closest(`#${HOST_ID}`));
    if (!all.length) return null;

    return all.map(el => {
      const r = el.getBoundingClientRect();
      const text = (el.innerText || '').length;
      let score = r.width * r.height + text * 160;
      if (String(el.className || '').includes('ProseMirror')) score += 1000000;
      if (el.getAttribute('role') === 'textbox') score += 300000;
      return { el, score };
    }).sort((a, b) => b.score - a.score)[0].el;
  }

  async function waitEditor(ms = 5000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const e = findEditor();
      if (e) return e;
      await sleep(150);
    }
    return null;
  }

  const backupKey = () => BACKUP_PREFIX + location.pathname;
  function saveBackup(editor) {
    try {
      localStorage.setItem(backupKey(), JSON.stringify({
        html: editor.innerHTML,
        text: editor.innerText || '',
        time: Date.now(),
        url: location.href
      }));
    } catch {}
  }
  function getBackup() {
    try { return JSON.parse(localStorage.getItem(backupKey()) || 'null'); }
    catch { return null; }
  }

  function cleanSource(src) {
    return String(src || '')
      .replace(/^:::writing\{[^\n]*\}\s*$/gmi, '')
      .replace(/^:::\s*$/gmi, '')
      .replace(/^```(?:markdown|md|text)?\s*$/gmi, '')
      .replace(/^```\s*$/gmi, '')
      .replace(/\r\n?/g, '\n')
      .trim();
  }

  function markdownToHtml(src) {
    const lines = cleanSource(src).split('\n');
    const out = [];
    let para = [], listType = null, listItems = [];

    const flushPara = () => {
      if (!para.length) return;
      out.push(`<p>${inline(para.map(x => x.trim()).join('<br>'))}</p>`);
      para = [];
    };
    const flushList = () => {
      if (!listType || !listItems.length) return;
      out.push(`<${listType}>${listItems.map(x => `<li>${inline(x)}</li>`).join('')}</${listType}>`);
      listType = null;
      listItems = [];
    };

    for (const raw of lines) {
      const line = raw.trimEnd();
      const t = line.trim();
      if (!t) { flushPara(); flushList(); continue; }
      if (/^---+$/.test(t) || /^___+$/.test(t)) { flushPara(); flushList(); out.push('<hr>'); continue; }

      const big = t.match(/^◆【大見出し】\s*(.+)$/) || t.match(/^#\s+(.+)$/);
      const small = t.match(/^◇【小見出し】\s*(.+)$/) || t.match(/^##\s+(.+)$/) || t.match(/^###\s+(.+)$/);
      if (big) { flushPara(); flushList(); out.push(`<h2>${inline(big[1])}</h2>`); continue; }
      if (small) { flushPara(); flushList(); out.push(`<h3>${inline(small[1])}</h3>`); continue; }

      const localImg = t.match(/^\[\[挿絵(\d+)\]\]$/);
      if (localImg) {
        flushPara(); flushList();
        out.push(`<p data-mumei-pon-img="${localImg[1]}">[[挿絵${localImg[1]}]]</p>`);
        continue;
      }

      const remoteImg = t.match(/^\[\[IMG:(https?:\/\/[^\]]+)\]\]$/i);
      if (remoteImg) {
        flushPara(); flushList();
        out.push(`<figure><img src="${esc(remoteImg[1])}" alt=""></figure>`);
        continue;
      }

      if (/^🔒【ここで有料ライン】/.test(t) || /^\[PAYWALL\]$/i.test(t)) {
        flushPara(); flushList(); out.push('<p>🔒【ここで有料ライン】</p>'); continue;
      }

      const ul = t.match(/^[-*・]\s+(.+)$/);
      if (ul) {
        flushPara();
        if (listType && listType !== 'ul') flushList();
        listType = 'ul';
        listItems.push(ul[1]);
        continue;
      }

      const ol = t.match(/^\d+[\.．]\s*(.+)$/);
      if (ol) {
        flushPara();
        if (listType && listType !== 'ol') flushList();
        listType = 'ol';
        listItems.push(ol[1]);
        continue;
      }

      const q = t.match(/^>\s?(.*)$/);
      if (q) { flushPara(); flushList(); out.push(`<blockquote>${inline(q[1])}</blockquote>`); continue; }
      para.push(line);
    }

    flushPara();
    flushList();
    return out.join('');
  }

  function selectNodeContents(editor) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    editor.focus();
  }

  function fireInput(editor, inputType = 'insertFromPaste') {
    try { editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType, data: null })); }
    catch { editor.dispatchEvent(new Event('input', { bubbles: true })); }
    editor.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function replaceEditor(editor, html) {
    saveBackup(editor);
    selectNodeContents(editor);
    let ok = false;
    try { ok = document.execCommand('insertHTML', false, html); } catch {}
    if (!ok) {
      editor.innerHTML = html;
      fireInput(editor, 'insertText');
    } else {
      fireInput(editor);
    }
  }

  function selectMarker(marker) {
    const range = document.createRange();
    range.selectNode(marker);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  async function pasteImageFile(editor, marker, file) {
    try {
      selectMarker(marker);
      editor.focus();
      const dt = new DataTransfer();
      dt.items.add(file);
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      const before = editor.querySelectorAll('img').length;
      marker.dispatchEvent(ev);
      editor.dispatchEvent(ev);
      for (let i = 0; i < 18; i++) {
        await sleep(250);
        const after = editor.querySelectorAll('img').length;
        if (after > before || !marker.isConnected) return true;
      }
    } catch {}
    return false;
  }

  async function insertSelectedImages(editor, files) {
    if (!files?.length) return { ok: 0, fail: 0 };
    let ok = 0, fail = 0;
    const selected = [...files];

    for (let i = 0; i < selected.length; i++) {
      const n = i + 1;
      const marker = editor.querySelector(`[data-mumei-pon-img="${n}"]`);
      if (!marker) continue;
      const done = await pasteImageFile(editor, marker, selected[i]);
      if (done) ok++;
      else {
        fail++;
        marker.textContent = `🖼️ 挿絵${n}：ここへ手動挿入`;
      }
      await sleep(350);
    }

    fireInput(editor);
    return { ok, fail };
  }

  async function restoreBackup(show) {
    const editor = await waitEditor();
    if (!editor) return show('本文エディタが見つからない');
    const b = getBackup();
    if (!b) return show('このページのバックアップがない');

    selectNodeContents(editor);
    let ok = false;
    try { ok = document.execCommand('insertHTML', false, b.html); } catch {}
    if (!ok) editor.innerHTML = b.html;
    fireInput(editor, 'insertText');
    show('↩️ 元本文へ戻した');
  }

  function getMountParent() {
    const main = document.querySelector('main');
    if (main) return main;
    return document.body;
  }

  function buildHost() {
    const host = document.createElement('section');
    host.id = HOST_ID;
    host.setAttribute('data-mumei-pon-v3', 'bottom');
    host.style.cssText = [
      'display:block!important',
      'position:static!important',
      'float:none!important',
      'clear:both!important',
      'inset:auto!important',
      'left:auto!important',
      'right:auto!important',
      'top:auto!important',
      'bottom:auto!important',
      'transform:none!important',
      'width:100%!important',
      'max-width:760px!important',
      'min-width:0!important',
      'height:auto!important',
      'margin:48px auto 96px!important',
      'padding:0 12px!important',
      'box-sizing:border-box!important',
      'flex:0 0 100%!important',
      'align-self:stretch!important',
      'order:2147483647!important',
      'z-index:auto!important'
    ].join(';');

    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host{all:initial}
        *{box-sizing:border-box}
        .box{font-family:system-ui,-apple-system,sans-serif;background:#07182a;color:#fff;border:1px solid #2fd7c6;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px #0003;width:100%}
        .bar{display:flex;align-items:center;gap:8px;padding:12px 14px;background:#0b2138;cursor:pointer;user-select:none}
        .title{font-weight:900;font-size:15px;flex:1}.ver{font-size:11px;color:#9ddbd6}.arrow{font-size:15px}
        .body{display:none;padding:12px}.body.open{display:block}
        textarea{width:100%;height:34vh;min-height:220px;border:0;border-radius:10px;padding:12px;font-size:15px;line-height:1.55;background:#fff;color:#111;resize:vertical}
        .hint{font-size:12px;line-height:1.55;color:#c8d9e6;margin:0 0 8px}
        .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
        button,.fileLabel{border:0;border-radius:10px;padding:11px 12px;font-size:14px;font-weight:800;cursor:pointer;text-align:center}
        .main{background:#39e7d2;color:#04202a;flex:1 1 180px}.sub{background:#17314b;color:#fff;border:1px solid #35546f;flex:1 1 150px}.danger{background:#5a2841;color:#fff;flex:1 1 150px}
        .fileLabel{display:block;background:#17314b;color:#fff;border:1px solid #35546f;flex:1 1 180px}.fileLabel input{display:none}
        .status{font-size:12px;color:#9ddbd6;margin-top:8px;min-height:1.4em;white-space:pre-wrap}
      </style>
      <div class="box">
        <div class="bar" id="toggle">
          <div class="title">📄 ポン出し</div>
          <div class="ver">v3｜ページ最下部</div>
          <div class="arrow">⌄</div>
        </div>
        <div class="body" id="body">
          <p class="hint">横・浮遊ボタンは使いません。ここはページ最下部の通常ブロックです。原稿内の [[挿絵1]] [[挿絵2]]… の順に画像を自動貼付します。</p>
          <textarea id="src" placeholder="ここへ完成原稿を丸ごと貼る"></textarea>
          <div class="row">
            <label class="fileLabel">🖼️ 挿絵をまとめて選択<input id="files" type="file" accept="image/*" multiple></label>
          </div>
          <div class="row">
            <button class="main" id="go">🚀 全消し → 本文＋挿絵ポン</button>
            <button class="sub" id="clip">📋 クリップボード読込</button>
            <button class="danger" id="undo">↩️ 元本文へ戻す</button>
          </div>
          <div class="status" id="status"></div>
        </div>
      </div>`;

    const q = s => root.querySelector(s);
    const body = q('#body');
    const status = q('#status');
    const show = msg => { status.textContent = msg; };

    q('#toggle').onclick = () => body.classList.toggle('open');

    q('#clip').onclick = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text.trim()) return show('クリップボードが空です');
        q('#src').value = text;
        show('📋 原稿を読み込んだ');
      } catch {
        show('クリップボードを直接読めないので、原稿欄を長押し→貼り付け');
      }
    };

    q('#undo').onclick = () => restoreBackup(show);

    q('#go').onclick = async () => {
      const src = q('#src').value || '';
      if (!src.trim()) return show('原稿を貼ってから押してね');

      const editor = await waitEditor();
      if (!editor) return show('本文エディタが見つからない');

      show('旧本文をバックアップ中…');
      replaceEditor(editor, markdownToHtml(src));
      await sleep(700);

      const files = q('#files').files;
      if (files?.length) {
        show(`本文投入完了。挿絵 ${files.length}枚を貼付中…`);
        const r = await insertSelectedImages(editor, files);
        if (r.fail) show(`✅ 本文完了／挿絵 ${r.ok}枚成功・${r.fail}枚は目印を残した`);
        else show(`✅ 全消し・見出し・本文・挿絵 ${r.ok}枚 完了`);
      } else {
        const markers = editor.querySelectorAll('[data-mumei-pon-img]').length;
        show(markers ? `✅ 本文完了。挿絵目印 ${markers}個あり。画像を選んで再実行で自動貼付` : '✅ 全消し・見出し・本文投入 完了');
      }
    };

    getMountParent().appendChild(host);
    return host;
  }

  function mountAtBottom() {
    const editor = findEditor();
    if (!editor) return;

    let host = document.getElementById(HOST_ID);
    const parent = getMountParent();

    if (!host) {
      buildHost();
      return;
    }

    if (host.parentElement !== parent || host !== parent.lastElementChild) {
      try { parent.appendChild(host); } catch {}
    }
  }

  let ticking = false;
  const scheduleMount = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      mountAtBottom();
    });
  };

  scheduleMount();
  const mo = new MutationObserver(scheduleMount);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(scheduleMount, 1800);
})();
