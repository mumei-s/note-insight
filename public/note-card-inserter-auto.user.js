// ==UserScript==
// @name         無名S note 極薄カード挿入（URL自動）
// @namespace    https://github.com/mumei-s/note-insight
// @version      1.0.0
// @description  高精細カードを1枚挿入し、画像の鎖ボタン→新しく出たURL入力欄へ記事URLを自動入力して確定
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  if (window.__MUMEI_THIN_CARD_AUTO_V100__) return;
  window.__MUMEI_THIN_CARD_AUTO_V100__ = true;

  const CARD_IMAGE = 'https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-paste-test/thin-card.png?v=hd2x';
  const ARTICLE_URL = 'https://note.com/ss_yr/n/nc14eb3f2ea9f';
  const BUTTON_ID = 'mumei-thin-card-auto-v100';
  const PANEL_ID = 'mumei-thin-card-auto-panel-v100';
  const OLD_IDS = [
    'mumei-thin-card-inserter-test','mumei-thin-card-panel-test',
    'mumei-thin-card-autolink-btn','mumei-toast',
    'mumei-thin-card-auto-v08','mumei-thin-card-auto-panel-v08',
    'mumei-thin-card-auto-v09','mumei-thin-card-auto-panel-v09'
  ];

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

  function requestBlob(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method:'GET', url, responseType:'blob', timeout:20000,
        onload:res => {
          if (res.status >= 200 && res.status < 300 && res.response) resolve(res.response);
          else reject(new Error('画像取得失敗 HTTP ' + res.status));
        },
        onerror:() => reject(new Error('画像取得に失敗')),
        ontimeout:() => reject(new Error('画像取得がタイムアウト'))
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

  function horizontalOverlap(a,b) {
    return Math.min(a.right,b.right) - Math.max(a.left,b.left) > 20;
  }

  // 現行note UI: [鎖] [ALT] [拡大] [配置] [削除]
  // ALTを目印に、その画像のツールバーを特定して左端の鎖だけを使う。
  function findLinkButtonFromAlt(img) {
    const ir = img.getBoundingClientRect();
    const altCandidates = [...document.querySelectorAll('button,[role="button"],span,div')]
      .filter(visible)
      .filter(el => (el.textContent || '').trim() === 'ALT');

    for (const alt of altCandidates) {
      let node = alt;
      for (let depth = 0; depth < 6 && node; depth++, node = node.parentElement) {
        const buttons = [...node.querySelectorAll('button,[role="button"]')].filter(visible);
        if (buttons.length < 4 || buttons.length > 7) continue;
        const nr = node.getBoundingClientRect();
        const gap = ir.top - nr.bottom;
        if (!(horizontalOverlap(nr,ir) && gap >= -25 && gap <= 180 && nr.height <= 140)) continue;

        buttons.sort((a,b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        const altIndex = buttons.findIndex(b => (b.textContent || '').trim() === 'ALT');
        if (altIndex === 1 && buttons[0]) return buttons[0];

        const ar = alt.getBoundingClientRect();
        const leftButtons = buttons.filter(b => b.getBoundingClientRect().right <= ar.left + 8);
        if (leftButtons.length === 1) return leftButtons[0];
      }
    }
    return null;
  }

  function tap(el) {
    try { el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',isPrimary:true})); } catch(_) {}
    try { el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',isPrimary:true})); } catch(_) {}
    try { el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true})); } catch(_) {}
    try { el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true})); } catch(_) {}
    try { el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); } catch(_) {}
  }

  async function selectImageAndGetLinkButton(img) {
    img.scrollIntoView({block:'center',behavior:'instant'});
    await sleep(250);
    tap(img);
    await sleep(700);
    for (let i=0;i<12;i++) {
      const btn = findLinkButtonFromAlt(img);
      if (btn) return btn;
      await sleep(200);
    }
    return null;
  }

  function isTextEntry(el) {
    if (!el || !visible(el)) return false;
    if (el instanceof HTMLInputElement) return !['file','button','submit','checkbox','radio','range','color'].includes((el.type||'text').toLowerCase());
    if (el instanceof HTMLTextAreaElement) return true;
    return el.getAttribute?.('contenteditable') === 'true' && !el.classList?.contains('ProseMirror');
  }

  function allTextEntries() {
    return [...document.querySelectorAll('input,textarea,[contenteditable="true"]')].filter(isTextEntry);
  }

  async function findFreshFocusedUrlEntry(beforeEntries) {
    for (let i=0;i<25;i++) {
      const active = document.activeElement;
      if (isTextEntry(active) && !beforeEntries.has(active)) return active;

      const entries = allTextEntries();
      const fresh = entries.filter(el => !beforeEntries.has(el));
      if (fresh.length === 1) return fresh[0];
      if (fresh.length > 1) {
        const focused = fresh.find(el => el === document.activeElement);
        if (focused) return focused;
        // URL欄は通常、鎖クリック直後に新しく現れる小さめの入力欄。
        fresh.sort((a,b) => {
          const ar=a.getBoundingClientRect(), br=b.getBoundingClientRect();
          return (ar.width*ar.height) - (br.width*br.height);
        });
        return fresh[0];
      }
      await sleep(160);
    }
    return null;
  }

  function setEntryValue(el, value) {
    el.focus();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto,'value')?.set;
      if (setter) setter.call(el,value); else el.value = value;
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      return;
    }
    el.textContent = value;
    el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));
  }

  function pressEnter(el) {
    el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
    el.dispatchEvent(new KeyboardEvent('keypress',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
    el.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
  }

  async function attachExactLink(img,url) {
    const linkBtn = await selectImageAndGetLinkButton(img);
    if (!linkBtn) {
      setStatus('⚠️ 鎖ボタンを見つけられませんでした',true);
      return false;
    }

    const beforeEntries = new Set(allTextEntries());
    tap(linkBtn);
    await sleep(250);

    const urlEntry = await findFreshFocusedUrlEntry(beforeEntries);
    if (!urlEntry) {
      setStatus('⚠️ 鎖は押せましたが、新しく出たURL入力欄を取得できませんでした',true);
      return false;
    }

    setEntryValue(urlEntry,url);
    await sleep(250);

    // 入力が実際に入ったか確認してからEnter。
    const current = urlEntry instanceof HTMLInputElement || urlEntry instanceof HTMLTextAreaElement
      ? urlEntry.value
      : urlEntry.textContent;
    if ((current || '').trim() !== url) {
      setStatus('⚠️ URL欄は見つかりましたが、文字入力が反映されませんでした',true);
      return false;
    }

    pressEnter(urlEntry);
    await sleep(900);

    // URL欄が閉じればnote側で確定されたと判断。
    if (!visible(urlEntry)) return true;

    // DOMにリンクが現れる場合は厳密確認。
    const a = img.closest('a[href]') || img.parentElement?.closest('a[href]');
    if (a) {
      try { return new URL(a.href,location.href).href === new URL(url).href; } catch(_) {}
    }

    return false;
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
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      setStatus('1/2 高精細カードを1枚挿入中…');

      const img = await waitForInsertedImage();
      if (!img) throw new Error('画像挿入を確認できませんでした');

      setStatus('2/2 鎖→URL入力→Enter を自動実行中…');
      const linked = await attachExactLink(img,ARTICLE_URL);
      consumed = false;
      beforeFileInputs = new Set();
      if (linked) setStatus('✅ 1枚挿入＋URL自動設定まで完了');
      else if (!document.getElementById(PANEL_ID)?.textContent?.includes('⚠️')) setStatus('⚠️ URL設定だけ確認できませんでした',true);
      return true;
    } catch(e) {
      consumed = false;
      setStatus('⚠️ ' + (e?.message || String(e)),true);
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
      disarmTimer = setTimeout(() => {
        if (armed) resetState('時間切れ。もう一度「極薄カード準備」を押してください',true);
      },45000);
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
      Object.assign(p.style,{position:'fixed',right:'12px',bottom:'74px',zIndex:'2147483646',maxWidth:'330px',padding:'9px 11px',borderRadius:'10px',background:'#111827',color:'#fff',fontSize:'12px',lineHeight:'1.45',boxShadow:'0 4px 18px rgba(0,0,0,.25)',pointerEvents:'none'});
      document.body.appendChild(p);
    }
    if (!document.getElementById(BUTTON_ID)) {
      const b = document.createElement('button');
      b.id = BUTTON_ID;
      b.type = 'button';
      b.textContent = '極薄カード準備';
      Object.assign(b.style,{position:'fixed',right:'12px',bottom:'16px',zIndex:'2147483647',border:'0',borderRadius:'12px',padding:'14px 18px',background:'#111',color:'#fff',fontSize:'16px',fontWeight:'800',boxShadow:'0 5px 20px rgba(0,0,0,.30)',touchAction:'manipulation'});
      b.addEventListener('click',armUpload);
      document.body.appendChild(b);
    }
  }

  function loop(){ ensureMounted(); setTimeout(loop,700); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',ensureMounted,{once:true}); else ensureMounted();
  loop();
})();
