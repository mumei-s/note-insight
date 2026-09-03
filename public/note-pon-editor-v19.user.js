// ==UserScript==
// @name         note ポン出し v19｜共マガ全件・本数別・👑・全カード
// @namespace    https://github.com/mumei-s/note-insight
// @version      19.0.0
// @description  正本＋保存一覧をマージして共同マガジン全件を本数別整理。ss_yr所有誌は👑。マガジンURL/カード、本人固定記事URL/カード、収納対応。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @connect      raw.githubusercontent.com
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v14.user.js?v=19
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v16.user.js?v=16.1.0
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v19.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v19.user.js
// ==/UserScript==

(() => {
  'use strict';
  if (window.__MUMEI_PON_V19__) return;
  window.__MUMEI_PON_V19__ = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let noteUrlCommand = null;

  function addVisibleUrls(text) {
    const lines = String(text || '').split(/\r?\n/);
    const out = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (/^https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+$/i.test(line)) {
        out.push(`マガジンURL：${line}`, line);
        continue;
      }
      if (/^https:\/\/note\.com\/[^/]+\/n\/n[a-z0-9]+$/i.test(line)) {
        out.push(`固定記事URL：${line}`, line);
        continue;
      }
      out.push(raw);
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function looksLikeView(value) {
    try {
      return !!(value && typeof value === 'object' && value.state?.doc && value.state?.schema && typeof value.dispatch === 'function' && value.dom && typeof value.posAtDOM === 'function');
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
    let req = null;
    try { chunks.push([[980000000 + Math.floor(Math.random()*10000000)], {}, r => { req = r; }]); } catch {}
    return req;
  }

  function cardFactory() {
    if (noteUrlCommand) return noteUrlCommand;
    const req = webpackRequire();
    if (!req) return null;
    const right = fn => {
      if (typeof fn !== 'function') return false;
      let s=''; try { s = Function.prototype.toString.call(fn); } catch {}
      return s.includes('state.selection') && s.includes('replaceRangeWith') && s.includes('.then');
    };
    let mod; try { mod = req(94928); } catch {}
    let fn = right(mod?.fjT) ? mod.fjT : null;
    if (!fn) {
      const loaded = Object.values(req.c || {}).flatMap(e => {
        const ex=e?.exports; if (!ex) return [];
        if (typeof ex === 'function') return [ex];
        try { return Object.values(ex); } catch { return []; }
      });
      fn = loaded.find(right) || null;
    }
    noteUrlCommand = fn;
    return fn;
  }

  function setCursorAfter(view, pos) {
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

  async function retryMagazineCards(status) {
    const view = findView();
    const factory = cardFactory();
    if (!view || !factory) return;
    for (let pass=0; pass<3; pass+=1) {
      const rows=[];
      view.state.doc.descendants((node,pos) => {
        if (node.isTextblock && /^https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+$/i.test((node.textContent||'').trim())) rows.push({pos,url:(node.textContent||'').trim()});
        return true;
      });
      rows.sort((a,b)=>b.pos-a.pos);
      if (!rows.length) return;
      if (status) status.textContent = `マガジンカード再確認 ${rows.length}件`;
      for (const item of rows) {
        const node=view.state.doc.nodeAt(item.pos);
        if (!node || (node.textContent||'').trim()!==item.url || !setCursorAfter(view,item.pos)) continue;
        try {
          const cmd=factory(item.url);
          if (typeof cmd==='function') cmd(view.state,tr=>view.dispatch(tr),view);
        } catch {}
        await sleep(450);
      }
      await sleep(700);
    }
  }

  function install() {
    const root=document.getElementById('__mumei_pon_v14_root__');
    const panel=root?.querySelector('#ponPanel14');
    const fab=root?.querySelector('#ponFab14');
    const src=root?.querySelector('#ponSrc14');
    const add=root?.querySelector('#ponAdd14');
    const status=root?.querySelector('#ponStatus14');
    const head=root?.querySelector('#ponDrag14 b');
    const button=document.getElementById('ponMags16');
    const oldMin=root?.querySelector('#ponMin14');
    const oldClose=root?.querySelector('#ponClose14');
    if (!root || !panel || !fab || !src || !add || !status || !button || !oldMin || !oldClose) return setTimeout(install,250);

    if (head) head.textContent='↔️ ポン出し v19';
    button.textContent='📚 全件取得→本数別＋👑＋全カード';

    const min=oldMin.cloneNode(true), close=oldClose.cloneNode(true);
    oldMin.replaceWith(min); oldClose.replaceWith(close);
    min.textContent='＿'; close.textContent='▼';
    min.title='しまう'; close.title='しまう';
    const stow=e=>{
      e?.preventDefault?.(); e?.stopPropagation?.();
      panel.style.setProperty('display','none','important');
      fab.style.setProperty('display','block','important');
    };
    min.addEventListener('click',stow);
    close.addEventListener('click',stow);
    fab.addEventListener('click',()=>{
      panel.style.setProperty('display','block','important');
      fab.style.setProperty('display','none','important');
    },true);

    add.addEventListener('click',()=>{
      if (!/#\s/.test(src.value) || !/https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+/i.test(src.value)) return;
      if (!/マガジンURL：/.test(src.value)) src.value=addVisibleUrls(src.value);
    },true);

    const observer=new MutationObserver(()=>{
      if (!/^✅ 完了/.test(status.textContent||'')) return;
      setTimeout(()=>retryMagazineCards(status),500);
    });
    observer.observe(status,{childList:true,subtree:true,characterData:true});
  }

  install();
})();