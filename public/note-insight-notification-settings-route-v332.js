(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationSettingsRoute332)return;window.__mumeiNotificationSettingsRoute332=true;

const ROOT='mumei-v325-dock';
const OLD='mumei-v325-filter-settings';
const SETTINGS='https://mumei-s.github.io/note-insight/notification-filter.html';

function button(){return document.querySelector(`#${ROOT} [data-a="settings"]`)}
function relabel(){const b=button();if(b){b.textContent='設定';b.title='通知フィルター設定を開く'}document.getElementById(OLD)?.remove()}
function openSettings(){
  const u=new URL(SETTINGS);
  u.searchParams.set('from','note');
  u.searchParams.set('mumei_return','https://note.com/notifications');
  u.searchParams.set('ts',String(Date.now()));
  document.getElementById(OLD)?.remove();
  location.assign(u.href);
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
new MutationObserver(relabel).observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',relabel,{once:true});else relabel();
window.__mumeiNotificationSettingsRoute332={openSettings,relabel};
})();
