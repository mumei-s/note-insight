// ==UserScript==
// @name         無名S note INSIGHT 通知自動同期
// @namespace    https://github.com/mumei-s/note-insight/notification-sync
// @version      2.2.0
// @description  noteの実ログインIDごとに本人通知をINSIGHTへ同期し、登録者の共同マガジン追加通知だけを整理します
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
  const INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-ingest-v2';
  const TOKEN_PREFIX='mumei_insight_notification_sync_token_v2:';
  const LAST_PREFIX='mumei_insight_notification_last_signature_v2:';
  const MUTE_PREFIX='mumei_insight_magazine_mute_ids_v2:';
  const LEGACY_TOKEN_KEY='mumei_insight_notification_sync_token_v1';
  const KW=/(返信|コメント|スキ|フォロー|マガジン|購入|チップ|サポート|話題|引用|紹介|高評価|ポイント|メンバーシップ|お知らせ|フォロワー)/;
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const sleep=m=>new Promise(r=>setTimeout(r,m));
  const accountKey=(prefix,id)=>`${prefix}${String(id||'').toLowerCase()}`;
  let syncing=false;
  let filterObserver=null;
  let lifecycleRoot=null;
  let lifecycleTimer=0;
  let filterRunning=false;
  let revealMuted=false;
  let lifecycleAccountId='';
  let lifecycleToken='';

  const noteId=value=>{try{const u=new URL(String(value||''),location.origin);if(u.hostname!=='note.com'&&u.hostname!=='www.note.com')return'';const id=u.pathname.split('/').filter(Boolean)[0]||'';return/^[A-Za-z0-9_-]+$/.test(id)?id.toLowerCase():''}catch{return String(value||'').replace(/^@/,'').trim().toLowerCase().match(/^[a-z0-9_-]+$/)?.[0]||''}};
  const isMagazineNotice=text=>/(共同)?マガジン/.test(text)&&/(追加|投稿|新しい記事|記事を)/.test(text);

  async function currentAccount(){
    try{
      const r=await fetch('/api/v2/current_user',{credentials:'include',headers:{accept:'application/json'},cache:'no-store'});
      if(!r.ok)return null;
      const j=await r.json(),d=j?.data??j??{},u=d?.user||d,id=String(u?.urlname||u?.url_name||u?.username||'').trim().toLowerCase();
      if(!/^[a-z0-9_-]+$/.test(id))return null;
      return{id,name:String(u?.nickname||u?.name||id)};
    }catch{return null}
  }
  async function tokenFor(id){return id?String(await GM_getValue(accountKey(TOKEN_PREFIX,id),'')||''):''}
  async function setToken(id,token){if(id&&token)await GM_setValue(accountKey(TOKEN_PREFIX,id),token)}
  async function deleteToken(id){if(id)await GM_deleteValue(accountKey(TOKEN_PREFIX,id))}
  async function muteIds(id){const raw=id?await GM_getValue(accountKey(MUTE_PREFIX,id),[]):[];return new Set((Array.isArray(raw)?raw:[]).map(noteId).filter(Boolean))}

  async function importMuteSettings(accountId){
    const u=new URL(location.href),encoded=u.searchParams.get('mumei_mute_sync');
    if(!encoded)return false;
    if(!accountId){toast('noteへログインしてから通知整理設定を反映してください。','error',true);return false}
    try{
      const base64=encoded.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(encoded.length/4)*4,'=');
      const json=decodeURIComponent(escape(atob(base64)));
      const ids=[...new Set((JSON.parse(json)||[]).map(noteId).filter(Boolean))];
      await GM_setValue(accountKey(MUTE_PREFIX,accountId),ids);
      u.searchParams.delete('mumei_mute_sync');u.searchParams.delete('mumei_account');history.replaceState(null,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);
      toast(`@${accountId} 通知整理設定：${ids.length}人を同期しました`,'ok');
      return true;
    }catch{toast('通知整理設定を読み込めませんでした。INSIGHTからやり直してください。','error',true);return false}
  }

  function statusDock(){
    let host=document.getElementById('mumei-insight-notify-sync-toast');
    if(host)return host;
    host=document.createElement('div');host.id='mumei-insight-notify-sync-toast';
    Object.assign(host.style,{position:'fixed',right:'0',bottom:'74px',zIndex:'2147483647',display:'flex',alignItems:'stretch',font:'700 12px/1.5 system-ui,sans-serif',transition:'transform .22s ease',filter:'drop-shadow(0 10px 24px rgba(0,0,0,.35))'});
    host.innerHTML='<button type="button" data-sync-tab aria-label="通知同期の状態を開く" style="width:38px;min-height:58px;border:1px solid #40566f;border-right:0;border-radius:12px 0 0 12px;background:#101923;color:#8feaff;padding:5px;line-height:1.15;font-weight:900;touch-action:manipulation">🔔<br>同期</button><div data-sync-panel style="display:none;width:min(300px,calc(100vw - 48px));padding:10px 11px;border:1px solid #40566f;border-right:0;border-radius:12px 0 0 12px;background:#101923;color:#dfeaff"><div style="display:flex;align-items:flex-start;gap:8px"><span data-sync-message style="flex:1;min-width:0;overflow-wrap:anywhere"></span><button type="button" data-sync-close aria-label="閉じる" style="flex:0 0 30px;width:30px;height:30px;border:1px solid #52667d;border-radius:8px;background:#172838;color:#fff;font-weight:900">×</button></div></div>';
    const tab=host.querySelector('[data-sync-tab]'),panel=host.querySelector('[data-sync-panel]'),close=host.querySelector('[data-sync-close]');
    const open=()=>{tab.style.display='none';panel.style.display='block';host.dataset.open='1'};
    const collapse=()=>{panel.style.display='none';tab.style.display='block';host.dataset.open='0'};
    tab.addEventListener('click',open);close.addEventListener('click',()=>{collapse();host.style.display='none'});
    host._open=open;host._collapse=collapse;document.documentElement.appendChild(host);return host;
  }
  function toast(text,kind='normal',stay=false){
    const host=statusDock(),panel=host.querySelector('[data-sync-panel]'),tab=host.querySelector('[data-sync-tab]'),message=host.querySelector('[data-sync-message]');
    const colors=kind==='error'?['#3a1118','#ffb3bd','#70303c']:kind==='ok'?['#102a1a','#a7ffc0','#315f40']:['#101923','#dfeaff','#40566f'];
    message.textContent=text;panel.style.background=colors[0];panel.style.color=colors[1];panel.style.borderColor=colors[2];tab.style.borderColor=colors[2];host.style.display='flex';host._open();
    clearTimeout(host._timer);host._timer=setTimeout(()=>host._collapse(),stay?9000:4500);
  }
  function request(url,body,headers={}){return new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:30000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{}if(r.status>=200&&r.status<300)resolve(p);else reject(Object.assign(new Error(p.error||('HTTP_'+r.status)),{status:r.status,payload:p}))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))}))}

  async function pairIfNeeded(account){
    const u=new URL(location.href),code=(u.searchParams.get('mumei_pair')||'').replace(/\D/g,'').slice(0,8),expected=String(u.searchParams.get('mumei_account')||'').trim().toLowerCase();
    const id=account?.id||'';
    let token=await tokenFor(id);
    if(code){
      if(!id){toast('noteへログインしてから連携してください。','error',true);return ''}
      if(expected&&expected!==id){toast(`連携先は @${expected} ですが、noteログイン中は @${id} です。正しいアカウントへ切り替えてからやり直してください。`,'error',true);return ''}
      toast(`@${id} のINSIGHT通知同期を連携しています…`,'normal',true);
      try{
        const p=await request(PAIR,{action:'pair-exchange',code});
        const paired=String(p.noteId||expected||id).toLowerCase();
        if(paired&&paired!==id)throw new Error('PAIR_ACCOUNT_MISMATCH');
        token=p.ingestToken||'';if(!token)throw new Error('TOKEN_NOT_RETURNED');
        await setToken(id,token);await GM_deleteValue(LEGACY_TOKEN_KEY);
        u.searchParams.delete('mumei_pair');u.searchParams.delete('mumei_account');history.replaceState(null,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);
        toast(`@${id} INSIGHT通知同期：連携完了`,'ok');
      }catch(e){toast('連携できませんでした。INSIGHTから連携をやり直してください。','error',true);return ''}
    }
    return token;
  }

  function visible(el){const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
  function strictBell(el){const control=el?.closest?.('button,a,[role="button"]');if(!control||!visible(control))return null;const label=clean([control.getAttribute('aria-label'),control.getAttribute('title'),control.getAttribute('data-testid'),control.textContent].filter(Boolean).join(' '));if(/通知|notice|notification/i.test(label))return control;const r=control.getBoundingClientRect();return r.top<150&&r.right>innerWidth*.45&&r.width<82&&r.height<82&&control.querySelector('svg')?control:null}
  function notificationBell(){const selectors=['button[aria-label*="通知"]','a[aria-label*="通知"]','button[title*="通知"]','a[title*="通知"]'];const candidates=selectors.flatMap(s=>[...document.querySelectorAll(s)]).filter(visible);const header=candidates.find(el=>{const r=el.getBoundingClientRect();return r.top<180&&r.left>innerWidth*.35});if(header)return header;return [...document.querySelectorAll('button,a')].filter(visible).find(el=>{const r=el.getBoundingClientRect(),t=clean(el.textContent||el.getAttribute('aria-label')||el.getAttribute('title'));return r.top<180&&r.left>innerWidth*.35&&(t==='通知'||t.includes('通知を確認'))})||null}
  function noticeText(el){return clean(el?.innerText||el?.textContent)}
  function selfAndChildLinks(el){return[...(el?.matches?.('a[href]')?[el]:[]),...(el?.querySelectorAll?.('a[href]')||[])]}
  function likelyNotice(el){const text=noticeText(el);if(text.length<4||text.length>1400||!KW.test(text)||!selfAndChildLinks(el).length)return false;return el.matches?.('.m-navbarNoticeItem,[class*="navbarNoticeItem"],[role="listitem"],li,article')||Boolean(el.querySelector?.('time[datetime]'))||/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)/.test(text)}
  function notificationItems(root=document){const known=[...root.querySelectorAll('li,article,[role="listitem"],.m-navbarNoticeItem,[class*="navbarNoticeItem"]')].filter(likelyNotice);const links=[...root.querySelectorAll('a[href]')].filter(likelyNotice);const fallback=known.length+links.length>=2?[]:[...root.querySelectorAll('div,section')].filter(likelyNotice);const nodes=[...new Set([...known,...links,...fallback])];return nodes.filter(el=>!nodes.some(child=>child!==el&&el.contains(child)&&noticeText(child)===noticeText(el)))}
  function tabByText(value){return[...document.querySelectorAll('[role="tab"],button,a,[tabindex],span,div,p')].filter(visible).find(el=>{const r=el.getBoundingClientRect();return r.top<360&&r.width<innerWidth*.75&&clean(el.textContent)===value})||null}
  function tabContext(){const notices=tabByText('通知'),news=tabByText('お知らせ');if(!notices||!news)return null;let node=notices.parentElement;while(node&&node!==document.body){if(node.contains(news))return node;node=node.parentElement}return null}
  function notificationRoot(){const roots=[...document.querySelectorAll('[role="dialog"],[role="menu"],aside,[data-testid*="notification" i],[class*="notification" i],[class*="Notice" i]')].filter(visible);const tab=tabContext();if(tab){let node=tab;while(node&&node!==document.body){if(notificationItems(node).length)return node;node=node.parentElement}}const scored=roots.map(el=>({el,score:notificationItems(el).length*10+(KW.test(noticeText(el))?5:0)+(getComputedStyle(el).position==='fixed'?3:0)})).sort((a,b)=>b.score-a.score);return scored[0]?.score>9?scored[0].el:null}
  async function requestNotificationOpen(){if(notificationRoot())return true;for(let i=0;i<8;i++){const bell=notificationBell();if(bell){bell.click();toast('通知を開いています…');await sleep(900);return Boolean(notificationRoot())}await sleep(250)}toast('右上のベルを1回タップしてください。通知が開いたら自動で同期します。','normal',true);return false}

  async function applyMuteFilter(root,accountId=lifecycleAccountId){
    if(filterRunning)return;filterRunning=true;
    try{
      const ids=await muteIds(accountId);let hidden=0;
      for(const e of notificationItems(root)){
        if(e.id==='mumei-insight-mute-summary')continue;
        const text=noticeText(e),actors=selfAndChildLinks(e).map(a=>noteId(a.getAttribute('href'))).filter(Boolean),muted=isMagazineNotice(text)&&actors.some(id=>ids.has(id)),display=muted&&!revealMuted?'none':'';
        if(e.dataset.mumeiMagazineMuted!==(muted?'1':'0'))e.dataset.mumeiMagazineMuted=muted?'1':'0';if(e.style.display!==display)e.style.display=display;if(muted)hidden++;
      }
      let bar=root.querySelector('#mumei-insight-mute-summary');
      if(!bar){bar=document.createElement('div');bar.id='mumei-insight-mute-summary';Object.assign(bar.style,{position:'sticky',top:'0',zIndex:'10',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px',padding:'8px 10px',background:'#101923',color:'#dfeaff',borderBottom:'1px solid #33465c',font:'700 12px/1.4 system-ui,sans-serif'});bar.innerHTML='<span data-mumei-mute-label></span><button type="button" data-mumei-mute-toggle style="border:1px solid #4f718c;border-radius:7px;background:#172838;color:#8feaff;padding:5px 8px;font:700 12px system-ui"></button>';bar.querySelector('button').onclick=()=>{revealMuted=!revealMuted;void applyMuteFilter(root,lifecycleAccountId)};root.prepend(bar)}
      const label=bar.querySelector('[data-mumei-mute-label]'),button=bar.querySelector('[data-mumei-mute-toggle]'),labelText=hidden?`@${accountId} INSIGHT整理済み ${hidden}件`:`@${accountId||'?'} INSIGHT整理：対象なし`,buttonText=revealMuted?'再び隠す':'一時表示';if(label.textContent!==labelText)label.textContent=labelText;button.hidden=!hidden;if(button.textContent!==buttonText)button.textContent=buttonText;
    }finally{filterRunning=false}
  }

  function extract(root){const found=new Map();for(const e of notificationItems(root)){const raw=clean(e.innerText);if(!raw||raw.length<3||raw.length>2400||!KW.test(raw))continue;const links=selfAndChildLinks(e).map(a=>{try{return{u:new URL(a.getAttribute('href'),location.href).href,t:clean(a.innerText)}}catch{return null}}).filter(Boolean);const actor=links.find(x=>/^https:\/\/note\.com\/[A-Za-z0-9_-]+\/?(?:[?#].*)?$/.test(x.u));const target=links.find(x=>x.u.startsWith('https://note.com/')&&x.u!==actor?.u);const tm=e.querySelector('time[datetime]')?.getAttribute('datetime')||null;const sig=raw+'|'+(target?.u||'')+'|'+(tm||'');if(!found.has(sig))found.set(sig,{raw_text:raw,actor_name:actor?.t||null,actor_url:actor?.u||null,target_title:target?.t||null,target_url:target?.u||null,source_url:target?.u||'https://note.com/',occurred_at:tm,meta:{source:'note-notification-auto-sync',via:'real-bell'}})}return found}
  function scrollBox(root){const all=[root,...root.querySelectorAll('*')];return all.find(el=>{const s=getComputedStyle(el);return el.scrollHeight>el.clientHeight+40&&/(auto|scroll)/.test(s.overflowY)})||root}
  async function collect(accountId){let root=null;for(let i=0;i<20;i++){root=notificationRoot();if(root)break;await sleep(250)}if(!root)throw new Error('NOTIFICATION_PANEL_NOT_FOUND');const box=scrollBox(root),last=await GM_getValue(accountKey(LAST_PREFIX,accountId),''),all=new Map();let stable=0,lastCount=-1,lastHeight=-1,sawPrevious=false;for(let i=0;i<50;i++){for(const [k,v] of extract(root))all.set(k,v);if(last&&all.has(last))sawPrevious=true;const h=box.scrollHeight,c=all.size;if((sawPrevious&&i>=2)||(h===lastHeight&&c===lastCount))stable++;else stable=0;if(stable>=3||c>=1200)break;lastHeight=h;lastCount=c;box.scrollTop=box.scrollHeight;await sleep(350)}box.scrollTop=0;for(const [k,v] of extract(root))all.set(k,v);return all}

  async function ingestOpened(token,accountId,quiet=false){
    if(syncing||!token||!accountId)return;syncing=true;if(!quiet)toast(`@${accountId} 本人通知をINSIGHTへ同期中…`,'normal',true);
    try{
      const found=await collect(accountId),items=[...found.values()];let inserted=0;
      for(let i=0;i<items.length;i+=100){const p=await request(INGEST,{noteId:accountId,source:'note-notification-auto-sync',notifications:items.slice(i,i+100)},{'X-Ingest-Token':token});inserted+=Number(p.inserted||0)}
      const first=[...found.keys()][0];if(first)await GM_setValue(accountKey(LAST_PREFIX,accountId),first);
      const u=new URL(location.href);u.searchParams.delete('mumei_pair');u.searchParams.delete('mumei_notify');u.searchParams.delete('mumei_account');history.replaceState(null,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);
      toast(`@${accountId} 本人通知：${items.length}件確認 / 新規${inserted}件`,'ok');
    }catch(e){
      if(e?.status===401){await deleteToken(accountId);lifecycleToken='';toast(`@${accountId} の通知連携期限が切れました。INSIGHTから再連携してください。`,'error',true)}
      else if(e?.status===409||e?.message==='NOTIFICATION_ACCOUNT_MISMATCH'){toast('通知アカウントが一致しないため同期を停止しました。INSIGHTからこのnote IDを再連携してください。','error',true)}
      else toast('通知同期エラー：'+(e?.message||e),'error',true);
    }finally{syncing=false}
  }

  async function refreshAccountContext(showMissing=false){
    const account=await currentAccount(),id=account?.id||'';
    if(!id){lifecycleAccountId='';lifecycleToken='';if(showMissing)toast('noteにログインしているアカウントを確認できません。','error',true);return null}
    if(id!==lifecycleAccountId){lifecycleAccountId=id;lifecycleToken=await tokenFor(id);revealMuted=false;if(showMissing&&!lifecycleToken)toast(`@${id} はまだINSIGHT本人通知と連携されていません。`,'normal',true)}
    return account;
  }
  async function onNotificationOpened(root){if(!root)return;const account=await refreshAccountContext(false);if(!account)return;await applyMuteFilter(root,account.id);if(lifecycleToken)void ingestOpened(lifecycleToken,account.id,true)}
  function watchMuteFilter(){filterObserver?.disconnect();const check=()=>{clearTimeout(lifecycleTimer);lifecycleTimer=setTimeout(()=>{const root=notificationRoot();if(!root){lifecycleRoot=null;return}if(root!==lifecycleRoot){lifecycleRoot=root;void onNotificationOpened(root)}else void applyMuteFilter(root,lifecycleAccountId)},120)};filterObserver=new MutationObserver(check);filterObserver.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-selected','aria-expanded']});check()}

  async function launch(){
    const u=new URL(location.href),invoked=u.searchParams.get('mumei_notify')==='1'||u.searchParams.has('mumei_pair');
    const account=await currentAccount();lifecycleAccountId=account?.id||'';
    await importMuteSettings(lifecycleAccountId);
    lifecycleToken=await pairIfNeeded(account);
    watchMuteFilter();
    if(invoked){if(!account){toast('noteへログインしてからINSIGHT通知同期を連携してください。','error',true);return}if(!lifecycleToken){toast(`@${account.id} は未連携です。INSIGHTの本人通知設定から連携してください。`,'error',true);return}const opened=await requestNotificationOpen();if(opened){const root=notificationRoot();if(root){lifecycleRoot=root;await ingestOpened(lifecycleToken,account.id)}}return}
    document.addEventListener('click',e=>{if(!strictBell(e.target))return;setTimeout(()=>{const root=notificationRoot();if(root){lifecycleRoot=root;void onNotificationOpened(root)}},650)},true);
  }

  GM_registerMenuCommand('このnoteアカウントのINSIGHT通知同期を再連携',async()=>{const a=await currentAccount();if(!a)return toast('ログイン中note IDを確認できません','error',true);await deleteToken(a.id);await GM_deleteValue(accountKey(LAST_PREFIX,a.id));if(lifecycleAccountId===a.id)lifecycleToken='';toast(`@${a.id} の連携情報を削除しました。INSIGHTから再連携してください。`,'normal',true)});
  GM_registerMenuCommand('このnoteアカウントの通知整理を全解除',async()=>{const a=await currentAccount();if(!a)return toast('ログイン中note IDを確認できません','error',true);await GM_deleteValue(accountKey(MUTE_PREFIX,a.id));toast(`@${a.id} の共同マガジン通知整理設定を解除しました。`,'normal')});
  void launch();
})();
