// ==UserScript==
// @name         無名S note INSIGHT 本人通知 V3
// @namespace    https://github.com/mumei-s/note-insight/notification-v3
// @version      3.3.7
// @description  本人通知V3.3.7。正常時のiframe固定4パネルへ復元。タップ消失を構造的に防ぎ、通知を自動で全履歴/差分読込し、人物URL・アイコン情報も再取得します。
// @match        https://note.com/*
// @match        https://mumei-s.github.io/note-insight/*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      mumei-s.github.io
// @connect      note.com
// @connect      raw.githubusercontent.com
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-runtime-v2958.js?v=3370
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-filter-restore-v2962.js?v=3370
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-autoscan-v2970.js?v=3370
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-filter-safety-v2961.js?v=3370
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-bootstrap-v2966.js?v=3370
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js
// ==/UserScript==

(function(){
'use strict';
const VERSION='3.3.7';
const TOOL_KEY='mumei-notification-tool-version';
const RUNTIME_KEY='mumei-notification-v3-loader';
const ACTIVE_GM_KEY='mumei-notification-active-runtime-version-v1';
const gmModern=()=>Boolean(globalThis.GM);
const gmVersionGet=async()=>{try{if(gmModern()&&typeof GM.getValue==='function')return String(await GM.getValue(ACTIVE_GM_KEY,'')||'');if(typeof GM_getValue==='function')return String(GM_getValue(ACTIVE_GM_KEY,'')||'')}catch{}return''};
const gmVersionSet=async v=>{try{if(gmModern()&&typeof GM.setValue==='function')return await GM.setValue(ACTIVE_GM_KEY,String(v||''));if(typeof GM_setValue==='function')return GM_setValue(ACTIVE_GM_KEY,String(v||''))}catch{}};
if(location.hostname==='mumei-s.github.io'){
  try{localStorage.setItem(TOOL_KEY,VERSION);localStorage.setItem(RUNTIME_KEY,VERSION);window.dispatchEvent(new Event('mumei-notification-version-changed'))}catch{}
  void Promise.resolve(gmVersionSet(VERSION)).then(()=>gmVersionGet()).then(active=>{
    const confirmed=/^\d+(?:\.\d+){1,3}$/.test(active)?active:VERSION;
    try{localStorage.setItem(TOOL_KEY,confirmed);localStorage.setItem(RUNTIME_KEY,confirmed);window.dispatchEvent(new Event('mumei-notification-version-changed'))}catch{}
  });
  const FEATURE='mumei_insight_notification_feature_enabled_v1',FEATURE_PAGE='mumei-notification-feature-ui-v1',FEATURE_BRIDGE='mumei-notification-feature-bridge-v1';
  const featureModern=()=>Boolean(globalThis.GM);
  const featureGet=async(d=true)=>{try{if(featureModern()&&typeof GM.getValue==='function')return await GM.getValue(FEATURE,d);if(typeof GM_getValue==='function')return GM_getValue(FEATURE,d)}catch{}return d};
  const featureSet=async(v)=>{try{if(featureModern()&&typeof GM.setValue==='function')return await GM.setValue(FEATURE,Boolean(v));if(typeof GM_setValue==='function')return GM_setValue(FEATURE,Boolean(v))}catch{}};
  const sendFeature=enabled=>window.postMessage({source:FEATURE_BRIDGE,type:'state',enabled:Boolean(enabled)},location.origin);
  addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.source!==FEATURE_PAGE)return;const d=e.data;(async()=>{if(d.type==='set')await featureSet(Boolean(d.enabled));sendFeature(await featureGet(true))})()});
  void featureGet(true).then(sendFeature);
  if(location.pathname==='/note-insight/notification-filter-settings.html'){
    const FIL='mumei_insight_magazine_filter_enabled_v3:',GRP='mumei_insight_notification_groups_v1:',MUT='mumei_insight_magazine_mute_ids_v5:',RETURN='mumei_insight_return_bell_v1';
    const PAGE='mumei-filter-page-v1',BRIDGE='mumei-filter-bridge-v1';
    const account=(new URLSearchParams(location.search).get('notificationAccount')||'').replace(/^@/,'').toLowerCase();
    const modern=()=>Boolean(globalThis.GM);
    const gmGet=async(k,d)=>{try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d};
    const gmSet=async(k,v)=>{try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}};
    const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
    const norm=raw=>(Array.isArray(raw)?raw:[]).map((g,i)=>({name:clean(g?.name)||`グループ ${i+1}`,enabled:g?.enabled!==false,ids:[...new Set((Array.isArray(g?.ids)?g.ids:[]).map(x=>clean(x).replace(/^@/,'').toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))]}));
    const send=(type,payload={})=>window.postMessage({source:BRIDGE,type,...payload},location.origin);
    const xhr=url=>new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn){reject(new Error('xhr unavailable'));return}fn({method:'GET',url,headers:{Accept:'application/json,text/html;q=0.9,*/*;q=0.8'},onload:r=>resolve(r),onerror:()=>reject(new Error('request failed')),ontimeout:()=>reject(new Error('request timeout'))})});
    const profileCache=new Map();
    const profile=async id=>{
      if(profileCache.has(id))return profileCache.get(id);
      const p=(async()=>{
        try{
          const r=await xhr('https://note.com/api/v2/creators/'+encodeURIComponent(id));
          if(Number(r.status)>=200&&Number(r.status)<300){
            const j=JSON.parse(r.responseText||'{}'),d=j?.data??j??{};
            const nickname=clean(d.nickname||d.name||id),profileImageUrl=clean(d.profileImageUrl||d.profile_image_url||d.avatarUrl||'');
            if(nickname!==id||profileImageUrl)return{id,nickname,profileImageUrl}
          }
        }catch{}
        try{
          const r=await xhr('https://note.com/'+encodeURIComponent(id));
          const doc=new DOMParser().parseFromString(r.responseText||'','text/html');
          const title=clean(doc.querySelector('meta[property="og:title"]')?.content||doc.title||id).replace(/\s*｜\s*note.*$/u,'');
          const image=clean(doc.querySelector('meta[property="og:image"]')?.content||'');
          return{id,nickname:title||id,profileImageUrl:image}
        }catch{return{id,nickname:id,profileImageUrl:''}}
      })();
      profileCache.set(id,p);
      return p
    };
    const loadState=async()=>{
      if(!/^[a-z0-9_-]+$/.test(account)){send('error',{message:'noteアカウントを確認できません'});return}
      let groups=norm(await gmGet(GRP+account,[]));
      if(!groups.length){
        const legacy=await gmGet(MUT+account,[]);
        if(Array.isArray(legacy)&&legacy.length)groups=[{name:'通知フィルター',enabled:true,ids:[...new Set(legacy.map(String).map(x=>x.toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))]}]
      }
      send('state',{groups,filterOn:Boolean(await gmGet(FIL+account,false))})
    };
    addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.source!==PAGE)return;const d=e.data;if(d.account!==account)return;(async()=>{
      try{
        if(d.type==='load')await loadState();
        else if(d.type==='save'){
          const groups=norm(d.groups);
          await gmSet(GRP+account,groups);
          await gmSet(MUT+account,[...new Set(groups.filter(g=>g.enabled).flatMap(g=>g.ids))]);
          send('saved')
        }else if(d.type==='return-bell'){
          await gmSet(RETURN,{account,at:Date.now()});
          send('return-ready')
        }else if(d.type==='profiles'){
          const ids=[...new Set((Array.isArray(d.ids)?d.ids:[]).map(x=>clean(x).replace(/^@/,'').toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))];
          for(let i=0;i<ids.length;i+=6){
            const part=ids.slice(i,i+6);
            send('profiles',{profiles:await Promise.all(part.map(profile))});
            if(i+6<ids.length)await new Promise(r=>setTimeout(r,50))
          }
        }
      }catch(err){send('error',{message:clean(err?.message||'設定処理に失敗しました')})}
    })()});
    void loadState();
  }
  return;
}
if(location.hostname!=='note.com')return;
const confirmActiveRuntime=()=>{try{if(window.__mumeiNotificationRuntime2958||String(window.__mumeiStableNotification337?.version||'')===VERSION)void gmVersionSet(VERSION)}catch{}};
confirmActiveRuntime();setTimeout(confirmActiveRuntime,250);setTimeout(confirmActiveRuntime,1200);
try{localStorage.setItem(RUNTIME_KEY,VERSION)}catch{}
const RETURN='mumei_insight_return_bell_v1';
const modernNote=()=>Boolean(globalThis.GM);
const noteGet=async(k,d)=>{try{if(modernNote()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d};
const noteSet=async(k,v)=>{try{if(modernNote()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}};
const returnQuery=()=>new URLSearchParams(location.search);
const wantsBellReturn=()=>returnQuery().get('mumei_filter_return')==='bell'||returnQuery().get('mumei_fullread')==='1';
const cloakBellReturn=()=>{if(!wantsBellReturn()&&location.pathname!=='/notifications')return;try{document.documentElement.style.setProperty('visibility','hidden','important');document.documentElement.setAttribute('data-mumei-bell-return-cloak','1')}catch{}};
const revealBellReturn=()=>{try{document.documentElement.style.removeProperty('visibility');document.documentElement.removeAttribute('data-mumei-bell-return-cloak')}catch{}};
const bellOpen=()=>{
  const shell=document.querySelector('[data-mumei-notice-shell-v2958="1"]');
  const frame=document.getElementById('mumei-v2948-frame');
  return Boolean(shell||(frame&&getComputedStyle(frame).display!=='none'))
};
const clickRealBell=()=>{
  const selectors='[aria-label*="通知"],[aria-label*="お知らせ"],[title*="通知"],[title*="お知らせ"],[data-testid*="notification" i],[data-testid*="notice" i]';
  for(const el of document.querySelectorAll(selectors)){
    const hit=el.matches('button,[role="button"]')?el:el.closest('button,[role="button"]');
    if(hit&&hit.getBoundingClientRect().width>0&&hit.getBoundingClientRect().height>0){hit.click();return true}
  }
  return false
};
cloakBellReturn();
(async()=>{
  const stale=await noteGet(RETURN,null);if(stale)await noteSet(RETURN,null);
  if(location.pathname==='/notifications'){location.replace(location.origin+'/?mumei_filter_return=bell');return}
  if(!wantsBellReturn())return;
  let attempts=0;
  const open=()=>{
    if(bellOpen()){
      try{const u=new URL(location.href);u.searchParams.delete('mumei_filter_return');u.searchParams.delete('mumei_fullread');history.replaceState(history.state,'',u.pathname+u.search+u.hash)}catch{}
      window.__mumeiNotificationReturnDone=true;revealBellReturn();
      setTimeout(()=>window.__mumeiStableNotification337?.scheduleAuto?.(120),120);
      return
    }
    if(attempts++>100){revealBellReturn();return}
    clickRealBell();
    setTimeout(open,120)
  };
  open()
})()
const q=new URLSearchParams(location.search);
if(q.get('mumei_insight_version_check')==='1'){
  confirmActiveRuntime();
  const raw=q.get('mumei_return')||'';
  try{const back=new URL(raw);if(back.origin==='https://mumei-s.github.io'&&back.pathname.startsWith('/note-insight/')){back.searchParams.set('notificationInstalled',VERSION);back.searchParams.set('notificationCheckedAt',String(Date.now()));back.searchParams.set('notificationUpdateResult','bottom-up-saved-line-v3245');location.replace(back.href)}}catch{}
}
})();