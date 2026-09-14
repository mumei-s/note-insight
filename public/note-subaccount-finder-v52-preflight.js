(() => {
'use strict';
const K='note巡回BOOST_v4';
const LIMIT_KEY=`${K}:limitV52`;
const DEFAULT_LIMIT=200;
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(k))??fb}catch{return fb}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const limit=Math.max(1,Math.min(5000,Number(load(LIMIT_KEY,DEFAULT_LIMIT))||DEFAULT_LIMIT));
const s=Object.assign({},load(`${K}:settings`,{}));
// 旧1時間制限は実質無効化し、24時間上限だけを使う。
s.likeHour=5000;
s.magHour=5000;
s.likeDay=limit;
s.magDay=limit;
save(`${K}:settings`,s);
})();
