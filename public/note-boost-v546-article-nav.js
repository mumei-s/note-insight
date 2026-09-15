(() => {
'use strict';
if(window.__NOTE_BOOST_V546_ARTICLE_NAV__)return;
window.__NOTE_BOOST_V546_ARTICLE_NAV__=true;

const K='note巡回BOOST_v531';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(`${K}:${k}`))??fb}catch{return fb}};
const q=()=>{const a=load('queue',[]);return Array.isArray(a)?a:[]};
const idx=()=>Math.max(0,Number(load('index',0))||0);
const cur=()=>q()[idx()]||null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const articleUrl=x=>x?.url||((x?.urlname&&x?.key)?`https://note.com/${encodeURIComponent(x.urlname)}/n/${encodeURIComponent(x.key)}`:'');
const profileCache=new Map(),articleCache=new Map();

function removeUi(){for(const s of ['#nb546-preview','#nb546-creator','#nb545-preview','#nb532-modal','#nb532-panel','#nb532-open'])$(s)?.remove()}
function hidePanel(){const p=$('#nb532-panel');if(p)p.style.visibility='hidden'}
function showPanel(){const p=$('#nb532-panel');if(p)p.style.visibility='visible'}

function openRealArticle(x=cur()){
  const url=articleUrl(x);if(!url)return;
  try{sessionStorage.setItem('noteBoost546ArticleNav',JSON.stringify({url,from:location.href,index:idx(),t:Date.now()}))}catch{}
  removeUi();
  setTimeout(()=>location.assign(url),20);
}
function openProfile(id){if(!id)return;removeUi();setTimeout(()=>location.assign(`https://note.com/${encodeURIComponent(id)}`),20)}

function closeOverlay(id){$(id)?.remove();showPanel()}
function openPreview(){
  const x=cur(),url=articleUrl(x);if(!x||!url||!$('#nb532-panel'))return;
  $('#nb546-preview')?.remove();
  const box=document.createElement('div');box.id='nb546-preview';
  box.style.cssText='position:fixed;inset:8px;z-index:2147483647;background:#07131b;border:1px solid #36c7ff;border-radius:14px;box-shadow:0 10px 36px #000c;display:flex;flex-direction:column;overflow:hidden';
  box.innerHTML=`<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#0b1d28;border-bottom:1px solid #294553"><button id="nb546-preview-back" style="padding:7px 11px">戻る</button><b style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:13px">実記事プレビュー</b><button id="nb546-preview-open" style="padding:7px 11px">記事を開く</button></div><iframe src="${esc(url)}" style="width:100%;height:calc(100vh - 72px);border:0;background:#fff" referrerpolicy="same-origin"></iframe>`;
  document.body.appendChild(box);hidePanel();
  $('#nb546-preview-back').onclick=e=>{e.preventDefault();closeOverlay('#nb546-preview')};
  $('#nb546-preview-open').onclick=e=>{e.preventDefault();closeOverlay('#nb546-preview');openRealArticle(x)};
}

async function getJson(url){const r=await fetch(url,{credentials:'include',headers:{accept:'application/json','cache-control':'no-cache'}});if(!r.ok)throw new Error(`${r.status}`);return r.json()}
function userObj(j,id){const d=j?.data??j??{},u=d.user||d.creator||d;return{
  id:String(u.urlname||u.url_name||u.username||id),
  name:String(u.nickname||u.name||id),
  bio:String(u.profile||u.description||u.bio||u.biography||u.introduction||''),
  icon:String(u.profile_image_url||u.profileImageUrl||u.icon_url||u.avatar_url||u.image_url||u.image?.url||''),
  followers:Number(u.followers_count??u.follower_count??u.followersCount??u.num_followers??0)||0,
  following:Number(u.following_count??u.followings_count??u.followingCount??0)||0,
  notes:Number(u.note_count??u.notes_count??u.contents_count??u.noteCount??0)||0
}}
async function creatorProfile(id){if(profileCache.has(id))return profileCache.get(id);const p=(async()=>{for(const ep of [`/api/v2/creators/${encodeURIComponent(id)}`,`/api/v1/creators/${encodeURIComponent(id)}`]){try{return userObj(await getJson(ep),id)}catch{}}return{id,name:id,bio:'',icon:'',followers:0,following:0,notes:0}})();profileCache.set(id,p);return p}
function noteItem(n,id){const key=String(n?.key||n?.note_key||n?.noteKey||n?.slug||'');if(!key)return null;return{key,urlname:id,title:String(n?.name||n?.title||key),like:Number(n?.likeCount??n?.like_count??n?.likes_count??n?.likesCount??0)||0,date:String(n?.publishAt||n?.publish_at||n?.createdAt||n?.created_at||''),url:`https://note.com/${encodeURIComponent(id)}/n/${encodeURIComponent(key)}`}}
async function creatorArticles(id){if(articleCache.has(id))return articleCache.get(id);const p=(async()=>{const out=[],seen=new Set();for(let page=1;page<=30;page++){let j;try{j=await getJson(`/api/v2/creators/${encodeURIComponent(id)}/contents?kind=note&page=${page}`)}catch{break}const d=j?.data??j??{},a=Array.isArray(d.contents)?d.contents:(Array.isArray(d.notes)?d.notes:(Array.isArray(d)?d:[]));if(!a.length)break;for(const n of a){const x=noteItem(n,id);if(x&&!seen.has(x.key)){seen.add(x.key);out.push(x)}}if(d.isLastPage===true||d.is_last_page===true)break}return out})();articleCache.set(id,p);return p}

async function openCreator(){
  const x=cur(),id=String(x?.urlname||'').replace(/^@/,'');if(!id||!$('#nb532-panel'))return;
  $('#nb546-creator')?.remove();
  const box=document.createElement('div');box.id='nb546-creator';box.style.cssText='position:fixed;inset:8px;z-index:2147483647;background:#07131b;border:1px solid #36c7ff;border-radius:14px;box-shadow:0 10px 36px #000c;display:flex;flex-direction:column;overflow:hidden;color:#fff';
  box.innerHTML=`<div style="display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid #294553"><button id="nb546-creator-back" style="padding:7px 11px">戻る</button><b style="flex:1">👤 クリエイター情報</b><button id="nb546-profile-open" style="padding:7px 11px">プロフィール</button></div><div id="nb546-creator-body" style="overflow:auto;padding:10px;line-height:1.5">読み込み中…</div>`;
  document.body.appendChild(box);hidePanel();
  $('#nb546-creator-back').onclick=e=>{e.preventDefault();closeOverlay('#nb546-creator')};
  $('#nb546-profile-open').onclick=e=>{e.preventDefault();openProfile(id)};
  const [p,a]=await Promise.all([creatorProfile(id),creatorArticles(id)]);const body=$('#nb546-creator-body');if(!body)return;
  const list=a.map((n,i)=>`<button class="nb546-carticle" data-i="${i}" style="display:grid;grid-template-columns:32px 1fr auto;gap:8px;width:100%;text-align:left;padding:9px 6px;border:0;border-bottom:1px solid #1e3440;background:transparent;color:#fff"><span style="opacity:.65">${i+1}</span><span><b>${esc(n.title)}</b><small style="display:block;opacity:.65">${esc(n.date?new Date(n.date).toLocaleDateString('ja-JP'):'')}</small></span><span style="white-space:nowrap">♡${n.like}</span></button>`).join('');
  body.innerHTML=`<div style="display:flex;gap:10px;align-items:center;padding-bottom:10px"><div id="nb546-profile-icon" style="width:56px;height:56px;border-radius:50%;overflow:hidden;background:#1b3440;flex:none">${p.icon?`<img src="${esc(p.icon)}" style="width:100%;height:100%;object-fit:cover">`:'👤'}</div><div style="min-width:0"><b style="font-size:16px">${esc(p.name)}</b><div style="opacity:.7">@${esc(p.id)}</div><div style="font-size:11px;opacity:.75">フォロワー ${p.followers||'—'} ・ 記事 ${p.notes||a.length}</div></div></div>${p.bio?`<div style="padding:8px;border:1px solid #294553;border-radius:8px;margin-bottom:10px;white-space:pre-wrap">${esc(p.bio)}</div>`:''}<div style="font-weight:900;margin:8px 0">公開記事一覧 ${a.length}件</div><div>${list||'記事が見つかりませんでした'}</div>`;
  $('#nb546-profile-icon')?.addEventListener('click',()=>openProfile(id));
  $$('.nb546-carticle',body).forEach(b=>b.onclick=()=>{const n=a[Number(b.dataset.i)];if(n)openRealArticle(n)});
}

function ensureButtons(){
  const card=$('#nb532-card');if(!card)return;
  let wrap=$('#nb546-top-actions');if(!wrap){wrap=document.createElement('div');wrap.id='nb546-top-actions';wrap.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:6px 0';const topAdd=$('#nb545-magtop');topAdd?topAdd.replaceWith(wrap):card.parentNode?.insertBefore(wrap,card)}
  if(!$('#nb546-preview-btn')){const b=document.createElement('button');b.id='nb546-preview-btn';b.textContent='👁 プレビュー';b.onclick=e=>{e.preventDefault();openPreview()};wrap.appendChild(b)}
  if(!$('#nb546-creator-btn')){const b=document.createElement('button');b.id='nb546-creator-btn';b.textContent='👤 クリエイター';b.onclick=e=>{e.preventDefault();void openCreator()};wrap.appendChild(b)}
  if(!$('#nb546-magtop2')){const b=document.createElement('button');b.id='nb546-magtop2';b.textContent='📚 追加';b.onclick=e=>{e.preventDefault();$('#nb532-mag')?.click()};wrap.appendChild(b)}
  for(const b of $$(`#nb546-top-actions button`))b.style.cssText='padding:9px;border:1px solid #466b7d;border-radius:10px;background:#102431;color:#fff;font:900 11px system-ui';
}

// 「記事」は実記事へ。同じタブで移動。プレビューとは完全分離。
document.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest('#nb532-openarticle'):null;if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openRealArticle()},true);

function boot(){ensureButtons();const root=document.body||document.documentElement;new MutationObserver(()=>ensureButtons()).observe(root,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();