(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationSettingsRoute332)return;window.__mumeiNotificationSettingsRoute332=true;

const ROOT='mumei-v325-dock';
const OLD='mumei-v325-filter-settings';
const SETTINGS='https://mumei-s.github.io/note-insight/notification-filter.html';
const LABEL='設定';
const TITLE='通知フィルター設定を開く';
let scheduled=false;

function button(){return document.querySelector(`#${ROOT} [data-a="settings"]`)}
function relabel(){
  const b=button();
  if(b){
    if(b.textContent!==LABEL)b.textContent=LABEL;
    if(b.title!==TITLE)b.title=TITLE;
  }
  const old=document.getElementById(OLD);
  if(old)old.remove();
}
function scheduleRelabel(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;relabel()});
}
function openSettings(){
  const u=new URL(SETTINGS);
  u.searchParams.set('from','note');
  u.searchParams.set('mumei_return','https://note.com/notifications');
  u.searchParams.set('ts',String(Date.now()));
  const old=document.getElementById(OLD);
  if(old)old.remove();
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
const observer=new MutationObserver(ms=>{
  let relevant=false;
  for(const m of ms){
    for(const n of m.addedNodes){
      if(!(n instanceof Element))continue;
      if(n.id===ROOT||n.querySelector?.(`#${ROOT}`)||n.matches?.(`#${ROOT} [data-a="settings"]`)||n.querySelector?.(`#${ROOT} [data-a="settings"]`)){relevant=true;break}
    }
    if(relevant)break;
  }
  if(relevant)scheduleRelabel();
});
observer.observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleRelabel,{once:true});else scheduleRelabel();
window.__mumeiNotificationSettingsRoute332={openSettings,relabel,scheduleRelabel};
})();