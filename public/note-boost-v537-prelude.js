(() => {
'use strict';
if(window.__NOTE_BOOST_V537_PRELUDE__)return;
window.__NOTE_BOOST_V537_PRELUDE__=true;

function isArticlePath(){
  return /^\/[^/]+\/n\/[^/?#]+\/?$/.test(location.pathname);
}
function syncRoute(){
  document.documentElement.classList.toggle('nb-boost-article-route',isArticlePath());
}
const style=document.createElement('style');
style.textContent=`
.nb-boost-article-route #nb532-open,
.nb-boost-article-route #nb532-panel,
.nb-boost-article-route #nb532-modal{display:none!important;visibility:hidden!important;pointer-events:none!important}
#nb532-prev,#nb532-next2{display:none!important}
`;
(document.head||document.documentElement).appendChild(style);
syncRoute();

for(const name of ['pushState','replaceState']){
  const orig=history[name];
  history[name]=function(...args){const r=orig.apply(this,args);queueMicrotask(syncRoute);return r};
}
addEventListener('popstate',syncRoute);
addEventListener('pageshow',syncRoute);

const native=window.setInterval.bind(window);
window.setInterval=function(fn,ms,...args){
  const src=typeof fn==='function'?Function.prototype.toString.call(fn):String(fn||'');
  // v5.3.2コアの旧周期処理だけ止める。note本体や他ツールのintervalは通す。
  if((Number(ms)===30000&&/batch\(\).*render\(\)/s.test(src))||(Number(ms)===1500&&/cleanupLegacy/.test(src)))return -1;
  return native(fn,ms,...args);
};
})();