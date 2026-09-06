// ==UserScript==
// @name         note ポン出し v32.1｜コピペ→整えてポン出し
// @namespace    https://github.com/mumei-s/note-insight
// @version      32.1.0
// @description  本文をコピペして「整えてポン出し」を押すだけ。既存本文を全消しし、note標準の大見出し・小見出し・段落・箇条書きへ整形。目次対応、brなし、挿絵は触らない。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v6.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v6.user.js
// ==/UserScript==

(() => {
  'use strict';

  const ROOT_ID = '__mumei_pon_v32_1_root__';
  const BACKUP_PREFIX = 'mumei-note-pon-v32-backup:';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  [
    '__mumei_pon_v32_root__','__mumei_pon_v31_root__','__mumei_pon_v14_1_root__','__mumei_pon_v14_root__',
    '__mumei_pon_v13_root__','__mumei_pon_v12_root__','__mumei_pon_v11_root__','__mumei_pon_v10_root__',
    '__mumei_pon_v9_editor__','__mumei_pon_v8_editor__','__mumei_pon_v7_editor__','__mumei_pon_v6_editor__'
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
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function sourceToHtml(src) {
    const lines = cleanSource(src).split('\n');
    const blocks = [];
    let para = [];
    let list = [];
    let listType = '';

    const flushPara = () => {
      if (!para.length) return;
      const text = para.map(v => v.trim()).filter(Boolean).join('');
      if (text) blocks.push({type:'p', text});
      para = [];
    };
    const flushList = () => {
      if (!list.length || !listType) return;
      blocks.push({type:listType, items:[...list]});
      list = [];
      listType = '';
    };
    const flushAll = () => { flushPara(); flushList(); };

    for (const raw of lines) {
      const t = raw.trim();
      if (!t) { flushAll(); continue; }

      if (/^-{3,}$/.test(t) || /^_{3,}$/.test(t)) {
        flushAll(); blocks.push({type:'hr'}); continue;
      }

      const bigHeading = t.match(/^#\s+(.+)$/) || t.match(/^◆\s*(.+)$/);
      const smallHeading = t.match(/^##\s+(.+)$/) || t.match(/^###\s+(.+)$/) || t.match(/^◇\s*(.+)$/);
      if (bigHeading) { flushAll(); blocks.push({type:'h2', text:bigHeading[1]}); continue; }
      if (smallHeading) { flushAll(); blocks.push({type:'h3', text:smallHeading[1]}); continue; }

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
      if (q) { flushAll(); blocks.push({type:'quote', text:q[1]}); continue; }

      para.push(t);
    }
    flushAll();

    const compact = [];
    const standalone = text => /^\*\*.+\*\*$/.test(text) || /^「.+」$/.test(text) || /^『.+』$/.test(text);
    for (const b of blocks) {
      const prev = compact[compact.length - 1];
      if (
        b.type === 'p' && prev?.type === 'p' &&
        !standalone(prev.text) && !standalone(b.text) &&
        prev.text.length < 170 && (prev.text.length + b.text.length) <= 280
      ) {
        prev.text += b.text;
      } else {
        compact.push({...b});
      }
    }

    const html = compact.map(b => {
      if (b.type === 'p') return `<p>${inline(b.text)}</p>`;
      if (b.type === 'h2') return `<h2>${inline(b.text)}</h2>`;
      if (b.type === 'h3') return `<h3>${inline(b.text)}</h3>`;
      if (b.type === 'quote') return `<blockquote>${inline(b.text)}</blockquote>`;
      if (b.type === 'hr') return '<hr>';
      if (b.type === 'ul' || b.type === 'ol') {
        return `<${b.type}>${b.items.map(v => `<li>${inline(v)}</li>`).join('')}</${b.type}>`;
      }
      return '';
    }).join('');

    if (/<br\b/i.test(html)) throw new Error('br detected');
    return {
      html,
      bigCount: compact.filter(b => b.type === 'h2').length,
      smallCount: compact.filter(b => b.type === 'h3').length
    };
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 160 && r.height > 80 && s.display !== 'none' && s.visibility !== 'hidden';
  }

  function findEditor() {
    const pm = [...document.querySelectorAll('.ProseMirror[contenteditable="true"]')].filter(visible);
    if (pm.length) return pm.sort((a,b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
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
    try {
      localStorage.setItem(backupKey(), JSON.stringify({html:editor.innerHTML, time:Date.now(), url:location.href}));
    } catch {}
  }
  function readBackup() {
    try { return JSON.parse(localStorage.getItem(backupKey()) || 'null'); }
    catch { return null; }
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

  async function hardClear(editor) {
    saveBackup(editor);
    selectEditor(editor);
    try { document.execCommand('delete', false); } catch {}
    fireInput(editor, 'deleteContentBackward');
    await sleep(180);

    if ((editor.innerText || '').trim()) {
      editor.innerHTML = '';
      fireInput(editor, 'deleteContentBackward');
      await sleep(140);
    }
    return !(editor.innerText || '').trim();
  }

  async function insertHtml(editor, html) {
    selectEditor(editor);
    let ok = false;
    try { ok = document.execCommand('insertHTML', false, html); } catch {}
    if (!ok || !(editor.innerText || '').trim()) editor.innerHTML = html;
    fireInput(editor, 'insertFromPaste');
  }

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.cssText = 'position:fixed!important;right:12px!important;bottom:78px!important;z-index:2147483647!important;font-family:system-ui,-apple-system,sans-serif!important;pointer-events:auto!important;';
  root.innerHTML = `
    <button id="ponFab" type="button" style="border:0;border-radius:999px;padding:10px 13px;background:#0b2138;color:#fff;font-weight:900;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.35);outline:1px solid #39e7d2;touch-action:manipulation">📄 ポン出し</button>
    <div id="ponPanel" style="display:none;position:absolute;right:0;bottom:52px;width:min(90vw,430px);max-height:72vh;overflow:auto;background:#07182a;color:#fff;border:1px solid #39e7d2;border-radius:13px;padding:10px;box-shadow:0 12px 32px rgba(0,0,0,.45)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
        <b style="flex:1;font-size:14px">📄 v32.1 コピペ → 整えてポン出し</b>
        <button id="ponClose" type="button" style="border:0;background:#17314b;color:#fff;border-radius:7px;padding:5px 8px">✕</button>
      </div>
      <div style="font-size:11px;line-height:1.45;color:#c8d9e6;margin-bottom:7px">本文をそのままコピペ。# / ◆ = 大見出し、## / ◇ = 小見出し。note標準サイズで入り、目次にも拾われます。本文は通常サイズ。brは作りません。挿絵は触りません。</div>
      <textarea id="ponSrc" rows="13" placeholder="ここに本文をコピペ" style="display:block;width:100%;min-height:250px;resize:vertical;box-sizing:border-box;border:2px solid #39e7d2;border-radius:9px;padding:10px;background:#fff;color:#111;font:15px/1.5 system-ui;caret-color:#111;user-select:text;-webkit-user-select:text"></textarea>
      <button id="ponGo" type="button" style="display:block;width:100%;margin-top:8px;border:0;border-radius:9px;padding:12px;background:#39e7d2;color:#04202a;font-weight:900;font-size:14px">🚀 整えてポン出し</button>
      <button id="ponUndo" type="button" style="display:block;width:100%;margin-top:6px;border:0;border-radius:9px;padding:9px;background:#5a2841;color:#fff;font-weight:800;font-size:12px">↩️ 前の本文に戻す</button>
      <div id="ponStatus" style="min-height:1.3em;margin-top:7px;color:#9ddbd6;font-size:11px;white-space:pre-wrap"></div>
    </div>`;
  document.body.appendChild(root);

  const fab = root.querySelector('#ponFab');
  const panel = root.querySelector('#ponPanel');
  const src = root.querySelector('#ponSrc');
  const status = root.querySelector('#ponStatus');
  const show = m => { status.textContent = m; };

  fab.addEventListener('click', () => {
    panel.style.display = 'block';
    fab.style.display = 'none';
    setTimeout(() => src.focus(), 60);
  });
  root.querySelector('#ponClose').addEventListener('click', () => {
    panel.style.display = 'none';
    fab.style.display = 'block';
  });

  root.querySelector('#ponGo').addEventListener('click', async () => {
    if (!src.value.trim()) return show('本文をコピペしてから押してね');
    const editor = await waitEditor();
    if (!editor) return show('❌ note本文エディタが見つからない');

    let converted;
    try { converted = sourceToHtml(src.value); }
    catch { return show('❌ 整形に失敗しました'); }

    show('① 旧本文を全消し中…');
    const empty = await hardClear(editor);
    if (!empty) return show('❌ 全消しできなかったので貼付を中止');

    show('② 文字サイズ・見出し・改行を整えて貼付中…');
    await insertHtml(editor, converted.html);

    const actualBig = editor.querySelectorAll('h2').length;
    const actualSmall = editor.querySelectorAll('h3').length;
    if (converted.bigCount + converted.smallCount > 0 && actualBig + actualSmall === 0) {
      return show('⚠️ 本文は貼れたけど、note側で見出し化できていません。保存せず教えてください。');
    }

    show(`✅ 完了｜大見出し ${actualBig} / 小見出し ${actualSmall}｜目次対応`);
    setTimeout(() => root.remove(), 1300);
  });

  root.querySelector('#ponUndo').addEventListener('click', async () => {
    const editor = await waitEditor();
    if (!editor) return show('❌ note本文エディタが見つからない');
    const b = readBackup();
    if (!b?.html) return show('戻せる本文がありません');
    selectEditor(editor);
    editor.innerHTML = b.html;
    fireInput(editor, 'insertFromPaste');
    show('↩️ 前の本文に戻しました');
  });
})();
