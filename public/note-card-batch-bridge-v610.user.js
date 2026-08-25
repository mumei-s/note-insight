// ==UserScript==
// @name         無名S note CLEAN通知＋極薄 COMPLETE 11.3
// @namespace    https://github.com/mumei-s/note-insight/batch-bridge-610
// @version      11.3.0
// @description  3送＝画像3枚→URL→標準カード3件自動生成→通知後カードだけ一括削除。Tampermonkey更新キャッシュ対策版
// @match        https://editor.note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js?v=11.3.0
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js?v=11.3.0
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/f0bcaa6e93e3e78d677cac862fcb74320344da24/public/note-card-batch-bridge-v610.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/e683ead83fe80c99a0cb32bbba0a19b8be750f3b/public/note-send3-addon-v112.js
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
page.__MUMEI_CLEAN_WRAPPER_VERSION__='11.3.0';
})();
