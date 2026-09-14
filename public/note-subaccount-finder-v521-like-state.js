(() => {
'use strict';
const K='note巡回BOOST_v4';
const LIKE_LIMIT=`${K}:likeLimitV52`;
const RESULT='likeResultsV521';
const GUARD='guardV52:like';
const DEFAULT_LIMIT=80;
let busy=false,booted=false;
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(k))??fb}catch{return fb}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const ak=(id,n)=>`${K}:acct:${id}:${n}`;
const al=(id,n,fb)=>load(ak(id,n),fb);
const as=(id,n,v)=>save(ak(id,n),v);
const clamp=(v,fb,max=5000)=>Math.max(1,Math.min(max,Number(v)||fb));
const likeLimit=()=>clamp(load(LIKE_LIMIT,DEFAULT_LIMIT),DEFAULT_LIMIT);
const fmtClock=ms=>{try{return new Date(ms).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}catch{return''}};
function history(id,name){const cut=Date.now()-48*3600e3,a=al(id,name,[]);return Array.isArray(a)?a.filter(x=>x&&Number(x.t)>=cut):[]}
function usage(id){const now=Date.now();return history(id,'likes').filter(x=>now-Number(x.t||0)<86400e3).length}
function nextRelease(id){const cap=likeLimit(),a=history(id,'likes').filter(x=>Date.now()-Number(x.t||0)<86400e3).sort((x,y)=>Number(x.t)-Number(y.t));return a.length<cap?0:Number(a[0].t)+86400e3}
function guard(id){const g=al(id,GUARD,null);return g&&typeof g==='object'?g:{until:0,strikes:[],reason:''}}
function setStatus(msg,bad=false){const e=document.getElementById('nb52-status');if(e){e.textContent=msg;e.dataset.bad=bad?'1':'0'}const old=document.getElementById('nb-status');if(old)old.textContent=msg}
async function api(url,init={}){const headers=Object.assign({accept:'application/json'},init.headers||{});const r=await fetch(url,Object.assign({credentials:'include'},init,{headers}));const text=await r.text();let json={};try{json=text?JSON.parse(text):{}}catch{}if(!r.ok){const e=new Error(`${r.status} ${r.statusText}`);e.status=r.status;e.body=text.slice(0,800);const ra=r.headers?.get?.('retry-after');e.retryAfter=ra?(/^\d+$/.test(ra)?Number(ra)*1000:Math.max(0,Date.parse(ra)-Date.now())):0;throw e}return json}
async function who(){const j=await api('/api/v2/current_user'),d=j?.data??j??{},u=d.user||d,id=String(u.urlname||u.url_name||u.username||'').replace(/^@/,'').toLowerCase();if(!id)throw new Error('noteログイン中アカウントを取得できません');return{id}}
function likedStateFrom(j){const d=j?.data??j??{},n=d.note||d;for(const k of ['isLiked','is_liked','liked','hasLiked'])if(typeof n?.[k]==='boolean')return n[k];return null}
function saveSession(id,s){as(id,'session',s)}
function resultMap(id){const a=al(id,RESULT,[]);return Array.isArray(a)?a:[]}
function addResult(id,c,state){const a=resultMap(id).filter(x=>x&&x.key!==c.key);a.unshift({t:Date.now(),key:c.key,urlname:c.urlname||'',name:c.name||c.urlname||'',title:c.title||c.key,state});as(id,RESULT,a.slice(0,1000));renderSummary(id)}
function markQueueState(id,s,i,state){if(!s||!Array.isArray(s.queue)||!s.queue[i])return;s.queue[i].liked=true;s.queue[i].likeState=state;s.queue[i].likeDoneAt=Date.now();saveSession(id,s)}
function renderSummary(id){const host=document.getElementById('nb52-settings')||document.getElementById('nb52-panel');if(!host)return;let e=document.getElementById('nb52-like-summary');if(!e){e=document.createElement('div');e.id='nb52-like-summary';e.style.cssText='margin:5px 0;padding:7px 9px;border:1px solid #30485a;border-radius:9px;background:#08141d;color:#fff;font:900 11px/1.45 system-ui';const meter=document.getElementById('nb52-meter');(meter?.parentNode||host).insertBefore(e,meter?.nextSibling||host.firstChild)}const a=resultMap(id),now=a.filter(x=>x.state==='liked_now').length,pre=a.filter(x=>x.state==='preexisting').length,done=now+pre,recent=a.slice(0,4).map(x=>`${x.state==='preexisting'?'💗':'❤️'}@${x.urlname||x.name||'?'}`).join('　');e.innerHTML=`✅ 完了 <b>${done}</b>　❤️今回 <b>${now}</b>　💗最初から <b>${pre}</b>${recent?`<br><small>${recent}</small>`:''}`}
function scheduleResumeLabel(id,until,why){if(!until||until<=Date.now())return;const tick=()=>{const left=until-Date.now();if(left<=0){setStatus('▶ 制限解除。続きの同じ人から再開できます');try{sessionStorage.setItem('nb-v52-open','1')}catch{}return}setStatus(`⏳ ${why}｜${fmtClock(until)}再開予定`)};tick();setTimeout(tick,Math.min(Math.max(1000,until-Date.now()),2147480000))}
function advance(){setTimeout(()=>document.getElementById('nb-skip')?.click(),80)}
async function safeLike(btn){if(busy)return;busy=true;btn.disabled=true;try{const me=await who(),s=al(me.id,'session',null),q=Array.isArray(s?.queue)?s.queue:[],i=Math.max(0,Number(s?.index)||0),c=q[i];if(!c?.key)throw new Error('現在の記事を特定できません');
  const known=resultMap(me.id).find(x=>x.key===c.key);if(known){markQueueState(me.id,s,i,known.state);setStatus(known.state==='preexisting'?'💗 最初からスキ済み｜解除せず次へ':'✅ 今回スキ済み｜二重送信せず次へ');advance();return}
  if(c.liked===true){markQueueState(me.id,s,i,'preexisting');addResult(me.id,c,'preexisting');setStatus('💗 最初からスキ済み｜何も送らず完了');advance();return}
  const g=guard(me.id);if(Number(g.until||0)>Date.now()){scheduleResumeLabel(me.id,Number(g.until),g.reason||'保護休止');return}
  const used=usage(me.id),cap=likeLimit();if(used>=cap){const until=nextRelease(me.id);scheduleResumeLabel(me.id,until,`スキ24時間上限 ${used}/${cap}`);return}
  setStatus(`🔎 ${c.title||c.key} の現在スキ状態を確認中…`);
  let current=null;try{current=likedStateFrom(await api(`/api/v3/notes/${encodeURIComponent(c.key)}`))}catch(e){if(e.status===401)throw e;setStatus('⚠ 現在のスキ状態を確認できません。安全のため送信せず未完了で保持',true);return}
  if(current===null){setStatus('⚠ スキ済み判定が取得できません。安全のため送信せず未完了で保持',true);return}
  if(current===true){markQueueState(me.id,s,i,'preexisting');addResult(me.id,c,'preexisting');setStatus('💗 最初からスキ済み｜何も送らず完了');advance();return}
  setStatus(`❤️ ${c.title||c.key} にスキ…`);
  try{await api(`/api/v3/notes/${encodeURIComponent(c.key)}/likes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:'{}'});const t=Date.now();const likes=history(me.id,'likes');likes.push({t,key:c.key,urlname:c.urlname,source:'v521'});as(me.id,'likes',likes.slice(-1600));const acts=history(me.id,'actions');acts.push({t,type:'like',key:c.key,urlname:c.urlname,source:'v521'});as(me.id,'actions',acts.slice(-1600));const out=history(me.id,'outbound');out.push({t,key:c.key,urlname:c.urlname,source:'v521'});as(me.id,'outbound',out.slice(-1600));markQueueState(me.id,s,i,'liked_now');addResult(me.id,c,'liked_now');setStatus('❤️ 今回スキ完了');advance()}catch(e){const body=String(e.body||'');if(/already|liked/i.test(body)){markQueueState(me.id,s,i,'preexisting');addResult(me.id,c,'preexisting');setStatus('💗 すでにスキ済み｜解除せず完了');advance();return}if(e.status===429){const wait=Math.max(60000,Number(e.retryAfter)||15*60*1000),until=Date.now()+wait;const gg=guard(me.id);gg.until=until;gg.reason='429保護休止';as(me.id,GUARD,gg);scheduleResumeLabel(me.id,until,'429保護休止');return}if(e.status===403){setStatus('⚠ 403。この人は未完了のまま保持｜再タップで同じ人から',true);return}if(e.status===401){setStatus('🛑 401認証エラー｜未完了のまま保持',true);return}throw e}
}catch(e){setStatus(`⚠ ${e?.message||e}`,true)}finally{btn.disabled=false;busy=false}}
function bind(){if(booted)return;booted=true;window.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest('#nb-like'):null;if(!(b instanceof HTMLButtonElement))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void safeLike(b)},true);const refresh=async()=>{try{const me=await who();renderSummary(me.id);const g=guard(me.id);if(Number(g.until||0)>Date.now())scheduleResumeLabel(me.id,Number(g.until),g.reason||'保護休止');else if(usage(me.id)>=likeLimit()){const u=nextRelease(me.id);if(u>Date.now())scheduleResumeLabel(me.id,u,`スキ24時間上限 ${usage(me.id)}/${likeLimit()}`)}}catch{}};setTimeout(refresh,300);addEventListener('pageshow',refresh)}
bind();
})();
