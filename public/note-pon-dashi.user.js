// ==UserScript==
// @name         note ポン出し｜本文全消し＋見出し自動整形
// @namespace    https://github.com/mumei-s/note-insight
// @version      1.1.0
// @description  ChatGPT等で作った原稿を1回コピー→note編集画面でポン。旧本文を自動バックアップし、本文全消し、見出し・箇条書き・太字・区切り線を自動整形して投入します。スマホUIかぶり回避・ドラッグ移動対応。
// @author       無名S note
// @match        https://note.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-dashi.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-dashi.user.js
// ==/UserScript==

(() => {
  'use strict';

  const APP_ID = 'mumei-note-pon-dashi';
  const BACKUP_PREFIX = 'mumei-note-pon-dashi-backup:';
  const POS_KEY = 'mumei-note-pon-dashi-fab-pos-v1';

  const css = `
    #${APP_ID}-fab{position:fixed;left:12px;top:38vh;z-index:2147483646;width:58px;height:58px;border-radius:50%;border:2px solid #39e7d2;background:#07192d;color:#fff;font-weight:900;font-size:18px;box-shadow:0 8px 28px #0008;display:none;align-items:center;justify-content:center;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none}
    #${APP_ID}-fab.mpd-ready{display:flex}
    #${APP_ID}-fab.mpd-dragging{opacity:.82;transform:scale(1.06)}
    #${APP_ID}-panel{position:fixed;left:10px;right:10px;top:max(66px,env(safe-area-inset-top));z-index:2147483647;max-width:640px;max-height:calc(100vh - 86px);overflow:auto;margin:auto;background:#081728f5;color:#fff;border:1px solid #37d8ca;border-radius:18px;box-shadow:0 12px 40px #000a;padding:14px;font-family:system-ui,-apple-system,sans-serif;backdrop-filter:blur(10px)}
    #${APP_ID}-panel *{box-sizing:border-box}
    .mpd-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .mpd-btn{flex:1;min-width:128px;border:0;border-radius:12px;padding:12px 10px;font-weight:800;font-size:15px;cursor:pointer}
    .mpd-main{background:#39e7d2;color:#04202a}.mpd-sub{background:#17314b;color:#fff;border:1px solid #35546f}.mpd-danger{background:#56243a;color:#fff}
    .mpd-title{font-weight:900;font-size:18px}.mpd-note{font-size:12px;line-height:1.5;color:#cbe0ec;margin-top:5px}
    #${APP_ID}-text{width:100%;height:42vh;min-height:210px;margin-top:10px;background:#fff;color:#111;border:0;border-radius:12px;padding:12px;font-size:15px;line-height:1.6;resize:vertical}
    #${APP_ID}-toast{position:fixed;left:50%;top:max(84px,env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483647;background:#061421;color:#fff;border:1px solid #39e7d2;border-radius:999px;padding:10px 16px;font-weight:800;box-shadow:0 6px 24px #0008;max-width:92vw;text-align:center}
  `;
  if (typeof GM_addStyle === 'function') GM_addStyle(css);
  else { const s=document.createElement('style'); s.textContent=css; document.head.appendChild(s); }

  function toast(msg, ms=2600){
    document.getElementById(`${APP_ID}-toast`)?.remove();
    const t=document.createElement('div'); t.id=`${APP_ID}-toast`; t.textContent=msg; document.body.appendChild(t);
    setTimeout(()=>t.remove(), ms);
  }

  function visible(el){
    const r=el.getBoundingClientRect();
    const st=getComputedStyle(el);
    return r.width>120 && r.height>80 && st.display!=='none' && st.visibility!=='hidden';
  }

  function findEditor(){
    const candidates=[...document.querySelectorAll('.ProseMirror,[contenteditable="true"]')]
      .filter(el=>visible(el))
      .filter(el=>!el.closest(`#${APP_ID}-panel,header,nav,[role="dialog"]`));
    if(!candidates.length) return null;
    const scored=candidates.map(el=>{
      const r=el.getBoundingClientRect();
      const text=(el.innerText||'').length;
      const cls=(el.className||'').toString();
      const score=(r.width*r.height)+(text*250)+(cls.includes('ProseMirror')?200000:0)+(r.height>250?100000:0);
      return {el,score};
    }).sort((a,b)=>b.score-a.score);
    return scored[0].el;
  }

  function backupKey(){ return BACKUP_PREFIX + location.pathname; }

  function saveBackup(editor){
    const data={html:editor.innerHTML,text:editor.innerText||'',time:Date.now(),url:location.href};
    localStorage.setItem(backupKey(), JSON.stringify(data));
  }

  function getBackup(){
    try{return JSON.parse(localStorage.getItem(backupKey())||'null')}catch{return null}
  }

  function escapeHtml(s){return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

  function inlineFormat(text){
    let s=escapeHtml(text);
    s=s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    s=s.replace(/__(.+?)__/g,'<strong>$1</strong>');
    s=s.replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
    s=s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2">$1</a>');
    return s;
  }

  function cleanSource(src){
    return src
      .replace(/^:::writing\{[^\n]*\}\s*$/gmi,'')
      .replace(/^:::\s*$/gmi,'')
      .replace(/^```(?:markdown|md|text)?\s*$/gmi,'')
      .replace(/^```\s*$/gmi,'')
      .replace(/\r\n?/g,'\n')
      .trim();
  }

  function markdownToHtml(src){
    const lines=cleanSource(src).split('\n');
    const out=[];
    let para=[];
    let listType=null, listItems=[];

    const flushPara=()=>{
      if(para.length){
        const joined=para.map(x=>x.trim()).join('<br>');
        out.push(`<p>${inlineFormat(joined)}</p>`); para=[];
      }
    };
    const flushList=()=>{
      if(listType && listItems.length){
        out.push(`<${listType}>${listItems.map(x=>`<li>${inlineFormat(x)}</li>`).join('')}</${listType}>`);
      }
      listType=null; listItems=[];
    };

    for(let raw of lines){
      const line=raw.trimEnd();
      const t=line.trim();
      if(!t){ flushPara(); flushList(); continue; }
      if(/^---+$/.test(t) || /^___+$/.test(t)){ flushPara(); flushList(); out.push('<hr>'); continue; }

      const h3=t.match(/^###?\s+(.+)$/);
      const h2=t.match(/^#\s+(.+)$/);
      if(h2){ flushPara(); flushList(); out.push(`<h2>${inlineFormat(h2[1])}</h2>`); continue; }
      if(h3){ flushPara(); flushList(); out.push(`<h3>${inlineFormat(h3[1])}</h3>`); continue; }

      const big=t.match(/^◆【大見出し】\s*(.+)$/);
      const small=t.match(/^◇【小見出し】\s*(.+)$/);
      if(big){ flushPara(); flushList(); out.push(`<h2>${inlineFormat(big[1])}</h2>`); continue; }
      if(small){ flushPara(); flushList(); out.push(`<h3>${inlineFormat(small[1])}</h3>`); continue; }

      if(/^🔒【ここで有料ライン】/.test(t) || /^\[PAYWALL\]$/i.test(t)){
        flushPara(); flushList(); out.push('<p>🔒【ここで有料ライン】</p>'); continue;
      }

      const ul=t.match(/^[-*・]\s+(.+)$/);
      if(ul){ flushPara(); if(listType && listType!=='ul') flushList(); listType='ul'; listItems.push(ul[1]); continue; }
      const ol=t.match(/^\d+[\.．]\s*(.+)$/);
      if(ol){ flushPara(); if(listType && listType!=='ol') flushList(); listType='ol'; listItems.push(ol[1]); continue; }

      const quote=t.match(/^>\s?(.*)$/);
      if(quote){ flushPara(); flushList(); out.push(`<blockquote>${inlineFormat(quote[1])}</blockquote>`); continue; }
      para.push(line);
    }
    flushPara(); flushList();
    return out.join('');
  }

  function htmlToPlain(html){
    const d=document.createElement('div'); d.innerHTML=html;
    return d.innerText||d.textContent||'';
  }

  function selectEditorContents(editor){
    const range=document.createRange(); range.selectNodeContents(editor);
    const sel=getSelection(); sel.removeAllRanges(); sel.addRange(range);
    editor.focus();
  }

  function replaceEditorHtml(editor, html){
    saveBackup(editor);
    selectEditorContents(editor);
    let ok=false;
    try{ ok=document.execCommand('insertHTML', false, html); }catch{}
    if(!ok){
      try{
        selectEditorContents(editor);
        document.execCommand('delete', false);
        const dt=new DataTransfer();
        dt.setData('text/html', html);
        dt.setData('text/plain', htmlToPlain(html));
        const ev=new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true});
        editor.dispatchEvent(ev);
        ok=(editor.innerText||'').trim().length>0;
      }catch{}
    }
    if(!ok){
      editor.innerHTML=html;
      editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:null}));
      editor.dispatchEvent(new Event('change',{bubbles:true}));
      ok=true;
    } else {
      editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste',data:null}));
    }
    return ok;
  }

  function restoreBackup(){
    const editor=findEditor(); if(!editor){toast('本文エディタが見つからない');return;}
    const b=getBackup(); if(!b){toast('このページのバックアップがない');return;}
    selectEditorContents(editor);
    let ok=false;
    try{ok=document.execCommand('insertHTML',false,b.html)}catch{}
    if(!ok){editor.innerHTML=b.html;editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));}
    toast('↩️ 直前の本文へ戻した');
  }

  async function readClipboard(){
    if(navigator.clipboard?.readText){
      try{return await navigator.clipboard.readText()}catch{}
    }
    return '';
  }

  async function ponFromClipboard(){
    const editor=findEditor();
    if(!editor){toast('note本文エディタが見つからない。編集画面で使ってね');return;}
    const src=await readClipboard();
    if(!src.trim()){
      openPanel(true);
      toast('クリップボードを読めなかったので貼付欄を開いた');
      return;
    }
    replaceEditorHtml(editor, markdownToHtml(src));
    toast('✅ 旧本文を保存 → 全消し → 新原稿をポン出し完了');
  }

  function ponFromTextarea(){
    const editor=findEditor();
    if(!editor){toast('note本文エディタが見つからない');return;}
    const ta=document.getElementById(`${APP_ID}-text`);
    const src=ta?.value||'';
    if(!src.trim()){toast('原稿を貼ってから押してね');return;}
    replaceEditorHtml(editor, markdownToHtml(src));
    closePanel();
    toast('✅ 全消し＋見出し自動整形＋投入 完了');
  }

  function closePanel(){document.getElementById(`${APP_ID}-panel`)?.remove();}

  function openPanel(showTextarea=false){
    closePanel();
    const p=document.createElement('div'); p.id=`${APP_ID}-panel`;
    p.innerHTML=`
      <div class="mpd-title">📄 note ポン出し v1.1</div>
      <div class="mpd-note">本文だけを対象に、旧本文を自動バックアップ→全消し→新原稿へ置換。<br># 大見出し / ## 小見出し / **太字** / 箇条書き / --- 区切り線 に対応。<br>丸い「ポン」は指で好きな位置へ移動できます。</div>
      ${showTextarea?`<textarea id="${APP_ID}-text" placeholder="ここへChatGPTの完成原稿を1回貼り付け"></textarea>`:''}
      <div class="mpd-row">
        ${showTextarea?`<button class="mpd-btn mpd-main" id="${APP_ID}-go">🚀 全消し→ポン出し</button>`:`<button class="mpd-btn mpd-main" id="${APP_ID}-clip">📋 クリップボードからポン</button>`}
        <button class="mpd-btn mpd-sub" id="${APP_ID}-manual">✍️ 貼付欄</button>
        <button class="mpd-btn mpd-danger" id="${APP_ID}-undo">↩️ 元本文へ戻す</button>
        <button class="mpd-btn mpd-sub" id="${APP_ID}-close">閉じる</button>
      </div>`;
    document.body.appendChild(p);
    p.querySelector(`#${APP_ID}-close`).onclick=closePanel;
    p.querySelector(`#${APP_ID}-undo`).onclick=restoreBackup;
    p.querySelector(`#${APP_ID}-manual`).onclick=()=>openPanel(true);
    p.querySelector(`#${APP_ID}-clip`)?.addEventListener('click',ponFromClipboard);
    p.querySelector(`#${APP_ID}-go`)?.addEventListener('click',ponFromTextarea);
  }

  function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

  function loadFabPos(){
    try{return JSON.parse(localStorage.getItem(POS_KEY)||'null')}catch{return null}
  }

  function saveFabPos(b){
    const r=b.getBoundingClientRect();
    localStorage.setItem(POS_KEY,JSON.stringify({left:r.left,top:r.top}));
  }

  function applyFabPos(b){
    const p=loadFabPos();
    if(!p) return;
    b.style.left=clamp(Number(p.left)||12,4,Math.max(4,innerWidth-62))+'px';
    b.style.top=clamp(Number(p.top)||Math.round(innerHeight*.38),4,Math.max(4,innerHeight-62))+'px';
  }

  function enableDrag(b){
    let sx=0,sy=0,sl=0,st=0,moved=false,pid=null;
    b.addEventListener('pointerdown',e=>{
      pid=e.pointerId; moved=false; sx=e.clientX; sy=e.clientY;
      const r=b.getBoundingClientRect(); sl=r.left; st=r.top;
      b.setPointerCapture?.(pid); b.classList.add('mpd-dragging');
      e.preventDefault();
    });
    b.addEventListener('pointermove',e=>{
      if(pid!==e.pointerId) return;
      const dx=e.clientX-sx, dy=e.clientY-sy;
      if(Math.abs(dx)+Math.abs(dy)>6) moved=true;
      if(!moved) return;
      b.style.left=clamp(sl+dx,4,Math.max(4,innerWidth-62))+'px';
      b.style.top=clamp(st+dy,4,Math.max(4,innerHeight-62))+'px';
      b.style.right='auto'; b.style.bottom='auto';
      e.preventDefault();
    });
    const end=e=>{
      if(pid!==e.pointerId) return;
      try{b.releasePointerCapture?.(pid)}catch{}
      b.classList.remove('mpd-dragging');
      if(moved){ saveFabPos(b); }
      else { ponFromClipboard(); }
      pid=null;
      e.preventDefault();
    };
    b.addEventListener('pointerup',end);
    b.addEventListener('pointercancel',e=>{pid=null;b.classList.remove('mpd-dragging');});
  }

  function updateFabVisibility(){
    const b=document.getElementById(`${APP_ID}-fab`);
    if(!b) return;
    if(findEditor()) b.classList.add('mpd-ready');
    else b.classList.remove('mpd-ready');
  }

  function mountFab(){
    let b=document.getElementById(`${APP_ID}-fab`);
    if(!b){
      b=document.createElement('button');
      b.id=`${APP_ID}-fab`; b.textContent='ポン'; b.title='note ポン出し｜ドラッグで移動';
      document.body.appendChild(b);
      applyFabPos(b);
      enableDrag(b);
      window.addEventListener('resize',()=>applyFabPos(b));
    }
    updateFabVisibility();
  }

  mountFab();
  const mo=new MutationObserver(()=>mountFab());
  mo.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(updateFabVisibility,1200);
})();
