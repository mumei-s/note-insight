// ==UserScript==
// @name         無名S note CLEAN通知＋極薄 COMPLETE 11.6
// @namespace    https://github.com/mumei-s/note-insight/batch-bridge-610
// @version      11.6.0
// @description  3送：サムネ3枚作成→本文へ一括挿入→URL付与→ここで初めて保存→3URLコピー→実Enter→通知後カードだけ一括削除
// @match        https://editor.note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js?v=11.6.0
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-card-batch-bridge-v610.user.js?v=11.6.0
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/f0bcaa6e93e3e78d677cac862fcb74320344da24/public/note-card-batch-bridge-v610.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/73460e42e936aafeeb56a2f5929a574351caef39/public/note-send3-addon-v116.js
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
page.__MUMEI_CLEAN_WRAPPER_VERSION__='11.6.0';
})();
