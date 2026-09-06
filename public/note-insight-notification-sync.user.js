// ==UserScript==
// @name         無名S note INSIGHT 本人通知・統計連携
// @namespace    https://github.com/mumei-s/note-insight/notification-sync
// @version      2.9.17
// @description  noteログイン中は通知を継続差分保存。通知画面は移動できる1操作ボタン＋INSIGHT常時表示、保存確認は小さい「保完」で示します。
// @match        https://note.com/*
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v298.js?v=2917
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v2915-patch.js?v=2917
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v2917-patch.js?v=2917
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-sync.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-sync.user.js
// ==/UserScript==
(function(){
'use strict';
const VERSION='2.9.17';
const CLEAN_NOTICE='mumei_open_notice_v2917';
const LEGACY_CLEAN=['mumei_open_notice_v2916','mumei_open_notice_v2915','mumei_open_notice_v2914','mumei_open_notice_v2913'];
const VERSION_CHECK='mumei_insight_version_check';
const RETURN_PARAM='mumei_return';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function safeInsightReturn(value){try{const u=new URL(String(value||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
function withInstalledVersion(back){const u=new URL(back);u.searchParams.set('notificationInstalled',VERSION);u.searchParams.set('notificationCheckedAt',String(Date.now()));return u.href}
function buttonText(el){return clean((el?.getAttribute?.('aria-label')||'')+' '+(el?.getAttribute?.('title')||'')+' '+(el?.getAttribute?.('data-testid')||'')+' '+(el?.textContent||''))}
function looksLikeBell(target){const el=target instanceof Element?target.closest('button,a,[role="button"],[aria-label],[title],[data-testid]'):null;if(!el)return null;const s=buttonText(el);if(/通知|notification|notice|bell/i.test(s))return el;const r=el.getBoundingClientRect?.(),svg=el.querySelector?.('svg');if(r&&svg&&r.top<180&&r.right>innerWidth*.55&&r.width<90&&r.height<90)return el;return null}
function findBell(){const selectors=['button[aria-label*="通知"]','a[aria-label*="通知"]','button[title*="通知"]','a[title*="通知"]','[data-testid*="notification" i]','[data-testid*="notice" i]'];for(const selector of selectors){const el=[...document.querySelectorAll(selector)].find(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>0&&r.height>0&&r.top<190&&s.display!=='none'&&s.visibility!=='hidden'});if(el)return el}return [...document.querySelectorAll('button,a,[role="button"]')].find(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<190&&r.right>innerWidth*.55&&/通知|notification|notice|bell/i.test(buttonText(el))})||null}
async function openBellAfterCleanNavigation(){const u=new URL(location.href);const k=[CLEAN_NOTICE,...LEGACY_CLEAN].find(x=>u.searchParams.get(x)==='1');if(!k)return;u.searchParams.delete(k);history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);for(let i=0;i<24;i++){const bell=findBell();if(bell){await sleep(250);bell.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return}await sleep(250)}}
function handleVersionCheck(){const u=new URL(location.href);if(u.searchParams.get(VERSION_CHECK)!=='1')return false;const back=safeInsightReturn(u.searchParams.get(RETURN_PARAM));u.searchParams.delete(VERSION_CHECK);u.searchParams.delete(RETURN_PARAM);history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);if(back){location.replace(withInstalledVersion(back));return true}return false}
document.addEventListener('click',event=>{if(!location.pathname.toLowerCase().startsWith('/sitesettings/stats'))return;const bell=looksLikeBell(event.target);if(!bell)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();location.replace(`https://note.com/?${CLEAN_NOTICE}=1`)},true);
if(!handleVersionCheck())void openBellAfterCleanNavigation();
})();
