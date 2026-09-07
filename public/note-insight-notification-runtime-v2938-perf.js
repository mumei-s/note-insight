(function(){
'use strict';
if(location.hostname!=='note.com')return;
const ATTR='data-mumei-insight-filter-scroll-v2933';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function shown(el){if(!el?.getBoundingClientRect)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'}
function exact(v){return[...document.querySelectorAll('button,a,[role="tab"],[role="button"],div,span')].find(el=>shown(el)&&clean(el.textContent)===v)||null}
function commonShell(a,b){if(!a||!b)return null;let p=a;for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){if(p.contains(b)&&shown(p)){const r=p.getBoundingClientRect();if(r.width>180&&r.height>100)return p}}return null}
let cached=null,timer=0;
function mark(){clearTimeout(timer);const root=cached?.isConnected&&shown(cached)?cached:commonShell(exact('通知'),exact('お知らせ'));if(!root)return;cached=root;root.dataset.mumeiInsightFilterScrollV2933='1'}
function schedule(ms=0){clearTimeout(timer);timer=setTimeout(mark,ms)}
document.addEventListener('click',()=>schedule(10),true);
const obs=new MutationObserver(ms=>{if(!cached?.isConnected&&ms.some(m=>m.type==='childList'))schedule(80)});obs.observe(document.documentElement,{childList:true,subtree:true});
addEventListener('focus',()=>{cached=null;schedule(30)});addEventListener('pageshow',()=>{cached=null;schedule(30)});
schedule(0);
})();