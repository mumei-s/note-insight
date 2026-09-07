(function(){
'use strict';
if(location.hostname!=='note.com')return;
const RAIL='mumei-v2933-rail';
const MUTED='mumei-muted-v2938';
const STYLE='mumei-v2936-scroll-style';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function shown(el){if(!el?.getBoundingClientRect)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function exact(v){return[...document.querySelectorAll('button,a,[role="tab"],[role="button"],div,span')].find(el=>shown(el)&&clean(el.textContent)===v)||null}
function commonShell(a,b){if(!a||!b)return null;let p=a;for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){if(p.contains(b)&&shown(p)){const r=p.getBoundingClientRect();if(r.width>180&&r.height>100)return p}}return null}
function shell(){return commonShell(exact('通知'),exact('お知らせ'))}
function filterOn(){const b=document.querySelector(`#${RAIL} .filter`);return Boolean(b&&(b.classList.contains('on')||/^フィルターON/u.test(clean(b.textContent))))}
function installStyle(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`[data-mumei-v2936-front-scroll="1"]{overscroll-behavior-y:contain!important;overscroll-behavior-x:none!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important}`;document.documentElement.append(s)}
function candidates(root){if(!root)return[];const out=[root,...root.querySelectorAll('*')];return[...new Set(out)].filter(el=>{if(!shown(el))return false;const r=el.getBoundingClientRect();return r.width>180&&r.height>100})}
function frontScroller(root){const xs=candidates(root).map(el=>{const s=getComputedStyle(el),scrollish=/auto|scroll|overlay/i.test(s.overflowY),overflow=Math.max(0,el.scrollHeight-el.clientHeight),rows=el.querySelectorAll?.(ITEM)?.length||0;return{el,score:(scrollish?100000:0)+rows*5000+overflow*20+Math.min(el.clientHeight,1200)}}).sort((a,b)=>b.score-a.score);return xs[0]?.el||root}
function markScroller(root){for(const el of document.querySelectorAll('[data-mumei-v2936-front-scroll]'))if(!root||!root.contains(el))el.removeAttribute('data-mumei-v2936-front-scroll');if(!filterOn()||!root)return null;const box=frontScroller(root);if(box)box.setAttribute('data-mumei-v2936-front-scroll','1');return box}
function rowList(root){if(!root)return[];let xs=[...root.querySelectorAll(ITEM)];if(!xs.length)xs=[...root.querySelectorAll('li,[role="listitem"],article')];return[...new Set(xs)]}
function visibleCount(root){return rowList(root).filter(el=>!el.classList.contains(MUTED)&&shown(el)).length}
let fillBusy=false,fillTimer=0;
async function requestOlder(){if(fillBusy||!filterOn())return;const root=shell(),box=markScroller(root);if(!root||!box)return;fillBusy=true;try{const before=rowList(root).length,max=Math.max(0,box.scrollHeight-box.clientHeight);if(max>2)return;try{box.dispatchEvent(new Event('scroll',{bubbles:true}))}catch{}await new Promise(r=>setTimeout(r,220));if(rowList(root).length===before&&visibleCount(root)<6){try{box.dispatchEvent(new Event('scroll',{bubbles:true}))}catch{}}}finally{fillBusy=false}}
function scheduleOlder(ms=120){clearTimeout(fillTimer);fillTimer=setTimeout(()=>void requestOlder(),ms)}
let touch=null;
document.addEventListener('touchstart',e=>{if(!filterOn())return;const root=shell(),t=e.target;if(!root||!(t instanceof Node)||!root.contains(t))return;const box=markScroller(root),p=e.touches?.[0];if(!box||!p)return;touch={root,box,y:p.clientY,top:box.scrollTop};},{capture:true,passive:true});
document.addEventListener('touchmove',e=>{if(!touch||!filterOn())return;const p=e.touches?.[0];if(!p)return;const {root,box,y,top}=touch;if(!root.isConnected||!box.isConnected||!root.contains(box)){touch=null;return}const max=Math.max(0,box.scrollHeight-box.clientHeight),delta=y-p.clientY,next=Math.max(0,Math.min(max,top+delta));e.preventDefault();e.stopPropagation();box.scrollTop=next;if(delta>8&&max<=2)scheduleOlder(40);},{capture:true,passive:false});
for(const ev of ['touchend','touchcancel'])document.addEventListener(ev,()=>{touch=null},{capture:true,passive:true});
document.addEventListener('wheel',e=>{if(!filterOn())return;const root=shell(),t=e.target;if(!root||!(t instanceof Node)||!root.contains(t))return;const box=markScroller(root);if(!box||!root.contains(box))return;const max=Math.max(0,box.scrollHeight-box.clientHeight),next=Math.max(0,Math.min(max,box.scrollTop+e.deltaY));e.preventDefault();e.stopPropagation();box.scrollTop=next;if(e.deltaY>0&&max<=2)scheduleOlder(40);},{capture:true,passive:false});
document.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest(`#${RAIL} .filter`):null;if(!b)return;for(const ms of [80,220])setTimeout(()=>markScroller(shell()),ms)},true);
addEventListener('focus',()=>markScroller(shell()));addEventListener('pageshow',()=>markScroller(shell()));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')markScroller(shell())});
installStyle();markScroller(shell());
})();