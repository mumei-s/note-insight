// ==UserScript==
// @name note こあく まこ調査
// @namespace https://github.com/mumei-s/note-insight
// @version 3.0.0
// @description 公開コメント・返信・スキ・フォロー関係とフォロワー構成を確認。本人同定は公開明示だけを根拠にします。
// @match https://note.com/*
// @updateURL https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-account-audit.user.js
// @downloadURL https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-account-audit.user.js
// @grant none
// @run-at document-start
// ==/UserScript==
(function(){
'use strict';window.__noteAccountAuditV1=1;window.__noteAccountAuditCanonical='3.0.0';
var P=['本垢','本アカ','メイン垢','メインアカ','サブ垢','サブアカ','別垢','別アカ','前垢','旧垢','前のアカウント','以前のアカウント','アカウント作り直','転生','複垢'];
var SNAP='note-account-audit:snapshots',OLD_NET='note-account-audit:all-followers:v18:koakumako',DBN='note-account-audit-v19-koakumako',last=null;
var PRESET_TARGET='koakumako',AUTO_KEY='note-account-audit:auto:koakumako:canonical:v221';
var AUDIT_EDGE='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/account-audit-relations';
var AUDIT_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aGFlcmp2cmdtbmFkeGpxZXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNTMxMTQsImV4cCI6MjEwMTYyOTExNH0.DtoUvuMTrW7rA3jLThLD4zijvluuTB_LmEBIjWJs-jA';
var PRESET_ARTS=[
'https://note.com/koakumako/n/nc6590ab92f8a',
'https://note.com/koakumako/n/n5c7a990fc503',
'https://note.com/koakumako/n/n816255fe6903',
'https://note.com/koakumako/n/nfe911697cce5',
'https://note.com/koakumako/n/n402a9fbee197',
'https://note.com/koakumako/n/n5f9989d19638',
'https://note.com/koakumako/n/ndf90bd9913bc',
'https://note.com/koakumako/n/n3451b0df1589',
'https://note.com/koakumako/n/n8c03103e9874',
'https://note.com/koakumako/n/n805a641b3bfe',
'https://note.com/koakumako/n/nacbf565c6dce',
'https://note.com/koakumako/n/n3f01f0511c8a'
];
function c(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}function n(v,d){v=Number(v);return Number.isFinite(v)?v:(d||0)}function a(v){return Array.isArray(v)?v:[]}function o(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}function esc(s){return c(s).replace(/[&<>"']/g,function(x){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]})}function wait(ms){return new Promise(function(r){setTimeout(r,ms)})}function pct(x,y){return y?Math.round(x*1000/y)/10:0}
async function api(url){var r=await fetch(url,{credentials:'include',cache:'no-store',headers:{accept:'application/json'}}),t=await r.text(),j={};try{j=t?JSON.parse(t):{}}catch(e){}if(!r.ok)throw new Error(r.status+' '+r.statusText);return j}
function uid(x){x=o(x&&x.user||x&&x.creator||x);return c(x.urlname||x.url_name||x.username).replace(/^@/,'').toLowerCase()}function uname(x){x=o(x&&x.user||x&&x.creator||x);return c(x.nickname||x.name||x.urlname||'noteユーザー')}function img(x){x=o(x&&x.user||x&&x.creator||x);return c(x.user_profile_image_url||x.profile_image_url||x.profileImageUrl)}
function target(v){v=c(v).replace(/^@/,'');try{var u=new URL(/^https?:/.test(v)?v:'https://note.com/'+v);return c(u.pathname.split('/').filter(Boolean)[0]).replace(/^@/,'').toLowerCase()}catch(e){return v.toLowerCase()}}
function artUrl(v){try{var u=new URL(c(v)),p=u.pathname.split('/').filter(Boolean),i=p.indexOf('n');if(i<1||!p[i+1])return null;return{creator:p[i-1].toLowerCase(),key:p[i+1],url:'https://note.com/'+p[i-1]+'/n/'+p[i+1]}}catch(e){return null}}
function platform(u){var h=(u.hostname||'').toLowerCase();if(/(^|\.)x\.com$|(^|\.)twitter\.com$/.test(h))return'X';if(/instagram\.com$/.test(h))return'Instagram';if(/threads\.net$/.test(h))return'Threads';if(/tiktok\.com$/.test(h))return'TikTok';if(/youtube\.com$|youtu\.be$/.test(h))return'YouTube';if(/facebook\.com$/.test(h))return'Facebook';if(/bsky\.app$/.test(h))return'Bluesky';if(/pinterest\./.test(h))return'Pinterest';if(/lit\.link$/.test(h))return'lit.link';if(/linktr\.ee$/.test(h))return'Linktree';if(/github\.com$/.test(h))return'GitHub';return'Web'}
function externalUrl(v){try{var u=new URL(c(v),location.href),h=u.hostname.toLowerCase();if(!/^https?:$/.test(u.protocol))return null;if(/(^|\.)note\.com$/i.test(h)||/(^|\.)st-note\.com$/i.test(h))return null;return{url:u.href,host:u.hostname.replace(/^www\./,''),platform:platform(u)}}catch(e){return null}}
function urlsInText(t){var m=String(t||'').match(/https?:\/\/[^\s<>"')\]]+/g)||[],out=[];m.forEach(function(v){var x=externalUrl(v);if(x)out.push(x)});return out}
function rawExternal(x){var out=[];function walk(v,depth){if(depth>4||v==null)return;if(typeof v==='string'){var q=externalUrl(v);if(q)out.push(q);else urlsInText(v).forEach(function(z){out.push(z)});return}if(Array.isArray(v)){v.slice(0,80).forEach(function(z){walk(z,depth+1)});return}if(typeof v==='object'){Object.keys(v).slice(0,120).forEach(function(k){if(/url|link|website|social|profile|description|bio/i.test(k))walk(v[k],depth+1)})}}walk(x,0);return out}
async function articleExternal(art){try{var r=await fetch(art.url,{credentials:'include',cache:'no-store'});if(!r.ok)return[];var h=await r.text(),d=new DOMParser().parseFromString(h,'text/html'),out=[];d.querySelectorAll('a[href]').forEach(function(a){var x=externalUrl(a.getAttribute('href'));if(x)out.push(Object.assign({source:'記事:'+art.key},x))});return out}catch(e){return[]}}
function dedupExternal(list){var m=new Map;list.forEach(function(x){if(!x||!x.url)return;try{var u=new URL(x.url),k=u.hostname.toLowerCase()+u.pathname.replace(/\/$/,'');if(!m.has(k))m.set(k,x)}catch(e){}});return Array.from(m.values())}
function searchLinks(id,name){var q1=encodeURIComponent('"'+id+'"'),q2=encodeURIComponent('"'+name+'"');return[
{label:'Google ID',url:'https://www.google.com/search?q='+q1},
{label:'Google 名前',url:'https://www.google.com/search?q='+q2},
{label:'X',url:'https://x.com/search?q='+q1},
{label:'Instagram検索',url:'https://www.google.com/search?q=site%3Ainstagram.com+'+q1},
{label:'Threads検索',url:'https://www.google.com/search?q=site%3Athreads.net+'+q1},
{label:'TikTok検索',url:'https://www.google.com/search?q=site%3Atiktok.com+'+q1},
{label:'YouTube検索',url:'https://www.google.com/search?q=site%3Ayoutube.com+'+q1},
{label:'Facebook検索',url:'https://www.google.com/search?q=site%3Afacebook.com+'+q1},
{label:'Bluesky検索',url:'https://www.google.com/search?q=site%3Absky.app+'+q1}
]}
async function profile(id){var j=await api('/api/v2/creators/'+encodeURIComponent(id)),d=o(j.data||j),x=o(d.creator||d.user||d);return{id:c(x.urlname||x.url_name||id).toLowerCase(),key:c(x.key||x.user_key),name:c(x.nickname||x.name||id),followers:n(x.followerCount||x.follower_count),followings:n(x.followingCount||x.following_count),notes:n(x.noteCount||x.note_count||x.contents_count,-1),bio:c(x.profile||x.description||x.bio),image:c(x.user_profile_image_url||x.profile_image_url),raw:x}}
async function articles(id,extra){var m=new Map;extra.forEach(function(x){if(x&&x.creator===id)m.set(x.key,{key:x.key,url:x.url,title:x.key})});for(var pg=1;pg<=3&&m.size<30;pg++){var j=await api('/api/v2/creators/'+encodeURIComponent(id)+'/contents?kind=note&page='+pg),d=o(j.data||j),ls=a(d.contents||d.notes||(Array.isArray(j.data)?j.data:[]));if(!ls.length)break;ls.forEach(function(x){var q=o(x.note||x),k=c(q.key||q.note_key||q.slug);if(k&&!m.has(k))m.set(k,{key:k,url:'https://note.com/'+id+'/n/'+k,title:c(q.name||q.title||k)})});if(ls.length<6)break;await wait(30)}return Array.from(m.values()).slice(0,30)}
function ct(v){if(typeof v==='string')return v;if(Array.isArray(v))return v.map(ct).join(' ');v=o(v);if(typeof v.value==='string')return v.value;return a(v.children).concat(a(v.content)).map(ct).join(' ')}
function cr(r,parent){r=o(r);var u=o(r.user||r.author),k=c(r.key||r.comment_key||r.id);if(!k)return null;return{key:k,parent:c(r.parent_key||r.parentKey)||parent||'',id:c(u.urlname||u.url_name).toLowerCase(),name:c(u.nickname||u.name||u.urlname),image:img(u),body:c(ct(r.comment||r.body||r.text)).slice(0,1200)}}
async function comments(key){var out=new Map;async function pages(parent){for(var pg=1;pg<=8;pg++){var j=await api('/api/v3/notes/'+encodeURIComponent(key)+'/note_comments?order=oldest&per_page=100&page='+pg+(parent?'&parent_key='+encodeURIComponent(parent):'')),d=o(j.data),ls=Array.isArray(j.data)?j.data:a(d.comments||d.note_comments||d.contents);for(var z=0;z<ls.length;z++){var q=cr(ls[z],parent);if(q)out.set(q.key,q)}if(ls.length<100)break;await wait(25)}}var j=await api('/api/v3/notes/'+encodeURIComponent(key)+'/note_comments?order=oldest&per_page=100&page=1'),d=o(j.data),roots=Array.isArray(j.data)?j.data:a(d.comments||d.note_comments||d.contents);for(var i=0;i<roots.length;i++){var b=cr(roots[i],'');if(b)out.set(b.key,b);var rc=n(roots[i].reply_count||roots[i].replyCount);if(rc>0&&b)try{await pages(b.key)}catch(e){}}return Array.from(out.values())}
async function likers(key){var m=new Map;for(var pg=1;pg<=50;pg++){var j=await api('/api/v3/notes/'+encodeURIComponent(key)+'/likes?page='+pg+'&per_page=100'),d=j.data||j,ls=Array.isArray(d)?d:a(d.likes||d.users||d.contents||d.likers);ls.forEach(function(x){var id=uid(x);if(id&&!m.has(id))m.set(id,{id:id,name:uname(x),image:img(x)})});if(!ls.length||ls.length<100)break;await wait(45)}return Array.from(m.values())}
function rp(x,rank){var u=o(x.user||x.follower||x.following||x.creator||x),id=c(u.urlname||x.urlname).toLowerCase();return id?{id:id,name:c(u.nickname||u.name||id),image:img(u),rank:rank}:null}
async function rel(p,dir){if(!p.key)return[];var m=new Map;for(var pg=1;pg<=50&&m.size<1000;pg++){var j=await api('/api/v3/users/'+encodeURIComponent(p.key)+'/'+dir+'?page='+pg+'&per=20'),d=o(j.data||j),ls=a(d.follows||d.followers||d.followings||d.users||d.contents);ls.forEach(function(x,i){var q=rp(x,(pg-1)*20+i+1);if(q&&!m.has(q.id))m.set(q.id,q)});if(!ls.length||ls.length<20)break;await wait(20)}return Array.from(m.values()).slice(0,1000)}
async function relLimited(p,dir,maxPages){if(!p.key)return[];var m=new Map;for(var pg=1;pg<=maxPages;pg++){var j=await api('/api/v3/users/'+encodeURIComponent(p.key)+'/'+dir+'?page='+pg+'&per=20'),d=o(j.data||j),ls=a(d.follows||d.followers||d.followings||d.users||d.contents);ls.forEach(function(x,i){var q=rp(x,(pg-1)*20+i+1);if(q&&!m.has(q.id))m.set(q.id,q)});if(!ls.length||ls.length<20)break;await wait(120)}return Array.from(m.values())}

async function auditServer(body){
 var r=await fetch(AUDIT_EDGE,{method:'POST',mode:'cors',cache:'no-store',headers:{'content-type':'application/json','apikey':AUDIT_ANON,'authorization':'Bearer '+AUDIT_ANON},body:JSON.stringify(body)});
 var t=await r.text(),j={};try{j=t?JSON.parse(t):{}}catch(e){}
 if(!r.ok||!j.ok)throw new Error(j.error||('AUDIT_SERVER_'+r.status));
 return j;
}
function idbOpen(){return new Promise(function(resolve,reject){var q=indexedDB.open(DBN,1);q.onupgradeneeded=function(){var d=q.result;if(!d.objectStoreNames.contains('people'))d.createObjectStore('people',{keyPath:'id'});if(!d.objectStoreNames.contains('hubs'))d.createObjectStore('hubs',{keyPath:'id'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'})};q.onsuccess=function(){resolve(q.result)};q.onerror=function(){reject(q.error)}})}
function idbGet(db,store,key){return new Promise(function(resolve,reject){var q=db.transaction(store,'readonly').objectStore(store).get(key);q.onsuccess=function(){resolve(q.result||null)};q.onerror=function(){reject(q.error)}})}
function idbAll(db,store){return new Promise(function(resolve,reject){var q=db.transaction(store,'readonly').objectStore(store).getAll();q.onsuccess=function(){resolve(q.result||[])};q.onerror=function(){reject(q.error)}})}
function idbPut(db,store,val){return new Promise(function(resolve,reject){var t=db.transaction(store,'readwrite'),q=t.objectStore(store).put(val);t.oncomplete=function(){resolve(val)};t.onerror=function(){reject(t.error||q.error)}})}
async function migrateOldNet(db){
 var m=await idbGet(db,'meta','migration-v18');if(m)return;
 try{
  var old=JSON.parse(localStorage.getItem(OLD_NET)||'null');
  if(old&&old.people){
   var ids=Object.keys(old.people);
   for(var i=0;i<ids.length;i++){var id=ids[i],p=old.people[id]||{};await idbPut(db,'people',Object.assign({id:id},p));}
   var hs=old.hubs||{},hids=Object.keys(hs);
   for(var j=0;j<hids.length;j++){var hid=hids[j],h=hs[hid]||{};await idbPut(db,'hubs',Object.assign({id:hid},h));}
  }
 }catch(e){}
 await idbPut(db,'meta',{key:'migration-v18',at:Date.now()});
}
async function v2FollowPage(id,page,per){
 per=per||100;
 var j=await api('/api/v2/creators/'+encodeURIComponent(id)+'/followings?page='+page+'&per='+per),d=o(j.data||j),ls=a(d.follows||d.followers||d.followings||d.users||d.contents||(Array.isArray(j.data)?j.data:[]));
 return ls.map(function(x,i){return rp(x,(page-1)*per+i+1)}).filter(Boolean);
}
async function followerNetwork(followers,targetFollowings,set){
 try{
  var db=await idbOpen();await migrateOldNet(db);
  var all=followers.slice(),tf=new Set(targetFollowings.map(function(x){return x.id})),
      existing=await idbAll(db,'people'),pm=new Map(existing.map(function(x){return[x.id,x]})),
      hubRows=await idbAll(db,'hubs'),hm=new Map(hubRows.map(function(x){if(!x.examples)x.examples=(x.followers||[]).slice(0,5);return[x.id,x]})),
      pending=all.filter(function(f){var p=pm.get(f.id);return !(p&&p.done&&!p.error)}),
      doneStart=all.length-pending.length,processed=0,serverErrors=0,next=0,lastUi=0;
  function ui(msg){var now=Date.now();if(now-lastUi<200)return;lastUi=now;set('☁ 専用高速サーバー '+(doneStart+processed)+'/'+all.length+(msg?'｜'+msg:''))}
  function saveResult(id,res){
   return new Promise(function(resolve,reject){
    var ps=pm.get(id)||{id:id,nextPage:1,done:false,profile:null,read:0,per:20,error:''};
    var t=db.transaction(['people','hubs'],'readwrite'),po=t.objectStore('people'),ho=t.objectStore('hubs');
    if(res.ok){
      ps.profile=res.profile||ps.profile;ps.read=Number(res.total||ps.read||0);ps.done=true;ps.error='';ps.nextPage=999999;
      var hs=Array.isArray(res.hubs)?res.hubs:[];
      for(var i=0;i<hs.length;i++){
        var qx=hs[i];if(!qx||!qx.id||qx.id===PRESET_TARGET)continue;
        var h=hm.get(qx.id)||{id:qx.id,name:qx.name||qx.id,image:qx.image||'',count:0,examples:[],targetFollows:false};
        h.count=Number(h.count||0)+1;if(!h.examples)h.examples=[];
        if(h.examples.length<5&&h.examples.indexOf(id)<0)h.examples.push(id);
        h.targetFollows=tf.has(qx.id);hm.set(qx.id,h);ho.put(h);
      }
    }else{
      ps.error=String(res.error||'SERVER_ITEM_ERROR');
      if(/404|CREATOR_KEY_NOT_FOUND/.test(ps.error))ps.done=true;
    }
    po.put(ps);pm.set(id,ps);
    t.oncomplete=function(){resolve()};t.onerror=function(){reject(t.error)}
   })
  }
  async function batchWorker(){
   while(true){
    var start=next;next+=8;if(start>=pending.length)return;
    var chunk=pending.slice(start,start+8),entries=chunk.map(function(f){var p=pm.get(f.id);return{id:f.id,skip:Number(p&&p.read||0)}});
    ui('8人処理中');
    try{
      var j=await auditServer({action:'scan_batch',entries:entries}),rs=Array.isArray(j.results)?j.results:[];
      var byId=new Map(rs.map(function(x){return[String(x.id||''),x]}));
      for(var i=0;i<chunk.length;i++){
        var id=chunk[i].id,res=byId.get(id)||{ok:false,id:id,error:'NO_SERVER_RESULT'};
        await saveResult(id,res);
        if(res.ok||/404|CREATOR_KEY_NOT_FOUND/.test(String(res.error||'')))processed++;else serverErrors++;
      }
    }catch(e){serverErrors+=chunk.length;throw e}
   }
  }
  set('☁ INSIGHT分離ロジック使用｜専用サーバーへ切替｜残り '+pending.length+'人');
  await Promise.all([batchWorker(),batchWorker(),batchWorker()]);
  var people=Array.from(pm.values()),ids=new Set(all.map(function(x){return x.id})),rows=people.filter(function(x){return ids.has(x.id)}),
      prof=rows.filter(function(x){return x.profile}).map(function(x){return x.profile}),doneRows=rows.filter(function(x){return x.done}),
      known=prof.filter(function(x){return x.notes>=0}),low=known.filter(function(x){return x.notes<=1}).length,
      empty=prof.filter(function(x){return x.bioThin}).length,mass=prof.filter(function(x){return x.mass}).length,
      hubs=Array.from(hm.values()).filter(function(x){return Number(x.count||0)>=2}).sort(function(a,b){return Number(b.count||0)-Number(a.count||0)}).slice(0,200);
  return{sample:all.length,scanned:doneRows.length,profiled:prof.length,started:rows.length,total:all.length,pagesThisRun:0,completed:doneRows.length>=all.length,stopped:serverErrors>0,stopReason:serverErrors?'SERVER_PARTIAL_ERRORS':'',backend:'server',hubs:hubs,quality:{sample:prof.length,low:pct(low,known.length),empty:pct(empty,prof.length),mass:pct(mass,prof.length)}}
 }catch(e){
  set('↩ 専用サーバー失敗｜スマホ内走査へ自動切替');
  return await followerNetworkLocal(followers,targetFollowings,set);
 }
}
async function followerNetworkLocal(followers,targetFollowings,set){
 var db=await idbOpen();await migrateOldNet(db);
 var all=followers.slice(),tf=new Set(targetFollowings.map(function(x){return x.id})),stopped=false,stopReason='',lastUi=0,pageOps=0,profileOps=0,writeLock=Promise.resolve();
 var existing=await idbAll(db,'people'),pm=new Map(existing.map(function(x){return[x.id,x]})),hubRows=await idbAll(db,'hubs'),hm=new Map(hubRows.map(function(x){
  if(x.followers&&(!x.examples||!x.examples.length)){x.examples=x.followers.slice(0,5);x.count=Math.max(Number(x.count||0),x.followers.length);delete x.followers}
  if(!x.examples)x.examples=[];return[x.id,x]
 }));
 function savePage(ps,touched){
  writeLock=writeLock.then(function(){return new Promise(function(resolve,reject){
   var t=db.transaction(['people','hubs'],'readwrite'),po=t.objectStore('people'),ho=t.objectStore('hubs');po.put(ps);for(var i=0;i<touched.length;i++)ho.put(touched[i]);
   t.oncomplete=function(){resolve()};t.onerror=function(){reject(t.error)}
  })});return writeLock
 }
 function counts(){var prof=0,done=0,started=0;pm.forEach(function(x){started++;if(x.profile)prof++;if(x.done&&!x.error)done++});return{prof:prof,done:done,started:started}}
 function ui(extra){var now=Date.now();if(now-lastUi<140)return;lastUi=now;var c=counts();set('⚡ AUTO '+c.done+'/'+all.length+'完了｜概要 '+c.prof+'/'+all.length+'｜今 '+pageOps+'頁'+(extra?'｜'+extra:''))}
 async function ensureProfile(f){
  var ps=pm.get(f.id)||{id:f.id,nextPage:1,done:false,profile:null,read:0,per:0,error:''};pm.set(f.id,ps);
  if(ps.profile)return;
  try{
   var fp=await profile(f.id);
   ps.profile={key:fp.key,notes:fp.notes,bioThin:(!fp.bio||fp.bio.length<4),mass:(fp.followings>=300&&fp.followings>=Math.max(500,fp.followers*10)),followings:fp.followings,followers:fp.followers};
   ps.error='';profileOps++;await idbPut(db,'people',ps);ui('概要取得中');
  }catch(e){
   var msg=String(e&&e.message||e);ps.error=msg;await idbPut(db,'people',ps);
   if(/403|429/.test(msg)){stopped=true;stopReason=msg}
  }
 }
 async function pool(items,limit,fn){
  var ix=0;
  async function w(){while(!stopped){var i=ix++;if(i>=items.length)return;await fn(items[i])}}
  var ws=[];for(var k=0;k<limit;k++)ws.push(w());await Promise.all(ws)
 }
 // Phase 1: grab every follower profile first so overview reaches 1000 quickly.
 var missing=all.filter(function(f){var p=pm.get(f.id);return !p||!p.profile});
 if(missing.length){set('☁ 専用高速サーバー｜全員概要 残り '+missing.length+'人｜32並列');await pool(missing,32,ensureProfile)}
 if(stopped){await writeLock;var cc=counts();return finish(cc)}
 // Phase 2: breadth-first. One page per follower per round, so one huge account cannot block progress.
 async function onePage(f){
  if(stopped)return;
  var ps=pm.get(f.id);if(!ps||!ps.profile||ps.done&&!ps.error)return;
  try{
   var requested=ps.per||100,ls=await v2FollowPage(f.id,ps.nextPage,requested);
   if(!ps.per){ps.per=(ls.length>20?100:20)}
   var touchedMap=new Map;
   for(var z=0;z<ls.length;z++){
    var qx=ls[z];if(!qx||!qx.id||qx.id===PRESET_TARGET)continue;
    var h=hm.get(qx.id)||{id:qx.id,name:qx.name||qx.id,image:qx.image||'',count:0,examples:[],targetFollows:false};
    h.count=Number(h.count||0)+1;
    if(h.examples.length<5&&h.examples.indexOf(f.id)<0)h.examples.push(f.id);
    h.targetFollows=tf.has(qx.id);hm.set(qx.id,h);touchedMap.set(qx.id,h);
   }
   ps.read=Number(ps.read||0)+ls.length;ps.nextPage=Number(ps.nextPage||1)+1;
   if(!ls.length||ls.length<(ps.per||20))ps.done=true;
   ps.error='';pm.set(f.id,ps);pageOps++;await savePage(ps,Array.from(touchedMap.values()));ui('@'+f.id+' '+ps.read+'件');
  }catch(e){
   var msg=String(e&&e.message||e);ps.error=msg;pm.set(f.id,ps);await idbPut(db,'people',ps);
   if(/403|429/.test(msg)){stopped=true;stopReason=msg}
  }
 }
 var round=0;
 while(!stopped){
  var pending=all.filter(function(f){var p=pm.get(f.id);return p&&p.profile&&!p.done});
  if(!pending.length)break;
  round++;set('⚡ 制限OFF試験｜深掘りROUND '+round+'｜残り '+pending.length+'人｜32並列');
  await pool(pending,32,onePage);
  await writeLock;
 }
 await writeLock;
 return finish(counts());
 function finish(c){
  var people=Array.from(pm.values()),ids=new Set(all.map(function(x){return x.id})),rows=people.filter(function(x){return ids.has(x.id)}),prof=rows.filter(function(x){return x.profile}).map(function(x){return x.profile}),doneRows=rows.filter(function(x){return x.done&&!x.error});
  var known=prof.filter(function(x){return x.notes>=0}),low=known.filter(function(x){return x.notes<=1}).length,empty=prof.filter(function(x){return x.bioThin}).length,mass=prof.filter(function(x){return x.mass}).length;
  var hubs=Array.from(hm.values()).filter(function(x){return Number(x.count||0)>=2}).sort(function(a,b){return Number(b.count||0)-Number(a.count||0)}).slice(0,200);
  return{sample:all.length,scanned:doneRows.length,profiled:prof.length,started:rows.length,total:all.length,pagesThisRun:pageOps,completed:doneRows.length>=all.length,stopped:stopped,stopReason:stopReason,hubs:hubs,quality:{sample:prof.length,low:pct(low,known.length),empty:pct(empty,prof.length),mass:pct(mass,prof.length)}}
 }
}
function add(m,p,k,ak,body){if(!p||!p.id)return;var q=m.get(p.id)||{id:p.id,name:p.name||p.id,image:p.image||'',comments:0,replies:0,likes:0,follower:false,following:false,arts:new Set,phrases:[]};if(k==='comment')q.comments++;if(k==='reply')q.replies++;if(k==='like')q.likes++;if(k==='follower')q.follower=true;if(k==='following')q.following=true;if(ak)q.arts.add(ak);P.forEach(function(x){if(body&&body.indexOf(x)>=0&&q.phrases.indexOf(x)<0)q.phrases.push(x)});m.set(p.id,q)}function score(q){return q.comments*4+q.replies*3+Math.min(q.likes,12)+(q.follower?1:0)+(q.following?3:0)+Math.min(q.arts.size*2,10)+q.phrases.length*3}
async function quality(f,set){var s=f.slice(0,Math.min(80,f.length)),done=0,res=[];for(var i=0;i<s.length;i+=4){var chunk=s.slice(i,i+4),got=await Promise.all(chunk.map(async function(x){try{return await profile(x.id)}catch(e){return null}}));res=res.concat(got.filter(Boolean));done=res.length;set('フォロワー構成を確認中… '+done+'/'+s.length);await wait(40)}var known=res.filter(function(x){return x.notes>=0}),low=known.filter(function(x){return x.notes<=1}).length,empty=res.filter(function(x){return !x.bio||x.bio.length<4}).length,mass=res.filter(function(x){return x.followings>=300&&x.followings>=Math.max(500,x.followers*10)}).length;return{sample:res.length,low:pct(low,known.length),empty:pct(empty,res.length),mass:pct(mass,res.length)}}
function snap(id,count){var d={};try{d=JSON.parse(localStorage.getItem(SNAP)||'{}')||{}}catch(e){}var x=a(d[id]),prev=x.length?x[x.length-1]:null,now=Date.now();if(!prev||now-prev.at>300000||prev.count!==count)x.push({at:now,count:count});d[id]=x.slice(-20);localStorage.setItem(SNAP,JSON.stringify(d));if(!prev)return null;return{h:Math.round((now-prev.at)/360000)/10,delta:count-prev.count,pc:prev.count?Math.round((count-prev.count)*1000/prev.count)/10:0}}
function anomaly(q,g){var s=0,r=[];if(q.sample>=20){if(q.low>=50){s+=28;r.push('投稿0〜1件 '+q.low+'%')}else if(q.low>=30){s+=16;r.push('投稿0〜1件 '+q.low+'%')}if(q.mass>=25){s+=30;r.push('大量フォロー型 '+q.mass+'%')}else if(q.mass>=12){s+=18;r.push('大量フォロー型 '+q.mass+'%')}if(q.empty>=55){s+=16;r.push('プロフィール薄め '+q.empty+'%')}}if(g&&g.delta>0&&g.h<=24){if(g.delta>=200||g.pc>=20){s+=25;r.push(g.h+'時間で +'+g.delta+'人')}else if(g.delta>=80||g.pc>=10){s+=12;r.push(g.h+'時間で +'+g.delta+'人')}}s=Math.min(100,s);return{score:s,label:s>=60?'不自然な獲得パターンが強い':s>=35?'要確認':s>=15?'一部に偏りあり':'大きな異常は未検出',reasons:r}}
function marketMatch(q,g,p,network){var s=0,r=[];if(q.sample>=20&&q.mass>=25){s+=30;r.push('大量フォロー型フォロワー '+q.mass+'%')}else if(q.sample>=20&&q.mass>=12){s+=18;r.push('大量フォロー型フォロワー '+q.mass+'%')}
if(g&&g.delta>0){var d=g.delta,pack=[100,120,200,300],near=pack.find(function(x){return Math.abs(d-x)<=Math.max(20,x*.15)});if(g.h<=24&&d>=80){s+=20;r.push(g.h+'時間で +'+d+'人')}else if(g.h<=168&&d>=150){s+=14;r.push(g.h+'時間で +'+d+'人')}if(near){s+=14;r.push('増加幅が販売例の定額帯に近い（約'+near+'人）')}}
if(p.followers>=300&&p.followings<=10){s+=10;r.push('現在フォロー数が極端に少ない（整理後と両立する形）')}
if(network&&network.scanned>=8&&network.hubs&&network.hubs.length){var top=network.hubs[0],ratio=top.count/network.scanned;if(ratio>=.5){s+=18;r.push('共通フォロー先が高集中 '+Math.round(ratio*100)+'%')}else if(ratio>=.3){s+=10;r.push('共通フォロー先が集中 '+Math.round(ratio*100)+'%')}}
if(q.sample>=20&&q.low>=40){s+=8;r.push('低投稿アカウント比率 '+q.low+'%')}
s=Math.min(100,s);return{score:s,label:s>=65?'販売型運用との一致が複数':s>=40?'販売型運用と一部一致':s>=20?'弱い一致':'一致材料は少ない',reasons:r}}

function noteIdsInText(t){var out=new Set,s=String(t||''),m;var re=/https?:\/\/note\.com\/([A-Za-z0-9_-]+)/g;while((m=re.exec(s)))if(m[1]&&m[1]!==PRESET_TARGET)out.add(m[1].toLowerCase());var at=/@([A-Za-z0-9_]{3,30})/g;while((m=at.exec(s)))if(m[1]&&m[1].toLowerCase()!==PRESET_TARGET)out.add(m[1].toLowerCase());return Array.from(out)}
function externalAccountId(x){
 try{
  var u=new URL(x.url),p=u.pathname.split('/').filter(Boolean),pl=x.platform||platform(u),id='';
  if(pl==='X'||pl==='Instagram'||pl==='Facebook'||pl==='Pinterest'||pl==='lit.link'||pl==='Linktree'||pl==='GitHub')id=p[0]||'';
  else if(pl==='Threads'||pl==='TikTok')id=(p[0]||'').replace(/^@/,'');
  else if(pl==='Bluesky'&&p[0]==='profile')id=p[1]||'';
  else if(pl==='YouTube'&&/^@/.test(p[0]||''))id=(p[0]||'').replace(/^@/,'');
  else return'';
  id=c(id).replace(/^@/,'').toLowerCase();
  if(!/^[A-Za-z0-9_.-]{3,60}$/.test(id))return'';
  if(/^(production|uploads?|images?|assets?|static|media|profile|channel|watch|shorts|share|home)$/i.test(id))return'';
  return id
 }catch(e){return''}
}
function publicCandidates(direct,third,external){var m=new Map;function put(id,label,weight,source,url){id=c(id).replace(/^@/,'').toLowerCase();if(!id||id===PRESET_TARGET)return;var q=m.get(id)||{id:id,score:0,reasons:[],urls:[]};q.score+=weight;if(q.reasons.indexOf(label)<0)q.reasons.push(label);if(url&&q.urls.indexOf(url)<0)q.urls.push(url);m.set(id,q)}
direct.forEach(function(x){noteIdsInText(x.body).forEach(function(id){put(id,'本人の別垢等の文脈で公開言及',100,'direct','https://note.com/'+id)})});
third.forEach(function(x){noteIdsInText(x.body).forEach(function(id){put(id,'第三者の別垢等の文脈で公開言及',60,'third','https://note.com/'+id)})});
(external||[]).forEach(function(x){var id=externalAccountId(x);if(id)put(id,'公開SNS/プロフィール上のID｜'+(x.platform||x.host),25,'external',x.url)});
return Array.from(m.values()).sort(function(a,b){return b.score-a.score}).slice(0,20)}

var LIKED_KEY='note-account-audit:liked:v271:koakumako';
async function targetLikedArticles(id,set){
 set('☁ まこの公開スキ全件を取得中…');
 var lastErr='';
 for(var attempt=1;attempt<=3;attempt++){
  try{
   var j=await auditServer({action:'liked_all',id:id}),items=Array.isArray(j.items)?j.items:[],map={};
   items.forEach(function(x,i){
    if(!x)return;
    var k=c(x.key)||('gql-'+i);
    map[k]={key:k,creator:c(x.creator).toLowerCase(),noteKey:c(x.noteKey),publishedAt:x.publishedAt||null,rank:n(x.rank),cursor:c(x.cursor)};
   });
   var state={items:map,pages:n(j.pages),at:Date.now(),complete:j.complete===true,source:c(j.source||'note-graphql'),count:Number.isFinite(Number(j.count))?Number(j.count):Object.keys(map).length};
   localStorage.setItem(LIKED_KEY,JSON.stringify(state));
   set('❤️ まこの公開スキ '+state.count+'件｜GraphQL全件');
   return{items:Object.values(map),count:state.count,pages:state.pages,at:state.at,complete:state.complete,source:state.source};
  }catch(e){
   lastErr=String(e&&e.message||e);
   set('↻ スキ全件取得 再試行 '+attempt+'/3｜'+lastErr);
   if(attempt<3)await wait(1200*attempt);
  }
 }
 return{items:[],count:0,pages:0,at:Date.now(),complete:false,source:'graphql-error',error:lastErr};
}
function corrRanks(pairs){
 if(!pairs||pairs.length<3)return null;
 var ax=pairs.map(function(x){return x[0]}),ay=pairs.map(function(x){return x[1]}),mx=ax.reduce(function(a,b){return a+b},0)/ax.length,my=ay.reduce(function(a,b){return a+b},0)/ay.length,nm=0,dx=0,dy=0;
 for(var i=0;i<pairs.length;i++){var x=ax[i]-mx,y=ay[i]-my;nm+=x*y;dx+=x*x;dy+=y*y}
 return dx&&dy?nm/Math.sqrt(dx*dy):null
}
function analyzeLikeGraph(outgoing,followers,incomingRows,fallbackCandidates){
 var fs=new Set(followers.map(function(x){return x.id})),fr=new Map(followers.map(function(x){return[x.id,n(x.rank)]})),incoming=new Map,cmap=new Map;
 (incomingRows||[]).forEach(function(x){var id=c(x.id).toLowerCase();if(id)incoming.set(id,n(x.count||x.articles||1))});
 if(!incoming.size)(fallbackCandidates||[]).forEach(function(x){if(x.likes>0)incoming.set(x.id,x.likes)});
 outgoing.forEach(function(x,idx){
  if(!x.creator)return;
  var id=c(x.creator).toLowerCase(),q=cmap.get(id)||{id:id,count:0,follower:fs.has(id),followerRank:fr.get(id)||0,incoming:incoming.get(id)||0,likedArticleNewestAt:null,likedArticleOldestAt:null,latestLikeRank:0};
  q.count++;q.incoming=incoming.get(id)||0;
  var pa=x.publishedAt||null;if(pa){if(!q.likedArticleNewestAt||pa>q.likedArticleNewestAt)q.likedArticleNewestAt=pa;if(!q.likedArticleOldestAt||pa<q.likedArticleOldestAt)q.likedArticleOldestAt=pa}
  var rk=n(x.rank)||idx+1;if(!q.latestLikeRank||rk<q.latestLikeRank)q.latestLikeRank=rk;
  cmap.set(id,q)
 });
 var creators=Array.from(cmap.values()).sort(function(a,b){return b.count-a.count}),
     followerTargets=creators.filter(function(x){return x.follower}),
     mutual=creators.filter(function(x){return x.incoming>0}),
     followerMutual=followerTargets.filter(function(x){return x.incoming>0}),
     followerOneWay=followerTargets.filter(function(x){return x.incoming<=0}),
     pairs=followerTargets.filter(function(x){return x.followerRank>0&&x.latestLikeRank>0}).map(function(x){return[x.followerRank,x.latestLikeRank]}),
     fArts=outgoing.filter(function(x){return x.creator&&fs.has(c(x.creator).toLowerCase())}).length;
 return{
  articles:outgoing.length,creators:creators.length,followerArticles:fArts,followerCreators:followerTargets.length,
  mutualCreators:mutual.length,followerMutualCreators:followerMutual.length,followerOneWayCreators:followerOneWay.length,
  followerMutualIds:followerMutual.map(function(x){return x.id}),followerOneWayIds:followerOneWay.map(function(x){return x.id}),
  followerOneTouch:followerTargets.filter(function(x){return x.count===1}).length,
  oneWayOneTouch:followerOneWay.filter(function(x){return x.count===1}).length,
  allOneTouch:creators.filter(function(x){return x.count===1}).length,
  rankCorr:corrRanks(pairs),rankPairs:pairs.length,
  incomingCreators:incoming.size,top:creators.slice(0,30),mutual:mutual.slice(0,30),oneWay:followerOneWay.slice(0,80),
  creatorMap:cmap
 };
}
function ageDays(v){if(!v)return null;var t=Date.parse(v);return Number.isFinite(t)?Math.max(0,Math.floor((Date.now()-t)/86400000)):null}
function ageText(v){var d=ageDays(v);return d==null?'記事なし':d===0?'今日':d+'日前'}
async function activityProfiles(ids,set){
 var cache={};try{cache=JSON.parse(localStorage.getItem(ACTIVITY_KEY)||'{}')||{}}catch(e){}
 var now=Date.now(),uniq=Array.from(new Set((ids||[]).filter(Boolean))),need=uniq.filter(function(id){var x=cache[id];return !x||!x.cachedAt||now-x.cachedAt>21600000});
 var chunks=[];for(var i=0;i<need.length;i+=60)chunks.push(need.slice(i,i+60));var next=0,done=0;
 async function worker(){while(true){var k=next++;if(k>=chunks.length)return;var ch=chunks[k];try{var j=await auditServer({action:'activity_batch',ids:ch}),rs=Array.isArray(j.results)?j.results:[];rs.forEach(function(x){if(x&&x.id)cache[x.id]=Object.assign({},x,{cachedAt:Date.now()})})}catch(e){}done+=ch.length;set('☁ フォロワー活動日を照合 '+Math.min(done,need.length)+'/'+need.length)}}
 await Promise.all([worker(),worker()]);
 try{localStorage.setItem(ACTIVITY_KEY,JSON.stringify(cache))}catch(e){}
 return uniq.map(function(id){return cache[id]||{id:id,ok:false}}).filter(Boolean)
}
function bucketActivity(ids,amap){
 var x={total:ids.length,d7:0,d30:0,d90:0,d180:0,old180:0,noArticle:0,readSignal7:0,readSignal30:0,postOld90ReadRecent30:0,publicQuiet90:0};
 ids.forEach(function(id){var a=amap.get(id)||{},d=ageDays(a.latestArticleAt),ld=ageDays(a.latestLikedNotePublishedAt);
  if(d==null)x.noArticle++;else if(d<=7)x.d7++;else if(d<=30)x.d30++;else if(d<=90)x.d90++;else if(d<=180)x.d180++;else x.old180++;
  if(ld!=null&&ld<=7)x.readSignal7++;if(ld!=null&&ld<=30)x.readSignal30++;
  if((d==null||d>90)&&ld!=null&&ld<=30)x.postOld90ReadRecent30++;
  if((d==null||d>90)&&(ld==null||ld>90))x.publicQuiet90++;
 });
 return x
}
function analyzeActivity(lg,rows){
 var amap=new Map((rows||[]).map(function(x){return[x.id,x]})),one=bucketActivity(lg.followerOneWayIds||[],amap),mut=bucketActivity(lg.followerMutualIds||[],amap);
 var detail=(lg.oneWay||[]).map(function(x){return Object.assign({},x,{activity:amap.get(x.id)||null})});
 return{complete:rows&&rows.length>=new Set([].concat(lg.followerOneWayIds||[],lg.followerMutualIds||[])).size,oneWay:one,mutual:mut,rows:detail,map:amap}
}
function median(xs){var a=(xs||[]).filter(function(x){return Number.isFinite(x)}).sort(function(a,b){return a-b});if(!a.length)return 0;var m=Math.floor(a.length/2);return a.length%2?a[m]:Math.round((a[m-1]+a[m])/2)}
function pct1(a,b){return b?Math.round(a*1000/b)/10:0}
async function profileGroupStats(ids){
 try{
  var db=await idbOpen(),rows=await idbAll(db,'people'),want=new Set(ids||[]),ps=rows.filter(function(x){return want.has(x.id)&&x.profile}).map(function(x){return x.profile}),n0=ps.length;
  return{
   total:(ids||[]).length,known:n0,
   mass:ps.filter(function(x){return x.mass}).length,
   lowNotes:ps.filter(function(x){return n(x.notes)<=1}).length,
   thinBio:ps.filter(function(x){return x.bioThin}).length,
   follow1000:ps.filter(function(x){return n(x.followings)>=1000}).length,
   ratio10:ps.filter(function(x){return n(x.followers)>0&&n(x.followings)/n(x.followers)>=10}).length,
   medFollowings:median(ps.map(function(x){return n(x.followings)})),
   medFollowers:median(ps.map(function(x){return n(x.followers)}))
  }
 }catch(e){return{total:(ids||[]).length,known:0,mass:0,lowNotes:0,thinBio:0,follow1000:0,ratio10:0,medFollowings:0,medFollowers:0}}
}
function oldContentStats(items,followers){
 var OPEN=Date.parse('2026-09-01T00:00:00+09:00'),D=86400000,fs=new Set((followers||[]).map(function(x){return x.id})),x={known:0,preOpen:0,pre30:0,pre90:0,followerKnown:0,followerPreOpen:0,followerPre30:0,followerPre90:0};
 (items||[]).forEach(function(it){var t=Date.parse(it.publishedAt||'');if(!Number.isFinite(t))return;x.known++;if(t<OPEN)x.preOpen++;if(t<OPEN-30*D)x.pre30++;if(t<OPEN-90*D)x.pre90++;if(fs.has(c(it.creator).toLowerCase())){x.followerKnown++;if(t<OPEN)x.followerPreOpen++;if(t<OPEN-30*D)x.followerPre30++;if(t<OPEN-90*D)x.followerPre90++}});
 return x
}
async function deepDive(lg,likedItems,followers){
 var both=await Promise.all([profileGroupStats(lg.followerOneWayIds||[]),profileGroupStats(lg.followerMutualIds||[])]),one=both[0],mut=both[1],old=oldContentStats(likedItems,followers);
 return{
  oneWay:one,mutual:mut,old:old,
  followerCoverage:pct1(lg.followerCreators,(followers||[]).length),
  oneWayRate:pct1(lg.followerOneWayCreators,lg.followerCreators),
  mutualRate:pct1(lg.followerMutualCreators,lg.followerCreators),
  allOneTouchRate:pct1(lg.allOneTouch,lg.creators),
  followerOneTouchRate:pct1(lg.followerOneTouch,lg.followerCreators),
  oneWayOneTouchRate:pct1(lg.oneWayOneTouch,lg.followerOneWayCreators),
  avgAll:lg.creators?Math.round(lg.articles/lg.creators*100)/100:0,
  avgFollower:lg.followerCreators?Math.round(lg.followerArticles/lg.followerCreators*100)/100:0,
  rankCorr:lg.rankCorr,rankPairs:lg.rankPairs
 }
}
async function followerPatternSummary(){
 try{
  var db=await idbOpen(),rows=await idbAll(db,'people'),p=rows.filter(function(x){return x.profile}).map(function(x){var y=x.profile,sc=0,why=[];if(y.mass){sc+=45;why.push('大量フォロー型')}if(y.notes>=0&&y.notes<=1){sc+=25;why.push('投稿0〜1')}if(y.bioThin){sc+=10;why.push('プロフィール薄い')}if(y.followings>=1000){sc+=10;why.push('フォロー1000+')}if(y.followers>0&&y.followings/y.followers>=10){sc+=10;why.push('フォロー/フォロワー比10倍+')}return{id:x.id,score:sc,why:why,followings:y.followings,followers:y.followers,notes:y.notes}}).sort(function(a,b){return b.score-a.score});
  var strong=p.filter(function(x){return x.score>=50}).length,mid=p.filter(function(x){return x.score>=30}).length;
  return{checked:p.length,strong:strong,mid:mid,rows:p.slice(0,50)};
 }catch(e){return{checked:0,strong:0,mid:0,rows:[]}}
}
function marketLinks(){
 return[
  {name:'相互フォロー代行 300人〜',url:'https://coconala.com/services/1905459',kind:'相互フォロー→片思い整理。完了後フォロー解除可'},
  {name:'運用代行＋片思い整理',url:'https://coconala.com/services/3639020',kind:'ID/パス共有型。フォロー返し狙い＋整理'},
  {name:'フォロー数を増やさず増加',url:'https://coconala.com/services/4061546',kind:'URLのみ。フォロワーのみ増加を標榜'},
  {name:'スキ200件〜増加',url:'https://coconala.com/services/4121301',kind:'記事スキ増加サービス'}
 ]}
function status(t,b){var e=document.getElementById('naa-status');if(e){e.textContent=t;e.style.borderColor=b?'#a44':'#345'}}
function render(r){
 last=r;
 var e=document.getElementById('naa-result'),pc=r.publicCandidates||[],network=r.network||{scanned:0,total:0,hubs:[]},market=r.market||{score:0,label:'未計算',reasons:[]},lg=r.likeGraph||{articles:0,creators:0,followerArticles:0,followerCreators:0,mutualCreators:0,followerMutualCreators:0,followerOneWayCreators:0,incomingCreators:0,incomingArticles:0,incomingEdges:0,top:[],mutual:[],oneWay:[]},pat=r.pattern||{checked:0,strong:0,mid:0,rows:[]},act=r.activity||{complete:false,oneWay:{total:0},mutual:{total:0},rows:[]},deep=r.deep||{oneWay:{},mutual:{},old:{}},ml=marketLinks(),external=r.external||[],top=r.candidates.slice(0,30),direct=r.direct,third=r.third;
 function card(t,v,s){return'<div class="naa-card"><small>'+esc(t)+'</small><b>'+esc(v)+'</b><span>'+esc(s||'')+'</span></div>'}
 function rows(xs,fn,empty){return xs&&xs.length?xs.map(fn).join(''):'<div class="naa-empty">'+esc(empty||'該当なし')+'</div>'}
 var lead=pc[0]||null,leadStatus='特定につながる公開明示なし',leadNote='候補なし';
 if(lead){
   if(lead.score>=100){leadStatus='本人自身の公開言及あり';leadNote='強い公開根拠。ただし文脈を開いて確認'}
   else if(lead.score>=60){leadStatus='第三者の公開言及あり';leadNote='第三者情報。本人確認ではない'}
   else{leadStatus='公開SNSリンク由来の候補';leadNote='SNSプロフィールIDだけでは本人特定不可'}
 }
 var marketText=market.score>=65?'販売型と複数一致':market.score>=40?'販売型と一部一致':market.score>=20?'販売型との一致は弱い':'販売型の一致材料は少ない';
 e.innerHTML=
 '<div class="naa-conclusion">'+
   '<small>今回の仮説検証</small>'+
   '<b>一方向 '+lg.followerOneWayCreators+'人</b>'+
   '<span>'+(act.complete?'停止・閲覧活動まで照合完了':'停止・閲覧活動を照合中')+'</span>'+
   '<em>'+(act.complete
      ?('90日超投稿停止/記事なし '+(act.oneWay.d180+act.oneWay.old180+act.oneWay.noArticle)+'人 ／ 公開活動90日超薄い '+act.oneWay.publicQuiet90+'人 ／ 最近30日以内の閲覧シグナル '+act.oneWay.readSignal30+'人')
      :'活動日データの取得中')+'</em>'+
   '<div class="naa-conclusion-sub">まこ→相手 '+lg.articles+'件｜現フォロワーへ '+lg.followerCreators+'人｜一方向 '+lg.followerOneWayCreators+'人｜一方向1回だけ '+deep.oneWayOneTouchRate+'%｜販売型 '+market.score+'/100</div>'+
 '</div>'+
 '<div class="naa-hyp">'+
   '<b>⏸ 停止アカウント仮説</b>'+
   '<div class="naa-hyp-grid">'+
     card('一方向',lg.followerOneWayCreators+'人','まこ→相手のみ')+
     card('90日超停止/記事なし',(act.oneWay.d180+act.oneWay.old180+act.oneWay.noArticle)+'人',act.complete?'一方向内 '+Math.round(((act.oneWay.d180+act.oneWay.old180+act.oneWay.noArticle)/Math.max(1,act.oneWay.total))*100)+'%':'集計中')+
     card('公開活動90日超薄い',act.oneWay.publicQuiet90+'人',act.complete?'投稿も閲覧シグナルも古い/なし':'集計中')+
     card('最近30日閲覧あり',act.oneWay.readSignal30+'人',act.complete?'最近公開記事へのスキあり':'集計中')+
     card('相互側90日超薄い',act.mutual.publicQuiet90+'人',act.complete?'比較用 / 相互 '+act.mutual.total+'人':'集計中')+
     card('本垢候補',pc.length+'件',lead?('@'+lead.id):'明示根拠なし')+
   '</div>'+
 '</div>'+
 '<div class="naa-cards">'+
 card('公開根拠候補',pc.length+'件',lead?('@'+lead.id+'｜'+leadNote):'明示根拠なし')+
 card('まこ→スキ',lg.complete?(lg.articles+'件'):'取得再試行中',lg.complete?('GraphQL全件｜'+lg.creators+'人へ'):(lg.error||'GraphQL未完了'))+
 card('フォロワーへスキ',lg.followerArticles+'件',lg.followerCreators+'人')+
 card('全記事相互',(lg.incomingComplete?'':'>=')+lg.followerMutualCreators+'人',lg.incomingComplete?'まこの全'+lg.incomingArticles+'記事で照合':'全記事照合は未完了')+
 card('全員走査',network.scanned+'/'+network.total,network.backend==='server'?'専用サーバー':'端末フォールバック')+
 card('販売型一致',market.score+'/100',market.label)+
 '</div>'+
 '<div class="naa-tabs">'+
 '<button data-tab="answer" class="on">答え</button><button data-tab="likes">スキ</button><button data-tab="activity">停止</button><button data-tab="deep">深掘り</button><button data-tab="net">関係網</button><button data-tab="market">購入</button><button data-tab="ext">外部</button>'+
 '</div>'+
 '<section class="naa-pane on" data-pane="answer">'+
 '<h3>🎯 公開根拠の強い確認候補</h3><p class="naa-note">「サブ垢率」ではなく、公開上の根拠強度。本人発言・第三者名指し・相互リンク・同一公開IDを優先。</p>'+
 rows(pc.slice(0,12),function(x){return'<div class="naa-compact"><span><b>@'+esc(x.id)+'</b><small>根拠 '+x.score+'｜'+esc(x.reasons.join(' / '))+'</small></span><a target="_blank" href="'+esc(x.urls[0]||('https://note.com/'+x.id))+'">確認</a></div>'},'公開根拠つき候補はまだ0件')+
 '<details><summary>本人・第三者の別垢言及</summary>'+
 (direct.length?direct.map(function(x){return'<div class="naa-ev"><b>本人｜'+esc(x.hits.join(' / '))+'</b><br>'+esc(x.body)+'</div>'}).join(''):'')+
 (third.length?third.slice(0,30).map(function(x){return'<div class="naa-ev"><b>'+esc(x.name)+' @'+esc(x.id)+'｜'+esc(x.hits.join(' / '))+'</b><br>'+esc(x.body)+'</div>'}).join(''):'<div class="naa-empty">言及なし</div>')+
 '</details></section>'+
 '<section class="naa-pane" data-pane="likes">'+
 '<h3>❤️ まこの公開スキ行動</h3>'+
 '<div class="naa-mini">'+(lg.complete?('公開スキ全件 <b>'+lg.articles+'</b>件 ／ 相手 <b>'+lg.creators+'</b>人 ／ フォロワー相手 <b>'+lg.followerCreators+'</b>人 ／ 相互スキ <b>'+lg.mutualCreators+'</b>人'):('公開スキ全件を取得中／再試行中'))+'<br><small>取得: '+esc(lg.source||'不明')+(lg.error?'｜'+esc(lg.error):'')+'</small></div>'+
 '<h4>スキ先 上位</h4>'+
 rows(lg.top.slice(0,20),function(x){return'<div class="naa-compact"><span><b>@'+esc(x.id)+'</b><small>まこ→ '+x.count+'件'+(x.follower?'｜フォロワー':'')+(x.incoming?'｜相手→まこ記事 '+x.incoming+'件':'')+'</small></span><a target="_blank" href="https://note.com/'+encodeURIComponent(x.id)+'">開く</a></div>'},'公開スキ履歴を取得できていません')+
 '<details><summary>相互スキ（現フォロワー内 '+lg.followerMutualCreators+'人）</summary>'+rows(lg.mutual.filter(function(x){return x.follower}),function(x){return'<div class="naa-compact"><span><b>@'+esc(x.id)+'</b><small>まこ→ '+x.count+'件 ／ 相手→まこ '+x.incoming+'記事</small></span></div>'},'相互スキなし')+'</details>'+ '<details><summary>まこ→相手のみ（現フォロワー内 '+lg.followerOneWayCreators+'人）</summary>'+rows(lg.oneWay,function(x){return'<div class="naa-compact"><span><b>@'+esc(x.id)+'</b><small>まこ→ '+x.count+'件 ／ 相手→まこ 0件 ／ 現在フォローあり</small></span></div>'},'該当なし')+'</details>'+
 '</section>'+
 '<section class="naa-pane" data-pane="activity">'+
 '<h3>⏸ 投稿停止・閲覧活動の照合</h3>'+
 '<div class="naa-note">「最新記事」は投稿停止の目安。「最近公開された記事へのスキ」は閲覧活動の下限シグナル。スキした正確な日時は公開APIでは取得できません。</div>'+
 '<div class="naa-cards">'+
 card('一方向',act.oneWay.total+'人','まこ→相手のみ')+
 card('一方向：投稿90日超/なし',(act.oneWay.old180+act.oneWay.noArticle+act.oneWay.d180)+'人','公開投稿が長期停止')+
 card('一方向：最近の閲覧シグナル',act.oneWay.readSignal30+'人','30日以内公開記事へのスキあり')+
 card('投稿停止だが閲覧は最近',act.oneWay.postOld90ReadRecent30+'人','90日超/記事なし＋最近のスキ対象')+
 card('公開活動90日超薄い',act.oneWay.publicQuiet90+'人','投稿もスキ対象も古い/なし')+
 card('相互側：公開活動90日超薄い',act.mutual.publicQuiet90+'人','比較用')+
 '</div>'+
 '<details open><summary>一方向フォロワーの例（最大80人）</summary>'+
 rows(act.rows,function(x){var a=x.activity||{};return'<div class="naa-compact"><span><b>@'+esc(x.id)+'</b><small>本人最新記事 '+ageText(a.latestArticleAt)+' ／ 最近のスキ対象記事 '+ageText(a.latestLikedNotePublishedAt)+' ／ まこがスキした記事の新しい投稿日 '+ageText(x.likedArticleNewestAt)+'</small></span><a target="_blank" href="https://note.com/'+encodeURIComponent(x.id)+'">開く</a></div>'},'活動日データなし')+
 '</details></section>'+'<section class="naa-pane" data-pane="deep">'+
 '<h3>🔬 一方向824人をさらに分解</h3>'+
 '<div class="naa-mini">現フォロワーへの接触率 <b>'+deep.followerCoverage+'%</b> ／ 接触済みフォロワーの一方向率 <b>'+deep.oneWayRate+'%</b> ／ 相互率 <b>'+deep.mutualRate+'%</b></div>'+
 '<h4>1回だけスキしている割合</h4>'+
 '<div class="naa-cards">'+
 card('全スキ先',deep.allOneTouchRate+'%','1人1回だけ')+
 card('現フォロワー',deep.followerOneTouchRate+'%','1人1回だけ')+
 card('一方向824人',deep.oneWayOneTouchRate+'%','1人1回だけ')+
 card('平均スキ数',deep.avgFollower+'件/人','現フォロワー相手')+
 '</div>'+
 '<h4>一方向 vs 相互のプロフィール構成</h4>'+
 '<div class="naa-compare"><div><b>一方向 '+deep.oneWay.known+'人</b><small>大量フォロー型 '+pct1(deep.oneWay.mass,deep.oneWay.known)+'%<br>投稿0〜1 '+pct1(deep.oneWay.lowNotes,deep.oneWay.known)+'%<br>フォロー1000+ '+pct1(deep.oneWay.follow1000,deep.oneWay.known)+'%<br>フォロー/フォロワー比10倍+ '+pct1(deep.oneWay.ratio10,deep.oneWay.known)+'%<br>中央値 フォロー '+deep.oneWay.medFollowings+' / フォロワー '+deep.oneWay.medFollowers+'</small></div><div><b>相互 '+deep.mutual.known+'人</b><small>大量フォロー型 '+pct1(deep.mutual.mass,deep.mutual.known)+'%<br>投稿0〜1 '+pct1(deep.mutual.lowNotes,deep.mutual.known)+'%<br>フォロー1000+ '+pct1(deep.mutual.follow1000,deep.mutual.known)+'%<br>フォロー/フォロワー比10倍+ '+pct1(deep.mutual.ratio10,deep.mutual.known)+'%<br>中央値 フォロー '+deep.mutual.medFollowings+' / フォロワー '+deep.mutual.medFollowers+'</small></div></div>'+
 '<h4>古い記事まで掘ってスキしているか</h4>'+
 '<div class="naa-cards">'+
 card('開設前の記事',deep.old.preOpen+'件',deep.old.known+'件中')+
 card('開設30日以上前',deep.old.pre30+'件','開設時点ですでに30日+経過')+
 card('開設90日以上前',deep.old.pre90+'件','開設時点ですでに90日+経過')+
 card('フォロワー相手の開設前記事',deep.old.followerPreOpen+'件',deep.old.followerKnown+'件中')+
 '</div>'+
 '<h4>一覧表示順の連動</h4><div class="naa-note">フォロワー一覧とスキ一覧の表示順を '+deep.rankPairs+'人で比較。相関 '+(deep.rankCorr==null?'算出不可':deep.rankCorr.toFixed(3))+'。これはフォロー日時・スキ日時そのものではなく、現在の一覧表示順の連動だけを見る参考指標。</div>'+
 '</section>'+'<section class="naa-pane" data-pane="net">'+
 '<h3>🕸 フォロワー全員の関係網</h3><div class="naa-mini">概要 <b>'+(network.profiled||network.scanned)+'/'+network.total+'</b> ／ 深掘り完了 <b>'+network.scanned+'/'+network.total+'</b> ／ 今回 '+(network.pagesThisRun||0)+'頁'+(network.completed?'｜全員完了':'｜全自動継続')+'</div>'+
 '<h4>共通フォロー先 TOP</h4>'+
 rows((network.hubs||[]).slice(0,25),function(x){return'<div class="naa-compact"><span><b>'+esc(x.name||x.id)+' @'+esc(x.id)+'</b><small>共通 '+x.count+'/'+network.scanned+'人'+(x.targetFollows?'｜まこ本人もフォロー':'')+'</small></span><a target="_blank" href="https://note.com/'+encodeURIComponent(x.id)+'">開く</a></div>'},'共通フォロー先なし')+
 '<details><summary>フォロワー側の相互フォロー型プロフィール（'+pat.strong+'人）</summary>'+
 '<div class="naa-note">購入の証拠ではなく、公開プロフィール構成が「大量フォロー型」に近い人。</div>'+
 rows(pat.rows.slice(0,40),function(x){return'<div class="naa-compact"><span><b>@'+esc(x.id)+'</b><small>一致 '+x.score+'｜'+esc(x.why.join(' / '))+'｜フォロー '+x.followings+' / フォロワー '+x.followers+' / 投稿 '+x.notes+'</small></span><a target="_blank" href="https://note.com/'+encodeURIComponent(x.id)+'">開く</a></div>'},'走査データなし')+
 '</details></section>'+
 '<section class="naa-pane" data-pane="market">'+
 '<h3>🧪 ココナラ等の販売型との照合</h3><div class="naa-score"><b>'+market.score+'/100</b><span>'+esc(market.label)+'</span></div>'+
 '<div class="naa-note">'+esc(market.reasons.join(' / ')||'一致材料なし')+'</div>'+
 '<h4>比較する現行サービス</h4>'+
 ml.map(function(x){return'<div class="naa-compact"><span><b>'+esc(x.name)+'</b><small>'+esc(x.kind)+'</small></span><a target="_blank" rel="noreferrer" href="'+esc(x.url)+'">見る</a></div>'}).join('')+
 '<details><summary>判定に使う観点</summary><div class="naa-ev">①短期間の増加幅　②現在フォロー0/少数　③相互フォロー型フォロワー比率　④共通ハブ集中　⑤低投稿・大量フォロー型比率　⑥まこ→フォロワーへのスキ　⑦相互スキ集中　⑧フォロー数を増やさない販売型との両立</div></details>'+
 '</section>'+
 '<section class="naa-pane" data-pane="ext">'+
 '<h3>🌐 外部SNS・公開リンク</h3>'+
 rows(external.slice(0,30),function(x){return'<div class="naa-compact"><span><b>'+esc(x.platform)+'｜'+esc(x.host)+'</b><small>'+esc(x.source||'公開リンク')+'</small></span><a target="_blank" href="'+esc(x.url)+'">開く</a></div>'},'noteから直接つながる外部公開リンクは未確認')+
 '<details><summary>接点が濃いnoteアカウント</summary>'+rows(top,function(x){return'<div class="naa-compact"><span><b>'+esc(x.name)+' @'+esc(x.id)+'</b><small>コメ '+x.comments+' / 返信 '+x.replies+' / まこ記事へのスキ '+x.likes+' / 接触記事 '+x.artCount+'</small></span><a target="_blank" href="https://note.com/'+encodeURIComponent(x.id)+'">開く</a></div>'},'接点なし')+'</details>'+
 '</section>';
 e.querySelectorAll('.naa-tabs button').forEach(function(b){b.onclick=function(){var t=b.dataset.tab;e.querySelectorAll('.naa-tabs button').forEach(function(x){x.classList.toggle('on',x===b)});e.querySelectorAll('.naa-pane').forEach(function(x){x.classList.toggle('on',x.dataset.pane===t)})}});
}

var NAA_AUTO={running:false,timer:null,cycles:0,lastDelay:0,rateHits:0,lastLikeDiag:null};
function autoSchedule(ms,reason){
 if(NAA_AUTO.timer)clearTimeout(NAA_AUTO.timer);
 NAA_AUTO.lastDelay=ms;
 var sec=Math.max(0,Math.round(ms/1000));
 status(ms>0?'⏳ 自動待機 '+sec+'秒'+(reason?'｜'+reason:''):'⚡ 即時自動再開');
 NAA_AUTO.timer=setTimeout(function(){NAA_AUTO.timer=null;void run()},ms);
}
function rateDelay(){NAA_AUTO.rateHits=Math.min(4,NAA_AUTO.rateHits+1);return Math.min(30000,5000*Math.pow(2,NAA_AUTO.rateHits-1))}
function clearRateDelay(){NAA_AUTO.rateHits=0}

async function diagnoseLikes(){
 var box=document.getElementById('naa-diag');
 if(box){box.style.display='block';box.innerHTML='🔍 接続診断中…'}
 try{
  var t0=Date.now(),j=await auditServer({action:'liked_all',id:PRESET_TARGET}),ms=Date.now()-t0,items=Array.isArray(j.items)?j.items:[];
  NAA_AUTO.lastLikeDiag={ok:true,count:items.length,pages:n(j.pages),source:c(j.source||'note-graphql'),ms:ms};
  if(box)box.innerHTML='✅ Edge Function OK<br>✅ GraphQL OK<br>取得 '+items.length+'件 / '+n(j.pages)+'ページ<br>'+ms+'ms';
  status('✅ スキ診断OK｜'+items.length+'件');
 }catch(e){
  var msg=String(e&&e.message||e);NAA_AUTO.lastLikeDiag={ok:false,error:msg};
  if(box)box.innerHTML='❌ スキ全件取得NG<br>'+esc(msg);
  status('❌ スキ診断 '+msg,1);
 }
}
async function run(){if(NAA_AUTO.running)return;NAA_AUTO.running=true;NAA_AUTO.cycles++;try{var id=PRESET_TARGET;var extra=PRESET_ARTS.map(artUrl).filter(Boolean);status('プロフィール取得中…');var p=await profile(id);status('記事取得中…');var arts=await articles(id,extra),m=new Map,all=[],external=rawExternal(p.raw).map(function(x){return Object.assign({source:'プロフィール公開情報'},x)}).concat(urlsInText(p.bio).map(function(x){return Object.assign({source:'プロフィール本文'},x)}));for(var i=0;i<arts.length;i++){var art=arts[i];status('外部リンク '+(i+1)+'/'+arts.length+'｜'+art.title);try{external=external.concat(await articleExternal(art))}catch(e){}status('コメント '+(i+1)+'/'+arts.length+'｜'+art.title);try{var cs=await comments(art.key);cs.forEach(function(x){x.art=art.key;all.push(x);if(x.id&&x.id!==id)add(m,{id:x.id,name:x.name,image:x.image},x.parent?'reply':'comment',art.key,x.body)})}catch(e){}status('スキ '+(i+1)+'/'+arts.length+'｜'+art.title);try{var ls=await likers(art.key);ls.forEach(function(x){if(x.id!==id)add(m,x,'like',art.key,'')})}catch(e){}await wait(35)}status('☁ 専用サーバーでフォロー関係取得中…');var followers=[],followings=[];try{var sr=await auditServer({action:'target',id:id});followers=(sr.followers||[]).map(function(x){return{id:c(x.id).toLowerCase(),name:c(x.name||x.id),image:c(x.image),rank:n(x.rank)}});followings=(sr.followings||[]).map(function(x){return{id:c(x.id).toLowerCase(),name:c(x.name||x.id),image:c(x.image),rank:n(x.rank)}})}catch(e){status('↩ フォロー関係は端末取得へ切替');var rr=await Promise.all([rel(p,'followers'),rel(p,'followings')]);followers=rr[0];followings=rr[1]}followers.forEach(function(x){if(x.id!==id)add(m,x,'follower','','')});followings.forEach(function(x){if(x.id!==id)add(m,x,'following','','')});status('まこの公開スキ履歴を確認中…');var liked=await targetLikedArticles(id,status);status('☁ まこの全記事スキも並列集計中…');var incomingPromise=auditServer({action:'incoming_likes_all',id:id}).catch(function(e){return{ok:false,complete:false,rows:[],error:String(e&&e.message||e)}});status('フォロワー関係網を確認中…');var network=await followerNetwork(followers,followings,status),incomingAll=await incomingPromise;status('フォロワー構成集計中…');var q=network.quality||{sample:0,low:0,empty:0,mass:0},g=snap(id,p.followers),an=anomaly(q,g),direct=[],third=[];all.forEach(function(x){urlsInText(x.body).forEach(function(u){external.push(Object.assign({source:'コメント:'+x.art},u))});var hits=P.filter(function(z){return x.body.indexOf(z)>=0});if(hits.length){var z={id:x.id,name:x.name,body:x.body,hits:hits,art:x.art};if(x.id===id)direct.push(z);else third.push(z)}});var candidates=Array.from(m.values()).map(function(x){return Object.assign({},x,{score:score(x),artCount:x.arts.size})}).sort(function(x,y){return y.score-x.score});var likeGraph=analyzeLikeGraph(liked.items,followers,incomingAll&&incomingAll.rows||[],candidates);likeGraph.articles=Number.isFinite(Number(liked.count))?Number(liked.count):likeGraph.articles;likeGraph.complete=liked.complete===true;likeGraph.source=liked.source||'';likeGraph.error=liked.error||'';likeGraph.incomingComplete=Boolean(incomingAll&&incomingAll.complete===true);likeGraph.incomingArticles=n(incomingAll&&incomingAll.articles);likeGraph.incomingEdges=n(incomingAll&&incomingAll.totalLikeEdges);likeGraph.incomingUnique=n(incomingAll&&incomingAll.uniqueLikers);likeGraph.incomingError=c(incomingAll&&incomingAll.error);status('☁ 一方向/相互フォロワーの活動日を照合中…');var activityRows=await activityProfiles([].concat(likeGraph.followerOneWayIds||[],likeGraph.followerMutualIds||[]),status),activity=analyzeActivity(likeGraph,activityRows);status('🔬 深掘り比較を集計中…');var deep=await deepDive(likeGraph,liked.items,followers),pattern=await followerPatternSummary(),market=marketMatch(q,g,p,network);if(likeGraph.followerCreators>=5){market.score=Math.min(100,market.score+8);market.reasons.push('まこ→フォロワーへの公開スキ '+likeGraph.followerCreators+'人')}if(likeGraph.incomingComplete&&likeGraph.followerMutualCreators>=5){market.score=Math.min(100,market.score+8);market.reasons.push('全記事相互スキ '+likeGraph.followerMutualCreators+'人')}market.label=market.score>=65?'販売型運用との一致が複数':market.score>=40?'販売型運用と一部一致':market.score>=20?'弱い一致':'一致材料は少ない';external=dedupExternal(external);var pc=publicCandidates(direct,third,external);render({p:p,q:q,g:g,an:an,direct:direct,third:third,candidates:candidates,external:external,searches:searchLinks(p.id,p.name),network:network,market:market,publicCandidates:pc,likeGraph:likeGraph,pattern:pattern,activity:activity,deep:deep});if(network.completed&&likeGraph.complete&&likeGraph.incomingComplete){clearRateDelay();status('✅ 完了｜一方向 '+likeGraph.followerOneWayCreators+'人｜90日超停止/なし '+(activity.oneWay.d180+activity.oneWay.old180+activity.oneWay.noArticle)+'人｜公開活動90日超薄い '+activity.oneWay.publicQuiet90+'人')}else if(network.completed&&(!likeGraph.complete||!likeGraph.incomingComplete)){autoSchedule(5000,'スキ全件照合を自動再試行')}else{var d=network.stopped?(network.backend==='server'?3000:rateDelay()):0;if(!network.stopped)clearRateDelay();autoSchedule(d,network.stopped?'アクセス制限後に自動再開':'続きから自動再開')}}catch(e){var msg=String(e&&e.message||e);status('⚠ '+msg,1);autoSchedule(/403|429/.test(msg)?rateDelay():5000,'エラー後に自動再開')}finally{NAA_AUTO.running=false}}
function install(){var old=document.getElementById('note-account-audit-v1');if(old)old.remove();var st=document.createElement('style');st.textContent='#note-account-audit-v1{position:fixed;right:8px;bottom:10px;z-index:2147483640;font-family:system-ui;color:#eef7ff}#naa-open{height:42px;padding:0 13px;border:1px solid #5bd8ff;border-radius:999px;background:#07131d;color:#fff;font-weight:900}#naa-panel{display:none;width:min(520px,calc(100vw - 12px));height:min(74vh,680px);overflow:hidden;margin-bottom:6px;padding:9px;border:1px solid #355b70;border-radius:14px;background:#071019;box-shadow:0 18px 40px #000b}.naa-btn{display:none}.naa-auto{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;padding:7px 9px;border:1px solid #397b62;border-radius:8px;background:#0c2b21}.naa-auto b{font-size:11px}.naa-auto span{font-size:8px;color:#a9cdbd}.naa-diag-btn{width:100%;height:34px;margin-top:5px;border:1px solid #6ad6ff;border-radius:8px;background:#0b2230;color:#fff;font-size:10px;font-weight:900}.naa-diag-box{margin-top:5px;padding:7px;border:1px solid #375b6c;border-radius:8px;background:#08161f;font-size:9px;line-height:1.5}#naa-status{margin:5px 0;padding:5px 7px;border:1px solid #345;border-radius:7px;background:#0b1821;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#naa-result{height:calc(100% - 86px);overflow:auto;padding-right:2px}.naa-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin:5px 0}.naa-card{padding:7px;border:1px solid #29495c;border-radius:9px;background:#0b1720}.naa-card small,.naa-card span{display:block;color:#98afbc;font-size:8px}.naa-conclusion{margin:5px 0 8px;padding:10px;border:2px solid #45c9ff;border-radius:11px;background:#0a1d28}.naa-conclusion small{display:block;color:#8fdfff;font-size:9px;font-weight:900}.naa-conclusion>b{display:block;margin:2px 0;font-size:20px;line-height:1.2}.naa-conclusion>span{display:block;font-size:11px;font-weight:800}.naa-conclusion>em{display:block;margin-top:4px;color:#a9bbc5;font-size:8px;font-style:normal;line-height:1.4}.naa-conclusion-sub{margin-top:7px;padding-top:7px;border-top:1px solid #29495c;font-size:8px;line-height:1.4}.naa-conclusion a{display:inline-block;margin-top:6px;color:#7ce2ff;font-size:9px;font-weight:800;text-decoration:none}.naa-hyp{margin:6px 0 8px;padding:8px;border:1px solid #4d7285;border-radius:10px;background:#09151d}.naa-hyp>b{display:block;margin-bottom:5px;font-size:11px}.naa-hyp-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}.naa-hyp-grid .naa-card{margin:0}.naa-compare{display:grid;grid-template-columns:1fr 1fr;gap:6px}.naa-compare>div{padding:8px;border:1px solid #29495c;border-radius:9px;background:#0b1720}.naa-compare b{display:block;font-size:11px;margin-bottom:5px}.naa-compare small{font-size:8px;line-height:1.55;color:#a8bdc9}.naa-card b{display:block;font-size:15px;line-height:1.2;margin:2px 0}.naa-tabs{position:sticky;top:0;z-index:3;display:grid;grid-template-columns:repeat(4,1fr);gap:3px;padding:5px 0;background:#071019}.naa-tabs button{height:31px;padding:0 2px;border:1px solid #29495c;border-radius:7px;background:#0b1720;color:#a8bdc9;font-size:9px;font-weight:800}.naa-tabs button.on{background:#0b5178;color:#fff;border-color:#52d6ff}.naa-pane{display:none}.naa-pane.on{display:block}.naa-pane h3{font-size:12px;margin:9px 0 4px;border-top:1px solid #233b49;padding-top:7px}.naa-pane h4{font-size:10px;margin:8px 0 3px}.naa-note,.naa-mini,.naa-ev,.naa-empty{padding:6px;border:1px solid #29404e;border-radius:7px;background:#0a151d;font-size:9px;line-height:1.45}.naa-mini b{font-size:12px}.naa-compact{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;padding:6px 7px;border-bottom:1px solid #1f3440}.naa-compact b{font-size:10px}.naa-compact small{display:block;color:#93aab7;font-size:8px;line-height:1.35}.naa-compact a{color:#7ce2ff;font-size:9px;text-decoration:none}.naa-score{display:flex;align-items:end;gap:8px;padding:7px;border:1px solid #36566a;border-radius:8px;background:#0b1821}.naa-score b{font-size:22px}.naa-score span{font-size:10px;padding-bottom:3px}details{margin-top:6px;border:1px solid #243b49;border-radius:8px;padding:5px}summary{font-size:9px;font-weight:800;cursor:pointer}';document.head.appendChild(st);var r=document.createElement('div');r.id='note-account-audit-v1';var cur=(location.pathname.split('/').filter(Boolean)[0]||'');r.innerHTML='<div id="naa-panel"><b>🔎 こあく まこ 検証ダッシュボード v3.0</b><div class="naa-ev"><b>対象 @'+esc(PRESET_TARGET)+'</b><br>スキ・フォロワー網・購入型・外部リンクを横断検証。</div><div class="naa-auto"><b>☁ 専用高速サーバー</b><span>INSIGHT本体とは分離・重い関係走査は専用Edge Function</span></div><button id="naa-like-diag" class="naa-diag-btn">🔍 スキ全件 接続診断</button><div id="naa-diag" class="naa-diag-box" style="display:none"></div><div id="naa-status">自動開始待ち</div><small>一方向フォロワーの停止・閲覧活動をトップに表示。</small><div id="naa-result"></div></div><button id="naa-open" >🔎 こあく まこ調査</button>';document.body.appendChild(r);document.getElementById('naa-open').onclick=function(){var p=document.getElementById('naa-panel');p.style.display=p.style.display==='block'?'none':'block'};var dg=document.getElementById('naa-like-diag');if(dg)dg.onclick=function(){void diagnoseLikes()};var p=document.getElementById('naa-panel');p.style.display='block';setTimeout(function(){void run()},650)}
if(document.body)install();else addEventListener('DOMContentLoaded',install,{once:true});
})();