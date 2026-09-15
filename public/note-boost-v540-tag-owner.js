(() => {
'use strict';
if (window.__NOTE_BOOST_V543_TAG_OWNER__) return;
window.__NOTE_BOOST_V543_TAG_OWNER__ = true;

const K='note巡回BOOST_v531';
const VERSION='5.4.3';
const nativeFetch=window.fetch.bind(window);
const norm=s=>String(s??'').normalize('NFKC').replace(/^#+/,'').trim().toLowerCase();
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(`${K}:${k}`))??fb}catch{return fb}};
const save=(k,v)=>{try{localStorage.setItem(`${K}:${k}`,JSON.stringify(v))}catch{}};

function parseTags(raw){
  const s=String(raw||'').trim();
  if(!s||/^https?:/i.test(s))return[];
  return [...new Set(s.split(/[\s,、]+/).map(norm).filter(Boolean))];
}
function setStatus(s,bad=false){const e=document.querySelector('#nb532-status');if(e){if(e.textContent!==s)e.textContent=s;e.dataset.bad=bad?'1':'0'}}
function done(x){return x?.likeState==='preexisting'||x?.likeState==='liked_now'}
function applyResults(q){const r=load('results',{});return q.map(x=>r?.[x.key]?Object.assign(x,{likeState:r[x.key].state,likeDoneAt:r[x.key].t}):x)}
function firstIncomplete(q){for(let i=0;i<q.length;i++)if(!done(q[i]))return i;return q.length}

async function json(url){
  const r=await nativeFetch(url,{credentials:'include',headers:{accept:'application/json'}});
  if(!r.ok){const e=new Error(`${r.status} ${r.statusText}`);e.status=r.status;throw e}
  return r.json();
}
async function currentAccount(){
  try{const j=await json('/api/v2/current_user'),d=j?.data??j??{},u=d.user||d,id=String(u.urlname||u.url_name||u.username||'').replace(/^@/,'').toLowerCase();if(id)return id}catch{}
  return String(load('lastAccount',{})?.id||'').toLowerCase();
}
function keyOf(n){return String(n?.key||n?.note_key||n?.noteKey||n?.slug||'')}
function userOf(n){return n?.user||n?.creator||n?.note_user||{}}
function thumbOf(n){
  for(const x of [n?.eyecatch_url,n?.eyecatch,n?.eyecatch_image,n?.eyecatchImage,n?.image_url,n?.thumbnail_url,n?.image?.url,n?.thumbnail?.url]){
    if(typeof x==='string'&&/^https?:\/\//.test(x))return x;
  }
  return'';
}
function normalizeHashtagResponse(j){
  const d=j?.data??j??{};
  const box=d.notes??d.contents??[];
  const arr=Array.isArray(box)?box:(Array.isArray(box?.contents)?box.contents:(Array.isArray(box?.notes)?box.notes:[]));
  const isLast=Boolean(d.is_last_page??d.isLastPage??box?.is_last_page??box?.isLastPage??false);
  const next=d.next_page??d.nextPage??box?.next_page??box?.nextPage??null;
  const count=Number(d.count??d.total_count??d.totalCount??box?.count??0)||0;
  return{arr,isLast,next,count};
}
function toQueueItem(n,tag){
  const key=keyOf(n),u=userOf(n),urlname=String(u.urlname||u.url_name||u.username||'').replace(/^@/,'').toLowerCase();
  if(!key||!urlname)return null;
  return{
    key,
    id:n.id??n.note_id??n.noteId??null,
    urlname,
    name:String(u.nickname||u.name||urlname),
    title:String(n.name||n.title||key),
    thumb:thumbOf(n),
    source:`#${tag}`,
    url:`https://note.com/${encodeURIComponent(urlname)}/n/${encodeURIComponent(key)}`
  };
}
async function tagInfo(tag){
  try{const j=await json(`/api/v2/hashtags/${encodeURIComponent(tag)}`),d=j?.data??j??{};return d.hashtag||d}catch{return null}
}
async function buildHashtagQueue(raw){
  const tags=parseTags(raw),cfg=Object.assign({count:100},load('cfg',{})),max=Math.max(1,Math.min(500,Number(cfg.count)||100));
  const me=await currentAccount(),out=[],creators=new Set();
  for(const tag of tags){
    let page=1,reportedCount=0;
    while(out.length<max&&page<=100){
      setStatus(`🏷 #${tag} タグAPI取得 ${out.length}/${max}`);
      const j=await json(`/api/v3/hashtags/${encodeURIComponent(tag)}/notes?order=new&page=${page}`);
      const s=normalizeHashtagResponse(j);
      if(s.count)reportedCount=s.count;
      if(!s.arr.length)break;
      for(const n of s.arr){
        if(out.length>=max)break;
        const x=toQueueItem(n,tag);if(!x)continue;
        if(x.urlname===me||creators.has(x.urlname))continue;
        creators.add(x.urlname);out.push(x);
      }
      if(s.isLast)break;
      if(s.next!=null){
        const np=Number(s.next);page=Number.isFinite(np)&&np>page?np:page+1;
      }else{
        if(s.arr.length<50)break;
        page++;
      }
    }
    if(out.length===0){
      const info=await tagInfo(tag),cnt=Number(info?.count??info?.note_count??reportedCount)||reportedCount;
      if(cnt>0)throw new Error(`#${tag} は${cnt}件ありますが記事一覧取得が0件でした`);
    }
    if(out.length>=max)break;
  }
  return applyResults(out);
}

// v5.4.2以前のHTML/キーワード検索キューは#巡回だけ再利用しない。
try{
  const marker=`${K}:strictTagQueueVersion`;
  if(localStorage.getItem(marker)!==VERSION){
    const src=String(load('source','')||'').trim();
    if(src.startsWith('#')){localStorage.removeItem(`${K}:queue`);localStorage.removeItem(`${K}:index`)}
    localStorage.setItem(marker,VERSION);
  }
}catch{}

document.addEventListener('click',async e=>{
  const b=e.target instanceof Element?e.target.closest('#nb532-start'):null;if(!b)return;
  const input=document.querySelector('#nb532-source'),raw=String(input?.value||'').trim();
  if(!raw.startsWith('#')||!parseTags(raw).length)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  if(b.dataset.strictBusy==='1')return;
  b.dataset.strictBusy='1';b.disabled=true;
  try{
    const card=document.querySelector('#nb532-card');if(card)card.style.display='none';
    save('source',raw);save('queue',[]);save('index',0);
    const q=await buildHashtagQueue(raw);
    save('queue',q);save('index',firstIncomplete(q));save('source',raw);
    try{sessionStorage.setItem('noteBoost543Message',q.length?`✅ #タグ完全一致 ${q.length}人を保存`:'⚠ #タグの巡回対象は0件でした')}catch{}
    location.reload();
  }catch(err){
    save('queue',[]);save('index',0);save('source',raw);
    setStatus(`⚠ #タグ取得失敗: ${err?.message||err}`,true);
    const card=document.querySelector('#nb532-card');if(card)card.style.display='none';
  }finally{b.dataset.strictBusy='0';b.disabled=false}
},true);

function showReloadMessage(){
  try{const m=sessionStorage.getItem('noteBoost543Message');if(!m)return;sessionStorage.removeItem('noteBoost543Message');setTimeout(()=>setStatus(m,!m.startsWith('✅')),120)}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showReloadMessage,{once:true});else showReloadMessage();
})();