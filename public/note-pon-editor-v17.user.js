// ==UserScript==
// @name         note ポン出し v17.3｜本数別＋全カード＋収納対応
// @namespace    https://github.com/mumei-s/note-insight
// @version      17.3.0
// @description  共同マガジン一覧を投稿上限本数別に整理。マガジンURL＋マガジンカード、固定記事URL＋固定記事カードを自動生成。ツールは＿/✕で収納し📄ポンから再表示可能。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @connect      raw.githubusercontent.com
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v14.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v16.user.js
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v17.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v17.user.js
// ==/UserScript==

(() => {
  'use strict';
  if (window.__MUMEI_PON_V173_ADDON__) return;
  window.__MUMEI_PON_V173_ADDON__ = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let noteUrlCommand = null;

  function stripOldIntro(text) {
    const s = String(text || '');
    if (!s.startsWith('共同マガジンが増えすぎて')) return s;
    const marker = 'では一覧👇';
    const p = s.indexOf(marker);
    if (p < 0) return s;
    return s.slice(p + marker.length).replace(/^\s+/, '');
  }

  function addVisibleUrls(text) {
    const lines = stripOldIntro(text).split(/\r?\n/);
    const out = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (/^https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+$/i.test(line)) {
        const prev = out.length ? out[out.length - 1].trim() : '';
        if (prev !== `マガジンURL：${line}`) out.push(`マガジンURL：${line}`);
        out.push(line);
        continue;
      }
      if (/^https:\/\/note\.com\/[^/]+\/n\/n[a-z0-9]+$/i.test(line)) {
        const prev = out.length ? out[out.length - 1].trim() : '';
        if (prev !== `固定記事URL：${line}`) out.push(`固定記事URL：${line}`);
        out.push(line);
        continue;
      }
      out.push(raw);
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function looksLikeView(value) {
    try {
      return !!(value && typeof value === 'object' && value.state?.doc && value.state?.schema &&
        typeof value.dispatch === 'function' && value.dom && typeof value.posAtDOM === 'function');
    } catch { return false; }
  }

  function findView() {
    const root = document.querySelector('.ProseMirror[contenteditable="true"]') || document.querySelector('.ProseMirror');
    if (!root) return null;
    const queue = [];
    let node = root;
    for (let i = 0; i < 7 && node; i += 1, node = node.parentElement) queue.push([node, 0]);
    const seen = new Set();
    let steps = 0;
    while (queue.length && steps++ < 14000) {
      const [value, depth] = queue.shift();
      if (!value || (typeof value !== 'object' && typeof value !== 'function') || seen.has(value)) continue;
      seen.add(value);
      if (looksLikeView(value)) return value;
      if (depth >= 5) continue;
      let keys = [];
      try { keys = Object.getOwnPropertyNames(value); } catch { continue; }
      for (const key of keys) {
        if (['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(key)) continue;
        let next;
        try { next = value[key]; } catch { continue; }
        if (next && (typeof next === 'object' || typeof next === 'function') && !seen.has(next)) queue.push([next, depth + 1]);
      }
    }
    return null;
  }

  function webpackRequire() {
    const chunks = window.webpackChunk_N_E;
    if (!chunks || typeof chunks.push !== 'function') return null;
    let require = null;
    try {
      chunks.push([[970000000 + Math.floor(Math.random() * 20000000)], {}, r => { require = r; }]);
    } catch {}
    return require;
  }

  function cardFactory() {
    if (typeof noteUrlCommand === 'function') return noteUrlCommand;
    const require = webpackRequire();
    if (!require) return null;
    let module;
    try { module = require(94928); } catch {}
    const looksRight = value => {
      if (typeof value !== 'function') return false;
      let source = '';
      try { source = Function.prototype.toString.call(value); } catch {}
      return source.includes('state.selection') && source.includes('nodeBefore') && source.includes('replaceRangeWith') && source.includes('.then');
    };
    let candidate = typeof module?.fjT === 'function' && looksRight(module.fjT) ? module.fjT : null;
    if (!candidate) {
      const loaded = Object.values(require.c || {}).flatMap(entry => {
        const ex = entry?.exports;
        if (!ex) return [];
        if (typeof ex === 'function') return [ex];
        try { return Object.values(ex); } catch { return []; }
      });
      candidate = loaded.find(looksRight) || null;
    }
    noteUrlCommand = candidate;
    return candidate;
  }

  function setCursorAfter(view, pos) {
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

  function nakedMagazineRows(view) {
    const rows = [];
    view.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return true;
      const url = (node.textContent || '').trim();
      if (/^https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+$/i.test(url)) rows.push({pos, url});
      return true;
    });
    return rows.sort((a,b) => b.pos - a.pos);
  }

  async function forceMagazineCards(status) {
    const view = findView();
    const factory = cardFactory();
    if (!view || !factory) return;
    for (let pass = 0; pass < 3; pass += 1) {
      const rows = nakedMagazineRows(view);
      if (!rows.length) return;
      if (status) status.textContent = `マガジンカード再確認 ${rows.length}件`;
      for (const item of rows) {
        const node = view.state.doc.nodeAt(item.pos);
        if (!node || (node.textContent || '').trim() !== item.url || !setCursorAfter(view, item.pos)) continue;
        try {
          const command = factory(item.url);
          if (typeof command === 'function') command(view.state, tr => view.dispatch(tr), view);
        } catch {}
        await sleep(500);
      }
      await sleep(900);
    }
  }

  function install() {
    const root = document.getElementById('__mumei_pon_v14_root__');
    const button = document.getElementById('ponMags16');
    if (!root || !button) return setTimeout(install, 300);

    const src = root.querySelector('#ponSrc14');
    const add = root.querySelector('#ponAdd14');
    const head = root.querySelector('#ponDrag14 b');
    const status = root.querySelector('#ponStatus14');
    const panel = root.querySelector('#ponPanel14');
    const fab = root.querySelector('#ponFab14');
    const min = root.querySelector('#ponMin14');
    const close = root.querySelector('#ponClose14');
    if (!src || !add || !status || !panel || !fab) return setTimeout(install, 300);

    if (head) head.textContent = '↔️ ポン出し v17.3';
    button.textContent = '📚 本数別一覧＋全マガジン/固定カード';

    // ＿も✕も「ツールを消す」ではなく収納。小さい📄ポンから再表示できる。
    const stow = e => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
      panel.style.display = 'none';
      fab.style.display = 'block';
    };
    if (min && !min.dataset.v173) {
      min.dataset.v173 = '1';
      min.title = 'しまう';
      min.addEventListener('click', stow, true);
    }
    if (close && !close.dataset.v173) {
      close.dataset.v173 = '1';
      close.title = 'しまう';
      close.textContent = '▼';
      close.addEventListener('click', stow, true);
    }

    add.addEventListener('click', () => {
      if (!/#\s/.test(src.value) || !/https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+/i.test(src.value)) return;
      src.value = addVisibleUrls(src.value);
    }, true);

    const observer = new MutationObserver(() => {
      if (!/^✅ 完了/.test(status.textContent || '')) return;
      setTimeout(() => forceMagazineCards(status), 500);
    });
    observer.observe(status, {childList:true, subtree:true, characterData:true});
  }

  install();
})();
