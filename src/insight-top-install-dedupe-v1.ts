export {};

const STYLE_ID="mumei-top-install-dedupe-v1-style";
const TOOL_CLASS="mumei-top-tool-install";
let timer=0;

function clean(v:any){return String(v||"").replace(/\s+/g," ").trim()}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");
  s.id=STYLE_ID;
  s.textContent=`
.miv5-source-card.dashboard>[data-mumei-install-duplicate="1"],
.miv5-source-card.notice>[data-mumei-install-duplicate="1"]{display:none!important}
.miv5-source-card.dashboard>.miv5-install-link~.miv5-install-link,
.miv5-source-card.notice>.miv5-install-link~.miv5-install-link{display:none!important}
`;
  document.head.appendChild(s);
}

function isInstallAction(el:Element){
  if(el.classList.contains("miv5-source-main"))return false;
  if(el.classList.contains("miv5-install-link")||el.classList.contains(TOOL_CLASS))return true;
  if(!(el instanceof HTMLAnchorElement||el instanceof HTMLButtonElement))return false;
  return clean(el.textContent)==="インストール / 更新";
}

function dedupeCard(cls:"dashboard"|"notice"){
  const card=document.querySelector<HTMLElement>(`.miv5-source-card.${cls}`);
  if(!card)return;
  const candidates=[...card.querySelectorAll<HTMLElement>("a,button")].filter(isInstallAction);
  if(!candidates.length)return;
  const keep=candidates.find(el=>el.classList.contains(TOOL_CLASS))||candidates[0];
  keep.classList.add("miv5-install-link",TOOL_CLASS);
  keep.removeAttribute("data-mumei-install-duplicate");
  for(const el of candidates){
    if(el===keep)continue;
    el.dataset.mumeiInstallDuplicate="1";
    const parent=el.parentElement;
    if(parent&&parent!==card&&parent.children.length===1){parent.remove();continue}
    el.remove();
  }
}

function run(){
  installStyle();
  dedupeCard("dashboard");
  dedupeCard("notice");
}
function schedule(ms=40){window.clearTimeout(timer);timer=window.setTimeout(run,ms)}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule()).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener("pageshow",()=>schedule(0));
window.addEventListener("focus",()=>schedule(0));
