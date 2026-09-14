(() => {
'use strict';
const K='note巡回BOOST_v4';
const LIKE_KEY=`${K}:likeLimitV52`;
const MAG_KEY=`${K}:magLimitV52`;
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(k))??fb}catch{return fb}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const clamp=(v,fb)=>Math.max(1,Math.min(5000,Number(v)||fb));
const likeLimit=clamp(load(LIKE_KEY,80),80);
const magLimit=clamp(load(MAG_KEY,200),200);
const s=Object.assign({},load(`${K}:settings`,{}));
// v5.2は固定の1時間制限を使わず、24時間上限だけを使う。
s.likeHour=5000;
s.magHour=5000;
s.likeDay=likeLimit;
s.magDay=magLimit;
save(`${K}:settings`,s);
// 旧v5.1の自動ランナーは止め、v5.2の適応リミッターへ一本化する。
try{
  const accounts=load(`${K}:knownAccounts`,[]);
  for(const a of Array.isArray(accounts)?accounts:[]){
    const id=String(a?.id||'');
    if(id)save(`${K}:acct:${id}:autoMagAutoResumeV51`,false);
  }
  const last=String(load(`${K}:lastActiveAccount`,''));
  if(last)save(`${K}:acct:${last}:autoMagAutoResumeV51`,false);
}catch{}
})();
