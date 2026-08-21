// ==UserScript==
// @name         無名S note 極薄カード挿入テスト
// @namespace    https://github.com/mumei-s/note-insight
// @version      0.5.0
// @description  note編集画面へ極薄カード画像を直接挿入する1枚テスト（画像挿入のみ）
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CARD_IMAGE = 'https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-paste-test/thin-card.png';
  const BUTTON_ID = 'mumei-thin-card-inserter-test';
  const PANEL_ID = 'mumei-thin-card-panel-test';

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function getEditor() {
    return document.querySelector('.ProseMirror');
  }

  function setStatus(text, bad = false) {
    const el = document.getElementById(PANEL_ID);
    if (!el) return;
    el.textContent = text;
    el.style.background = bad ? '#7f1d1d' : '#111827';
  }

  function requestBlob(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'blob',
        timeout: 20000,
        onload: res => {
          if (res.status >= 200 && res.status < 300 && res.response) resolve(res.response);
          else reject(new Error('画像取得失敗 HTTP ' + res.status));
        },
        onerror: () => reject(new Error('画像取得に失敗')),
        ontimeout: () => reject(new Error('画像取得がタイムアウト'))
      });
    });
  }

  async function waitForNewImage(editor, before, timeout = 20000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const imgs = [...editor.querySelectorAll('img')];
      const added = imgs.find(img => !before.has(img));
      if (added) return added;
      await sleep(250);
    }
    return null;
  }

  async function insertCard() {
    const btn = document.getElementById(BUTTON_ID);
    if (btn) btn.disabled = true;

    try {
      const editor = getEditor();
      if (!editor) throw new Error('本文エディタが見つかりません');

      editor.focus();
      setStatus('1/2 画像を取得中…');
      const blob = await requestBlob(CARD_IMAGE);

      setStatus('2/2 note本文へ貼り付け中…');
      const before = new Set(editor.querySelectorAll('img'));
      const file = new File([blob], 'mumei-thin-card.png', { type: blob.type || 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);

      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt
      });
      editor.dispatchEvent(pasteEvent);

      const img = await waitForNewImage(editor, before);
      if (!img) throw new Error('画像挿入を確認できませんでした');

      img.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setStatus('✅ 画像挿入できました。今回はリンク設定はまだしていません');
    } catch (e) {
      setStatus('⚠️ ' + (e?.message || String(e)), true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function makePanel() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.textContent = '本文を1回タップ → 極薄カード挿入';
    Object.assign(panel.style, {
      position: 'fixed', right: '12px', bottom: '74px', zIndex: '2147483646',
      maxWidth: '290px', padding: '9px 11px', borderRadius: '10px',
      background: '#111827', color: '#fff', fontSize: '12px', lineHeight: '1.45',
      boxShadow: '0 4px 18px rgba(0,0,0,.25)', pointerEvents: 'none'
    });
    return panel;
  }

  function makeButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.textContent = '極薄カード挿入';
    Object.assign(btn.style, {
      position: 'fixed', right: '12px', bottom: '16px', zIndex: '2147483647',
      border: '0', borderRadius: '12px', padding: '14px 18px',
      background: '#111', color: '#fff', fontSize: '16px', fontWeight: '800',
      boxShadow: '0 5px 20px rgba(0,0,0,.30)', touchAction: 'manipulation'
    });
    btn.addEventListener('click', insertCard);
    return btn;
  }

  function ensureMounted() {
    if (!document.body) return;
    if (!document.getElementById(PANEL_ID)) document.body.appendChild(makePanel());
    if (!document.getElementById(BUTTON_ID)) document.body.appendChild(makeButton());
  }

  ensureMounted();
  setInterval(ensureMounted, 1000);
  window.addEventListener('popstate', () => setTimeout(ensureMounted, 100));
  window.addEventListener('pageshow', () => setTimeout(ensureMounted, 100));
})();
