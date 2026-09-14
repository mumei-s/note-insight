// ==UserScript==
// @name         無名S note INSIGHT 本人通知 V3
// @namespace    https://github.com/mumei-s/note-insight/notification-v3
// @version      3.1.7
// @description  本人通知V3。通知本体の読込成否に依存しない常駐INSIGHTランチャーを追加し、4ボタンパネルへ必ず入れる安定版。
// @match        https://note.com/*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      mumei-s.github.io
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-launcher-v317.js?v=317
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v316-fix.js?v=316
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/19b1beec55012b53bedcd93751af552f53c0cf8a/public/note-insight-notification-v3.user.js
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-notification-v3.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-notification-v3.user.js
// ==/UserScript==

(function(){
'use strict';
try{localStorage.setItem('mumei-notification-v3-wrapper','3.1.7')}catch{}
})();
