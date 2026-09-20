(function(){
'use strict';
if(location.hostname!=='mumei-s.github.io')return;
if(window.__mumeiNotificationFeatureBridgeV1Loaded)return;window.__mumeiNotificationFeatureBridgeV1Loaded=true;
const KEY='mumei_insight_notification_feature_enabled_v1',PAGE='mumei-notification-feature-ui-v1',BRIDGE='mumei-notification-feature-bridge-v1';
const modern=()=>Boolean(globalThis.GM);
async function get(d=true){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(KEY,d);if(typeof GM_getValue==='function')return GM_getValue(KEY,d)}catch{}return d}
async function set(v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(KEY,Boolean(v));if(typeof GM_setValue==='function')return GM_setValue(KEY,Boolean(v))}catch{}}
const send=enabled=>window.postMessage({source:BRIDGE,type:'state',enabled:Boolean(enabled)},location.origin);
addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.source!==PAGE)return;(async()=>{if(e.data?.type==='set')await set(Boolean(e.data?.enabled));send(await get(true))})()});
void get(true).then(send);
})();