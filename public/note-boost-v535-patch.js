(() => {
'use strict';
if (window.__NOTE_BOOST_V535_PATCH__) return;
window.__NOTE_BOOST_V535_PATCH__ = true;

const K='note巡回BOOST_v531';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(`${K}:${k}`))??fb}catch{return fb}};
const save=(k,v)=>{try{localStorage.setItem(`${K}:${k}`,JSON.stringify(v))}catch{}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let probeKey='',probeState='unknown',probeSeq=0;
const probeCache=new Map();
const magPromises=new Map();
const magMeta=new Map(Object.entries(load('magMeta535',{})));

function queue(){const q=load('queue',[]);return Array.isArray(q)?q:[]}
function index(){return Math.max(0,Number(load('index',0))||0)}
function current(){const q=queue();return q[index()]||null}
function doneState(s){return s==='preexisting'||s==='liked_now'}
function currentUrl(x){return x?.urlname&&x?.key?`https://note.com/${encodeURIComponent(x.urlname)}/n/${encodeURIComponent(x.key)}`:''}
function readLiked(j){const d=j?.data??j??{},n=d.note||d;for(const k of ['isLiked','is_liked','liked','hasLiked'])if(typeof n?.[k]==='boolean')return n[k];return null}
function setCurrentStatus(text,bad=false){const e=$('#nb532-status');if(e){e.textContent=text;e.dataset.bad=bad?'1':'0'}}
function setVisual(state,x){
  const card=$('#nb532-card');if(!card||!x)return;
  const strong=card.querySelector('.nb532-top strong');
  const like=$('#nb532-like');
  let label='🔎 スキ状態確認中',btn='🔎 確認中';
  if(x.likeState==='liked_now'){label='❤️ 今回スキ済み ✓';btn='❤️ 今回済'}
  else if(x.likeState==='preexisting'){label='💗 元からスキ済み ✓';btn='💗 元から済'}
  else if(state==='preexisting'){label='💗 元からスキ済み';btn='💗 元から済'}
  else if(state==='unliked'){label='♡ 未スキ';btn='♡ スキ'}
  else if(state==='error'){label='⚠ 判定できません';btn='♡ 判定不能'}
  if(strong)strong.textContent=label;
  if(like)like.textContent=btn;
}
function clearOldStatus(x){
  if(!x)return;
  if(doneState(x.likeState)){
    const t=x.likeState==='preexisting'?'💗 元からスキ済み ✓':'❤️ 今回スキ済み ✓';
    setCurrentStatus(`現在 @${x.urlname||'?'}｜${t}`);
  }else{
    setCurrentStatus(`現在 @${x.urlname||'?'}｜🔎 スキ状態を確認中…`);
  }
  setVisual('unknown',x);
}
async function probeCurrent(force=false){
  const x=current();if(!x?.key)return;
  const key=String(x.key);
  if(key!==probeKey){probeKey=key;probeState='unknown';probeSeq++;clearOldStatus(x)}
  if(doneState(x.likeState)){setVisual(x.likeState,x);return}
  const cached=probeCache.get(key);
  if(!force&&cached&&Date.now()-cached.t<30000){probeState=cached.state;applyProbe(x,cached.state);return}
  const seq=++probeSeq;
  try{
    const r=await fetch(`/api/v3/notes/${encodeURIComponent(key)}`,{credentials:'include',headers:{accept:'application/json'}});
    if(!r.ok)throw new Error(String(r.status));
    const j=await r.json();const liked=readLiked(j);
    if(seq!==probeSeq||current()?.key!==key)return;
    const state=liked===true?'preexisting':liked===false?'unliked':'error';
    probeCache.set(key,{state,t:Date.now()});probeState=state;applyProbe(current(),state);
  }catch{
    if(seq!==probeSeq||current()?.key!==key)return;
    probeState='error';applyProbe(current(),'error');
  }
}
function applyProbe(x,state){
  if(!x)return;
  if(doneState(x.likeState)){setVisual(x.likeState,x);return}
  if(state==='preexisting')setCurrentStatus(`現在 @${x.urlname||'?'}｜💗 元からスキ済み`);
  else if(state==='unliked')setCurrentStatus(`現在 @${x.urlname||'?'}｜♡ 未スキ`);
  else if(state==='error')setCurrentStatus(`現在 @${x.urlname||'?'}｜⚠ スキ状態を判定できません`,true);
  else setCurrentStatus(`現在 @${x.urlname||'?'}｜🔎 スキ状態を確認中…`);
  setVisual(state,x);
}

// 元からスキ済みを「次へ」で飛ばす時は、コアの安全判定を1回通して完了記録してから進める。
document.addEventListener('click',e=>{
  const next=e.target instanceof Element?e.target.closest('#nb532-next,#nb533-prev'):null;
  if(!next)return;
  if(next.id==='nb532-next'&&probeState==='preexisting'){
    const x=current();if(x&&!doneState(x.likeState)){
      e.preventDefault();e.stopImmediatePropagation();
      $('#nb532-like')?.click();
    }
  }
},true);

// 「記事」は巡回UIを完全に消してから、同じタブをフル遷移させる。
document.addEventListener('click',e=>{
  const b=e.target instanceof Element?e.target.closest('#nb532-openarticle'):null;if(!b)return;
  const x=current(),url=currentUrl(x);if(!url)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  save('open',false);
  try{sessionStorage.setItem('noteBoost535Article',JSON.stringify({url,from:location.href,t:Date.now()}))}catch{}
  for(const s of ['#nb532-modal','#nb532-panel','#nb532-open'])$(s)?.remove();
  requestAnimationFrame(()=>setTimeout(()=>{location.href=url},20));
},true);

function articleMode(){
  try{
    const v=JSON.parse(sessionStorage.getItem('noteBoost535Article')||'null');
    if(!v?.url)return false;
    const target=new URL(v.url),same=location.pathname===target.pathname;
    if(!same){sessionStorage.removeItem('noteBoost535Article');return false}
    return true;
  }catch{return false}
}
function suppressOnArticle(){if(!articleMode())return;for(const s of ['#nb532-modal','#nb532-panel','#nb532-open'])$(s)?.remove()}

function deepImage(obj,depth=0){
  if(!obj||depth>4)return'';
  if(typeof obj==='string')return /^https?:\/\//.test(obj)&&/\.(?:png|jpe?g|webp|gif)(?:\?|$)/i.test(obj)?obj:'';
  if(Array.isArray(obj)){for(const v of obj){const x=deepImage(v,depth+1);if(x)return x}return''}
  if(typeof obj!=='object')return'';
  const preferred=['image_url','imageUrl','thumbnail_url','thumbnailUrl','thumbnail','cover_image_url','coverImageUrl','cover_image','eyecatch','eyecatch_image','header_image_url','icon_url'];
  for(const k of preferred){if(k in obj){const x=deepImage(obj[k],depth+1);if(x)return x}}
  for(const [k,v] of Object.entries(obj)){if(/image|thumb|cover|eyecatch|photo|icon/i.test(k)){const x=deepImage(v,depth+1);if(x)return x}}
  return'';
}
function magPage(meta,key){
  for(const k of ['url','magazine_url','magazineUrl','share_url','shareUrl','note_url','noteUrl']){
    const v=meta?.[k];if(typeof v==='string'&&/^https?:\/\//.test(v))return v;
  }
  const u=meta?.user||meta?.creator||meta?.owner||{};
  const name=String(u.urlname||u.url_name||u.username||meta?.urlname||meta?.creator_urlname||'').replace(/^@/,'');
  return name?`https://note.com/${encodeURIComponent(name)}/m/${encodeURIComponent(key)}`:'';
}
function rememberMags(json){
  const d=json?.data??json??{},arr=d.magazines||json?.magazines||[];
  if(!Array.isArray(arr))return;
  for(const m of arr){const key=String(m?.key||'');if(!key)continue;magMeta.set(key,m)}
  try{save('magMeta535',Object.fromEntries(magMeta))}catch{}
}
const prevFetch=window.fetch.bind(window);
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const r=await prevFetch(input,init);
  if(/\/api\/v1\/my\/magazines(?:\?|$)/.test(url)){
    try{const j=await r.clone().json();rememberMags(j);setTimeout(enrichMagazineThumbs,0)}catch{}
  }
  return r;
};
async function resolveMagThumb(key){
  if(magPromises.has(key))return magPromises.get(key);
  const p=(async()=>{
    let meta=magMeta.get(key)||{};let img=deepImage(meta);if(img)return img;
    for(const endpoint of [`/api/v1/magazines/${encodeURIComponent(key)}`,`/api/v2/magazines/${encodeURIComponent(key)}`]){
      try{const r=await prevFetch(endpoint,{credentials:'include',headers:{accept:'application/json'}});if(!r.ok)continue;const j=await r.json();const d=j?.data??j??{};meta=Object.assign({},meta,d.magazine||d);magMeta.set(key,meta);img=deepImage(meta);if(img)return img}catch{}
    }
    const page=magPage(meta,key);if(page){
      try{const r=await prevFetch(page,{credentials:'include'});if(r.ok){const html=await r.text(),doc=new DOMParser().parseFromString(html,'text/html');img=doc.querySelector('meta[property="og:image"],meta[name="twitter:image"]')?.content||'';if(img)return img}}catch{}
    }
    return'';
  })();magPromises.set(key,p);return p;
}
async function enrichMagazineThumbs(){
  const labels=$$('#nb532-ml label');if(!labels.length)return;
  let i=0;const workers=Array.from({length:Math.min(4,labels.length)},async()=>{for(;;){const n=i++;if(n>=labels.length)return;const label=labels[n],cb=label.querySelector('input[type="checkbox"]'),key=cb?.value;if(!key)continue;const currentImg=label.querySelector('img');if(currentImg?.src&&!/data:/.test(currentImg.src))continue;const img=await resolveMagThumb(key);if(!img)continue;const ph=label.querySelector('.nb532-magph');const el=document.createElement('img');el.src=img;el.alt='';el.loading='lazy';if(ph)ph.replaceWith(el);else label.prepend(el)}});await Promise.all(workers)
}

let lastKey='';
function tick(){
  suppressOnArticle();if(articleMode())return;
  const x=current();const key=String(x?.key||'');
  if(key&&key!==lastKey){lastKey=key;probeKey='';probeState='unknown';void probeCurrent(true)}
  else if(key)void probeCurrent(false);
  if($('#nb532-ml'))void enrichMagazineThumbs();
  const h=$('#nb532-panel .nb532-head b');if(h)h.textContent='巡回BOOST 5.3.5';
}
function boot(){tick();new MutationObserver(()=>{clearTimeout(window.__nb535T);window.__nb535T=setTimeout(tick,80)}).observe(document.documentElement,{subtree:true,childList:true});setInterval(tick,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();