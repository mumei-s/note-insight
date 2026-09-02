// ==UserScript==
// @name         note 巡回BOOST｜タグ検索・スキ・マガジン v5.0
// @namespace    https://github.com/mumei-s/note-insight
// @version      5.0.0
// @description  v4.8の途中進捗・複数マガジン・200件/日を維持し、通常ページの周期通信を撤去。403即停止＋2時間冷却、低頻度API、ボタン不要の安全自動再開へ変更。
// @match        https://note.com/*
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/77843a09e9bc671716af5fa0ac0448ef095eabdc/public/note-subaccount-finder.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/47874424d2f601f0c9c526d36c7c480860f9ce06/public/note-subaccount-finder-v44-patch.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/897cd77f69a5fc1524236b30c41ef20917b6a347/public/note-subaccount-finder-v45-drag.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/f2fd0aed0b5070ec356226240a71b4583f780e24/public/note-subaccount-finder-v46-magbatch.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/6ebedeef4659048a5431845aef13f3ba21e9c7eb/public/note-subaccount-finder-v48-multimag.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/5171b5ad93a356b2111fe55bfe35d214d3332700/public/note-subaccount-finder-v50-safe.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
  'use strict';
  const normalize = () => {
    const body = document.getElementById('nb-v46-body');
    if (!body) return false;
    if (!body.style.display) body.style.display = 'none';
    return true;
  };
  if (!normalize()) {
    const mo = new MutationObserver(() => {
      if (normalize()) mo.disconnect();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 20000);
  }
})();
