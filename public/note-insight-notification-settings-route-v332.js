(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationSettingsRoute332)return;
window.__mumeiNotificationSettingsRoute332=true;
function openSettings(){
  const api=window.__mumeiV3Runtime328;
  if(api&&typeof api.openSettings==='function')void api.openSettings();
}
function intercept(e){
  const t=e.target instanceof Element?e.target.closest('#mumei-v325-dock [data-a="settings"],#mumei-v324-dock [data-a="settings"],#mumei-v3-tray-v330 [data-act="settings"]'):null;
  if(!t)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  openSettings();
}
document.addEventListener('click',intercept,true);
window.__mumeiNotificationSettingsRoute332={openSettings};
})();