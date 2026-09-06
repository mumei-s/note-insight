// ==UserScript==
// @name         無名S note INSIGHT 本人通知・統計連携
// @namespace    https://github.com/mumei-s/note-insight/notification-sync
// @version      2.9.14
// @description  INSIGHT起動時の最新通知差分を自動保存。通常はフィルターON/OFFとINSIGHT戻りを常設し、過去読込やグループ管理は収納します。
// @match        https://note.com/*
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v298.js?v=2914
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v2914-patch.js?v=2914
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-sync.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-sync.user.js
// ==/UserScript==

(function(){
'use strict';
const VERSION='2.9.14';
const CLEAN_NOTICE='mumei_open_notice_v2914';
const LEGACY_CLEAN_NOTICE='mumei_open_notice_v2913';
const VERSION_CHECK='mumei_insight_version_check';
const RETURN_PARAM='mumei_return';
const INSIGHT_NOTIFICATIONS='https://mumei-s.github.io/note-insight/?insightMode=notifications#dashboard';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function safeInsightReturn(value){try{const u=new URL(String(value||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
function withInstalledVersion(back){const u=new URL(back);u.searchParams.set('notificationInstalled',VERSION);u.searchParams.set('notificationCheckedAt',String(Date.now()));return u.href}
function buttonText(el){return clean((el?.getAttribute?.('aria-label')||'')+' '+(el?.getAttribute?.('title')||'')+' '+(el?.getAttribute?.('data-testid')||'')+' '+(el?.textContent||''))}
function looksLikeBell(target){const el=target instanceof Element?target.closest('button,a,[role="button"],[aria-label],[title],[data-testid]'):null;if(!el)return null;const s=buttonText(el);if(/通知|notification|notice|bell/i.test(s))return el;const r=el.getBoundingClientRect?.(),svg=el.querySelector?.('svg');if(r&&svg&&r.top<180&&r.right>innerWidth*.55&&r.width<90&&r.height<90)return el;return null}
function findBell(){const selectors=['button[aria-label*="通知"]','a[aria-label*="通知"]','button[title*="通知"]','a[title*="通知"]','[data-testid*="notification" i]','[data-testid*="notice" i]'];for(const selector of selectors){const el=[...document.querySelectorAll(selector)].find(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>0&&r.height>0&&r.top<190&&s.display!=='none'&&s.visibility!=='hidden'});if(el)return el}return [...document.querySelectorAll('button,a,[role="button"]')].find(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<190&&r.right>innerWidth*.55&&/通知|notification|notice|bell/i.test(buttonText(el))})||null}
async function openBellAfterCleanNavigation(){const u=new URL(location.href);const key=u.searchParams.get(CLEAN_NOTICE)==='1'?CLEAN_NOTICE:u.searchParams.get(LEGACY_CLEAN_NOTICE)==='1'?LEGACY_CLEAN_NOTICE:'';if(!key)return;u.searchParams.delete(key);history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);for(let i=0;i<24;i++){const bell=findBell();if(bell){await sleep(250);bell.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return}await sleep(250)}}
function handleVersionCheck(){const u=new URL(location.href);if(u.searchParams.get(VERSION_CHECK)!=='1')return false;const back=safeInsightReturn(u.searchParams.get(RETURN_PARAM));u.searchParams.delete(VERSION_CHECK);u.searchParams.delete(RETURN_PARAM);history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);if(back){location.replace(withInstalledVersion(back));return true}return false}

function visible(el){if(!el?.getBoundingClientRect)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'}
function noticeTop(){const exact=[...document.querySelectorAll('[role="tab"],button,a,div')].filter(el=>visible(el)&&clean(el.textContent)==='通知');for(const tab of exact){const box=tab.closest('[role="tablist"]')||tab.parentElement;if(!box||!visible(box))continue;const r=box.getBoundingClientRect();if(r.top<360&&r.bottom>40)return Math.round(Math.max(48,Math.min(innerHeight-125,r.bottom+1)))}return 274}
function setToolbarTop(){document.documentElement.style.setProperty('--mumei-notice-toolbar-top',`${noticeTop()}px`)}
function ensureInsightReturnButton(){const bar=document.getElementById('mumei-v297-actions');if(!bar)return;if(!bar.querySelector('.mumei-insight-return')){const b=document.createElement('button');b.type='button';b.className='mumei-insight-return';b.textContent='INSIGHTへ';b.title='INSIGHT本人通知へ戻る';b.addEventListener('click',()=>location.assign(INSIGHT_NOTIFICATIONS));bar.append(b)}setToolbarTop()}
function installToolbarStyle(){if(document.getElementById('mumei-v2914-return-style'))return;const s=document.createElement('style');s.id='mumei-v2914-return-style';s.textContent=`
html #mumei-v297-actions{position:fixed!important;top:var(--mumei-notice-toolbar-top,274px)!important;left:0!important;right:0!important;z-index:2147483000!important;width:100vw!important;max-width:100vw!important;min-width:0!important;margin:0!important;border-left:0!important;border-right:0!important;background:rgba(9,23,34,.985)!important;box-sizing:border-box!important;overflow:visible!important;transform:none!important;float:none!important;align-self:auto!important}
html #mumei-v297-actions button[data-mumei-role="current"]{display:none!important}
`;
  document.documentElement.appendChild(s)
}
installToolbarStyle();
setToolbarTop();
const toolbarTimer=window.setInterval(()=>{ensureInsightReturnButton();setToolbarTop()},700);
window.addEventListener('resize',setToolbarTop,{passive:true});
window.addEventListener('pagehide',()=>window.clearInterval(toolbarTimer),{once:true});

document.addEventListener('click',event=>{if(!location.pathname.toLowerCase().startsWith('/sitesettings/stats'))return;const bell=looksLikeBell(event.target);if(!bell)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();location.replace(`https://note.com/?${CLEAN_NOTICE}=1`)},true);

if(!handleVersionCheck())void openBellAfterCleanNavigation();
})();
