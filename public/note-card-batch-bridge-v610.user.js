// ==UserScript==
// @name         無名S note CLEAN通知＋極薄 COMPLETE 11.5
// @namespace    https://github.com/mumei-s/note-insight/batch-bridge-610
// @version      11.5.0
// @description  3送を10/107と同じ実績済み方式へ統一：画像先行→URL一覧コピー→実Enter→通知後カードだけ一括削除
// @match        https://editor.note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js?v=11.5.0
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js?v=11.5.0
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/f0bcaa6e93e3e78d677cac862fcb74320344da24/public/note-card-batch-bridge-v610.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/33a29c26f2d64a6386c789ea7038b20eb21119ee/public/note-send3-addon-v115.js
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
page.__MUMEI_CLEAN_WRAPPER_VERSION__='11.5.0';
})();
