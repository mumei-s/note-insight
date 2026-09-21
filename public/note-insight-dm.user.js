// ==UserScript==
// @name         無名S note INSIGHT DM同期
// @namespace    https://github.com/mumei-s/note-insight/dm
// @version      1.2.0
// @description  INSIGHT DM同期。本人通知とは完全分離し、通信Reader優先＋DOM補助で会話本文まで同期します。
// @match        https://note.com/messages/rooms*
// @match        https://mumei-s.github.io/note-insight/*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      note.com
// @connect      raw.githubusercontent.com
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dm-account-pair-v1.js?v=100
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dm-network-v2.js?v=120
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dm-reader-v1.js?v=120
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dm.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dm.user.js
// ==/UserScript==

(function(){
'use strict';
const VERSION='1.2.0',KEY='mumei-dm-tool-version',GMKEY='mumei-dm-active-version-v1';
const modern=()=>Boolean(globalThis.GM);
async function setActive(v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(GMKEY,String(v||''));if(typeof GM_setValue==='function')return GM_setValue(GMKEY,String(v||''))}catch{}}
function publish(){try{localStorage.setItem(KEY,VERSION);window.dispatchEvent(new Event('mumei-dm-version-changed'))}catch{}}
void Promise.resolve(setActive(VERSION)).then(publish);publish();
window.__mumeiDmPackage={version:VERSION,architecture:'standalone-v1'};
})();