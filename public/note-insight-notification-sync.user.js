// ==UserScript==
// @name         無名S note INSIGHT 通知自動同期
// @namespace    https://github.com/mumei-s/note-insight/notification-sync
// @version      2.0.0
// @description  noteの通知ベルをINSIGHTへ同期し、登録者の共同マガジン追加通知だけを整理します
// @match        https://note.com/*
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
  const MUTE_KEY='mumei_insight_magazine_mute_ids_v1';
  const KW=/(返信|コメント|スキ|フォロー|マガジン|購入|チップ|サポート|話題|引用|紹介|高評価|ポイント|メンバーシップ|お知らせ|フォロワー)/;
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const sleep=m=>new Promise(r=>setTimeout(r,m));
  let syncing=false;
  let filterObserver=null;
  let revealMuted=false;

  const noteId=value=>{try{const u=new URL(String(value||''),location.origin);if(u.hostname!=='note.com'&&u.hostname!=='www.note.com')return'';const id=u.pathname.split('/').filter(Boolean)[0]||'';return/^[A-Za-z0-9_-]+$/.test(id)?id.toLowerCase():''}catch{return String(value||'').replace(/^@/,'').trim().toLowerCase().match(/^[a-z0-9_-]+$/)?.[0]||''}};
  const isMagazineNotice=text=>/(共同)?マガジン/.test(text)&&/(追加|投稿|新しい記事|記事を)/.test(text);
  async function muteIds(){const raw=await GM_getValue(MUTE_KEY,[]);return new Set((Array.isArray(raw)?raw:[]).map(noteId).filter(Boolean))}

  async function importMuteSettings(){
    const u=new URL(location.href),encoded=u.searchParams.get('mumei_mute_sync');
    if(!encoded)return false;
    try{
      const base64=encoded.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(encoded.length/4)*4,'=');
      const json=decodeURIComponent(escape(atob(base64)));
      const ids=[...new Set((JSON.parse(json)||[]).map(noteId).filter(Boolean))];
      await GM_setValue(MUTE_KEY,ids);
      u.searchParams.delete('mumei_mute_sync');history.replaceState(null,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);
      toast(`通知整理設定：${ids.length}人を同期しました`,'ok');
      return true;
    }catch{toast('通知整理設定を読み込めませんでした。INSIGHTからやり直してください。','error',true);return false}
  }

  function toast(text,kind='normal',stay=false){
    let el=document.getElementById('mumei-insight-notify-sync-toast');
    if(!el){el=document.createElement('div');el.id='mumei-insight-notify-sync-toast';Object.assign(el.style,{position:'fixed',right:'12px',bottom:'12px',zIndex:'2147483647',maxWidth:'min(360px,calc(100vw - 24px))',padding:'10px 12px',borderRadius:'12px',font:'700 12px/1.5 system-ui,sans-serif',boxShadow:'0 10px 35px rgba(0,0,0,.28)',transition:'opacity .25s'});document.documentElement.appendChild(el)}
    el.textContent=text;el.style.background=kind==='error'?'#3a1118':kind==='ok'?'#102a1a':'#101923';el.style.color=kind==='error'?'#ffb3bd':kind==='ok'?'#a7ffc0':'#dfeaff';el.style.border='1px solid '+(kind==='error'?'#70303c':kind==='ok'?'#315f40':'#33465c');el.style.opacity='1';
    clearTimeout(el._timer);if(!stay)el._timer=setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),300)},4500);
  }

  function request(url,body,headers={}){return new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:30000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{}if(r.status>=200&&r.status<300)resolve(p);else reject(Object.assign(new Error(p.error||('HTTP_'+r.status)),{status:r.status}))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))}))}

  async function pairIfNeeded(){
    const u=new URL(location.href),code=(u.searchParams.get('mumei_pair')||'').replace(/\D/g,'').slice(0,8);
    let token=await GM_getValue(TOKEN_KEY,'');
    if(code){
      toast('INSIGHT通知同期を連携しています…','normal',true);
      try{const p=await request(PAIR,{action:'pair-exchange',code});token=p.ingestToken||'';if(!token)throw new Error('TOKEN_NOT_RETURNED');await GM_setValue(TOKEN_KEY,token);toast('INSIGHT通知同期：連携完了','ok')}
      catch(e){toast('連携できませんでした。INSIGHTから連携をやり直してください。','error',true);return ''}
    }
    return token;
  }

  function visible(el){const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
  function strictBell(el){return el?.closest?.('button[aria-label*="通知"],a[aria-label*="通知"],button[title*="通知"],a[title*="通知"]')||null}
  function notificationBell(){
    const selectors=['button[aria-label*="通知"]','a[aria-label*="通知"]','button[title*="通知"]','a[title*="通知"]'];
    const candidates=selectors.flatMap(s=>[...document.querySelectorAll(s)]).filter(visible);
    const header=candidates.find(el=>{const r=el.getBoundingClientRect();return r.top<180&&r.left>innerWidth*.35});
    if(header)return header;
    return [...document.querySelectorAll('button,a')].filter(visible).find(el=>{const r=el.getBoundingClientRect(),t=clean(el.textContent||el.getAttribute('aria-label')||el.getAttribute('title'));return r.top<180&&r.left>innerWidth*.35&&(t==='通知'||t.includes('通知を確認'))})||null;
  }

  async function openRealNotifications(){
    for(let i=0;i<24;i++){const bell=notificationBell();if(bell){bell.click();await sleep(900);return true}await sleep(250)}
    toast('noteの通知ベルを自動で見つけられません。右上のベルを1回タップしてください。','error',true);return false;
  }

  function notificationRoot(){
    const roots=[...document.querySelectorAll('[role="dialog"],[role="menu"],aside,[data-testid*="notification" i],[class*="notification" i],[class*="Notice" i]')].filter(visible);
    const scored=roots.map(el=>({el,score:(el.querySelectorAll('li,article,[role="listitem"]').length*10)+(KW.test(clean(el.innerText))?5:0)+(getComputedStyle(el).position==='fixed'?3:0)})).sort((a,b)=>b.score-a.score);
    return scored[0]?.score>4?scored[0].el:null;
  }

  function notificationItems(root){
    let nodes=[...root.querySelectorAll('li,article,[role="listitem"],.m-navbarNoticeItem,[class*="navbarNoticeItem"]')];
    if(nodes.length<2)nodes=[...root.querySelectorAll('div')].filter(e=>{const x=clean(e.innerText);return x.length>5&&x.length<1800&&KW.test(x)&&e.querySelector('a[href]')});
    return nodes.filter(e=>!nodes.some(parent=>parent!==e&&parent.contains(e)&&clean(parent.innerText)===clean(e.innerText)));
  }

  async function applyMuteFilter(root){
    const ids=await muteIds();let hidden=0;
    for(const e of notificationItems(root)){
      const text=clean(e.innerText),actors=[...e.querySelectorAll('a[href]')].map(a=>noteId(a.getAttribute('href'))).filter(Boolean);
      const muted=isMagazineNotice(text)&&actors.some(id=>ids.has(id));
      e.dataset.mumeiMagazineMuted=muted?'1':'0';
      e.style.display=muted&&!revealMuted?'none':'';
      if(muted)hidden++;
    }
    let bar=root.querySelector('#mumei-insight-mute-summary');
    if(!bar){bar=document.createElement('div');bar.id='mumei-insight-mute-summary';Object.assign(bar.style,{position:'sticky',top:'0',zIndex:'10',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px',padding:'8px 10px',background:'#101923',color:'#dfeaff',borderBottom:'1px solid #33465c',font:'700 12px/1.4 system-ui,sans-serif'});root.prepend(bar)}
    bar.replaceChildren();const label=document.createElement('span');label.textContent=hidden?`INSIGHT整理済み ${hidden}件`:`INSIGHT整理：対象なし`;bar.appendChild(label);
    if(hidden){const button=document.createElement('button');button.type='button';button.textContent=revealMuted?'再び隠す':'一時表示';Object.assign(button.style,{border:'1px solid #4f718c',borderRadius:'7px',background:'#172838',color:'#8feaff',padding:'5px 8px',font:'700 12px system-ui'});button.onclick=()=>{revealMuted=!revealMuted;void applyMuteFilter(root)};bar.appendChild(button)}
  }

  function watchMuteFilter(){
    filterObserver?.disconnect();let timer=0;
    filterObserver=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{const root=notificationRoot();if(root)void applyMuteFilter(root)},80)});
    filterObserver.observe(document.documentElement,{childList:true,subtree:true});
    const root=notificationRoot();if(root)void applyMuteFilter(root);
  }

  function extract(root){
    const found=new Map();let nodes=[...root.querySelectorAll('li,article,[role="listitem"],.m-navbarNoticeItem,[class*="navbarNoticeItem"]')];
    if(nodes.length<2)nodes=[...root.querySelectorAll('div')].filter(e=>{const x=clean(e.innerText);return x.length>5&&x.length<1800&&KW.test(x)&&e.querySelector('a[href]')});
    for(const e of nodes){
      const raw=clean(e.innerText);if(!raw||raw.length<3||raw.length>2400||!KW.test(raw))continue;
      const links=[...e.querySelectorAll('a[href]')].map(a=>{try{return{u:new URL(a.getAttribute('href'),location.href).href,t:clean(a.innerText)}}catch{return null}}).filter(Boolean);
      const actor=links.find(x=>/^https:\/\/note\.com\/[A-Za-z0-9_-]+\/?(?:[?#].*)?$/.test(x.u));
      const target=links.find(x=>x.u.startsWith('https://note.com/')&&x.u!==actor?.u);
      const tm=e.querySelector('time[datetime]')?.getAttribute('datetime')||null;
      const sig=raw+'|'+(target?.u||'')+'|'+(tm||'');
      if(!found.has(sig))found.set(sig,{raw_text:raw,actor_name:actor?.t||null,actor_url:actor?.u||null,target_title:target?.t||null,target_url:target?.u||null,source_url:target?.u||'https://note.com/',occurred_at:tm,meta:{source:'note-notification-auto-sync',via:'real-bell'}});
    }
    return found;
  }

  function scrollBox(root){const all=[root,...root.querySelectorAll('*')];return all.find(el=>{const s=getComputedStyle(el);return el.scrollHeight>el.clientHeight+40&&/(auto|scroll)/.test(s.overflowY)})||root}
  async function collect(){
    let root=null;for(let i=0;i<20;i++){root=notificationRoot();if(root)break;await sleep(250)}if(!root)throw new Error('NOTIFICATION_PANEL_NOT_FOUND');
    const box=scrollBox(root),last=await GM_getValue(LAST_KEY,''),all=new Map();let stable=0,lastCount=-1,lastHeight=-1,sawPrevious=false;
    for(let i=0;i<50;i++){for(const [k,v] of extract(root))all.set(k,v);if(last&&all.has(last))sawPrevious=true;const h=box.scrollHeight,c=all.size;if((sawPrevious&&i>=2)||(h===lastHeight&&c===lastCount))stable++;else stable=0;if(stable>=3||c>=1200)break;lastHeight=h;lastCount=c;box.scrollTop=box.scrollHeight;await sleep(350)}
    box.scrollTop=0;for(const [k,v] of extract(root))all.set(k,v);return all;
  }

  async function ingestOpened(token,quiet=false){
    if(syncing||!token)return;syncing=true;if(!quiet)toast('本人通知をINSIGHTへ同期中…','normal',true);
    try{const found=await collect(),items=[...found.values()];let inserted=0;for(let i=0;i<items.length;i+=100){const p=await request(INGEST,{source:'note-notification-auto-sync',notifications:items.slice(i,i+100)},{'X-Ingest-Token':token});inserted+=Number(p.inserted||0)}const first=[...found.keys()][0];if(first)await GM_setValue(LAST_KEY,first);const u=new URL(location.href);u.searchParams.delete('mumei_pair');u.searchParams.delete('mumei_notify');history.replaceState(null,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);toast(`本人通知：${items.length}件確認 / 新規${inserted}件`,'ok')}
    catch(e){if(e?.status===401){await GM_deleteValue(TOKEN_KEY);toast('通知連携の期限が切れました。INSIGHTから再連携してください。','error',true)}else if(!quiet)toast('通知同期エラー：'+(e?.message||e),'error',true)}finally{syncing=false}
  }

  async function launch(){
    const u=new URL(location.href),invoked=u.searchParams.get('mumei_notify')==='1'||u.searchParams.has('mumei_pair');
    await importMuteSettings();
    const token=await pairIfNeeded();
    if(invoked){if(!token){toast('INSIGHT通知同期：未連携。INSIGHTの通知画面から初回連携してください。','error',true);return}const opened=await openRealNotifications();if(opened){watchMuteFilter();await ingestOpened(token)}return}
    document.addEventListener('click',e=>{const bell=strictBell(e.target);if(!bell)return;setTimeout(()=>{watchMuteFilter();if(token)void ingestOpened(token,true)},650)},true);
  }

  GM_registerMenuCommand('INSIGHT通知同期を再連携',async()=>{await GM_deleteValue(TOKEN_KEY);await GM_deleteValue(LAST_KEY);toast('連携情報を削除しました。INSIGHTから再連携してください。','normal',true)});
  GM_registerMenuCommand('INSIGHT通知整理の登録者を全解除',async()=>{await GM_deleteValue(MUTE_KEY);toast('共同マガジン通知の整理設定を解除しました。','normal')});
  void launch();
})();
