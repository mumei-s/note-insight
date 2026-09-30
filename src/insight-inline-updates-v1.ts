export {};
// This layer only explains feature actions. The canonical top controls own update styling.
let timer=0;
function paint(){
  for(const kind of ["normal","notice","dashboard"]){
    const card=document.querySelector<HTMLElement>(`.miv5-source-card.${kind}`);
    const main=card?.querySelector<HTMLElement>(".miv5-source-main");if(!main)continue;
    const title=kind==="normal"?"公開データを再取得。INSIGHT本体の更新とは別です":kind==="dashboard"?"分析を開く。設定・更新は下の丸いボタンです":"本人通知を開く。設定・更新は下の丸いボタンです";
    if(main.title!==title)main.title=title;
  }
}
function schedule(ms=160){window.clearTimeout(timer);timer=window.setTimeout(paint,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule()).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","aria-busy"]});
window.addEventListener("pageshow",()=>schedule(20));window.addEventListener("focus",()=>schedule(20));
