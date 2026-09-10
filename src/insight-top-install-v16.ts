export {};

const STYLE_ID="mumei-top-install-v16-style";
const TOOL_CLASS="mumei-top-tool-install";
const CANONICAL="mumei-canonical-install";
let timer=0;

function clean(v:any){return String(v||"").replace(/\s+/g," ").trim()}
function activeNoteId(){
  const links=[...document.querySelectorAll<HTMLAnchorElement>('.miu a[href*="note.com/"]')];
  const byText=links.find(a=>/@[A-Za-z0-9_-]+/.test(clean(a.textContent)));
  const m=byText?clean(byText.textContent).match(/@([A-Za-z0-9_-]+)/):null;
  if(m?.[1])return m[1].toLowerCase();
  for(const a of links){try{const id=new URL(a.href).pathname.split('/').filter(Boolean)[0];if(id)return id.toLowerCase()}catch{}}
  return"";
}
function roleFor(id:string){return id==="ss_yr"?"owner":"member"}
function hrefFor(kind:"dashboard"|"notice"){
  const id=activeNoteId(),role=roleFor(id),back=encodeURIComponent(window.location.href);
  if(kind==="notice")return`./notification-update.html?from=top&role=${role}&return=${back}`;
  const account=id?`&account=${encodeURIComponent(id)}`:"";
  return`./dashboard-setup.html?from=top&role=${role}${account}&return=${back}&auto=0`;
}
function installStyle(){
  let s=document.getElementById(STYLE_ID) as HTMLStyleElement|null;
  if(!s){s=document.createElement("style");s.id=STYLE_ID;document.head.appendChild(s)}
  s.textContent=`
.miv5-update{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}
.miv5-update .miv5-source-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-template-rows:auto!important;grid-auto-rows:auto!important;gap:4px!important;align-items:start!important;height:auto!important;min-height:0!important;max-height:none!important}
.miv5-update .miv5-source-card.normal,.miv5-update .miv5-source-card.dashboard,.miv5-update .miv5-source-card.notice{display:grid!important;grid-template-rows:minmax(0,1fr) auto!important;gap:4px!important;height:102px!important;min-height:102px!important;max-height:102px!important;overflow:visible!important}
.miv5-update .miv5-source-card.dashboard>.miv5-source-main,.miv5-update .miv5-source-card.notice>.miv5-source-main{height:76px!important;min-height:76px!important;max-height:76px!important}
.miv5-update .miv5-source-card.normal>.miv5-source-main{height:102px!important;min-height:102px!important;max-height:102px!important}
.miv5-update .miv5-source-card.normal.mumei-has-app-update>.miv5-source-main{height:76px!important;min-height:76px!important;max-height:76px!important}
.miv5-update .miv5-install-link.${CANONICAL},.miv5-update .miv5-source-card.normal>.miv5-install-link.update-ready{display:flex!important;position:static!important;width:100%!important;height:22px!important;min-height:22px!important;max-height:22px!important;margin:0!important;padding:0 5px!important;align-items:center!important;justify-content:center!important;border-radius:999px!important;text-decoration:none!important;font:900 6.8px/1 system-ui!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-source-card.dashboard>.miv5-install-link.${CANONICAL}{border:1px solid #45667c!important;background:#0a1a25!important;color:#d9f4ff!important}
.miv5-update .miv5-source-card.notice>.miv5-install-link.${CANONICAL}{border:1px solid #856f36!important;background:#221a08!important;color:#ffe6a0!important}
@media(max-width:620px){
 .miv5-update .miv5-source-grid{gap:3px!important}
 .miv5-update .miv5-source-card.normal,.miv5-update .miv5-source-card.dashboard,.miv5-update .miv5-source-card.notice{gap:3px!important;height:97px!important;min-height:97px!important;max-height:97px!important}
 .miv5-update .miv5-source-card.dashboard>.miv5-source-main,.miv5-update .miv5-source-card.notice>.miv5-source-main{height:72px!important;min-height:72px!important;max-height:72px!important}
 .miv5-update .miv5-source-card.normal>.miv5-source-main{height:97px!important;min-height:97px!important;max-height:97px!important}
 .miv5-update .miv5-source-card.normal.mumei-has-app-update>.miv5-source-main{height:72px!important;min-height:72px!important;max-height:72px!important}
 .miv5-update .miv5-install-link.${CANONICAL},.miv5-update .miv5-source-card.normal>.miv5-install-link.update-ready{height:22px!important;min-height:22px!important;max-height:22px!important;font-size:6.1px!important}
}
`;
}
function ensureOne(kind:"dashboard"|"notice"){
  const card=document.querySelector<HTMLElement>(`.miv5-source-card.${kind}`);if(!card)return;
  let keep=card.querySelector<HTMLAnchorElement>(`:scope > .${CANONICAL}`);
  if(!keep){
    const existing=card.querySelector<HTMLAnchorElement>(`:scope > a.${TOOL_CLASS},:scope > a.miv5-install-link`);
    keep=existing||document.createElement("a");
    if(!existing)card.appendChild(keep);
  }
  keep.classList.add("miv5-install-link",TOOL_CLASS,CANONICAL);
  keep.href=hrefFor(kind);
  keep.textContent="インストール / 更新";
  keep.title=kind==="dashboard"?"Dashboard同期＋本人通知の導入パネルを開く":"本人通知ツールをインストール / 更新";
  for(const el of [...card.querySelectorAll<HTMLElement>(":scope > a,:scope > button")]){
    if(el===keep||el.classList.contains("miv5-source-main"))continue;
    if(el.classList.contains("miv5-install-link")||el.classList.contains(TOOL_CLASS)||clean(el.textContent)==="インストール / 更新")el.remove();
  }
}
function normalizeCopy(){
  const small=document.querySelector<HTMLElement>(".miv5-source-card.dashboard .miv5-source-main small");
  if(small&&!/Dashboard同期 v/.test(clean(small.textContent)))small.textContent="Dashboard同期＋本人通知 必須";
  const span=document.querySelector<HTMLElement>(".miv5-source-card.dashboard .miv5-source-main span");
  if(span)span.textContent="公式Dashboard＋INSIGHT Pro";
}
function equalize(){
  const root=document.querySelector<HTMLElement>(".miv5-update");
  root?.style.setProperty("height","auto","important");root?.style.setProperty("min-height","0","important");root?.style.setProperty("max-height","none","important");
  const normal=document.querySelector<HTMLElement>(".miv5-source-card.normal");
  normal?.classList.toggle("mumei-has-app-update",Boolean(normal.querySelector(":scope > .miv5-install-link.update-ready")));
}
function run(){installStyle();ensureOne("dashboard");ensureOne("notice");normalizeCopy();equalize()}
function schedule(ms=60){window.clearTimeout(timer);timer=window.setTimeout(run,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule(80)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","aria-busy"]});
window.addEventListener("pageshow",()=>schedule(0));window.addEventListener("focus",()=>schedule(0));window.addEventListener("resize",()=>schedule(20));
