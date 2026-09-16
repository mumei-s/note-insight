// ==UserScript==
// @name         note 巡回BOOST｜専用アプリ
// @namespace    https://github.com/mumei-s/note-insight
// @version      6.2.2
// @description  通常のnote画面には何も表示せず、専用URLの時だけ巡回BOOSTアプリとして起動。戻る・スキ・マガジンサムネイルを修正。
// @match        https://note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-boost-v531.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-boost-v531.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/989790e81bb12c0fcbb6cde264c3bf4aa42cbb48/public/note-boost-v620-dedicated-app.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/57d36f000a082ab40f6f1486f25e16a155c84134/public/note-boost-v622-runtime-fixes.js
// @grant        none
// @run-at       document-start
// ==/UserScript==
(() => {
  'use strict';
  const u = new URL(location.href);
  const dedicated = u.searchParams.get('boost_app') === '1' || u.hash === '#boost_app' || u.hash === '#boost';
  if (!dedicated) return;
  if (window.__NOTE_BOOST_V620_APP__) return;
  try { window.stop(); } catch {}
  const paint = () => {
    if (window.__NOTE_BOOST_V620_APP__) return;
    document.documentElement.innerHTML = '<head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#07131b"><title>巡回BOOST 起動診断</title></head><body style="margin:0;background:#050b10;color:#eef7ff;font-family:system-ui,-apple-system,sans-serif"><main style="max-width:680px;margin:auto;padding:28px 18px"><h1 style="font-size:24px;margin:0 0 12px">巡回BOOST</h1><div style="padding:16px;border:1px solid #2b4658;border-radius:14px;background:#0a151e"><b style="color:#8feaff">v6.2.2 起動診断</b><p style="line-height:1.7">Tampermonkey本体はこの専用URLで動作しています。ただし専用アプリ本体の読み込みに失敗しています。</p><p style="font-size:13px;color:#a9bdca">通常のnoteトップは表示しません。再読み込みしてもこの画面なら、Userscriptを更新し直してください。</p></div></main></body>';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint, {once:true}); else paint();
})();