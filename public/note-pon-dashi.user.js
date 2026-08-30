// ==UserScript==
// @name         note ポン出し｜本文全消し＋見出し自動整形
// @namespace    https://github.com/mumei-s/note-insight
// @version      1.2.0
// @description  ChatGPT等で作った原稿を1回コピー→note編集画面でポン。旧本文を自動バックアップし、本文全消し、見出し・箇条書き・太字・区切り線を自動整形して投入します。スマホ常駐版。
// @author       無名S note
// @match        https://note.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-dashi.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-dashi.user.js
// ==/UserScript==

(() => {
  'use strict';

  const APP_ID='mumei-note-pon-dashi';
  const BACKUP_PREFIX='mumei-note-pon-dashi-backup:';
  const POS_KEY='mumei-note-pon-dashi-fab-pos-v2';

  const css=`
  #${APP_ID}-fab{position:fixed;left:10px;top:36vh;z-index:2147483647;width:58px;height:58px;border-radius:50%;border:2px solid #39e7d2;background:#07192d;color:#fff;font-weight:900;font-size:18px;box-shadow:0 8px 28px #0009;display:flex!important;align-items:center;justify-content:center;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;opacity:.96}
  #${APP_ID}-fab:active{transform:scale(.96)}
  #${APP_ID}-fab.mpd-dragging{opacity:.75;transform:scale(1.06)}
  #${APP_ID}-panel{position:fixed;left:8px;right:8px;top:max(58px,env(safe-area-inset-top));z-index:2147483647;max-width:680px;max-height:calc(100vh - 72px);overflow:auto;margin:auto;background:#081728f7;color:#fff;border:1px solid #37d8ca;border-radius:16px;box-shadow:0 12px 40px #000b;padding:14px;font-family:system-ui,-apple-system,sans-serif;backdrop-filter:blur(10px)}
  #${APP_ID}-panel *{box-sizing:border-box}.mpd-title{font-size:18px;font-weight:900}.mpd-note{font-size:12px;line-height:1.5;color:#cbe0ec;margin-top:5px}.mpd-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.mpd-btn{flex:1;min-width:130px;border:0;border-radius:12px;padding:12px 10px;font-weight:800;font-size:15px}.mpd-main{background:#39e7d2;color:#04202a}.mpd-sub{background:#17314b;color:#fff;border:1px solid #35546f}.mpd-danger{background:#56243a;color:#fff}#${APP_ID}-text{width:100%;height:44vh;min-height:240px;margin-top:10px;background:#fff;color:#111;border:0;border-radius:12px;padding:12px;font-size:15px;line-height:1.6;resize:vertical}#${APP_ID}-toast{position:fixed;left:50%;top:max(72px,env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483647;background:#061421;color:#fff;border:1px solid #39e7d2;border-radius:999px;padding:10px 16px;font-weight:800;box-shadow:0 6px 24px #0008;max-width:92vw;text-align:center}
  `;
  if(typeof GM_addStyle==='function') GM_addStyle(css); else {const s=document.createElement('style');s.textContent=css;document.head.appendChild(s)}

  const toast=(msg,ms=2600)=>{document.getElementById(`${APP_ID}-toast`)?.remove();const t=document.createElement('div');t.id=`${APP_ID}-toast`;t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),ms)};
  const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>80&&r.height>30&&s.display!=='none'&&s.visibility!=='hidden'};

  function findEditor(){
    const selectors=['.ProseMirror','[contenteditable="true"][role="textbox"]','div[contenteditable="true"]','article [contenteditable="true"]'];
    const uniq=[...new Set(selectors.flatMap(s=>[...document.querySelectorAll(s)]))]
      .filter(visible)
      .filter(el=>!el.closest(`#${APP_ID}-panel,header,nav,[role="dialog"]`));
    if(!uniq.length) return null;
    return uniq.map(el=>{const r=el.getBoundingClientRect();const text=(el.innerText||'').length;const cls=String(el.className||'');let score=r.width*r.height+text*200;if(cls.includes('ProseMirror'))score+=1000000;if(el.getAttribute('contenteditable')==='true')score+=100000;return {el,score}}).sort((a,b)=>b.score-a.score)[0].el;
  }

  async function waitForEditor(ms=2500){
    const end=Date.now()+ms;
    while(Date.now()<end){const e=findEditor();if(e)return e;await new Promise(r=>setTimeout(r,120));}
    return null;
  }

  const backupKey=()=>BACKUP_PREFIX+location.pathname;
  function saveBackup(editor){try{localStorage.setItem(backupKey(),JSON.stringify({html:editor.innerHTML,text:editor.innerText||'',time:Date.now(),url:location.href}))}catch{}}
  function getBackup(){try{return JSON.parse(localStorage.getItem(backupKey())||'null')}catch{return null}}
  const escapeHtml=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  function inlineFormat(text){let s=escapeHtml(text);s=s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');s=s.replace(/__(.+?)__/g,'<strong>$1</strong>');s=s.replace(/\*([^*\n]+)\*/g,'<em>$1</em>');s=s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2">$1</a>');return s}
  function cleanSource(src){return src.replace(/^:::writing\{[^\n]*\}\s*$/gmi,'').replace(/^:::\s*$/gmi,'').replace(/^```(?:markdown|md|text)?\s*$/gmi,'').replace(/^```\s*$/gmi,'').replace(/\r\n?/g,'\n').trim()}

  function markdownToHtml(src){
    const lines=cleanSource(src).split('\n'),out=[];let para=[],listType=null,listItems=[];
    const flushPara=()=>{if(para.length){out.push(`<p>${inlineFormat(para.map(x=>x.trim()).join('<br>'))}</p>`);para=[]}};
    const flushList=()=>{if(listType&&listItems.length)out.push(`<${listType}>${listItems.map(x=>`<li>${inlineFormat(x)}</li>`).join('')}</${listType}>`);listType=null;listItems=[]};
    for(const raw of lines){const line=raw.trimEnd(),t=line.trim();if(!t){flushPara();flushList();continue}if(/^---+$/.test(t)||/^___+$/.test(t)){flushPara();flushList();out.push('<hr>');continue}
      const big=t.match(/^◆【大見出し】\s*(.+)$/)||t.match(/^#\s+(.+)$/);const small=t.match(/^◇【小見出し】\s*(.+)$/)||t.match(/^##\s+(.+)$/)||t.match(/^###\s+(.+)$/);
      if(big){flushPara();flushList();out.push(`<h2>${inlineFormat(big[1])}</h2>`);continue}if(small){flushPara();flushList();out.push(`<h3>${inlineFormat(small[1])}</h3>`);continue}
      if(/^🔒【ここで有料ライン】/.test(t)||/^\[PAYWALL\]$/i.test(t)){flushPara();flushList();out.push('<p>🔒【ここで有料ライン】</p>');continue}
      const ul=t.match(/^[-*・]\s+(.+)$/);if(ul){flushPara();if(listType&&listType!=='ul')flushList();listType='ul';listItems.push(ul[1]);continue}
      const ol=t.match(/^\d+[\.．]\s*(.+)$/);if(ol){flushPara();if(listType&&listType!=='ol')flushList();listType='ol';listItems.push(ol[1]);continue}
      const q=t.match(/^>\s?(.*)$/);if(q){flushPara();flushList();out.push(`<blockquote>${inlineFormat(q[1])}</blockquote>`);continue}para.push(line)
    }flushPara();flushList();return out.join('')
  }

  function selectAll(editor){const r=document.createRange();r.selectNodeContents(editor);const s=getSelection();s.removeAllRanges();s.addRange(r);editor.focus()}
  function replaceEditorHtml(editor,html){
    saveBackup(editor);selectAll(editor);let ok=false;
    try{ok=document.execCommand('insertHTML',false,html)}catch{}
    if(!ok){try{selectAll(editor);document.execCommand('delete',false);editor.focus();const dt=new DataTransfer();dt.setData('text/html',html);const d=document.createElement('div');d.innerHTML=html;dt.setData('text/plain',d.innerText||'');editor.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));ok=(editor.innerText||'').trim().length>0}catch{}}
    if(!ok){editor.innerHTML=html;editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:null}));editor.dispatchEvent(new Event('change',{bubbles:true}));ok=true}else editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste',data:null}));
    return ok;
  }

  async function restoreBackup(){const editor=await waitForEditor();if(!editor){toast('本文エディタがまだ見つからない');return}const b=getBackup();if(!b){toast('このページのバックアップがない');return}selectAll(editor);let ok=false;try{ok=document.execCommand('insertHTML',false,b.html)}catch{}if(!ok){editor.innerHTML=b.html;editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}))}toast('↩️ 元本文へ戻した')}
  async function readClipboard(){try{return await navigator.clipboard.readText()}catch{return ''}}
  async function ponFromClipboard(){const editor=await waitForEditor();if(!editor){openPanel(true);toast('本文エディタを検出できない。貼付欄から実行してね');return}const src=await readClipboard();if(!src.trim()){openPanel(true);toast('スマホがクリップボード読取を止めたので貼付欄を開いた');return}replaceEditorHtml(editor,markdownToHtml(src));toast('✅ 全消し → 見出し整形 → ポン出し完了')}
  async function ponFromTextarea(){const editor=await waitForEditor();if(!editor){toast('本文エディタが見つからない');return}const ta=document.getElementById(`${APP_ID}-text`);const src=ta?.value||'';if(!src.trim()){toast('原稿を貼ってから押してね');return}replaceEditorHtml(editor,markdownToHtml(src));closePanel();toast('✅ 全消し＋自動整形＋投入 完了')}

  function closePanel(){document.getElementById(`${APP_ID}-panel`)?.remove()}
  function openPanel(showTextarea=true){closePanel();const p=document.createElement('div');p.id=`${APP_ID}-panel`;p.innerHTML=`<div class="mpd-title">📄 note ポン出し v1.2</div><div class="mpd-note">ボタンはもう自動で消えません。スマホでクリップボード読取が使えない時は、下の欄へ原稿を1回貼って「全消し→ポン出し」。旧本文は先にバックアップします。</div>${showTextarea?`<textarea id="${APP_ID}-text" placeholder="ここへ完成原稿を丸ごと貼る"></textarea>`:''}<div class="mpd-row"><button class="mpd-btn mpd-main" id="${APP_ID}-go">🚀 全消し→ポン出し</button><button class="mpd-btn mpd-sub" id="${APP_ID}-clip">📋 クリップボード</button><button class="mpd-btn mpd-danger" id="${APP_ID}-undo">↩️ 元本文へ戻す</button><button class="mpd-btn mpd-sub" id="${APP_ID}-close">閉じる</button></div>`;document.body.appendChild(p);p.querySelector(`#${APP_ID}-close`).onclick=closePanel;p.querySelector(`#${APP_ID}-undo`).onclick=restoreBackup;p.querySelector(`#${APP_ID}-go`).onclick=ponFromTextarea;p.querySelector(`#${APP_ID}-clip`).onclick=ponFromClipboard}

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  function loadPos(){try{return JSON.parse(localStorage.getItem(POS_KEY)||'null')}catch{return null}}
  function savePos(b){const r=b.getBoundingClientRect();try{localStorage.setItem(POS_KEY,JSON.stringify({left:r.left,top:r.top}))}catch{}}
  function applyPos(b){const p=loadPos();if(!p)return;b.style.left=clamp(Number(p.left)||10,4,Math.max(4,innerWidth-62))+'px';b.style.top=clamp(Number(p.top)||Math.round(innerHeight*.36),4,Math.max(4,innerHeight-62))+'px'}
  function enableDrag(b){let sx=0,sy=0,sl=0,st=0,moved=false,pid=null;b.addEventListener('pointerdown',e=>{pid=e.pointerId;moved=false;sx=e.clientX;sy=e.clientY;const r=b.getBoundingClientRect();sl=r.left;st=r.top;b.setPointerCapture?.(pid);b.classList.add('mpd-dragging');e.preventDefault()});b.addEventListener('pointermove',e=>{if(pid!==e.pointerId)return;const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.abs(dx)+Math.abs(dy)>6)moved=true;if(!moved)return;b.style.left=clamp(sl+dx,4,Math.max(4,innerWidth-62))+'px';b.style.top=clamp(st+dy,4,Math.max(4,innerHeight-62))+'px';e.preventDefault()});b.addEventListener('pointerup',e=>{if(pid!==e.pointerId)return;try{b.releasePointerCapture?.(pid)}catch{}b.classList.remove('mpd-dragging');if(moved)savePos(b);else openPanel(true);pid=null;e.preventDefault()});b.addEventListener('pointercancel',()=>{pid=null;b.classList.remove('mpd-dragging')})}

  function mount(){if(document.getElementById(`${APP_ID}-fab`))return;const b=document.createElement('button');b.id=`${APP_ID}-fab`;b.textContent='ポン';b.title='note ポン出し v1.2';document.body.appendChild(b);applyPos(b);enableDrag(b)}
  mount();
  new MutationObserver(()=>mount()).observe(document.documentElement,{childList:true,subtree:true});
})();
