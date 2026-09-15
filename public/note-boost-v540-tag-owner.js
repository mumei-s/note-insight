(() => {
'use strict';
if (window.__NOTE_BOOST_V540_TAG_OWNER__) return;
window.__NOTE_BOOST_V540_TAG_OWNER__ = true;

const K='note巡回BOOST_v531';
const VERSION='5.4.0';
const nativeFetch=window.fetch.bind(window);
const norm=s=>String(s??'').normalize('NFKC').replace(/^#+/,'').trim().toLowerCase();
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(`${K}:${k}`))??fb}catch{return fb}};
const save=(k,v)=>{try{localStorage.setItem(`${K}:${k}`,JSON.stringify(v))}catch{}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function keyOf(n){return String(n?.key||n?.note_key||n?.noteKey||n?.slug||'').trim()}
function userOf(n){return n?.user||n?.creator||n?.note_user||{}}
function thumbOf(n){for(const x of [n?.eyecatch,n?.eyecatch_image,n?.eyecatchImage,n?.image,n?.image_url,n?.thumbnail,n?.thumbnail_url,n?.eyecatch?.url,n?.image?.url,n?.thumbnail?.url])if(typeof x==='string'&&/^https?:\/\//.test(x))return x;return''}
function parseTags(raw){const s=String(raw||'').trim();if(!s||/^https?:/i.test(s))return[];return[...new Set(s.split(/[\s,、]+/).map(norm).filter(Boolean))]}
function setStatus(s,bad=false){const e=document.querySelector('#nb532-status');if(e){if(e.textContent!==s)e.textContent=s;e.dataset.bad=bad?'1':'0'}}
async function json(url){const r=await nativeFetch(url,{credentials:'include',headers:{accept:'application/json'}});if(!r.ok)throw new Error(`${r.status}`);return r.json()}
function normalizeSearch(j){const d=j?.data??j??{},n=d.notes||{},a=n.contents||n.notes||d.contents||[];return{arr:Array.isArray(a)?a:[],cursor:d?.cursor?.note??d.note_cursor??n.next_cursor??n.cursor??null,last:n.is_last_page===true||n.isLastPage===true}}

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
      let m=href.match(/\/hashtag\/([^/?#]+)/i);
      if(m){try{out.add(norm(decodeURIComponent(m[1])))}catch{out.add(norm(m[1]))};continue}
      try{
        const u=new URL(href,location.origin);
        if(/search/i.test(u.pathname)&&u.searchParams.get('context')==='note'){
          const q=u.searchParams.get('q');
          if(q&&/^#/.test(q.trim()))out.add(norm(q));
        }
      }catch{}
    }
  }catch{}
  return out;
}
async function exactTagMatch(n,wanted){
  const key=keyOf(n);if(!key)return false;
  const target=norm(wanted);if(!target)return false;
  const u=userOf(n),id=String(u.urlname||u.url_name||u.username||'').replace(/^@/,'').toLowerCase();
  try{
    const detail=await json(`/api/v3/notes/${encodeURIComponent(key)}`);
    const tags=canonicalTagsFromApi(detail);
    if(tags.has(target))return true;
    if(tags.size)return false;
  }catch{}
  if(!id)return false;
  try{
    const r=await nativeFetch(`https://note.com/${encodeURIComponent(id)}/n/${encodeURIComponent(key)}`,{credentials:'include'});
    if(!r.ok)return false;
    const tags=canonicalTagsFromHtml(await r.text());
    return tags.has(target);
  }catch{return false}
}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let i=0;async function w(){for(;;){const n=i++;if(n>=items.length)return;try{out[n]=await fn(items[n],n)}catch{out[n]=false}}}await Promise.all(Array.from({length:Math.min(limit,items.length)},w));return out}
async function currentAccount(){
  try{const j=await json('/api/v2/current_user'),d=j?.data??j??{},u=d.user||d,id=String(u.urlname||u.url_name||u.username||'').replace(/^@/,'').toLowerCase();if(id)return id}catch{}
  return String(load('lastAccount',{})?.id||'').toLowerCase();
}
function applyResults(q){const r=load('results',{});return q.map(x=>r?.[x.key]?Object.assign(x,{likeState:r[x.key].state,likeDoneAt:r[x.key].t}):x)}
function done(x){return x?.likeState==='preexisting'||x?.likeState==='liked_now'}
function firstIncomplete(q){for(let i=0;i<q.length;i++)if(!done(q[i]))return i;return q.length}

async function buildStrictQueue(raw){
  const tags=parseTags(raw),cfg=Object.assign({count:100},load('cfg',{})),max=Math.max(1,Math.min(500,Number(cfg.count)||100));
  const me=await currentAccount(),out=[],creators=new Set();
  for(const tag of tags){
    let cursor='0',page=0;
    while(out.length<max&&page<150){
      page++;
      setStatus(`🏷 #${tag} 実タグ確認中 ${out.length}/${max}`);
      const j=await json(`/api/v3/searches?context=note&q=${encodeURIComponent(tag)}&size=20&start=${encodeURIComponent(cursor)}&sort=new`),s=normalizeSearch(j);
      if(!s.arr.length)break;
      const ok=await mapLimit(s.arr,4,n=>exactTagMatch(n,tag));
      for(let i=0;i<s.arr.length&&out.length<max;i++){
        if(!ok[i])continue;
        const n=s.arr[i],u=userOf(n),id=String(u.urlname||u.url_name||u.username||'').replace(/^@/,'').toLowerCase(),key=keyOf(n);
        if(!id||id===me||!key||creators.has(id))continue;
        creators.add(id);
        out.push({key,id:n.id??n.note_id??null,urlname:id,name:String(u.nickname||u.name||id),title:String(n.name||n.title||key),thumb:thumbOf(n),source:`#${tag}`});
      }
      if(s.last||s.cursor==null||String(s.cursor)===String(cursor))break;
      cursor=String(s.cursor);
      if(page%8===0)await sleep(80);
    }
    if(out.length>=max)break;
  }
  return applyResults(out);
}

// v5.3.xの誤ヒット入り#キューは、この版で一度だけ捨てる。完了履歴は保持。
try{
  if(localStorage.getItem(`${K}:strictTagQueueVersion`)!==VERSION){
    const src=String(load('source','')||'').trim();
    if(src.startsWith('#')){localStorage.removeItem(`${K}:queue`);localStorage.removeItem(`${K}:index`)}
    localStorage.setItem(`${K}:strictTagQueueVersion`,VERSION);
  }
}catch{}

document.addEventListener('click',async e=>{
  const b=e.target instanceof Element?e.target.closest('#nb532-start'):null;if(!b)return;
  const input=document.querySelector('#nb532-source'),raw=String(input?.value||'').trim();
  if(!parseTags(raw).length)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  if(b.dataset.strictBusy==='1')return;
  b.dataset.strictBusy='1';b.disabled=true;
  try{
    // 画面上の旧カードも検索中は隠して、前の誤キューを見せない。
    const card=document.querySelector('#nb532-card');if(card)card.style.display='none';
    save('source',raw);save('queue',[]);save('index',0);
    const q=await buildStrictQueue(raw);
    save('queue',q);save('index',firstIncomplete(q));save('source',raw);
    try{sessionStorage.setItem('noteBoost540Message',q.length?`✅ #完全一致 ${q.length}人を保存`:'⚠ 完全一致する巡回対象は0件でした')}catch{}
    location.reload();
  }catch(err){
    save('queue',[]);save('index',0);save('source',raw);
    setStatus(`⚠ #完全一致検索に失敗: ${err?.message||err}`,true);
    const card=document.querySelector('#nb532-card');if(card)card.style.display='none';
  }finally{b.dataset.strictBusy='0';b.disabled=false}
},true);

function showReloadMessage(){
  try{const m=sessionStorage.getItem('noteBoost540Message');if(!m)return;sessionStorage.removeItem('noteBoost540Message');setTimeout(()=>setStatus(m,!m.startsWith('✅')),120)}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showReloadMessage,{once:true});else showReloadMessage();
})();
