(function(){
'use strict';
if(location.hostname!=='note.com')return;
const RAIL='mumei-v2933-rail';
const STYLE='mumei-v2936-scroll-style';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
let cachedRoot=null,cachedBox=null;
function shown(el){if(!el?.getBoundingClientRect)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function exact(v){return[...document.querySelectorAll('button,a,[role="tab"],[role="button"],div,span')].find(el=>shown(el)&&clean(el.textContent)===v)||null}
function commonShell(a,b){if(!a||!b)return null;let p=a;for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){if(p.contains(b)&&shown(p)){const r=p.getBoundingClientRect();if(r.width>180&&r.height>100)return p}}return null}
function shell(){if(cachedRoot?.isConnected&&shown(cachedRoot))return cachedRoot;cachedRoot=commonShell(exact('通知'),exact('お知らせ'));cachedBox=null;return cachedRoot}
function filterOn(){const b=document.querySelector(`#${RAIL} .filter`);return Boolean(b&&(b.classList.contains('on')||/^フィルターON/u.test(clean(b.textContent))))}
function installStyle(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`[data-mumei-v2936-front-scroll="1"]{overscroll-behavior-y:contain!important;overscroll-behavior-x:none!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important;scroll-behavior:auto!important}`;document.documentElement.append(s)}
function frontScroller(root){if(!root)return null;if(cachedBox?.isConnected&&root.contains(cachedBox))return cachedBox;const xs=[root,...root.querySelectorAll('*')].filter(el=>{if(!shown(el))return false;const r=el.getBoundingClientRect();return r.width>180&&r.height>100}).map(el=>{const s=getComputedStyle(el),scrollish=/auto|scroll|overlay/i.test(s.overflowY),overflow=Math.max(0,el.scrollHeight-el.clientHeight),rows=el.querySelectorAll?.(ITEM)?.length||0;return{el,score:(scrollish?100000:0)+rows*5000+overflow*20+Math.min(el.clientHeight,1200)}}).sort((a,b)=>b.score-a.score);cachedBox=xs[0]?.el||root;return cachedBox}
function mark(){for(const el of document.querySelectorAll('[data-mumei-v2936-front-scroll]'))el.removeAttribute('data-mumei-v2936-front-scroll');if(!filterOn())return null;const root=shell(),box=frontScroller(root);if(box)box.setAttribute('data-mumei-v2936-front-scroll','1');return box}
function canMove(box,delta){if(!box)return false;const max=Math.max(0,box.scrollHeight-box.clientHeight),top=box.scrollTop;if(max<=2)return false;if(delta>0)return top<max-2;if(delta<0)return top>2;return true}
let startY=null;
document.addEventListener('touchstart',e=>{if(!filterOn())return;const root=shell(),t=e.target;if(!root||!(t instanceof Node)||!root.contains(t))return;mark();startY=e.touches?.[0]?.clientY??null},{capture:true,passive:true});
document.addEventListener('touchmove',e=>{if(startY==null||!filterOn())return;const root=shell(),t=e.target,p=e.touches?.[0];if(!root||!(t instanceof Node)||!root.contains(t)||!p)return;const box=frontScroller(root),delta=startY-p.clientY;if(canMove(box,delta))return;e.preventDefault();e.stopPropagation()},{capture:true,passive:false});
for(const ev of ['touchend','touchcancel'])document.addEventListener(ev,()=>{startY=null},{capture:true,passive:true});
document.addEventListener('wheel',e=>{if(!filterOn())return;const root=shell(),t=e.target;if(!root||!(t instanceof Node)||!root.contains(t))return;const box=frontScroller(root);if(canMove(box,e.deltaY))return;e.preventDefault();e.stopPropagation()},{capture:true,passive:false});
document.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest(`#${RAIL} .filter`):null;if(!b)return;cachedBox=null;setTimeout(mark,90)},true);
addEventListener('focus',()=>{cachedRoot=null;cachedBox=null;setTimeout(mark,60)});addEventListener('pageshow',()=>{cachedRoot=null;cachedBox=null;setTimeout(mark,60)});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){cachedRoot=null;cachedBox=null;setTimeout(mark,60)}});
installStyle();setTimeout(mark,100);
})();