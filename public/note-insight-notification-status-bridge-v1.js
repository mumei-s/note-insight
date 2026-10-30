(function(){
'use strict';
if(location.hostname!=='mumei-s.github.io')return;
if(window.__mumeiNotificationStatusBridgeV1Loaded)return;window.__mumeiNotificationStatusBridgeV1Loaded=true;
const PAGE='mumei-notification-status-ui-v1',BRIDGE='mumei-notification-status-bridge-v1';
const CHECK='mumei_insight_notification_checkpoint_v2922:',SAVED='mumei_insight_notification_saved_v2919:';
const modern=()=>(typeof GM!=='undefined'&&Boolean(GM)),watches=new Map(),savedCounts=new Map(),pendingSends=new Map();
async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function watch(noteId){
 const id=String(noteId||'').trim().replace(/^@/,'').toLowerCase();if(!/^[a-z0-9_-]+$/.test(id)||watches.has(id))return;
 try{
  const fn=modern()&&typeof GM.addValueChangeListener==='function'?GM.addValueChangeListener:typeof GM_addValueChangeListener==='function'?GM_addValueChangeListener:null;
  if(!fn)return;
  const listener=fn(CHECK+id,()=>void send(id));watches.set(id,listener)
 }catch{}
}
async function send(noteId){
 const id=String(noteId||'').trim().replace(/^@/,'').toLowerCase();
 if(!/^[a-z0-9_-]+$/.test(id))return;
 // Coalesce page timers and GM change events. Storage reads can be slow on mobile.
 if(pendingSends.has(id))return pendingSends.get(id);
 const pending=(async()=>{
  const cp=await get(CHECK+id,{});
  const accurateCount=cp&&Number.isSafeInteger(cp.savedCount)&&cp.savedCount>=0;
  let total=accurateCount?cp.savedCount:undefined;
  // Older clients lack savedCount. Cache their one-time legacy array read
  // until the reader actually confirms another save.
  if(total===undefined){
   const stamp=Number(cp?.lastSaveAt||0),cached=savedCounts.get(id);
   if(cached&&cached.stamp===stamp)total=cached.total;
   else{
    const saved=await get(SAVED+id,[]);
    total=Array.isArray(saved)?saved.length:0;
    savedCounts.set(id,{stamp,total});
   }
  }
  window.postMessage({source:BRIDGE,type:'state',noteId:id,status:{
   lastCheckAt:Number(cp?.lastCheckAt||0),lastSaveAt:Number(cp?.lastSaveAt||0),lastRunAt:Number(cp?.lastRunAt||cp?.lastCheckAt||0),
   lastRunComplete:Boolean(cp?.lastRunComplete),lastRunMode:String(cp?.lastRunMode||''),lastRunReadCount:Number(cp?.lastRunReadCount??cp?.manualSeenCount??0),
   lastRunSavedCount:Number(cp?.lastRunSavedCount??cp?.manualNewCount??0),savedTotal:total,
   historyComplete:Boolean(cp?.historyComplete),lastError:String(cp?.lastError||''),version:String(cp?.version||'')
  }},location.origin);
 })().finally(()=>pendingSends.delete(id));
 pendingSends.set(id,pending);
 return pending;
}
addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.source!==PAGE||e.data?.type!=='read')return;void watch(e.data?.noteId);void send(e.data?.noteId)});
window.__mumeiNotificationStatusBridgeV1={version:'1.1.2',send,watch};
})();