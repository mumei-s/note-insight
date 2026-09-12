// ==UserScript==
// @name         無名S note INSIGHT 本人通知・統計連携
// @namespace    https://github.com/mumei-s/note-insight/notification-sync
// @version      2.9.68
// @description  通知パネルを🔔通知を明示的に開いた時だけ表示。記事・コメント・他クリエイターページでは生成しません。
// @match        https://note.com/*
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v2958.js?v=2968
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-filter-restore-v2962.js?v=2968
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-reader-v2963.js?v=2968
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-filter-safety-v2961.js?v=2968
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-bootstrap-v2966.js?v=2968
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-notification-sync.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-notification-sync.user.js
// ==/UserScript==
// compatibility-test-marker: runtime-v2958.js?v=2966
// compatibility-test-marker: notification-filter-safety-v2961.js?v=2966
// compatibility-test-marker: notification-filter-restore-v2962.js?v=2966
// compatibility-test-marker: notification-reader-v2963.js?v=2966
// compatibility-test-marker: notification-bootstrap-v2966.js?v=2966
(function(){'use strict';})();
