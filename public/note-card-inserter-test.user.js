// ==UserScript==
// @name         無名S note 極薄カード挿入テスト
// @namespace    https://github.com/mumei-s/note-insight
// @version      0.6.0
// @description  note自身の画像アップロード入力へ極薄カードを直接渡す1枚テスト
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const CARD_IMAGE = 'https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-paste-test/thin-card.png';
  const BUTTON_ID = 'mumei-thin-card-inserter-test';
  const PANEL_ID = 'mumei-thin-card-panel-test';

  let armed = false;
  let preparedFile = null;
  let beforeFileInputs = new Set();
  let beforeEditorImages = new Set();
  let disarmTimer = null;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function getEditor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') ||
           document.querySelector('.ProseMirror');
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

  function isImageFileInput(input) {
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return false;
    const accept = (input.accept || '').toLowerCase();
    return !accept || accept.includes('image') || accept.includes('.png') || accept.includes('.jpg') || accept.includes('.jpeg');
  }

  function disarm(message, bad = false) {
    armed = false;
    preparedFile = null;
    beforeFileInputs = new Set();
    if (disarmTimer) clearTimeout(disarmTimer);
    disarmTimer = null;
    if (message) setStatus(message, bad);
  }

  async function verifyBodyImage() {
    const editor = getEditor();
    if (!editor) return false;
    const end = Date.now() + 15000;
    while (Date.now() < end) {
      const imgs = [...editor.querySelectorAll('img')];
      const added = imgs.find(img => !beforeEditorImages.has(img));
      if (added) return true;
      await sleep(300);
    }
    return false;
  }

  function injectIntoFileInput(input) {
    if (!armed || !preparedFile || !isImageFileInput(input)) return false;
    // 既に存在していた別用途のfile inputは触らない。
    if (beforeFileInputs.has(input)) return false;

    try {
      const dt = new DataTransfer();
      dt.items.add(preparedFile);
      input.files = dt.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      setStatus('noteへ画像ファイルを渡しました。アップロード確認中…');

      setTimeout(async () => {
        const ok = await verifyBodyImage();
        if (ok) disarm('✅ 極薄カード画像を本文へ挿入できました');
        else disarm('⚠️ noteの画像入力には渡せましたが、本文への表示を確認できませんでした', true);
      }, 300);
      return true;
    } catch (e) {
      setStatus('⚠️ ファイル注入失敗: ' + (e?.message || String(e)), true);
      return false;
    }
  }

  // noteが動的に作る file input を捕まえる。
  const observer = new MutationObserver(mutations => {
    if (!armed) return;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (isImageFileInput(node) && injectIntoFileInput(node)) return;
        const inputs = node.querySelectorAll ? node.querySelectorAll('input[type="file"]') : [];
        for (const input of inputs) {
          if (isImageFileInput(input) && injectIntoFileInput(input)) return;
        }
      }
    }
  });

  function startObserver() {
    if (!document.documentElement) return setTimeout(startObserver, 50);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  startObserver();

  // noteが input.click() でOSファイル選択を開く場合も横取りする。
  const nativeInputClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function (...args) {
    if (armed && isImageFileInput(this) && !beforeFileInputs.has(this)) {
      if (injectIntoFileInput(this)) return;
    }
    return nativeInputClick.apply(this, args);
  };

  async function armNativeUpload() {
    const btn = document.getElementById(BUTTON_ID);
    if (btn) btn.disabled = true;
    try {
      const editor = getEditor();
      if (!editor) throw new Error('note本文欄が見つかりません');

      setStatus('極薄カードを準備中…');
      const blob = await requestBlob(CARD_IMAGE);
      preparedFile = new File([blob], 'mumei-thin-card.png', { type: 'image/png' });

      beforeFileInputs = new Set(document.querySelectorAll('input[type="file"]'));
      beforeEditorImages = new Set(editor.querySelectorAll('img'));
      armed = true;

      setStatus('準備OK。本文の入れたい行をタップ → noteの「＋」→「画像」を押してください');
      disarmTimer = setTimeout(() => {
        if (armed) disarm('時間切れ。もう一度「極薄カード準備」を押してください', true);
      }, 45000);
    } catch (e) {
      disarm('⚠️ ' + (e?.message || String(e)), true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function makePanel() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.textContent = '本文をタップしてから「極薄カード準備」';
    Object.assign(panel.style, {
      position: 'fixed', right: '12px', bottom: '74px', zIndex: '2147483646',
      maxWidth: '310px', padding: '9px 11px', borderRadius: '10px',
      background: '#111827', color: '#fff', fontSize: '12px', lineHeight: '1.45',
      boxShadow: '0 4px 18px rgba(0,0,0,.25)', pointerEvents: 'none'
    });
    return panel;
  }

  function makeButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.textContent = '極薄カード準備';
    Object.assign(btn.style, {
      position: 'fixed', right: '12px', bottom: '16px', zIndex: '2147483647',
      border: '0', borderRadius: '12px', padding: '14px 18px',
      background: '#111', color: '#fff', fontSize: '16px', fontWeight: '800',
      boxShadow: '0 5px 20px rgba(0,0,0,.30)', touchAction: 'manipulation'
    });
    btn.addEventListener('click', armNativeUpload);
    return btn;
  }

  function ensureMounted() {
    if (!document.body) return;
    if (!document.getElementById(PANEL_ID)) document.body.appendChild(makePanel());
    if (!document.getElementById(BUTTON_ID)) document.body.appendChild(makeButton());
  }

  function mountLoop() {
    ensureMounted();
    setTimeout(mountLoop, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureMounted, { once: true });
  } else {
    ensureMounted();
  }
  mountLoop();
})();
