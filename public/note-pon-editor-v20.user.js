// ==UserScript==
// @name         note URLポン v31.1｜URL行だけ自動カード化
// @namespace    https://github.com/mumei-s/note-insight
// @version      31.1.0
// @description  本文はユーザーが貼るだけ。本文中の「note URLだけの1行」だけを検出し、その行でnote本来のURLカード化処理を順番に実行する。文字・見出し・順番・本文には一切触れない。
// @author       無名S note
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v20.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v20.user.js
// ==/UserScript==

(() => {
  'use strict';
  if (window.__MUMEI_URL_PON_V311__) return;
  window.__MUMEI_URL_PON_V311__ = true;

  const BTN_ID = 'mumei-url-pon-v311-btn';
  const STATUS_ID = 'mumei-url-pon-v311-status';
  let busy = false;
  let viewCache = null;
  let noteUrlCommand = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function normalizeUrl(value) {
    try {
      const u = new URL(String(value || '').trim(), location.href);
      u.search = '';
      u.hash = '';
      return u.href;
    } catch (_) {
      return String(value || '').trim();
    }
  }

  function isStandaloneNoteUrl(value) {
    return /^https:\/\/note\.com\/[^\s]+$/i.test(String(value || '').trim());
  }

  function editor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') ||
      document.querySelector('.ProseMirror');
  }

  function looksLikeView(value) {
    try {
      return Boolean(value && typeof value === 'object' && value.state?.doc &&
        value.state?.schema && typeof value.dispatch === 'function' &&
        value.dom && typeof value.posAtDOM === 'function');
    } catch (_) {
      return false;
    }
  }

  function findView() {
    if (looksLikeView(viewCache) && viewCache.dom?.isConnected) return viewCache;
    const root = editor();
    if (!root) return null;
    const seen = new Set();
    const queue = [];
    let seed = root;
    for (let i = 0; i < 7 && seed; i += 1, seed = seed.parentElement) queue.push([seed, 0]);
    let steps = 0;
    while (queue.length && steps++ < 14000) {
      const [value, depth] = queue.shift();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      if (looksLikeView(value)) return (viewCache = value);
      if (depth >= 7) continue;
      let keys = [];
      try { keys = Object.getOwnPropertyNames(value); } catch (_) { continue; }
      for (const key of keys) {
        if (['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(key)) continue;
        let next;
        try { next = value[key]; } catch (_) { continue; }
        if (looksLikeView(next)) return (viewCache = next);
        if (next && (typeof next === 'object' || typeof next === 'function') &&
          next !== window && next !== document) queue.push([next, depth + 1]);
      }
    }
    return null;
  }

  function webpackRequire() {
    const chunks = window.webpackChunk_N_E;
    if (!chunks || typeof chunks.push !== 'function') return null;
    let req = null;
    try {
      chunks.push([[998000000 + Math.floor(Math.random() * 1000000)], {}, (runtimeRequire) => {
        req = runtimeRequire;
      }]);
    } catch (_) {}
    return req;
  }

  function noteUrlCommandFactory() {
    if (typeof noteUrlCommand === 'function') return noteUrlCommand;
    const req = webpackRequire();
    if (!req) throw new Error('note内部URL処理を取得できません');
    let mod;
    try { mod = req(94928); } catch (_) {}
    let candidate = typeof mod?.fjT === 'function' ? mod.fjT : null;
    const looksRight = (value) => {
      if (typeof value !== 'function') return false;
      let source = '';
      try { source = Function.prototype.toString.call(value); } catch (_) {}
      return source.includes('state.selection') && source.includes('nodeBefore') &&
        source.includes('replaceRangeWith') && source.includes('.then');
    };
    if (!looksRight(candidate)) {
      const loaded = Object.values(req.c || {}).flatMap((entry) => {
        const exp = entry?.exports;
        if (typeof exp === 'function') return [exp];
        return exp && typeof exp === 'object' ? Object.values(exp) : [];
      });
      candidate = loaded.find(looksRight) || null;
    }
    if (!looksRight(candidate)) throw new Error('note正規URLコマンドが見つかりません');
    noteUrlCommand = candidate;
    return candidate;
  }

  function rawUrlRows(view) {
    const out = [];
    view.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return;
      const raw = (node.textContent || '').trim();
      if (!isStandaloneNoteUrl(raw)) return;
      out.push({ node, pos, url: normalizeUrl(raw) });
    });
    return out.sort((a, b) => a.pos - b.pos);
  }

  function embedNodes(view) {
    const out = [];
    view.state.doc.descendants((node, pos) => {
      if (node.type?.name === 'embed') out.push({ node, pos });
    });
    return out;
  }

  function cardKey(hit) {
    return String(hit?.node?.attrs?.embeddedContentKey || '');
  }

  function cardUrl(hit) {
    return normalizeUrl(hit?.node?.attrs?.src || '');
  }

  function genuineCard(hit, url) {
    const key = cardKey(hit);
    const html = String(hit?.node?.attrs?.htmlForEmbed || '');
    return cardUrl(hit) === normalizeUrl(url) &&
      /^emb[a-z0-9]+$/i.test(key) && html.includes('note-embed');
  }

  function setCursorAtUrlEnd(view, row) {
    const Selection = view.state.selection.constructor;
    const pos = Math.max(1, Math.min(view.state.doc.content.size, row.pos + row.node.nodeSize - 1));
    const resolved = view.state.doc.resolve(pos);
    let selection = null;
    try {
      if (typeof Selection.create === 'function') selection = Selection.create(view.state.doc, pos);
    } catch (_) {}
    if (!selection) {
      try { selection = Selection.near(resolved, -1); } catch (_) {}
    }
    if (!selection) throw new Error('URL行へカーソルを置けません');
    view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
    view.focus();
  }

  function sameRawStillNear(view, url, originalPos) {
    return rawUrlRows(view).some((row) =>
      row.url === normalizeUrl(url) && Math.abs(row.pos - originalPos) <= 3);
  }

  async function waitConverted(view, url, beforeKeys, originalPos, timeout = 45000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const fresh = embedNodes(view).find((hit) => {
        const key = cardKey(hit);
        return key && !beforeKeys.has(key) && genuineCard(hit, url);
      });
      if (fresh && !sameRawStillNear(view, url, originalPos)) return fresh;
      await sleep(250);
    }
    return null;
  }

  async function convertOne(view, row) {
    const beforeKeys = new Set(embedNodes(view).map(cardKey).filter(Boolean));
    const originalPos = row.pos;
    setCursorAtUrlEnd(view, row);
    const command = noteUrlCommandFactory()(row.url);
    if (typeof command !== 'function') throw new Error('URLコマンド未生成');
    const handled = command(view.state, (tr) => view.dispatch(tr), view);
    if (!handled) throw new Error('noteがURLを処理しませんでした');
    const card = await waitConverted(view, row.url, beforeKeys, originalPos, 45000);
    if (!card) throw new Error('カード生成を確認できません');
    return card;
  }

  function status(text, bad = false) {
    const el = document.getElementById(STATUS_ID);
    if (!el) return;
    el.textContent = text;
    el.style.background = bad ? '#991b1b' : '#1f2937';
  }

  function updateButton() {
    if (busy) return;
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    const view = findView();
    const count = view ? rawUrlRows(view).length : 0;
    btn.textContent = count ? `🔗 URLだけ ${count}件 → カード化` : '🔗 URLだけの行をカード化';
    btn.disabled = count === 0;
    btn.style.opacity = count === 0 ? '.55' : '1';
  }

  async function run() {
    if (busy) return;
    const view = findView();
    if (!view) {
      status('❌ note編集本文を取得できません', true);
      return;
    }
    const initial = rawUrlRows(view).length;
    if (!initial) {
      status('URLだけの行は0件');
      return;
    }
    busy = true;
    const btn = document.getElementById(BTN_ID);
    if (btn) btn.disabled = true;
    try {
      noteUrlCommandFactory();
      let done = 0;
      while (true) {
        const rows = rawUrlRows(view);
        if (!rows.length) break;
        const row = rows[rows.length - 1];
        status(`🔗 ${done + 1}/${initial} カード化中…\n${row.url}`);
        await convertOne(view, row);
        done += 1;
        status(`✅ ${done}/${initial} 完了`);
        if (done < initial) await sleep(700);
      }
      status(`✅ URL ${done}/${initial}件を全部カード化`);
    } catch (error) {
      const left = rawUrlRows(view).length;
      status(`❌ 停止｜残り ${left}件\n${error?.message || String(error)}`, true);
    } finally {
      busy = false;
      if (btn) btn.disabled = false;
      updateButton();
    }
  }

  function mount() {
    if (!document.body) return;
    let statusEl = document.getElementById(STATUS_ID);
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = STATUS_ID;
      document.body.appendChild(statusEl);
    }
    Object.assign(statusEl.style, {
      position: 'fixed', right: '8px', bottom: '68px', zIndex: '2147483646',
      maxWidth: '320px', padding: '6px 8px', borderRadius: '8px',
      background: '#1f2937', color: '#fff', fontSize: '11px', lineHeight: '1.35',
      whiteSpace: 'pre-wrap', boxShadow: '0 3px 12px rgba(0,0,0,.25)',
      pointerEvents: 'none'
    });
    if (!statusEl.textContent) statusEl.textContent = '本文を貼ったら、URLだけの行を自動判別';

    let btn = document.getElementById(BTN_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = BTN_ID;
      btn.type = 'button';
      btn.addEventListener('click', run);
      document.body.appendChild(btn);
    }
    Object.assign(btn.style, {
      position: 'fixed', right: '8px', bottom: '18px', zIndex: '2147483647',
      border: '0', borderRadius: '10px', padding: '11px 14px',
      background: '#059669', color: '#fff', fontSize: '13px', fontWeight: '900',
      boxShadow: '0 4px 14px rgba(0,0,0,.28)', touchAction: 'manipulation'
    });
    updateButton();
  }

  mount();
  setInterval(mount, 800);
})();
