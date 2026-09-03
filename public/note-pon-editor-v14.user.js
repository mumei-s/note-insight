// ==UserScript==
// @name         note ポン出し v14｜見出し・区切り線・noteカード完全対応
// @namespace    https://github.com/mumei-s/note-insight
// @version      14.0.0
// @description  既存本文を残して追記。#大見出し、##小見出し、---区切り線、note URLはnote正規カードへ変換。全消しは別ボタン。小型・移動・最小化対応。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v14.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v14.user.js
// ==/UserScript==

(() => {
  'use strict';
  if (window.__MUMEI_PON_V14__) return;
  window.__MUMEI_PON_V14__ = true;

  const ROOT_ID = '__mumei_pon_v14_root__';
  const BACKUP_PREFIX = 'mumei-note-pon-v14-backup:';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let noteUrlCommand = null;
  let savedInsertPos = null;

  [
    '__mumei_pon_v132_root__','__mumei_pon_v131_root__','__mumei_pon_v13_root__',
    '__mumei_pon_v12_root__','__mumei_pon_v11_root__','__mumei_pon_v10_root__',
    '__mumei_pon_v9_editor__','__mumei_pon_v8_editor__','__mumei_pon_v7_editor__','__mumei_pon_v6_editor__'
  ].forEach(id => document.getElementById(id)?.remove());

  function editorDom() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') ||
      document.querySelector('.ProseMirror');
  }

  function looksLikeView(value) {
    try {
      return Boolean(value && typeof value === 'object' && value.state?.doc &&
        value.state?.schema && typeof value.dispatch === 'function' &&
        value.dom && typeof value.posAtDOM === 'function');
    } catch { return false; }
  }

  function findView() {
    const root = editorDom();
    if (!root) return null;
    const seeds = [];
    let node = root;
    for (let i = 0; i < 7 && node; i += 1, node = node.parentElement) seeds.push(node);
    const queue = seeds.map(v => [v, 0]);
    const seen = new Set();
    let steps = 0;
    while (queue.length && steps < 14000) {
      steps += 1;
      const [value, depth] = queue.shift();
      if (!value || (typeof value !== 'object' && typeof value !== 'function')) continue;
      if (seen.has(value)) continue;
      seen.add(value);
      if (looksLikeView(value)) return value;
      if (depth >= 5) continue;
      let keys = [];
      try { keys = Object.getOwnPropertyNames(value); } catch { continue; }
      for (const key of keys) {
        if (['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(key)) continue;
        let next;
        try { next = value[key]; } catch { continue; }
        if (!next || (typeof next !== 'object' && typeof next !== 'function')) continue;
        if (!seen.has(next)) queue.push([next, depth + 1]);
      }
    }
    return null;
  }

  function webpackRequire() {
    const chunks = window.webpackChunk_N_E;
    if (!chunks || typeof chunks.push !== 'function') return null;
    let require = null;
    const chunkId = 940000000 + Math.floor(Math.random() * 50000000);
    try {
      chunks.push([[chunkId], {}, runtimeRequire => { require = runtimeRequire; }]);
    } catch {}
    return require;
  }

  function noteUrlCommandFactory() {
    if (typeof noteUrlCommand === 'function') return noteUrlCommand;
    const require = webpackRequire();
    if (!require) throw new Error('note内部処理を取得できません');
    let module;
    try { module = require(94928); } catch {}
    let candidate = typeof module?.fjT === 'function' ? module.fjT : null;
    const looksRight = value => {
      if (typeof value !== 'function') return false;
      let source = '';
      try { source = Function.prototype.toString.call(value); } catch {}
      return source.includes('state.selection') && source.includes('nodeBefore') &&
        source.includes('replaceRangeWith') && source.includes('.then');
    };
    if (!looksRight(candidate)) {
      const loaded = Object.values(require.c || {}).flatMap(entry => {
        const ex = entry?.exports;
        if (!ex) return [];
        if (typeof ex === 'function') return [ex];
        try { return Object.values(ex); } catch { return []; }
      });
      candidate = loaded.find(looksRight) || null;
    }
    if (typeof candidate !== 'function') throw new Error('note正規URLコマンドが見つかりません');
    noteUrlCommand = candidate;
    return noteUrlCommand;
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

  function plainInline(text) {
    return String(text || '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .trim();
  }

  function parseSource(src) {
    const lines = cleanSource(src).split('\n');
    const tokens = [];
    let para = [];
    const flush = () => {
      const text = para.map(v => v.trim()).filter(Boolean).join('');
      if (text) tokens.push({type:'paragraph', text: plainInline(text)});
      para = [];
    };
    for (const raw of lines) {
      const t = raw.trim();
      if (!t) { flush(); continue; }
      if (/^-{3,}$/.test(t)) { flush(); tokens.push({type:'hr'}); continue; }
      let m = t.match(/^#\s+(.+)$/);
      if (m) { flush(); tokens.push({type:'heading', level:2, text:plainInline(m[1])}); continue; }
      m = t.match(/^##\s+(.+)$/) || t.match(/^###\s+(.+)$/);
      if (m) { flush(); tokens.push({type:'heading', level:3, text:plainInline(m[1])}); continue; }
      if (/^https?:\/\/note\.com\/[^\s]+$/i.test(t)) { flush(); tokens.push({type:'card', url:t}); continue; }
      const bullet = t.match(/^[-*・]\s*(.+)$/);
      if (bullet) { flush(); tokens.push({type:'paragraph', text:'・' + plainInline(bullet[1])}); continue; }
      para.push(t);
    }
    flush();
    return tokens;
  }

  function textNode(schema, text) {
    return text ? schema.text(text) : null;
  }

  function makeNode(schema, token) {
    if (token.type === 'heading') {
      const heading = schema.nodes.heading;
      if (!heading) throw new Error('note見出しノードが見つかりません');
      return heading.create({level: token.level}, textNode(schema, token.text));
    }
    if (token.type === 'hr') {
      const type = schema.nodes.horizontal_rule || schema.nodes.horizontalRule || schema.nodes.hr;
      if (!type) throw new Error('note区切り線ノードが見つかりません');
      return type.create();
    }
    const paragraph = schema.nodes.paragraph;
    if (!paragraph) throw new Error('paragraphノードが見つかりません');
    const text = token.type === 'card' ? token.url : token.text;
    return paragraph.create(null, textNode(schema, text));
  }

  function backupKey() { return BACKUP_PREFIX + location.pathname; }
  function saveBackup(view) {
    try {
      localStorage.setItem(backupKey(), JSON.stringify({doc:view.state.doc.toJSON(), time:Date.now()}));
    } catch {}
  }

  function restoreBackup(view) {
    let data;
    try { data = JSON.parse(localStorage.getItem(backupKey()) || 'null'); } catch { data = null; }
    if (!data?.doc) return false;
    try {
      const doc = view.state.schema.nodeFromJSON(data.doc);
      const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
      view.dispatch(tr);
      return true;
    } catch { return false; }
  }

  function insertTokens(view, tokens, replaceAll = false) {
    saveBackup(view);
    let tr = view.state.tr;
    let start;
    if (replaceAll) {
      tr = tr.delete(0, tr.doc.content.size);
      start = 0;
    } else {
      const max = tr.doc.content.size;
      start = Number.isInteger(savedInsertPos) ? Math.max(0, Math.min(savedInsertPos, max)) : max;
      try {
        const $p = tr.doc.resolve(start);
        if ($p.parent.isTextblock) start = $p.after($p.depth);
      } catch { start = max; }
    }
    let pos = start;
    const cardAnchors = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      const node = makeNode(tr.doc.type.schema, token);
      tr = tr.insert(pos, node);
      if (token.type === 'card') cardAnchors.push({pos, url:token.url});
      pos += node.nodeSize;
    }
    view.dispatch(tr);
    savedInsertPos = null;
    return cardAnchors;
  }

  function setCursorAfterNode(view, pos) {
    const node = view.state.doc.nodeAt(pos);
    if (!node) return false;
    const end = Math.max(1, Math.min(view.state.doc.content.size, pos + node.nodeSize - 1));
    try {
      const Sel = view.state.selection.constructor;
      view.dispatch(view.state.tr.setSelection(Sel.near(view.state.doc.resolve(end), -1)));
      view.focus();
      return true;
    } catch { return false; }
  }

  async function convertCards(view, anchors, show) {
    if (!anchors.length) return {ok:0, failed:0};
    let ok = 0, failed = 0;
    const factory = noteUrlCommandFactory();
    const ordered = [...anchors].sort((a,b) => b.pos - a.pos);
    for (let i = 0; i < ordered.length; i += 1) {
      const item = ordered[i];
      show(`カード化 ${i + 1}/${ordered.length}`);
      const node = view.state.doc.nodeAt(item.pos);
      if (!node || (node.textContent || '').trim() !== item.url) { failed += 1; continue; }
      if (!setCursorAfterNode(view, item.pos)) { failed += 1; continue; }
      try {
        const command = factory(item.url);
        const handled = command(view.state, tr => view.dispatch(tr), view);
        if (!handled) { failed += 1; continue; }
        ok += 1;
        await sleep(650);
      } catch { failed += 1; }
    }
    return {ok, failed};
  }

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.cssText = 'position:fixed!important;right:8px!important;bottom:72px!important;z-index:2147483647!important;font-family:system-ui,-apple-system,sans-serif!important;pointer-events:auto!important;';
  root.innerHTML = `
    <button id="ponFab14" type="button" style="border:0;border-radius:999px;padding:7px 10px;background:#0b2138;color:#fff;font-weight:900;font-size:11px;box-shadow:0 4px 14px rgba(0,0,0,.3);outline:1px solid #39e7d2">📄 ポン</button>
    <div id="ponPanel14" style="display:none;position:fixed;right:6px;bottom:108px;width:min(72vw,320px);max-height:42vh;overflow:auto;background:#07182a;color:#fff;border:1px solid #39e7d2;border-radius:10px;padding:7px;box-shadow:0 8px 24px rgba(0,0,0,.4)">
      <div id="ponDrag14" style="display:flex;align-items:center;gap:5px;margin:-1px -1px 5px;padding:4px 3px;cursor:move;touch-action:none;user-select:none;border-bottom:1px solid #28445c">
        <b style="flex:1;font-size:12px">↔️ ポン出し v14</b>
        <button id="ponMin14" type="button" style="border:0;background:#17314b;color:#fff;border-radius:6px;padding:3px 6px;font-size:11px">＿</button>
        <button id="ponClose14" type="button" style="border:0;background:#17314b;color:#fff;border-radius:6px;padding:3px 6px;font-size:11px">✕</button>
      </div>
      <div style="font-size:9px;line-height:1.3;color:#c8d9e6;margin-bottom:4px"># 大見出し / ## 小見出し / --- 区切り線 / note URL＝標準カード。通常は既存本文を残して追記。</div>
      <textarea id="ponSrc14" rows="6" placeholder="原稿を貼り付け" style="display:block;width:100%;height:112px;resize:vertical;box-sizing:border-box;border:1px solid #39e7d2;border-radius:7px;padding:7px;background:#fff;color:#111;font:13px/1.35 system-ui;caret-color:#111;user-select:text;-webkit-user-select:text"></textarea>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:5px">
        <button id="ponClip14" type="button" style="border:0;border-radius:7px;padding:7px 4px;background:#17314b;color:#fff;font-weight:800;font-size:10px">📋 読込</button>
        <button id="ponAdd14" type="button" style="border:0;border-radius:7px;padding:7px 4px;background:#39e7d2;color:#04202a;font-weight:900;font-size:10px">➕ 追記＋カード</button>
        <button id="ponUndo14" type="button" style="border:0;border-radius:7px;padding:7px 4px;background:#5a2841;color:#fff;font-weight:800;font-size:10px">↩️ 戻す</button>
        <button id="ponReplace14" type="button" style="border:1px solid #ff7a7a;border-radius:7px;padding:7px 4px;background:#521b25;color:#fff;font-weight:900;font-size:10px">⚠️ 全消し→作成</button>
      </div>
      <div id="ponStatus14" style="min-height:1.1em;margin-top:4px;color:#9ddbd6;font-size:9px;line-height:1.25;white-space:pre-wrap"></div>
    </div>`;
  document.body.appendChild(root);

  const fab = root.querySelector('#ponFab14');
  const panel = root.querySelector('#ponPanel14');
  const drag = root.querySelector('#ponDrag14');
  const src = root.querySelector('#ponSrc14');
  const status = root.querySelector('#ponStatus14');
  const show = text => { status.textContent = text; };
  const minimize = () => { panel.style.display = 'none'; fab.style.display = 'block'; };

  fab.addEventListener('click', () => {
    const view = findView();
    if (view && view.state.selection.empty) savedInsertPos = view.state.selection.from;
    else savedInsertPos = null;
    panel.style.display = 'block';
    fab.style.display = 'none';
  });
  root.querySelector('#ponMin14').addEventListener('click', minimize);
  root.querySelector('#ponClose14').addEventListener('click', () => root.remove());

  let moving = null;
  drag.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const r = panel.getBoundingClientRect();
    moving = {x:e.clientX,y:e.clientY,left:r.left,top:r.top};
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

  root.querySelector('#ponClip14').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return show('クリップボードが空');
      src.value = text; show('✅ 読込');
    } catch { show('白い欄を長押し→貼付でOK'); }
  });

  async function run(replaceAll) {
    if (!src.value.trim()) return show('原稿を貼ってね');
    const view = findView();
    if (!view) return show('❌ note EditorViewが見つからない');
    let tokens;
    try { tokens = parseSource(src.value); } catch (e) { return show(`❌ ${e.message}`); }
    if (replaceAll) {
      if (!confirm('既存本文・既存カードをすべて消して作り直します。実行しますか？')) return show('全消し中止');
      if (!confirm('最終確認：本当に全消ししますか？')) return show('全消し中止');
    }
    try {
      show('見出し・本文・区切り線を作成中…');
      const anchors = insertTokens(view, tokens, replaceAll);
      const result = await convertCards(view, anchors, show);
      show(`✅ 完了｜カード ${result.ok}/${anchors.length}${result.failed ? `（失敗${result.failed}はURLのまま）` : ''}`);
      setTimeout(minimize, 1100);
    } catch (e) { show(`❌ ${e?.message || e}`); }
  }

  root.querySelector('#ponAdd14').addEventListener('click', () => run(false));
  root.querySelector('#ponReplace14').addEventListener('click', () => run(true));
  root.querySelector('#ponUndo14').addEventListener('click', () => {
    const view = findView();
    if (!view) return show('❌ note EditorViewが見つからない');
    show(restoreBackup(view) ? '↩️ 直前の本文へ戻した' : '戻せるバックアップなし');
  });
})();
