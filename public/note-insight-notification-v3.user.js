// ==UserScript==
// @name         無名S note INSIGHT 本人通知 V3
// @namespace    https://github.com/mumei-s/note-insight/notification-v3
// @version      3.2.43
// @description  本人通知V3。通知画面下部に5パネルを固定し、自動ON/OFF・手動読込・フィルター・設定・INSIGHTを操作します。通知は下側から上方向へ読み、完了ラインより上の追加分だけを次回保存します。
// @match        https://note.com/*
// @match        https://mumei-s.github.io/note-insight/*
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      mumei-s.github.io
// @connect      raw.githubusercontent.com
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-reader-v323.js?v=3243
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-checkpoint-v325.js?v=3243
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v327.js?v=3243
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js
// ==/UserScript==

(function(){
'use strict';
const VERSION='3.2.43';
const TOOL_KEY='mumei-notification-tool-version';
const RUNTIME_KEY='mumei-notification-v3-loader';
if(location.hostname==='mumei-s.github.io'){
  try{localStorage.setItem(TOOL_KEY,VERSION);localStorage.setItem(RUNTIME_KEY,VERSION);window.dispatchEvent(new Event('mumei-notification-version-changed'))}catch{}
  return;
}
if(location.hostname!=='note.com')return;
try{localStorage.setItem(RUNTIME_KEY,VERSION)}catch{}
document.addEventListener('click',e=>{
  const t=e.target instanceof Element?e.target.closest('#mumei-v325-dock [data-a="settings"],#mumei-v324-dock [data-a="settings"],#mumei-v3-tray-v330 [data-act="settings"]'):null;
  if(!t)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  document.getElementById('mumei-v325-filter-settings')?.remove();
  document.getElementById('mumei-v324-filter-settings')?.remove();
  const u=new URL('https://mumei-s.github.io/note-insight/notification-filter.html');
  u.searchParams.set('from','note');
  u.searchParams.set('ts',String(Date.now()));
  location.replace(u.href);
},true);
const q=new URLSearchParams(location.search);
if(q.get('mumei_insight_version_check')==='1'){
  const raw=q.get('mumei_return')||'';
  try{const back=new URL(raw);if(back.origin==='https://mumei-s.github.io'&&back.pathname.startsWith('/note-insight/')){back.searchParams.set('notificationInstalled',VERSION);back.searchParams.set('notificationCheckedAt',String(Date.now()));back.searchParams.set('notificationUpdateResult','bottom-up-saved-line-v3243');location.replace(back.href)}}catch{}
}
})();