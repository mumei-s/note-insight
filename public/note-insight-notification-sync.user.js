// ==UserScript==
// @name         無名S note INSIGHT 本人通知・統計連携
// @namespace    https://github.com/mumei-s/note-insight/notification-sync
// @version      2.9.12
// @description  通知バーを2段にして操作幅を確保し、「あなたの記事がマガジンに追加されました」も漏らさずINSIGHTへ保存します。
// @match        https://note.com/*
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v298.js?v=2912
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v2912-patch.js?v=2912
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-sync.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-sync.user.js
// ==/UserScript==

(function(){
'use strict';
const VERSION='2.9.12';
const CLEAN_NOTICE='mumei_open_notice_v2912';
const VERSION_CHECK='mumei_insight_version_check';
const RETURN_PARAM='mumei_return';
const INSIGHT_NOTIFICATIONS='https://mumei-s.github.io/note-insight/?insightMode=notifications#dashboard';
const NOTICE_ITEM_SELECTOR='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function safeInsightReturn(value){
  try{
    const u=new URL(String(value||''));
    return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:'';
  }catch{return''}
}
function withInstalledVersion(back){
  const u=new URL(back);
  u.searchParams.set('notificationInstalled',VERSION);
  u.searchParams.set('notificationCheckedAt',String(Date.now()));
  return u.href;
}
function buttonText(el){
  return clean((el?.getAttribute?.('aria-label')||'')+' '+(el?.getAttribute?.('title')||'')+' '+(el?.getAttribute?.('data-testid')||'')+' '+(el?.textContent||''));
}
function looksLikeBell(target){
  const el=target instanceof Element?target.closest('button,a,[role="button"],[aria-label],[title],[data-testid]'):null;
  if(!el)return null;
  const s=buttonText(el);
  if(/通知|notification|notice|bell/i.test(s))return el;
  const r=el.getBoundingClientRect?.();
  const svg=el.querySelector?.('svg');
  if(r&&svg&&r.top<180&&r.right>innerWidth*.55&&r.width<90&&r.height<90)return el;
  return null;
}
function findBell(){
  const selectors=['button[aria-label*="通知"]','a[aria-label*="通知"]','button[title*="通知"]','a[title*="通知"]','[data-testid*="notification" i]','[data-testid*="notice" i]'];
  for(const selector of selectors){
    const el=[...document.querySelectorAll(selector)].find(x=>{const r=x.getBoundingClientRect();const s=getComputedStyle(x);return r.width>0&&r.height>0&&r.top<190&&s.display!=='none'&&s.visibility!=='hidden'});
    if(el)return el;
  }
  return [...document.querySelectorAll('button,a,[role="button"]')].find(el=>{
    const r=el.getBoundingClientRect();
    return r.width>0&&r.height>0&&r.top<190&&r.right>innerWidth*.55&&/通知|notification|notice|bell/i.test(buttonText(el));
  })||null;
}

async function openBellAfterCleanNavigation(){
  const u=new URL(location.href);
  if(u.searchParams.get(CLEAN_NOTICE)!=='1')return;
  u.searchParams.delete(CLEAN_NOTICE);
  history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);
  for(let i=0;i<24;i++){
    const bell=findBell();
    if(bell){
      await sleep(250);
      bell.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
      return;
    }
    await sleep(250);
  }
}

function handleVersionCheck(){
  const u=new URL(location.href);
  if(u.searchParams.get(VERSION_CHECK)!=='1')return false;
  const back=safeInsightReturn(u.searchParams.get(RETURN_PARAM));
  u.searchParams.delete(VERSION_CHECK);
  u.searchParams.delete(RETURN_PARAM);
  history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);
  if(back){
    location.replace(withInstalledVersion(back));
    return true;
  }
  return false;
}

function toolbarHost(bar){
  let node=bar?.parentElement||null;
  while(node&&node!==document.body&&node!==document.documentElement){
    const count=node.querySelectorAll?.(NOTICE_ITEM_SELECTOR)?.length||0;
    if(count>=2)return node;
    node=node.parentElement;
  }
  return null;
}
function repairToolbarHost(){
  const bar=document.getElementById('mumei-v297-actions');
  if(!bar)return;
  const host=toolbarHost(bar);
  if(host&&bar.parentElement!==host)host.insertBefore(bar,host.firstChild);
  bar.style.setProperty('width','100%','important');
  bar.style.setProperty('max-width','100%','important');
  bar.style.setProperty('min-width','0','important');
  bar.style.setProperty('grid-column','1 / -1','important');
  bar.style.setProperty('flex','0 0 100%','important');
  bar.style.setProperty('align-self','stretch','important');
}
function ensureInsightReturnButton(){
  const bar=document.getElementById('mumei-v297-actions');
  if(!bar)return;
  repairToolbarHost();
  if(bar.querySelector('.mumei-insight-return'))return;
  const b=document.createElement('button');
  b.type='button';
  b.className='mumei-insight-return';
  b.textContent='INSIGHTへ';
  b.title='INSIGHT本人通知へ戻る';
  b.addEventListener('click',()=>location.assign(INSIGHT_NOTIFICATIONS));
  bar.append(b);
}
function installReturnButtonStyle(){
  if(document.getElementById('mumei-v2912-return-style'))return;
  const s=document.createElement('style');
  s.id='mumei-v2912-return-style';
  s.textContent=`
html #mumei-v297-actions{grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(86px,.8fr)!important;grid-auto-rows:28px!important;gap:3px!important;width:100%!important;max-width:100%!important;min-width:0!important;min-height:62px!important;flex:0 0 100%!important;grid-column:1/-1!important;align-self:stretch!important;overflow:visible!important;padding:3px 5px!important}
html #mumei-v297-actions button{padding:0 7px!important;font-size:9.5px!important;min-width:0!important;height:28px!important}
html #mumei-v297-actions .m297-filter-switch{font-size:9px!important;justify-content:center!important;min-width:0!important}
html #mumei-v297-actions details{grid-column:1/2!important;grid-row:2!important;min-width:0!important;width:100%!important}
html #mumei-v297-actions summary{padding:0 7px!important;font-size:9px!important;width:100%!important;height:28px!important;justify-content:center!important}
html #mumei-v297-actions .mumei-insight-return{grid-column:2/-1!important;grid-row:2!important;width:100%!important;border-color:#79dff6!important;background:#123448!important;color:#eaffff!important;font-size:10px!important;padding:0 9px!important}
@media(max-width:430px){html #mumei-v297-actions{grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(82px,.75fr)!important;gap:2px!important;padding:3px!important}html #mumei-v297-actions button{padding:0 4px!important;font-size:9px!important}html #mumei-v297-actions summary{padding:0 4px!important;font-size:8.7px!important}html #mumei-v297-actions .m297-filter-switch{font-size:8.5px!important}html #mumei-v297-actions .mumei-insight-return{font-size:9.5px!important}}
`;
  document.documentElement.appendChild(s);
}
installReturnButtonStyle();
const returnButtonTimer=window.setInterval(()=>{repairToolbarHost();ensureInsightReturnButton()},350);
window.addEventListener('pagehide',()=>window.clearInterval(returnButtonTimer),{once:true});

document.addEventListener('click',event=>{
  if(!location.pathname.toLowerCase().startsWith('/sitesettings/stats'))return;
  const bell=looksLikeBell(event.target);
  if(!bell)return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  location.replace(`https://note.com/?${CLEAN_NOTICE}=1`);
},true);

if(!handleVersionCheck())void openBellAfterCleanNavigation();
})();
