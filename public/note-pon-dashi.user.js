// ==UserScript==
// @name         note ポン出し v2｜完全隔離＋挿絵自動
// @namespace    https://github.com/mumei-s/note-insight
// @version      2.0.0
// @description  ChatGPT原稿を一括投入。旧本文バックアップ、全消し、見出し整形、挿絵マーカー自動挿入。Shadow DOMで他UIと競合しにくい。
// @author       無名S note
// @match        https://note.com/*
// @grant        none
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-dashi.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-dashi.user.js
// ==/UserScript==

(() => {
  'use strict';

  const HOST_ID = '__mumei_pon_v2_host__';
  const BACKUP_PREFIX = 'mumei-note-pon-v2-backup:';
  const POS_KEY = 'mumei-note-pon-v2-pos';
  let host, root, selectedFiles = [];

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const clamp = (v,min,max) => Math.max(min, Math.min(max,v));

  function mountHost() {
    if (document.getElementById(HOST_ID)) return;
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;visibility:visible!important;opacity:1!important;';
    (document.documentElement || document).appendChild(host);
    root = host.attachShadow({mode:'closed'});
    root.innerHTML = `
      <style>
        :host{all:initial}
        *{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}
        #fab{position:fixed;left:10px;top:36vh;width:58px;height:58px;border-radius:50%;border:2px solid #39e7d2;background:#07192d;color:#fff;font-weight:900;font-size:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 28px #0009;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none}
        #fab.drag{opacity:.75;transform:scale(1.06)}
        #panel{position:fixed;left:8px;right:8px;top:max(56px,env(safe-area-inset-top));max-width:680px;max-height:calc(100vh - 72px);overflow:auto;margin:auto;background:#081728fa;color:#fff;border:1px solid #37d8ca;border-radius:16px;box-shadow:0 12px 40px #000b;padding:14px;pointer-events:auto}
        .title{font-size:18px;font-weight:900}.note{font-size:12px;line-height:1.55;color:#cbe0ec;margin-top:5px}.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
        button{flex:1;min-width:128px;border:0;border-radius:12px;padding:12px 10px;font-weight:800;font-size:15px}.main{background:#39e7d2;color:#04202a}.sub{background:#17314b;color:#fff;border:1px solid #35546f}.danger{background:#56243a;color:#fff}
        textarea{width:100%;height:36vh;min-height:210px;margin-top:10px;background:#fff;color:#111;border:0;border-radius:12px;padding:12px;font-size:15px;line-height:1.6;resize:vertical}
        input[type=file]{display:none}.filelabel{display:block;margin-top:10px;background:#17314b;border:1px solid #35546f;color:#fff;border-radius:12px;padding:11px;text-align:center;font-weight:800}.status{margin-top:8px;font-size:12px;color:#bfeee8;white-space:pre-wrap}
        #toast{position:fixed;left:50%;top:max(70px,env(safe-area-inset-top));transform:translateX(-50%);background:#061421;color:#fff;border:1px solid #39e7d2;border-radius:999px;padding:10px 16px;font-weight:800;box-shadow:0 6px 24px #0008;max-width:92vw;text-align:center;pointer-events:none}
      </style>
      <div id="fab">ポン</div>
      <div id="panel" hidden>
        <div class="title">📄 note ポン出し v2</div>
        <div class="note">旧本文をバックアップ→全消し→見出し整形→本文投入→挿絵を指定位置へ自動貼付。<br>挿絵位置は <b>[[挿絵1]]</b> / <b>[[挿絵2]]</b> …。画像は順番どおりまとめて1回選択。<br>URL画像は <b>[[IMG:https://...]]</b> で画像選択不要。</div>
        <textarea id="text" placeholder="ここへ完成原稿を丸ごと貼る"></textarea>
        <label class="filelabel" for="files">🖼️ 挿絵をまとめて選ぶ（順番どおり）</label>
        <input id="files" type="file" accept="image/*" multiple>
        <div class="status" id="status">挿絵：未選択</div>
        <div class="row">
          <button class="main" id="go">🚀 全消し→本文＋挿絵ポン</button>
          <button class="sub" id="clip">📋 本文をクリップボードから</button>
          <button class="danger" id="undo">↩️ 元本文へ戻す</button>
          <button class="sub" id="close">閉じる</button>
        </div>
      </div>
      <div id="toast" hidden></div>`;

    bindUi();
    applyPos();
  }

  function q(sel){ return root?.querySelector(sel); }
  function toast(msg, ms=2600){ const t=q('#toast'); if(!t)return; t.textContent=msg; t.hidden=false; clearTimeout(t._tm); t._tm=setTimeout(()=>t.hidden=true,ms); }
  function openPanel(){ q('#panel').hidden=false; }
  function closePanel(){ q('#panel').hidden=true; }

  function bindUi(){
    const fab=q('#fab');
    let sx=0,sy=0,sl=0,st=0,moved=false,pid=null;
    fab.addEventListener('pointerdown',e=>{
      pid=e.pointerId;moved=false;sx=e.clientX;sy=e.clientY;
      const r=fab.getBoundingClientRect();sl=r.left;st=r.top;
      fab.setPointerCapture?.(pid);fab.classList.add('drag');e.preventDefault();
    });
    fab.addEventListener('pointermove',e=>{
      if(e.pointerId!==pid)return;const dx=e.clientX-sx,dy=e.clientY-sy;
      if(Math.abs(dx)+Math.abs(dy)>6)moved=true;if(!moved)return;
      fab.style.left=clamp(sl+dx,4,Math.max(4,innerWidth-62))+'px';
      fab.style.top=clamp(st+dy,4,Math.max(4,innerHeight-62))+'px';e.preventDefault();
    });
    fab.addEventListener('pointerup',e=>{
      if(e.pointerId!==pid)return;fab.classList.remove('drag');
      if(moved)savePos();else openPanel();pid=null;e.preventDefault();
    });
    fab.addEventListener('pointercancel',()=>{pid=null;fab.classList.remove('drag')});

    q('#close').onclick=closePanel;
    q('#undo').onclick=restoreBackup;
    q('#go').onclick=runPon;
    q('#clip').onclick=async()=>{
      try{const s=await navigator.clipboard.readText();if(s){q('#text').value=s;toast('📋 本文を読み込んだ')}else toast('クリップボードが空')}catch{toast('クリップボード読取不可。貼付欄へ直接ペーストしてね')}
    };
    q('#files').addEventListener('change',e=>{
      selectedFiles=[...(e.target.files||[])];
      q('#status').textContent=selectedFiles.length?`挿絵：${selectedFiles.length}枚選択\n${selectedFiles.map((f,i)=>`${i+1}. ${f.name}`).join('\n')}`:'挿絵：未選択';
    });
  }

  function savePos(){const r=q('#fab').getBoundingClientRect();try{localStorage.setItem(POS_KEY,JSON.stringify({left:r.left,top:r.top}))}catch{}}
  function applyPos(){try{const p=JSON.parse(localStorage.getItem(POS_KEY)||'null');if(!p)return;const f=q('#fab');f.style.left=clamp(+p.left||10,4,Math.max(4,innerWidth-62))+'px';f.style.top=clamp(+p.top||Math.round(innerHeight*.36),4,Math.max(4,innerHeight-62))+'px'}catch{}}

  function visible(el){const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>80&&r.height>30&&s.display!=='none'&&s.visibility!=='hidden'}
  function findEditor(){
    const sels=['.ProseMirror','[contenteditable="true"][role="textbox"]','article [contenteditable="true"]','div[contenteditable="true"]'];
    const els=[...new Set(sels.flatMap(s=>[...document.querySelectorAll(s)]))].filter(visible);
    if(!els.length)return null;
    return els.map(el=>{const r=el.getBoundingClientRect();let score=r.width*r.height+(el.innerText||'').length*150;if(String(el.className).includes('ProseMirror'))score+=1e6;return{el,score}}).sort((a,b)=>b.score-a.score)[0].el;
  }
  async function waitEditor(ms=4000){const end=Date.now()+ms;while(Date.now()<end){const e=findEditor();if(e)return e;await sleep(120)}return null}

  const backupKey=()=>BACKUP_PREFIX+location.pathname;
  function saveBackup(ed){try{localStorage.setItem(backupKey(),JSON.stringify({html:ed.innerHTML,time:Date.now(),url:location.href}))}catch{}}
  function getBackup(){try{return JSON.parse(localStorage.getItem(backupKey())||'null')}catch{return null}}

  function inlineFormat(s){
    let x=esc(s);x=x.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/__(.+?)__/g,'<strong>$1</strong>').replace(/\*([^*\n]+)\*/g,'<em>$1</em>').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2">$1</a>');return x;
  }
  function cleanSource(src){return src.replace(/^:::writing\{[^\n]*\}\s*$/gmi,'').replace(/^:::\s*$/gmi,'').replace(/^```(?:markdown|md|text)?\s*$/gmi,'').replace(/^```\s*$/gmi,'').replace(/\r\n?/g,'\n').trim()}

  function parseSource(src){
    const urls=[];let localMax=0;
    const lines=cleanSource(src).split('\n'),out=[];let para=[],listType=null,list=[];
    const flushP=()=>{if(para.length){out.push(`<p>${inlineFormat(para.map(x=>x.trim()).join('<br>'))}</p>`);para=[]}};
    const flushL=()=>{if(listType&&list.length)out.push(`<${listType}>${list.map(x=>`<li>${inlineFormat(x)}</li>`).join('')}</${listType}>`);listType=null;list=[]};
    for(const raw of lines){const line=raw.trimEnd(),t=line.trim();if(!t){flushP();flushL();continue}
      let m=t.match(/^\[\[挿絵(\d+)\]\]$/);if(m){flushP();flushL();const n=+m[1];localMax=Math.max(localMax,n);out.push(`<p>__MUMEI_IMG_LOCAL_${n}__</p>`);continue}
      m=t.match(/^\[\[IMG:(https?:\/\/[^\]]+)\]\]$/i)||t.match(/^\[\[挿絵:(https?:\/\/[^\]]+)\]\]$/i);if(m){flushP();flushL();const id=urls.length;urls.push(m[1]);out.push(`<p>__MUMEI_IMG_URL_${id}__</p>`);continue}
      if(/^---+$/.test(t)||/^___+$/.test(t)){flushP();flushL();out.push('<hr>');continue}
      const big=t.match(/^◆【大見出し】\s*(.+)$/)||t.match(/^#\s+(.+)$/);const small=t.match(/^◇【小見出し】\s*(.+)$/)||t.match(/^##\s+(.+)$/)||t.match(/^###\s+(.+)$/);
      if(big){flushP();flushL();out.push(`<h2>${inlineFormat(big[1])}</h2>`);continue}if(small){flushP();flushL();out.push(`<h3>${inlineFormat(small[1])}</h3>`);continue}
      if(/^🔒【ここで有料ライン】/.test(t)||/^\[PAYWALL\]$/i.test(t)){flushP();flushL();out.push('<p>🔒【ここで有料ライン】</p>');continue}
      const ul=t.match(/^[-*・]\s+(.+)$/);if(ul){flushP();if(listType&&listType!=='ul')flushL();listType='ul';list.push(ul[1]);continue}
      const ol=t.match(/^\d+[\.．]\s*(.+)$/);if(ol){flushP();if(listType&&listType!=='ol')flushL();listType='ol';list.push(ol[1]);continue}
      const qt=t.match(/^>\s?(.*)$/);if(qt){flushP();flushL();out.push(`<blockquote>${inlineFormat(qt[1])}</blockquote>`);continue}
      para.push(line);
    }flushP();flushL();return {html:out.join(''),urls,localMax};
  }

  function selectNodeText(node){const r=document.createRange();r.selectNodeContents(node);const s=getSelection();s.removeAllRanges();s.addRange(r);node.closest('[contenteditable="true"]')?.focus()}
  function replaceEditorHtml(ed,html){saveBackup(ed);const r=document.createRange();r.selectNodeContents(ed);const s=getSelection();s.removeAllRanges();s.addRange(r);ed.focus();let ok=false;try{ok=document.execCommand('insertHTML',false,html)}catch{}if(!ok){ed.innerHTML=html;ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));ed.dispatchEvent(new Event('change',{bubbles:true}))}else ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'}));}

  async function urlToFile(url,index){const res=await fetch(url,{mode:'cors'});if(!res.ok)throw new Error('画像取得 '+res.status);const blob=await res.blob();const ext=(blob.type.split('/')[1]||'png').replace('jpeg','jpg');return new File([blob],`pon-${index+1}.${ext}`,{type:blob.type||'image/png'})}
  async function pasteImageAtMarker(ed,markerText,file){
    const nodes=[...ed.querySelectorAll('p,div')].filter(n=>(n.textContent||'').trim()===markerText);
    const marker=nodes[0];if(!marker)return false;
    selectNodeText(marker);
    let dispatched=false;
    try{const dt=new DataTransfer();dt.items.add(file);const ev=new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true});dispatched=marker.dispatchEvent(ev)===false||ev.defaultPrevented}catch{}
    await sleep(1200);
    if((marker.textContent||'').trim()===markerText){
      try{const dataUrl=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(file)});selectNodeText(marker);document.execCommand('insertHTML',false,`<img src="${dataUrl}" alt="">`);marker.remove();ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'}));await sleep(600);return true}catch{return dispatched}
    }
    return true;
  }

  async function runPon(){
    const src=q('#text').value||'';if(!src.trim()){toast('原稿を貼ってね');return}
    const ed=await waitEditor();if(!ed){toast('本文エディタが見つからない');return}
    const parsed=parseSource(src);
    if(parsed.localMax>selectedFiles.length){toast(`挿絵${parsed.localMax}まで指定あり。画像は${selectedFiles.length}枚だけ`);return}
    q('#status').textContent='本文を入れています…';
    replaceEditorHtml(ed,parsed.html);await sleep(700);
    let done=0,fail=0;
    for(let i=1;i<=parsed.localMax;i++){
      q('#status').textContent=`挿絵 ${i}/${parsed.localMax} を挿入中…`;
      const ok=await pasteImageAtMarker(ed,`__MUMEI_IMG_LOCAL_${i}__`,selectedFiles[i-1]);ok?done++:fail++;
    }
    for(let i=0;i<parsed.urls.length;i++){
      q('#status').textContent=`URL挿絵 ${i+1}/${parsed.urls.length} を挿入中…`;
      try{const f=await urlToFile(parsed.urls[i],i);const ok=await pasteImageAtMarker(ed,`__MUMEI_IMG_URL_${i}__`,f);ok?done++:fail++}catch{fail++}
    }
    q('#status').textContent=`完了：本文＋挿絵 ${done}枚${fail?` / 失敗 ${fail}枚`:''}`;
    toast(fail?'⚠️ 本文完了。挿絵に失敗あり':'✅ 本文＋見出し＋挿絵までポン出し完了',4000);
  }

  async function restoreBackup(){const ed=await waitEditor();if(!ed){toast('本文エディタが見つからない');return}const b=getBackup();if(!b){toast('バックアップなし');return}const r=document.createRange();r.selectNodeContents(ed);const s=getSelection();s.removeAllRanges();s.addRange(r);ed.focus();let ok=false;try{ok=document.execCommand('insertHTML',false,b.html)}catch{}if(!ok){ed.innerHTML=b.html;ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}))}toast('↩️ 元本文へ戻した')}

  function watchdog(){
    if(!document.getElementById(HOST_ID)) mountHost();
    setTimeout(watchdog,1200);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mountHost,{once:true}); else mountHost();
  setTimeout(watchdog,1400);
})();
