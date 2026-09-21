// ==UserScript==
// @name         無名S note INSIGHT 本人通知 V3
// @namespace    https://github.com/mumei-s/note-insight/notification-v3
// @version      3.5.0
// @description  本人通知V3.5.0。通信Reader高速化・人物アイコン取得・保存確認即時反映に加え、読込/フィルター/設定/INSIGHTの4列操作バーを通知DOMから独立固定します。
// @match        https://note.com/*
// @match        https://mumei-s.github.io/note-insight/*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        GM.addValueChangeListener
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @connect      mumei-s.github.io
// @connect      note.com
// @connect      raw.githubusercontent.com
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-network-v3300.js?v=3500
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-reader-v4.js?v=3500
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-controls-v1.js?v=130
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-filter-v4.js?v=400
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-return-v1.js?v=120
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-status-bridge-v1.js?v=110
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-feature-bridge-v1.js?v=100
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-settings-bridge-v1.js?v=100
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-account-pair-v1.js?v=100
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js
// ==/UserScript==

(function(){
'use strict';
const VERSION='3.5.0',TOOL_KEY='mumei-notification-tool-version',RUNTIME_KEY='mumei-notification-v3-loader',ACTIVE_GM_KEY='mumei-notification-active-runtime-version-v1';
const modern=()=>Boolean(globalThis.GM);
async function setActive(v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(ACTIVE_GM_KEY,String(v||''));if(typeof GM_setValue==='function')return GM_setValue(ACTIVE_GM_KEY,String(v||''))}catch{}}
function publish(){try{localStorage.setItem(TOOL_KEY,VERSION);localStorage.setItem(RUNTIME_KEY,VERSION);window.dispatchEvent(new Event('mumei-notification-version-changed'))}catch{}}
void Promise.resolve(setActive(VERSION)).then(publish);publish();

if(location.hostname==='note.com'){
 const q=new URLSearchParams(location.search);
 if(q.get('mumei_insight_version_check')==='1'){
  const raw=q.get('mumei_return')||'';
  try{
   const back=new URL(raw);
   if(back.origin==='https://mumei-s.github.io'&&back.pathname.startsWith('/note-insight/')){
    back.searchParams.set('notificationInstalled',VERSION);
    back.searchParams.set('notificationCheckedAt',String(Date.now()));
    back.searchParams.set('notificationUpdateResult','direct-api-v350');
    location.replace(back.href)
   }
  }catch{}
 }
}
window.__mumeiNotificationPackage={version:VERSION,architecture:'split-v1'};
})();