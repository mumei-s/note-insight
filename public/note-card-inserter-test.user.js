// ==UserScript==
// @name         無名S note 極薄カード挿入テスト
// @namespace    https://github.com/mumei-s/note-insight
// @version      0.1.0
// @description  note編集画面へ極薄カード画像を直接挿入し、元記事リンク設定まで試す1枚テスト
// @match        https://note.com/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CARD_IMAGE = 'https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-paste-test/thin-card.png';
  const ARTICLE_URL = 'https://note.com/ss_yr/n/nc14eb3f2ea9f';
  const BUTTON_ID = 'mumei-thin-card-inserter-test';
  const PANEL_ID = 'mumei-thin-card-panel-test';

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function getEditor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') ||
           document.querySelector('.ProseMirror') ||
           document.querySelector('[contenteditable="true"][role="textbox"]') ||
           document.querySelector('[contenteditable="true"]');
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

  function selectionPoint(editor) {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) {
          const r = range.getBoundingClientRect();
          if (r && Number.isFinite(r.left) && Number.isFinite(r.top) && (r.width || r.height)) {
            return { x: r.left + Math.max(2, r.width / 2), y: r.top + Math.max(2, r.height / 2) };
          }
        }
      }
    } catch (_) {}
    const r = editor.getBoundingClientRect();
    return { x: r.left + Math.min(30, Math.max(10, r.width / 4)), y: r.top + Math.min(30, Math.max(10, r.height / 8)) };
  }

  async function waitForNewImage(editor, before, timeout = 12000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const imgs = [...editor.querySelectorAll('img')];
      const added = imgs.find(img => !before.has(img));
      if (added && visible(added)) return added;
      await sleep(250);
    }
    return null;
  }

  function labelOf(el) {
    return [
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.getAttribute('data-tooltip'),
      el.getAttribute('data-testid'),
      el.textContent
    ].filter(Boolean).join(' ').trim();
  }

  async function trySetImageLink(img) {
    const beforeVisibleButtons = new Set(
      [...document.querySelectorAll('button,[role="button"]')].filter(el => visible(el))
    );
    const beforeVisibleInputs = new Set(
      [...document.querySelectorAll('input')].filter(el => visible(el))
    );

    img.scrollIntoView({ block: 'center', behavior: 'instant' });
    img.click();
    img.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    img.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    await sleep(700);

    const allButtons = [...document.querySelectorAll('button,[role="button"]')]
      .filter(el => visible(el) && !el.closest('#' + BUTTON_ID) && !el.closest('#' + PANEL_ID));

    let linkButton = allButtons.find(el => /(^|\s)(リンク|link|url)(\s|$)|リンクを|link to/i.test(labelOf(el)));

    if (!linkButton) {
      const newButtons = allButtons.filter(el => !beforeVisibleButtons.has(el));
      const imgRect = img.getBoundingClientRect();
      const nearby = newButtons.filter(el => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const ix = imgRect.left + imgRect.width / 2;
        const iy = imgRect.top + imgRect.height / 2;
        return Math.abs(cx - ix) < Math.max(380, imgRect.width) && Math.abs(cy - iy) < 260;
      });
      if (nearby.length >= 1 && nearby.length <= 8) {
        nearby.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        linkButton = nearby[0]; // note公式では画像ツールバーのリンクは一番左
      }
    }

    if (!linkButton) return { ok: false, reason: '画像ツールバーのリンクボタンを特定できませんでした' };

    linkButton.click();
    await sleep(500);

    const inputs = [...document.querySelectorAll('input')].filter(el => visible(el));
    let input = inputs.find(el => /url|リンク|link/i.test([
      el.type,
      el.placeholder,
      el.getAttribute('aria-label'),
      el.name
    ].filter(Boolean).join(' ')));
    if (!input) input = inputs.find(el => !beforeVisibleInputs.has(el));
    if (!input) return { ok: false, reason: 'URL入力欄を特定できませんでした' };

    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, ARTICLE_URL);
    else input.value = ARTICLE_URL;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(150);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    await sleep(500);

    const okButton = [...document.querySelectorAll('button,[role="button"]')]
      .filter(el => visible(el))
      .find(el => /^(OK|設定|適用|保存)$/i.test((el.textContent || '').trim()));
    if (okButton) okButton.click();

    await sleep(700);
    const linked = img.closest('a[href]');
    if (linked && linked.href.includes('note.com/ss_yr/n/nc14eb3f2ea9f')) return { ok: true, verified: true };
    if (document.documentElement.innerHTML.includes(ARTICLE_URL)) return { ok: true, verified: false };
    return { ok: true, verified: false };
  }

  async function insertCard() {
    const btn = document.getElementById(BUTTON_ID);
    if (btn) btn.disabled = true;
    try {
      const editor = getEditor();
      if (!editor) throw new Error('note本文エディタが見つかりません。編集画面を開いてください');

      setStatus('1/3 画像を取得中…');
      const blob = await requestBlob(CARD_IMAGE);

      setStatus('2/3 note本文へ挿入中…');
      const before = new Set(editor.querySelectorAll('img'));
      const file = new File([blob], 'mumei-thin-card.png', { type: blob.type || 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const p = selectionPoint(editor);
      const ev = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        clientX: p.x,
        clientY: p.y,
        dataTransfer: dt
      });
      editor.dispatchEvent(ev);

      const img = await waitForNewImage(editor, before);
      if (!img) throw new Error('画像挿入を確認できませんでした');

      setStatus('3/3 元記事リンクを設定中…');
      const linked = await trySetImageLink(img);
      if (linked.ok) {
        setStatus(linked.verified ? '✅ 画像挿入＋リンク設定まで確認できました' : '✅ 画像挿入＋リンク設定処理まで完了。画像を1回タップしてリンクだけ確認してください');
      } else {
        setStatus('⚠️ 画像は挿入できました。' + linked.reason, true);
      }
    } catch (e) {
      setStatus('⚠️ ' + (e?.message || String(e)), true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function mount() {
    if (document.getElementById(BUTTON_ID)) return;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.textContent = 'note編集画面で本文の入れたい位置をタップしてから実行';
    Object.assign(panel.style, {
      position: 'fixed', right: '12px', bottom: '74px', zIndex: '2147483646',
      maxWidth: '290px', padding: '9px 11px', borderRadius: '10px',
      background: '#111827', color: '#fff', fontSize: '12px', lineHeight: '1.45',
      boxShadow: '0 4px 18px rgba(0,0,0,.25)'
    });

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

    document.body.append(panel, btn);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
