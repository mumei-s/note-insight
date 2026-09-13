(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationAutoscan2970)return;window.__mumeiNotificationAutoscan2970=true;
const VERSION='2.9.69',PROTOCOL='2.9.69';
const INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-ingest-v2';
const TOKEN='mumei_insight_notification_sync_token_v2:',SAVED='mumei_insight_notification_saved_v2919:',CHECK='mumei_insight_notification_checkpoint_v2922:';
const PRIMARY='mumei-v2948-frame',FALLBACK='mumei-notice-reader-v2963',SHELL='[data-mumei-notice-shell-v2958="1"]';
const INSIGHT='https://mumei-s.github.io/note-insight/notification-entry.html?from=note&insightMode=notifications#dashboard';
const SETUP='https://mumei-s.github.io/note-insight/notification-setup.html?from=note';
const FILTER='https://mumei-s.github.io/note-insight/notification-filter.html?from=note';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[class*="NotificationItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const TIME_RE=/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)/u;
const NOTICE_RE=/(?:さん|通知|新しい記事|追加しました|フォロー|コメント|返信|スキ|いいね|リアクション|購入|チップ|サポート|支援|応援金|メンバー|メンバーシップ|メンシプ|プラン|加入|入会|マガジン|掲示板|話題|高評価|引用|紹介)/u;
const EXCLUDE=new Set(['settings','sitesettings','membership','memberships','notifications','messages','search','explore','login','signup']);
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const stripTime=v=>clean(v).replace(/\s*(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)$/u,'').trim();
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(k,d){if(modern()&&typeof GM.getValue==='function')return GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d);return d}
async function set(k,v){if(modern()&&typeof GM.setValue==='function')return GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}
function request(url,body,headers={}){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));fn({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300&&p.ok!==false?resolve(p):reject(new Error(p.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
function shown(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return false;for(let p=el;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||p.hasAttribute('inert')||s.display==='none'||s.visibility==='hidden')return false}return true}
function creatorId(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean),id=(p[0]||'').toLowerCase();return u.hostname.endsWith('note.com')&&p.length===1&&/^[a-z0-9_-]+$/.test(id)&&!EXCLUDE.has(id)?id:''}catch{return''}}
function accountFromDom(){const selectors=['header a[href]','nav a[href]','[class*="header" i] a[href]','[data-testid*="profile" i] a[href]'];for(const a of document.querySelectorAll(selectors.join(','))){if(!shown(a))continue;const id=creatorId(a.getAttribute('href'));if(!id)continue;const r=a.getBoundingClientRect();if(r.top<220||a.querySelector('img'))return{id}}return null}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(r.ok){const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();if(/^[a-z0-9_-]+$/.test(id))return{id}}}catch{}return null}
function rowish(el,trusted=false){if(!shown(el))return false;const t=clean(el.textContent);return t.length>=3&&t.length<=4000&&(trusted||TIME_RE.test(t))}
function rows(root){if(!root?.querySelectorAll)return[];const exact=[...root.querySelectorAll('.m-navbarNoticeItem,[data-testid="notification-item"],[data-testid="notice-item"]')].filter(el=>rowish(el,true));if(exact.length)return exact.filter(el=>!exact.some(other=>other!==el&&other.contains(el)));const known=[...root.querySelectorAll(ITEM)].filter(el=>rowish(el,true)&&!String(el.className).includes('__'));if(known.length)return known.filter(el=>!known.some(other=>other!==el&&other.contains(el)));
 // The enclosing notification list is already verified. Keep unknown wording as well.
 const out=[];for(const el of root.querySelectorAll('li,[role="listitem"],a[href]')){if(!rowish(el))continue;if(out.some(x=>x.contains(el)))continue;for(let i=out.length-1;i>=0;i--)if(el.contains(out[i]))out.splice(i,1);out.push(el)}return out;
}
function findPanel(){const shell=document.querySelector(SHELL);if(!shell||!shown(shell)||shell===document.body||shell===document.documentElement)return null;
 const labels=[...shell.querySelectorAll('button,a,[role="tab"],[role="button"]')].filter(shown).map(el=>clean(el.textContent));
 if(!((labels.some(t=>/^通知(?:\s*\d+)?$/.test(t))&&labels.some(t=>/^お知らせ(?:\s*\d+)?$/.test(t)))||shell.matches('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notificationList" i],[class*="noticeList" i]')))return null;
 return shell;
}
function scrollHost(panel){const xs=rows(panel);let p=xs[0]||panel;while(p&&panel.contains(p)){if(p.scrollHeight>p.clientHeight+20&&/(auto|scroll)/.test(getComputedStyle(p).overflowY))return p;if(p===panel)break;p=p.parentElement}return panel.scrollHeight>panel.clientHeight+20?panel:null}
function links(el){const out=[];for(const a of [...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')]){try{const u=new URL(a.getAttribute('href'),location.href);if(u.hostname.endsWith('note.com'))out.push({a,u:u.href,t:clean(a.textContent)})}catch{}if(out.length>=18)break}return out}
function estimatedTime(raw){const m=clean(raw).match(/(\d+)\s*(秒|分|時間|日|週)前$/u);if(m){const unit={'秒':1000,'分':60000,'時間':3600000,'日':86400000,'週':604800000};return new Date(Date.now()-Number(m[1])*unit[m[2]]).toISOString()}return null}
function rowData(el){const raw=clean(el.textContent);if(!raw||raw.length>4000)return null;const ls=links(el),actor=ls.find(x=>creatorId(x.u))||null,target=ls.find(x=>/[?&]kind=/.test(x.u))||ls.find(x=>/\/n\/|\/m\/|\/membership|kind=|scrollpos=comment/i.test(x.u))||null,tm=el.querySelector('time[datetime]')?.getAttribute('datetime')||el.querySelector('[datetime]')?.getAttribute('datetime')||null,m=stripTime(raw).match(/^(.{1,180}?)\s*さん/u);let img=null;for(const x of el.querySelectorAll('img[src]')){const src=String(x.currentSrc||x.src||'');if(src&&!/cover|ogp|magazine/i.test(src)){img=src;break}}return{raw_text:raw,actor_name:actor?.t||m?.[1]||null,actor_url:actor?.u||null,actor_image_url:img,target_title:target?.t||null,target_url:target?.u||null,source_url:target?.u||actor?.u||'https://note.com/',occurred_at:tm||estimatedTime(raw),meta:{source:'note-notification-manual-sync-v2968',capture_source:'note-notification-reader-v2968',userscript:VERSION,protocol:PROTOCOL,scan_mode:'verified-shell-bottom-to-top',event_identity:eventIdentity(el,raw,tm),verified_shell:true,time_estimated:!tm,article_url:ls.find(x=>/\/n\//.test(x.u))?.u||null,magazine_url:ls.find(x=>/\/m\//.test(x.u))?.u||null,links:ls.map(x=>({url:x.u,title:x.t}))}}}
function eventIdentity(el,raw,tm){
 const id=el.getAttribute('data-notification-id')||el.getAttribute('data-notice-id')||el.querySelector('[data-notification-id]')?.getAttribute('data-notification-id');
 if(id)return 'notice:'+id;
 for(const a of [...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')]){try{const u=new URL(a.href);for(const k of ['notification_id','notice_id','c','comment_id'])if(u.searchParams.get(k))return 'notice:'+u.searchParams.get(k)}catch{}}
 if(tm&&!Number.isNaN(Date.parse(tm)))return 'time:'+new Date(tm).toISOString();
 // Relative labels are evidence of a date, never a durable event ID.
 const m=clean(raw).match(/(\d+)\s*(秒|分|時間|日|週)前$/u);
 if(m){const scale={'秒':1000,'分':60000,'時間':3600000,'日':86400000,'週':604800000};const at=Date.now()-Number(m[1])*scale[m[2]],bucket=Math.max(60000,scale[m[2]]);return 'estimated:'+Math.floor(at/bucket)+':'+bucket}
 return 'label:'+clean(raw).match(TIME_RE)?.[0];
}
const sig=r=>[stripTime(r.raw_text),String(r.target_url||'').split('#')[0],String(r.actor_url||'').split('?')[0],r.meta?.event_identity||r.occurred_at||'unknown'].join('|');
function ui(){for(const id of[PRIMARY,FALLBACK]){try{const f=document.getElementById(id),d=f?.contentDocument;if(d)return{frame:f,doc:d,read:d.getElementById('read'),health:d.getElementById('health')}}catch{}}return{frame:null,doc:null,read:null,health:null}}
let scanning=false,stop=false,autoPass=0;
function health(msg,cls=''){const x=ui();if(x.health){x.health.dataset.readerStatus='1';x.health.textContent=msg;x.health.className='health '+cls}if(x.read)x.read.textContent=scanning?(stop?'停止→保存中…':'■ 停止して保存'):'下から読込'}
function fallbackHtml(){return`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui}.dock{height:48px;padding:3px;display:grid;grid-template-columns:1.5fr .8fr .9fr;grid-template-rows:25px 15px;gap:2px;border:1px solid #355063;border-radius:10px;background:#0e1c26}button{height:25px;border:1px solid #42667b;border-radius:6px;background:#102737;color:#e3f8ff;font:900 8px/1 system-ui}.health{grid-column:1/-1;height:15px;display:flex;align-items:center;justify-content:center;border:1px solid #355063;border-radius:5px;background:#091923;color:#c5d8e5;font:850 7px/1 system-ui}.saving{color:#fff0a7}.error{color:#ffd2d7}.done{color:#c8ffda}</style><div class="dock"><button id="read">下から読込</button><button id="settings">設定</button><button id="ins">INSIGHT【通知】</button><div id="health" class="health">通知一覧を認識しました</div></div>`}
function ensureFallback(){}
async function sendBatch(input,a,saved){if(!input.length)return 0;const token=String(await get(key(TOKEN,a.id),'')||'');if(!token)throw new Error('PAIR_REQUIRED');let total=0;for(let i=0;i<input.length;i+=25){const part=input.slice(i,i+25).filter(r=>!saved.has(sig(r)));if(!part.length)continue;const payload=part.map(r=>({...r,meta:{...(r.meta||{}),client_signature:sig(r)}})),p=await request(INGEST,{noteId:a.id,notifications:payload},{'X-Ingest-Token':token});const sent=new Set(payload.map(sig)),confirmed=Array.isArray(p.confirmedClientSignatures)?p.confirmedClientSignatures.map(String).filter(s=>sent.has(s)):[];for(const s of confirmed)saved.add(s);total+=confirmed.length;await set(key(SAVED,a.id),[...saved].slice(-12000));if(confirmed.length!==payload.length)throw new Error('一部の通知が未保存です。再読込で再試行します');await sleep(30)}return total}
async function seekOldest(host,panel){if(!host)return;let same=0,last=-1;for(let i=0;i<80&&!stop;i++){if(findPanel()!==panel)throw new Error('通知一覧を閉じたため中断しました');host.scrollTop=Math.max(0,host.scrollHeight-host.clientHeight);health('古い通知を確認中…','saving');await sleep(350);const height=host.scrollHeight;if(height===last)same++;else same=0;last=height;if(same>=3)return}if(!stop)throw new Error('古い通知の読み込みが続いています。再読込で続けてください')}
async function scan(){
 if(scanning){stop=true;health('停止地点まで保存します…','saving');return}
 const filter=ui().doc?.getElementById('filter');if(filter?.classList.contains('on')){filter.click();await sleep(150)}const panel=findPanel();if(!panel){health('本物の🔔通知一覧を開いてください','error');return}
 const a=await account();if(!a){health('noteログインを確認してください','error');return}
 if(!String(await get(key(TOKEN,a.id),'')||'')){health('本人連携が必要です｜読込ボタンで修復','error');const x=ui();if(x.read)x.read.dataset.repair='1';return}
 scanning=true;stop=false;const cp=await get(key(CHECK,a.id),{}),savedRaw=await get(key(SAVED,a.id),[]),saved=new Set(Array.isArray(savedRaw)?savedRaw.map(String):[]),seen=new Set(),host=scrollHost(panel);let count=0,readCount=0,steps=0,stalls=0,newest=null,queue=[];
 try{
  // Only this notification list can move. Never scroll the background document.
  await seekOldest(host,panel);
  await sleep(100);
  while(!stop&&steps++<250){
   if(findPanel()!==panel||!panel.isConnected)throw new Error('通知一覧を閉じたため中断しました。保存済み分は保持しています');
   const entries=rows(panel).slice().reverse();
   for(const el of entries){const r=rowData(el);if(!r)continue;const id=sig(r);el.dataset.mumeiReaderSignature=id;if(seen.has(id))continue;seen.add(id);readCount++;if(saved.has(id))continue;queue.push(r);newest=r;if(queue.length>=25){health(`下から読込 ${readCount}件｜保存 ${count}件`,'saving');count+=await sendBatch(queue,a,saved);queue=[];if(stop)break}}
   if(!host)break;const before=host.scrollTop;if(before<=1)break;
   host.scrollTop=Math.max(0,before-Math.max(160,host.clientHeight*.75));await sleep(350);
   stalls=Math.abs(host.scrollTop-before)<1?stalls+1:0;if(stalls>=3)break;
  }
  count+=await sendBatch(queue,a,saved);
  const now=Date.now();await set(key(CHECK,a.id),{...cp,lastSaveAt:count?now:cp.lastSaveAt,lastCheckAt:now,savedCount:saved.size,lastError:'',manualNewCount:count,manualSeenCount:readCount,version:VERSION,boundarySignature:newest?sig(newest):cp.boundarySignature,boundaryLegacySignature:newest?[stripTime(newest.raw_text),String(newest.target_url||'').split('#')[0],String(newest.actor_url||'').split('?')[0]].join('|'):cp.boundaryLegacySignature,boundaryAt:now,boundarySource:'reader-v2968'});
  health(`${stop?'停止・':''}${count}件保存確認｜${readCount}件読取${steps>=250?'｜残りは再読込':''}`,'done');
 }catch(e){health(`⚠ ${String(e?.message||e)}`,'error')}finally{scanning=false;stop=false;const x=ui();if(x.read)x.read.textContent='下から読込'}
}
function bindFrame(f){try{const d=f.contentDocument;if(!d||d.documentElement.dataset.mumeiReader2963==='1')return false;const read=d.getElementById('read'),settings=d.getElementById('settings'),ins=d.getElementById('ins');if(!read)return false;d.documentElement.dataset.mumeiReader2963='1';read.textContent='下から読込';d.addEventListener('click',e=>{const t=e.target;if(!(t instanceof d.defaultView.HTMLElement))return;if(t.id==='read'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(t.dataset.repair==='1'){location.assign(SETUP);return}void scan(false);return}if(t.id==='settings'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();location.assign(FILTER);return}if(t.id==='ins'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void account().then(a=>{const u=new URL(INSIGHT);if(a?.id)u.searchParams.set('account',a.id);location.assign(u.href)})}},true);return true}catch{return false}}
let tries=0;function bind(){const primary=document.getElementById(PRIMARY),fallback=document.getElementById(FALLBACK);if(primary&&bindFrame(primary))return true;if(fallback&&bindFrame(fallback))return true;ensureFallback();const f=document.getElementById(FALLBACK);return!!(f&&bindFrame(f))}
function later(){if(bind()||tries++>80)return;setTimeout(later,300)}setTimeout(later,150);let scheduled=0;new MutationObserver(()=>{clearTimeout(scheduled);scheduled=setTimeout(()=>{tries=0;later()},180)}).observe(document.documentElement,{subtree:true,childList:true});window.addEventListener('pageshow',()=>{tries=0;setTimeout(later,100)});window.addEventListener('focus',()=>{tries=0;setTimeout(later,100)});
})();