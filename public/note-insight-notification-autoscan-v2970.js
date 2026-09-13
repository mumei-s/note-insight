(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationAutoscan2970)return;window.__mumeiNotificationAutoscan2970=true;
const VERSION='2.9.69',PROTOCOL='2.9.69';
const INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-ingest-v2';
const TOKEN='mumei_insight_notification_sync_token_v2:',SAVED='mumei_insight_notification_saved_v2919:',CHECK='mumei_insight_notification_checkpoint_v2922:';
const FRAME='mumei-v2948-frame',SHELL='[data-mumei-notice-shell-v2958="1"]',FILTER_URL='https://mumei-s.github.io/note-insight/notification-filter.html?from=note';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[class*="NotificationItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const TIME_RE=/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)/u;
const NOTICE_RE=/(?:さん|通知|新しい記事|追加しました|フォロー|コメント|返信|スキ|いいね|リアクション|購入|チップ|サポート|支援|応援金|メンバー|メンバーシップ|メンシプ|プラン|加入|入会|マガジン|掲示板|話題|高評価|ポイント|引用|紹介)/u;
const EXCLUDE=new Set(['settings','sitesettings','membership','memberships','notifications','messages','search','explore','login','signup']);
const BATCH=20,SAVE_EVERY=20,MAX_NEW=160,STEP_WAIT=300,MAX_UP_STEPS=220,UP_STALL=7,SEEK_WAIT=280,SEEK_MAX=180,SEEK_STALL=8,AUTO_PASS_LIMIT=40;
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const stripTime=v=>clean(v).replace(/\s(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)$/u,'').trim();
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const yieldUi=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
async function get(k,d){if(modern()&&typeof GM.getValue==='function')return GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d);return d}
async function set(k,v){if(modern()&&typeof GM.setValue==='function')return GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}
function request(url,body,headers={}){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));fn({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300?resolve(p):reject(new Error(p.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
function shown(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function notificationRoute(){return /^\/notifications(?:\/|$)/.test(location.pathname.toLowerCase())}
function creatorId(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean),id=(p[0]||'').toLowerCase();return u.hostname.endsWith('note.com')&&p.length===1&&/^[a-z0-9_-]+$/.test(id)&&!EXCLUDE.has(id)?id:''}catch{return''}}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(r.ok){const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();if(/^[a-z0-9_-]+$/.test(id))return{id}}}catch{}return null}
function rowish(el,trusted=false){if(!shown(el))return false;const t=clean(el.textContent);return t.length>=6&&t.length<=1200&&TIME_RE.test(t)&&(trusted||NOTICE_RE.test(t))}
function candidate(node,stop){let p=node,best=null,d=0;while(p&&p!==document.body&&d++<7){if(rowish(p,false))best=p;const t=clean(p.textContent);if(t.length>1200)break;if(p===stop)break;p=p.parentElement}return best}
function rows(root){if(!root?.querySelectorAll)return[];const known=[];for(const el of root.querySelectorAll(ITEM)){if(rowish(el,true))known.push(el);if(known.length>=260)break}if(known.length)return[...new Set(known)];const out=[];let n=0;for(const el of root.querySelectorAll('time,[datetime],a[href]')){if(n++>420)break;if(!shown(el))continue;const c=candidate(el,root);if(!c)continue;if(out.some(x=>x===c||x.contains(c)))continue;for(let i=out.length-1;i>=0;i--)if(c.contains(out[i]))out.splice(i,1);out.push(c);if(out.length>=260)break}return out}
function findPanel(){const marked=document.querySelector(SHELL);if(marked&&shown(marked)&&rows(marked).length)return marked;if(!notificationRoute())return null;for(const c of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],[class*="notification" i],[class*="notice" i]')){if(shown(c)&&/通知/u.test(clean(c.textContent))&&rows(c).length)return c}return null}
function scrollHost(panel){let p=rows(panel)[0]||panel,d=0;while(p&&d++<10){try{if(p.scrollHeight>p.clientHeight+30&&/(auto|scroll)/.test(getComputedStyle(p).overflowY))return p}catch{}p=p.parentElement}try{if(panel.scrollHeight>panel.clientHeight+30)return panel}catch{}return document.scrollingElement||document.documentElement}
function links(el){const out=[];for(const a of el.querySelectorAll('a[href]')){try{const u=new URL(a.getAttribute('href'),location.href);if(u.hostname.endsWith('note.com'))out.push({a,u:u.href,t:clean(a.textContent)})}catch{}if(out.length>=18)break}return out}
function rowData(el){const raw=clean(el.textContent);if(!raw||raw.length>1200)return null;const ls=links(el),actor=ls.find(x=>creatorId(x.u))||null,target=ls.find(x=>/\/n\/|\/m\/|\/membership|kind=|scrollpos=comment/i.test(x.u))||null,tm=el.querySelector('time[datetime]')?.getAttribute('datetime')||el.querySelector('[datetime]')?.getAttribute('datetime')||null,m=stripTime(raw).match(/^(.{1,180}?)\s*さん/u);let img=null;for(const x of el.querySelectorAll('img[src]')){const src=String(x.currentSrc||x.src||'');if(src&&!/cover|ogp|magazine/i.test(src)){img=src;break}}return{raw_text:raw,actor_name:actor?.t||m?.[1]||null,actor_url:actor?.u||null,actor_image_url:img,target_title:target?.t||null,target_url:target?.u||null,source_url:target?.u||actor?.u||'https://note.com/',occurred_at:tm,meta:{source:'note-notification-bottom-up-v2970',userscript:VERSION,protocol:PROTOCOL,scan_mode:'oldest-to-newest-incremental'}}}
const sig=r=>[stripTime(r.raw_text),String(r.target_url||'').split('#')[0],String(r.actor_url||'').split('?')[0]].join('|');
function ui(){try{const f=document.getElementById(FRAME),d=f?.contentDocument;if(d)return{frame:f,doc:d,read:d.getElementById('read'),health:d.getElementById('health'),settings:d.getElementById('settings')}}catch{}return{frame:null,doc:null,read:null,health:null,settings:null}}
let scanning=false,stop=false,autoPass=0;
function health(msg,cls=''){const x=ui();if(x.health){x.health.textContent=msg;x.health.className='health '+cls}if(x.read)x.read.textContent=scanning?(stop?'停止→保存中…':'■ 自動読込を停止'):'前回の続きから読込'}
async function sendBatch(input,a,saved){if(!input.length)return 0;const token=String(await get(key(TOKEN,a.id),'')||'');if(!token)throw new Error('PAIR_REQUIRED');let total=0;for(let i=0;i<input.length;i+=BATCH){const part=input.slice(i,i+BATCH).filter(r=>!saved.has(sig(r)));if(!part.length)continue;const payload=part.map(r=>({...r,meta:{...(r.meta||{}),client_signature:sig(r)}})),p=await request(INGEST,{noteId:a.id,notifications:payload},{'X-Ingest-Token':token});const confirmed=Array.isArray(p.confirmedClientSignatures)&&p.confirmedClientSignatures.length?p.confirmedClientSignatures.map(String):payload.map(sig);for(const s of confirmed)saved.add(s);total+=confirmed.length;await yieldUi()}return total}
function resumeSignature(cp){return String(cp?.resumeSignatureV2970||'')}
async function seekOldest(host){let stall=0,lastHeight=-1,lastTop=-1;health('古い通知まで下へ移動中…','saving');for(let i=0;i<SEEK_MAX&&!stop;i++){const max=Math.max(0,Number(host.scrollHeight||0)-Number(host.clientHeight||0));try{host.scrollTop=max}catch{}await sleep(SEEK_WAIT);await yieldUi();const h=Number(host.scrollHeight||0),t=Number(host.scrollTop||0),nextMax=Math.max(0,h-Number(host.clientHeight||0));health(`古い通知まで移動中… ${i+1}/${SEEK_MAX}`,'saving');if(Math.abs(h-lastHeight)<2&&Math.abs(t-lastTop)<2&&t>=nextMax-2)stall++;else stall=0;lastHeight=h;lastTop=t;if(stall>=SEEK_STALL)break}return Number(host.scrollTop||0)}
async function restoreCheckpoint(panel,host,cp){const wanted=resumeSignature(cp);if(!wanted)return'';health('前回保存位置を探しています…','saving');const savedTop=Number(cp?.resumeScrollTopV2970||0);if(savedTop>0){try{host.scrollTop=Math.min(savedTop,Math.max(0,host.scrollHeight-host.clientHeight))}catch{}await sleep(180)}for(let pass=0;pass<24&&!stop;pass++){for(const el of rows(panel)){const d=rowData(el);if(d&&sig(d)===wanted){try{el.scrollIntoView({block:'center'})}catch{}await sleep(120);return wanted}}const max=Math.max(0,Number(host.scrollHeight||0)-Number(host.clientHeight||0));if(Number(host.scrollTop||0)>=max-2)break;try{host.scrollTop=Math.min(max,Number(host.scrollTop||0)+Math.max(220,Number(host.clientHeight||300)*.82))}catch{}await sleep(250);await yieldUi()}return''}
function collectAbove(panel,checkpoint,seen,out){const current=rows(panel).map(rowData).filter(Boolean);let cut=current.length;if(checkpoint){const idx=current.findIndex(r=>sig(r)===checkpoint);if(idx>=0)cut=idx}for(let i=cut-1;i>=0;i--){const r=current[i],s=sig(r);if(s===checkpoint||seen.has(s))continue;seen.add(s);out.push(r);if(out.length>=MAX_NEW)break}}
async function persistProgress(a,baseCp,saved,chunk,host,reason,reachedTop,totalSeen,totalConfirmed){const confirmed=await sendBatch(chunk,a,saved);await set(key(SAVED,a.id),[...saved].slice(-12000));const newest=chunk.length?chunk[chunk.length-1]:null,newSig=newest?sig(newest):resumeSignature(baseCp),now=Date.now(),next={...baseCp,lastSaveAt:confirmed?now:Number(baseCp?.lastSaveAt||0),lastCheckAt:now,savedCount:saved.size,lastError:'',manualNewCount:Number(totalConfirmed||0)+confirmed,manualSeenCount:Number(totalSeen||0),version:VERSION,boundarySignature:newSig||String(baseCp?.boundarySignature||''),boundaryAt:newSig?now:Number(baseCp?.boundaryAt||0),resumeSignatureV2970:newSig,resumeScrollTopV2970:Number(host.scrollTop||0),resumeSavedAtV2970:now,resumeReasonV2970:reason,resumeReachedTopV2970:Boolean(reachedTop),boundarySource:'bottom-up-v2970'};await set(key(CHECK,a.id),next);return{confirmed,next}}
async function scan(autoContinue=false){
  if(scanning){if(!autoContinue){stop=true;health('停止地点まで保存します…','saving')}return}
  if(!autoContinue)autoPass=0;
  const panel=findPanel();if(!panel){health('🔔通知一覧を開いてください','error');return}
  const a=await account();if(!a){health('noteログインを確認してください','error');return}
  const token=String(await get(key(TOKEN,a.id),'')||'');if(!token){health('本人連携が必要です','error');return}
  scanning=true;stop=false;
  const originalCp=await get(key(CHECK,a.id),{}),savedRaw=await get(key(SAVED,a.id),[]),saved=new Set(Array.isArray(savedRaw)?savedRaw.map(String):[]),host=scrollHost(panel),ordered=[],seen=new Set();
  let liveCp=originalCp,checkpoint='',flushed=0,totalConfirmed=0,stall=0,steps=0,reachedTop=false,continueAfter=false;
  try{
    checkpoint=await restoreCheckpoint(panel,host,liveCp);
    if(!checkpoint){await seekOldest(host);checkpoint='';health('最も古い側から上へ読込開始…','saving')}
    else health('前回保存位置から上へ読込再開…','saving');
    while(steps<MAX_UP_STEPS&&!stop&&ordered.length<MAX_NEW){
      collectAbove(panel,checkpoint,seen,ordered);
      if(ordered.length-flushed>=SAVE_EVERY){const chunk=ordered.slice(flushed);const r=await persistProgress(a,liveCp,saved,chunk,host,'progress',false,ordered.length,totalConfirmed);liveCp=r.next;totalConfirmed+=r.confirmed;flushed=ordered.length;health(`古い側→新しい側へ読込中… ${ordered.length}件｜保存 ${totalConfirmed}件`,'saving')}
      if(stop||ordered.length>=MAX_NEW)break;
      const before=Number(host.scrollTop||0);if(before<=2){reachedTop=true;break}
      try{host.scrollTop=Math.max(0,before-Math.max(220,Number(host.clientHeight||300)*.82))}catch{}
      await sleep(STEP_WAIT);await yieldUi();steps++;
      const after=Number(host.scrollTop||0);stall=Math.abs(after-before)<2?stall+1:0;
      if(stall>=UP_STALL){reachedTop=after<=2;break}
    }
    const pending=ordered.slice(flushed),reason=stop?'manual-stop':ordered.length>=MAX_NEW?'safe-chunk-limit':reachedTop?'top':'step-limit';
    if(pending.length||!ordered.length){const r=await persistProgress(a,liveCp,saved,pending,host,reason,reachedTop,ordered.length,totalConfirmed);liveCp=r.next;totalConfirmed+=r.confirmed}
    if(reason==='safe-chunk-limit'&&autoPass<AUTO_PASS_LIMIT){autoPass++;continueAfter=true;health(`区切り保存 ✓ ${totalConfirmed}件｜続けて上へ ${autoPass}/${AUTO_PASS_LIMIT}`,'done')}
    else if(stop)health(`停止地点まで保存 ✓ ${totalConfirmed}件｜次回ここから上へ`,'done');
    else if(reachedTop)health(`全通知 保存完了 ✓ ${totalConfirmed}件｜古い側から最新まで確認`,'done');
    else health(`区切り保存 ✓ ${totalConfirmed}件｜続きは同じ位置から`,'done')
  }catch(e){const msg=String(e?.message||e);await set(key(CHECK,a.id),{...liveCp,lastError:msg,lastCheckAt:Date.now(),version:VERSION});health(`⚠ ${msg}`,'error')}
  finally{scanning=false;stop=false;if(continueAfter)setTimeout(()=>void scan(true),550);else setTimeout(()=>{const x=ui();if(x.health&&!/⚠|必要|確認/.test(x.health.textContent||''))health('通知一覧を認識しました')},2400)}
}
function bind(){try{const f=document.getElementById(FRAME),d=f?.contentDocument,b=d?.getElementById('read'),settings=d?.getElementById('settings');if(!d||!b||!settings)return false;if(b.dataset.mumeiBottomUp==='2970')return true;b.dataset.mumeiBottomUp='2970';b.textContent='前回の続きから読込';settings.textContent='フィルター設定';d.addEventListener('click',e=>{const t=e.target;if(!(t instanceof d.defaultView.HTMLElement))return;if(t.id==='read'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void scan(false);return}if(t.id==='settings'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();location.assign(FILTER_URL)}},true);return true}catch{return false}}
let tries=0;function later(){if(bind()||tries++>100)return;setTimeout(later,300)}setTimeout(later,120);new MutationObserver(()=>{tries=0;setTimeout(later,20)}).observe(document.documentElement,{subtree:true,childList:true});window.addEventListener('pageshow',()=>{tries=0;setTimeout(later,80)});window.addEventListener('focus',()=>{tries=0;setTimeout(later,80)});
})();