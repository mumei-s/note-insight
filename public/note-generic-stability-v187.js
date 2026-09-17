(function(){
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(page.__MUMEI_GENERIC_STABILITY_187__)return;
page.__MUMEI_GENERIC_STABILITY_187__=true;

const PANEL='mumei-note-source-picker-v163';
const STYLE='mumei-generic-stability-v187-style';
const FLOAT_STATE='mumei_note_floating_ui_v164';

function css(){
  if(document.getElementById(STYLE)||!document.head)return;
  const s=document.createElement('style');s.id=STYLE;s.textContent=`
#${PANEL}{width:min(250px,calc(100vw - 10px))!important;max-width:250px!important;padding:6px!important}
#${PANEL}>.title{min-height:24px!important;margin-bottom:4px!important;cursor:move!important;touch-action:none!important;font-size:11px!important}
#${PANEL} .mumei-min-btn-v164{width:26px!important;min-width:26px!important;height:24px!important;line-height:22px!important;font-size:14px!important}
#${PANEL} .mumei-prince-special-v184{padding:5px!important;margin-bottom:4px!important;border-radius:8px!important}
#${PANEL} .mumei-prince-special-v184>div:first-child{font-size:10px!important;margin-bottom:4px!important}
#${PANEL} .mumei-prince-special-v184 input{height:29px!important;min-height:29px!important;padding:4px 6px!important;margin:0 0 4px!important;font-size:10px!important}
#${PANEL} .mumei-prince-special-v184 .choices{gap:2px!important;margin-bottom:4px!important}
#${PANEL} .mumei-prince-special-v184 .choices button{height:27px!important;min-height:27px!important;padding:2px!important;font-size:9px!important}
#${PANEL} .mumei-prince-special-v184 [data-start]{height:30px!important;min-height:30px!important;padding:3px!important;font-size:11px!important}
#${PANEL} .mumei-prince-special-v184 .mini{font-size:8px!important;line-height:1.2!important;margin-top:3px!important}
#${PANEL} .actions{gap:3px!important}
#${PANEL} .actions button{min-height:29px!important;padding:3px!important;font-size:10px!important}
#${PANEL} #mumei-note-source-status-v163{font-size:8px!important;line-height:1.25!important;max-height:34px!important;overflow:auto!important}
#${PANEL}.mumei-ui-minimized-v164{width:120px!important;max-width:120px!important;padding:4px 5px!important}
`;
  document.head.appendChild(s);
}
function savePos(left,top){
  try{const old=JSON.parse(localStorage.getItem(FLOAT_STATE)||'{}')||{};localStorage.setItem(FLOAT_STATE,JSON.stringify({...old,left,top,updatedAt:Date.now()}))}catch(_){ }
}
function attachDrag(){
  const panel=document.getElementById(PANEL);if(!panel||panel.dataset.mumeiDirectDrag187==='1')return;
  const title=panel.querySelector(':scope > .title');if(!title)return;
  panel.dataset.mumeiDirectDrag187='1';
  title.addEventListener('pointerdown',e=>{
    if(e.button!=null&&e.button!==0)return;
    if(e.target?.closest?.('.mumei-min-btn-v164'))return;
    e.stopImmediatePropagation();
    const r=panel.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,sl=r.left,st=r.top,id=e.pointerId;
    let moved=false;
    try{title.setPointerCapture?.(id)}catch(_){ }
    const move=ev=>{
      if(ev.pointerId!==id)return;
      const dx=ev.clientX-sx,dy=ev.clientY-sy;if(Math.hypot(dx,dy)>3)moved=true;if(!moved)return;
      ev.preventDefault();
      const vw=page.visualViewport?.width||page.innerWidth||360,vh=page.visualViewport?.height||page.innerHeight||640;
      const pr=panel.getBoundingClientRect();
      const left=Math.max(4,Math.min(sl+dx,vw-pr.width-4)),top=Math.max(4,Math.min(st+dy,vh-Math.min(pr.height,vh-8)-4));
      panel.style.setProperty('left',`${Math.round(left)}px`,'important');panel.style.setProperty('top',`${Math.round(top)}px`,'important');panel.style.setProperty('right','auto','important');panel.style.setProperty('bottom','auto','important');
    };
    const up=ev=>{
      if(ev.pointerId!==id)return;
      page.removeEventListener('pointermove',move,true);page.removeEventListener('pointerup',up,true);page.removeEventListener('pointercancel',up,true);
      if(moved){const q=panel.getBoundingClientRect();savePos(Math.round(q.left),Math.round(q.top));}
      try{title.releasePointerCapture?.(id)}catch(_){ }
    };
    page.addEventListener('pointermove',move,{capture:true,passive:false});page.addEventListener('pointerup',up,true);page.addEventListener('pointercancel',up,true);
  },true);
}

css();attachDrag();
setInterval(()=>{css();attachDrag()},350);
})();
