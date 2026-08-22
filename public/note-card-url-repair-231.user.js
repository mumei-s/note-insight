// ==UserScript==
// @name         無名S note URL修理 NEW 2.3.1
// @namespace    https://github.com/mumei-s/note-insight/url-repair-new
// @version      2.3.1
// @description  既存の極薄カード10枚へ対応URLを設定。旧UIを強制非表示し、ALT直前の鎖ボタンを直接クリックする専用版
// @match        https://editor.note.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function(){
'use strict';
if(window.__MUMEI_URL_REPAIR_NEW_231__) return;
window.__MUMEI_URL_REPAIR_NEW_231__=true;

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

const PANEL='mumei-url-repair-new231-panel';
const BTN='mumei-url-repair-new231-btn';
const OLD_IDS=[
'mumei-batch10-full-auto-v2','mumei-batch10-full-auto-panel-v2',
'mumei-batch10-v210','mumei-batch10-repair-v210','mumei-batch10-panel-v210',
'mumei-url-repair-panel-v220','mumei-url-repair-btn-v220',
'mumei-url-repair-panel-v230','mumei-url-repair-btn-v230',
'mumei-thin-card-auto-v100','mumei-thin-card-auto-panel-v100',
'mumei-thin-card-auto-v09','mumei-thin-card-auto-panel-v09',
'mumei-thin-card-auto-v08','mumei-thin-card-auto-panel-v08'
];
let busy=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function editor(){return document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror')}
function visible(el){if(!el||!el.isConnected)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0}
function status(t,bad=false){const p=document.getElementById(PANEL);if(!p)return;p.textContent=t;p.style.background=bad?'#991b1b':'#4c1d95'}
function cards(){const root=editor();if(!root)return[];return [...root.querySelectorAll('img')].filter(img=>{const r=img.getBoundingClientRect(),w=img.naturalWidth||r.width,h=img.naturalHeight||r.height;return h>0&&w/h>4.5}).slice(-10)}

function dispatchTap(el){
  if(!el)return;
  try{el.scrollIntoView({block:'center',behavior:'instant'})}catch(_){}
  const r=el.getBoundingClientRect();
  const x=r.left+r.width/2,y=r.top+r.height/2;
  const common={bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,buttons:1};
  try{el.dispatchEvent(new PointerEvent('pointerdown',{...common,pointerType:'touch',isPrimary:true,pointerId:1}))}catch(_){}
  try{el.dispatchEvent(new PointerEvent('pointerup',{...common,pointerType:'touch',isPrimary:true,pointerId:1}))}catch(_){}
  for(const t of ['mousedown','mouseup','click']){try{el.dispatchEvent(new MouseEvent(t,common))}catch(_){}}
}

function altButtonNear(img){
  const ir=img.getBoundingClientRect();
  const ix=ir.left+ir.width/2,iy=ir.top+ir.height/2;
  return [...document.querySelectorAll('button,[role="button"]')].filter(visible).find(b=>{
    if((b.textContent||'').trim()!=='ALT')return false;
    const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    return Math.abs(x-ix)<Math.max(420,ir.width/2+180)&&Math.abs(y-iy)<340;
  })||null;
}

function chainDirectlyBeforeAlt(alt){
  if(!alt)return null;
  let node=alt.parentElement;
  for(let d=0;d<8&&node;d++,node=node.parentElement){
    const buttons=[...node.querySelectorAll('button,[role="button"]')].filter(visible);
    if(buttons.length<4||buttons.length>8||!buttons.includes(alt))continue;
    buttons.sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);
    const idx=buttons.indexOf(alt);
    if(idx>0){
      const prev=buttons[idx-1];
      if(prev!==alt)return prev;
    }
  }
  return null;
}

async function selectImageAndFindChain(img){
  img.scrollIntoView({block:'center',behavior:'instant'});
  await sleep(250);
  dispatchTap(img);
  try{img.click()}catch(_){}
  for(let i=0;i<20;i++){
    await sleep(100);
    const alt=altButtonNear(img);
    if(alt){
      const chain=chainDirectlyBeforeAlt(alt);
      if(chain)return chain;
      return null;
    }
  }
  return null;
}

function entries(){
  return [...document.querySelectorAll('input,textarea,[contenteditable="true"]')].filter(el=>{
    if(!visible(el))return false;
    if(el instanceof HTMLInputElement)return !['file','button','submit','checkbox','radio','range','color'].includes((el.type||'text').toLowerCase());
    if(el instanceof HTMLTextAreaElement)return true;
    return el.getAttribute('contenteditable')==='true'&&!el.classList.contains('ProseMirror');
  });
}

async function freshEntry(before){
  for(let i=0;i<35;i++){
    const active=document.activeElement;
    if(active&&!before.has(active)&&entries().includes(active))return active;
    const fresh=entries().filter(x=>!before.has(x));
    if(fresh.length===1)return fresh[0];
    if(fresh.length>1){
      const focused=fresh.find(x=>x===document.activeElement);
      if(focused)return focused;
      fresh.sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height);
      return fresh[0];
    }
    await sleep(120);
  }
  return null;
}

function setValue(el,v){
  el.focus();
  if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement){
    const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
    if(setter)setter.call(el,v);else el.value=v;
    el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:v}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }else{
    el.textContent=v;
    el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:v}));
  }
}
function pressEnter(el){for(const t of ['keydown','keypress','keyup'])el.dispatchEvent(new KeyboardEvent(t,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}))}

async function one(img,url,n){
  status(`${n}/10 画像を選択中…`);
  const chain=await selectImageAndFindChain(img);
  if(!chain)return 0;
  status(`${n}/10 鎖を直接クリック…`);
  const before=new Set(entries());
  // ここが今回の修正点：座標経由ではなく鎖ボタン自身を直接クリックする。
  try{chain.click()}catch(_){dispatchTap(chain)}
  await sleep(300);
  const input=await freshEntry(before);
  if(!input)return 1;
  status(`${n}/10 URL入力…`);
  setValue(input,url);
  await sleep(180);
  const now=(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement)?input.value:input.textContent;
  if((now||'').trim()!==url)return 2;
  pressEnter(input);
  await sleep(700);
  return 4;
}

async function run(){
  if(busy)return;busy=true;
  const b=document.getElementById(BTN);if(b)b.disabled=true;
  try{
    const imgs=cards();
    if(imgs.length!==10){status(`カード ${imgs.length}/10。今ある10枚の画面で押して`,true);return}
    let chain=0,input=0,filled=0,done=0;
    for(let n=0;n<10;n++){
      const s=await one(imgs[n],URLS[n],n+1);
      if(s>=1)chain++;if(s>=2)input++;if(s>=3)filled++;if(s>=4)done++;
      if(n===0&&s<4){status(`1枚目で停止：鎖 ${chain}/1・入力欄 ${input}/1・入力 ${filled}/1・確定 ${done}/1`,true);return}
      await sleep(220);
    }
    status(`完了：鎖 ${chain}/10・入力欄 ${input}/10・入力 ${filled}/10・確定 ${done}/10`,done<10);
  }catch(e){status('⚠️ '+(e?.message||String(e)),true)}
  finally{busy=false;if(b)b.disabled=false}
}

function hideOld(){
  let st=document.getElementById('mumei-hide-all-old-231');
  if(!st){
    st=document.createElement('style');st.id='mumei-hide-all-old-231';
    st.textContent=OLD_IDS.map(id=>`#${id}{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}`).join('\n');
    document.documentElement.appendChild(st);
  }
  OLD_IDS.forEach(id=>{const x=document.getElementById(id);if(x){x.style.setProperty('display','none','important');x.style.setProperty('pointer-events','none','important')}});
}

function mount(){
  if(!document.body)return;
  hideOld();
  if(!document.getElementById(PANEL)){
    const p=document.createElement('div');p.id=PANEL;p.textContent='NEW 2.3.1';
    Object.assign(p.style,{position:'fixed',right:'8px',bottom:'58px',zIndex:'2147483646',maxWidth:'230px',padding:'6px 8px',borderRadius:'8px',background:'#4c1d95',color:'#fff',fontSize:'11px',lineHeight:'1.3',boxShadow:'0 4px 12px rgba(0,0,0,.25)',pointerEvents:'none'});
    document.body.appendChild(p);
  }
  if(!document.getElementById(BTN)){
    const b=document.createElement('button');b.id=BTN;b.type='button';b.textContent='URL修理 NEW 2.3.1';
    Object.assign(b.style,{position:'fixed',right:'8px',bottom:'10px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'10px 13px',background:'#7c3aed',color:'#fff',fontSize:'13px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});
    b.addEventListener('click',run);document.body.appendChild(b);
  }
}
function loop(){mount();setTimeout(loop,600)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loop,{once:true});else loop();
})();
