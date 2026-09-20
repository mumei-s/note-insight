(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(!/^\/messages\/rooms(?:\/|$)/i.test(location.pathname))return;
if(window.__mumeiDmPairV1Loaded)return;window.__mumeiDmPairV1Loaded=true;
const API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dm-import-token';
const TOKEN='mumei_insight_dm_sync_token_v1:';
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase(),clean=v=>String(v||'').replace(/\s+/g,' ').trim();
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function req(body){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));fn({method:'POST',url:API,headers:{'Content-Type':'application/json'},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300&&p.ok!==false?resolve(p):reject(new Error(p.error||('HTTP_'+r.status)))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
async function current(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?{id}:null}catch{return null}}
(async()=>{
 const u=new URL(location.href),code=clean(u.searchParams.get('mumei_dm_pair')).replace(/\D/g,'').slice(0,8);
 if(!code)return;
 const expected=clean(u.searchParams.get('mumei_account')).replace(/^@/,'').toLowerCase(),a=await current();
 if(!a||expected&&expected!==a.id)return;
 try{
  const p=await req({action:'pair-exchange',code}),t=String(p?.dmIngestToken||'');if(!t)throw new Error('DM_PAIR_TOKEN_EMPTY');
  await set(key(TOKEN,a.id),t);
  u.searchParams.delete('mumei_dm_pair');u.searchParams.delete('mumei_account');history.replaceState(history.state,'',u.pathname+u.search+u.hash);
  window.dispatchEvent(new CustomEvent('mumei-dm-paired',{detail:{noteId:a.id,version:'1.0.0'}}));
  setTimeout(()=>window.__mumeiInsightDmReaderV1Api?.run?.(),300)
 }catch(e){console.error('[INSIGHT DM pair]',e)}
})();
})();