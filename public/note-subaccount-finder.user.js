// ==UserScript==
// @name         note 巡回BOOST｜タグ検索・スキ・マガジン v4.8
// @namespace    https://github.com/mumei-s/note-insight
// @version      4.8.0
// @description  v4.7の途中進捗・200件/日・自動再開・起動時新着読込を維持し、403個別スキップと複数マガジン選択を追加。
// @match        https://note.com/*
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/77843a09e9bc671716af5fa0ac0448ef095eabdc/public/note-subaccount-finder.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/47874424d2f601f0c9c526d36c7c480860f9ce06/public/note-subaccount-finder-v44-patch.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/897cd77f69a5fc1524236b30c41ef20917b6a347/public/note-subaccount-finder-v45-drag.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/f2fd0aed0b5070ec356226240a71b4583f780e24/public/note-subaccount-finder-v46-magbatch.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/3bf5fb1ab11e60c2492d7433ead22cd7dc22812f/public/note-subaccount-finder-v47-autoresume.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/de10d568884f4e15448f8cda7534a7c432e99fb3/public/note-subaccount-finder-v48-multimag.js
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
