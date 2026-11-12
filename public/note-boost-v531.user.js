// ==UserScript==
// @name         note 巡回BOOST｜専用アプリ
// @namespace    https://github.com/mumei-s/note-insight
// @version      6.9.7
// @description  運営者専用。note上の巡回パネルとコンパクトな専用画面を統合。#タグ・記事・マガジン・人物とお気に入りに対応。
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

const BOOST_PREF_KEY='noteBoostOwnerSettingsV697';
const BOOST_DEFAULTS={likes:{hour:18,day:80},mags:{hour:18,day:80},follows:{hour:6,day:20}};
function boostSettings(){
  let v={};try{v=JSON.parse(localStorage.getItem(BOOST_PREF_KEY)||'{}')||{}}catch{}
  const caps={};
  for(const k of Object.keys(BOOST_DEFAULTS)){
    const x=v.caps?.[k]||{},d=BOOST_DEFAULTS[k];
    const norm=(z,f)=>Number(z)>=1&&Number.isFinite(Number(z))?Math.min(2000,Math.floor(Number(z))):f;
    caps[k]={hour:norm(x.hour,d.hour),day:norm(x.day,d.day)};
  }
  return{followEnabled:v.followEnabled===true,caps};
}
function boostLimit(k){
  const now=Date.now(),cap=boostSettings().caps[k]||BOOST_DEFAULTS[k]||BOOST_DEFAULTS.likes;
  let a=[],g={};try{a=JSON.parse(localStorage.getItem(LIMIT_PREFIX+k)||'[]')||[]}catch{}
  try{g=JSON.parse(localStorage.getItem(LIMIT_PREFIX+'guard:'+k)||'{}')||{}}catch{}
  a=(Array.isArray(a)?a:[]).filter(x=>Number(x.t)>0&&now-Number(x.t)<86400000&&Number(x.t)<=now).sort((x,y)=>x.t-y.t);
  const h=a.filter(x=>now-Number(x.t)<3600000);
  let until=Number(g.until)||0;
  if(h.length>=cap.hour)until=Math.max(until,Number(h[h.length-cap.hour].t)+3600000);
  if(a.length>=cap.day)until=Math.max(until,Number(a[a.length-cap.day].t)+86400000);
  return{hour:h.length,day:a.length,until,cap};
}
function boostCheck(k){const l=boostLimit(k);if(l.until>Date.now())throw Error('操作上限・解除 '+new Date(l.until).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}))}
function boostLog(k,key){
  let a=[];try{a=JSON.parse(localStorage.getItem(LIMIT_PREFIX+k)||'[]')||[]}catch{}
  a=(Array.isArray(a)?a:[]).filter(x=>Date.now()-Number(x.t)<86400000);a.push({t:Date.now(),key});
  localStorage.setItem(LIMIT_PREFIX+k,JSON.stringify(a.slice(-2000)));
}
function boostPrefsForm(el,done){
  if(!el)return;const v=boostSettings(),names={likes:'♡ スキ',mags:'📚 追加',follows:'＋ フォロー'};
  el.innerHTML='<label class="boost-settings-follow"><input type="checkbox" data-follow-pref '+(v.followEnabled?'checked':'')+'> フォロー操作（初期OFF）</label>'+
    '<p class="boost-settings-caption">リミッター：1時間 / 24時間の回数（note側の制限は別途適用）</p>'+
    Object.keys(names).map(k=>'<div class="boost-settings-line"><span>'+names[k]+'</span><label>1h <input type="number" min="1" max="2000" inputmode="numeric" data-cap-kind="'+k+'" data-unit="hour" value="'+v.caps[k].hour+'"></label><label>24h <input type="number" min="1" max="2000" inputmode="numeric" data-cap-kind="'+k+'" data-unit="day" value="'+v.caps[k].day+'"></label></div>').join('');
  el.onchange=e=>{
    const t=e.target,n=boostSettings();
    if(t.hasAttribute('data-follow-pref'))n.followEnabled=t.checked;
    else if(t.hasAttribute('data-cap-kind')){
      const k=t.dataset.capKind,u=t.dataset.unit,z=Number(t.value);
      if(!n.caps[k]||!['hour','day'].includes(u)||!Number.isFinite(z)||z<1){boostPrefsForm(el,done);return}
      n.caps[k][u]=Math.min(2000,Math.floor(z));
    }else return;
    localStorage.setItem(BOOST_PREF_KEY,JSON.stringify(n));
    boostPrefsForm(el,done);if(typeof done==='function')done();
  };
}

function boostFollowState(raw){
  const root=raw?.data??raw??{},user=root?.creator??root?.user??root,parts=[user,root,user?.relationship,user?.follow];
  for(const obj of parts){
    if(!obj||typeof obj!=='object')continue;
    for(const key of ['isFollowing','is_following','isFollowed','is_followed','followed','followedByMe','followed_by_me']){
      if(typeof obj[key]==='boolean')return obj[key];
    }
  }
  return null;
}
async function boostFollowInfo(urlname){
  const id=String(urlname||'').replace(/^@/,'').trim();
  if(!/^[A-Za-z0-9_-]{1,60}$/.test(id))throw Error('クリエイターIDを確認できません');
  const response=await fetch('/api/v2/creators/'+encodeURIComponent(id),{
    credentials:'include',cache:'no-store',headers:{accept:'application/json'}
  });
  if(!response.ok)throw Error('フォロー状態の確認に失敗しました（HTTP '+response.status+'）');
  const json=await response.json(),root=json?.data??json??{},user=root.creator??root.user??root;
  return {id:String(user.id??user.user_id??user.userId??''),urlname:id,
    name:String(user.nickname||user.name||id),following:boostFollowState(json)};
}
async function boostFollowChange(urlname,notify){
  if(!boostSettings().followEnabled){notify('フォローはOFFです。設定でONにしてください');return}
  const name=String(urlname||'').trim().toLowerCase();
  if(boostFollowBusy.has(name))return;
  boostFollowBusy.add(name);
  try{
    const me=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});
    if(!me.ok)throw Error('noteのログインが必要です');
    const data=await me.json(),u=(data?.data??data??{}).user??(data?.data??data);
    if(String(u.urlname||u.url_name||u.username||'').replace(/^@/,'').toLowerCase()!=='ss_yr')
      throw Error('運営者本人以外では操作できません');
    const previous=await boostFollowInfo(name);
    const action=previous.following===true?'フォロー解除':previous.following===false?'フォロー':'公式プロフィールで状態を確認';
    if(!confirm('対象：'+previous.name+'（@'+name+'）\n操作：'+action+'\n\nこの操作を実行しますか？'))return;
    if(previous.following===null||!/^[0-9]+$/.test(previous.id)){
      notify('現在の状態を確定できないため、note公式で確認してください');
      location.assign('https://note.com/'+encodeURIComponent(name));
      return;
    }
    if(Date.now()-boostFollowLastActionAt<5000)throw Error('連続操作を防ぐため少し間隔を空けてください');
    const again=await boostFollowInfo(name);
    if(again.id!==previous.id||again.following!==previous.following)
      throw Error('フォロー状態が変わったため操作を中止しました');
    boostCheck('follows');
    const method=previous.following?'DELETE':'POST';
    boostFollowLastActionAt=Date.now();
    const res=await fetch('/api/v3/users/'+encodeURIComponent(previous.id)+'/following',{
      method,credentials:'include',cache:'no-store',
      headers:{accept:'application/json','x-requested-with':'XMLHttpRequest'}
    });
    if(!res.ok){if(res.status===403||res.status===429)localStorage.setItem(LIMIT_PREFIX+'guard:follows',JSON.stringify({until:Date.now()+3600000,reason:'HTTP '+res.status}));throw Error('フォロー操作ができません（HTTP '+res.status+'）')}
    boostLog('follows',name);
    let success=false;
    for(const delay of [250,700,1200]){
      await new Promise(resolve=>setTimeout(resolve,delay));
      try{if((await boostFollowInfo(name)).following===!previous.following){success=true;break}}catch{}
    }
    notify(success?(previous.following?'フォロー解除を確認しました':'フォローを確認しました'):
      '操作は送信済みですが結果を確認できません。公式プロフィールで状態をご確認ください');
  }catch(e){notify('⚠ '+String(e?.message||e))}
  finally{boostFollowBusy.delete(name)}
}
const boostFollowBusy=new Set();
let boostFollowLastActionAt=0;
function mountOwnerBoostPanel(){
  if(window.__mumeiBoostNotePanelV681)return;
  window.__mumeiBoostNotePanelV681=true;
  const TAB='mumei-boost-native-tab-v681',ROOT='mumei-boost-native-panel-v681';
  const FAV='noteBoostOwnerFavoritesV670',PENDING='noteBoostOwnerPendingSourceV681',MAG_PENDING='noteBoostOwnerPendingMagazineV681';
  let owner=false,checking=false,lastCheck=0,doing=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const json=(key,alt)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??alt}catch{return alt}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const state=()=>{const v=json(STORE,null)||json(PREV_STORE,null)||json(OLD_STORE,null)||{};return {...v,queue:Array.isArray(v.queue)?v.queue:[],index:Math.max(0,Number(v.index)||0),likedNow:v.likedNow||{},likeSent:v.likeSent||{}}};
  const favs=()=>{const v=json(FAV,{});return {sources:Array.isArray(v.sources)?v.sources.map(x=>typeof x==='string'?x:x?.value).filter(Boolean):[],creators:Array.isArray(v.creators)?v.creators.filter(x=>x?.id):[],articles:Array.isArray(v.articles)?v.articles.filter(x=>x?.key&&x?.urlname):[]}};
  const urlOf=x=>'https://note.com/'+encodeURIComponent(x.urlname)+'/n/'+encodeURIComponent(x.key);
  const css=document.createElement('style');css.id='mumei-boost-native-css-v681';
  css.textContent=`
#${TAB}{all:initial;box-sizing:border-box!important;position:fixed!important;right:8px!important;top:calc(env(safe-area-inset-top,0px) + 92px)!important;z-index:2147482000!important;border:1px solid #c6a362!important;background:#193040!important;color:#f7e5bd!important;padding:8px 10px!important;font:800 12px/1.2 system-ui!important;border-radius:10px!important;min-height:36px!important;box-shadow:0 4px 14px #0006!important;cursor:pointer!important}
#${ROOT}{all:initial;box-sizing:border-box!important;position:fixed!important;right:8px!important;top:calc(env(safe-area-inset-top,0px) + 135px)!important;width:min(380px,calc(100vw - 16px))!important;max-height:calc(100dvh - 225px)!important;overflow-y:auto!important;overscroll-behavior:contain!important;z-index:2147482000!important;color:#eef7fd!important;background:#091720f7!important;border:1px solid #c6a362!important;border-radius:12px!important;padding:8px!important;box-shadow:0 12px 32px #000b!important;font:12px/1.4 system-ui!important}
#${ROOT}[hidden],#${ROOT} [hidden]{display:none!important}#${ROOT} *{box-sizing:border-box!important}
#${ROOT} header{display:flex;align-items:center;gap:6px;margin-bottom:5px;background:transparent!important;padding:0!important;height:auto!important;position:static!important}
#${ROOT} header b{flex:1;font-size:14px;color:#ffe2a8}#${ROOT} header small{font-size:10px;color:#95b7c8}
#${ROOT} button,#${ROOT} input{font:inherit!important;min-height:32px!important;border:1px solid #4b687a!important;border-radius:7px!important}
#${ROOT} button{background:#142f3e!important;color:#eff8fc!important;padding:5px 7px!important;cursor:pointer!important}
#${ROOT} button:disabled{opacity:.5!important}
#${ROOT} input{background:#07111a!important;color:white!important;padding:6px 8px!important;width:100%!important;min-width:0!important;flex:1!important;appearance:none!important}
#${ROOT} .mb-row{display:flex;gap:5px;margin-top:5px;align-items:center}
#${ROOT} .mb-row button{white-space:nowrap!important}
#${ROOT} .mb-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:5px}
#${ROOT} .mb-actions button{min-width:0!important;font-size:11px!important;padding:6px 3px!important}
#${ROOT} [data-status]{font-size:11px;color:#accede;margin:6px 1px;min-height:14px;overflow-wrap:anywhere}
#${ROOT} [data-current]{padding:6px;border:1px solid #304e60;border-radius:8px;background:#0c2330;margin-top:6px}
#${ROOT} .mb-current-title{font-weight:800;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#${ROOT} .mb-small{font-size:10px;color:#9bbccc;margin-top:3px}
#${ROOT} .mb-group{border-top:1px solid #2e4a5c;margin-top:7px;padding-top:5px}
#${ROOT} .mb-group h3{color:#dfbe81;font-size:12px;margin:3px 0 5px}
#${ROOT} .mb-item{display:flex;gap:5px;align-items:center;padding:5px 0;border-bottom:1px solid #213947}
#${ROOT} .mb-item span{flex:1;min-width:0;overflow-wrap:anywhere}
#${ROOT} .mb-item button{font-size:10px!important;min-height:28px!important}
@media(max-height:550px){#${ROOT}{top:115px!important;max-height:calc(100dvh - 155px)!important}#${TAB}{top:72px!important}}`;
  css.textContent+="\n#mumei-boost-native-panel-v681 .mb-card-row{display:grid;grid-template-columns:64px minmax(0,1fr);gap:7px;align-items:start}\n#mumei-boost-native-panel-v681 .mb-card-row img,#mumei-boost-native-panel-v681 .mb-card-placeholder{display:block;width:64px;height:48px;object-fit:cover;background:#162934;border-radius:6px}\n#mumei-boost-native-panel-v681 .mb-card-placeholder{display:grid;place-items:center;color:#91acbd;font-size:9px}\n";
  css.textContent+="\n#mumei-boost-native-panel-v681 .mb-card-row{display:grid!important;grid-template-columns:116px minmax(0,1fr)!important;gap:8px!important;align-items:start!important}\n#mumei-boost-native-panel-v681 .mb-card-row img,#mumei-boost-native-panel-v681 .mb-card-placeholder{display:block!important;width:116px!important;height:80px!important;object-fit:cover!important;background:#162934!important;border-radius:7px!important}\n#mumei-boost-native-panel-v681 .mb-card-placeholder{display:grid!important;place-items:center!important;color:#91acbd!important;font-size:10px!important}\n#mumei-boost-native-panel-v681 .mb-card-info{min-width:0!important}\n#mumei-boost-native-panel-v681 .mb-card-heading{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:4px!important;align-items:start!important}\n#mumei-boost-native-panel-v681 .mb-card-heading .mb-current-title{font:800 12px/1.32 system-ui!important;min-width:0!important}\n#mumei-boost-native-panel-v681 .mb-card-heading button[data-follow]{all:initial!important;box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;max-width:72px!important;height:25px!important;min-height:25px!important;padding:0 5px!important;white-space:nowrap!important;background:#122d39!important;color:#d9e9f4!important;border:1px solid #577486!important;border-radius:6px!important;font:700 10px/1 system-ui!important;cursor:pointer!important}\n#mumei-boost-native-panel-v681 .mb-actions{gap:4px!important;margin-top:4px!important}\n#mumei-boost-native-panel-v681 .mb-actions-four{grid-template-columns:repeat(4,minmax(0,1fr))!important}\n#mumei-boost-native-panel-v681 .mb-actions button{all:initial!important;box-sizing:border-box!important;display:flex!important;justify-content:center!important;align-items:center!important;width:100%!important;min-width:0!important;height:29px!important;min-height:29px!important;padding:2px 3px!important;border:1px solid #426072!important;border-radius:6px!important;background:#142e3f!important;color:#e9f6ff!important;font:700 10px/1.15 system-ui!important;cursor:pointer!important;text-align:center!important}\n#mumei-boost-native-panel-v681 .mb-actions button:disabled{opacity:.48!important;cursor:default!important}\n#mumei-boost-native-panel-v681 .mb-row button,#mumei-boost-native-panel-v681 header button{min-height:29px!important;padding:4px 6px!important;font:700 11px/1.15 system-ui!important}\n#mumei-boost-native-panel-v681 [data-current]{padding:6px!important;margin-top:5px!important}\n#mumei-boost-native-panel-v681 [data-status]{font-size:10px!important;margin:4px 0!important}\n#mumei-boost-native-panel-v681 .mb-card-info .mb-small{font-size:10px!important;line-height:1.3!important;margin-top:5px!important;overflow-wrap:anywhere!important}\n#mumei-boost-native-panel-v681{top:calc(env(safe-area-inset-top,0px) + 128px)!important;padding:7px!important}\n@media(max-width:350px){#mumei-boost-native-panel-v681 .mb-card-row{grid-template-columns:98px minmax(0,1fr)!important}#mumei-boost-native-panel-v681 .mb-card-row img,#mumei-boost-native-panel-v681 .mb-card-placeholder{width:98px!important;height:72px!important}}\n";
  css.textContent += "\n#"+ROOT+" .boost-settings-line{display:grid;grid-template-columns:minmax(0,1fr) 75px 75px;gap:4px;align-items:center;margin:5px 0}#"+ROOT+" .boost-settings-line input{width:100%!important;font-size:16px!important;padding:3px!important;min-height:29px!important}#"+ROOT+" .boost-settings-follow{display:flex;gap:6px;align-items:center}#"+ROOT+" .boost-settings-follow input{width:20px!important;min-height:20px!important;flex:0 0 20px!important}#"+ROOT+" .boost-settings-caption{font-size:10px;color:#a3bece}#"+ROOT+" input[data-source]{font-size:16px!important}";
  const tab=document.createElement('button');tab.id=TAB;tab.type='button';tab.textContent='💗 BOOST';
  const panel=document.createElement('div');panel.id=ROOT;panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','巡回BOOST運営者パネル');
  panel.innerHTML='<header><b>巡回BOOST</b><small>@ss_yr</small><button data-close aria-label="閉じる">×</button></header><div class="mb-row"><input data-source aria-label="巡回元" placeholder="#タグ / 記事URL / マガジン / @ID"><button data-run>巡回開始</button></div><div class="mb-actions"><button data-save>☆ 条件保存</button><button data-fav-toggle>★ お気に入り</button><button data-app>全画面</button></div><details data-settings><summary>⚙ 上限・フォロー設定</summary><div data-settings-ui></div></details><div data-status>巡回条件を入力できます</div><div data-current></div><div data-favorites hidden></div>';
  function message(t){const el=panel.querySelector('[data-status]');if(el)el.textContent=t}
  function mount(){if(!owner||!document.body)return;if(!document.getElementById(css.id))(document.head||document.documentElement).append(css);if(!document.getElementById(TAB))document.body.append(tab);if(!document.getElementById(ROOT))document.body.append(panel);if(!panel.hidden)refresh()}
  function dismiss(){tab.remove();panel.remove()}
  function run(source){const raw=String(source||'').trim();if(!raw){message('巡回条件を入力してください');return}try{localStorage.setItem(PENDING,raw)}catch{}location.assign(APP_URL)}
  function refresh(){
    const v=state(),x=v.queue[v.index],area=panel.querySelector('[data-current]');
    if(!x){area.innerHTML='<div class="mb-small">まだ巡回リストはありません。#タグ・URL・@IDから開始できます。</div>';return}
    area.innerHTML='<div class="mb-card-row">'+
      (x.thumb?'<img src="'+esc(x.thumb)+'" alt="記事サムネイル" loading="lazy">':'<span class="mb-card-placeholder">画像なし</span>')+
      '<div class="mb-card-info"><div class="mb-card-heading"><div class="mb-current-title">'+esc(x.title||x.key)+'</div>'+
      (boostSettings().followEnabled?'<button type="button" data-follow title="確認してからフォローを操作">確認</button>':'')+'</div>'+
      '<div class="mb-small">@'+esc(x.urlname)+'　'+(v.index+1)+' / '+v.queue.length+'</div></div></div>'+
      '<div class="mb-actions"><button data-prev>←前</button><button data-real>実記事</button><button data-next>次→</button></div>'+
      '<div class="mb-actions mb-actions-four"><button data-like>♡スキ</button><button data-mag>📚追加</button><button data-fav-person>☆人物</button><button data-queue>▤一覧</button></div>';if(boostSettings().followEnabled)void nativeSyncFollow(x.urlname);
    if(v.likedNow[x.key]||v.likeSent[x.key]){const b=area.querySelector('[data-like]');b.disabled=true;b.textContent='♡処理済み'}
  }

  let nativeFollowLastId='',nativeFollowAt=0,nativeFollowLabel='フォロー確認',nativeFollowSeq=0;
  async function nativeSyncFollow(id,force=false){
    const b=panel.querySelector('[data-follow]');if(!b)return;
    if(!force&&id===nativeFollowLastId&&Date.now()-nativeFollowAt<30000){
      b.textContent=nativeFollowLabel;return;
    }
    nativeFollowLastId=id;nativeFollowAt=Date.now();
    const seq=++nativeFollowSeq;b.textContent='確認中';
    try{
      const info=await boostFollowInfo(id);
      if(seq!==nativeFollowSeq)return;
      nativeFollowLabel=info.following===true?'フォロー中':info.following===false?'フォロー':'状態を確認';
      panel.querySelector('[data-follow]').textContent=nativeFollowLabel;
    }catch{
      if(seq===nativeFollowSeq){nativeFollowLabel='状態を確認';panel.querySelector('[data-follow]').textContent=nativeFollowLabel}
    }
  }
  function drawFavorites(){
    const v=favs(),el=panel.querySelector('[data-favorites]');
    const block=(name,items,type,display)=>'<div class="mb-group"><h3>'+name+' ('+items.length+')</h3>'+(items.map((x,i)=>'<div class="mb-item"><span>'+esc(display(x))+'</span><button data-do="'+type+'" data-i="'+i+'">巡回</button><button data-del="'+type+'" data-i="'+i+'" aria-label="削除">×</button></div>').join('')||'<div class="mb-small">未登録</div>')+'</div>';
    el.innerHTML=block('巡回条件',v.sources,'source',x=>x)+block('クリエイター',v.creators,'creator',x=>(x.name||x.id)+' @'+x.id)+block('記事',v.articles,'article',x=>x.title||x.key);
  }
  async function like(){
    if(doing)return;const v=state(),x=v.queue[v.index];if(!x)return;
    if(v.likedNow[x.key]||v.likeSent[x.key]){message('この記事は処理済みです');return}
    doing=true;
    const btn=panel.querySelector('[data-like]');if(btn)btn.disabled=true;
    try{
      boostCheck('likes');
      const get=async()=>{
        const r=await fetch('/api/v3/notes/'+encodeURIComponent(x.key),{credentials:'include',cache:'no-store'});
        if(!r.ok)throw Error('記事確認 HTTP '+r.status);
        const j=await r.json();return j?.data?.note||j?.data||j?.note||j;
      };
      const liked=n=>['isLiked','is_liked','liked','hasLiked'].map(k=>n?.[k]).find(z=>typeof z==='boolean');
      const before=liked(await get());
      if(before===true){message('💗 元からスキ済み。解除しません');return}
      if(before!==false)throw Error('スキ状態を確認できないため実行しません');
      const r=await fetch('/api/v3/notes/'+encodeURIComponent(x.key)+'/likes',{method:'POST',credentials:'include',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:'{}'});
      if(!r.ok)throw Error('スキ送信 HTTP '+r.status);
      v.likeSent[x.key]=true;write(STORE,v);boostLog('likes',x.key);
      let confirmed=false;
      for(const delay of [250,750,1300]){await new Promise(resolve=>setTimeout(resolve,delay));try{if(liked(await get())===true){confirmed=true;break}}catch{}}
      if(confirmed){v.likedNow[x.key]=true;delete v.likeSent[x.key];write(STORE,v);const old=json('noteBoostCreatorLikeHistoryV650',{});old[String(x.urlname||'').toLowerCase()]={at:Date.now(),noteKey:x.key,kind:'tool'};write('noteBoostCreatorLikeHistoryV650',old);message('❤️ スキ確認済み')}
      else message('送信済み・反映確認待ち。重複送信を防止しています');
    }catch(e){message('⚠ '+String(e?.message||e))}
    finally{doing=false;refresh()}
  }
  panel.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-close')){panel.hidden=true;return}
    if(b.hasAttribute('data-run'))return run(panel.querySelector('[data-source]').value);
    if(b.hasAttribute('data-app'))return location.assign(APP_URL);
    if(b.hasAttribute('data-save')){const source=panel.querySelector('[data-source]').value.trim();if(!source)return message('先に保存する条件を入力してください');const v=favs();v.sources=[source,...v.sources.filter(x=>x!==source)].slice(0,100);write(FAV,v);message('☆ 条件を保存しました');drawFavorites();return}
    if(b.hasAttribute('data-fav-toggle')){const area=panel.querySelector('[data-favorites]');area.hidden=!area.hidden;if(!area.hidden)drawFavorites();return}
    const v=state(),x=v.queue[v.index];
    if(b.hasAttribute('data-prev')||b.hasAttribute('data-next')){if(!v.queue.length)return;v.index=Math.min(v.queue.length-1,Math.max(0,v.index+(b.hasAttribute('data-next')?1:-1)));write(STORE,v);refresh();return}
    if(b.hasAttribute('data-real')&&x)return location.assign(urlOf(x));
    if(b.hasAttribute('data-like')){void like();return}
    if(b.hasAttribute('data-follow')&&x){void boostFollowChange(x.urlname,message).then(()=>void nativeSyncFollow(x.urlname,true));return}
    if(b.hasAttribute('data-queue')){localStorage.setItem('noteBoostOwnerPendingQueueV693','1');location.assign(APP_URL);return}
    if(b.hasAttribute('data-mag')){localStorage.setItem(MAG_PENDING,'1');location.assign(APP_URL);return}
    if(b.hasAttribute('data-fav-person')&&x){const f=favs(),id=String(x.urlname||'').toLowerCase();f.creators=[{id,name:x.name||id},...f.creators.filter(y=>y.id!==id)].slice(0,200);write(FAV,f);message('☆ 人物を保存しました');drawFavorites();return}
    const type=b.dataset.do||b.dataset.del,idx=Number(b.dataset.i);
    if(!type||!Number.isInteger(idx))return;
    const f=favs(),arr=type==='source'?f.sources:type==='creator'?f.creators:f.articles,obj=arr[idx];if(!obj)return;
    if(b.hasAttribute('data-del')){arr.splice(idx,1);write(FAV,f);drawFavorites();return}
    if(type==='source')return run(obj);
    if(type==='creator')return run('@'+obj.id);
    if(type==='article')return run(urlOf(obj));
  });
  panel.querySelector('[data-source]').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();run(e.target.value)}});
  tab.addEventListener('click',()=>{panel.hidden=!panel.hidden;if(!panel.hidden){mount();refresh();drawFavorites();boostPrefsForm(panel.querySelector('[data-settings-ui]'),refresh)}});
  async function verify(force=false){
    if(checking||(!force&&Date.now()-lastCheck<30000)){mount();return}
    checking=true;lastCheck=Date.now();
    try{
      const res=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});
      if(!res.ok)throw Error('login');
      const j=await res.json(),d=j?.data??j??{},u=d.user??d;
      owner=String(u.urlname||u.url_name||u.username||'').replace(/^@/,'').toLowerCase()==='ss_yr';
    }catch{owner=false}
    finally{checking=false;if(owner){mount();returnToBoost()}else dismiss()}
  }

  function returnToBoost(){
    if(!fromBoost||!owner||!document.body||document.getElementById('boost-return-v697'))return;
    const b=document.createElement('button');b.id='boost-return-v697';b.textContent='← BOOSTへ戻る';
    b.style.cssText='position:fixed!important;left:8px!important;bottom:calc(12px + env(safe-area-inset-bottom,0px))!important;z-index:2147483647!important;border:1px solid #d4b47d!important;border-radius:12px!important;background:#0b2430!important;color:white!important;padding:11px 14px!important;font:800 13px system-ui!important;box-shadow:0 6px 20px #0007!important';
    b.onclick=()=>location.assign(APP_URL);document.body.appendChild(b);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void verify(true),{once:true});else void verify(true);
  addEventListener('pageshow',()=>void verify(true));addEventListener('focus',()=>void verify(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void verify(true)});
  setInterval(()=>{if(owner)mount();if(Date.now()-lastCheck>60000)void verify(true)},8000);
}

if (!dedicated) { mountOwnerBoostPanel(); return; }

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


.boost-creator-with-follow{grid-template-columns:42px minmax(0,1fr) auto!important}
#current .tiny-follow{font:700 10px/1.1 system-ui!important;padding:4px 6px!important;min-height:29px!important;border:1px solid #55717e;background:#0b2230;color:#d7e8f1;border-radius:6px;max-width:88px;white-space:nowrap;align-self:start}
.boost-article-row{display:flex;gap:8px;align-items:start;min-width:0}
.boost-article-thumb,.boost-card-placeholder{display:block;flex:0 0 84px;width:84px;height:60px;object-fit:cover;background:#14242d;border-radius:7px}
.boost-card-placeholder{display:grid;place-items:center;font:700 10px/1.3 system-ui;color:#839fb1;text-align:center;padding:4px}
.boost-article-caption{min-width:0;flex:1}.boost-article-caption h2{font-size:13px;line-height:1.35;margin:0 0 4px}
.boost-controls>.top-actions{grid-template-columns:repeat(3,minmax(0,1fr))}
.boost-queue-item{display:grid;grid-template-columns:84px minmax(0,1fr);gap:8px;border:1px solid #2d4859;border-radius:10px;padding:7px;margin:5px 0;background:#081923}
.boost-queue-item.selected{border-color:#d2ac69}
.boost-queue-copy{min-width:0;font-size:12px}.boost-queue-copy b{display:block;overflow-wrap:anywhere;line-height:1.4}
.boost-queue-actions{display:flex;gap:6px;margin-top:7px}.boost-queue-actions button{padding:6px 8px;font-size:11px;flex:1}
.boost-queue-more{display:block;width:100%;margin-top:10px}
.fav-item .boost-card-placeholder,.fav-item img{width:45px;height:45px;flex:0 0 45px;object-fit:cover;border-radius:7px}

/* Mobile BOOST: larger article cover, smaller actions and stable full-screen width */
html,body{width:100%!important;min-width:0!important;overflow-x:hidden!important}
.app{width:100%!important;max-width:720px!important;margin:0 auto!important;padding:6px 9px calc(55px + env(safe-area-inset-bottom,0px))!important}
#current .boost-article-row{display:grid!important;grid-template-columns:134px minmax(0,1fr)!important;gap:9px!important;align-items:start!important}
#current .boost-article-thumb,#current .boost-card-placeholder{width:134px!important;height:90px!important;flex-basis:134px!important;object-fit:cover!important}
#current .boost-article-caption h2{font-size:13px!important;line-height:1.35!important}
.boost-queue-item{grid-template-columns:118px minmax(0,1fr)!important;gap:9px!important}
.boost-queue-item>.boost-card-placeholder,.boost-queue-item>img{width:118px!important;height:78px!important;object-fit:cover!important;border-radius:7px!important}
#current .actions button{min-height:30px!important;padding:5px 3px!important;font:700 11px/1.2 system-ui!important;border-radius:7px!important}
#current .boost-creator-with-follow{grid-template-columns:38px minmax(0,1fr) auto!important;gap:6px!important}
#current .creator img{width:38px!important;height:38px!important}
#current .tiny-follow{max-width:75px!important;font-size:10px!important;min-height:27px!important;padding:4px 6px!important}
.modalbody .listrow{grid-template-columns:94px minmax(0,1fr)!important;gap:9px!important}
.modalbody .listrow img,.modalbody .listrow .boost-card-placeholder{width:94px!important;height:66px!important;object-fit:cover!important}
@media(max-width:370px){#current .boost-article-row{grid-template-columns:114px minmax(0,1fr)!important}#current .boost-article-thumb,#current .boost-card-placeholder{width:114px!important;height:80px!important}.boost-queue-item{grid-template-columns:98px minmax(0,1fr)!important}.boost-queue-item>.boost-card-placeholder,.boost-queue-item>img{width:98px!important;height:70px!important}}


/* BOOST mobile layout guard: prevent accidental auto-zoom and overflowing list contents */
html,body{max-width:100%!important;min-width:0!important;overflow-x:clip!important}
.app,.card,.modal,.modalbody,.listrow,.listrow>div,.boost-queue-item,.boost-queue-copy{min-width:0!important;max-width:100%!important}
.modal{width:100vw!important;max-width:100%!important;overflow:hidden!important}
.modalbody{width:100%!important;overflow-x:hidden!important;overflow-wrap:anywhere;overscroll-behavior:contain}
.modalbody img{max-width:100%!important}
.modalbody h2,.modalbody b,.modalbody .meta,.boost-queue-copy b{overflow-wrap:anywhere;word-break:break-word}
.listrow,.modalbody .listrow{grid-template-columns:94px minmax(0,1fr)!important}
input[type=text],input[type=search],input[type=number],#source,#magSearch{font-size:16px!important}
.headrow .boost-head-actions{display:flex;gap:5px;flex-wrap:wrap;align-items:center;justify-content:flex-end}
.headrow .boost-head-actions button{padding:6px 8px;font-size:11px;min-height:32px}
.boost-five-list{display:grid;gap:7px;margin-top:7px}
.boost-five-card{min-width:0;border:1px solid #365160;border-radius:11px;background:#091c27;padding:8px}
.boost-five-card.selected{border-color:#d0ac6b;background:#102636}
.boost-five-title{font-size:12px;font-weight:900;overflow-wrap:anywhere}
.boost-five-article{display:grid;grid-template-columns:94px minmax(0,1fr);gap:8px;min-width:0;margin-top:6px}
.boost-five-article img,.boost-five-article .boost-card-placeholder{width:94px!important;height:65px!important;max-width:100%!important;object-fit:cover}
.boost-five-article>div{min-width:0}
.boost-five-article b{font-size:12px;line-height:1.35;display:block;overflow-wrap:anywhere}
.boost-five-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:6px}
.boost-five-actions button{padding:6px 3px!important;font-size:11px!important;min-height:31px!important}
.boost-settings-line{display:grid;grid-template-columns:minmax(0,1fr) 82px 82px;gap:6px;align-items:center;font-size:11px;margin-top:7px}
.boost-settings-line label{display:flex;align-items:center;gap:3px}
.boost-settings-line input{width:100%!important;min-width:0!important;text-align:center;padding:6px 2px!important}
.boost-settings-caption{font-size:10px;color:#93aabb;margin:7px 0}
.boost-settings-follow{display:flex;align-items:center;gap:7px;font-size:12px}
.boost-settings-follow input{width:19px!important;height:19px!important;flex:0 0 19px}
@media(max-width:375px){.boost-five-article{grid-template-columns:84px minmax(0,1fr)}.boost-five-article img,.boost-five-article .boost-card-placeholder{width:84px!important;height:59px!important}.boost-settings-line{grid-template-columns:minmax(0,1fr) 73px 73px}}
</style></head><body>
<main class="app"><header class="head"><div class="headrow"><h1>note 巡回BOOST</h1><div class="boost-head-actions"><span id="acct" class="acct">診断中…</span><button id="backBoost" type="button">← 戻る</button><button id="exitBoost" type="button">終了 ×</button></div></div><div class="sub">#タグ・記事・マガジン・人物から巡回｜v6.9.7</div></header>
<section class="card boost-controls">
<div class="row source-controls"><input class="grow" id="source" type="text" placeholder="#タグ／記事URL／マガジンURL／@ID" autocomplete="off" aria-label="巡回元"><button class="primary" id="startSource" disabled>巡回開始</button></div>
<div class="top-actions"><button id="saveSource" disabled>☆ 条件保存</button><button id="showFavorites">★ お気に入り</button><button id="queueBtn">🗂 記事一覧</button></div>
<div id="status" class="status" role="status">noteログイン状態を確認中…</div>
<details class="more-controls"><summary>上限・詳細設定</summary><div class="limits"><div id="likeLimit" class="pill">♡ 1h — / 24h —</div><div id="magLimit" class="pill">📚 1h — / 24h —</div><div id="followLimit" class="pill">＋ 1h — / 24h —</div></div><div id="boostSettingsUI"></div><div class="top-actions"><button id="reset" class="danger">巡回をリセット</button></div></details>
</section>
<section id="current" class="card hidden"></section></main>
<footer class="footer"><button id="prev">← 前の5人</button><button id="next">次の5人 →</button></footer>
<section id="previewModal" class="modal"><div class="modalhead"><button data-close="previewModal">戻る</button><b>プレビュー</b></div><div id="previewBody" class="modalbody"></div></section>
<section id="creatorModal" class="modal"><div class="modalhead"><button data-close="creatorModal">戻る</button><b>クリエイター</b></div><div id="creatorBody" class="modalbody"></div></section>
<section id="queueModal" class="modal"><div class="modalhead"><button data-close="queueModal">戻る</button><b>記事一覧</b></div><div id="queueBody" class="modalbody"></div></section><section id="magModal" class="modal"><div class="modalhead"><button data-close="magModal">戻る</button><b>マガジン追加</b></div><div id="magBody" class="modalbody"></div></section><section id="favModal" class="modal"><div class="modalhead"><button data-close="favModal">戻る</button><b>⭐ お気に入り</b></div><div id="favBody" class="modalbody"></div></section>
</body></html>`;

// Write a complete document rather than editing documentElement at document-start.
// The document root may be unavailable while the note parser is still active.
(function installBoostDocument(){
  try {
    document.open();
    document.write(HTML);
    document.close();
    const viewport=document.querySelector('meta[name="viewport"]');
    if(viewport) viewport.content='width=device-width,initial-scale=1,viewport-fit=cover';
    if(document.documentElement)document.documentElement.style.visibility='visible';
  } catch(error) {
    if(!document.documentElement)throw error;
    document.documentElement.innerHTML=HTML.slice(HTML.indexOf('<head>'),HTML.lastIndexOf('</html>'));
    document.documentElement.style.visibility='visible';
  }
})();

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
    (v.articles.map((x,i)=>'<div class="fav-item">'+boostArticleThumbMarkup(x)+'<span class="fav-name"><b>'+esc(x.title||x.key)+'</b><small>@'+esc(x.urlname)+'</small></span><button data-fav-article-start="'+i+'">巡回</button><button data-fav-article="'+i+'">記事</button><button aria-label="保存解除" data-fav-remove-article="'+i+'">×</button></div>').join('')||'<p class="fav-empty">未登録</p>')+'</div>';
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
function thumbOf(n){for(const x of [n?.eyecatch_url,n?.eyecatch?.url,n?.eyecatch,n?.eyecatch_image?.url,n?.eyecatch_image,n?.eyecatchImage?.url,n?.eyecatchImage,n?.image_url,n?.thumbnail_url,n?.cover_image_url,n?.image?.url,n?.thumbnail?.url,n?.thumbnail?.src])if(typeof x==='string'&&/^https?:\/\//.test(x))return x;return''}
function readLiked(j){for(const o of [j,j?.data,j?.note,j?.data?.note].filter(Boolean))for(const k of ['isLiked','is_liked','liked','hasLiked'])if(typeof o?.[k]==='boolean')return o[k];return null}
function readLikeCount(j){for(const o of [j?.data?.note,j?.data,j?.note,j].filter(Boolean)){const n=Number(o?.likeCount??o?.like_count??o?.likes_count??o?.likesCount);if(Number.isFinite(n))return n}return null}
async function api(path,init={}){const timeoutMs=Math.max(1500,Number(init.timeoutMs)||20000),{timeoutMs:_tm,...reqInit}=init,ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),timeoutMs);try{const r=await fetch(path,{credentials:'include',cache:'no-store',...reqInit,headers:{accept:'application/json',...(reqInit.headers||{})},signal:ctl.signal});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={text}}if(!r.ok){const e=new Error(`HTTP ${r.status}`);e.status=r.status;e.body=data;const ra=r.headers.get('retry-after');e.retryAfter=ra?(/^\d+$/.test(ra)?Number(ra)*1000:Math.max(0,Date.parse(ra)-Date.now())):0;throw e}return data}catch(e){if(e?.name==='AbortError'){const x=new Error('API応答タイムアウト');x.code='TIMEOUT';throw x}throw e}finally{clearTimeout(tm)}}
async function textReq(raw){const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),20000);try{const r=await fetch(raw,{credentials:'include',cache:'no-store',signal:ctl.signal});if(!r.ok){const e=new Error(`HTTP ${r.status}`);e.status=r.status;throw e}return await r.text()}finally{clearTimeout(tm)}}
function hist(kind){try{return JSON.parse(localStorage.getItem(LIMIT_PREFIX+kind)||'[]').filter(x=>Date.now()-Number(x.t)<86400000)}catch{return[]}}
function saveHist(kind,a){localStorage.setItem(LIMIT_PREFIX+kind,JSON.stringify(a.slice(-500)))}
function pushHist(kind,key){const a=hist(kind);a.push({t:Date.now(),key});saveHist(kind,a)}
function guard(kind){try{return JSON.parse(localStorage.getItem(LIMIT_PREFIX+'guard:'+kind)||'{"until":0,"reason":""}')}catch{return{until:0,reason:''}}}
function setGuard(kind,until,reason){localStorage.setItem(LIMIT_PREFIX+'guard:'+kind,JSON.stringify({until,reason}))}
function limitStatus(kind){return boostLimit(kind)}
function refreshLimits(){for(const [kind,id,icon] of [['likes','#likeLimit','♡'],['mags','#magLimit','📚'],['follows','#followLimit','＋']]){const s=limitStatus(kind),extra=s.until>Date.now()?'・解除 '+fmtClock(s.until):'';const el=$(id);if(el)el.textContent=icon+' 1h '+s.hour+'/'+s.cap.hour+'・24h '+s.day+'/'+s.cap.day+extra}}
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
    const image=item.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url')||
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
function boostArticleThumbMarkup(item){
  return item?.thumb?'<img src="'+esc(item.thumb)+'" alt="記事サムネイル" loading="lazy">':
    '<div class="boost-card-placeholder">画像なし</div>';
}
function boostCurrentArticleHeader(x,detail){
  const img=detail?.thumb||x.thumb||'',title=detail?.title||x.title||x.key||'記事';
  return '<div class="boost-article-row">'+
    (img?'<img class="boost-article-thumb" src="'+esc(img)+'" loading="lazy" alt="記事サムネイル">':
      '<div class="boost-card-placeholder">画像なし</div>')+
    '<div class="boost-article-caption"><h2>'+esc(title)+'</h2><div class="meta">記事スキ '+(detail?.likeCount??x.likeCount??'—')+'</div></div></div>';
}
async function boostSyncFollowButton(id){
  const button=$('#followBtn');
  if(!button||current()?.urlname?.toLowerCase()!==id?.toLowerCase())return;
  button.textContent='確認中';
  try{
    const info=await boostFollowInfo(id);
    if(current()?.urlname?.toLowerCase()!==id?.toLowerCase()||!button.isConnected)return;
    button.textContent=info.following===true?'フォロー中':info.following===false?'フォロー':'状態確認';
  }catch{if(button.isConnected)button.textContent='状態確認'}
}

function openQueue(){
  showModal('queueModal');
  let page=Math.floor(state.index/5);const root=$('#queueBody'),tried=new Set();
  const draw=()=>{
    const q=state.queue||[],pages=Math.max(1,Math.ceil(q.length/5));
    page=Math.max(0,Math.min(page,pages-1));
    const begin=page*5,items=q.slice(begin,begin+5);
    root.innerHTML='<div class="bar"><button id="queuePrev" '+(page===0?'disabled':'')+'>← 前の5人</button><span class="meta">'+(page+1)+'/'+pages+' ページ・全'+q.length+'人</span><button id="queueNext" '+(page>=pages-1?'disabled':'')+'>次の5人 →</button></div>'+
      items.map((x,k)=>{const i=begin+k;return '<div class="boost-queue-item'+(state.index===i?' selected':'')+'">'+
        boostArticleThumbMarkup(x)+'<div class="boost-queue-copy"><b>'+esc(x.title||x.key)+'</b><div class="meta">@'+esc(x.urlname||'')+' ・ '+(i+1)+'/'+q.length+'</div>'+
        '<div class="boost-queue-actions"><button data-select="'+i+'">選ぶ</button><button data-direct="'+i+'">実記事</button></div></div></div>'}).join('')+
      '<div class="bar"><button id="queuePrevBottom" '+(page===0?'disabled':'')+'>← 前へ</button><button id="queueNextBottom" '+(page>=pages-1?'disabled':'')+'>次へ →</button></div>';
    for(const b of root.querySelectorAll('[data-select]'))b.onclick=()=>{state.index=Number(b.dataset.select);saveState();closeModal('queueModal');void render()};
    for(const b of root.querySelectorAll('[data-direct]'))b.onclick=()=>{const x=q[Number(b.dataset.direct)];if(x)goOut('https://note.com/'+encodeURIComponent(x.urlname)+'/n/'+encodeURIComponent(x.key))};
    for(const b of [root.querySelector('#queuePrev'),root.querySelector('#queuePrevBottom')].filter(Boolean))b.onclick=()=>{page--;root.scrollTop=0;draw()};
    for(const b of [root.querySelector('#queueNext'),root.querySelector('#queueNextBottom')].filter(Boolean))b.onclick=()=>{page++;root.scrollTop=0;draw()};
    const missing=items.filter(x=>!x.thumb&&x.urlname&&x.key&&!tried.has(x.key));
    if(missing.length){
      for(const x of missing)tried.add(x.key);
      void mapLimit(missing,2,async x=>{
        const image=await ogImage('https://note.com/'+encodeURIComponent(x.urlname)+'/n/'+encodeURIComponent(x.key));
        if(!image)return false;x.thumb=image;saveState();return true;
      }).then(results=>{if(results.some(Boolean)&&root.isConnected)draw()}).catch(()=>{});
    }
  };draw();
}
function stateText(detail,x){const dup=Boolean(x?.duplicateCreator||creatorWasLiked(x?.urlname)||detail?.liked===true);if(state.likedNow[x.key])return'❤️ この人は今回スキ済み｜⚠ 重複あり｜マガジン追加できます';if(detail?.liked===true)return'💗 この人は元からスキ済み｜⚠ 重複あり｜マガジン追加できます';if(state.likeSent[x.key])return'❤️ スキ送信済み・反映確認待ち｜⚠ 重複あり';if(dup)return'⚠ 重複あり｜この人には以前スキ済み。別の記事も確認できます';return'♡ この人は未スキ'}

const BOOST_PAGE_SIZE=5;
let boostRenderTicket=0;
function boostPage(){return Math.floor(Math.max(0,state.index)/BOOST_PAGE_SIZE)}
function boostCard(x,i,total){
  const marked=!!(state.likedNow[x.key]||state.likeSent[x.key]||x.liked===true),following=boostSettings().followEnabled;
  const label=state.likedNow[x.key]?'❤️今回済':state.likeSent[x.key]?'❤️送信済':x.liked===true?'💗既スキ':'♡スキ';
  const button=(action,text,disabled)=>'<button type="button" data-boost-action="'+action+'" data-i="'+i+'" '+(disabled?'disabled':'')+'>'+text+'</button>';
  const avatar=x.profileIcon?'<img src="'+esc(x.profileIcon)+'" alt="" style="width:30px;height:30px;border-radius:50%;object-fit:cover">':'👤';
  const info=marked?'💗処理済':x.duplicateCreator||creatorWasLiked(x.urlname)?'⚠ この人は過去にスキあり':'状態未確認';
  return '<article class="boost-five-card'+(state.index===i?' selected':'')+'" data-boost-card="'+i+'">'+
    '<div class="boost-five-title">'+(i+1)+' / '+total+'　'+avatar+'　'+esc(x.profileName||x.name||x.urlname||'')+' <span class="id">@'+esc(x.urlname||'')+'</span></div>'+
    '<div class="boost-five-article">'+(x.thumb?'<img src="'+esc(x.thumb)+'" alt="記事サムネイル" loading="lazy">':'<div class="boost-card-placeholder">画像なし</div>')+
    '<div><b>'+esc(x.title||x.key||'記事')+'</b><div class="meta">'+info+' ・ ♡'+(x.likeCount??'—')+'</div></div></div>'+
    '<div class="boost-five-actions">'+button('like',label,marked)+button('article','実記事',false)+button('preview','プレビュー',false)+
    button('creator','記事一覧',false)+button('mag','📚追加',false)+button('profile','👤本人',false)+
    button('favorite','☆保存',false)+(following?button('follow','フォロー確認',false):'')+'</div></article>';
}
async function boostCardAction(index,action){
  if(!Number.isInteger(index)||index<0||index>=state.queue.length)return;
  if(busy||magBusy){status('操作の処理が完了してから選択してください');return}
  state.index=index;saveState();
  for(const el of $$('#current [data-boost-card]'))el.classList.toggle('selected',Number(el.dataset.boostCard)===index);
  const x=current();
  if(action==='like')return void likeCurrent();
  if(action==='article')return goOut('https://note.com/'+encodeURIComponent(x.urlname)+'/n/'+encodeURIComponent(x.key));
  if(action==='preview')return void openPreview();
  if(action==='creator')return void openCreator();
  if(action==='mag')return void openMags();
  if(action==='profile')return goOut('https://note.com/'+encodeURIComponent(x.urlname));
  if(action==='favorite'){saveFavoriteCreator(x);saveFavoriteArticle();return}
  if(action==='follow'&&boostSettings().followEnabled)return void boostFollowChange(x.urlname,m=>status(m));
}
async function render(){
  const box=$('#current'),ticket=++boostRenderTicket;refreshLimits();
  if(!state.queue.length){box.classList.add('hidden');status(state.source?'巡回対象がありません':'巡回元を入力してください');return}
  state.index=Math.min(state.queue.length-1,Math.max(0,state.index));
  const page=boostPage(),start=page*BOOST_PAGE_SIZE,items=state.queue.slice(start,start+BOOST_PAGE_SIZE);
  box.classList.remove('hidden');
  box.innerHTML='<div class="progress">クリエイター '+(start+1)+'〜'+(start+items.length)+' / '+state.queue.length+' ｜ '+(page+1)+' / '+Math.ceil(state.queue.length/BOOST_PAGE_SIZE)+'ページ</div>'+
    '<div class="boost-five-list">'+items.map((x,j)=>boostCard(x,start+j,state.queue.length)).join('')+'</div>';
  for(const b of box.querySelectorAll('[data-boost-action]'))b.onclick=()=>void boostCardAction(Number(b.dataset.i),b.dataset.boostAction);
  $('#prev').disabled=page===0;$('#next').disabled=(page+1)*BOOST_PAGE_SIZE>=state.queue.length;
  void mapLimit(items,2,async (x,j)=>{
    const i=start+j;let detail=null,profile=null;
    try{detail=await noteDetail(x.key)}catch{}
    try{profile=await creatorProfile(x.urlname)}catch{}
    if(ticket!==boostRenderTicket)return;
    if(detail){
      if(detail.thumb&&!x.thumb)x.thumb=detail.thumb;
      if(detail.title)x.title=detail.title;
      if(detail.likeCount!=null)x.likeCount=detail.likeCount;
      if(detail.liked===true){x.liked=true;x.duplicateCreator=true;markCreatorLiked(x.urlname,x.key,state.likeSent[x.key]?'tool-confirmed':'preexisting')}
      else if(detail.liked===false)x.liked=false;
      if(detail.liked===true&&state.likeSent[x.key]){state.likedNow[x.key]=true;delete state.likeSent[x.key]}
    }
    if(profile){x.profileIcon=profile.icon||x.profileIcon;x.profileName=profile.name||x.profileName}
    saveState();
    const prev=box.querySelector('[data-boost-card="'+i+'"]');if(!prev||ticket!==boostRenderTicket)return;
    const next=document.createElement('div');next.innerHTML=boostCard(x,i,state.queue.length);const card=next.firstElementChild;
    prev.replaceWith(card);
    for(const b of card.querySelectorAll('[data-boost-action]'))b.onclick=()=>void boostCardAction(Number(b.dataset.i),b.dataset.boostAction);
  }).catch(()=>{});
}
function withReturn(raw){const x=new URL(raw,location.origin);x.searchParams.set('boost_return','1');return x.href}
function goOut(raw){saveState();location.assign(withReturn(raw))}
async function likeCurrent(){if(busy)return;const x=current();if(!x)return;busy=true;const b=$('#current [data-boost-action="like"][data-i="'+state.index+'"]');try{enforce('likes');if(b){b.disabled=true;b.textContent='確認中…'}const before=await api(`/api/v3/notes/${encodeURIComponent(x.key)}`),liked=readLiked(before),beforeCount=readLikeCount(before);if(liked===true){status('💗 元からスキ済み｜送信なし');await render();return}b.textContent='スキ中…';try{await api(`/api/v3/notes/${encodeURIComponent(x.key)}/likes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:'{}'})}catch(e){const body=JSON.stringify(e.body||'');if(/already|liked|exist/i.test(body)){status('💗 すでにスキ済み｜解除せず完了');await render();return}if(e.status===403)setGuard('likes',Date.now()+3600000,'403検出');if(e.status===429)setGuard('likes',Date.now()+Math.max(3600000,e.retryAfter||0),'429検出');throw e}state.likeSent[x.key]=true;pushHist('likes',x.key);saveState();let ok=false;for(const w of [300,800,1500,2500]){await sleep(w);try{const after=await api(`/api/v3/notes/${encodeURIComponent(x.key)}`),aLiked=readLiked(after),afterCount=readLikeCount(after);if(aLiked===true||(beforeCount!=null&&afterCount!=null&&afterCount>beforeCount)){ok=true;break}}catch{}}if(ok){state.likedNow[x.key]=true;x.duplicateCreator=true;markCreatorLiked(x.urlname,x.key,'tool');delete state.likeSent[x.key];saveState();status('❤️ スキ反映を確認しました｜次回この人は「⚠ 重複あり」と表示します')}else{status('❤️ スキは送信済み。反映表示は次回読み込みで再確認します')}await render()}catch(e){if(b){b.disabled=false;b.textContent='♡スキ'}status(formatError(e),true);refreshLimits()}finally{busy=false}}
function sanitizeHtml(html){const d=new DOMParser().parseFromString(`<div id="x">${html||''}</div>`,'text/html'),root=d.querySelector('#x');for(const n of root.querySelectorAll('script,style,iframe,object,embed,form'))n.remove();for(const n of root.querySelectorAll('*'))for(const a of [...n.attributes])if(/^on/i.test(a.name)||a.name==='srcdoc')n.removeAttribute(a.name);return root.innerHTML}
async function openPreview(){const x=current();if(!x)return;showModal('previewModal');$('#previewBody').innerHTML='読み込み中…';try{const d=await noteDetail(x.key);$('#previewBody').innerHTML=`${d.thumb?`<img class="thumb" src="${esc(d.thumb)}">`:''}<h2>${esc(d.title)}</h2><div class="meta">@${esc(d.urlname)}・♡${Number(d.likeCount||0)}</div><article style="margin-top:12px;line-height:1.8">${sanitizeHtml(d.body)||'<div class="empty">本文プレビューを取得できませんでした。</div>'}</article>`}catch(e){$('#previewBody').textContent=formatError(e)}}
function hydrateCreatorCovers(id,articles){
  const missing=articles.filter(x=>!x.thumb&&x.key).slice(0,12);
  return mapLimit(missing,2,async item=>{
    try{
      const src=await ogImage('https://note.com/'+encodeURIComponent(id)+'/n/'+encodeURIComponent(item.key));
      if(!src)return false;
      item.thumb=src;
      const row=[...document.querySelectorAll('#creatorBody .listrow[data-note-key]')]
        .find(el=>el.dataset.noteKey===item.key);
      if(!row)return false;
      const ph=row.querySelector('.boost-card-placeholder');
      if(ph){const img=document.createElement('img');img.src=src;img.alt='記事サムネイル';img.loading='lazy';ph.replaceWith(img)}
      return true;
    }catch{return false}
  });
}
async function openCreator(){const x=current();if(!x)return;showModal('creatorModal');$('#creatorBody').innerHTML='記事一覧を読み込み中…';try{const p=await creatorProfile(x.urlname),r=await creatorContents(x.urlname,1),arts=(r.items||[]).sort((a,b)=>Number(b.likeCount||0)-Number(a.likeCount||0)||recentSort(a,b)).slice(0,30);$('#creatorBody').innerHTML=`<div class="creator"><img id="creatorProfileGo" class="tap" src="${esc(p.icon||'')}"><div><div class="name">${esc(p.name||x.urlname)}</div><div class="id">@${esc(x.urlname)}</div><div class="stats">フォロワー ${p.followers||'—'}・記事 ${p.articleCount||arts.length||'—'}</div></div></div><div class="bio">${esc(p.bio||'')}</div><div style="margin:14px 0 8px;font-weight:900">クリエイターの記事一覧</div>${arts.map(a=>`<div class="listitem"><div class="listrow" data-note-key="${esc(a.key)}">${boostArticleThumbMarkup(a)}<div><b>${esc(a.title)}</b><div class="meta">${a.publishAt?new Date(a.publishAt).toLocaleDateString('ja-JP'):''}・♡${Number(a.likeCount||0)}${a.liked===true?'・💗スキ済み':''}</div><button data-open="https://note.com/${encodeURIComponent(x.urlname)}/n/${encodeURIComponent(a.key)}" style="margin-top:6px">実記事</button></div></div></div>`).join('')||'<div class="empty">記事を取得できませんでした</div>'}`;$('#creatorProfileGo').onclick=()=>goOut(`https://note.com/${encodeURIComponent(x.urlname)}`);for(const b of $('#creatorBody [data-open]'))b.onclick=()=>goOut(b.dataset.open);void hydrateCreatorCovers(x.urlname,arts)}catch(e){$('#creatorBody').textContent=formatError(e)}}
function magAdded(m,bel){for(const k of ['is_added','isAdded','has_note','hasNote','included','is_included','isIncluded','contains_note','containsNote','is_note_added','isNoteAdded','selected'])if(typeof m?.[k]==='boolean')return m[k];return bel.has(String(m?.key||''))}
function magThumb(m){for(const x of [m?.image_url,m?.imageUrl,m?.thumbnail_url,typeof m?.thumbnail==='string'?m.thumbnail:m?.thumbnail?.url,typeof m?.eyecatch==='string'?m.eyecatch:m?.eyecatch?.url,m?.cover_image_url,m?.coverImage,m?.cover_image?.url,typeof m?.image==='string'?m.image:m?.image?.url,m?.icon_url,m?.iconUrl,m?.icon?.url])if(typeof x==='string'&&/^https?:\/\//.test(x))return x;return''}
function magUrl(m,key){const raw=m?.url||m?.magazine_url||m?.magazineUrl;if(raw)return raw;const owner=m?.user?.urlname||m?.creator?.urlname||m?.owner?.urlname||state.me||'';return owner?`https://note.com/${encodeURIComponent(owner)}/m/${encodeURIComponent(key)}`:''}
async function loadMagazineBase(force=false){const cached=loadRaw(MAG_CACHE_KEY);if(!force&&cached?.t&&Date.now()-Number(cached.t)<600000&&Array.isArray(cached.items)&&cached.items.length)return cached.items;let arr=[];for(const ep of ['/api/v1/my/magazines?includes_editable=true','/api/v1/my/magazines']){try{const j=await api(ep,{timeoutMs:10000}),d=j?.data??j??{},a=d.magazines||j?.magazines||[];if(Array.isArray(a)&&a.length){arr=a;break}}catch{}}const items=arr.map(m=>({raw:m,key:String(m.key||''),name:String(m.name||m.title||m.key||''),count:Number(m.note_count??m.noteCount??m.notes_count??0)||0,image:magThumb(m),url:magUrl(m,String(m.key||'')),added:false})).filter(x=>x.key);if(items.length)saveRaw(MAG_CACHE_KEY,{t:Date.now(),items});return items}
async function editableMagazines(noteKey){const [baseR,mjR,njR]=await Promise.allSettled([loadMagazineBase(false),api(`/api/v1/my/magazines?includes_editable=true&note_key=${encodeURIComponent(noteKey)}`,{timeoutMs:12000}),api(`/api/v3/notes/${encodeURIComponent(noteKey)}`,{timeoutMs:12000})]),base=baseR.status==='fulfilled'?baseR.value:[],mj=mjR.status==='fulfilled'?mjR.value:{},nj=njR.status==='fulfilled'?njR.value:{},md=mj?.data??mj??{},arr=md.magazines||mj?.magazines||[],nd=nj?.data??nj??{},n=nd.note||nd,bel=new Set(nd.belonging_magazine_keys||n.belonging_magazine_keys||nj?.belonging_magazine_keys||[]),map=new Map(base.map(x=>[x.key,{...x,added:bel.has(x.key)}]));for(const m of (Array.isArray(arr)?arr:[])){const key=String(m.key||'');if(!key)continue;const prev=map.get(key)||{};map.set(key,{...prev,raw:m,key,name:String(m.name||m.title||prev.name||key),count:Number(m.note_count??m.noteCount??m.notes_count??prev.count??0)||0,image:magThumb(m)||prev.image||'',url:magUrl(m,key)||prev.url||'',added:magAdded(m,bel)})}return[...map.values()]}
async function ogImage(page){if(!page)return'';try{const html=await textReq(page),d=new DOMParser().parseFromString(html,'text/html');return d.querySelector('meta[property="og:image"]')?.content||d.querySelector('meta[name="twitter:image"]')?.content||''}catch{return''}}
async function hydrateMagThumbs(){const jobs=currentMags.filter(m=>!m.image&&m.url);await mapLimit(jobs,3,async m=>{m.image=await ogImage(m.url);const img=$(`#magBody [data-magrow="${CSS.escape(m.key)}"] img`),ph=$(`#magBody [data-magrow="${CSS.escape(m.key)}"] .magph`);if(m.image){if(img)img.src=m.image;else if(ph){const el=document.createElement('img');el.src=m.image;el.alt='';el.dataset.magopen=m.url;ph.replaceWith(el);el.onclick=()=>goOut(m.url)}}return m})}
function renderMagList(filter=''){const list=$('#magList');if(!list)return;const q=filter.trim().toLowerCase();list.innerHTML=currentMags.filter(m=>!q||m.name.toLowerCase().includes(q)).map(m=>`<label class="mag" data-magrow="${esc(m.key)}">${m.image?`<img src="${esc(m.image)}" data-magopen="${esc(m.url)}">`:'<div class="magph">📚</div>'}<input type="checkbox" data-magcheck value="${esc(m.key)}" ${m.added?'checked disabled':''}><span><b>${esc(m.name)}</b><div class="meta">${m.added?'✔ 追加済み':`${m.count}記事`}</div></span></label>`).join('')||'<div class="empty">該当するマガジンがありません</div>';for(const im of $$('#magList [data-magopen]'))im.onclick=e=>{e.preventDefault();e.stopPropagation();goOut(im.dataset.magopen)}}
async function openMags(){const x=current();if(!x)return;showModal('magModal');$('#magBody').innerHTML='マガジンを読み込み中…';try{const base=await loadMagazineBase(false);currentMags=base;$('#magBody').innerHTML=`<div class="mag-controls"><div class="bar"><input id="magSearch" placeholder="マガジン検索"><button id="magReload">更新</button></div><button id="magAddTop" class="mag-add">選択したマガジンへ追加</button><div id="magMsg" class="msg">追加状態を確認中…</div></div><div id="magList" class="mag-list"></div><button id="magAddBottom" class="mag-add">選択したマガジンへ追加</button>`;renderMagList();$('#magSearch').oninput=e=>renderMagList(e.target.value);$('#magAddTop').onclick=addSelectedMags;$('#magAddBottom').onclick=addSelectedMags;$('#magReload').onclick=async()=>{await loadMagazineBase(true);currentMags=await editableMagazines(x.key);renderMagList($('#magSearch')?.value||'');setMsg(`${currentMags.filter(m=>m.added).length}誌に追加済み`);void hydrateMagThumbs()};currentMags=await editableMagazines(x.key);renderMagList();setMsg(`${currentMags.filter(m=>m.added).length}誌に追加済み`);void hydrateMagThumbs()}catch(e){$('#magBody').textContent=formatError(e)}}
async function addSelectedMags(){if(magBusy)return;const x=current();if(!x)return;const keys=$$('#magBody [data-magcheck]:checked:not(:disabled)').map(e=>e.value);if(!keys.length){setMsg('追加先を選択してください');return}magBusy=true;for(const b of [$('#magAddTop'),$('#magAddBottom')].filter(Boolean)){b.disabled=true;b.textContent='追加中…'}let ok=0,already=0,fail=0;try{const detail=await noteDetail(x.key),noteId=x.id??detail.id;if(!noteId)throw new Error('記事IDを取得できません');for(const key of keys){try{enforce('mags');await api(`/api/v1/our/magazines/${encodeURIComponent(key)}/notes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:JSON.stringify({note_id:noteId,note_key:x.key})});pushHist('mags',`${key}:${x.key}`);ok++;const m=currentMags.find(z=>z.key===key);if(m)m.added=true;setMsg(`追加中… ${ok+already}/${keys.length}`)}catch(e){const body=JSON.stringify(e.body||'');if(/already|exist|included/i.test(body)||e.status===409||e.status===422){already++;const m=currentMags.find(z=>z.key===key);if(m)m.added=true;continue}if(e.status===403){setGuard('mags',Date.now()+3600000,'403検出');fail++;setMsg('403を検出したため停止しました');break}if(e.status===429){setGuard('mags',Date.now()+Math.max(3600000,e.retryAfter||0),'429検出');fail++;setMsg('429を検出したため停止しました');break}fail++}}renderMagList($('#magSearch')?.value||'');setMsg(`追加 ${ok}｜追加済み ${already}｜失敗 ${fail}`);refreshLimits()}catch(e){setMsg(formatError(e))}finally{magBusy=false;for(const b of [$('#magAddTop'),$('#magAddBottom')].filter(Boolean)){b.disabled=false;b.textContent='選択したマガジンへ追加'}}}
function showModal(id){try{document.activeElement?.blur?.()}catch{}const m=$('#'+id);if(m){m.classList.add('show');const body=m.querySelector('.modalbody');if(body)body.scrollTop=0}}
function closeModal(id){$('#'+id)?.classList.remove('show')}
for(const b of $$('[data-close]'))b.onclick=()=>closeModal(b.dataset.close);
$('#prev').onclick=async()=>{const p=boostPage();if(p>0){state.index=(p-1)*BOOST_PAGE_SIZE;saveState();await render();scrollTo(0,0)}};
$('#next').onclick=async()=>{const p=boostPage();if((p+1)*BOOST_PAGE_SIZE<state.queue.length){state.index=(p+1)*BOOST_PAGE_SIZE;saveState();await render();scrollTo(0,0)}else status('最後の巡回対象です')};
$('#reset').onclick=()=>{if(confirm('巡回リストと位置だけをリセットします。スキやマガジン追加は取り消しません。')){state.queue=[];state.index=0;state.source='';saveState();$('#source').value='';$('#current').classList.add('hidden');status('巡回をリセットしました｜巡回条件を入力できます')}};
boostPrefsForm($('#boostSettingsUI'),()=>{refreshLimits();void render()});
$('#backBoost').onclick=()=>{const m=$('.modal.show').pop();if(m)return closeModal(m.id);if(state.index>0)return $('#prev').click();location.assign('https://note.com/')};$('#exitBoost').onclick=()=>{saveState();location.assign('https://note.com/')};
$('#startSource').onclick=()=>void loadSource();$('#source').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void loadSource()}});$('#saveSource').onclick=()=>saveFavoriteSource($('#source').value);$('#showFavorites').onclick=openFavorites;$('#queueBtn').onclick=openQueue;



try{history.replaceState({boostRoot:1},'',APP_URL);history.pushState({boostGuard:1},'',APP_URL);addEventListener('popstate',()=>{const m=$$('.modal.show').pop();if(m)m.classList.remove('show');else if(boostPage()>0){state.index=(boostPage()-1)*BOOST_PAGE_SIZE;saveState();void render()}else{location.assign('https://note.com/');return}history.pushState({boostGuard:1},'',APP_URL)})}catch{}

async function diagnose(){try{status('noteログイン状態を確認中…');const me=await who();state.me=me.urlname.toLowerCase();if(state.me!=='ss_yr')throw Error('運営者本人のみ使用できます');saveState();$('#acct').textContent=`@${me.urlname}`;$('#startSource').disabled=false;$('#saveSource').disabled=false;ready=true;$('#source').value=state.source||'';refreshLimits();if(state.queue.length)await render();else status('巡回元を入力して開始できます');const pending=localStorage.getItem('noteBoostOwnerPendingSourceV681');if(pending){localStorage.removeItem('noteBoostOwnerPendingSourceV681');$('#source').value=pending;await loadSource()}else if(localStorage.getItem('noteBoostOwnerPendingMagazineV681')==='1'&&state.queue.length){localStorage.removeItem('noteBoostOwnerPendingMagazineV681');void openMags()}if(localStorage.getItem('noteBoostOwnerPendingQueueV693')==='1'){localStorage.removeItem('noteBoostOwnerPendingQueueV693');openQueue()}}catch(e){ready=false;$('#startSource').disabled=true;$('#saveSource').disabled=true;$('#acct').textContent='未接続';status(formatError(e),true);if(e?.code==='LOGIN'||e?.status===401)$('#status').insertAdjacentHTML('beforeend','<br><a class="login" href="https://note.com/login">noteへログイン</a>')}}
void diagnose();
})();
