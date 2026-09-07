(function(){
'use strict';
if(location.hostname!=='note.com')return;
const RAIL='mumei-v2933-rail';
const EVT_STATUS='mumei-insight-sync-status-v2933';
const INS='https://mumei-s.github.io/note-insight/notification-entry.html?from=note&insightMode=notifications#dashboard';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function shown(el){if(!el?.getBoundingClientRect)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function exact(v){return[...document.querySelectorAll('button,a,[role="tab"],[role="button"],div,span')].find(el=>shown(el)&&clean(el.textContent)===v)||null}
function commonShell(a,b){if(!a||!b)return null;let p=a;for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){if(p.contains(b)&&shown(p)){const r=p.getBoundingClientRect();if(r.width>180&&r.height>100)return p}}return null}
function shell(){return commonShell(exact('通知'),exact('お知らせ'))}
function scroller(root){if(!root)return null;const xs=[root,...root.querySelectorAll('*')].filter(shown).map(el=>{const s=getComputedStyle(el),scrollish=/auto|scroll|overlay/i.test(s.overflowY),overflow=Math.max(0,el.scrollHeight-el.clientHeight),rows=el.querySelectorAll?.(ITEM)?.length||0;return{el,score:(scrollish?100000:0)+rows*5000+overflow*20+Math.min(el.clientHeight,1200)}}).sort((a,b)=>b.score-a.score);return xs[0]?.el||root}
let snap=null,navLock=0,restoreTimer=0;
function capture(){const root=shell(),box=scroller(root);snap={root,box,top:Number(box?.scrollTop||0),pageY:Number(window.scrollY||0),at:Date.now()};return snap}
function restore(delay=0){clearTimeout(restoreTimer);restoreTimer=setTimeout(()=>{const s=snap;if(!s||Date.now()-s.at>20000)return;requestAnimationFrame(()=>{try{if(s.box?.isConnected&&s.root?.isConnected&&s.root.contains(s.box)){const max=Math.max(0,s.box.scrollHeight-s.box.clientHeight);s.box.scrollTop=Math.min(Math.max(0,s.top),max)}}catch{}try{if(Math.abs((window.scrollY||0)-s.pageY)>2)window.scrollTo(0,s.pageY)}catch{}})},delay)}
function buttonFrom(e){return e.target instanceof Element?e.target.closest(`#${RAIL} button`):null}
function directInsight(e){const b=buttonFrom(e);if(!b?.classList.contains('ins'))return false;capture();navLock=Date.now()+1200;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();location.assign(INS);return true}
function onPress(e){const b=buttonFrom(e);if(!b)return;if(b.classList.contains('ins')){directInsight(e);return}if(b.classList.contains('read')||b.classList.contains('filter'))capture()}
document.addEventListener('pointerdown',onPress,true);
if(!('PointerEvent'in window))document.addEventListener('touchstart',onPress,{capture:true,passive:false});
document.addEventListener('click',e=>{if(Date.now()<navLock){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();return}const b=buttonFrom(e);if(!b)return;if(b.classList.contains('ins')){directInsight(e);return}if(b.classList.contains('filter')){restore(70);setTimeout(()=>restore(0),220);setTimeout(()=>restore(0),520)}},true);
window.addEventListener(EVT_STATUS,e=>{const state=String(e.detail?.state||'');if(state==='done'||state==='error'){restore(30);setTimeout(()=>restore(0),180);setTimeout(()=>restore(0),500)}});
})();