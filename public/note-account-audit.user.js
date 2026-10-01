// ==UserScript==
// @name note こあく まこ調査
// @namespace https://github.com/mumei-s/note-insight
// @version 3.2.0
// @description スマホ側パネル停止版。調査はチャット側・専用バックエンドで実施します。
// @match https://note.com/*
// @updateURL https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-account-audit.user.js
// @downloadURL https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-account-audit.user.js
// @grant none
// @run-at document-start
// ==/UserScript==
(function(){
'use strict';
window.__noteAccountAuditV1=1;
window.__noteAccountAuditCanonical='3.2.0-headless';
function removeAuditUI(){
  try{
    document.getElementById('note-account-audit-v1')?.remove();
    document.querySelectorAll('[id^="naa-"], .naa-auto, .naa-cards, .naa-tabs, .naa-pane, .naa-conclusion, .naa-hyp').forEach(function(el){
      try{el.remove()}catch(_){}
    });
  }catch(_){}
}
removeAuditUI();
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',removeAuditUI,{once:true});
}
window.addEventListener('pageshow',removeAuditUI);
setTimeout(removeAuditUI,500);
setTimeout(removeAuditUI,2000);
})();