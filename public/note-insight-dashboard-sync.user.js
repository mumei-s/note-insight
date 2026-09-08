// ==UserScript==
// @name         無名S note INSIGHT｜公式Dashboard同期
// @namespace    https://mumei-s.github.io/note-insight/
// @version      1.2.0
// @description  note公式DashboardをINSIGHTへ同期。スマホ遅延注入・ページ復帰対応の再起動強化版。
// @match        https://note.com/sitesettings/stats*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-dashboard-sync-core-v1.1.0.js
// ==/UserScript==

(() => {
  'use strict';
  const VERSION='1.2.0';
  const flowRequested=()=>{const q=new URLSearchParams(location.search);return q.get('mumei_dashboard_sync')==='1'||!!q.get('mumei_dashboard_pair')};
  const panelReady=()=>!!document.getElementById('mumei-dashboard-sync');
  function mark(){try{localStorage.setItem('mumei-dashboard-tool-version',VERSION)}catch{}}
  function fireBoot(){
    mark();
    if(!flowRequested())return;
    if(panelReady())return;
    try{document.dispatchEvent(new Event('DOMContentLoaded',{bubbles:true,cancelable:false}))}catch{}
    try{window.dispatchEvent(new Event('DOMContentLoaded'))}catch{}
  }
  function recovery(){
    if(panelReady()||document.getElementById('mumei-dashboard-v120-recovery')||!document.body)return;
    const box=document.createElement('div');box.id='mumei-dashboard-v120-recovery';
    box.style.cssText='position:fixed;z-index:2147483647;left:10px;right:10px;bottom:12px;padding:12px;border:1px solid #65e8ff;border-radius:12px;background:#071923f2;color:#eaffff;font:900 12px/1.5 system-ui;box-shadow:0 10px 30px #0008';
    box.innerHTML='<b>📊 INSIGHT Dashboard同期 v1.2.0</b><br><span style="font-weight:600">自動起動を再試行できます。</span><button style="display:block;width:100%;margin-top:8px;min-height:42px;border:1px solid #7cecff;border-radius:9px;background:#b8ff43;color:#102000;font-weight:950">今すぐ連携・読み込みを再開</button>';
    box.querySelector('button').onclick=()=>{fireBoot();setTimeout(()=>{if(!panelReady())location.reload()},700)};
    document.body.append(box);
  }
  function ensure(){fireBoot();setTimeout(()=>{fireBoot();setTimeout(recovery,700)},900)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure,{once:true});else ensure();
  window.addEventListener('pageshow',ensure);
  window.addEventListener('popstate',ensure);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')ensure()});
})();