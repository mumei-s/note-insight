// ==UserScript==
// @name         note 巡回BOOST｜独立版 v5.4.0
// @namespace    https://github.com/mumei-s/note-insight
// @version      5.4.0
// @description  記事URL・マガジンURL・#から巡回。#巡回は検索結果を直接キュー化せず、実タグ完全一致を確認した記事だけで巡回キューを再構築。個別記事ではUI非表示、周期再描画なし。
// @match        https://note.com/*
// @exclude      https://note.com/*/n/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-boost-v531.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-boost-v531.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/526f236fd162ee73ce921d0a7294883a30de8c1a/public/note-boost-v537-prelude.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/cc5c24cd87d3e4ebb9e909c4df505dd75b8b4047/public/note-boost-v540-tag-owner.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/cc2afdc13d387301c2275907c87d2273331aba4a/public/note-boost-v531.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/48bf3abee32d40677a189da35d64d2b4b896650f/public/note-boost-v533-patch.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/fb232f7d612c23ef151c90e34f6e0b5619f54320/public/note-boost-v535-patch.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/2c4f54bf6756302fefe4faceb1a491143df5a32a/public/note-boost-v536-clarity.js
// @grant        none
// @run-at       document-start
// ==/UserScript==
(() => {
  'use strict';
  // v5.4.0: #巡回をstrict ownerへ切替。旧誤キューを再利用しない。
})();
