// ==UserScript==
// @name         無名S note INSIGHT｜公式Dashboard同期
// @namespace    https://mumei-s.github.io/note-insight/
// @version      1.7.9
// @description  INSIGHTを開いたときに、連携済みの公式ダッシュボードを自動同期。読み込み・一時停止・履歴・OFF対応。取得済みデータは画面を離れても保存します。ON/OFFはメイン🔔から変更できます。
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
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dashboard-feature-bridge-v1.js?v=102
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dashboard-save-queue-v1.js?v=103
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dashboard-sync-core-v1.1.0.js?v=179
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-dashboard-sync.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-dashboard-sync.user.js
// ==/UserScript==

(function startDashboardWrapper() {
  'use strict';
  if(!document.documentElement){const ready=new MutationObserver(()=>{if(document.documentElement){ready.disconnect();startDashboardWrapper()}});ready.observe(document,{childList:true});return}
  const VERSION='1.7.9',CORE_VERSION='1.7.9';
  let featureEpoch=0,resumeBoot=false;
  const featureOn=()=>window.__mumeiDashboardFeatureV1?.isEnabled?.()!==false;
  const autoOn=()=>window.__mumeiDashboardFeatureV1?.isAutomatic?.()??(localStorage.getItem('mumei_insight_dashboard_auto_enabled_v1')!=='false');
  if(document.documentElement?.getAttribute('data-mumei-dashboard-wrapper'))return;
  document.documentElement?.setAttribute('data-mumei-dashboard-wrapper',CORE_VERSION);
  const TOKEN_API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-import-token';
  const TOKEN_KEY='mumei-dashboard-ingest-token-v1';
  const NOTE_KEY='mumei-dashboard-note-id-v1';
  const RETURN_KEY='mumei-dashboard-return-v143';
  const FLOW_KEY='mumei-dashboard-flow-v143';
  const HANDOFF_KEY='mumei-dashboard-handoff-v143';
  const ENTRY_KEY='mumei-dashboard-entry-v179';
  const ENTRY_EVENT='mumei-dashboard-entry-refresh';
  const ENTRY_PARAM='mumei_dashboard_entry';
  const ENTRY_MAX_AGE=10*60*1000;
  const lastSavedKey=(noteId,period)=>ENTRY_KEY+':saved:'+noteId+':'+period;
  const ENTRY_GAP=2*60*60*1000;
  const HANDOFF_ID='mumei-dashboard-handoff';
  const HIDE_STYLE_ID='mumei-dashboard-panel-hide-v143';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const modern=()=>(typeof GM!=='undefined'&&Boolean(GM));
  const modernRequest=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest.bind(GM):null;
  async function gmGet(k,d=''){if(modern()&&typeof GM.getValue==='function')return GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d);return d}
  async function gmSet(k,v){if(modern()&&typeof GM.setValue==='function')return GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}
  async function gmDel(k){if(modern()&&typeof GM.deleteValue==='function')return GM.deleteValue(k);if(typeof GM_deleteValue==='function')return GM_deleteValue(k)}
  function request(body){const fn=modernRequest||(typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null);if(fn)return new Promise((resolve,reject)=>fn({method:'POST',url:TOKEN_API,headers:{'Content-Type':'application/json'},data:JSON.stringify(body),timeout:60000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{}if(r.status>=200&&r.status<300&&p?.ok!==false)resolve(p);else reject(new Error(p?.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))}));return fetch(TOKEN_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}).then(async r=>{const p=await r.json().catch(()=>({}));if(!r.ok||p?.ok===false)throw new Error(p?.error||`HTTP_${r.status}`);return p})}
  function safeReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
  function liveManager(){try{const info=typeof GM_info!=='undefined'?GM_info:typeof GM!=='undefined'?GM?.info:null,name=String(info?.scriptHandler||'').toLowerCase();return ['Userscripts','Tampermonkey','Violentmonkey','Greasemonkey','Stay'].find(value=>value.toLowerCase()===name)||''}catch{return''}}
  function markVersion(){try{localStorage.setItem('mumei-dashboard-tool-version',VERSION)}catch{}}
  function installHideStyle(forceAll=false){if(document.getElementById(HIDE_STYLE_ID))return;const s=document.createElement('style');s.id=HIDE_STYLE_ID;s.textContent=forceAll?'#mumei-dashboard-sync{display:none!important}':'#mumei-dashboard-sync{display:none!important}#mumei-dashboard-sync[data-mumei-recovery="1"]{display:block!important}';(document.head||document.documentElement).appendChild(s)}

  if(location.origin==='https://mumei-s.github.io'){
    if(location.pathname==='/note-insight/'||location.pathname==='/note-insight/index.html'){
      let requesting=false;
      const entry=async e=>{
        const {noteId,period,returnTo}=e.detail||{},back=safeReturn(returnTo);
        if(!/^[a-z0-9_-]{1,33}$/.test(String(noteId||''))||!back||!['week','month','all'].includes(period)||requesting||document.visibilityState==='hidden')return;
        requesting=true;
        try{
          await window.__mumeiDashboardFeatureV1?.ready;
          if(!featureOn()||!autoOn()||document.visibilityState==='hidden'||!liveManager())return;
          const marker=ENTRY_KEY+':'+noteId+':'+period;
          const last=Number(localStorage.getItem(marker)||0);
          if(Date.now()-last<ENTRY_GAP)return;
          const lastSaved=Number(await gmGet(lastSavedKey(noteId,period),0));
          if(Date.now()-lastSaved<ENTRY_GAP||e.detail?.from!==location.href||!featureOn()||!autoOn()||document.visibilityState==='hidden')return;
          const requestId=crypto.randomUUID(),request=JSON.stringify({noteId,period,returnTo:back,requestId,at:Date.now()});
          localStorage.setItem(marker,String(Date.now()));
          const handoffKey=ENTRY_KEY+':handoff:'+requestId;
          await gmSet(handoffKey,request);
          // Do not navigate away if the user changed screens while storage was pending.
          if(await gmGet(handoffKey)!==request||!featureOn()||!autoOn()||document.visibilityState==='hidden'||e.detail?.from!==location.href){await gmDel(handoffKey);return;}
          const target=new URL('https://note.com/sitesettings/stats');
          target.searchParams.set(ENTRY_PARAM,requestId);
          document.dispatchEvent(new Event('mumei-dashboard-entry-started'));
          location.assign(target.href);
        }catch{}finally{requesting=false}
      };
      document.addEventListener(ENTRY_EVENT,e=>void entry(e));
      return;
    }
    if(!/\/(?:tool-setup|dashboard-setup)\.html$/.test(location.pathname))return;
    installHideStyle(true);markVersion();
    const markBridge=()=>{const root=document.documentElement;if(!root)return;let changed=false;const manager=liveManager();if(manager&&root.getAttribute('data-mumei-dashboard-live-manager')!==manager){root.setAttribute('data-mumei-dashboard-live-manager',manager);changed=true}else if(!manager&&root.hasAttribute('data-mumei-dashboard-live-manager')){root.removeAttribute('data-mumei-dashboard-live-manager');changed=true}if(root.getAttribute('data-mumei-dashboard-bridge')!==VERSION){root.setAttribute('data-mumei-dashboard-bridge',VERSION);changed=true}if(root.getAttribute('data-mumei-dashboard-live-version')!==VERSION){root.setAttribute('data-mumei-dashboard-live-version',VERSION);changed=true}if(changed)window.dispatchEvent(new Event('mumei-insight-tool-ready'))};
    const cleanup=()=>{document.getElementById('mumei-dashboard-sync')?.remove();markVersion();markBridge()};
    const saveHandoff=async()=>{
      const el=document.getElementById(HANDOFF_ID),raw=el?.getAttribute('data-payload')||'';if(!raw)return;
      let requestId='';
      try{
        const p=JSON.parse(raw);requestId=String(p.requestId||'');
        if(!/^\d{8}$/.test(String(p.code||''))||!/^[a-z0-9_-]+$/i.test(String(p.noteId||'')))throw new Error('HANDOFF_INVALID');
        if(!(modern()&&typeof GM.setValue==='function'&&typeof GM.getValue==='function')&&!(typeof GM_setValue==='function'&&typeof GM_getValue==='function'))throw new Error('HANDOFF_STORAGE_UNAVAILABLE');
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
  document.addEventListener('mumei-dashboard-snapshot-confirmed',e=>{
    const {noteId,period}=e.detail||{};
    if(noteId!==localStorage.getItem(NOTE_KEY)||!/^[a-z0-9_-]{1,33}$/.test(String(noteId||''))||!['week','month','all'].includes(period))return;
    void gmSet(lastSavedKey(noteId,period),Date.now()).catch(()=>{});
  });
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
  let arrivalEntry=new URLSearchParams(location.search).get(ENTRY_PARAM)||'';
  async function handleEntry(){
    const id=arrivalEntry;if(!id)return false;arrivalEntry='';
    if(!/^[a-f0-9-]{36}$/.test(id))return false;
    const handoffKey=ENTRY_KEY+':handoff:'+id;
    let req;try{req=JSON.parse(await gmGet(handoffKey,''));await gmDel(handoffKey)}catch{return false}
    if(req?.requestId!==id||!safeReturn(req.returnTo)||!Number.isFinite(req.at)||Date.now()-req.at<0||Date.now()-req.at>ENTRY_MAX_AGE||!['week','month','all'].includes(req.period))return false;
    if(!/^[a-z0-9_-]{1,33}$/.test(String(req.noteId||'')))return false;
    const back=result=>{
      // Respect a newer user navigation during an in-flight refresh.
      if(!looksDashboard())return;
      const url=new URL(req.returnTo);url.searchParams.set('dashboardSync',['ok','partial','unchanged','skipped'].includes(result)?result:'failed');
      url.searchParams.set('dashboardVersion',VERSION);
      location.replace(url.href);
    };
    // This handoff never issues a pairing code or sends credentials across origins.
    if(!featureOn()||!autoOn()||localStorage.getItem(NOTE_KEY)!==req.noteId||!localStorage.getItem(TOKEN_KEY)){back('skipped');return true}
    if(!await waitPanel()||panel()?.dataset.coreVersion!==CORE_VERSION){back('failed');return true}
    if(!featureOn()||!autoOn()){back('skipped');return true}
    showPanel();
    sessionStorage.setItem('mumei-dashboard-requested-period',JSON.stringify({noteId:req.noteId,period:req.period}));
    const done=event=>{clearTimeout(timeout);sessionStorage.removeItem('mumei-dashboard-requested-period');back(event.detail?.result||'failed')};
    if(document.visibilityState==='hidden'){back('skipped');return true}
    document.addEventListener('mumei-dashboard-entry-finished',done,{once:true});
    const timeout=setTimeout(()=>{
      // Leave an in-flight read/save alone; its completion handler still returns.
      if(panel()?.getAttribute('aria-busy')==='true')return;
      document.removeEventListener('mumei-dashboard-entry-finished',done);
      sessionStorage.removeItem('mumei-dashboard-requested-period');back('failed');
    },120000);
    document.dispatchEvent(new CustomEvent('mumei-dashboard-read',{detail:{automatic:false,entry:true}}));
    return true;
  }
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
    if(panel()?.dataset.coreVersion!==CORE_VERSION){
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
      if(arrivalEntry&&looksDashboard()&&await handleEntry())return;
      if(!featureOn()){hidePanel();lastAutoKey='';return}
      const dashboard=looksDashboard();
      if(!dashboard){
        // Pending handoffs belong only to the dashboard, never normal note/edit pages.
        sessionStorage.removeItem(FLOW_KEY);panel()?.remove();lastAutoKey='';arrivalDirect=null;return;
      }
      if(document.documentElement.getAttribute('data-mumei-dashboard-surface')==='other')return;
      if(!await waitPanel())throw new Error('DASHBOARD_TOOL_CORE_NOT_READY');showPanel();
      if(panel()?.dataset.coreVersion!==CORE_VERSION){setCoreStatus('ダッシュボードの更新が揃っていません。更新を確認してください。','warn');const btn=document.getElementById('mumei-dash-run');if(btn)btn.disabled=true;if(!document.getElementById('mumei-dash-update')){const a=document.createElement('a');a.id='mumei-dash-update';a.textContent='更新を確認';a.href='https://mumei-s.github.io/note-insight/dashboard-setup.html';panel()?.append(a)}return;}
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
