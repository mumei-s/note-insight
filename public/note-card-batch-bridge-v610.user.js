// ==UserScript==
// @name         無名S note CLEAN通知＋極薄 COMPLETE 11.4
// @namespace    https://github.com/mumei-s/note-insight/batch-bridge-610
// @version      11.4.0
// @description  3送＝画像3枚→URL→標準カード3件自動生成→通知後カードだけ一括削除。通信失敗をAPI/HTML/文字カードの3段フォールバックで回避
// @match        https://editor.note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js?v=11.4.0
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js?v=11.4.0
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/f0bcaa6e93e3e78d677cac862fcb74320344da24/public/note-card-batch-bridge-v610.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/0ec7ecf8625539166f27cbbc55ad926999403f91/public/note-send3-addon-v114.js
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @connect      note.com
// @connect      assets.st-note.com
// @connect      mumei-s.github.io
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function(){
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
page.__MUMEI_CLEAN_WRAPPER_VERSION__='11.4.0';
})();
