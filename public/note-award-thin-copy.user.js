// ==UserScript==
// @name         無名S note 表彰式→極薄＋通知 1.2
// @namespace    https://github.com/mumei-s/note-insight/award-thin-copy
// @version      1.2.0
// @description  表彰記事の賞名・順位・クリエイター名・URLを抽出し、note.com→editor.note.comを跨いで極薄リンク＋本物通知カードを生成。画は共有抽出データを自動復元し画像選択まで自動化
// @match        https://note.com/*/n/*
// @match        https://editor.note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-award-thin-copy.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-award-thin-copy.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/5f5ca351b0b324ef04a9c3b3e7fc72d2df0e021a/public/note-award-thin-copy.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/46797c8189e051e368ddec3717a496e4ef70773f/public/note-award-thin-copy-v112-patch.js
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
  // 実装本体は上記の固定v1.1とv1.2パッチを読み込む。
  // エントリを小さく保ち、通知カード生成の既存成功コードを変更せず
  // note.com と editor.note.com の抽出データ共有・画像導線だけを修正する。
})();