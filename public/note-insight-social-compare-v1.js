(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiSocialCompareV1Loaded)return;window.__mumeiSocialCompareV1Loaded=true;
const VERSION='1.0.8',API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-social-compare';
const STATE='mumei_social_comparison_v1:',COOLDOWN=15*60*1000,ACTIVE='mumei_social_explicit_scan_v1',MODE='mumei_social_explicit_scan_mode_v1';
const pageWindow=()=>{try{return typeof unsafeWindow!=='undefined'?unsafeWindow:window}catch{return window}};
const gm=()=>globalThis.GM||{},sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(k,d){if(typeof gm().getValue==='function')return gm().getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d);return d}
async function set(k,v){if(typeof gm().setValue==='function')return gm().setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v);throw new Error('SOCIAL_STORAGE_UNAVAILABLE')}
async function json(path){const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);try{const r=await fetch(path,{credentials:'include',cache:'no-store',signal:c.signal});if(!r.ok)throw new Error('NOTE_HTTP_'+r.status);return await r.json()}finally{clearTimeout(timer)}}
async function account(){const p=await json('/api/v2/current_user'),u=(p.data||p).user||(p.data||p),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?id:''}
async function tokenFor(id){for(const[kind,prefix]of [['notification','mumei_insight_notification_sync_token_v2:'],['dm','mumei_insight_dm_sync_token_v1:']]){const token=await get(prefix+id,'');if(token)return{kind,token}}return null}
function save(body,auth){return new Promise((resolve,reject)=>{const fn=typeof gm().xmlHttpRequest==='function'?gm().xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('SOCIAL_REQUEST_UNAVAILABLE'));fn({method:'POST',url:API,headers:{'Content-Type':'application/json','X-Ingest-Token':auth.token,'X-Insight-Reader':auth.kind},data:JSON.stringify(body),timeout:20000,onload:r=>{let p;try{p=JSON.parse(r.responseText)}catch{};r.status>=200&&r.status<300&&p?.ok===true?resolve(p):reject(new Error(p?.error||'SOCIAL_SAVE_FAILED'))},onerror:()=>reject(new Error('SOCIAL_NETWORK_ERROR')),ontimeout:()=>reject(new Error('SOCIAL_SAVE_TIMEOUT'))})})}
const boolean=(...values)=>values.find(v=>typeof v==='boolean')??null;
function person(row,direction,rank){
 const u=row?.user||row?.follower||row?.following||row?.followee||row?.creator||row||{},id=String(u.urlname||u.urlName||'').toLowerCase(),key=String(u.key||u.id||id);
 if(!key||!/^[a-z0-9_-]+$/.test(id))return null;
 return{person_key:key,actor_name:String(u.nickname||u.name||id),actor_url:'https://note.com/'+id,actor_image_url:u.user_profile_image_path||u.user_profile_image_url||u.profileImageUrl||null,
  is_following:direction==='followings'?true:boolean(u.followings?.actively,u.is_following,u.isFollowing),
  is_follower:direction==='followers'?true:boolean(u.followings?.passively,u.is_followed,u.isFollowed),
  following_rank:direction==='followings'?rank:null,follower_rank:direction==='followers'?rank:null};
}
let running=false,stopped=false,panel=null,routeTimer=0;
const ownPath=id=>location.pathname.replace(/\/$/,'')==='/'+id;
function removePanel(){panel?.remove();panel=null;if(routeTimer)clearInterval(routeTimer);routeTimer=0}
function show(message,id,paused=false,finished=false){
 if(!ownPath(id))return removePanel();
 if(!panel){
  panel=document.createElement('section');panel.id='mumei-social-comparison-panel';panel.setAttribute('aria-label','フォロー照合');
  panel.style.cssText='position:fixed;z-index:2147483600;bottom:max(10px,env(safe-area-inset-bottom));left:10px;right:10px;max-width:620px;margin:auto;padding:10px 12px;background:#102633;color:#e6eff3;border:1px solid #65bdcf;border-radius:12px;font:14px/1.5 system-ui;box-shadow:0 3px 16px #0005;box-sizing:border-box';
  const status=document.createElement('div');status.setAttribute('role','status');status.style.cssText='white-space:normal;overflow-wrap:anywhere';panel.append(status);
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;align-items:center;margin-top:6px';
  const action=document.createElement('button');action.type='button';action.style.cssText='color:#e6eff3;background:#244653;border:1px solid #65bdcf;border-radius:8px;padding:6px 12px;min-height:36px';action.onclick=()=>{if(running){stopped=true;sessionStorage.removeItem(ACTIVE);show('停止しました。保存済みの続きから再開できます。',id,true)}else{stopped=false;sessionStorage.setItem(ACTIVE,location.pathname);void run(true)}};actions.append(action);
  const back=document.createElement('a');back.href='https://mumei-s.github.io/note-insight/?insightMode=social#dashboard';back.textContent='分析で確認 ↗';back.style.color='#b8e5ed';actions.append(back);
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','照合を停止してパネルを閉じる');close.style.cssText='margin-left:auto;color:#e6eff3;background:transparent;border:0;font-size:22px;min-width:36px;min-height:36px';close.onclick=()=>{stopped=true;sessionStorage.removeItem(ACTIVE);removePanel()};actions.append(close);panel.append(actions);document.body.append(panel);
  routeTimer=setInterval(()=>{if(!ownPath(id)){stopped=true;sessionStorage.removeItem(ACTIVE);removePanel()}},1000);
 }
 panel.querySelector('[role=status]').textContent=message;
 const action=panel.querySelector('button');action.textContent=finished?'もう一度照合':paused?'続きから再開':'停止';
}
async function run(force=false){
 if(!force&&sessionStorage.getItem(ACTIVE)!==location.pathname)return;
 if(running||document.visibilityState==='hidden'||!/^\/[a-z0-9_-]+\/?$/i.test(location.pathname))return;
 running=true;stopped=false;let id='',auth=null,state=null,lock=null,stateKey='';
 const w=pageWindow();
 const allowed=()=>!stopped&&document.visibilityState!=='hidden'&&ownPath(id);
 try{
  id=await account();if(!id||!ownPath(id))return;
  auth=await tokenFor(id);if(!auth){show('連携情報がありません。分析画面の更新・設定から連携してください。',id,true);sessionStorage.removeItem(ACTIVE);return}
  if(w.__mumeiSocialCompareBusy)return;lock={noteId:id};w.__mumeiSocialCompareBusy=lock;
  const p=await json('/api/v2/creators/'+encodeURIComponent(id)),c=p.data||p;
  if(String(c.urlname||c.urlName||'').toLowerCase()!==id||!c.key||c.isMyself!==true)throw new Error('SOCIAL_ACCOUNT_UNVERIFIED');
  const historyOnly=sessionStorage.getItem(MODE)==='history';stateKey=STATE+id+(historyOnly?':history':'');
  state=await get(stateKey,null);
  if(state?.creatorKey&&state.creatorKey!==String(c.key))throw new Error('NOTE_ACCOUNT_CHANGED');
  // The pending-only queue has a different membership than the old all-person
  // scan. Restart that old cursor once; fresh saved checks are reused by SQL.
  if(historyOnly&&state&&state.pendingOnly!==true)state={...state,historyCursor:'',historyChecked:0,historySkipped:0,complete:false,error:null,pendingOnly:true,version:VERSION};
  if(state?.complete&&!force&&Date.now()-Number(state.finishedAt||0)<COOLDOWN)return;
  if(!state||state.complete||state.error==='SOCIAL_LIST_CHANGED'){
   const followingTotal=Math.max(0,Number(c.followingCount??c.following_count)||0),followerTotal=Math.max(0,Number(c.followerCount??c.follower_count)||0);
   state={creatorKey:String(c.key),followingTotal,followerTotal,followingKeys:[],followerKeys:[],direction:historyOnly?'history':'followings',page:Math.ceil(Math.min(1000,followingTotal)/20),complete:false,startedAt:Date.now(),version:VERSION,pendingOnly:historyOnly,historyCursor:'',historyChecked:0,historySkipped:0};
   await set(stateKey,state);
  }
  const status=()=>({followingTotal:state.followingTotal,followerTotal:state.followerTotal,followingChecked:state.followingKeys.length,followerChecked:state.followerKeys.length,complete:state.complete&&!(state.historySkipped||0)&&state.followingKeys.length>=state.followingTotal&&state.followerKeys.length>=state.followerTotal,error:state.error||null});
  const progress=()=>`照合中 · フォロー ${state.followingKeys.length}/${Math.min(1000,state.followingTotal)}人 · フォロワー ${state.followerKeys.length}/${Math.min(1000,state.followerTotal)}人`;
  show(historyOnly?'保存済みの人物を確認します。最新1,000人の一覧は読み直しません。':progress(),id);
  while(allowed()){
   if(state.direction==='history'){
    const batch=await save({action:'history_candidates',pendingOnly:historyOnly,noteId:id,checkedAt:new Date().toISOString(),after:state.historyCursor||''},auth);
    if(!Array.isArray(batch.rows))throw new Error('SOCIAL_HISTORY_UNVERIFIED');
    for(const candidate of batch.rows){
     if(!allowed())break;
     const target=new URL(candidate.actor_url).pathname.split('/')[1];
     show(`過去の保存人物を確認中 · ${state.historyChecked||0}人確認 · 残り最大${batch.remaining}人`,id);
     let profile;try{profile=await json('/api/v2/creators/'+encodeURIComponent(target))}catch(e){if(!/NOTE_HTTP_(404|410)$/.test(String(e?.message||e)))throw e;profile={data:{}}}const u=profile.data||profile;
     if(await account()!==id)throw new Error('NOTE_ACCOUNT_CHANGED');
     if(!allowed())break;
     const row=person(u,'profile',null);
     if(row&&row.person_key===candidate.person_key&&row.actor_url===candidate.actor_url.replace(/\/$/,'')&&typeof row.is_following==='boolean'&&typeof row.is_follower==='boolean'){
      const ack=await save({noteId:id,checkedAt:new Date().toISOString(),rows:[{...row,evidence:'profile_flags'}]},auth);
      if(!ack.confirmedPersonKeys?.includes(row.person_key))throw new Error('SOCIAL_SAVE_UNCONFIRMED');
      state.historyChecked=(state.historyChecked||0)+1;
     }else state.historySkipped=(state.historySkipped||0)+1;
     state.historyCursor=candidate.person_key;state.error=null;await set(stateKey,state);await sleep(500);
    }
    if(!allowed())break;
    if(batch.nextCursor)continue;
    state={...state,complete:true,finishedAt:Date.now(),error:state.historySkipped?'SOCIAL_PROFILE_UNVERIFIED:'+state.historySkipped:null};
    if(await account()!==id)throw new Error('NOTE_ACCOUNT_CHANGED');
    if(!historyOnly)await save({noteId:id,checkedAt:new Date().toISOString(),rows:[],status:status()},auth);await set(stateKey,state);sessionStorage.removeItem(ACTIVE);
    show(`${historyOnly?'過去の保存人物を確認しました':'保存しました · フォロー'+state.followingKeys.length+'人・フォロワー'+state.followerKeys.length+'人'} · 関係を確認${state.historyChecked||0}人${state.historySkipped?`（未確認 ${state.historySkipped}人）`:''}`,id,false,true);break;
   }
   if(state.page<1){
    if(state.direction==='followings'){state={...state,direction:'followers',page:Math.ceil(Math.min(1000,state.followerTotal)/20)};await set(stateKey,state);continue}
    const covered=state.followingKeys.length>=Math.min(1000,state.followingTotal)&&state.followerKeys.length>=Math.min(1000,state.followerTotal);
    if(!covered)throw new Error('SOCIAL_LIST_CHANGED');
    state={...state,direction:'history',historyCursor:state.historyCursor||'',historyChecked:state.historyChecked||0,historySkipped:state.historySkipped||0};await set(stateKey,state);continue;
   }
   const checkedAt=new Date().toISOString(),direction=state.direction,page=state.page;
   const p=await json('/api/v3/users/'+encodeURIComponent(state.creatorKey)+'/'+direction+'?page='+page+'&per=20'),data=p.data||p,raw=data.follows??data.followers??data.followings??data.users;
   if(!Array.isArray(raw))throw new Error('SOCIAL_LIST_UNVERIFIED');
   if(await account()!==id)throw new Error('NOTE_ACCOUNT_CHANGED');
   if(!allowed())break;
   // Page order and the people within each page both start at the bottom.
   const rows=raw.map((r,i)=>person(r,direction,(page-1)*20+i+1)).filter(Boolean).reverse();
   if(rows.length!==raw.length)throw new Error('SOCIAL_PERSON_UNVERIFIED');
   const field=direction==='followings'?'followingKeys':'followerKeys',nextKeys=[...new Set([...state[field],...rows.map(r=>r.person_key)])];
   const pendingStatus={...status(),[direction==='followings'?'followingChecked':'followerChecked']:nextKeys.length};
   const ack=await save({noteId:id,checkedAt,rows,status:pendingStatus},auth),confirmed=new Set(ack.confirmedPersonKeys||[]);
   if(rows.some(r=>!confirmed.has(r.person_key)))throw new Error('SOCIAL_SAVE_UNCONFIRMED');
   state={...state,[field]:nextKeys,page:page-1,error:null};await set(stateKey,state);
   if(allowed())show(progress(),id);
   await sleep(200);
  }
 }catch(e){
  const error=String(e?.message||e);sessionStorage.removeItem(ACTIVE);
  if(state&&id&&auth){state={...state,error};await set(stateKey,state).catch(()=>{});
   if(error!=='NOTE_ACCOUNT_CHANGED'&&sessionStorage.getItem(MODE)!=='history')await save({noteId:id,checkedAt:new Date().toISOString(),rows:[],status:{followingTotal:state.followingTotal,followerTotal:state.followerTotal,followingChecked:state.followingKeys.length,followerChecked:state.followerKeys.length,complete:false,error}},auth).catch(()=>{});
  }
  const reason=error==='NOTE_ACCOUNT_CHANGED'?'noteのログイン先が変わりました。':/429/.test(error)?'noteの混雑・回数制限で停止しました。時間を置いて再開してください。':error==='SOCIAL_ACCOUNT_UNVERIFIED'?'本人のプロフィールと確認できませんでした。':'照合が止まりました。保存済みの続きから再開できます。';
  if(id&&!stopped)show(reason+' '+error,id,true);
 }finally{if(lock&&w.__mumeiSocialCompareBusy===lock)delete w.__mumeiSocialCompareBusy;running=false;if(panel&&stopped)show('停止しました。保存済みの続きから再開できます。',id,true)}
}
// Bounded automatic owner-only recovery, resumed from the saved cursor.
async function autoPending(){
 if(running||document.visibilityState==='hidden'||sessionStorage.getItem(ACTIVE))return;
 const id='ss_yr',key=STATE+id+':auto',now=Date.now(),previous=await get(key,null);
 if(now-Number(previous?.lastAttempt||0)<6*60*60*1000)return;
 const w=pageWindow();if(w.__mumeiSocialCompareBusy)return;
 let lock=null,cursor=String(previous?.cursor||'');
 try{
  if(await account()!==id)return;
  const auth=await tokenFor(id);if(!auth)return;
  const self=await json('/api/v2/creators/'+id),own=self.data||self;
  if(own.isMyself!==true||String(own.urlname||'').toLowerCase()!==id)return;
  if(w.__mumeiSocialCompareBusy)return;
  lock={kind:'auto-pending',noteId:id};w.__mumeiSocialCompareBusy=lock;
  await set(key,{cursor,lastAttempt:now});
  const batch=await save({action:'history_candidates',pendingOnly:true,noteId:id,checkedAt:new Date().toISOString(),after:cursor},auth);
  if(!Array.isArray(batch.rows))return;
  for(const candidate of batch.rows.slice(0,12)){
   if(document.visibilityState==='hidden'||running||sessionStorage.getItem(ACTIVE))break;
   const link=new URL(String(candidate.actor_url||''));if(link.hostname!=='note.com'||!/^\/[a-z0-9_-]+\/?$/i.test(link.pathname))continue;
   const target=link.pathname.split('/')[1];
   let profile;try{profile=await json('/api/v2/creators/'+encodeURIComponent(target))}
   catch(e){if(!/NOTE_HTTP_(404|410)/.test(String(e?.message||'')))throw e;profile={data:{}}}
   // Profile flags belong to the note login that fetched them. Never persist
   // another account's relationship state with the captured owner credential.
   if(await account()!==id)throw new Error('NOTE_ACCOUNT_CHANGED');
   const currentAuth=await tokenFor(id);
   if(!currentAuth||currentAuth.kind!==auth.kind||currentAuth.token!==auth.token)throw new Error('SOCIAL_TOKEN_CHANGED');
   if(document.visibilityState==='hidden'||running||sessionStorage.getItem(ACTIVE))break;
   const row=person(profile.data||profile,'profile',null);
   if(row&&row.person_key===candidate.person_key&&row.actor_url===String(candidate.actor_url).replace(/\/$/,'')&&typeof row.is_following==='boolean'&&typeof row.is_follower==='boolean'){
    const ack=await save({noteId:id,checkedAt:new Date().toISOString(),rows:[{...row,evidence:'profile_flags'}]},auth);
    if(!ack.confirmedPersonKeys?.includes(row.person_key))throw new Error('SOCIAL_SAVE_UNCONFIRMED');
   }
   cursor=String(candidate.person_key||'');await set(key,{cursor,lastAttempt:now});await sleep(200);
  }
  if(!batch.rows.length||(!batch.nextCursor&&batch.rows.length<=12))await set(key,{cursor:'',lastAttempt:now});
 }catch{}finally{if(lock&&w.__mumeiSocialCompareBusy===lock)delete w.__mumeiSocialCompareBusy}
}
function start(){const u=new URL(location.href),requested=u.searchParams.get('mumei_social_scan'),force=requested==='1'||requested==='history';if(force){sessionStorage.setItem(ACTIVE,location.pathname);sessionStorage.setItem(MODE,requested==='history'?'history':'full');u.searchParams.delete('mumei_social_scan');history.replaceState(history.state,'',u.href)}if(sessionStorage.getItem(ACTIVE)!==location.pathname)return;void run(force)}
window.addEventListener('pageshow',start);window.addEventListener('focus',start);document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')start()});
setTimeout(start,2500);
setTimeout(()=>{if(!sessionStorage.getItem(ACTIVE))void autoPending()},4500);
window.__mumeiSocialComparisonV1={version:VERSION,run,person};
})();
