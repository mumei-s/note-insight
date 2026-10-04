(function(){
'use strict';
if(!['mumei-s.github.io','note.com'].includes(location.hostname))return;
if(window.__mumeiDashboardFeatureV1)return;
const KEY='mumei_insight_dashboard_feature_enabled_v1',MODE='mumei_insight_dashboard_auto_enabled_v1',PAGE='mumei-dashboard-feature-ui-v1',BRIDGE='mumei-dashboard-feature-bridge-v1',EVENT='mumei-dashboard-feature-changed',MODE_EVENT='mumei-dashboard-mode-changed';
const NOTE=location.hostname==='note.com';
let enabled=null,automatic=null,revision=0,queue=Promise.resolve();
const api=()=>globalThis.GM;
async function read(k=KEY){if(typeof api()?.getValue==='function')return (await api().getValue(k,true))!==false;if(typeof GM_getValue==='function')return GM_getValue(k,true)!==false;return true}
async function write(value,k=KEY){if(typeof api()?.setValue==='function')return api().setValue(k,value);if(typeof GM_setValue==='function')return GM_setValue(k,value);throw new Error('設定を保存できません。ダッシュボード同期ツールを更新してください。')}
function send(error=''){if(!NOTE)window.postMessage({source:BRIDGE,type:'state',enabled:enabled===true,automatic:automatic!==false,error},location.origin)}
function apply(value){const changed=enabled!==value;enabled=value;const root=document.documentElement;if(root){const state=value?'on':'off';if(root.getAttribute('data-mumei-dashboard-feature')!==state)root.setAttribute('data-mumei-dashboard-feature',state)}if(changed)window.dispatchEvent(new CustomEvent(EVENT,{detail:{enabled:value}}));send();return value}
function applyMode(value){const changed=automatic!==value;automatic=value;const root=document.documentElement;if(root){const state=value?'automatic':'manual';if(root.getAttribute('data-mumei-dashboard-mode')!==state)root.setAttribute('data-mumei-dashboard-mode',state)}if(changed)window.dispatchEvent(new CustomEvent(MODE_EVENT,{detail:{automatic:value}}));return value}
async function refresh(){const at=revision;try{const [value,mode]=await Promise.all([read(),read(MODE)]);if(at===revision){applyMode(mode);apply(value)}}catch{send('設定を確認できません。もう一度操作してください。')}return enabled===true}
function setEnabled(value){const next=Boolean(value);queue=queue.catch(()=>{}).then(async()=>{revision++;try{await write(next);const saved=await read();if(saved!==next)throw new Error('設定の保存を確認できませんでした。');return apply(saved)}catch(e){send(String(e?.message||'設定を保存できませんでした。'));throw e}});return queue}
function setAutomatic(value){const next=Boolean(value);queue=queue.catch(()=>{}).then(async()=>{revision++;try{await write(next,MODE);const saved=await read(MODE);if(saved!==next)throw new Error('読込モードの保存を確認できませんでした。');applyMode(saved);send();return saved}catch(e){send(String(e?.message||'読込モードを保存できませんでした。'));throw e}});return queue}
window.__mumeiDashboardFeatureV1={isEnabled:()=>enabled===true,isAutomatic:()=>automatic!==false,refresh,setEnabled,setAutomatic,ready:null};
function style(){if(!document.documentElement)return false;if(!document.getElementById('mumei-dashboard-feature-style')){const s=document.createElement('style');s.id='mumei-dashboard-feature-style';s.textContent='html[data-mumei-dashboard-feature="off"] #mumei-dashboard-sync,html[data-mumei-dashboard-feature="off"] #mumei-dashboard-clearance,html[data-mumei-dashboard-surface="other"] #mumei-dashboard-sync,html[data-mumei-dashboard-surface="other"] #mumei-dashboard-clearance{display:none!important}';(document.head||document.documentElement).append(s)}if(enabled!==null)apply(enabled);return true}
if(NOTE&&!style()){const observer=new MutationObserver(()=>{if(style())observer.disconnect()});observer.observe(document,{childList:true,subtree:true})}
const listen=typeof api()?.addValueChangeListener==='function'?api().addValueChangeListener.bind(api()):typeof GM_addValueChangeListener==='function'?GM_addValueChangeListener:null;
if(listen)for(const k of [KEY,MODE])try{Promise.resolve(listen(k,(_key,_old,value)=>{revision++;if(k===MODE){applyMode(value!==false);send()}else apply(value!==false)})).catch(()=>{})}catch{}
if(!NOTE)window.addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.source!==PAGE)return;if(e.data.type==='get')void queue.catch(()=>{}).then(refresh);else if(e.data.type==='set'&&typeof e.data.enabled==='boolean')void setEnabled(e.data.enabled).catch(()=>{})});
for(const event of ['focus','pageshow'])window.addEventListener(event,()=>void refresh());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh()});
window.__mumeiDashboardFeatureV1.ready=refresh();
})();
