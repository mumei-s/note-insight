// ==UserScript==
// @name         無名S note 通知カード 再検証 ISOLATED
// @namespace    https://github.com/mumei-s/note-insight/card-isolated-retest
// @version      1.0.0
// @description  INSIGHTから完全分離した通知カード再検証版。本文の既存カードを採用し、3秒間隔・10件ごと30秒休止・最後に1回保存。
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-isolated-retest-v1.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-isolated-retest-v1.user.js
// ==/UserScript==

(function(){
'use strict';
if(window.__MUMEI_CARD_ISOLATED_RETEST_V1__)return;
window.__MUMEI_CARD_ISOLATED_RETEST_V1__=true;

const VERSION='1.0.0';
const MANIFEST='https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-live-batch/manifest.json';
const PANEL='mumei-card-isolated-retest-v1';
const STATUS='mumei-card-isolated-retest-status-v1';
const STATE_PREFIX='mumei_card_isolated_retest_v1:';
let busy=false,viewCache=null,noteUrlCommand=null,stopRequested=false,rowsCache=null;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const articleKey=()=>location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1]||'';
const stateKey=()=>STATE_PREFIX+(articleKey()||'unknown');
const readState=()=>{try{return JSON.parse(localStorage.getItem(stateKey())||'null')}catch{return null}};
const writeState=v=>localStorage.setItem(stateKey(),JSON.stringify(v));
const normalize=v=>{try{const u=new URL(String(v||''),location.href);u.search='';u.hash='';return u.href}catch{return String(v||'')}};
function setStatus(msg,bad=false){const e=document.getElementById(STATUS);if(e){e.textContent=msg;e.dataset.bad=bad?'1':'0'}}
function enabled(){return Boolean(articleKey())}
function requestJSON(url){return new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'GET',url:url+(url.includes('?')?'&':'?')+'_='+Date.now(),responseType:'text',timeout:60000,onload:r=>{try{if(r.status!==200)throw new Error('manifest HTTP '+r.status);resolve(JSON.parse(r.responseText))}catch(e){reject(e)}},onerror:()=>reject(new Error('manifest通信失敗')),ontimeout:()=>reject(new Error('manifest通信タイムアウト'))}))}
async function rows(){if(rowsCache)return rowsCache;const m=await requestJSON(MANIFEST);if(!Array.isArray(m?.items)||!m.items.length||m.items.length!==Number(m.count))throw new Error('対象一覧を確認できません');rowsCache=m.items.map((x,i)=>({index:i+1,url:normalize(x.url),creator:String(x.creator||''),title:String(x.title||'')}));return rowsCache}

function webpackRequire(){const chunks=window.webpackChunk_N_E;if(!chunks||typeof chunks.push!=='function')return null;let req=null;const id=995000000+Math.floor(Math.random()*900000);try{chunks.push([[id],{},r=>{req=r}])}catch{}return req}
function looksLikeView(v){try{return Boolean(v&&typeof v==='object'&&v.state?.doc&&v.state?.schema&&typeof v.dispatch==='function'&&v.dom&&typeof v.posAtDOM==='function')}catch{return false}}
function findView(){
 if(looksLikeView(viewCache)&&viewCache.dom?.isConnected)return viewCache;
 const root=document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror');if(!root)return null;
 const seen=new Set(),q=[];let seed=root;for(let i=0;i<6&&seed;i++,seed=seed.parentElement)q.push([seed,0]);
 let steps=0;while(q.length&&steps++<14000){const[v,d]=q.shift();if(!v||seen.has(v))continue;seen.add(v);if(looksLikeView(v))return viewCache=v;let keys=[];try{keys=Object.getOwnPropertyNames(v)}catch{continue}for(const k of keys){if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k))continue;let x;try{x=v[k]}catch{continue}if(looksLikeView(x))return viewCache=x;if(d<7&&x&&(typeof x==='object'||typeof x==='function')&&x!==window&&x!==document)q.push([x,d+1])}}return null
}
function selectionAtEnd(view){const current=view?.state?.selection?.constructor;if(typeof current?.atEnd==='function')return current.atEnd(view.state.doc);const req=webpackRequire();let api;try{api=req?.(35130)?.sW}catch{}if(typeof api?.atEnd==='function')return api.atEnd(view.state.doc);if(typeof current?.near==='function')return current.near(view.state.doc.resolve(view.state.doc.content.size));throw new Error('note末尾位置を取得できません')}
function nativeUrlCommand(){
 if(noteUrlCommand)return noteUrlCommand;
 const req=webpackRequire();if(!req)throw new Error('note内部URL処理を取得できません');
 let candidate;try{candidate=req(94928)?.fjT}catch{}
 const right=v=>{if(typeof v!=='function')return false;let s='';try{s=Function.prototype.toString.call(v)}catch{}return s.includes('state.selection')&&s.includes('nodeBefore')&&s.includes('replaceRangeWith')&&s.includes('.then')};
 if(!right(candidate)){const loaded=Object.values(req.c||{}).flatMap(e=>{const x=e?.exports;if(typeof x==='function')return[x];return x&&typeof x==='object'?Object.values(x):[]});candidate=loaded.find(right)||null}
 if(!right(candidate))throw new Error('note正規URLカード処理が見つかりません');
 return noteUrlCommand=candidate
}
function embedNodes(view){const out=[];view.state.doc.descendants((node,pos)=>{if(node.type?.name==='embed')out.push({node,pos})});return out}
function cardKey(hit){return String(hit?.node?.attrs?.embeddedContentKey||'')}
function cardUrl(hit){return normalize(hit?.node?.attrs?.src)}
function genuineCard(hit,url){
 const key=cardKey(hit),html=String(hit?.node?.attrs?.htmlForEmbed||'');
 if(!/^emb[a-z0-9]+$/i.test(key)||!html.includes('note-embed'))return false;
 if(cardUrl(hit)===normalize(url))return true;
 try{const src=new URL(cardUrl(hit)),expected=new URL(url);const embedded=src.pathname.match(/^\/embed\/notes\/(n[a-f0-9]{12})\/?$/i)?.[1],wanted=expected.pathname.match(/\/n\/(n[a-f0-9]{12})/i)?.[1];return src.origin==='https://note.com'&&embedded&&wanted&&embedded===wanted}catch{return false}
}
function exactUrlParagraphs(view,url){const wanted=normalize(url),out=[];view.state.doc.descendants((node,pos)=>{if(node.isTextblock&&normalize((node.textContent||'').trim())===wanted)out.push({node,pos})});return out}
function removeHits(view,hits){const map=new Map();for(const h of hits||[])if(h?.node)map.set(h.pos,h);if(!map.size)return 0;let tr=view.state.tr;for(const h of [...map.values()].sort((a,b)=>b.pos-a.pos))tr=tr.delete(h.pos,h.pos+h.node.nodeSize);view.dispatch(tr);view.focus();return map.size}
function ensureEnd(view){const p=view.state.schema.nodes.paragraph;if(!p)throw new Error('paragraph nodeなし');if(view.state.doc.lastChild?.type!==p||view.state.doc.lastChild.textContent!=='')view.dispatch(view.state.tr.insert(view.state.doc.content.size,p.create()));view.dispatch(view.state.tr.setSelection(selectionAtEnd(view.state.doc?view:view)).scrollIntoView());view.focus()}
function insertWorkUrl(view,url){ensureEnd(view);const p=view.state.schema.nodes.paragraph,pos=view.state.doc.content.size,node=p.create(null,view.state.schema.text(url));view.dispatch(view.state.tr.insert(pos,node));const actual=view.state.doc.nodeAt(pos);if(actual?.type!==p||actual.textContent!==url)throw new Error('作業用URLを配置できません');view.dispatch(view.state.tr.setSelection(selectionAtEnd(view)).scrollIntoView());view.focus();return actual}
async function waitCard(view,url,beforeKeys,attempt,timeout=30000){
 const end=Date.now()+timeout;let errorAt=0;
 while(Date.now()<end){
  const hit=embedNodes(view).find(h=>{const k=cardKey(h);return k&&!beforeKeys.has(k)&&genuineCard(h,url)});if(hit)return hit;
  if(attempt.error){if(!errorAt)errorAt=Date.now();if(Date.now()-errorAt>=2500)throw attempt.error}
  if(stopRequested)throw new Error('手動停止');
  await sleep(120)
 }
 throw attempt.error||new Error('カード生成待ちタイムアウト')
}
function statusCode(e){return Number(e?.response?.status||e?.status||String(e?.message||'').match(/\b(401|403|429)\b/)?.[1]||0)}
function scanExisting(view,list){const embeds=embedNodes(view),map=new Map();for(const row of list){const hit=embeds.find(h=>genuineCard(h,row.url));if(hit)map.set(row.url,{url:row.url,key:cardKey(hit)})}return map}
function firstMissing(list,owned){for(let i=0;i<list.length;i++)if(!owned.has(list[i].url))return i;return list.length}
async function nativeSaveOnce(){
 setStatus('カード完了｜noteの下書き保存を1回だけ実行中…');
 await sleep(1200);
 const b=[...document.querySelectorAll('button')].find(x=>/^(一時保存|下書き保存)$/.test(x.textContent?.trim())&&x.getClientRects().length&&!x.disabled);
 if(!b)throw new Error('下書き保存ボタンを押せません。カードは本文に残っています');
 b.click();await sleep(7000)
}
async function run(){
 if(busy||!enabled())return;busy=true;stopRequested=false;updateButtons();
 try{
  const list=await rows(),view=findView();if(!view)throw new Error('編集画面を取得できません');
  nativeUrlCommand();
  const owned=scanExisting(view,list),start=firstMissing(list,owned);
  const prev=readState(),state={version:VERSION,articleKey:articleKey(),count:list.length,keys:[...owned.values()],startedAt:prev?.startedAt||Date.now(),updatedAt:Date.now(),stage:'building'};
  writeState(state);
  if(start>=list.length){setStatus('カード '+list.length+'/'+list.length+' すべて本文にあります ✅');return}
  setStatus('独立再検証開始｜既存 '+owned.size+'/'+list.length+'｜'+(start+1)+'番から');
  let session=0;
  for(let i=start;i<list.length;i++){
   const row=list[i];if(owned.has(row.url))continue;
   if(stopRequested)throw new Error('手動停止');
   const beforeKeys=new Set(embedNodes(view).map(cardKey).filter(Boolean)),beforeRaw=exactUrlParagraphs(view,row.url).length,work=insertWorkUrl(view,row.url),attempt={error:null};
   setStatus('通知カード '+owned.size+'/'+list.length+'｜'+(i+1)+'番 '+row.creator);
   const command=nativeUrlCommand()(row.url,e=>{attempt.error=e});
   const handled=command(view.state,(tr,consumed=work)=>{try{if(consumed!==work&&!consumed?.eq?.(work))throw new Error('作業用URLが変更されました');view.dispatch(tr)}catch(e){attempt.error=e}},view);
   if(!handled)throw new Error((i+1)+'番 note正規URLカード処理が未処理');
   let hit;
   try{hit=await waitCard(view,row.url,beforeKeys,attempt,30000)}
   catch(e){
    const recovered=embedNodes(view).find(h=>{const k=cardKey(h);return k&&!beforeKeys.has(k)&&genuineCard(h,row.url)});
    if(recovered)hit=recovered;else{
      const raws=exactUrlParagraphs(view,row.url);if(raws.length>beforeRaw)removeHits(view,[raws.at(-1)]);
      const code=statusCode(e);state.stage='paused';state.error=String(e?.message||e);state.errorCode=code;state.updatedAt=Date.now();writeState(state);
      throw new Error((i+1)+'番 '+row.creator+' で停止'+(code?' HTTP '+code:'')+'｜自動再試行なし')
    }
   }
   const raws=exactUrlParagraphs(view,row.url);if(raws.length>beforeRaw)removeHits(view,[raws.at(-1)]);
   const rec={url:row.url,key:cardKey(hit)};owned.set(row.url,rec);state.keys=[...owned.values()];state.updatedAt=Date.now();writeState(state);
   session++;setStatus('通知カード '+owned.size+'/'+list.length+' ✅｜3秒待機');
   await sleep(3000);
   if(session%10===0&&owned.size<list.length){setStatus('通知カード '+owned.size+'/'+list.length+'｜403回避 30秒休止');await sleep(30000)}
  }
  await nativeSaveOnce();
  state.stage='ready';state.completedAt=Date.now();state.updatedAt=Date.now();writeState(state);
  setStatus('通知カード '+owned.size+'/'+list.length+' 完了・保存操作済み ✅ 投稿後は「今回カード一括削除」');
 }catch(e){setStatus('停止：'+(e?.message||String(e))+'｜完成分は保持',true)}
 finally{busy=false;updateButtons()}
}
async function deleteCards(){
 if(busy||!enabled())return;busy=true;updateButtons();
 try{
  const list=await rows(),view=findView();if(!view)throw new Error('編集画面を取得できません');
  const state=readState(),known=new Set((state?.keys||[]).map(x=>String(x.key||'')).filter(Boolean)),targets=new Set(list.map(x=>x.url));
  const hits=embedNodes(view).filter(h=>known.has(cardKey(h))||targets.has(cardUrl(h)));
  const removed=removeHits(view,hits);
  setStatus('今回の通知カード '+removed+'件を本文から削除。下書き保存を1回実行中…');
  await nativeSaveOnce();
  localStorage.removeItem(stateKey());
  setStatus('今回カード '+removed+'件を削除・保存操作済み ✅');
 }catch(e){setStatus('カード削除停止：'+(e?.message||String(e)),true)}
 finally{busy=false;updateButtons()}
}
function stop(){stopRequested=true;setStatus('停止要求済み｜現在の1件が終わったら止まります')}
function updateButtons(){const p=document.getElementById(PANEL);if(!p)return;for(const b of p.querySelectorAll('button'))b.disabled=busy&&b.dataset.a!=='stop'}
function mount(){
 if(!enabled()||!document.body||document.getElementById(PANEL))return;
 const p=document.createElement('div');p.id=PANEL;p.style.cssText='position:fixed;right:8px;top:82px;z-index:2147483647;width:min(320px,calc(100vw - 16px));padding:9px;border:1px solid #4b748d;border-radius:12px;background:#07131d;color:#eef7ff;font:12px/1.4 system-ui;box-shadow:0 8px 28px #0008';
 p.innerHTML='<div style="font-weight:950;margin-bottom:7px">通知カード 再検証 ISOLATED v'+VERSION+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px"><button data-a="run">再検証開始／続き</button><button data-a="stop">停止</button><button data-a="delete" style="grid-column:1/-1">投稿後・今回カード一括削除</button></div><div id="'+STATUS+'" style="margin-top:7px;font-size:10px;color:#bfe8ff">INSIGHT非参照・自動開始なし・通信監視なし</div>';
 p.addEventListener('click',e=>{const a=e.target.closest('button[data-a]')?.dataset.a;if(a==='run')void run();if(a==='stop')stop();if(a==='delete')void deleteCards()});document.body.appendChild(p);updateButtons()
}
let tries=0;function boot(){mount();if(!document.getElementById(PANEL)&&tries++<60)setTimeout(boot,500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();