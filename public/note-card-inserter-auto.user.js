// ==UserScript==
// @name         無名S note 極薄カード URL修理 v2.2
// @namespace    https://github.com/mumei-s/note-insight
// @version      2.2.0
// @description  既に入っている極薄カード10枚へ、画像中央の実座標から選択して対応URLを自動設定する修理版
// @match        https://editor.note.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function(){
'use strict';
if(window.__MUMEI_URL_REPAIR_V220__) return;
window.__MUMEI_URL_REPAIR_V220__=true;

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
const PANEL='mumei-url-repair-panel-v220',BTN='mumei-url-repair-btn-v220';
let busy=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function ed(){return document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror')}
function vis(el){if(!el||!el.isConnected)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0}
function status(t,bad=false){const p=document.getElementById(PANEL);if(!p)return;p.textContent=t;p.style.background=bad?'#991b1b':'#111827'}
function cards(){const root=ed();if(!root)return[];return [...root.querySelectorAll('img')].filter(img=>{const r=img.getBoundingClientRect(),w=img.naturalWidth||r.width,h=img.naturalHeight||r.height;return h>0&&w/h>4.5}).slice(-10)}
function xy(el){const r=el.getBoundingClientRect();return {x:Math.max(1,Math.min(innerWidth-2,r.left+r.width/2)),y:Math.max(1,Math.min(innerHeight-2,r.top+r.height/2))}}
function fireAt(target,x,y){
  if(!target)return;
  const common={bubbles:true,cancelable:true,clientX:x,clientY:y,screenX:x,screenY:y,button:0,buttons:1};
  try{target.dispatchEvent(new PointerEvent('pointerdown',{...common,pointerId:1,pointerType:'touch',isPrimary:true,pressure:.5}))}catch(_){}
  try{if(window.Touch&&window.TouchEvent){const t=new Touch({identifier:1,target,clientX:x,clientY:y,screenX:x,screenY:y,pageX:x+scrollX,pageY:y+scrollY,radiusX:1,radiusY:1,rotationAngle:0,force:.5});target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t],targetTouches:[t],changedTouches:[t]}));target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[t]}))}}catch(_){}
  try{target.dispatchEvent(new PointerEvent('pointerup',{...common,pointerId:1,pointerType:'touch',isPrimary:true,pressure:0}))}catch(_){}
  for(const type of ['mousedown','mouseup','click']){try{target.dispatchEvent(new MouseEvent(type,common))}catch(_){}}
  try{HTMLElement.prototype.click.call(target)}catch(_){try{target.click()}catch(__){}}
}
function clickByCenter(el){const p=xy(el),hit=document.elementFromPoint(p.x,p.y)||el;fireAt(hit,p.x,p.y);return hit}
function visibleAlt(){return [...document.querySelectorAll('button,[role="button"],span,div')].find(x=>vis(x)&&(x.textContent||'').trim()==='ALT')||null}
function chainFromAlt(alt){if(!alt)return null;let n=alt;for(let d=0;d<8&&n;d++,n=n.parentElement){const bs=[...n.querySelectorAll('button,[role="button"]')].filter(vis);if(bs.length<4||bs.length>8)continue;bs.sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);const ar=alt.getBoundingClientRect();const left=bs.filter(b=>b.getBoundingClientRect().right<=ar.left+10);if(left.length===1)return left[0];const idx=bs.findIndex(b=>(b.textContent||'').trim()==='ALT');if(idx===1)return bs[0]}return null}
async function selectImage(img){
  img.scrollIntoView({block:'center',behavior:'instant'});await sleep(300);
  const candidates=[];
  const centerHit=clickByCenter(img);candidates.push(centerHit,img,img.parentElement,img.parentElement?.parentElement,img.closest('figure'),img.closest('[contenteditable="false"]'),img.closest('[draggable="true"]'));
  for(const t of [...new Set(candidates.filter(Boolean))]){
    const r=t.getBoundingClientRect();const x=Math.max(1,Math.min(innerWidth-2,r.left+r.width/2)),y=Math.max(1,Math.min(innerHeight-2,r.top+r.height/2));fireAt(t,x,y);
    for(let k=0;k<8;k++){await sleep(120);const alt=visibleAlt();if(alt){const chain=chainFromAlt(alt);if(chain)return chain}}
  }
  return null;
}
function entries(){return [...document.querySelectorAll('input,textarea,[contenteditable="true"]')].filter(el=>{if(!vis(el))return false;if(el instanceof HTMLInputElement)return !['file','button','submit','checkbox','radio','range','color'].includes((el.type||'text').toLowerCase());if(el instanceof HTMLTextAreaElement)return true;return el.getAttribute('contenteditable')==='true'&&!el.classList.contains('ProseMirror')})}
async function newEntry(before){for(let i=0;i<30;i++){const a=document.activeElement;if(a&&!before.has(a)&&entries().includes(a))return a;const f=entries().filter(x=>!before.has(x));if(f.length===1)return f[0];if(f.length>1){const active=f.find(x=>x===document.activeElement);if(active)return active;f.sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height);return f[0]}await sleep(120)}return null}
function setVal(el,v){el.focus();if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement){const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;if(setter)setter.call(el,v);else el.value=v;el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:v}));el.dispatchEvent(new Event('change',{bubbles:true}))}else{el.textContent=v;el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:v}))}}
function enter(el){for(const t of ['keydown','keypress','keyup'])el.dispatchEvent(new KeyboardEvent(t,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}))}
async function one(img,url,n){status(`URL ${n}/10：画像選択中…`);const chain=await selectImage(img);if(!chain)return 0;status(`URL ${n}/10：鎖OK、入力欄待ち…`);const before=new Set(entries());clickByCenter(chain);await sleep(250);const input=await newEntry(before);if(!input)return 1;status(`URL ${n}/10：入力欄OK、URL入力…`);setVal(input,url);await sleep(180);const v=input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement?input.value:input.textContent;if((v||'').trim()!==url)return 2;enter(input);await sleep(650);return 4}
async function run(){if(busy)return;busy=true;const b=document.getElementById(BTN);if(b)b.disabled=true;try{const imgs=cards();if(imgs.length!==10){status(`極薄カードが ${imgs.length}/10枚。10枚ある状態で押して`,true);return}let c=0,i=0,f=0,d=0;for(let n=0;n<10;n++){const s=await one(imgs[n],URLS[n],n+1);if(s>=1)c++;if(s>=2)i++;if(s>=3)f++;if(s>=4)d++;await sleep(200)}status(`結果：鎖 ${c}/10・入力欄 ${i}/10・入力 ${f}/10・確定 ${d}/10`,d<10)}catch(e){status('⚠️ '+(e?.message||String(e)),true)}finally{busy=false;if(b)b.disabled=false}}
function mount(){if(!document.body)return;if(!document.getElementById(PANEL)){const p=document.createElement('div');p.id=PANEL;p.textContent='v2.2：今ある10枚へURLだけ修理';Object.assign(p.style,{position:'fixed',right:'12px',bottom:'78px',zIndex:'2147483646',maxWidth:'360px',padding:'10px 12px',borderRadius:'12px',background:'#111827',color:'#fff',fontSize:'13px',lineHeight:'1.45',boxShadow:'0 6px 20px rgba(0,0,0,.28)',pointerEvents:'none'});document.body.appendChild(p)}if(!document.getElementById(BTN)){const b=document.createElement('button');b.id=BTN;b.type='button';b.textContent='URLだけ修理 v2.2';Object.assign(b.style,{position:'fixed',right:'12px',bottom:'18px',zIndex:'2147483647',border:'0',borderRadius:'12px',padding:'14px 18px',background:'#b45309',color:'#fff',fontSize:'15px',fontWeight:'800',boxShadow:'0 6px 20px rgba(0,0,0,.30)',touchAction:'manipulation'});b.addEventListener('click',run);document.body.appendChild(b)}}
function loop(){mount();setTimeout(loop,1000)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loop,{once:true});else loop();
})();
