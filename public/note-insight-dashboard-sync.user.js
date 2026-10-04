// ==UserScript==
// @name         無名S note INSIGHT｜公式Dashboard同期
// @namespace    https://mumei-s.github.io/note-insight/
// @version      1.7.1
// @description  小型の手動読み込みパネル。読み込み・一時停止・履歴・OFF対応。取得済みデータは画面を離れても保存します。ON/OFFは設定から変更できます。
// @match        https://note.com/*
// @match        https://mumei-s.github.io/note-insight/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.addValueChangeListener
// @grant        GM.deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_deleteValue
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dashboard-feature-bridge-v1.js?v=101
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dashboard-save-queue-v1.js?v=101
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dashboard-sync-core-v1.1.0.js?v=171
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-dashboard-sync.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-dashboard-sync.user.js
// ==/UserScript==

(function startDashboardWrapper() {
  'use strict';
  if(!document.documentElement){const ready=new MutationObserver(()=>{if(document.documentElement){ready.disconnect();startDashboardWrapper()}});ready.observe(document,{childList:true});return}
  const VERSION='1.7.1';
  let featureEpoch=0,resumeBoot=false;
  const featureOn=()=>window.__mumeiDashboardFeatureV1?.isEnabled?.()!==false;
  const autoOn=()=>window.__mumeiDashboardFeatureV1?.isAutomatic?.()??(localStorage.getItem('mumei_insight_dashboard_auto_enabled_v1')!=='false');
  if(document.documentElement?.getAttribute('data-mumei-dashboard-wrapper'))return;
  document.documentElement?.setAttribute('data-mumei-dashboard-wrapper',VERSION);
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
    if(!/\/(?:tool-setup|dashboard-setup)\.html$/.test(location.pathname))return;
    installHideStyle(true);markVersion();
    const markBridge=()=>{if(document.documentElement)document.documentElement.setAttribute('data-mumei-dashboard-bridge',VERSION)};
    const cleanup=()=>{document.getElementById('mumei-dashboard-sync')?.remove();markVersion();markBridge()};
    const saveHandoff=async()=>{
      const el=document.getElementById(HANDOFF_ID),raw=el?.getAttribute('data-payload')||'';if(!raw)return;
      let requestId='';
      try{
        const p=JSON.parse(raw);requestId=String(p.requestId||'');
        if(!/^\d{8}$/.test(String(p.code||''))||!/^[a-z0-9_-]+$/i.test(String(p.noteId||'')))throw new Error('HANDOFF_INVALID');
        if(!(modern()&&typeof GM.setValue==='function'&&typeof GM.getValue==='function')&&!(typeof globalThis.GM_setValue==='function'&&typeof globalThis.GM_getValue==='function'))throw new Error('HANDOFF_STORAGE_UNAVAILABLE');
        p.version=VERSION;p.savedAt=Date.now();const saved=JSON.stringify(p);await gmSet(HANDOFF_KEY,saved);
        if(await gmGet(HANDOFF_KEY,'')!==saved)throw new Error('HANDOFF_SAVE_FAILED');
        document.documentElement?.setAttribute('data-mumei-dashboard-handoff-saved','1');
      }catch(e){document.documentElement?.setAttribute('data-mumei-dashboard-handoff-saved','0');document.documentElement?.setAttribute('data-mumei-dashboard-handoff-error',String(e?.message||e))}
      document.documentElement?.setAttribute('data-mumei-dashboard-handoff-id',requestId);document.dispatchEvent(new Event('mumei-dashboard-handoff-saved'));
    };
    markBridge();document.addEventListener('mumei-dashboard-handoff',()=>void saveHandoff());if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cleanup,{once:true});else cleanup();window.addEventListener('pageshow',cleanup);new MutationObserver(cleanup).observe(document.documentElement,{subtree:true,childList:true});return;
  }

  if(location.origin!=='https://note.com')return;
  markVersion();
  async function currentNoteIdV143(){const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store',signal:c.signal});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u?.urlname||u?.url_name||u?.username||'').replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?id:''}catch{return''}finally{clearTimeout(timer)}}
  function panel(){return document.getElementById('mumei-dashboard-sync')}
  function hidePanel(){const p=panel();if(p){p.removeAttribute('data-mumei-recovery');p.style.setProperty('display','none','important');p.setAttribute('aria-hidden','true')}}
  function showPanel(){if(!featureOn())return;if(document.documentElement.getAttribute('data-mumei-dashboard-surface')==='other')return;const p=panel();if(p){p.setAttribute('data-mumei-recovery','1');p.style.setProperty('display','block','important');p.removeAttribute('aria-hidden')}}
  function setCoreStatus(message,kind='',action=''){document.dispatchEvent(new CustomEvent('mumei-dashboard-status',{detail:{message,kind,action}}))}
  function ensureCorePanel(){document.dispatchEvent(new Event('mumei-dashboard-mount'));return !!panel()}
  function looksDashboard(){return /^\/(?:sitesettings\/stats|dashboard)(?:\/|$)/.test(location.pathname)}
  function directPayload(){const q=new URLSearchParams(location.search),code=String(q.get('mumei_dashboard_pair')||'').replace(/\D/g,'').slice(0,8),noteId=String(q.get('mumei_dashboard_account')||'').replace(/^@/,'').toLowerCase(),returnTo=safeReturn(q.get('mumei_dashboard_return'));if(q.get('mumei_dashboard_sync')!=='1'||!/^\d{8}$/.test(code)||!/^[a-z0-9_-]+$/.test(noteId))return null;return{code,noteId,returnTo,period:q.get('mumei_dashboard_period')}}
  // note may normalize the URL before DOMContentLoaded. Keep the arrival request,
  // and also accept the handoff saved by the extension before the navigation.
  let arrivalDirect=directPayload();
  function clearDirectParams(){const u=new URL(location.href);for(const k of ['mumei_dashboard_pair','mumei_dashboard_sync','mumei_dashboard_account','mumei_dashboard_return','mumei_dashboard_tool_version','mumei_dashboard_period'])u.searchParams.delete(k);history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash)}
  async function loadPending(){const raw=await gmGet(HANDOFF_KEY,'');if(!raw)return null;try{const p=JSON.parse(String(raw)),age=Date.now()-Number(p.savedAt||p.createdAt||0),expiry=p.expiresAt?Date.parse(p.expiresAt):Number(p.savedAt||p.createdAt||0)+10*60*1000;if(!/^\d{8}$/.test(String(p.code||''))||!/^[a-z0-9_-]+$/i.test(String(p.noteId||''))||!Number.isFinite(age)||age<0||age>10*60*1000||!Number.isFinite(expiry)||expiry<=Date.now()){await gmDel(HANDOFF_KEY);return null}return p}catch{await gmDel(HANDOFF_KEY);return null}}
  async function pairRequest(p){
    if(!p||!featureOn())return false;const epoch=featureEpoch;ensureCorePanel();showPanel();setCoreStatus('連携情報を受信｜note本人を照合中…');
    const current=await currentNoteIdV143(),expected=String(p.noteId||'').toLowerCase();
    if(!featureOn()||epoch!==featureEpoch)return false;
    if(!current)throw new Error('NOTE_LOGIN_REQUIRED');if(current!==expected)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${expected}`);
    if(!looksDashboard())return false;
    const x=await request({action:'pair-exchange',code:String(p.code||'')}),issued=String(x.noteId||'').toLowerCase();
    if(!featureOn()||epoch!==featureEpoch)return false;
    if(issued!==current)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${issued}`);
    if(!x.ingestToken)throw new Error('PAIR_RESPONSE_INVALID');
    localStorage.setItem(TOKEN_KEY,String(x.ingestToken));localStorage.setItem(NOTE_KEY,current);
    const back=safeReturn(p.returnTo);if(back)localStorage.setItem(RETURN_KEY,back);
    sessionStorage.setItem(FLOW_KEY,'1');if(['week','month','all'].includes(p.period))sessionStorage.setItem('mumei-dashboard-requested-period',JSON.stringify({period:p.period,noteId:current}));else sessionStorage.removeItem('mumei-dashboard-requested-period');markVersion();arrivalDirect=null;clearDirectParams();
    try{const pending=await loadPending();if(pending?.code===p.code)await gmDel(HANDOFF_KEY)}catch{}
    document.dispatchEvent(new Event('mumei-dashboard-connection-ready'));
    setCoreStatus(`✓ @${current} 連携済み｜読み込みます`,'ok','read');return true;
  }
  async function waitPanel(){for(let i=0;i<25&&featureOn();i++){if(ensureCorePanel())return true;await sleep(120)}return false}
  let completionTimer=0;
  function watchCompletion(){
    if(sessionStorage.getItem(FLOW_KEY)!=='1')return;
    const done=()=>{if(!featureOn()||!/同期完了/.test(panel()?.querySelector('.status')?.textContent||''))return false;
      sessionStorage.removeItem(FLOW_KEY);markVersion();const back=safeReturn(localStorage.getItem(RETURN_KEY)||'');localStorage.removeItem(RETURN_KEY);
      if(back){const u=new URL(back);u.searchParams.set('dashboardSync','ok');u.searchParams.set('dashboardVersion',VERSION);u.searchParams.set('dashboardAt',new Date().toISOString());completionTimer=setTimeout(()=>{if(featureOn()&&looksDashboard()&&document.visibilityState!=='hidden'&&document.documentElement.getAttribute('data-mumei-dashboard-surface')!=='other')location.assign(u.href)},1800)}return true};
    if(done())return;const o=new MutationObserver(()=>{if(done())o.disconnect()});o.observe(panel(),{subtree:true,childList:true,characterData:true});setTimeout(()=>o.disconnect(),600000);
  }
  async function startRead({automatic=false}={}){
    const epoch=featureEpoch;
    if(!await waitPanel())throw new Error('DASHBOARD_TOOL_CORE_NOT_READY');showPanel();
    if(panel()?.dataset.coreVersion!==VERSION){
      setCoreStatus('ダッシュボードの更新が揃っていません。更新を確認してください。','warn');
      const btn=document.getElementById('mumei-dash-run');if(btn)btn.disabled=true;
      if(!document.getElementById('mumei-dash-update')){const a=document.createElement('a');a.id='mumei-dash-update';a.textContent='更新を確認';a.href='https://mumei-s.github.io/note-insight/dashboard-setup.html?v='+VERSION;a.style.cssText='color:#a5eaff;white-space:nowrap;padding:8px';panel()?.querySelector('.row')?.append(a)}
      return;
    }
    watchCompletion();await sleep(1200);if(epoch!==featureEpoch||!featureOn()||(automatic&&!autoOn())||document.documentElement.getAttribute('data-mumei-dashboard-surface')==='other')return;document.dispatchEvent(new CustomEvent('mumei-dashboard-read',{detail:{automatic}}));
  }
  let running=false,lastAutoKey='';
  async function boot(){
    if(running)return;running=true;const epoch=featureEpoch;
    try{
      await window.__mumeiDashboardFeatureV1?.ready;
      if(!featureOn()){hidePanel();lastAutoKey='';return}
      const dashboard=looksDashboard();
      if(!dashboard){
        // Pending handoffs belong only to the dashboard, never normal note/edit pages.
        sessionStorage.removeItem(FLOW_KEY);panel()?.remove();lastAutoKey='';arrivalDirect=null;return;
      }
      if(document.documentElement.getAttribute('data-mumei-dashboard-surface')==='other')return;
      if(!await waitPanel())throw new Error('DASHBOARD_TOOL_CORE_NOT_READY');showPanel();
      if(panel()?.dataset.coreVersion!==VERSION){setCoreStatus('ダッシュボードの更新が揃っていません。更新を確認してください。','warn');const btn=document.getElementById('mumei-dash-run');if(btn)btn.disabled=true;if(!document.getElementById('mumei-dash-update')){const a=document.createElement('a');a.id='mumei-dash-update';a.textContent='更新を確認';a.href='https://mumei-s.github.io/note-insight/dashboard-setup.html';panel()?.append(a)}return;}
      const direct=directPayload()||arrivalDirect,pending=direct?null:await loadPending();
      if(epoch!==featureEpoch||!featureOn())return;
      const requested=await pairRequest(direct||pending);if(requested)lastAutoKey='';
      if(epoch!==featureEpoch||!featureOn())return;
      // Content-tab query changes are part of one read, not a new dashboard visit.
      const key=JSON.stringify([location.pathname,localStorage.getItem(NOTE_KEY),localStorage.getItem(TOKEN_KEY)]);
      if(key===lastAutoKey)return;
      if(!localStorage.getItem(TOKEN_KEY)){showPanel();setCoreStatus('未連携｜保存先を設定','warn','connect');return}
      showPanel();if(!requested)return;
      lastAutoKey=key;await startRead({automatic:false});
    }catch(e){if(!featureOn())return;ensureCorePanel();showPanel();setCoreStatus(/ACCOUNT/.test(String(e?.message||e))?'アカウント不一致｜連携を確認':/LOGIN/.test(String(e?.message||e))?'noteへのログインが必要':/PAIR_CODE/.test(String(e?.message||e))?'連携の有効期限切れ｜もう一度連携': '連携できませんでした｜再試行','warn','connect')}
    finally{running=false;if(resumeBoot&&featureOn()){resumeBoot=false;run()}}
  }
  const run=()=>{document.dispatchEvent(new Event('mumei-dashboard-surface'));if(document.visibilityState!=='hidden')void boot()};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  window.addEventListener('pageshow',run);window.addEventListener('popstate',run);window.addEventListener('hashchange',run);
  for(const name of ['pushState','replaceState']){const original=history[name];if(!original.__mumeiDashboardRoute163){const wrapped=function(...args){const result=original.apply(this,args);queueMicrotask(run);return result};Object.defineProperty(wrapped,'__mumeiDashboardRoute163',{value:true});history[name]=wrapped}}
  document.addEventListener('mumei-dashboard-visible',run);
  let previousHref=location.href,routeWatch=0;
  function watchRoute(){if(!featureOn()||document.visibilityState==='hidden'){clearInterval(routeWatch);routeWatch=0;return}if(!routeWatch)routeWatch=setInterval(()=>{if(location.href!==previousHref){previousHref=location.href;run()}},750)}
  window.addEventListener('mumei-dashboard-feature-changed',()=>{featureEpoch++;resumeBoot=featureOn()&&running;lastAutoKey='';if(!featureOn()){clearTimeout(completionTimer);sessionStorage.removeItem(FLOW_KEY);hidePanel()}watchRoute();run()});
  window.addEventListener('mumei-dashboard-mode-changed',()=>{featureEpoch++});
  document.addEventListener('visibilitychange',()=>{watchRoute();run()});watchRoute();
})();
