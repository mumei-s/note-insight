// ==UserScript==
// @name         無名S note 極薄カード挿入テスト
// @namespace    https://github.com/mumei-s/note-insight
// @version      0.2.0
// @description  note編集画面へ極薄カード画像を直接挿入し、その画像だけを元記事URLへリンクする1枚テスト
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

  function exactLinkedImage(img) {
    const a = img.closest('a[href]');
    if (!a) return false;
    try {
      return new URL(a.href, location.href).href === new URL(ARTICLE_URL).href;
    } catch (_) {
      return false;
    }
  }

  async function setExactImageLink(img, editor) {
    // Never guess toolbar buttons. Only operate on the image inserted by this run.
    img.scrollIntoView({ block: 'center', behavior: 'instant' });
    await sleep(250);

    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNode(img);
    sel.removeAllRanges();
    sel.addRange(range);

    let commandWorked = false;
    try {
      commandWorked = document.execCommand('createLink', false, ARTICLE_URL);
    } catch (_) {}
    await sleep(700);

    if (exactLinkedImage(img)) return { ok: true, method: 'createLink' };

    // Some ProseMirror builds normalize the DOM after execCommand. Try one scoped DOM mutation
    // and immediately verify. If the editor rejects it, remove it and report failure.
    let wrapper = null;
    try {
      wrapper = document.createElement('a');
      wrapper.href = ARTICLE_URL;
      wrapper.setAttribute('data-mumei-thin-card-link', '1');
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'formatCreateLink' }));
      await sleep(900);
      if (exactLinkedImage(img)) return { ok: true, method: commandWorked ? 'createLink+verify' : 'scoped-wrap' };
    } catch (_) {}

    // Safety rollback: never leave an unverified or wrong link around the image.
    const current = img.closest('a[href]');
    if (current) {
      let isExact = false;
      try { isExact = new URL(current.href, location.href).href === new URL(ARTICLE_URL).href; } catch (_) {}
      if (!isExact && current.parentNode) current.replaceWith(img);
    }
    if (wrapper && wrapper.isConnected && wrapper.parentNode) wrapper.replaceWith(img);

    sel.removeAllRanges();
    return { ok: false };
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
      editor.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        clientX: p.x,
        clientY: p.y,
        dataTransfer: dt
      }));

      const img = await waitForNewImage(editor, before);
      if (!img) throw new Error('画像挿入を確認できませんでした');

      setStatus('3/3 この画像だけに元記事リンクを設定中…');
      const linked = await setExactImageLink(img, editor);
      if (linked.ok && exactLinkedImage(img)) {
        setStatus('✅ 画像挿入＋正しい記事URLを確認しました');
      } else {
        setStatus('⚠️ 画像は挿入できましたが、リンクは安全に設定できなかったので付けずに止めました', true);
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
