(function(){
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
const INSIGHT_BRIDGE_KEY='mumei_profile_card_likes_300_v2';
if(location.hostname!=='editor.note.com')return;
const VERSION='2.5.8';
if(page.__MUMEI_PROFILE_CARD_CORE_VERSION__===VERSION)return;
page.__MUMEI_PROFILE_CARD_CORE_VERSION__=VERSION;
page.__MUMEI_PROFILE_CARD_PASTER_V1__=true;
const PANEL='mumei-profile-card-paster-v1';
const STATUS='mumei-profile-card-paster-status-v1';
const PREF='mumei_profile_card_paster_v1';
const POS='mumei_profile_card_paster_pos_v1';
const RUN_PREFIX='mumei_profile_card_paster_run_v15:';
const SPECIAL_LAST='mumei_profile_card_paster_special_last_v15';
const SPECIAL_EXCLUDED='mumei_profile_card_paster_special_excluded_v15';
const SPECIAL_RECOVERY_IMPORTED='mumei_profile_card_paster_special_recovery_v171';
const SPECIAL_RECOVERY_URLS=['https://note.com/ss_yr/n/n1b6e30eb9e41'];
const SPECIAL_SCAN_PREFIX='mumei_profile_special_scan_v181:';
const LIKE300_PREP_PREFIX='mumei_profile_like300_prep_v2:';
const FIRST_TAGS=['はじめてのnote','始めてのnote','自己紹介'];
const STRICT_FIRST_TAGS=new Set(['はじめてのnote','始めてのnote']);
const SELF_INTRO_TAG='自己紹介';
const WORKMOM_TAG='ワーママ';
const PARENTING_TAG='育児日記';
const WORKMOM_CONTEXT={
 explicit:/(?:ワーママ|働くママ|働くお母さん|働く母|仕事と育児|育児と仕事|仕事と子育て|子育てと仕事)/i,
 parent:/(?:ママ|お母さん|母親|母として|育児|子育て|子ども|子供|保育園|保育所|学童|育休|産休|授乳|出産|妊娠)/i,
 work:/(?:仕事|働|勤務|職場|会社|復職|時短|フルタイム|パート|正社員|キャリア|在宅ワーク|テレワーク|共働き|残業|転職|副業|フリーランス)/i
};
const PARENTING_CONTEXT={
 explicit:/(?:育児日記|育児記録|子育て日記|子育て記録|育児|子育て)/i,
 family:/(?:子ども|子供|赤ちゃん|乳児|幼児|園児|息子|娘|きょうだい|兄弟|姉妹|保育園|幼稚園|学童|小学生|離乳食|夜泣き|おむつ|寝かしつけ|育休|産休|出産)/i
};
const SPECIAL_NG=[
  {label:'ポルノ',re:/(?:ポルノ|アダルト動画|18禁|R-?18|エロ動画|セックス動画|AV女優|ヌード販売|自慰動画|性行為動画|援助交際)/i},
  {label:'ギャンブル',re:/(?:ギャンブル必勝|パチンコ攻略|パチスロ攻略|競馬予想販売|競艇予想販売|競輪予想販売|オンラインカジノ|ブックメーカー)/i},
  {label:'暴力',re:/(?:殺害予告|殺人予告|リンチ推奨|銃撃推奨|テロ賛美|自傷を勧め|自殺を勧め)/i},
  {label:'危険な稼ぎ方',re:/(?:必ず儲かる|絶対稼げる|元本保証|高額報酬保証|投資サロン勧誘|FX自動売買勧誘|仮想通貨勧誘|暗号資産勧誘|闇バイト)/i},
  {label:'その他NG',re:/(?:違法販売|詐欺商材|覚醒剤販売|大麻販売|薬物販売|マルチ商法勧誘|ネットワークビジネス勧誘|宗教勧誘|ヘイト扇動|差別煽動)/i}
];
// 普通の副業・在宅ワーク・フリーランス・仕事紹介・収益化体験・一般的な投資体験の記述は、勧誘や危険表現がなければ除外しない。
const W=860,H=140;
const FINAL_URL='https://note.com/fuku444/n/nb4f6934381e9';
const FINAL_KEY='nb4f6934381e9';
const SPEED_FACTOR=4.0;
const IMAGE_PASTE_GAP=180;
const CARD_GAP_FAST=Math.round(5000/SPEED_FACTOR);
const CARD_GAP_SLOW=Math.round(10000/SPEED_FACTOR);
const CARD_BLOCK_PAUSE=Math.round(30000/SPEED_FACTOR);
let busy=false,stopRequested=false,viewCache=null,imageCommandCache=null,noteUrlCommandCache=null,selectionCache=null,dragging=false,longTimer=0,suppressClickUntil=0,wakeLock=null;const activeRequests=new Set();
let cardPauseRequested=false,cardRunActive=false;
const CARD_SESSION='card-'+Date.now()+'-'+Math.random().toString(36).slice(2);
page.__MUMEI_PROFILE_CARD_CORE_BUSY__=()=>busy;
page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__=saveOnce;
page.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__=createCardsAtTap;
page.__MUMEI_PROFILE_CARD_DELETE_CARDS__=bulkDelete;
page.__MUMEI_PROFILE_CARD_PAUSE__=pauseCards;
function fixedRunBusy(){try{return Boolean(page.__MUMEI_PROFILE_CARD_FIXED_BUSY__?.())}catch{return false}}
function actionBlocked(){
 if(!busy&&!fixedRunBusy())return false;
 setStatus('実行中です。先に「停止」を押してください',true);return true
}
const scanKey=()=>SPECIAL_SCAN_PREFIX+(editorArticleKey()||'unknown');
const like300PrepKey=()=>LIKE300_PREP_PREFIX+(editorArticleKey()||'unknown');
async function keepAwake(){
 if(!page.navigator?.wakeLock?.request||document.hidden)return false;
 try{
  if(wakeLock&&!wakeLock.released)return true;
  wakeLock=await page.navigator.wakeLock.request('screen');
  wakeLock.addEventListener?.('release',()=>{wakeLock=null;if(!document.hidden&&(busy||readScan()?.active))setTimeout(()=>void keepAwake(),350)},{once:true});
  return true
 }catch{return false}
}
async function releaseAwake(){try{await wakeLock?.release?.()}catch{}wakeLock=null}
function readScan(){try{return JSON.parse(localStorage.getItem(scanKey())||'null')}catch{return null}}
function writeScan(v){try{if(v==null)localStorage.removeItem(scanKey());else localStorage.setItem(scanKey(),JSON.stringify(v))}catch{}}
function clearScan(){try{localStorage.removeItem(scanKey())}catch{}}
const gmGet=(k,d=null)=>Promise.resolve(GM_getValue(k,d));

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=v=>{try{const u=new URL(String(v||''),location.href);u.search='';u.hash='';return u.href}catch{return String(v||'').trim()}};
const noteKey=url=>String(url||'').match(/\/n\/(n[a-f0-9]{12})(?:[/?#]|$)/i)?.[1]||'';
const magazineKey=url=>String(url||'').match(/\/(?:m|magazines)\/(m[a-z0-9]+)(?:[/?#]|$)/i)?.[1]||'';
const editorArticleKey=()=>location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1]||'';
const runKey=()=>RUN_PREFIX+(editorArticleKey()||'unknown');
function readRun(){if(page.__MUMEI_PROFILE_CARD_RUN_STORE__)return page.__MUMEI_PROFILE_CARD_RUN_STORE__.read();try{return JSON.parse(localStorage.getItem(runKey())||'null')}catch{return null}}
function writeRun(v){if(page.__MUMEI_PROFILE_CARD_RUN_STORE__){page.__MUMEI_PROFILE_CARD_RUN_STORE__.write(v);return;}try{if(v==null)localStorage.removeItem(runKey());else localStorage.setItem(runKey(),JSON.stringify(v))}catch{}}
function mediaUrl(v){
 let raw='';
 if(typeof v==='string')raw=v;
 else if(v&&typeof v==='object')raw=v.url||v.src||v.path||v.image_url||v.imageUrl||'';
 raw=String(raw||'').trim();if(!raw)return'';
 if(raw.startsWith('//'))return'https:'+raw;
 if(/^https?:\/\//i.test(raw))return raw;
 if(raw.startsWith('/'))return'https://assets.st-note.com'+raw;
 if(/^production\//i.test(raw))return'https://assets.st-note.com/'+raw;
 return raw
}
function getPrefs(){try{return JSON.parse(localStorage.getItem(PREF)||'{}')||{}}catch{return{}}}
function setPrefs(v){try{localStorage.setItem(PREF,JSON.stringify(v))}catch{}}
function setStatus(t,bad=false){const e=document.getElementById(STATUS);if(e){e.textContent=t;e.dataset.bad=bad?'1':'0'}}
function xhr(url,responseType='text',timeout=60000){
 return new Promise((resolve,reject)=>{
  let req=null;
  const finish=()=>{if(req)activeRequests.delete(req)};
  req=GM_xmlhttpRequest({
   method:'GET',url,responseType,timeout,
   headers:{Accept:responseType==='blob'?'image/avif,image/webp,image/png,image/jpeg,*/*':'application/json,text/html,*/*'},
   onload:r=>{finish();if(stopRequested){reject(new Error('停止しました'));return}r.status>=200&&r.status<300?resolve(r.response):reject(new Error('GET '+r.status+' '+url))},
   onerror:()=>{finish();reject(new Error(stopRequested?'停止しました':'通信失敗 '+url))},
   ontimeout:()=>{finish();reject(new Error(stopRequested?'停止しました':'通信タイムアウト '+url))},
   onabort:()=>{finish();reject(new Error('停止しました'))}
  });
  if(req)activeRequests.add(req)
 })
}
function abortActiveRequests(){
 for(const req of [...activeRequests]){try{req.abort?.()}catch{}}
 activeRequests.clear()
}
async function xhrJSON(url){const raw=await xhr(url,'text');try{return JSON.parse(String(raw||''))}catch{throw new Error('JSON解析失敗 '+url)}}

function webpackRequire(){const chunks=page.webpackChunk_N_E;if(!chunks||typeof chunks.push!=='function')return null;let req=null;const id=996000000+Math.floor(Math.random()*900000);try{chunks.push([[id],{},r=>{req=r}])}catch{}return req}
function looksLikeView(v){try{return Boolean(v&&typeof v==='object'&&v.state?.doc&&v.state?.schema&&typeof v.dispatch==='function'&&v.dom&&typeof v.posAtDOM==='function')}catch{return false}}
function findView(){
 if(looksLikeView(viewCache)&&viewCache.dom?.isConnected)return viewCache;
 const root=document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror');if(!root)return null;
 const seen=new Set(),q=[];let seed=root;for(let i=0;i<6&&seed;i++,seed=seed.parentElement)q.push([seed,0]);
 let n=0;while(q.length&&n++<14000){const[v,d]=q.shift();if(!v||seen.has(v))continue;seen.add(v);if(looksLikeView(v))return viewCache=v;let keys=[];try{keys=Object.getOwnPropertyNames(v)}catch{continue}for(const k of keys){if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k))continue;let x;try{x=v[k]}catch{continue}if(looksLikeView(x))return viewCache=x;if(d<7&&x&&(typeof x==='object'||typeof x==='function')&&x!==page&&x!==document)q.push([x,d+1])}}return null
}
function nativeImageCommand(){
 if(imageCommandCache)return imageCommandCache;
 const req=webpackRequire();let cmd;try{cmd=req?.(94928)?.CwN}catch{}
 const src=typeof cmd==='function'?Function.prototype.toString.call(cmd):'';
 if(!(cmd?.length===4&&/Array\.from/.test(src)&&/imageUploading/.test(src)&&/entries/.test(src)))throw new Error('note正規画像処理を取得できません');
 return imageCommandCache=cmd
}
function selectionApi(){
 if(selectionCache)return selectionCache;
 const req=webpackRequire();let mod;try{mod=req?.(44044)}catch{}
 const Selection=mod?.Y1;
 if(typeof Selection?.atEnd!=='function')throw new Error('note内部Selectionを取得できません');
 return selectionCache=Selection
}
function ensureEndSelection(view){
 const paragraph=view.state.schema.nodes.paragraph;
 if(!paragraph)throw new Error('note段落を取得できません');
 const last=view.state.doc.lastChild;
 if(!last||last.type!==paragraph||last.textContent!=='')view.dispatch(view.state.tr.insert(view.state.doc.content.size,paragraph.create()));
 view.dispatch(view.state.tr.setSelection(selectionApi().atEnd(view.state.doc)).scrollIntoView());
 view.focus()
}
function imageNodes(view){const out=[];view.state.doc.descendants((node,pos)=>{if(node.type?.name==='image')out.push({node,pos})});return out}
function remoteImage(node){const src=String(node?.attrs?.src||'');return /^https:\/\//i.test(src)&&!/raw\.githubusercontent\.com/i.test(src)}
async function waitNewNoteImage(view,beforeIds,timeout=150000){
 const end=Date.now()+timeout;
 while(Date.now()<end){
  const fresh=imageNodes(view).filter(h=>{const id=String(h.node.attrs?.id||'');return id&&!beforeIds.has(id)&&remoteImage(h.node)}).sort((a,b)=>a.pos-b.pos);
  if(fresh.length===1)return fresh[0];
  if(fresh.length>1)return fresh.at(-1);
  if(stopRequested)throw new Error('停止しました');
  await sleep(120)
 }
 throw new Error('note画像アップロード待ちタイムアウト')
}
function relinkCaption(view,hit,row){
 const node=view.state.doc.nodeAt(hit.pos)||hit.node;
 if(node?.type?.name!=='image')throw new Error('画像ノードを確認できません');
 const caption=row.creator+'さん';
 const replacement=node.type.create({...node.attrs,link:row.url},view.state.schema.text(caption),node.marks);
 view.dispatch(view.state.tr.replaceWith(hit.pos,hit.pos+node.nodeSize,replacement));
 const id=String(replacement.attrs?.id||'');
 const after=imageNodes(view).find(h=>id&&String(h.node.attrs?.id||'')===id)||imageNodes(view).find(h=>h.pos===hit.pos);
 if(!after||norm(after.node.attrs?.link)!==norm(row.url)||String(after.node.textContent||'').trim()!==caption)throw new Error('画像リンク・名前キャプション設定に失敗しました');
 return after
}
function noteUrlCommandFactory(){
 if(noteUrlCommandCache)return noteUrlCommandCache;
 const req=webpackRequire();if(!req)throw new Error('note内部URL処理を取得できません');
 let candidate=null;try{candidate=req?.(94928)?.fjT}catch{}
 const right=v=>{
  if(typeof v!=='function')return false;
  let src='';try{src=Function.prototype.toString.call(v)}catch{}
  return src.includes('state.selection')&&src.includes('nodeBefore')&&src.includes('replaceRangeWith')&&src.includes('.then')
 };
 if(!right(candidate)){
  const loaded=Object.values(req.c||{}).flatMap(e=>{
   const x=e?.exports;
   if(typeof x==='function')return[x];
   return x&&typeof x==='object'?Object.values(x):[]
  });
  candidate=loaded.find(right)||null
 }
 if(!right(candidate))throw new Error('note正規URLカード処理が見つかりません');
 return noteUrlCommandCache=candidate
}
function embedNodes(view){const out=[];view.state.doc.descendants((node,pos)=>{if(node.type?.name==='embed')out.push({node,pos})});return out}
function cardKey(hit){return String(hit?.node?.attrs?.embeddedContentKey||'')}
function cardUrl(hit){return norm(hit?.node?.attrs?.src)}
function genuineCard(hit,url){
 const key=cardKey(hit),html=String(hit?.node?.attrs?.htmlForEmbed||'');
 if(!/^emb[a-z0-9]+$/i.test(key)||!html.includes('note-embed'))return false;
 if(cardUrl(hit)===norm(url))return true;
 try{
  const src=new URL(cardUrl(hit)),wanted=noteKey(url),embedded=src.pathname.match(/^\/embed\/notes\/(n[a-f0-9]{12})\/?$/i)?.[1];
  return src.origin==='https://note.com'&&Boolean(embedded)&&embedded===wanted
 }catch{return false}
}
function exactUrlParagraphs(view,url){
 const wanted=norm(url),out=[];
 view.state.doc.forEach((node,pos)=>{
  if(node.type===view.state.schema.nodes.paragraph&&norm((node.textContent||'').trim())===wanted)out.push({node,pos})
 });
 return out
}
function cardAnchorFromSelection(view){
 const sel=view.state.selection,$from=sel.$from;
 if(!$from)return view.state.doc.content.size;
 try{
  if($from.depth>=1){
   const node=$from.node(1),before=$from.before(1);
   if(node?.type===view.state.schema.nodes.paragraph&&!String(node.textContent||''))return before;
   return before+node.nodeSize
  }
 }catch{}
 return Math.max(0,Math.min(view.state.doc.content.size,Number(sel.from)||view.state.doc.content.size))
}
function insertWorkUrlAt(view,url,pos){
 const p=view.state.schema.nodes.paragraph;
 const at=Math.max(0,Math.min(view.state.doc.content.size,Number(pos)));
 view.dispatch(view.state.tr.insert(at,p.create(null,view.state.schema.text(url))));
 const node=view.state.doc.nodeAt(at);
 if(node?.type!==p||node.textContent!==url)throw new Error('通知カード用URLを指定位置へ配置できません');
 const Selection=selectionApi(),near=typeof Selection.near==='function'?Selection.near(view.state.doc.resolve(Math.max(0,Math.min(view.state.doc.content.size,at+node.nodeSize-1)))):Selection.atEnd(view.state.doc);
 view.dispatch(view.state.tr.setSelection(near).scrollIntoView());view.focus();
 return{node,pos:at}
}
async function waitNewCard(view,url,beforeKeys,attempt,timeout=45000){
 const end=Date.now()+timeout,errorGrace=2500;let errorAt=0;
 while(Date.now()<end){
  const hit=embedNodes(view).find(h=>{const k=cardKey(h);return k&&!beforeKeys.has(k)&&genuineCard(h,url)});
  if(hit)return hit;
  if(attempt.error){if(!errorAt)errorAt=Date.now();if(Date.now()-errorAt>=errorGrace)throw attempt.error}
  if(stopRequested)throw new Error('停止しました');
  await sleep(140)
 }
 throw attempt.error||new Error('正規通知カード生成タイムアウト')
}
function deleteExtraWorkUrl(view,url,beforeCount){
 const list=exactUrlParagraphs(view,url);
 if(list.length<=beforeCount)return 0;
 const extra=list.slice(beforeCount).sort((a,b)=>b.pos-a.pos);
 return deleteHits(view,extra)
}
function cardAnchor(run,fallback=0,view=null){
 const valid=run?.cardAnchorPos!=null&&run.cardAnchorPos!==''&&Number.isFinite(Number(run.cardAnchorPos));let anchor=valid?Math.max(0,Number(run.cardAnchorPos)):fallback;
 if(view){const records=new Map((run?.cardKeys||[]).map(card=>[String(card.key||''),card])),baseline=new Set(run?.cardBaselineKeys||[]);for(const hit of embedNodes(view)){const rec=records.get(cardKey(hit));if(rec&&!baseline.has(cardKey(hit))&&genuineCard(hit,rec.url))anchor=valid?Math.min(anchor,hit.pos):hit.pos<anchor?hit.pos:anchor}}
 return anchor
}
function generatedCardHits(view,run,rows=run?.rows||[]){
 const urls=new Map(rows.map(row=>[norm(row.url),row])),keys=new Map(rows.map(row=>[noteKey(row.url),row])),baseline=new Set(run?.cardBaselineKeys||[]),anchor=cardAnchor(run,0,view),out=[];
 for(const hit of embedNodes(view)){
  if(hit.pos<anchor||baseline.has(cardKey(hit)))continue;
  const src=cardUrl(hit);let row=urls.get(src);
  if(!row){try{const u=new URL(src),key=u.origin==='https://note.com'?u.pathname.match(/^\/embed\/notes\/(n[a-f0-9]{12})\/?$/i)?.[1]:'';row=key?keys.get(key):null}catch{}}
  if(row&&genuineCard(hit,row.url))out.push({...hit,targetUrl:norm(row.url)})
 }
 return out.sort((a,b)=>a.pos-b.pos)
}
function duplicateCardDetails(view,run,rows=run?.rows||[]){
 const counts=new Map();for(const hit of generatedCardHits(view,run,rows))counts.set(hit.targetUrl,(counts.get(hit.targetUrl)||0)+1);
 return rows.map(row=>({url:row.url,creator:row.creator,count:counts.get(norm(row.url))||0})).filter(row=>row.count>1)
}
function assertUniqueGeneratedCards(view,run,rows=run?.rows||[]){
 const duplicates=duplicateCardDetails(view,run,rows);
 if(duplicates.length)throw new Error('同じクリエイターのカードが重複しています：'+duplicates.slice(0,4).map(row=>row.creator+'さん '+row.count+'枚').join('・')+'。今ある内容は保持しました');
}
function emptyCardGap(view,from,to){
 let pos=from;
 while(pos<to){const node=view.state.doc.nodeAt?.(pos);if(node?.type?.name!=='paragraph'||String(node.textContent||'').trim()||!node.nodeSize)return false;pos+=node.nodeSize}
 return pos===to
}
function recordNativeCard(hit,row){
 const run=readRun()||{},cards=Array.isArray(run.cardKeys)?run.cardKeys:[],rec={url:row.url,key:cardKey(hit),creator:row.creator};
 const records=new Map(cards.map(card=>[String(card.key||''),card]));records.set(rec.key,rec);
 writeRun({...run,cardKeys:[...records.values()],pendingCard:null,updatedAt:Date.now()});return rec
}
async function reconcileCompletedCards(view,run,rows){
 assertUniqueGeneratedCards(view,run,rows);
 const hits=generatedCardHits(view,run,rows),cards=new Map((run.cardKeys||[]).map(card=>[String(card.key||''),card]));
 const anchor=cardAnchor(run,0,view);let pos=anchor,changed=false;
 for(let index=0;index<hits.length;index++){
  const hit=hits[index],row=rows[index];
  if(!row||!genuineCard(hit,row.url)||!emptyCardGap(view,pos,hit.pos))throw new Error('カードの途中に欠落または順序の違いがあります。今ある内容は保持しました');
  if(!cards.has(cardKey(hit))){cards.set(cardKey(hit),{url:row.url,key:cardKey(hit),creator:row.creator});changed=true}
  pos=hit.pos+hit.node.nodeSize;
 }
 const completedPending=run.pendingCard&&hits.some(hit=>genuineCard(hit,run.pendingCard.url));
 const normalizeAnchor=Number(run.cardAnchorPos)!==anchor;
 if(changed||completedPending||normalizeAnchor){writeRun({...run,cardAnchorPos:anchor,cardKeys:[...cards.values()],pendingCard:completedPending?null:run.pendingCard,updatedAt:Date.now()});await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.()}
 return changed||completedPending||normalizeAnchor?(readRun()||run):run
}
function knownCardFailure(error){return error?.cardTerminal===true||/\b(?:HTTP|status)\s*[:=]?\s*(?:400|401|403|404|409|410|413|415|422|429)\b/i.test(String(error?.message||error))||[400,401,403,404,409,410,413,415,422,429].includes(Number(error?.status||error?.statusCode))}
async function createNativeCard(view,row,insertPos){
 let run=readRun()||{},cards=Array.isArray(run.cardKeys)?run.cardKeys:[],baseline=new Set(run.cardBaselineKeys||[]);
 assertUniqueGeneratedCards(view,run);
 const existing=generatedCardHits(view,run).filter(hit=>genuineCard(hit,row.url));
 if(existing.length){
  const hit=existing[0];if(!emptyCardGap(view,insertPos,hit.pos))throw new Error('同じカードが別の位置にあります。再送せず、今ある内容を保持しました');
  const rec=recordNativeCard(hit,row);await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();return{rec,nextPos:hit.pos+hit.node.nodeSize}
 }
 if(run.pendingCard&&norm(run.pendingCard.url)===norm(row.url)&&run.pendingCard.sessionId===CARD_SESSION)throw new Error('前のカード変換の結果を確認できないため再送を停止しました。下書き保存→再読み込み→②で再開してください。今ある内容は保持しています');
 writeRun({...run,pendingCard:{sessionId:CARD_SESSION,url:row.url,pos:insertPos,startedAt:Date.now()},updatedAt:Date.now()});
 await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
 if(stopRequested)throw new Error('手動停止');
 const beforeKeys=new Set(embedNodes(view).map(cardKey).filter(Boolean)),rawBefore=exactUrlParagraphs(view,row.url).length;
 let requested=false,hit;
 try{
 if(stopRequested)throw new Error('手動停止');
 const work=insertWorkUrlAt(view,row.url,insertPos),workNode=work.node,attempt={error:null};
 const command=noteUrlCommandFactory()(row.url,e=>{attempt.error=e});requested=true;
 const handled=command(view.state,(tr,consumedNode=workNode)=>{
  try{
   if(consumedNode!==workNode&&!consumedNode?.eq?.(workNode))throw new Error('通知カード用URLが変更されました');
   view.dispatch(tr)
  }catch(e){attempt.error=e}
 },view);
 if(!handled){const error=new Error('note正規URLカード処理が未処理です');error.cardTerminal=true;throw error}
 try{hit=await waitNewCard(view,row.url,beforeKeys,attempt,45000)}
 catch(e){
  const recovered=embedNodes(view).find(h=>{const k=cardKey(h);return k&&!beforeKeys.has(k)&&genuineCard(h,row.url)});
  if(recovered)hit=recovered;else throw e
 }
 deleteExtraWorkUrl(view,row.url,rawBefore);
 hit=embedNodes(view).find(h=>cardKey(h)===cardKey(hit))||hit;
 if(!genuineCard(hit,row.url))throw new Error('正規通知カードの照合に失敗しました');
 assertUniqueGeneratedCards(view,readRun()||run);
 const rec=recordNativeCard(hit,row);
 return{rec,nextPos:hit.pos+hit.node.nodeSize}
 }catch(error){
  if(!requested||knownCardFailure(error)){deleteExtraWorkUrl(view,row.url,rawBefore);const current=readRun()||run;writeRun({...current,pendingCard:null,updatedAt:Date.now()});await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.()}
  throw error
 }
}

function parseLiker(item){
 const u=item?.user||{},urlname=String(u.urlname||'').trim(),id=String(u.key??u.id??urlname).trim();
 if(!id||!urlname)return null;
 return{likerKey:id,urlname,creator:String(u.nickname||u.name||urlname).trim(),actorUrl:'https://note.com/'+urlname,actorImageUrl:mediaUrl(u.user_profile_image_url||u.profileImageUrl||u.profile_image_url||u.user_profile_image_path||u.profile_image_path||u.profileImagePath||u.icon_url||u.image_url||'')}
}
function contentList(p){const d=p?.data&&typeof p.data==='object'?p.data:{};return Array.isArray(d.contents)?d.contents:Array.isArray(d.notes)?d.notes:[]}
function articleFromRaw(raw,creator={}){
 const note=raw?.note&&typeof raw.note==='object'?raw.note:raw;if(!note||typeof note!=='object')return null;
 const key=String(note.key||'').trim();if(!/^n[a-f0-9]{12}$/i.test(key))return null;
 const user=note.user||note.author||{},urlname=String(creator.urlname||user.urlname||'').trim();
 const url=norm(note.noteUrl||note.url||(urlname?'https://note.com/'+urlname+'/n/'+key:''));
 if(!url)return null;
 return{
  likerKey:String(creator.likerKey||user.key||user.id||urlname||key),urlname,
  creator:String(creator.creator||user.nickname||user.name||urlname||'noteクリエイター').trim(),
  actorUrl:String(creator.actorUrl||(urlname?'https://note.com/'+urlname:'')),
  actorImageUrl:mediaUrl(creator.actorImageUrl||user.user_profile_image_url||user.profileImageUrl||user.profile_image_url||user.user_profile_image_path||user.profile_image_path||user.profileImagePath||user.icon_url||user.image_url||''),
  url,title:String(note.name||note.title||'無題の記事').trim(),key,
  publishAt:String(note.publishAt||note.publish_at||note.published_at||note.created_at||'').trim()||null,
  thumbUrl:mediaUrl(note.eyecatch_url||note.image_url||note.imageUrl||note.thumbnail_url||note.thumbnailUrl||note.eyecatch?.url||note.eyecatch_image?.url||note.eyecatchImage?.url||note.image?.url||note.thumbnail?.url||'')
 }
}
async function creatorContents(id,pageNo=1,disabledPinned=true){return xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)+'/contents?kind=note&page='+pageNo+'&disabled_pinned='+(disabledPinned?'true':'false')+'&with_notes=false')}
async function chooseCreatorArticle(creator,choice){
 try{
  if(choice==='fixed'){
   const p=await creatorContents(creator.urlname,1,false);
   return articleFromRaw(contentList(p)[0],creator)
  }
  if(choice==='oldest'){
   const first=await creatorContents(creator.urlname,1,true),list=contentList(first);if(!list.length)return null;
   const d=first?.data&&typeof first.data==='object'?first.data:{},total=Number(d.totalCount||0),per=Math.max(1,list.length),lastPage=Math.min(500,total>0?Math.max(1,Math.ceil(total/per)):1);
   const lp=lastPage===1?first:await creatorContents(creator.urlname,lastPage,true),candidates=contentList(lp).map(x=>articleFromRaw(x,creator)).filter(Boolean);
   candidates.sort((a,b)=>new Date(a.publishAt||0)-new Date(b.publishAt||0));
   return candidates[0]||null
  }
  const p=await creatorContents(creator.urlname,1,true);
  return articleFromRaw(contentList(p)[0],creator)
 }catch{return null}
}
function parseUnifiedSources(raw){
 const out=[];
 for(const line0 of String(raw||'').split(/\r?\n/)){
  const line=line0.trim();if(!line)continue;
  const urls=line.match(/https?:\/\/[^\s,、]+/g)||[];
  for(const url of urls){
   if(noteKey(url))out.push({type:'note',value:norm(url),label:norm(url)});
   else if(magazineKey(url))out.push({type:'mag',value:norm(url),label:norm(url)})
  }
  const tags=[...line.matchAll(/#([^#\s,、]+)/g)].map(m=>m[1].trim()).filter(Boolean);
  for(const tag of tags)out.push({type:'tag',value:tag,label:'#'+tag});
  if(!urls.length&&!tags.length){
   const tag=line.replace(/^#+/,'').trim();
   if(tag)out.push({type:'tag',value:tag,label:'#'+tag})
  }
 }
 const seen=new Set();
 return out.filter(x=>{const k=x.type+'|'+x.value;if(seen.has(k))return false;seen.add(k);return true})
}
function normalizeSearch(j){
 const d=j?.data??j??{},notes=d.notes||{},arr=notes.contents||notes.notes||d.contents||[];
 return{arr:Array.isArray(arr)?arr:[],cursor:d?.cursor?.note??d.note_cursor??notes.next_cursor??notes.cursor??null,last:notes.is_last_page===true||notes.isLastPage===true}
}
function targetLimit(mode,count){return mode==='all'?Infinity:Math.max(0,Number(count||0))}
async function collectUnified(raw,mode,count,choice){
 const sources=parseUnifiedSources(raw),limit=targetLimit(mode,count);
 if(!sources.length||limit===0)return[];
 const out=[],seenUrls=new Set(),seenCreators=new Set(),collectedCreators=new Set(['fuku444']);
 const add=row=>{
  if(!row)return false;
  const u=norm(row.url);
  const creator=String(row.urlname||u.match(/^https:\/\/note\.com\/([^/?#]+)\/n\//i)?.[1]||row.likerKey||'').trim().toLowerCase();
  if(!u||u===norm(FINAL_URL)||seenUrls.has(u)||(creator&&collectedCreators.has(creator)))return false;
  seenUrls.add(u);if(creator)collectedCreators.add(creator);out.push({...row,url:u});return true
 };
 for(let si=0;si<sources.length&&out.length<limit;si++){
  const src=sources[si];
  if(stopRequested)throw new Error('停止しました');
  if(src.type==='note'){
   const key=noteKey(src.value);if(!key)continue;
   for(let pageNo=1;pageNo<=200&&out.length<limit;pageNo++){
    setStatus('入力 '+(si+1)+'/'+sources.length+'｜記事URLのスキ '+out.length+(mode==='all'?' / 全数':' / '+limit));
    const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(key)+'/likes?page='+pageNo+'&per=50');
    const list=Array.isArray(p?.data?.likes)?p.data.likes:[],creators=[];
    for(const item of list){
     const c=parseLiker(item);if(!c||seenCreators.has(c.likerKey))continue;
     seenCreators.add(c.likerKey);creators.push(c)
    }
    for(let i=0;i<creators.length&&out.length<limit;i+=5){
     const chosen=await Promise.all(creators.slice(i,i+5).map(c=>chooseCreatorArticle(c,choice)));
     for(const row of chosen){add(row);if(out.length>=limit)break}
    }
    if(list.length<50)break
   }
  }else if(src.type==='mag'){
   const key=magazineKey(src.value);if(!key)continue;
   let start=0;
   while(out.length<limit&&start<10000){
    setStatus('入力 '+(si+1)+'/'+sources.length+'｜マガジン '+out.length+(mode==='all'?' / 全数':' / '+limit));
    const p=await xhrJSON('https://note.com/api/v1/magazines/'+encodeURIComponent(key)+'/notes?start='+start+'&limit=100');
    const d=p?.data&&typeof p.data==='object'?p.data:{},list=Array.isArray(d.notes)?d.notes:[];
    for(const rawNote of list){add(articleFromRaw(rawNote,{}));if(out.length>=limit)break}
    start+=list.length;if(!list.length||list.length<100)break
   }
  }else if(src.type==='tag'){
   let cursor='0';
   for(let pageNo=1;pageNo<=250&&out.length<limit;pageNo++){
    setStatus('入力 '+(si+1)+'/'+sources.length+'｜#'+src.value+' '+out.length+(mode==='all'?' / 全数':' / '+limit));
    const p=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(src.value)+'&size=20&start='+encodeURIComponent(cursor)+'&sort=new');
    const q=normalizeSearch(p);if(!q.arr.length)break;
    for(const rawNote of q.arr){add(articleFromRaw(rawNote,{}));if(out.length>=limit)break}
    if(q.last||q.cursor==null||String(q.cursor)===String(cursor))break;
    cursor=String(q.cursor);await sleep(70)
   }
  }
 }
 return out
}
function readJSONKey(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function writeJSONKey(key,value){try{if(value==null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value))}catch{}}
function specialExcluded(){
 const raw=readJSONKey(SPECIAL_EXCLUDED,[]);
 return Array.isArray(raw)?raw:[]
}
function specialExcludedSets(){
 const arr=specialExcluded();
 return{
  urls:new Set(arr.map(x=>norm(x?.url)).filter(Boolean)),
  creators:new Set(arr.map(x=>String(x?.urlname||'').toLowerCase()).filter(Boolean)),
  keys:new Set(arr.map(x=>String(x?.key||noteKey(x?.url)||'')).filter(Boolean))
 }
}
function extractNoteKeysFromRecovery(raw,sourceKey=''){
 const text=String(raw||'');
 const out=new Set();
 const patterns=[
  /https?:\/\/note\.com\/[A-Za-z0-9_.-]+\/n\/(n[a-f0-9]{12})/ig,
  /https?:\/\/note\.com\/embed\/notes\/(n[a-f0-9]{12})/ig,
  /\/n\/(n[a-f0-9]{12})/ig,
  /\/embed\/notes\/(n[a-f0-9]{12})/ig
 ];
 for(const re of patterns){
  let m;while((m=re.exec(text)))out.add(String(m[1]||''))
 }
 out.delete(String(sourceKey||''));out.delete(FINAL_KEY);
 return out
}
async function recoverSpecialExclusionsFromPublishedArticles(){
 const imported=readJSONKey(SPECIAL_RECOVERY_IMPORTED,{});
 const current=specialExcluded(),seenKeys=new Set(current.map(x=>String(x?.key||noteKey(x?.url)||'')).filter(Boolean));
 let added=0;
 for(const url of SPECIAL_RECOVERY_URLS){
  const sourceKey=noteKey(url);if(!sourceKey||imported?.[url])continue;
  setStatus('初投稿者｜前回公開記事から重複除外を復元中…');
  let combined='';
  try{
   const api=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(sourceKey));
   combined+=JSON.stringify(api||{})
  }catch{}
  try{combined+=' '+String(await xhr(url,'text',60000)||'')}catch{}
  const keys=extractNoteKeysFromRecovery(combined,sourceKey);
  if(!keys.size)throw new Error('前回公開記事から掲載済み記事を確認できませんでした。重複防止のため初投稿案件を開始しません');
  for(const key of keys){
   if(seenKeys.has(key))continue;
   seenKeys.add(key);current.push({url:'',urlname:'',creator:'',key,confirmedAt:Date.now(),recoveredFrom:url});added++
  }
  writeJSONKey(SPECIAL_EXCLUDED,current);
  writeJSONKey(SPECIAL_RECOVERY_IMPORTED,{...(imported||{}),[url]:{at:Date.now(),count:keys.size}})
 }
 updateExcludedCount();
 if(added)setStatus('前回公開記事から '+added+'件を重複除外へ復元しました ✅');
 return added
}
function specialBlockedReason(text){
 const t=String(text||'');
 for(const rule of SPECIAL_NG)if(rule.re.test(t))return rule.label;
 return''
}
async function creatorSinglePublicArticle(row){
 if(!row?.urlname)return false;
 try{
  // 「1記事だけ」は公開note記事で厳密確認する。
  // 固定表示の有無で同一記事が重複して見えるケースもあるため、両方の一覧を照合する。
  const [plain,pinned,page2]=await Promise.all([
   creatorContents(row.urlname,1,true),
   creatorContents(row.urlname,1,false),
   creatorContents(row.urlname,2,true)
  ]);
  const d=plain?.data&&typeof plain.data==='object'?plain.data:{};
  const plainList=contentList(plain),pinnedList=contentList(pinned),secondList=contentList(page2);
  const totalRaw=d.totalCount??d.total_count??d.count??d.noteCount??d.note_count;
  if(totalRaw!==undefined&&totalRaw!==null&&String(totalRaw)!==''){
   const total=Number(totalRaw);
   if(!Number.isFinite(total)||total!==1)return false
  }
  if(plainList.length!==1||secondList.length!==0)return false;
  const keys=new Set(
   [...plainList,...pinnedList]
    .map(x=>articleFromRaw(x,{}))
    .filter(Boolean)
    .map(x=>noteKey(x.url))
    .filter(Boolean)
  );
  const wanted=noteKey(row.url);
  return Boolean(wanted&&keys.size===1&&keys.has(wanted))
 }catch{return false}
}
async function specialArticleText(row){
 let note={};
 try{const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));note=p?.data||p||{}}catch{}
 const parts=[
  row.title,note.name,note.title,note.description,note.body,note.body_html,note.bodyText,note.body_text,
  JSON.stringify(note.hashtags||note.tags||note.hashtag_names||[])
 ];
 try{
  const html=await xhr(row.url,'text',45000),doc=new DOMParser().parseFromString(String(html||''),'text/html');
  parts.push(doc.querySelector('article')?.textContent||doc.querySelector('main')?.textContent||'')
 }catch{}
 return parts.map(v=>String(v||'')).join(' ').replace(/\s+/g,' ').trim()
}
function exactWorkmomTag(value){
 return /(?:^|[^一-龯ぁ-んァ-ヶ々ーA-Za-z0-9_])#?ワーママ(?:$|[^一-龯ぁ-んァ-ヶ々ーA-Za-z0-9_])/i.test(String(value||''))
}
async function workmomArticleAudit(row){
 let note={},doc=null;
 try{const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));note=p?.data||p||{}}catch{}
 try{
  const html=String(await xhr(row.url,'text',45000)||'');
  doc=new DOMParser().parseFromString(html,'text/html')
 }catch{}
 const tagDump=JSON.stringify(note.hashtags||note.tags||note.hashtag_names||note.tag_names||note.note_hashtags||[]);
 let exactTag=exactWorkmomTag(tagDump);
 if(!exactTag&&doc){
  exactTag=[...doc.querySelectorAll('a')].some(a=>{
   const label=String(a.textContent||'').trim().replace(/^#/,'');
   let href=String(a.getAttribute('href')||'');try{href=decodeURIComponent(href)}catch{}
   return label===WORKMOM_TAG||href.includes('/hashtag/'+WORKMOM_TAG)
  })
 }
 if(!exactTag)return{ok:false,reason:'#ワーママタグ確認不可'};
 const parts=[
  row.title,note.name,note.title,note.description,note.body,note.body_html,note.bodyText,note.body_text,
  doc?.querySelector('article')?.textContent||doc?.querySelector('main')?.textContent||''
 ];
 const text=parts.map(v=>String(v||'')).join(' ').replace(/\s+/g,' ').trim();
 const blocked=specialBlockedReason(text);if(blocked)return{ok:false,reason:blocked};
 const relevant=WORKMOM_CONTEXT.explicit.test(text)||(WORKMOM_CONTEXT.parent.test(text)&&WORKMOM_CONTEXT.work.test(text));
 if(!relevant)return{ok:false,reason:'ワーママ文脈不足'};
 return{ok:true,reason:''}
}
async function collectWorkmom(mode,count){
 const limit=targetLimit(mode,count);if(limit===0)return[];
 let cursor='0',pageNo=0,scanned=0;const tested=new Set(),out=[];
 while(out.length<limit&&pageNo<250){
  if(stopRequested)throw new Error('停止しました');
  pageNo++;
  setStatus('#ワーママ案件｜新着 '+pageNo+'ページ｜確認 '+scanned+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit));
  const p=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(WORKMOM_TAG)+'&size=20&start='+encodeURIComponent(cursor)+'&sort=new');
  const q=normalizeSearch(p);if(!q.arr.length)break;
  for(const raw of q.arr){
   if(out.length>=limit)break;
   const row=articleFromRaw(raw,{}),u=norm(row?.url);
   if(!row||!u||u===norm(FINAL_URL)||tested.has(u))continue;
   tested.add(u);scanned++;
   setStatus('#ワーママ案件｜確認 '+scanned+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit)+'｜'+row.creator);
   const audit=await workmomArticleAudit({...row,url:u});
   if(!audit.ok)continue;
   out.push({...row,url:u,workmom:true});
   await sleep(80)
  }
  if(q.last||q.cursor==null||String(q.cursor)===String(cursor))break;
  cursor=String(q.cursor);await sleep(60)
 }
 return out
}

function exactParentingTag(value){
 return /(?:^|[^一-龯ぁ-んァ-ヶ々ーA-Za-z0-9_])#?育児日記(?:$|[^一-龯ぁ-んァ-ヶ々ーA-Za-z0-9_])/i.test(String(value||''))
}
async function parentingArticleAudit(row){
 let note={},doc=null;
 try{const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));note=p?.data||p||{}}catch{}
 try{
  const html=String(await xhr(row.url,'text',45000)||'');
  doc=new DOMParser().parseFromString(html,'text/html')
 }catch{}
 const tagDump=JSON.stringify(note.hashtags||note.tags||note.hashtag_names||note.tag_names||note.note_hashtags||[]);
 let exactTag=exactParentingTag(tagDump);
 if(!exactTag&&doc){
  exactTag=[...doc.querySelectorAll('a')].some(a=>{
   const label=String(a.textContent||'').trim().replace(/^#/,'');
   let href=String(a.getAttribute('href')||'');try{href=decodeURIComponent(href)}catch{}
   return label===PARENTING_TAG||href.includes('/hashtag/'+PARENTING_TAG)
  })
 }
 if(!exactTag)return{ok:false,reason:'#育児日記タグ確認不可'};
 const parts=[
  row.title,note.name,note.title,note.description,note.body,note.body_html,note.bodyText,note.body_text,
  doc?.querySelector('article')?.textContent||doc?.querySelector('main')?.textContent||''
 ];
 const text=parts.map(v=>String(v||'')).join(' ').replace(/\s+/g,' ').trim();
 // 検閲は既存共通ルールを必ず通す。副業という語そのものはNG条件に含めない。
 const blocked=specialBlockedReason(text);if(blocked)return{ok:false,reason:blocked};
 const relevant=PARENTING_CONTEXT.explicit.test(text)||PARENTING_CONTEXT.family.test(text);
 if(!relevant)return{ok:false,reason:'育児文脈不足'};
 return{ok:true,reason:''}
}
async function collectParenting(mode,count){
 const limit=targetLimit(mode,count);if(limit===0)return[];
 let cursor='0',pageNo=0,scanned=0;const tested=new Set(),out=[];
 while(out.length<limit&&pageNo<250){
  if(stopRequested)throw new Error('停止しました');
  pageNo++;
  setStatus('#育児日記案件｜新着 '+pageNo+'ページ｜確認 '+scanned+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit));
  const p=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(PARENTING_TAG)+'&size=20&start='+encodeURIComponent(cursor)+'&sort=new');
  const q=normalizeSearch(p);if(!q.arr.length)break;
  for(const raw of q.arr){
   if(out.length>=limit)break;
   const row=articleFromRaw(raw,{}),u=norm(row?.url);
   if(!row||!u||u===norm(FINAL_URL)||tested.has(u))continue;
   tested.add(u);scanned++;
   setStatus('#育児日記案件｜確認 '+scanned+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit)+'｜'+row.creator);
   const audit=await parentingArticleAudit({...row,url:u});
   if(!audit.ok)continue;
   out.push({...row,url:u,parenting:true});
   await sleep(80)
  }
  if(q.last||q.cursor==null||String(q.cursor)===String(cursor))break;
  cursor=String(q.cursor);await sleep(60)
 }
 return out
}

async function specialTagAudit(row,tag){
 let note={},doc=null;
 try{const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));note=p?.data||p||{}}catch{}
 try{const html=String(await xhr(row.url,'text',45000)||'');doc=new DOMParser().parseFromString(html,'text/html')}catch{}
 const tagDump=JSON.stringify(note.hashtags||note.tags||note.hashtag_names||note.tag_names||note.note_hashtags||[]);
 let exactTag=tagDump.includes(tag);
 if(!exactTag&&doc){
  exactTag=[...doc.querySelectorAll('a')].some(a=>{
   const label=String(a.textContent||'').trim().replace(/^#/,'');
   let href=String(a.getAttribute('href')||'');try{href=decodeURIComponent(href)}catch{}
   return label===tag||href.includes('/hashtag/'+tag)
  })
 }
 if(!exactTag)return{ok:false,reason:'#'+tag+'タグ確認不可'};
 const parts=[row.title,note.name,note.title,note.description,note.body,note.body_html,note.bodyText,note.body_text,doc?.querySelector('article')?.textContent||doc?.querySelector('main')?.textContent||''];
 const text=parts.map(v=>String(v||'')).join(' ').replace(/\s+/g,' ').trim();
 const blocked=specialBlockedReason(text);if(blocked)return{ok:false,reason:blocked};
 // #自己紹介はタグ実在を確認できれば採用対象。本文表現の型までは強制しない。
 return{ok:true,reason:''}
}
async function collectFirstNoteSpecial(mode,count,selectedTags){
 const limit=targetLimit(mode,count);
 if(limit===0)return[];
 const tags=(Array.isArray(selectedTags)?selectedTags:[]).filter(x=>FIRST_TAGS.includes(x));
 if(!tags.length)throw new Error('タグを1つ以上選んでください');
 await keepAwake();
 await recoverSpecialExclusionsFromPublishedArticles();
 const excluded=specialExcludedSets();
 const saved=readScan();
 const effectiveLimit=limit;
 const sig=JSON.stringify({tags:[...tags].sort(),limit:limit===Infinity?'all':limit});
 const liveLimit=()=>{
  if(mode==='all')return Infinity;
  const el=document.querySelector('#'+PANEL+' [data-special-count]');
  const n=Math.max(1,Math.min(1000,Number(el?.value||effectiveLimit||1)));
  return n
 };
 const anchorPos=Number(saved?.anchorPos||0)||null;
 let states,tested,out,scanned,rejects;
 if(saved?.version===1&&saved.signature===sig&&Array.isArray(saved.states)&&Array.isArray(saved.out)){
  states=saved.states.map(st=>({...st,buffer:Array.isArray(st.buffer)?st.buffer:[]}));
  tested=new Set(Array.isArray(saved.tested)?saved.tested:[]);
  out=saved.out;scanned=Number(saved.scanned||tested.size||0);rejects=saved.rejects&&typeof saved.rejects==='object'?saved.rejects:{};
  setStatus('途中保存から再開 ✅ 採用 '+out.length+'件｜確認済み '+tested.size+'件')
 }else{
  states=tags.map(tag=>({tag,cursor:'0',done:false,page:0,buffer:[]}));
  tested=new Set();out=[];scanned=0;rejects={};
  writeScan({version:1,signature:sig,states,tested:[],out,scanned,rejects,anchorPos,active:true,updatedAt:Date.now()})
 }
 const checkpoint=()=>writeScan({version:1,signature:sig,states,tested:[...tested],out,scanned,rejects,anchorPos,active:!stopRequested,updatedAt:Date.now()});
 const reject=reason=>{const key=String(reason||'その他');rejects[key]=Number(rejects[key]||0)+1};
 async function fill(st){
  while(!stopRequested&&!st.done&&!st.buffer.length&&st.page<250){
   st.page++;
   setStatus('第二弾｜#'+st.tag+' 新着 '+st.page+'ページ｜採用 '+out.length+(mode==='all'?' / 全数':' / '+liveLimit()));
   const p=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(st.tag)+'&size=20&start='+encodeURIComponent(st.cursor)+'&sort=new');
   const q=normalizeSearch(p),rows=[];
   for(const raw of q.arr){const row=articleFromRaw(raw,{}),u=norm(row?.url);if(row&&u&&u!==norm(FINAL_URL))rows.push({...row,url:u})}
   rows.sort((a,b)=>new Date(b.publishAt||0).getTime()-new Date(a.publishAt||0).getTime());
   st.buffer=rows;
   if(q.last||!q.arr.length||q.cursor==null||String(q.cursor)===String(st.cursor))st.done=true;else st.cursor=String(q.cursor);
   checkpoint();
   if(!st.buffer.length&&!st.done)await sleep(45)
  }
 }
 for(const st of states)if(!st.buffer.length&&!st.done)await fill(st);
 while(!stopRequested&&out.length<liveLimit()&&states.some(st=>st.buffer.length||!st.done)&&scanned<20000){
  if(out.length>=liveLimit()){checkpoint();setStatus('指定件数 '+liveLimit()+' に到達｜採用 '+out.length+'件で停止');break}
  if(document.hidden){checkpoint();setStatus('バックグラウンド継続中｜進捗は逐次保存')}
  for(const st of states)if(!st.buffer.length&&!st.done)await fill(st);
  if(stopRequested){checkpoint();throw new Error('停止しました')}
  let chosenState=null,chosenRow=null,chosenTime=-Infinity;
  for(const st of states){const row=st.buffer[0];if(!row)continue;const t=new Date(row.publishAt||0).getTime();if(!chosenRow||t>chosenTime){chosenState=st;chosenRow=row;chosenTime=t}}
  if(!chosenRow)break;
  chosenState.buffer.shift();scanned++;
  const u=norm(chosenRow.url),creator=String(chosenRow.urlname||'').toLowerCase(),key=noteKey(u);
  if(tested.has(u)){reject('同一記事重複');checkpoint();continue}
  tested.add(u);checkpoint();
  if(excluded.urls.has(u)||excluded.creators.has(creator)||excluded.keys.has(key)){reject('前回掲載済み');checkpoint();continue}
  setStatus('第二弾｜#'+chosenState.tag+'｜確認 '+tested.size+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+liveLimit()));
  const audit=await specialTagAudit(chosenRow,chosenState.tag);
  if(stopRequested){checkpoint();throw new Error('停止しました')}
  if(!audit.ok){reject(audit.reason);checkpoint();continue}
  if(STRICT_FIRST_TAGS.has(chosenState.tag)){
   const single=await creatorSinglePublicArticle(chosenRow);
   if(stopRequested){checkpoint();throw new Error('停止しました')}
   if(!single){reject('公開記事が1件ではない');checkpoint();continue}
  }
  out.push({...chosenRow,specialFirstNote:true,specialSourceTag:chosenState.tag});
  const topRejects=Object.entries(rejects).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>k+' '+v).join(' / ');
  setStatus('第二弾｜確認 '+tested.size+'｜採用 '+out.length+(topRejects?'｜除外上位 '+topRejects:''));
  checkpoint();
  await sleep(55)
 }
 checkpoint();
 return out
}
function saveSpecialLast(rows){
 const list=(rows||[]).filter(x=>x?.specialFirstNote).map(x=>({url:norm(x.url),urlname:String(x.urlname||''),creator:String(x.creator||''),key:String(x.key||''),at:Date.now()}));
 writeJSONKey(SPECIAL_LAST,{at:Date.now(),count:list.length,items:list,committed:false})
}
function commitSpecialLast({silent=false}={}){
 const last=readJSONKey(SPECIAL_LAST,null);
 const items=Array.isArray(last?.items)?last.items:[];
 if(!items.length){if(!silent)setStatus('前回の特別案件成功候補がありません',true);return 0}
 const current=specialExcluded(),seen=new Set(current.map(x=>String(x.key||noteKey(x.url)||'')+'|'+String(x.urlname||'').toLowerCase()));
 let added=0;
 for(const item of items){
  const k=String(item.key||noteKey(item.url)||'')+'|'+String(item.urlname||'').toLowerCase();
  if(seen.has(k))continue;
  seen.add(k);current.push({...item,confirmedAt:Date.now()});added++
 }
 writeJSONKey(SPECIAL_EXCLUDED,current);
 writeJSONKey(SPECIAL_LAST,{...last,committed:true,committedAt:Date.now()});
 updateExcludedCount();
 if(!silent)setStatus('成功分 '+added+'件を次回以降の除外対象へ登録しました ✅');
 return added
}
function clearSpecialExcluded(){
 const n=specialExcluded().length;
 if(!n){setStatus('除外登録は0件です');return}
 if(!page.confirm('初投稿者の除外登録 '+n+'件をすべて解除しますか？'))return;
 writeJSONKey(SPECIAL_EXCLUDED,[]);updateExcludedCount();setStatus('初投稿者の除外登録をクリアしました')
}
function updateExcludedCount(){
 const e=document.querySelector('[data-excluded-count]');if(e)e.textContent='除外 '+specialExcluded().length+'件'
}

async function articleMetaImage(url){
 try{
  const html=await xhr(url,'text',45000),doc=new DOMParser().parseFromString(String(html||''),'text/html');
  return mediaUrl(doc.querySelector('meta[property="og:image"]')?.content||doc.querySelector('meta[name="twitter:image"]')?.content||'')
 }catch{return''}
}
async function creatorProfile(id){
 if(!id)return null;
 try{
  const p=await xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)),d=p?.data??p??{},u=d.creator||d.user||d;
  return{
   creator:String(u.nickname||u.name||id).trim(),
   avatar:mediaUrl(u.user_profile_image_url||u.profile_image_url||u.profileImageUrl||u.user_profile_image_path||u.profile_image_path||u.profileImagePath||u.icon_url||u.image_url||'')
  }
 }catch{return null}
}
function activityLabelFromText(text){
 const t=String(text||'').replace(/\s+/g,' ');
 const rules=[
  [/(?:生成AI|ChatGPT|AI画像|AIイラスト|人工知能|プロンプト)/ig,'AI・創作'],
  [/(?:小説|詩|短歌|俳句|エッセイ|創作|物語|漫画|イラスト)/ig,'創作・表現'],
  [/(?:子育て|育児|家族|暮らし|日常|生活)/ig,'暮らし・日常'],
  [/(?:仕事|働き方|キャリア|副業|フリーランス|転職|ビジネス)/ig,'仕事・働き方'],
  [/(?:勉強|学習|資格|読書|本|教育|学び)/ig,'学び・読書'],
  [/(?:写真|カメラ|旅行|旅|散歩|観光)/ig,'写真・旅'],
  [/(?:料理|レシピ|食事|グルメ|カフェ)/ig,'食・料理'],
  [/(?:音楽|映画|アニメ|ゲーム|舞台|ドラマ)/ig,'エンタメ'],
  [/(?:プログラミング|開発|Web|アプリ|デザイン|IT)/ig,'IT・デザイン'],
  [/(?:お金|家計|資産運用|投資|NISA|株)/ig,'お金・暮らし']
 ];
 const scored=rules.map(([re,label])=>{const m=t.match(re);return{label,count:m?.length||0}}).filter(x=>x.count>0).sort((a,b)=>b.count-a.count);
 if(!scored.length)return'日々のことや気づきを発信';
 const labels=scored.slice(0,2).map(x=>x.label);
 return labels.join('・')+'について発信'
}
async function creatorActivity(row){
 const id=String(row?.urlname||'').trim();if(!id)return'日々のことや気づきを発信';
 try{
  const [prof,contents]=await Promise.all([
   xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)).catch(()=>({})),
   creatorContents(id,1,true).catch(()=>({}))
  ]);
  const p=prof?.data?.creator||prof?.data?.user||prof?.data||prof||{};
  const list=contentList(contents).slice(0,6);
  const dump=[
   p.profile,p.description,p.bio,p.introduction,p.self_introduction,p.note_intro,
   ...list.flatMap(x=>[x?.name,x?.title,x?.description,x?.body_text]),
   row?.title
  ].filter(Boolean).join(' ');
  return activityLabelFromText(dump)
 }catch{return activityLabelFromText(row?.title||'')}
}
async function enrich(row){
 let note={},user={},profile=null;
 try{
  const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));
  note=p?.data||p||{};user=note.user||note.author||{}
 }catch{}
 profile=await creatorProfile(row.urlname||String(user.urlname||'')).catch(()=>null);
 let thumb=mediaUrl(note.eyecatch_url||note.image_url||note.imageUrl||note.thumbnail_url||note.thumbnailUrl||note.eyecatch?.url||note.eyecatch_image?.url||note.eyecatchImage?.url||note.image?.url||note.thumbnail?.url||row.thumbUrl||'');
 if(!thumb)thumb=await articleMetaImage(row.url);
 let avatar=mediaUrl(user.user_profile_image_url||user.profileImageUrl||user.profile_image_url||user.user_profile_image_path||user.profile_image_path||user.profileImagePath||profile?.avatar||row.actorImageUrl||'');
 return{
  ...row,
  creator:String(profile?.creator||user.nickname||user.name||row.creator||row.urlname||'noteクリエイター').trim(),
  actorImageUrl:avatar,
  thumbUrl:thumb,
  title:String(note.name||note.title||row.title||'無題の記事').trim()
 }
}
async function buildRows(input,special=false,workmom=false,parenting=false){
 const raw=parenting?await collectParenting(input.mode,input.count):workmom?await collectWorkmom(input.mode,input.count):special?await collectFirstNoteSpecial(input.mode,input.count,input.specialTags):await collectUnified(input.sources,input.mode,input.count,input.choice);
 const seen=new Set(),rows=[];
 for(const row of raw){
  const u=norm(row?.url);if(!u||u===norm(FINAL_URL)||seen.has(u))continue;
  seen.add(u);rows.push({...row,url:u})
 }
 rows.push({
  likerKey:'final-performance-math',urlname:'fuku444',creator:'実績の算数',
  actorUrl:'https://note.com/fuku444',actorImageUrl:'',url:FINAL_URL,
  title:'実績の算数│3日半で0→1達成',key:FINAL_KEY,publishAt:null,thumbUrl:'',finalMarker:true
 });
 const out=[];
 for(let i=0;i<rows.length;i+=5){
  if(stopRequested)throw new Error('停止しました');
  setStatus('画像情報 '+out.length+'/'+rows.length+'…');
  out.push(...await Promise.all(rows.slice(i,i+5).map(enrich)))
 }
 return out.map((x,i)=>({...x,index:i+1,finalMarker:Boolean(x.finalMarker||norm(x.url)===norm(FINAL_URL))}))
}

async function buildRowsFromSavedSpecial(maxCount){
 const scan=readScan(),saved=Array.isArray(scan?.out)?scan.out:[];
 if(!saved.length)throw new Error('保存済みの採用候補がありません');
 const n=Math.max(1,Math.min(saved.length,Number(maxCount)||saved.length));
 const seen=new Set(),rows=[];
 for(const row of saved.slice(0,n)){
  const u=norm(row?.url);if(!u||u===norm(FINAL_URL)||seen.has(u))continue;
  seen.add(u);rows.push({...row,url:u,specialFirstNote:true})
 }
 rows.push({
  likerKey:'final-performance-math',urlname:'fuku444',creator:'実績の算数',
  actorUrl:'https://note.com/fuku444',actorImageUrl:'',url:FINAL_URL,
  title:'実績の算数│3日半で0→1達成',key:FINAL_KEY,publishAt:null,thumbUrl:'',finalMarker:true
 });
 const out=[];
 for(let i=0;i<rows.length;i+=5){
  if(stopRequested)throw new Error('停止しました');
  setStatus('保存済み採用分｜画像情報 '+out.length+'/'+rows.length+'…');
  out.push(...await Promise.all(rows.slice(i,i+5).map(enrich)))
 }
 return out.map((x,i)=>({...x,index:i+1,finalMarker:Boolean(x.finalMarker||norm(x.url)===norm(FINAL_URL))}))
}
async function prepareInsightLikePerson(person){
 const id=String(person?.urlname||'').trim();
 if(!id)return null;
 const creator={likerKey:String(person.likerKey||id),urlname:id,creator:String(person.creator||id),actorUrl:String(person.actorUrl||('https://note.com/'+id)),actorImageUrl:mediaUrl(person.actorImageUrl||'')};
 try{
  const [contents,prof]=await Promise.all([
   creatorContents(id,1,true),
   xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)).catch(()=>({}))
  ]);
  const list=contentList(contents);
  const latest=articleFromRaw(list[0],creator);
  if(!latest)return null;
  const p=prof?.data?.creator||prof?.data?.user||prof?.data||prof||{};
  const text=[
   p.profile,p.description,p.bio,p.introduction,p.self_introduction,p.note_intro,
   ...list.slice(0,6).flatMap(x=>[x?.name,x?.title,x?.description,x?.body_text]),
   latest.title
  ].filter(Boolean).join(' ');
  return{...latest,likesHistory:true,activityLabel:activityLabelFromText(text),likedAt:String(person.likedAt||'')}
 }catch{return null}
}
async function buildInsightLikeRows(target=300){
 const bridge=await gmGet(INSIGHT_BRIDGE_KEY,null);
 const people=Array.isArray(bridge?.people)?bridge.people:[];
 if(!people.length)throw new Error('INSIGHT側のスキ履歴準備がありません。下の「INSIGHTで準備」を押してください');
 const sig=String(bridge?.at||0)+'|'+target;
 let saved;try{saved=JSON.parse(localStorage.getItem(like300PrepKey())||'null')}catch{saved=null}
 let rows=Array.isArray(saved?.rows)&&saved.signature===sig?saved.rows:[],index=saved?.signature===sig?Number(saved.index||0):0;
 const seen=new Set(rows.map(x=>String(x.urlname||'').toLowerCase()).filter(Boolean));
 while(index<people.length&&rows.length<target){
  if(stopRequested)throw new Error('停止しました');
  const batch=people.slice(index,index+4);index+=batch.length;
  setStatus('INSIGHTスキ履歴｜活動確認 '+rows.length+'/'+target+'｜候補 '+index+'/'+people.length);
  const prepared=await Promise.all(batch.map(prepareInsightLikePerson));
  for(const row of prepared){
   const id=String(row?.urlname||'').toLowerCase();
   if(!row||!id||seen.has(id))continue;
   seen.add(id);rows.push(row);
   if(rows.length>=target)break
  }
  try{localStorage.setItem(like300PrepKey(),JSON.stringify({signature:sig,index,rows,updatedAt:Date.now()}))}catch{}
  await sleep(80)
 }
 if(rows.length<target)throw new Error('公開記事を確認できたクリエイターが '+rows.length+'人でした。INSIGHT側で再準備して候補を増やしてください');
 return rows.slice(0,target).map((x,i)=>({...x,index:i+1}))
}
function creatorHeadingText(groupIndex){
 const from=groupIndex*10+1,to=Math.min(from+9,300);
 return String(groupIndex+1).padStart(2,'0')+'｜'+from+'人目〜'+to+'人目のクリエイター様'
}
async function bitmapFromUrl(url){
 if(!url)return null;
 try{const blob=await xhr(url,'blob',45000);if('createImageBitmap'in page)return await page.createImageBitmap(blob);return await new Promise((resolve,reject)=>{const img=new page.Image(),u=page.URL.createObjectURL(blob);img.onload=()=>{page.URL.revokeObjectURL(u);resolve(img)};img.onerror=()=>{page.URL.revokeObjectURL(u);reject(new Error('画像読込失敗'))};img.src=u})}catch{return null}
}
function rounded(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath()}
function circle(ctx,x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.closePath()}
function fit(ctx,text,max){let s=String(text||'');if(ctx.measureText(s).width<=max)return s;while(s&&ctx.measureText(s+'…').width>max)s=[...s].slice(0,-1).join('');return s+'…'}
function lines(ctx,text,maxWidth,maxLines){const chars=[...String(text||'')],out=[];let line='';for(let i=0;i<chars.length;i++){const test=line+chars[i];if(line&&ctx.measureText(test).width>maxWidth){out.push(line);line=chars[i];if(out.length===maxLines-1){line=chars.slice(i).join('');break}}else line=test}if(line&&out.length<maxLines){while(line&&ctx.measureText(line+(line.length<String(text||'').length?'…':'')).width>maxWidth)line=[...line].slice(0,-1).join('');out.push(line+(out.length===maxLines-1&&line.length<String(text||'').length?'…':''))}return out.slice(0,maxLines)}
function designHash(value){
 let h=2166136261;
 for(const ch of String(value||'')){h^=ch.codePointAt(0)||0;h=Math.imul(h,16777619)}
 return h>>>0
}
function randomThinTheme(row){
 const themes=[
  {bg:'#ffffff',panel:'#ffffff',ink:'#101827',muted:'#64748b',line:'#d8e1ea',accent:'#22c3ee',soft:'#edfaff',kind:'minimal'},
  {bg:'#eef8ff',panel:'#ffffff',ink:'#10243a',muted:'#557086',line:'#b9d9ec',accent:'#5faee3',soft:'#dff3ff',kind:'wave'},
  {bg:'#fff8ed',panel:'#fffdf8',ink:'#33271e',muted:'#806b58',line:'#ead6ba',accent:'#e4a24d',soft:'#fff0d7',kind:'paper'},
  {bg:'#0b1622',panel:'#101f2e',ink:'#f5fbff',muted:'#9cc6da',line:'#294b60',accent:'#4ee6d6',soft:'#153544',kind:'cyber'},
  {bg:'#f7f7f7',panel:'#ffffff',ink:'#151515',muted:'#666666',line:'#cdcdcd',accent:'#111111',soft:'#eeeeee',kind:'mono'},
  {bg:'#effcf6',panel:'#fbfffd',ink:'#17352b',muted:'#58776b',line:'#bfe3d4',accent:'#37b98a',soft:'#dff7ed',kind:'ticket'},
  {bg:'#f7f1ff',panel:'#ffffff',ink:'#24143a',muted:'#745b8d',line:'#d9c5ee',accent:'#9c6ade',soft:'#eee2ff',kind:'orbit'},
  {bg:'#fff0f2',panel:'#fffafb',ink:'#3a1d27',muted:'#8a6170',line:'#efc5cf',accent:'#e76f91',soft:'#ffe1e8',kind:'stripe'},
  {bg:'#f3fbff',panel:'#ffffff',ink:'#12324a',muted:'#5d7587',line:'#c7ddea',accent:'#2b9ed8',soft:'#e5f5fc',kind:'grid'},
  {bg:'#fffdf3',panel:'#fffef8',ink:'#362f19',muted:'#7d7350',line:'#eadf9d',accent:'#d8b931',soft:'#fff6be',kind:'dots'},
  {bg:'#f4f8ff',panel:'#ffffff',ink:'#17243c',muted:'#65728b',line:'#ccd6eb',accent:'#5a74d6',soft:'#e7edff',kind:'diagonal'},
  {bg:'#fff5fa',panel:'#ffffff',ink:'#351a2b',muted:'#856278',line:'#eccdde',accent:'#d956a0',soft:'#ffe5f3',kind:'corner'},
  {bg:'#f3fff9',panel:'#ffffff',ink:'#15372a',muted:'#5f7d70',line:'#c5e7d7',accent:'#2da974',soft:'#e4f8ef',kind:'frame'},
  {bg:'#fff8f1',panel:'#fffdf9',ink:'#3b281a',muted:'#876d59',line:'#ead5c0',accent:'#e37b3d',soft:'#ffead8',kind:'split'},
  {bg:'#f9f6ff',panel:'#ffffff',ink:'#291c40',muted:'#75658a',line:'#d9cfeb',accent:'#7d5bc8',soft:'#eee6ff',kind:'ribbon'},
  {bg:'#effcff',panel:'#fbffff',ink:'#12343b',muted:'#5a7880',line:'#bfe4e8',accent:'#26afbd',soft:'#ddf7fa',kind:'bubbles'},
  {bg:'#fff7e8',panel:'#fffdfa',ink:'#382719',muted:'#88705a',line:'#efd9b7',accent:'#ef9c36',soft:'#ffebc8',kind:'sunrise'},
  {bg:'#f6fbf4',panel:'#ffffff',ink:'#22351c',muted:'#6f8069',line:'#d2e3cc',accent:'#69a850',soft:'#eaf5e4',kind:'zigzag'},
  {bg:'#eef5ff',panel:'#f9fbff',ink:'#16263d',muted:'#60738d',line:'#c3d3e9',accent:'#3f7fc5',soft:'#dce9f8',kind:'glass'},
  {bg:'#fffef7',panel:'#ffffff',ink:'#28251b',muted:'#77705d',line:'#ddd4b6',accent:'#b69443',soft:'#f6efd7',kind:'notebook'}
 ];
 const extraKinds=['chevron','cross','rings','pixel','dash','capsule','mountain','constellation','ladder','barcode','stamp','triangle','halftone','arc','beam','columns','steps','mesh','sprinkles','focus','lineburst','stack','circuit','seam','cloud','petal','tiles','radar','bracket','horizon'];
 const palettes=[
  ['#f4fbff','#ffffff','#142b3b','#607b8b','#cae2ed','#2da9d2','#e5f6fc'],
  ['#fff8fb','#ffffff','#3b1d2c','#866176','#efcbdc','#d95a9c','#ffe8f3'],
  ['#f7fff8','#ffffff','#173525','#68806f','#cfe6d5','#3aaa68','#e8f7ec'],
  ['#fffaf2','#fffefa','#39291b','#846e5a','#ead7bf','#d99240','#fff0da'],
  ['#f8f5ff','#ffffff','#2e2141','#78688e','#ddd2ec','#8062c9','#eee8fb'],
  ['#f6fbfa','#ffffff','#173431','#607b76','#cbe1dd','#3aa79b','#e5f5f2']
 ];
 for(let i=0;i<extraKinds.length;i++){
  const p=palettes[i%palettes.length];
  themes.push({bg:p[0],panel:p[1],ink:p[2],muted:p[3],line:p[4],accent:p[5],soft:p[6],kind:extraKinds[i]})
 }
 return themes[designHash(row?.key||row?.url||row?.creator)%themes.length]
}
function drawThinDecor(ctx,t){
 ctx.fillStyle=t.bg;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle=t.line;ctx.lineWidth=1.5;rounded(ctx,1,1,W-2,H-2,12);ctx.stroke();
 if(t.kind==='minimal'){
  ctx.fillStyle=t.accent;ctx.fillRect(0,0,6,H);
  ctx.fillStyle=t.soft;ctx.beginPath();ctx.arc(545,22,46,0,Math.PI*2);ctx.fill()
 }else if(t.kind==='wave'){
  const g=ctx.createLinearGradient(0,0,W,0);g.addColorStop(0,t.bg);g.addColorStop(1,t.soft);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.35;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,118);ctx.bezierCurveTo(180,70,340,150,560,92);ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='paper'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,74,H);
  ctx.strokeStyle=t.line;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(566,12);ctx.lineTo(566,H-12);ctx.stroke();ctx.setLineDash([])
 }else if(t.kind==='cyber'){
  ctx.fillStyle=t.panel;rounded(ctx,8,8,560,H-16,10);ctx.fill();
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.32;for(let x=18;x<560;x+=38){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+46,H);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='mono'){
  ctx.fillStyle=t.accent;ctx.fillRect(0,0,12,H);
  ctx.strokeStyle='#d7d7d7';for(let y=18;y<H;y+=18){ctx.beginPath();ctx.moveTo(18,y);ctx.lineTo(565,y);ctx.stroke()}
 }else if(t.kind==='ticket'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,W,H);
  ctx.fillStyle=t.panel;rounded(ctx,10,9,W-20,H-18,12);ctx.fill();
  ctx.strokeStyle=t.accent;ctx.setLineDash([6,5]);ctx.strokeRect(572,9,1,H-18);ctx.setLineDash([])
 }else if(t.kind==='orbit'){
  ctx.fillStyle=t.soft;ctx.beginPath();ctx.arc(526,72,74,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.45;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(520,70,100,38,-.25,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='stripe'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=t.line;ctx.globalAlpha=.6;for(let x=-100;x<W;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+80,H);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='grid'){
  ctx.strokeStyle=t.line;ctx.globalAlpha=.55;for(let x=0;x<570;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(570,y);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='dots'){
  ctx.fillStyle=t.accent;ctx.globalAlpha=.22;for(let y=14;y<H;y+=20)for(let x=14;x<570;x+=20){ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1
 }else if(t.kind==='diagonal'){
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.2;ctx.lineWidth=5;for(let x=-120;x<600;x+=44){ctx.beginPath();ctx.moveTo(x,H);ctx.lineTo(x+110,0);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='corner'){
  ctx.strokeStyle=t.accent;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(8,46);ctx.lineTo(8,8);ctx.lineTo(140,8);ctx.stroke();ctx.beginPath();ctx.moveTo(430,H-8);ctx.lineTo(566,H-8);ctx.lineTo(566,H-46);ctx.stroke()
 }else if(t.kind==='frame'){
  ctx.strokeStyle=t.accent;ctx.lineWidth=2;rounded(ctx,14,12,544,H-24,14);ctx.stroke();ctx.globalAlpha=.25;ctx.strokeStyle=t.line;rounded(ctx,21,19,530,H-38,11);ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='split'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,205,H);ctx.fillStyle=t.accent;ctx.globalAlpha=.18;ctx.beginPath();ctx.moveTo(205,0);ctx.lineTo(290,0);ctx.lineTo(205,H);ctx.closePath();ctx.fill();ctx.globalAlpha=1
 }else if(t.kind==='ribbon'){
  ctx.fillStyle=t.accent;ctx.globalAlpha=.16;ctx.beginPath();ctx.moveTo(0,18);ctx.lineTo(570,0);ctx.lineTo(570,28);ctx.lineTo(0,46);ctx.closePath();ctx.fill();ctx.globalAlpha=1
 }else if(t.kind==='bubbles'){
  ctx.fillStyle=t.accent;ctx.globalAlpha=.14;for(const p of [[505,25,40],[545,88,30],[455,105,22],[170,18,16]]){ctx.beginPath();ctx.arc(p[0],p[1],p[2],0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1
 }else if(t.kind==='sunrise'){
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.26;ctx.lineWidth=2;for(let a=0;a<Math.PI*2;a+=Math.PI/12){ctx.beginPath();ctx.moveTo(520,70);ctx.lineTo(520+Math.cos(a)*95,70+Math.sin(a)*95);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='zigzag'){
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.3;ctx.lineWidth=3;ctx.beginPath();for(let x=0;x<570;x+=24){const y=(x/24)%2?122:105;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='glass'){
  const g=ctx.createLinearGradient(0,0,570,H);g.addColorStop(0,'rgba(255,255,255,.8)');g.addColorStop(.5,'rgba(255,255,255,.15)');g.addColorStop(1,'rgba(255,255,255,.65)');ctx.fillStyle=g;rounded(ctx,10,9,552,H-18,14);ctx.fill();ctx.strokeStyle=t.line;ctx.stroke()
 }else if(t.kind==='notebook'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,28,H);ctx.strokeStyle=t.line;for(let y=18;y<H;y+=18){ctx.beginPath();ctx.moveTo(34,y);ctx.lineTo(566,y);ctx.stroke()}ctx.fillStyle=t.accent;for(let y=15;y<H;y+=22){ctx.beginPath();ctx.arc(14,y,3,0,Math.PI*2);ctx.fill()}
 }else if(t.kind==='chevron'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.25;ctx.lineWidth=4;for(let x=0;x<570;x+=42){ctx.beginPath();ctx.moveTo(x,20);ctx.lineTo(x+16,36);ctx.lineTo(x,52);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='cross'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.18;for(let y=18;y<H;y+=28)for(let x=18;x<570;x+=34){ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x+4,y);ctx.moveTo(x,y-4);ctx.lineTo(x,y+4);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='rings'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.22;for(const r of [18,34,50,66]){ctx.beginPath();ctx.arc(520,70,r,0,Math.PI*2);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='pixel'){ctx.fillStyle=t.accent;ctx.globalAlpha=.16;for(let y=8;y<132;y+=16)for(let x=8;x<568;x+=16)if(((x+y)/16)%3===0)ctx.fillRect(x,y,6,6);ctx.globalAlpha=1
 }else if(t.kind==='dash'){ctx.strokeStyle=t.accent;ctx.setLineDash([10,8]);ctx.globalAlpha=.32;for(let y=18;y<H;y+=26){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(570,y);ctx.stroke()}ctx.setLineDash([]);ctx.globalAlpha=1
 }else if(t.kind==='capsule'){ctx.fillStyle=t.soft;for(const p of [[430,16,100,18],[455,48,86,18],[408,80,126,18],[468,112,72,14]]){rounded(ctx,p[0],p[1],p[2],p[3],9);ctx.fill()}
 }else if(t.kind==='mountain'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.28;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,118);for(let x=0;x<570;x+=36)ctx.lineTo(x,118-(x/36%3)*16);ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='constellation'){ctx.strokeStyle=t.accent;ctx.fillStyle=t.accent;ctx.globalAlpha=.22;const q=[[420,22],[468,44],[520,28],[548,72],[490,96],[438,78]];ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();q.forEach(p=>{ctx.beginPath();ctx.arc(p[0],p[1],3,0,Math.PI*2);ctx.fill()});ctx.globalAlpha=1
 }else if(t.kind==='ladder'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.22;ctx.beginPath();ctx.moveTo(500,8);ctx.lineTo(500,132);ctx.moveTo(540,8);ctx.lineTo(540,132);for(let y=16;y<132;y+=18){ctx.moveTo(500,y);ctx.lineTo(540,y)}ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='barcode'){ctx.fillStyle=t.accent;ctx.globalAlpha=.18;for(let x=420;x<560;x+=7){ctx.fillRect(x,14,(x%5)+1,112)}ctx.globalAlpha=1
 }else if(t.kind==='stamp'){ctx.strokeStyle=t.accent;ctx.setLineDash([3,3]);ctx.globalAlpha=.35;rounded(ctx,420,20,125,86,12);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1
 }else if(t.kind==='triangle'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.18;for(let y=10;y<130;y+=24)for(let x=400;x<570;x+=28){ctx.beginPath();ctx.moveTo(x,y+16);ctx.lineTo(x+10,y);ctx.lineTo(x+20,y+16);ctx.closePath();ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='halftone'){ctx.fillStyle=t.accent;ctx.globalAlpha=.18;for(let y=16;y<128;y+=14)for(let x=420;x<564;x+=14){const r=1+((x+y)/14%4);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1
 }else if(t.kind==='arc'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.2;for(let r=28;r<120;r+=22){ctx.beginPath();ctx.arc(560,140,r,Math.PI,Math.PI*1.5);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='beam'){const g=ctx.createLinearGradient(0,0,570,H);g.addColorStop(0,'transparent');g.addColorStop(.52,t.soft);g.addColorStop(.7,'transparent');ctx.fillStyle=g;ctx.fillRect(0,0,570,H)
 }else if(t.kind==='columns'){ctx.fillStyle=t.accent;ctx.globalAlpha=.12;for(let x=390;x<570;x+=28)ctx.fillRect(x,8,14,H-16);ctx.globalAlpha=1
 }else if(t.kind==='steps'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.25;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(400,110);for(let i=0;i<7;i++){ctx.lineTo(400+i*24,110-i*12);ctx.lineTo(424+i*24,110-i*12)}ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='mesh'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.13;for(let x=380;x<590;x+=22){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-80,H);ctx.stroke();ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+80,H);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='sprinkles'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.24;for(let i=0;i<34;i++){const x=390+(i*37)%170,y=10+(i*29)%120;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+7,y+3);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='focus'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.28;ctx.lineWidth=2;for(const [x,y,dx,dy] of [[410,18,24,0],[410,18,0,24],[548,18,-24,0],[548,18,0,24],[410,122,24,0],[410,122,0,-24],[548,122,-24,0],[548,122,0,-24]]){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='lineburst'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.2;for(let a=0;a<Math.PI*2;a+=Math.PI/18){ctx.beginPath();ctx.moveTo(520,70);ctx.lineTo(520+Math.cos(a)*105,70+Math.sin(a)*70);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='stack'){ctx.fillStyle=t.soft;for(let i=0;i<5;i++){rounded(ctx,410+i*8,18+i*10,120-i*12,82-i*8,10);ctx.fill()}
 }else if(t.kind==='circuit'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.22;ctx.lineWidth=2;for(let y=24;y<120;y+=24){ctx.beginPath();ctx.moveTo(390,y);ctx.lineTo(450,y);ctx.lineTo(466,y+12);ctx.lineTo(552,y+12);ctx.stroke();ctx.beginPath();ctx.arc(552,y+12,3,0,Math.PI*2);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='seam'){ctx.strokeStyle=t.accent;ctx.setLineDash([2,5]);ctx.globalAlpha=.35;rounded(ctx,14,12,542,H-24,16);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1
 }else if(t.kind==='cloud'){ctx.fillStyle=t.soft;ctx.globalAlpha=.9;for(const p of [[438,46,28],[470,38,34],[505,50,30],[535,42,24]]){ctx.beginPath();ctx.arc(p[0],p[1],p[2],0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1
 }else if(t.kind==='petal'){ctx.fillStyle=t.accent;ctx.globalAlpha=.12;for(let a=0;a<Math.PI*2;a+=Math.PI/6){ctx.save();ctx.translate(510,70);ctx.rotate(a);ctx.beginPath();ctx.ellipse(0,-36,10,28,0,0,Math.PI*2);ctx.fill();ctx.restore()}ctx.globalAlpha=1
 }else if(t.kind==='tiles'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.16;for(let y=8;y<132;y+=24)for(let x=400;x<570;x+=24)ctx.strokeRect(x,y,18,18);ctx.globalAlpha=1
 }else if(t.kind==='radar'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.22;for(const r of [18,36,54]){ctx.beginPath();ctx.arc(510,70,r,0,Math.PI*2);ctx.stroke()}for(let a=0;a<Math.PI*2;a+=Math.PI/4){ctx.beginPath();ctx.moveTo(510,70);ctx.lineTo(510+Math.cos(a)*54,70+Math.sin(a)*54);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='bracket'){ctx.strokeStyle=t.accent;ctx.globalAlpha=.35;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(410,28);ctx.lineTo(410,16);ctx.lineTo(470,16);ctx.moveTo(550,112);ctx.lineTo(550,124);ctx.lineTo(490,124);ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='horizon'){ctx.fillStyle=t.soft;ctx.fillRect(0,92,570,48);ctx.strokeStyle=t.accent;ctx.globalAlpha=.28;ctx.beginPath();ctx.moveTo(0,92);ctx.lineTo(570,92);ctx.stroke();ctx.globalAlpha=1
 }
}
async function makeFile(row){
 const [avatar,thumb]=await Promise.all([bitmapFromUrl(row.actorImageUrl),bitmapFromUrl(row.thumbUrl)]);
 const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d'),theme=randomThinTheme(row);
 drawThinDecor(ctx,theme);
 const ax=50,ay=70,ar=34;
 ctx.fillStyle=theme.soft;circle(ctx,ax,ay,ar+2);ctx.fill();
 ctx.strokeStyle=theme.accent;ctx.lineWidth=2;circle(ctx,ax,ay,ar+2);ctx.stroke();
 if(avatar){const iw=avatar.width||avatar.naturalWidth||1,ih=avatar.height||avatar.naturalHeight||1,scale=Math.max((ar*2)/iw,(ar*2)/ih),dw=iw*scale,dh=ih*scale;ctx.save();circle(ctx,ax,ay,ar);ctx.clip();ctx.drawImage(avatar,ax-dw/2,ay-dh/2,dw,dh);ctx.restore()}
 else{ctx.fillStyle=theme.muted;ctx.font='800 24px system-ui';ctx.textAlign='center';ctx.fillText('n',ax,57);ctx.textAlign='start'}
 const tx=100,tw=455;ctx.textBaseline='top';
 if(row.activityLabel){
  ctx.fillStyle=theme.accent;ctx.font='800 12px system-ui,-apple-system,sans-serif';ctx.fillText(fit(ctx,'活動｜'+row.activityLabel,tw),tx,9);
  ctx.fillStyle=theme.ink;ctx.font='700 17px system-ui,-apple-system,sans-serif';lines(ctx,row.title,tw,2).forEach((v,i)=>ctx.fillText(v,tx,31+i*22));
  ctx.fillStyle=theme.muted;ctx.font='700 14px system-ui,-apple-system,sans-serif';ctx.fillText(fit(ctx,row.creator+'さん',tw),tx,84);
  ctx.fillStyle=theme.accent;ctx.font='700 11px system-ui,-apple-system,sans-serif';ctx.fillText('note',tx,109)
 }else{
  ctx.fillStyle=theme.ink;ctx.font='700 18px system-ui,-apple-system,sans-serif';lines(ctx,row.title,tw,2).forEach((v,i)=>ctx.fillText(v,tx,18+i*25));
  ctx.fillStyle=theme.muted;ctx.font='700 14px system-ui,-apple-system,sans-serif';ctx.fillText(fit(ctx,row.creator+'さん',tw),tx,86);
  ctx.fillStyle=theme.accent;ctx.font='700 12px system-ui,-apple-system,sans-serif';ctx.fillText('note',tx,110)
 }
 const ix=590,iy=8,iw=262,ih=124;ctx.fillStyle=theme.panel;rounded(ctx,ix,iy,iw,ih,8);ctx.fill();ctx.strokeStyle=theme.line;ctx.lineWidth=1;rounded(ctx,ix,iy,iw,ih,8);ctx.stroke();
 if(thumb){const sw=thumb.width||thumb.naturalWidth||1,sh=thumb.height||thumb.naturalHeight||1,scale=Math.max(iw/sw,ih/sh),dw=sw*scale,dh=sh*scale;ctx.save();rounded(ctx,ix,iy,iw,ih,8);ctx.clip();ctx.drawImage(thumb,ix+(iw-dw)/2,iy+(ih-dh)/2,dw,dh);ctx.restore()}
 else{ctx.fillStyle=theme.muted;ctx.font='800 24px system-ui';ctx.textAlign='center';ctx.fillText('note',ix+iw/2,55);ctx.textAlign='start'}
 try{avatar?.close?.()}catch{}try{thumb?.close?.()}catch{}
 const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('画像生成失敗')),'image/png',1));
 return new page.File([blob],'mumei_profile_note_v17_'+String(row.index).padStart(3,'0')+'.png',{type:'image/png'})
}
function sectionHeadingText(groupIndex){
 const from=groupIndex*10+1,to=from+9;
 return String(groupIndex+1).padStart(2,'0')+'｜'+from+'〜'+to+'人目の「はじめまして」'
}
function insertHeadingAt(view,text,pos){
 const type=view.state.schema.nodes.heading;if(!type)throw new Error('note見出しノードを取得できません');
 const at=Math.max(0,Math.min(view.state.doc.content.size,Number(pos)||0));
 let node;try{node=type.create({level:2},view.state.schema.text(text))}catch{node=type.create(null,view.state.schema.text(text))}
 view.dispatch(view.state.tr.insert(at,node));
 const actual=view.state.doc.nodeAt(at);
 if(!actual||actual.type?.name!=='heading'||String(actual.textContent||'')!==text)throw new Error('10人区切り見出しの挿入確認に失敗しました');
 return{pos:at,nextPos:at+actual.nodeSize}
}
function recordHeading(text){
 const run=readRun();if(!run)return;
 const headings=Array.isArray(run.sectionHeadings)?run.sectionHeadings:[];
 if(!headings.includes(text))headings.push(text);
 writeRun({...run,sectionHeadings:headings,updatedAt:Date.now()})
}
function resolveOwnedHeadingHits(view){
 const run=readRun(),wanted=new Set(Array.isArray(run?.sectionHeadings)?run.sectionHeadings:[]),out=[];
 if(!wanted.size)return out;
 view.state.doc.descendants((node,pos)=>{if(node.type?.name==='heading'&&wanted.has(String(node.textContent||'')))out.push({node,pos})});
 return out
}
function resolveOwnedActivityHits(view){
 const run=readRun(),counts=new Map(),out=[];
 for(const text of Array.isArray(run?.activityTexts)?run.activityTexts:[]){
  const value=String(text||'');if(value)counts.set(value,(counts.get(value)||0)+1)
 }
 if(!counts.size)return out;
 const anchor=Math.max(0,Number(run.imageAnchorPos)||0);
 view.state.doc.descendants((node,pos)=>{
  if(pos<anchor||node.type?.name!=='paragraph')return;
  const text=String(node.textContent||''),remaining=counts.get(text)||0;
  if(remaining>0){out.push({node,pos});counts.set(text,remaining-1)}
 });
 return out
}
function findHeadingByText(view,text){
 let hit=null;
 view.state.doc.descendants((node,pos)=>{if(!hit&&node.type?.name==='heading'&&String(node.textContent||'')===String(text||''))hit={node,pos}});
 return hit
}
function setSelectionForInsert(view,pos){
 const max=view.state.doc.content.size;
 const at=Math.max(0,Math.min(max,Number(pos)||0));
 const Selection=selectionApi();
 const resolved=view.state.doc.resolve(at);
 const sel=typeof Selection.near==='function'?Selection.near(resolved):Selection.atEnd(view.state.doc);
 view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
 view.focus();
 return view.state.selection.from
}
async function uploadOne(view,row,file,insertPos){
 const before=new Set(imageNodes(view).map(h=>String(h.node.attrs?.id||'')).filter(Boolean));
 const selected=setSelectionForInsert(view,insertPos);
 const dt=new page.DataTransfer();dt.items.add(file);
 if(nativeImageCommand()(view,dt.files,Math.max(0,selected-1),'image')!==true)throw new Error(row.index+'番 画像アップロードを開始できません');
 const hit=await waitNewNoteImage(view,before,150000);
 const linked=relinkCaption(view,hit,row);
 const actual=imageNodes(view).find(h=>{
  const id=String(linked?.node?.attrs?.id||'');
  return (id&&String(h.node.attrs?.id||'')===id)||h.pos===linked.pos
 })||linked;
 return{hit:actual,nextPos:actual.pos+actual.node.nodeSize}
}
function recordImage(hit,row){
 const run=readRun()||{version:VERSION,articleKey:editorArticleKey(),items:[],createdAt:Date.now()};
 const rec={id:String(hit?.node?.attrs?.id||''),src:String(hit?.node?.attrs?.src||''),url:norm(row.url),creator:String(row.creator||''),at:Date.now()};
 const items=Array.isArray(run.items)?run.items:[];
 const key=(x)=>String(x.id||'')+'|'+String(x.src||'')+'|'+norm(x.url);
 if(!items.some(x=>key(x)===key(rec)))items.push(rec);
 writeRun({...run,version:VERSION,articleKey:editorArticleKey(),items,updatedAt:Date.now()})
}
function legacyOwnedMarker(node){
 return Object.values(node?.attrs||{}).some(v=>/mumei_profile_note_v1/i.test(String(v||'')))
}
function resolveOwnedImageHits(view){
 const run=readRun(),records=Array.isArray(run?.items)?run.items:[],all=imageNodes(view),owned=new Map();
 for(const rec of records){
  const byId=rec.id?all.find(h=>String(h.node.attrs?.id||'')===String(rec.id)):null;
  if(byId&&norm(byId.node.attrs?.link)===norm(rec.url)){owned.set(byId.pos,byId);continue}
  if(rec.src){
   const matches=all.filter(h=>String(h.node.attrs?.src||'')===String(rec.src)&&norm(h.node.attrs?.link)===norm(rec.url));
   if(matches.length===1)owned.set(matches[0].pos,matches[0])
  }
 }
 for(const h of all)if(legacyOwnedMarker(h.node))owned.set(h.pos,h);
 return[...owned.values()]
}
function deleteHits(view,hits){
 const uniq=[...new Map((hits||[]).map(h=>[h.pos,h])).values()].sort((a,b)=>b.pos-a.pos);
 if(!uniq.length)return 0;
 let tr=view.state.tr;
 for(const h of uniq){
  const node=view.state.doc.nodeAt(h.pos);
  if(!node||!node.eq(h.node))throw new Error('本文位置が変わったため削除を停止しました');
  tr=tr.delete(h.pos,h.pos+h.node.nodeSize)
 }
 view.dispatch(tr);ensureEndSelection(view);return uniq.length
}
async function saveOnce(label='貼り付け完了｜下書き保存を1回だけ実行中…'){
 setStatus(label);await sleep(1500);
 const b=[...document.querySelectorAll('button')].find(x=>/^(一時保存|下書き保存)$/.test(x.textContent?.trim())&&x.getClientRects().length&&!x.disabled);
 if(b){b.click();await sleep(6000)}
}
function resolveOwnedCardHits(view){
 const run=readRun(),cards=Array.isArray(run?.cardKeys)?run.cardKeys:[],baseline=new Set(run?.cardBaselineKeys||[]),hits=new Map();
 for(const rec of cards){
  if(baseline.has(String(rec.key||'')))continue;
  const hit=embedNodes(view).find(h=>cardKey(h)===String(rec.key||'')&&genuineCard(h,rec.url));
  if(hit)hits.set(cardKey(hit),hit)
 }
 return[...hits.values()]
}
async function auditGeneratedDuplicates(){
 try{
 await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.hydrate?.();
 const view=findView(),run=readRun();if(!view||!Array.isArray(run?.rows))throw new Error('現在の記事の一覧を確認できません。本文は保持しています');
 const rows=run.rows,urls=new Set(rows.map(row=>norm(row.url))),images=imageNodes(view).filter(hit=>hit.pos>=Math.max(0,Number(run.imageAnchorPos)||0)&&urls.has(norm(hit.node.attrs?.link))),imageCounts=new Map();
 for(const hit of images){const url=norm(hit.node.attrs?.link);imageCounts.set(url,(imageCounts.get(url)||0)+1)}
 const hasCardAnchor=run.cardAnchorPos!=null&&run.cardAnchorPos!==''&&Number.isFinite(Number(run.cardAnchorPos));
 const cards=hasCardAnchor?generatedCardHits(view,run,rows):[];
 const duplicateImages=rows.map(row=>({creator:row.creator,url:row.url,count:imageCounts.get(norm(row.url))||0})).filter(row=>row.count>1);
 const duplicateCards=hasCardAnchor?duplicateCardDetails(view,run,rows):[];
 const names=[...new Set([...duplicateImages,...duplicateCards].map(row=>row.creator))];
 setStatus('重複確認｜画像 '+images.length+'件｜カード '+cards.length+'件｜'+(names.length?'重複 '+names.slice(0,5).join('・'):'現在の貼り付け範囲に重複なし'),names.length>0);
 return{imageCount:images.length,cardCount:cards.length,duplicateImages,duplicateCards,duplicateCreators:names}
 }catch(error){setStatus('重複確認停止：'+(error?.message||String(error)),true);return{error:error?.message||String(error)}}
}
page.__MUMEI_PROFILE_CARD_AUDIT_DUPLICATES__=auditGeneratedDuplicates;
function trackedContentCount(view){
 if(!readRun())return{images:0,cards:0,headings:0,activities:0};
 return{images:resolveOwnedImageHits(view).length,cards:resolveOwnedCardHits(view).length,headings:resolveOwnedHeadingHits(view).length,activities:resolveOwnedActivityHits(view).length}
}
function recoverNotificationCardHits(view,run){
 const baseline=new Set(run.cardBaselineKeys||[]);
 const urls=new Set((run.rows||[]).map(row=>norm(row.url)));
 const linked=new Set(imageNodes(view).map(hit=>norm(hit.node.attrs?.link)).filter(url=>urls.has(url)&&noteKey(url)));
 const wanted=new Set([...linked].map(noteKey));
 const tracked=new Map((run.cardKeys||[]).filter(rec=>noteKey(rec.url)&&rec.key).map(rec=>[String(rec.key),noteKey(rec.url)]));
 const anchor=run.cardAnchorPos,hasAnchor=anchor!=null&&anchor!==''&&Number.isFinite(Number(anchor))&&Number(anchor)>=0&&Number(anchor)<=view.state.doc.content.size;
 return embedNodes(view).filter(hit=>{
  if(baseline.has(cardKey(hit)))return false;
  const raw=String(hit.node.attrs?.src||'');
  let key='';try{const u=new URL(raw);if(u.origin!=='https://note.com')return false;key=noteKey(u.href)||u.pathname.match(/^\/embed\/notes\/(n[a-f0-9]{12})\/?$/i)?.[1]||''}catch{return false}
  const recorded=Boolean(key)&&tracked.get(cardKey(hit))===key;
  if(hasAnchor&&hit.pos<Number(anchor)&&!recorded)return false;
  return recorded||Boolean(key)&&wanted.has(key);
 });
}
function deleteVerifiedNotificationCardHits(view,hits){
 const before=view.state.doc,uniq=[...new Map(hits.map(hit=>[hit.pos,hit])).values()].sort((a,b)=>b.pos-a.pos);
 let tr=view.state.tr;
 for(const hit of uniq){
  const node=before.nodeAt(hit.pos);
  if(node?.type?.name!=='embed'||!node.eq(hit.node))throw new Error('通知カードの位置が変わったため削除を停止しました。保存記録は保持しています');
  tr=tr.delete(hit.pos,hit.pos+node.nodeSize);
 }
 const expected=tr.doc;
 if(!expected||typeof expected.eq!=='function')throw new Error('通知カード以外の本文を保持できるか確認できないため削除を停止しました');
 if(view.state.doc!==before&&!view.state.doc.eq(before))throw new Error('本文が変更されたため削除を停止しました。保存記録は保持しています');
 view.dispatch(tr);
 if(!view.state.doc.eq(expected))throw new Error('通知カードの削除結果を確認できません。保存記録を保持しました。下書きを確認してください');
 // The deletion transaction maps the selection itself. Appending a paragraph
 // merely to move the caret would change non-card content after verification.
 return uniq.length;
}
function notificationCardBaselinePositions(view,run){
 const all=embedNodes(view),keys=new Set([...(run.cardBaselineKeys||[]),...(run.cardBaselineNodes||[]).map(record=>String(record.key||'')).filter(Boolean)]),positions=new Set(all.filter(hit=>keys.has(cardKey(hit))).map(hit=>hit.pos));
 const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
 const signatures=new Map(all.filter(hit=>typeof hit.node.toJSON==='function').map(hit=>[hit.pos,stable(hit.node.toJSON())]));
 for(const record of run.cardBaselineNodes||[]){
  if(record.key&&all.some(hit=>cardKey(hit)===String(record.key)))continue;
  const signature=record.json?stable(record.json):null;
  const match=signature?all.find(hit=>!positions.has(hit.pos)&&signatures.get(hit.pos)===signature):null;
  if(match)positions.add(match.pos);
 }
 return positions;
}
async function deleteNotificationCards({confirm=true,save=true}={}){
 await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.hydrate?.();
 const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
 const run=readRun();if(!run)throw new Error('この下書きのカード記録を確認できません。本文は保持しています');
 if(run.articleKey&&run.articleKey!==editorArticleKey())throw new Error('保存記録が別の記事のため削除を停止しました');
 const tracked=resolveOwnedCardHits(view),anchor=run.cardAnchorPos;
 const hasAnchor=anchor!=null&&anchor!==''&&Number.isFinite(Number(anchor))&&Number(anchor)>=0&&Number(anchor)<=view.state.doc.content.size;
 const scoped=hasAnchor?run:tracked.length?{...run,cardAnchorPos:Math.min(...tracked.map(hit=>hit.pos))}:null;
 const generated=scoped?generatedCardHits(view,scoped).filter(hit=>!hasAnchor||hit.pos>=Number(anchor)):[];
 const baseline=notificationCardBaselinePositions(view,run);
 const hits=[...new Map([...tracked,...generated,...recoverNotificationCardHits(view,run)].filter(hit=>!baseline.has(hit.pos)).map(hit=>[hit.pos,hit])).values()];
 if(!hits.length)return 0;
 if(confirm&&!page.confirm('今回作った正規通知カード '+hits.length+'件だけ削除します。紹介画像は残します。実行しますか？'))return null;
 const removed=deleteVerifiedNotificationCardHits(view,hits);
 const pending=run.pendingCard&&run.pendingCard.sessionId===CARD_SESSION&&!hits.some(hit=>genuineCard(hit,run.pendingCard.url))?run.pendingCard:null;
 writeRun({...run,cardKeys:[],pendingCard:pending,stage:'images_ready',updatedAt:Date.now()});
 await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
 if(save&&removed)await saveOnce('正規通知カード '+removed+'件を一括削除｜下書き保存中…');
 return removed
}
function resolveOwnedDividerHits(view,images){
 const run=readRun(),marked=new Set((Array.isArray(run?.dividerUrls)?run.dividerUrls:[]).map(norm)),out=[];
 for(const image of images){
  if(!marked.has(norm(image.node.attrs?.link)))continue;
  const pos=image.pos+image.node.nodeSize,node=view.state.doc.nodeAt(pos);
  if(!node)continue;
  let native=['horizontal_rule','horizontalRule','horizontal-rule','divider','separator','hr'].includes(node.type?.name);
  if(!native){try{const dom=node.type?.spec?.toDOM?.(node);native=Array.isArray(dom)&&dom[0]==='hr'}catch{}}
  if(native)out.push({node,pos})
 }
 return out
}
async function deleteAllGenerated({save=true}={}){
 const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
 const cards=resolveOwnedCardHits(view),images=resolveOwnedImageHits(view),headings=resolveOwnedHeadingHits(view),activities=resolveOwnedActivityHits(view);
 const dividers=resolveOwnedDividerHits(view,images);
 const removedCards=cards.length,removedImages=images.length,removedHeadings=headings.length,removedActivities=activities.length,removedDividers=dividers.length;
 deleteHits(view,[...cards,...images,...headings,...activities,...dividers]);
 writeRun(null);
 if(save&&(removedCards||removedImages||removedHeadings||removedActivities||removedDividers))await saveOnce('最初に戻る｜通知'+removedCards+'・画像'+removedImages+'・見出し'+removedHeadings+'・プロフィール'+removedActivities+'・区切り線'+removedDividers+'を削除して保存中…');
 return{removedCards,removedImages,removedHeadings,removedActivities,removedDividers}
}

function inputValues(save=true){
 const p=document.getElementById(PANEL),g=getPrefs();if(!p)return g;
 const sources=String(p.querySelector('[data-sources]')?.value||'').trim();
 const mode=p.querySelector('[data-mode]')?.value==='all'?'all':'number';
 const count=Math.max(0,Math.min(5000,Number(p.querySelector('[data-count]')?.value||0)));
 const choice=p.querySelector('button[data-choice].on')?.dataset.choice||g.choice||'latest';
 const specialMode=p.querySelector('[data-special-mode]')?.value==='all'?'all':'number';
 const specialCount=Math.max(1,Math.min(1000,Number(p.querySelector('[data-special-count]')?.value||g.specialCount||200)));
 const specialTags=[...p.querySelectorAll('button[data-special-tag].on')].map(x=>String(x.dataset.specialTag||'')).filter(Boolean);
 const v={sources,mode,count,choice,specialMode,specialCount,specialTags,collapsed:Boolean(g.collapsed),tiny:Boolean(g.tiny)};
 if(save)setPrefs(v);return v
}
function choiceLabel(c){return c==='oldest'?'最初の記事':c==='fixed'?'固定→最新':'最新記事'}
function amountLabel(mode,count){return mode==='all'?'全数':String(count)+'件'}
async function createImageList({special=false,workmom=false,parenting=false}={}){
 if(actionBlocked())return;busy=true;stopRequested=false;update();
 try{
  const input=inputValues();
  if(special)await keepAwake();
  if(!special&&!workmom&&!parenting){
   const sources=parseUnifiedSources(input.sources);
   if(!sources.length)throw new Error('記事URL・マガジンURL・#タグを1つ以上入れてください');
   if(input.mode==='number'&&input.count<=0)throw new Error('件数を1以上にするか「全数」を選んでください');
  }
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();noteUrlCommandFactory();selectionApi();

  // ①画像一覧も、開始ボタンを押した瞬間の本文タップ位置を固定して使う。
  // 以後の通信・画像生成中に選択位置が変わっても、最下部へ飛ばさない。
  let imageInsertPos=cardAnchorFromSelection(view);
  if(special){
   const savedScan=readScan();
   if(savedScan?.active&&Number.isFinite(Number(savedScan.anchorPos))&&Number(savedScan.anchorPos)>=0)imageInsertPos=Math.min(Number(savedScan.anchorPos),view.state.doc.content.size);
   else writeScan({...savedScan,version:1,anchorPos:imageInsertPos,active:true,updatedAt:Date.now()})
  }

  const leftover=trackedContentCount(view);
  if(leftover.images||leftover.cards||leftover.headings||leftover.activities){
   throw new Error('このページに今回作成分が残っています。「正規通知カード一括削除」または「最初に戻る」で整理してから新規実行してください')
  }

  if(special&&(!Array.isArray(input.specialTags)||!input.specialTags.length))throw new Error('初投稿タグを1つ以上選んでください');
  const effective=parenting
   ?{...input,mode:input.parentingMode,count:input.parentingCount}
   :workmom
    ?{...input,mode:input.workmomMode,count:input.workmomCount}
    :special
     ?{...input,mode:input.specialMode,count:input.specialCount,specialTags:input.specialTags}
     :input;

  const rows=await buildRows(effective,special,workmom,parenting);
  if(!rows.length)throw new Error('貼り付け対象が0件です');
  if(special)clearScan();

  // 指定件数は実績の算数を含まない。buildRows が最後に +1件する。
  const requestedCount=parenting?(input.parentingMode==='all'?null:input.parentingCount):workmom?(input.workmomMode==='all'?null:input.workmomCount):special?(input.specialMode==='all'?null:input.specialCount):(input.mode==='all'?null:input.count);
  writeRun({
   version:VERSION,articleKey:editorArticleKey(),items:[],cardKeys:[],sectionHeadings:[],rows,
   cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),
   createdAt:Date.now(),stage:'images_building',special:Boolean(special),workmom:Boolean(workmom),parenting:Boolean(parenting),
   imageAnchorPos:imageInsertPos,
   sources:parenting?'#'+PARENTING_TAG:workmom?'#'+WORKMOM_TAG:special?input.specialTags.map(x=>'#'+x).join(' '):input.sources,
   mode:effective.mode,count:requestedCount,choice:input.choice
  });

  setStatus((parenting?'#育児日記案件':workmom?'#ワーママ案件':special?'特別案件':'通常')+'｜ランダム極薄50種｜①画像一覧をタップ位置から '+rows.length+'件（指定'+(requestedCount??'全数')+'＋実績の算数1件）作成');
  for(let i=0;i<rows.length;i++){
   if(stopRequested)throw new Error('手動停止');
   const row=rows[i];
   if(special){
    if(row.finalMarker){
     const text='最後に｜実績の算数';
     const h=insertHeadingAt(view,text,imageInsertPos);imageInsertPos=h.nextPos;recordHeading(text)
    }else if(i%10===0){
     const text=sectionHeadingText(Math.floor(i/10));
     const h=insertHeadingAt(view,text,imageInsertPos);imageInsertPos=h.nextPos;recordHeading(text)
    }
   }
   setStatus('① 画像🔗＋名前キャプション '+(i+1)+'/'+rows.length+'｜'+row.creator);
   const file=await makeFile(row);
   const made=await uploadOne(view,row,file,imageInsertPos);
   imageInsertPos=made.nextPos;
   recordImage(made.hit,row);
   await sleep(IMAGE_PASTE_GAP)
  }

  const runNow=readRun()||{};
  writeRun({...runNow,stage:'images_ready',rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});
  if(special)saveSpecialLast(rows);
  await saveOnce('① 画像🔗＋名前キャプション '+rows.length+'/'+rows.length+' 完了｜保存中…');
  if(special){
   const autoAdded=commitSpecialLast({silent:true});
   setStatus('①初投稿者画像一覧 完了 ✅ '+rows.length+'件｜今回成功分 '+autoAdded+'件を次回重複除外へ自動登録｜カード位置をタップ →「②ここから通知カード」')
  }else{
   setStatus('①画像一覧 完了 ✅ '+rows.length+'件｜カードを置く位置を本文でタップ →「②ここから通知カード」')
  }
 }catch(e){
  setStatus('停止：'+(e?.message||String(e))+'｜完成分は本文に保持。自動再開はしません',true)
 }finally{if(special)await releaseAwake();busy=false;update()}
}
async function createInsightLikes300(){
 if(actionBlocked())return;busy=true;stopRequested=false;update();
 try{
  await keepAwake();
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();noteUrlCommandFactory();selectionApi();
  const leftover=trackedContentCount(view);
  if(leftover.images||leftover.cards||leftover.headings||leftover.activities)throw new Error('このページに今回作成分が残っています。重複防止のため整理してから実行してください');
  let imageInsertPos=cardAnchorFromSelection(view);
  const creators=await buildInsightLikeRows(300);
  const finalRow={
   likerKey:'final-performance-math',urlname:'fuku444',creator:'実績の算数',
   actorUrl:'https://note.com/fuku444',actorImageUrl:'',url:FINAL_URL,
   title:'実績の算数│3日半で0→1達成',key:FINAL_KEY,publishAt:null,thumbUrl:'',finalMarker:true,index:301
  };
  const rows=[...creators,finalRow];
  writeRun({
   version:VERSION,articleKey:editorArticleKey(),items:[],cardKeys:[],sectionHeadings:[],rows,
   cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),
   createdAt:Date.now(),stage:'images_building',likesHistory:true,special:false,
   imageAnchorPos:imageInsertPos,sources:'INSIGHT スキ履歴',mode:'number',count:300,choice:'latest'
  });
  setStatus('INSIGHTスキ履歴｜300人＋実績の算数｜極薄50種で貼り付け開始');
  for(let i=0;i<rows.length;i++){
   if(stopRequested)throw new Error('手動停止');
   const row=rows[i];
   if(row.finalMarker){
    const text='最後に｜実績の算数';
    const h=insertHeadingAt(view,text,imageInsertPos);imageInsertPos=h.nextPos;recordHeading(text)
   }else if(i%10===0){
    const text=creatorHeadingText(Math.floor(i/10));
    const h=insertHeadingAt(view,text,imageInsertPos);imageInsertPos=h.nextPos;recordHeading(text)
   }
   setStatus('INSIGHTスキ300｜画像 '+(i+1)+'/'+rows.length+'｜'+row.creator);
   const file=await makeFile(row);
   const made=await uploadOne(view,row,file,imageInsertPos);
   imageInsertPos=made.nextPos;
   recordImage(made.hit,row);
   await sleep(IMAGE_PASTE_GAP)
  }
  const runNow=readRun()||{};
  writeRun({...runNow,stage:'images_ready',rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});
  await saveOnce('INSIGHTスキ300｜画像 '+rows.length+'/'+rows.length+' 完了｜保存中…');
  setStatus('INSIGHTスキ300 完了 ✅ 300人＋実績の算数｜本文位置をタップ→②カード続き/開始')
 }catch(e){
  setStatus('INSIGHTスキ300 停止：'+(e?.message||String(e))+'｜完成分は本文に保持',true)
 }finally{await releaseAwake();busy=false;update()}
}

async function pasteSavedSpecial(){
 if(actionBlocked())return;busy=true;stopRequested=false;update();
 try{
  await keepAwake();
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();noteUrlCommandFactory();selectionApi();

  const input=inputValues();
  const scan=readScan(),savedCount=Array.isArray(scan?.out)?scan.out.length:0;
  let run=readRun();
  const ownedImages=resolveOwnedImageHits(view).sort((a,b)=>a.pos-b.pos);
  const ownedCards=resolveOwnedCardHits(view);
  if(ownedCards.length)throw new Error('通知カードがすでにあります。画像の続き貼り付けはできません');

  let rows=[];
  if(run?.special&&Array.isArray(run.rows)&&run.rows.length){
   rows=run.rows;
  }else{
   if(!savedCount)throw new Error('保存済み採用分がありません');
   const useCount=Math.min(savedCount,input.specialMode==='all'?savedCount:input.specialCount);
   rows=await buildRowsFromSavedSpecial(useCount);
   run={
    version:VERSION,articleKey:editorArticleKey(),items:[],cardKeys:[],sectionHeadings:[],rows,
    cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),
    createdAt:Date.now(),stage:'images_building',special:true,
    imageAnchorPos:cardAnchorFromSelection(view),
    sources:'保存済み採用分',mode:'number',count:useCount,choice:input.choice
   };
   writeRun(run)
  }

  const total=rows.length;
  let done=Math.min(ownedImages.length,total);
  let imageInsertPos;
  if(done>0){
   const last=ownedImages[done-1];
   imageInsertPos=last.pos+last.node.nodeSize;
  }else{
   imageInsertPos=Number(run?.imageAnchorPos);
   if(!Number.isFinite(imageInsertPos))imageInsertPos=cardAnchorFromSelection(view)
  }

  if(done>=total){
   writeRun({...run,stage:'images_ready',updatedAt:Date.now()});
   setStatus('画像はすでに '+done+'/'+total+' 件あります ✅ 次は本文位置をタップ→②ここから通知カード');
   return
  }

  writeRun({...run,stage:'images_building',rows,updatedAt:Date.now()});
  setStatus('保存分の続きから再開｜'+done+'/'+total+' 件済み');

  for(let i=done;i<rows.length;i++){
   if(stopRequested)throw new Error('手動停止');
   const row=rows[i];

   if(row.finalMarker){
    const text='最後に｜実績の算数';
    const existing=findHeadingByText(view,text);
    if(existing&&existing.pos>=imageInsertPos){imageInsertPos=existing.pos+existing.node.nodeSize;recordHeading(text)}
    else if(!existing){const h=insertHeadingAt(view,text,imageInsertPos);imageInsertPos=h.nextPos;recordHeading(text)}
   }else if(i%10===0){
    const text=sectionHeadingText(Math.floor(i/10));
    const existing=findHeadingByText(view,text);
    if(existing&&existing.pos>=imageInsertPos){imageInsertPos=existing.pos+existing.node.nodeSize;recordHeading(text)}
    else if(!existing){const h=insertHeadingAt(view,text,imageInsertPos);imageInsertPos=h.nextPos;recordHeading(text)}
   }

   setStatus('保存分の続き '+(i+1)+'/'+rows.length+'｜'+row.creator);
   const file=await makeFile(row);
   const made=await uploadOne(view,row,file,imageInsertPos);
   imageInsertPos=made.nextPos;
   recordImage(made.hit,row);
   await sleep(IMAGE_PASTE_GAP)
  }

  run=readRun()||run;
  writeRun({...run,stage:'images_ready',rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});
  saveSpecialLast(rows);
  await saveOnce('保存分の続き '+rows.length+'/'+rows.length+' 完了｜保存中…');
  const autoAdded=commitSpecialLast({silent:true});
  setStatus('保存分の続き貼付完了 ✅ '+rows.length+'件｜次は本文位置をタップ→②ここから通知カード')
 }catch(e){
  setStatus('停止：'+(e?.message||String(e))+'｜完成分は本文に保持',true)
 }finally{await releaseAwake();busy=false;update()}
}

function pauseCards(){
 if(!cardRunActive)return false;
 cardPauseRequested=true;
 setStatus('一時停止を受付｜処理中の通知カードを確定して保存します');
 return true;
}
async function pauseCardsAtBoundary(done,total){
 if(stopRequested)throw new Error('手動停止');
 if(!cardPauseRequested||done>=total)return false;
 const run=readRun()||{};
 writeRun({...run,stage:'cards_building',paused:true,pauseStage:'cards',pausedAt:Date.now(),updatedAt:Date.now()});
 await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
 await saveOnce('通知カード '+done+'/'+total+' 件で一時停止｜下書き保存中…');
 if(stopRequested)throw new Error('手動停止');
 setStatus('一時停止中｜通知カード '+done+'/'+total+' 件を保存済み。「再開」または②で続きから');
 return true;
}
async function createCardsAtTap(){
 if(actionBlocked())return;busy=true;stopRequested=false;cardPauseRequested=false;cardRunActive=true;update();
 try{
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  const anchors={tappedAnchor:cardAnchorFromSelection(view)};
  await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.hydrate?.();
  if(stopRequested)throw new Error('手動停止');
  await page.__MUMEI_PROFILE_CARD_ENSURE_CARDS_READY__?.(view,anchors);
  const tappedAnchor=anchors.tappedAnchor;
  if(stopRequested)throw new Error('手動停止');
  let run=readRun(),rows=Array.isArray(run?.rows)?run.rows:[];
  if(!run||!rows.length||!['images_ready','cards_building','complete'].includes(run.stage))throw new Error('先に①画像一覧を完成させてください');
  const imageCount=resolveOwnedImageHits(view).length;
  if(imageCount!==rows.length)throw new Error('今回画像が '+imageCount+'/'+rows.length+' 件です。画像一覧を確認してください');

  if(run.cardAnchorPos==null||run.cardAnchorPos===''||!Number.isFinite(Number(run.cardAnchorPos)))run={...run,cardAnchorPos:tappedAnchor};
  run=await reconcileCompletedCards(view,run,rows);

  let existing=resolveOwnedCardHits(view).sort((a,b)=>a.pos-b.pos);
  if(existing.length>rows.length||existing.some((hit,index)=>!genuineCard(hit,rows[index]?.url)))throw new Error('保存済みカードの途中に欠落または順序の違いがあります。今あるカードは保持しました');
  let done=Math.min(existing.length,rows.length);

  if(done>=rows.length){
   writeRun({...run,stage:'complete',paused:false,pauseStage:null,updatedAt:Date.now()});
   await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
   setStatus('通知カードはすでに '+done+'/'+rows.length+' 件あります ✅');
   return
  }

  // 初回だけ本文タップ位置。途中再開は最後に作れたカードの直後から続行。
  let insertPos;
  if(done>0){
   const last=existing[done-1];
   insertPos=last.pos+last.node.nodeSize
  }else if(run.cardAnchorPos!=null&&run.cardAnchorPos!==''&&Number.isFinite(Number(run.cardAnchorPos))){
   insertPos=Math.min(Number(run.cardAnchorPos),view.state.doc.content.size)
  }else{
   insertPos=tappedAnchor
  }

  const existingRecs=Array.isArray(run.cardKeys)?run.cardKeys:[];
  writeRun({...run,stage:'cards_building',paused:false,pauseStage:null,cardAnchorPos:cardAnchor(run,insertPos,view),cardKeys:existingRecs,updatedAt:Date.now()});
  await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
  let cardGapMs=CARD_GAP_FAST;
  setStatus('② 通知カードの続き｜'+done+'/'+rows.length+' 件済み');

  for(let i=done;i<rows.length;i++){
   if(stopRequested)throw new Error('手動停止');
   if(await pauseCardsAtBoundary(i,rows.length))return;
   const row=rows[i];
   let made=null;
   setStatus('② 正規通知カード '+(i+1)+'/'+rows.length+'｜'+row.creator+'｜待機 '+(cardGapMs/1000).toFixed(1)+'秒');
   made=await createNativeCard(view,row,insertPos);
   insertPos=made.nextPos;
   await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
   if(await pauseCardsAtBoundary(i+1,rows.length))return;
   await sleep(cardGapMs);

   if((i+1)%10===0&&i+1<rows.length){
    setStatus('② 正規通知カード '+(i+1)+'/'+rows.length+'｜403回避 '+(CARD_BLOCK_PAUSE/1000).toFixed(1)+'秒休止');
    await sleep(CARD_BLOCK_PAUSE)
   }
  }

  assertUniqueGeneratedCards(view,readRun()||run,rows);

  const doneRun=readRun()||{};
  const actualCards=resolveOwnedCardHits(view).length;
  if(actualCards!==rows.length)throw new Error('通知カード実数 '+actualCards+'/'+rows.length+'｜不足を検出。もう一度②を押せば続きから再開します');
  writeRun({...doneRun,stage:'complete',paused:false,pauseStage:null,cardsCompletedAt:Date.now(),updatedAt:Date.now()});
  await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
  await saveOnce('② 正規通知カード '+rows.length+'/'+rows.length+' 完了｜最終保存中…');
  setStatus('完了 ✅ 画像一覧 '+rows.length+'件 → 通知カード '+rows.length+'件')
 }catch(e){
  setStatus('通知カード停止：'+(e?.message||String(e))+'｜完成分は保持。もう一度②で続きから再開できます',true)
 }finally{cardRunActive=false;busy=false;update()}
}

async function bulkDelete(){
 if(actionBlocked())return;busy=true;stopRequested=true;update();
 try{
  const removed=await deleteNotificationCards({confirm:true,save:true});
  if(removed!==null)setStatus(removed?'正規通知カード '+removed+'件を一括削除しました ✅ 紹介画像は保持':'この本文に削除対象の通知カードはありません｜画像・プロフィールは保持')
 }catch(e){setStatus('通知カード一括削除停止：'+(e?.message||String(e)),true)}
 finally{busy=false;stopRequested=false;update()}
}
function resetFields(){
 const p=document.getElementById(PANEL);if(!p)return;
 p.querySelector('[data-sources]').value='';
 p.querySelector('[data-mode]').value='number';
 p.querySelector('[data-count]').value='10';
 const sm=p.querySelector('[data-special-mode]'),sc=p.querySelector('[data-special-count]');
 if(sm)sm.value='number';if(sc)sc.value='200';
 p.querySelectorAll('button[data-special-tag]').forEach(x=>x.classList.add('on'));
 p.querySelectorAll('button[data-choice]').forEach(x=>x.classList.toggle('on',x.dataset.choice==='latest'));
 applyAmountMode();applySpecialAmountMode()
}
async function resetAll(){
 if(actionBlocked())return;
 if(!page.confirm('今回作った紹介画像＋正規通知カードを削除し、入力・件数・途中記録を最初に戻します。元本文・元画像・元カードは残します。実行しますか？'))return;
 busy=true;stopRequested=true;update();
 try{
  const result=await deleteAllGenerated({save:false});
  localStorage.removeItem(PREF);writeRun(null);clearScan();resetFields();
  if(result.removedCards||result.removedImages||result.removedHeadings||result.removedActivities||result.removedDividers)await saveOnce('最初に戻る｜通知'+result.removedCards+'・画像'+result.removedImages+'・見出し'+result.removedHeadings+'・プロフィール'+result.removedActivities+'・区切り線'+result.removedDividers+'を削除して保存中…');
  setStatus('最初に戻しました ✅ 画像 '+result.removedImages+' / 通知 '+result.removedCards+' / 見出し '+result.removedHeadings+' / プロフィール '+result.removedActivities+' / 区切り線 '+result.removedDividers+' を削除｜元本文は保持')
 }catch(e){setStatus('最初に戻る停止：'+(e?.message||String(e)),true)}
 finally{busy=false;stopRequested=false;update()}
}
function stop(){stopRequested=true;abortActiveRequests();const scan=readScan();if(scan)writeScan({...scan,active:false,updatedAt:Date.now()});window.dispatchEvent(new Event('mumei-profile-card-stop'));setStatus('停止しました｜途中保存は保持。自動再開もしません')}
function update(){
 const p=document.getElementById(PANEL);if(!p)return;
 p.querySelectorAll('textarea,input,select,button').forEach(x=>{
  if(x.dataset.a==='stop'||x.dataset.a==='pause'||x.dataset.galleryAction==='pause'||x.dataset.ui||x.matches?.('[data-special-count]'))return;
  x.disabled=busy||fixedRunBusy()
 })
}
window.addEventListener('mumei-profile-card-fixed-state',update);
function saveUiState(extra={}){const cur=inputValues(false),old=getPrefs();setPrefs({...old,...cur,...extra})}
function applyAmountMode(){
 const p=document.getElementById(PANEL),sel=p?.querySelector('[data-mode]'),num=p?.querySelector('[data-count]');
 if(num)num.style.display=sel?.value==='all'?'none':'block'
}
function applySpecialAmountMode(){
 const p=document.getElementById(PANEL),sel=p?.querySelector('[data-special-mode]'),num=p?.querySelector('[data-special-count]');
 if(num)num.style.display=sel?.value==='all'?'none':'block'
}
function applyWorkmomAmountMode(){
 const p=document.getElementById(PANEL),sel=p?.querySelector('[data-workmom-mode]'),num=p?.querySelector('[data-workmom-count]');
 if(num)num.style.display=sel?.value==='all'?'none':'block'
}
function applyParentingAmountMode(){
 const p=document.getElementById(PANEL),sel=p?.querySelector('[data-parenting-mode]'),num=p?.querySelector('[data-parenting-count]');
 if(num)num.style.display=sel?.value==='all'?'none':'block'
}
function announcePanelReady(){window.dispatchEvent(new window.Event('mumei-profile-card-panel-ready'))}
function setCollapsed(on){
 const p=document.getElementById(PANEL);if(!p)return;
 p.classList.toggle('collapsed',Boolean(on));p.classList.remove('tiny');
 saveUiState({collapsed:Boolean(on),tiny:false});
 if(!on)announcePanelReady()
}
function setTiny(on){
 const p=document.getElementById(PANEL),mini=document.getElementById(PANEL+'-mini');if(!p||!mini)return;
 if(on){
  const r=p.getBoundingClientRect();
  mini.style.left=Math.max(4,Math.min(innerWidth-46,r.left))+'px';
  mini.style.top=Math.max(4,Math.min(innerHeight-46,r.top))+'px';mini.style.right='auto';
  p.classList.add('tiny');mini.style.display='flex'
 }else{
  const r=mini.getBoundingClientRect();
  p.style.left=Math.max(4,Math.min(innerWidth-p.offsetWidth-4,r.left))+'px';
  p.style.top=Math.max(4,Math.min(innerHeight-p.offsetHeight-4,r.top))+'px';p.style.right='auto';
  p.classList.remove('tiny','collapsed');mini.style.display='none';savePos(p)
 }
 saveUiState({tiny:Boolean(on),collapsed:false});
 if(!on)announcePanelReady()
}
function restorePos(el){
 try{const v=JSON.parse(localStorage.getItem(POS)||'null');if(!v)return;const left=Math.max(4,Math.min(innerWidth-el.offsetWidth-4,Number(v.left)||4)),top=Math.max(24,Math.min(innerHeight-el.offsetHeight-4,Number(v.top)||84));el.style.left=left+'px';el.style.top=top+'px';el.style.right='auto'}catch{}
}
function savePos(el){try{const r=el.getBoundingClientRect();localStorage.setItem(POS,JSON.stringify({left:Math.round(r.left),top:Math.round(r.top)}))}catch{}}
function bindLongDrag(handle,panel){
 if(!handle||!panel)return;
 let pid=null,startX=0,startY=0,baseL=0,baseT=0;
 const clear=()=>{clearTimeout(longTimer);longTimer=0};
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0)return;
  pid=e.pointerId;dragging=false;startX=e.clientX;startY=e.clientY;
  const r=panel.getBoundingClientRect();baseL=r.left;baseT=r.top;clear();
  longTimer=setTimeout(()=>{dragging=true;try{handle.setPointerCapture(pid)}catch{}},420)
 });
 handle.addEventListener('pointermove',e=>{
  if(!dragging||e.pointerId!==pid)return;e.preventDefault();
  const l=Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,baseL+e.clientX-startX));
  const t=Math.max(4,Math.min(innerHeight-panel.offsetHeight-4,baseT+e.clientY-startY));
  panel.style.left=l+'px';panel.style.top=t+'px';panel.style.right='auto'
 });
 const end=e=>{clear();if(dragging){e.preventDefault();savePos(panel);suppressClickUntil=Date.now()+650}dragging=false;pid=null};
 handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end)
}
function bindDirectDrag(handle,panel){
 if(!handle||!panel)return;
 let pid=null,startX=0,startY=0,baseL=0,baseT=0,moved=false;
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  pid=e.pointerId;startX=e.clientX;startY=e.clientY;moved=false;
  const r=panel.getBoundingClientRect();baseL=r.left;baseT=r.top;
  try{handle.setPointerCapture(pid)}catch{}
 });
 handle.addEventListener('pointermove',e=>{
  if(pid==null||e.pointerId!==pid)return;
  const dx=e.clientX-startX,dy=e.clientY-startY;
  if(!moved&&Math.hypot(dx,dy)<3)return;
  moved=true;e.preventDefault();e.stopPropagation();
  const l=Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,baseL+dx));
  const t=Math.max(24,Math.min(innerHeight-panel.offsetHeight-4,baseT+dy));
  panel.style.left=l+'px';panel.style.top=t+'px';panel.style.right='auto'
 });
 const end=e=>{
  if(pid==null||e.pointerId!==pid)return;
  if(moved){e.preventDefault();e.stopPropagation();savePos(panel);suppressClickUntil=Date.now()+300}
  pid=null;moved=false
 };
 handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end)
}
function escAttr(v){return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
let mountedPanel=null,mountedPanelBody=null,stopDelegationBound=false;
function restorePanel(){
 const current=document.getElementById(PANEL);
 if(current&&(current!==mountedPanel||current.querySelector('.body')!==mountedPanelBody||!document.getElementById(PANEL+'-mini')))current.remove();
 mount();
}
page.__MUMEI_PROFILE_CARD_RESTORE_PANEL__=restorePanel;
page.__MUMEI_PROFILE_CARD_REFRESH_UI__=update;
function bindPanelInputEvents(panel){
 const controlFor=event=>{const control=event.target?.closest?.('textarea,input,select,button,summary');return control&&panel.contains(control)?control:null};
 const down=event=>{
  const control=controlFor(event);if(!control)return;
  event.stopPropagation();
  // Text fields keep native caret placement and mobile keyboard. Delegation
  // also covers action buttons cloned or added after the panel has mounted.
  if(event.type==='mousedown'&&control.matches('button'))event.preventDefault();
  if(control.matches('textarea,input')&&!control.disabled&&!control.readOnly&&document.activeElement!==control)control.focus({preventScroll:true});
 };
 panel.addEventListener('pointerdown',down);
 panel.addEventListener('mousedown',down);
 panel.addEventListener('touchstart',down,{passive:true});
 for(const type of ['keydown','keypress','keyup','paste','cut','copy'])panel.addEventListener(type,event=>{
  const control=controlFor(event);if(control?.matches('textarea,input,select'))event.stopPropagation();
 });
}
function mount(){
 if(!document.body||document.getElementById(PANEL))return;
 const g=getPrefs(),p=document.createElement('div');p.id=PANEL;
 p.innerHTML=`
 <style>
 #${PANEL}{position:fixed;right:4px;top:76px;z-index:2147483647;width:min(132px,calc(100vw - 8px));padding:3px;border:1px solid #365b70;border-radius:8px;background:#07131d;color:#edf8ff;box-shadow:0 6px 16px #0008;font:7.2px/1.18 system-ui;max-height:34vh}
 #${PANEL}.tiny{display:none}#${PANEL}.collapsed .body{display:none}#${PANEL}.collapsed{width:108px;padding:3px}
 #${PANEL} .dragbar{position:absolute;left:0;right:0;top:-15px;height:15px;border:1px solid #365b70;border-bottom:0;border-radius:7px 7px 0 0;background:#0a2938;color:#c9f4ff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:6.4px;letter-spacing:.05em;touch-action:none;user-select:none;cursor:grab;z-index:2}\n #${PANEL} .head{display:grid;grid-template-columns:1fr 20px 20px;gap:1px;align-items:center;touch-action:none;user-select:none}
 #${PANEL} .title{font-weight:950;font-size:7.6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:grab}
 #${PANEL} .body{max-height:calc(34vh - 23px);overflow:auto;padding-right:1px}
 #${PANEL} label{display:block;margin-top:2px;font-size:6.4px;color:#b9d8e8}
 #${PANEL} textarea{width:100%;height:34px;resize:vertical;margin-top:1px;padding:2px;border:1px solid #35576b;border-radius:5px;background:#0b1d28;color:#fff;font:6.7px/1.15 system-ui}
 #${PANEL} input,#${PANEL} select{width:100%;height:22px;padding:1px 2px;border:1px solid #35576b;border-radius:5px;background:#0b1d28;color:#fff;font-size:7px}
 #${PANEL} .amount{display:grid;grid-template-columns:43px 1fr;gap:2px;margin-top:1px}.choices{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin-top:1px}#${PANEL} .special-tags{grid-template-columns:repeat(3,1fr)}#${PANEL} .special-tags button{font-size:5.6px}
 #${PANEL} button{min-height:22px;border:1px solid #3b6378;border-radius:5px;background:#102b3b;color:#eaf9ff;font-weight:850;font-size:6.8px;touch-action:manipulation;pointer-events:auto;padding:1px 2px}
 #${PANEL} .choices button.on{background:#145c73;border-color:#63d7f1;color:#fff}
 #${PANEL} .hint{margin-top:2px;font-size:6.1px;color:#91b5c8;line-height:1.18}
 #${PANEL} .phase{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:2px}
 #${PANEL} [data-a="images"],#${PANEL} [data-a="special-images"]{background:#0b6176;border-color:#64d8ef}
 #${PANEL} [data-a="cards"]{background:#34518a;border-color:#7897df}
 #${PANEL} .tools{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:2px}#${PANEL} [data-a="delete"]{background:#5d1b25;border-color:#b95b68}#${PANEL} [data-a="reset"]{background:#4a3514;border-color:#a9833e}
 #${PANEL} details{margin-top:2px;border:1px solid #29485b;border-radius:5px;background:#091923;padding:2px}
 #${PANEL} summary{cursor:pointer;font-weight:900;font-size:6.8px;color:#dff6ff;list-style:none}#${PANEL} summary::-webkit-details-marker{display:none}
 #${PANEL} .special-actions{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:2px}
 #${STATUS}{margin-top:2px;padding-top:2px;border-top:1px solid #284555;font-size:6.2px;color:#bfe8ff;word-break:break-word}#${STATUS}[data-bad="1"]{color:#ffb8b8}
 #${PANEL}-mini{position:fixed;right:7px;top:80px;z-index:2147483647;width:30px;height:30px;border:1px solid #5fd4ee;border-radius:50%;background:#082333;color:#fff;font:950 7px system-ui;display:none;align-items:center;justify-content:center;box-shadow:0 5px 16px #0008;touch-action:none;user-select:none}
 </style>
 <div class="head"><div class="title">紹介貼付 v${VERSION}</div><button data-ui="collapse">－</button><button data-ui="tiny">×</button></div>
 <div class="body">
  <label>URL / マガジン / #（上から優先）</label>
  <textarea data-sources placeholder="記事URL&#10;マガジンURL&#10;#タグ">${escAttr(g.sources||'')}</textarea>
  <div class="amount"><select data-mode><option value="number">件数</option><option value="all">全数</option></select><input data-count type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${Number(g.count??10)}"></div>
  <div class="choices"><button data-choice="oldest">最初</button><button data-choice="fixed">固定→最新</button><button data-choice="latest">最新</button></div>
  <div class="hint">指定件数＋最後に「実績の算数」1件（件数外）</div>

  <div class="phase"><button data-a="images">①画像一覧</button><button data-a="cards">②カード続き/開始</button></div>

  <details data-special open>
   <summary>＋ 第二弾：初投稿＋自己紹介</summary>
   <div class="hint">#はじめてのnote / #始めてのnote＝公開1記事のみ。#自己紹介＝複数記事OK。3タグ混合新着・重複除外・NG検閲。指定件数＋実績の算数1件。10人ごと見出し。</div>
   <div class="choices special-tags"><button data-special-tag="はじめてのnote">#はじめて</button><button data-special-tag="始めてのnote">#始めて</button><button data-special-tag="自己紹介">#自己紹介</button></div>
   <div class="amount"><select data-special-mode><option value="number">件数</option><option value="all">全数</option></select><input data-special-count type="text" inputmode="numeric" pattern="[0-9]*" value="${Number(g.specialCount??200)}"></div>
   <button data-a="special-images" style="width:100%;margin-top:2px">① 指定件数＋見出し</button>
   <div class="special-actions"><button data-a="scan-stats">判定内訳</button><button data-a="paste-saved">保存分の続き</button></div><div class="special-actions"><button data-a="clear-excluded"><span data-excluded-count>除外 0件</span> 解除</button><span></span></div>
  </details>
  <details data-like300 open>
   <summary>＋ スキ履歴から300人</summary>
   <div class="hint">新しい順｜同一人物除外｜最新記事サムネ＋アイコン｜プロフィール全文は画像の上｜極薄50種｜10人ごと見出し</div>
   <div class="special-actions"><button data-a="like300-images" style="background:#176b54;border-color:#5bd7a7">① スキ300貼付</button></div>
  </details>
  <div class="tools"><button data-a="delete">通知カード削除</button><button data-a="reset">最初に戻る</button></div>
  <button data-a="stop" style="width:100%;margin-top:3px">停止</button>
  <div id="${STATUS}">①画像一覧は自動。②は本文で置く場所をタップしてから押す。</div>
 </div>`;
 document.getElementById(PANEL+'-mini')?.remove();
 const mini=document.createElement('button');mini.id=PANEL+'-mini';mini.type='button';mini.textContent='極薄';mini.title='極薄サムを開く（ハロウィンアート2026・再開）';mini.setAttribute('aria-label',mini.title);
 document.body.append(p,mini);
 bindPanelInputEvents(p);

 const choice=['oldest','fixed','latest'].includes(g.choice)?g.choice:'latest';
 p.querySelector('[data-choice="'+choice+'"]').classList.add('on');
 p.querySelector('[data-mode]').value=g.mode==='all'?'all':'number';
 p.querySelector('[data-special-mode]').value=g.specialMode==='all'?'all':'number';
 const savedSpecialTags=Array.isArray(g.specialTags)?g.specialTags:FIRST_TAGS;
 p.querySelectorAll('button[data-special-tag]').forEach(x=>x.classList.toggle('on',savedSpecialTags.includes(x.dataset.specialTag)));
 applyAmountMode();applySpecialAmountMode();updateExcludedCount();

 p.querySelectorAll('button[data-choice]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  p.querySelectorAll('button[data-choice]').forEach(x=>x.classList.remove('on'));btn.classList.add('on');saveUiState({choice:btn.dataset.choice})
 }));
 p.querySelector('[data-mode]').addEventListener('change',()=>{applyAmountMode();saveUiState()});
 p.querySelector('[data-special-mode]').addEventListener('change',()=>{applySpecialAmountMode();saveUiState()});
 p.querySelectorAll('button[data-special-tag]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  btn.classList.toggle('on');
  const on=[...p.querySelectorAll('button[data-special-tag].on')];
  if(!on.length){btn.classList.add('on');setStatus('初投稿タグは最低1つ選んでください',true);return}
  saveUiState({specialTags:on.map(x=>x.dataset.specialTag)})
 }));

 p.querySelectorAll('textarea,input').forEach(x=>{
  x.addEventListener('focus',e=>e.stopPropagation());
  x.addEventListener('click',e=>e.stopPropagation());
  x.addEventListener('change',()=>saveUiState())
 });
 for(const sel of ['[data-count]','[data-special-count]']){
  const el=p.querySelector(sel);
  el?.addEventListener('input',()=>{const d=String(el.value||'').replace(/\D+/g,'').slice(0,4);if(el.value!==d)el.value=d})
 }

 p.querySelector('[data-ui="collapse"]').addEventListener('click',e=>{e.preventDefault();setCollapsed(!p.classList.contains('collapsed'))});
 p.querySelector('[data-ui="tiny"]').addEventListener('click',e=>{e.preventDefault();setTiny(true)});
 p.querySelector('[data-a="images"]').addEventListener('click',e=>{e.preventDefault();void createImageList({special:false,workmom:false,parenting:false})});
 p.querySelector('[data-a="special-images"]').addEventListener('click',e=>{e.preventDefault();void createImageList({special:true,workmom:false,parenting:false})});
 p.querySelector('[data-a="like300-images"]').addEventListener('click',e=>{e.preventDefault();window.dispatchEvent(new Event('mumei-profile-card-start'))});
 p.querySelector('[data-a="cards"]').addEventListener('click',e=>{e.preventDefault();void createCardsAtTap()});
 p.querySelector('[data-a="scan-stats"]').addEventListener('click',e=>{e.preventDefault();const scan=readScan(),r=scan?.rejects||{};const msg=Object.entries(r).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v+'件').join('｜')||'除外内訳なし';setStatus('確認 '+(scan?.tested?.length||0)+'｜採用 '+(scan?.out?.length||0)+'｜'+msg)});
 p.querySelector('[data-a="paste-saved"]').addEventListener('click',e=>{e.preventDefault();void pasteSavedSpecial()});
 p.querySelector('[data-a="clear-excluded"]').addEventListener('click',e=>{e.preventDefault();clearSpecialExcluded()});
 p.querySelector('[data-a="delete"]').addEventListener('click',e=>{e.preventDefault();void bulkDelete()});
 p.querySelector('[data-a="reset"]').addEventListener('click',e=>{e.preventDefault();void resetAll()});
 const stopBtn=p.querySelector('[data-a="stop"]');
 stopBtn.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();stop()},{capture:true,passive:false});
 stopBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();stop()},{capture:true});
 stopBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();stop()});
 if(!stopDelegationBound){
  stopDelegationBound=true;
 document.addEventListener('pointerdown',e=>{const t=e.target?.closest?.('#'+PANEL+' [data-a="stop"]');if(t){e.preventDefault();e.stopImmediatePropagation();stop()}},{capture:true});
 document.addEventListener('touchstart',e=>{const t=e.target?.closest?.('#'+PANEL+' [data-a="stop"]');if(t){e.preventDefault();e.stopImmediatePropagation();stop()}},{capture:true,passive:false});
 }

 mini.addEventListener('click',e=>{if(dragging||Date.now()<suppressClickUntil){e.preventDefault();return}e.preventDefault();setTiny(false)});
 bindDirectDrag(p.querySelector('[data-dragbar]'),p);bindLongDrag(p.querySelector('.title'),p);bindLongDrag(mini,mini);restorePos(p);
 if(g.collapsed)p.classList.add('collapsed');if(g.tiny){p.classList.add('tiny');mini.style.display='flex'}
 mountedPanel=p;mountedPanelBody=p.querySelector('.body');update();announcePanelReady()
}
let autoResumeTimer=null;
function scheduleAutoResume(){
 clearTimeout(autoResumeTimer);
 autoResumeTimer=setTimeout(()=>{
  const saved=readScan();
  if(!saved?.active||busy||document.hidden)return;
  const p=document.getElementById(PANEL);
  if(!p)return;
  setStatus('途中保存から自動再開｜採用 '+(saved.out?.length||0)+'件・確認済み '+(saved.tested?.length||0)+'件');
  void createImageList({special:true,workmom:false,parenting:false})
 },900)
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){
  const saved=readScan();if(saved?.active)writeScan({...saved,updatedAt:Date.now()});
 }else{
  void keepAwake();
  scheduleAutoResume()
 }
});
page.addEventListener('pageshow',()=>{
 const saved=readScan();
 if(saved?.active){
  writeScan({...saved,active:false,updatedAt:Date.now()});
  setTimeout(()=>setStatus('途中保存あり｜採用 '+(saved.out?.length||0)+'件。再読み込み後は自動再開しません'),500)
 }else if(saved?.out?.length){
  setTimeout(()=>setStatus('途中保存あり｜採用 '+saved.out.length+'件'),500)
 }
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

