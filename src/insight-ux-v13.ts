export {};
const STYLE_ID="mumei-insight-ux-v13-style";
let timer=0;

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`
/* v13: top source strip must shrink to content height with no reserved blank area. */
section.miv5-update{display:block!important;box-sizing:border-box!important;min-height:0!important;min-block-size:0!important;height:auto!important;block-size:auto!important;max-height:none!important;max-block-size:none!important;aspect-ratio:auto!important;overflow:visible!important;padding:4px!important;margin:2px auto 2px!important}
section.miv5-update>.miv5-source-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-template-rows:max-content!important;grid-auto-rows:max-content!important;align-items:start!important;align-content:start!important;min-height:0!important;min-block-size:0!important;height:auto!important;block-size:auto!important;max-height:none!important;max-block-size:none!important;gap:4px!important;margin:0!important;padding:0!important}
section.miv5-update .miv5-source-card{display:grid!important;grid-template-rows:auto auto!important;align-content:start!important;align-self:start!important;min-height:0!important;height:auto!important;max-height:none!important;gap:3px!important;margin:0!important}
section.miv5-update .miv5-source-main{min-height:50px!important;height:auto!important;padding:7px 8px!important;border-radius:18px!important}
section.miv5-update .miv5-install-link{min-height:25px!important;margin:0 2px 1px!important;border-radius:999px!important;font-size:8px!important}
section.miv5-update+.micmp{margin-top:2px!important}
/* analysis entry is a real two-way split even on mobile */
.miah .miah-paths{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important}
.miah .miah-paths article{padding:5px!important;align-content:start!important}.miah .miah-paths button{min-height:62px!important;padding:6px!important}.miah .miah-paths button strong{font-size:10px!important}.miah .miah-paths button small{font-size:7.6px!important}.miah .miah-paths button span{font-size:7.3px!important}.miah .miah-paths a,.miah .miah-ready{font-size:7.7px!important;min-height:30px!important;padding:5px 6px!important}.miah-dashboard-with-read{border-color:#d3b456!important;background:#2a210d!important;color:#fff0b6!important}.miah-secondary-install{margin-top:0!important}
@media(min-width:900px){section.miv5-update>.miv5-source-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
@media(max-width:620px){section.miv5-update{width:calc(100% - 8px)!important;padding:3px!important}.miah .miah-paths{grid-template-columns:repeat(2,minmax(0,1fr))!important}.miah .miah-paths button{min-height:58px!important}.miah .miah-paths button strong{font-size:9.4px!important}.miah .miah-paths button span{font-size:6.9px!important}}
`;document.head.appendChild(s)
}

function setText(el:HTMLElement|null|undefined,text:string){if(el&&el.textContent!==text)el.textContent=text}
function setHtml(el:HTMLElement|null|undefined,html:string){if(el&&el.innerHTML!==html)el.innerHTML=html}
function activeAccount(){
  try{return String(localStorage.getItem("mumei-insight-active-account-v3")||sessionStorage.getItem("mumei-insight-notification-account")||"").replace(/^@/,"").toLowerCase()}catch{return""}
}
function role(){return activeAccount()==="ss_yr"?"owner":"member"}
function returnUrl(mode=""){const u=new URL(window.location.href);if(mode)u.searchParams.set("insightMode",mode);return encodeURIComponent(u.href)}
function notificationHref(){return`./notification-update.html?from=insight&role=${role()}&return=${returnUrl()}`}
function dashboardHref(scope:"base"|"with"="base",auto=false){return`./dashboard-setup.html?from=insight&role=${role()}&scope=${scope}${auto?"&auto=1":""}&return=${returnUrl(auto?"analysis":"")}`}

function ensureTopLink(card:HTMLElement,kind:"notice"|"dashboard"){
  let a=card.querySelector<HTMLAnchorElement>(`:scope > .miv5-install-link[data-v13="${kind}"]`);
  if(!a){a=document.createElement("a");a.className="miv5-install-link";a.dataset.v13=kind;card.appendChild(a)}
  const href=kind==="notice"?notificationHref():dashboardHref("base",false);if(a.getAttribute("href")!==href)a.href=href;
  setText(a,"インストール / 更新");
}
function enhanceTop(){
  const root=document.querySelector<HTMLElement>(".miv5-update");if(!root)return;
  const notice=root.querySelector<HTMLElement>(".miv5-source-card.notice"),dashboard=root.querySelector<HTMLElement>(".miv5-source-card.dashboard");
  if(notice)ensureTopLink(notice,"notice");
  if(dashboard){ensureTopLink(dashboard,"dashboard");setText(dashboard.querySelector<HTMLElement>(".miv5-source-main strong"),"📊 ダッシュボード");setText(dashboard.querySelector<HTMLElement>(".miv5-source-main span"),"公式Dashboard＋INSIGHT分析")}
}
function fitTopHeight(){
  const root=document.querySelector<HTMLElement>(".miv5-update"),grid=root?.querySelector<HTMLElement>(":scope > .miv5-source-grid");if(!root||!grid)return;
  root.querySelectorAll<HTMLElement>(".miv5-source-card").forEach(card=>{card.style.setProperty("min-height","0px","important");card.style.setProperty("height","auto","important");card.style.setProperty("max-height","none","important");card.style.setProperty("margin","0px","important")});
  root.style.setProperty("box-sizing","border-box","important");root.style.setProperty("min-height","0px","important");root.style.setProperty("height","auto","important");root.style.setProperty("max-height","none","important");root.style.setProperty("min-block-size","0px","important");root.style.setProperty("block-size","auto","important");root.style.setProperty("max-block-size","none","important");
  grid.style.setProperty("min-height","0px","important");grid.style.setProperty("height","auto","important");grid.style.setProperty("max-height","none","important");grid.style.setProperty("min-block-size","0px","important");grid.style.setProperty("block-size","auto","important");grid.style.setProperty("max-block-size","none","important");
}

function enhanceAnalysisHub(){
  const root=document.querySelector<HTMLElement>(".miah");if(!root)return;const cards=[...root.querySelectorAll<HTMLElement>(".miah-paths > article")];if(cards.length<2)return;
  const base=cards[0],withNotice=cards[1],baseButton=base.querySelector<HTMLButtonElement>("button"),noticeButton=withNotice.querySelector<HTMLButtonElement>("button");
  setText(baseButton?.querySelector<HTMLElement>("strong"),"📊 本人通知なし");setText(baseButton?.querySelector<HTMLElement>("small"),"公式Dashboard＋INSIGHT");
  setText(noticeButton?.querySelector<HTMLElement>("strong"),"🔔 本人通知あり");setText(noticeButton?.querySelector<HTMLElement>("small"),"通常分析＋通知の追加分析");
  const baseRead=base.querySelector<HTMLAnchorElement>(":scope > a");if(baseRead){const href=dashboardHref("base",true);if(baseRead.getAttribute("href")!==href)baseRead.href=href;setText(baseRead,"📥 本人通知なしで読込")}
  let withRead=withNotice.querySelector<HTMLAnchorElement>(":scope > .miah-dashboard-with-read");if(!withRead){withRead=document.createElement("a");withRead.className="miah-dashboard-with-read";const after=withNotice.querySelector(":scope > button");after?.insertAdjacentElement("afterend",withRead)}
  const withHref=dashboardHref("with",true);if(withRead.getAttribute("href")!==withHref)withRead.href=withHref;setText(withRead,"📥 本人通知ありで読込");
  const other=[...withNotice.querySelectorAll<HTMLElement>(":scope > a,:scope > span")].filter(x=>x!==withRead);other.forEach(x=>x.classList.add("miah-secondary-install"));
  setHtml(root.querySelector<HTMLElement>(".miah-rule"),"<b>整理：</b>Dashboard読込に本人通知は不要。INSIGHTとnoteの<strong>同一アカウント照合だけ自動実行</strong>します。本人通知は右側の追加分析だけに使います。");
}

function run(){installStyle();enhanceTop();fitTopHeight();enhanceAnalysisHub()}
function schedule(ms=100){window.clearTimeout(timer);timer=window.setTimeout(run,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule(140)).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener("pageshow",()=>schedule(40));
