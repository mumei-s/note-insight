// ==UserScript==
// @name         無名S note CLEAN通知＋極薄 COMPLETE 11.7
// @namespace    https://github.com/mumei-s/note-insight/batch-bridge-610
// @version      11.7.0
// @description  3送：通信なしでサムネ3枚生成→10と同じ画像一括挿入→URL付与→保存→3URLコピー→実Enter→通知後カードだけ一括削除
// @match        https://editor.note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js?v=11.7.0
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js?v=11.7.0
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/f0bcaa6e93e3e78d677cac862fcb74320344da24/public/note-card-batch-bridge-v610.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/b749d2a79421e9dd87d1b5be2fb1b86f12b3ccc3/public/note-send3-addon-v117.js
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
page.__MUMEI_CLEAN_WRAPPER_VERSION__='11.7.0';
})();
