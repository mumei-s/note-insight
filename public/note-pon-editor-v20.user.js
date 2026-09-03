// ==UserScript==
// @name         note ポン出し v20.2｜共同マガジンURLだけ全消し＋カード修復
// @namespace    https://github.com/mumei-s/note-insight
// @version      20.2.0
// @description  記事本文を残したまま、ポン出しで追加したマガジンURL・固定記事URL・生URL・対応カードだけを一括削除。v19.1の回数整理とカード修復も維持。
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
  if (window.__MUMEI_PON_V202__) return;
  window.__MUMEI_PON_V202__ = true;
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
    view.state.doc.descendants((node,pos)=>{
      if(node.isTextblock){
        const url=(node.textContent||'').trim();
        if(isUrl(url)) out.push({pos,url,node});
      }
      return true;
    });
    return out.sort((a,b)=>b.pos-a.pos);
  }

  function exists(view,url) {
    let hit=false;
    view.state.doc.descendants(node=>{
      if(hit)return false;
      if(node.isTextblock&&(node.textContent||'').trim()===url){hit=true;return false;}
      return true;
    });
    return hit;
  }

  function cursor(view,pos) {
    const node=view.state.doc.nodeAt(pos); if(!node)return false;
    try {
      const end=Math.max(1,Math.min(view.state.doc.content.size,pos+node.nodeSize-1));
      const Sel=view.state.selection.constructor;
      view.dispatch(view.state.tr.setSelection(Sel.near(view.state.doc.resolve(end),-1)));
      view.focus();
      return true;
    } catch { return false; }
  }

  async function waitGone(view,url,ms=6000) {
    const end=Date.now()+ms;
    while(Date.now()<end){if(!exists(view,url))return true;await sleep(180);}
    return !exists(view,url);
  }

  async function convert(view,item) {
    let current=raws(view).find(x=>x.url===item.url); if(!current)return true;
    const f=factory();
    if(f&&cursor(view,current.pos)){
      try {
        const cmd=f(item.url);
        if(typeof cmd==='function'){
          const r=cmd(view.state,tr=>view.dispatch(tr),view);
          if(r?.then)try{await r}catch{}
          if(await waitGone(view,item.url))return true;
        }
      } catch {}
    }
    current=raws(view).find(x=>x.url===item.url);
    if(!current||!cursor(view,current.pos))return !exists(view,item.url);
    const ev=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true});
    let handled=false;
    try {
      if(typeof view.someProp==='function') view.someProp('handleKeyDown',fn=>{
        if(handled||typeof fn!=='function')return handled;
        try{handled=!!fn(view,ev)}catch{}
        return handled;
      });
    } catch {}
    if(!handled)try{view.dom.dispatchEvent(ev)}catch{}
    if(await waitGone(view,item.url))return true;
    cachedFactory=null;
    current=raws(view).find(x=>x.url===item.url); if(!current)return true;
    if(factory()&&cursor(view,current.pos))try{const cmd=factory()(item.url);if(typeof cmd==='function')cmd(view.state,tr=>view.dispatch(tr),view)}catch{}
    return waitGone(view,item.url,6500);
  }

  function linkMarkType(schema) {
    if (schema.marks?.link) return schema.marks.link;
    for (const [name,type] of Object.entries(schema.marks || {})) if (/link/i.test(name)) return type;
    return null;
  }

  function linkAttrs(type,url) {
    const attrs={};
    const spec=type?.spec?.attrs || {};
    for (const [name,rule] of Object.entries(spec)) {
      if (/href|url|link/i.test(name)) attrs[name]=url;
      else if (name === 'target') attrs[name]='_blank';
      else if (name === 'rel') attrs[name]='noopener noreferrer';
      else if (Object.prototype.hasOwnProperty.call(rule || {},'default')) attrs[name]=rule.default;
      else attrs[name]=null;
    }
    if (!Object.keys(attrs).some(name=>/href|url|link/i.test(name))) attrs.href=url;
    return attrs;
  }

  function labelRows(view) {
    const out=[];
    const re=/^(マガジンURL|固定記事URL)：(https:\/\/note\.com\/[^\s]+)$/i;
    view.state.doc.descendants((node,pos)=>{
      if(!node.isTextblock)return true;
      const text=(node.textContent||'').trim();
      const m=text.match(re);
      if(!m)return true;
      const url=m[2];
      const startInText=text.indexOf(url);
      if(startInText<0)return true;
      out.push({pos,url,node,start:pos+1+startInText,end:pos+1+startInText+url.length});
      return true;
    });
    return out;
  }

  function urlAlreadyLinked(view,row,type) {
    let covered=false;
    view.state.doc.nodesBetween(row.start,row.end,node=>{
      if(covered)return false;
      for(const mark of node.marks||[]){
        if(mark.type!==type)continue;
        const vals=Object.values(mark.attrs||{}).map(String);
        if(vals.includes(row.url)){covered=true;return false;}
      }
      return true;
    });
    return covered;
  }

  function linkifyLabelUrls(view) {
    const type=linkMarkType(view.state.schema);
    if(!type)return 0;
    const rows=labelRows(view);
    if(!rows.length)return 0;
    let tr=view.state.tr, changed=0;
    for(const row of rows){
      if(urlAlreadyLinked(view,row,type))continue;
      let mark;
      try{mark=type.create(linkAttrs(type,row.url));}catch{continue;}
      try{tr=tr.addMark(row.start,row.end,mark);changed+=1;}catch{}
    }
    if(changed)view.dispatch(tr);
    return changed;
  }

  function nodeCarriesTarget(node, targets) {
    if (!node || node.isTextblock) return false;
    const name=node.type?.name || '';
    if (!(node.isAtom || /embed|card|bookmark|oembed|external|preview|iframe/i.test(name))) return false;
    let json='';
    try { json=JSON.stringify(node.toJSON ? node.toJSON() : node.attrs || {}); } catch { return false; }
    for (const url of targets) {
      const key=url.split('/').pop();
      if (json.includes(url) || (key && json.includes(key))) return true;
    }
    return false;
  }

  function deleteBlocks(view,hits) {
    if(!hits.length)return 0;
    const seen=new Set();
    let tr=view.state.tr, count=0;
    for(const hit of [...hits].sort((a,b)=>b.pos-a.pos)){
      const size=hit.node?.nodeSize || 0;
      if(!size)continue;
      const k=`${hit.pos}:${size}`;
      if(seen.has(k))continue;
      seen.add(k);
      try{tr=tr.delete(hit.pos,hit.pos+size);count+=1;}catch{}
    }
    if(count)view.dispatch(tr);
    return count;
  }

  function clearPastedUrls() {
    if(busy)return;
    const view=findView();
    if(!view){say('❌ URL削除：EditorViewなし');return;}

    const labels=labelRows(view);
    const targetSet=new Set(labels.map(x=>x.url));
    if(!targetSet.size){
      // ラベルが既に消えている場合だけ、生URLを対象として救済削除する。
      for(const row of raws(view)) targetSet.add(row.url);
    }
    if(!targetSet.size){say('✅ 削除する貼付URLなし');return;}

    const hits=[];
    for(const row of labels) hits.push({pos:row.pos,node:row.node});
    for(const row of raws(view)) if(targetSet.has(row.url)) hits.push({pos:row.pos,node:row.node});
    view.state.doc.descendants((node,pos)=>{
      if(nodeCarriesTarget(node,targetSet)) hits.push({pos,node});
      return true;
    });

    const removed=deleteBlocks(view,hits);
    say(`🧹 貼付URLだけ全消し ✅ ${removed}ブロック削除｜本文・見出しは保持`);
  }

  const status=()=>document.getElementById('ponStatus14');
  const say=t=>{const s=status();if(s)s.textContent=t;};

  async function repair() {
    if(busy)return; busy=true;
    const btn=document.getElementById('ponRepairCards20'); if(btn)btn.disabled=true;
    try {
      const view=findView(); if(!view)throw Error('EditorViewなし');
      const list=raws(view);
      if(!list.length){
        const linked=linkifyLabelUrls(view);
        say(linked?`✅ カード化済み｜URLリンク ${linked}件追加`:'✅ カード化済み｜URLもタップ可能');
        return;
      }
      const total=list.length;
      for(let i=0;i<list.length;i++){
        say(`🃏 カード化 ${i+1}/${total}`);
        await convert(view,list[i]);
        await sleep(250);
      }
      const remain=raws(view).length;
      const linked=linkifyLabelUrls(view);
      say(remain?`⚠️ カード化 ${total-remain}/${total}｜残り ${remain}件｜URLリンク ${linked}件`:`✅ カード化完了 ${total}/${total}｜URLもタップ可能`);
    } catch(e){say('❌ カード修復：'+(e?.message||e));}
    finally {busy=false;if(btn)btn.disabled=false;}
  }

  function install() {
    const root=document.getElementById('__mumei_pon_v14_root__');
    const panel=root?.querySelector('#ponPanel14');
    const src=root?.querySelector('#ponSrc14');
    const s=status();
    if(!root||!panel||!src||!s)return setTimeout(install,250);

    const head=root.querySelector('#ponDrag14 b');
    if(head)head.textContent='↔️ ポン出し v20.2';

    document.getElementById('ponClearUrls20')?.remove();
    document.getElementById('ponRepairCards20')?.remove();

    const clear=document.createElement('button');
    clear.id='ponClearUrls20';
    clear.type='button';
    clear.textContent='🧹 貼り付けたURLだけ全消し';
    clear.style.cssText='display:block;width:100%;border:1px solid #ff8d8d;border-radius:8px;padding:9px 5px;background:#5b1f29;color:#fff;font-weight:900;font-size:11px;margin-bottom:5px';
    panel.insertBefore(clear,src);
    clear.addEventListener('click',clearPastedUrls);

    const btn=document.createElement('button');
    btn.id='ponRepairCards20';
    btn.type='button';
    btn.textContent='🃏 カード化＋🔗URLリンク';
    btn.style.cssText='display:block;width:100%;border:0;border-radius:8px;padding:9px 5px;background:#72f1c9;color:#032b25;font-weight:900;font-size:11px;margin-bottom:5px';
    panel.insertBefore(btn,src);
    btn.addEventListener('click',repair);

    let timer=null;
    new MutationObserver(()=>{
      const t=s.textContent||'';
      if(/^✅ 完了/.test(t)||/カード生成中/.test(t)){
        clearTimeout(timer);
        timer=setTimeout(repair,1200);
      }
    }).observe(s,{childList:true,subtree:true,characterData:true});

    setTimeout(()=>{
      const v=findView();
      if(!v)return;
      const rawCount=raws(v).length;
      const linked=linkifyLabelUrls(v);
      if(rawCount)say(`🃏 生URL ${rawCount}件｜先に「貼り付けたURLだけ全消し」も可能`);
      else if(linked)say(`🔗 URLリンク ${linked}件追加済み`);
    },1200);
  }

  install();
})();
