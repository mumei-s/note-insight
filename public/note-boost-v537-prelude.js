(() => {
'use strict';
if(window.__NOTE_BOOST_V537_PRELUDE__)return;
window.__NOTE_BOOST_V537_PRELUDE__=true;
const native=window.setInterval.bind(window);
window.setInterval=function(fn,ms,...args){
  const src=typeof fn==='function'?Function.prototype.toString.call(fn):String(fn||'');
  // v5.3.2コアの旧周期処理だけ止める。note本体や他ツールのintervalは通す。
  if((Number(ms)===30000&&/batch\(\).*render\(\)/s.test(src))||(Number(ms)===1500&&/cleanupLegacy/.test(src)))return -1;
  return native(fn,ms,...args);
};
})();