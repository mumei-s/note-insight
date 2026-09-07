(function(){
'use strict';
if(location.hostname!=='note.com')return;
const RAIL='mumei-v2933-rail',SETTINGS='mumei-v2933-settings';
const HOST_ATTR='data-mumei-insight-notification-host-v2933';
const EVT_MANUAL='mumei-insight-manual-read-v2933';
const EVT_MARK='mumei-insight-mark-v2933';
const EVT_STATUS='mumei-insight-sync-status-v2933';
const STYLE='mumei-v2935-independent-style';
const MISS_GRACE=900;
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function shown(el){if(!el?.getBoundingClientRect)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function exact(v){return[...document.querySelectorAll('button,a,[role="tab"],[role="button"],div,span')].find(el=>shown(el)&&clean(el.textContent)===v)||null}
function commonShell(a,b){if(!a||!b)return null;let p=a;for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){if(p.contains(b)&&shown(p)){const r=p.getBoundingClientRect();if(r.width>180&&r.height>100)return p}}return null}
function directShell(){return commonShell(exact('通知'),exact('お知らせ'))}
let lastShell=null,lastSeen=0,hideTimer=0;
function notificationShell(){const now=Date.now(),hit=directShell();if(hit){lastShell=hit;lastSeen=now;return hit}if(lastShell?.isConnected&&now-lastSeen<MISS_GRACE)return lastShell;return null}
function installStyle(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`
#${RAIL}{position:fixed!important;left:6px!important;right:6px!important;top:auto!important;bottom:max(8px,env(safe-area-inset-bottom,0px))!important;width:auto!important;z-index:2147483500!important}
#${SETTINGS}{position:fixed!important;left:8px!important;right:8px!important;top:auto!important;bottom:max(62px,calc(env(safe-area-inset-bottom,0px) + 62px))!important;z-index:2147483647!important}
[data-mumei-insight-boundary-v2933="1"]{box-shadow:none!important}
[data-mumei-insight-boundary-v2933="1"]::before{display:none!important;content:none!important}
`;document.documentElement.append(s)}
function stripBoundaryText(){const h=document.querySelector(`#${RAIL} .m2933-health`);if(!h)return;const t=clean(h.textContent).replace(/^✓\s*保存済み境界あり｜?/u,'').trim();if(t&&t!==clean(h.textContent))h.textContent=t;h.removeAttribute('title')}
function setHidden(rail,want){if(!rail)return;if(Boolean(rail.hidden)!==Boolean(want))rail.hidden=Boolean(want)}
function moveIndependent(shell){const rail=document.getElementById(RAIL),settings=document.getElementById(SETTINGS);if(rail&&rail.parentElement!==document.body)document.body.append(rail);if(settings&&settings.parentElement!==document.body)document.body.append(settings);if(shell){clearTimeout(hideTimer);for(const el of document.querySelectorAll(`[${HOST_ATTR}]`)){if(el!==shell)el.removeAttribute(HOST_ATTR)}shell.setAttribute(HOST_ATTR,'1');setHidden(rail,false)}else if(rail){clearTimeout(hideTimer);hideTimer=setTimeout(()=>{if(!directShell()&&Date.now()-lastSeen>=MISS_GRACE){setHidden(rail,true);document.getElementById(SETTINGS)?.remove()}},MISS_GRACE)}stripBoundaryText()}
let frame=0;
function sync(){installStyle();moveIndependent(notificationShell())}
function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(sync)}
window.addEventListener(EVT_MANUAL,e=>{const shell=notificationShell();if(!shell){e.stopImmediatePropagation();window.dispatchEvent(new CustomEvent(EVT_STATUS,{detail:{state:'error',text:'🔔の「通知」一覧を開いてから押してください',manual:true,version:'2.9.38'}}));return}if(e.detail&&typeof e.detail==='object')e.detail.root=shell},true);
window.addEventListener(EVT_MARK,e=>{e.stopImmediatePropagation()},true);
const observer=new MutationObserver(ms=>{if(ms.some(m=>m.type==='childList'))schedule()});
observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',()=>setTimeout(schedule,60),true);
addEventListener('focus',schedule);addEventListener('pageshow',schedule);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule()});
installStyle();schedule();
})();