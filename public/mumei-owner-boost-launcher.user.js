// ==UserScript==
// @name         無名S OWNER｜巡回BOOST専用起動ボタン
// @namespace    urn:mumei-s:owner-only:boost-launcher
// @version      1.0.1
// @description  noteにログインした本人にだけ巡回BOOSTの独立した起動ボタンを表示。本人通知やINSIGHTに干渉しません。
// @match        https://note.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/mumei-owner-boost-launcher.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/mumei-owner-boost-launcher.user.js
// ==/UserScript==
(() => {
  'use strict';
  const OWNER_ID = 'ss_yr';
  const BOOST_URL = 'https://note.com/?boost_app=1';
  const BUTTON_ID = 'mumei-owner-boost-launcher-v1';
  const STYLE_ID = 'mumei-owner-boost-launcher-style-v1';
  const OWNER_CHECK_INTERVAL = 60000;
  let ownerConfirmed = false, lastCheck = 0, checking = false;
  function inBoostApp() {
    const url = new URL(location.href);
    return url.searchParams.get('boost_app') === '1' ||
      ['#boost', '#boost_app'].includes(url.hash);
  }
  function removeButton() { document.getElementById(BUTTON_ID)?.remove(); }
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = `
      #${BUTTON_ID} {
        all: initial;
        position: fixed !important;
        z-index: 2147482900 !important;
        right: 12px !important;
        top: calc(env(safe-area-inset-top, 0px) + 78px) !important;
        box-sizing: border-box !important;
        border-radius: 999px !important;
        border: 1px solid #d7b775 !important;
        padding: 10px 13px !important;
        min-height: 42px !important;
        max-width: min(55vw, 190px) !important;
        background: linear-gradient(135deg, #182936, #65431a) !important;
        box-shadow: 0 6px 18px #0007 !important;
        color: #fff2d9 !important;
        font: 800 12px/1.3 system-ui, sans-serif !important;
        letter-spacing: .02em !important;
        text-align: center !important;
        cursor: pointer !important;
        touch-action: manipulation !important;
      }
      #${BUTTON_ID}:focus-visible {outline: 3px solid #ffe3a2 !important; outline-offset: 3px !important;}
      @media (max-width: 450px) {
        #${BUTTON_ID} { top: calc(env(safe-area-inset-top, 0px) + 70px) !important; }
      }
    `;
    (document.head || document.documentElement)?.appendChild(el);
  }
  function mount() {
    if (!ownerConfirmed || inBoostApp() || !document.body) {
      removeButton();
      return;
    }
    if (document.getElementById(BUTTON_ID)) return;
    ensureStyle();
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.setAttribute('aria-label', 'OWNER専用 巡回BOOSTを開く');
    btn.textContent = '✦ 巡回BOOST';
    btn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (ownerConfirmed) location.assign(BOOST_URL);
    });
    document.body.appendChild(btn);
  }
  async function verifyOwner(force = false) {
    if (checking) return;
    if (!force && Date.now() - lastCheck < OWNER_CHECK_INTERVAL) { mount(); return; }
    checking = true;
    lastCheck = Date.now();
    try {
      const response = await fetch('/api/v2/current_user', {
        credentials: 'include', cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('Not authenticated');
      const json = await response.json();
      const data = json?.data ?? json ?? {};
      const user = data.user ?? data;
      const id = String(user?.urlname ?? user?.url_name ?? user?.username ?? '')
        .replace(/^@/, '').toLowerCase();
      ownerConfirmed = id === OWNER_ID;
    } catch (_) {
      ownerConfirmed = false;
    } finally {
      checking = false;
      mount();
    }
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => void verifyOwner(true), { once: true });
  else void verifyOwner(true);
  addEventListener('pageshow', () => void verifyOwner(true));
  addEventListener('focus', () => void verifyOwner(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void verifyOwner(true);
  });
  setInterval(() => {
    if (Date.now() - lastCheck >= OWNER_CHECK_INTERVAL) void verifyOwner(true);
    else mount();
  }, 5000);
})();
