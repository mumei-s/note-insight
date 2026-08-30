// ==UserScript==
// @name         note ポン出し v8｜全消し→整形→貼付
// @namespace    https://github.com/mumei-s/note-insight
// @version      8.0.0
// @description  note編集中画面専用。入力欄を動かさず、旧本文を完全削除してからbrなしで段落・見出しを整えて貼付。挿絵自動処理なし。
// @author       無名S note
// @match        https://note.com/*
// @match        https://editor.note.com/*
// @grant        none
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v6.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v6.user.js
// ==/UserScript==

(() => {
  'use strict';

  const HOST_ID = '__mumei_pon_v8_editor__';
  const BACKUP_PREFIX = 'mumei-note-pon-v8-backup:';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 過去のポン出しUIだけ隠す。夏機能・カード機能には触れない。
  const LEGACY_IDS = [
    '#mumei-note-pon-dashi-fab',
    '#mumei-note-pon-dashi-panel',
    '#mumei-note-pon-dashi-toast',
    '#__mumei_pon_v2_host__',
    '#__mumei_pon_v21_host__',
    '#__mumei_pon_v3_bottom__',
    '#__mumei_pon_v6_editor__',
    '#__mumei_pon_v7_editor__'
  ];

  function installLegacyKiller() {
    if (document.getElementById('__mumei_pon_v8_legacy_killer__')) return;
    const s = document.createElement('style');
    s.id = '__mumei_pon_v8_legacy_killer__';
    s.textContent = `${LEGACY_IDS.join(',')} {display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}`;
    (document.head || document.documentElement).appendChild(s);
  }
  installLegacyKiller();

  // 実際の操作UIは記事編集中の editor.note.com だけ。
  if (location.hostname !== 'editor.note.com') return;

  const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 120 && r.height > 40 && st.display !== 'none' && st.visibility !== 'hidden';
  }

  function findEditor() {
    const direct = document.querySelector('.ProseMirror[contenteditable="true"]');
    if (visible(direct)) return direct;
    const all = [...document.querySelectorAll('[contenteditable="true"]')].filter(visible);
    if (!all.length) return null;
    return all.map(el => {
      const r = el.getBoundingClientRect();
      const text = (el.innerText || '').length;
      let score = r.width * r.height + text * 200;
      if (String(el.className || '').includes('ProseMirror')) score += 1000000;
      return {el, score};
    }).sort((a,b) => b.score - a.score)[0].el;
  }

  async function waitEditor(ms = 8000) {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const e = findEditor();
      if (e) return e;
      await sleep(120);
    }
    return null;
  }

  function findAnchor(editor) {
    let node = editor;
    for (let i = 0; i < 10 && node.parentElement && node.parentElement !== document.body; i++) {
      const p = node.parentElement;
      const d = getComputedStyle(p).display;
      if (d === 'flex' || d === 'inline-flex' || d === 'grid' || d === 'inline-grid') node = p;
      else break;
    }
    return node;
  }

  const backupKey = () => BACKUP_PREFIX + location.pathname;
  function saveBackup(editor) {
    try {
      localStorage.setItem(backupKey(), JSON.stringify({html:editor.innerHTML, text:editor.innerText || '', time:Date.now(), url:location.href}));
    } catch {}
  }
  function getBackup() {
    try { return JSON.parse(localStorage.getItem(backupKey()) || 'null'); }
    catch { return null; }
  }

  function cleanSource(src) {
    return String(src || '')
      .replace(/^:::writing\{[^\n]*\}\s*$/gmi, '')
      .replace(/^:::\s*$/gmi, '')
      .replace(/^```(?:markdown|md|text)?\s*$/gmi, '')
      .replace(/^```\s*$/gmi, '')
      .replace(/\r\n?/g, '\n')
      .trim();
  }

  // <br>は絶対に生成しない。空行だけを段落区切りとして扱う。
  function sourceToHtml(src) {
    const lines = cleanSource(src).split('\n');
    const out = [];
    let para = [];
    let list = [];
    let listType = '';

    const flushPara = () => {
      if (!para.length) return;
      const text = para.map(x => x.trim()).filter(Boolean).join('');
      if (text) out.push(`<p>${inline(text)}</p>`);
      para = [];
    };
    const flushList = () => {
      if (!list.length || !listType) return;
      out.push(`<${listType}>${list.map(x => `<li>${inline(x)}</li>`).join('')}</${listType}>`);
      list = [];
      listType = '';
    };

    for (const raw of lines) {
      const t = raw.trim();
      if (!t) { flushPara(); flushList(); continue; }
      if (/^---+$/.test(t) || /^___+$/.test(t)) { flushPara(); flushList(); out.push('<hr>'); continue; }

      const big = t.match(/^#\s+(.+)$/) || t.match(/^◆【大見出し】\s*(.+)$/);
      const small = t.match(/^##\s+(.+)$/) || t.match(/^###\s+(.+)$/) || t.match(/^◇【小見出し】\s*(.+)$/);
      if (big) { flushPara(); flushList(); out.push(`<h2>${inline(big[1])}</h2>`); continue; }
      if (small) { flushPara(); flushList(); out.push(`<h3>${inline(small[1])}</h3>`); continue; }

      const ul = t.match(/^[-*・]\s+(.+)$/);
      if (ul) {
        flushPara();
        if (listType && listType !== 'ul') flushList();
        listType = 'ul'; list.push(ul[1]); continue;
      }

      const ol = t.match(/^\d+[\.．]\s*(.+)$/);
      if (ol) {
        flushPara();
        if (listType && listType !== 'ol') flushList();
        listType = 'ol'; list.push(ol[1]); continue;
      }

      const q = t.match(/^>\s?(.*)$/);
      if (q) { flushPara(); flushList(); out.push(`<blockquote>${inline(q[1])}</blockquote>`); continue; }

      para.push(t);
    }

    flushPara();
    flushList();
    const html = out.join('');
    if (/<br\b/i.test(html)) throw new Error('br生成を検出');
    return html;
  }

  function selectContents(editor) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    editor.focus();
  }

  function fireInput(editor, inputType) {
    try { editor.dispatchEvent(new InputEvent('input', {bubbles:true, inputType, data:null})); }
    catch { editor.dispatchEvent(new Event('input', {bubbles:true})); }
    editor.dispatchEvent(new Event('change', {bubbles:true}));
  }

  function looksLikeView(v) {
    try { return !!v && typeof v === 'object' && v.state?.doc && typeof v.dispatch === 'function' && v.dom; }
    catch { return false; }
  }

  function findView(editor) {
    const seeds = [];
    let n = editor;
    for (let i = 0; i < 6 && n; i++, n = n.parentElement) seeds.push(n);
    const seen = new Set();
    const q = seeds.map(x => [x,0]);
    let steps = 0;
    while (q.length && steps++ < 9000) {
      const [v,d] = q.shift();
      if (!v || seen.has(v)) continue;
      seen.add(v);
      if (looksLikeView(v)) return v;
      if (d >= 5) continue;
      let keys = [];
      try { keys = Object.getOwnPropertyNames(v); } catch { continue; }
      for (const k of keys) {
        if (['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k)) continue;
        let x;
        try { x = v[k]; } catch { continue; }
        if (looksLikeView(x)) return x;
        if (x && (typeof x === 'object' || typeof x === 'function')) q.push([x,d+1]);
      }
    }
    return null;
  }

  async function hardClear(editor) {
    saveBackup(editor);

    const view = findView(editor);
    if (view) {
      try {
        const size = view.state.doc.content.size;
        if (size > 0) view.dispatch(view.state.tr.delete(0, size));
      } catch {}
    }

    await sleep(140);
    selectContents(editor);
    try { document.execCommand('delete', false); } catch {}
    fireInput(editor, 'deleteContentBackward');

    await sleep(200);
    if ((editor.innerText || '').trim()) {
      editor.innerHTML = '';
      fireInput(editor, 'deleteContentBackward');
      await sleep(180);
    }

    return !(editor.innerText || '').trim();
  }

  async function insertCleanHtml(editor, html) {
    if (/<br\b/i.test(html)) throw new Error('br生成を検出');
    selectContents(editor);
    let ok = false;
    try { ok = document.execCommand('insertHTML', false, html); } catch {}
    if (!ok || !(editor.innerText || '').trim()) {
      editor.innerHTML = html;
      fireInput(editor, 'insertText');
    } else {
      fireInput(editor, 'insertFromPaste');
    }
  }

  async function replaceAll(src, show) {
    const editor = await waitEditor();
    if (!editor) return show('本文エディタが見つからない');
    if (!String(src || '').trim()) return show('原稿を貼ってから押してね');

    show('① 旧本文を完全削除中…');
    const empty = await hardClear(editor);
    if (!empty) return show('❌ 全消しできなかったため、新原稿は貼っていません');

    show('② 空を確認。改行を整えて貼付中…');
    let html;
    try { html = sourceToHtml(src); }
    catch (e) { return show('❌ brを検出したため貼付を中止'); }

    await insertCleanHtml(editor, html);
    show('✅ 全消し → 段落・見出し整形 → 貼付完了（brなし）');
  }

  async function restore(show) {
    const editor = await waitEditor();
    if (!editor) return show('本文エディタが見つからない');
    const b = getBackup();
    if (!b) return show('このページのバックアップがない');
    await hardClear(editor);
    editor.innerHTML = b.html;
    fireInput(editor, 'insertFromPaste');
    show('↩️ 元本文へ戻した');
  }

  function buildHost() {
    const host = document.createElement('section');
    host.id = HOST_ID;
    host.setAttribute('contenteditable','false');
    host.style.cssText = 'display:block!important;position:relative!important;float:none!important;clear:both!important;width:100%!important;max-width:760px!important;margin:24px auto 64px!important;padding:0!important;flex:0 0 100%!important;align-self:stretch!important;z-index:2!important;pointer-events:auto!important;';

    host.innerHTML = `
      <div style="font-family:system-ui,-apple-system,sans-serif;background:#07182a;color:#fff;border:1px solid #2fd7c6;border-radius:14px;overflow:hidden;box-sizing:border-box">
        <div id="mumeiPonToggle" style="display:flex;align-items:center;gap:8px;padding:12px 14px;background:#0b2138;cursor:pointer;user-select:none;box-sizing:border-box">
          <div style="font-weight:900;flex:1">📄 ポン出し</div><div style="font-size:11px;color:#9ddbd6">v8｜単純版</div><div>⌄</div>
        </div>
        <div id="mumeiPonBody" style="display:none;padding:12px;box-sizing:border-box">
          <div style="font-size:12px;line-height:1.55;color:#c8d9e6;margin:0 0 8px">入力欄をタップして原稿を貼る → 全消し → 空確認 → brなしで貼付。挿絵は手動。</div>
          <textarea id="mumeiPonSrc" tabindex="0" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="ここをタップ → 原稿を貼り付け" style="display:block!important;width:100%!important;height:38vh!important;min-height:260px!important;border:2px solid #39e7d2!important;border-radius:10px!important;padding:12px!important;font-size:16px!important;line-height:1.55!important;background:#fff!important;color:#111!important;resize:vertical!important;box-sizing:border-box!important;pointer-events:auto!important;touch-action:manipulation!important;user-select:text!important;-webkit-user-select:text!important;caret-color:#111!important;position:relative!important;z-index:5!important"></textarea>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button id="mumeiPonGo" type="button" style="border:0;border-radius:10px;padding:12px;font-size:14px;font-weight:900;background:#39e7d2;color:#04202a;flex:1 1 220px">🚀 全消し → 整形 → 貼る</button><button id="mumeiPonUndo" type="button" style="border:0;border-radius:10px;padding:12px;font-size:14px;font-weight:900;background:#5a2841;color:#fff;flex:1 1 130px">↩️ 元本文へ戻す</button></div>
          <div id="mumeiPonStatus" style="font-size:12px;color:#9ddbd6;margin-top:8px;min-height:1.4em;white-space:pre-wrap"></div>
        </div>
      </div>`;

    const body = host.querySelector('#mumeiPonBody');
    const src = host.querySelector('#mumeiPonSrc');
    const status = host.querySelector('#mumeiPonStatus');
    const show = msg => { status.textContent = msg; };

    host.querySelector('#mumeiPonToggle').addEventListener('click', e => {
      e.stopPropagation();
      body.style.display = body.style.display === 'block' ? 'none' : 'block';
      if (body.style.display === 'block') setTimeout(() => src.focus({preventScroll:true}), 80);
    });

    // note側の編集イベントへ渡さず、スマホでもtextareaに確実にフォーカスを残す。
    ['pointerdown','mousedown','touchstart','click'].forEach(type => {
      src.addEventListener(type, e => e.stopPropagation(), {passive:type === 'touchstart'});
    });
    src.addEventListener('pointerup', e => { e.stopPropagation(); src.focus(); });
    src.addEventListener('touchend', e => { e.stopPropagation(); setTimeout(() => src.focus(), 0); }, {passive:true});

    host.querySelector('#mumeiPonGo').addEventListener('click', e => { e.stopPropagation(); replaceAll(src.value, show); });
    host.querySelector('#mumeiPonUndo').addEventListener('click', e => { e.stopPropagation(); restore(show); });

    return host;
  }

  function mountOnce() {
    if (document.getElementById(HOST_ID)) return;
    const editor = findEditor();
    if (!editor) return;
    const anchor = findAnchor(editor);
    const host = buildHost();
    try { anchor.insertAdjacentElement('afterend', host); } catch { return; }
  }

  function start() {
    mountOnce();
    // 接続中は絶対に動かさない。note側に消された時だけ再設置。
    setInterval(() => {
      const host = document.getElementById(HOST_ID);
      if (!host || !host.isConnected) mountOnce();
    }, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
