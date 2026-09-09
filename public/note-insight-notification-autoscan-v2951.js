(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationAutoscan2951)return;window.__mumeiNotificationAutoscan2951=true;
const VERSION='2.9.51',INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-ingest-v2';
const TOKEN='mumei_insight_notification_sync_token_v2:',SAVED='mumei_insight_notification_saved_v2919:',CHECK='mumei_insight_notification_checkpoint_v2922:';
const FRAME='mumei-v2948-frame',ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]',SRC='note-notification-manual-sync-v2951';
const MAX_NEW=120,BATCH=25,STEP_WAIT=320,MAX_STEPS=72,CHUNK_STEPS=6,STALL_LIMIT=5;
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),stripTime=v=>clean(v).replace(/\s(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)$/u,'').trim(),modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const yieldUi=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
async function get(k,d){if(modern()&&typeof GM.getValue==='function')return GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d);return d}
async function set(k,v){if(modern()&&typeof GM.setValue==='function')return GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}
function request(url,body,headers={}){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));fn({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300?resolve(p):reject(new Error(p.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?{id}:null}catch{return null}}
function shown(el){if(!el?.getBoundingClientRect)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'}
const NOTICE_RE=/(?:さん|他\d+名|新しい記事|追加しました|フォロー|コメント|スキ|購入|メンバーシップ|マガジン|掲示板)/u,TIME_RE=/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)/gu;
function timeCount(text){return(clean(text).match(TIME_RE)||[]).length}
function noticeText(el){const t=clean(el?.innerText||el?.textContent);return t.length>=8&&t.length<=900&&NOTICE_RE.test(t)&&timeCount(t)>=1}
function fallbackRows(root){const scope=root?.querySelectorAll?root:document;const seeds=[...scope.querySelectorAll('li,[role="listitem"],article,div')].filter(el=>shown(el)&&noticeText(el));const picked=[];for(const seed of seeds){let best=seed,p=seed.parentElement,depth=0;while(p&&p!==document.body&&depth++<6){const t=clean(p.innerText||p.textContent),tc=timeCount(t);if(t.length>900||tc>1)break;if(NOTICE_RE.test(t)&&(p.querySelector('a[href]')||p.querySelector('img')))best=p;p=p.parentElement}if(!picked.some(x=>x===best||x.contains(best))){for(let i=picked.length-1;i>=0;i--)if(best.contains(picked[i]))picked.splice(i,1);picked.push(best)}}return picked}
function rows(root){if(!root)return[];let xs=[...root.querySelectorAll(ITEM)].filter(shown);if(!xs.length)xs=fallbackRows(root);return[...new Set(xs)]}
function commonAncestor(nodes){if(!nodes.length)return null;let p=nodes[0];while(p&&p!==document.body){if(nodes.every(n=>p.contains(n)))return p;p=p.parentElement}return document.body}
function findPanel(){const candidates=[...document.querySelectorAll('[class*="navbarNotice"],[data-testid*="notification" i],[data-testid*="notice" i],[role="dialog"],[role="menu"],[popover]')].filter(shown).sort((a,b)=>rows(b).length-rows(a).length);const direct=candidates.find(x=>rows(x).length);if(direct)return direct;const globalRows=rows(document.body);if(!globalRows.length)return null;return commonAncestor(globalRows.slice(0,Math.min(8,globalRows.length)))||document.body}
function noteLinks(el){return[...el.querySelectorAll('a[href]')].map(a=>{try{const u=new URL(a.getAttribute('href'),location.href);return u.hostname.endsWith('note.com')?{a,u:u.href,t:clean(a.textContent)}:null}catch{return null}}).filter(Boolean)}
function creatorIdFromUrl(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean);if(!u.hostname.endsWith('note.com')||p.length!==1)return'';const id=(p[0]||'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)&&!['settings','sitesettings','membership','notifications'].includes(id)?id:''}catch{return''}}
function actorLink(ls){return ls.find(x=>creatorIdFromUrl(x.u))||null}
function targetLink(ls){return ls.find(x=>/\/membership(?:[/?#]|$)|\/memberships?\/|\/m\/|\/n\/|kind=board_reply_comment|scrollpos=comment/i.test(x.u))||null}
function actorImage(el,actor){const direct=actor?.a?.querySelector?.('img[src]');if(direct&&direct.currentSrc&&!/magazine_cover/i.test(direct.currentSrc))return direct.currentSrc;for(const img of el.querySelectorAll('img[src]')){const src=String(img.currentSrc||img.src||'');if(/\/profile_/i.test(src))return src}for(const img of el.querySelectorAll('img[src]')){const src=String(img.currentSrc||img.src||'');if(src&&!/magazine_cover|ogp|cover/i.test(src))return src}return null}
function rowData(el){const raw=clean(el.innerText||el.textContent);if(!raw||raw.length>900)return null;const ls=noteLinks(el),target=targetLink(ls),actor=actorLink(ls),tm=el.querySelector('time[datetime]')?.getAttribute('datetime')||el.querySelector('[datetime]')?.getAttribute('datetime')||null,m=stripTime(raw).match(/^(.{1,180}?)\s*さん(?:他\d+名)?(?:が|の|から|より|に)/u);return{raw_text:raw,actor_name:actor?.t||m?.[1]||null,actor_url:actor?.u||null,actor_image_url:actorImage(el,actor),target_title:target?.t||null,target_url:target?.u||null,source_url:target?.u||actor?.u||'https://note.com/',occurred_at:tm,meta:{source:SRC,userscript:VERSION}}}
const signature=r=>[stripTime(r.raw_text),String(r.target_url||'').split('#')[0],String(r.actor_url||'').split('?')[0]].join('|');
function scrollHost(panel){const scrolling=document.scrollingElement;const list=[scrolling,panel,...panel.querySelectorAll('div,ul,section')].filter((el,i,a)=>el&&a.indexOf(el)===i&&el.scrollHeight>el.clientHeight+30&&(el===scrolling||/(auto|scroll)/.test(getComputedStyle(el).overflowY)));return list.sort((a,b)=>(b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight))[0]||scrolling||panel}
function ui(){try{const f=document.getElementById(FRAME),d=f?.contentDocument;return{health:d?.getElementById('health'),read:d?.getElementById('read')}}catch{return{health:null,read:null}}}
let scanning=false,cancelRequested=false;
function health(text,cls=''){const x=ui();if(x.health){x.health.textContent=text;x.health.className='health '+cls}if(x.read)x.read.textContent=scanning?(cancelRequested?'停止中…':'■ 自動読込を停止'):'自動保存（前回まで）'}
async function sendBatch(input,a){if(!input.length)return[];const token=String(await get(key(TOKEN,a.id),'')||'');if(!token)throw new Error('本人連携の更新が必要です');const confirmed=[];for(let i=0;i<input.length;i+=BATCH){if(cancelRequested)break;const part=input.slice(i,i+BATCH),payload=part.map(r=>({...r,meta:{...(r.meta||{}),client_signature:signature(r)}})),p=await request(INGEST,{noteId:a.id,notifications:payload},{'X-Ingest-Token':token});confirmed.push(...(Array.isArray(p.confirmedClientSignatures)?p.confirmedClientSignatures:[]).map(String));await yieldUi()}return[...new Set(confirmed)]}
async function autoScan(){
  if(scanning){cancelRequested=true;health('自動読込を安全に停止しています…','saving');return}
  const panel=findPanel();if(!panel){health('🔔の通知一覧を開いてください','error');return}
  const a=await account();if(!a){health('noteのログイン状態を確認してください','error');return}
  scanning=true;cancelRequested=false;health('前回保存位置まで自動読込を開始…','saving');
  const cp=await get(key(CHECK,a.id),{}),boundary=String(cp?.boundarySignature||''),savedRaw=await get(key(SAVED,a.id),[]),saved=new Set((Array.isArray(savedRaw)?savedRaw:[]).map(String)),host=scrollHost(panel),original=host.scrollTop,ordered=[],seen=new Set();let reached=false,recovered=false,boundarySig=boundary,stall=0,lastExtent=-1,steps=0;
  try{
    host.scrollTop=0;await sleep(180);await yieldUi();
    while(steps<MAX_STEPS&&!cancelRequested&&!reached&&(!boundary?ordered.length<MAX_NEW:true)){
      for(let chunk=0;chunk<CHUNK_STEPS&&steps<MAX_STEPS&&!cancelRequested&&!reached;chunk++,steps++){
        const current=rows(panel).map(rowData).filter(Boolean);
        for(const r of current){const s=signature(r);if(!seen.has(s)){seen.add(s);ordered.push(r)}if(boundary&&s===boundary){reached=true;boundarySig=s;break}if(boundary&&!reached&&saved.has(s)){reached=true;recovered=true;boundarySig=s;break}}
        if(reached||cancelRequested)break;
        const extent=host.scrollHeight-host.clientHeight;if(extent<=0)break;
        const before=host.scrollTop;host.scrollTop=Math.min(extent,before+Math.max(220,host.clientHeight*.82));await sleep(STEP_WAIT);
        const nowExtent=host.scrollHeight-host.clientHeight;if(Math.abs(host.scrollTop-before)<2&&nowExtent===lastExtent)stall++;else stall=0;lastExtent=nowExtent;if(stall>=STALL_LIMIT){steps=MAX_STEPS;break}
      }
      health(`自動読込中…確認 ${ordered.length}件${reached?'・前回位置到達':''}`,'saving');await yieldUi();
    }
    if(cancelRequested){health(`停止しました｜確認済み ${ordered.length}件（保存前）`,'error');return}
    const stopIndex=boundarySig?ordered.findIndex(r=>signature(r)===boundarySig):-1,scope=stopIndex>=0?ordered.slice(0,stopIndex):ordered,unique=[];for(const r of scope){const s=signature(r);if(saved.has(s))continue;unique.push(r);if(unique.length>=MAX_NEW)break}
    const confirmed=await sendBatch(unique,a);for(const s of confirmed)saved.add(s);await set(key(SAVED,a.id),[...saved].slice(-10000));const first=ordered[0],scopeComplete=unique.length<MAX_NEW,newBoundary=(reached||!boundary)&&scopeComplete&&first?signature(first):boundary,next={...cp,lastSaveAt:confirmed.length?Date.now():Number(cp?.lastSaveAt||0),lastCheckAt:Date.now(),savedCount:saved.size,lastError:'',manualNewCount:confirmed.length,manualSeenCount:ordered.length,version:VERSION,boundarySignature:newBoundary,boundaryAt:newBoundary!==boundary?Date.now():Number(cp?.boundaryAt||0),boundarySource:recovered?'auto-saved-overlap-v2951':'auto-checkpoint-v2951'};await set(key(CHECK,a.id),next);const tail=reached?'・前回位置まで自動確認':boundary?'・前回位置未到達':'・初回範囲';health(`保存完了 ✓ INSIGHT反映${confirmed.length}件・確認${ordered.length}件${tail}`,'done');
  }catch(e){await set(key(CHECK,a.id),{...cp,lastError:String(e?.message||e),lastCheckAt:Date.now(),version:VERSION});health(`⚠ ${e?.message||e}`,'error')}
  finally{host.scrollTop=original;scanning=false;cancelRequested=false;setTimeout(()=>health((ui().health?.textContent||'').replace(/^■ /,''),ui().health?.className?.includes('error')?'error':ui().health?.className?.includes('done')?'done':''),30)}
}
function bind(){try{const f=document.getElementById(FRAME),d=f?.contentDocument,b=d?.getElementById('read');if(!d||!b)return false;if(b.dataset.mumeiAutoScan==='2951')return true;b.dataset.mumeiAutoScan='2951';b.textContent='自動保存（前回まで）';d.addEventListener('click',e=>{const t=e.target;if(!(t instanceof d.defaultView.HTMLElement)||t.id!=='read')return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void autoScan()},true);return true}catch{return false}}
let bindTries=0;function bindLater(){if(bind()||bindTries++>=40)return;setTimeout(bindLater,700)}setTimeout(bindLater,300);window.addEventListener('pageshow',()=>{bindTries=0;setTimeout(bindLater,400)});
})();