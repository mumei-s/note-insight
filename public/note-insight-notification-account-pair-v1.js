(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationAccountPairV1Loaded)return;window.__mumeiNotificationAccountPairV1Loaded=true;
const PAIR='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-import-token';
const TOKEN='mumei_insight_notification_sync_token_v2:',RETURN_PARAM='mumei_return';
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase(),clean=v=>String(v||'').replace(/\s+/g,' ').trim();
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function request(url,body){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));fn({method:'POST',url,headers:{'Content-Type':'application/json'},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300&&p.ok!==false?resolve(p):reject(new Error(p.error||('HTTP_'+r.status)))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
function safeBack(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
async function current(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?{id}:null}catch{return null}}
(async()=>{
 const u=new URL(location.href),code=clean(u.searchParams.get('mumei_pair')).replace(/\D/g,'').slice(0,8);if(!code)return;
 const expected=clean(u.searchParams.get('mumei_account')).replace(/^@/,'').toLowerCase(),back=safeBack(u.searchParams.get(RETURN_PARAM)),a=await current();
 if(!a)return;if(expected&&expected!==a.id)return;
 try{const p=await request(PAIR,{action:'pair-exchange',code}),t=String(p?.ingestToken||'');if(!t)throw new Error('PAIR_TOKEN_EMPTY');await set(key(TOKEN,a.id),t);
  u.searchParams.delete('mumei_pair');u.searchParams.delete('mumei_account');u.searchParams.delete(RETURN_PARAM);history.replaceState(history.state,'',u.pathname+u.search+u.hash);
  if(back)location.replace(back)
 }catch(e){console.error('[INSIGHT pair]',e)}
})();
})();