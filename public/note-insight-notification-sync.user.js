// ==UserScript==
// @name         無名S note INSIGHT 本人通知・統計連携
// @namespace    https://github.com/mumei-s/note-insight/notification-sync
// @version      2.9.41
// @description  軽量統合版。通知フィルター・手動保存・操作UIを1ランタイムで処理し、note本来のスクロールを妨げません。
// @match        https://note.com/*
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v2940.js?v=2940a
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-notification-sync.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-notification-sync.user.js
// ==/UserScript==
(function(){
'use strict';
const VERSION='2.9.41';
const PAIR='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-import-token';
const TOKEN='mumei_insight_notification_sync_token_v2:';
const MUTES='mumei_insight_magazine_mute_ids_v5:';
const FILTER='mumei_insight_magazine_filter_enabled_v3:';
const GROUPS='mumei_insight_notification_groups_v1:';
const VERSION_CHECK='mumei_insight_version_check';
const RETURN_PARAM='mumei_return';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const modern=()=>Boolean(globalThis.GM);
const key=(p,id)=>p+String(id||'').toLowerCase();
async function get(k,d){if(modern()&&typeof GM.getValue==='function')return GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d);return d}
async function set(k,v){if(modern()&&typeof GM.setValue==='function')return GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}
function request(url,body){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));fn({method:'POST',url,headers:{'Content-Type':'application/json'},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300?resolve(p):reject(new Error(p.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
function safeInsightReturn(value){try{const u=new URL(String(value||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
function creatorId(v){try{const raw=String(v||'').trim(),u=new URL(/^https?:\/\//i.test(raw)?raw:`https://note.com/${raw.replace(/^@/,'')}`),id=u.pathname.split('/').filter(Boolean)[0]||'';return u.hostname==='note.com'&&/^[A-Za-z0-9_-]+$/.test(id)?id.toLowerCase():''}catch{return''}}
function decode64(raw){const b=String(raw||'').replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(String(raw||'').length/4)*4,'=');return JSON.parse(decodeURIComponent(escape(atob(b))))}
async function currentAccount(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?{id}:null}catch{return null}}
function stripControlParams(u){for(const x of ['mumei_auto_notice_v2924','mumei_auto_notice_v2923','mumei_auto_notice_v2922','mumei_auto_notice_v2921','mumei_auto_notice_v2920','mumei_auto_notice_v2919','mumei_auto_notice_v2918','mumei_open_notice_v2924','mumei_open_notice_v2923','mumei_open_notice_v2922','mumei_open_notice_v2921','mumei_open_notice_v2920','mumei_open_notice_v2919','mumei_open_notice_v2918'])u.searchParams.delete(x);return u}
async function handlePair(){const u=new URL(location.href),code=clean(u.searchParams.get('mumei_pair')).replace(/\D/g,'').slice(0,8);if(!code)return false;const expected=clean(u.searchParams.get('mumei_account')).replace(/^@/,'').toLowerCase(),back=safeInsightReturn(u.searchParams.get(RETURN_PARAM)),a=await currentAccount();if(!a)return true;if(expected&&expected!==a.id)return true;try{const p=await request(PAIR,{action:'pair-exchange',code}),t=String(p.ingestToken||'');if(t)await set(key(TOKEN,a.id),t)}catch{}u.searchParams.delete('mumei_pair');u.searchParams.delete('mumei_account');u.searchParams.delete(RETURN_PARAM);history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);if(back)location.replace(back);return true}
function handleVersionCheck(){const u=new URL(location.href);if(u.searchParams.get(VERSION_CHECK)!=='1')return false;const back=safeInsightReturn(u.searchParams.get(RETURN_PARAM));u.searchParams.delete(VERSION_CHECK);u.searchParams.delete(RETURN_PARAM);stripControlParams(u);history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);if(back){const b=new URL(back);b.searchParams.set('notificationInstalled',VERSION);b.searchParams.set('notificationCheckedAt',String(Date.now()));b.searchParams.set('notificationUpdateResult','checked');location.replace(b.href)}return true}
async function handleFilterSync(){const u=new URL(location.href),reset=u.searchParams.get('mumei_filter_reset')==='1',grouped=u.searchParams.get('mumei_groups_sync');if(!reset&&!grouped)return false;const a=await currentAccount();if(!a)return true;const expected=clean(u.searchParams.get('mumei_account')).replace(/^@/,'').toLowerCase();if(expected&&expected!==a.id)return true;if(reset){await set(key(MUTES,a.id),[]);await set(key(GROUPS,a.id),[]);await set(key(FILTER,a.id),false);u.searchParams.delete('mumei_filter_reset')}else{try{const groups=(decode64(grouped)||[]).map(g=>({name:clean(g?.name)||'グループ',enabled:g?.enabled!==false,ids:[...new Set((Array.isArray(g?.ids)?g.ids:[]).map(creatorId).filter(Boolean))]})).filter(g=>g.ids.length),ids=[...new Set(groups.filter(g=>g.enabled).flatMap(g=>g.ids))];await set(key(GROUPS,a.id),groups);await set(key(MUTES,a.id),ids);await set(key(FILTER,a.id),ids.length>0)}catch{}u.searchParams.delete('mumei_groups_sync')}u.searchParams.delete('mumei_account');history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);return true}
(async()=>{const u=new URL(location.href),hadAuto=[...u.searchParams.keys()].some(k=>k.startsWith('mumei_auto_notice_')||k.startsWith('mumei_open_notice_'));if(hadAuto){stripControlParams(u);u.searchParams.delete(RETURN_PARAM);history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash)}if(handleVersionCheck())return;if(await handleFilterSync())return;await handlePair()})();
})();