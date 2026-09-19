// ==UserScript==
// @name note こあく まこ調査
// @namespace https://github.com/mumei-s/note-insight
// @version 2.4.0
// @description 公開コメント・返信・スキ・フォロー関係とフォロワー構成を確認。本人同定は公開明示だけを根拠にします。
// @match https://note.com/*
// @updateURL https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-account-audit.user.js
// @downloadURL https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-account-audit.user.js
// @grant none
// @run-at document-start
// ==/UserScript==
(function(){
'use strict';window.__noteAccountAuditV1=1;window.__noteAccountAuditCanonical='2.4.0';
var P=['本垢','本アカ','メイン垢','メインアカ','サブ垢','サブアカ','別垢','別アカ','前垢','旧垢','前のアカウント','以前のアカウント','アカウント作り直','転生','複垢'];
var SNAP='note-account-audit:snapshots',OLD_NET='note-account-audit:all-followers:v18:koakumako',DBN='note-account-audit-v19-koakumako',last=null;
var PRESET_TARGET='koakumako',AUTO_KEY='note-account-audit:auto:koakumako:canonical:v221';
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
function externalUrl(v){try{var u=new URL(c(v),location.href);if(!/^https?:$/.test(u.protocol))return null;if(/(^|\.)note\.com$/i.test(u.hostname))return null;return{url:u.href,host:u.hostname.replace(/^www\./,''),platform:platform(u)}}catch(e){return null}}
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
 if(missing.length){set('⚡ 全員概要を先に取得｜残り '+missing.length+'人｜20並列');await pool(missing,20,ensureProfile)}
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
  round++;set('⚡ 深掘りROUND '+round+'｜残り '+pending.length+'人｜20並列');
  await pool(pending,20,onePage);
  await writeLock;
  if(!stopped)await wait(40);
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
function publicCandidates(direct,third,external){var m=new Map;function put(id,label,weight,source,url){id=c(id).replace(/^@/,'').toLowerCase();if(!id||id===PRESET_TARGET)return;var q=m.get(id)||{id:id,score:0,reasons:[],urls:[]};q.score+=weight;if(q.reasons.indexOf(label)<0)q.reasons.push(label);if(url&&q.urls.indexOf(url)<0)q.urls.push(url);m.set(id,q)}
direct.forEach(function(x){noteIdsInText(x.body).forEach(function(id){put(id,'本人の別垢等の文脈で公開言及',100,'direct','https://note.com/'+id)})});
third.forEach(function(x){noteIdsInText(x.body).forEach(function(id){put(id,'第三者の別垢等の文脈で公開言及',60,'third','https://note.com/'+id)})});
(external||[]).forEach(function(x){try{var u=new URL(x.url),seg=u.pathname.split('/').filter(Boolean)[0]||'';if(seg&&/^[A-Za-z0-9_.-]{3,40}$/.test(seg)){var same=seg.replace(/^@/,'').toLowerCase()===PRESET_TARGET;put(seg,(same?'対象と同じ公開IDの外部リンク':'公開外部リンク上のID')+'｜'+(x.platform||x.host),same?45:20,'external',x.url)}}catch(e){}});
return Array.from(m.values()).sort(function(a,b){return b.score-a.score}).slice(0,20)}

var LIKED_KEY='note-account-audit:liked:v20:koakumako';
async function targetLikedArticles(id,set){
 var state={items:{},pages:0,at:0};
 try{var old=JSON.parse(localStorage.getItem(LIKED_KEY)||'null');if(old&&old.items)state=old}catch(e){}
 var noNew=0;
 for(var pg=1;pg<=50;pg++){
  set('まこの公開スキ履歴 '+Object.keys(state.items).length+'件｜p'+pg);
  try{
   var r=await fetch('/'+encodeURIComponent(id)+'/likes?page='+pg,{credentials:'include',cache:'no-store'});
   if(!r.ok)break;
   var h=await r.text(),norm=h.replace(/\\u002F/g,'/').replace(/\\\//g,'/'),d=new DOMParser().parseFromString(norm,'text/html'),before=Object.keys(state.items).length;
   var root=d.querySelector('main')||d;
   root.querySelectorAll('a[href]').forEach(function(el){
    var u=el.getAttribute('href')||'',x=artUrl(new URL(u,'https://note.com').href);
    if(x&&x.creator&&x.creator!==id){
     state.items[x.key]={key:x.key,creator:x.creator,url:x.url,title:c(el.textContent)||x.key};
    }
   });
   var re=/https?:\/\/note\.com\/([A-Za-z0-9_-]+)\/n\/(n[A-Za-z0-9]+)/g,m;
   while((m=re.exec(norm))){
    var cr=c(m[1]).toLowerCase(),k=c(m[2]);if(cr&&k&&cr!==id)state.items[k]=state.items[k]||{key:k,creator:cr,url:'https://note.com/'+cr+'/n/'+k,title:k};
   }
   state.pages=pg;state.at=Date.now();localStorage.setItem(LIKED_KEY,JSON.stringify(state));
   var after=Object.keys(state.items).length;if(after===before)noNew++;else noNew=0;
   if(noNew>=2)break;
   await wait(80);
  }catch(e){break}
 }
 return{items:Object.values(state.items),pages:state.pages,at:state.at};
}
function analyzeLikeGraph(outgoing,followers,candidates){
 var fs=new Set(followers.map(function(x){return x.id})),incoming=new Map,cmap=new Map;
 candidates.forEach(function(x){if(x.likes>0)incoming.set(x.id,x.likes)});
 outgoing.forEach(function(x){var q=cmap.get(x.creator)||{id:x.creator,count:0,follower:fs.has(x.creator),incoming:incoming.get(x.creator)||0};q.count++;cmap.set(x.creator,q)});
 var creators=Array.from(cmap.values()).sort(function(a,b){return b.count-a.count}),fArts=outgoing.filter(function(x){return fs.has(x.creator)}).length,fCreators=creators.filter(function(x){return x.follower}),mutual=creators.filter(function(x){return x.incoming>0});
 return{articles:outgoing.length,creators:creators.length,followerArticles:fArts,followerCreators:fCreators.length,mutualCreators:mutual.length,incomingCreators:incoming.size,top:creators.slice(0,30),mutual:mutual.slice(0,30)};
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
 var e=document.getElementById('naa-result'),pc=r.publicCandidates||[],network=r.network||{scanned:0,total:0,hubs:[]},market=r.market||{score:0,label:'未計算',reasons:[]},lg=r.likeGraph||{articles:0,creators:0,followerArticles:0,followerCreators:0,mutualCreators:0,incomingCreators:0,top:[],mutual:[]},pat=r.pattern||{checked:0,strong:0,mid:0,rows:[]},ml=marketLinks(),external=r.external||[],top=r.candidates.slice(0,30),direct=r.direct,third=r.third;
 function card(t,v,s){return'<div class="naa-card"><small>'+esc(t)+'</small><b>'+esc(v)+'</b><span>'+esc(s||'')+'</span></div>'}
 function rows(xs,fn,empty){return xs&&xs.length?xs.map(fn).join(''):'<div class="naa-empty">'+esc(empty||'該当なし')+'</div>'}
 e.innerHTML=
 '<div class="naa-cards">'+
 card('公開根拠候補',pc.length+'件',pc.length?'最上位を候補タブへ':'明示根拠なし')+
 card('まこ→スキ',lg.articles+'件',lg.creators+'人へ')+
 card('フォロワーへスキ',lg.followerArticles+'件',lg.followerCreators+'人')+
 card('相互スキ',lg.mutualCreators+'人','双方の公開スキ')+
 card('全員概要',String(network.profiled||network.scanned)+'/'+network.total,'深掘り '+network.scanned+'/'+network.total)+
 card('販売型一致',market.score+'/100',market.label)+
 '</div>'+
 '<div class="naa-tabs">'+
 '<button data-tab="answer" class="on">答え</button><button data-tab="likes">スキ</button><button data-tab="net">関係網</button><button data-tab="market">購入検証</button><button data-tab="ext">外部</button>'+
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
 '<div class="naa-mini">取得できた公開スキ記事 <b>'+lg.articles+'</b>件 ／ 相手 <b>'+lg.creators+'</b>人 ／ フォロワー相手 <b>'+lg.followerCreators+'</b>人 ／ 相互スキ <b>'+lg.mutualCreators+'</b>人</div>'+
 '<h4>スキ先 上位</h4>'+
 rows(lg.top.slice(0,20),function(x){return'<div class="naa-compact"><span><b>@'+esc(x.id)+'</b><small>まこ→ '+x.count+'件'+(x.follower?'｜フォロワー':'')+(x.incoming?'｜相手→まこ記事 '+x.incoming+'件':'')+'</small></span><a target="_blank" href="https://note.com/'+encodeURIComponent(x.id)+'">開く</a></div>'},'公開スキ履歴を取得できていません')+
 '<details><summary>相互スキだけ表示（'+lg.mutualCreators+'人）</summary>'+rows(lg.mutual,function(x){return'<div class="naa-compact"><span><b>@'+esc(x.id)+'</b><small>まこ→ '+x.count+'件 ／ 相手→まこ '+x.incoming+'件'+(x.follower?' ／ フォロワー':'')+'</small></span></div>'},'相互スキなし')+'</details>'+
 '</section>'+
 '<section class="naa-pane" data-pane="net">'+
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

var NAA_AUTO={running:false,timer:null,cycles:0,lastDelay:0};
function autoSchedule(ms,reason){
 if(NAA_AUTO.timer)clearTimeout(NAA_AUTO.timer);
 NAA_AUTO.lastDelay=ms;
 var sec=Math.max(1,Math.round(ms/1000));
 status('⏳ 自動待機 '+sec+'秒'+(reason?'｜'+reason:''));
 NAA_AUTO.timer=setTimeout(function(){NAA_AUTO.timer=null;void run()},ms);
}
async function run(){if(NAA_AUTO.running)return;NAA_AUTO.running=true;NAA_AUTO.cycles++;try{var id=PRESET_TARGET;var extra=PRESET_ARTS.map(artUrl).filter(Boolean);status('プロフィール取得中…');var p=await profile(id);status('記事取得中…');var arts=await articles(id,extra),m=new Map,all=[],external=rawExternal(p.raw).map(function(x){return Object.assign({source:'プロフィール公開情報'},x)}).concat(urlsInText(p.bio).map(function(x){return Object.assign({source:'プロフィール本文'},x)}));for(var i=0;i<arts.length;i++){var art=arts[i];status('外部リンク '+(i+1)+'/'+arts.length+'｜'+art.title);try{external=external.concat(await articleExternal(art))}catch(e){}status('コメント '+(i+1)+'/'+arts.length+'｜'+art.title);try{var cs=await comments(art.key);cs.forEach(function(x){x.art=art.key;all.push(x);if(x.id&&x.id!==id)add(m,{id:x.id,name:x.name,image:x.image},x.parent?'reply':'comment',art.key,x.body)})}catch(e){}status('スキ '+(i+1)+'/'+arts.length+'｜'+art.title);try{var ls=await likers(art.key);ls.forEach(function(x){if(x.id!==id)add(m,x,'like',art.key,'')})}catch(e){}await wait(35)}status('フォロー関係取得中…');var rr=await Promise.all([rel(p,'followers'),rel(p,'followings')]),followers=rr[0],followings=rr[1];followers.forEach(function(x){if(x.id!==id)add(m,x,'follower','','')});followings.forEach(function(x){if(x.id!==id)add(m,x,'following','','')});status('まこの公開スキ履歴を確認中…');var liked=await targetLikedArticles(id,status);status('フォロワー関係網を確認中…');var network=await followerNetwork(followers,followings,status);status('フォロワー構成集計中…');var q=network.quality||{sample:0,low:0,empty:0,mass:0},g=snap(id,p.followers),an=anomaly(q,g),direct=[],third=[];all.forEach(function(x){urlsInText(x.body).forEach(function(u){external.push(Object.assign({source:'コメント:'+x.art},u))});var hits=P.filter(function(z){return x.body.indexOf(z)>=0});if(hits.length){var z={id:x.id,name:x.name,body:x.body,hits:hits,art:x.art};if(x.id===id)direct.push(z);else third.push(z)}});var candidates=Array.from(m.values()).map(function(x){return Object.assign({},x,{score:score(x),artCount:x.arts.size})}).sort(function(x,y){return y.score-x.score});var likeGraph=analyzeLikeGraph(liked.items,followers,candidates),pattern=await followerPatternSummary(),market=marketMatch(q,g,p,network);if(likeGraph.followerCreators>=5){market.score=Math.min(100,market.score+8);market.reasons.push('まこ→フォロワーへの公開スキ '+likeGraph.followerCreators+'人')}if(likeGraph.mutualCreators>=5){market.score=Math.min(100,market.score+8);market.reasons.push('相互スキ '+likeGraph.mutualCreators+'人')}market.label=market.score>=65?'販売型運用との一致が複数':market.score>=40?'販売型運用と一部一致':market.score>=20?'弱い一致':'一致材料は少ない';external=dedupExternal(external);var pc=publicCandidates(direct,third,external);render({p:p,q:q,g:g,an:an,direct:direct,third:third,candidates:candidates,external:external,searches:searchLinks(p.id,p.name),network:network,market:market,publicCandidates:pc,likeGraph:likeGraph,pattern:pattern});if(network.completed){status('✅ 全自動完了｜まこスキ '+likeGraph.articles+'件｜相互スキ '+likeGraph.mutualCreators+'人｜フォロワー '+network.scanned+'/'+network.total+'人')}else{var d=network.stopped?60000:1200;autoSchedule(d,network.stopped?'アクセス制限回避後に自動再開':'続きから自動再開')}}catch(e){var msg=String(e&&e.message||e);status('⚠ '+msg,1);autoSchedule(/403|429/.test(msg)?60000:15000,'エラー後に自動再開')}finally{NAA_AUTO.running=false}}
function install(){var old=document.getElementById('note-account-audit-v1');if(old)old.remove();var st=document.createElement('style');st.textContent='#note-account-audit-v1{position:fixed;right:8px;bottom:10px;z-index:2147483640;font-family:system-ui;color:#eef7ff}#naa-open{height:42px;padding:0 13px;border:1px solid #5bd8ff;border-radius:999px;background:#07131d;color:#fff;font-weight:900}#naa-panel{display:none;width:min(520px,calc(100vw - 12px));height:min(74vh,680px);overflow:hidden;margin-bottom:6px;padding:9px;border:1px solid #355b70;border-radius:14px;background:#071019;box-shadow:0 18px 40px #000b}.naa-btn{display:none}.naa-auto{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;padding:7px 9px;border:1px solid #397b62;border-radius:8px;background:#0c2b21}.naa-auto b{font-size:11px}.naa-auto span{font-size:8px;color:#a9cdbd}#naa-status{margin:5px 0;padding:5px 7px;border:1px solid #345;border-radius:7px;background:#0b1821;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#naa-result{height:calc(100% - 86px);overflow:auto;padding-right:2px}.naa-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin:5px 0}.naa-card{padding:7px;border:1px solid #29495c;border-radius:9px;background:#0b1720}.naa-card small,.naa-card span{display:block;color:#98afbc;font-size:8px}.naa-card b{display:block;font-size:15px;line-height:1.2;margin:2px 0}.naa-tabs{position:sticky;top:0;z-index:3;display:grid;grid-template-columns:repeat(5,1fr);gap:3px;padding:5px 0;background:#071019}.naa-tabs button{height:31px;border:1px solid #29495c;border-radius:7px;background:#0b1720;color:#a8bdc9;font-size:9px;font-weight:800}.naa-tabs button.on{background:#0b5178;color:#fff;border-color:#52d6ff}.naa-pane{display:none}.naa-pane.on{display:block}.naa-pane h3{font-size:12px;margin:9px 0 4px;border-top:1px solid #233b49;padding-top:7px}.naa-pane h4{font-size:10px;margin:8px 0 3px}.naa-note,.naa-mini,.naa-ev,.naa-empty{padding:6px;border:1px solid #29404e;border-radius:7px;background:#0a151d;font-size:9px;line-height:1.45}.naa-mini b{font-size:12px}.naa-compact{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;padding:6px 7px;border-bottom:1px solid #1f3440}.naa-compact b{font-size:10px}.naa-compact small{display:block;color:#93aab7;font-size:8px;line-height:1.35}.naa-compact a{color:#7ce2ff;font-size:9px;text-decoration:none}.naa-score{display:flex;align-items:end;gap:8px;padding:7px;border:1px solid #36566a;border-radius:8px;background:#0b1821}.naa-score b{font-size:22px}.naa-score span{font-size:10px;padding-bottom:3px}details{margin-top:6px;border:1px solid #243b49;border-radius:8px;padding:5px}summary{font-size:9px;font-weight:800;cursor:pointer}';document.head.appendChild(st);var r=document.createElement('div');r.id='note-account-audit-v1';var cur=(location.pathname.split('/').filter(Boolean)[0]||'');r.innerHTML='<div id="naa-panel"><b>🔎 こあく まこ 検証ダッシュボード v2.4</b><div class="naa-ev"><b>対象 @'+esc(PRESET_TARGET)+'</b><br>スキ・フォロワー網・購入型・外部リンクを横断検証。</div><div class="naa-auto"><b>⚡ 全自動</b><span>完了まで自動継続・制限時も自動再開</span></div><div id="naa-status">自動開始待ち</div><small>公開根拠と異常指標を分けて表示。</small><div id="naa-result"></div></div><button id="naa-open" >🔎 こあく まこ調査</button>';document.body.appendChild(r);document.getElementById('naa-open').onclick=function(){var p=document.getElementById('naa-panel');p.style.display=p.style.display==='block'?'none':'block'};var p=document.getElementById('naa-panel');p.style.display='block';setTimeout(function(){void run()},650)}
if(document.body)install();else addEventListener('DOMContentLoaded',install,{once:true});
})();