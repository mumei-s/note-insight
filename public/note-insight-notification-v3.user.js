// ==UserScript==
// @name         無名S note INSIGHT 本人通知 V3
// @namespace    https://github.com/mumei-s/note-insight/notification-v3
// @version      3.6.62
// @description  本人通知V3.6.62。通知取得結果の本人照合と保存線の通知ID・本人照合を強化しました。🔔操作パネルの高さと保存済み境界までの差分取得は維持します。
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
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-feature-bridge-v1.js?v=121
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-network-v3300.js?v=3623
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-reader-v4.js?v=3637
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-controls-v1.js?v=158
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-checkpoint-v325.js?v=364
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-filter-v4.js?v=4214
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-return-v1.js?v=121
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-status-bridge-v1.js?v=112
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-settings-bridge-v1.js?v=115
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-account-pair-v1.js?v=102
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-outgoing-comment-capture-v1.js?v=100
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-outgoing-comment-reader-v1.js?v=102
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-social-compare-v1.js?v=109
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js
// ==/UserScript==

(function(){
'use strict';
const VERSION='3.6.62',TOOL_KEY='mumei-notification-tool-version',RUNTIME_KEY='mumei-notification-v3-loader',ACTIVE_GM_KEY='mumei-notification-active-runtime-version-v1';
const modern=()=>(typeof GM!=='undefined'&&Boolean(GM));
async function setActive(v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(ACTIVE_GM_KEY,String(v||''));if(typeof GM_setValue==='function')return GM_setValue(ACTIVE_GM_KEY,String(v||''))}catch{}}
function liveManager(){try{const info=typeof GM_info!=='undefined'?GM_info:typeof GM!=='undefined'?GM?.info:null,name=String(info?.scriptHandler||'').toLowerCase();return ['Userscripts','Tampermonkey','Violentmonkey','Greasemonkey','Stay'].find(value=>value.toLowerCase()===name)||''}catch{return''}}
function publishLive(){if(location.origin!=='https://mumei-s.github.io'||!location.pathname.startsWith('/note-insight/'))return;if(!document.documentElement){document.addEventListener('DOMContentLoaded',publishLive,{once:true});return}const root=document.documentElement,manager=liveManager();if(manager)root.setAttribute('data-mumei-notification-live-manager',manager);else root.removeAttribute('data-mumei-notification-live-manager');if(root.getAttribute('data-mumei-notification-live-version')!==VERSION)root.setAttribute('data-mumei-notification-live-version',VERSION);window.dispatchEvent(new Event('mumei-insight-tool-ready'))}
function publish(){try{localStorage.setItem(TOOL_KEY,VERSION);localStorage.setItem(RUNTIME_KEY,VERSION);window.dispatchEvent(new Event('mumei-notification-version-changed'))}catch{}publishLive()}
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
    back.searchParams.set('notificationUpdateResult','durable-window-v362');
    location.replace(back.href)
   }
  }catch{}
 }
}
window.__mumeiNotificationPackage={version:VERSION,architecture:'split-v1'};
})();
