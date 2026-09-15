(() => {
'use strict';
if(window.__NOTE_BOOST_V550_SHELL__)return;
window.__NOTE_BOOST_V550_SHELL__=true;

const K='note巡回BOOST_v531';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(`${K}:${k}`))??fb}catch{return fb}};
const save=(k,v)=>{try{localStorage.setItem(`${K}:${k}`,JSON.stringify(v))}catch{}};

function ensureStyle(){
  if($('#nb550-style'))return;
  const s=document.createElement('style');s.id='nb550-style';s.textContent=`
#nb532-open{display:none!important}
#nb550-open{position:fixed;z-index:2147483646;right:8px;bottom:84px;min-width:42px;height:28px;padding:0 9px;border:1px solid #39c5ff;border-radius:999px;background:#0a1d27;color:#fff;font:900 11px/26px system-ui;box-shadow:0 4px 16px #0008;user-select:none;touch-action:none;text-align:center;white-space:nowrap}
#nb550-open[data-drag="1"]{opacity:.86;transform:scale(.98)}
#nb532-panel{max-width:min(430px,calc(100vw - 12px))!important}
#nb532-panel .nb532-head b{white-space:nowrap}
`;
  (document.head||document.documentElement).appendChild(s);
}
function oldOpen(){return $('#nb532-open')}
function panel(){return $('#nb532-panel')}
function createTab(){
  let b=$('#nb550-open');if(b)return b;
  b=document.createElement('button');b.id='nb550-open';b.type='button';b.textContent='巡回';b.title='巡回BOOST';
  const pos=load('v550TabPos',null);if(pos&&Number.isFinite(pos.x)&&Number.isFinite(pos.y)){b.style.left=`${Math.max(0,pos.x)}px`;b.style.top=`${Math.max(0,pos.y)}px`;b.style.right='auto';b.style.bottom='auto'}
  document.body.appendChild(b);
  let timer=0,drag=false,start=null,moved=false;
  const down=e=>{const p=e.touches?.[0]||e;start={x:p.clientX,y:p.clientY,l:b.offsetLeft,t:b.offsetTop};moved=false;timer=setTimeout(()=>{drag=true;b.dataset.drag='1'},420)};
  const move=e=>{if(!start)return;const p=e.touches?.[0]||e,dx=p.clientX-start.x,dy=p.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>8)moved=true;if(!drag)return;e.preventDefault();const x=Math.min(innerWidth-b.offsetWidth,Math.max(0,start.l+dx)),y=Math.min(innerHeight-b.offsetHeight,Math.max(0,start.t+dy));b.style.left=`${x}px`;b.style.top=`${y}px`;b.style.right='auto';b.style.bottom='auto'};
  const up=e=>{clearTimeout(timer);if(drag){drag=false;b.dataset.drag='0';save('v550TabPos',{x:b.offsetLeft,y:b.offsetTop});start=null;return}start=null;if(moved)return;oldOpen()?.click()};
  b.addEventListener('pointerdown',down);window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);
  b.addEventListener('touchstart',down,{passive:true});window.addEventListener('touchmove',move,{passive:false});window.addEventListener('touchend',up);
  b.addEventListener('click',e=>e.preventDefault());
  return b;
}
function unifyHeader(){const h=$('#nb532-panel .nb532-head b');if(h&&h.textContent!=='巡回BOOST 5.5.0')h.textContent='巡回BOOST 5.5.0'}
function cleanLaunchers(){for(const e of $$('button,a,div')){if(e.id==='nb550-open'||e.closest?.('#nb532-panel'))continue;const t=(e.textContent||'').replace(/\s+/g,'').trim();if((t==='♡'||t==='💗'||t==='❤️')&&getComputedStyle(e).position==='fixed')e.style.display='none'}}
function sync(){ensureStyle();if(document.body)createTab();unifyHeader();cleanLaunchers()}
function boot(){sync();const root=document.body||document.documentElement;new MutationObserver(ms=>{if(ms.some(m=>m.addedNodes.length))sync()}).observe(root,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();