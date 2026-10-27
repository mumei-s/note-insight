(function(){
'use strict';
if(location.hostname!=='editor.note.com')return;
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
const VERSION='2.8.1';
if(page.__MUMEI_PURCHASE_REVIEW_VERSION__===VERSION)return;
page.__MUMEI_PURCHASE_REVIEW_VERSION__=VERSION;
const PANEL='mumei-purchased-review-panel',STATUS=PANEL+'-status';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const norm=value=>{try{const url=new URL(String(value||''),location.href);url.search='';url.hash='';return url.href}catch{return String(value||'').trim()}};
const editorArticleKey=()=>location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1]||'';
const runKey=()=> 'mumei_purchase_review_run_v1:'+(editorArticleKey()||'unknown');
let busy=false,stopRequested=false,pauseRequested=false,nativeImageUploadActive=false,wakeLock=null,exportWaiter=null;
let viewCache=null,imageCommandCache=null,selectionCache=null;
const activeRequests=new Set();
function coreBusy(){try{return Boolean(page.__MUMEI_PROFILE_CARD_CORE_BUSY__?.()||page.__MUMEI_PROFILE_CARD_FIXED_BUSY__?.())}catch{return false}}
async function keepAwake(){try{if(page.navigator?.wakeLock?.request&&!document.hidden)wakeLock=await page.navigator.wakeLock.request('screen')}catch{}}
async function releaseAwake(){try{await wakeLock?.release?.()}catch{}wakeLock=null}
function setStatus(text,bad=false){const node=document.getElementById(STATUS);if(node){node.textContent=text;node.dataset.bad=bad?'1':'0'}}
function notifyFixedState(){
 const panel=document.getElementById(PANEL);if(!panel)return;
 for(const node of panel.querySelectorAll('[data-purchase-import],[data-purchase-start],[data-purchase-delete],[data-purchase-file]'))node.disabled=busy;
 const pause=panel.querySelector('[data-purchase-pause]');if(pause){pause.disabled=false;pause.textContent=busy&&pauseRequested?'停止受付中…':'一時停止'}
}
function checkPause(){if(pauseRequested)throw Object.assign(new Error('一時停止しました。貼り付け／再開で続けられます'),{code:'PAUSED'})}
// INCLUDED PURCHASE HELPERS
const runStore=createStoredState(runKey,'mumei_purchase_review_backup_v1:');
function readRun(){return runStore.read()}
function writeRun(value){runStore.write(value)}
async function flushRunBackup(){await runStore.flush()}
async function hydrateRunBackup(){
 await runStore.hydrate();
 if(readRun())return readRun();
 const articleKey=editorArticleKey();let old=null;
 try{old=JSON.parse(localStorage.getItem('mumei_profile_card_paster_run_v15:'+articleKey)||'null')}catch{}
 if(old?.purchasedReview===true&&old.articleKey===articleKey){writeRun(old);await flushRunBackup()}
 return readRun();
}
async function deletePurchasedReview(){
 if(busy||coreBusy()){setStatus('一時停止が完了してから削除してください',true);return;}
 busy=true;notifyFixedState();
 try{
  await hydrateRunBackup();const run=readRun(),view=findView();
  if(!run?.purchasedReview||!view){setStatus('この記事の購入記事紹介はまだありません');return;}
  if(run.articleKey!==editorArticleKey())throw Error('別の記事の記録です');
  assertPurchaseTracking(view,run);
  const images=ownedImagesForRun(view,run),hits=[...images];
  for(const hit of images){const pos=hit.pos+hit.node.nodeSize,node=view.state.doc.nodeAt(pos);if((run.dividerUrls||[]).includes(hit.node.attrs?.link)&&isDivider(view,node))hits.push({node,pos})}
  let tr=view.state.tr;
  for(const hit of [...new Map(hits.map(hit=>[hit.pos,hit])).values()].sort((a,b)=>b.pos-a.pos)){
   if(!view.state.doc.nodeAt(hit.pos)?.eq(hit.node))throw Error('本文位置が変わりました。削除を停止しました');
   tr=tr.delete(hit.pos,hit.pos+hit.node.nodeSize);
  }
  const expected=tr.doc;view.dispatch(tr);
  if(!expected?.eq?.(view.state.doc))throw Error('削除結果を確認できません。作成記録は保持しました');
  writeRun(null);await flushRunBackup();await saveNativeDraftOnce('今回分を削除｜下書きを保存中…');setStatus('購入記事紹介 '+images.length+'件を削除しました');
 }catch(error){setStatus(error?.message||String(error),true)}finally{busy=false;notifyFixedState()}
}
function mount(){
 if(!document.body||document.getElementById(PANEL))return;
 const style=document.createElement('style');style.id=PANEL+'-style';
 style.textContent=`#mumei-profile-card-paster-v1,#mumei-profile-card-paster-v1-mini{display:none!important}#${PANEL}{position:fixed;z-index:2147483647;right:4px;top:76px;width:min(132px,calc(100vw - 8px));padding:3px;border:1px solid #365b70;border-radius:8px;background:#07131d;color:#edf8ff;box-shadow:0 6px 16px #0008;font:7.2px/1.3 system-ui}#${PANEL} .head{display:grid;grid-template-columns:1fr 20px 20px;gap:2px;align-items:center;touch-action:none}#${PANEL} .title{font-weight:900;font-size:7.6px}#${PANEL} button{min-height:22px;border:1px solid #3b6378;border-radius:5px;background:#102b3b;color:#eaf9ff;font-weight:800;font-size:6.8px;touch-action:manipulation;padding:2px}#${PANEL} .body{display:grid;gap:3px;margin-top:3px}#${PANEL} .row{display:grid;grid-template-columns:1fr 1fr;gap:3px}#${PANEL} .hint{font-size:6.4px;color:#b7d4e4}#${PANEL} [data-purchase-start]{background:#176b54}#${PANEL} [data-purchase-delete]{background:#55212b}#${PANEL} [disabled]{opacity:.55}#${PANEL} [hidden]{display:none!important}#${STATUS}{font-size:6.4px;color:#bfe8ff;overflow-wrap:anywhere}#${STATUS}[data-bad="1"]{color:#ffb8b8}#${PANEL}.collapsed .body{display:none}#${PANEL}.tiny{display:none}#${PANEL}-mini{position:fixed;z-index:2147483647;right:7px;top:80px;width:30px;height:30px;display:none;border:1px solid #5fd4ee;border-radius:50%;background:#082333;color:#fff;font:800 8px system-ui}`;
 document.getElementById(style.id)?.remove();document.head.appendChild(style);
 const panel=document.createElement('div');panel.id=PANEL;
 panel.innerHTML='<div class="head"><span class="title">購入記事 v'+VERSION+'</span><button type="button" data-collapse>－</button><button type="button" data-close>×</button></div><div class="body"><div class="hint">小さめ通常サムネ＋記事紹介</div><input data-purchase-file type="file" accept="application/json,.json" hidden><button type="button" data-purchase-import>① 紹介データを選ぶ</button><button type="button" data-purchase-start>② 貼り付け／再開</button><div class="row"><button type="button" data-purchase-pause>一時停止</button><button type="button" data-purchase-stop>停止</button></div><button type="button" data-purchase-delete>今回分を削除</button><div id="'+STATUS+'">データを選ぶ→本文の位置をタップ→②</div></div>';
 const file=panel.querySelector('[data-purchase-file]');
 panel.querySelector('[data-purchase-import]').addEventListener('click',()=>file.click());
 file.addEventListener('change',async()=>{
  try{
   if(busy)throw Error('実行中です。一時停止してから読み込んでください');
   const selected=file.files?.[0];if(!selected)return;if(selected.size>1024*1024)throw Error('紹介データは1MB以内にしてください');
   const rows=validatePurchasedReview(JSON.parse(await selected.text()));
   await Promise.resolve(GM_setValue(PURCHASE_REVIEW_PREPARED,{format:PURCHASE_REVIEW_FORMAT,items:rows}));
   setStatus(rows.length+'件を読込済み｜本文の位置をタップして②');
  }catch(error){setStatus(error?.message||String(error),true)}finally{file.value=''}
 });
 panel.querySelector('[data-purchase-start]').addEventListener('click',()=>void pastePurchasedReview());
 const pause=()=>{pauseRequested=true;setStatus(busy?'処理中の1件を記録して一時停止します':'停止中です。②で再開できます');notifyFixedState()};
 let pauseAt=-Infinity;
 for(const type of ['pointerdown','click'])panel.querySelector('[data-purchase-pause]').addEventListener(type,event=>{event.preventDefault();event.stopPropagation();if(Date.now()-pauseAt<650)return;pauseAt=Date.now();pause()});
 panel.querySelector('[data-purchase-stop]').addEventListener('click',()=>{stopRequested=true;abortRequests();setStatus('停止しました。完成分は記録済みです')});
 panel.querySelector('[data-purchase-delete]').addEventListener('click',()=>void deletePurchasedReview());
 panel.querySelector('[data-collapse]').addEventListener('click',()=>panel.classList.toggle('collapsed'));
 document.getElementById(PANEL+'-mini')?.remove();const mini=document.createElement('button');mini.id=PANEL+'-mini';mini.type='button';mini.textContent='記事';
 panel.querySelector('[data-close]').addEventListener('click',()=>{panel.classList.add('tiny');mini.style.display='block'});
 mini.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();panel.classList.remove('tiny','collapsed');mini.style.display='none'});
 for(const type of ['pointerdown','mousedown','touchstart','click','keydown','keyup','paste'])panel.addEventListener(type,event=>{event.stopPropagation();if(type==='mousedown'&&event.target.closest('button'))event.preventDefault()});
 let drag=null;const head=panel.querySelector('.head');
 head.addEventListener('pointerdown',event=>{if(event.target.closest('button'))return;const box=panel.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:box.left,top:box.top};head.setPointerCapture?.(event.pointerId)});
 head.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;event.preventDefault();panel.style.right='auto';panel.style.left=Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,drag.left+event.clientX-drag.x))+'px';panel.style.top=Math.max(4,Math.min(innerHeight-panel.offsetHeight-4,drag.top+event.clientY-drag.y))+'px'});
 for(const type of ['pointerup','pointercancel'])head.addEventListener(type,()=>{drag=null});
 document.body.append(panel,mini);notifyFixedState();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
window.addEventListener('pageshow',mount);
if(typeof MutationObserver==='function'){
 const observer=new MutationObserver(()=>{if(!document.getElementById(PANEL))mount()});
 observer.observe(document.documentElement,{childList:true,subtree:true});
}
})();
