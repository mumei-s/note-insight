const STYLE_ID="mumei-data-source-boundaries-style";
const ENTRY_AT_KEY="mumei-insight-entry-at";
const ENTRY_MODE_KEY="mumei-insight-entry-mode";
let graphsOpen=false;
let runTimer=0;
let lastRun=0;
let initialEntryHandled=false;
let navigationBound=false;
const explicitNotificationEntry=(()=>{try{const q=new URLSearchParams(window.location.search).get("insightMode");const at=Number(sessionStorage.getItem(ENTRY_AT_KEY)||0),fresh=at>0&&Date.now()-at<20_000;return q==="notifications"||fresh}catch{return false}})();

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`
.mia2 .mia2-tabs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;overflow:visible!important}
.mia2 .mia2-tabs button{width:100%!important;min-width:0!important;padding:0 7px!important;font-size:10px!important}
#mumei-analysis-graph-toggle{width:100%;min-height:36px;margin:2px 0 8px;border:1px solid #35576d;border-radius:10px;background:#0a1d29;color:#cdefff;font:900 9px/1 system-ui}
#mumei-analysis-graph-toggle[hidden]{display:none!important}
.mia2.mumei-overview-graphs-collapsed>.mia2-panel.mia2-wave,.mia2.mumei-overview-graphs-collapsed>.mia2-grid{display:none!important}
@media(max-width:560px){.mia2 .mia2-tabs button{font-size:9px!important;min-height:36px!important}}
`;document.head.append(s)
}
function enhanceAnalysis(){
  const root=document.querySelector<HTMLElement>(".mia2");if(!root)return;const tabs=root.querySelector<HTMLElement>(".mia2-tabs");if(!tabs)return;
  let toggle=document.getElementById("mumei-analysis-graph-toggle") as HTMLButtonElement|null;
  if(!toggle){toggle=document.createElement("button");toggle.id="mumei-analysis-graph-toggle";tabs.insertAdjacentElement("afterend",toggle);toggle.addEventListener("click",()=>{graphsOpen=!graphsOpen;paintAnalysis(root,toggle!)})}
  paintAnalysis(root,toggle)
}
function paintAnalysis(root:HTMLElement,toggle:HTMLButtonElement){
  const active=[...root.querySelectorAll<HTMLButtonElement>(".mia2-tabs button")].find(b=>b.classList.contains("active"));const overview=active?.textContent?.trim()==="総合";
  toggle.hidden=!overview;if(!overview){root.classList.remove("mumei-overview-graphs-collapsed");return}
  root.classList.toggle("mumei-overview-graphs-collapsed",!graphsOpen);
  const label=graphsOpen?"▲ 詳細分析グラフを閉じる":"▼ 詳細分析グラフを開く（流入・波形・星図）";if(toggle.textContent!==label)toggle.textContent=label
}
function blurActive(){const a=document.activeElement;if(a instanceof HTMLElement&&a!==document.body)a.blur()}
function openNormalTop(){window.dispatchEvent(new CustomEvent("mumei-insight-open-mode",{detail:"normal"}));requestAnimationFrame(()=>{window.scrollTo({top:0,behavior:"auto"});blurActive()})}
function normalizeInitialEntry(){
  if(initialEntryHandled||!document.querySelector(".miv5"))return;
  initialEntryHandled=true;
  if(explicitNotificationEntry)return;
  try{sessionStorage.removeItem(ENTRY_MODE_KEY);sessionStorage.removeItem(ENTRY_AT_KEY)}catch{}
  window.history.replaceState({...window.history.state,route:"dashboard",insightMode:"normal",insightScrollY:0},"",window.location.href);
  window.setTimeout(openNormalTop,0)
}
function bindNavigation(){
  if(navigationBound)return;navigationBound=true;
  document.addEventListener("click",event=>{const target=event.target instanceof Element?event.target:null,button=target?.closest(".app-bottom-nav button");if(!button)return;const label=(button.textContent||"").replace(/\s+/g," ").trim();if(!/^INSIGHT(?:\s|$)/.test(label))return;try{sessionStorage.removeItem(ENTRY_MODE_KEY);sessionStorage.removeItem(ENTRY_AT_KEY)}catch{}window.setTimeout(openNormalTop,0)},{passive:true})
}
function run(){lastRun=Date.now();installStyle();bindNavigation();normalizeInitialEntry();enhanceAnalysis()}
function scheduleRun(delay=180){if(runTimer)window.clearTimeout(runTimer);const elapsed=Date.now()-lastRun;runTimer=window.setTimeout(()=>{runTimer=0;run()},Math.max(delay,elapsed<250?250-elapsed:0))}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>scheduleRun(0),{once:true});else scheduleRun(0);
const observer=new MutationObserver(()=>scheduleRun(220));observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener("hashchange",()=>scheduleRun(80));window.addEventListener("pageshow",()=>scheduleRun(80));
