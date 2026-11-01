(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationReturnV1Loaded)return;window.__mumeiNotificationReturnV1Loaded=true;
const VERSION='1.3.0',RETURN='mumei_insight_return_bell_tab_v2',ENTRY='__mumeiNotificationReturnV2',MAX_AGE=6*60*60*1000;
const featureOn=()=>window.__mumeiNotificationFeatureV1?.isEnabled?.()!==false;
const dm=()=>/^\/messages\/rooms(?:\/|$)/i.test(location.pathname);
const query=()=>new URLSearchParams(location.search);
const wants=()=>query().get('mumei_filter_return')==='bell'||query().get('mumei_fullread')==='1';
let cloakStyle=null;
function cloak(){if(!document.documentElement||dm()||(!wants()&&location.pathname!=='/notifications'))return;const root=document.documentElement;cloakStyle=[root.style.getPropertyValue('opacity'),root.style.getPropertyPriority('opacity')];root.style.setProperty('opacity','0','important');root.setAttribute('data-mumei-bell-return-cloak','1')}
function reveal(){const root=document.documentElement;if(!root||!cloakStyle)return;const[value,priority]=cloakStyle;value?root.style.setProperty('opacity',value,priority):root.style.removeProperty('opacity');root.removeAttribute('data-mumei-bell-return-cloak');cloakStyle=null}
function shown(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<=0||r.height<=0)return false;for(let p=el;p;p=p.parentElement){const style=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||style.display==='none'||style.visibility==='hidden')return false}return true}
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function exactTabsOpen(){
 const visible=[...document.querySelectorAll('button,a,[role="tab"],[role="button"],div,span')].filter(shown);
 const notices=visible.filter(el=>/^通知(?:\s*\d+)?$/u.test(clean(el.textContent)));
 const news=visible.filter(el=>/^お知らせ(?:\s*\d+)?$/u.test(clean(el.textContent)));
 if(!notices.length||!news.length)return false;
 for(const n of notices)for(const o of news){
  let p=n.parentElement,d=0;
  while(p&&p!==document.body&&d++<10){if(p.contains(o)&&shown(p))return true;p=p.parentElement}
 }
 return false
}
function noticePanel(){
 for(const api of [window.__mumeiNotificationFilterV4,window.__mumeiNotificationReaderV4])try{const p=api?.findPanel?.();if(p&&shown(p))return p}catch{}
 for(const root of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],section,aside')){
  if(!shown(root))continue;const t=clean(root.textContent);
  if(/通知/.test(t)&&/お知らせ/.test(t))return root
 }
 return null
}
function openNotice(){return Boolean(noticePanel())||exactTabsOpen()}
function bellMeta(el){return el instanceof Element?clean([el.textContent,el.getAttribute('aria-label'),el.getAttribute('title'),el.getAttribute('data-testid'),el.id,typeof el.className==='string'?el.className:''].join(' ')):''}
function bellHit(el){const meta=bellMeta(el);return/(?:notification|notice|通知|お知らせ|bell)/iu.test(meta)&&!/setting|filter/i.test(meta)}
function notificationBellElement(){
 const direct='[aria-label*="通知"],[aria-label*="お知らせ"],[title*="通知"],[title*="お知らせ"],[data-testid*="notification" i],[data-testid*="notice" i]';
 for(const el of document.querySelectorAll(direct)){const hit=el.matches('button,a,[role="button"],[role="tab"]')?el:el.closest('button,a,[role="button"],[role="tab"]');if(hit&&shown(hit))return hit}
 for(const el of document.querySelectorAll('header button,header a,nav button,nav a,button,[role="button"],[role="tab"]'))if(shown(el)&&bellHit(el))return el;
 for(const el of document.querySelectorAll('header button,header [role="button"],nav button,nav [role="button"]')){if(!shown(el))continue;const r=el.getBoundingClientRect(),t=clean(el.textContent);if(r.top<180&&el.querySelector('svg')&&/^\d{1,3}$/.test(t))return el}
 return null
}
let ownClick=false;
function clickBell(){const hit=notificationBellElement();if(!hit)return false;try{ownClick=true;hit.click();return true}catch{return false}finally{ownClick=false}}
function readRecords(){try{const records=JSON.parse(sessionStorage.getItem(RETURN)||'[]');return Array.isArray(records)?records.filter(r=>r&&typeof r.id==='string'&&typeof r.source==='string'&&Number.isFinite(r.at)&&Date.now()-r.at<MAX_AGE&&Date.now()>=r.at).slice(-12).map(r=>({...r,scroll:Array.isArray(r.scroll)?r.scroll.filter(s=>s&&Array.isArray(s.path)&&s.path.length<=24&&s.path.every(n=>Number.isInteger(n)&&n>=-24&&n<=10000)&&Number.isFinite(s.top)&&Number.isFinite(s.left)).slice(0,24):[],page:Array.isArray(r.page)&&r.page.length===2&&r.page.every(n=>Number.isFinite(n)&&n>=0)?r.page:[0,0]})):[]}catch{return[]}}
function writeRecords(records){try{sessionStorage.setItem(RETURN,JSON.stringify(records.slice(-12)))}catch{}}
function currentRecord(){const id=history.state&&typeof history.state==='object'?history.state[ENTRY]:null;return typeof id==='string'?readRecords().find(r=>r.id===id&&r.source===location.href)||null:null}
function forget(){const record=currentRecord();if(!record)return;const state={...history.state};delete state[ENTRY];try{history.replaceState(state,'',location.href)}catch{}writeRecords(readRecords().filter(r=>r.id!==record.id))}
function articleUrl(link){try{const url=new URL(link.href,location.href);return url.origin===location.origin&&/^\/[^/]+\/n\/n[a-z0-9]+\/?$/i.test(url.pathname)?url:null}catch{return null}}
function scrollNodes(panel){const nodes=[];const add=el=>{if(el&&shown(el)&&(el.scrollTop>0||el.scrollHeight>el.clientHeight&&/auto|scroll/.test(getComputedStyle(el).overflowY))&&!nodes.includes(el))nodes.push(el)};add(panel);for(let p=panel?.parentElement;p&&p!==document.body;p=p.parentElement)add(p);if(panel)for(const el of [...panel.querySelectorAll('*')].slice(0,500))add(el);return nodes}
function pathFor(panel,node){if(node===panel)return[];if(panel.contains(node)){const path=[];for(let p=node;p&&p!==panel;p=p.parentElement)path.unshift([...p.parentElement.children].indexOf(p));return path}let steps=0;for(let p=panel;p;p=p.parentElement){if(p===node)return[-steps];steps++}return null}
function nodeAt(panel,path){if(!Array.isArray(path)||path.length>24)return null;let node=panel;if(path[0]<0){for(let i=0;i<-path[0]&&node;i++)node=node.parentElement;return node}for(const index of path){if(!Number.isInteger(index)||index<0)return null;node=node?.children[index]}return node||null}
function remember(event){
 if(!featureOn()||ownClick||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const target=event.target instanceof Element?event.target:event.target?.parentElement,link=target?.closest('a[href]');
 if(!link||link.hasAttribute('download')||link.target&&!/^_self$/i.test(link.target)||!articleUrl(link))return;
 const panel=noticePanel();if(!panel?.contains(link))return;
 // A source entry marker survives both SPA Back and full-document Back. Keep
 // the breadcrumb tab-local; GM storage would also reopen other tabs' bells.
 const old=history.state;if(old!==null&&(typeof old!=='object'||Array.isArray(old)))return;
 const id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),record={id,at:Date.now(),source:location.href,scroll:scrollNodes(panel).map(node=>({path:pathFor(panel,node),top:node.scrollTop,left:node.scrollLeft})),page:[scrollX,scrollY]};
 try{history.replaceState({...old,[ENTRY]:id},'',location.href)}catch{return}
 const records=readRecords().filter(r=>r.id!==old?.[ENTRY]);records.push(record);writeRecords(records);
}
let timer=0,run=0,activeKey='';
function cancel(){run++;clearTimeout(timer);timer=0;activeKey='';reveal()}
function cleanFlags(){try{const url=new URL(location.href);url.searchParams.delete('mumei_filter_return');url.searchParams.delete('mumei_fullread');history.replaceState(history.state,'',url.pathname+url.search+url.hash)}catch{}}
function filterReady(panel){const api=window.__mumeiNotificationFilterV4;if(!api||typeof api.getState!=='function')return true;try{const root=api.findPanel?.();return Boolean(api.getState()&&root?.isConnected&&panel&&(root===panel||root.contains(panel)||panel.contains(root)))}catch{return false}}
function restore(){
 const record=currentRecord(),explicit=wants(),key=(record?.id||'explicit')+'|'+location.href;if(timer&&key===activeKey)return;
 cancel();if(!featureOn()||dm()||!record&&!explicit)return;activeKey=key;
 const source=location.href,epoch=run,started=Date.now();let clicked=false,settled=0;
 const finish=()=>{if(explicit)cleanFlags();window.__mumeiNotificationReturnDone=true;reveal();window.dispatchEvent(new CustomEvent('mumei-notification-return-opened',{detail:{version:VERSION}}))};
 const step=()=>{
  timer=0;if(epoch!==run||location.href!==source||dm()){cancel();return}
  if(openNotice()){
   const panel=noticePanel();let ready=filterReady(panel);
   for(const saved of record?.scroll||[]){const node=nodeAt(panel,saved.path);if(!node?.isConnected){ready=false;continue}const top=Math.max(0,Number(saved.top)||0),left=Math.max(0,Number(saved.left)||0);if(node.scrollHeight-node.clientHeight+1<top)ready=false;node.scrollTop=top;node.scrollLeft=left}
   if(record?.page?.some(n=>n>0))window.scrollTo({left:record.page[0],top:record.page[1],behavior:'instant'});
   // Allow the router and filter to finish mounting before the final position.
   // Never keep forcing a position after the reader starts interacting.
   if(!ready)settled=0;
   if(ready&&++settled>=3||Date.now()-started>=14400){finish();return}
  }else if(!clicked)clicked=clickBell();
  if(Date.now()-started>=14400){reveal();return}
  timer=setTimeout(step,120)
 };
 step();
}
window.addEventListener('click',remember,true);
function interaction(event){if(ownClick)return;cancel();if(event.type==='wheel'||event.type==='keydown'&&event.key!=='Escape'||!currentRecord())return;const panel=noticePanel(),target=event.target instanceof Element?event.target:null;if(panel&&(event.key==='Escape'||target&&!panel.contains(target)&&!target.closest('[id^="mumei-"],[data-mumei-notification-controls]')))forget()}
for(const type of ['pointerdown','touchstart','wheel','keydown','click'])window.addEventListener(type,interaction,{capture:true,passive:true});
window.addEventListener('mumei-notification-feature-changed',()=>{if(!featureOn()){cancel();forget()}});
window.addEventListener('popstate',restore);
window.addEventListener('pageshow',restore);
window.addEventListener('pagehide',cancel);
cloak();
if(location.pathname==='/notifications')location.replace(location.origin+'/?mumei_filter_return=bell');else restore();
})();
