export {};
const STYLE_ID="mumei-insight-ux-v13-style";
const V14_STYLE_ID="mumei-insight-mobile-v14-style";
let timer=0;

function markV14(root:HTMLElement|null){
  if(!root)return false;
  const active=Boolean(document.getElementById(V14_STYLE_ID));
  if(active)root.dataset.mumeiV14="1";else delete root.dataset.mumeiV14;
  return active
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`
/* v13 remains fallback only. v14/v15 own the current launcher and exact height. */
section.miv5-update:not([data-mumei-v14="1"]){display:block!important;box-sizing:border-box!important;min-height:0!important;min-block-size:0!important;height:auto!important;block-size:auto!important;max-height:none!important;max-block-size:none!important;aspect-ratio:auto!important;overflow:visible!important;padding:4px!important;margin:2px auto 2px!important}
section.miv5-update:not([data-mumei-v14="1"])>.miv5-source-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-template-rows:max-content!important;grid-auto-rows:max-content!important;align-items:start!important;align-content:start!important;min-height:0!important;min-block-size:0!important;height:auto!important;block-size:auto!important;max-height:none!important;max-block-size:none!important;gap:4px!important;margin:0!important;padding:0!important}
section.miv5-update:not([data-mumei-v14="1"]) .miv5-source-card{display:grid!important;grid-template-rows:auto auto!important;align-content:start!important;align-self:start!important;min-height:0!important;height:auto!important;max-height:none!important;gap:3px!important;margin:0!important}
section.miv5-update:not([data-mumei-v14="1"]) .miv5-source-main{min-height:50px!important;height:auto!important;padding:7px 8px!important;border-radius:18px!important}
section.miv5-update:not([data-mumei-v14="1"]) .miv5-install-link{min-height:25px!important;margin:0 2px 1px!important;border-radius:999px!important;font-size:8px!important}
section.miv5-update+.micmp{margin-top:2px!important}
.miah .miah-paths{grid-template-columns:1fr!important;gap:5px!important}
.miah .miah-paths article{padding:5px!important;align-content:start!important}.miah .miah-paths a,.miah .miah-ready{font-size:8px!important;min-height:30px!important;padding:5px 6px!important}
@media(min-width:900px){section.miv5-update:not([data-mumei-v14="1"])>.miv5-source-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
@media(max-width:620px){section.miv5-update:not([data-mumei-v14="1"]){width:calc(100% - 8px)!important;padding:3px!important}.miah .miah-paths{grid-template-columns:1fr!important}}
`;document.head.appendChild(s)
}

function setText(el:HTMLElement|null|undefined,text:string){if(el&&el.textContent!==text)el.textContent=text}
function activeAccount(){
  try{return String(localStorage.getItem("mumei-insight-active-account-v3")||sessionStorage.getItem("mumei-insight-notification-account")||"").replace(/^@/,"").toLowerCase()}catch{return""}
}
function role(){return activeAccount()==="ss_yr"?"owner":"member"}
function returnUrl(mode=""){const u=new URL(window.location.href);if(mode)u.searchParams.set("insightMode",mode);return encodeURIComponent(u.href)}
function notificationHref(){return`./notification-update.html?from=insight&role=${role()}&return=${returnUrl()}`}
function dashboardHref(auto=false){const account=activeAccount();return`./dashboard-setup.html?from=insight&role=${role()}${account?`&account=${encodeURIComponent(account)}`:""}${auto?"&auto=1":""}&return=${returnUrl(auto?"analysis":"")}`}

function ensureTopLink(card:HTMLElement,kind:"notice"|"dashboard"){
  let a=card.querySelector<HTMLAnchorElement>(`:scope > .miv5-install-link[data-v13="${kind}"]`);
  if(!a){a=document.createElement("a");a.className="miv5-install-link";a.dataset.v13=kind;card.appendChild(a)}
  const href=kind==="notice"?notificationHref():dashboardHref(false);if(a.getAttribute("href")!==href)a.href=href;
  setText(a,"インストール / 更新");
}
function enhanceTop(){
  const root=document.querySelector<HTMLElement>(".miv5-update");if(!root)return;markV14(root);
  const notice=root.querySelector<HTMLElement>(".miv5-source-card.notice"),dashboard=root.querySelector<HTMLElement>(".miv5-source-card.dashboard");
  if(notice)ensureTopLink(notice,"notice");
  if(dashboard){ensureTopLink(dashboard,"dashboard");setText(dashboard.querySelector<HTMLElement>(".miv5-source-main strong"),"📊 分析");setText(dashboard.querySelector<HTMLElement>(".miv5-source-main span"),"Dashboard同期＋本人通知")}
}
function fitTopHeight(){
  const root=document.querySelector<HTMLElement>(".miv5-update"),grid=root?.querySelector<HTMLElement>(":scope > .miv5-source-grid");if(!root||!grid||markV14(root))return;
  root.querySelectorAll<HTMLElement>(".miv5-source-card").forEach(card=>{card.style.setProperty("min-height","0px","important");card.style.setProperty("height","auto","important");card.style.setProperty("max-height","none","important");card.style.setProperty("margin","0px","important")});
  root.style.setProperty("box-sizing","border-box","important");root.style.setProperty("min-height","0px","important");root.style.setProperty("height","auto","important");root.style.setProperty("max-height","none","important");root.style.setProperty("min-block-size","0px","important");root.style.setProperty("block-size","auto","important");root.style.setProperty("max-block-size","none","important");
  grid.style.setProperty("min-height","0px","important");grid.style.setProperty("height","auto","important");grid.style.setProperty("max-height","none","important");grid.style.setProperty("min-block-size","0px","important");grid.style.setProperty("block-size","auto","important");grid.style.setProperty("max-block-size","none","important");
}

/* Dashboard分析はDashboard同期＋本人通知の2ツール必須。旧v13の「本人通知なし/あり」2分岐DOM上書きは廃止。 */
function enhanceAnalysisHub(){return}

function run(){installStyle();enhanceTop();fitTopHeight();enhanceAnalysisHub()}
function schedule(ms=100){window.clearTimeout(timer);timer=window.setTimeout(run,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule(140)).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener("pageshow",()=>schedule(40));
