// ==UserScript==
// @name         無名S note 極薄カード10枚一括完全自動
// @namespace    https://github.com/mumei-s/note-insight
// @version      2.1.0
// @description  10枚一括挿入＋対応URL自動設定。既に入った10枚へURLだけ再設定も可能
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @connect      assets.st-note.com
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';
  if (window.__MUMEI_BATCH10_V210__) return;
  window.__MUMEI_BATCH10_V210__ = true;

  const BUTTON_ID='mumei-batch10-v210';
  const REPAIR_ID='mumei-batch10-repair-v210';
  const PANEL_ID='mumei-batch10-panel-v210';
  const CREATOR='無名S note';
  const OLD_IDS=['mumei-batch10-full-auto-v2','mumei-batch10-full-auto-panel-v2'];

  const ITEMS=[
    ['https://note.com/ss_yr/n/nc14eb3f2ea9f','【言葉と行動、その間にあるもの】 第2回スキ動画コンテスト『夏の陣』🏖'],
    ['https://note.com/ss_yr/n/na8cf287a7152','忘れたくない夏を、ひとつ増やした。【#あいびよりあそび】'],
    ['https://note.com/ss_yr/n/nafb8a53d1fe7','『営業パパ クリエイター図鑑』│無名S note【クリエイター名鑑〇〇編】'],
    ['https://note.com/ss_yr/n/nca7a49a69d3c','【時を閉じ込める番人】│コングラ◯◯冠⁉️『クリエイター名鑑』'],
    ['https://note.com/ss_yr/n/n752f333ddd80','鬼もほどける艶ポーズ👹【スイ式 AI創作レシピ】で描くヨガ道場 📔貼り付け小さくしてみた。'],
    ['https://note.com/ss_yr/n/n426982b5d60b','彗星、縫ってます。☄️そのフォロー外し… 見えてるよ🧐'],
    ['https://note.com/ss_yr/n/n20f58cb3ec59','【TEnGU】'],
    ['https://note.com/ss_yr/n/n5cda670acdcf','【書いた言葉が、朝の部屋から飛び立つまで】 210000PV＆32000スキ達成'],
    ['https://note.com/ss_yr/n/n2dfac2d0b184',"( 'ω'o[おしらせ]o【業界保有数No.1⁉️】"],
    ['https://note.com/ss_yr/n/na51322616876','【企画📝】あなたが、まだ名前をつけていないもの。 共同マガジンの引き継ぎのお知らせ']
  ].map(([url,title],i)=>({url,title,index:i+1}));

  let armed=false,consumed=false,files=[],beforeInputs=new Set(),beforeImages=new Set(),timeoutId=null,busyRepair=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function getEditor(){return document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror')}
  function visible(el){if(!el||!el.isConnected)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0}
  function status(text,bad=false){const p=document.getElementById(PANEL_ID);if(!p)return;p.textContent=text;p.style.background=bad?'#7f1d1d':'#111827'}
  function xhr(url,responseType='text'){return new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'GET',url,responseType,timeout:25000,onload:r=>r.status>=200&&r.status<300?resolve(r.response):reject(new Error('取得失敗 '+r.status)),onerror:()=>reject(new Error('通信失敗')),ontimeout:()=>reject(new Error('通信タイムアウト'))}))}
  function imageInput(input){if(!(input instanceof HTMLInputElement)||input.type!=='file')return false;const a=(input.accept||'').toLowerCase();return !a||a.includes('image')||a.includes('.png')||a.includes('.jpg')||a.includes('.jpeg')}
  function metaContent(html,property){const doc=new DOMParser().parseFromString(html,'text/html');return doc.querySelector(`meta[property="${property}"]`)?.content||doc.querySelector(`meta[name="${property}"]`)?.content||''}
  async function getThumb(url){const html=await xhr(url,'text'),thumb=metaContent(html,'og:image');if(!thumb)throw new Error('サムネ取得失敗');return thumb}
  async function blobToBitmap(blob){if('createImageBitmap'in window)return await createImageBitmap(blob);return await new Promise((resolve,reject)=>{const img=new Image(),u=URL.createObjectURL(blob);img.onload=()=>{URL.revokeObjectURL(u);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('画像読込失敗'))};img.src=u})}
  function roundRect(c,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+rr,y);c.arcTo(x+w,y,x+w,y+h,rr);c.arcTo(x+w,y+h,x,y+h,rr);c.arcTo(x,y+h,x,y,rr);c.arcTo(x,y,x+w,y,rr);c.closePath()}
  function fitTextLines(c,text,maxWidth,maxLines){const chars=[...text],lines=[];let line='';for(const ch of chars){const test=line+ch;if(c.measureText(test).width>maxWidth&&line){lines.push(line);line=ch;if(lines.length===maxLines-1)break}else line=test}if(lines.length<maxLines&&line){const used=lines.join('').length;let rest=[...text].slice(used).join('');if(c.measureText(rest).width>maxWidth){while(rest&&c.measureText(rest+'…').width>maxWidth)rest=rest.slice(0,-1);rest+='…'}lines.push(rest)}return lines.slice(0,maxLines)}
  async function makeCard(item){const thumbUrl=await getThumb(item.url),thumbBlob=await xhr(thumbUrl,'blob'),bmp=await blobToBitmap(thumbBlob),W=1160,H=192,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,W,H);c.strokeStyle='#ddd';c.lineWidth=2;roundRect(c,1,1,W-2,H-2,20);c.stroke();const leftW=700;c.fillStyle='#151a21';c.font='700 28px system-ui, sans-serif';c.textBaseline='top';fitTextLines(c,item.title,leftW-44,2).forEach((line,i)=>c.fillText(line,24,18+i*38));c.fillStyle='#555d69';c.font='22px system-ui, sans-serif';c.fillText(CREATOR,24,148);const bx=718,by=18,bw=424,bh=156;c.fillStyle='#fff';c.fillRect(bx,by,bw,bh);const iw=bmp.width||bmp.naturalWidth,ih=bmp.height||bmp.naturalHeight,scale=Math.min(bw/iw,bh/ih),dw=iw*scale,dh=ih*scale;c.drawImage(bmp,bx+(bw-dw)/2,by+(bh-dh)/2,dw,dh);if(bmp.close)bmp.close();const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('カード生成失敗')),'image/png',1));return new File([blob],String(item.index).padStart(2,'0')+'.png',{type:'image/png'})}
  async function prepare(){const out=[];for(let i=0;i<ITEMS.length;i++){status(`カード準備中 ${i+1}/10…`);out.push(await makeCard(ITEMS[i]))}return out}
  function reset(msg,bad=false){armed=false;consumed=false;files=[];beforeInputs=new Set();if(timeoutId)clearTimeout(timeoutId);timeoutId=null;if(msg)status(msg,bad)}
  async function waitNewImages(timeout=45000){const ed=getEditor();if(!ed)return[];const end=Date.now()+timeout;while(Date.now()<end){const added=[...ed.querySelectorAll('img')].filter(x=>!beforeImages.has(x));if(added.length>=10)return added;await sleep(400)}return [...ed.querySelectorAll('img')].filter(x=>!beforeImages.has(x))}

  function fakeEvent(target,currentTarget,type='click'){
    return {type,target,currentTarget,nativeEvent:new MouseEvent(type,{bubbles:true,cancelable:true}),button:0,buttons:1,detail:1,isTrusted:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},stopPropagation(){},persist(){},isDefaultPrevented(){return this.defaultPrevented},isPropagationStopped(){return false}};
  }
  function invokeReact(el,names=['onClick']){
    let n=el;
    for(let depth=0;depth<8&&n;depth++,n=n.parentElement){
      const keys=Object.keys(n).filter(k=>k.startsWith('__reactProps$'));
      for(const key of keys){
        const props=n[key];if(!props)continue;
        for(const name of names){
          if(typeof props[name]==='function'){
            try{props[name](fakeEvent(el,n,name==='onClick'?'click':'pointerdown'));return true}catch(e){console.debug('react handler error',e)}
          }
        }
      }
    }
    return false;
  }
  function tap(el){if(!el)return;try{el.scrollIntoView({block:'center',behavior:'instant'})}catch(_){}for(const type of ['pointerdown','pointerup']){try{el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',isPrimary:true}))}catch(_){}}for(const type of ['mousedown','mouseup','click']){try{el.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true}))}catch(_){}}try{if(typeof el.click==='function')el.click()}catch(_){}}
  async function activate(el){tap(el);await sleep(180);invokeReact(el,['onClick','onPointerUp','onPointerDown','onMouseUp','onMouseDown']);}

  function altToolbar(img){const ir=img.getBoundingClientRect(),alts=[...document.querySelectorAll('button,[role="button"],span,div')].filter(visible).filter(e=>(e.textContent||'').trim()==='ALT');for(const alt of alts){let n=alt;for(let d=0;d<8&&n;d++,n=n.parentElement){const bs=[...n.querySelectorAll('button,[role="button"]')].filter(visible);if(bs.length<4||bs.length>8)continue;const nr=n.getBoundingClientRect(),gap=ir.top-nr.bottom,overlap=Math.min(nr.right,ir.right)-Math.max(nr.left,ir.left)>15;if(!overlap||gap<-50||gap>260||nr.height>180)continue;bs.sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);const ar=alt.getBoundingClientRect(),left=bs.filter(b=>b.getBoundingClientRect().right<=ar.left+12);if(left.length===1)return left[0];const idx=bs.findIndex(b=>(b.textContent||'').trim()==='ALT');if(idx===1)return bs[0]}}return null}
  async function selectAndFindLink(img){
    const targets=[img,img.closest('figure'),img.closest('[contenteditable="false"]'),img.closest('[draggable="true"]'),img.parentElement,img.parentElement?.parentElement,img.parentElement?.parentElement?.parentElement,img.closest('[data-node-view-wrapper]')].filter(Boolean);
    const uniq=[...new Set(targets)];
    for(const t of uniq){
      await activate(t);await sleep(350);
      for(let k=0;k<5;k++){const b=altToolbar(img);if(b)return b;await sleep(120)}
    }
    return null;
  }
  function textEntries(){return [...document.querySelectorAll('input,textarea,[contenteditable="true"]')].filter(el=>{if(!visible(el))return false;if(el instanceof HTMLInputElement)return !['file','button','submit','checkbox','radio','range','color'].includes((el.type||'text').toLowerCase());if(el instanceof HTMLTextAreaElement)return true;return el.getAttribute('contenteditable')==='true'&&!el.classList.contains('ProseMirror')})}
  async function freshEntry(before){for(let i=0;i<35;i++){const a=document.activeElement;if(a&&!before.has(a)&&textEntries().includes(a))return a;const fresh=textEntries().filter(x=>!before.has(x));if(fresh.length===1)return fresh[0];if(fresh.length>1){const f=fresh.find(x=>x===document.activeElement);if(f)return f;fresh.sort((a,b)=>{const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return ar.width*ar.height-br.width*br.height});return fresh[0]}await sleep(120)}return null}
  function setValue(el,v){el.focus();if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement){const p=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,s=Object.getOwnPropertyDescriptor(p,'value')?.set;if(s)s.call(el,v);else el.value=v;el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:v}));el.dispatchEvent(new Event('change',{bubbles:true}))}else{el.textContent=v;el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:v}))}}
  function enter(el){for(const type of ['keydown','keypress','keyup'])el.dispatchEvent(new KeyboardEvent(type,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));invokeReact(el,['onKeyDown','onKeyPress','onKeyUp'])}

  async function linkOne(img,url,n){
    status(`URL設定中 ${n}/10…`);
    const btn=await selectAndFindLink(img);
    if(!btn)return {stage:0};
    const before=new Set(textEntries());
    await activate(btn);await sleep(250);
    const input=await freshEntry(before);
    if(!input)return {stage:1};
    setValue(input,url);await sleep(180);
    const value=(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement)?input.value:input.textContent;
    if((value||'').trim()!==url)return {stage:2};
    enter(input);await sleep(700);
    const a=img.closest('a[href]')||img.parentElement?.closest('a[href]');
    if(a){try{if(new URL(a.href,location.href).href===new URL(url).href)return {stage:4}}catch(_){}}
    if(!visible(input))return {stage:4};
    return {stage:3};
  }
  async function linkAll(imgs){
    let toolbar=0,input=0,filled=0,done=0;
    for(let i=0;i<Math.min(10,imgs.length);i++){
      const r=await linkOne(imgs[i],ITEMS[i].url,i+1);
      if(r.stage>=1)toolbar++;
      if(r.stage>=2)input++;
      if(r.stage>=3)filled++;
      if(r.stage>=4)done++;
      await sleep(250);
    }
    return {toolbar,input,filled,done};
  }

  function findCurrentCards(){
    const ed=getEditor();if(!ed)return[];
    const all=[...ed.querySelectorAll('img')].filter(img=>{
      const w=img.naturalWidth||img.getBoundingClientRect().width,h=img.naturalHeight||img.getBoundingClientRect().height;
      return h>0&&w/h>4.5;
    });
    return all.slice(-10);
  }
  async function repairUrls(){
    if(busyRepair)return;
    busyRepair=true;
    const b=document.getElementById(REPAIR_ID);if(b)b.disabled=true;
    try{
      const imgs=findCurrentCards();
      if(imgs.length<10){status(`極薄カードを${imgs.length}枚しか見つけられません`,true);return}
      status('今ある10枚へURLだけ再設定中…');
      const r=await linkAll(imgs);
      status(`URL再試行：鎖 ${r.toolbar}/10・入力欄 ${r.input}/10・入力 ${r.filled}/10・確定 ${r.done}/10`,r.done<10);
    }catch(e){status('⚠️ '+(e?.message||String(e)),true)}finally{busyRepair=false;if(b)b.disabled=false}
  }

  async function inject(input){if(!armed||consumed||!files.length||!imageInput(input)||beforeInputs.has(input))return false;consumed=true;armed=false;if(timeoutId)clearTimeout(timeoutId);timeoutId=null;const send=files;files=[];try{const dt=new DataTransfer();send.forEach(f=>dt.items.add(f));input.files=dt.files;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));status('10枚を一括挿入中…');const imgs=await waitNewImages();if(!imgs.length)throw new Error('画像挿入を確認できませんでした');const r=await linkAll(imgs);consumed=false;status(`完了：画像 ${imgs.length}/10・鎖 ${r.toolbar}/10・URL確定 ${r.done}/10`,r.done<Math.min(10,imgs.length));return true}catch(e){consumed=false;status('⚠️ '+(e?.message||String(e)),true);return false}}
  const observer=new MutationObserver(ms=>{if(!armed||consumed)return;for(const m of ms)for(const node of m.addedNodes){if(!(node instanceof Element))continue;if(imageInput(node)){inject(node);return}for(const input of node.querySelectorAll?.('input[type="file"]')||[]){if(imageInput(input)){inject(input);return}}}});
  function startObs(){if(!document.documentElement)return setTimeout(startObs,50);observer.observe(document.documentElement,{childList:true,subtree:true})}startObs();
  const nativeClick=HTMLInputElement.prototype.click;HTMLInputElement.prototype.click=function(...args){if(armed&&!consumed&&imageInput(this)&&!beforeInputs.has(this)){inject(this);return}return nativeClick.apply(this,args)};
  async function arm(){const b=document.getElementById(BUTTON_ID);if(b)b.disabled=true;try{const ed=getEditor();if(!ed)throw new Error('note本文欄が見つかりません');reset();beforeImages=new Set(ed.querySelectorAll('img'));files=await prepare();beforeInputs=new Set(document.querySelectorAll('input[type="file"]'));armed=true;consumed=false;status('準備OK。本文をタップ → noteの「＋」→「画像」を1回だけ押してください');timeoutId=setTimeout(()=>{if(armed)reset('時間切れ。もう一度「10枚一括自動」を押してください',true)},60000)}catch(e){reset('⚠️ '+(e?.message||String(e)),true)}finally{if(b)b.disabled=false}}

  function removeOld(){for(const id of OLD_IDS){const el=document.getElementById(id);if(el)el.remove()}}
  function mount(){
    if(!document.body)return;removeOld();
    if(!document.getElementById(PANEL_ID)){const p=document.createElement('div');p.id=PANEL_ID;p.textContent='v2.1：今の10枚は「URLだけ再試行」でOK';Object.assign(p.style,{position:'fixed',right:'12px',bottom:'130px',zIndex:'2147483646',maxWidth:'350px',padding:'9px 11px',borderRadius:'10px',background:'#111827',color:'#fff',fontSize:'12px',lineHeight:'1.45',boxShadow:'0 4px 18px rgba(0,0,0,.25)',pointerEvents:'none'});document.body.appendChild(p)}
    if(!document.getElementById(REPAIR_ID)){const b=document.createElement('button');b.id=REPAIR_ID;b.type='button';b.textContent='URLだけ再試行 v2.1';Object.assign(b.style,{position:'fixed',right:'12px',bottom:'72px',zIndex:'2147483647',border:'0',borderRadius:'12px',padding:'12px 16px',background:'#b45309',color:'#fff',fontSize:'14px',fontWeight:'800',boxShadow:'0 5px 20px rgba(0,0,0,.30)',touchAction:'manipulation'});b.addEventListener('click',repairUrls);document.body.appendChild(b)}
    if(!document.getElementById(BUTTON_ID)){const b=document.createElement('button');b.id=BUTTON_ID;b.type='button';b.textContent='10枚一括自動 v2.1';Object.assign(b.style,{position:'fixed',right:'12px',bottom:'16px',zIndex:'2147483647',border:'0',borderRadius:'12px',padding:'12px 16px',background:'#0f766e',color:'#fff',fontSize:'14px',fontWeight:'800',boxShadow:'0 5px 20px rgba(0,0,0,.30)',touchAction:'manipulation'});b.addEventListener('click',arm);document.body.appendChild(b)}
  }
  function loop(){mount();setTimeout(loop,1000)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loop,{once:true});else loop();
})();
