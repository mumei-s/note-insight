// ==UserScript==
// @name         無名S note INSIGHT 本人通知・統計連携
// @namespace    https://github.com/mumei-s/note-insight/notification-sync
// @version      2.9.22
// @description  note通知を自動確認・自動保存し、保存成功地点・最終確認日時を表示。INSIGHT【通知】へ直行します。
// @match        https://note.com/*
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v298.js?v=2922
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v2922.js?v=2922a
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v2922-ui.js?v=2922a
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-sync.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-sync.user.js
// ==/UserScript==
(function(){
'use strict';
const VERSION='2.9.22';
const CLEAN_NOTICE='mumei_open_notice_v2922';
const AUTO_NOTICE='mumei_auto_notice_v2922';
const EVT_STATUS='mumei-insight-sync-status-v2922';
const LEGACY_CLEAN=['mumei_open_notice_v2921','mumei_open_notice_v2920','mumei_open_notice_v2919','mumei_open_notice_v2918','mumei_open_notice_v2917','mumei_open_notice_v2916','mumei_open_notice_v2915','mumei_open_notice_v2914','mumei_open_notice_v2913'];
const LEGACY_AUTO=['mumei_auto_notice_v2921','mumei_auto_notice_v2920','mumei_auto_notice_v2919','mumei_auto_notice_v2918'];
const VERSION_CHECK='mumei_insight_version_check';
const RETURN_PARAM='mumei_return';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function safeInsightReturn(value){try{const u=new URL(String(value||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
function withInstalledVersion(back){const u=new URL(back);u.searchParams.set('notificationInstalled',VERSION);u.searchParams.set('notificationCheckedAt',String(Date.now()));return u.href}
function withAutoResult(back,ok,detail={}){const u=new URL(back);u.searchParams.set('notificationInstalled',VERSION);u.searchParams.set('notificationCheckedAt',String(Date.now()));u.searchParams.set('notificationAutoSynced',ok?'1':'0');u.searchParams.set('notificationNoteId',String(detail.noteId||''));u.searchParams.set('notificationAutoAt',String(Number(detail.lastCheckAt||detail.at||Date.now())));if(!ok)u.searchParams.set('notificationAutoError',String(detail.error||detail.text||'AUTO_SYNC_FAILED').slice(0,240));else u.searchParams.delete('notificationAutoError');return u.href}
function buttonText(el){return clean((el?.getAttribute?.('aria-label')||'')+' '+(el?.getAttribute?.('title')||'')+' '+(el?.getAttribute?.('data-testid')||'')+' '+(el?.textContent||''))}
function looksLikeBell(target){const el=target instanceof Element?target.closest('button,a,[role="button"],[aria-label],[title],[data-testid]'):null;if(!el)return null;const s=buttonText(el);if(/通知|notification|notice|bell/i.test(s))return el;const r=el.getBoundingClientRect?.(),svg=el.querySelector?.('svg');if(r&&svg&&r.top<180&&r.right>innerWidth*.55&&r.width<90&&r.height<90)return el;return null}
function findBell(){const selectors=['button[aria-label*="通知"]','a[aria-label*="通知"]','button[title*="通知"]','a[title*="通知"]','[data-testid*="notification" i]','[data-testid*="notice" i]'];for(const selector of selectors){const el=[...document.querySelectorAll(selector)].find(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>0&&r.height>0&&r.top<190&&s.display!=='none'&&s.visibility!=='hidden'});if(el)return el}return [...document.querySelectorAll('button,a,[role="button"]')].find(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<190&&r.right>innerWidth*.55&&/通知|notification|notice|bell/i.test(buttonText(el))})||null}
function clickBell(el){el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}))}
async function findAndOpenBell(){for(let i=0;i<32;i++){const bell=findBell();if(bell){await sleep(220);clickBell(bell);return true}await sleep(250)}return false}
async function openBellAfterCleanNavigation(){const u=new URL(location.href);const key=[CLEAN_NOTICE,...LEGACY_CLEAN].find(x=>u.searchParams.get(x)==='1');if(!key)return false;for(const x of [CLEAN_NOTICE,...LEGACY_CLEAN])u.searchParams.delete(x);history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);await findAndOpenBell();return true}
function handleVersionCheck(){const u=new URL(location.href);if(u.searchParams.get(VERSION_CHECK)!=='1')return false;const back=safeInsightReturn(u.searchParams.get(RETURN_PARAM));u.searchParams.delete(VERSION_CHECK);u.searchParams.delete(RETURN_PARAM);history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);if(back){location.replace(withInstalledVersion(back));return true}return false}
async function handleAutoNotice(){const u=new URL(location.href),autoKey=[AUTO_NOTICE,...LEGACY_AUTO].find(x=>u.searchParams.get(x)==='1');if(!autoKey)return false;const back=safeInsightReturn(u.searchParams.get(RETURN_PARAM));for(const x of [AUTO_NOTICE,...LEGACY_AUTO])u.searchParams.delete(x);u.searchParams.delete(RETURN_PARAM);history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);if(!back)return true;let finished=false,timeout=0;const finish=(ok,detail={})=>{if(finished)return;finished=true;clearTimeout(timeout);window.removeEventListener(EVT_STATUS,onStatus);location.replace(withAutoResult(back,ok,detail))};const onStatus=e=>{const d=e.detail||{};if(d.state==='done')finish(true,d);else if(d.state==='error')finish(false,d)};window.addEventListener(EVT_STATUS,onStatus);timeout=window.setTimeout(()=>finish(false,{error:'AUTO_SYNC_TIMEOUT',at:Date.now()}),25000);const opened=await findAndOpenBell();if(!opened)finish(false,{error:'NOTIFICATION_BELL_NOT_FOUND',at:Date.now()});return true}
document.addEventListener('click',event=>{if(!location.pathname.toLowerCase().startsWith('/sitesettings/stats'))return;const bell=looksLikeBell(event.target);if(!bell)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();location.replace(`https://note.com/?${CLEAN_NOTICE}=1`)},true);
(async()=>{if(handleVersionCheck())return;if(await handleAutoNotice())return;await openBellAfterCleanNavigation()})();
})();
