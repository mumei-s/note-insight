(function(){
'use strict';
if(location.hostname!=='note.com')return;
window.__MUMEI_NOTIFICATION_V2939__=true;
const EVT='mumei-insight-manual-read-v2933';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function shown(el){if(!el?.getBoundingClientRect)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'}
function exact(v){return[...document.querySelectorAll('button,a,[role="tab"],[role="button"],div,span')].find(el=>shown(el)&&clean(el.textContent)===v)||null}
function commonShell(a,b){if(!a||!b)return null;let p=a;for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){if(p.contains(b)&&shown(p)){const r=p.getBoundingClientRect();if(r.width>180&&r.height>100)return p}}return null}
function shell(){return commonShell(exact('通知'),exact('お知らせ'))}
function safeListRoot(){const s=shell();if(!s)return null;const rows=[...s.querySelectorAll(ITEM)].filter(shown);if(!rows.length)return s;const sample=rows.slice(0,Math.min(6,rows.length));let p=sample[0].parentElement;while(p&&p!==s&&!sample.every(x=>p.contains(x)))p=p.parentElement;return p&&s.contains(p)?p:s}
window.addEventListener(EVT,e=>{const r=safeListRoot();if(r&&e.detail&&typeof e.detail==='object')e.detail.root=r},true);
window.__MUMEI_NOTIFICATION_SAFE_ROOT__=safeListRoot;
})();