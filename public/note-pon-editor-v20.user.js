// ==UserScript==
// @name         note ポン出し v20｜共同マガジンカード修復版
// @namespace    https://github.com/mumei-s/note-insight
// @version      20.0.0
// @description  v19.1の回数整理を維持し、残ったnote生URLを正規カードへ再変換。直接コマンド＋Enter処理＋再試行。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @connect      raw.githubusercontent.com
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v19.user.js?v=19.1.0
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v20.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v20.user.js
// ==/UserScript==

(() => {
  'use strict';
  if (window.__MUMEI_PON_V20__) return;
  window.__MUMEI_PON_V20__ = true;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let cachedFactory = null;
  let busy = false;

  const isUrl = s => /^https:\/\/note\.com\/[^/]+\/(?:m\/m|n\/n)[a-z0-9]+$/i.test(String(s || '').trim());
  const looksLikeView = v => { try { return !!(v && v.state?.doc && v.state?.schema && typeof v.dispatch === 'function' && v.dom); } catch { return false; } };

  function findView() {
    const root = document.querySelector('.ProseMirror[contenteditable="true"]') || document.querySelector('.ProseMirror');
    if (!root) return null;
    const q = []; let n = root;
    for (let i=0;i<8&&n;i++,n=n.parentElement) q.push([n,0]);
    const seen = new Set();
    while (q.length) {
      const [v,d] = q.shift();
      if (!v || (typeof v!=='object'&&typeof v!=='function') || seen.has(v)) continue;
      seen.add(v);
      if (looksLikeView(v)) return v;
      if (d >= 6) continue;
      let keys=[]; try { keys=Object.getOwnPropertyNames(v); } catch { continue; }
      for (const k of keys) {
        if (['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k)) continue;
        let x; try { x=v[k]; } catch { continue; }
        if (x && (typeof x==='object'||typeof x==='function') && !seen.has(x)) q.push([x,d+1]);
      }
    }
    return null;
  }

  function webpackRequire() {
    const chunks = window.webpackChunk_N_E;
    if (!chunks || typeof chunks.push !== 'function') return null;
    let req = null;
    try { chunks.push([[985000000+Math.floor(Math.random()*10000000)],{},r=>{req=r;}]); } catch {}
    return req;
  }

  function factory() {
    if (typeof cachedFactory === 'function') return cachedFactory;
    const req = webpackRequire(); if (!req) return null;
    try {
      const mod = req(94928);
      if (typeof mod?.fjT === 'function') return cachedFactory = mod.fjT;
    } catch {}
    const candidates=[];
    for (const e of Object.values(req.c||{})) {
      const ex=e?.exports; if(!ex) continue;
      if(typeof ex==='function') candidates.push(ex);
      else try { for(const f of Object.values(ex)) if(typeof f==='function') candidates.push(f); } catch {}
    }
    const scored=candidates.map(fn=>{let s='';try{s=Function.prototype.toString.call(fn)}catch{};let p=0;if(/embed|embeddable|embeddedContent/i.test(s))p+=8;if(/replaceRangeWith/.test(s))p+=5;if(/state\.selection|nodeBefore/.test(s))p+=4;return{fn,p}}).filter(x=>x.p>=8).sort((a,b)=>b.p-a.p);
    return cachedFactory = scored[0]?.fn || null;
  }

  function raws(view) {
    const out=[];
    view.state.doc.descendants((node,pos)=>{ if(node.isTextblock){const url=(node.textContent||'').trim();if(isUrl(url))out.push({pos,url});} return true; });
    return out.sort((a,b)=>b.pos-a.pos);
  }

  function exists(view,url) {
    let hit=false;
    view.state.doc.descendants(node=>{if(hit)return false;if(node.isTextblock&&(node.textContent||'').trim()===url){hit=true;return false;}return true;});
    return hit;
  }

  function cursor(view,pos) {
    const node=view.state.doc.nodeAt(pos); if(!node)return false;
    try { const end=Math.max(1,Math.min(view.state.doc.content.size,pos+node.nodeSize-1)); const Sel=view.state.selection.constructor; view.dispatch(view.state.tr.setSelection(Sel.near(view.state.doc.resolve(end),-1))); view.focus(); return true; } catch { return false; }
  }

  async function waitGone(view,url,ms=6000) {
    const end=Date.now()+ms;
    while(Date.now()<end){if(!exists(view,url))return true;await sleep(180);} return !exists(view,url);
  }

  async function convert(view,item) {
    let current=raws(view).find(x=>x.url===item.url); if(!current)return true;
    const f=factory();
    if(f&&cursor(view,current.pos)){
      try { const cmd=f(item.url); if(typeof cmd==='function'){ const r=cmd(view.state,tr=>view.dispatch(tr),view); if(r?.then)try{await r}catch{}; if(await waitGone(view,item.url))return true; } } catch {}
    }
    current=raws(view).find(x=>x.url===item.url); if(!current||!cursor(view,current.pos))return !exists(view,item.url);
    const ev=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true});
    let handled=false;
    try { if(typeof view.someProp==='function') view.someProp('handleKeyDown',fn=>{if(handled||typeof fn!=='function')return handled;try{handled=!!fn(view,ev)}catch{}return handled;}); } catch {}
    if(!handled)try{view.dom.dispatchEvent(ev)}catch{}
    if(await waitGone(view,item.url))return true;
    cachedFactory=null;
    current=raws(view).find(x=>x.url===item.url); if(!current)return true;
    if(factory()&&cursor(view,current.pos))try{const cmd=factory()(item.url);if(typeof cmd==='function')cmd(view.state,tr=>view.dispatch(tr),view)}catch{}
    return waitGone(view,item.url,6500);
  }

  const status=()=>document.getElementById('ponStatus14');
  const say=t=>{const s=status();if(s)s.textContent=t;};

  async function repair() {
    if(busy)return; busy=true;
    const btn=document.getElementById('ponRepairCards20'); if(btn)btn.disabled=true;
    try {
      const view=findView(); if(!view)throw Error('EditorViewなし');
      const list=raws(view); if(!list.length){say('✅ 生URLなし｜カード化済み');return;}
      const total=list.length;
      for(let i=0;i<list.length;i++){say(`🃏 カード化 ${i+1}/${total}`);await convert(view,list[i]);await sleep(250);}
      const remain=raws(view).length;
      say(remain?`⚠️ カード化 ${total-remain}/${total}｜残り ${remain}件 → もう一度カード化`:`✅ カード化完了 ${total}/${total}`);
    } catch(e){say('❌ カード修復：'+(e?.message||e));}
    finally {busy=false;if(btn)btn.disabled=false;}
  }

  function install() {
    const root=document.getElementById('__mumei_pon_v14_root__'); const panel=root?.querySelector('#ponPanel14'); const src=root?.querySelector('#ponSrc14'); const s=status();
    if(!root||!panel||!src||!s)return setTimeout(install,250);
    const head=root.querySelector('#ponDrag14 b'); if(head)head.textContent='↔️ ポン出し v20';
    document.getElementById('ponRepairCards20')?.remove();
    const btn=document.createElement('button'); btn.id='ponRepairCards20'; btn.type='button'; btn.textContent='🃏 残りURLをカード化';
    btn.style.cssText='display:block;width:100%;border:0;border-radius:8px;padding:9px 5px;background:#72f1c9;color:#032b25;font-weight:900;font-size:11px;margin-bottom:5px';
    panel.insertBefore(btn,src); btn.addEventListener('click',repair);
    let timer=null; new MutationObserver(()=>{const t=s.textContent||'';if(/^✅ 完了/.test(t)||/カード生成中/.test(t)){clearTimeout(timer);timer=setTimeout(repair,1200);}}).observe(s,{childList:true,subtree:true,characterData:true});
    setTimeout(()=>{const v=findView();if(v&&raws(v).length)say(`🃏 生URL ${raws(v).length}件｜「残りURLをカード化」で修復`);},1200);
  }
  install();
})();
