// ==UserScript==
// @name         note ポン出し v31.9｜入力・移動修正版
// @namespace    https://github.com/mumei-s/note-insight
// @version      31.9.0
// @description  v31.8の見出し・区切り線・純正カード完全生成を維持し、Androidで白い入力欄へカーソルが入らない問題とパネルを移動できない問題を修正。
// @author       無名S note
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        none
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/0f57e541a392b8ee415eb3d00cd6ae4b02207c69/public/note-pon-editor-v20.user.js
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v20.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v20.user.js
// ==/UserScript==
(() => {
'use strict';
if(window.__MUMEI_PON_V319_FIX__)return;
window.__MUMEI_PON_V319_FIX__=true;

function installFix(){
  const root=document.getElementById('__mumei_pon_v318_root__');
  if(!root)return false;
  const fab=root.querySelector('#ponFab318');
  const panel=root.querySelector('#ponPanel318');
  const src=root.querySelector('#ponSrc318');
  const min=root.querySelector('#ponMin318');
  if(!fab||!panel||!src)return false;

  fab.textContent='📄 ポン v31.9';
  const head=panel.firstElementChild;
  const title=head?.querySelector('b');
  if(title)title.textContent='↔️ 原稿→完全生成 v31.9';

  src.disabled=false;
  src.readOnly=false;
  src.tabIndex=0;
  src.setAttribute('inputmode','text');
  src.setAttribute('autocomplete','off');
  Object.assign(src.style,{
    pointerEvents:'auto',
    touchAction:'auto',
    userSelect:'text',
    WebkitUserSelect:'text',
    caretColor:'#111',
    position:'relative',
    zIndex:'3'
  });

  const forceFocus=()=>{
    if(panel.style.display==='none')return;
    try{src.focus({preventScroll:true})}catch{try{src.focus()}catch{}}
    try{
      const p=src.selectionStart??src.value.length;
      src.setSelectionRange(p,p);
    }catch{}
  };
  ['pointerdown','touchstart','mousedown'].forEach(type=>src.addEventListener(type,e=>e.stopPropagation(),true));
  src.addEventListener('click',()=>setTimeout(forceFocus,0));
  src.addEventListener('pointerup',()=>setTimeout(forceFocus,0));
  src.addEventListener('touchend',()=>setTimeout(forceFocus,0));

  fab.addEventListener('click',()=>setTimeout(forceFocus,80));

  if(head){
    head.id='ponDrag319';
    Object.assign(head.style,{
      cursor:'move',
      touchAction:'none',
      userSelect:'none',
      WebkitUserSelect:'none',
      padding:'5px 3px',
      borderBottom:'1px solid #28445c'
    });
    let moving=null;
    head.addEventListener('pointerdown',e=>{
      if(e.target.closest('button'))return;
      const r=panel.getBoundingClientRect();
      moving={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};
      panel.style.right='auto';
      panel.style.bottom='auto';
      try{head.setPointerCapture(e.pointerId)}catch{}
      e.preventDefault();
      e.stopPropagation();
    });
    head.addEventListener('pointermove',e=>{
      if(!moving||e.pointerId!==moving.id)return;
      const maxLeft=Math.max(0,innerWidth-panel.offsetWidth);
      const maxTop=Math.max(0,innerHeight-44);
      panel.style.left=`${Math.min(maxLeft,Math.max(0,moving.left+e.clientX-moving.x))}px`;
      panel.style.top=`${Math.min(maxTop,Math.max(0,moving.top+e.clientY-moving.y))}px`;
      e.preventDefault();
      e.stopPropagation();
    });
    const stop=e=>{
      if(moving&&(!e||e.pointerId===moving.id))moving=null;
    };
    head.addEventListener('pointerup',stop);
    head.addEventListener('pointercancel',stop);
  }

  if(min)min.title='最小化';
  return true;
}

let tries=0;
const timer=setInterval(()=>{
  if(installFix()||++tries>40)clearInterval(timer);
},250);
})();