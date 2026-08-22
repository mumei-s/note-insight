// ==UserScript==
// @name         無名S note 極薄カード URL修理 v2.3
// @namespace    https://github.com/mumei-s/note-insight
// @version      2.3.0
// @description  既存の極薄カード10枚へ、ALT直前の鎖ボタンを厳密指定して対応URLを自動設定
// @match        https://editor.note.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function(){
'use strict';
if(window.__MUMEI_URL_REPAIR_V230__) return;
window.__MUMEI_URL_REPAIR_V230__=true;

const URLS=[
'https://note.com/ss_yr/n/nc14eb3f2ea9f',
'https://note.com/ss_yr/n/na8cf287a7152',
'https://note.com/ss_yr/n/nafb8a53d1fe7',
'https://note.com/ss_yr/n/nca7a49a69d3c',
'https://note.com/ss_yr/n/n752f333ddd80',
'https://note.com/ss_yr/n/n426982b5d60b',
'https://note.com/ss_yr/n/n20f58cb3ec59',
'https://note.com/ss_yr/n/n5cda670acdcf',
'https://note.com/ss_yr/n/n2dfac2d0b184',
'https://note.com/ss_yr/n/na51322616876'
];
const PANEL='mumei-url-repair-panel-v230',BTN='mumei-url-repair-btn-v230';
const OLD=[
'mumei-batch10-full-auto-v2','mumei-batch10-full-auto-panel-v2',
'mumei-batch10-v210','mumei-batch10-repair-v210','mumei-batch10-panel-v210',
'mumei-url-repair-panel-v220','mumei-url-repair-btn-v220'
];
let busy=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function ed(){return document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror')}
function vis(el){if(!el||!el.isConnected)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0}
function status(t,bad=false){const p=document.getElementById(PANEL);if(!p)return;p.textContent=t;p.style.background=bad?'#991b1b':'#111827'}
function cards(){const root=ed();if(!root)return[];return [...root.querySelectorAll('img')].filter(img=>{const r=img.getBoundingClientRect(),w=img.naturalWidth||r.width,h=img.naturalHeight||r.height;return h>0&&w/h>4.5}).slice(-10)}
function center(el){const r=el.getBoundingClientRect();return{x:Math.max(2,Math.min(innerWidth-3,r.left+r.width/2)),y:Math.max(2,Math.min(innerHeight-3,r.top+r.height/2))}}
function fire(target,x,y){if(!target)return;const common={bubbles:true,cancelable:true,clientX:x,clientY:y,screenX:x,screenY:y,button:0,buttons:1};try{target.dispatchEvent(new PointerEvent('pointerdown',{...common,pointerId:1,pointerType:'touch',isPrimary:true,pressure:.5}))}catch(_){}try{target.dispatchEvent(new PointerEvent('pointerup',{...common,pointerId:1,pointerType:'touch',isPrimary:true,pressure:0}))}catch(_){}for(const t of ['mousedown','mouseup','click']){try{target.dispatchEvent(new MouseEvent(t,common))}catch(_){}}try{target.click()}catch(_){}}
function tapCenter(el){const p=center(el),hit=document.elementFromPoint(p.x,p.y)||el;fire(hit,p.x,p.y);return hit}
function near(a,b){const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();const ax=ar.left+ar.width/2,ay=ar.top+ar.height/2,bx=br.left+br.width/2,by=br.top+br.height/2;return Math.abs(ax-bx)<Math.max(380,br.width/2+160)&&Math.abs(ay-by)<320}
function altButtonNear(img){return [...document.querySelectorAll('button,[role="button"]')].filter(vis).find(b=>(b.textContent||'').trim()==='ALT'&&near(b,img))||null}
function chainImmediatelyBeforeAlt(alt){if(!alt)return null;let n=alt.parentElement;for(let d=0;d<7&&n;d++,n=n.parentElement){const buttons=[...n.querySelectorAll('button,[role="button"]')].filter(vis);if(buttons.length<4||buttons.length>8||!buttons.includes(alt))continue;buttons.sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);const idx=buttons.indexOf(alt);if(idx<=0)continue;const prev=buttons[idx-1];if((prev.textContent||'').trim()==='ALT')continue;if(prev.getBoundingClientRect().right<=alt.getBoundingClientRect().left+14)return prev;}return null}
async function selectAndChain(img){
  img.scrollIntoView({block:'center',behavior:'instant'});await sleep(250);
  // まず1回だけ、実際に指で画像中央を押す位置をタップ。
  tapCenter(img);
  for(let i=0;i<12;i++){
    await sleep(120);
    const alt=altButtonNear(img);
    if(alt){
      // ALTが出た時点で画像選択は成功。ここから他の場所は絶対に触らない。
      return chainImmediatelyBeforeAlt(alt);
    }
  }
  // 中央のヒット要素で反応しない場合だけ、画像要素そのものを1回だけ。
  const p=center(img);fire(img,p.x,p.y);
  for(let i=0;i<12;i++){
    await sleep(120);
    const alt=altButtonNear(img);
    if(alt)return chainImmediatelyBeforeAlt(alt);
  }
  return null;
}
function entries(){return [...document.querySelectorAll('input,textarea,[contenteditable="true"]')].filter(el=>{if(!vis(el))return false;if(el instanceof HTMLInputElement)return !['file','button','submit','checkbox','radio','range','color'].includes((el.type||'text').toLowerCase());if(el instanceof HTMLTextAreaElement)return true;return el.getAttribute('contenteditable')==='true'&&!el.classList.contains('ProseMirror')})}
async function freshEntry(before){for(let i=0;i<30;i++){const a=document.activeElement;if(a&&!before.has(a)&&entries().includes(a))return a;const f=entries().filter(x=>!before.has(x));if(f.length===1)return f[0];if(f.length>1){const active=f.find(x=>x===document.activeElement);if(active)return active;f.sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height);return f[0]}await sleep(120)}return null}
function setVal(el,v){el.focus();if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement){const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;if(setter)setter.call(el,v);else el.value=v;el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:v}));el.dispatchEvent(new Event('change',{bubbles:true}))}else{el.textContent=v;el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:v}))}}
function enter(el){for(const t of ['keydown','keypress','keyup'])el.dispatchEvent(new KeyboardEvent(t,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}))}
async function one(img,url,n){
  status(`${n}/10 画像選択…`);
  const chain=await selectAndChain(img);
  if(!chain)return 0;
  status(`${n}/10 鎖→URL欄…`);
  const before=new Set(entries());
  tapCenter(chain);await sleep(250);
  const input=await freshEntry(before);
  if(!input)return 1;
  setVal(input,url);await sleep(180);
  const v=input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement?input.value:input.textContent;
  if((v||'').trim()!==url)return 2;
  enter(input);await sleep(650);
  return 4;
}
async function run(){
  if(busy)return;busy=true;const b=document.getElementById(BTN);if(b)b.disabled=true;
  try{
    const imgs=cards();if(imgs.length!==10){status(`カード ${imgs.length}/10`,true);return}
    // 1枚目が鎖まで通らなければ、その場で停止。10枚全部を誤操作しない。
    let c=0,i=0,f=0,d=0;
    for(let n=0;n<10;n++){
      const s=await one(imgs[n],URLS[n],n+1);
      if(s>=1)c++;if(s>=2)i++;if(s>=3)f++;if(s>=4)d++;
      if(n===0&&s<4){status(`1枚目で停止：鎖 ${c}/1・入力欄 ${i}/1・入力 ${f}/1・確定 ${d}/1`,true);return}
      await sleep(200);
    }
    status(`完了：鎖 ${c}/10・入力欄 ${i}/10・入力 ${f}/10・確定 ${d}/10`,d<10);
  }catch(e){status('⚠️ '+(e?.message||String(e)),true)}finally{busy=false;if(b)b.disabled=false}
}
function hideOld(){
  if(!document.getElementById('mumei-hide-old-ui-v230')){
    const st=document.createElement('style');st.id='mumei-hide-old-ui-v230';st.textContent=OLD.map(id=>`#${id}{display:none!important}`).join('\n');document.documentElement.appendChild(st);
  }
  OLD.forEach(id=>{const x=document.getElementById(id);if(x)x.style.setProperty('display','none','important')});
}
function mount(){if(!document.body)return;hideOld();if(!document.getElementById(PANEL)){const p=document.createElement('div');p.id=PANEL;p.textContent='URL修理 v2.3';Object.assign(p.style,{position:'fixed',right:'8px',bottom:'58px',zIndex:'2147483646',maxWidth:'230px',padding:'6px 8px',borderRadius:'8px',background:'#111827',color:'#fff',fontSize:'11px',lineHeight:'1.3',boxShadow:'0 4px 12px rgba(0,0,0,.25)',pointerEvents:'none'});document.body.appendChild(p)}if(!document.getElementById(BTN)){const b=document.createElement('button');b.id=BTN;b.type='button';b.textContent='URL修理 v2.3';Object.assign(b.style,{position:'fixed',right:'8px',bottom:'10px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'10px 13px',background:'#b45309',color:'#fff',fontSize:'13px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});b.addEventListener('click',run);document.body.appendChild(b)}}
function loop(){mount();setTimeout(loop,800)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loop,{once:true});else loop();
})();
