(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationV316Fix)return;window.__mumeiNotificationV316Fix=true;
const VERSION='3.1.6';
const safeReturn=v=>{try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}};

// 3.1.6補助は更新確認だけを担当する。
// パネルの表示/非表示は dock-watch の1系統に固定し、二重制御による点滅・再表示を起こさない。
(function immediateVersionReturn(){
  const u=new URL(location.href);
  if(u.searchParams.get('mumei_insight_version_check')!=='1')return;
  const back=safeReturn(u.searchParams.get('mumei_return'));
  u.searchParams.delete('mumei_insight_version_check');
  u.searchParams.delete('mumei_return');
  history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);
  if(!back)return;
  const b=new URL(back);
  b.searchParams.set('notificationInstalled',VERSION);
  b.searchParams.set('notificationCheckedAt',String(Date.now()));
  b.searchParams.set('notificationUpdateResult','loader-checked-v316');
  location.replace(b.href);
})();
})();
