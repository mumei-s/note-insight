import "./insight-ux-v11";
const STYLE_ID="mumei-data-source-boundaries-style";
const ENTRY_AT_KEY="mumei-insight-entry-at";
const ENTRY_MODE_KEY="mumei-insight-entry-mode";
const RECLASSIFY="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-reclassify";
const RECLASSIFY_DAY_KEY="mumei-insight-notification-reclassify-day-v1:";
let graphsOpen=false;
let runTimer=0;
let lastRun=0;
let initialEntryHandled=false;
let navigationBound=false;
let reclassifyBusy=false;
const explicitNotificationEntry=(()=>{try{const q=new URLSearchParams(window.location.search).get("insightMode");const at=Number(sessionStorage.getItem(ENTRY_AT_KEY)||0),fresh=at>0&&Date.now()-at<20_000;return q==="notifications"||fresh}catch{return false}})();
const KAOMOJI:Record<string,string>={like:"(♡˙︶˙♡)",comment_like:"(๑♡ᴗ♡๑)",comment:"(｡･ω･)ﾉﾞ",reply_self:"( •̀ᴗ•́ )و",reply_other:"( •̀ᴗ•́ )و",reply:"( •̀ᴗ•́ )و",follow:"(ง •̀_•́)ง",creator_article_posted:"(๑•̀ㅂ•́)و✧",magazine_follow:"( ´ ▽ ` )ﾉ",my_article_magazine_added:"(ﾉ◕ヮ◕)ﾉ",magazine_article_added:"(ﾉ◕ヮ◕)ﾉ",magazine_join:"(*´▽`*)",membership_board:"( ˶'ᵕ'˶ )",membership_board_reply:"( ˶'ᵕ'˶ )",membership_reaction_self:"(♡´▽`♡)",membership_reaction_joined:"(♡´▽`♡)",membership_reaction:"(♡´▽`♡)",membership_started:"٩(ˊᗜˋ*)و",membership_plan:"٩(ˊᗜˋ*)و",membership_join:"(*´꒳`*)",purchase:"(*ﾟ▽ﾟ*)",tip:"(人´∀`*)",buzz:"(๑•̀ㅁ•́๑)✧",rating:"٩(ˊᗜˋ*)و",points:"( •̀ᴗ•́ )و",quote:"(｡•̀ᴗ-)✧",other:"(・・?)"};

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`
.mia2 .mia2-tabs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;overflow:visible!important}
.mia2 .mia2-tabs button{width:100%!important;min-width:0!important;padding:0 7px!important;font-size:10px!important}
#mumei-analysis-graph-toggle{width:100%;min-height:36px;margin:2px 0 8px;border:1px solid #35576d;border-radius:10px;background:#0a1d29;color:#cdefff;font:900 9px/1 system-ui}
#mumei-analysis-graph-toggle[hidden]{display:none!important}
.mia2.mumei-overview-graphs-collapsed>.mia2-panel.mia2-wave,.mia2.mumei-overview-graphs-collapsed>.mia2-grid{display:none!important}
.mumei-notification-day-heading{display:flex;align-items:center;gap:6px;margin:8px 0 3px;padding:4px 8px;border:1px solid #2c465a;border-radius:999px;background:#0b1a25;color:#bfefff;font:950 9px/1 system-ui;letter-spacing:.02em}
.mumei-notification-day-heading:first-child{margin-top:3px}
.mumei-kaomoji{display:inline-flex!important;align-items:center;justify-content:center;max-width:92px;padding:2px 6px!important;border:1px solid #425d72!important;border-radius:999px!important;background:#10202e!important;color:#dff7ff!important;font:900 8px/1.1 system-ui!important;white-space:nowrap!important}
@media(max-width:560px){.mia2 .mia2-tabs button{font-size:9px!important;min-height:36px!important}.mumei-kaomoji{font-size:7.5px!important;padding:2px 5px!important}.mumei-notification-day-heading{font-size:8.5px}}
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
function jstDayNow(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function accountKey(){try{return String(localStorage.getItem("mumei-insight-active-account-v3")||sessionStorage.getItem("mumei-insight-notification-account")||"current").replace(/^@/,"").toLowerCase()}catch{return"current"}}
async function ensureDailyReclassify(){
  if(reclassifyBusy||!document.getElementById("minf-notifications"))return;
  const token=localStorage.getItem("mumei-insight-access-token")||"";if(!token)return;
  const day=jstDayNow(),key=RECLASSIFY_DAY_KEY+accountKey();
  try{if(localStorage.getItem(key)===day)return}catch{}
  reclassifyBusy=true;
  try{const r=await fetch(RECLASSIFY,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify({day}),cache:"no-store"});const p=await r.json().catch(()=>({}));if(r.ok&&p?.ok!==false){try{localStorage.setItem(key,day)}catch{}}}catch{}finally{reclassifyBusy=false}
}
function dayFromTimeText(v:string){const t=v.trim();const m=t.match(/(\d{4})[\/.年-](\d{1,2})[\/.月-](\d{1,2})/);if(!m)return t.split(/\s+/)[0]||"日時不明";return`${Number(m[2])}/${Number(m[3])}`}
function enhanceNotificationRows(){
  const root=document.getElementById("minf-notifications");if(!root)return;void ensureDailyReclassify();
  const list=root.querySelector<HTMLElement>(".minf-list");if(!list)return;
  const articles=[...list.querySelectorAll<HTMLElement>(":scope > article")];if(!articles.length)return;
  for(const article of articles){
    const type=[...article.classList].find(x=>x.startsWith("type-"))?.slice(5)||"other",meta=article.querySelector<HTMLElement>(".minf-meta");if(!meta)continue;
    let face=meta.querySelector<HTMLElement>(":scope > .mumei-kaomoji");if(!face){face=document.createElement("span");face.className="mumei-kaomoji";meta.prepend(face)}
    const next=KAOMOJI[type]||KAOMOJI.other;if(face.textContent!==next)face.textContent=next
  }
  const days=articles.map(a=>dayFromTimeText(a.querySelector("time")?.textContent||"日時不明")),signature=days.join("|");if(list.dataset.mumeiDaySignature===signature)return;
  list.querySelectorAll(":scope > .mumei-notification-day-heading").forEach(x=>x.remove());let previous="";
  articles.forEach((article,i)=>{const day=days[i];if(day===previous)return;previous=day;const h=document.createElement("div");h.className="mumei-notification-day-heading";h.textContent=`📅 ${day}`;article.before(h)});list.dataset.mumeiDaySignature=signature
}
function run(){lastRun=Date.now();installStyle();bindNavigation();normalizeInitialEntry();enhanceAnalysis();enhanceNotificationRows()}
function scheduleRun(delay=180){if(runTimer)window.clearTimeout(runTimer);const elapsed=Date.now()-lastRun;runTimer=window.setTimeout(()=>{runTimer=0;run()},Math.max(delay,elapsed<250?250-elapsed:0))}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>scheduleRun(0),{once:true});else scheduleRun(0);
const observer=new MutationObserver(()=>scheduleRun(220));observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener("hashchange",()=>scheduleRun(80));window.addEventListener("pageshow",()=>scheduleRun(80));
