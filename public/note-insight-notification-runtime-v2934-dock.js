(function(){
'use strict';
if(location.hostname!=='note.com')return;
const RAIL='mumei-v2933-rail',SETTINGS='mumei-v2933-settings',STYLE='mumei-v2934-dock-style';
function installStyle(){
  if(document.getElementById(STYLE))return;
  const s=document.createElement('style');s.id=STYLE;s.textContent=`
#${RAIL}{left:6px!important;right:6px!important;top:auto!important;bottom:max(8px,env(safe-area-inset-bottom,0px))!important;width:auto!important;min-height:48px!important;padding:3px!important;border-radius:10px!important;grid-template-rows:25px 16px!important;gap:2px!important;border:1px solid #355063!important;box-shadow:0 -4px 14px rgba(0,0,0,.34)!important}
#${RAIL} button{height:25px!important;padding:0 4px!important;font-size:8px!important}
#${RAIL} .m2933-health{height:16px!important;padding:0 4px!important;font-size:7px!important}
#${SETTINGS}{top:auto!important;bottom:max(62px,calc(env(safe-area-inset-bottom,0px) + 62px))!important;max-height:min(66vh,calc(100dvh - 92px))!important}
`;
  document.documentElement.append(s);
}
function dockToBottom(){
  const rail=document.getElementById(RAIL),host=rail?.parentElement;
  if(!rail||!host)return;
  if(host.lastElementChild!==rail)host.append(rail);
}
function refresh(){installStyle();dockToBottom()}
refresh();
for(const ms of [120,350,700,1400,2600,4200])setTimeout(refresh,ms);
document.addEventListener('click',()=>setTimeout(refresh,80),true);
addEventListener('focus',()=>setTimeout(refresh,80));
addEventListener('pageshow',()=>setTimeout(refresh,80));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(refresh,80)});
})();
