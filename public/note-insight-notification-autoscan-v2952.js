(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationAutoscan2952)return;window.__mumeiNotificationAutoscan2952=true;
const VERSION='2.9.52',INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-ingest-v2';
const TOKEN='mumei_insight_notification_sync_token_v2:',SAVED='mumei_insight_notification_saved_v2919:',CHECK='mumei_insight_notification_checkpoint_v2922:';
const FRAME='mumei-v2948-frame',ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]',SRC='note-notification-manual-sync-v2952';
const MAX_NEW=120,BATCH=25,STEP_WAIT=420,MAX_STEPS=120,CHUNK_STEPS=1,STALL_LIMIT=6,ANCHOR_LIMIT=240,TIME_LIMIT=100;
const NOTICE_RE=/(?:さん|他\d+名|新しい記事|追加しました|フォロー|コメント|スキ|購入|メンバーシップ|マガジン|掲示板)/u,TIME_RE=/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)/u;
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),stripTime=v=>clean(v).replace(/\s(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)$/u,'').trim(),modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const yieldUi=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
async function get(k,d){if(modern()&&typeof GM.getValue==='function')return GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d);return d}
async function set(k,v){if(modern()&&typeof GM.setValue==='function')return GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}
function request(url,body,headers={}){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));fn({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300?resolve(p):reject(new Error(p.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?{id}:null}catch{return null}}
function text(el){return clean(el?.textContent)}
function rowish(el){const t=text(el);return t.length>=8&&t.length<=900&&NOTICE_RE.test(t)&&TIME_RE.test(t)}
function candidateFromNode(node,stop){let p=node,depth=0,best=null;while(p&&p!==document.body&&depth++<6){const t=text(p);if(t.length>900)break;if(NOTICE_RE.test(t)&&TIME_RE.test(t))best=p;if(p===stop)break;p=p.parentElement}return best}
function knownRows(root){if(!root?.querySelectorAll)return[];const out=[];for(const el of root.querySelectorAll(ITEM)){if(rowish(el))out.push(el);if(out.length>=140)break}return out}
function fallbackRows(root){if(!root?.querySelectorAll)return[];const picked=[];const add=el=>{if(!el||!rowish(el))return;if(picked.some(x=>x===el||x.contains(el)))return;for(let i=picked.length-1;i>=0;i--)if(el.contains(picked[i]))picked.splice(i,1);picked.push(el)};
let n=0;for(const a of root.querySelectorAll('a[href]')){if(n++>=ANCHOR_LIMIT)break;const c=candidateFromNode(a,root);if(c)add(c)}
if(!picked.length){n=0;for(const tm of root.querySelectorAll('time,[datetime]')){if(n++>=TIME_LIMIT)break;const c=candidateFromNode(tm,root);if(c)add(c)}}
return picked.slice(0,140)}
function rows(root){const known=knownRows(root);return known.length?known:fallbackRows(root)}
function commonAncestor(nodes){if(!nodes.length)return null;let p=nodes[0];while(p&&p!==document.body){if(nodes.every(n=>p.contains(n)))return p;p=p.parentElement}return document.body}
function findPanel(){const sels='[class*="navbarNotice"],[data-testid*="notification" i],[data-testid*="notice" i],[role="dialog"],[role="menu"],[popover]';for(const c of document.querySelectorAll(sels)){if(!c.getClientRects().length)continue;const known=knownRows(c);if(known.length)return c}
const global=fallbackRows(document.body);if(!global.length)return null;return commonAncestor(global.slice(0,Math.min(6,global.length)))||document.body}
function noteLinks(el){const out=[];for(const a of el.querySelectorAll('a[href]')){try{const u=new URL(a.getAttribute('href'),location.href);if(u.hostname.endsWith('note.com'))out.push({a,u:u.href,t:text(a)})}catch{}if(out.length>=18)break}return out}
function creatorIdFromUrl(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean);if(!u.hostname.endsWith('note.com')||p.length!==1)return'';const id=(p[0]||'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)&&!['settings','sitesettings','membership','notifications'].includes(id)?id:''}catch{return''}}
function actorLink(ls){return ls.find(x=>creatorIdFromUrl(x.u))||null}
function targetLink(ls){return ls.find(x=>/\/membership(?:[/?#]|$)|\/memberships?\/|\/m\/|\/n\/|kind=board_reply_comment|scrollpos=comment/i.test(x.u))||null}
function actorImage(el,actor){const direct=actor?.a?.querySelector?.('img[src]');if(direct&&direct.currentSrc&&!/magazine_cover/i.test(direct.currentSrc))return direct.currentSrc;let n=0;for(const img of el.querySelectorAll('img[src]')){if(n++>10)break;const src=String(img.currentSrc||img.src||'');if(/\/profile_/i.test(src))return src;if(src&&!/magazine_cover|ogp|cover/i.test(src))return src}return null}
function rowData(el){const raw=text(el);if(!raw||raw.length>900)return null;const ls=noteLinks(el),target=targetLink(ls),actor=actorLink(ls),tm=el.querySelector('time[datetime]')?.getAttribute('datetime')||el.querySelector('[datetime]')?.getAttribute('datetime')||null,m=stripTime(raw).match(/^(.{1,180}?)\s*さん(?:他\d+名)?(?:が|の|から|より|に)/u);return{raw_text:raw,actor_name:actor?.t||m?.[1]||null,actor_url:actor?.u||null,actor_image_url:actorImage(el,actor),target_title:target?.t||null,target_url:target?.u||null,source_url:target?.u||actor?.u||'https://note.com/',occurred_at:tm,meta:{source:SRC,userscript:VERSION}}}
const signature=r=>[stripTime(r.raw_text),String(r.target_url||'').split('#')[0],String(r.actor_url||'').split('?')[0]].join('|');
function scrollHost(panel){const doc=document.scrollingElement||document.documentElement;const first=rows(panel)[0];let p=first||panel,depth=0;while(p&&depth++<9){try{if(p.scrollHeight>p.clientHeight+30&&/(auto|scroll)/.test(getComputedStyle(p).overflowY))return p}catch{}if(p===panel)break;p=p.parentElement}try{if(panel!==document.body&&panel.scrollHeight>panel.clientHeight+30&&/(auto|scroll)/.test(getComputedStyle(panel).overflowY))return panel}catch{}return doc}
function ui(){try{const f=document.getElementById(FRAME),d=f?.contentDocument;return{health:d?.getElementById('health'),read:d?.getElementById('read')}}catch{return{health:null,read:null}}}
let scanning=false,cancelRequested=false;
function health(msg,cls=''){const x=ui();if(x.health){x.health.textContent=msg;x.health.className='health '+cls}if(x.read)x.read.textContent=scanning?(cancelRequested?'停止中…':'■ 自動読込を停止'):'自動保存（前回まで）'}
async function sendBatch(input,a){if(!input.length)return[];const token=String(await get(key(TOKEN,a.id),'')||'');if(!token)throw new Error('本人連携の更新が必要です');const confirmed=[];for(let i=0;i<input.length;i+=BATCH){if(cancelRequested)break;const part=input.slice(i,i+BATCH),payload=part.map(r=>({...r,meta:{...(r.meta||{}),client_signature:signature(r)}})),p=await request(INGEST,{noteId:a.id,notifications:payload},{'X-Ingest-Token':token});confirmed.push(...(Array.isArray(p.confirmedClientSignatures)?p.confirmedClientSignatures:[]).map(String));await yieldUi()}return[...new Set(confirmed)]}
async function autoScan(){
if(scanning){cancelRequested=true;health('自動読込を安全に停止しています…','saving');return}
health('通知一覧を軽量確認中…','saving');await yieldUi();
const panel=findPanel();if(!panel){health('🔔の通知一覧を開いてください','error');return}
const a=await account();if(!a){health('noteのログイン状態を確認してください','error');return}
scanning=true;cancelRequested=false;health('前回保存位置まで自動読込を開始…','saving');
const cp=await get(key(CHECK,a.id),{}),boundary=String(cp?.boundarySignature||''),savedRaw=await get(key(SAVED,a.id),[]),saved=new Set((Array.isArray(savedRaw)?savedRaw:[]).map(String)),host=scrollHost(panel),original=host.scrollTop,ordered=[],seen=new Set();let reached=false,recovered=false,boundarySig=boundary,stall=0,lastExtent=-1,steps=0;
try{
host.scrollTop=0;await sleep(180);await yieldUi();
while(steps<MAX_STEPS&&!cancelRequested&&!reached&&(!boundary?ordered.length<MAX_NEW:true)){
for(let chunk=0;chunk<CHUNK_STEPS&&steps<MAX_STEPS&&!cancelRequested&&!reached;chunk++,steps++){
await yieldUi();const current=rows(panel).map(rowData).filter(Boolean);for(const r of current){const s=signature(r);if(!seen.has(s)){seen.add(s);ordered.push(r)}if(boundary&&s===boundary){reached=true;boundarySig=s;break}if(boundary&&!reached&&saved.has(s)){reached=true;recovered=true;boundarySig=s;break}}
if(reached||cancelRequested)break;const extent=host.scrollHeight-host.clientHeight;if(extent<=0)break;const before=host.scrollTop;host.scrollTop=Math.min(extent,before+Math.max(220,host.clientHeight*.82));await sleep(STEP_WAIT);const nowExtent=host.scrollHeight-host.clientHeight;if(Math.abs(host.scrollTop-before)<2&&nowExtent===lastExtent)stall++;else stall=0;lastExtent=nowExtent;if(stall>=STALL_LIMIT){steps=MAX_STEPS;break}}
health(`自動読込中…確認 ${ordered.length}件${reached?'・前回位置到達':''}`,'saving');await yieldUi()}
if(cancelRequested){health(`停止しました｜確認済み ${ordered.length}件（保存前）`,'error');return}
const stopIndex=boundarySig?ordered.findIndex(r=>signature(r)===boundarySig):-1,scope=stopIndex>=0?ordered.slice(0,stopIndex):ordered,unique=[];for(const r of scope){const s=signature(r);if(saved.has(s))continue;unique.push(r);if(unique.length>=MAX_NEW)break}
const confirmed=await sendBatch(unique,a);for(const s of confirmed)saved.add(s);await set(key(SAVED,a.id),[...saved].slice(-10000));const first=ordered[0],scopeComplete=unique.length<MAX_NEW,newBoundary=(reached||!boundary)&&scopeComplete&&first?signature(first):boundary,next={...cp,lastSaveAt:confirmed.length?Date.now():Number(cp?.lastSaveAt||0),lastCheckAt:Date.now(),savedCount:saved.size,lastError:'',manualNewCount:confirmed.length,manualSeenCount:ordered.length,version:VERSION,boundarySignature:newBoundary,boundaryAt:newBoundary!==boundary?Date.now():Number(cp?.boundaryAt||0),boundarySource:recovered?'auto-saved-overlap-v2952':'auto-checkpoint-v2952'};await set(key(CHECK,a.id),next);const tail=reached?'・前回位置まで自動確認':boundary?'・前回位置未到達':'・初回範囲';health(`保存完了 ✓ INSIGHT反映${confirmed.length}件・確認${ordered.length}件${tail}`,'done')
}catch(e){await set(key(CHECK,a.id),{...cp,lastError:String(e?.message||e),lastCheckAt:Date.now(),version:VERSION});health(`⚠ ${e?.message||e}`,'error')}
finally{host.scrollTop=original;scanning=false;cancelRequested=false;setTimeout(()=>health((ui().health?.textContent||'').replace(/^■ /,''),ui().health?.className?.includes('error')?'error':ui().health?.className?.includes('done')?'done':''),30)}}
function bind(){try{const f=document.getElementById(FRAME),d=f?.contentDocument,b=d?.getElementById('read');if(!d||!b)return false;if(b.dataset.mumeiAutoScan==='2952')return true;b.dataset.mumeiAutoScan='2952';b.textContent='自動保存（前回まで）';d.addEventListener('click',e=>{const t=e.target;if(!(t instanceof d.defaultView.HTMLElement)||t.id!=='read')return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void autoScan()},true);return true}catch{return false}}
let bindTries=0;function bindLater(){if(bind()||bindTries++>=30)return;setTimeout(bindLater,900)}setTimeout(bindLater,350);window.addEventListener('pageshow',()=>{bindTries=0;setTimeout(bindLater,500)});
})();