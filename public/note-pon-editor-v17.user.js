// ==UserScript==
// @name         note ポン出し v17｜共同マガジン本文＋一覧完成版
// @namespace    https://github.com/mumei-s/note-insight
// @version      17.0.0
// @description  v16の共同マガジン一覧に、記事本文の導入文を自動追加。見出し・区切り線・note標準カード・手動削除対応。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @connect      raw.githubusercontent.com
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v14.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v16.user.js
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v17.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v17.user.js
// ==/UserScript==
(() => {
  'use strict';
  if (window.__MUMEI_PON_V17_ADDON__) return;
  window.__MUMEI_PON_V17_ADDON__ = true;

  const INTRO = `共同マガジンが増えすぎて、自分でも投稿上限が分からなくなってきたので一覧にしました🤣

今参加している共同マガジンと、自分で運営している共同マガジンを、1日の投稿上限が多い順に並べています。

数字に幅がある場合は上限側に入れています。固定記事とマガジン紹介欄で数字が違う場合は両方に掲載しています。

有料記事を追加できないものだけ「有料記事追加不可」と表記しています。

では一覧👇`;

  let armed = false;
  let resetTimer = null;

  function install() {
    const root = document.getElementById('__mumei_pon_v14_root__');
    const button = document.getElementById('ponMags16');
    if (!root || !button) return setTimeout(install, 300);

    const src = root.querySelector('#ponSrc14');
    const add = root.querySelector('#ponAdd14');
    const head = root.querySelector('#ponDrag14 b');
    if (!src || !add) return setTimeout(install, 300);

    if (head) head.textContent = '↔️ ポン出し v17';
    button.textContent = '📚 本文＋共マガ一覧＋全カード';

    button.addEventListener('click', () => {
      armed = true;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { armed = false; }, 180000);
    }, true);

    add.addEventListener('click', () => {
      if (!armed) return;
      armed = false;
      clearTimeout(resetTimer);
      const body = String(src.value || '').trim();
      if (!body) return;
      if (!body.startsWith('共同マガジンが増えすぎて')) {
        src.value = INTRO + '\n\n' + body;
      }
    }, true);
  }

  install();
})();
