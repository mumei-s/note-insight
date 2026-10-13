// ==UserScript==
// @name         無名S note アイコン＋キャプション 貼り付け装置
// @namespace    https://github.com/mumei-s/note-insight/profile-card-paster
// @version      2.1.0
// @description  初投稿第二弾200件＋実績の算数1件。#はじめてのnote/#始めてのnoteは公開1記事のみ、#自己紹介は複数記事可。10人ごと見出しで目次対応、ランダム極薄20柄、健全な副業・在宅ワーク可、さらに高速化。
// @match        https://editor.note.com/*
// @match        https://mumei-s.github.io/note-insight/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      note.com
// @connect      assets.st-note.com
// @connect      *
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v1.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v1.user.js
// ==/UserScript==

(function(){
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
const INSIGHT_BRIDGE_KEY='mumei_profile_card_likes_300_v2';
const IS_INSIGHT_BRIDGE=location.hostname==='mumei-s.github.io'&&location.pathname.startsWith('/note-insight');
if(IS_INSIGHT_BRIDGE){
 if(page.__MUMEI_PROFILE_CARD_PASTER_BRIDGE_V2__)return;
 page.__MUMEI_PROFILE_CARD_PASTER_BRIDGE_V2__=true;
 const HISTORY='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-history';
 const TOKEN_KEY='mumei-insight-access-token';
 const gmSet=(k,v)=>Promise.resolve(GM_setValue(k,v));
 async function collect300(){
  const token=localStorage.getItem(TOKEN_KEY)||'';
  const status=document.getElementById('mumei-like300-bridge-status');
  const set=t=>{if(status)status.textContent=t};
  if(!token){set('INSIGHTへログインしてから実行');return}
  const seen=new Set(),people=[];let p=1,total=Infinity;
  try{
   while(people.length<450&&(p-1)*100<total&&p<=80){
    set('スキ履歴候補 '+people.length+'人｜'+p+'ページ');
    const r=await fetch(HISTORY,{method:'POST',headers:{'Content-Type':'application/json','X-Insight-Token':token},body:JSON.stringify({action:'likes',page:p,pageSize:100,status:'all',sort:'newest',query:'',dateFrom:null,dateTo:null}),cache:'no-store'});
    const x=await r.json().catch(()=>({}));
    if(!r.ok||x?.ok===false)throw new Error(x?.error||('HTTP '+r.status));
    const rows=Array.isArray(x.rows)?x.rows:[];total=Number(x.total||total);
    if(!rows.length)break;
    for(const row of rows){
     const actorUrl=String(row.actor_url||'');
     const urlname=(actorUrl.match(/note\.com\/([^/?#]+)/i)?.[1]||'').trim();
     const key=String(row.liker_key||urlname||actorUrl).trim().toLowerCase();
     if(!key||seen.has(key))continue;
     seen.add(key);
     people.push({
      likerKey:String(row.liker_key||key),urlname,
      creator:String(row.actor_name||urlname||'noteクリエイター').trim(),
      actorUrl,urlnameLower:urlname.toLowerCase(),
      actorImageUrl:String(row.actor_image_url||''),
      likedAt:String(row.liked_at||''),
      likedArticleUrl:String(row.article_url||''),
      likedArticleTitle:String(row.article_title||'')
     });
     if(people.length>=450)break
    }
    await gmSet(INSIGHT_BRIDGE_KEY,{version:2,at:Date.now(),count:people.length,people});
    p++
   }
   await gmSet(INSIGHT_BRIDGE_KEY,{version:2,at:Date.now(),count:people.length,people});
   set('準備完了 ✅ 候補'+people.length+'人｜note編集画面で「INSIGHTスキ300」を押す')
  }catch(e){set('停止：'+(e?.message||String(e)))}
 }
 function mountBridge(){
  if(!document.body||document.getElementById('mumei-like300-bridge'))return;
  const box=document.createElement('div');box.id='mumei-like300-bridge';
  box.style.cssText='position:fixed;right:8px;bottom:120px;z-index:2147483647;width:170px;padding:7px;border:1px solid #56cfe8;border-radius:10px;background:#071923;color:#eaffff;font:700 9px/1.4 system-ui;box-shadow:0 8px 24px #0008';
  box.innerHTML='<b style="display:block;margin-bottom:5px">極薄サム｜スキ履歴300人</b><button id="mumei-like300-bridge-go" style="width:100%;min-height:30px;border:1px solid #5de0f5;border-radius:7px;background:#0b6176;color:#fff;font-weight:900">300人を準備</button><div id="mumei-like300-bridge-status" style="margin-top:5px;color:#aeeaff">同一人物を除外して新しい順</div>';
  document.body.appendChild(box);
  box.querySelector('#mumei-like300-bridge-go').addEventListener('click',()=>void collect300())
 }
 const boot=()=>{mountBridge();const u=new URL(location.href);if(u.searchParams.get('like300prep')==='1'){u.searchParams.delete('like300prep');history.replaceState(history.state,'',u.toString());setTimeout(()=>void collect300(),500)}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 return
}

})();
