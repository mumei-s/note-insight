(function(){
'use strict';
if(location.hostname!=='mumei-s.github.io'||!['/note-insight/notification-filter-settings.html','/note-insight/notification-browser-install.html'].includes(location.pathname))return;
if(window.__mumeiNotificationSettingsBridgeV1Loaded)return;window.__mumeiNotificationSettingsBridgeV1Loaded=true;
const FIL='mumei_insight_magazine_filter_enabled_v3:',GRP='mumei_insight_notification_groups_v1:',MUT='mumei_insight_magazine_mute_ids_v5:',PROFILE='mumei_insight_magazine_mute_profiles_v5:',RETURN='mumei_insight_return_bell_v1',PANEL='mumei_insight_notification_panel_enabled_v1';
const PAGE=location.pathname.endsWith('/notification-browser-install.html')?'mumei-notification-install-page-v1':'mumei-filter-page-v1',BRIDGE='mumei-filter-bridge-v1';
const params=new URLSearchParams(location.search),account=(params.get('notificationAccount')||params.get('account')||'').replace(/^@/,'').toLowerCase();
const modern=()=>(typeof GM!=='undefined'&&Boolean(GM)),clean=v=>String(v||'').replace(/\s+/g,' ').trim();
async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v);throw new Error('設定を保存できません。本人通知ツールを確認してください')}
const norm=raw=>(Array.isArray(raw)?raw:[]).map((g,i)=>({name:clean(g?.name)||('グループ '+(i+1)),enabled:g?.enabled!==false,ids:[...new Set((Array.isArray(g?.ids)?g.ids:[]).map(x=>clean(x).replace(/^@/,'').toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))]}));
const send=(type,payload={})=>window.postMessage({source:BRIDGE,type,account,...payload},location.origin);
function xhr(url,anonymous=false){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('xhr unavailable'));fn({method:'GET',url,anonymous,headers:{Accept:'application/json,text/html;q=0.9,*/*;q=0.8'},timeout:20000,onload:r=>resolve(r),onerror:()=>reject(new Error('request failed')),ontimeout:()=>reject(new Error('request timeout'))})})}
const reserved=new Set(['n','m','notifications','settings','sitesettings','messages','search','login','signup','home','explore','membership','magazine','api','intent']);
function creatorId(value){const id=clean(value).replace(/^@/,'').toLowerCase();return /^[a-z0-9_-]+$/.test(id)&&!reserved.has(id)?id:''}
function creatorInput(value){
 const raw=clean(value);if(!raw||raw.length>2048)throw new Error('記事URL・クリエイターURL・@IDを入力してください');
 if(!/[\/:?#.]/.test(raw)){const id=creatorId(raw);if(id)return{id};throw new Error('クリエイターIDを確認できません')}
 let u;try{u=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw)}catch{throw new Error('noteの記事URL・クリエイターURLを入力してください')}
 if(u.protocol!=='https:'||u.hostname!=='note.com'||u.username||u.password||u.port)throw new Error('https://note.com/ のURLを入力してください');
 const parts=u.pathname.split('/').filter(Boolean).map(part=>{try{return decodeURIComponent(part)}catch{return''}});
 if(parts.length===1&&creatorId(parts[0]))return{id:creatorId(parts[0])};
 if(parts.length===3&&parts[1]==='n'&&creatorId(parts[0])&&/^n[a-f0-9]{12}$/i.test(parts[2]))return{id:creatorId(parts[0])};
 if(parts.length===2&&parts[0]==='n'&&/^n[a-f0-9]{12}$/i.test(parts[1]))return{key:parts[1].toLowerCase()};
 throw new Error('noteの記事URL・クリエイターURL・@IDを入力してください')
}
const articleAuthors=new Map();
async function resolveCreator(value){
 const input=creatorInput(value);if(input.id)return input.id;
 if(!articleAuthors.has(input.key)){
  const pending=(async()=>{
   const response=await xhr('https://note.com/api/v3/notes/'+encodeURIComponent(input.key),true);
   const status=Number(response.status);if(!Number.isInteger(status)||status<200||status>=300)throw new Error('記事の投稿者を確認できません。URLを確認して再試行してください');
   if(response.finalUrl&&new URL(response.finalUrl).origin!=='https://note.com')throw new Error('記事の取得先を確認できません');
   let payload;try{payload=JSON.parse(response.responseText||'{}')}catch{throw new Error('記事の投稿者を確認できません')}
   const note=payload?.data??payload,user=note?.user||note?.author,id=creatorId(user?.urlname);
   if(!id)throw new Error('記事の投稿者を確認できません。クリエイターURLか@IDでも追加できます');
   return id
  })();articleAuthors.set(input.key,pending);pending.catch(()=>{if(articleAuthors.get(input.key)===pending)articleAuthors.delete(input.key)})
 }
 return articleAuthors.get(input.key)
}
const cache=new Map();let profileWrites=Promise.resolve(),groupWrites=Promise.resolve();
function saveGroups(groups){const work=groupWrites.catch(()=>{}).then(async()=>{await set(GRP+account,groups);await set(MUT+account,[...new Set(groups.filter(g=>g.enabled).flatMap(g=>g.ids))])});groupWrites=work;return work}
async function saveProfiles(items){profileWrites=profileWrites.catch(()=>{}).then(async()=>{const old=await get(PROFILE+account,[]),map=new Map((Array.isArray(old)?old:[]).map(p=>[p.id,p]));for(const p of items)if(p.nickname&&p.nickname!==p.id)map.set(p.id,{id:p.id,name:p.nickname,image:p.profileImageUrl||''});await set(PROFILE+account,[...map.values()])});await profileWrites}
async function profile(id){
 if(cache.has(id))return cache.get(id);
 const p=(async()=>{
  try{const r=await xhr('https://note.com/api/v2/creators/'+encodeURIComponent(id));if(Number(r.status)>=200&&Number(r.status)<300){const j=JSON.parse(r.responseText||'{}'),d=j?.data??j??{},nickname=clean(d.nickname||d.name||id),profileImageUrl=clean(d.profileImageUrl||d.profile_image_url||d.avatarUrl||'');if(nickname!==id||profileImageUrl)return{id,nickname,profileImageUrl}}}catch{}
  try{const r=await xhr('https://note.com/'+encodeURIComponent(id)),doc=new DOMParser().parseFromString(r.responseText||'','text/html'),title=clean(doc.querySelector('meta[property="og:title"]')?.content||doc.title||id).replace(/\s*｜\s*note.*$/u,''),image=clean(doc.querySelector('meta[property="og:image"]')?.content||'');return{id,nickname:title||id,profileImageUrl:image}}catch{return{id,nickname:id,profileImageUrl:''}}
 })();cache.set(id,p);return p
}
async function load(){
 if(!/^[a-z0-9_-]+$/.test(account)){send('error',{message:'noteアカウントを確認できません'});return}
 let groups=norm(await get(GRP+account,[]));if(!groups.length){const legacy=await get(MUT+account,[]);if(Array.isArray(legacy)&&legacy.length)groups=[{name:'通知フィルター',enabled:true,ids:[...new Set(legacy.map(String).map(x=>x.toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))]}]}
 const storedProfiles=await get(PROFILE+account,[]),profiles=(Array.isArray(storedProfiles)?storedProfiles:[]).filter(p=>creatorId(p?.id)).map(p=>({id:creatorId(p.id),nickname:clean(p.name||p.nickname||p.id),profileImageUrl:clean(p.image||p.profileImageUrl||'')}));
 send('state',{groups,profiles,canResolveArticles:true,filterOn:Boolean(await get(FIL+account,false)),panelOn:Boolean(await get(PANEL,true))})
}
addEventListener('message',e=>{if(!/^[a-z0-9_-]+$/.test(account)||e.origin!==location.origin||e.data?.source!==PAGE||e.data?.account!==account)return;const d=e.data;(async()=>{
 try{
  if(d.type==='load')await load();
  else if(d.type==='save'){const groups=norm(d.groups);await saveGroups(groups);send('saved',{requestId:typeof d.requestId==='string'?d.requestId:undefined})}
  else if(d.type==='panel-set'){const panelOn=Boolean(d.enabled);await set(PANEL,panelOn);send('panel-saved',{panelOn})}
  else if(d.type==='return-bell'){await groupWrites;await set(RETURN,{account,at:Date.now()});send('return-ready')}
  else if(d.type==='resolve-creator'){
   if(typeof d.requestId!=='string'||!/^[a-z0-9:_-]{1,100}$/i.test(d.requestId))return;
   try{send('creator-resolved',{requestId:d.requestId,id:await resolveCreator(d.value)})}catch(err){send('creator-error',{requestId:d.requestId,message:clean(err?.message||'記事の投稿者を確認できません')})}
  }
  else if(d.type==='profiles'){const ids=[...new Set((Array.isArray(d.ids)?d.ids:[]).map(x=>clean(x).replace(/^@/,'').toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))];for(let i=0;i<ids.length;i+=6){const part=ids.slice(i,i+6);const profiles=await Promise.all(part.map(profile));await saveProfiles(profiles);send('profiles',{profiles});if(i+6<ids.length)await new Promise(r=>setTimeout(r,50))}}
 }catch(err){send('error',{message:clean(err?.message||'設定処理に失敗しました'),action:d.type,requestId:typeof d.requestId==='string'?d.requestId:undefined})}
})()});
void load();
window.__mumeiNotificationSettingsBridgeV1={version:'1.1.5',load};
})();
