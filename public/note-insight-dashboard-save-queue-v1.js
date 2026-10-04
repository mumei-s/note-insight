(function(){
'use strict';
if(location.hostname!=='note.com'||window.__mumeiDashboardSaveQueueV1)return;
const PREFIX='mumei-dashboard-save-queue-v1:',TOKEN='mumei-dashboard-ingest-token-v1',NOTE='mumei-dashboard-note-id-v1',API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-data';
const jobs=new Map(),memory=new Map(),remote=new Set(),writes=new Map(),waiting=new Map(),dirty=new Set();
const getValue=typeof GM_getValue==='function'?GM_getValue:globalThis.GM?.getValue?.bind(globalThis.GM);
const setValue=typeof GM_setValue==='function'?GM_setValue:globalThis.GM?.setValue?.bind(globalThis.GM);
function remember(key,value){
 // A full note.com origin must not block sending or confirming a captured snapshot.
 try{if(!remote.has(key)){localStorage.setItem(key,value);memory.delete(key);return}}catch{}
 memory.set(key,value);
 if(!getValue||!setValue)return;
 remote.add(key);dirty.add(key);waiting.set(key,value);
 if(writes.has(key))return;
 const work=(async()=>{while(waiting.has(key)){const next=waiting.get(key),origin=localStorage.getItem(key);waiting.delete(key);try{await setValue(key,next);if(memory.get(key)===next)dirty.delete(key);if(localStorage.getItem(key)===origin)localStorage.removeItem(key)}catch{return}}})();
 writes.set(key,work);void work.finally(()=>{if(writes.get(key)===work)writes.delete(key)});
}
const cached=(key,fallback=null)=>memory.has(key)?memory.get(key):(localStorage.getItem(key)??fallback);
async function recall(key,fallback=null){
 if(memory.has(key))return memory.get(key);
 if(getValue&&setValue)try{const value=await getValue(key,null);if(memory.has(key))return memory.get(key);if(typeof value==='string'){remote.add(key);memory.set(key,value);return value}}catch{}
 return cached(key,fallback);
}
async function settled(key){while(writes.has(key))await writes.get(key)}
async function refresh(key){if(remote.has(key)&&!dirty.has(key))try{const value=await getValue(key,null);if(typeof value==='string'&&!dirty.has(key))memory.set(key,value)}catch{}}
async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function prepare(noteId,token){const key=PREFIX+await hash(JSON.stringify([noteId,token]));await Promise.all([recall(key),recall(key+':confirmed'),recall(key+':last-saved')]);
 // A still-open older tab can have a queue in origin storage after a fallback migration.
 for(const name of [key,key+':confirmed'])if(remote.has(name)){let legacy=[];try{legacy=JSON.parse(localStorage.getItem(name)||'[]')}catch{}if(Array.isArray(legacy)&&legacy.length){const merged=new Map(read(name).map(r=>[r.id,r]));for(const row of legacy){const newer=merged.get(row.id);merged.set(row.id,newer?{...row,...newer,saved:newer.saved||row.saved}:row)}write(name,[...merged.values()]);await settled(name)}}return key}
const read=key=>{try{return JSON.parse(cached(key)||'[]')}catch{return []}};
const write=(key,rows)=>remember(key,JSON.stringify(rows));
function stage(key,pending){const rows=read(key);pending.queueId=pending.queueId||crypto.randomUUID();if(read(key+':confirmed').some(r=>r.id===pending.queueId))return pending.queueId;const row={id:pending.queueId,payload:pending.payload,saved:pending.saved||null,at:Date.now()},index=rows.findIndex(r=>r.id===row.id);if(index<0)rows.push(row);else rows[index]={...row,saved:row.saved||rows[index].saved};write(key,rows);return row.id}
function request(body,token){return new Promise((resolve,reject)=>{const fn=typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:globalThis.GM?.xmlHttpRequest;if(!fn)return reject(Error('DASHBOARD_REQUEST_UNAVAILABLE'));fn({method:'POST',url:API,headers:{'Content-Type':'application/json','X-Ingest-Token':token},data:JSON.stringify(body),timeout:45000,onload:r=>{let p;try{p=JSON.parse(r.responseText)}catch{return reject(Error('SAVE_RESPONSE'))}if(r.status>=200&&r.status<300&&p.ok!==false)resolve(p);else reject(Error(p.error||'HTTP_'+r.status))},onerror:()=>reject(Error('NETWORK_ERROR')),ontimeout:()=>reject(Error('TIMEOUT'))})})}
async function identity(){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);let r;try{r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store',signal:controller.signal})}finally{clearTimeout(timer)};if(!r.ok)throw Error('DASHBOARD_ACCOUNT_UNKNOWN');const j=await r.json(),u=(j.data??j).user||(j.data??j);return String(u.urlname||u.url_name||u.username||'').toLowerCase()}
function verify(payload,saved,v){const metrics=payload.metricSeries||[],charts=payload.chartSeries||[];if(!saved?.snapshotId||v.confirmed!==true||String(v.snapshotId)!==String(saved.snapshotId)||v.noteId!==payload.noteId||Number(v.articleCount)!==payload.articles.length||Number(v.dailyMetricCount)!==metrics.length||Number(v.dailyPvDays)!==metrics.filter(r=>r.pageViews!=null).length||(charts.length&&Number(v.chartMetricCount)!==charts.length))throw Error('保存件数が一致しません [SAVE_COUNT]');for(const[k,n]of Object.entries(payload.totals||{}))if(n!=null&&Number(v.totals?.[k])!==n)throw Error('保存した数値を確認できません [SAVE_VALUE]')}
async function run(key,wanted){await settled(key);await settled(key+':confirmed');const token=localStorage.getItem(TOKEN)||'',noteId=(localStorage.getItem(NOTE)||'').toLowerCase();if(!token||key!==await prepare(noteId,token)||await identity()!==noteId)throw Error('DASHBOARD_ACCOUNT_MISMATCH');await Promise.all([refresh(key),refresh(key+':confirmed')]);if(localStorage.getItem(TOKEN)!==token||localStorage.getItem(NOTE)?.toLowerCase()!==noteId)throw Error('DASHBOARD_ACCOUNT_MISMATCH');let answer=read(key+':confirmed').find(r=>r.id===wanted)?.result||null;
 for(const item of read(key)){if(item.payload?.noteId!==noteId)throw Error('DASHBOARD_ACCOUNT_MISMATCH');if(localStorage.getItem(TOKEN)!==token||localStorage.getItem(NOTE)?.toLowerCase()!==noteId)throw Error('DASHBOARD_ACCOUNT_MISMATCH');
  const confirmed=read(key+':confirmed').find(r=>r.id===item.id);if(confirmed){write(key,read(key).filter(r=>r.id!==item.id));await settled(key);if(item.id===wanted)answer=confirmed.result;continue}
  let saved=item.saved;if(!saved){saved=await request(item.payload,token);if(!saved.snapshotId)throw Error('保存応答に記録番号がありません [SAVE_RESPONSE]');write(key,read(key).map(r=>r.id===item.id?{...r,saved}:r));await settled(key)}
  const verified=await request({action:'sync-status',noteId,snapshotId:saved.snapshotId},token);verify(item.payload,saved,verified);
  if(localStorage.getItem(TOKEN)!==token||localStorage.getItem(NOTE)?.toLowerCase()!==noteId)throw Error('DASHBOARD_ACCOUNT_MISMATCH');
  write(key+':confirmed',[...read(key+':confirmed').filter(r=>r.id!==item.id),{id:item.id,result:{saved,verified}}].slice(-20));await settled(key+':confirmed');write(key,read(key).filter(r=>r.id!==item.id));await settled(key);if(item.id===wanted)answer={saved,verified};
 }
 return answer;
}
function flush(key,wanted){if(jobs.has(key))return jobs.get(key).then(()=>read(key).some(r=>r.id===wanted)?flush(key,wanted):read(key+':confirmed').find(r=>r.id===wanted)?.result||null);const task=(navigator.locks?.request?navigator.locks.request(key,()=>run(key,wanted)):run(key,wanted)).finally(()=>jobs.delete(key));jobs.set(key,task);return task}
window.__mumeiDashboardSaveQueueV1={version:'1.0.1',prepare,stage,flush,hash,remember,recall,cached,settled};
// Retry only a previously authorised save for the currently paired account.
(async()=>{try{const token=localStorage.getItem(TOKEN),id=localStorage.getItem(NOTE)?.toLowerCase();if(!token||!id)return;const key=await prepare(id,token);if(read(key).length)await flush(key)}catch{}})();
})();
