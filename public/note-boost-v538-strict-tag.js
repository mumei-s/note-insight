(() => {
'use strict';
if (window.__NOTE_BOOST_V538_STRICT_TAG__) return;
window.__NOTE_BOOST_V538_STRICT_TAG__ = true;

let active = null;
const nativeFetch = window.fetch.bind(window);
const norm = s => String(s ?? '').normalize('NFKC').replace(/^#+/,'').trim().toLowerCase();

function parseRequestedTags(raw){
  const s=String(raw||'').trim();
  if(!s || /^https?:/i.test(s)) return [];
  return [...new Set(s.split(/[\s,、]+/).map(norm).filter(Boolean))];
}
function noteKey(n){return String(n?.key||n?.note_key||n?.noteKey||n?.slug||'').trim()}
function tagNamesFromValue(v,out,depth=0){
  if(v==null||depth>5)return;
  if(typeof v==='string'){const x=norm(v);if(x)out.add(x);return}
  if(Array.isArray(v)){for(const x of v)tagNamesFromValue(x,out,depth+1);return}
  if(typeof v!=='object')return;
  for(const k of ['name','tag','hashtag','hash_tag','value','keyword','text']){
    if(typeof v[k]==='string'){const x=norm(v[k]);if(x)out.add(x)}
  }
  for(const [k,x] of Object.entries(v)){
    if(/^(?:hashtags?|hash_tags?|tags?|tag_list|tagList)$/i.test(k))tagNamesFromValue(x,out,depth+1);
  }
}
function extractExactTags(j){
  const out=new Set(),d=j?.data??j??{},n=d.note||d;
  if(!n||typeof n!=='object')return out;
  for(const k of ['hashtags','hashtag','hash_tags','hashTags','tags','tag_list','tagList']){
    if(k in n)tagNamesFromValue(n[k],out,0);
  }
  const body=n.body||n.note||null;
  if(body&&typeof body==='object'){
    for(const k of ['hashtags','hash_tags','tags','tag_list','tagList'])if(k in body)tagNamesFromValue(body[k],out,0);
  }
  return out;
}
async function exactMatch(n,wanted){
  const key=noteKey(n);if(!key)return false;
  try{
    const r=await nativeFetch(`/api/v3/notes/${encodeURIComponent(key)}`,{credentials:'include',headers:{accept:'application/json'}});
    if(!r.ok)return false;
    const j=await r.json(),actual=extractExactTags(j);
    return actual.has(norm(wanted));
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
  active=tags.length?{tags,until:Date.now()+5*60*1000}:null;
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
    const ok=await mapLimit(box.arr,4,n=>exactMatch(n,wanted));
    box.set(box.arr.filter((_,i)=>ok[i]));
    return responseFrom(r,j);
  }catch{return r}
};
})();
