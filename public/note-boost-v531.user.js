// ==UserScript==
// @name         note 巡回BOOST｜独立版 v5.3.1
// @namespace    https://github.com/mumei-s/note-insight
// @version      5.3.1
// @description  記事URL・マガジンURL・#からクリエイター巡回。安全なスキ判定、途中復元、カード式マガジン追加、24h上限、403/429保護を1本に統合。旧BOOST UIは停止・非表示。
// @match        https://note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-boost-v531.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-boost-v531.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
'use strict';
if (window.__NOTE_BOOST_V531__) return;
window.__NOTE_BOOST_V531__ = true;

const VER='5.3.1', K='note巡回BOOST_v531';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(`${K}:${k}`))??fb}catch{return fb}};
const save=(k,v)=>{try{localStorage.setItem(`${K}:${k}`,JSON.stringify(v))}catch{}};
const now=()=>Date.now();
const clamp=(v,fb,max)=>Math.max(1,Math.min(max,Number(v)||fb));
const fmtWait=ms=>{const m=Math.max(0,Math.ceil(ms/60000));return m<60?`${m}分`:`${Math.floor(m/60)}時間${m%60}分`};
const fmtClock=t=>new Date(t).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
const cfg=()=>Object.assign({count:100,likeCap:80,magCap:200},load('cfg',{}));
let account=null, queue=load('queue',[]), index=load('index',0), busy=false, magModal=null, timer=0;

function hideLegacy(){
  let st=$('#nb531-legacy-hide');
  if(!st){st=document.createElement('style');st.id='nb531-legacy-hide';st.textContent='#nb52-open,#nb52-panel,#note巡回boost-v4,#nb-v46{display:none!important}';document.documentElement.appendChild(st)}
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(/autoMagAutoResumeV(47|51|52)$/.test(k))localStorage.setItem(k,'false')}}catch{}
}

async function api(url,init={}){
  const r=await fetch(url,Object.assign({credentials:'include',headers:Object.assign({accept:'application/json'},init.headers||{})},init));
  const text=await r.text();let json={};try{json=text?JSON.parse(text):{}}catch{}
  if(!r.ok){const e=new Error(`${r.status} ${r.statusText}`);e.status=r.status;e.body=text.slice(0,800);const ra=r.headers.get('retry-after');e.retryAfter=ra?(/^\d+$/.test(ra)?Number(ra)*1000:Math.max(0,Date.parse(ra)-Date.now())):0;throw e}
  return json;
}
function parseUserObj(j){const d=j?.data??j??{},u=d.user||d;const id=String(u.urlname||u.url_name||u.username||'').replace(/^@/,'').toLowerCase();return id?{id,name:String(u.nickname||u.name||id)}:null}
function domAccount(){
  const bad=new Set(['notifications','settings','search','login','signup','membership','memberships','messages','magazines','likes']);
  const anchors=[...document.querySelectorAll('header a[href],nav a[href]')];
  for(const a of anchors){const img=a.querySelector('img');if(!img)continue;try{const u=new URL(a.href,location.href),p=u.pathname.split('/').filter(Boolean);if(p.length===1&&!bad.has(p[0]))return{id:p[0].toLowerCase(),name:p[0]}}catch{}}
  return null;
}
async function who(){
  try{const x=parseUserObj(await api('/api/v2/current_user'));if(x){save('lastAccount',x);return x}}catch{}
  const d=domAccount();if(d){save('lastAccount',d);return d}
  const last=load('lastAccount',null);if(last?.id)return last;
  throw new Error('noteログイン中アカウントを取得できません');
}
function stopLegacyJobs(id){
  const oldK='note巡回BOOST_v4';
  for(const name of ['autoMagJobV46','autoMagJobV52']){const key=`${oldK}:acct:${id}:${name}`;try{const j=JSON.parse(localStorage.getItem(key)||'null');if(j&&!j.complete){localStorage.setItem(`${key}:backup-v531`,JSON.stringify(j));j.complete=true;j.last='v5.3.1移行により旧自動ジョブ停止';localStorage.setItem(key,JSON.stringify(j))}}catch{}}
}
function history(name){const cut=now()-48*3600e3,a=load(`hist:${name}`,[]);return Array.isArray(a)?a.filter(x=>x&&x.t>=cut):[]}
function pushHist(name,data){const a=history(name);a.push({t:now(),...data});save(`hist:${name}`,a.slice(-2000))}
function used(name){return history(name).filter(x=>now()-x.t<86400e3).length}
function nextRelease(name,cap){const a=history(name).filter(x=>now()-x.t<86400e3).sort((x,y)=>x.t-y.t);return a.length<cap?0:a[0].t+86400e3}
function guard(kind){return load(`guard:${kind}`,{until:0,strikes:[],reason:''})}
function setGuard(kind,g){save(`guard:${kind}`,g)}
function clearGuardStrikes(kind){const g=guard(kind);g.strikes=[];if(g.until<=now()){g.until=0;g.reason=''}setGuard(kind,g)}
function strike403(kind,key){const g=guard(kind),t=now();const a=(g.strikes||[]).filter(x=>t-x.t<120000&&x.key!==key);a.push({t,key});const u=[...new Map(a.map(x=>[x.key,x])).values()];if(u.length>=3){g.until=t+30*60*1000;g.reason='403が異なる対象で3回続いたため30分保護休止';g.strikes=[]}else{g.strikes=u;g.reason=''}setGuard(kind,g);return{cool:g.until>t,count:u.length,wait:Math.max(0,g.until-t)}}
function strike429(kind,retry){const g=guard(kind),wait=Math.max(60000,Number(retry)||15*60*1000);g.until=now()+wait;g.reason='429保護休止';g.strikes=[];setGuard(kind,g);return wait}

function setStatus(s,bad=false){const e=$('#nb531-status');if(e){e.textContent=s;e.dataset.bad=bad?'1':'0'}}
function saveState(){save('queue',queue);save('index',index);render()}
function results(){return load('results',{})}
function putResult(item,state){const r=results();r[item.key]={state,urlname:item.urlname,title:item.title||item.key,t:now()};save('results',r);item.likeState=state;item.likeDoneAt=now();saveState()}
function applyKnown(q){const r=results();return q.map(x=>r[x.key]?Object.assign(x,{likeState:r[x.key].state,likeDoneAt:r[x.key].t}):x)}
function keyOf(n){return String(n?.key||n?.note_key||n?.noteKey||n?.slug||'')}
function userOf(n){return n?.user||n?.creator||n?.note_user||{}}
function thumbOf(n){for(const x of [n?.eyecatch,n?.eyecatch_image,n?.eyecatchImage,n?.image,n?.image_url,n?.thumbnail,n?.thumbnail_url,n?.eyecatch?.url,n?.image?.url,n?.thumbnail?.url])if(typeof x==='string'&&/^https?:\/\//.test(x))return x;return''}
function noteUrl(item){return `https://note.com/${encodeURIComponent(item.urlname)}/n/${encodeURIComponent(item.key)}`}
function parseSource(raw){
  const s=String(raw||'').trim();
  if(s.startsWith('#')||(!/^https?:/i.test(s)&&s))return{type:'tag',tags:[...new Set(s.split(/[\s,、]+/).map(x=>x.replace(/^#+/,'')).filter(Boolean))]};
  try{const u=new URL(s);if(u.hostname!=='note.com')return null;const p=u.pathname.split('/').filter(Boolean),ni=p.indexOf('n'),mi=p.indexOf('m');if(ni>=1&&p[ni+1])return{type:'note',creator:p[ni-1],key:p[ni+1],url:u.href};if(mi>=1&&p[mi+1])return{type:'mag',creator:p[mi-1],key:p[mi+1],url:u.href}}catch{}
  return null;
}
async function latestForCreator(id,matched){
  try{const j=await api(`/api/v2/creators/${encodeURIComponent(id)}/contents?kind=note&page=1`),d=j?.data??j??{},a=Array.isArray(d.contents)?d.contents:(Array.isArray(d)?d:[]),n=a.find(x=>keyOf(x));if(!n)return null;const u=userOf(n);return{key:keyOf(n),id:n.id??n.note_id??null,urlname:id,name:String(u.nickname||u.name||id),title:String(n.name||n.title||keyOf(n)),thumb:thumbOf(n),source:matched}}catch{return null}}
async function mapLimit(items,lim,fn){const out=new Array(items.length);let i=0;async function w(){for(;;){const n=i++;if(n>=items.length)return;try{out[n]=await fn(items[n],n)}catch{out[n]=null}}}await Promise.all(Array.from({length:Math.min(lim,items.length)},w));return out}
function normalizeLikeUsers(j){const d=j?.data??j??{},a=Array.isArray(d)?d:(d.likes||d.users||d.contents||d.likers||[]);return(Array.isArray(a)?a:[]).map(x=>x?.user||x?.creator||x).filter(Boolean)}
async function sourceFromArticle(p,max){
  const users=new Map();for(let page=1;users.size<max&&page<=Math.ceil(max/100)+2;page++){setStatus(`❤️ スキした人を取得中 ${users.size}/${max}`);const j=await api(`/api/v3/notes/${encodeURIComponent(p.key)}/likes?page=${page}&per_page=100`),a=normalizeLikeUsers(j);for(const u of a){const id=String(u.urlname||u.url_name||u.username||'').replace(/^@/,'').toLowerCase();if(id&&id!==account.id&&!users.has(id))users.set(id,u);if(users.size>=max)break}if(a.length<100)break}
  const ids=[...users.keys()].slice(0,max);setStatus(`👤 ${ids.length}人の記事を準備中…`);return(await mapLimit(ids,5,id=>latestForCreator(id,'記事URLのスキ'))).filter(Boolean)
}
async function sourceFromMagazine(p,max){
  const items=[],creators=new Set(),seen=new Set();for(let page=1;page<=40&&items.length<max;page++){const u=new URL(p.url);u.searchParams.set('page',String(page));setStatus(`📚 マガジンを取得中 ${items.length}/${max}`);const r=await fetch(u.href,{credentials:'include'});if(!r.ok)throw new Error(`マガジン取得 ${r.status}`);const html=await r.text(),d=new DOMParser().parseFromString(html,'text/html'),pageKeys=[];for(const a of d.querySelectorAll('a[href]')){let x;try{x=new URL(a.getAttribute('href'),u)}catch{continue}const pp=x.pathname.split('/').filter(Boolean),ni=pp.indexOf('n');if(ni<1||!pp[ni+1])continue;const creator=pp[ni-1].toLowerCase(),key=pp[ni+1];pageKeys.push(key);if(!creator||creator===account.id||creators.has(creator))continue;creators.add(creator);items.push({key,urlname:creator,name:creator,title:(a.textContent||key).trim().slice(0,120)||key,thumb:'',source:'マガジンURL'});if(items.length>=max)break}const sig=[...new Set(pageKeys)].slice(0,12).join('|');if(!sig||seen.has(sig))break;seen.add(sig)}return items
}
function normalizeSearch(j){const d=j?.data??j??{},n=d.notes||{},a=n.contents||n.notes||d.contents||[];return{arr:Array.isArray(a)?a:[],cursor:d?.cursor?.note??d.note_cursor??n.next_cursor??n.cursor??null,last:n.is_last_page===true||n.isLastPage===true}}
async function sourceFromTags(tags,max){
  const out=[],creators=new Set();for(const tag of tags){let cursor='0',page=0;while(out.length<max&&page<100){page++;setStatus(`🏷 #${tag} 検索 ${out.length}/${max}`);const j=await api(`/api/v3/searches?context=note&q=${encodeURIComponent(tag)}&size=20&start=${encodeURIComponent(cursor)}&sort=new`),s=normalizeSearch(j);if(!s.arr.length)break;for(const n of s.arr){const u=userOf(n),id=String(u.urlname||u.url_name||u.username||'').toLowerCase(),key=keyOf(n);if(!id||id===account.id||!key||creators.has(id))continue;creators.add(id);out.push({key,id:n.id??n.note_id??null,urlname:id,name:String(u.nickname||u.name||id),title:String(n.name||n.title||key),thumb:thumbOf(n),source:`#${tag}`});if(out.length>=max)break}if(s.last||s.cursor==null||String(s.cursor)===String(cursor))break;cursor=String(s.cursor)}if(out.length>=max)break}return out
}
async function startSource(){
  if(busy)return;busy=true;try{account=await who();stopLegacyJobs(account.id);const raw=$('#nb531-source').value.trim(),p=parseSource(raw);if(!p)throw new Error('記事URL / マガジンURL / #タグを入れてください');const max=cfg().count;let q=[];if(p.type==='note')q=await sourceFromArticle(p,max);else if(p.type==='mag')q=await sourceFromMagazine(p,max);else q=await sourceFromTags(p.tags,max);q=[...new Map(q.map(x=>[x.urlname,x])).values()].slice(0,max);if(!q.length)throw new Error('巡回対象が見つかりませんでした');queue=applyKnown(q);index=0;save('source',raw);saveState();setStatus(`✅ ${queue.length}人を巡回リストへ保存`)}catch(e){setStatus(`⚠ ${e.message||e}`,true)}finally{busy=false;render()}}
async function enrich(item){if(item._loaded)return item;try{const [nj,cj]=await Promise.all([api(`/api/v3/notes/${encodeURIComponent(item.key)}`),api(`/api/v2/creators/${encodeURIComponent(item.urlname)}`)]),d=nj?.data??nj??{},n=d.note||d,c=cj?.data??cj??{};item.id=item.id??n.id??n.note_id??null;item.title=String(n.name||n.title||item.title||item.key);item.thumb=thumbOf(n)||item.thumb;item.name=String(c.nickname||c.name||item.name||item.urlname);for(const k of ['isLiked','is_liked','liked','hasLiked'])if(typeof n[k]==='boolean'){item.currentLiked=n[k];break}item._loaded=true;saveState()}catch{}return item}
function render(){
  const panel=$('#nb531-panel');if(!panel)return;const c=cfg(),likeUsed=used('likes'),magUsed=used('mags');$('#nb531-meter').innerHTML=`<span>❤️ <b>${likeUsed}/${c.likeCap}</b></span><span>📚 <b>${magUsed}/${c.magCap}</b></span>`;
  const r=results(),vals=Object.values(r),nowN=vals.filter(x=>x.state==='liked_now').length,preN=vals.filter(x=>x.state==='preexisting').length;$('#nb531-summary').textContent=`✅完了 ${nowN+preN}　❤️今回 ${nowN}　💗最初から ${preN}`;
  $('#nb531-progress').textContent=queue.length?`${Math.min(index+1,queue.length)}/${queue.length}`:'0/0';
  const box=$('#nb531-card');if(!queue.length){box.innerHTML='<div class="nb531-empty">記事URL / マガジンURL / # から巡回を開始</div>';return}if(index>=queue.length){box.innerHTML='<div class="nb531-empty"><b>✅ 巡回完了</b><br>先頭へ戻る場合は「戻る」</div>';return}
  const x=queue[index],state=x.likeState==='preexisting'?'💗 最初から':x.likeState==='liked_now'?'❤️ 今回':'未完了';box.innerHTML=`<div class="nb531-top">${x.thumb?`<img src="${esc(x.thumb)}">`:''}<div><b>${esc(x.name||x.urlname)}</b><small>@${esc(x.urlname)}</small><strong>${esc(state)}</strong></div></div><div class="nb531-title">${esc(x.title||x.key)}</div><div class="nb531-actions"><button id="nb531-like">${x.likeState?'✅ 完了':'♡ スキ'}</button><button id="nb531-prev">←戻る</button><button id="nb531-next">次へ→</button><button id="nb531-mag">📚追加</button></div><a class="nb531-open" href="${noteUrl(x)}" target="_blank" rel="noopener">記事を開く</a>`;
  $('#nb531-prev').onclick=()=>{index=Math.max(0,index-1);saveState();void ensureCurrent()};$('#nb531-next').onclick=()=>{index=Math.min(queue.length,index+1);saveState();void ensureCurrent()};$('#nb531-like').onclick=()=>void safeLike();$('#nb531-mag').onclick=()=>void openMags();
}
async function ensureCurrent(){render();if(index<queue.length){await enrich(queue[index]);render()}}
async function safeLike(){
  if(busy||index>=queue.length)return;busy=true;try{account=account||await who();const item=queue[index],known=results()[item.key];if(known){item.likeState=known.state;setStatus(known.state==='preexisting'?'💗 最初からスキ済み。解除せず次へ':'❤️ 今回スキ済み。二重送信せず次へ');index++;saveState();return void ensureCurrent()}
  const g=guard('like');if(g.until>now())return setStatus(`⏳ ${g.reason}｜${fmtClock(g.until)}頃まで`,true);const c=cfg(),u=used('likes');if(u>=c.likeCap){const t=nextRelease('likes',c.likeCap);return setStatus(`⏳ ❤️24h上限 ${u}/${c.likeCap}｜${fmtClock(t)}頃に1件解除`,true)}
  await enrich(item);let liked=item.currentLiked;if(typeof liked!=='boolean'){try{const j=await api(`/api/v3/notes/${encodeURIComponent(item.key)}`),d=j?.data??j??{},n=d.note||d;for(const k of ['isLiked','is_liked','liked','hasLiked'])if(typeof n[k]==='boolean'){liked=n[k];break}}catch{} }
  if(typeof liked!=='boolean')return setStatus('⚠ スキ済み判定が取れないため送信せず未完了で保持',true);
  if(liked){putResult(item,'preexisting');clearGuardStrikes('like');setStatus('💗 最初からスキ済み｜何も送らず完了');index++;saveState();return void ensureCurrent()}
  try{await api(`/api/v3/notes/${encodeURIComponent(item.key)}/likes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:'{}'});pushHist('likes',{key:item.key,urlname:item.urlname});putResult(item,'liked_now');clearGuardStrikes('like');setStatus('❤️ 今回スキ完了');index++;saveState();void ensureCurrent()}catch(e){const body=String(e.body||'');if(/already|liked/i.test(body)){putResult(item,'preexisting');setStatus('💗 すでにスキ済み｜解除せず完了');index++;saveState();return void ensureCurrent()}if(e.status===429){const w=strike429('like',e.retryAfter);return setStatus(`⏳ 429｜${fmtWait(w)}休止`,true)}if(e.status===403){const s=strike403('like',item.key);return setStatus(s.cool?`⏳ 403連続｜${fmtWait(s.wait)}休止`:`⚠ 403 ${s.count}/3｜この人は未完了のまま保持`,true)}throw e}
  }catch(e){setStatus(`⚠ ${e.message||e}`,true)}finally{busy=false;render()}}
async function editableMags(item){const [mj,nj]=await Promise.all([api(`/api/v1/my/magazines?includes_editable=true&note_key=${encodeURIComponent(item.key)}`),api(`/api/v3/notes/${encodeURIComponent(item.key)}`)]),a=mj?.data?.magazines||mj?.magazines||[],d=nj?.data??nj??{},n=d.note||d,bel=new Set(d.belonging_magazine_keys||n.belonging_magazine_keys||nj?.belonging_magazine_keys||[]);return(Array.isArray(a)?a:[]).map(m=>({key:String(m.key||''),name:String(m.name||''),price:Number(m.price)||0,count:Number(m.note_count??m.noteCount)||0,added:!!(m.is_added||m.isAdded||bel.has(String(m.key||'')))})).filter(x=>x.key)}
function closeMags(){magModal?.remove();magModal=null}
async function openMags(){
  if(index>=queue.length)return;try{account=account||await who();const item=queue[index];setStatus('📚 マガジン一覧取得中…');const mags=await editableMags(item);closeMags();magModal=document.createElement('div');magModal.id='nb531-modal';magModal.innerHTML=`<div class="nb531-sheet"><div class="nb531-mh"><b>マガジンに追加</b><button id="nb531-mx">×</button></div><small>${esc(item.title||item.key)}</small><input id="nb531-mf" placeholder="マガジン検索"><div id="nb531-ml">${mags.map(m=>`<label data-name="${esc(m.name.toLowerCase())}"><input type="checkbox" value="${esc(m.key)}" ${m.added?'checked disabled':''}><span>${m.price>0?'💴':'📚'} ${esc(m.name)}</span><em>${m.added?'追加済み':`${m.count}記事`}</em></label>`).join('')}</div><button id="nb531-ma">選択したマガジンへ追加</button><div id="nb531-ms">${mags.filter(x=>x.added).length}誌に追加済み</div></div>`;document.body.appendChild(magModal);$('#nb531-mx').onclick=closeMags;magModal.onclick=e=>{if(e.target===magModal)closeMags()};$('#nb531-mf').oninput=e=>{const q=e.target.value.toLowerCase();$$('#nb531-ml label').forEach(x=>x.style.display=!q||x.dataset.name.includes(q)?'grid':'none')};$('#nb531-ma').onclick=()=>void addMags(item,mags)
  }catch(e){setStatus(`⚠ マガジン一覧取得失敗：${e.message||e}`,true)}}
async function addMags(item,mags){
  if(busy)return;const keys=$$('#nb531-ml input:checked:not(:disabled)').map(x=>x.value);if(!keys.length)return $('#nb531-ms').textContent='追加先を選んでください';busy=true;let ok=0,skip=0,fail=0;try{const g=guard('mag');if(g.until>now()){ $('#nb531-ms').textContent=`保護休止中 ${fmtWait(g.until-now())}`;return}const j=await api(`/api/v3/notes/${encodeURIComponent(item.key)}`),d=j?.data??j??{},n=d.note||d,noteId=item.id??n.id??n.note_id??n.noteId??null;if(!noteId)throw new Error('記事ID取得失敗');for(const key of keys){const c=cfg(),u=used('mags');if(u>=c.magCap){const t=nextRelease('mags',c.magCap);$('#nb531-ms').textContent=`📚24h上限 ${u}/${c.magCap}｜${fmtClock(t)}頃解除`;break}try{await api(`/api/v1/our/magazines/${encodeURIComponent(key)}/notes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:JSON.stringify({note_id:noteId,note_key:item.key})});pushHist('mags',{key:item.key,mag:key,urlname:item.urlname});clearGuardStrikes('mag');ok++;const cb=$(`#nb531-ml input[value="${CSS.escape(key)}"]`);if(cb){cb.checked=true;cb.disabled=true;cb.closest('label').querySelector('em').textContent='追加済み'}}catch(e){if(/already/i.test(String(e.body||''))){skip++;continue}if(e.status===429){const w=strike429('mag',e.retryAfter);$('#nb531-ms').textContent=`429｜${fmtWait(w)}休止`;break}if(e.status===403){const s=strike403('mag',`${item.key}|${key}`);fail++;if(s.cool){$('#nb531-ms').textContent=`403連続｜${fmtWait(s.wait)}休止`;break}continue}fail++}}$('#nb531-ms').textContent=`追加 ${ok}｜追加済み ${skip}｜失敗 ${fail}`;render()}catch(e){$('#nb531-ms').textContent=`失敗：${e.message||e}`}finally{busy=false}}
function resetRun(){if(!confirm('現在の巡回リストと位置だけをリセットします。スキ・マガジン追加は取り消しません。'))return;queue=[];index=0;save('queue',[]);save('index',0);setStatus('巡回リストをリセットしました');render()}
function install(){
  hideLegacy();if($('#nb531-open'))return;const style=document.createElement('style');style.id='nb531-style';style.textContent=`#nb531-open{position:fixed;right:8px;bottom:10px;z-index:2147483600;height:38px;padding:0 13px;border:1px solid #40cdf6;border-radius:999px;background:#07131c;color:#fff;font:950 13px system-ui;box-shadow:0 6px 20px #0009}#nb531-panel{display:none;position:fixed;right:8px;bottom:54px;z-index:2147483599;width:min(420px,calc(100vw - 16px));max-height:72vh;overflow:auto;background:#071018;color:#fff;border:2px solid #29bff0;border-radius:14px;padding:8px;box-sizing:border-box;box-shadow:0 12px 32px #000b;font-family:system-ui}#nb531-panel *{box-sizing:border-box}.nb531-head{display:grid;grid-template-columns:1fr auto auto auto;gap:5px;align-items:center}.nb531-head b{font-size:13px}.nb531-head button{height:32px;min-width:34px;border:1px solid #38576a;border-radius:8px;background:#14232d;color:#fff;font-weight:900}#nb531-meter{display:flex;gap:6px}#nb531-meter span,#nb531-progress{padding:5px 8px;border:1px solid #294759;border-radius:999px;background:#0c1d28;font-size:11px}.nb531-source{display:grid;grid-template-columns:1fr auto;gap:5px;margin-top:6px}.nb531-source input{min-width:0;height:40px;border:1px solid #607888;border-radius:9px;background:#fff;color:#111;padding:0 9px;font-weight:800}.nb531-source button{height:40px;border:1px solid #32c8ff;border-radius:9px;background:#096d9b;color:#fff;font-weight:950}#nb531-status,#nb531-summary{margin-top:5px;padding:6px 8px;border:1px solid #294759;border-radius:8px;background:#0b1b25;font-size:11px;font-weight:850;line-height:1.35}#nb531-status[data-bad="1"]{border-color:#a34a4a;background:#2b1010}#nb531-settings{display:none;margin-top:5px;padding:6px;border:1px solid #294759;border-radius:8px;background:#0a151e}#nb531-settings.open{display:grid;gap:5px}#nb531-settings label{display:grid;grid-template-columns:1fr 80px;gap:6px;align-items:center;font-size:11px}#nb531-settings input{width:100%;height:30px}.nb531-card{margin-top:6px;border:1px solid #294759;border-radius:10px;background:#0b151e;padding:8px}.nb531-top{display:flex;gap:8px;align-items:center}.nb531-top img{width:72px;height:48px;object-fit:cover;border-radius:7px}.nb531-top div{display:grid;min-width:0}.nb531-top small{color:#a9c0ce}.nb531-top strong{color:#80ddff;font-size:11px}.nb531-title{margin:7px 0;font-size:13px;font-weight:900;line-height:1.35}.nb531-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.nb531-actions button{min-width:0;height:38px;border:1px solid #39576a;border-radius:8px;background:#14232d;color:#fff;font-weight:900;font-size:11px}.nb531-actions #nb531-like{background:#3c1221;border-color:#b84b70}.nb531-actions #nb531-mag{background:#153421;border-color:#4a9868}.nb531-open{display:block;margin-top:5px;text-align:center;color:#9de4ff;font-size:11px}.nb531-empty{text-align:center;padding:18px 5px;color:#b8cbd5}.nb531-foot{display:grid;grid-template-columns:1fr auto;gap:5px;margin-top:5px}.nb531-foot button{height:32px;border:1px solid #39576a;border-radius:8px;background:#14232d;color:#fff;font-weight:900}#nb531-modal{position:fixed;inset:0;z-index:2147483647;background:#000a;display:flex;align-items:flex-end;justify-content:center}.nb531-sheet{width:min(540px,100%);max-height:82vh;overflow:auto;background:#081118;color:#fff;border:1px solid #496778;border-radius:16px 16px 0 0;padding:9px}.nb531-mh{display:flex;justify-content:space-between;align-items:center}.nb531-mh button{width:36px;height:32px;border:0;border-radius:8px;background:#233744;color:#fff}.nb531-sheet>small{display:block;padding:5px 0;color:#b8cbd5}.nb531-sheet>input{width:100%;height:38px;border-radius:8px;border:1px solid #607888;padding:0 8px}#nb531-ml{display:grid;gap:4px;margin-top:6px}#nb531-ml label{display:grid;grid-template-columns:24px 1fr auto;gap:7px;align-items:center;padding:8px;border:1px solid #2d4656;border-radius:8px;background:#101b24}#nb531-ml input{width:20px;height:20px}#nb531-ml em{font-style:normal;color:#9dc1d2;font-size:10px}#nb531-ma{width:100%;height:42px;margin-top:7px;border:1px solid #55d98e;border-radius:9px;background:#16482e;color:#fff;font-weight:950}#nb531-ms{text-align:center;padding:6px;font-size:11px;color:#d5e8f0}@media(max-width:560px){#nb531-panel{left:8px;right:8px;width:auto;max-height:68vh}.nb531-actions{grid-template-columns:repeat(2,1fr)}}`;
  document.documentElement.appendChild(style);const open=document.createElement('button');open.id='nb531-open';open.textContent='💗 巡回BOOST';const panel=document.createElement('div');panel.id='nb531-panel';panel.innerHTML=`<div class="nb531-head"><b>巡回BOOST ${VER}</b><div id="nb531-meter"></div><button id="nb531-set">⚙</button><button id="nb531-x">×</button></div><div class="nb531-source"><input id="nb531-source" placeholder="記事URL / マガジンURL / #タグ" value="${esc(load('source',''))}"><button id="nb531-start">巡回開始</button></div><div id="nb531-status">待機中</div><div id="nb531-summary"></div><div id="nb531-settings"><label>巡回人数上限<input id="nb531-count" type="number" min="1" max="500" value="${cfg().count}"></label><label>❤️24h上限<input id="nb531-likecap" type="number" min="1" max="5000" value="${cfg().likeCap}"></label><label>📚24h上限<input id="nb531-magcap" type="number" min="1" max="5000" value="${cfg().magCap}"></label></div><div class="nb531-foot"><span id="nb531-progress"></span><button id="nb531-reset">リセット</button></div><div id="nb531-card" class="nb531-card"></div>`;document.body.append(open,panel);const paint=o=>{panel.style.display=o?'block':'none';open.textContent=o?'× 巡回BOOST':'💗 巡回BOOST';save('open',o)};open.onclick=()=>paint(panel.style.display!=='block');$('#nb531-x').onclick=()=>paint(false);$('#nb531-set').onclick=()=>$('#nb531-settings').classList.toggle('open');$('#nb531-start').onclick=()=>void startSource();$('#nb531-reset').onclick=resetRun;for(const [id,k,max] of [['nb531-count','count',500],['nb531-likecap','likeCap',5000],['nb531-magcap','magCap',5000]])$('#'+id).onchange=e=>{const c=cfg();c[k]=clamp(e.target.value,c[k],max);save('cfg',c);render()};paint(load('open',false));render();void ensureCurrent();
}
async function boot(){hideLegacy();install();try{account=await who();stopLegacyJobs(account.id);setStatus(`@${account.id}｜準備完了`)}catch(e){setStatus(`⚠ ${e.message||e}`,true)}render()}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
setInterval(hideLegacy,1500);
if(timer)clearInterval(timer);timer=setInterval(()=>{const g1=guard('like'),g2=guard('mag');if(g1.until>now()||g2.until>now())render()},30000);
})();
