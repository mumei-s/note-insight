const STYLE_ID="mumei-data-source-boundaries-style";
let graphsOpen=false;
let runTimer=0;
let lastRun=0;

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
function run(){lastRun=Date.now();installStyle();enhanceAnalysis()}
function scheduleRun(delay=180){if(runTimer)window.clearTimeout(runTimer);const elapsed=Date.now()-lastRun;runTimer=window.setTimeout(()=>{runTimer=0;run()},Math.max(delay,elapsed<250?250-elapsed:0))}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>scheduleRun(0),{once:true});else scheduleRun(0);
const observer=new MutationObserver(()=>scheduleRun(220));observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener("hashchange",()=>scheduleRun(80));window.addEventListener("pageshow",()=>scheduleRun(80));
