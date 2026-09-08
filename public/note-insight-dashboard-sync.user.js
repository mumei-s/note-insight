// ==UserScript==
// @name         無名S note INSIGHT｜公式Dashboard同期
// @namespace    https://mumei-s.github.io/note-insight/
// @version      1.4.0
// @description  INSIGHTの既存ボタンから本人確認・公式Dashboard読込・INSIGHT復帰まで自動実行。通常時パネル完全非表示、失敗時のみ復旧表示。
// @match        https://note.com/*
// @match        https://mumei-s.github.io/note-insight/dashboard-setup.html*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dashboard-sync-core-v1.1.0.js
// ==/UserScript==

(() => {
  'use strict';
  const VERSION='1.4.0';
  const TOKEN_API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-import-token';
  const TOKEN_KEY='mumei-dashboard-ingest-token-v1';
  const NOTE_KEY='mumei-dashboard-note-id-v1';
  const RETURN_KEY='mumei-dashboard-return-v140';
  const FLOW_KEY='mumei-dashboard-flow-v140';
  const HANDOFF_KEY='mumei-dashboard-handoff-v140';
  const HANDOFF_ID='mumei-dashboard-handoff';
  const HIDE_STYLE_ID='mumei-dashboard-panel-hide-v140';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const gmGet=(k,d='')=>Promise.resolve(GM_getValue(k,d));
  const gmSet=(k,v)=>Promise.resolve(GM_setValue(k,v));
  const gmDel=k=>Promise.resolve(GM_deleteValue(k));
  function request(body){return new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'POST',url:TOKEN_API,headers:{'Content-Type':'application/json'},data:JSON.stringify(body),timeout:60000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{}if(r.status>=200&&r.status<300&&p?.ok!==false)resolve(p);else reject(new Error(p?.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))}))}
  function safeReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
  function markVersion(){try{localStorage.setItem('mumei-dashboard-tool-version',VERSION)}catch{}}
  function installHideStyle(){if(location.origin!=='https://note.com'||document.getElementById(HIDE_STYLE_ID))return;const s=document.createElement('style');s.id=HIDE_STYLE_ID;s.textContent='#mumei-dashboard-sync{display:none!important}#mumei-dashboard-sync[data-mumei-recovery="1"]{display:block!important}';(document.head||document.documentElement).appendChild(s)}

  if(location.origin==='https://mumei-s.github.io'){
    const markBridge=()=>{if(document.documentElement)document.documentElement.setAttribute('data-mumei-dashboard-bridge',VERSION)};
    const cleanup=()=>{document.getElementById('mumei-dashboard-sync')?.remove();markBridge()};
    const saveHandoff=async()=>{const el=document.getElementById(HANDOFF_ID),raw=el?.getAttribute('data-payload')||'';if(!raw)return;try{const p=JSON.parse(raw);if(!/^\d{8}$/.test(String(p.code||''))||!/^[a-z0-9_-]+$/i.test(String(p.noteId||'')))throw new Error('HANDOFF_INVALID');p.version=VERSION;p.savedAt=Date.now();await gmSet(HANDOFF_KEY,JSON.stringify(p));document.documentElement?.setAttribute('data-mumei-dashboard-handoff-saved','1');document.dispatchEvent(new Event('mumei-dashboard-handoff-saved'))}catch(e){document.documentElement?.setAttribute('data-mumei-dashboard-handoff-saved','0');document.documentElement?.setAttribute('data-mumei-dashboard-handoff-error',String(e?.message||e));document.dispatchEvent(new Event('mumei-dashboard-handoff-saved'))}};
    markBridge();document.addEventListener('mumei-dashboard-handoff',()=>void saveHandoff());if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cleanup,{once:true});else cleanup();window.addEventListener('pageshow',cleanup);return;
  }

  if(location.origin!=='https://note.com')return;
  installHideStyle();markVersion();
  async function currentNoteIdV140(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u?.urlname||u?.url_name||u?.username||'').replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?id:''}catch{return''}}
  function panel(){return document.getElementById('mumei-dashboard-sync')}
  function hidePanel(){const p=panel();if(p){p.removeAttribute('data-mumei-recovery');p.style.setProperty('display','none','important');p.setAttribute('aria-hidden','true')}}
  function showPanel(){const p=panel();if(p){p.setAttribute('data-mumei-recovery','1');p.style.setProperty('display','block','important');p.removeAttribute('aria-hidden')}}
  function setCoreStatus(message,kind=''){const s=document.querySelector('#mumei-dashboard-sync .status');if(s){s.textContent=message;s.dataset.kind=kind}}
  function ensureCorePanel(){if(panel()){hidePanel();return true}if(document.readyState!=='loading'){try{window.dispatchEvent(new Event('DOMContentLoaded'))}catch{}}const ok=!!panel();if(ok)hidePanel();return ok}
  function looksDashboard(){const p=location.pathname.toLowerCase(),body=(document.body?.innerText||'').slice(0,12000);return p.includes('/sitesettings/stats')||p.includes('/dashboard')||(/アクセス状況/.test(body)&&(/インプレッション|ページビュー|スキ/.test(body)))}
  async function loadPending(){const raw=await gmGet(HANDOFF_KEY,'');if(!raw)return null;try{const p=JSON.parse(String(raw));if(Date.now()-Number(p.savedAt||p.createdAt||0)>15*60*1000){await gmDel(HANDOFF_KEY);return null}return p}catch{await gmDel(HANDOFF_KEY);return null}}
  async function pairPending(){const p=await loadPending();if(!p)return false;ensureCorePanel();setCoreStatus('INSIGHT本人確認中…');const current=await currentNoteIdV140(),expected=String(p.noteId||'').toLowerCase();if(!current)throw new Error('NOTE_LOGIN_REQUIRED');if(current!==expected)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${expected}`);const x=await request({action:'pair-exchange',code:String(p.code||'')});const issued=String(x.noteId||'').toLowerCase();if(issued!==current)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${issued}`);localStorage.setItem(TOKEN_KEY,String(x.ingestToken||''));localStorage.setItem(NOTE_KEY,current);localStorage.setItem('mumei-dashboard-tool-version',VERSION);const back=safeReturn(p.returnTo);if(back)localStorage.setItem(RETURN_KEY,back);sessionStorage.setItem(FLOW_KEY,'1');await gmDel(HANDOFF_KEY);setCoreStatus(`✓ @${current} 本人連携完了。公式Dashboardを読み込みます`,'ok');return true}
  async function waitPanel(){for(let i=0;i<25;i++){if(ensureCorePanel())return true;await sleep(120)}return false}
  function watchCompletion(){const done=()=>{const s=document.querySelector('#mumei-dashboard-sync .status'),t=s?.textContent||'';if(!/同期完了/.test(t))return false;sessionStorage.removeItem(FLOW_KEY);markVersion();hidePanel();const back=safeReturn(localStorage.getItem(RETURN_KEY)||'');localStorage.removeItem(RETURN_KEY);if(back){const u=new URL(back);u.searchParams.set('dashboardSync','ok');u.searchParams.set('dashboardVersion',VERSION);u.searchParams.set('dashboardAt',new Date().toISOString());setTimeout(()=>location.assign(u.href),350)}return true};if(done())return;const o=new MutationObserver(()=>{hidePanel();if(done())o.disconnect()});o.observe(document.documentElement,{subtree:true,childList:true,characterData:true});setTimeout(()=>o.disconnect(),90000)}
  async function startRead(){if(!await waitPanel())throw new Error('DASHBOARD_TOOL_CORE_NOT_READY');hidePanel();watchCompletion();await sleep(1200);const btn=document.getElementById('mumei-dash-read');if(!btn)throw new Error('DASHBOARD_READ_BUTTON_NOT_FOUND');btn.click();hidePanel()}
  async function boot(){try{installHideStyle();const pairedNow=await pairPending(),flow=sessionStorage.getItem(FLOW_KEY)==='1';if(!pairedNow&&!flow){panel()?.remove();return}if(!looksDashboard()){setCoreStatus('公式Dashboardへ移動中…');if(location.pathname!=='/sitesettings/stats'){location.assign('https://note.com/sitesettings/stats');return}}await startRead()}catch(e){ensureCorePanel();showPanel();setCoreStatus(`⚠ ${e?.message||e}｜復旧が必要なため、このパネルだけ表示しています`,'warn')}}
  const run=()=>void boot();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();window.addEventListener('pageshow',run);window.addEventListener('popstate',run);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')run()});
})();
