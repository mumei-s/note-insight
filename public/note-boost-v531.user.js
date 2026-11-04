// ==UserScript==
// @name         note 巡回BOOST｜専用アプリ
// @namespace    https://github.com/mumei-s/note-insight
// @version      6.8.0
// @description  自分の最新5記事をタップして即開始。選択記事にスキした人＋スキが付いたコメント投稿者を循環。過去スキ済みは重複警告。マガジン先読み対応。
// @match        https://note.com/*
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-boost-v531.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-boost-v531.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==
(() => {
'use strict';

const APP_URL = 'https://note.com/?boost_app=1';
const url = new URL(location.href);
const dedicated = url.searchParams.get('boost_app') === '1' || url.hash === '#boost_app' || url.hash === '#boost';
const fromBoost = url.searchParams.get('boost_return') === '1';
const STORE = 'noteBoostDedicatedV640';
const PREV_STORE = 'noteBoostDedicatedV630';
const OLD_STORE = 'noteBoostDedicatedV620';
const LIMIT_PREFIX = 'noteBoostDedicatedLimit:';

if (!dedicated) {
  if (fromBoost) {
    const addReturn = () => {
      if (!document.body || document.getElementById('noteBoostReturnV630')) return;
      const b = document.createElement('button');
      b.id = 'noteBoostReturnV630';
      b.type = 'button';
      b.textContent = '← 巡回BOOSTへ戻る';
      b.style.cssText = 'position:fixed;left:10px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:2147483647;border:1px solid #3a6680;border-radius:999px;padding:11px 14px;background:#071b28;color:#fff;font:800 13px system-ui;box-shadow:0 6px 24px #0008';
      b.addEventListener('click', () => location.assign(APP_URL));
      document.body.appendChild(b);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addReturn, {once:true}); else addReturn();
  }
  return;
}

try { document.documentElement.style.visibility = 'hidden'; } catch {}
try { window.stop(); } catch {}

const HTML = `<!doctype html><html lang="ja"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#07131b"><title>note 巡回BOOST</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif;background:#05090e;color:#eef7ff}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:linear-gradient(180deg,#07131b 0,#04080c 100%);overflow-x:hidden}button,input{font:inherit}.app{width:min(760px,100%);margin:auto;padding:12px 12px calc(92px + env(safe-area-inset-bottom,0px))}.head{position:sticky;top:0;z-index:10;padding:10px 2px 9px;background:#050a0ff2;backdrop-filter:blur(14px);border-bottom:1px solid #253a49}.headrow{display:flex;justify-content:space-between;gap:8px;align-items:center}.head h1{margin:0;font-size:19px}.acct{font-size:11px;color:#8feaff}.sub{font-size:10px;color:#8097a8;margin-top:3px}.card{margin-top:10px;border:1px solid #284151;border-radius:14px;background:#0a151e;padding:10px;box-shadow:0 8px 24px #0005}.row{display:flex;gap:8px;align-items:center}.grow{flex:1;min-width:0}input{width:100%;border:1px solid #355368;background:#071018;color:#fff;border-radius:11px;padding:11px 12px;outline:none}button{border:1px solid #355368;background:#102431;color:#fff;border-radius:10px;padding:10px 11px;font-weight:800;cursor:pointer}button.primary{background:#0d4b35;border-color:#2b9d68}button.danger{background:#36171b;border-color:#8a3b46}button:disabled{opacity:.48;cursor:default}.top-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.status{margin-top:8px;padding:8px 9px;border-radius:9px;background:#071018;color:#a8bfce;font-size:12px;white-space:pre-wrap}.status.ok{color:#82efb2}.status.bad{color:#ff9b9b}.limits{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}.pill{padding:7px;border:1px solid #294354;border-radius:9px;background:#071018;font-size:10px;color:#9fb7c7}.progress{font-size:12px;color:#9eb5c4;margin:0 0 8px}.creator{display:grid;grid-template-columns:58px 1fr;gap:10px;align-items:center}.creator img{width:58px;height:58px;border-radius:50%;object-fit:cover;background:#14232d}.tap{cursor:pointer}.name{font-weight:900;line-height:1.25}.id,.meta,.stats{font-size:11px;color:#88a3b5}.bio{font-size:12px;color:#c3d0d8;white-space:pre-wrap;line-height:1.6;margin-top:5px}.state{margin-top:9px;padding:9px;border-radius:10px;border:1px solid #35536a;background:#08131b;text-align:center;font-weight:900}.article{margin-top:9px;border:1px solid #294454;border-radius:12px;background:#07131b;padding:9px}.article h2{font-size:15px;margin:0 0 5px;line-height:1.5}.thumb{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;background:#111c24;margin-top:8px}.actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:8px}.actions.two{grid-template-columns:repeat(2,minmax(0,1fr))}.actions button{min-width:0;padding:10px 5px}.footer{position:fixed;left:50%;bottom:0;z-index:15;transform:translateX(-50%);width:min(760px,100%);display:grid;grid-template-columns:1fr 1fr;background:#071019f5;border-top:1px solid #284353;padding:8px 10px calc(8px + env(safe-area-inset-bottom,0px));backdrop-filter:blur(14px)}.footer button{border:0;background:#0f202c}.footer button+button{margin-left:6px}.modal{display:none;position:fixed;inset:0;z-index:30;background:#03080bf5}.modal.show{display:flex;flex-direction:column}.modalhead{display:flex;gap:8px;align-items:center;padding:10px;border-bottom:1px solid #263d4c;background:#071019}.modalhead b{flex:1}.modalbody{padding:10px;overflow:auto;flex:1}.listitem{border:1px solid #294252;border-radius:11px;background:#09141c;padding:9px;margin-bottom:8px}.listrow{display:grid;grid-template-columns:56px 1fr;gap:9px;align-items:center}.listrow img{width:56px;height:56px;border-radius:8px;object-fit:cover;background:#15232c}.mag-controls{position:sticky;top:0;z-index:3;background:#03080bf5;padding:0 0 8px}.mag-add{width:100%;margin:8px 0;background:#0d4b35;border-color:#2b9d68}.mag-list{margin-top:6px}.mag{display:grid;grid-template-columns:58px 28px 1fr;gap:8px;align-items:center;border:1px solid #294252;border-radius:11px;background:#09141c;padding:8px;margin-bottom:7px}.mag img,.magph{width:58px;height:58px;object-fit:cover;border-radius:8px;background:#15232c}.magph{display:grid;place-items:center;font-size:25px}.mag input[type=checkbox]{width:21px;height:21px;margin:0}.mag b{display:block;line-height:1.35}.mag .meta{margin-top:3px}.hidden{display:none!important}.empty{padding:24px 10px;text-align:center;color:#8ca2b1}.login{display:inline-block;margin-top:8px;color:#8feaff}.msg{font-size:11px;color:#8feaff;min-height:1.5em;margin:6px 0}.bar{display:flex;gap:7px}.bar button{flex:1}.pick-head{display:flex;gap:7px;align-items:center}.pick-head button{flex:1}.article-picks{display:grid;gap:8px;margin-top:10px}.article-pick{display:grid;grid-template-columns:74px 1fr auto;gap:9px;align-items:center;border:1px solid #294252;border-radius:12px;background:#09141c;padding:8px;text-align:left}.article-pick.selected{border-color:#63c9ff;box-shadow:0 0 0 1px #63c9ff55 inset;background:#0b1d29}.article-pick img,.article-pick .pickph{width:74px;height:54px;border-radius:8px;object-fit:cover;background:#15232c}.article-pick .pickph{display:grid;place-items:center;font-size:22px}.article-pick b{display:block;font-size:13px;line-height:1.35}.article-pick .meta{margin-top:4px}.article-pick .go{font-size:11px;color:#8feaff;white-space:nowrap}.pick-note{font-size:10px;color:#8fa6b5;margin-top:7px}
@media(max-width:390px){.actions{grid-template-columns:1fr 1fr}.actions button:last-child:nth-child(odd){grid-column:1/-1}.creator{grid-template-columns:52px 1fr}.creator img{width:52px;height:52px}.head h1{font-size:17px}.mag{grid-template-columns:52px 26px 1fr}.mag img,.magph{width:52px;height:52px}}

.app{width:min(680px,100%);padding:5px 8px calc(58px + env(safe-area-inset-bottom,0px))}
.head{padding:6px 2px}.head h1{font-size:17px}.head .sub{font-size:10px}
.card{margin-top:6px;padding:8px;border-radius:10px;box-shadow:none}
.boost-controls .source-controls{gap:5px}.boost-controls input{min-width:0;padding:9px 10px;font-size:13px;min-height:38px}
.boost-controls .source-controls button{white-space:nowrap;font-size:12px;padding:8px 9px}
.boost-controls .top-actions{margin-top:5px;gap:5px}.boost-controls .top-actions button{padding:6px 8px;font-size:11px}
.status{margin-top:5px;padding:5px 7px;font-size:11px;min-height:24px;max-height:60px;overflow:auto}
.more-controls{margin-top:6px;font-size:11px;color:#9db7c7}.more-controls summary{cursor:pointer;padding:2px 4px}
.more-controls .limits{margin-top:5px}
#current .creator{grid-template-columns:42px 1fr;gap:7px}#current .creator img{width:42px;height:42px}
#current .bio{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:11px}
#current .state{margin-top:6px;padding:6px;font-size:11px}
#current .article{margin-top:6px;padding:7px}#current .article h2{font-size:13px}
#current .actions{gap:5px;margin-top:5px}#current .actions button{padding:8px 4px;font-size:11px;min-height:34px}
.media-optional{margin-top:4px;font-size:11px;color:#92d7ea}
.footer{padding:4px 8px calc(4px + env(safe-area-inset-bottom,0px))}
.footer button{padding:8px}.modalbody{padding:8px}
.fav-group{margin:0 0 15px}.fav-group h2{font-size:14px;margin:5px 0 8px;color:#8fd7ee}.fav-group h2 small{font-size:10px;color:#8ba5b8}
.fav-item{display:flex;align-items:center;gap:5px;border-bottom:1px solid #244153;padding:6px 2px;font-size:11px}
.fav-name{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;overflow-wrap:anywhere}
.fav-name small{font-size:10px;color:#8eacbd}.fav-item button{flex:0 0 auto;padding:7px 8px;font-size:11px}
.fav-empty{color:#879ba9;font-size:11px;margin:5px 0}

</style></head><body>
<main class="app"><header class="head"><div class="headrow"><h1>note 巡回BOOST</h1><div id="acct" class="acct">診断中…</div></div><div class="sub">#タグ・記事・マガジン・人物から巡回｜v6.8.0</div></header>
<section class="card boost-controls">
<div class="row source-controls"><input class="grow" id="source" type="text" placeholder="#タグ／記事URL／マガジンURL／@ID" autocomplete="off" aria-label="巡回元"><button class="primary" id="startSource" disabled>巡回開始</button></div>
<div class="top-actions"><button id="saveSource" disabled>☆ 条件を保存</button><button id="showFavorites">★ お気に入り</button></div>
<div id="status" class="status" role="status">noteログイン状態を確認中…</div>
<details class="more-controls"><summary>上限・詳細設定</summary><div class="limits"><div id="likeLimit" class="pill">♡ 1h — / 24h —</div><div id="magLimit" class="pill">📚 1h — / 24h —</div></div><div class="top-actions"><button id="preloadMags" disabled>マガジン先読み</button><button id="reset" class="danger">巡回をリセット</button></div></details>
</section>
<section id="current" class="card hidden"></section></main>
<footer class="footer"><button id="prev">戻る</button><button id="next">次へ</button></footer>
<section id="previewModal" class="modal"><div class="modalhead"><button data-close="previewModal">戻る</button><b>プレビュー</b></div><div id="previewBody" class="modalbody"></div></section>
<section id="creatorModal" class="modal"><div class="modalhead"><button data-close="creatorModal">戻る</button><b>クリエイター</b></div><div id="creatorBody" class="modalbody"></div></section>
<section id="magModal" class="modal"><div class="modalhead"><button data-close="magModal">戻る</button><b>マガジン追加</b></div><div id="magBody" class="modalbody"></div></section><section id="favModal" class="modal"><div class="modalhead"><button data-close="favModal">戻る</button><b>⭐ お気に入り</b></div><div id="favBody" class="modalbody"></div></section>
</body></html>`;

document.documentElement.innerHTML = HTML.replace(/^<!doctype html><html[^>]*>|<\/html>$/g,'');
document.documentElement.style.visibility = 'visible';

const $ = (s,r=document) => r.querySelector(s);
const $$ = (s,r=document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function loadRaw(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function saveRaw(key,v){try{localStorage.setItem(key,JSON.stringify(v))}catch{}}
let state = loadRaw(STORE) || loadRaw(PREV_STORE) || loadRaw(OLD_STORE) || {source:'',queue:[],index:0,me:'',likedNow:{},likeSent:{}};
state.queue = Array.isArray(state.queue)?state.queue:[];
state.index = Math.max(0,Number(state.index)||0);
state.likedNow = state.likedNow||{};
state.likeSent = state.likeSent||{};
saveState();
let ready=false,busy=false,magBusy=false,currentMags=[],myRecentArticles=[];
const MAG_CACHE_KEY='noteBoostMagazineCacheV640', COMMENT_EP_KEY='noteBoostCommentLikeEndpointV640';
const CREATOR_LIKE_HISTORY_KEY='noteBoostCreatorLikeHistoryV650';
function creatorLikeHistory(){const v=loadRaw(CREATOR_LIKE_HISTORY_KEY);return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}
function creatorWasLiked(id){const k=String(id||'').toLowerCase();return !!(k&&creatorLikeHistory()[k])}
function markCreatorLiked(id,key,kind='liked'){const k=String(id||'').toLowerCase();if(!k)return;const h=creatorLikeHistory();h[k]={at:Date.now(),noteKey:String(key||''),kind};saveRaw(CREATOR_LIKE_HISTORY_KEY,h)}
function recentSort(a,b){return String(b?.publishAt||'').localeCompare(String(a?.publishAt||''))}
async function recentFiveForCreator(id,source){const r=await creatorContents(id,1),items=(r.items||[]).sort(recentSort).slice(0,5);if(!items.length)return null;const duplicate=creatorWasLiked(id)||items.some(x=>x.liked===true);const first=items.find(x=>x.liked===false)||items.find(x=>x.liked!==true)||items[0];return{...first,source,recentArticles:items,duplicateCreator:duplicate}}
let commentLikeEndpoint=Number(localStorage.getItem(COMMENT_EP_KEY));if(!Number.isInteger(commentLikeEndpoint))commentLikeEndpoint=-1;
const FAVORITES_KEY = 'noteBoostOwnerFavoritesV670';
function favorites() {
  const raw=loadRaw(FAVORITES_KEY)||{};
  return {
    sources:Array.isArray(raw.sources)?raw.sources.map(x=>typeof x==='string'?x:x?.value).filter(Boolean):[],
    creators:Array.isArray(raw.creators)?raw.creators.filter(x=>x?.id):[],
    articles:Array.isArray(raw.articles)?raw.articles.filter(x=>x?.key&&x?.urlname):[]
  };
}
function storeFavorites(v){saveRaw(FAVORITES_KEY,v)}
function saveFavoriteSource(value){
  const raw=String(value||'').trim(),parsed=sourceType(raw);
  if(!parsed){status('保存する巡回条件を入力してください',true);return}
  const v=favorites();v.sources=[raw,...v.sources.filter(x=>x!==raw)].slice(0,100);
  storeFavorites(v);status('⭐ 巡回条件を保存しました：'+raw);
}
function saveFavoriteCreator(person){
  const id=String(person?.urlname||person?.id||'').replace(/^@/,'').toLowerCase();
  if(!/^[a-z0-9_-]+$/.test(id))return;
  const v=favorites();
  v.creators=[{id,name:String(person?.name||id),savedAt:Date.now()},...v.creators.filter(x=>x.id!==id)].slice(0,200);
  storeFavorites(v);status('⭐ @'+id+' をお気に入りに保存しました');
}
function saveFavoriteArticle(){
  const x=current();if(!x)return;
  const v=favorites();
  v.articles=[{key:x.key,urlname:x.urlname,title:x.title||x.key,thumb:x.thumb||'',savedAt:Date.now()},...v.articles.filter(y=>y.key!==x.key)].slice(0,300);
  storeFavorites(v);status('⭐ 記事をお気に入りに保存しました');
}
function openFavorites(){
  const v=favorites(),root=$('#favBody');if(!root)return;
  const sourceTypeLabel=x=>{const p=sourceType(x);return p?.type==='tag'?'#タグ':p?.type==='mag'?'マガジン':p?.type==='creator'?'人物':'記事URL'};
  root.innerHTML='<div class="fav-group"><h2>巡回条件 <small>'+v.sources.length+'件</small></h2>'+
    (v.sources.map((x,i)=>'<div class="fav-item"><span class="fav-name"><small>'+sourceTypeLabel(x)+'</small><b>'+esc(x)+'</b></span><button data-fav-start="'+i+'">巡回</button><button aria-label="保存解除" data-fav-remove-source="'+i+'">×</button></div>').join('')||'<p class="fav-empty">未登録</p>')+'</div>'+
    '<div class="fav-group"><h2>クリエイター <small>'+v.creators.length+'人</small></h2>'+
    (v.creators.map((x,i)=>'<div class="fav-item"><span class="fav-name"><b>'+esc(x.name||x.id)+'</b><small>@'+esc(x.id)+'</small></span><button data-fav-creator="'+i+'">巡回</button><button data-fav-profile="'+i+'">人物</button><button aria-label="保存解除" data-fav-remove-creator="'+i+'">×</button></div>').join('')||'<p class="fav-empty">未登録</p>')+'</div>'+
    '<div class="fav-group"><h2>記事 <small>'+v.articles.length+'件</small></h2>'+
    (v.articles.map((x,i)=>'<div class="fav-item"><span class="fav-name"><b>'+esc(x.title||x.key)+'</b><small>@'+esc(x.urlname)+'</small></span><button data-fav-article-start="'+i+'">巡回</button><button data-fav-article="'+i+'">記事</button><button aria-label="保存解除" data-fav-remove-article="'+i+'">×</button></div>').join('')||'<p class="fav-empty">未登録</p>')+'</div>';
  function start(val){$('#source').value=val;closeModal('favModal');void loadSource()}
  for(const b of root.querySelectorAll('[data-fav-start]'))b.onclick=()=>start(favorites().sources[Number(b.dataset.favStart)]);
  for(const b of root.querySelectorAll('[data-fav-creator]'))b.onclick=()=>start('@'+favorites().creators[Number(b.dataset.favCreator)]?.id);
  for(const b of root.querySelectorAll('[data-fav-profile]'))b.onclick=()=>{const x=favorites().creators[Number(b.dataset.favProfile)];if(x)goOut('https://note.com/'+encodeURIComponent(x.id))};
  for(const b of root.querySelectorAll('[data-fav-article-start]'))b.onclick=()=>{const x=favorites().articles[Number(b.dataset.favArticleStart)];if(x)start('https://note.com/'+encodeURIComponent(x.urlname)+'/n/'+encodeURIComponent(x.key))};
  for(const b of root.querySelectorAll('[data-fav-article]'))b.onclick=()=>{const x=favorites().articles[Number(b.dataset.favArticle)];if(x)goOut('https://note.com/'+encodeURIComponent(x.urlname)+'/n/'+encodeURIComponent(x.key))};
  for(const type of ['source','creator','article']){
    for(const b of root.querySelectorAll('[data-fav-remove-'+type+']')){
      b.onclick=()=>{
        const next=favorites(),index=Number(b.dataset['favRemove'+type[0].toUpperCase()+type.slice(1)]);
        next[type==='source'?'sources':type==='creator'?'creators':'articles'].splice(index,1);
        storeFavorites(next);openFavorites();
      };
    }
  }
  showModal('favModal');
}
function saveState(){saveRaw(STORE,state)}
function current(){return state.queue[state.index]||null}
function status(t,bad=false){const e=$('#status');if(!e)return;e.textContent=t;e.className='status '+(bad?'bad':'ok')}
function setMsg(t){const e=$('#magMsg');if(e)e.textContent=t}
function fmtClock(t){return new Date(t).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}
function noteObj(j){const d=j?.data??j??{};return d.note||d}
function userOf(n){return n?.user||n?.creator||n?.note_user||{}}
function keyOf(n){return String(n?.key||n?.note_key||n?.noteKey||n?.slug||'')}
function thumbOf(n){for(const x of [n?.eyecatch_url,n?.eyecatch,n?.eyecatch_image,n?.eyecatchImage,n?.image_url,n?.thumbnail_url,n?.cover_image_url,n?.image?.url,n?.thumbnail?.url])if(typeof x==='string'&&/^https?:\/\//.test(x))return x;return''}
function readLiked(j){for(const o of [j,j?.data,j?.note,j?.data?.note].filter(Boolean))for(const k of ['isLiked','is_liked','liked','hasLiked'])if(typeof o?.[k]==='boolean')return o[k];return null}
function readLikeCount(j){for(const o of [j?.data?.note,j?.data,j?.note,j].filter(Boolean)){const n=Number(o?.likeCount??o?.like_count??o?.likes_count??o?.likesCount);if(Number.isFinite(n))return n}return null}
async function api(path,init={}){const timeoutMs=Math.max(1500,Number(init.timeoutMs)||20000),{timeoutMs:_tm,...reqInit}=init,ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),timeoutMs);try{const r=await fetch(path,{credentials:'include',cache:'no-store',...reqInit,headers:{accept:'application/json',...(reqInit.headers||{})},signal:ctl.signal});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={text}}if(!r.ok){const e=new Error(`HTTP ${r.status}`);e.status=r.status;e.body=data;const ra=r.headers.get('retry-after');e.retryAfter=ra?(/^\d+$/.test(ra)?Number(ra)*1000:Math.max(0,Date.parse(ra)-Date.now())):0;throw e}return data}catch(e){if(e?.name==='AbortError'){const x=new Error('API応答タイムアウト');x.code='TIMEOUT';throw x}throw e}finally{clearTimeout(tm)}}
async function textReq(raw){const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),20000);try{const r=await fetch(raw,{credentials:'include',cache:'no-store',signal:ctl.signal});if(!r.ok){const e=new Error(`HTTP ${r.status}`);e.status=r.status;throw e}return await r.text()}finally{clearTimeout(tm)}}
function hist(kind){try{return JSON.parse(localStorage.getItem(LIMIT_PREFIX+kind)||'[]').filter(x=>Date.now()-Number(x.t)<86400000)}catch{return[]}}
function saveHist(kind,a){localStorage.setItem(LIMIT_PREFIX+kind,JSON.stringify(a.slice(-500)))}
function pushHist(kind,key){const a=hist(kind);a.push({t:Date.now(),key});saveHist(kind,a)}
function guard(kind){try{return JSON.parse(localStorage.getItem(LIMIT_PREFIX+'guard:'+kind)||'{"until":0,"reason":""}')}catch{return{until:0,reason:''}}}
function setGuard(kind,until,reason){localStorage.setItem(LIMIT_PREFIX+'guard:'+kind,JSON.stringify({until,reason}))}
function limitStatus(kind){const a=hist(kind),now=Date.now(),hour=a.filter(x=>now-Number(x.t)<3600000),g=guard(kind);let until=Number(g.until||0);if(hour.length>=18)until=Math.max(until,Number(hour[0]?.t||0)+3600000);if(a.length>=80)until=Math.max(until,Number(a[0]?.t||0)+86400000);return{hour:hour.length,day:a.length,until}}
function refreshLimits(){for(const [kind,id,icon] of [['likes','#likeLimit','♡'],['mags','#magLimit','📚']]){const s=limitStatus(kind),extra=s.until>Date.now()?`・解除 ${fmtClock(s.until)}`:'';$(id).textContent=`${icon} 1h ${s.hour}/18・24h ${s.day}/80${extra}`}}
function enforce(kind){const s=limitStatus(kind);if(s.until>Date.now()){const e=new Error(`安全上限により保護中・解除 ${fmtClock(s.until)}`);e.code='LIMIT';throw e}}
function formatError(e){if(e?.code==='LOGIN')return'ログイン未確認：noteへログインしてください';if(e?.status===401)return'401：noteログインを確認してください';if(e?.status===403)return'403：note側で操作が制限されています';if(e?.status===429)return'429：操作間隔の制限を検出しました';if(e?.code==='TIMEOUT')return'API応答タイムアウト';return String(e?.message||e||'不明なエラー')}
async function who(){const j=await api('/api/v2/current_user'),d=j?.data??j??{},u=d.user||d,id=String(u.urlname||u.url_name||u.username||'').replace(/^@/,'');if(!id){const e=new Error('noteへログインしてください');e.code='LOGIN';throw e}return{urlname:id,name:String(u.nickname||u.name||id),icon:u.profile_image_url||u.profileImageUrl||u.icon_url||''}}
async function rssArticles(url,restrictId=''){
  const xml=await textReq(url);
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror'))throw Error('RSS解析エラー');
  const out=[];
  for(const item of doc.querySelectorAll('item')){
    const link=String(item.querySelector('link')?.textContent||'').trim();
    let u;
    try{u=new URL(link)}catch{continue}
    const p=u.pathname.split('/').filter(Boolean),n=p.indexOf('n');
    if(u.hostname!=='note.com'||n<1||!p[n+1])continue;
    const id=p[n-1].toLowerCase(),key=p[n+1];
    if(restrictId&&id!==restrictId.toLowerCase())continue;
    const image=item.getElementsByTagName('media:thumbnail')[0]?.textContent||
      item.getElementsByTagName('media:content')[0]?.getAttribute('url')||
      item.querySelector('enclosure')?.getAttribute('url')||'';
    out.push({key,id:null,urlname:id,name:id,title:item.querySelector('title')?.textContent?.trim()||key,
      thumb:image,likeCount:null,publishAt:item.querySelector('pubDate')?.textContent||'',liked:null,source:'RSS'});
  }
  return out;
}
async function creatorContents(id,page=1){
  let apiError=null,apiItems=[];
  try{
    const j=await api('/api/v2/creators/'+encodeURIComponent(id)+'/contents?kind=note&page='+page);
    const d=j?.data??j??{};
    const candidates=[d.contents,d.notes,d.items,d.contents?.contents,d.contents?.notes,d.contents?.items,d.note_list,d.noteList,j?.contents,j?.notes,Array.isArray(d)?d:null];
    apiItems=candidates.find(x=>Array.isArray(x)&&x.length)||[];
    const items=apiItems.map(v=>v?.note||v?.content||v).map(n=>{
      const u=userOf(n),key=keyOf(n);
      return{key,id:n.id??n.note_id??n.noteId??null,urlname:String(u.urlname||u.url_name||u.username||id),
        name:String(u.nickname||u.name||id),title:String(n.name||n.title||key),thumb:thumbOf(n),
        likeCount:Number(n.likeCount??n.like_count??n.likes_count??n.likesCount??0)||0,
        publishAt:n.publishAt||n.publish_at||n.createdAt||n.created_at||'',liked:readLiked(n),rawUser:u};
    }).filter(x=>x.key);
    if(items.length)return{items,last:Boolean(d.isLastPage??d.is_last_page??false)};
  }catch(e){apiError=e}
  if(page>1){if(apiError)throw apiError;return{items:[],last:true}}
  try{
    const items=await rssArticles('https://note.com/'+encodeURIComponent(id)+'/rss',id);
    if(items.length)return{items,last:true,fromRss:true};
  }catch(e){if(!apiError)apiError=e}
  if(apiError)throw apiError;
  return{items:[],last:true};
}
async function creatorProfile(id){for(const ep of [`/api/v2/creators/${encodeURIComponent(id)}`,`/api/v1/creators/${encodeURIComponent(id)}`]){try{const j=await api(ep),d=j?.data??j??{},u=d.creator||d.user||d;return{id,name:String(u.nickname||u.name||id),icon:u.profile_image_url||u.profileImageUrl||u.icon_url||'',bio:String(u.bio||u.description||u.profile||''),followers:Number(u.followers_count??u.follower_count??u.followersCount??0)||0,following:Number(u.following_count??u.followingCount??0)||0,articleCount:Number(u.note_count??u.notes_count??u.noteCount??0)||0}}catch{}}const c=await creatorContents(id,1),u=c.items[0]?.rawUser||{};return{id,name:String(u.nickname||u.name||id),icon:u.profile_image_url||u.profileImageUrl||u.icon_url||'',bio:String(u.bio||u.description||''),followers:Number(u.followers_count??u.follower_count??0)||0,following:Number(u.following_count??0)||0,articleCount:0}}
async function noteDetail(key){const j=await api(`/api/v3/notes/${encodeURIComponent(key)}`),n=noteObj(j),u=userOf(n);return{key:keyOf(n)||key,id:n.id??n.note_id??n.noteId??null,title:String(n.name||n.title||key),urlname:String(u.urlname||u.url_name||u.username||''),name:String(u.nickname||u.name||''),thumb:thumbOf(n),likeCount:readLikeCount(j)||0,liked:readLiked(j),body:n.body||n.body_html||n.bodyHtml||n.content||n.content_html||'',raw:j}}
function sourceType(raw){const s=String(raw||'').trim();if(s.startsWith('#'))return{type:'tag',tag:s.replace(/^#+/,'')};if(/^https?:\/\//i.test(s)){try{const u=new URL(s),p=u.pathname.split('/').filter(Boolean),ni=p.indexOf('n'),mi=p.indexOf('m');if(u.hostname==='note.com'&&ni>=1&&p[ni+1])return{type:'note',key:p[ni+1],url:u.href};if(u.hostname==='note.com'&&mi>=1&&p[mi+1])return{type:'mag',url:u.href};if(u.hostname==='note.com'&&p.length===1)return{type:'creator',id:p[0]}}catch{}return null}const id=s.replace(/^@/,'');return /^[A-Za-z0-9_.-]+$/.test(id)?{type:'creator',id}:null}
async function mapLimit(items,lim,fn){const out=new Array(items.length);let i=0;async function w(){for(;;){const n=i++;if(n>=items.length)return;try{out[n]=await fn(items[n],n)}catch{out[n]=null}}}await Promise.all(Array.from({length:Math.min(lim,items.length)},w));return out}
async function latestForCreator(id,source){return recentFiveForCreator(id,source)}
function normalizeUsers(j){const d=j?.data??j??{},a=Array.isArray(d)?d:(d.likes||d.users||d.contents||d.likers||[]);return(Array.isArray(a)?a:[]).map(x=>x?.user||x?.creator||x).filter(Boolean)}
function cleanNoticeText(v){return String(v??'').replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim()}
function noticeAstText(v,depth=0){if(depth>8||v==null)return'';if(typeof v==='string')return cleanNoticeText(v);if(Array.isArray(v))return cleanNoticeText(v.slice(0,120).map(x=>noticeAstText(x,depth+1)).join(' '));if(typeof v!=='object')return'';if(typeof v.value==='string')return cleanNoticeText(v.value);if(typeof v.text==='string')return cleanNoticeText(v.text);return noticeAstText(v.children||v.content||v.body||[],depth+1)}
function noticeText(n){for(const k of ['message','text','body','title','label','description','content','display_text','displayText','notice_text','noticeText','notification_text','notificationText','summary']){const v=n?.[k];if(typeof v==='string'&&cleanNoticeText(v))return cleanNoticeText(v)}return noticeAstText(n?.body_ast??n?.bodyAst)}
function noticeActor(n){const a=(Array.isArray(n?.action_users)?n.action_users.find(Boolean):null)||(Array.isArray(n?.actionUsers)?n.actionUsers.find(Boolean):null)||n?.actor||n?.user||n?.creator||n?.from_user||n?.fromUser||n?.sender||{};const id=String(a?.urlname||a?.url_name||a?.username||n?.actor_urlname||n?.actorUrlname||'').replace(/^@/,'').toLowerCase();return{id,user:a}}
function noticeLikeType(n){const kind=cleanNoticeText(n?.kind||n?.type||n?.event_type||n?.eventType||'').toLowerCase(),txt=noticeText(n),hay=kind+' '+txt;if(!/(?:スキ|like|liked)/i.test(hay))return'';return/(?:コメント|comment|返信|reply)/i.test(hay)?'コメントスキ':'記事スキ'}
async function allLikePeople(max=500){const people=new Map();for(let page=1;page<=60&&people.size<max;page++){status(`💗 全スキを取得中 ${people.size}/${max}`);let j;try{j=await api(`/api/v3/notices?page=${page}&per=12&body_ast=1`,{timeoutMs:8000})}catch(e){if(page===1)throw e;break}const a=Array.isArray(j?.data)?j.data:[];if(!a.length)break;for(const n of a){const via=noticeLikeType(n);if(!via)continue;const act=noticeActor(n),id=act.id;if(!id||id===state.me)continue;const prev=people.get(id);if(prev){const set=new Set(String(prev.via||'').split('＋').filter(Boolean));set.add(via);prev.via=[...set].join('＋')}else people.set(id,{id,user:act.user,via});if(people.size>=max)break}if(a.length<12)break}return[...people.values()]}
async function articleLikerPeople(p,max=500){const out=[],seen=new Set();for(let page=1;page<=10&&out.length<max;page++){status(`❤️ 記事スキを取得中 ${out.length}/${max}`);const j=await api(`/api/v3/notes/${encodeURIComponent(p.key)}/likes?page=${page}&per_page=100`),a=normalizeUsers(j);for(const u of a){const id=String(u.urlname||u.url_name||u.username||'').toLowerCase();if(id&&id!==state.me&&!seen.has(id)){seen.add(id);out.push({id,user:u,via:'記事スキ'})}if(out.length>=max)break}if(a.length<100)break}return out}
function normalizeComments(j){const d=j?.data??j??{};if(Array.isArray(j?.data))return j.data;if(Array.isArray(d?.comments))return d.comments;if(Array.isArray(j?.comments))return j.comments;return[]}
function commentAuthor(c){const u=c?.user||c?.creator||{};return String(u.urlname||u.url_name||u.username||'').toLowerCase()}
function commentLikeCount(c){return Number(c?.like_count??c?.likeCount??c?.likes_count??c?.likesCount??0)||0}
function nestedCommentLikers(c){for(const v of [c?.likers,c?.likes,c?.liked_users,c?.like_users,c?.users_who_liked,c?.likedUsers,c?.likeUsers]){const a=Array.isArray(v)?v:(Array.isArray(v?.data)?v.data:null);if(a?.length)return a.map(x=>x?.user||x?.creator||x).filter(Boolean)}return[]}
function commentLikePaths(noteKey,c){const ck=String(c?.key||c?.comment_key||c?.commentKey||''),raw=[c?.likes_url,c?.like_users_url,c?.likers_url,c?.links?.likes].filter(x=>typeof x==='string'&&x);const guessed=[`/api/v3/notes/${encodeURIComponent(noteKey)}/note_comments/${encodeURIComponent(ck)}/likes`,`/api/v3/note_comments/${encodeURIComponent(ck)}/likes`,`/api/v3/comments/${encodeURIComponent(ck)}/likes`];return[...raw,...guessed]}
async function commentLikers(noteKey,c){const nested=nestedCommentLikers(c);if(nested.length)return nested;if(commentLikeCount(c)<=0)return[];const paths=commentLikePaths(noteKey,c),idxs=commentLikeEndpoint>=0?[commentLikeEndpoint,...paths.map((_,i)=>i).filter(i=>i!==commentLikeEndpoint)]:paths.map((_,i)=>i);for(const i of idxs){const p=paths[i];if(!p)continue;try{const j=await api(p,{timeoutMs:6000}),a=normalizeUsers(j);if(a.length){commentLikeEndpoint=i;try{localStorage.setItem(COMMENT_EP_KEY,String(i))}catch{}return a}}catch{}}return[]}
async function noteComments(noteKey,max=120){const out=[],seen=new Set();let page=1,v3Failed=false;for(let n=0;n<5&&out.length<max;n++){status(`💬 コメントを取得中 ${out.length}/${max}`);let j;try{j=await api(`/api/v3/notes/${encodeURIComponent(noteKey)}/note_comments?order=newest&page=${page}&per_page=50`)}catch(e){v3Failed=true;break}const a=normalizeComments(j);for(const c of a){const k=String(c?.key||c?.comment_key||c?.id||'');if(k&&!seen.has(k)){seen.add(k);out.push(c)}if(out.length>=max)break}const next=j?.next_page??j?.data?.next_page??null;if(!a.length||a.length<50||next==null)break;page=Number(next)||page+1}if(!out.length&&v3Failed){try{const d=await noteDetail(noteKey),id=d.id;if(id){let maxId;for(let n=0;n<5&&out.length<max;n++){const q=maxId?`?max_id=${encodeURIComponent(maxId)}`:'';const j=await api(`/api/v1/note/${encodeURIComponent(id)}/comments${q}`),a=normalizeComments(j);for(const c of a){const k=String(c?.key||c?.id||'');if(k&&!seen.has(k)){seen.add(k);out.push(c)}if(out.length>=max)break}if(!a.length||!Number(j?.rest_comment_count||0))break;const ids=a.map(c=>Number(c?.id)).filter(Number.isFinite);if(!ids.length)break;maxId=Math.min(...ids)}}}catch{}}return out}
async function likedCommentAuthorPeople(p,max=500){const comments=(await noteComments(p.key,120)).filter(c=>commentAuthor(c)&&commentAuthor(c)!==state.me&&commentLikeCount(c)>0),people=new Map();for(const c of comments){const id=commentAuthor(c),u=c?.user||c?.creator||{};if(!id)continue;const prev=people.get(id);if(prev){prev.commentLikes=Number(prev.commentLikes||0)+commentLikeCount(c);prev.hits=Number(prev.hits||1)+1}else people.set(id,{id,user:u,via:'スキ付きコメント',commentLikes:commentLikeCount(c),hits:1});if(people.size>=max)break}status(`💬 スキ付きコメント投稿者 ${people.size}人を取得`);return[...people.values()]}
async function sourceFromCirculation(p,max=500){if(!p?.key)throw new Error('記事一覧から巡回する記事を選んでください');const people=new Map(),add=x=>{const id=String(x?.id||'').toLowerCase();if(!id||id===state.me)return;const prev=people.get(id);if(prev){const set=new Set(String(prev.via||'').split('＋').filter(Boolean));set.add(x.via);prev.via=[...set].join('＋');prev.hits=Number(prev.hits||1)+Number(x.hits||1);prev.commentLikes=Number(prev.commentLikes||0)+Number(x.commentLikes||0)}else people.set(id,{...x,id,hits:Number(x.hits||1)})};for(const x of await articleLikerPeople(p,max))add(x);for(const x of await likedCommentAuthorPeople(p,max))add(x);const ids=[...people.keys()].slice(0,max);status(`🔁 選択記事から ${ids.length}人を循環対象に作成中…`);return(await mapLimit(ids,4,async id=>{const meta=people.get(id),x=await latestForCreator(id,meta?.via||'記事スキ/スキ付きコメント');return x?{...x,source:meta?.via||'記事スキ/スキ付きコメント',sourceHits:Number(meta?.hits||1),commentLikes:Number(meta?.commentLikes||0),duplicateCreator:Boolean(x.duplicateCreator||creatorWasLiked(id))}:null})).filter(Boolean)}
async function sourceFromArticle(p,max=500){return sourceFromCirculation(p,max)}
async function sourceFromMagazine(p,max=500){
  const creators=new Map(),seenPages=new Set(),rssFallback=[];
  try{
    for(let page=1;page<=30&&creators.size<max;page++){
      const u=new URL(p.url);u.searchParams.set('page',String(page));
      status('📚 マガジン内の記事を確認中… '+creators.size+'人');
      const html=await textReq(u.href);
      const doc=new DOMParser().parseFromString(html,'text/html'),keys=[];
      for(const a of doc.querySelectorAll('a[href]')){
        let link;
        try{link=new URL(a.getAttribute('href'),u)}catch{continue}
        const parts=link.pathname.split('/').filter(Boolean),idx=parts.indexOf('n');
        if(link.hostname!=='note.com'||idx!==1||!parts[2])continue;
        const id=parts[0].toLowerCase(),key=parts[2];keys.push(key);
        if(id&&id!==state.me&&!creators.has(id))creators.set(id,key);
        if(creators.size>=max)break;
      }
      const signature=[...new Set(keys)].slice(0,10).join('|');
      if(!signature||seenPages.has(signature))break;
      seenPages.add(signature);
    }
  }catch(e){if(creators.size)status('📚 一部のページのみ取得しました');}
  if(!creators.size){
    try{
      const url=p.url.replace(/\/+$/,'')+'/rss';
      const items=await rssArticles(url);
      for(const x of items){
        if(x.urlname&&x.urlname!==state.me&&!creators.has(x.urlname))creators.set(x.urlname,x.key);
        if(x.urlname!==state.me)rssFallback.push({...x,source:'マガジンRSS'});
      }
    }catch(e){status('マガジンの記事一覧を取得できませんでした：'+formatError(e),true)}
  }
  const ids=[...creators.keys()].slice(0,max);
  const q=(await mapLimit(ids,4,id=>latestForCreator(id,'マガジンURL'))).filter(Boolean);
  return q.length?q:[...new Map(rssFallback.map(x=>[x.urlname,x])).values()];
}
async function sourceFromTag(p,max=500){
  const out=[],seenCreators=new Set();let originalError=null;
  try{
    for(let page=1;page<=50&&out.length<max;page++){
      status('🏷 #'+p.tag+' を検索中… '+out.length+'人');
      const j=await api('/api/v3/hashtags/'+encodeURIComponent(p.tag)+'/notes?order=new&page='+page);
      const d=j?.data??j??{},x=d.notes||d.contents||j?.notes||[];
      const arr=Array.isArray(x)?x:Array.isArray(x.contents)?x.contents:Array.isArray(x.notes)?x.notes:[];
      if(!arr.length)break;
      for(const n0 of arr){
        const n=n0.note||n0.content||n0,u=userOf(n),id=String(u.urlname||u.url_name||u.username||'').toLowerCase(),key=keyOf(n);
        if(!id||id===state.me||!key||seenCreators.has(id))continue;
        seenCreators.add(id);
        out.push({key,id:n.id??n.note_id??null,urlname:id,name:String(u.nickname||u.name||id),
          title:String(n.name||n.title||key),thumb:thumbOf(n),likeCount:Number(n.likeCount??n.like_count??0)||0,
          publishAt:n.publishAt||n.publish_at||'',source:'#'+p.tag});
        if(out.length>=max)break;
      }
      if(arr.length<20)break;
    }
  }catch(e){originalError=e}
  if(!out.length){
    try{
      const items=await rssArticles('https://note.com/hashtag/'+encodeURIComponent(p.tag)+'/rss');
      for(const x of items){
        if(!x.urlname||x.urlname===state.me||seenCreators.has(x.urlname))continue;
        seenCreators.add(x.urlname);
        out.push({...x,source:'#'+p.tag+'（RSS）'});
        if(out.length>=max)break;
      }
    }catch(e){if(!originalError)originalError=e}
  }
  if(!out.length&&originalError)throw originalError;
  return out;
}
async function sourceFromCreator(p){
  status('@'+p.id+' の記事を取得中…');
  const list=[];
  for(let page=1;page<=20&&list.length<500;page++){
    const r=await creatorContents(p.id,page);
    const next=r.items||[];
    list.push(...next.filter(x=>x.key));
    if(r.last||!next.length||next.length<20)break;
  }
  const items=[...new Map(list.map(x=>[x.key,x])).values()];
  items.sort((a,b)=>{
    const va=a.likeCount,vb=b.likeCount;
    return va!=null&&vb!=null&&va!==vb?vb-va:recentSort(a,b);
  });
  return items.map(x=>({...x,source:'@'+p.id+'｜クリエイター記事',duplicateCreator:creatorWasLiked(p.id)||x.liked===true}));
}
function selectedArticleKey(){const raw=String($('#source')?.value||state.source||'');try{const u=new URL(raw,location.origin),p=u.pathname.split('/').filter(Boolean),i=p.indexOf('n');return i>=1?String(p[i+1]||''):''}catch{return''}}

async function loadSource(){if(busy)return;const raw=$('#source').value.trim(),p=sourceType(raw);if(!p){status('#タグ・記事URL・マガジンURL・クリエイターIDを入力してください',true);return}busy=true;$('#startSource').disabled=true;try{const me=await who();if(me.urlname.toLowerCase()!=='ss_yr')throw Error('運営者本人のみ使用できます');state.me=me.urlname.toLowerCase();let q=p.type==='note'?await sourceFromArticle(p):p.type==='tag'?await sourceFromTag(p):p.type==='mag'?await sourceFromMagazine(p):p.type==='creator'?await sourceFromCreator(p):[];q=q.filter(x=>x?.key&&x?.urlname&&x.urlname.toLowerCase()!==state.me);if(p.type!=='creator')q=[...new Map(q.map(x=>[x.urlname.toLowerCase(),x])).values()];if(!q.length){status('対象を取得できませんでした。条件を確認してください。前の巡回リストは保持しています。',true);return}state.source=raw;state.queue=q;state.index=0;saveState();await render();status('✅ '+q.length+'件の巡回対象を取得しました')}catch(e){status(formatError(e),true)}finally{busy=false;$('#startSource').disabled=false}}
function stateText(detail,x){const dup=Boolean(x?.duplicateCreator||creatorWasLiked(x?.urlname)||detail?.liked===true);if(state.likedNow[x.key])return'❤️ この人は今回スキ済み｜⚠ 重複あり｜マガジン追加できます';if(detail?.liked===true)return'💗 この人は元からスキ済み｜⚠ 重複あり｜マガジン追加できます';if(state.likeSent[x.key])return'❤️ スキ送信済み・反映確認待ち｜⚠ 重複あり';if(dup)return'⚠ 重複あり｜この人には以前スキ済み。別の最新5記事も確認できます';return'♡ この人は未スキ'}
async function render(){const box=$('#current'),x=current();refreshLimits();if(!x){box.classList.add('hidden');status(state.source?'巡回対象がありません':'巡回元を入力してください');return}box.classList.remove('hidden');let detail=null,profile=null;try{[detail,profile]=await Promise.all([noteDetail(x.key),creatorProfile(x.urlname)]);if(detail?.liked===true){x.duplicateCreator=true;markCreatorLiked(x.urlname,x.key,state.likeSent[x.key]?'tool-confirmed':'preexisting');if(state.likeSent[x.key]&&!state.likedNow[x.key]){state.likedNow[x.key]=true;delete state.likeSent[x.key];saveState()}}}catch(e){status(formatError(e),true)}const st=stateText(detail,x);box.innerHTML=`<div class="progress">${state.index+1}/${state.queue.length}｜${esc(x.source||state.source)}</div><div class="creator"><img class="tap" id="profileImg" src="${esc(profile?.icon||'')}"><div class="tap" id="profileName"><div class="name">${esc(profile?.name||x.name||x.urlname)}</div><div class="id">@${esc(x.urlname)}</div><div class="stats">フォロワー ${profile?.followers||'—'}・記事 ${profile?.articleCount||'—'}</div></div></div>${profile?.bio?`<div class="bio">${esc(profile.bio)}</div>`:''}<div class="state">${esc(st)}</div><div class="article"><h2>${esc(detail?.title||x.title)}</h2><div class="meta">記事スキ ${Number(detail?.likeCount??x.likeCount)||0}</div>${(detail?.thumb||x.thumb)?`<details class="media-optional"><summary>画像を表示</summary><img class="thumb" src="${esc(detail?.thumb||x.thumb)}" loading="lazy"></details>`:''}<div class="actions"><button id="likeBtn" ${(detail?.liked===true||state.likedNow[x.key]||state.likeSent[x.key])?'disabled':''}>${state.likedNow[x.key]?'❤️今回済':detail?.liked===true?'💗元から':state.likeSent[x.key]?'❤️送信済':'♡スキ'}</button><button id="openBtn">実記事</button><button id="previewBtn">プレビュー</button></div><div class="actions two"><button id="creatorBtn">📚 記事を見る</button><button id="magBtn">📚マガジン追加</button><button id="favoriteArticleBtn">⭐ 記事保存</button><button id="favoriteCreatorBtn">⭐ この人を保存</button></div></div>`;$('#likeBtn').onclick=likeCurrent;$('#openBtn').onclick=()=>goOut(`https://note.com/${encodeURIComponent(x.urlname)}/n/${encodeURIComponent(x.key)}`);$('#previewBtn').onclick=openPreview;$('#creatorBtn').onclick=openCreator;$('#magBtn').onclick=openMags;$('#favoriteArticleBtn').onclick=saveFavoriteArticle;$('#favoriteCreatorBtn').onclick=()=>saveFavoriteCreator(x);$('#profileImg').onclick=$('#profileName').onclick=()=>goOut(`https://note.com/${encodeURIComponent(x.urlname)}`)}
function withReturn(raw){const x=new URL(raw,location.origin);x.searchParams.set('boost_return','1');return x.href}
function goOut(raw){saveState();location.assign(withReturn(raw))}
async function likeCurrent(){if(busy)return;const x=current();if(!x)return;busy=true;const b=$('#likeBtn');try{enforce('likes');b.disabled=true;b.textContent='確認中…';const before=await api(`/api/v3/notes/${encodeURIComponent(x.key)}`),liked=readLiked(before),beforeCount=readLikeCount(before);if(liked===true){status('💗 元からスキ済み｜送信なし');await render();return}b.textContent='スキ中…';try{await api(`/api/v3/notes/${encodeURIComponent(x.key)}/likes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:'{}'})}catch(e){const body=JSON.stringify(e.body||'');if(/already|liked|exist/i.test(body)){status('💗 すでにスキ済み｜解除せず完了');await render();return}if(e.status===403)setGuard('likes',Date.now()+3600000,'403検出');if(e.status===429)setGuard('likes',Date.now()+Math.max(3600000,e.retryAfter||0),'429検出');throw e}state.likeSent[x.key]=true;pushHist('likes',x.key);saveState();let ok=false;for(const w of [300,800,1500,2500]){await sleep(w);try{const after=await api(`/api/v3/notes/${encodeURIComponent(x.key)}`),aLiked=readLiked(after),afterCount=readLikeCount(after);if(aLiked===true||(beforeCount!=null&&afterCount!=null&&afterCount>beforeCount)){ok=true;break}}catch{}}if(ok){state.likedNow[x.key]=true;x.duplicateCreator=true;markCreatorLiked(x.urlname,x.key,'tool');delete state.likeSent[x.key];saveState();status('❤️ スキ反映を確認しました｜次回この人は「⚠ 重複あり」と表示します')}else{status('❤️ スキは送信済み。反映表示は次回読み込みで再確認します')}await render()}catch(e){if(b){b.disabled=false;b.textContent='♡スキ'}status(formatError(e),true);refreshLimits()}finally{busy=false}}
function sanitizeHtml(html){const d=new DOMParser().parseFromString(`<div id="x">${html||''}</div>`,'text/html'),root=d.querySelector('#x');for(const n of root.querySelectorAll('script,style,iframe,object,embed,form'))n.remove();for(const n of root.querySelectorAll('*'))for(const a of [...n.attributes])if(/^on/i.test(a.name)||a.name==='srcdoc')n.removeAttribute(a.name);return root.innerHTML}
async function openPreview(){const x=current();if(!x)return;showModal('previewModal');$('#previewBody').innerHTML='読み込み中…';try{const d=await noteDetail(x.key);$('#previewBody').innerHTML=`${d.thumb?`<img class="thumb" src="${esc(d.thumb)}">`:''}<h2>${esc(d.title)}</h2><div class="meta">@${esc(d.urlname)}・♡${Number(d.likeCount||0)}</div><article style="margin-top:12px;line-height:1.8">${sanitizeHtml(d.body)||'<div class="empty">本文プレビューを取得できませんでした。</div>'}</article>`}catch(e){$('#previewBody').textContent=formatError(e)}}
async function openCreator(){const x=current();if(!x)return;showModal('creatorModal');$('#creatorBody').innerHTML='記事一覧を読み込み中…';try{const p=await creatorProfile(x.urlname),r=await creatorContents(x.urlname,1),arts=(r.items||[]).sort((a,b)=>Number(b.likeCount||0)-Number(a.likeCount||0)||recentSort(a,b)).slice(0,30);$('#creatorBody').innerHTML=`<div class="creator"><img id="creatorProfileGo" class="tap" src="${esc(p.icon||'')}"><div><div class="name">${esc(p.name||x.urlname)}</div><div class="id">@${esc(x.urlname)}</div><div class="stats">フォロワー ${p.followers||'—'}・記事 ${p.articleCount||arts.length||'—'}</div></div></div><div class="bio">${esc(p.bio||'')}</div><div style="margin:14px 0 8px;font-weight:900">クリエイターの記事一覧</div>${arts.map(a=>`<div class="listitem"><div class="listrow">${a.thumb?`<img src="${esc(a.thumb)}">`:'<div></div>'}<div><b>${esc(a.title)}</b><div class="meta">${a.publishAt?new Date(a.publishAt).toLocaleDateString('ja-JP'):''}・♡${Number(a.likeCount||0)}${a.liked===true?'・💗スキ済み':''}</div><button data-open="https://note.com/${encodeURIComponent(x.urlname)}/n/${encodeURIComponent(a.key)}" style="margin-top:6px">実記事</button></div></div></div>`).join('')||'<div class="empty">記事を取得できませんでした</div>'}`;$('#creatorProfileGo').onclick=()=>goOut(`https://note.com/${encodeURIComponent(x.urlname)}`);for(const b of $('#creatorBody [data-open]'))b.onclick=()=>goOut(b.dataset.open)}catch(e){$('#creatorBody').textContent=formatError(e)}}
function magAdded(m,bel){for(const k of ['is_added','isAdded','has_note','hasNote','included','is_included','isIncluded','contains_note','containsNote','is_note_added','isNoteAdded','selected'])if(typeof m?.[k]==='boolean')return m[k];return bel.has(String(m?.key||''))}
function magThumb(m){for(const x of [m?.image_url,m?.imageUrl,m?.thumbnail_url,typeof m?.thumbnail==='string'?m.thumbnail:m?.thumbnail?.url,typeof m?.eyecatch==='string'?m.eyecatch:m?.eyecatch?.url,m?.cover_image_url,m?.coverImage,m?.cover_image?.url,typeof m?.image==='string'?m.image:m?.image?.url,m?.icon_url,m?.iconUrl,m?.icon?.url])if(typeof x==='string'&&/^https?:\/\//.test(x))return x;return''}
function magUrl(m,key){const raw=m?.url||m?.magazine_url||m?.magazineUrl;if(raw)return raw;const owner=m?.user?.urlname||m?.creator?.urlname||m?.owner?.urlname||state.me||'';return owner?`https://note.com/${encodeURIComponent(owner)}/m/${encodeURIComponent(key)}`:''}
async function loadMagazineBase(force=false){const cached=loadRaw(MAG_CACHE_KEY);if(!force&&cached?.t&&Date.now()-Number(cached.t)<600000&&Array.isArray(cached.items)&&cached.items.length)return cached.items;let arr=[];for(const ep of ['/api/v1/my/magazines?includes_editable=true','/api/v1/my/magazines']){try{const j=await api(ep,{timeoutMs:10000}),d=j?.data??j??{},a=d.magazines||j?.magazines||[];if(Array.isArray(a)&&a.length){arr=a;break}}catch{}}const items=arr.map(m=>({raw:m,key:String(m.key||''),name:String(m.name||m.title||m.key||''),count:Number(m.note_count??m.noteCount??m.notes_count??0)||0,image:magThumb(m),url:magUrl(m,String(m.key||'')),added:false})).filter(x=>x.key);if(items.length)saveRaw(MAG_CACHE_KEY,{t:Date.now(),items});return items}
async function preloadMagazineList(force=false,silent=false){const b=$('#preloadMags');if(b){b.disabled=true;b.textContent='📚 読込中…'}try{const a=await loadMagazineBase(force);if(!silent)status(a.length?`📚 マガジン ${a.length}誌を先読みしました`:'📚 マガジンを取得できませんでした',!a.length);return a}catch(e){if(!silent)status(formatError(e),true);return[]}finally{if(b){b.disabled=false;b.textContent='📚 マガジン先読み'}}}
async function editableMagazines(noteKey){const [baseR,mjR,njR]=await Promise.allSettled([loadMagazineBase(false),api(`/api/v1/my/magazines?includes_editable=true&note_key=${encodeURIComponent(noteKey)}`,{timeoutMs:12000}),api(`/api/v3/notes/${encodeURIComponent(noteKey)}`,{timeoutMs:12000})]),base=baseR.status==='fulfilled'?baseR.value:[],mj=mjR.status==='fulfilled'?mjR.value:{},nj=njR.status==='fulfilled'?njR.value:{},md=mj?.data??mj??{},arr=md.magazines||mj?.magazines||[],nd=nj?.data??nj??{},n=nd.note||nd,bel=new Set(nd.belonging_magazine_keys||n.belonging_magazine_keys||nj?.belonging_magazine_keys||[]),map=new Map(base.map(x=>[x.key,{...x,added:bel.has(x.key)}]));for(const m of (Array.isArray(arr)?arr:[])){const key=String(m.key||'');if(!key)continue;const prev=map.get(key)||{};map.set(key,{...prev,raw:m,key,name:String(m.name||m.title||prev.name||key),count:Number(m.note_count??m.noteCount??m.notes_count??prev.count??0)||0,image:magThumb(m)||prev.image||'',url:magUrl(m,key)||prev.url||'',added:magAdded(m,bel)})}return[...map.values()]}
async function ogImage(page){if(!page)return'';try{const html=await textReq(page),d=new DOMParser().parseFromString(html,'text/html');return d.querySelector('meta[property="og:image"]')?.content||d.querySelector('meta[name="twitter:image"]')?.content||''}catch{return''}}
async function hydrateMagThumbs(){const jobs=currentMags.filter(m=>!m.image&&m.url);await mapLimit(jobs,3,async m=>{m.image=await ogImage(m.url);const img=$(`#magBody [data-magrow="${CSS.escape(m.key)}"] img`),ph=$(`#magBody [data-magrow="${CSS.escape(m.key)}"] .magph`);if(m.image){if(img)img.src=m.image;else if(ph){const el=document.createElement('img');el.src=m.image;el.alt='';el.dataset.magopen=m.url;ph.replaceWith(el);el.onclick=()=>goOut(m.url)}}return m})}
function renderMagList(filter=''){const list=$('#magList');if(!list)return;const q=filter.trim().toLowerCase();list.innerHTML=currentMags.filter(m=>!q||m.name.toLowerCase().includes(q)).map(m=>`<label class="mag" data-magrow="${esc(m.key)}">${m.image?`<img src="${esc(m.image)}" data-magopen="${esc(m.url)}">`:'<div class="magph">📚</div>'}<input type="checkbox" data-magcheck value="${esc(m.key)}" ${m.added?'checked disabled':''}><span><b>${esc(m.name)}</b><div class="meta">${m.added?'✔ 追加済み':`${m.count}記事`}</div></span></label>`).join('')||'<div class="empty">該当するマガジンがありません</div>';for(const im of $$('#magList [data-magopen]'))im.onclick=e=>{e.preventDefault();e.stopPropagation();goOut(im.dataset.magopen)}}
async function openMags(){const x=current();if(!x)return;showModal('magModal');$('#magBody').innerHTML='マガジンを読み込み中…';try{const base=await loadMagazineBase(false);currentMags=base;$('#magBody').innerHTML=`<div class="mag-controls"><div class="bar"><input id="magSearch" placeholder="マガジン検索"><button id="magReload">更新</button></div><button id="magAddTop" class="mag-add">選択したマガジンへ追加</button><div id="magMsg" class="msg">追加状態を確認中…</div></div><div id="magList" class="mag-list"></div><button id="magAddBottom" class="mag-add">選択したマガジンへ追加</button>`;renderMagList();$('#magSearch').oninput=e=>renderMagList(e.target.value);$('#magAddTop').onclick=addSelectedMags;$('#magAddBottom').onclick=addSelectedMags;$('#magReload').onclick=async()=>{await preloadMagazineList(true,true);currentMags=await editableMagazines(x.key);renderMagList($('#magSearch')?.value||'');setMsg(`${currentMags.filter(m=>m.added).length}誌に追加済み`);void hydrateMagThumbs()};currentMags=await editableMagazines(x.key);renderMagList();setMsg(`${currentMags.filter(m=>m.added).length}誌に追加済み`);void hydrateMagThumbs()}catch(e){$('#magBody').textContent=formatError(e)}}
async function addSelectedMags(){if(magBusy)return;const x=current();if(!x)return;const keys=$$('#magBody [data-magcheck]:checked:not(:disabled)').map(e=>e.value);if(!keys.length){setMsg('追加先を選択してください');return}magBusy=true;for(const b of [$('#magAddTop'),$('#magAddBottom')].filter(Boolean)){b.disabled=true;b.textContent='追加中…'}let ok=0,already=0,fail=0;try{const detail=await noteDetail(x.key),noteId=x.id??detail.id;if(!noteId)throw new Error('記事IDを取得できません');for(const key of keys){try{enforce('mags');await api(`/api/v1/our/magazines/${encodeURIComponent(key)}/notes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:JSON.stringify({note_id:noteId,note_key:x.key})});pushHist('mags',`${key}:${x.key}`);ok++;const m=currentMags.find(z=>z.key===key);if(m)m.added=true;setMsg(`追加中… ${ok+already}/${keys.length}`)}catch(e){const body=JSON.stringify(e.body||'');if(/already|exist|included/i.test(body)||e.status===409||e.status===422){already++;const m=currentMags.find(z=>z.key===key);if(m)m.added=true;continue}if(e.status===403){setGuard('mags',Date.now()+3600000,'403検出');fail++;setMsg('403を検出したため停止しました');break}if(e.status===429){setGuard('mags',Date.now()+Math.max(3600000,e.retryAfter||0),'429検出');fail++;setMsg('429を検出したため停止しました');break}fail++}}renderMagList($('#magSearch')?.value||'');setMsg(`追加 ${ok}｜追加済み ${already}｜失敗 ${fail}`);refreshLimits()}catch(e){setMsg(formatError(e))}finally{magBusy=false;for(const b of [$('#magAddTop'),$('#magAddBottom')].filter(Boolean)){b.disabled=false;b.textContent='選択したマガジンへ追加'}}}
function showModal(id){$('#'+id)?.classList.add('show')}
function closeModal(id){$('#'+id)?.classList.remove('show')}
for(const b of $$('[data-close]'))b.onclick=()=>closeModal(b.dataset.close);
$('#prev').onclick=async()=>{if(state.index>0){state.index--;saveState();await render()}};
$('#next').onclick=async()=>{if(state.index<state.queue.length-1){state.index++;saveState();await render()}else status('最後の巡回対象です')};
$('#reset').onclick=()=>{if(confirm('巡回リストと位置だけをリセットします。スキやマガジン追加は取り消しません。')){state.queue=[];state.index=0;state.source='';saveState();$('#source').value='';$('#current').classList.add('hidden');status('巡回をリセットしました｜巡回条件を入力できます')}};
$('#startSource').onclick=()=>void loadSource();$('#source').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void loadSource()}});$('#saveSource').onclick=()=>saveFavoriteSource($('#source').value);$('#showFavorites').onclick=openFavorites;

$('#preloadMags').onclick=()=>void preloadMagazineList(true,false);

try{history.replaceState({boostRoot:1},'',APP_URL);history.pushState({boostGuard:1},'',APP_URL);addEventListener('popstate',()=>{const m=$$('.modal.show').pop();if(m)m.classList.remove('show');else if(state.index>0){state.index--;saveState();void render()}history.pushState({boostGuard:1},'',APP_URL)})}catch{}

async function diagnose(){try{status('noteログイン状態を確認中…');const me=await who();state.me=me.urlname.toLowerCase();if(state.me!=='ss_yr')throw Error('運営者本人のみ使用できます');saveState();$('#acct').textContent=`@${me.urlname}`;$('#preloadMags').disabled=false;$('#startSource').disabled=false;$('#saveSource').disabled=false;ready=true;$('#source').value=state.source||'';refreshLimits();if(state.queue.length)await render();else status('巡回元を入力して開始できます')}catch(e){ready=false;$('#preloadMags').disabled=true;$('#startSource').disabled=true;$('#saveSource').disabled=true;$('#acct').textContent='未接続';status(formatError(e),true);if(e?.code==='LOGIN'||e?.status===401)$('#status').insertAdjacentHTML('beforeend','<br><a class="login" href="https://note.com/login">noteへログイン</a>')}}
void diagnose();
})();
