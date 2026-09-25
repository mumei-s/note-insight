// ==UserScript==
// @name         無名S note INSIGHT 本人通知・統計連携（旧版停止）
// @namespace    https://github.com/mumei-s/note-insight/notification-sync
// @version      2.9.70
// @description  旧本人通知ツール互換停止版。旧Runtime/AutoScanを読み込まず、現行V3へ処理を一本化します。
// @match        https://note.com/*
// @run-at       document-start
// @grant        none
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-notification-sync.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-notification-sync.user.js
// ==/UserScript==
(function(){
'use strict';
window.__mumeiLegacyNotificationSyncRetired=true;
const cleanup=()=>{
 for(const id of ['mumei-v2948-frame','mumei-notice-reader-v2963','mumei-inline-notification-tools-v339','mumei-v325-dock']){
  try{document.getElementById(id)?.remove()}catch{}
 }
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cleanup,{once:true});else cleanup();
})();
