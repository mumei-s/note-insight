(function(){
'use strict';
const PANEL='mumei-note-source-picker-v163';
const BOX='mumei-prince-special-v184';
const STYLE='mumei-generic-controls-v189-style';
if(window.__MUMEI_GENERIC_CONTROLS_189__)return;
window.__MUMEI_GENERIC_CONTROLS_189__=true;

function css(){
 if(document.getElementById(STYLE)||!document.head)return;
 const s=document.createElement('style');s.id=STYLE;s.textContent=`
#${PANEL} .actions,#${PANEL} .resume{display:none!important}
#${PANEL} .mumei-generic-controls-v189{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-top:5px}
#${PANEL} .mumei-generic-controls-v189 button{min-width:0!important;height:30px!important;min-height:30px!important;padding:2px!important;border-radius:7px!important;color:#fff!important;font-size:10px!important;font-weight:900!important}
#${PANEL} .mumei-generic-controls-v189 [data-g="image"]{background:#2563eb!important}
#${PANEL} .mumei-generic-controls-v189 [data-g="send"]{background:#7c3aed!important}
#${PANEL} .mumei-generic-controls-v189 [data-g="delete"]{background:#b91c1c!important}
#${PANEL} .mumei-generic-controls-v189 [data-g="reset"]{background:#7f1d1d!important}
#${PANEL} .mumei-generic-controls-v189-note{font-size:8px;line-height:1.2;color:#94a3b8;margin-top:4px}
`;
 document.head.appendChild(s);
}
function fire(action){
 const panel=document.getElementById(PANEL);if(!panel)return;
 const target=panel.querySelector(`button[data-a="${action}"]`);
 if(target&&!target.disabled)target.click();
}
function mount(){
 css();const panel=document.getElementById(PANEL);if(!panel)return false;
 const box=panel.querySelector(`.${BOX}`);if(!box)return false;
 if(box.querySelector('.mumei-generic-controls-v189'))return true;
 const row=document.createElement('div');row.className='mumei-generic-controls-v189';
 row.innerHTML='<button type="button" data-g="image">画</button><button type="button" data-g="send">送</button><button type="button" data-g="delete">削</button><button type="button" data-g="reset">初期化</button>';
 const note=document.createElement('div');note.className='mumei-generic-controls-v189-note';note.textContent='画＝最初の＋→画像は1回だけ／以降10枚ずつ自動';
 box.append(row,note);
 row.addEventListener('click',e=>{
   const b=e.target.closest('button[data-g]');if(!b)return;
   e.preventDefault();e.stopPropagation();
   const a=b.dataset.g;
   if(a==='image')fire('image');
   if(a==='send')fire('send');
   if(a==='delete')fire('delete');
   if(a==='reset')fire('reset');
 });
 return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>120)clearInterval(timer)},300);mount();
})();
