// ==UserScript==
// @name         無名S note INSIGHT 本人通知・統計連携
// @namespace    https://github.com/mumei-s/note-insight/notification-sync
// @version      2.9.63
// @description  通知読込を強化。通知DOM変更時も行検出を継続し、本人連携切れを明示して修復できます。
// @match        https://note.com/*
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v2958.js?v=2963
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-filter-safety-v2961.js?v=2963
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-filter-restore-v2962.js?v=2963
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-reader-v2963.js?v=2963
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-bootstrap-v2962.js?v=2963
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-notification-sync.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-notification-sync.user.js
// ==/UserScript==
// Compatibility markers for the v2.9.62 protocol regression suite:
// @version 2.9.62 legacy-protocol-marker
// runtime-v2958.js?v=2962
// notification-filter-safety-v2961.js?v=2962
// notification-filter-restore-v2962.js?v=2962
// notification-autoscan-v2960.js?v=2962
// notification-bootstrap-v2962.js?v=2962
(function(){'use strict';})();