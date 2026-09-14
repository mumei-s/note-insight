// ==UserScript==
// @name         note 巡回BOOST｜URL・#・マガジン v5.3
// @namespace    https://github.com/mumei-s/note-insight
// @version      5.3.0
// @description  記事URL・マガジンURL・#をすべて巡回元として扱い、クリエイターカードから自分の編集可能な全マガジンへnote公式風に追加。既存スキを解除・二重送信せず、最初から/今回/完了を記録。24時間上限＋403/429適応リミッター。
// @match        https://note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-subaccount-finder.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-subaccount-finder.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/77843a09e9bc671716af5fa0ac0448ef095eabdc/public/note-subaccount-finder.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/47874424d2f601f0c9c526d36c7c480860f9ce06/public/note-subaccount-finder-v44-patch.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/897cd77f69a5fc1524236b30c41ef20917b6a347/public/note-subaccount-finder-v45-drag.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-subaccount-finder-v53-source-magpicker.js?v=5.3.0
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-subaccount-finder-v521-like-state.js?v=5.3.0
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
  'use strict';
  // v5.3では旧v46/v48/v51/v52の一括追加ランナーを読み込まない。
  // 巡回元は記事URL/マガジンURL/#、マガジン追加は各カードから実行する。
})();
