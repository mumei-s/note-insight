// ==UserScript==
// @name         note ポン出し v17.1｜共マガURL＋カード完成版
// @namespace    https://github.com/mumei-s/note-insight
// @version      17.1.0
// @description  共同マガジン一覧を本数順で作成し、マガジンURLと固定記事URLを文字で残しつつ、それぞれnote標準カードも自動生成。カードは後から手動削除可能。
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
  if (window.__MUMEI_PON_V171_ADDON__) return;
  window.__MUMEI_PON_V171_ADDON__ = true;

  function stripOldIntro(text) {
    const s = String(text || '');
    if (!s.startsWith('共同マガジンが増えすぎて')) return s;
    const marker = 'では一覧👇';
    const p = s.indexOf(marker);
    if (p < 0) return s;
    return s.slice(p + marker.length).replace(/^\s+/, '');
  }

  function addVisibleUrls(text) {
    const lines = stripOldIntro(text).split(/\r?\n/);
    const out = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (/^https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+$/i.test(line)) {
        const prev = out.length ? out[out.length - 1].trim() : '';
        if (prev !== `マガジンURL：${line}`) out.push(`マガジンURL：${line}`);
        out.push(line); // 裸URLはv14がnote標準カードへ変換
        continue;
      }
      if (/^https:\/\/note\.com\/[^/]+\/n\/n[a-z0-9]+$/i.test(line)) {
        const prev = out.length ? out[out.length - 1].trim() : '';
        if (prev !== `固定記事URL：${line}`) out.push(`固定記事URL：${line}`);
        out.push(line); // 裸URLはv14がnote標準カードへ変換
        continue;
      }
      out.push(lines[i]);
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function install() {
    const root = document.getElementById('__mumei_pon_v14_root__');
    const button = document.getElementById('ponMags16');
    if (!root || !button) return setTimeout(install, 300);

    const src = root.querySelector('#ponSrc14');
    const add = root.querySelector('#ponAdd14');
    const head = root.querySelector('#ponDrag14 b');
    if (!src || !add) return setTimeout(install, 300);

    if (head) head.textContent = '↔️ ポン出し v17.1';
    button.textContent = '📚 一覧＋URL＋全カード';

    // v14本体が本文へ入れる直前に、表示用URLを追加する。
    // 裸URLは残すため、v14がマガジン・固定記事ともnote標準カード化する。
    add.addEventListener('click', () => {
      if (!/#\s/.test(src.value) || !/https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+/i.test(src.value)) return;
      src.value = addVisibleUrls(src.value);
    }, true);
  }

  install();
})();
