(() => {
'use strict';
if (window.__NOTE_BOOST_V539_STRICT_TAG__) return;
window.__NOTE_BOOST_V539_STRICT_TAG__ = true;

const K='note巡回BOOST_v531';
let active = null;
const nativeFetch = window.fetch.bind(window);
// 完全一致用。表記ゆれとして許可するのは Unicode 正規化・先頭#・前後空白だけ。
const norm = s => String(s ?? '').normalize('NFKC').replace(/^#+/,'').trim().toLowerCase();

// v5.3.8以前の #検索キューには部分一致/検索補助値由来の誤採用が残り得る。
// 完了履歴(results)は保持し、#由来の巡回対象だけ一度作り直す。
try{
  const marker=`${K}:strictTagQueueVersion`;
  if(localStorage.getItem(marker)!=='5.3.9'){
    let src='';
    try{src=JSON.parse(localStorage.getItem(`${K}:source`)||'""')||''}catch{}
    if(String(src).trim().startsWith('#')){
      localStorage.removeItem(`${K}:queue`);
      localStorage.removeItem(`${K}:index`);
    }
    localStorage.setItem(marker,'5.3.9');
  }
}catch{}

function parseRequestedTags(raw){
  const s=String(raw||'').trim();
  if(!s || /^https?:/i.test(s)) return [];
  return [...new Set(s.split(/[\s,、]+/).map(norm).filter(Boolean))];
}
function noteKey(n){return String(n?.key||n?.note_key||n?.noteKey||n?.slug||'').trim()}

// 「タグ配列」の中だけを見る。text / keyword / value など検索補助項目は一切タグ名にしない。
function collectCanonicalTagNames(v,out,depth=0){
  if(v==null||depth>6)return;
  if(typeof v==='string'){
    const x=norm(v);if(x)out.add(x);return;
  }
  if(Array.isArray(v)){
    for(const x of v)collectCanonicalTagNames(x,out,depth+1);
    return;
  }
  if(typeof v!=='object')return;

  // noteの実タグ名として扱うのは name / tag / hashtag / label のみ。
  for(const k of ['name','tag','hashtag','label']){
    if(typeof v[k]==='string'){
      const x=norm(v[k]);if(x)out.add(x);
    }
  }
  // タグコンテナ内の既知の入れ子だけ辿る。一般text/keyword等へは降りない。
  for(const k of ['hashtags','hashtag','hash_tags','hashTags','tags','tag_list','tagList','items','contents']){
    if(k in v && (typeof v[k]==='object'||Array.isArray(v[k]))) collectCanonicalTagNames(v[k],out,depth+1);
  }
}
function extractExactTags(j){
  const out=new Set(),d=j?.data??j??{},n=d.note||d;
  if(!n||typeof n!=='object')return out;
  for(const k of ['hashtags','hashtag','hash_tags','hashTags','tags','tag_list','tagList']){
    if(k in n)collectCanonicalTagNames(n[k],out,0);
  }
  // 本文オブジェクトにタグ配列が明示される形式のみ確認。本文文字列は検索しない。
  const body=n.body||n.note||null;
  if(body&&typeof body==='object'){
    for(const k of ['hashtags','hashtag','hash_tags','hashTags','tags','tag_list','tagList']){
      if(k in body)collectCanonicalTagNames(body[k],out,0);
    }
  }
  return out;
}
async function exactMatch(n,wanted){
  const key=noteKey(n);if(!key)return false;
  const target=norm(wanted);
  if(!target)return false;
  try{
    const r=await nativeFetch(`/api/v3/notes/${encodeURIComponent(key)}`,{credentials:'include',headers:{accept:'application/json'}});
    if(!r.ok)return false;
    const j=await r.json(),actual=extractExactTags(j);
    // includes / startsWith / 部分一致は禁止。Setの完全一致だけ。
    return actual.has(target);
  }catch{return false}
}
async function mapLimit(items,limit,fn){
  const out=new Array(items.length);let i=0;
  async function worker(){for(;;){const n=i++;if(n>=items.length)return;try{out[n]=await fn(items[n],n)}catch{out[n]=false}}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return out;
}
function getNotesContainer(j){
  const d=j?.data??j??{},notes=d.notes||{};
  if(Array.isArray(notes.contents))return{arr:notes.contents,set:a=>{notes.contents=a}};
  if(Array.isArray(notes.notes))return{arr:notes.notes,set:a=>{notes.notes=a}};
  if(Array.isArray(d.contents))return{arr:d.contents,set:a=>{d.contents=a}};
  return null;
}
function responseFrom(r,j){
  const h=new Headers(r.headers);h.delete('content-length');h.set('content-type','application/json; charset=utf-8');
  return new Response(JSON.stringify(j),{status:r.status,statusText:r.statusText,headers:h});
}

document.addEventListener('click',e=>{
  const b=e.target instanceof Element?e.target.closest('#nb532-start'):null;if(!b)return;
  const input=document.querySelector('#nb532-source');
  const tags=parseRequestedTags(input?.value||'');
  active=tags.length?{tags,until:Date.now()+10*60*1000}:null;
},true);

window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const method=String(init?.method||input?.method||'GET').toUpperCase();
  if(method!=='GET'||!active||active.until<Date.now()||!/\/api\/v3\/searches(?:\?|$)/.test(url))return nativeFetch(input,init);
  let u;try{u=new URL(url,location.origin)}catch{return nativeFetch(input,init)}
  if(u.searchParams.get('context')!=='note')return nativeFetch(input,init);
  const wanted=norm(u.searchParams.get('q')||'');
  if(!wanted||!active.tags.includes(wanted))return nativeFetch(input,init);

  const r=await nativeFetch(input,init);if(!r.ok)return r;
  try{
    const j=await r.clone().json(),box=getNotesContainer(j);if(!box||!box.arr.length)return r;
    const original=box.arr;
    const ok=await mapLimit(original,4,n=>exactMatch(n,wanted));
    const filtered=original.filter((_,i)=>ok[i]);
    // その検索ページに完全一致が0件でも、後続ページを探索できるよう無効ダミーを1件だけ残す。
    // コア側は user/key が無いので巡回対象には採用しない。
    box.set(filtered.length?filtered:[{__noteBoostStrictNoop:true}]);
    return responseFrom(r,j);
  }catch{
    // 判定に失敗した検索結果をそのまま通すと誤採用になるため、失敗時も原文レスポンスへ戻さない。
    try{
      const j=await r.clone().json(),box=getNotesContainer(j);
      if(box){box.set([{__noteBoostStrictNoop:true}]);return responseFrom(r,j)}
    }catch{}
    return r;
  }
};
})();
