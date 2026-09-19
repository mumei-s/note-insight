// ==UserScript==
// @name note こあく まこ調査 v1.8
// @namespace https://github.com/mumei-s/note-insight
// @version 1.8.0
// @description 公開コメント・返信・スキ・フォロー関係とフォロワー構成を確認。本人同定は公開明示だけを根拠にします。
// @match https://note.com/*
// @updateURL https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-account-audit-v18.user.js
// @downloadURL https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-account-audit-v18.user.js
// @grant none
// @run-at document-idle
// ==/UserScript==
(function(){
'use strict';if(window.__noteAccountAuditV1)return;window.__noteAccountAuditV1=1;
var P=['本垢','本アカ','メイン垢','メインアカ','サブ垢','サブアカ','別垢','別アカ','前垢','旧垢','前のアカウント','以前のアカウント','アカウント作り直','転生','複垢'];
var SNAP='note-account-audit:snapshots',NET='note-account-audit:all-followers:v18:koakumako',last=null;
var PRESET_TARGET='koakumako',AUTO_KEY='note-account-audit:auto:koakumako:v180';
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
async function likers(key){var m=new Map;for(var pg=1;pg<=3&&m.size<250;pg++){var j=await api('/api/v3/notes/'+encodeURIComponent(key)+'/likes?page='+pg+'&per_page=100'),d=j.data||j,ls=Array.isArray(d)?d:a(d.likes||d.users||d.contents||d.likers);ls.forEach(function(x){var id=uid(x);if(id&&!m.has(id))m.set(id,{id:id,name:uname(x),image:img(x)})});if(ls.length<100)break;await wait(20)}return Array.from(m.values())}
function rp(x,rank){var u=o(x.user||x.follower||x.following||x.creator||x),id=c(u.urlname||x.urlname).toLowerCase();return id?{id:id,name:c(u.nickname||u.name||id),image:img(u),rank:rank}:null}
async function rel(p,dir){if(!p.key)return[];var m=new Map;for(var pg=1;pg<=50&&m.size<1000;pg++){var j=await api('/api/v3/users/'+encodeURIComponent(p.key)+'/'+dir+'?page='+pg+'&per=20'),d=o(j.data||j),ls=a(d.follows||d.followers||d.followings||d.users||d.contents);ls.forEach(function(x,i){var q=rp(x,(pg-1)*20+i+1);if(q&&!m.has(q.id))m.set(q.id,q)});if(!ls.length||ls.length<20)break;await wait(20)}return Array.from(m.values()).slice(0,1000)}
async function relLimited(p,dir,maxPages){if(!p.key)return[];var m=new Map;for(var pg=1;pg<=maxPages;pg++){var j=await api('/api/v3/users/'+encodeURIComponent(p.key)+'/'+dir+'?page='+pg+'&per=20'),d=o(j.data||j),ls=a(d.follows||d.followers||d.followings||d.users||d.contents);ls.forEach(function(x,i){var q=rp(x,(pg-1)*20+i+1);if(q&&!m.has(q.id))m.set(q.id,q)});if(!ls.length||ls.length<20)break;await wait(120)}return Array.from(m.values())}
async function followerNetwork(followers,targetFollowings,set){
var all=followers.slice(),tf=new Set(targetFollowings.map(function(x){return x.id})),state={v:18,people:{},hubs:{},total:all.length,completed:false};
try{var old=JSON.parse(localStorage.getItem(NET)||'null');if(old&&old.v===18&&old.people&&old.hubs)state=old}catch(e){}
if(state.total!==all.length&&state.completed)state={v:18,people:{},hubs:{},total:all.length,completed:false};
state.total=all.length;
function save(){try{localStorage.setItem(NET,JSON.stringify(state))}catch(e){}}
var stopped=false,stopReason='';
for(var i=0;i<all.length&&!stopped;i++){
 var f=all[i],ps=state.people[f.id]||{nextPage:1,done:false,profile:null,read:0};
 if(ps.done)continue;
 set('全フォロワー走査 '+Object.keys(state.people).filter(function(k){return state.people[k].done}).length+'/'+all.length+'｜@'+f.id+'｜フォロー先 p'+ps.nextPage);
 try{
  if(!ps.profile){
   var fp=await profile(f.id);
   ps.profile={notes:fp.notes,bioThin:(!fp.bio||fp.bio.length<4),mass:(fp.followings>=300&&fp.followings>=Math.max(500,fp.followers*10)),followings:fp.followings,followers:fp.followers};
   state.people[f.id]=ps;save();await wait(180);
  }
  while(!ps.done){
   var j=await api('/api/v3/users/'+encodeURIComponent((await profile(f.id)).key)+'/followings?page='+ps.nextPage+'&per=20'),d=o(j.data||j),ls=a(d.follows||d.followers||d.followings||d.users||d.contents);
   ls.forEach(function(x){
    var qx=rp(x,ps.read+1);if(!qx||!qx.id||qx.id===PRESET_TARGET)return;
    var q=state.hubs[qx.id]||{id:qx.id,name:qx.name||qx.id,image:qx.image||'',count:0,followers:[],targetFollows:false};
    q.count++;if(q.followers.length<12)q.followers.push(f.id);q.targetFollows=tf.has(qx.id);state.hubs[qx.id]=q;
   });
   ps.read+=ls.length;ps.nextPage++;
   if(!ls.length||ls.length<20)ps.done=true;
   state.people[f.id]=ps;save();
   set('全フォロワー走査 '+Object.keys(state.people).filter(function(k){return state.people[k].done}).length+'/'+all.length+'｜@'+f.id+'｜フォロー先 '+ps.read+'件');
   if(!ps.done)await wait(220);
  }
 }catch(e){
  var msg=String(e&&e.message||e);state.people[f.id]=ps;save();
  if(/403|429/.test(msg)){stopped=true;stopReason=msg}else{ps.error=msg;ps.done=true;state.people[f.id]=ps;save()}
 }
 await wait(260);
}
var ids=new Set(all.map(function(x){return x.id})),entries=Object.keys(state.people).filter(function(id){return ids.has(id)}).map(function(id){return state.people[id]}),doneRows=entries.filter(function(x){return x.done&&!x.error}),profRows=entries.filter(function(x){return x.profile}).map(function(x){return x.profile});
var known=profRows.filter(function(x){return x.notes>=0}),low=known.filter(function(x){return x.notes<=1}).length,empty=profRows.filter(function(x){return x.bioThin}).length,mass=profRows.filter(function(x){return x.mass}).length;
var scanned=doneRows.length,started=entries.length;
if(!stopped&&scanned>=all.length){state.completed=true;save()}
var hubs=Object.keys(state.hubs).map(function(k){return state.hubs[k]}).filter(function(x){return x.count>=2}).sort(function(a,b){return b.count-a.count}).slice(0,200);
return{sample:all.length,scanned:scanned,started:started,total:all.length,completed:state.completed,stopped:stopped,stopReason:stopReason,hubs:hubs,quality:{sample:profRows.length,low:pct(low,known.length),empty:pct(empty,profRows.length),mass:pct(mass,profRows.length)}}
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
function status(t,b){var e=document.getElementById('naa-status');if(e){e.textContent=t;e.style.borderColor=b?'#a44':'#345'}}
function render(r){last=r;var e=document.getElementById('naa-result'),top=r.candidates.slice(0,25),direct=r.direct,third=r.third,external=r.external||[],searches=r.searches||[],network=r.network||{sample:0,scanned:0,hubs:[]},market=r.market||{score:0,label:'未計算',reasons:[]},pc=r.publicCandidates||[];
e.innerHTML='<h3>対象</h3><div class="naa-grid"><b>@'+esc(r.p.id)+'</b><b>フォロワー '+r.p.followers+'</b><b>フォロー '+r.p.followings+'</b></div>'
+'<h3>🎯 公開根拠から確認する候補</h3><small>本人発言・第三者の名指し・公開リンク・同一公開IDを優先。文体や時間帯だけでは候補化しません。</small>'
+(pc.length?pc.map(function(x){return'<div class="naa-row"><span><b>@'+esc(x.id)+'</b><small>公開根拠 '+x.score+'｜'+esc(x.reasons.join(' / '))+'</small></span><a target="_blank" href="'+esc(x.urls[0]||('https://note.com/'+x.id))+'">確認</a></div>'}).join(''):'<div class="naa-ev"><b>公開根拠つき候補はまだ0件</b><br>関係網・コメント・外部リンクは下で確認できます。</div>')
+'<h3>本人の別垢等の明示</h3>'+(direct.length?direct.map(function(x){return'<div class="naa-ev"><b>'+esc(x.hits.join(' / '))+'</b><br>'+esc(x.body)+'</div>'}).join(''):'<small>今回の公開コメント内では未確認</small>')
+'<h3>フォロワー全員の共通フォロー先</h3><div class="naa-ev"><b>走査 '+network.scanned+'/'+network.total+'人'+(network.completed?'｜全員完了':'｜途中保存済み')+'</b>'+(network.stopped?'<br>制限検知で停止：次回続きから再開':'')+'</div><small>取得できる公開フォロワーを全員対象。各フォロワーの公開フォロー先もページが尽きるまで全件確認し、途中ページを保存しながら共通先を集計します。</small>'
+(network.hubs.length?network.hubs.map(function(x){return'<div class="naa-row">'+(x.image?'<img src="'+esc(x.image)+'">':'')+'<span><b>'+esc(x.name)+' @'+esc(x.id)+'</b><small>共通 '+x.count+'/'+network.scanned+'人'+(x.targetFollows?'｜本人もフォロー':'')+'｜例 '+esc(x.followers.slice(0,4).join(', '))+'</small></span><a target="_blank" href="https://note.com/'+encodeURIComponent(x.id)+'">開く</a></div>'}).join(''):'<small>サンプル内で2人以上の共通フォロー先は未検出</small>')
+'<h3>ココナラ等のフォロワー増加サービス一致度</h3><div class="naa-ev"><b>'+market.score+'/100｜'+esc(market.label)+'</b><br>'+esc(market.reasons.join(' / ')||'一致材料なし')+'<br><small>購入の証明ではなく、公開されている販売型運用の特徴との一致度です。</small></div>'
+'<div class="naa-search"><a target="_blank" rel="noreferrer" href="https://www.google.com/search?q=site%3Acoconala.com+%22'+encodeURIComponent(r.p.id)+'%22">ココナラでID検索</a><a target="_blank" rel="noreferrer" href="https://www.google.com/search?q=site%3Acoconala.com+%22'+encodeURIComponent(r.p.name)+'%22">ココナラで名前検索</a></div>'
+'<h3>フォロワー異常指標</h3><div class="naa-ev"><b>'+r.an.score+'/100｜'+esc(r.an.label)+'</b><br>'+esc(r.an.reasons.join(' / ')||'強い異常要因なし')+'<br>サンプル '+r.q.sample+'人｜投稿0〜1件 '+r.q.low+'%｜大量フォロー型 '+r.q.mass+'%｜プロフィール薄め '+r.q.empty+'%</div>'
+'<h3>外部SNS・サイト</h3>'+(external.length?external.map(function(x){return'<div class="naa-row"><span><b>'+esc(x.platform)+'｜'+esc(x.host)+'</b><small>'+esc(x.source||'公開リンク')+'</small></span><a target="_blank" rel="noreferrer" href="'+esc(x.url)+'">開く</a></div>'}).join(''):'<small>noteから直接つながる外部公開リンクは今回未確認</small>')
+'<div class="naa-search">'+searches.map(function(x){return'<a target="_blank" rel="noreferrer" href="'+esc(x.url)+'">'+esc(x.label)+'</a>'}).join('')+'</div>'
+'<h3>接点が濃い公開アカウント</h3><small>同一人物候補ではなく、公開接点の強さ。</small>'+top.map(function(x){return'<div class="naa-row">'+(x.image?'<img src="'+esc(x.image)+'">':'')+'<span><b>'+esc(x.name)+' @'+esc(x.id)+'</b><small>接点'+x.score+'｜コメ'+x.comments+' 返信'+x.replies+' スキ'+x.likes+'｜'+x.artCount+'記事'+(x.following?'｜本人→相手':'')+(x.follower?'｜相手→本人':'')+'</small></span><a target="_blank" href="https://note.com/'+encodeURIComponent(x.id)+'">開く</a></div>'}).join('')
+'<h3>第三者の別垢等への言及</h3>'+(third.length?third.slice(0,20).map(function(x){return'<div class="naa-ev"><b>'+esc(x.name)+' @'+esc(x.id)+'｜'+esc(x.hits.join(' / '))+'</b><br>'+esc(x.body)+'</div>'}).join(''):'<small>該当なし</small>')}
async function run(){try{var id=PRESET_TARGET;var extra=PRESET_ARTS.map(artUrl).filter(Boolean);status('プロフィール取得中…');var p=await profile(id);status('記事取得中…');var arts=await articles(id,extra),m=new Map,all=[],external=rawExternal(p.raw).map(function(x){return Object.assign({source:'プロフィール公開情報'},x)}).concat(urlsInText(p.bio).map(function(x){return Object.assign({source:'プロフィール本文'},x)}));for(var i=0;i<arts.length;i++){var art=arts[i];status('外部リンク '+(i+1)+'/'+arts.length+'｜'+art.title);try{external=external.concat(await articleExternal(art))}catch(e){}status('コメント '+(i+1)+'/'+arts.length+'｜'+art.title);try{var cs=await comments(art.key);cs.forEach(function(x){x.art=art.key;all.push(x);if(x.id&&x.id!==id)add(m,{id:x.id,name:x.name,image:x.image},x.parent?'reply':'comment',art.key,x.body)})}catch(e){}status('スキ '+(i+1)+'/'+arts.length+'｜'+art.title);try{var ls=await likers(art.key);ls.forEach(function(x){if(x.id!==id)add(m,x,'like',art.key,'')})}catch(e){}await wait(35)}status('フォロー関係取得中…');var rr=await Promise.all([rel(p,'followers'),rel(p,'followings')]),followers=rr[0],followings=rr[1];followers.forEach(function(x){if(x.id!==id)add(m,x,'follower','','')});followings.forEach(function(x){if(x.id!==id)add(m,x,'following','','')});status('フォロワー関係網を確認中…');var network=await followerNetwork(followers,followings,status);status('フォロワー構成集計中…');var q=network.quality||{sample:0,low:0,empty:0,mass:0},g=snap(id,p.followers),an=anomaly(q,g),direct=[],third=[];all.forEach(function(x){urlsInText(x.body).forEach(function(u){external.push(Object.assign({source:'コメント:'+x.art},u))});var hits=P.filter(function(z){return x.body.indexOf(z)>=0});if(hits.length){var z={id:x.id,name:x.name,body:x.body,hits:hits,art:x.art};if(x.id===id)direct.push(z);else third.push(z)}});var candidates=Array.from(m.values()).map(function(x){return Object.assign({},x,{score:score(x),artCount:x.arts.size})}).sort(function(x,y){return y.score-x.score});var market=marketMatch(q,g,p,network);external=dedupExternal(external);var pc=publicCandidates(direct,third,external);render({p:p,q:q,g:g,an:an,direct:direct,third:third,candidates:candidates,external:external,searches:searchLinks(p.id,p.name),network:network,market:market,publicCandidates:pc});status('完了｜記事'+arts.length+'・コメント/返信'+all.length+'・公開フォロワー'+followers.length+'・全員走査 '+network.scanned+'/'+network.total+'人'+(network.completed?' 完了':' 保存済み'))}catch(e){status('⚠ '+(e.message||e),1)}}
function install(){if(document.getElementById('note-account-audit-v1'))return;var st=document.createElement('style');st.textContent='#note-account-audit-v1{position:fixed;right:8px;bottom:12px;z-index:2147483640;font-family:system-ui;color:#eef7ff}#naa-open{height:42px;padding:0 14px;border:1px solid #5bd8ff;border-radius:999px;background:#07131d;color:#fff;font-weight:900}#naa-panel{display:none;width:min(460px,calc(100vw - 16px));max-height:80vh;overflow:auto;margin-bottom:7px;padding:10px;border:1px solid #355b70;border-radius:14px;background:#071019;box-shadow:0 18px 40px #000b}.naa-in{box-sizing:border-box;width:100%;margin-top:7px;border:1px solid #567080;border-radius:8px;background:#fff;color:#111;padding:8px;font-weight:800}.naa-ta{min-height:68px}.naa-btn{width:100%;height:42px;margin-top:7px;border:1px solid #45c9ff;border-radius:8px;background:#0b5178;color:#fff;font-weight:900}#naa-status,.naa-ev{margin-top:7px;padding:7px;border:1px solid #345;border-radius:8px;background:#0b1821;font-size:10px;line-height:1.45}#naa-result h3{font-size:12px;border-top:1px solid #28404f;padding-top:8px}.naa-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;font-size:10px}.naa-row{display:grid;grid-template-columns:32px 1fr auto;gap:6px;align-items:center;padding:6px;border:1px solid #2c4352;border-radius:8px;margin-top:4px}.naa-row img{width:32px;height:32px;border-radius:50%;object-fit:cover}.naa-row small{display:block;color:#9bb0bd;font-size:8px}.naa-row a{color:#78dcff;font-size:9px}.naa-search{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.naa-search a{padding:5px 7px;border:1px solid #31566c;border-radius:999px;color:#8de5ff;text-decoration:none;font-size:9px}';document.head.appendChild(st);var r=document.createElement('div');r.id='note-account-audit-v1';var cur=(location.pathname.split('/').filter(Boolean)[0]||'');r.innerHTML='<div id="naa-panel"><b>🔎 こあく まこ 公開関係・SNS監査 v1.8</b><div class="naa-ev"><b>対象 @'+esc(PRESET_TARGET)+'</b><br>登録済み12記事＋公開プロフィール＋コメント/返信＋スキ＋公開フォロワー全員＋各フォロワーの公開フォロー先全件＋外部SNSを自動調査します。</div><button id="naa-run" class="naa-btn">🔄 こあく まこを再調査</button><div id="naa-status">待機中</div><small>同一人物と扱うのは本人自身の公開明示がある場合だけ。異常指標は外部購入の証拠ではありません。</small><div id="naa-result"></div></div><button id="naa-open" >🔎 こあく まこ調査</button>';document.body.appendChild(r);document.getElementById('naa-open').onclick=function(){var p=document.getElementById('naa-panel');p.style.display=p.style.display==='block'?'none':'block'};document.getElementById('naa-run').onclick=run;if(sessionStorage.getItem(AUTO_KEY)!=='1'){sessionStorage.setItem(AUTO_KEY,'1');var p=document.getElementById('naa-panel');p.style.display='block';setTimeout(function(){void run()},650)}}
if(document.body)install();else addEventListener('DOMContentLoaded',install,{once:true});
})();