// ==UserScript==
// @name         無名S note INSIGHT DM同期
// @namespace    https://github.com/mumei-s/note-insight/dm
// @version      1.4.7
// @description  INSIGHT DM同期。note画面を移動させず、親Readerが画面外の実DMルームDOMを直接読んで全件同期します。
// @match        https://note.com/*
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
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dm-network-v2.js?v=146
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dm-reader-v1.js?v=145
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-social-compare-v1.js?v=102
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dm.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dm.user.js
// ==/UserScript==

(function(){
'use strict';
const VERSION='1.4.7',KEY='mumei-dm-tool-version',GMKEY='mumei-dm-active-version-v1';
const modern=()=>Boolean(globalThis.GM);
async function setActive(v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(GMKEY,String(v||''));if(typeof GM_setValue==='function')return GM_setValue(GMKEY,String(v||''))}catch{}}
function publish(){try{localStorage.setItem(KEY,VERSION);window.dispatchEvent(new Event('mumei-dm-version-changed'))}catch{}}
void Promise.resolve(setActive(VERSION)).then(publish);publish();
if(location.origin==='https://mumei-s.github.io')window.addEventListener('message',event=>{
 if(event.source!==window||event.origin!==location.origin||event.data?.source!=='mumei-dm-status-ui'||event.data?.type!=='read')return;
 const id=String(event.data.noteId||'').toLowerCase();if(!/^[a-z0-9_-]+$/.test(id))return;
 void (async()=>{try{const k='mumei_insight_dm_checkpoint_v1:'+id,status=modern()&&typeof GM.getValue==='function'?await GM.getValue(k,null):typeof GM_getValue==='function'?GM_getValue(k,null):null;window.postMessage({source:'mumei-dm-status-bridge',type:'state',noteId:id,status},location.origin)}catch{}})();
});
window.__mumeiDmPackage={version:VERSION,architecture:'durable-dm-v147'};
})();