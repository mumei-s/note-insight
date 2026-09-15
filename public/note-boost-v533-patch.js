(() => {
'use strict';
if (window.__NOTE_BOOST_V533_PATCH__) return;
window.__NOTE_BOOST_V533_PATCH__ = true;

const K='note巡回BOOST_v531';
const SHORT_CAP=18, SHORT_MS=60*60*1000, DAY_CAP=80, DAY_MS=24*60*60*1000;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const now=()=>Date.now();
const fmt=t=>t?new Date(t).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'—';
const loadRaw=(key,fb)=>{try{return JSON.parse(localStorage.getItem(key))??fb}catch{return fb}};
const saveRaw=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v))}catch{}};
const load=(k,fb)=>loadRaw(`${K}:${k}`,fb);
const save=(k,v)=>saveRaw(`${K}:${k}`,v);
const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};

function hist(kind){const a=load(`hist:${kind}`,[]),cut=now()-48*60*60*1000;return Array.isArray(a)?a.filter(x=>x&&Number(x.t)>=cut):[]}
function within(kind,ms){return hist(kind).filter(x=>now()-Number(x.t)<ms)}
function release(kind,cap,ms){const a=within(kind,ms).sort((x,y)=>Number(x.t)-Number(y.t));return a.length<cap?0:Number(a[0].t)+ms}
function guardUntil(kind){const c=[release(kind,SHORT_CAP,SHORT_MS),release(kind,DAY_CAP,DAY_MS),Number(load(`guard533:${kind}`,{}).until||0),Number(load(`guard:${kind}`,{}).until||0)].filter(x=>x>now());return c.length?Math.max(...c):0}
function stats(kind){return{short:within(kind,SHORT_MS).length,day:within(kind,DAY_MS).length,until:guardUntil(kind)}}
function markGuard(kind,reason,until){save(`guard533:${kind}`,{until,reason});save(`guard:${kind}`,{until,strikes:[],reason});window.dispatchEvent(new Event('noteBoostLimiterChange'))}
function setConfig(){const c=Object.assign({},load('cfg',{}),{likeCap:DAY_CAP,magCap:DAY_CAP,batchCap:9999,batchCoolMin:60});save('cfg',c)}
setConfig();

function retryResponse(until,reason){const sec=Math.max(60,Math.ceil((until-now())/1000));return new Response(JSON.stringify({error:'巡回BOOST limiter',reason}),{status:429,headers:{'content-type':'application/json','retry-after':String(sec)}})}
const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const method=String(init?.method||input?.method||'GET').toUpperCase();
  let kind=null;
  if(method==='POST'&&/\/api\/v3\/notes\/[^/]+\/likes(?:\?|$)/.test(url))kind='likes';
  if(method==='POST'&&/\/api\/v1\/our\/magazines\/[^/]+\/notes(?:\?|$)/.test(url))kind='mags';
  if(kind){
    const s=stats(kind);
    if(s.until>now())return retryResponse(s.until,`${kind==='likes'?'スキ':'マガジン'}上限`);
    if(s.short>=SHORT_CAP){const u=release(kind,SHORT_CAP,SHORT_MS);markGuard(kind,`1時間上限 ${SHORT_CAP}`,u);return retryResponse(u,'1時間上限')}
    if(s.day>=DAY_CAP){const u=release(kind,DAY_CAP,DAY_MS);markGuard(kind,`24時間上限 ${DAY_CAP}`,u);return retryResponse(u,'24時間上限')}
  }
  const r=await nativeFetch(input,init);
  if(kind&&r.status===403)markGuard(kind,'403検出・60分保護',now()+SHORT_MS);
  else if(kind&&r.status===429){const ra=r.headers.get('retry-after');let ms=SHORT_MS;if(ra){if(/^\d+$/.test(ra))ms=Math.max(ms,Number(ra)*1000);else{const t=Date.parse(ra);if(Number.isFinite(t))ms=Math.max(ms,t-now())}}markGuard(kind,'429検出',now()+ms)}
  if(kind==='likes'&&r.ok){
    const m=url.match(/\/api\/v3\/notes\/([^/]+)\/likes/),key=m?.[1]?decodeURIComponent(m[1]):'';
    if(key){let confirmed=false;for(const wait of [250,650,1200]){await new Promise(res=>setTimeout(res,wait));try{const c=await nativeFetch(`/api/v3/notes/${encodeURIComponent(key)}`,{credentials:'include',headers:{accept:'application/json'}});const j=await c.json(),d=j?.data??j??{},n=d.note||d;confirmed=['isLiked','is_liked','liked','hasLiked'].some(k=>n?.[k]===true);if(confirmed)break}catch{}}if(!confirmed){const u=now()+SHORT_MS;markGuard('likes','スキ反映未確認・60分保護',u);return retryResponse(u,'スキ反映未確認')}}
  }
  if(kind)window.dispatchEvent(new Event('noteBoostLimiterChange'));
  return r;
};

function cleanupLegacy(){
  const current=$('#nb532-open');
  for(const s of ['#nb53-open','#nb52-open','#note巡回boost-v4','#nb-v46','#nb-open','#nb-panel','.nb-v48-panel','.nb-v50-panel'])for(const e of $$(s))e.remove();
  for(const e of $$('button,a')){if(e===current||e.closest('#nb532-panel')||e.closest('#nb532-modal'))continue;if(/巡回BOOST/.test((e.textContent||'').replace(/\s+/g,'')))e.remove()}
}
function simplifyNav(){
  const actions=$('#nb532-card .nb532-actions'),hiddenPrev=$('#nb532-prev'),bottomNext=$('#nb532-next2');
  if(actions&&hiddenPrev&&!$('#nb533-prev')){const b=document.createElement('button');b.id='nb533-prev';b.textContent='戻る';b.onclick=e=>{e.preventDefault();hiddenPrev.click()};const next=$('#nb532-next');if(next)actions.insertBefore(b,next);else actions.appendChild(b)}
  if(hiddenPrev)hiddenPrev.style.display='none';if(bottomNext)bottomNext.style.display='none';
  const nav=$('#nb532-card .nb532-nav');if(nav){nav.style.gridTemplateColumns='1fr';const small=nav.querySelector('small');if(small){small.style.display='block';small.style.textAlign='center'}}
  if(actions)actions.style.gridTemplateColumns='repeat(5,minmax(0,1fr))';
}
function updateLimiterUI(){
  const box=$('#nb532-limits');if(!box)return;const a=stats('likes'),m=stats('mags');
  let l1=$('#nb533-like-limit'),l2=$('#nb533-mag-limit');
  if(!l1||!l2){box.replaceChildren();box.style.gridTemplateColumns='1fr';l1=document.createElement('span');l1.id='nb533-like-limit';l2=document.createElement('span');l2.id='nb533-mag-limit';box.append(l1,l2)}
  setText(l1,`♡ 1h ${a.short}/${SHORT_CAP}・24h ${a.day}/${DAY_CAP}・解除 ${a.until?fmt(a.until):'—'}`);
  setText(l2,`📚 1h ${m.short}/${SHORT_CAP}・24h ${m.day}/${DAY_CAP}・解除 ${m.until?fmt(m.until):'—'}`);
}
function setupSettings(){const cfgBox=$('#nb532-settings');if(!cfgBox)return;if(!$('#nb533-limiter-note')){const n=document.createElement('div');n.id='nb533-limiter-note';n.textContent='安全リミッター：♡/📚 共通 18回/1時間・80回/24時間（固定）';n.style.cssText='padding:5px;border:1px solid #38576a;border-radius:7px;font-size:9px;color:#bfeaff';cfgBox.prepend(n)}for(const id of ['nb532-batchcap','nb532-cool','nb532-likecap','nb532-magcap'])$('#'+id)?.closest('label')?.remove()}
function setupPanel(){cleanupLegacy();simplifyNav();setupSettings();updateLimiterUI();const open=$('#nb532-open');if(open)open.style.display='block'}

function boot(){
  setupPanel();
  window.addEventListener('noteBoostLimiterChange',updateLimiterUI);
  window.addEventListener('focus',updateLimiterUI);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateLimiterUI()});
  document.addEventListener('click',e=>{const t=e.target instanceof Element?e.target.closest('#nb532-open,#nb532-next,#nb533-prev,#nb532-start,#nb532-mag,#nb532-like'):null;if(t)setTimeout(()=>{setupPanel()},0)},true);
  const root=document.body||document.documentElement;
  const mo=new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.id==='nb532-panel'||n.id==='nb532-card'||n.querySelector?.('#nb532-panel,#nb532-card')))))setTimeout(()=>{simplifyNav();setupSettings();updateLimiterUI()},0)});
  mo.observe(root,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();