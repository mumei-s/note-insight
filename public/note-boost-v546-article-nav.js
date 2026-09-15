(() => {
'use strict';
if(window.__NOTE_BOOST_V546_ARTICLE_NAV__)return;
window.__NOTE_BOOST_V546_ARTICLE_NAV__=true;

const K='note巡回BOOST_v531';
const $=(s,r=document)=>r.querySelector(s);
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(`${K}:${k}`))??fb}catch{return fb}};
const q=()=>{const a=load('queue',[]);return Array.isArray(a)?a:[]};
const idx=()=>Math.max(0,Number(load('index',0))||0);
const cur=()=>q()[idx()]||null;
const articleUrl=x=>x?.url||((x?.urlname&&x?.key)?`https://note.com/${encodeURIComponent(x.urlname)}/n/${encodeURIComponent(x.key)}`:'');

function removeUi(){for(const s of ['#nb546-preview','#nb545-preview','#nb532-modal','#nb532-panel','#nb532-open'])$(s)?.remove()}

function openRealArticle(){
  const x=cur(),url=articleUrl(x);if(!url)return;
  try{sessionStorage.setItem('noteBoost546ArticleNav',JSON.stringify({url,from:location.href,index:idx(),t:Date.now()}))}catch{}
  removeUi();
  setTimeout(()=>location.assign(url),20);
}

function closePreview(){
  $('#nb546-preview')?.remove();
  const panel=$('#nb532-panel');if(panel)panel.style.visibility='visible';
}

function openPreview(){
  const x=cur(),url=articleUrl(x),panel=$('#nb532-panel');if(!x||!url||!panel)return;
  $('#nb546-preview')?.remove();
  const box=document.createElement('div');
  box.id='nb546-preview';
  box.style.cssText='position:fixed;inset:8px;z-index:2147483647;background:#07131b;border:1px solid #36c7ff;border-radius:14px;box-shadow:0 10px 36px #000c;display:flex;flex-direction:column;overflow:hidden';
  box.innerHTML=`<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#0b1d28;border-bottom:1px solid #294553"><button id="nb546-preview-back" style="padding:7px 11px;border:1px solid #466b7d;border-radius:8px;background:#142532;color:#fff;font-weight:800">戻る</button><b style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:13px">実記事プレビュー</b><button id="nb546-preview-open" style="padding:7px 11px;border:1px solid #3d9665;border-radius:8px;background:#0d3928;color:#fff;font-weight:800">記事を開く</button></div><iframe id="nb546-preview-frame" src="${url.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" style="width:100%;height:calc(100vh - 72px);border:0;background:#fff" referrerpolicy="same-origin"></iframe>`;
  document.body.appendChild(box);
  panel.style.visibility='hidden';
  $('#nb546-preview-back').onclick=e=>{e.preventDefault();closePreview()};
  $('#nb546-preview-open').onclick=e=>{e.preventDefault();closePreview();openRealArticle()};
}

function ensurePreviewButton(){
  const card=$('#nb532-card');if(!card)return;
  if($('#nb546-preview-btn'))return;
  const topAdd=$('#nb545-magtop');
  const wrap=document.createElement('div');wrap.id='nb546-top-actions';wrap.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0';
  const p=document.createElement('button');p.id='nb546-preview-btn';p.textContent='👁 プレビュー';p.style.cssText='padding:9px;border:1px solid #466b7d;border-radius:10px;background:#102431;color:#fff;font:900 12px system-ui';p.onclick=e=>{e.preventDefault();openPreview()};
  const m=document.createElement('button');m.id='nb546-magtop2';m.textContent='📚 マガジンに追加';m.style.cssText='padding:9px;border:1px solid #3d9665;border-radius:10px;background:#0d3928;color:#fff;font:900 12px system-ui';m.onclick=e=>{e.preventDefault();$('#nb532-mag')?.click()};
  wrap.append(p,m);
  if(topAdd)topAdd.replaceWith(wrap);else card.parentNode?.insertBefore(wrap,card);
}

// 「記事」は実記事へ。同じタブで移動。プレビューとは完全分離。
document.addEventListener('click',e=>{
  const b=e.target instanceof Element?e.target.closest('#nb532-openarticle'):null;if(!b)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  openRealArticle();
},true);

function boot(){ensurePreviewButton();const root=document.body||document.documentElement;new MutationObserver(()=>ensurePreviewButton()).observe(root,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();