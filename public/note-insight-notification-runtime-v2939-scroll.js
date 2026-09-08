(function(){
'use strict';
if(location.hostname!=='note.com')return;
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const ATTR='data-mumei-v2939-native-scroll';
const STYLE='mumei-v2939-native-scroll-style';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function shown(el){if(!el?.getBoundingClientRect)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'}
function exact(v){return[...document.querySelectorAll('button,a,[role="tab"],[role="button"],div,span')].find(el=>shown(el)&&clean(el.textContent)===v)||null}
function commonShell(a,b){if(!a||!b)return null;let p=a;for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){if(p.contains(b)&&shown(p)){const r=p.getBoundingClientRect();if(r.width>180&&r.height>100)return p}}return null}
function shell(){return commonShell(exact('通知'),exact('お知らせ'))}
function installStyle(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`[${ATTR}="1"]{overscroll-behavior-y:contain!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important}`;document.documentElement.append(s)}
let cachedRoot=null,cachedBox=null,timer=0;
function findBox(root){if(!root)return null;const xs=[root,...root.querySelectorAll('*')].filter(el=>shown(el)&&el!==document.body&&el!==document.documentElement).map(el=>{const st=getComputedStyle(el),scrollish=/auto|scroll|overlay/i.test(st.overflowY),overflow=Math.max(0,el.scrollHeight-el.clientHeight),n=el.querySelectorAll?.(ITEM)?.length||0;return{el,score:(scrollish?100000:0)+n*10000+overflow}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);return xs[0]?.el||root}
function mark(){clearTimeout(timer);installStyle();const root=shell();if(!root)return;if(cachedRoot===root&&cachedBox?.isConnected&&root.contains(cachedBox))return;for(const el of document.querySelectorAll(`[${ATTR}]`))el.removeAttribute(ATTR);cachedRoot=root;cachedBox=findBox(root);cachedBox?.setAttribute(ATTR,'1')}
function schedule(ms=60){clearTimeout(timer);timer=setTimeout(mark,ms)}
document.addEventListener('click',()=>schedule(80),true);addEventListener('focus',()=>{cachedRoot=cachedBox=null;schedule(30)});addEventListener('pageshow',()=>{cachedRoot=cachedBox=null;schedule(30)});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){cachedRoot=cachedBox=null;schedule(30)}});
installStyle();schedule(120);
})();