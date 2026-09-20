(function(){
'use strict';
if(location.hostname!=='mumei-s.github.io'||location.pathname!=='/note-insight/notification-filter-settings.html')return;
if(window.__mumeiNotificationSettingsBridgeV1Loaded)return;window.__mumeiNotificationSettingsBridgeV1Loaded=true;
const FIL='mumei_insight_magazine_filter_enabled_v3:',GRP='mumei_insight_notification_groups_v1:',MUT='mumei_insight_magazine_mute_ids_v5:',RETURN='mumei_insight_return_bell_v1';
const PAGE='mumei-filter-page-v1',BRIDGE='mumei-filter-bridge-v1';
const account=(new URLSearchParams(location.search).get('notificationAccount')||'').replace(/^@/,'').toLowerCase();
const modern=()=>Boolean(globalThis.GM),clean=v=>String(v||'').replace(/\s+/g,' ').trim();
async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
const norm=raw=>(Array.isArray(raw)?raw:[]).map((g,i)=>({name:clean(g?.name)||('グループ '+(i+1)),enabled:g?.enabled!==false,ids:[...new Set((Array.isArray(g?.ids)?g.ids:[]).map(x=>clean(x).replace(/^@/,'').toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))]}));
const send=(type,payload={})=>window.postMessage({source:BRIDGE,type,...payload},location.origin);
function xhr(url){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('xhr unavailable'));fn({method:'GET',url,headers:{Accept:'application/json,text/html;q=0.9,*/*;q=0.8'},timeout:20000,onload:r=>resolve(r),onerror:()=>reject(new Error('request failed')),ontimeout:()=>reject(new Error('request timeout'))})})}
const cache=new Map();
async function profile(id){
 if(cache.has(id))return cache.get(id);
 const p=(async()=>{
  try{const r=await xhr('https://note.com/api/v2/creators/'+encodeURIComponent(id));if(Number(r.status)>=200&&Number(r.status)<300){const j=JSON.parse(r.responseText||'{}'),d=j?.data??j??{},nickname=clean(d.nickname||d.name||id),profileImageUrl=clean(d.profileImageUrl||d.profile_image_url||d.avatarUrl||'');if(nickname!==id||profileImageUrl)return{id,nickname,profileImageUrl}}}catch{}
  try{const r=await xhr('https://note.com/'+encodeURIComponent(id)),doc=new DOMParser().parseFromString(r.responseText||'','text/html'),title=clean(doc.querySelector('meta[property="og:title"]')?.content||doc.title||id).replace(/\s*｜\s*note.*$/u,''),image=clean(doc.querySelector('meta[property="og:image"]')?.content||'');return{id,nickname:title||id,profileImageUrl:image}}catch{return{id,nickname:id,profileImageUrl:''}}
 })();cache.set(id,p);return p
}
async function load(){
 if(!/^[a-z0-9_-]+$/.test(account)){send('error',{message:'noteアカウントを確認できません'});return}
 let groups=norm(await get(GRP+account,[]));if(!groups.length){const legacy=await get(MUT+account,[]);if(Array.isArray(legacy)&&legacy.length)groups=[{name:'通知フィルター',enabled:true,ids:[...new Set(legacy.map(String).map(x=>x.toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))]}]}
 send('state',{groups,filterOn:Boolean(await get(FIL+account,false))})
}
addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.source!==PAGE||e.data?.account!==account)return;const d=e.data;(async()=>{
 try{
  if(d.type==='load')await load();
  else if(d.type==='save'){const groups=norm(d.groups);await set(GRP+account,groups);await set(MUT+account,[...new Set(groups.filter(g=>g.enabled).flatMap(g=>g.ids))]);send('saved')}
  else if(d.type==='return-bell'){await set(RETURN,{account,at:Date.now()});send('return-ready')}
  else if(d.type==='profiles'){const ids=[...new Set((Array.isArray(d.ids)?d.ids:[]).map(x=>clean(x).replace(/^@/,'').toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))];for(let i=0;i<ids.length;i+=6){const part=ids.slice(i,i+6);send('profiles',{profiles:await Promise.all(part.map(profile))});if(i+6<ids.length)await new Promise(r=>setTimeout(r,50))}}
 }catch(err){send('error',{message:clean(err?.message||'設定処理に失敗しました')})}
})()});
void load();
window.__mumeiNotificationSettingsBridgeV1={version:'1.0.0',load};
})();