(function(){
'use strict';
if(location.hostname!=='note.com'||window.__mumeiDashboardSaveQueueV1)return;
const PREFIX='mumei-dashboard-save-queue-v1:',TOKEN='mumei-dashboard-ingest-token-v1',NOTE='mumei-dashboard-note-id-v1',API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-data';
const jobs=new Map();
async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function prepare(noteId,token){return PREFIX+await hash(JSON.stringify([noteId,token]))}
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}};
const write=(key,rows)=>localStorage.setItem(key,JSON.stringify(rows));
function stage(key,pending){const rows=read(key);pending.queueId=pending.queueId||crypto.randomUUID();if(read(key+':confirmed').some(r=>r.id===pending.queueId))return pending.queueId;const row={id:pending.queueId,payload:pending.payload,saved:pending.saved||null,at:Date.now()},index=rows.findIndex(r=>r.id===row.id);if(index<0)rows.push(row);else rows[index]={...row,saved:row.saved||rows[index].saved};write(key,rows);return row.id}
function request(body,token){return new Promise((resolve,reject)=>{const fn=typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:globalThis.GM?.xmlHttpRequest;if(!fn)return reject(Error('DASHBOARD_REQUEST_UNAVAILABLE'));fn({method:'POST',url:API,headers:{'Content-Type':'application/json','X-Ingest-Token':token},data:JSON.stringify(body),timeout:45000,onload:r=>{let p;try{p=JSON.parse(r.responseText)}catch{return reject(Error('SAVE_RESPONSE'))}if(r.status>=200&&r.status<300&&p.ok!==false)resolve(p);else reject(Error(p.error||'HTTP_'+r.status))},onerror:()=>reject(Error('NETWORK_ERROR')),ontimeout:()=>reject(Error('TIMEOUT'))})})}
async function identity(){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);let r;try{r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store',signal:controller.signal})}finally{clearTimeout(timer)};if(!r.ok)throw Error('DASHBOARD_ACCOUNT_UNKNOWN');const j=await r.json(),u=(j.data??j).user||(j.data??j);return String(u.urlname||u.url_name||u.username||'').toLowerCase()}
function verify(payload,saved,v){const metrics=payload.metricSeries||[],charts=payload.chartSeries||[];if(!saved?.snapshotId||v.confirmed!==true||String(v.snapshotId)!==String(saved.snapshotId)||v.noteId!==payload.noteId||Number(v.articleCount)!==payload.articles.length||Number(v.dailyMetricCount)!==metrics.length||Number(v.dailyPvDays)!==metrics.filter(r=>r.pageViews!=null).length||(charts.length&&Number(v.chartMetricCount)!==charts.length))throw Error('保存件数が一致しません [SAVE_COUNT]');for(const[k,n]of Object.entries(payload.totals||{}))if(n!=null&&Number(v.totals?.[k])!==n)throw Error('保存した数値を確認できません [SAVE_VALUE]')}
async function run(key,wanted){const token=localStorage.getItem(TOKEN)||'',noteId=(localStorage.getItem(NOTE)||'').toLowerCase();if(!token||key!==await prepare(noteId,token)||await identity()!==noteId)throw Error('DASHBOARD_ACCOUNT_MISMATCH');let answer=read(key+':confirmed').find(r=>r.id===wanted)?.result||null;
 for(const item of read(key)){if(item.payload?.noteId!==noteId)throw Error('DASHBOARD_ACCOUNT_MISMATCH');if(localStorage.getItem(TOKEN)!==token||localStorage.getItem(NOTE)?.toLowerCase()!==noteId)throw Error('DASHBOARD_ACCOUNT_MISMATCH');
  let saved=item.saved;if(!saved){saved=await request(item.payload,token);if(!saved.snapshotId)throw Error('保存応答に記録番号がありません [SAVE_RESPONSE]');write(key,read(key).map(r=>r.id===item.id?{...r,saved}:r))}
  const verified=await request({action:'sync-status',noteId,snapshotId:saved.snapshotId},token);verify(item.payload,saved,verified);
  if(localStorage.getItem(TOKEN)!==token||localStorage.getItem(NOTE)?.toLowerCase()!==noteId)throw Error('DASHBOARD_ACCOUNT_MISMATCH');
  write(key+':confirmed',[...read(key+':confirmed').filter(r=>r.id!==item.id),{id:item.id,result:{saved,verified}}].slice(-20));write(key,read(key).filter(r=>r.id!==item.id));if(item.id===wanted)answer={saved,verified};
 }
 return answer;
}
function flush(key,wanted){if(jobs.has(key))return jobs.get(key).then(()=>read(key).some(r=>r.id===wanted)?flush(key,wanted):read(key+':confirmed').find(r=>r.id===wanted)?.result||null);const task=(navigator.locks?.request?navigator.locks.request(key,()=>run(key,wanted)):run(key,wanted)).finally(()=>jobs.delete(key));jobs.set(key,task);return task}
window.__mumeiDashboardSaveQueueV1={version:'1.0.0',prepare,stage,flush,hash};
// Retry only a previously authorised save for the currently paired account.
(async()=>{try{const token=localStorage.getItem(TOKEN),id=localStorage.getItem(NOTE)?.toLowerCase();if(!token||!id)return;const key=await prepare(id,token);if(read(key).length)await flush(key)}catch{}})();
})();
