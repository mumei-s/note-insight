(() => {
'use strict';
if(window.__NOTE_BOOST_V543_NETWORK_FIX__)return;
window.__NOTE_BOOST_V543_NETWORK_FIX__=true;

const K='note巡回BOOST_v531';
const nativeFetch=window.fetch.bind(window);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const isMagAdd=(url,method)=>method==='POST'&&/\/api\/v1\/our\/magazines\/m[0-9a-z]+\/notes(?:\?|$)/i.test(url);
const magKeyFromUrl=url=>{const m=String(url||'').match(/\/api\/v1\/our\/magazines\/(m[0-9a-z]+)\/notes/i);return m?.[1]||''};

async function verifyAdded(noteKey,magKey){
  if(!noteKey||!magKey)return null;
  for(let i=0;i<4;i++){
    if(i)await sleep(450*(i+1));
    try{
      const vr=await nativeFetch(`/api/v3/notes/${encodeURIComponent(noteKey)}?boost_verify=${Date.now()}`,{
        credentials:'include',
        headers:{accept:'application/json','cache-control':'no-cache'}
      });
      if(!vr.ok)continue;
      const j=await vr.json(),d=j?.data??j??{},n=d.note||d;
      const a=d.belonging_magazine_keys||n.belonging_magazine_keys||j?.belonging_magazine_keys||[];
      if(Array.isArray(a)&&a.map(String).includes(String(magKey)))return true;
    }catch{}
  }
  return false;
}

window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const method=String(init?.method||input?.method||'GET').toUpperCase();
  if(!isMagAdd(url,method))return nativeFetch(input,init);

  let noteKey='',noteId=null;
  try{
    const raw=typeof init?.body==='string'?JSON.parse(init.body):null;
    noteKey=String(raw?.note_key||raw?.noteKey||'');
    noteId=Number(raw?.note_id);
  }catch{}

  // v4.6で実際に動いていた payload を維持する。
  // { note_id, note_key } を削らず、そのまま note へ送る。
  const r=await nativeFetch(input,init);
  const magKey=magKeyFromUrl(url);
  let verified=null;
  if(r.ok&&noteKey&&magKey)verified=await verifyAdded(noteKey,magKey);

  try{
    localStorage.setItem(`${K}:lastMagazineWrite`,JSON.stringify({
      t:Date.now(),url,status:r.status,ok:r.ok,verified,magKey,noteKey,noteId
    }));
  }catch{}

  if(r.ok&&verified===false){
    const e=new Error('マガジン追加の実反映を確認できませんでした');
    e.status=598;
    e.boostMagazineVerifyFailed=true;
    throw e;
  }
  return r;
};
})();