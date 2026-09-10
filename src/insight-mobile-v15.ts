export {};

const STYLE_ID="mumei-insight-mobile-v15-style";
const DETAIL_CLASS="mumei-detail-analysis-proxy";
const TOOL_CLASS="mumei-top-tool-install";
let timer=0;

function imp(el:HTMLElement|null,name:string,value:string){el?.style.setProperty(name,value,"important")}
function clean(v:any){return String(v||"").replace(/\s+/g," ").trim()}
function activeNoteId(){
  const links=[...document.querySelectorAll<HTMLAnchorElement>('.miu a[href*="note.com/"]')];
  const byText=links.find(a=>/@[A-Za-z0-9_-]+/.test(clean(a.textContent)));
  const textMatch=byText?clean(byText.textContent).match(/@([A-Za-z0-9_-]+)/):null;
  if(textMatch?.[1])return textMatch[1].toLowerCase();
  for(const a of links){try{const id=new URL(a.href).pathname.split('/').filter(Boolean)[0];if(id)return id.toLowerCase()}catch{}}
  return""
}
function roleFor(id:string){return id==="ss_yr"?"owner":"member"}
function installerHref(kind:"dashboard"|"notice"){
  const id=activeNoteId(),role=roleFor(id),back=encodeURIComponent(window.location.href);
  if(kind==="notice")return`./notification-update.html?from=top&role=${role}&return=${back}`;
  const account=id?`&account=${encodeURIComponent(id)}`:"";
  return`./dashboard-setup-v2.html?from=top&role=${role}${account}&return=${back}&auto=0`;
}

function installStyle(){
  let s=document.getElementById(STYLE_ID) as HTMLStyleElement|null;
  if(!s){s=document.createElement("style");s.id=STYLE_ID;document.head.appendChild(s)}
  s.textContent=`
.miv5-update{display:block!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;padding:4px!important;margin:3px auto 3px!important}
.miv5-update .miv5-source-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-template-rows:auto!important;grid-auto-rows:auto!important;gap:4px!important;align-items:start!important;align-content:start!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;overflow:visible!important}
.miv5-update .miv5-source-card.normal{display:grid!important;order:1!important}
.miv5-update .miv5-source-card.dashboard{display:grid!important;order:2!important}
.miv5-update .miv5-source-card.notice{display:grid!important;order:3!important}
.miv5-update .miv5-source-card.detail{display:none!important}
.miv5-update .miv5-source-card{box-sizing:border-box!important;grid-template-rows:auto auto!important;gap:4px!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;overflow:visible!important;align-self:start!important}
.miv5-update .miv5-source-main{box-sizing:border-box!important;width:100%!important;height:76px!important;min-height:76px!important;max-height:76px!important;border-radius:14px!important;padding:7px!important;align-content:center!important;overflow:hidden!important}
.miv5-update .miv5-source-card.normal:not(.mumei-has-app-update) .miv5-source-main{height:102px!important;min-height:102px!important;max-height:102px!important}
.miv5-update .miv5-source-main strong{font-size:9.2px!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-source-main small{font-size:6.6px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-source-main span{font-size:6px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-install-link,.miv5-update .${TOOL_CLASS}{box-sizing:border-box!important;position:static!important;display:flex!important;width:100%!important;height:22px!important;min-height:22px!important;max-height:22px!important;margin:0!important;padding:0 5px!important;align-items:center!important;justify-content:center!important;border-radius:999px!important;border:1px solid #45667c!important;background:#0a1a25!important;color:#d9f4ff!important;text-decoration:none!important;font:900 6.8px/1 system-ui!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-source-card.notice>.${TOOL_CLASS}{border-color:#856f36!important;background:#221a08!important;color:#ffe6a0!important}
.miv5-update .miv5-source-card.normal>.miv5-install-link.update-ready{border-color:#4f7b5d!important;background:#0b2115!important;color:#c8ffdc!important}
.miu-topactions .mumei-public-refresh-proxy{display:none!important}
.miu-topactions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;align-items:stretch!important}
.miu-topactions .${DETAIL_CLASS}{display:grid!important;place-items:center!important;align-content:center!important;gap:2px!important;min-width:0!important;min-height:50px!important;border:1px solid #6a4a91!important;background:#171126!important;color:#eadcff!important;border-radius:11px!important;padding:7px 8px!important;font-weight:950!important}
.miu-topactions .${DETAIL_CLASS} span{font-size:10px!important;line-height:1.15!important}.miu-topactions .${DETAIL_CLASS} small{font-size:7px!important;color:#bca9d1!important;line-height:1.2!important}
@media(max-width:620px){.miv5-update{width:calc(100% - 8px)!important;padding:3px!important}.miv5-update .miv5-source-grid{gap:3px!important}.miv5-update .miv5-source-main{height:72px!important;min-height:72px!important;max-height:72px!important;padding:6px!important}.miv5-update .miv5-source-card.normal:not(.mumei-has-app-update) .miv5-source-main{height:98px!important;min-height:98px!important;max-height:98px!important}.miv5-update .miv5-source-main strong{font-size:8.4px!important}.miv5-update .miv5-source-main small{font-size:6px!important}.miv5-update .miv5-source-main span{font-size:5.5px!important}.miv5-update .miv5-install-link,.miv5-update .${TOOL_CLASS}{height:22px!important;min-height:22px!important;max-height:22px!important;font-size:6.1px!important}.miu-topactions .${DETAIL_CLASS}{min-height:48px!important}}
`;
}

function forceTopLayout(){
  const root=document.querySelector<HTMLElement>(".miv5-update"),grid=root?.querySelector<HTMLElement>(":scope > .miv5-source-grid");
  if(!root||!grid)return;
  imp(root,"height","auto");imp(root,"min-height","0");imp(root,"max-height","none");imp(root,"overflow","visible");
  imp(grid,"display","grid");imp(grid,"grid-template-columns","repeat(3,minmax(0,1fr))");imp(grid,"grid-template-rows","auto");imp(grid,"grid-auto-rows","auto");imp(grid,"align-items","start");imp(grid,"align-content","start");imp(grid,"height","auto");imp(grid,"min-height","0");imp(grid,"max-height","none");
  const normal=grid.querySelector<HTMLElement>(".miv5-source-card.normal"),dash=grid.querySelector<HTMLElement>(".miv5-source-card.dashboard"),notice=grid.querySelector<HTMLElement>(".miv5-source-card.notice"),detail=grid.querySelector<HTMLElement>(".miv5-source-card.detail");
  [[normal,"1"],[dash,"2"],[notice,"3"]].forEach(([card,order])=>{const c=card as HTMLElement|null;if(!c)return;imp(c,"display","grid");imp(c,"order",String(order));imp(c,"height","auto");imp(c,"min-height","0");imp(c,"max-height","none");imp(c,"overflow","visible")});
  imp(detail,"display","none");
  const stale=document.querySelector<HTMLElement>(".miu-topactions .mumei-public-refresh-proxy");imp(stale,"display","none");
  if(normal)normal.classList.toggle("mumei-has-app-update",Boolean(normal.querySelector(":scope > .miv5-install-link.update-ready")));
}

function ensureInstaller(kind:"dashboard"|"notice"){
  const card=document.querySelector<HTMLElement>(`.miv5-source-card.${kind}`);if(!card)return;
  let link=card.querySelector<HTMLAnchorElement>(`:scope > .${TOOL_CLASS}`);
  if(!link){link=document.createElement("a");link.className=`miv5-install-link ${TOOL_CLASS}`;link.textContent="インストール / 更新";link.addEventListener("click",e=>e.stopPropagation());card.appendChild(link)}
  link.href=installerHref(kind);
  link.textContent="インストール / 更新";
}

function ensureDetailProxy(){
  const actions=document.querySelector<HTMLElement>(".miu-topactions"),source=document.querySelector<HTMLButtonElement>(".miv5-source-card.detail .miv5-source-main");if(!actions||!source)return;
  const stale=actions.querySelector<HTMLElement>(".mumei-public-refresh-proxy");imp(stale,"display","none");
  let proxy=actions.querySelector<HTMLButtonElement>(`.${DETAIL_CLASS}`);
  if(!proxy){proxy=document.createElement("button");proxy.type="button";proxy.className=DETAIL_CLASS;proxy.innerHTML="<span>🔎 詳細分析</span><small>インストール不要</small>";proxy.addEventListener("click",()=>source.click());actions.appendChild(proxy)}
}

function normalizeNormalUpdate(){
  const normal=document.querySelector<HTMLElement>(".miv5-source-card.normal"),button=normal?.querySelector<HTMLElement>(":scope > .miv5-install-link.update-ready");
  if(button){button.textContent="INSIGHT本体を更新";normal?.classList.add("mumei-has-app-update")}else normal?.classList.remove("mumei-has-app-update")
}

function run(){installStyle();forceTopLayout();ensureInstaller("dashboard");ensureInstaller("notice");ensureDetailProxy();normalizeNormalUpdate();forceTopLayout()}
function schedule(ms=70){window.clearTimeout(timer);timer=window.setTimeout(run,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule(90)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","aria-busy"]});
window.addEventListener("resize",()=>schedule(20));window.addEventListener("pageshow",()=>schedule(20));window.addEventListener("focus",()=>schedule(20));
