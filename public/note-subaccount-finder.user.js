// ==UserScript==
// @name         note 巡回BOOST｜タグ検索・スキ・マガジン v4.6.1
// @namespace    https://github.com/mumei-s/note-insight
// @version      4.6.1
// @description  v4.5の巡回・アカウント切替・反応履歴・長押し移動を維持し、現在の検索結果を保有マガジンへ安全値連動で一括整理。初回開閉も安定化。
// @match        https://note.com/*
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/77843a09e9bc671716af5fa0ac0448ef095eabdc/public/note-subaccount-finder.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/47874424d2f601f0c9c526d36c7c480860f9ce06/public/note-subaccount-finder-v44-patch.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/897cd77f69a5fc1524236b30c41ef20917b6a347/public/note-subaccount-finder-v45-drag.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/f2fd0aed0b5070ec356226240a71b4583f780e24/public/note-subaccount-finder-v46-magbatch.js
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
