// ==UserScript==
// @name         note ポン出し v20.3｜最新版1本・貼付分まるごと全消し
// @namespace    https://github.com/mumei-s/note-insight
// @version      20.3.0
// @description  最新版1本だけで動作。共同マガジン一覧の回数見出し・誌名・注意書き・URL文字・生URL・カード・区切り線まで、ポン出し貼付分だけを丸ごと一括削除。元の記事本文は保持。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @connect      raw.githubusercontent.com
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v14.user.js?v=20.3.0
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v19.user.js?v=20.3.0
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v20.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v20.user.js
// ==/UserScript==

(() => {
  'use strict';
  if (window.__MUMEI_PON_V203__) return;
  window.__MUMEI_PON_V203__ = true;
  window.__MUMEI_PON_V20__ = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let cachedFactory = null;
  let busy = false;

  const NOTE_URL_RE = /^https:\/\/note\.com\/[^/]+\/(?:m\/m|n\/n)[a-z0-9]+$/i;
  const LABEL_RE = /^(?:※\s*)?(?:マガジンURL|固定記事URL|マガジンリンク|固定記事リンク)\s*[:：]\s*(https:\/\/note\.com\/[^\s]+)?\s*$/i;
  const GROUP_RE = /^(?:♾️?\s*無制限・制限なし|❓\s*制限数の表記を確認できないマガジン|(?:🔟|\d+️⃣)\s*1日\d+記事まで)$/;

  const isUrl = value => NOTE_URL_RE.test(String(value || '').trim());
  const text = node => String(node?.textContent || '').trim();

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
    for (let i = 0; i < 8 && node; i += 1, node = node.parentElement) queue.push([node, 0]);
    const seen = new Set();
    let steps = 0;
    while (queue.length && steps++ < 18000) {
      const [value, depth] = queue.shift();
      if (!value || (typeof value !== 'object' && typeof value !== 'function') || seen.has(value)) continue;
      seen.add(value);
      if (looksLikeView(value)) return value;
      if (depth >= 6) continue;
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

  function topBlocks(view) {
    const out = [];
    view.state.doc.forEach((node, offset) => out.push({node, pos:offset}));
    return out;
  }

  function isGroup(node) {
    const level = Number(node?.attrs?.level || 0);
    return level === 2 && GROUP_RE.test(text(node));
  }

  function isMagazineHeading(node) {
    return Number(node?.attrs?.level || 0) === 3;
  }

  function isHr(node) {
    return /^(?:horizontal_rule|horizontalRule|hr)$/i.test(node?.type?.name || '');
  }

  function isGeneratedNote(node) {
    if (!node?.isTextblock) return false;
    const value = text(node);
    return /^※/.test(value) || LABEL_RE.test(value) || NOTE_URL_RE.test(value);
  }

  function isCardLike(node) {
    if (!node || node.isTextblock) return false;
    const name = node.type?.name || '';
    return !!(node.isAtom || /embed|card|bookmark|oembed|external|preview|iframe/i.test(name));
  }

  function generatedSpans(view) {
    const blocks = topBlocks(view);
    const spans = [];
    let i = 0;
    while (i < blocks.length) {
      if (!isGroup(blocks[i].node)) { i += 1; continue; }
      const start = blocks[i].pos;
      let lastHrEnd = null;
      let j = i;
      while (j < blocks.length) {
        const {node, pos} = blocks[j];
        const allowed = isGroup(node) || isMagazineHeading(node) || isHr(node) || isGeneratedNote(node) || isCardLike(node);
        if (!allowed) break;
        if (isHr(node)) lastHrEnd = pos + node.nodeSize;
        j += 1;
      }
      if (lastHrEnd != null && lastHrEnd > start) {
        spans.push({start, end:lastHrEnd});
        while (i < blocks.length && blocks[i].pos < lastHrEnd) i += 1;
      } else {
        i += 1;
      }
    }
    return spans;
  }

  function fallbackUrlHits(view) {
    const labels = [];
    const targets = new Set();
    view.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return true;
      const value = text(node);
      const lm = value.match(LABEL_RE);
      if (lm) {
        labels.push({node,pos});
        if (lm[1] && isUrl(lm[1])) targets.add(lm[1]);
      }
      if (isUrl(value)) targets.add(value);
      return true;
    });
    const hits = [...labels];
    view.state.doc.descendants((node, pos) => {
      const value = text(node);
      if (node.isTextblock && targets.has(value)) hits.push({node,pos});
      if (!node.isTextblock && isCardLike(node) && targets.size) {
        let json = '';
        try { json = JSON.stringify(node.toJSON ? node.toJSON() : node.attrs || {}); } catch {}
        for (const url of targets) {
          const key = url.split('/').pop();
          if (json.includes(url) || (key && json.includes(key))) { hits.push({node,pos}); break; }
        }
      }
      return true;
    });
    return hits;
  }

  function deleteHits(view, hits) {
    const unique = new Map();
    for (const hit of hits) {
      const size = hit.node?.nodeSize || 0;
      if (!size) continue;
      unique.set(`${hit.pos}:${size}`, hit);
    }
    const ordered = [...unique.values()].sort((a,b) => b.pos - a.pos);
    if (!ordered.length) return 0;
    let tr = view.state.tr;
    let count = 0;
    for (const hit of ordered) {
      try { tr = tr.delete(hit.pos, hit.pos + hit.node.nodeSize); count += 1; } catch {}
    }
    if (count) view.dispatch(tr);
    return count;
  }

  const status = () => document.getElementById('ponStatus14');
  const say = value => { const s = status(); if (s) s.textContent = value; };

  function clearEntirePaste() {
    if (busy) return;
    const view = findView();
    if (!view) { say('❌ 貼付分削除：EditorViewなし'); return; }
    const spans = generatedSpans(view);
    let removed = 0;
    if (spans.length) {
      let tr = view.state.tr;
      for (const span of [...spans].sort((a,b) => b.start - a.start)) {
        try { tr = tr.delete(span.start, span.end); removed += 1; } catch {}
      }
      if (removed) view.dispatch(tr);
    } else {
      removed = deleteHits(view, fallbackUrlHits(view));
    }
    const src = document.getElementById('ponSrc14');
    if (src) src.value = '';
    try { src?.dispatchEvent(new Event('input', {bubbles:true})); } catch {}
    say(removed ? `🧹 ポン出し貼付分を全部削除 ✅ ${removed}ブロック｜元記事は保持` : '✅ ポン出し貼付分はありません');
  }

  function webpackRequire() {
    const chunks = window.webpackChunk_N_E;
    if (!chunks || typeof chunks.push !== 'function') return null;
    let req = null;
    try { chunks.push([[986000000 + Math.floor(Math.random()*10000000)], {}, r => { req = r; }]); } catch {}
    return req;
  }

  function factory() {
    if (typeof cachedFactory === 'function') return cachedFactory;
    const req = webpackRequire();
    if (!req) return null;
    try {
      const mod = req(94928);
      if (typeof mod?.fjT === 'function') return cachedFactory = mod.fjT;
    } catch {}
    const candidates = [];
    for (const entry of Object.values(req.c || {})) {
      const ex = entry?.exports;
      if (!ex) continue;
      if (typeof ex === 'function') candidates.push(ex);
      else try { for (const fn of Object.values(ex)) if (typeof fn === 'function') candidates.push(fn); } catch {}
    }
    const scored = candidates.map(fn => {
      let source = '';
      try { source = Function.prototype.toString.call(fn); } catch {}
      let score = 0;
      if (/embed|embeddable|embeddedContent/i.test(source)) score += 8;
      if (/replaceRangeWith/.test(source)) score += 5;
      if (/state\.selection|nodeBefore/.test(source)) score += 4;
      return {fn,score};
    }).filter(x => x.score >= 8).sort((a,b) => b.score - a.score);
    return cachedFactory = scored[0]?.fn || null;
  }

  function rawRows(view) {
    const out = [];
    view.state.doc.descendants((node,pos) => {
      if (node.isTextblock && isUrl(text(node))) out.push({node,pos,url:text(node)});
      return true;
    });
    return out.sort((a,b) => b.pos - a.pos);
  }

  function rawExists(view,url) {
    return rawRows(view).some(row => row.url === url);
  }

  function setCursor(view,pos) {
    const node = view.state.doc.nodeAt(pos);
    if (!node) return false;
    try {
      const end = Math.max(1, Math.min(view.state.doc.content.size, pos + node.nodeSize - 1));
      const Sel = view.state.selection.constructor;
      view.dispatch(view.state.tr.setSelection(Sel.near(view.state.doc.resolve(end), -1)));
      view.focus();
      return true;
    } catch { return false; }
  }

  async function convertOne(view,row) {
    const fn = factory();
    if (!fn || !setCursor(view,row.pos)) return false;
    try {
      const cmd = fn(row.url);
      if (typeof cmd !== 'function') return false;
      const result = cmd(view.state, tr => view.dispatch(tr), view);
      if (result?.then) try { await result; } catch {}
    } catch { return false; }
    const end = Date.now() + 7000;
    while (Date.now() < end) {
      if (!rawExists(view,row.url)) return true;
      await sleep(200);
    }
    return !rawExists(view,row.url);
  }

  async function repairCards() {
    if (busy) return;
    busy = true;
    const button = document.getElementById('ponRepairCards20');
    if (button) button.disabled = true;
    try {
      const view = findView();
      if (!view) throw Error('EditorViewなし');
      const rows = rawRows(view);
      if (!rows.length) { say('✅ 生URLなし｜カード化済み'); return; }
      const total = rows.length;
      let ok = 0;
      for (let i = 0; i < rows.length; i += 1) {
        say(`🃏 カード化 ${i+1}/${total}`);
        if (await convertOne(view, rows[i])) ok += 1;
        await sleep(300);
      }
      const remain = rawRows(view).length;
      say(remain ? `⚠️ カード化 ${ok}/${total}｜残り ${remain}件` : `✅ カード化完了 ${total}/${total}`);
    } catch (e) {
      say('❌ カード修復：' + (e?.message || e));
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  }

  function install() {
    const root = document.getElementById('__mumei_pon_v14_root__');
    const panel = root?.querySelector('#ponPanel14');
    const src = root?.querySelector('#ponSrc14');
    const s = status();
    if (!root || !panel || !src || !s) return setTimeout(install, 250);

    const head = root.querySelector('#ponDrag14 b');
    if (head) head.textContent = '↔️ ポン出し v20.3';

    ['ponClearUrls20','ponClearPaste20','ponRepairCards20'].forEach(id => document.getElementById(id)?.remove());

    const clear = document.createElement('button');
    clear.id = 'ponClearPaste20';
    clear.type = 'button';
    clear.textContent = '🧹 ポン出し貼付分を全部消す';
    clear.style.cssText = 'display:block;width:100%;border:1px solid #ff8d8d;border-radius:8px;padding:9px 5px;background:#5b1f29;color:#fff;font-weight:900;font-size:11px;margin-bottom:5px';
    panel.insertBefore(clear, src);
    clear.addEventListener('click', clearEntirePaste);

    const repair = document.createElement('button');
    repair.id = 'ponRepairCards20';
    repair.type = 'button';
    repair.textContent = '🃏 残りURLをカード化';
    repair.style.cssText = 'display:block;width:100%;border:0;border-radius:8px;padding:9px 5px;background:#72f1c9;color:#032b25;font-weight:900;font-size:11px;margin-bottom:5px';
    panel.insertBefore(repair, src);
    repair.addEventListener('click', repairCards);
  }

  install();
})();
