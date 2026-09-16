(() => {
'use strict';
const APP_URL='https://note.com/?boost_app=1';
const STORE='noteBoostDedicatedV620';
const LIMIT_PREFIX='noteBoostDedicatedLimit:';
const u=new URL(location.href);
const dedicated=u.searchParams.get('boost_app')==='1';
const fromBoost=u.searchParams.get('boost_return')==='1';
const $=(s,r=document)=>r.querySelector(s);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const loadState=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'null')||{}}catch{return{}}};
const saveState=s=>{try{localStorage.setItem(STORE,JSON.stringify(s))}catch{}};
function current(){const s=loadState();return s?.queue?.[Number(s.index)||0]||null}
function setStatus(text,bad=false){const e=$('#status');if(!e)return;e.textContent=text;e.className='status '+(bad?'bad':'ok')}
function readLiked(j){const c=[j,j?.data,j?.note,j?.data?.note].filter(Boolean);for(const o of c)for(const k of ['isLiked','is_liked','liked','hasLiked'])if(typeof o?.[k]==='boolean')return o[k];return null}
function readLikeCount(j){const c=[j?.data?.note,j?.data,j?.note,j].filter(Boolean);for(const o of c){const n=Number(o?.likeCount??o?.like_count??o?.likes_count??o?.likesCount);if(Number.isFinite(n))return n}return null}
async function api(path,init={}){const r=await fetch(path,{credentials:'include',cache:'no-store',...init,headers:{accept:'application/json',...(init.headers||{})}});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={text}}if(!r.ok){const e=new Error(`HTTP ${r.status}`);e.status=r.status;e.body=data;const ra=r.headers.get('retry-after');e.retryAfter=ra?(/^\d+$/.test(ra)?Number(ra)*1000:Math.max(0,Date.parse(ra)-Date.now())):0;throw e}return data}
function hist(kind){try{return JSON.parse(localStorage.getItem(LIMIT_PREFIX+kind)||'[]').filter(x=>Date.now()-Number(x.t)<86400000)}catch{return[]}}
function putHist(kind,key){const a=hist(kind);a.push({t:Date.now(),key});localStorage.setItem(LIMIT_PREFIX+kind,JSON.stringify(a.slice(-500)))}
function guard(kind){try{return JSON.parse(localStorage.getItem(LIMIT_PREFIX+'guard:'+kind)||'{"until":0,"reason":""}')}catch{return{until:0,reason:''}}}
function setGuard(kind,until,reason){localStorage.setItem(LIMIT_PREFIX+'guard:'+kind,JSON.stringify({until,reason}))}
function limit(kind){const a=hist(kind),now=Date.now(),hour=a.filter(x=>now-Number(x.t)<3600000),g=guard(kind);let until=Number(g.until||0);if(hour.length>=18)until=Math.max(until,Number(hour[0]?.t||0)+3600000);if(a.length>=80)until=Math.max(until,Number(a[0]?.t||0)+86400000);return{hour:hour.length,day:a.length,until}}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function withReturn(raw){const x=new URL(raw,location.origin);x.searchParams.set('boost_return','1');return x.href}
function goOut(raw){try{sessionStorage.setItem('noteBoostReturnV622',APP_URL)}catch{}location.assign(withReturn(raw))}

// Pages explicitly opened from BOOST always get a reliable way back to the app.
if(!dedicated){
  if(fromBoost){
    const add=()=>{if(document.getElementById('noteBoostReturnV622'))return;const b=document.createElement('button');b.id='noteBoostReturnV622';b.textContent='← 巡回BOOSTへ戻る';b.style.cssText='position:fixed;left:10px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:2147483647;border:0;border-radius:999px;padding:11px 14px;background:#071b28;color:#fff;font:700 13px system-ui;box-shadow:0 6px 24px #0008';b.onclick=()=>location.assign(APP_URL);document.body.appendChild(b)};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add,{once:true});else add();
  }
  return;
}

// Keep Android/browser Back inside the dedicated app. Back closes a modal first,
// otherwise it moves to the previous patrol item instead of returning to Yahoo/launcher.
try{
  history.replaceState({boostRoot:1},'',APP_URL);
  history.pushState({boostGuard:1},'',APP_URL);
  addEventListener('popstate',()=>{
    if(!new URL(location.href).searchParams.has('boost_app'))return;
    const modal=[...document.querySelectorAll('.modal.show')][0];
    if(modal)modal.classList.remove('show');
    else $('#prev')?.click();
    history.pushState({boostGuard:1},'',APP_URL);
  });
}catch{}

let likeBusy=false;
async function fixedLike(){
  if(likeBusy)return;
  const item=current(),btn=$('#likeBtn');if(!item||!btn)return;
  const lim=limit('likes');
  if(lim.until>Date.now()){setStatus(`安全上限により保護中・解除 ${new Date(lim.until).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}`,true);return}
  likeBusy=true;btn.disabled=true;btn.textContent='確認中…';
  try{
    const before=await api(`/api/v3/notes/${encodeURIComponent(item.key)}`),liked=readLiked(before),beforeCount=readLikeCount(before);
    if(liked===true){btn.textContent='💗元から';const stateEl=$('.state');if(stateEl)stateEl.textContent='💗 この人は元からスキ済み';setStatus('💗 元からスキ済み｜送信なし');return}
    btn.textContent='スキ中…';
    try{
      await api(`/api/v3/notes/${encodeURIComponent(item.key)}/likes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:'{}'});
    }catch(e){
      const body=JSON.stringify(e.body||'');
      if(/already|liked|exist/i.test(body)){btn.textContent='💗元から';const stateEl=$('.state');if(stateEl)stateEl.textContent='💗 この人は元からスキ済み';setStatus('💗 すでにスキ済み｜解除せず完了');return}
      if(e.status===403)setGuard('likes',Date.now()+3600000,'403検出・60分保護');
      if(e.status===429)setGuard('likes',Date.now()+Math.max(3600000,e.retryAfter||0),'429検出');
      throw e;
    }
    let verified=false;
    for(const wait of [300,800,1500]){
      await sleep(wait);const after=await api(`/api/v3/notes/${encodeURIComponent(item.key)}`),aLiked=readLiked(after),afterCount=readLikeCount(after);
      if(aLiked===true||(beforeCount!=null&&afterCount!=null&&afterCount>beforeCount)){verified=true;break}
    }
    if(!verified)throw new Error('スキ送信後の反映を確認できませんでした');
    const s=loadState();s.likedNow=s.likedNow||{};s.likedNow[item.key]=true;saveState(s);putHist('likes',item.key);
    btn.textContent='❤️今回済';const stateEl=$('.state');if(stateEl)stateEl.textContent='❤️ この人は今回スキ済み✓';setStatus('❤️ スキ反映を確認しました');
  }catch(e){btn.disabled=false;btn.textContent='♡スキ';setStatus(e?.status?`${e.status}：スキ操作に失敗しました`:String(e?.message||e),true)}finally{likeBusy=false}
}

function magThumb(m){for(const x of [m?.image_url,m?.imageUrl,m?.thumbnail_url,typeof m?.thumbnail==='string'?m.thumbnail:m?.thumbnail?.url,typeof m?.eyecatch==='string'?m.eyecatch:m?.eyecatch?.url,m?.cover_image_url,m?.coverImage,m?.cover_image?.url,typeof m?.image==='string'?m.image:m?.image?.url,m?.icon_url,m?.iconUrl,m?.icon?.url])if(typeof x==='string'&&/^https?:\/\//.test(x))return x;return''}
function magUrl(m,key,state){const raw=m?.url||m?.magazine_url||m?.magazineUrl;if(raw)return raw;const owner=m?.user?.urlname||m?.creator?.urlname||m?.owner?.urlname||state?.me||'';return owner?`https://note.com/${encodeURIComponent(owner)}/m/${encodeURIComponent(key)}`:''}
async function ogImage(page){if(!page)return'';try{const r=await fetch(page,{credentials:'include',cache:'no-store'});if(!r.ok)return'';const html=await r.text(),d=new DOMParser().parseFromString(html,'text/html');return d.querySelector('meta[property="og:image"]')?.content||d.querySelector('meta[name="twitter:image"]')?.content||''}catch{return''}}
let magHydrating=false;
async function hydrateMagazineThumbs(){
  if(magHydrating||!$('#magModal.show')||!current())return;
  magHydrating=true;
  try{
    const item=current(),j=await api(`/api/v1/my/magazines?includes_editable=true&note_key=${encodeURIComponent(item.key)}`),d=j?.data??j??{},arr=d.magazines||j?.magazines||[],state=loadState();
    const byKey=new Map((Array.isArray(arr)?arr:[]).map(m=>[String(m.key||''),m]));
    const rows=[...document.querySelectorAll('#magBody .mag')];
    for(const row of rows){
      const button=row.querySelector('button[data-mag]');if(!button)continue;const key=button.dataset.mag,m=byKey.get(String(key));if(!m)continue;
      const page=magUrl(m,key,state);let src=magThumb(m);if(!src)src=await ogImage(page);
      let img=row.querySelector('img');
      if(src){if(!img){img=document.createElement('img');row.firstElementChild?.replaceWith(img)}img.src=src;img.alt='';img.dataset.url=page||'';img.style.cssText='width:54px;height:54px;object-fit:cover;border-radius:8px;background:#15232c';if(page)img.onclick=()=>goOut(page)}
      else if(!img){const ph=row.firstElementChild;ph.textContent='📚';ph.style.cssText='width:54px;height:54px;display:grid;place-items:center;border-radius:8px;background:#15232c;font-size:24px'}
    }
  }catch(e){setStatus(`マガジンサムネイル取得失敗：${e?.message||e}`,true)}finally{magHydrating=false}
}

// Capture-phase handlers override the broken v6.2.1 handlers without touching INSIGHT.
document.addEventListener('click',e=>{
  const t=e.target.closest?.('button,img,.tap');if(!t)return;
  if(t.id==='likeBtn'){e.preventDefault();e.stopImmediatePropagation();void fixedLike();return}
  const state=loadState(),item=state?.queue?.[Number(state.index)||0];
  if(t.id==='openBtn'&&item){e.preventDefault();e.stopImmediatePropagation();goOut(`https://note.com/${encodeURIComponent(item.urlname)}/n/${encodeURIComponent(item.key)}`);return}
  if((t.id==='profileImg'||t.id==='profileName'||t.id==='creatorProfileGo')&&item){e.preventDefault();e.stopImmediatePropagation();goOut(`https://note.com/${encodeURIComponent(item.urlname)}`);return}
  if(t.matches?.('#creatorBody [data-open]')){e.preventDefault();e.stopImmediatePropagation();goOut(t.dataset.open);return}
  if(t.matches?.('#magBody img[data-url]')&&t.dataset.url){e.preventDefault();e.stopImmediatePropagation();goOut(t.dataset.url);return}
},true);

const obs=new MutationObserver(()=>{if($('#magModal.show'))void hydrateMagazineThumbs()});
obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
setTimeout(()=>{if($('#magModal.show'))void hydrateMagazineThumbs()},800);
})();