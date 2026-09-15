(() => {
'use strict';
if (window.__NOTE_BOOST_V535_PATCH__) return;
window.__NOTE_BOOST_V535_PATCH__ = true;

const K='note巡回BOOST_v531';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(`${K}:${k}`))??fb}catch{return fb}};
const save=(k,v)=>{try{localStorage.setItem(`${K}:${k}`,JSON.stringify(v))}catch{}};
const magPromises=new Map();
const magMeta=new Map(Object.entries(load('magMeta535',{})));

function queue(){const q=load('queue',[]);return Array.isArray(q)?q:[]}
function index(){return Math.max(0,Number(load('index',0))||0)}
function current(){return queue()[index()]||null}
function currentUrl(x){return x?.urlname&&x?.key?`https://note.com/${encodeURIComponent(x.urlname)}/n/${encodeURIComponent(x.key)}`:''}

// 記事ボタン：巡回UIを完全に消してから同じタブでフル遷移。
document.addEventListener('click',e=>{
  const b=e.target instanceof Element?e.target.closest('#nb532-openarticle'):null;if(!b)return;
  const x=current(),url=currentUrl(x);if(!url)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  save('open',false);
  try{sessionStorage.setItem('noteBoost535Article',JSON.stringify({url,from:location.href,t:Date.now()}))}catch{}
  for(const s of ['#nb532-modal','#nb532-panel','#nb532-open'])$(s)?.remove();
  setTimeout(()=>location.assign(url),20);
},true);

function articleMode(){
  try{const v=JSON.parse(sessionStorage.getItem('noteBoost535Article')||'null');if(!v?.url)return false;const target=new URL(v.url),same=location.pathname===target.pathname;if(!same){sessionStorage.removeItem('noteBoost535Article');return false}return true}catch{return false}
}
function suppressOnArticle(){if(!articleMode())return;for(const s of ['#nb532-modal','#nb532-panel','#nb532-open'])$(s)?.remove()}
suppressOnArticle();

function deepImage(obj,depth=0){
  if(!obj||depth>4)return'';
  if(typeof obj==='string')return /^https?:\/\//.test(obj)?obj:'';
  if(Array.isArray(obj)){for(const v of obj){const x=deepImage(v,depth+1);if(x)return x}return''}
  if(typeof obj!=='object')return'';
  const preferred=['image_url','imageUrl','thumbnail_url','thumbnailUrl','thumbnail','cover_image_url','coverImageUrl','cover_image','eyecatch','eyecatch_image','header_image_url','icon_url'];
  for(const k of preferred){if(k in obj){const x=deepImage(obj[k],depth+1);if(x)return x}}
  for(const [k,v] of Object.entries(obj)){if(/image|thumb|cover|eyecatch|photo|icon/i.test(k)){const x=deepImage(v,depth+1);if(x)return x}}
  return'';
}
function magPage(meta,key){
  for(const k of ['url','magazine_url','magazineUrl','share_url','shareUrl','note_url','noteUrl']){const v=meta?.[k];if(typeof v==='string'&&/^https?:\/\//.test(v))return v}
  const u=meta?.user||meta?.creator||meta?.owner||{},name=String(u.urlname||u.url_name||u.username||meta?.urlname||meta?.creator_urlname||'').replace(/^@/,'');
  return name?`https://note.com/${encodeURIComponent(name)}/m/${encodeURIComponent(key)}`:'';
}
function rememberMags(json){
  const d=json?.data??json??{},arr=d.magazines||json?.magazines||[];if(!Array.isArray(arr))return;
  let changed=false;for(const m of arr){const key=String(m?.key||'');if(!key)continue;magMeta.set(key,m);changed=true}if(changed)try{save('magMeta535',Object.fromEntries(magMeta))}catch{}
}
const prevFetch=window.fetch.bind(window);
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const r=await prevFetch(input,init);
  if(/\/api\/v1\/my\/magazines(?:\?|$)/.test(url))try{rememberMags(await r.clone().json())}catch{}
  return r;
};
async function resolveMagThumb(key){
  if(magPromises.has(key))return magPromises.get(key);
  const p=(async()=>{
    let meta=magMeta.get(key)||{},img=deepImage(meta);if(img)return img;
    for(const ep of [`/api/v1/magazines/${encodeURIComponent(key)}`,`/api/v2/magazines/${encodeURIComponent(key)}`]){try{const r=await prevFetch(ep,{credentials:'include',headers:{accept:'application/json'}});if(!r.ok)continue;const j=await r.json(),d=j?.data??j??{};meta=Object.assign({},meta,d.magazine||d);magMeta.set(key,meta);img=deepImage(meta);if(img)return img}catch{}}
    const page=magPage(meta,key);if(page)try{const r=await prevFetch(page,{credentials:'include'});if(r.ok){const html=await r.text(),doc=new DOMParser().parseFromString(html,'text/html');img=doc.querySelector('meta[property="og:image"],meta[name="twitter:image"]')?.content||'';if(img)return img}}catch{}
    return'';
  })();magPromises.set(key,p);return p;
}
async function enrichMagazineThumbs(root=document){
  const labels=$$('#nb532-ml label',root.closest?.('#nb532-modal')||document);if(!labels.length)return;
  let i=0;const workers=Array.from({length:Math.min(4,labels.length)},async()=>{for(;;){const n=i++;if(n>=labels.length)return;const label=labels[n],cb=label.querySelector('input[type="checkbox"]'),key=cb?.value;if(!key||label.dataset.thumbDone==='1')continue;const existing=label.querySelector('img');if(existing?.src){label.dataset.thumbDone='1';continue}const img=await resolveMagThumb(key);label.dataset.thumbDone='1';if(!img)continue;const ph=label.querySelector('.nb532-magph');const el=document.createElement('img');el.src=img;el.alt='';el.loading='lazy';if(ph)ph.replaceWith(el);else label.prepend(el)}});await Promise.all(workers)
}

document.addEventListener('click',e=>{if(e.target instanceof Element&&e.target.closest('#nb532-mag'))setTimeout(()=>void enrichMagazineThumbs(),250)},true);
const root=document.body||document.documentElement;
new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){if(n.nodeType!==1)continue;const el=n;const modal=el.id==='nb532-modal'?el:el.querySelector?.('#nb532-modal');if(modal){void enrichMagazineThumbs(modal);return}}}).observe(root,{childList:true,subtree:true});
})();