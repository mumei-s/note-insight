// ==UserScript==
// @name         note BOOST App Bridge v6.1.0
// @namespace    https://github.com/mumei-s/note-insight
// @version      6.1.0
// @description  巡回BOOST専用アプリ内からTampermonkey経由でnoteへ直接通信。note画面にはUIを表示せず、noteトップを開かない。
// @match        https://mumei-s.github.io/note-insight/boost-app/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-boost-v531.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-boost-v531.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/1062adad32c268dc0daff72d713b98ae45bdfdf3/public/note-boost-v610-app-bridge.js
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @run-at       document-start
// ==/UserScript==
(() => {
  'use strict';
  // v6.1.0: dedicated app only. No note.com page UI or window.opener bridge.
})();