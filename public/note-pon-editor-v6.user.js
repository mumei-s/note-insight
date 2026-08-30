// ==UserScript==
// @name         note ポン出し v6｜編集中画面常設＋挿絵自動
// @namespace    https://github.com/mumei-s/note-insight
// @version      6.0.0
// @description  noteの本当の編集中画面 editor.note.com 専用。本文直下に常設し、旧本文バックアップ、全消し、見出し整形、挿絵自動、元本文復元。旧ポンUIだけ非表示。夏機能には触れません。
// @author       無名S note
// @match        https://note.com/*
// @match        https://editor.note.com/*
// @grant        none
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v6.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v6.user.js
// ==/UserScript==

(() => {
  'use strict';

  const HOST_ID = '__mumei_pon_v6_editor__';
  const BACKUP_PREFIX = 'mumei-note-pon-v6-backup:';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 旧ポン出しだけ非表示。夏機能のID/CSS/DOMには一切触れない。
  const legacyCss = `
    #mumei-note-pon-dashi-fab,
    #mumei-note-pon-dashi-panel,
    #mumei-note-pon-dashi-toast,
    #__mumei_pon_v2_host__,
    #__mumei_pon_v21_host__,
    #__mumei_pon_v3_bottom__ {
      display:none !important;
      visibility:hidden !important;
      opacity:0 !important;
      pointer-events:none !important;
    }
  `;

  function installLegacyKiller() {
    if (document.getElementById('__mumei_pon_v6_legacy_killer__')) return;
    const s = document.createElement('style');
    s.id = '__mumei_pon_v6_legacy_killer__';
    s.textContent = legacyCss;
    (document.head || document.documentElement).appendChild(s);
  }
  installLegacyKiller();

  // note.com側では旧UIを消すだけ。実UIは本当の編集画面 editor.note.com だけ。
  if (location.hostname !== 'editor.note.com') return;

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
    return r.width > 120 && r.height > 40 && s.display !== 'none' && s.visibility !== 'hidden';
  }

  function findEditor() {
    const direct = document.querySelector('.ProseMirror[contenteditable="true"]');
    if (visible(direct)) return direct;

    const sels = [
      '[contenteditable="true"][role="textbox"]',
      'article [contenteditable="true"]',
      'main [contenteditable="true"]',
      'div[contenteditable="true"]'
    ];
    const all = [...new Set(sels.flatMap(sel => [...document.querySelectorAll(sel)]))].filter(visible);
    if (!all.length) return null;
    return all.map(el => {
      const r = el.getBoundingClientRect();
      const text = (el.innerText || '').length;
      let score = r.width * r.height + text * 180;
      if (String(el.className || '').includes('ProseMirror')) score += 1000000;
      if (el.getAttribute('role') === 'textbox') score += 300000;
      return { el, score };
    }).sort((a,b) => b.score - a.score)[0].el;
  }

  async function waitEditor(ms = 8000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const e = findEditor();
      if (e) return e;
      await sleep(120);
    }
    return null;
  }

  // 横並びの親を避けて、通常フローで下に出せる位置まで上がる。
  function findAnchor(editor) {
    let a = editor;
    for (let i = 0; i < 10 && a.parentElement && a.parentElement !== document.body; i++) {
      const p = a.parentElement;
      const d = getComputedStyle(p).display;
      if (d === 'flex' || d === 'inline-flex' || d === 'grid' || d === 'inline-grid') {
        a = p;
        continue;
      }
      break;
    }
    return a;
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
        flushPara(); flushList();
        out.push('<p>🔒【ここで有料ライン】</p>');
        continue;
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
      if (q) {
        flushPara(); flushList();
        out.push(`<blockquote>${inline(q[1])}</blockquote>`);
        continue;
      }

      para.push(line);
    }

    flushPara();
    flushList();
    return out.join('');
  }

  function selectContents(editor) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    editor.focus();
  }

  function fireInput(editor, inputType = 'insertFromPaste') {
    try { editor.dispatchEvent(new InputEvent('input', { bubbles:true, inputType, data:null })); }
    catch { editor.dispatchEvent(new Event('input', { bubbles:true })); }
    editor.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function replaceEditor(editor, html) {
    saveBackup(editor);
    selectContents(editor);
    let ok = false;
    try { ok = document.execCommand('insertHTML', false, html); } catch {}
    if (!ok) editor.innerHTML = html;
    fireInput(editor, ok ? 'insertFromPaste' : 'insertText');
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
      const before = editor.querySelectorAll('img').length;
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles:true, cancelable:true });
      marker.dispatchEvent(ev);
      editor.dispatchEvent(ev);
      for (let i = 0; i < 20; i++) {
        await sleep(250);
        const after = editor.querySelectorAll('img').length;
        if (after > before || !marker.isConnected) return true;
      }
    } catch {}
    return false;
  }

  async function insertImages(editor, files) {
    const markers = [...editor.querySelectorAll('[data-mumei-pon-img]')]
      .sort((a,b) => Number(a.dataset.mumeiPonImg) - Number(b.dataset.mumeiPonImg));
    if (!markers.length || !files?.length) return { ok:0, fail:0, markers:markers.length };

    let ok = 0, fail = 0;
    for (let i = 0; i < Math.min(files.length, markers.length); i++) {
      const good = await pasteImageFile(editor, markers[i], files[i]);
      if (good) ok++;
      else {
        fail++;
        markers[i].textContent = `🖼️ 挿絵${i+1}：ここへ手動挿入`;
      }
      await sleep(300);
    }
    fireInput(editor);
    return { ok, fail, markers:markers.length };
  }

  async function restoreBackup(show) {
    const editor = await waitEditor();
    if (!editor) return show('本文エディタが見つからない');
    const b = getBackup();
    if (!b) return show('このページのバックアップがない');
    selectContents(editor);
    let ok = false;
    try { ok = document.execCommand('insertHTML', false, b.html); } catch {}
    if (!ok) editor.innerHTML = b.html;
    fireInput(editor, 'insertText');
    show('↩️ 元本文へ戻した');
  }

  function buildHost() {
    const host = document.createElement('section');
    host.id = HOST_ID;
    host.style.cssText = [
      'display:block!important',
      'position:relative!important',
      'float:none!important',
      'clear:both!important',
      'width:100%!important',
      'max-width:760px!important',
      'min-width:0!important',
      'height:auto!important',
      'margin:24px auto 64px!important',
      'padding:0!important',
      'transform:none!important',
      'z-index:auto!important',
      'flex:0 0 100%!important',
      'align-self:stretch!important'
    ].join(';');

    const root = host.attachShadow({ mode:'open' });
    root.innerHTML = `
      <style>
        :host{all:initial}
        *{box-sizing:border-box}
        .box{width:100%;font-family:system-ui,-apple-system,sans-serif;background:#07182a;color:#fff;border:1px solid #2fd7c6;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px #0003}
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
          <div class="ver">v6｜編集中</div>
          <div class="arrow">⌄</div>
        </div>
        <div class="body" id="body">
          <p class="hint">ここは editor.note.com の編集中画面専用。完成原稿を1回貼る → 挿絵をまとめて選ぶ → ポン。[[挿絵1]] [[挿絵2]]… を自動位置指定します。</p>
          <textarea id="src" placeholder="ここへ完成原稿を丸ごと貼る"></textarea>
          <div class="row">
            <label class="fileLabel">🖼️ 挿絵をまとめて選択<input id="files" type="file" accept="image/*" multiple></label>
          </div>
          <div class="row">
            <button class="main" id="go">🚀 全消し → 本文＋挿絵ポン</button>
            <button class="sub" id="clip">📋 クリップボード読込</button>
            <button class="sub" id="textOnly">📝 本文だけ</button>
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
        show('クリップボードを直接読めないので、上の欄へ長押し→貼り付け');
      }
    };

    q('#undo').onclick = () => restoreBackup(show);

    q('#textOnly').onclick = async () => {
      const src = q('#src').value || '';
      if (!src.trim()) return show('原稿を貼ってから押してね');
      const editor = await waitEditor();
      if (!editor) return show('本文エディタが見つからない');
      replaceEditor(editor, markdownToHtml(src));
      const n = editor.querySelectorAll('[data-mumei-pon-img]').length;
      show(n ? `✅ 本文・見出し完了／挿絵目印 ${n}個` : '✅ 本文・見出し完了');
    };

    q('#go').onclick = async () => {
      const src = q('#src').value || '';
      if (!src.trim()) return show('原稿を貼ってから押してね');
      const editor = await waitEditor();
      if (!editor) return show('本文エディタが見つからない');

      show('旧本文をバックアップ → 全消し → 本文投入中…');
      replaceEditor(editor, markdownToHtml(src));
      await sleep(650);

      const files = [...(q('#files').files || [])];
      const markerCount = editor.querySelectorAll('[data-mumei-pon-img]').length;
      if (!files.length) {
        return show(markerCount ? `✅ 本文完了。挿絵目印 ${markerCount}個あり。画像を選んで再実行` : '✅ 全消し・見出し・本文投入 完了');
      }

      show(`本文完了。挿絵 ${files.length}枚を貼付中…`);
      const r = await insertImages(editor, files);
      show(r.fail ? `✅ 本文完了／挿絵 ${r.ok}枚成功・${r.fail}枚は目印を残した` : `✅ 本文・見出し・挿絵 ${r.ok}枚 完了`);
    };

    return host;
  }

  function mount() {
    installLegacyKiller();
    const editor = findEditor();
    if (!editor) return;
    const anchor = findAnchor(editor);
    let host = document.getElementById(HOST_ID);
    if (!host) host = buildHost();

    const p = anchor.parentElement;
    if (!p) return;
    if (host.parentElement !== p || host.previousElementSibling !== anchor) {
      try { anchor.insertAdjacentElement('afterend', host); }
      catch { p.appendChild(host); }
    }
  }

  let ticking = false;
  function scheduleMount() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      mount();
    });
  }

  const start = () => {
    scheduleMount();
    new MutationObserver(scheduleMount).observe(document.documentElement, { childList:true, subtree:true });
    setInterval(scheduleMount, 1200);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
