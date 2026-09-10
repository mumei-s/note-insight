export {};
const STYLE_ID="mumei-inline-updates-v1-style";
let timer=0;
function installStyle(){if(document.getElementById(STYLE_ID))return;const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`
.miv5-source-card.needs-update .miv5-source-main{cursor:pointer!important}.miv5-source-card.needs-update>.miv5-install-link{box-shadow:0 0 0 1px rgba(182,255,56,.2)!important}
`;document.head.appendChild(s)}
function paint(){installStyle();for(const cls of ["normal","notice","dashboard"]){const card=document.querySelector<HTMLElement>(`.miv5-source-card.${cls}`);if(!card)continue;const main=card.querySelector<HTMLElement>(".miv5-source-main"),action=card.querySelector<HTMLElement>(":scope > .miv5-install-link");if(card.classList.contains("needs-update")){if(main)main.title=cls==="normal"?"公開データを更新。INSIGHT本体更新は下の別ボタンです":"機能を開く。ツールのインストール/更新は下の別ボタンです";if(action)action.title=cls==="normal"?"INSIGHT本体のレイアウト・仕様を最新版へ更新":"このツールをインストール/更新"}else if(main){main.removeAttribute("title")}}}
function schedule(ms=160){clearTimeout(timer);timer=window.setTimeout(paint,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);new MutationObserver(()=>schedule()).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","aria-busy"]});window.addEventListener("pageshow",()=>schedule(20));window.addEventListener("focus",()=>schedule(20));
