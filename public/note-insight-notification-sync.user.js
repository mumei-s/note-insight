// ==UserScript==
// @name         無名S note INSIGHT 通知自動同期
// @namespace    https://github.com/mumei-s/note-insight/notification-sync
// @version      1.0.0
// @description  note通知ページを開いた時だけ、本人通知をINSIGHTへ自動同期します
// @match        https://note.com/notifications*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-sync.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-sync.user.js
// ==/UserScript==

(function(){
  'use strict';
  const PAIR='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-import-token';
  const INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notifications';
  const TOKEN_KEY='mumei_insight_notification_sync_token_v1';
  const LAST_KEY='mumei_insight_notification_last_signature_v1';
  const KW=/(返信|コメント|スキ|フォロー|マガジン|購入|チップ|サポート|話題|引用|紹介|高評価|ポイント|メンバーシップ|お知らせ|フォロワー)/;
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const sleep=m=>new Promise(r=>setTimeout(r,m));

  function toast(text,kind='normal',stay=false){
    let el=document.getElementById('mumei-insight-notify-sync-toast');
    if(!el){el=document.createElement('div');el.id='mumei-insight-notify-sync-toast';Object.assign(el.style,{position:'fixed',right:'12px',bottom:'12px',zIndex:'2147483647',maxWidth:'min(360px,calc(100vw - 24px))',padding:'10px 12px',borderRadius:'12px',font:'700 12px/1.5 system-ui,sans-serif',boxShadow:'0 10px 35px rgba(0,0,0,.28)',transition:'opacity .25s'});document.documentElement.appendChild(el)}
    el.textContent=text;el.style.background=kind==='error'?'#3a1118':kind==='ok'?'#102a1a':'#101923';el.style.color=kind==='error'?'#ffb3bd':kind==='ok'?'#a7ffc0':'#dfeaff';el.style.border='1px solid '+(kind==='error'?'#70303c':kind==='ok'?'#315f40':'#33465c');el.style.opacity='1';
    clearTimeout(el._timer);if(!stay)el._timer=setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),300)},4000);
  }

  function request(url,body,headers={}){return new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:30000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{}if(r.status>=200&&r.status<300)resolve(p);else reject(Object.assign(new Error(p.error||('HTTP_'+r.status)),{status:r.status}))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))}))}

  async function pairIfNeeded(){
    const u=new URL(location.href),code=(u.searchParams.get('mumei_pair')||'').replace(/\D/g,'').slice(0,8);
    let token=await GM_getValue(TOKEN_KEY,'');
    if(code){toast('INSIGHT通知同期を連携しています…','normal',true);try{const p=await request(PAIR,{action:'pair-exchange',code});token=p.ingestToken||'';if(!token)throw new Error('TOKEN_NOT_RETURNED');await GM_setValue(TOKEN_KEY,token);u.searchParams.delete('mumei_pair');history.replaceState(null,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);toast('INSIGHT通知同期：連携完了','ok')}catch(e){toast('連携できませんでした。INSIGHTから連携をやり直してください。','error',true);return ''}}
    return token;
  }

  function extract(){
    const found=new Map();let nodes=[...document.querySelectorAll('li,article,[role="listitem"]')];
    if(nodes.length<5)nodes=[...document.querySelectorAll('div')].filter(e=>{const x=clean(e.innerText);return x.length>5&&x.length<2400&&KW.test(x)&&e.querySelector('a[href]')});
    for(const e of nodes){const raw=clean(e.innerText);if(!raw||raw.length<3||raw.length>3000||!KW.test(raw))continue;const links=[...e.querySelectorAll('a[href]')].map(a=>{try{return{u:new URL(a.getAttribute('href'),location.href).href,t:clean(a.innerText)}}catch{return null}}).filter(Boolean);const actor=links.find(x=>/^https:\/\/note\.com\/[A-Za-z0-9_-]+\/?(?:[?#].*)?$/.test(x.u)&&!x.u.includes('/notifications'));const target=links.find(x=>x.u.startsWith('https://note.com/')&&!x.u.includes('/notifications')&&x.u!==actor?.u);const tm=e.querySelector('time[datetime]')?.getAttribute('datetime')||null;const sig=raw+'|'+(target?.u||'')+'|'+(tm||'');if(!found.has(sig))found.set(sig,{raw_text:raw,actor_name:actor?.t||null,actor_url:actor?.u||null,target_title:target?.t||null,target_url:target?.u||null,source_url:target?.u||location.origin+'/notifications',occurred_at:tm,meta:{source:'note-notification-auto-sync'}})}
    return found;
  }

  async function collect(){
    const startY=scrollY,last=await GM_getValue(LAST_KEY,''),all=new Map();let stable=0,lastCount=-1,lastHeight=-1,sawPrevious=false;
    for(let i=0;i<70;i++){
      for(const [k,v] of extract())all.set(k,v);
      if(last&&all.has(last))sawPrevious=true;
      const h=document.documentElement.scrollHeight,c=all.size;
      if((sawPrevious&&i>=2)||(h===lastHeight&&c===lastCount))stable++;else stable=0;
      if(stable>=3||c>=1500)break;
      lastHeight=h;lastCount=c;window.scrollTo(0,h);await sleep(450);
    }
    for(const [k,v] of extract())all.set(k,v);window.scrollTo(0,startY);
    return all;
  }

  async function sync(){
    const token=await pairIfNeeded();
    if(!token){toast('INSIGHT通知同期：未連携。INSIGHTの通知画面から初回連携してください。','error',true);return}
    toast('本人通知をINSIGHTへ同期中…','normal',true);
    try{
      await sleep(900);const found=await collect(),items=[...found.values()];let inserted=0;
      for(let i=0;i<items.length;i+=100){const p=await request(INGEST,{source:'note-notification-auto-sync',notifications:items.slice(i,i+100)},{'X-Ingest-Token':token});inserted+=Number(p.inserted||0)}
      const first=[...found.keys()][0];if(first)await GM_setValue(LAST_KEY,first);
      toast(`本人通知：${items.length}件確認 / 新規${inserted}件`,'ok');
    }catch(e){if(e?.status===401){await GM_deleteValue(TOKEN_KEY);toast('通知連携の期限が切れました。INSIGHTから再連携してください。','error',true)}else toast('通知同期エラー：'+(e?.message||e),'error',true)}
  }

  GM_registerMenuCommand('INSIGHT通知同期を再連携',async()=>{await GM_deleteValue(TOKEN_KEY);await GM_deleteValue(LAST_KEY);toast('連携情報を削除しました。INSIGHTから再連携してください。','normal',true)});
  void sync();
})();
