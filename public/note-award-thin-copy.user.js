// ==UserScript==
// @name         無名S note 表彰式→極薄＋通知 1.2.1
// @namespace    https://github.com/mumei-s/note-insight/award-thin-copy
// @version      1.2.1
// @description  表彰記事の賞名・順位・クリエイター名・URLを抽出し、note.com→editor.note.comを跨いで極薄リンク＋本物通知カードを生成。画だけで不足時は自動抽出し画像選択まで進行
// @match        https://note.com/*/n/*
// @match        https://editor.note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-award-thin-copy.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-award-thin-copy.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/5f5ca351b0b324ef04a9c3b3e7fc72d2df0e021a/public/note-award-thin-copy.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/bc46b1a331bf5b86524a4b16a80bc28f5278cf80/public/note-award-thin-copy-v112-patch.js
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @connect      note.com
// @connect      assets.st-note.com
// ==/UserScript==

(function(){
  'use strict';
  // 実装本体は固定v1.1＋v1.2.1パッチ。
  // 通知カード生成の成功済みコードを固定したまま、
  // 抽出データ共有・画の自動抽出・画像選択導線のみ更新する。
})();