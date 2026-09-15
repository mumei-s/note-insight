(() => {
'use strict';
if(window.__NOTE_BOOST_V543_NETWORK_FIX__)return;
window.__NOTE_BOOST_V543_NETWORK_FIX__=true;

const K='note巡回BOOST_v531';
const nativeFetch=window.fetch.bind(window);
const isMagAdd=(url,method)=>method==='POST'&&/\/api\/v1\/our\/magazines\/m[0-9a-z]+\/notes(?:\?|$)/i.test(url);

window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const method=String(init?.method||input?.method||'GET').toUpperCase();
  let nextInit=init;
  if(isMagAdd(url,method)){
    try{
      const raw=typeof init?.body==='string'?JSON.parse(init.body):null;
      const noteId=Number(raw?.note_id);
      if(Number.isFinite(noteId)&&noteId>0){
        // 現行noteの専用追加APIは numeric note_id のみを送る。
        // 旧版で混ぜていた note_key は400系の原因になるため除去。
        nextInit=Object.assign({},init,{body:JSON.stringify({note_id:noteId})});
      }
    }catch{}
  }
  const r=await nativeFetch(input,nextInit);
  if(isMagAdd(url,method)){
    try{
      localStorage.setItem(`${K}:lastMagazineWrite`,JSON.stringify({
        t:Date.now(),url,status:r.status,ok:r.ok
      }));
    }catch{}
  }
  return r;
};
})();