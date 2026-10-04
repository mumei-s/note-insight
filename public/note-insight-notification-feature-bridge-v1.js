(function(){
'use strict';
if(!['mumei-s.github.io','note.com'].includes(location.hostname))return;
if(window.__mumeiNotificationFeatureBridgeV1Loaded)return;window.__mumeiNotificationFeatureBridgeV1Loaded=true;
const KEY='mumei_insight_notification_feature_enabled_v1',PAGE='mumei-notification-feature-ui-v1',BRIDGE='mumei-notification-feature-bridge-v1',EVENT='mumei-notification-feature-changed';
const NOTE=location.hostname==='note.com',OWNED='#mumei-inline-notification-controls-v1,[data-mumei-notification-controls="1"],#mumei-inline-notification-tools-v339,#mumei-v325-dock,#mumei-v325-filter-settings,#mumei-v3-saved-boundary-v3223,#mumei-v3-reader-progress-v3223';
let enabled=null,revision=0,queue=Promise.resolve();
const modern=()=>Boolean(globalThis.GM);
async function get(d=true){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(KEY,d);if(typeof GM_getValue==='function')return GM_getValue(KEY,d)}catch{}return d}
async function write(k,v){if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v);throw new Error('ON/OFFを保存できるツールがありません')}
async function verify(k,v){let actual;if(modern()&&typeof GM.getValue==='function')actual=await GM.getValue(k,null);else if(typeof GM_getValue==='function')actual=GM_getValue(k,null);else throw new Error('ON/OFFの保存を確認できません');if(actual!==v)throw new Error('ON/OFFの保存を確認できません')}
const send=(error='')=>{if(!NOTE)window.postMessage({source:BRIDGE,type:'state',enabled:enabled===true,error},location.origin)};
function apply(value){
 const next=Boolean(value),changed=enabled!==next;enabled=next;
 if(NOTE){
  const root=document.documentElement,want=next?'on':'off';if(root&&root.getAttribute('data-mumei-notification-feature')!==want)root.setAttribute('data-mumei-notification-feature',want);
  if(!next){document.querySelectorAll(OWNED).forEach(el=>el.remove());window.__mumeiNotificationNetwork3300?.stop?.()}
  if(changed)window.dispatchEvent(new CustomEvent(EVENT,{detail:{enabled:next}}));
 }
 if(changed)send();return enabled
}
async function refresh(){const at=revision,value=await get(true);if(at===revision)apply(value);return enabled===true}
function setEnabled(value){const next=Boolean(value);const job=queue.catch(()=>{}).then(async()=>{revision++;try{if(next){const panel='mumei_insight_notification_panel_enabled_v1';await write(panel,true);await verify(panel,true)}await write(KEY,next);await verify(KEY,next);apply(next);send();return next}catch(e){await refresh();send(String(e?.message||e));throw e}});queue=job;return job}
window.__mumeiNotificationFeatureV1={version:'1.2.0',setEnabled,isEnabled:()=>enabled===true,refresh,ready:null};
if(NOTE){
 const style=document.createElement('style');style.id='mumei-notification-feature-style-v1';
 style.textContent=OWNED.split(',').map(s=>'html[data-mumei-notification-feature="off"] '+s).join(',')+'{display:none!important}';
 (document.head||document.documentElement)?.append(style);
}
const listen=modern()&&typeof GM.addValueChangeListener==='function'?GM.addValueChangeListener.bind(GM):typeof GM_addValueChangeListener==='function'?GM_addValueChangeListener:null;
if(listen)try{Promise.resolve(listen(KEY,(_key,_old,value)=>{revision++;apply(value)})).catch(()=>{})}catch{}
if(!NOTE)addEventListener('message',e=>{
 if(e.origin!==location.origin||e.data?.source!==PAGE)return;
 if(e.data?.type==='set')void setEnabled(e.data.enabled).catch(()=>{});
 else if(e.data?.type==='get')void queue.catch(()=>{}).then(async()=>{await refresh();send()});
});
for(const name of ['focus','pageshow'])addEventListener(name,()=>void refresh());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh()});
setInterval(()=>{if(document.visibilityState!=='hidden')void refresh()},2000);
window.__mumeiNotificationFeatureV1.ready=refresh();
})();
