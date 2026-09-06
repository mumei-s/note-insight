(function(){
'use strict';
if(location.hostname!=='note.com')return;
const V='2.9.21';
const ING='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-ingest-v2';
const TOK='mumei_insight_notification_sync_token_v2:';
const SAVED='mumei_insight_notification_saved_v2919:';
const CHECK='mumei_insight_notification_checkpoint_v2919:';
const SRC='note-notification-continuous-sync-v2921';
const EVT_STATUS='mumei-insight-sync-status-v2921';
const EVT_MANUAL='mumei-insight-manual-read-v2921';
const SEL=['.m-navbarNoticeItem','[class*="navbarNoticeItem"]','[class*="notificationItem" i]','[class*="noticeItem" i]','[data-testid*="notification-item" i]','[data-testid*="notice-item" i]'];
const ITEM=SEL.join(',');
const ACT=/(?:スキ(?:しました|されました)|コメント.{0,100}(?:しました|返信|スキ)|返信(?:しました|がありました)|フォロー(?:しました|されました)|追加(?:しました|されました)|仲間入りしました|参加しました|メンバーになりました|購入|メンバーシップ|掲示板|チップ|サポート|支援|応援金|話題|高評価|ポイント|引用され|紹介され|記事を投稿しました)/u;
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\b保完\b/g,' ').replace(/保完(?=\s|$)/g,' ').replace(/\s+/g,' ').trim();
const stripTime=v=>clean(v).replace(/\s(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)$/u,'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const key=(p,id)=>p+String(id||'').toLowerCase();
const modern=()=>Boolean(globalThis.GM);
async function get(k,d){if(modern()&&GM.getValue)return GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d);return d}
async function set(k,v){if(modern()&&GM.setValue)return GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}
function request(url,body,headers={}){return new Promise((resolve,reject)=>{const fn=modern()&&GM.xmlHttpRequest?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('NO_GM_REQUEST'));fn({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300?resolve(p):reject(new Error(p.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
let accountId='',busy=false,timer=0,lastSync=0;
function emit(state,text,extra={}){window.dispatchEvent(new CustomEvent(EVT_STATUS,{detail:{state,text,at:Date.now(),...extra}}))}
async function account(){if(accountId)return{id:accountId};try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();if(!/^[a-z0-9_-]+$/.test(id))return null;accountId=id;return{id}}catch{return null}}
function visible(el){if(!el?.getBoundingClientRect)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'}
function rawItems(){return[...document.querySelectorAll(ITEM)].filter(el=>visible(el)&&!el.closest?.('#mumei-v2921-rail,#mumei-v2921-settings'))}
function links(el){return[...(el.matches?.('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')].map(a=>{try{const u=new URL(a.getAttribute('href'),location.href);return u.hostname.endsWith('note.com')?{u:u.href,t:clean(a.textContent)}:null}catch{return null}}).filter(Boolean)}
function targetLink(ls){return ls.find(x=>/\/membership\/boards\/|\/m\/|\/n\/|kind=board_reply_comment|scrollpos=comment/.test(x.u))||null}
function actorLink(ls,raw){const self=/^あなたの記事が/u.test(stripTime(raw));return ls.find(x=>{try{const p=new URL(x.u).pathname.split('/').filter(Boolean),id=(p[0]||'').toLowerCase();return p.length===1&&/^[a-z0-9_-]+$/.test(id)&&!['settings','sitesettings'].includes(id)&&!(self&&id===accountId)}catch{return false}})||null}
function typeOf(text,targetUrl){const t=clean(text),target=targetUrl||'';
 if(/(?:あなたのコメント.{0,80}(?:に|へ).{0,20}スキ(?:しました|されました)|コメントにスキしました|コメントをスキしました)/.test(t))return'comment_like';
 if(/(?:あなたの記事にスキしました|あなたの投稿にスキしました|「[^」]{0,500}」にスキしました|新しいスキが\d*件?増えました|さん他?\d*名?があなたの記事にスキしました)/.test(t))return'like';
 if(/(?:あなたのコメント.{0,80}返信|コメントへの返信|コメントに返信しました|返信がありました)/.test(t)&&(/\/membership\/boards\//.test(target)||/[?&]kind=board_reply_comment(?:&|$)/.test(target)))return'membership_board_reply';
 if(/(?:あなたのコメント.{0,80}返信|コメントへの返信|コメントに返信しました|返信がありました)/.test(t))return'reply';
 if(/(?:あなたの記事.{0,80}コメントしました|新しいコメントが\d*件?増えました|コメントがありました)/.test(t))return'comment';
 if(/メンバーシップ.{0,80}掲示板.{0,40}投稿しました/.test(t))return'membership_board';
 if(/メンバーシップを(?:はじめ|始め|開始し)ました/.test(t))return'membership_started';
 if(/メンバーシップ.{0,80}(?:新しいプラン.{0,30}(?:追加|公開)しました|プラン.{0,30}(?:追加|公開)しました)/.test(t))return'membership_plan';
 if(/(?:あなたのメンバーシップ.{0,50}参加しました|あなたのメンバーシップ.{0,50}メンバーになりました|メンバーシップに参加しました)/.test(t))return'membership_join';
 if(/(?:運営メンバーに仲間入りしました|マガジン.{0,80}参加しました|共同マガジン.{0,80}仲間入りしました)/.test(t))return'magazine_join';
 if(/(?:あなたの記事が.{0,320}に追加されました|あなたの記事を.{0,180}マガジン.{0,80}追加)/.test(t))return'my_article_magazine_added';
 if((/\/m\//.test(target)&&/をフォローしました/.test(t))||/マガジンをフォローしました/.test(t))return'magazine_follow';
 if(/(?:あなたをフォローしました|フォローされました|新しいフォロワー|さんがあなたをフォロー)/.test(t))return'follow';
 if(/(?:に新しい記事を\d*本?追加しました|に記事を追加しました|マガジン.{0,80}(?:記事|新しい記事).{0,30}追加しました|メンバー特典マガジンに記事)/.test(t))return'magazine_article_added';
 if(/(?:さんが記事を投稿しました|さんが新しい記事を投稿しました)/.test(t))return'creator_article_posted';
 if(/(?:あなたの記事.{0,20}話題です|あなたの記事.{0,20}話題になりました|あなたの記事\s*が話題です)/.test(t))return'buzz';
 if(/(?:あなたの記事が購入されました|あなたの有料記事が購入されました|購入がありました|さんがあなたの記事を購入しました)/.test(t))return'purchase';
 if(/(?:さん(?:から|より).{0,80}(?:チップ|サポート|支援|応援金)|(?:チップ|サポート|支援|応援金).{0,180}(?:届き|届いた|届きました|受け取り|受け取った|受け取りました|もらい|もらいました|いただき|いただきました|贈られ|送られ|されました))/u.test(t))return'tip';
 if(/(?:あなたの記事.{0,40}引用され|あなたの記事.{0,40}紹介され)/.test(t))return'quote';
 if(/あなたの記事を高評価しました/.test(t))return'rating';
 if(/(?:あなたにポイント|ポイントが付与|ポイントを獲得)/.test(t))return'points';
 return'other';
}
function candidate(el){const t=clean(el.textContent);if(t.length<5||t.length>700||!ACT.test(t))return false;return typeOf(t,targetLink(links(el))?.u||null)!=='other'}
function items(){const list=rawItems().filter(candidate);return list.filter(el=>!list.some(other=>other!==el&&other.contains(el)&&clean(other.textContent).length<=700))}
function row(el){const raw=clean(el.textContent);if(raw.length<5||raw.length>700)return null;const ls=links(el),target=targetLink(ls),actor=actorLink(ls,raw),targetUrl=target?.u||null,type=typeOf(raw,targetUrl);if(type==='other')return null;const tm=el.querySelector('time[datetime]')?.getAttribute('datetime')||el.querySelector('[datetime]')?.getAttribute('datetime')||null;const m=stripTime(raw).match(/^(.{1,150}?)\s*さん(?:他\d+名)?(?:が|の|から|より)/u),self=stripTime(raw).match(/^あなたの記事が\s*(.+?)\s*に追加されました/u),im=el.querySelector('img[src]');return{raw_text:raw,actor_name:actor?.t||m?.[1]||null,actor_url:actor?.u||null,actor_image_url:im?.currentSrc||im?.src||null,target_title:target?.t||self?.[1]||null,target_url:targetUrl,source_url:target?.u||actor?.u||null,occurred_at:tm,meta:{source:SRC,via:'notification-panel-v2921',userscript:V,local_kind:type}}}
const signature=r=>[stripTime(r.raw_text),String(r.target_url||'').split('#')[0],String(r.actor_url||'').split('?')[0]].join('|');
function unread(el){return Boolean(el.matches?.('[aria-label*="未読"],[data-testid*="unread" i],[class*="unread" i],[class*="unseen" i]')||el.querySelector?.('[aria-label*="未読"],[data-testid*="unread" i],[class*="unread" i],[class*="unseen" i]'))}
function rows(){return items().map(el=>({el,r:row(el),unread:unread(el)})).filter(x=>x.r).sort((a,b)=>Number(b.unread)-Number(a.unread))}
function scrollBox(){const first=items()[0];let p=first?.parentElement;for(let i=0;i<12&&p&&p!==document.body&&p!==document.documentElement;i++,p=p.parentElement){const s=getComputedStyle(p);if(/auto|scroll/.test(s.overflowY)&&p.scrollHeight>p.clientHeight+100&&p.clientHeight>140)return p}return null}
async function loadSaved(id){const a=await get(key(SAVED,id),[]);return new Set(Array.isArray(a)?a:[])}
async function saveSaved(id,s){await set(key(SAVED,id),[...s].slice(-3000))}
async function sendBatch(batch,a){if(!batch.length)return{confirmed:[],inserted:0,updated:0,skipped:0,blocked:0};const token=String(await get(key(TOK,a.id),'')||'');if(!token)throw new Error('PAIR_REQUIRED');let inserted=0,updated=0,skipped=0,blocked=0,confirmed=[];const send=xs=>request(ING,{noteId:a.id,notifications:xs.map(r=>({...r,meta:{...(r.meta||{}),client_signature:signature(r)}}))},{'X-Ingest-Token':token});for(let i=0;i<batch.length;i+=100){const part=batch.slice(i,i+100),p=await send(part);inserted+=+p.inserted||0;updated+=+p.updated||0;skipped+=+p.skipped||0;blocked+=+p.blocked||0;if((+p.skipped||0)===0&&(+p.blocked||0)===0)confirmed.push(...part.map(signature));else for(const r of part){const one=await send([r]);inserted+=+one.inserted||0;updated+=+one.updated||0;if((+one.inserted||0)+(+one.updated||0)>0)confirmed.push(signature(r))}}return{confirmed:[...new Set(confirmed)],inserted,updated,skipped,blocked}}
function markerStyle(){if(document.getElementById('mumei-v2921-marker-style'))return;const s=document.createElement('style');s.id='mumei-v2921-marker-style';const off=SEL.map(x=>`${x}:not([data-mumei-insight-saved="1"])::after`).join(',');const on=SEL.map(x=>`${x}[data-mumei-insight-saved="1"]::after`).join(',');s.textContent=`${off}{content:none!important;display:none!important}${on}{content:'保完'!important;display:block!important;position:absolute!important;right:6px!important;bottom:5px!important;z-index:8!important;padding:1px 4px!important;border:1px solid #4d8f69!important;border-radius:999px!important;background:rgba(10,49,31,.88)!important;color:#bfffd1!important;font:950 7px/1.35 system-ui!important;pointer-events:none!important;opacity:.9!important}${SEL.map(x=>`${x}[data-mumei-insight-saved="1"]`).join(',')}{position:relative!important}`;document.documentElement.append(s)}
async function mark(){const a=accountId?{id:accountId}:await account();if(!a)return;const saved=await loadSaved(a.id);for(const el of rawItems())delete el.dataset.mumeiInsightSaved;for(const el of items()){const r=row(el),q=r?signature(r):'';if(q&&saved.has(q))el.dataset.mumeiInsightSaved='1'}}
async function persist(found,a,why){const saved=await loadSaved(a.id),list=[...found.values()],unsaved=list.filter(r=>!saved.has(signature(r))),res=await sendBatch(unsaved,a);for(const q of res.confirmed)saved.add(q);await saveSaved(a.id,saved);await set(key(CHECK,a.id),{at:Date.now(),confirmed:res.confirmed.slice(-100),visible:list.length,why});lastSync=Date.now();await mark();return{list,unsaved,res}}
async function syncVisible(why='auto'){if(busy||!items().length)return;busy=true;let a=null;try{a=await account();if(!a)throw new Error('NOTE_LOGIN_REQUIRED');if(!await get(key(TOK,a.id),''))throw new Error('PAIR_REQUIRED');emit('saving','保存中… ページを閉じないでください');const found=new Map;for(const x of rows())found.set(signature(x.r),x.r);const {res}=await persist(found,a,why);emit('done',res.confirmed.length?`保存完了 ✓ ${res.confirmed.length}件`:'保存完了 ✓ 追加なし',{noteId:a.id,confirmed:res.confirmed.length})}catch(e){emit('error','保存できません ⚠',{noteId:a?.id||'',error:String(e?.message||e)})}finally{busy=false}}
async function manualDeep(){if(busy)return;const current=items();if(!current.length){emit('error','通知画面を開いてください');return}busy=true;let a=null,box=null,start=0;try{a=await account();if(!a)throw new Error('NOTE_LOGIN_REQUIRED');if(!await get(key(TOK,a.id),''))throw new Error('PAIR_REQUIRED');emit('saving','追加読込・保存中… ページを閉じないでください');const found=new Map;box=scrollBox();start=box?.scrollTop||0;let last=-1,stall=0;for(let i=0;i<90;i++){for(const x of rows())found.set(signature(x.r),x.r);if(!box)break;const next=Math.min(box.scrollHeight,box.scrollTop+Math.max(220,box.clientHeight*.78));box.scrollTop=next;await sleep(180);if(box.scrollTop===last)stall++;else stall=0;last=box.scrollTop;if(stall>3)break}const {res}=await persist(found,a,'manual-deep-v2921');emit('done',res.confirmed.length?`保存完了 ✓ ${res.confirmed.length}件`:'保存完了 ✓ 追加なし',{noteId:a.id,confirmed:res.confirmed.length})}catch(e){emit('error','保存できません ⚠',{noteId:a?.id||'',error:String(e?.message||e)})}finally{if(box)box.scrollTop=start;busy=false}}
function schedule(why='dom',delay=120){clearTimeout(timer);timer=setTimeout(async()=>{await mark();if(items().length&&Date.now()-lastSync>650&&!busy)void syncVisible(why)},delay)}
function bellLike(target){const el=target instanceof Element?target.closest('button,a,[role="button"],[aria-label],[title],[data-testid]'):null;if(!el)return false;const s=clean((el.getAttribute('aria-label')||'')+' '+(el.getAttribute('title')||'')+' '+(el.getAttribute('data-testid')||'')+' '+(el.textContent||''));return/通知|notification|notice|bell/i.test(s)}
window.addEventListener(EVT_MANUAL,()=>void manualDeep());
document.addEventListener('click',e=>{if(bellLike(e.target))setTimeout(()=>schedule('bell-open-v2921',30),30)},true);
const ob=new MutationObserver(()=>schedule('notification-dom-v2921',110));if(document.body)ob.observe(document.body,{childList:true,subtree:true});
addEventListener('focus',()=>schedule('focus-v2921',60));addEventListener('pageshow',()=>schedule('pageshow-v2921',60));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule('visible-v2921',60)});
setInterval(()=>{if(document.visibilityState==='visible'&&items().length)schedule('heartbeat-v2921',20)},5000);
async function init(){markerStyle();await account();await mark();if(items().length)void syncVisible('startup-panel-v2921')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void init(),{once:true});else void init();
})();
