(() => {
'use strict';
if (window.__NOTE_BOOST_V541_TAG_OWNER__) return;
window.__NOTE_BOOST_V541_TAG_OWNER__ = true;

const K='note巡回BOOST_v531';
const VERSION='5.4.1';
const nativeFetch=window.fetch.bind(window);
const norm=s=>String(s??'').normalize('NFKC').replace(/^#+/,'').trim().toLowerCase();
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(`${K}:${k}`))??fb}catch{return fb}};
const save=(k,v)=>{try{localStorage.setItem(`${K}:${k}`,JSON.stringify(v))}catch{}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function parseTags(raw){
  const s=String(raw||'').trim();
  if(!s||/^https?:/i.test(s))return[];
  return [...new Set(s.split(/[\s,、]+/).map(norm).filter(Boolean))];
}
function setStatus(s,bad=false){const e=document.querySelector('#nb532-status');if(e){if(e.textContent!==s)e.textContent=s;e.dataset.bad=bad?'1':'0'}}
function done(x){return x?.likeState==='preexisting'||x?.likeState==='liked_now'}
function applyResults(q){const r=load('results',{});return q.map(x=>r?.[x.key]?Object.assign(x,{likeState:r[x.key].state,likeDoneAt:r[x.key].t}):x)}
function firstIncomplete(q){for(let i=0;i<q.length;i++)if(!done(q[i]))return i;return q.length}
function thumbFromCard(card){for(const img of card?.querySelectorAll?.('img')||[]){const src=img.currentSrc||img.src||img.getAttribute('src')||'';if(/^https?:\/\//.test(src))return src}return''}
function textFromCard(card,key){
  if(!card)return key;
  const h=card.querySelector('h1,h2,h3,h4,[class*="title"],[data-testid*="title"]');
  const t=(h?.textContent||'').trim();
  if(t&&t.length<220)return t;
  return key;
}
function parseNoteHref(href){
  try{
    const u=new URL(href,location.origin);
    if(u.hostname!=='note.com')return null;
    const p=u.pathname.split('/').filter(Boolean);
    const ni=p.indexOf('n');
    if(ni!==1||!p[0]||!p[2])return null;
    const creator=decodeURIComponent(p[0]).replace(/^@/,'').toLowerCase();
    const key=decodeURIComponent(p[2]);
    if(!creator||!/^n[0-9a-z]+$/i.test(key))return null;
    return{creator,key,url:`https://note.com/${encodeURIComponent(creator)}/n/${encodeURIComponent(key)}`};
  }catch{return null}
}
function extractHashtagPageNotes(html){
  const out=[],seen=new Set();
  let doc;
  try{doc=new DOMParser().parseFromString(html,'text/html')}catch{return out}
  for(const a of doc.querySelectorAll('a[href]')){
    const p=parseNoteHref(a.getAttribute('href')||'');
    if(!p||seen.has(p.key))continue;
    const card=a.closest('article,[data-testid*="note"],[class*="noteCard"],[class*="note-card"],li,section,div');
    seen.add(p.key);
    out.push({key:p.key,urlname:p.creator,name:p.creator,title:textFromCard(card,p.key),thumb:thumbFromCard(card),url:p.url});
  }
  return out;
}
function canonicalTagsFromApi(j){
  const out=new Set(),d=j?.data??j??{},n=d.note||d;
  const walk=v=>{
    if(v==null)return;
    if(typeof v==='string'){const x=norm(v);if(x)out.add(x);return}
    if(Array.isArray(v)){for(const x of v)walk(x);return}
    if(typeof v!=='object')return;
    for(const k of ['name','tag','hashtag','label'])if(typeof v[k]==='string'){const x=norm(v[k]);if(x)out.add(x)}
    for(const k of ['hashtags','hashtag','hash_tags','hashTags','tags','tag_list','tagList'])if(k in v)walk(v[k]);
  };
  if(n&&typeof n==='object')for(const k of ['hashtags','hashtag','hash_tags','hashTags','tags','tag_list','tagList'])if(k in n)walk(n[k]);
  return out;
}
function canonicalTagsFromHtml(html){
  const out=new Set();
  try{
    const doc=new DOMParser().parseFromString(html,'text/html');
    for(const a of doc.querySelectorAll('a[href]')){
      const href=a.getAttribute('href')||'';
      let u;try{u=new URL(href,location.origin)}catch{continue}
      const p=u.pathname.split('/').filter(Boolean);
      if(p[0]!=='hashtag'||!p[1])continue;
      try{out.add(norm(decodeURIComponent(p[1])))}catch{out.add(norm(p[1]))}
    }
  }catch{}
  return out;
}
async function json(url){const r=await nativeFetch(url,{credentials:'include',headers:{accept:'application/json'}});if(!r.ok)throw new Error(String(r.status));return r.json()}
async function currentAccount(){
  try{const j=await json('/api/v2/current_user'),d=j?.data??j??{},u=d.user||d,id=String(u.urlname||u.url_name||u.username||'').replace(/^@/,'').toLowerCase();if(id)return id}catch{}
  return String(load('lastAccount',{})?.id||'').toLowerCase();
}
async function exactArticleTag(item,tag){
  const target=norm(tag);
  try{
    const j=await json(`/api/v3/notes/${encodeURIComponent(item.key)}`),tags=canonicalTagsFromApi(j);
    if(tags.has(target))return true;
    if(tags.size)return false;
  }catch{}
  try{
    const r=await nativeFetch(item.url,{credentials:'include'});
    if(!r.ok)return false;
    return canonicalTagsFromHtml(await r.text()).has(target);
  }catch{return false}
}
async function enrichItem(item){
  try{
    const j=await json(`/api/v3/notes/${encodeURIComponent(item.key)}`),d=j?.data??j??{},n=d.note||d,u=n.user||n.creator||{};
    item.id=n.id??n.note_id??item.id??null;
    item.name=String(u.nickname||u.name||item.name||item.urlname);
    item.title=String(n.name||n.title||item.title||item.key);
    for(const x of [n.eyecatch,n.eyecatch_image,n.eyecatchImage,n.image_url,n.thumbnail_url,n?.eyecatch?.url,n?.image?.url])if(typeof x==='string'&&/^https?:\/\//.test(x)){item.thumb=x;break}
  }catch{}
  return item;
}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let i=0;async function w(){for(;;){const n=i++;if(n>=items.length)return;try{out[n]=await fn(items[n],n)}catch{out[n]=null}}}await Promise.all(Array.from({length:Math.min(limit,items.length)},w));return out}

async function fetchHashtagPage(tag,page){
  const url=new URL(`/hashtag/${encodeURIComponent(tag)}`,location.origin);
  url.searchParams.set('sort','new');
  if(page>1)url.searchParams.set('page',String(page));
  const r=await nativeFetch(url.href,{credentials:'include',headers:{accept:'text/html,application/xhtml+xml'}});
  if(!r.ok)throw new Error(`ハッシュタグページ取得 ${r.status}`);
  return{url:url.href,html:await r.text()};
}
async function buildHashtagQueue(raw){
  const tags=parseTags(raw),cfg=Object.assign({count:100},load('cfg',{})),max=Math.max(1,Math.min(500,Number(cfg.count)||100));
  const me=await currentAccount(),out=[],creators=new Set();
  for(const tag of tags){
    const seenPageSig=new Set(),seenNotes=new Set();
    for(let page=1;page<=80&&out.length<max;page++){
      setStatus(`🏷 #${tag} タグページ取得 ${out.length}/${max}`);
      const {html}=await fetchHashtagPage(tag,page);
      const found=extractHashtagPageNotes(html).filter(x=>!seenNotes.has(x.key));
      const sig=found.slice(0,12).map(x=>x.key).join('|');
      if(!found.length||!sig||seenPageSig.has(sig))break;
      seenPageSig.add(sig);
      for(const x of found)seenNotes.add(x.key);

      setStatus(`🏷 #${tag} 実タグ確認 ${out.length}/${max}`);
      const checks=await mapLimit(found,4,x=>exactArticleTag(x,tag));
      for(let i=0;i<found.length&&out.length<max;i++){
        if(checks[i]!==true)continue;
        const x=found[i];
        if(!x.urlname||x.urlname===me||creators.has(x.urlname))continue;
        creators.add(x.urlname);
        x.source=`#${tag}`;
        out.push(x);
      }
      if(page%5===0)await sleep(80);
    }
    if(out.length>=max)break;
  }
  const enriched=(await mapLimit(out,5,enrichItem)).filter(Boolean);
  return applyResults(enriched);
}

// #巡回はこのファイルが完全所有する。旧keyword検索キューは再利用しない。
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
    try{sessionStorage.setItem('noteBoost541Message',q.length?`✅ #タグページ完全一致 ${q.length}人を保存`:'⚠ #タグページに完全一致する巡回対象は0件でした')}catch{}
    location.reload();
  }catch(err){
    save('queue',[]);save('index',0);save('source',raw);
    setStatus(`⚠ #タグページ取得に失敗: ${err?.message||err}`,true);
    const card=document.querySelector('#nb532-card');if(card)card.style.display='none';
  }finally{b.dataset.strictBusy='0';b.disabled=false}
},true);

function showReloadMessage(){
  try{const m=sessionStorage.getItem('noteBoost541Message');if(!m)return;sessionStorage.removeItem('noteBoost541Message');setTimeout(()=>setStatus(m,!m.startsWith('✅')),120)}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showReloadMessage,{once:true});else showReloadMessage();
})();
