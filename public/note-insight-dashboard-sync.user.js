// ==UserScript==
// @name         無名S note INSIGHT｜公式Dashboard同期
// @namespace    https://mumei-s.github.io/note-insight/
// @version      1.1.1
// @description  note公式DashboardをINSIGHTへ同期。ページ復帰・遅延注入でも連携/自動同期を取り逃がさない復旧版。
// @match        https://note.com/sitesettings/stats*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dashboard-sync-core-v1.1.0.js
// ==/UserScript==

(() => {
  'use strict';
  const VERSION='1.1.1';
  const RELOAD_KEY='mumei-dashboard-bootstrap-reload-v1';
  const flowRequested=()=>{
    const q=new URLSearchParams(location.search);
    return q.get('mumei_dashboard_sync')==='1'||!!q.get('mumei_dashboard_pair');
  };
  const panelReady=()=>!!document.getElementById('mumei-dashboard-sync');
  function markVersion(){
    try{localStorage.setItem('mumei-dashboard-tool-version',VERSION)}catch{}
  }
  function showRecovery(){
    if(document.getElementById('mumei-dashboard-recovery'))return;
    const box=document.createElement('div');
    box.id='mumei-dashboard-recovery';
    box.style.cssText='position:fixed;z-index:2147483647;left:10px;right:10px;bottom:64px;padding:12px;border:1px solid #ffca68;border-radius:12px;background:#241b08ee;color:#fff3ca;font:900 12px/1.5 system-ui;box-shadow:0 10px 30px #0008';
    box.innerHTML='<b>⚠ INSIGHT Dashboard同期ツールの起動を再試行します</b><br><span style="font-weight:600">Dashboardを開いただけで止まった場合は、このボタンで再読込してください。</span><button style="display:block;width:100%;margin-top:8px;min-height:40px;border:1px solid #ffd879;border-radius:9px;background:#ffe08d;color:#261b00;font-weight:950">Dashboard同期を再起動</button>';
    box.querySelector('button').onclick=()=>{try{sessionStorage.removeItem(RELOAD_KEY)}catch{}location.reload()};
    document.body?.append(box);
  }
  function ensureBoot(){
    markVersion();
    if(!flowRequested())return;
    setTimeout(()=>{
      if(panelReady()){
        try{sessionStorage.removeItem(RELOAD_KEY)}catch{}
        return;
      }
      let already='';
      try{already=sessionStorage.getItem(RELOAD_KEY)||''}catch{}
      if(already!==location.href){
        try{sessionStorage.setItem(RELOAD_KEY,location.href)}catch{}
        location.reload();
        return;
      }
      showRecovery();
    },1800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureBoot,{once:true});
  else ensureBoot();
  window.addEventListener('pageshow',ensureBoot);
  window.addEventListener('popstate',ensureBoot);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')ensureBoot()});
})();
