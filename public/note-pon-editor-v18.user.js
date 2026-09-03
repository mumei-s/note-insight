// ==UserScript==
// @name         note ポン出し v18｜本数別＋全カード＋収納確実版
// @namespace    https://github.com/mumei-s/note-insight
// @version      18.0.0
// @description  共同マガジンを投稿上限本数別に整理し、マガジンURL/カードとオーナー本人固定記事URL/カードを生成。収納ボタンは旧処理を除去して確実に収納。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @connect      raw.githubusercontent.com
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v14.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v16.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v17.user.js
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v18.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v18.user.js
// ==/UserScript==

(() => {
  'use strict';
  if (window.__MUMEI_PON_V18__) return;
  window.__MUMEI_PON_V18__ = true;

  function patch() {
    const root = document.getElementById('__mumei_pon_v14_root__');
    const panel = root?.querySelector('#ponPanel14');
    const fab = root?.querySelector('#ponFab14');
    const head = root?.querySelector('#ponDrag14 b');
    const button = document.getElementById('ponMags16');
    const oldMin = root?.querySelector('#ponMin14');
    const oldClose = root?.querySelector('#ponClose14');
    if (!root || !panel || !fab || !oldMin || !oldClose) return setTimeout(patch, 250);

    if (head) head.textContent = '↔️ ポン出し v18';
    if (button) button.textContent = '📚 本数別一覧＋全マガジン/固定カード';

    // 旧v14のクリックリスナーごと除去するためボタンをcloneで置換。
    const min = oldMin.cloneNode(true);
    const close = oldClose.cloneNode(true);
    oldMin.replaceWith(min);
    oldClose.replaceWith(close);

    min.textContent = '＿';
    min.title = 'しまう';
    close.textContent = '▼';
    close.title = 'しまう';

    const stow = e => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      panel.style.setProperty('display', 'none', 'important');
      fab.style.setProperty('display', 'block', 'important');
    };
    min.addEventListener('click', stow);
    close.addEventListener('click', stow);

    // 小さい📄ポンは必ず再表示。
    fab.addEventListener('click', () => {
      panel.style.setProperty('display', 'block', 'important');
      fab.style.setProperty('display', 'none', 'important');
    }, true);

    // 念のため収納状態を壊す旧処理を監視しない。v14の自動収納はそのまま利用。
  }

  patch();
})();
