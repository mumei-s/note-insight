// ==UserScript==
// @name         無名S note INSIGHT 本人通知 V3
// @namespace    https://github.com/mumei-s/note-insight/notification-v3
// @version      3.2.24
// @description  本人通知V3。🔔通知画面だけに固定4列パネルを表示し、追加通知読込・以前のインライン型フィルター登録・INSIGHT連携を1本で起動。
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
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-reader-v323.js?v=3224
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v324.js?v=3224
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-dock-watch-v312.js?v=3224
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v324.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v324.user.js
// ==/UserScript==

(function(){
'use strict';
const VERSION='3.2.24';
const TOOL_KEY='mumei-notification-tool-version';
const RUNTIME_KEY='mumei-notification-v3-loader';
if(location.hostname==='mumei-s.github.io'){
  try{localStorage.setItem(TOOL_KEY,VERSION);localStorage.setItem(RUNTIME_KEY,VERSION);window.dispatchEvent(new Event('mumei-notification-version-changed'))}catch{}
  return;
}
if(location.hostname!=='note.com')return;
try{localStorage.setItem(RUNTIME_KEY,VERSION)}catch{}
const q=new URLSearchParams(location.search);
if(q.get('mumei_insight_version_check')==='1'){
  const raw=q.get('mumei_return')||'';
  try{
    const back=new URL(raw);
    if(back.origin==='https://mumei-s.github.io'&&back.pathname.startsWith('/note-insight/')){
      back.searchParams.set('notificationInstalled',VERSION);
      back.searchParams.set('notificationCheckedAt',String(Date.now()));
      back.searchParams.set('notificationUpdateResult','runtime-checked-v3224');
      location.replace(back.href);
    }
  }catch{}
}
})();