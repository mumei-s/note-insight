(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiSocialCompareV1Loaded)return;window.__mumeiSocialCompareV1Loaded=true;
const VERSION='1.0.2',API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-social-compare';
const STATE='mumei_social_comparison_v1:',COOLDOWN=15*60*1000,ACTIVE='mumei_social_explicit_scan_v1';
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
let running=false;
async function run(force=false){
 if(!force&&sessionStorage.getItem(ACTIVE)!==location.pathname)return;
 if(running||document.visibilityState==='hidden')return;
 running=true;let id='',auth=null,state=null,lock=null;
 const w=pageWindow();
 try{
  id=await account();if(!id)return;auth=await tokenFor(id);if(!auth)return;
  if(w.__mumeiSocialCompareBusy)return;lock={noteId:id};w.__mumeiSocialCompareBusy=lock;
  state=await get(STATE+id,null);
  if(state?.complete&&!force&&Date.now()-Number(state.finishedAt||0)<COOLDOWN)return;
  if(!state||state.complete||Date.now()-Number(state.startedAt||0)>COOLDOWN){
   const p=await json('/api/v2/creators/'+encodeURIComponent(id)),c=p.data||p;
   if(String(c.urlname||c.urlName||'').toLowerCase()!==id||!c.key||c.isMyself!==true)throw new Error('SOCIAL_ACCOUNT_UNVERIFIED');
   const followingTotal=Math.max(0,Number(c.followingCount??c.following_count)||0),followerTotal=Math.max(0,Number(c.followerCount??c.follower_count)||0);
   state={creatorKey:String(c.key),followingTotal,followerTotal,followingKeys:[],followerKeys:[],direction:'followings',page:Math.ceil(Math.min(1000,followingTotal)/20),complete:false,startedAt:Date.now(),version:VERSION};
   await set(STATE+id,state);
  }
  const status=()=>({followingTotal:state.followingTotal,followerTotal:state.followerTotal,followingChecked:state.followingKeys.length,followerChecked:state.followerKeys.length,complete:state.complete,error:state.error||null});
  while(document.visibilityState!=='hidden'){
   if(state.page<1){
    if(state.direction==='followings'){state={...state,direction:'followers',page:Math.ceil(Math.min(1000,state.followerTotal)/20)};await set(STATE+id,state);continue}
    const covered=state.followingKeys.length>=Math.min(1000,state.followingTotal)&&state.followerKeys.length>=Math.min(1000,state.followerTotal);
    state={...state,complete:covered,finishedAt:Date.now(),error:covered?null:'SOCIAL_LIST_CHANGED',...(!covered?{startedAt:0}:{})};if(covered)sessionStorage.removeItem(ACTIVE);
    if(await account()!==id)throw new Error('NOTE_ACCOUNT_CHANGED');
    await save({noteId:id,checkedAt:new Date().toISOString(),rows:[],status:status()},auth);await set(STATE+id,state);break;
   }
   const checkedAt=new Date().toISOString(),direction=state.direction,page=state.page;
   const p=await json('/api/v3/users/'+encodeURIComponent(state.creatorKey)+'/'+direction+'?page='+page+'&per=20'),data=p.data||p,raw=data.follows??data.followers??data.followings??data.users;
   if(!Array.isArray(raw))throw new Error('SOCIAL_LIST_UNVERIFIED');
   if(await account()!==id)throw new Error('NOTE_ACCOUNT_CHANGED');
   // Page order and the people within each page both start at the bottom.
   const rows=raw.map((r,i)=>person(r,direction,(page-1)*20+i+1)).filter(Boolean).reverse();
   if(rows.length!==raw.length)throw new Error('SOCIAL_PERSON_UNVERIFIED');
   const field=direction==='followings'?'followingKeys':'followerKeys',nextKeys=[...new Set([...state[field],...rows.map(r=>r.person_key)])];
   const progress={...status(),[direction==='followings'?'followingChecked':'followerChecked']:nextKeys.length};
   const ack=await save({noteId:id,checkedAt,rows,status:progress},auth),confirmed=new Set(ack.confirmedPersonKeys||[]);
   if(rows.some(r=>!confirmed.has(r.person_key)))throw new Error('SOCIAL_SAVE_UNCONFIRMED');
   state={...state,[field]:nextKeys,page:page-1,error:null};await set(STATE+id,state);
   await sleep(200);
  }
 }catch(e){
  if(state&&id&&auth){state={...state,error:String(e?.message||e)};await set(STATE+id,state).catch(()=>{});
   if(state.error!=='NOTE_ACCOUNT_CHANGED')await save({noteId:id,checkedAt:new Date().toISOString(),rows:[],status:{followingTotal:state.followingTotal,followerTotal:state.followerTotal,followingChecked:state.followingKeys.length,followerChecked:state.followerKeys.length,complete:false,error:state.error}},auth).catch(()=>{});
  }
 }finally{if(lock&&w.__mumeiSocialCompareBusy===lock)delete w.__mumeiSocialCompareBusy;running=false}
}
function start(){const u=new URL(location.href),force=u.searchParams.get('mumei_social_scan')==='1';if(force){sessionStorage.setItem(ACTIVE,location.pathname);u.searchParams.delete('mumei_social_scan');history.replaceState(history.state,'',u.href)}if(sessionStorage.getItem(ACTIVE)!==location.pathname)return;void run(force)}
window.addEventListener('pageshow',start);window.addEventListener('focus',start);document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')start()});
setTimeout(start,2500);setInterval(start,60000);
window.__mumeiSocialComparisonV1={version:VERSION,run,person};
})();
