(() => {
'use strict';
if(window.__NOTE_BOOST_V545_UI_SOURCE__)return;
window.__NOTE_BOOST_V545_UI_SOURCE__=true;

const K='note巡回BOOST_v531',VER='5.4.5';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(`${K}:${k}`))??fb}catch{return fb}};
const save=(k,v)=>{try{localStorage.setItem(`${K}:${k}`,JSON.stringify(v))}catch{}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const done=x=>x?.likeState==='preexisting'||x?.likeState==='liked_now';
const cfg=()=>Object.assign({count:50},load('cfg',{}));
const chunk=()=>Math.max(1,Math.min(100,Number(cfg().count)||50));
const q=()=>{const a=load('queue',[]);return Array.isArray(a)?a:[]};
const idx=()=>Math.max(0,Number(load('index',0))||0);
const cur=()=>q()[idx()]||null;
const setStatus=(s,bad=false)=>{const e=$('#nb532-status');if(e){if(e.textContent!==s)e.textContent=s;e.dataset.bad=bad?'1':'0'}};
const nativeFetch=window.fetch.bind(window);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function json(url){const r=await nativeFetch(url,{credentials:'include',headers:{accept:'application/json','cache-control':'no-cache'}});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.json()}
function keyOf(n){return String(n?.key||n?.note_key||n?.noteKey||n?.slug||'')}
function userOf(n){return n?.user||n?.creator||n?.note_user||{}}
function thumbOf(n){for(const x of [n?.eyecatch_url,n?.eyecatch,n?.eyecatch_image,n?.eyecatchImage,n?.image_url,n?.thumbnail_url,n?.image?.url,n?.thumbnail?.url])if(typeof x==='string'&&/^https?:\/\//.test(x))return x;return''}
function applyResults(a){const r=load('results',{});return a.map(x=>r?.[x.key]?Object.assign(x,{likeState:r[x.key].state,likeDoneAt:r[x.key].t}):x)}
function firstIncomplete(a){for(let i=0;i<a.length;i++)if(!done(a[i]))return i;return a.length}
function currentAccount(){return String(load('lastAccount',{})?.id||'').replace(/^@/,'').toLowerCase()}
function normalizeCreator(raw){
  const s=String(raw||'').trim();if(!s||s.startsWith('#'))return null;
  if(/^https?:/i.test(s)){try{const u=new URL(s);if(u.hostname!=='note.com')return null;const p=u.pathname.split('/').filter(Boolean);if(p.length===1&&!['search','notifications','settings','messages','magazines','membership','memberships'].includes(p[0]))return p[0].replace(/^@/,'').toLowerCase();return null}catch{return null}}
  const id=s.replace(/^@/,'').trim();return /^[A-Za-z0-9_.-]+$/.test(id)?id.toLowerCase():null;
}
function likeCount(n){return Number(n?.likeCount??n?.like_count??n?.likes_count??n?.likesCount??0)||0}
function pubTime(n){return Date.parse(n?.publishAt||n?.publish_at||n?.createdAt||n?.created_at||0)||0}
function creatorItem(n,id){const key=keyOf(n);if(!key)return null;const u=userOf(n);return{key,id:n?.id??n?.note_id??n?.noteId??null,urlname:id,name:String(u.nickname||u.name||id),title:String(n?.name||n?.title||key),thumb:thumbOf(n),source:`@${id}｜スキ多い順`,likeCount:likeCount(n),publishAt:n?.publishAt||n?.publish_at||'',url:`https://note.com/${encodeURIComponent(id)}/n/${encodeURIComponent(key)}`}}
async function buildCreatorPool(id){
  const out=[],seen=new Set();
  for(let page=1;page<=200;page++){
    setStatus(`👤 @${id} の記事を取得中 ${out.length}本`);
    const j=await json(`/api/v2/creators/${encodeURIComponent(id)}/contents?kind=note&page=${page}`),d=j?.data??j??{},a=Array.isArray(d.contents)?d.contents:(Array.isArray(d.notes)?d.notes:(Array.isArray(d)?d:[]));
    if(!a.length)break;
    for(const n of a){const x=creatorItem(n,id);if(x&&!seen.has(x.key)){seen.add(x.key);out.push(x)}}
    if(d.isLastPage===true||d.is_last_page===true||a.length===0)break;
    await sleep(120);
  }
  out.sort((a,b)=>(b.likeCount-a.likeCount)||(Date.parse(b.publishAt||0)-Date.parse(a.publishAt||0)));
  return applyResults(out);
}

// クリエイターID / プロフィールURLは、その人の公開記事をスキ数降順で巡回。
document.addEventListener('click',async e=>{
  const b=e.target instanceof Element?e.target.closest('#nb532-start'):null;if(!b)return;
  const input=$('#nb532-source'),raw=String(input?.value||'').trim(),id=normalizeCreator(raw);if(!id)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(b.dataset.v545Busy==='1')return;b.dataset.v545Busy='1';b.disabled=true;
  try{
    save('source',raw);save('queue',[]);save('index',0);
    const pool=await buildCreatorPool(id),n=chunk(),first=pool.slice(0,n);
    save('v545Pool',pool);save('v545PoolPos',first.length);save('v545Flow',{source:raw,mode:'creator',finished:first.length>=pool.length,total:pool.length,batch:1});
    save('queue',first);save('index',firstIncomplete(first));
    sessionStorage.setItem('noteBoost545Message',`✅ @${id} 公開記事 ${pool.length}本｜スキ多い順｜1〜${first.length}本を表示`);
    location.reload();
  }catch(err){setStatus(`⚠ クリエイター読込失敗: ${err?.message||err}`,true)}finally{b.dataset.v545Busy='0';b.disabled=false}
},true);

// ---------- UI統一 ----------
function ensureVersion(){const e=$('#nb532-panel .nb532-head b');if(e&&e.textContent!==`巡回BOOST ${VER}`)e.textContent=`巡回BOOST ${VER}`}
function ensureTopAdd(){const card=$('#nb532-card');if(!card||$('#nb545-magtop'))return;const b=document.createElement('button');b.id='nb545-magtop';b.textContent='📚 マガジンに追加';b.style.cssText='width:100%;margin:6px 0;padding:9px;border:1px solid #3d9665;border-radius:10px;background:#0d3928;color:#fff;font:900 12px system-ui';b.onclick=()=>$('#nb532-mag')?.click();card.parentNode?.insertBefore(b,card)}
function fallbackBack(){const p=$('#nb532-prev');if(p){p.click();return}const a=q();let i=idx();if(a.length){i=Math.max(0,i-1);save('index',i);location.reload()}}
function ensureNav(){
  const actions=$('#nb532-card .nb532-actions');if(!actions)return;
  let back=$('#nb533-prev')||$('#nb545-prev');
  if(!back){back=document.createElement('button');back.id='nb545-prev';back.textContent='戻る';const next=$('#nb532-next');next?actions.insertBefore(back,next):actions.appendChild(back);back.onclick=e=>{e.preventDefault();fallbackBack()}}
  back.style.display='';back.textContent='戻る';const next=$('#nb532-next');if(next){next.textContent='次へ';next.style.display=''}
  $('#nb532-prev')?.style.setProperty('display','none','important');$('#nb532-next2')?.style.setProperty('display','none','important');
  for(const b of $$('#nb532-card button')){const t=(b.textContent||'').trim();if(t==='←'||t==='→')b.style.setProperty('display','none','important')}
  actions.style.gridTemplateColumns='repeat(5,minmax(0,1fr))';
}

// ---------- パネル内記事プレビュー ----------
function htmlText(s){const d=new DOMParser().parseFromString(String(s||'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|h[1-6]|li)>/gi,'\n'),'text/html');return (d.body.textContent||'').replace(/\n{3,}/g,'\n\n').trim()}
function bodyFrom(j){const d=j?.data??j??{},n=d.note||d;for(const x of [n?.body,n?.body_html,n?.bodyHtml,n?.content,n?.content_html,n?.free_body,n?.freeBody,d?.body])if(typeof x==='string'&&x.trim())return htmlText(x);return''}
async function articleText(x){for(const ep of [`/api/v3/notes/${encodeURIComponent(x.key)}`,`/api/v1/notes/${encodeURIComponent(x.key)}`]){try{const j=await json(ep),t=bodyFrom(j);if(t)return t}catch{}}try{const r=await nativeFetch(`https://note.com/${encodeURIComponent(x.urlname)}/n/${encodeURIComponent(x.key)}`,{credentials:'include'});if(r.ok){const h=await r.text(),d=new DOMParser().parseFromString(h,'text/html'),el=d.querySelector('article')||d.querySelector('main');const t=(el?.textContent||'').replace(/\s*\n\s*/g,'\n').replace(/\n{3,}/g,'\n\n').trim();if(t)return t}}catch{}return'本文を取得できませんでした。'}
async function openPreview(){const x=cur(),panel=$('#nb532-panel');if(!x||!panel)return;$('#nb545-preview')?.remove();const box=document.createElement('div');box.id='nb545-preview';box.style.cssText='position:absolute;inset:8px;z-index:2147483647;background:#07131b;border:1px solid #36c7ff;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;color:#fff;box-shadow:0 8px 30px #000a';box.innerHTML=`<div style="display:flex;gap:8px;align-items:center"><button id="nb545-preview-back" style="padding:7px 10px">← 戻る</button><b style="font-size:13px;flex:1">${esc(x.title||x.key)}</b></div><div id="nb545-preview-body" style="overflow:auto;white-space:pre-wrap;line-height:1.75;font-size:13px;padding:6px;border:1px solid #294553;border-radius:8px;min-height:180px;max-height:68vh">本文を読み込み中…</div><button id="nb545-preview-back2" style="padding:8px">戻る</button>`;panel.appendChild(box);const close=()=>box.remove();$('#nb545-preview-back').onclick=close;$('#nb545-preview-back2').onclick=close;const t=await articleText(x);const body=$('#nb545-preview-body');if(body)body.textContent=t}
document.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest('#nb532-openarticle'):null;if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void openPreview()},true);

// ---------- マガジンサムネ + タップ遷移 ----------
const magMeta=new Map(Object.entries(load('magMeta545',{}))),magBusy=new Map();
function deepImage(o,depth=0){if(!o||depth>4)return'';if(typeof o==='string')return /^https?:\/\//.test(o)?o:'';if(Array.isArray(o)){for(const v of o){const x=deepImage(v,depth+1);if(x)return x}return''}if(typeof o!=='object')return'';for(const k of ['image_url','imageUrl','thumbnail_url','thumbnailUrl','thumbnail','cover_image_url','coverImageUrl','cover_image','eyecatch','eyecatch_image','header_image_url','icon_url'])if(k in o){const x=deepImage(o[k],depth+1);if(x)return x}for(const [k,v] of Object.entries(o))if(/image|thumb|cover|eyecatch|photo|icon/i.test(k)){const x=deepImage(v,depth+1);if(x)return x}return''}
function magPage(m,key){for(const k of ['url','magazine_url','magazineUrl','share_url','shareUrl','note_url','noteUrl']){const v=m?.[k];if(typeof v==='string'&&/^https?:\/\//.test(v))return v}const u=m?.user||m?.creator||m?.owner||{},name=String(u.urlname||u.url_name||u.username||m?.urlname||m?.creator_urlname||'').replace(/^@/,'');return name?`https://note.com/${encodeURIComponent(name)}/m/${encodeURIComponent(key)}`:''}
function rememberMags(j){const d=j?.data??j??{},a=d.magazines||j?.magazines||[];if(!Array.isArray(a))return;for(const m of a){const key=String(m?.key||'');if(key)magMeta.set(key,m)}save('magMeta545',Object.fromEntries(magMeta))}
const wrappedFetch=window.fetch.bind(window);window.fetch=async function(input,init={}){const url=typeof input==='string'?input:String(input?.url||'');const r=await wrappedFetch(input,init);if(/\/api\/v1\/my\/magazines(?:\?|$)/.test(url))try{rememberMags(await r.clone().json())}catch{}return r};
async function ensureMag(key){if(magBusy.has(key))return magBusy.get(key);const p=(async()=>{let m=magMeta.get(key)||{};if(magPage(m,key)&&deepImage(m))return m;for(const ep of [`/api/v1/magazines/${encodeURIComponent(key)}`,`/api/v2/magazines/${encodeURIComponent(key)}`]){try{const j=await json(ep),d=j?.data??j??{};m=Object.assign({},m,d.magazine||d);magMeta.set(key,m);save('magMeta545',Object.fromEntries(magMeta));if(magPage(m,key))break}catch{}}return m})();magBusy.set(key,p);return p}
async function enrichMags(){for(const label of $$('#nb532-ml label')){if(label.dataset.v545==='1')continue;const cb=label.querySelector('input[type="checkbox"]'),key=cb?.value;if(!key)continue;const m=await ensureMag(key),page=magPage(m,key)||(()=>{const me=currentAccount();return me?`https://note.com/${encodeURIComponent(me)}/m/${encodeURIComponent(key)}`:''})(),imgUrl=deepImage(m);let visual=label.querySelector('img,.nb532-magph');if(imgUrl&&!label.querySelector('img')){const im=document.createElement('img');im.src=imgUrl;im.alt='';im.loading='lazy';visual?.replaceWith(im);visual=im}if(visual&&page&&!visual.closest('.nb545-maglink')){const a=document.createElement('a');a.className='nb545-maglink';a.href=page;a.target='_self';a.title='マガジンを開く';a.onclick=e=>{e.stopPropagation()};visual.replaceWith(a);a.appendChild(visual)}label.dataset.v545='1'}}

// ---------- 50件ごとの自動続行 ----------
async function latestForCreator(id,source){try{const j=await json(`/api/v2/creators/${encodeURIComponent(id)}/contents?kind=note&page=1`),d=j?.data??j??{},a=Array.isArray(d.contents)?d.contents:(Array.isArray(d.notes)?d.notes:[]),n=a.find(x=>keyOf(x));if(!n)return null;const u=userOf(n);return{key:keyOf(n),id:n.id??n.note_id??null,urlname:id,name:String(u.nickname||u.name||id),title:String(n.name||n.title||keyOf(n)),thumb:thumbOf(n),source}}catch{return null}}
async function mapLimit(a,lim,fn){const out=new Array(a.length);let i=0;async function w(){for(;;){const n=i++;if(n>=a.length)return;try{out[n]=await fn(a[n])}catch{out[n]=null}}}await Promise.all(Array.from({length:Math.min(lim,a.length)},w));return out}
function parseSource(raw){try{const u=new URL(raw);const p=u.pathname.split('/').filter(Boolean),ni=p.indexOf('n'),mi=p.indexOf('m');if(u.hostname==='note.com'&&ni>=1&&p[ni+1])return{type:'note',key:p[ni+1],url:u.href};if(u.hostname==='note.com'&&mi>=1&&p[mi+1])return{type:'mag',url:u.href}}catch{}if(String(raw).trim().startsWith('#'))return{type:'tag',tags:String(raw).trim().split(/[\s,、]+/).map(x=>x.replace(/^#+/,'')).filter(Boolean)};const id=normalizeCreator(raw);return id?{type:'creator',id}:null}
function seenSet(flow,a){const s=new Set(flow?.seen||[]);for(const x of a)if(x?.urlname)s.add(String(x.urlname).toLowerCase());return s}
async function nextArticle(p,seen,max){const ids=[];for(let page=1;page<=100&&ids.length<max;page++){const j=await json(`/api/v3/notes/${encodeURIComponent(p.key)}/likes?page=${page}&per_page=100`),d=j?.data??j??{},a=Array.isArray(d)?d:(d.likes||d.users||d.contents||d.likers||[]);if(!a.length)break;for(const z of a){const u=z?.user||z?.creator||z,id=String(u?.urlname||u?.url_name||u?.username||'').replace(/^@/,'').toLowerCase();if(id&&id!==currentAccount()&&!seen.has(id)){seen.add(id);ids.push(id);if(ids.length>=max)break}}if(a.length<100)break}return (await mapLimit(ids,5,id=>latestForCreator(id,'記事URLのスキ'))).filter(Boolean)}
async function nextTag(p,seen,max){const out=[];for(const tag of p.tags){for(let page=1;page<=100&&out.length<max;page++){const j=await json(`/api/v3/hashtags/${encodeURIComponent(tag)}/notes?order=new&page=${page}`),d=j?.data??j??{},box=d.notes??d.contents??[],a=Array.isArray(box)?box:(box.contents||box.notes||[]);if(!Array.isArray(a)||!a.length)break;for(const n of a){const u=userOf(n),id=String(u.urlname||u.url_name||u.username||'').replace(/^@/,'').toLowerCase(),key=keyOf(n);if(!id||!key||id===currentAccount()||seen.has(id))continue;seen.add(id);out.push({key,id:n.id??n.note_id??null,urlname:id,name:String(u.nickname||u.name||id),title:String(n.name||n.title||key),thumb:thumbOf(n),source:`#${tag}`});if(out.length>=max)break}if(d.isLastPage===true||d.is_last_page===true||a.length<50)break}}return out}
async function nextMag(p,seen,max){const out=[],sigs=new Set();for(let page=1;page<=80&&out.length<max;page++){const u=new URL(p.url);u.searchParams.set('page',String(page));const r=await nativeFetch(u.href,{credentials:'include'});if(!r.ok)break;const h=await r.text(),d=new DOMParser().parseFromString(h,'text/html'),keys=[];for(const a of d.querySelectorAll('a[href]')){let x;try{x=new URL(a.getAttribute('href'),u)}catch{continue}const pp=x.pathname.split('/').filter(Boolean),ni=pp.indexOf('n');if(ni<1||!pp[ni+1])continue;const id=pp[ni-1].toLowerCase(),key=pp[ni+1];keys.push(key);if(!id||id===currentAccount()||seen.has(id))continue;seen.add(id);out.push({key,urlname:id,name:id,title:(a.textContent||key).trim().slice(0,120)||key,thumb:'',source:'マガジンURL'});if(out.length>=max)break}const sig=[...new Set(keys)].slice(0,12).join('|');if(!sig||sigs.has(sig))break;sigs.add(sig)}return out}
let refillBusy=false;
async function maybeContinue(){if(refillBusy)return;const a=q();if(!a.length||!a.every(done))return;const raw=String(load('source','')||'').trim(),p=parseSource(raw);if(!p)return;refillBusy=true;try{
  const n=chunk();if(p.type==='creator'){
    const pool=load('v545Pool',[]),pos=Number(load('v545PoolPos',0))||0;if(pos>=pool.length){setStatus('✅ このクリエイターの記事は全件終了');return}const next=applyResults(pool.slice(pos,pos+n));save('v545PoolPos',pos+next.length);save('queue',next);save('index',firstIncomplete(next));save('v545Flow',{source:raw,mode:'creator',finished:pos+next.length>=pool.length,total:pool.length,batch:Math.floor(pos/n)+2});sessionStorage.setItem('noteBoost545Message',`✅ 続き ${pos+1}〜${pos+next.length}/${pool.length} を表示`);location.reload();return}
  let flow=load('v545Flow',{});if(flow.source!==raw)flow={source:raw,mode:p.type,seen:[],finished:false,batch:1};if(flow.finished)return;const seen=seenSet(flow,a);let next=[];if(p.type==='note')next=await nextArticle(p,seen,n);else if(p.type==='tag')next=await nextTag(p,seen,n);else if(p.type==='mag')next=await nextMag(p,seen,n);if(!next.length){flow.finished=true;flow.seen=[...seen];save('v545Flow',flow);setStatus('✅ この巡回元は全件終了');return}next=applyResults(next);flow.seen=[...seen];flow.batch=Number(flow.batch||1)+1;save('v545Flow',flow);save('queue',next);save('index',firstIncomplete(next));sessionStorage.setItem('noteBoost545Message',`✅ 続きの${next.length}件を自動読込`);location.reload();
}finally{refillBusy=false}}

function enhance(){ensureVersion();ensureTopAdd();ensureNav();const open=$('#nb532-open');if(open)open.style.display='block';if($('#nb532-modal'))void enrichMags()}
function boot(){enhance();try{const m=sessionStorage.getItem('noteBoost545Message');if(m){sessionStorage.removeItem('noteBoost545Message');setTimeout(()=>setStatus(m,false),150)}}catch{}setTimeout(()=>void maybeContinue(),900);const root=document.body||document.documentElement;new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(n=>n.nodeType===1))){clearTimeout(window.__nb545t);window.__nb545t=setTimeout(enhance,0)}}).observe(root,{childList:true,subtree:true});}

document.addEventListener('click',e=>{const t=e.target instanceof Element?e.target.closest('#nb532-like,#nb532-next,#nb533-prev,#nb545-prev,#nb532-mag,#nb545-magtop'):null;if(!t)return;if(t.id==='nb532-mag'||t.id==='nb545-magtop')setTimeout(()=>void enrichMags(),220);if(t.id==='nb532-like'||t.id==='nb532-next'){setTimeout(()=>void maybeContinue(),2200);setTimeout(()=>void maybeContinue(),5200)}setTimeout(enhance,0)},true);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();