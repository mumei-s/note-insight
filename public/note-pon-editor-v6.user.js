// ==UserScript==
// @name         note ポン出し v32.4｜note標準見出し貼付
// @namespace    https://github.com/mumei-s/note-insight
// @version      32.4.0
// @description  原稿コピペ→整えてポン出し。小型UI。note標準の貼付処理を使って大見出し・小見出しを保持し、目次対応。見出し化失敗時は元本文へ自動復元。brなし、挿絵は触らない。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v6.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v6.user.js
// ==/UserScript==

(() => {
  'use strict';

  const ROOT_ID = '__mumei_pon_v32_4_root__';
  const BACKUP_PREFIX = 'mumei-note-pon-v32-backup:';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  [
    '__mumei_pon_v32_3_root__','__mumei_pon_v32_2_root__','__mumei_pon_v32_1_root__','__mumei_pon_v32_root__','__mumei_pon_v31_root__',
    '__mumei_pon_v14_1_root__','__mumei_pon_v14_root__','__mumei_pon_v13_root__','__mumei_pon_v12_root__',
    '__mumei_pon_v11_root__','__mumei_pon_v10_root__','__mumei_pon_v9_editor__','__mumei_pon_v8_editor__','__mumei_pon_v7_editor__','__mumei_pon_v6_editor__'
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

  function sourceToBlocks(src) {
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
      if (/^-{3,}$/.test(t) || /^_{3,}$/.test(t)) { flushAll(); blocks.push({type:'hr'}); continue; }

      const big = t.match(/^#\s+(.+)$/) || t.match(/^◆\s*(.+)$/);
      const small = t.match(/^##\s+(.+)$/) || t.match(/^###\s+(.+)$/) || t.match(/^◇\s*(.+)$/);
      if (big) { flushAll(); blocks.push({type:'h2', text:big[1]}); continue; }
      if (small) { flushAll(); blocks.push({type:'h3', text:small[1]}); continue; }

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
      if (b.type === 'p' && prev?.type === 'p' && !standalone(prev.text) && !standalone(b.text) && prev.text.length < 170 && prev.text.length + b.text.length <= 280) {
        prev.text += b.text;
      } else compact.push({...b});
    }
    return compact;
  }

  function blocksToHtml(blocks) {
    return blocks.map(b => {
      if (b.type === 'p') return `<p>${inline(b.text)}</p>`;
      if (b.type === 'h2') return `<h2>${inline(b.text)}</h2>`;
      if (b.type === 'h3') return `<h3>${inline(b.text)}</h3>`;
      if (b.type === 'quote') return `<blockquote>${inline(b.text)}</blockquote>`;
      if (b.type === 'hr') return '<hr>';
      if (b.type === 'ul' || b.type === 'ol') return `<${b.type}>${b.items.map(v => `<li>${inline(v)}</li>`).join('')}</${b.type}>`;
      return '';
    }).join('');
  }

  function blocksToPlain(blocks) {
    return blocks.map(b => {
      if (b.type === 'p' || b.type === 'h2' || b.type === 'h3' || b.type === 'quote') return b.text;
      if (b.type === 'hr') return '---';
      if (b.type === 'ul') return b.items.map(v => `・${v}`).join('\n');
      if (b.type === 'ol') return b.items.map((v,i) => `${i+1}. ${v}`).join('\n');
      return '';
    }).join('\n\n');
  }

  function convert(src) {
    const blocks = sourceToBlocks(src);
    const html = blocksToHtml(blocks);
    if (/<br\b/i.test(html)) throw new Error('br detected');
    return {
      html,
      plain: blocksToPlain(blocks),
      bigCount: blocks.filter(b => b.type === 'h2').length,
      smallCount: blocks.filter(b => b.type === 'h3').length
    };
  }

  function attrs(el) {
    return [el?.id, el?.className, el?.getAttribute?.('aria-label'), el?.getAttribute?.('placeholder'), el?.getAttribute?.('data-placeholder'), el?.getAttribute?.('name')]
      .filter(Boolean).join(' ').toLowerCase();
  }
  function looksLikeTitle(el) {
    if (!el) return true;
    const a = attrs(el);
    const txt = (el.innerText || el.textContent || '').trim();
    return /title|headline|記事タイトル|タイトル/.test(a) || (el.tagName === 'H1' && txt.length < 180);
  }
  function editableSelfOrAncestor(node) {
    let el = node?.nodeType === 1 ? node : node?.parentElement;
    for (let i = 0; el && i < 12; i++, el = el.parentElement) {
      if (el.id === ROOT_ID || el.closest?.(`#${ROOT_ID}`)) return null;
      const ce = el.getAttribute?.('contenteditable');
      if ((el.classList?.contains('ProseMirror') || ce === 'true' || ce === 'plaintext-only' || el.getAttribute?.('role') === 'textbox') && !looksLikeTitle(el)) return el;
    }
    return null;
  }

  let lastEditor = null;
  let pendingConverted = null;
  let picking = false;

  function rememberFromNode(node) {
    const e = editableSelfOrAncestor(node);
    if (e) lastEditor = e;
    return e;
  }
  document.addEventListener('focusin', e => rememberFromNode(e.target), true);
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel?.rangeCount) rememberFromNode(sel.getRangeAt(0).commonAncestorContainer);
  }, true);

  function visible(el) {
    if (!el?.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    let s;
    try { s = el.ownerDocument.defaultView.getComputedStyle(el); } catch { return false; }
    return r.width > 80 && r.height > 8 && s.display !== 'none' && s.visibility !== 'hidden';
  }
  function score(el) {
    if (!el || !visible(el) || looksLikeTitle(el) || el.closest?.(`#${ROOT_ID}`)) return -1e9;
    const r = el.getBoundingClientRect();
    const a = attrs(el);
    let n = 0;
    if (el.classList?.contains('ProseMirror')) n += 10000;
    if (el.isContentEditable || ['true','plaintext-only'].includes(el.getAttribute?.('contenteditable'))) n += 4000;
    if (el.getAttribute?.('role') === 'textbox') n += 1200;
    if (/本文|body|content|editor|prosemirror/.test(a)) n += 1800;
    if (/本文を書|本文を入力|記事を書く/.test(a)) n += 2500;
    if (el.querySelector?.('p,h2,h3,blockquote,ul,ol')) n += 900;
    n += Math.min(r.width, 900) + Math.min(r.height, 900) * 1.2;
    return n;
  }
  function scanDoc(doc) {
    const list = [];
    const sels = ['.ProseMirror','[contenteditable]','[role="textbox"]','[data-placeholder]','[aria-label]'];
    for (const sel of sels) {
      try { doc.querySelectorAll(sel).forEach(el => list.push(el)); } catch {}
    }
    for (const f of [...(doc.querySelectorAll?.('iframe') || [])]) {
      try { if (f.contentDocument) list.push(...scanDoc(f.contentDocument)); } catch {}
    }
    return list;
  }
  function findEditor() {
    if (lastEditor?.isConnected && visible(lastEditor) && !looksLikeTitle(lastEditor)) return lastEditor;
    const candidates = [...new Set(scanDoc(document))].sort((a,b) => score(b)-score(a));
    const best = candidates[0];
    if (best && score(best) > 1000) { lastEditor = best; return best; }
    return null;
  }

  function backupKey() { return BACKUP_PREFIX + location.pathname; }
  function saveBackup(editor) {
    try { localStorage.setItem(backupKey(), JSON.stringify({html:editor.innerHTML,time:Date.now(),url:location.href})); } catch {}
  }
  function readBackup() {
    try { return JSON.parse(localStorage.getItem(backupKey()) || 'null'); } catch { return null; }
  }
  function fireInput(editor, type='insertText') {
    const win = editor.ownerDocument?.defaultView || window;
    try { editor.dispatchEvent(new win.InputEvent('input',{bubbles:true,inputType:type,data:null})); }
    catch { editor.dispatchEvent(new win.Event('input',{bubbles:true})); }
    editor.dispatchEvent(new win.Event('change',{bubbles:true}));
  }
  function selectAll(editor) {
    const doc = editor.ownerDocument || document;
    const win = doc.defaultView || window;
    const range = doc.createRange();
    range.selectNodeContents(editor);
    const sel = win.getSelection();
    sel.removeAllRanges(); sel.addRange(range); editor.focus();
  }
  async function clearEditor(editor) {
    const doc = editor.ownerDocument || document;
    selectAll(editor);
    try { doc.execCommand('delete', false); } catch {}
    fireInput(editor,'deleteContentBackward');
    await sleep(150);
    if ((editor.innerText || editor.textContent || '').trim()) {
      editor.innerHTML = '';
      fireInput(editor,'deleteContentBackward');
      await sleep(100);
    }
  }

  function headingCounts(editor) {
    return {
      big: editor.querySelectorAll?.('h2').length || 0,
      small: editor.querySelectorAll?.('h3').length || 0
    };
  }

  async function pasteThroughNote(editor, converted) {
    const doc = editor.ownerDocument || document;
    const win = doc.defaultView || window;
    selectAll(editor);

    try {
      const dt = new win.DataTransfer();
      dt.setData('text/html', converted.html);
      dt.setData('text/plain', converted.plain);
      const ev = new win.ClipboardEvent('paste', {bubbles:true,cancelable:true,clipboardData:dt});
      editor.dispatchEvent(ev);
      await sleep(350);
      const c = headingCounts(editor);
      const hasText = (editor.innerText || editor.textContent || '').trim().length > 0;
      if (hasText && c.big >= converted.bigCount && c.small >= converted.smallCount) return true;
    } catch {}

    // fallback: execCommand insertHTML
    await clearEditor(editor);
    selectAll(editor);
    let ok = false;
    try { ok = doc.execCommand('insertHTML', false, converted.html); } catch {}
    if (!ok || !(editor.innerText || editor.textContent || '').trim()) editor.innerHTML = converted.html;
    fireInput(editor,'insertFromPaste');
    await sleep(250);
    const c = headingCounts(editor);
    return c.big >= converted.bigCount && c.small >= converted.smallCount;
  }

  async function replaceEditor(editor, converted) {
    saveBackup(editor);
    await clearEditor(editor);
    const ok = await pasteThroughNote(editor, converted);
    if (ok) return true;

    const b = readBackup();
    if (b?.html) {
      await clearEditor(editor);
      editor.innerHTML = b.html;
      fireInput(editor,'insertFromPaste');
    }
    return false;
  }

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.cssText = 'position:fixed!important;right:8px!important;bottom:72px!important;z-index:2147483647!important;font-family:system-ui,-apple-system,sans-serif!important;pointer-events:auto!important;';
  root.innerHTML = `
    <button id="ponFab" type="button" style="border:0;border-radius:999px;padding:7px 10px;background:#0b2138;color:#fff;font-weight:900;font-size:11px;box-shadow:0 5px 15px rgba(0,0,0,.32);outline:1px solid #39e7d2">📄 ポン</button>
    <div id="ponPanel" style="display:none;position:absolute;right:0;bottom:42px;width:min(76vw,300px);max-height:38vh;overflow:auto;background:#07182a;color:#fff;border:1px solid #39e7d2;border-radius:10px;padding:7px;box-shadow:0 10px 28px rgba(0,0,0,.42)">
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px"><b style="flex:1;font-size:12px">📄 ポン出し v32.4</b><button id="ponClose" type="button" style="border:0;background:#17314b;color:#fff;border-radius:6px;padding:3px 6px;font-size:11px">✕</button></div>
      <div style="font-size:9px;line-height:1.3;color:#c8d9e6;margin-bottom:4px"># / ◆＝大見出し　## / ◇＝小見出し</div>
      <textarea id="ponSrc" placeholder="本文をコピペ" style="display:block;width:100%;height:88px;resize:vertical;box-sizing:border-box;border:1px solid #39e7d2;border-radius:7px;padding:6px;background:#fff;color:#111;font:13px/1.35 system-ui;caret-color:#111"></textarea>
      <button id="ponGo" type="button" style="display:block;width:100%;margin-top:5px;border:0;border-radius:7px;padding:8px;background:#39e7d2;color:#04202a;font-weight:900;font-size:11px">🚀 整えてポン出し</button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px"><button id="ponUndo" type="button" style="border:0;border-radius:7px;padding:6px;background:#5a2841;color:#fff;font-weight:800;font-size:10px">↩️ 戻す</button><button id="ponMin" type="button" style="border:0;border-radius:7px;padding:6px;background:#17314b;color:#fff;font-weight:800;font-size:10px">＿ しまう</button></div>
      <div id="ponStatus" style="min-height:1.2em;margin-top:4px;color:#9ddbd6;font-size:9px;line-height:1.25;white-space:pre-wrap"></div>
    </div>
    <div id="ponPick" style="display:none;background:#07182a;color:#fff;border:1px solid #39e7d2;border-radius:8px;padding:7px 9px;font-weight:800;font-size:11px;box-shadow:0 6px 18px rgba(0,0,0,.4)">👆 noteの本文欄を1回タップ</div>`;
  document.body.appendChild(root);

  const fab = root.querySelector('#ponFab');
  const panel = root.querySelector('#ponPanel');
  const src = root.querySelector('#ponSrc');
  const status = root.querySelector('#ponStatus');
  const pick = root.querySelector('#ponPick');
  const show = m => status.textContent = m;

  fab.onclick = () => { panel.style.display='block'; fab.style.display='none'; setTimeout(()=>src.focus(),40); };
  root.querySelector('#ponClose').onclick = () => root.remove();
  root.querySelector('#ponMin').onclick = () => { panel.style.display='none'; fab.style.display='block'; };

  async function finish(editor, converted) {
    picking = false;
    pick.style.display='none';
    show('note標準形式で貼付中…');
    const ok = await replaceEditor(editor, converted);
    if (!ok) return show('❌ 見出し化できなかったため元本文へ戻しました');

    const c = headingCounts(editor);
    show(`✅ 完了｜大見出し ${c.big} / 小見出し ${c.small}｜目次対応`);
    setTimeout(() => root.remove(), 1600);
  }

  document.addEventListener('pointerdown', e => {
    if (!picking) return;
    if (e.target?.closest?.(`#${ROOT_ID}`)) return;
    const editor = rememberFromNode(e.target);
    if (!editor || !pendingConverted) return;
    e.preventDefault();
    e.stopPropagation();
    const converted = pendingConverted;
    pendingConverted = null;
    setTimeout(() => finish(editor, converted), 80);
  }, true);

  root.querySelector('#ponGo').onclick = async () => {
    if (!src.value.trim()) return show('本文をコピペしてね');
    let converted;
    try { converted = convert(src.value); }
    catch { return show('❌ 整形失敗'); }

    const editor = findEditor();
    if (editor) return finish(editor, converted);

    pendingConverted = converted;
    picking = true;
    panel.style.display='none';
    pick.style.display='block';
    show('本文欄を1回タップしてね');
  };

  root.querySelector('#ponUndo').onclick = async () => {
    const editor = findEditor();
    if (!editor) return show('本文欄を1回タップしてから戻して');
    const b = readBackup();
    if (!b?.html) return show('戻せる本文なし');
    await clearEditor(editor);
    editor.innerHTML = b.html;
    fireInput(editor,'insertFromPaste');
    show('↩️ 前の本文に戻しました');
  };
})();
