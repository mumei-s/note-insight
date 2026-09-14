// ==UserScript==
// @name         無名S note INSIGHT Bridge (互換停止版)
// @namespace    https://mumei-s.github.io/note-insight/bridge
// @version      1.0.1
// @description  旧Bridge互換用。Dashboard同期と本人通知は各正本ツールへ戻したため、このBridgeは何も起動しません。
// @match        https://note.com/*
// @match        https://mumei-s.github.io/note-insight/*
// @run-at       document-start
// @grant        none
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-bridge.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-bridge.user.js
// ==/UserScript==
(function(){'use strict';try{localStorage.removeItem('mumei-insight-bridge-version');localStorage.removeItem('mumei-insight-bridge-at')}catch{}document.documentElement?.removeAttribute('data-mumei-insight-bridge');})();
