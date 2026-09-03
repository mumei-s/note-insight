// ==UserScript==
// @name         note URLポン v31.4｜全URL安定カード化
// @namespace    https://github.com/mumei-s/note-insight
// @version      31.4.0
// @description  本文は手動貼付。/m/マガジンURLと/n/固定記事URLだけを検出。各URLをnoteで成功実績のある本文末処理で本物カード化し、そのカードを元URL位置へ戻す。失敗時は末尾の仮URL・仮カードを自動回収。本文・見出し・順番・その他URLには触れない。
// @author       無名S note
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v20.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v20.user.js
// ==/UserScript==
(() => {
'use strict';
if(window.__MUMEI_URL_PON_V314__)return;window.__MUMEI_URL_PON_V314__=true;
const BTN='mumei-url-pon-v314-btn',ST='mumei-url-pon-v314-status',sleep=ms=>new Promise(r=>setTimeout(r,ms));
let busy=false,viewCache=null,cmdCache=null,selectionCache=null;
const norm=v=>{try{const u=new URL(String(v||'').trim(),location.href);u.search='';u.hash='';return u.href}catch{return String(v||'').trim()}};
const target=v=>/^https:\/\/note\.com\/[A-Za-z0-9_-]+\/(?:m\/m[a-z0-9]+|n\/n[a-z0-9]+)\/?$/i.test(String(v||'').trim());
const editor=()=>document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror');
function isView(v){try{return!!(v&&v.state?.doc&&v.state?.schema&&typeof v.dispatch==='function'&&v.dom&&typeof v.posAtDOM==='function')}catch{return false}}
function view(){if(isView(viewCache)&&viewCache.dom?.isConnected)return viewCache;const root=editor();if(!root)return null;const q=[],seen=new Set();let s=root;for(let i=0;i<7&&s;i++,s=s.parentElement)q.push([s,0]);let n=0;while(q.length&&n++<14000){const[v,d]=q.shift();if(!v||seen.has(v))continue;seen.add(v);if(isView(v))return(viewCache=v);if(d>=7)continue;let ks=[];try{ks=Object.getOwnPropertyNames(v)}catch{continue}for(const k of ks){if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k))continue;let x;try{x=v[k]}catch{continue}if(isView(x))return(viewCache=x);if(x&&(typeof x==='object'||typeof x==='function')&&x!==window&&x!==document)q.push([x,d+1])}}return null}
function req(){const c=window.webpackChunk_N_E;if(!c||typeof c.push!=='function')return null;let r=null;try{c.push([[998700000+Math.floor(Math.random()*200000)],{},x=>{r=x}])}catch{}return r}
function selectionApi(){if(selectionCache)return selectionCache;const r=req();if(!r)throw Error('note内部Selectionを取得できません');let m;try{m=r(44044)}catch{}const S=m?.Y1;if(typeof S?.atEnd!=='function')throw Error('note Selection.atEndが見つかりません');return(selectionCache=S)}
function factory(){if(cmdCache)return cmdCache;const r=req();if(!r)throw Error('note内部URL処理を取得できません');let m;try{m=r(94928)}catch{}const right=f=>{if(typeof f!=='function')return false;let s='';try{s=Function.prototype.toString.call(f)}catch{}return s.includes('state.selection')&&s.includes('nodeBefore')&&s.includes('replaceRangeWith')&&s.includes('.then')};let f=right(m?.fjT)?m.fjT:null;if(!f){const a=Object.values(r.c||{}).flatMap(e=>{const x=e?.exports;return typeof x==='function'?[x]:x&&typeof x==='object'?Object.values(x):[]});f=a.find(right)||null}if(!f)throw Error('note正規URLコマンドが見つかりません');return(cmdCache=f)}
function rows(v){const a=[];v.state.doc.descendants((node,pos)=>{if(!node.isTextblock)return;const raw=(node.textContent||'').trim();if(target(raw))a.push({node,pos,url:norm(raw)})});return a.sort((a,b)=>a.pos-b.pos)}
function embeds(v){const a=[];v.state.doc.descendants((node,pos)=>{if(node.type?.name==='embed')a.push({node,pos})});return a}
const ckey=h=>String(h?.node?.attrs?.embeddedContentKey||''),curl=h=>norm(h?.node?.attrs?.src||'');
const genuine=(h,u)=>curl(h)===norm(u)&&/^emb[a-z0-9]+$/i.test(ckey(h))&&String(h?.node?.attrs?.htmlForEmbed||'').includes('note-embed');
function ensureEnd(v){const p=v.state.schema.nodes.paragraph;if(!p)throw Error('paragraphなし');let added=false;if(v.state.doc.lastChild?.type!==p||v.state.doc.lastChild.textContent!==''){v.dispatch(v.state.tr.insert(v.state.doc.content.size,p.create()));added=true}v.dispatch(v.state.tr.setSelection(selectionApi().atEnd(v.state.doc)).scrollIntoView());v.focus();return added}
function insertTemp(v,url){const added=ensureEnd(v),p=v.state.schema.nodes.paragraph;v.dispatch(v.state.tr.insert(v.state.doc.content.size,p.create(null,v.state.schema.text(url))));v.dispatch(v.state.tr.setSelection(selectionApi().atEnd(v.state.doc)).scrollIntoView());v.focus();return added}
function removeOwnedSpacer(v,added){if(!added)return;const d=v.state.doc,last=d.lastChild,p=v.state.schema.nodes.paragraph;if(last?.type===p&&last.textContent===''){const from=d.content.size-last.nodeSize;try{v.dispatch(v.state.tr.delete(from,d.content.size))}catch{}}}
function cleanupTemp(v,url,originalPos,added,before){
  const temp=rows(v).filter(r=>r.url===norm(url)&&r.pos>originalPos).sort((a,b)=>b.pos-a.pos)[0];
  if(temp)try{v.dispatch(v.state.tr.delete(temp.pos,temp.pos+temp.node.nodeSize))}catch{}
  const stray=embeds(v).filter(h=>h.pos>originalPos&&ckey(h)&&!before.has(ckey(h))&&curl(h)===norm(url)).sort((a,b)=>b.pos-a.pos)[0];
  if(stray)try{v.dispatch(v.state.tr.delete(stray.pos,stray.pos+stray.node.nodeSize))}catch{}
  removeOwnedSpacer(v,added)
}
async function generateAtEnd(v,url,before){const command=factory()(url);if(typeof command!=='function')throw Error('URLコマンド未生成');if(!command(v.state,tr=>v.dispatch(tr),v))throw Error('noteがURLを処理しませんでした');const end=Date.now()+45000;while(Date.now()<end){const hit=embeds(v).find(h=>ckey(h)&&!before.has(ckey(h))&&genuine(h,url));if(hit)return hit;await sleep(250)}throw Error('カード生成を確認できません')}
function currentOriginal(v,url,originalPos){const a=rows(v).filter(r=>r.url===norm(url)&&r.pos<=originalPos+3);if(!a.length)return null;return a.sort((x,y)=>Math.abs(x.pos-originalPos)-Math.abs(y.pos-originalPos))[0]}
async function one(v,row){const before=new Set(embeds(v).map(ckey).filter(Boolean)),originalPos=row.pos;let added=false;try{added=insertTemp(v,row.url);const fresh=await generateAtEnd(v,row.url,before);const original=currentOriginal(v,row.url,originalPos);if(!original)throw Error('元URL位置を見失いました');if(fresh.pos<=original.pos)throw Error('生成カード位置が不正です');let tr=v.state.tr;tr=tr.delete(fresh.pos,fresh.pos+fresh.node.nodeSize);tr=tr.replaceWith(original.pos,original.pos+original.node.nodeSize,fresh.node);v.dispatch(tr.scrollIntoView());removeOwnedSpacer(v,added);return fresh}catch(e){cleanupTemp(v,row.url,originalPos,added,before);throw e}}
function say(t,bad=false){const e=document.getElementById(ST);if(e){e.textContent=t;e.style.background=bad?'#991b1b':'#1f2937'}}
function refresh(){if(busy)return;const b=document.getElementById(BTN);if(!b)return;const v=view(),n=v?rows(v).length:0;b.textContent=n?`🔗 マガジン＋固定記事 ${n}件 → 全カード化`:'🔗 /m/・/n/ URLをカード化';b.disabled=!n;b.style.opacity=n?'1':'.55'}
async function run(){if(busy)return;const v=view();if(!v)return say('❌ note編集本文を取得できません',true);const total=rows(v).length;if(!total)return say('対象URLは0件');busy=true;const b=document.getElementById(BTN);if(b)b.disabled=true;try{factory();selectionApi();let done=0;while(true){const a=rows(v);if(!a.length)break;const r=a[0];say(`🔗 ${done+1}/${total} カード化中…\n${r.url}`);await one(v,r);done++;say(`✅ ${done}/${total} 完了`);if(done<total)await sleep(900)}say(`✅ ${done}/${total}件 全部カード化`)}catch(e){say(`❌ 停止｜残り ${rows(v).length}件\n${e?.message||e}`,true)}finally{busy=false;if(b)b.disabled=false;refresh()}}
function mount(){if(!document.body)return;let s=document.getElementById(ST);if(!s){s=document.createElement('div');s.id=ST;document.body.appendChild(s)}Object.assign(s.style,{position:'fixed',right:'8px',bottom:'68px',zIndex:'2147483646',maxWidth:'320px',padding:'6px 8px',borderRadius:'8px',background:'#1f2937',color:'#fff',fontSize:'11px',lineHeight:'1.35',whiteSpace:'pre-wrap',boxShadow:'0 3px 12px rgba(0,0,0,.25)',pointerEvents:'none'});if(!s.textContent)s.textContent='本文を貼付 → /m/ と /n/ の単独URLだけ判別';let b=document.getElementById(BTN);if(!b){b=document.createElement('button');b.id=BTN;b.type='button';b.addEventListener('click',run);document.body.appendChild(b)}Object.assign(b.style,{position:'fixed',right:'8px',bottom:'18px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'11px 14px',background:'#059669',color:'#fff',fontSize:'13px',fontWeight:'900',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});refresh()}
mount();setInterval(mount,800);
})();
