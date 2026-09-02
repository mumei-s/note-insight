// ==UserScript==
// @name         note ポン出し v12｜区切り線対応・貼付後自動終了
// @namespace    https://github.com/mumei-s/note-insight
// @version      12.0.0
// @description  editor.note.comで右下に表示。原稿貼付→旧本文全消し→brなしで整形→Markdownの---を区切り線へ変換→貼付後、ツール本体を自動終了。挿絵自動処理なし。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v6.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v6.user.js
// ==/UserScript==

(() => {
  'use strict';

  const ROOT_ID = '__mumei_pon_v12_root__';
  const BACKUP_PREFIX = 'mumei-note-pon-v12-backup:';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  ['__mumei_pon_v11_root__','__mumei_pon_v10_root__','__mumei_pon_v9_editor__','__mumei_pon_v8_editor__','__mumei_pon_v7_editor__','__mumei_pon_v6_editor__']
    .forEach(id => document.getElementById(id)?.remove());

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
        flushPara();
        flushList();
        out.push('<hr>');
        continue;
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
    catch { editor.dispatchEvent(new Event('input', {bubbles:true}));
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
    return !(editor.innerText || '').trim();
  }

  async function insertHtml(editor, html) {
    selectEditor(editor);
    let ok = false;
    try { ok = document.execCommand('insertHTML', false, html); } catch {}
    if (!ok || !(editor.innerText || '').trim()) {
      editor.innerHTML = html;
      fireInput(editor, 'insertFromPaste');
    } else {
      fireInput(editor, 'insertFromPaste');
    }
  }

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.cssText = 'position:fixed!important;right:14px!important;bottom:18px!important;z-index:2147483647!important;font-family:system-ui,-apple-system,sans-serif!important;pointer-events:auto!important;';
  root.innerHTML = `
    <button id="ponFab" type="button" style="border:0;border-radius:999px;padding:13px 17px;background:#0b2138;color:white;font-weight:900;font-size:15px;box-shadow:0 8px 24px rgba(0,0,0,.35);outline:2px solid #39e7d2;touch-action:manipulation">📄 ポン出し</button>
    <div id="ponPanel" style="display:none;position:absolute;right:0;bottom:58px;width:min(92vw,680px);max-height:78vh;overflow:auto;background:#07182a;color:#fff;border:1px solid #39e7d2;border-radius:14px;padding:12px;box-shadow:0 12px 36px rgba(0,0,0,.45)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><b style="flex:1">📄 ポン出し v12</b><button id="ponClose" type="button" style="border:0;background:#17314b;color:#fff;border-radius:8px;padding:7px 10px">✕</button></div>
      <div style="font-size:12px;color:#c8d9e6;margin-bottom:8px">原稿を貼る → 旧本文を全消し → 空確認 → 見出し・段落・区切り線を整えて貼付。#＝大見出し、##＝小見出し、---＝区切り線。成功したらツールは自動で消えます。</div>
      <textarea id="ponSrc" rows="15" placeholder="ここをタップして原稿を貼り付け" style="display:block;width:100%;min-height:260px;box-sizing:border-box;border:2px solid #39e7d2;border-radius:10px;padding:12px;background:#fff;color:#111;font:16px/1.55 system-ui;caret-color:#111;user-select:text;-webkit-user-select:text"></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button id="ponClip" type="button" style="flex:1 1 180px;border:0;border-radius:10px;padding:11px;background:#17314b;color:#fff;font-weight:800">📋 クリップボードから読込</button>
        <button id="ponGo" type="button" style="flex:1 1 220px;border:0;border-radius:10px;padding:11px;background:#39e7d2;color:#04202a;font-weight:900">🚀 全消し → 整形 → 貼る</button>
        <button id="ponUndo" type="button" style="flex:1 1 140px;border:0;border-radius:10px;padding:11px;background:#5a2841;color:#fff;font-weight:800">↩️ 元本文へ戻す</button>
      </div>
      <div id="ponStatus" style="min-height:1.4em;margin-top:8px;color:#9ddbd6;font-size:12px;white-space:pre-wrap"></div>
    </div>`;

  document.body.appendChild(root);

  const fab = root.querySelector('#ponFab');
  const panel = root.querySelector('#ponPanel');
  const close = root.querySelector('#ponClose');
  const src = root.querySelector('#ponSrc');
  const status = root.querySelector('#ponStatus');
  const show = m => status.textContent = m;
  const finishAndRemove = () => setTimeout(() => root.remove(), 900);

  fab.addEventListener('click', () => { panel.style.display = 'block'; setTimeout(() => src.focus(), 60); });
  close.addEventListener('click', () => root.remove());

  root.querySelector('#ponClip').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return show('クリップボードが空です');
      src.value = text;
      show('✅ 原稿を読み込みました');
    } catch {
      show('クリップボード読込不可。白い欄を長押し→貼り付けでOK');
    }
  });

  root.querySelector('#ponGo').addEventListener('click', async () => {
    if (!src.value.trim()) return show('原稿を貼ってから押してね');
    const editor = await waitEditor();
    if (!editor) return show('❌ note本文エディタが見つからない');
    show('① 旧本文を全消し中…');
    const empty = await hardClear(editor);
    if (!empty) return show('❌ 全消しできなかったので新原稿は入れていません');
    show('② 空を確認。整形して貼付中…');
    let html;
    try { html = sourceToHtml(src.value); } catch { return show('❌ br検出。貼付中止'); }
    await insertHtml(editor, html);
    show('✅ 貼付完了。ツールを閉じます');
    finishAndRemove();
  });

  root.querySelector('#ponUndo').addEventListener('click', async () => {
    const editor = await waitEditor();
    if (!editor) return show('❌ note本文エディタが見つからない');
    const b = readBackup();
    if (!b?.html) return show('戻せるバックアップがない');
    selectEditor(editor);
    editor.innerHTML = b.html;
    fireInput(editor, 'insertFromPaste');
    show('↩️ 元本文へ戻しました');
  });
})();
