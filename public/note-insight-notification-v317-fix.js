(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationV317Fix)return;window.__mumeiNotificationV317Fix=true;
const VERSION='3.1.7';
const safeReturn=v=>{try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}};
(function immediateVersionReturn(){
  const u=new URL(location.href);
  if(u.searchParams.get('mumei_insight_version_check')!=='1')return;
  const back=safeReturn(u.searchParams.get('mumei_return'));
  u.searchParams.delete('mumei_insight_version_check');u.searchParams.delete('mumei_return');
  history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);
  if(!back)return;
  const b=new URL(back);b.searchParams.set('notificationInstalled',VERSION);b.searchParams.set('notificationCheckedAt',String(Date.now()));b.searchParams.set('notificationUpdateResult','loader-checked-v317');location.replace(b.href);
})();
})();
