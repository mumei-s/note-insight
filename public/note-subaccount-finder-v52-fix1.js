(() => {
'use strict';
const K='note巡回BOOST_v4';
const NEW='autoMagJobV52',OLD='autoMagJobV46';
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(k))??fb}catch{return fb}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const ak=(id,n)=>`${K}:acct:${id}:${n}`;
function migrate(){
  const ids=new Set();
  const last=String(load(`${K}:lastActiveAccount`,''));if(last)ids.add(last);
  for(const a of load(`${K}:knownAccounts`,[])||[])if(a?.id)ids.add(String(a.id));
  for(const id of ids){
    if(load(ak(id,NEW),null))continue;
    const old=load(ak(id,OLD),null);if(!old||old.complete)continue;
    const targets=Array.isArray(old.targets)&&old.targets.length?old.targets:(old.magKey?[{key:String(old.magKey),name:String(old.magName||old.magKey),price:Number(old.magPrice)||0}]:[]);
    if(!targets.length||!Array.isArray(old.items)||!old.items.length)continue;
    save(ak(id,NEW),{...old,version:'5.2.0',targets,itemIndex:Number.isFinite(Number(old.itemIndex))?Number(old.itemIndex):Number(old.index)||0,targetIndex:Number.isFinite(Number(old.targetIndex))?Number(old.targetIndex):0,last:`旧巡回BOOSTから引継ぎ：${String(old.last||'再開待ち')}`});
  }
}
function fixOpen(){
  const b=document.getElementById('nb52-open'),p=document.getElementById('nb52-panel');
  if(!(b instanceof HTMLButtonElement)||!(p instanceof HTMLElement)||b.dataset.v52OpenFix==='1')return false;
  b.dataset.v52OpenFix='1';
  b.onclick=e=>{e.preventDefault();const open=getComputedStyle(p).display==='none';p.style.display=open?'block':'none';b.textContent=open?'× 巡回BOOST':'💗 巡回BOOST';try{sessionStorage.setItem('nb-v52-open',open?'1':'0')}catch{}};
  return true;
}
migrate();
if(!fixOpen()){
  const mo=new MutationObserver(()=>{if(fixOpen())mo.disconnect()});
  mo.observe(document.documentElement,{subtree:true,childList:true});
  setTimeout(()=>mo.disconnect(),20000);
}
})();
