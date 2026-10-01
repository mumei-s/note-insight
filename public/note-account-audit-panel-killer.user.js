// ==UserScript==
// @name note こあく まこ調査 パネル停止
// @namespace https://github.com/mumei-s/note-insight/panel-killer
// @version 1.0.0
// @description 旧版を含む「こあく まこ調査」パネルをnote上から完全に非表示・停止します。
// @match https://note.com/*
// @updateURL https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-account-audit-panel-killer.user.js
// @downloadURL https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-account-audit-panel-killer.user.js
// @grant none
// @run-at document-start
// ==/UserScript==
(function(){
'use strict';
try{
  window.__noteAccountAuditV1=1;
  window.__noteAccountAuditCanonical='panel-killer';
}catch(_){}
const CSS='#note-account-audit-v1,#naa-panel,#naa-open,.naa-auto,.naa-cards,.naa-tabs,.naa-pane,.naa-conclusion,.naa-hyp{display:none!important;visibility:hidden!important;pointer-events:none!important;opacity:0!important}';
function style(){
  try{
    if(document.getElementById('note-account-audit-killer-style'))return;
    const st=document.createElement('style');
    st.id='note-account-audit-killer-style';
    st.textContent=CSS;
    (document.head||document.documentElement).appendChild(st);
  }catch(_){}
}
function kill(){
  try{
    style();
    [
      '#note-account-audit-v1',
      '#naa-panel',
      '#naa-open'
    ].forEach(sel=>document.querySelectorAll(sel).forEach(el=>el.remove()));
  }catch(_){}
}
style();
kill();
try{
  const root=document.documentElement||document;
  const mo=new MutationObserver(()=>kill());
  mo.observe(root,{childList:true,subtree:true});
}catch(_){}
document.addEventListener('DOMContentLoaded',kill,{once:true});
window.addEventListener('pageshow',kill);
setInterval(kill,1000);
})();