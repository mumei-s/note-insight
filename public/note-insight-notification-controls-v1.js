(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationControlsV1Loaded)return;window.__mumeiNotificationControlsV1Loaded=true;
const VERSION='1.5.4';
const featureOn=()=>window.__mumeiNotificationFeatureV1?.isEnabled?.()!==false;
const TOOLBAR='mumei-inline-notification-controls-v1',STYLE=TOOLBAR+'-style';
const FILTER_STATE=TOOLBAR+'-filter-state',FILTER_STATE_STYLE=FILTER_STATE+'-style';
const FIL='mumei_insight_magazine_filter_enabled_v3:',PANEL='mumei_insight_notification_panel_enabled_v1';
const SETTINGS='https://mumei-s.github.io/note-insight/notification-filter-settings.html?from=note';
const INSIGHT='https://mumei-s.github.io/note-insight/?insightMode=notifications#dashboard';
const CONNECTION='https://mumei-s.github.io/note-insight/notification-connection.html?from=note';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const isDmRoute=()=>/^\/messages\/rooms(?:\/|$)/i.test(location.pathname)&&!findPanel();
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase(),clean=v=>String(v||'').replace(/\s+/g,' ').trim();
async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
async function refreshPanel(){panelVisible=Boolean(await get(PANEL,true));if(panelVisible)schedule(0);else{closeFilterStateDialog();for(const el of document.querySelectorAll('#'+TOOLBAR+',[data-mumei-notification-controls="1"],#mumei-inline-notification-tools-v339'))el.remove()}return panelVisible}
let knownAccount=null,accountRequest=null,panelVisible=null;
async function account(){if(accountRequest)return accountRequest;accountRequest=(async()=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),8000);try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store',signal:c.signal});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();knownAccount=/^[a-z0-9_-]+$/.test(id)?{id}:null;return knownAccount}catch{return null}finally{clearTimeout(timer);accountRequest=null}})();return accountRequest}
function text(el,value){if(el&&el.textContent!==value)el.textContent=value}
function shown(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return false;for(let p=el;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden')return false}return true}
function tabs(root){let n=false,o=false,c=0;for(const el of root.querySelectorAll('button,a,[role="tab"],[role="button"]')){if(c++>140)break;if(!shown(el))continue;const t=clean(el.textContent||el.getAttribute('aria-label')||el.getAttribute('title'));if(/^通知(?:\s*\d+)?$/u.test(t))n=true;if(/^お知らせ(?:\s*\d+)?$/u.test(t))o=true;if(n&&o)return true}return false}
function hasRows(root){let n=0;for(const el of root.querySelectorAll(ITEM+',li,[role="listitem"]')){if(!shown(el))continue;const t=clean(el.textContent);if(t.length<3||t.length>4000)continue;if(/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)/u.test(t)){if(++n>=1)return true}}return false}
function findPanel(){
 try{const p=window.__mumeiNotificationFilterV4?.findPanel?.();if(p&&shown(p))return p}catch{}
 const reader=window.__mumeiNotificationReaderV4;
 try{const p=reader&&typeof reader.findPanel==='function'?reader.findPanel():null;if(p&&shown(p))return p}catch{}
 const exact=[...document.querySelectorAll(ITEM)].filter(shown);
 for(const item of exact){let p=item.parentElement,d=0;while(p&&p!==document.body&&d++<12){if(shown(p)&&(tabs(p)||p.matches('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notificationList" i],[class*="noticeList" i]'))&&hasRows(p))return p;p=p.parentElement}}
 const controls=[...document.querySelectorAll('button,a,[role="tab"],[role="button"]')].filter(shown),ns=controls.filter(x=>/^通知(?:\s*\d+)?$/u.test(clean(x.textContent))),os=controls.filter(x=>/^お知らせ(?:\s*\d+)?$/u.test(clean(x.textContent)));
 for(const a of ns)for(const b of os){let p=a.parentElement,d=0;while(p&&p!==document.body&&d++<12){if(p.contains(b)&&shown(p)){let q=p,k=0;while(q&&q!==document.body&&k++<6){if(hasRows(q))return q;q=q.parentElement}}p=p.parentElement}}
 return null
}
function installStyle(){let s=document.getElementById(STYLE);if(s?.dataset.version===VERSION)return;if(!s){s=document.createElement('style');s.id=STYLE;document.documentElement.append(s)}s.dataset.version=VERSION;s.textContent=`#${TOOLBAR}{overflow:hidden;position:fixed;left:8px;right:8px;bottom:max(8px,env(safe-area-inset-bottom));z-index:2147483000;display:grid;grid-template-columns:.95fr 1fr .65fr 1.1fr .45fr;gap:3px;padding:3px;margin:0;background:rgba(8,20,29,.94);border:1px solid #35576d;border-radius:8px;box-shadow:0 3px 12px rgba(0,0,0,.28);backdrop-filter:blur(5px)}#${TOOLBAR} button{min-height:32px!important;height:32px!important;min-width:0;border:1px solid #496a80;border-radius:6px;background:#102534;color:#e9f8ff;font:800 11px/1.2 system-ui;padding:0 3px!important;white-space:nowrap;touch-action:manipulation;cursor:pointer}#${TOOLBAR} button[data-action=insight]{display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px}#${TOOLBAR} button[data-action=insight] small{font-size:9px}#${TOOLBAR} button[data-action=filter]{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;overflow:hidden;white-space:normal;font-size:10px;line-height:1.05}#${TOOLBAR} button[data-action=filter] small{font-size:9px;line-height:1.1}#${TOOLBAR} .panel-meta{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0}#${TOOLBAR} .read-status{min-width:0;flex:1;margin:0 3px;color:#bedce9;font:600 10px/1.3 system-ui;white-space:normal;overflow-wrap:anywhere}#${TOOLBAR} button[data-on="1"]{background:#163421;border-color:#57b878;color:#d9ffe5}#${TOOLBAR} button[data-state="done"]{background:#123d26;border-color:#63cf85;color:#dfffea}#${TOOLBAR} button[data-state="error"]{background:#3a171d;border-color:#a95b68;color:#ffdbe0}#${TOOLBAR} .panel-settings{flex:0 0 auto;white-space:nowrap;text-align:right;color:#bedce9;font:9px/1.3 system-ui;text-decoration:none}#${TOOLBAR} button[data-paused="1"]{background:#77dff7;color:#07151a;border-color:#c5f5ff}#${TOOLBAR} button:disabled{opacity:.55}#${TOOLBAR} button:active{transform:scale(.98)}#${TOOLBAR}[aria-busy="true"]::after{content:"";position:absolute;bottom:0;left:2%;width:24%;height:2px;background:#8aebff;border-radius:3px;pointer-events:none;animation:mumei-notification-progress 1s ease-in-out infinite}@keyframes mumei-notification-progress{0%{transform:translateX(0);opacity:.4}50%{opacity:1}100%{transform:translateX(300%);opacity:.4}}@media(prefers-reduced-motion:reduce){#${TOOLBAR}[aria-busy="true"]::after{animation:none;width:96%}}`}
async function sync(bar){if(!bar?.isConnected)return;const a=await account();if(!a)return;const enabled=Boolean(await get(key(FIL,a.id),false)),b=bar.querySelector('[data-action="filter"]');if(b){b.dataset.on=enabled?'1':'0';b.setAttribute('aria-label',enabled?'フィルター ON':'フィルター OFF');if(!b.querySelector('span'))b.innerHTML='<span>フィルター </span><small></small>';text(b.querySelector('small'),enabled?'ON':'OFF')}}
let filterStateDialog=null;
function installFilterStateStyle(){
 if(document.getElementById(FILTER_STATE_STYLE))return;
 const style=document.createElement('style');style.id=FILTER_STATE_STYLE;style.textContent=`#${TOOLBAR} button[data-action="filter-state"]{flex:0 0 auto;min-width:44px;min-height:44px!important;height:44px!important;padding:0 6px!important;font-size:10px}#${FILTER_STATE}{position:fixed;inset:0;z-index:2147483400;box-sizing:border-box;display:grid;place-items:center;padding:16px;padding-top:max(16px,env(safe-area-inset-top));padding-bottom:max(16px,env(safe-area-inset-bottom));overflow:auto;overscroll-behavior:contain;background:rgba(0,9,17,.78);color:#e8f8ff;font:14px/1.6 system-ui,-apple-system,sans-serif}#${FILTER_STATE} *{box-sizing:border-box;min-width:0}#${FILTER_STATE} .filter-state-card{width:100%;max-width:440px;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow:auto;overscroll-behavior:contain;border:1px solid #4a7f95;border-radius:14px;padding:16px;background:#0b1d2a;box-shadow:0 12px 40px #0008}#${FILTER_STATE} h2{margin:0 0 8px;font-size:18px;line-height:1.4;color:#e8f8ff}#${FILTER_STATE} p{margin:8px 0;font-size:12px;color:#b6d2e1;overflow-wrap:break-word}#${FILTER_STATE} dl{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0 12px;margin:12px 0}#${FILTER_STATE} dt,#${FILTER_STATE} dd{margin:0;padding:7px 0;border-bottom:1px solid #28485b;font-size:13px}#${FILTER_STATE} dd{text-align:right;white-space:nowrap;font-weight:800;font-variant-numeric:tabular-nums;color:#c5f1ff}#${FILTER_STATE} .filter-state-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}#${FILTER_STATE} button{appearance:none;-webkit-appearance:none;flex:1;min-height:44px;min-width:92px;border:1px solid #527c93;border-radius:9px;padding:9px 12px;background:#12374b;color:#e8f8ff;font:700 14px/1.4 system-ui;cursor:pointer;touch-action:manipulation}#${FILTER_STATE} button:focus-visible,#${FILTER_STATE} textarea:focus-visible{outline:2px solid #8be6ff;outline-offset:2px}#${FILTER_STATE} textarea{display:block;width:100%;min-height:150px;max-height:260px;margin-top:10px;padding:9px;border:1px solid #527c93;border-radius:8px;background:#08151f;color:#e8f8ff;font:14px/1.5 ui-monospace,monospace;resize:vertical}#${FILTER_STATE} textarea[hidden]{display:none}#${FILTER_STATE} .filter-state-copy-status{min-height:1.6em}`;document.documentElement.append(style);
}
function filterStateSnapshot(){
 const api=window.__mumeiNotificationFilterV4;
 let data=null;try{data=api&&typeof api.getState==='function'?api.getState():null}catch{}
 const counter=name=>{const value=data?.[name];return Number.isSafeInteger(value)&&value>=0?value:null};
 const rawVersion=data?.version||api?.version,version=typeof rawVersion==='string'&&/^\d{1,4}(?:\.\d{1,4}){1,3}$/.test(rawVersion)?rawVersion:'';
 const available=Boolean(api&&typeof api.getState==='function'),enabled=typeof data?.enabled==='boolean'?data.enabled:null;
 const registered=counter('registered'),total=counter('total'),hidden=counter('hidden'),magazineAdd=counter('magazineAdd'),unresolved=counter('unresolved');
 const count=(value,unit)=>value===null?'未確認':new Intl.NumberFormat('ja-JP').format(value)+unit;
 const rows=[['実行版',available?version||'未確認':'未起動'],['フィルター',enabled===null?'未確認':enabled?'ON':'OFF'],['有効な登録人物',count(registered,'人')],['判定した通知',count(total,'件')],['マガジン追加通知',count(magazineAdd,'件')],['非表示',count(hidden,'件')],['人物未確認',count(unresolved,'件')]];
 const message=!available?'フィルターが起動していません。本人通知ツールを更新し、このnote画面を再読み込みしてください。':!data?'判定待ちです。通知一覧を開いた状態で確認してください。':enabled&&registered===0?'有効な登録人物が0人です。設定で登録人物とフォルダのON・OFFを確認してください。':unresolved>0?'人物を特定できないマガジン追加通知があります。':'この画面内のフィルター判定結果です。';
 return{rows,message,copy:'フィルターの状態（匿名）\n'+rows.map(([label,value])=>label+': '+value).join('\n')};
}
function updateFilterStateDialog(){
 if(!filterStateDialog)return;const snapshot=filterStateSnapshot();
 text(filterStateDialog.message,snapshot.message);snapshot.rows.forEach(([,value],i)=>text(filterStateDialog.values[i],value));filterStateDialog.copyText=snapshot.copy;
}
function closeFilterStateDialog(){
 const current=filterStateDialog;if(!current)return;filterStateDialog=null;window.removeEventListener('keydown',current.keydown,true);current.overlay.remove();
 if(current.body){current.overflow?current.body.style.setProperty('overflow',current.overflow,current.priority):current.body.style.removeProperty('overflow')}
 if(current.opener?.isConnected)current.opener.focus();
}
async function copyFilterState(){
 const current=filterStateDialog;if(!current)return;updateFilterStateDialog();const copy=current.copyText;let copied=false;
 try{if(typeof navigator.clipboard?.writeText==='function'){await navigator.clipboard.writeText(copy);copied=true}}catch{}
 if(filterStateDialog!==current)return;
 if(!copied){current.fallback.hidden=false;current.fallback.value=copy;current.fallback.focus();current.fallback.select();try{copied=typeof document.execCommand==='function'&&document.execCommand('copy')}catch{}}
 if(filterStateDialog!==current)return;
 current.fallback.hidden=copied;text(current.copyStatus,copied?'匿名の状態をコピーしました。':'下の内容を選択してコピーしてください。名前・ID・通知本文は含みません。');
}
function openFilterStateDialog(opener){
 if(filterStateDialog){updateFilterStateDialog();filterStateDialog.close.focus();return}
 installFilterStateStyle();const overlay=document.createElement('div');overlay.id=FILTER_STATE;
 const card=document.createElement('section');card.className='filter-state-card';card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-labelledby',FILTER_STATE+'-title');
 const heading=document.createElement('h2');heading.id=FILTER_STATE+'-title';heading.textContent='フィルターの状態';const message=document.createElement('p'),list=document.createElement('dl'),values=[];
 for(const[label]of filterStateSnapshot().rows){const term=document.createElement('dt'),value=document.createElement('dd');term.textContent=label;list.append(term,value);values.push(value)}
 const privacy=document.createElement('p');privacy.textContent='コピーには件数と実行版だけを含めます。名前・ID・通知本文は含みません。';
 const actions=document.createElement('div');actions.className='filter-state-actions';const copy=document.createElement('button'),close=document.createElement('button');copy.type=close.type='button';copy.textContent='状態をコピー';close.textContent='閉じる';copy.dataset.filterStateAction='copy';close.dataset.filterStateAction='close';actions.append(copy,close);
 const copyStatus=document.createElement('p');copyStatus.className='filter-state-copy-status';copyStatus.setAttribute('role','status');copyStatus.setAttribute('aria-live','polite');const fallback=document.createElement('textarea');fallback.readOnly=true;fallback.hidden=true;fallback.setAttribute('aria-label','コピーする匿名の状態');
 card.append(heading,message,list,privacy,actions,copyStatus,fallback);overlay.append(card);
 const keydown=event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeFilterStateDialog();return}if(event.key!=='Tab')return;const focusable=[copy,close,...(!fallback.hidden?[fallback]:[])],first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&(document.activeElement===first||!card.contains(document.activeElement))){event.preventDefault();last.focus()}else if(!event.shiftKey&&(document.activeElement===last||!card.contains(document.activeElement))){event.preventDefault();first.focus()}};
 const body=document.body;filterStateDialog={overlay,message,values,copyStatus,fallback,close,opener,keydown,body,overflow:body?.style.getPropertyValue('overflow')||'',priority:body?.style.getPropertyPriority('overflow')||'',copyText:''};
 if(body)body.style.setProperty('overflow','hidden');document.documentElement.append(overlay);window.addEventListener('keydown',keydown,true);updateFilterStateDialog();close.focus();
}
function leave(url,label){
 const veil=document.createElement('div');veil.id='mumei-route-veil-v130';veil.textContent=label||'INSIGHTへ移動中…';veil.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#07131c;color:#e7f8ff;font:900 13px/1.4 system-ui;letter-spacing:.03em';
 document.documentElement.appendChild(veil);requestAnimationFrame(()=>location.replace(url))
}
async function act(action,bar){
 if(!featureOn())return;
 if(action==='filter-state'){openFilterStateDialog(bar.querySelector('[data-action="filter-state"]'));return}
 if(action==='read'){
  const b=bar?.querySelector('[data-action="read"]'),wasError=b?.dataset.state==='error';if(b){const running=b.dataset.state==='busy';b.textContent=running?'一時停止中…':'確認中…';b.dataset.state='busy'}
  if(b?.dataset.repair==='1'){const a=knownAccount||await account(),u=new URL(CONNECTION);if(a)u.searchParams.set('notificationAccount',a.id);u.searchParams.set('return',INSIGHT);leave(u.href,'本人通知の再連携を開いています…');return}
  const reader=window.__mumeiNotificationReaderV4;
  if(!reader||typeof reader.scan!=='function'){if(b){b.textContent='再読込';b.dataset.state='error'}return}
  try{if(typeof reader.pause==='function'&&typeof reader.resume==='function'){if(reader.isPaused?.()||wasError)await reader.resume({forceNetwork:true});else await reader.pause()}else await reader.scan({forceNetwork:true})}catch{if(b){b.textContent='再読込';b.dataset.state='error'}}return
 }
 if(action==='off'){const b=bar.querySelector('[data-action=off]');b.disabled=true;try{const feature=window.__mumeiNotificationFeatureV1;if(typeof feature?.setEnabled!=='function')throw new Error('本人通知ツールを更新してください');await feature.setEnabled(false)}catch(e){b.disabled=false;renderStatus({state:'error',message:String(e?.message||'OFFを保存できませんでした')})}return}
 if(action==='panel-settings'){const a=knownAccount||await account(),u=new URL(CONNECTION);if(a)u.searchParams.set('notificationAccount',a.id);leave(u.href,'🔔本人設定を開いています…');return}
 if(action==='filter'){const a=await account();if(!a){renderStatus({state:'error',message:'noteログインの確認に失敗しました'});return}const next=!Boolean(await get(key(FIL,a.id),false));await set(key(FIL,a.id),next);window.dispatchEvent(new Event('mumei-insight-filter-refresh-v2939'));await sync(bar);return}
 if(action==='settings'){const a=knownAccount||await account();if(!a){renderStatus({state:'error',message:'note本人IDを確認できません。もう一度設定を押してください'});return}const u=new URL(SETTINGS);u.searchParams.set('notificationAccount',a.id);leave(u.href,'設定を開いています…');return}
 if(action==='insight'){const a=knownAccount||await account();const u=new URL(INSIGHT);u.searchParams.set('insightMode','notifications');if(a)u.searchParams.set('notificationAccount',a.id);u.hash='dashboard';leave(u.href,'INSIGHT【通知】を開いています…');return}
}
function makeBar(){
 const bar=document.createElement('div');bar.id=TOOLBAR;bar.setAttribute('data-mumei-notification-controls','1');
 bar.innerHTML='<button type="button" data-action="read">一時停止</button><button type="button" data-action="filter">フィルター</button><button type="button" data-action="settings">設定</button><button type="button" data-action="insight">INSIGHT<small>【通知】</small></button><button type="button" data-action="off" aria-label="公式🔔パネルをOFFにする">OFF</button><div class="panel-meta"><p class="read-status" role="status" aria-live="polite">新着を確認します</p><button type="button" data-action="filter-state" aria-haspopup="dialog">状態</button><a class="panel-settings" data-action="panel-settings" href="'+CONNECTION+'">ON/OFFはメイン🔔から</a></div>';
 return bar
}
function toolbarTarget(e){const t=e.target;return t instanceof Element?t.closest('#'+TOOLBAR+' [data-action]'):null}
function interceptToolbar(e){
 const target=e.target,state=target instanceof Element?target.closest('#'+FILTER_STATE):null;
 if(state){
  // note closes its notice menu from document-level outside-click handlers.
  // Keep every modal gesture local while preserving default text selection.
  e.stopPropagation();e.stopImmediatePropagation();
  if(e.type==='click'){const button=target.closest('button[data-filter-state-action]');if(button){e.preventDefault();if(button.dataset.filterStateAction==='copy')void copyFilterState();else if(button.dataset.filterStateAction==='close')closeFilterStateDialog()}else if(target===state){e.preventDefault();closeFilterStateDialog()}}
  return;
 }
 const b=toolbarTarget(e);if(!b)return;
 // Cancelling touchstart/touchend suppresses the browser-generated click on phones.
 // Isolate the gesture from note, but cancel its default action only on click.
 e.stopPropagation();e.stopImmediatePropagation();
 if(e.type==='click')e.preventDefault();
 if(e.type==='click'){const bar=b.closest('#'+TOOLBAR);if(bar)void act(String(b.getAttribute('data-action')||''),bar)}
}
for(const ev of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','click','contextmenu'])window.addEventListener(ev,interceptToolbar,{capture:true,passive:ev!=='click'});
function dedupe(){
 const all=[...document.querySelectorAll('#'+TOOLBAR+',[data-mumei-notification-controls="1"],#mumei-inline-notification-tools-v339')];
 let keep=all.find(x=>x.id===TOOLBAR)||null;
 if(!keep&&all.length){keep=all[0];keep.id=TOOLBAR;keep.setAttribute('data-mumei-notification-controls','1')}
 for(const el of all)if(el!==keep)el.remove();
 if(keep){keep.removeAttribute('data-collapsed');for(const button of keep.querySelectorAll('[data-action="collapse"],.collapse'))button.remove()}
 return keep
}
function mount(){
 if(!featureOn()||panelVisible!==true||isDmRoute()){closeFilterStateDialog();for(const el of document.querySelectorAll('#'+TOOLBAR+',[data-mumei-notification-controls="1"],#mumei-inline-notification-tools-v339'))el.remove();return}
 const panel=findPanel();if(!panel){closeFilterStateDialog();const old=dedupe();if(old)old.remove();return}
 installStyle();installFilterStateStyle();
 let bar=dedupe()||makeBar();
 if(document.body&&bar.parentElement!==document.body){document.body.appendChild(bar);void sync(bar)}
 lastFilter=window.__mumeiNotificationFilterV4?.getState?.()||lastFilter;
 if(lastStatus)renderStatus(lastStatus);else if(window.__mumeiNotificationReaderV4?.isPaused?.())renderStatus({state:'done',userPaused:true});else text(bar.querySelector('.read-status'),filterNotice()||'新着を自動で確認します')
}
let timer=0,lastStatus=null,lastFilter=null;
function filterNotice(){return lastFilter?.enabled&&lastFilter.total>0&&lastFilter.hidden===lastFilter.total?`表示中の${lastFilter.total}件はすべてフィルター対象です｜OFFで表示`:''}
const owned=node=>node instanceof Element&&Boolean(node.closest('#'+TOOLBAR+',#'+STYLE+',#'+FILTER_STATE+',#'+FILTER_STATE_STYLE));
const schedule=(ms=180)=>{if(timer)return;timer=setTimeout(()=>{timer=0;mount()},ms)};
function observe(){if(!document.documentElement){document.addEventListener('DOMContentLoaded',observe,{once:true});return}new MutationObserver(records=>{if(records.some(r=>!owned(r.target)))schedule()}).observe(document.documentElement,{subtree:true,childList:true});schedule(150)}
void refreshPanel().then(observe);
window.addEventListener('pageshow',()=>{void refreshPanel();const bar=dedupe();if(bar)void sync(bar)});window.addEventListener('focus',()=>{void refreshPanel();const bar=dedupe();if(bar)void sync(bar)});
function renderStatus(d){
 lastStatus=d;const bar=dedupe();if(!bar?.isConnected)return;
 const b=bar.querySelector('[data-action="read"]'),line=bar.querySelector('.read-status');if(!b)return;
 const state=String(d.state||''),read=Number(d.readCount||0),saved=Number(d.savedCount||0),total=Number(d.totalCount||0);
 const busy=Boolean(d.scanning||state==='saving'),paused=Boolean(d.stopping||d.partial)&&!busy;
 bar.setAttribute('aria-busy',String(busy));
 const repair=state==='error'&&(String(d.errorCode||'')==='PAIR_REQUIRED'||/(?:本人通知|本人)の?連携|PAIR_REQUIRED/u.test(String(d.message||'')));
 const reader=window.__mumeiNotificationReaderV4,canPause=typeof reader?.pause==='function',userPaused=Boolean(reader?.isPaused?.()||d.userPaused);
 const label=canPause&&!repair&&state!=='error'?(userPaused?(busy?'一時停止中':'再開'):'一時停止'):repair?'再連携':state==='error'?'再試行':busy?(d.stopping?'停止中…':'停止'):paused?'続き読込':saved?'✓保存 '+saved:d.historyComplete?'確認済み':'再確認';
 b.dataset.repair=repair?'1':'0';b.dataset.paused=userPaused?'1':'0';b.setAttribute('aria-pressed',String(userPaused));b.disabled=canPause&&userPaused&&busy;
 text(b,label);b.dataset.state=state==='error'?'error':busy?'busy':paused?'paused':'done';
 const message=state==='error'?String(d.message||'読込に失敗しました')+(total?`（保存確認 ${saved} / ${total}件）`:''):busy&&d.phase==='saving'?`保存先を確認中｜保存確認 ${saved} / ${total}件`:busy?`読込 ${read}${total?' / '+total:''}｜保存確認 ${saved}`:paused?`途中保存 ${saved}件｜続きから再開できます`:saved?`読込 ${read}｜保存確認 ${saved}件`:d.historyComplete?`確認 ${Number(d.checkedCount||0)}件・追加0件${d.boundaryAt?'｜保存位置 '+new Date(d.boundaryAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):''}`:'確認中・保存完了は未確認';
 text(line,[userPaused&&!busy?'一時停止中｜再開で自動読み込みに戻ります':message,filterNotice()].filter(Boolean).join('｜'));b.title=String(d.message||message);b.setAttribute('aria-label',label+'：'+message);
}
window.addEventListener('mumei-notification-reader-status',e=>renderStatus(e.detail||{}));
window.addEventListener('mumei-notification-filter-status',e=>{lastFilter=e.detail||null;mount();updateFilterStateDialog()});
window.addEventListener('mumei-notification-feature-changed',()=>{lastStatus=null;lastFilter=null;mount()});
const panelListen=modern()&&typeof GM.addValueChangeListener==='function'?GM.addValueChangeListener:typeof GM_addValueChangeListener==='function'?GM_addValueChangeListener:null;if(panelListen)try{panelListen(PANEL,()=>void refreshPanel())}catch{}
window.__mumeiNotificationControlsV1={version:VERSION,mount,findPanel,sync,refreshPanel};
})();
