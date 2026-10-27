(function(){
'use strict';
if(location.hostname!=='editor.note.com')return;
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
const VERSION='2.8.2';
if(page.__MUMEI_PURCHASE_REVIEW_VERSION__===VERSION)return;
page.__MUMEI_PURCHASE_REVIEW_VERSION__=VERSION;
const PANEL='mumei-purchased-review-panel',STATUS=PANEL+'-status';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const norm=value=>{try{const url=new URL(String(value||''),location.href);url.search='';url.hash='';return url.href}catch{return String(value||'').trim()}};
const editorArticleKey=()=>location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1]||'';
const noteKey=url=>String(url||'').match(/\/n\/(n[a-f0-9]{12})(?:[/?#]|$)/i)?.[1]||'';
const runKey=()=> 'mumei_purchase_review_run_v1:'+(editorArticleKey()||'unknown');
// INCLUDED PURCHASE PACING
const CARD_SESSION='purchase-card-'+Date.now()+'-'+Math.random().toString(36).slice(2);
let busy=false,stopRequested=false,pauseRequested=false,nativeImageUploadActive=false,wakeLock=null,exportWaiter=null;
let viewCache=null,imageCommandCache=null,noteUrlCommandCache=null,selectionCache=null,activePhase='',cardWaitWake=null;
const activeRequests=new Set();
function coreBusy(){try{return Boolean(page.__MUMEI_PROFILE_CARD_CORE_BUSY__?.()||page.__MUMEI_PROFILE_CARD_FIXED_BUSY__?.())}catch{return false}}
async function keepAwake(){try{if(page.navigator?.wakeLock?.request&&!document.hidden)wakeLock=await page.navigator.wakeLock.request('screen')}catch{}}
async function releaseAwake(){try{await wakeLock?.release?.()}catch{}wakeLock=null}
function setStatus(text,bad=false){const node=document.getElementById(STATUS);if(node){node.textContent=text;node.dataset.bad=bad?'1':'0'}}
function notifyFixedState(){
 const panel=document.getElementById(PANEL);if(!panel)return;
 for(const node of panel.querySelectorAll('[data-purchase-import],[data-purchase-start],[data-purchase-cards],[data-purchase-delete-cards],[data-purchase-delete],[data-purchase-file]'))node.disabled=busy;
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
function deleteHits(view,hits){
 const before=view.state.doc;let tr=view.state.tr;
 for(const hit of [...new Map(hits.map(hit=>[hit.pos,hit])).values()].sort((a,b)=>b.pos-a.pos)){
  if(!before.nodeAt(hit.pos)?.eq(hit.node))throw Error('削除する本文位置が変わりました');
  tr=tr.delete(hit.pos,hit.pos+hit.node.nodeSize);
 }
 const expected=tr.doc;view.dispatch(tr);if(!expected?.eq?.(view.state.doc))throw Error('削除結果を確認できません');
 return hits.length;
}
async function waitPurchaseCardDelay(ms){
 if(pauseRequested||stopRequested||ms<=0)return;let wake;
 try{await Promise.race([sleep(ms),new Promise(resolve=>{wake=resolve;cardWaitWake=resolve})])}
 finally{if(cardWaitWake===wake)cardWaitWake=null}
}
async function pausePurchaseCardsAtBoundary(done,total){
 if(stopRequested)throw Error('停止しました');
 if(!pauseRequested||done>=total)return false;
 writeRun({...readRun(),stage:'cards_building',paused:true,pauseStage:'cards',pausedAt:Date.now()});await flushRunBackup();
 await saveOnce('通知カード '+done+'/'+total+'件で一時停止｜下書きを保存中…');
 setStatus('通知カード '+done+'/'+total+'件で一時停止しました。③で再開できます');return true;
}
async function pastePurchaseNotificationCards(){
 if(busy||coreBusy()){setStatus('実行中です。一時停止が完了してから再開してください',true);return;}
 busy=true;activePhase='cards';stopRequested=false;pauseRequested=false;notifyFixedState();
 try{
  const view=findView();if(!view)throw Error('note本文編集欄を取得できません');
  const tappedAnchor=notificationCardAnchorFromSelection(view),before=view.state.doc;
  await hydrateRunBackup();let run=readRun();
  if(!run?.purchasedReview||run.articleKey!==editorArticleKey())throw Error('先に②で紹介画像を完成させてください');
  const rows=validatePurchasedReview({format:PURCHASE_REVIEW_FORMAT,items:run.rows});
  if(!['images_ready','cards_building','complete'].includes(run.stage))throw Error('先に②で紹介画像を完成させてください');
  if(completedImagePrefix(rows,ownedImagesForRun(view,run))!==rows.length)throw Error('紹介画像の不足を確認しました。先に②で続きを完成させてください');
  if(!run.purchaseCardsStarted&&!run.pendingCard&&!(run.cardKeys||[]).length){
   if(view.state.doc!==before&&!view.state.doc.eq(before))throw Error('読み込み中に本文が変わりました。置く位置を選び直してください');
   run={...run,purchaseCardsStarted:true,cardAnchorPos:tappedAnchor,cardBaselineKeys:[...new Set([...(run.cardBaselineKeys||[]),...embedNodes(view).map(cardKey).filter(Boolean)])],cardBaselineNodes:embedNodes(view).map(hit=>({key:cardKey(hit),json:hit.node.toJSON?.()||null}))};
   writeRun(run);await flushRunBackup();
  }
  run=await reconcileCompletedCards(view,run,rows);
  const existing=resolveOwnedCardHits(view).sort((a,b)=>a.pos-b.pos);
  if(existing.length>rows.length||existing.some((hit,index)=>!genuineCard(hit,rows[index]?.url)))throw Error('通知カードの順序が保存記録と一致しません。完成分は保持しました');
  const done=existing.length;
  if(done===rows.length){
   if(run.stage==='complete'&&run.draftSaveState==='confirmed')setStatus('通知カード '+done+'件は貼り付け済みです');
   else await saveCompletedCards(rows.length,'通知カードは作成済み｜下書き保存を再確認中…');
   return;
  }
  let insertPos=done?existing.at(-1).pos+existing.at(-1).node.nodeSize:Number(run.cardAnchorPos);
  if(!Number.isFinite(insertPos))throw Error('通知カードの貼り付け位置を確認できません');
  writeRun({...run,stage:'cards_building',purchaseCardsStarted:true,paused:false,pauseStage:null});await flushRunBackup();
  await keepAwake();
  for(let index=done;index<rows.length;index++){
   if(await pausePurchaseCardsAtBoundary(index,rows.length))return;
   const row=rows[index],startedAt=Date.now();setStatus('通知カード '+(index+1)+'/'+rows.length+'｜'+row.creator+'さん');
   const made=await createNativeCard(view,row,insertPos);insertPos=made.nextPos;await flushRunBackup();
   if(await pausePurchaseCardsAtBoundary(index+1,rows.length))return;
   if(index+1<rows.length)await waitPurchaseCardDelay(Math.max(0,CARD_GAP_FAST-(Date.now()-startedAt)));
   if(await pausePurchaseCardsAtBoundary(index+1,rows.length))return;
   if((index+1)%10===0&&index+1<rows.length){await waitPurchaseCardDelay(CARD_BLOCK_PAUSE);if(await pausePurchaseCardsAtBoundary(index+1,rows.length))return;}
  }
  assertUniqueGeneratedCards(view,readRun(),rows);
  if(resolveOwnedCardHits(view).length!==rows.length)throw Error('通知カードに不足があります。③で続きから再開してください');
  await saveCompletedCards(rows.length,'通知カード '+rows.length+'件完成｜下書きを保存中…');
 }catch(error){setStatus('通知カード停止：'+(error?.message||String(error))+'｜完成分は記録済み。③で再開できます',true)}
 finally{busy=false;activePhase='';notifyFixedState();await releaseAwake()}
}
function assertPurchaseCardBoundary(view,run){
 if(run.pendingCard?.sessionId===CARD_SESSION&&!pendingPurchaseCardHit(view,run))throw Error('カード変換の結果がまだ未確認です。下書き保存後に再読み込みしてください');
}
function pendingPurchaseCardHit(view,run){
 const pending=run.pendingCard;if(!pending||!Number.isFinite(Number(pending.pos)))return null;
 const baseline=notificationCardBaselinePositions(view,run);
 return embedNodes(view).find(hit=>hit.pos===Number(pending.pos)&&!baseline.has(hit.pos)&&genuineCard(hit,pending.url))||null;
}
function purchaseNotificationCardHits(view,run){
 const baseline=notificationCardBaselinePositions(view,run),urls=new Set((run.rows||[]).map(row=>norm(row.url)));
 const tracked=resolveOwnedCardHits(view).filter(hit=>!baseline.has(hit.pos)&&(run.cardKeys||[]).some(record=>record.key===cardKey(hit)&&urls.has(norm(record.url))));
 const pending=pendingPurchaseCardHit(view,run);
 if(pending&&urls.has(norm(run.pendingCard.url)))tracked.push(pending);
 return[...new Map(tracked.map(hit=>[hit.pos,hit])).values()];
}
async function deletePurchaseNotificationCards(){
 if(busy||coreBusy()){setStatus('一時停止が完了してから削除してください',true);return;}
 busy=true;activePhase='delete';stopRequested=false;notifyFixedState();
 try{
  await hydrateRunBackup();const run=readRun(),view=findView();
  if(!run?.purchasedReview||!view||!run.purchaseCardsStarted&&!(run.cardKeys||[]).length&&!run.pendingCard){setStatus('今回の通知カードはまだありません');return;}
  if(run.articleKey!==editorArticleKey())throw Error('別の記事の作成記録です');
  assertPurchaseCardBoundary(view,run);
  const hits=purchaseNotificationCardHits(view,run),removed=hits.length?deleteVerifiedNotificationCardHits(view,hits):0;
  writeRun({...run,cardKeys:[],pendingCard:null,purchaseCardsStarted:false,cardAnchorPos:null,paused:false,pauseStage:null,stage:'images_ready'});await flushRunBackup();
  if(removed)await saveOnce('通知カード '+removed+'件だけ一括削除｜下書きを保存中…');
  setStatus('通知カード '+removed+'件だけ一括削除しました。紹介画像と本文は残っています');
 }catch(error){setStatus('通知カード削除：'+(error?.message||String(error)),true)}
 finally{busy=false;activePhase='';notifyFixedState()}
}
async function deletePurchasedReview(){
 if(busy||coreBusy()){setStatus('一時停止が完了してから削除してください',true);return;}
 busy=true;notifyFixedState();
 try{
  await hydrateRunBackup();const run=readRun(),view=findView();
  if(!run?.purchasedReview||!view){setStatus('この記事の購入記事紹介はまだありません');return;}
  if(run.articleKey!==editorArticleKey())throw Error('別の記事の記録です');
  assertPurchaseTracking(view,run);
  assertPurchaseCardBoundary(view,run);
  const images=ownedImagesForRun(view,run),hits=[...images];
  if(run.purchaseCardsStarted||(run.cardKeys||[]).length||run.pendingCard){
   hits.push(...purchaseNotificationCardHits(view,run));
  }
  for(const hit of images){const pos=hit.pos+hit.node.nodeSize,node=view.state.doc.nodeAt(pos);if((run.dividerUrls||[]).includes(hit.node.attrs?.link)&&isDivider(view,node))hits.push({node,pos})}
  let tr=view.state.tr;
  for(const hit of [...new Map(hits.map(hit=>[hit.pos,hit])).values()].sort((a,b)=>b.pos-a.pos)){
   if(!view.state.doc.nodeAt(hit.pos)?.eq(hit.node))throw Error('本文位置が変わりました。削除を停止しました');
   tr=tr.delete(hit.pos,hit.pos+hit.node.nodeSize);
  }
  const expected=tr.doc;view.dispatch(tr);
  if(!expected?.eq?.(view.state.doc))throw Error('削除結果を確認できません。作成記録は保持しました');
  writeRun(null);await flushRunBackup();await saveNativeDraftOnce('今回分を全削除｜下書きを保存中…');setStatus('今回の紹介画像・通知カード・区切り線を削除しました');
 }catch(error){setStatus(error?.message||String(error),true)}finally{busy=false;notifyFixedState()}
}
function mount(){
 if(!document.body||document.getElementById(PANEL))return;
 const style=document.createElement('style');style.id=PANEL+'-style';
 style.textContent=`#mumei-profile-card-paster-v1,#mumei-profile-card-paster-v1-mini{display:none!important}#${PANEL}{position:fixed;z-index:2147483647;right:4px;top:76px;width:min(132px,calc(100vw - 8px));padding:3px;border:1px solid #365b70;border-radius:8px;background:#07131d;color:#edf8ff;box-shadow:0 6px 16px #0008;font:7.2px/1.3 system-ui}#${PANEL} .head{display:grid;grid-template-columns:1fr 20px 20px;gap:2px;align-items:center;touch-action:none}#${PANEL} .title{font-weight:900;font-size:7.6px}#${PANEL} button{min-height:22px;border:1px solid #3b6378;border-radius:5px;background:#102b3b;color:#eaf9ff;font-weight:800;font-size:6.8px;touch-action:manipulation;padding:2px}#${PANEL} .body{display:grid;gap:3px;margin-top:3px}#${PANEL} .row{display:grid;grid-template-columns:1fr 1fr;gap:3px}#${PANEL} .hint{font-size:6.4px;color:#b7d4e4}#${PANEL} [data-purchase-start]{background:#176b54}#${PANEL} [data-purchase-delete]{background:#55212b}#${PANEL} [disabled]{opacity:.55}#${PANEL} [hidden]{display:none!important}#${STATUS}{font-size:6.4px;color:#bfe8ff;overflow-wrap:anywhere}#${STATUS}[data-bad="1"]{color:#ffb8b8}#${PANEL}.collapsed .body{display:none}#${PANEL}.tiny{display:none}#${PANEL}-mini{position:fixed;z-index:2147483647;right:7px;top:80px;width:30px;height:30px;display:none;border:1px solid #5fd4ee;border-radius:50%;background:#082333;color:#fff;font:800 8px system-ui}`;
 document.getElementById(style.id)?.remove();document.head.appendChild(style);
 const panel=document.createElement('div');panel.id=PANEL;
 panel.innerHTML='<div class="head"><span class="title">購入記事 v'+VERSION+'</span><button type="button" data-collapse>－</button><button type="button" data-close>×</button></div><div class="body"><div class="hint">小さめ通常サムネ＋記事紹介</div><input data-purchase-file type="file" accept="application/json,.json" hidden><div class="row"><button type="button" data-purchase-import>① 紹介データを選ぶ</button><button type="button" data-purchase-start>② 画像貼付／再開</button></div><button type="button" data-purchase-cards>③ 通知カード貼付／再開</button><div class="row"><button type="button" data-purchase-pause>一時停止</button><button type="button" data-purchase-stop>停止</button></div><div class="row"><button type="button" data-purchase-delete-cards>通知カードだけ一括削除</button><button type="button" data-purchase-delete>今回分を全削除</button></div><div id="'+STATUS+'">②画像→カードを置く位置をタップ→③</div></div>';
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
 panel.querySelector('[data-purchase-cards]').addEventListener('click',()=>void pastePurchaseNotificationCards());
 panel.querySelector('[data-purchase-delete-cards]').addEventListener('click',()=>void deletePurchaseNotificationCards());
 const pause=()=>{pauseRequested=true;cardWaitWake?.();setStatus(busy?'処理中の1件を記録して一時停止します':'停止中です。画像は②、通知カードは③で再開できます');notifyFixedState()};
 let pauseAt=-Infinity;
 for(const type of ['pointerdown','click'])panel.querySelector('[data-purchase-pause]').addEventListener(type,event=>{event.preventDefault();event.stopPropagation();if(Date.now()-pauseAt<650)return;pauseAt=Date.now();pause()});
 panel.querySelector('[data-purchase-stop]').addEventListener('click',()=>{stopRequested=true;cardWaitWake?.();abortRequests();setStatus('停止しました。完成分は記録済みです')});
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
