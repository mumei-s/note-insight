// ==UserScript==
// @name         note 巡回BOOST｜URL・#・マガジン v5.2.2
// @namespace    https://github.com/mumei-s/note-insight
// @version      5.2.2
// @description  URLまたは#から巡回。記事URLはスキした人から巡回、マガジンURLは追加先。既存スキを解除・二重送信せず、最初から/今回/完了を記録。24時間上限＋403/429適応リミッター、途中位置を保持して同じ人から再開。
// @match        https://note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-subaccount-finder.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-subaccount-finder.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-subaccount-finder-v52-preflight.js?v=5.2.2
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/77843a09e9bc671716af5fa0ac0448ef095eabdc/public/note-subaccount-finder.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/47874424d2f601f0c9c526d36c7c480860f9ce06/public/note-subaccount-finder-v44-patch.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/897cd77f69a5fc1524236b30c41ef20917b6a347/public/note-subaccount-finder-v45-drag.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/f2fd0aed0b5070ec356226240a71b4583f780e24/public/note-subaccount-finder-v46-magbatch.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/6ebedeef4659048a5431845aef13f3ba21e9c7eb/public/note-subaccount-finder-v48-multimag.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/1c6d7d91425da7ef00fe6355f1eadbc17f8bf5cd/public/note-subaccount-finder-v51-limitonly.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-subaccount-finder-v52-compact.js?v=5.2.2
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-subaccount-finder-v52-fix1.js?v=5.2.2
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-subaccount-finder-v521-like-state.js?v=5.2.2
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
