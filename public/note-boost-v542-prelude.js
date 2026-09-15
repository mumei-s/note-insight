(() => {
'use strict';
if(window.__NOTE_BOOST_V542_PRELUDE__)return;
window.__NOTE_BOOST_V542_PRELUDE__=true;

// v5.4.2: 巡回先の個別記事でも💗タブ/パネルを消さない。
// 旧v5.3.7は記事URLで #nb532-open / #nb532-panel / #nb532-modal を
// CSS強制非表示にしていたため、巡回中に操作不能になっていた。
const style=document.createElement('style');
style.id='nb542-prelude-style';
style.textContent=`#nb532-prev,#nb532-next2{display:none!important}`;
(document.head||document.documentElement).appendChild(style);

// 旧コア固有の周期処理だけ止める。note本体や他ツールのintervalは通す。
const native=window.setInterval.bind(window);
window.setInterval=function(fn,ms,...args){
  const src=typeof fn==='function'?Function.prototype.toString.call(fn):String(fn||'');
  if((Number(ms)===30000&&/batch\(\).*render\(\)/s.test(src))||(Number(ms)===1500&&/cleanupLegacy/.test(src)))return -1;
  return native(fn,ms,...args);
};
})();
