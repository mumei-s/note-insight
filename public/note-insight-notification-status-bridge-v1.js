(function(){
'use strict';
if(location.hostname!=='mumei-s.github.io')return;
if(window.__mumeiNotificationStatusBridgeV1Loaded)return;window.__mumeiNotificationStatusBridgeV1Loaded=true;
const PAGE='mumei-notification-status-ui-v1',BRIDGE='mumei-notification-status-bridge-v1';
const CHECK='mumei_insight_notification_checkpoint_v2922:',SAVED='mumei_insight_notification_saved_v2919:';
const modern=()=>Boolean(globalThis.GM);
async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function send(noteId){
 const id=String(noteId||'').trim().replace(/^@/,'').toLowerCase();if(!/^[a-z0-9_-]+$/.test(id))return;
 const cp=await get(CHECK+id,{}),saved=await get(SAVED+id,[]);
 window.postMessage({source:BRIDGE,type:'state',noteId:id,status:{
  lastCheckAt:Number(cp?.lastCheckAt||0),lastSaveAt:Number(cp?.lastSaveAt||0),lastRunAt:Number(cp?.lastRunAt||cp?.lastCheckAt||0),
  lastRunComplete:Boolean(cp?.lastRunComplete),lastRunMode:String(cp?.lastRunMode||''),lastRunReadCount:Number(cp?.lastRunReadCount??cp?.manualSeenCount??0),
  lastRunSavedCount:Number(cp?.lastRunSavedCount??cp?.manualNewCount??0),savedTotal:Array.isArray(saved)?saved.length:Number(cp?.savedCount||0),
  historyComplete:Boolean(cp?.historyComplete),lastError:String(cp?.lastError||''),version:String(cp?.version||'')
 }},location.origin)
}
addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.source!==PAGE||e.data?.type!=='read')return;void send(e.data?.noteId)});
window.__mumeiNotificationStatusBridgeV1={version:'1.0.0',send};
})();