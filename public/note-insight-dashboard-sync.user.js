// ==UserScript==
// @name         無名S note INSIGHT｜公式Dashboard同期
// @namespace    https://mumei-s.github.io/note-insight/
// @version      1.4.3
// @description  INSIGHTの読込ボタンから公式Dashboardを本人通知なしでも同期。直接遷移でもアカウント照合・読込・INSIGHT復帰まで自動実行します。
// @match        https://note.com/*
// @match        https://mumei-s.github.io/note-insight/dashboard-setup.html*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dashboard-sync-core-v1.1.0.js?v=143a
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-dashboard-sync.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-dashboard-sync.user.js
// ==/UserScript==

(() => {
  'use strict';
  // Bridge protocol remains 1.4.2 so the existing setup page can detect the patched script.
  const VERSION='1.4.2';
  const TOKEN_API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-import-token';
  const TOKEN_KEY='mumei-dashboard-ingest-token-v1';
  const NOTE_KEY='mumei-dashboard-note-id-v1';
  const RETURN_KEY='mumei-dashboard-return-v143';
  const FLOW_KEY='mumei-dashboard-flow-v143';
  const HANDOFF_KEY='mumei-dashboard-handoff-v143';
  const HANDOFF_ID='mumei-dashboard-handoff';
  const HIDE_STYLE_ID='mumei-dashboard-panel-hide-v143';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const modern=()=>Boolean(globalThis.GM);
  const modernRequest=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest.bind(GM):null;
  if(typeof globalThis.GM_xmlhttpRequest!=='function'&&modernRequest){try{globalThis.GM_xmlhttpRequest=opts=>modernRequest(opts)}catch{}}
  async function gmGet(k,d=''){if(modern()&&typeof GM.getValue==='function')return GM.getValue(k,d);if(typeof globalThis.GM_getValue==='function')return globalThis.GM_getValue(k,d);return d}
  async function gmSet(k,v){if(modern()&&typeof GM.setValue==='function')return GM.setValue(k,v);if(typeof globalThis.GM_setValue==='function')return globalThis.GM_setValue(k,v)}
  async function gmDel(k){if(modern()&&typeof GM.deleteValue==='function')return GM.deleteValue(k);if(typeof globalThis.GM_deleteValue==='function')return globalThis.GM_deleteValue(k)}
  function request(body){const fn=modernRequest||(typeof globalThis.GM_xmlhttpRequest==='function'?globalThis.GM_xmlhttpRequest:null);if(fn)return new Promise((resolve,reject)=>fn({method:'POST',url:TOKEN_API,headers:{'Content-Type':'application/json'},data:JSON.stringify(body),timeout:60000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{}if(r.status>=200&&r.status<300&&p?.ok!==false)resolve(p);else reject(new Error(p?.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))}));return fetch(TOKEN_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}).then(async r=>{const p=await r.json().catch(()=>({}));if(!r.ok||p?.ok===false)throw new Error(p?.error||`HTTP_${r.status}`);return p})}
  function safeReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
  function markVersion(){try{localStorage.setItem('mumei-dashboard-tool-version',VERSION)}catch{}}
  function installHideStyle(forceAll=false){if(document.getElementById(HIDE_STYLE_ID))return;const s=document.createElement('style');s.id=HIDE_STYLE_ID;s.textContent=forceAll?'#mumei-dashboard-sync{display:none!important}':'#mumei-dashboard-sync{display:none!important}#mumei-dashboard-sync[data-mumei-recovery="1"]{display:block!important}';(document.head||document.documentElement).appendChild(s)}

  if(location.origin==='https://mumei-s.github.io'){
    installHideStyle(true);
    const markBridge=()=>{if(document.documentElement)document.documentElement.setAttribute('data-mumei-dashboard-bridge',VERSION)};
    const cleanup=()=>{document.getElementById('mumei-dashboard-sync')?.remove();markBridge()};
    const saveHandoff=async()=>{const el=document.getElementById(HANDOFF_ID),raw=el?.getAttribute('data-payload')||'';if(!raw)return;try{const p=JSON.parse(raw);if(!/^\d{8}$/.test(String(p.code||''))||!/^[a-z0-9_-]+$/i.test(String(p.noteId||'')))throw new Error('HANDOFF_INVALID');p.version=VERSION;p.savedAt=Date.now();await gmSet(HANDOFF_KEY,JSON.stringify(p));document.documentElement?.setAttribute('data-mumei-dashboard-handoff-saved','1');document.dispatchEvent(new Event('mumei-dashboard-handoff-saved'))}catch(e){document.documentElement?.setAttribute('data-mumei-dashboard-handoff-saved','0');document.documentElement?.setAttribute('data-mumei-dashboard-handoff-error',String(e?.message||e));document.dispatchEvent(new Event('mumei-dashboard-handoff-saved'))}};
    markBridge();document.addEventListener('mumei-dashboard-handoff',()=>void saveHandoff());if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cleanup,{once:true});else cleanup();window.addEventListener('pageshow',cleanup);new MutationObserver(cleanup).observe(document.documentElement,{subtree:true,childList:true});return;
  }

  if(location.origin!=='https://note.com')return;
  installHideStyle(false);markVersion();
  async function currentNoteIdV143(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u?.urlname||u?.url_name||u?.username||'').replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?id:''}catch{return''}}
  function panel(){return document.getElementById('mumei-dashboard-sync')}
  function hidePanel(){const p=panel();if(p){p.removeAttribute('data-mumei-recovery');p.style.setProperty('display','none','important');p.setAttribute('aria-hidden','true')}}
  function showPanel(){const p=panel();if(p){p.setAttribute('data-mumei-recovery','1');p.style.setProperty('display','block','important');p.removeAttribute('aria-hidden')}}
  function setCoreStatus(message,kind=''){const s=document.querySelector('#mumei-dashboard-sync .status');if(s){s.textContent=message;s.dataset.kind=kind}}
  function ensureCorePanel(){if(panel()){hidePanel();return true}if(document.readyState!=='loading'){try{window.dispatchEvent(new Event('DOMContentLoaded'))}catch{}}const ok=!!panel();if(ok)hidePanel();return ok}
  function looksDashboard(){const p=location.pathname.toLowerCase(),body=(document.body?.innerText||'').slice(0,12000);return p.includes('/sitesettings/stats')||p.includes('/dashboard')||(/アクセス状況/.test(body)&&(/インプレッション|ページビュー|スキ/.test(body)))}
  function directPayload(){const q=new URLSearchParams(location.search),code=String(q.get('mumei_dashboard_pair')||'').replace(/\D/g,'').slice(0,8),noteId=String(q.get('mumei_dashboard_account')||'').replace(/^@/,'').toLowerCase(),returnTo=safeReturn(q.get('mumei_dashboard_return'));if(q.get('mumei_dashboard_sync')!=='1'||!/^\d{8}$/.test(code)||!/^[a-z0-9_-]+$/.test(noteId))return null;return{code,noteId,returnTo}}
  function clearDirectParams(){const u=new URL(location.href);for(const k of ['mumei_dashboard_pair','mumei_dashboard_sync','mumei_dashboard_account','mumei_dashboard_return','mumei_dashboard_tool_version'])u.searchParams.delete(k);history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash)}
  async function pairDirect(){const p=directPayload();if(!p)return false;ensureCorePanel();setCoreStatus('INSIGHTアカウント照合中…');const current=await currentNoteIdV143();if(!current)throw new Error('NOTE_LOGIN_REQUIRED');if(current!==p.noteId)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${p.noteId}`);const x=await request({action:'pair-exchange',code:p.code}),issued=String(x.noteId||'').toLowerCase();if(issued!==current)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${issued}`);localStorage.setItem(TOKEN_KEY,String(x.ingestToken||''));localStorage.setItem(NOTE_KEY,current);if(p.returnTo)localStorage.setItem(RETURN_KEY,p.returnTo);sessionStorage.setItem(FLOW_KEY,'1');markVersion();clearDirectParams();setCoreStatus(`✓ @${current} アカウント一致。公式Dashboardを読み込みます`,'ok');return true}
  async function loadPending(){const raw=await gmGet(HANDOFF_KEY,'');if(!raw)return null;try{const p=JSON.parse(String(raw));if(Date.now()-Number(p.savedAt||p.createdAt||0)>15*60*1000){await gmDel(HANDOFF_KEY);return null}return p}catch{await gmDel(HANDOFF_KEY);return null}}
  async function pairPending(){const p=await loadPending();if(!p)return false;ensureCorePanel();setCoreStatus('INSIGHTアカウント照合中…');const current=await currentNoteIdV143(),expected=String(p.noteId||'').toLowerCase();if(!current)throw new Error('NOTE_LOGIN_REQUIRED');if(current!==expected)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${expected}`);const x=await request({action:'pair-exchange',code:String(p.code||'')});const issued=String(x.noteId||'').toLowerCase();if(issued!==current)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${issued}`);localStorage.setItem(TOKEN_KEY,String(x.ingestToken||''));localStorage.setItem(NOTE_KEY,current);markVersion();const back=safeReturn(p.returnTo);if(back)localStorage.setItem(RETURN_KEY,back);sessionStorage.setItem(FLOW_KEY,'1');await gmDel(HANDOFF_KEY);setCoreStatus(`✓ @${current} アカウント一致。公式Dashboardを読み込みます`,'ok');return true}
  async function waitPanel(){for(let i=0;i<25;i++){if(ensureCorePanel())return true;await sleep(120)}return false}
  function watchCompletion(){const done=()=>{const s=document.querySelector('#mumei-dashboard-sync .status'),t=s?.textContent||'';if(!/同期完了/.test(t))return false;sessionStorage.removeItem(FLOW_KEY);markVersion();hidePanel();const back=safeReturn(localStorage.getItem(RETURN_KEY)||'');localStorage.removeItem(RETURN_KEY);if(back){const u=new URL(back);u.searchParams.set('dashboardSync','ok');u.searchParams.set('dashboardVersion',VERSION);u.searchParams.set('dashboardAt',new Date().toISOString());setTimeout(()=>location.assign(u.href),350)}return true};if(done())return;const o=new MutationObserver(()=>{hidePanel();if(done())o.disconnect()});o.observe(document.documentElement,{subtree:true,childList:true,characterData:true});setTimeout(()=>o.disconnect(),90000)}
  async function startRead(){if(!await waitPanel())throw new Error('DASHBOARD_TOOL_CORE_NOT_READY');hidePanel();watchCompletion();await sleep(1200);const btn=document.getElementById('mumei-dash-read');if(!btn)throw new Error('DASHBOARD_READ_BUTTON_NOT_FOUND');btn.click();hidePanel()}
  async function boot(){
    try{
      installHideStyle(false);
      const pairedDirect=await pairDirect();
      const pairedPending=pairedDirect?false:await pairPending();
      const flow=sessionStorage.getItem(FLOW_KEY)==='1';
      if(!pairedDirect&&!pairedPending&&!flow){panel()?.remove();return}
      if(!looksDashboard()){setCoreStatus('公式Dashboardへ移動中…');if(location.pathname!=='/sitesettings/stats'){location.assign('https://note.com/sitesettings/stats');return}}
      await startRead();
    }catch(e){ensureCorePanel();showPanel();setCoreStatus(`⚠ ${e?.message||e}｜自動読込に失敗した時だけこの復旧パネルを表示します`,'warn')}
  }
  const run=()=>void boot();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();window.addEventListener('pageshow',run);window.addEventListener('popstate',run);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')run()});
})();
