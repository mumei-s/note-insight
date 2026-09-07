(function(){
'use strict';
if(location.hostname!=='note.com')return;
const RAIL='mumei-v2933-rail';
const MUTED='mumei-muted-v2933';
const STYLE='mumei-v2936-scroll-style';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function shown(el){if(!el?.getBoundingClientRect)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function exact(v){return[...document.querySelectorAll('button,a,[role="tab"],[role="button"],div,span')].find(el=>shown(el)&&clean(el.textContent)===v)||null}
function commonShell(a,b){if(!a||!b)return null;let p=a;for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){if(p.contains(b)&&shown(p)){const r=p.getBoundingClientRect();if(r.width>180&&r.height>100)return p}}return null}
function shell(){return commonShell(exact('通知'),exact('お知らせ'))}
function filterOn(){const b=document.querySelector(`#${RAIL} .filter`);return Boolean(b&&(b.classList.contains('on')||/^フィルターON/u.test(clean(b.textContent))))}
function installStyle(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`
[data-mumei-v2936-front-scroll="1"]{overscroll-behavior-y:contain!important;overscroll-behavior-x:none!important;-webkit-overflow-scrolling:touch!important}
`;document.documentElement.append(s)}
function candidates(root){if(!root)return[];const out=[];let p=root;for(let i=0;i<5&&p&&p!==document.body&&p!==document.documentElement;i++,p=p.parentElement)out.push(p);for(const el of root.querySelectorAll('*'))out.push(el);return[...new Set(out)].filter(el=>{if(!shown(el))return false;const r=el.getBoundingClientRect();return r.width>180&&r.height>100})}
function frontScroller(root){const xs=candidates(root).map(el=>{const s=getComputedStyle(el),scrollish=/auto|scroll|overlay/i.test(s.overflowY),overflow=Math.max(0,el.scrollHeight-el.clientHeight);return{el,score:(scrollish?100000:0)+overflow*20+Math.min(el.clientHeight,1200)}}).sort((a,b)=>b.score-a.score);return xs[0]?.el||root}
function markScroller(root){for(const el of document.querySelectorAll('[data-mumei-v2936-front-scroll]'))el.removeAttribute('data-mumei-v2936-front-scroll');if(!filterOn()||!root)return null;const box=frontScroller(root);if(box)box.setAttribute('data-mumei-v2936-front-scroll','1');return box}
function rowList(root){if(!root)return[];let xs=[...root.querySelectorAll(ITEM)];if(!xs.length)xs=[...root.querySelectorAll('li,[role="listitem"],article')];return[...new Set(xs)]}
function visibleCount(root){return rowList(root).filter(el=>!el.classList.contains(MUTED)&&shown(el)).length}
let fillBusy=false,fillTimer=0;
async function fillOlder(){if(fillBusy||!filterOn())return;const root=shell();if(!root)return;const box=markScroller(root);if(!box)return;fillBusy=true;const start=Math.max(0,box.scrollTop);let stable=0,lastTotal=rowList(root).length;try{for(let step=0;step<6&&filterOn();step++){
 const visible=visibleCount(root),max=Math.max(0,box.scrollHeight-box.clientHeight);
 if(visible>=7&&max>Math.max(120,box.clientHeight*.3))break;
 box.scrollTop=max;
 try{box.dispatchEvent(new Event('scroll',{bubbles:true}))}catch{}
 await new Promise(r=>setTimeout(r,320));
 const total=rowList(root).length,nextMax=Math.max(0,box.scrollHeight-box.clientHeight);
 if(total<=lastTotal&&nextMax<=max+2)stable++;else stable=0;
 lastTotal=total;
 if(stable>=2)break;
 }
 const max=Math.max(0,box.scrollHeight-box.clientHeight);box.scrollTop=Math.min(start,max);try{box.dispatchEvent(new Event('scroll',{bubbles:true}))}catch{}
}finally{fillBusy=false;markScroller(shell())}}
function scheduleFill(ms=80){clearTimeout(fillTimer);fillTimer=setTimeout(()=>void fillOlder(),ms)}
let touch=null;
document.addEventListener('touchstart',e=>{if(!filterOn())return;const root=shell(),t=e.target;if(!root||!(t instanceof Node)||!root.contains(t))return;const box=markScroller(root),p=e.touches?.[0];if(!box||!p)return;touch={root,box,y:p.clientY,top:box.scrollTop};},{capture:true,passive:true});
document.addEventListener('touchmove',e=>{if(!touch||!filterOn())return;const p=e.touches?.[0];if(!p)return;const {root,box,y,top}=touch;if(!root.isConnected||!box.isConnected){touch=null;return}const max=Math.max(0,box.scrollHeight-box.clientHeight),next=Math.max(0,Math.min(max,top+(y-p.clientY)));e.preventDefault();e.stopPropagation();box.scrollTop=next;if(next>=max-2&&p.clientY<y)scheduleFill(30);},{capture:true,passive:false});
for(const ev of ['touchend','touchcancel'])document.addEventListener(ev,()=>{touch=null},{capture:true,passive:true});
document.addEventListener('wheel',e=>{if(!filterOn())return;const root=shell(),t=e.target;if(!root||!(t instanceof Node)||!root.contains(t))return;const box=markScroller(root);if(!box)return;const max=Math.max(0,box.scrollHeight-box.clientHeight),next=Math.max(0,Math.min(max,box.scrollTop+e.deltaY));e.preventDefault();e.stopPropagation();box.scrollTop=next;if(next>=max-2&&e.deltaY>0)scheduleFill(30);},{capture:true,passive:false});
document.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest(`#${RAIL} .filter`):null;if(!b)return;for(const ms of [80,260,700])setTimeout(()=>{const root=shell();markScroller(root);if(filterOn())scheduleFill(20)},ms)},true);
document.addEventListener('scroll',e=>{if(!filterOn())return;const root=shell();if(!root)return;const box=frontScroller(root);if(e.target===box&&box.scrollTop>=Math.max(0,box.scrollHeight-box.clientHeight)-3)scheduleFill(80)},true);
addEventListener('focus',()=>{markScroller(shell());if(filterOn())scheduleFill(160)});addEventListener('pageshow',()=>{markScroller(shell());if(filterOn())scheduleFill(160)});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){markScroller(shell());if(filterOn())scheduleFill(160)}});
installStyle();markScroller(shell());if(filterOn())scheduleFill(200);
})();
