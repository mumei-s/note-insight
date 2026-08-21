// ==UserScript==
// @name         無名S note 極薄カード挿入（URL自動）
// @namespace    https://github.com/mumei-s/note-insight
// @version      0.8.0
// @description  成功済みの高精細1枚挿入方式で極薄カードを入れ、その直後の画像だけに記事URLを自動設定
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  if (window.__MUMEI_THIN_CARD_AUTO_V08__) return;
  window.__MUMEI_THIN_CARD_AUTO_V08__ = true;

  const CARD_IMAGE = 'https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-paste-test/thin-card.png?v=hd2x';
  const ARTICLE_URL = 'https://note.com/ss_yr/n/nc14eb3f2ea9f';
  const BUTTON_ID = 'mumei-thin-card-auto-v08';
  const PANEL_ID = 'mumei-thin-card-auto-panel-v08';
  const OLD_IDS = ['mumei-thin-card-inserter-test','mumei-thin-card-panel-test','mumei-thin-card-autolink-btn','mumei-toast'];

  let armed = false;
  let consumed = false;
  let preparedFile = null;
  let beforeFileInputs = new Set();
  let beforeEditorImages = new Set();
  let disarmTimer = null;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function getEditor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') || document.querySelector('.ProseMirror');
  }

  function setStatus(text, bad = false) {
    const el = document.getElementById(PANEL_ID);
    if (!el) return;
    el.textContent = text;
    el.style.background = bad ? '#7f1d1d' : '#111827';
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function labelOf(el) {
    return [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-tooltip'), el.getAttribute('data-testid'), el.textContent]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function requestBlob(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, responseType: 'blob', timeout: 20000,
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

  function resetState(message, bad = false) {
    armed = false;
    consumed = false;
    preparedFile = null;
    beforeFileInputs = new Set();
    if (disarmTimer) clearTimeout(disarmTimer);
    disarmTimer = null;
    if (message) setStatus(message, bad);
  }

  async function waitForInsertedImage(timeout = 15000) {
    const editor = getEditor();
    if (!editor) return null;
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const imgs = [...editor.querySelectorAll('img')];
      const added = imgs.find(img => !beforeEditorImages.has(img));
      if (added) return added;
      await sleep(300);
    }
    return null;
  }

  function nearImage(el, img, extra = 220) {
    const a = el.getBoundingClientRect();
    const b = img.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    return Math.abs(ax - bx) <= Math.max(extra, b.width / 2 + 100) && Math.abs(ay - by) <= extra;
  }

  async function openImageToolbar(img) {
    const before = new Set([...document.querySelectorAll('button,[role="button"]')].filter(visible));
    img.scrollIntoView({block:'center', behavior:'instant'});
    await sleep(250);
    img.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerType:'mouse'}));
    img.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
    img.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
    img.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    if (typeof img.click === 'function') img.click();
    await sleep(700);

    const now = [...document.querySelectorAll('button,[role="button"]')].filter(visible);
    let link = now.find(el => nearImage(el, img, 260) && /(リンク|link|chain|url)/i.test(labelOf(el)));
    if (link) return link;

    // 公式仕様では画像ツールバーのリンクは一番左。挿入画像をクリックして新しく出た小ボタンだけに限定して選ぶ。
    const fresh = now.filter(el => !before.has(el) && nearImage(el, img, 260)).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width <= 100 && r.height <= 100;
    });
    if (fresh.length >= 2 && fresh.length <= 8) {
      fresh.sort((x,y) => x.getBoundingClientRect().left - y.getBoundingClientRect().left);
      return fresh[0];
    }
    return null;
  }

  function setInputValue(input, value) {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(input, value); else input.value = value;
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new Event('change', {bubbles:true}));
  }

  async function findLinkInput(beforeInputs) {
    for (let i=0;i<15;i++) {
      const inputs = [...document.querySelectorAll('input,textarea')].filter(visible);
      let input = inputs.find(el => /(url|リンク|link|http)/i.test([
        el.type, el.placeholder, el.getAttribute('aria-label'), el.name
      ].filter(Boolean).join(' ')));
      if (!input) input = inputs.find(el => !beforeInputs.has(el) && ['INPUT','TEXTAREA'].includes(el.tagName));
      if (input) return input;
      await sleep(200);
    }
    return null;
  }

  async function verifyLinkByReopen(img, url) {
    const a = img.closest('a[href]');
    if (a) {
      try { if (new URL(a.href, location.href).href === new URL(url).href) return true; } catch (_) {}
    }

    const linkBtn = await openImageToolbar(img);
    if (!linkBtn) return false;
    const beforeInputs = new Set([...document.querySelectorAll('input,textarea')].filter(visible));
    linkBtn.click();
    await sleep(400);
    const input = await findLinkInput(beforeInputs);
    if (!input) return false;
    const ok = (input.value || '').trim() === url;
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));
    return ok;
  }

  async function attachExactLink(img, url) {
    const linkBtn = await openImageToolbar(img);
    if (!linkBtn) return false;

    const beforeInputs = new Set([...document.querySelectorAll('input,textarea')].filter(visible));
    linkBtn.click();
    await sleep(400);
    const input = await findLinkInput(beforeInputs);
    if (!input) return false;

    input.focus();
    setInputValue(input, url);
    await sleep(200);
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
    input.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
    await sleep(900);

    return await verifyLinkByReopen(img, url);
  }

  async function injectIntoFileInput(input) {
    if (!armed || consumed || !preparedFile || !isImageFileInput(input)) return false;
    if (beforeFileInputs.has(input)) return false;

    consumed = true;
    armed = false;
    if (disarmTimer) clearTimeout(disarmTimer);
    disarmTimer = null;
    const fileToSend = preparedFile;
    preparedFile = null;

    try {
      const dt = new DataTransfer();
      dt.items.add(fileToSend);
      input.files = dt.files;
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
      setStatus('1/2 高精細カードを1枚挿入中…');

      const img = await waitForInsertedImage();
      if (!img) throw new Error('画像挿入を確認できませんでした');

      setStatus('2/2 この画像だけに記事URLを設定中…');
      const linked = await attachExactLink(img, ARTICLE_URL);
      consumed = false;
      beforeFileInputs = new Set();
      if (linked) setStatus('✅ 1枚挿入＋正しいURL設定まで完了');
      else setStatus('⚠️ 画像は1枚入りましたが、URL設定だけ確認できませんでした', true);
      return true;
    } catch (e) {
      consumed = false;
      setStatus('⚠️ ' + (e?.message || String(e)), true);
      return false;
    }
  }

  const observer = new MutationObserver(mutations => {
    if (!armed || consumed) return;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (isImageFileInput(node) && injectIntoFileInput(node)) return;
        const inputs = node.querySelectorAll ? node.querySelectorAll('input[type="file"]') : [];
        for (const input of inputs) if (isImageFileInput(input) && injectIntoFileInput(input)) return;
      }
    }
  });

  function startObserver() {
    if (!document.documentElement) return setTimeout(startObserver,50);
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  startObserver();

  const nativeInputClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function(...args) {
    if (armed && !consumed && isImageFileInput(this) && !beforeFileInputs.has(this)) {
      if (injectIntoFileInput(this)) return;
    }
    return nativeInputClick.apply(this,args);
  };

  async function armUpload() {
    const btn = document.getElementById(BUTTON_ID);
    if (btn) btn.disabled = true;
    try {
      const editor = getEditor();
      if (!editor) throw new Error('note本文欄が見つかりません');
      resetState();
      setStatus('高精細カードを準備中…');
      const blob = await requestBlob(CARD_IMAGE);
      preparedFile = new File([blob],'mumei-thin-card-hd.png',{type:'image/png'});
      beforeFileInputs = new Set(document.querySelectorAll('input[type="file"]'));
      beforeEditorImages = new Set(editor.querySelectorAll('img'));
      consumed = false;
      armed = true;
      setStatus('準備OK。本文の入れたい行をタップ → noteの「＋」→「画像」を1回押してください');
      disarmTimer = setTimeout(() => { if (armed) resetState('時間切れ。もう一度「極薄カード準備」を押してください',true); },45000);
    } catch(e) {
      resetState('⚠️ ' + (e?.message || String(e)),true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function removeOldUi() {
    for (const id of OLD_IDS) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
  }

  function ensureMounted() {
    if (!document.body) return;
    removeOldUi();
    if (!document.getElementById(PANEL_ID)) {
      const p = document.createElement('div');
      p.id = PANEL_ID;
      p.textContent = '本文をタップしてから「極薄カード準備」';
      Object.assign(p.style,{position:'fixed',right:'12px',bottom:'74px',zIndex:'2147483646',maxWidth:'320px',padding:'9px 11px',borderRadius:'10px',background:'#111827',color:'#fff',fontSize:'12px',lineHeight:'1.45',boxShadow:'0 4px 18px rgba(0,0,0,.25)',pointerEvents:'none'});
      document.body.appendChild(p);
    }
    if (!document.getElementById(BUTTON_ID)) {
      const b = document.createElement('button');
      b.id = BUTTON_ID; b.type = 'button'; b.textContent = '極薄カード準備';
      Object.assign(b.style,{position:'fixed',right:'12px',bottom:'16px',zIndex:'2147483647',border:'0',borderRadius:'12px',padding:'14px 18px',background:'#111',color:'#fff',fontSize:'16px',fontWeight:'800',boxShadow:'0 5px 20px rgba(0,0,0,.30)',touchAction:'manipulation'});
      b.addEventListener('click',armUpload);
      document.body.appendChild(b);
    }
  }

  function loop(){ ensureMounted(); setTimeout(loop,700); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',ensureMounted,{once:true}); else ensureMounted();
  loop();
})();
