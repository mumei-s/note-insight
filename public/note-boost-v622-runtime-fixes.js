(() => {
'use strict';
const APP_URL='https://note.com/?boost_app=1';
const STORE='noteBoostDedicatedV620';
const LIMIT_PREFIX='noteBoostDedicatedLimit:';
const u=new URL(location.href);
const dedicated=u.searchParams.get('boost_app')==='1';
const fromBoost=u.searchParams.get('boost_return')==='1';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
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
function withReturn(raw){const x=new URL(raw,location.origin);x.searchParams.set('boost_return','1');return x.href}
function goOut(raw){try{sessionStorage.setItem('noteBoostReturnV622',APP_URL)}catch{}location.assign(withReturn(raw))}

if(!dedicated){
  if(fromBoost){
    const add=()=>{if(document.getElementById('noteBoostReturnV622'))return;const b=document.createElement('button');b.id='noteBoostReturnV622';b.textContent='← 巡回BOOSTへ戻る';b.style.cssText='position:fixed;left:10px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:2147483647;border:0;border-radius:999px;padding:11px 14px;background:#071b28;color:#fff;font:700 13px system-ui;box-shadow:0 6px 24px #0008';b.onclick=()=>location.assign(APP_URL);document.body.appendChild(b)};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add,{once:true});else add();
  }
  return;
}

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
function magAdded(m,bel){for(const k of ['is_added','isAdded','selected','has_note','hasNote','included','is_included','isIncluded','contains_note','containsNote','is_note_added','isNoteAdded'])if(typeof m?.[k]==='boolean')return m[k];return bel.has(String(m?.key||''))}
async function editableMags(item){
  const [mj,nj]=await Promise.all([api(`/api/v1/my/magazines?includes_editable=true&note_key=${encodeURIComponent(item.key)}`),api(`/api/v3/notes/${encodeURIComponent(item.key)}`)]);
  const md=mj?.data??mj??{},arr=md.magazines||mj?.magazines||[],nd=nj?.data??nj??{},note=nd.note||nd;
  const bel=new Set(nd.belonging_magazine_keys||note.belonging_magazine_keys||nj?.belonging_magazine_keys||[]),state=loadState();
  return (Array.isArray(arr)?arr:[]).map(m=>{const key=String(m.key||'');return{raw:m,key,name:String(m.name||m.title||key),count:Number(m.note_count??m.noteCount??0)||0,image:magThumb(m),url:magUrl(m,key,state),added:magAdded(m,bel)}}).filter(x=>x.key);
}
async function fillMissingMagThumbs(mags){
  const targets=mags.filter(m=>!m.image&&m.url);
  let i=0;async function worker(){for(;;){const n=i++;if(n>=targets.length)return;targets[n].image=await ogImage(targets[n].url)}}
  await Promise.all(Array.from({length:Math.min(4,targets.length)},worker));
}
let magBusy=false;
function magPickerHtml(mags){
  const rows=mags.map(m=>`<label class="boost-mag-row" data-name="${String(m.name).toLowerCase().replace(/"/g,'&quot;')}" style="display:grid;grid-template-columns:58px 1fr 28px;gap:9px;align-items:center;border:1px solid #294252;border-radius:11px;background:#09141c;padding:8px;margin-bottom:7px">${m.image?`<img src="${m.image.replace(/"/g,'&quot;')}" data-url="${(m.url||'').replace(/"/g,'&quot;')}" style="width:58px;height:58px;object-fit:cover;border-radius:8px;background:#15232c">`:'<div style="width:58px;height:58px;display:grid;place-items:center;border-radius:8px;background:#15232c;font-size:25px">📚</div>'}<span><b>${m.name}</b><small style="display:block;color:#88a3b5;margin-top:3px">${m.added?'追加済み':`${m.count}記事`}</small></span><input class="boost-mag-check" type="checkbox" value="${m.key.replace(/"/g,'&quot;')}" ${m.added?'checked disabled':''} style="width:22px;height:22px"></label>`).join('');
  return `<button id="boostMagAddTop" class="primary" style="width:100%;margin-bottom:8px">選択したマガジンへ追加</button><input id="boostMagSearch" placeholder="マガジン検索" style="margin-bottom:8px"><div id="boostMagList">${rows||'<div class="empty">編集可能なマガジンがありません</div>'}</div><button id="boostMagAddBottom" class="primary" style="width:100%;margin-top:8px">選択したマガジンへ追加</button><div id="boostMagStatus" class="status" style="margin-top:8px">${mags.filter(x=>x.added).length}誌に追加済み</div>`;
}
async function openMagazinePicker(){
  const item=current();if(!item)return;
  const modal=$('#magModal'),body=$('#magBody');if(!modal||!body)return;
  modal.classList.add('show');body.innerHTML='マガジン一覧を取得中…';
  try{
    const mags=await editableMags(item);body.innerHTML=magPickerHtml(mags);
    void fillMissingMagThumbs(mags).then(()=>{if($('#magModal.show')){const checks=new Map($$('.boost-mag-check',body).map(x=>[x.value,{checked:x.checked,disabled:x.disabled}]));body.innerHTML=magPickerHtml(mags);for(const x of $$('.boost-mag-check',body)){const s=checks.get(x.value);if(s&&!s.disabled)x.checked=s.checked}bindMagPicker(item,mags)}});
    bindMagPicker(item,mags);
  }catch(e){body.textContent=`マガジン一覧取得失敗：${e?.message||e}`;setStatus('マガジン一覧取得に失敗しました',true)}
}
function bindMagPicker(item,mags){
  const body=$('#magBody');if(!body)return;
  const search=$('#boostMagSearch',body);if(search)search.oninput=()=>{const q=search.value.toLowerCase();$$('.boost-mag-row',body).forEach(r=>r.style.display=!q||r.dataset.name.includes(q)?'grid':'none')};
  for(const img of $$('img[data-url]',body))img.onclick=e=>{e.preventDefault();e.stopPropagation();if(img.dataset.url)goOut(img.dataset.url)};
  const add=()=>void addSelectedMags(item,mags);
  $('#boostMagAddTop',body)?.addEventListener('click',add);$('#boostMagAddBottom',body)?.addEventListener('click',add);
}
async function addSelectedMags(item,mags){
  if(magBusy)return;const body=$('#magBody'),out=$('#boostMagStatus',body);if(!body||!out)return;
  const keys=$$('.boost-mag-check:checked:not(:disabled)',body).map(x=>x.value);if(!keys.length){out.textContent='追加先を選んでください';return}
  magBusy=true;for(const b of [$('#boostMagAddTop',body),$('#boostMagAddBottom',body)])if(b){b.disabled=true;b.textContent='追加中…'};
  let ok=0,skip=0,fail=0;
  try{
    const lim=limit('mags');if(lim.until>Date.now()){out.textContent=`安全上限により保護中・解除 ${new Date(lim.until).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}`;return}
    const nj=await api(`/api/v3/notes/${encodeURIComponent(item.key)}`),nd=nj?.data??nj??{},note=nd.note||nd,noteId=item.id??note.id??note.note_id??note.noteId??null;if(!noteId)throw new Error('記事ID取得失敗');
    for(const key of keys){
      const l=limit('mags');if(l.until>Date.now()){out.textContent=`追加 ${ok}｜追加済み ${skip}｜失敗 ${fail}｜上限保護中`;break}
      try{
        await api(`/api/v1/our/magazines/${encodeURIComponent(key)}/notes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:JSON.stringify({note_id:noteId,note_key:item.key})});
        putHist('mags',`${key}:${item.key}`);ok++;
        const cb=$(`.boost-mag-check[value="${CSS.escape(key)}"]`,body);if(cb){cb.checked=true;cb.disabled=true;const sm=cb.closest('.boost-mag-row')?.querySelector('small');if(sm)sm.textContent='追加済み'}
      }catch(e){const txt=JSON.stringify(e.body||'');if(/already|exist|added/i.test(txt)){skip++;const cb=$(`.boost-mag-check[value="${CSS.escape(key)}"]`,body);if(cb){cb.checked=true;cb.disabled=true}continue}if(e.status===403)setGuard('mags',Date.now()+3600000,'403検出・60分保護');if(e.status===429)setGuard('mags',Date.now()+Math.max(3600000,e.retryAfter||0),'429検出');fail++;if(e.status===403||e.status===429)break}
    }
    out.textContent=`追加 ${ok}｜追加済み ${skip}｜失敗 ${fail}`;setStatus(ok?`📚 ${ok}誌へ追加しました`:'📚 マガジン追加を確認してください',!ok&&fail>0);
  }catch(e){out.textContent=`失敗：${e?.message||e}`;setStatus('マガジン追加に失敗しました',true)}finally{magBusy=false;for(const b of [$('#boostMagAddTop',body),$('#boostMagAddBottom',body)])if(b){b.disabled=false;b.textContent='選択したマガジンへ追加'}}
}

function normalizeMagazineUi(){const top=$('#topMag');if(top){top.style.display='none';const p=top.parentElement;if(p&&p.classList.contains('top-actions'))p.style.gridTemplateColumns='1fr'}}
const uiObs=new MutationObserver(normalizeMagazineUi);uiObs.observe(document.documentElement,{subtree:true,childList:true});setTimeout(normalizeMagazineUi,50);

document.addEventListener('click',e=>{
  const t=e.target.closest?.('button,img,.tap');if(!t)return;
  if(t.id==='likeBtn'){e.preventDefault();e.stopImmediatePropagation();void fixedLike();return}
  if(t.id==='magBtn'||t.id==='quickMag'||t.id==='topMag'){e.preventDefault();e.stopImmediatePropagation();void openMagazinePicker();return}
  const state=loadState(),item=state?.queue?.[Number(state.index)||0];
  if(t.id==='openBtn'&&item){e.preventDefault();e.stopImmediatePropagation();goOut(`https://note.com/${encodeURIComponent(item.urlname)}/n/${encodeURIComponent(item.key)}`);return}
  if((t.id==='profileImg'||t.id==='profileName'||t.id==='creatorProfileGo')&&item){e.preventDefault();e.stopImmediatePropagation();goOut(`https://note.com/${encodeURIComponent(item.urlname)}`);return}
  if(t.matches?.('#creatorBody [data-open]')){e.preventDefault();e.stopImmediatePropagation();goOut(t.dataset.open);return}
},true);
})();