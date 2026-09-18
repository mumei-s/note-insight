(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationSettingsRoute332)return;
window.__mumeiNotificationSettingsRoute332=true;

const ROOT='mumei-v325-dock';
const OLD='mumei-v325-filter-settings';
const SETTINGS='https://mumei-s.github.io/note-insight/notification-filter.html';

function openSettings(){
  document.getElementById(OLD)?.remove();
  const u=new URL(SETTINGS);
  u.searchParams.set('from','note');
  u.searchParams.set('ts',String(Date.now()));
  location.replace(u.href);
}
function intercept(e){
  const t=e.target instanceof Element?e.target.closest(`#${ROOT} [data-a="settings"]`):null;
  if(!t)return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  openSettings();
}
document.addEventListener('click',intercept,true);
window.__mumeiNotificationSettingsRoute332={openSettings};
})();