// ==UserScript==
// @name         note 巡回BOOST｜専用アプリ
// @namespace    https://github.com/mumei-s/note-insight
// @version      6.2.4
// @description  通常のnote画面には何も表示せず、専用URLの時だけ巡回BOOSTアプリとして起動。戻る・スキ・マガジン復元に加え、起動途中でnote骨組み画面に止まる症状を自動復旧。
// @match        https://note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-boost-v531.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-boost-v531.user.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/989790e81bb12c0fcbb6cde264c3bf4aa42cbb48/public/note-boost-v620-dedicated-app.js
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/4836fd8633a0a3182f12001ababa1fce53bffb28/public/note-boost-v622-runtime-fixes.js
// @grant        none
// @run-at       document-start
// ==/UserScript==
(() => {
  'use strict';
  const u = new URL(location.href);
  const dedicated = u.searchParams.get('boost_app') === '1' || u.hash === '#boost_app' || u.hash === '#boost';
  if (!dedicated) return;

  const APP_URL = 'https://note.com/?boost_app=1';
  const RECOVERY_KEY = 'noteBoostStartupRecoveryV624';
  const appReady = () => !!document.querySelector('main.app') && !!document.querySelector('#source') && !!document.querySelector('#status');
  const clearRecovery = () => { try { sessionStorage.removeItem(RECOVERY_KEY); } catch {} };
  const paintFailure = () => {
    try { window.stop(); } catch {}
    document.documentElement.innerHTML = '<head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#07131b"><title>巡回BOOST 起動診断</title></head><body style="margin:0;background:#050b10;color:#eef7ff;font-family:system-ui,-apple-system,sans-serif"><main style="max-width:680px;margin:auto;padding:28px 18px"><h1 style="font-size:24px;margin:0 0 12px">巡回BOOST</h1><div style="padding:16px;border:1px solid #2b4658;border-radius:14px;background:#0a151e"><b style="color:#8feaff">v6.2.4 起動診断</b><p style="line-height:1.7">専用画面の起動に失敗しました。noteの骨組み画面で止まらないよう自動復旧を実行しました。</p><p style="font-size:13px;color:#a9bdca">この画面が続く場合はUserscriptをv6.2.4へ更新し直してください。</p><button id="boostRetry" style="width:100%;padding:13px;border:0;border-radius:12px;background:#155e75;color:#fff;font-weight:800">巡回BOOSTを再起動</button></div></main></body>';
    document.getElementById('boostRetry')?.addEventListener('click', () => location.replace(APP_URL + '&fresh=' + Date.now()));
  };
  const recover = () => {
    if (appReady()) { clearRecovery(); return; }
    let n = 0;
    try { n = Number(sessionStorage.getItem(RECOVERY_KEY) || 0); } catch {}
    if (n < 2) {
      try { sessionStorage.setItem(RECOVERY_KEY, String(n + 1)); } catch {}
      location.replace(APP_URL + '&fresh=' + Date.now());
      return;
    }
    clearRecovery();
    paintFailure();
  };

  // @require側が起動済みフラグだけ立てて画面置換に失敗しても、必ず復旧する。
  setTimeout(recover, 900);
  addEventListener('pageshow', () => setTimeout(recover, 250));
})();