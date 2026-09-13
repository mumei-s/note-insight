// ==UserScript==
// @name         無名S note INSIGHT 本人通知・統計連携
// @namespace    https://github.com/mumei-s/note-insight/notification-sync
// @version      2.9.69
// @description  古い通知側（下）から上へ読み、20件ごとに途中保存。旧3ボタンは廃止し通知画面以外では表示しません。
// @match        https://note.com/*
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v2958.js?v=2970
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-filter-restore-v2962.js?v=2970
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-autoscan-v2970.js?v=2970
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-filter-safety-v2961.js?v=2970
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-bootstrap-v2966.js?v=2970
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-notification-sync.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-notification-sync.user.js
// ==/UserScript==
// compatibility-test-marker: runtime-v2958.js?v=2968
// compatibility-test-marker: notification-filter-safety-v2961.js?v=2968
// compatibility-test-marker: notification-filter-restore-v2962.js?v=2968
// compatibility-test-marker: notification-reader-v2963.js?v=2968
// compatibility-test-marker: notification-bootstrap-v2966.js?v=2968
(function(){'use strict';})();
