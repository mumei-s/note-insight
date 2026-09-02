// ==UserScript==
// @name         note ポン出し v13.1｜追記標準・小型可動
// @namespace    https://github.com/mumei-s/note-insight
// @version      13.1.0
// @description  通常は既存本文・リンクを消さずカーソル位置へ追記。全消しは別ボタン。小型・移動・最小化対応。brなし、---区切り線対応。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v13.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v13.user.js
// ==/UserScript==

(() => {
  'use strict';

  const ROOT_ID = '__mumei_pon_v131_root__';
  const BACKUP_PREFIX = 'mumei-note-pon-v131-backup:';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  [
    '__mumei_pon_v13_root__','__mumei_pon_v12_root__','__mumei_pon_v11_root__',
    '__mumei_pon_v10_root__','__mumei_pon_v9_editor__','__mumei_pon_v8_editor__',
    '__mumei_pon_v7_editor__','__mumei_pon_v6_editor__'
  ].forEach(id => document.getElementById(id)?.remove());
  if (document.getElementById(ROOT_ID)) return;

  const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  function cleanSource(src) {
    return String(src || '')
      .replace(/^:::writing\{[^\n]*\}\s*$/gmi, '')
      .replace(/^:::\s*$/gmi, '')
      .replace(/^```(?:markdown|md|text)?\s*$/gmi, '')
      .replace(/^```\s*$/gmi, '')
      .replace(/\r\n?/g, '\n')
      .trim();
  }

  function sourceToHtml(src) {
    const lines = cleanSource(src).split('\n');
    const out = [];
    let para = [];
    let list = [];
    let listType = '';

    const flushPara = () => {
      if (!para.length) return;
      const text = para.map(v => v.trim()).filter(Boolean).join('');
      if (text) out.push(`<p>${inline(text)}</p>`);
      para = [];
    };
    const flushList = () => {
      if (!list.length || !listType) return;
      out.push(`<${listType}>${list.map(v => `<li>${inline(v)}</li>`).join('')}</${listType}>`);
      list = [];
      listType = '';
    };

    for (const raw of lines) {
      const t = raw.trim();
      if (!t) { flushPara(); flushList(); continue; }
      if (/^-{3,}$/.test(t)) {
        flushPara(); flushList(); out.push('<hr>'); continue;
      }
      const h1 = t.match(/^#\s+(.+)$/);
      const h2 = t.match(/^##\s+(.+)$/) || t.match(/^###\s+(.+)$/);
      if (h1) { flushPara(); flushList(); out.push(`<h2>${inline(h1[1])}</h2>`); continue; }
      if (h2) { flushPara(); flushList(); out.push(`<h3>${inline(h2[1])}</h3>`); continue; }
      const ul = t.match(/^[-*・]\s*(.+)$/);
      if (ul) {
        flushPara();
        if (listType && listType !== 'ul') flushList();
        listType = 'ul'; list.push(ul[1]); continue;
      }
      const ol = t.match(/^\d+[\.．]\s*(.+)$/);
      if (ol) {
        flushPara();
        if (listType && listType !== 'ol') flushList();
        listType = 'ol'; list.push(ol[1]); continue;
      }
      const q = t.match(/^>\s?(.*)$/);
      if (q) { flushPara(); flushList(); out.push(`<blockquote>${inline(q[1])}</blockquote>`); continue; }
      para.push(t);
    }

    flushPara();
    flushList();
    const html = out.join('');
    if (/<br\b/i.test(html)) throw new Error('br detected');
    return html;
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 160 && r.height > 80 && s.display !== 'none' && s.visibility !== 'hidden';
  }

  function findEditor() {
    const pm = [...document.querySelectorAll('.ProseMirror[contenteditable="true"]')].find(visible);
    if (pm) return pm;
    const all = [...document.querySelectorAll('[contenteditable="true"]')].filter(visible);
    if (!all.length) return null;
    return all.sort((a,b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
  }

  async function waitEditor(ms = 10000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const e = findEditor();
      if (e) return e;
      await sleep(120);
    }
    return null;
  }

  function backupKey() { return BACKUP_PREFIX + location.pathname; }
  function saveBackup(editor) {
    try { localStorage.setItem(backupKey(), JSON.stringify({html: editor.innerHTML, time: Date.now()})); } catch {}
  }
  function readBackup() {
    try { return JSON.parse(localStorage.getItem(backupKey()) || 'null'); } catch { return null; }
  }
  function fireInput(editor, type='insertText') {
    try { editor.dispatchEvent(new InputEvent('input', {bubbles:true, inputType:type, data:null})); }
    catch { editor.dispatchEvent(new Event('input', {bubbles:true})); }
    editor.dispatchEvent(new Event('change', {bubbles:true}));
  }
  function selectEditor(editor) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    editor.focus();
  }

  let savedEditorRange = null;
  const toElement = node => node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const editor = findEditor();
    if (!editor) return;
    const range = sel.getRangeAt(0);
    const el = toElement(range.commonAncestorContainer);
    if (el && (el === editor || editor.contains(el))) savedEditorRange = range.cloneRange();
  });

  function placeCaret(editor) {
    const sel = window.getSelection();
    if (savedEditorRange) {
      const el = toElement(savedEditorRange.commonAncestorContainer);
      if (el && (el === editor || editor.contains(el))) {
        try {
          sel.removeAllRanges();
          sel.addRange(savedEditorRange.cloneRange());
          editor.focus();
          return;
        } catch {}
      }
    }
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    editor.focus();
  }

  async function hardClear(editor) {
    saveBackup(editor);
    selectEditor(editor);
    try { document.execCommand('delete', false); } catch {}
    fireInput(editor, 'deleteContentBackward');
    await sleep(150);
    if ((editor.innerText || '').trim()) {
      editor.innerHTML = '';
      fireInput(editor, 'deleteContentBackward');
      await sleep(120);
    }
    savedEditorRange = null;
    return !(editor.innerText || '').trim();
  }

  async function appendHtml(editor, html) {
    saveBackup(editor);
    placeCaret(editor);
    let ok = false;
    try { ok = document.execCommand('insertHTML', false, html); } catch {}
    if (!ok) {
      try {
        const sel = window.getSelection();
        if (sel?.rangeCount) {
          const range = sel.getRangeAt(0);
          range.collapse(true);
          const fragment = range.createContextualFragment(html);
          const last = fragment.lastChild;
          range.insertNode(fragment);
          if (last) {
            range.setStartAfter(last);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          ok = true;
        }
      } catch {}
    }
    if (!ok) editor.insertAdjacentHTML('beforeend', html);
    fireInput(editor, 'insertFromPaste');
  }

  async function replaceAll(editor, html) {
    const empty = await hardClear(editor);
    if (!empty) return false;
    placeCaret(editor);
    let ok = false;
    try { ok = document.execCommand('insertHTML', false, html); } catch {}
    if (!ok || !(editor.innerText || '').trim()) editor.innerHTML = html;
    fireInput(editor, 'insertFromPaste');
    return true;
  }

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.cssText = 'position:fixed!important;right:8px!important;bottom:72px!important;z-index:2147483647!important;font-family:system-ui,-apple-system,sans-serif!important;pointer-events:auto!important;';
  root.innerHTML = `
    <button id="ponFab" type="button" style="border:0;border-radius:999px;padding:7px 10px;background:#0b2138;color:#fff;font-weight:900;font-size:11px;box-shadow:0 4px 14px rgba(0,0,0,.3);outline:1px solid #39e7d2;touch-action:manipulation">📄 ポン</button>
    <div id="ponPanel" style="display:none;position:fixed;right:6px;bottom:108px;width:min(72vw,320px);max-height:42vh;overflow:auto;background:#07182a;color:#fff;border:1px solid #39e7d2;border-radius:10px;padding:7px;box-shadow:0 8px 24px rgba(0,0,0,.4)">
      <div id="ponDrag" style="display:flex;align-items:center;gap:5px;margin:-1px -1px 5px;padding:4px 3px;cursor:move;touch-action:none;user-select:none;border-bottom:1px solid #28445c">
        <b style="flex:1;font-size:12px">↔️ ポン出し v13.1</b>
        <button id="ponMin" type="button" style="border:0;background:#17314b;color:#fff;border-radius:6px;padding:3px 6px;font-size:11px">＿</button>
        <button id="ponClose" type="button" style="border:0;background:#17314b;color:#fff;border-radius:6px;padding:3px 6px;font-size:11px">✕</button>
      </div>
      <div style="font-size:9px;line-height:1.3;color:#c8d9e6;margin-bottom:4px">通常＝既存本文保持。カーソル位置へ追記。#大見出し / ##小見出し / ---区切り線</div>
      <textarea id="ponSrc" rows="6" placeholder="原稿を貼り付け" style="display:block;width:100%;height:112px;resize:vertical;box-sizing:border-box;border:1px solid #39e7d2;border-radius:7px;padding:7px;background:#fff;color:#111;font:13px/1.35 system-ui;caret-color:#111;user-select:text;-webkit-user-select:text"></textarea>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:5px">
        <button id="ponClip" type="button" style="border:0;border-radius:7px;padding:7px 4px;background:#17314b;color:#fff;font-weight:800;font-size:10px">📋 読込</button>
        <button id="ponAdd" type="button" style="border:0;border-radius:7px;padding:7px 4px;background:#39e7d2;color:#04202a;font-weight:900;font-size:10px">➕ 追記</button>
        <button id="ponUndo" type="button" style="border:0;border-radius:7px;padding:7px 4px;background:#5a2841;color:#fff;font-weight:800;font-size:10px">↩️ 戻す</button>
        <button id="ponReplace" type="button" style="border:1px solid #ff7a7a;border-radius:7px;padding:7px 4px;background:#521b25;color:#fff;font-weight:900;font-size:10px">⚠️ 全消し</button>
      </div>
      <div id="ponStatus" style="min-height:1.1em;margin-top:4px;color:#9ddbd6;font-size:9px;line-height:1.25;white-space:pre-wrap"></div>
    </div>`;
  document.body.appendChild(root);

  const fab = root.querySelector('#ponFab');
  const panel = root.querySelector('#ponPanel');
  const drag = root.querySelector('#ponDrag');
  const close = root.querySelector('#ponClose');
  const min = root.querySelector('#ponMin');
  const src = root.querySelector('#ponSrc');
  const status = root.querySelector('#ponStatus');
  const show = m => status.textContent = m;
  const minimize = () => { panel.style.display = 'none'; fab.style.display = 'block'; };

  fab.addEventListener('click', () => { panel.style.display = 'block'; fab.style.display = 'none'; });
  min.addEventListener('click', minimize);
  close.addEventListener('click', () => root.remove());

  let moving = null;
  drag.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const r = panel.getBoundingClientRect();
    moving = {x:e.clientX, y:e.clientY, left:r.left, top:r.top};
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
    try { drag.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });
  drag.addEventListener('pointermove', e => {
    if (!moving) return;
    const maxLeft = Math.max(0, innerWidth - panel.offsetWidth);
    const maxTop = Math.max(0, innerHeight - 40);
    panel.style.left = `${Math.min(maxLeft, Math.max(0, moving.left + e.clientX - moving.x))}px`;
    panel.style.top = `${Math.min(maxTop, Math.max(0, moving.top + e.clientY - moving.y))}px`;
    e.preventDefault();
  });
  const stopMove = () => { moving = null; };
  drag.addEventListener('pointerup', stopMove);
  drag.addEventListener('pointercancel', stopMove);

  root.querySelector('#ponClip').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return show('クリップボードが空');
      src.value = text;
      show('✅ 読込');
    } catch {
      show('白い欄を長押し→貼付でOK');
    }
  });

  root.querySelector('#ponAdd').addEventListener('click', async () => {
    if (!src.value.trim()) return show('原稿を貼ってね');
    const editor = await waitEditor();
    if (!editor) return show('❌ 本文が見つからない');
    let html;
    try { html = sourceToHtml(src.value); } catch { return show('❌ br検出'); }
    show('追記中…');
    await appendHtml(editor, html);
    show('✅ 既存本文を残して追記完了');
    setTimeout(minimize, 650);
  });

  root.querySelector('#ponReplace').addEventListener('click', async () => {
    if (!src.value.trim()) return show('原稿を貼ってね');
    if (!confirm('本文をすべて削除して、この原稿だけに置き換えます。既存リンクやカードも消えます。実行しますか？')) return show('全消しを中止');
    if (!confirm('最終確認：本当に本文を全消ししますか？')) return show('全消しを中止');
    const editor = await waitEditor();
    if (!editor) return show('❌ 本文が見つからない');
    let html;
    try { html = sourceToHtml(src.value); } catch { return show('❌ br検出'); }
    show('全消し→貼付中…');
    const ok = await replaceAll(editor, html);
    if (!ok) return show('❌ 全消し失敗。新原稿は未貼付');
    show('✅ 全置換完了');
    setTimeout(minimize, 650);
  });

  root.querySelector('#ponUndo').addEventListener('click', async () => {
    const editor = await waitEditor();
    if (!editor) return show('❌ 本文が見つからない');
    const b = readBackup();
    if (!b?.html) return show('戻せるバックアップなし');
    editor.innerHTML = b.html;
    fireInput(editor, 'insertFromPaste');
    savedEditorRange = null;
    show('↩️ 直前の本文へ戻した');
  });
})();
