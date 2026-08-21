// ==UserScript==
// @name         無名S note 極薄カード挿入テスト（URL自動版）
// @namespace    https://note.com/ss_yr
// @version      0.1.0
// @description  note編集画面で極薄カード画像を1枚だけ挿入し、その画像に記事URLを自動設定するテスト版
// @match        https://editor.note.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CARD_IMAGE_URL = 'https://mumei-s.github.io/note-insight/note-paste-test/thin-card.png?v=hd2';
  const ARTICLE_URL = 'https://note.com/ss_yr/n/nc14eb3f2ea9f';
  const BUTTON_ID = 'mumei-thin-card-autolink-btn';

  let armed = false;
  let busy = false;
  let usedOnce = false;
  let knownImageCount = 0;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function toast(msg, isErr = false) {
    let t = document.getElementById('mumei-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'mumei-toast';
      t.style.cssText = [
        'position:fixed','left:50%','bottom:84px','transform:translateX(-50%)',
        'z-index:2147483647','padding:10px 14px','border-radius:12px',
        'font-size:13px','font-weight:700','box-shadow:0 6px 20px rgba(0,0,0,.2)',
        'max-width:88vw','line-height:1.5','word-break:break-word'
      ].join(';');
      document.body.appendChild(t);
    }
    t.style.background = isErr ? '#8b1e1e' : '#111827';
    t.style.color = '#fff';
    t.textContent = msg;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.remove(), 3500);
  }

  function ensureButton() {
    if (location.hostname !== 'editor.note.com') return;
    let btn = document.getElementById(BUTTON_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = BUTTON_ID;
      btn.type = 'button';
      btn.textContent = '極薄カード準備';
      btn.style.cssText = [
        'position:fixed','right:14px','bottom:18px','z-index:2147483646',
        'border:none','border-radius:9999px','padding:12px 16px','font-size:14px',
        'font-weight:700','background:#111827','color:#fff','box-shadow:0 8px 24px rgba(0,0,0,.24)'
      ].join(';');
      btn.addEventListener('click', () => {
        if (busy) return toast('今処理中です');
        if (usedOnce) usedOnce = false;
        armed = true;
        knownImageCount = getEditorImages().length;
        btn.textContent = '準備OK';
        btn.style.background = '#0f766e';
        toast('準備OK。次に note の「＋ → 画像」を1回だけ押してください');
      });
      document.body.appendChild(btn);
    }
  }

  function resetButton() {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;
    btn.textContent = '極薄カード準備';
    btn.style.background = '#111827';
  }

  function getEditorRoot() {
    return document.querySelector('.ProseMirror,[contenteditable="true"]');
  }

  function getEditorImages() {
    const root = getEditorRoot() || document;
    return [...root.querySelectorAll('img')];
  }

  async function fetchCardFile() {
    const r = await fetch(CARD_IMAGE_URL, { credentials: 'omit', cache: 'no-store' });
    if (!r.ok) throw new Error('画像取得失敗');
    const blob = await r.blob();
    return new File([blob], 'thin-card.png', { type: blob.type || 'image/png' });
  }

  async function interceptFileInput(input) {
    if (!armed || busy || usedOnce) return;
    busy = true;
    armed = false;
    usedOnce = true;
    try {
      toast('画像を準備中…');
      const file = await fetchCardFile();
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      resetButton();
      toast('画像を挿入中…');
      const inserted = await waitInsertedImage();
      if (!inserted) throw new Error('画像挿入を確認できませんでした');
      toast('画像を確認。URL設定中…');
      const linked = await attachLinkToImage(inserted, ARTICLE_URL);
      if (!linked) toast('画像は入ったがURL自動設定は失敗。今回は画像だけ残しています', true);
      else toast('✅ 画像挿入＋URL自動設定できました');
    } catch (e) {
      console.error(e);
      resetButton();
      toast(e.message || '処理に失敗しました', true);
    } finally {
      busy = false;
    }
  }

  async function waitInsertedImage() {
    for (let i = 0; i < 60; i++) {
      await sleep(300);
      const imgs = getEditorImages();
      if (imgs.length > knownImageCount) return imgs[imgs.length - 1];
    }
    return null;
  }

  function matchText(el, patterns) {
    const parts = [el.getAttribute('aria-label'), el.getAttribute('title'), el.textContent]
      .filter(Boolean).join(' ').toLowerCase();
    return patterns.some(p => parts.includes(p));
  }

  async function attachLinkToImage(img, url) {
    img.scrollIntoView({ block: 'center' });
    img.click();
    img.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await sleep(500);

    let linkBtn = [...document.querySelectorAll('button,[role="button"]')].find(el =>
      matchText(el, ['リンク', 'link', 'chain'])
    );
    if (!linkBtn) return false;
    linkBtn.click();
    await sleep(500);

    let urlInput = document.querySelector('input[type="url"], input[placeholder*="http"], input[placeholder*="URL"], input[placeholder*="リンク"], input[name*="url" i]');
    if (!urlInput) {
      for (let i = 0; i < 10 && !urlInput; i++) {
        await sleep(300);
        urlInput = document.querySelector('input[type="url"], input[placeholder*="http"], input[placeholder*="URL"], input[placeholder*="リンク"], input[name*="url" i]');
      }
    }
    if (!urlInput) return false;

    urlInput.focus();
    urlInput.value = '';
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    urlInput.value = url;
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    urlInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(300);

    let submitBtn = [...document.querySelectorAll('button,[role="button"]')].find(el =>
      matchText(el, ['保存', '適用', '完了', '追加', '決定', 'ok'])
    );
    if (submitBtn) submitBtn.click();
    else {
      urlInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      urlInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    }
    await sleep(700);

    const linkedAncestor = img.closest('a') || img.parentElement?.closest('a');
    if (linkedAncestor && linkedAncestor.href === url) return true;

    const stillInput = document.querySelector('input[type="url"], input[placeholder*="http"], input[placeholder*="URL"], input[placeholder*="リンク"], input[name*="url" i]');
    return !stillInput;
  }

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.type !== 'file') return;
    if (!t.accept || !t.accept.includes('image')) return;
    interceptFileInput(t);
  }, true);

  ensureButton();
  setInterval(ensureButton, 1000);
})();
