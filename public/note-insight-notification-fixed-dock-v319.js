(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationFixedDock319)return;window.__mumeiNotificationFixedDock319=true;
// Compatibility shim only. Older V3.1.9 installs still @require this file.
// Do not create or control any visible panel here.
const ROOT='mumei-v3-fixed-dock',LAUNCHER='mumei-v3-notification-launcher';
function retire(){const r=document.getElementById(ROOT);if(r instanceof HTMLElement){r.style.setProperty('display','none','important');r.style.setProperty('visibility','hidden','important');r.style.setProperty('pointer-events','none','important');r.style.setProperty('width','0px','important');r.style.setProperty('height','0px','important')}document.getElementById(LAUNCHER)?.remove()}
if(document.documentElement){retire();new MutationObserver(retire).observe(document.documentElement,{subtree:true,childList:true})}
})();
