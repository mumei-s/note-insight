// ==UserScript==
// @name         note ポン出し v4｜メニュー起動＋挿絵自動
// @namespace    https://github.com/mumei-s/note-insight
// @version      4.0.0
// @description  noteページ内にUIを置かず、ユーザースクリプトのメニューから起動。本文全消し、見出し整形、挿絵自動、元本文復元。
// @author       無名S note
// @match        https://note.com/*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-menu-v4.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-menu-v4.user.js
// ==/UserScript==

(() => {
  'use strict';

  const BACKUP_PREFIX = 'mumei-note-pon-v4-backup:';
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
      let score = r.width * r.height + text * 160;
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
      listType = null; listItems = [];
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
        listType = 'ul'; listItems.push(ul[1]); continue;
      }

      const ol = t.match(/^\d+[\.．]\s*(.+)$/);
      if (ol) {
        flushPara();
        if (listType && listType !== 'ol') flushList();
        listType = 'ol'; listItems.push(ol[1]); continue;
      }

      const q = t.match(/^>\s?(.*)$/);
      if (q) { flushPara(); flushList(); out.push(`<blockquote>${inline(q[1])}</blockquote>`); continue; }
      para.push(line);
    }
    flushPara(); flushList();
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
    try { editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType, data: null })); }
    catch { editor.dispatchEvent(new Event('input', { bubbles: true })); }
    editor.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function replaceEditor(editor, html) {
    saveBackup(editor);
    selectContents(editor);
    let ok = false;
    try { ok = document.execCommand('insertHTML', false, html); } catch {}
    if (!ok) {
      editor.innerHTML = html;
      fireInput(editor, 'insertText');
    } else {
      fireInput(editor);
    }
  }

  async function getSource() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) return text;
    } catch {}
    return window.prompt('完成原稿をここへ貼り付けて「OK」') || '';
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
      for (let i = 0; i < 20; i++) {
        await sleep(250);
        const after = editor.querySelectorAll('img').length;
        if (after > before || !marker.isConnected) return true;
      }
    } catch {}
    return false;
  }

  async function chooseImages() {
    return await new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;opacity:0;pointer-events:none';
      input.addEventListener('change', () => {
        const files = [...(input.files || [])];
        input.remove();
        resolve(files);
      }, { once: true });
      document.documentElement.appendChild(input);
      input.click();
      setTimeout(() => {
        if (input.isConnected && !(input.files && input.files.length)) {
          input.remove();
        }
      }, 30000);
    });
  }

  async function insertImages() {
    const editor = await waitEditor();
    if (!editor) return alert('本文エディタが見つからない');
    const markers = [...editor.querySelectorAll('[data-mumei-pon-img]')]
      .sort((a,b) => Number(a.dataset.mumeiPonImg) - Number(b.dataset.mumeiPonImg));
    if (!markers.length) return alert('本文内に [[挿絵1]] などの目印がありません');
    const files = await chooseImages();
    if (!files.length) return;
    let ok = 0, fail = 0;
    for (let i = 0; i < Math.min(files.length, markers.length); i++) {
      const done = await pasteImageFile(editor, markers[i], files[i]);
      if (done) ok++;
      else {
        fail++;
        markers[i].textContent = `🖼️ 挿絵${i+1}：ここへ手動挿入`;
      }
      await sleep(350);
    }
    fireInput(editor);
    alert(fail ? `本文は完了。挿絵 ${ok}枚成功／${fail}枚は目印を残しました` : `挿絵 ${ok}枚 完了`);
  }

  async function ponTextOnly() {
    const src = await getSource();
    if (!src.trim()) return;
    const editor = await waitEditor();
    if (!editor) return alert('本文エディタが見つからない');
    replaceEditor(editor, markdownToHtml(src));
    const count = editor.querySelectorAll('[data-mumei-pon-img]').length;
    alert(count ? `本文・見出しの投入完了。挿絵目印 ${count}個あり → 次にメニューの「挿絵を入れる」` : '本文・見出しの投入完了');
  }

  async function ponAll() {
    const src = await getSource();
    if (!src.trim()) return;
    const editor = await waitEditor();
    if (!editor) return alert('本文エディタが見つからない');
    replaceEditor(editor, markdownToHtml(src));
    await sleep(600);
    const count = editor.querySelectorAll('[data-mumei-pon-img]').length;
    if (!count) return alert('本文・見出しの投入完了');
    const files = await chooseImages();
    if (!files.length) return alert(`本文完了。挿絵目印 ${count}個は残っています`);
    let ok = 0, fail = 0;
    const markers = [...editor.querySelectorAll('[data-mumei-pon-img]')]
      .sort((a,b) => Number(a.dataset.mumeiPonImg) - Number(b.dataset.mumeiPonImg));
    for (let i = 0; i < Math.min(files.length, markers.length); i++) {
      const done = await pasteImageFile(editor, markers[i], files[i]);
      if (done) ok++;
      else {
        fail++;
        markers[i].textContent = `🖼️ 挿絵${i+1}：ここへ手動挿入`;
      }
      await sleep(350);
    }
    fireInput(editor);
    alert(fail ? `本文完了／挿絵 ${ok}枚成功・${fail}枚は目印を残しました` : `本文・見出し・挿絵 ${ok}枚 完了`);
  }

  async function restore() {
    const editor = await waitEditor();
    if (!editor) return alert('本文エディタが見つからない');
    const b = getBackup();
    if (!b) return alert('このページのバックアップがありません');
    selectContents(editor);
    let ok = false;
    try { ok = document.execCommand('insertHTML', false, b.html); } catch {}
    if (!ok) editor.innerHTML = b.html;
    fireInput(editor, 'insertText');
    alert('元本文へ戻しました');
  }

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('🚀 本文＋挿絵ポン', ponAll);
    GM_registerMenuCommand('📝 本文だけポン', ponTextOnly);
    GM_registerMenuCommand('🖼️ 挿絵を入れる', insertImages);
    GM_registerMenuCommand('↩️ 元本文へ戻す', restore);
  }
})();
