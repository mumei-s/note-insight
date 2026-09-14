// ==UserScript==
// @name         無名S note INSIGHT 本人通知 V3
// @namespace    https://github.com/mumei-s/note-insight/notification-v3
// @version      3.1.8
// @description  本人通知V3。通知本体の読込成否に依存しない常駐INSIGHTランチャーと4ボタンパネル。途中保存・差分読込・ダッシュボード同期を1本に統合。
// @match        https://note.com/*
// @match        https://mumei-s.github.io/note-insight/tool-setup.html*
// @match        https://mumei-s.github.io/note-insight/dashboard-setup.html*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.deleteValue
// @grant        GM_deleteValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      mumei-s.github.io
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-launcher-v317.js?v=317
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-loader-v318.js?v=318
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-notification-v3.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-notification-v3.user.js
// ==/UserScript==

(function(){
'use strict';
try{localStorage.setItem('mumei-notification-v3-wrapper','3.1.8')}catch{}
})();
