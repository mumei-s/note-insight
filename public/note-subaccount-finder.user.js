// ==UserScript==
// @name         note 巡回BOOST｜タグ検索・スキ・マガジン v4.9
// @namespace    https://github.com/mumei-s/note-insight
// @version      4.9.0
// @description  v4.8.1の途中進捗・複数マガジン・403個別スキップ・200件/日・起動時新着読込を維持し、自動再開ON時は未完了ジョブをボタン操作なしで自動継続。
// @match        https://note.com/*
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/77843a09e9bc671716af5fa0ac0448ef095eabdc/public/note-subaccount-finder.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/47874424d2f601f0c9c526d36c7c480860f9ce06/public/note-subaccount-finder-v44-patch.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/897cd77f69a5fc1524236b30c41ef20917b6a347/public/note-subaccount-finder-v45-drag.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/f2fd0aed0b5070ec356226240a71b4583f780e24/public/note-subaccount-finder-v46-magbatch.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/3bf5fb1ab11e60c2492d7433ead22cd7dc22812f/public/note-subaccount-finder-v47-autoresume.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/6ebedeef4659048a5431845aef13f3ba21e9c7eb/public/note-subaccount-finder-v48-multimag.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/576318e5788ef21df90afe820052136b694a21f8/public/note-subaccount-finder-v49-autostart.js
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
