// ==UserScript==
// @name         無名S OWNER｜巡回BOOST専用起動ボタン（旧版停止）
// @namespace    urn:mumei-s:owner-only:boost-launcher
// @version      1.0.2
// @description  旧単独ボタンは廃止。巡回BOOST本体v6.8.2にnote上の専用パネルを統合しました。追加スクリプトは削除して構いません。
// @match        https://note.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/mumei-owner-boost-launcher.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/mumei-owner-boost-launcher.user.js
// ==/UserScript==
(()=>{
  'use strict';
  document.getElementById('mumei-owner-boost-launcher-v1')?.remove();
})();
