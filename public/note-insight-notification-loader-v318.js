(function(){
'use strict';
if(!['note.com','mumei-s.github.io'].includes(location.hostname))return;
if(window.__mumeiNotificationLoader322)return;window.__mumeiNotificationLoader322=true;
const VERSION='3.2.4';
const BASE='https://mumei-s.github.io/note-insight/';
const IS_NOTE=location.hostname==='note.com';
const CACHE='mumei-v324-runtime-cache:';
const FLOW_KEY='mumei-dashboard-flow-v143';
const HARD_KEY='mumei-v322-dashboard-hardload';
let dashboardLoaded=false,loading=false,lastHref=location.href;

function modern(){return Boolean(globalThis.GM)}
async function getValue(k,d=''){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function setValue(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function safeReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
function gmRequest(url){return new Promise((resolve,reject)=>{const d={method:'GET',url,headers:{'Cache-Control':'no-cache'},timeout:20000,onload:r=>r.status>=200&&r.status<300?resolve(String(r.responseText||'')):reject(new Error('HTTP_'+r.status)),onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))};try{if(modern()&&typeof GM.xmlHttpRequest==='function'){GM.xmlHttpRequest(d);return}if(typeof GM_xmlhttpRequest==='function'){GM_xmlhttpRequest(d);return}}catch(e){reject(e);return}reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'))})}
async function componentText(name){const url=BASE+name+'?v=324&ts='+Date.now();let last=null;for(let i=0;i<2;i++){try{const t=await gmRequest(url);if(t.trim()){await setValue(CACHE+name,t);return t}}catch(e){last=e}try{const r=await fetch(url,{cache:'no-store'});if(r.ok){const t=await r.text();if(t.trim()){await setValue(CACHE+name,t);return t}}}catch(e){last=e}await new Promise(r=>setTimeout(r,180+i*220))}const cached=String(await getValue(CACHE+name,'')||'');if(cached.trim())return cached;throw last||new Error('EMPTY_'+name)}
async function ensureDashboard(){if(dashboardLoaded)return;if(typeof window.__mumeiStartDashboard323==='function'){window.__mumeiStartDashboard323();dashboardLoaded=true;return}try{let src=await componentText('note-insight-dashboard-integrated-v318.js');src=src.replaceAll('mumeiDashboardCore318','mumeiDashboardCore322').replaceAll('mumeiDashboardAdapter318','mumeiDashboardAdapter322');eval(src+'\n//# sourceURL='+(BASE+'note-insight-dashboard-integrated-v318.js'));dashboardLoaded=true;try{localStorage.setItem('mumei-dashboard-integrated-runtime',VERSION)}catch{}}catch(e){console.warn('[INSIGHT] ダッシュボード接続失敗',e)}}
function maybeHardDashboard(){if(!IS_NOTE)return false;const onStats=/^\/sitesettings\/stats(?:\/|$)/i.test(location.pathname),flow=sessionStorage.getItem(FLOW_KEY)==='1';if(!onStats||!flow){if(!onStats)sessionStorage.removeItem(HARD_KEY);return false}const mark=location.pathname+location.search;if(sessionStorage.getItem(HARD_KEY)===mark)return false;sessionStorage.setItem(HARD_KEY,mark);location.reload();return true}
function versionCheck(){if(!IS_NOTE)return;const u=new URL(location.href);if(u.searchParams.get('mumei_insight_version_check')!=='1')return;const back=safeReturn(u.searchParams.get('mumei_return'));u.searchParams.delete('mumei_insight_version_check');u.searchParams.delete('mumei_return');history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);if(back){const b=new URL(back);b.searchParams.set('notificationInstalled',VERSION);b.searchParams.set('notificationCheckedAt',String(Date.now()));b.searchParams.set('notificationUpdateResult','runtime-checked-v324');location.replace(b.href)}}
async function pairNotice(){
 const u=new URL(location.href),code=u.searchParams.get('mumei_pair');if(!code)return false;
 const back=safeReturn(u.searchParams.get('mumei_return')),expected=String(u.searchParams.get('mumei_account')||'').toLowerCase();
 try{
  const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)throw new Error('noteにログインしてください');
  const j=await r.json(),user=(j.data??j).user||(j.data??j),id=String(user.urlname||user.url_name||user.username||'').toLowerCase();
  if(!expected||id!==expected)throw new Error('noteとINSIGHTのアカウントが一致しません');
  const storage='mumei_insight_notification_sync_token_v2:'+id;
  if(!await getValue(storage,'')){
   const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;
   if(!fn)throw new Error('ユーザースクリプトの実行許可を確認してください');
   const token=await new Promise((resolve,reject)=>fn({method:'POST',url:'https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-import-token',headers:{'Content-Type':'application/json'},data:JSON.stringify({action:'pair-exchange',code}),timeout:20000,onload:x=>{try{const p=JSON.parse(x.responseText);if(x.status<200||x.status>=300||!p.ok||p.noteId!==id||!p.ingestToken)throw new Error('連携を確認できません。導入画面で再試行してください');resolve(p.ingestToken)}catch(e){reject(e)}},onerror:()=>reject(new Error('連携通信に失敗しました')),ontimeout:()=>reject(new Error('連携が時間切れです'))}));
   if(modern()&&typeof GM.setValue==='function')await GM.setValue(storage,token);else if(typeof GM_setValue==='function')GM_setValue(storage,token);else throw new Error('連携情報を保存できません');
  }
  for(const k of ['mumei_pair','mumei_account','mumei_return'])u.searchParams.delete(k);history.replaceState(history.state,'',u.href);
  if(back){const dest=new URL(back);dest.searchParams.set('notificationPaired','1');location.replace(dest.href)}
 }catch(e){const dest=back?new URL(back):new URL(BASE+'tool-setup.html');dest.searchParams.set('notificationPairError',String(e.message||e));location.replace(dest.href)}
 return true;
}
async function start(){if(loading)return;loading=true;try{if(IS_NOTE&&await pairNotice())return;if(!IS_NOTE||/^\/sitesettings\/stats(?:\/|$)/.test(location.pathname))await ensureDashboard();if(maybeHardDashboard())return;if(!IS_NOTE||window.__mumeiV3Reader322Ready)versionCheck();try{localStorage.setItem('mumei-notification-v3-loader',VERSION)}catch{}document.dispatchEvent(new Event('mumei-v3-core-ready'))}finally{loading=false}}
function routeChanged(){if(location.href===lastHref)return;lastHref=location.href;void start()}
function installRouteWatch(){for(const name of['pushState','replaceState']){const orig=history[name];if(typeof orig!=='function'||orig.__mumeiLoader322Wrapped)continue;const fn=function(){const out=orig.apply(this,arguments);queueMicrotask(routeChanged);return out};fn.__mumeiLoader322Wrapped=true;history[name]=fn}addEventListener('popstate',routeChanged);addEventListener('hashchange',routeChanged)}
installRouteWatch();
addEventListener('pageshow',()=>void start());
addEventListener('focus',()=>void start());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void start()});
void start();
})();