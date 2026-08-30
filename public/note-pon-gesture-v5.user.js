// ==UserScript==
// @name         note ポン出し v5｜左下3タップ起動＋挿絵自動
// @namespace    https://github.com/mumei-s/note-insight
// @version      5.0.0
// @description  noteページ内に見えるUIを一切置かず、左下3タップで起動。本文全消し、見出し整形、挿絵自動、元本文復元。既存の夏機能には触れません。
// @author       無名S note
// @match        https://note.com/*
// @grant        none
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-gesture-v5.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-gesture-v5.user.js
// ==/UserScript==

(() => {
  'use strict';

  const BACKUP_PREFIX = 'mumei-note-pon-v5-backup:';
  const TAP_WINDOW = 900;
  const HOT_W = 0.36;
  const HOT_H = 150;
  let taps = [];
  let busy = false;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
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
    const all = [...new Set(selectors.flatMap(sel => [...document.querySelectorAll(sel)]))].filter(visible);
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
        flushPara(); flushList();
        out.push('<p>🔒【ここで有料ライン】</p>');
        continue;
      }

      const ul = t.match(/^[-*・]\s+(.+)$/);
      if (ul) {
        flushPara();
        if (listType && listType !== 'ul') flushList();
        listType = 'ul'; listItems.push(ul[1]);
        continue;
      }

      const ol = t.match(/^\d+[\.．]\s*(.+)$/);
      if (ol) {
        flushPara();
        if (listType && listType !== 'ol') flushList();
        listType = 'ol'; listItems.push(ol[1]);
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
    try { editor.dispatchEvent(new InputEvent('input', { bubbles:true, inputType, data:null })); }
    catch { editor.dispatchEvent(new Event('input', { bubbles:true })); }
    editor.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function replaceEditor(editor, html) {
    saveBackup(editor);
    selectNodeContents(editor);
    let ok = false;
    try { ok = document.execCommand('insertHTML', false, html); } catch {}
    if (!ok) editor.innerHTML = html;
    fireInput(editor, ok ? 'insertFromPaste' : 'insertText');
  }

  async function readArticleSource() {
    try {
      const t = await navigator.clipboard.readText();
      if (t && t.trim()) return t;
    } catch {}
    return window.prompt('完成原稿をここへ貼り付けて「OK」\n（長文をそのまま貼って大丈夫）', '') || '';
  }

  function openImagePicker() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;opacity:0;pointer-events:none';
      const done = () => {
        const files = input.files ? [...input.files] : [];
        try { input.remove(); } catch {}
        resolve(files);
      };
      input.addEventListener('change', done, { once:true });
      input.addEventListener('cancel', done, { once:true });
      (document.documentElement || document.body).appendChild(input);
      input.click();
      setTimeout(() => {
        if (input.isConnected && (!input.files || input.files.length === 0)) {
          // leave picker alive; change/cancel will resolve on browsers that support it
        }
      }, 500);
    });
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
    if (!files.length) return { ok:0, fail:0, missing:0 };
    let ok = 0, fail = 0, missing = 0;
    for (let i = 0; i < files.length; i++) {
      const n = i + 1;
      const marker = editor.querySelector(`[data-mumei-pon-img="${n}"]`);
      if (!marker) { missing++; continue; }
      const good = await pasteImageFile(editor, marker, files[i]);
      if (good) ok++;
      else {
        fail++;
        marker.textContent = `🖼️ 挿絵${n}：ここへ手動挿入`;
      }
      await sleep(300);
    }
    fireInput(editor);
    return { ok, fail, missing };
  }

  async function restoreBackup() {
    const editor = await waitEditor();
    if (!editor) return alert('本文エディタが見つからない');
    const b = getBackup();
    if (!b) return alert('このページのバックアップがない');
    selectNodeContents(editor);
    let ok = false;
    try { ok = document.execCommand('insertHTML', false, b.html); } catch {}
    if (!ok) editor.innerHTML = b.html;
    fireInput(editor, 'insertText');
    alert('↩️ 元本文へ戻した');
  }

  async function doText(withImages) {
    const editor = await waitEditor();
    if (!editor) return alert('本文エディタが見つからない。noteの記事編集画面を開いてから実行してね。');
    const src = await readArticleSource();
    if (!src.trim()) return;

    replaceEditor(editor, markdownToHtml(src));
    await sleep(700);

    if (!withImages) {
      alert('✅ 旧本文バックアップ → 全消し → 見出し整形 → 本文投入 完了');
      return;
    }

    const markerCount = editor.querySelectorAll('[data-mumei-pon-img]').length;
    if (!markerCount) {
      alert('✅ 本文投入完了。挿絵マーカー [[挿絵1]] がないので本文だけ反映した。');
      return;
    }

    const files = await openImagePicker();
    if (!files.length) {
      alert(`✅ 本文投入完了。挿絵マーカー ${markerCount}個は残してある。`);
      return;
    }

    const r = await insertImages(editor, files);
    alert(`✅ 本文＋挿絵 完了\n挿絵成功 ${r.ok}枚 / 失敗 ${r.fail}枚 / 対応マーカーなし ${r.missing}枚`);
  }

  async function doImagesOnly() {
    const editor = await waitEditor();
    if (!editor) return alert('本文エディタが見つからない');
    const markers = editor.querySelectorAll('[data-mumei-pon-img]');
    if (!markers.length) return alert('本文内に [[挿絵1]] などの目印がない');
    const files = await openImagePicker();
    if (!files.length) return;
    const r = await insertImages(editor, files);
    alert(`🖼️ 挿絵処理完了\n成功 ${r.ok}枚 / 失敗 ${r.fail}枚 / 対応マーカーなし ${r.missing}枚`);
  }

  async function openNativeMenu() {
    if (busy) return;
    busy = true;
    try {
      const choice = window.prompt(
        'note ポン出し v5\n\n1：本文＋挿絵ポン\n2：本文だけポン\n3：挿絵だけ\n4：元本文へ戻す\n\n番号を入力',
        '1'
      );
      if (choice == null) return;
      if (choice.trim() === '1') await doText(true);
      else if (choice.trim() === '2') await doText(false);
      else if (choice.trim() === '3') await doImagesOnly();
      else if (choice.trim() === '4') await restoreBackup();
      else alert('1〜4を入力してね');
    } finally {
      busy = false;
    }
  }

  function inHotZone(x, y) {
    return x <= Math.max(120, innerWidth * HOT_W) && y >= innerHeight - HOT_H;
  }

  function registerTap(x, y) {
    if (!inHotZone(x, y)) {
      taps = [];
      return;
    }
    const now = Date.now();
    taps = taps.filter(t => now - t < TAP_WINDOW);
    taps.push(now);
    if (taps.length >= 3) {
      taps = [];
      setTimeout(openNativeMenu, 0);
    }
  }

  window.addEventListener('pointerup', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    registerTap(e.clientX, e.clientY);
  }, true);

  window.addEventListener('touchend', e => {
    const t = e.changedTouches && e.changedTouches[0];
    if (t) registerTap(t.clientX, t.clientY);
  }, { capture:true, passive:true });
})();
