// ==UserScript==
// @name         無名S note INSIGHTスキ300 修正版
// @namespace    https://github.com/mumei-s/note-insight/likes300-fix
// @version      2.5.4
// @description  スキ履歴の読み取りだけで同一人物を除外した300人を取得し、プロフィール文を画像外上部に挿入。アイコン・最新記事サムネ付き極薄50種を生成。
// @match        https://editor.note.com/*
// @noframes
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      note.com
// @connect      assets.st-note.com
// @connect      *
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-core-v232.js?v=254
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v22.user.js?v=254
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-likes300-fix-v220.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-likes300-fix-v220.user.js
// ==/UserScript==

// Compatibility entry: the shared implementation owns rendering and resume state.

