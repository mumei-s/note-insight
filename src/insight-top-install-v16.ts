export {};

const STYLE_ID="mumei-top-final-v17-style";
const TOOL_CLASS="mumei-top-tool-install";
const CANONICAL="mumei-canonical-install";
const DETAIL_CLASS="mumei-detail-analysis-proxy";
let timer=0;

function clean(v:any){return String(v||"").replace(/\s+/g," ").trim()}
function imp(el:HTMLElement|null|undefined,name:string,value:string){el?.style.setProperty(name,value,"important")}
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
/* FINAL TOP: this is the only active TOP layout manager. */
.miv5-update{box-sizing:border-box!important;display:block!important;width:calc(100% - 8px)!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;padding:3px!important;margin:3px auto 3px!important;aspect-ratio:auto!important}
.miv5-update::before,.miv5-update::after,.miv5-source-grid::before,.miv5-source-grid::after{content:none!important;display:none!important}
.miv5-update .miv5-source-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-template-rows:97px!important;grid-auto-rows:97px!important;gap:3px!important;align-items:stretch!important;align-content:start!important;height:97px!important;min-height:97px!important;max-height:97px!important;margin:0!important;padding:0!important;overflow:visible!important}
.miv5-update .miv5-source-card.normal{display:grid!important;order:1!important}
.miv5-update .miv5-source-card.dashboard{display:grid!important;order:2!important}
.miv5-update .miv5-source-card.notice{display:grid!important;order:3!important}
.miv5-update .miv5-source-card.detail{display:none!important}
.miv5-update .miv5-source-card.normal,.miv5-update .miv5-source-card.dashboard,.miv5-update .miv5-source-card.notice{box-sizing:border-box!important;grid-template-rows:minmax(0,1fr) auto!important;gap:3px!important;width:auto!important;height:97px!important;min-height:97px!important;max-height:97px!important;margin:0!important;padding:0!important;overflow:visible!important;align-self:stretch!important}
.miv5-update .miv5-source-main{box-sizing:border-box!important;width:100%!important;height:72px!important;min-height:72px!important;max-height:72px!important;border-radius:14px!important;padding:6px!important;align-content:center!important;overflow:hidden!important}
.miv5-update .miv5-source-card.normal:not(.mumei-has-app-update)>.miv5-source-main{height:97px!important;min-height:97px!important;max-height:97px!important}
.miv5-update .miv5-source-main strong{font-size:8.4px!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-source-main small{font-size:6px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-source-main span{font-size:5.5px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-install-link.${CANONICAL},.miv5-update .miv5-source-card.normal>.miv5-install-link.update-ready{box-sizing:border-box!important;display:flex!important;position:static!important;width:100%!important;height:22px!important;min-height:22px!important;max-height:22px!important;margin:0!important;padding:0 4px!important;align-items:center!important;justify-content:center!important;border-radius:999px!important;text-decoration:none!important;font:900 6.1px/1 system-ui!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-source-card.dashboard>.miv5-install-link.${CANONICAL}{border:1px solid #45667c!important;background:#0a1a25!important;color:#d9f4ff!important}
.miv5-update .miv5-source-card.notice>.miv5-install-link.${CANONICAL}{border:1px solid #856f36!important;background:#221a08!important;color:#ffe6a0!important}
.miv5-update .miv5-source-card.normal>.miv5-install-link.update-ready{border:1px solid #4f7b5d!important;background:#0b2115!important;color:#c8ffdc!important}
.miv5-update+.micmp{margin-top:3px!important}
.miu-topactions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;align-items:stretch!important}
.miu-topactions .${DETAIL_CLASS}{display:grid!important;place-items:center!important;align-content:center!important;gap:2px!important;min-width:0!important;min-height:48px!important;border:1px solid #6a4a91!important;background:#171126!important;color:#eadcff!important;border-radius:11px!important;padding:7px 8px!important;font-weight:950!important}
.miu-topactions .${DETAIL_CLASS} span{font-size:10px!important;line-height:1.15!important}.miu-topactions .${DETAIL_CLASS} small{font-size:7px!important;color:#bca9d1!important;line-height:1.2!important}
@media(min-width:621px){
 .miv5-update .miv5-source-grid{grid-template-rows:102px!important;grid-auto-rows:102px!important;height:102px!important;min-height:102px!important;max-height:102px!important;gap:4px!important}
 .miv5-update .miv5-source-card.normal,.miv5-update .miv5-source-card.dashboard,.miv5-update .miv5-source-card.notice{height:102px!important;min-height:102px!important;max-height:102px!important;gap:4px!important}
 .miv5-update .miv5-source-main{height:76px!important;min-height:76px!important;max-height:76px!important;padding:7px!important}
 .miv5-update .miv5-source-card.normal:not(.mumei-has-app-update)>.miv5-source-main{height:102px!important;min-height:102px!important;max-height:102px!important}
 .miv5-update .miv5-source-main strong{font-size:9.2px!important}.miv5-update .miv5-source-main small{font-size:6.6px!important}.miv5-update .miv5-source-main span{font-size:6px!important}
 .miv5-update .miv5-install-link.${CANONICAL},.miv5-update .miv5-source-card.normal>.miv5-install-link.update-ready{height:22px!important;min-height:22px!important;max-height:22px!important;font-size:6.8px!important}
}
`;
}

function ensureOne(kind:"dashboard"|"notice"){
  const card=document.querySelector<HTMLElement>(`.miv5-source-card.${kind}`);if(!card)return;
  const all=[...card.querySelectorAll<HTMLElement>(":scope > a,:scope > button")];
  let keep=all.find(el=>el.classList.contains(CANONICAL)) as HTMLAnchorElement|undefined;
  if(!keep){
    const reusable=all.find(el=>el instanceof HTMLAnchorElement&&(el.classList.contains(TOOL_CLASS)||el.classList.contains("miv5-install-link"))) as HTMLAnchorElement|undefined;
    keep=reusable||document.createElement("a");
    if(!reusable)card.appendChild(keep);
  }
  keep.className=`miv5-install-link ${TOOL_CLASS} ${CANONICAL}`;
  keep.href=hrefFor(kind);
  keep.textContent="インストール / 更新";
  keep.title=kind==="dashboard"?"Dashboard同期＋本人通知のブラウザ別導入パネルを開く":"本人通知ツールをインストール / 更新";
  keep.onclick=e=>e.stopPropagation();
  for(const el of [...card.querySelectorAll<HTMLElement>(":scope > a,:scope > button")]){
    if(el===keep||el.classList.contains("miv5-source-main"))continue;
    if(el.classList.contains("miv5-install-link")||el.classList.contains(TOOL_CLASS)||clean(el.textContent)==="インストール / 更新")el.remove();
  }
}

function ensureDetailProxy(){
  const actions=document.querySelector<HTMLElement>(".miu-topactions"),source=document.querySelector<HTMLButtonElement>(".miv5-source-card.detail .miv5-source-main");if(!actions||!source)return;
  actions.querySelectorAll(".mumei-public-refresh-proxy").forEach(el=>el.remove());
  let proxy=actions.querySelector<HTMLButtonElement>(`.${DETAIL_CLASS}`);
  if(!proxy){proxy=document.createElement("button");proxy.type="button";proxy.className=DETAIL_CLASS;proxy.innerHTML="<span>🔎 詳細分析</span><small>インストール不要</small>";proxy.addEventListener("click",()=>source.click());actions.appendChild(proxy)}
}

function normalizeCopy(){
  const dash=document.querySelector<HTMLElement>(".miv5-source-card.dashboard .miv5-source-main small");
  if(dash&&!/Dashboard同期 v/.test(clean(dash.textContent)))dash.textContent="Dashboard同期＋本人通知 必須";
  const span=document.querySelector<HTMLElement>(".miv5-source-card.dashboard .miv5-source-main span");if(span)span.textContent="公式Dashboard＋INSIGHT Pro";
}

function enforce(){
  const root=document.querySelector<HTMLElement>(".miv5-update"),grid=root?.querySelector<HTMLElement>(":scope > .miv5-source-grid");if(!root||!grid)return;
  const mobile=window.matchMedia("(max-width:620px)").matches,total=mobile?97:102,main=mobile?72:76,gap=mobile?3:4;
  imp(root,"height",`${total+6}px`);imp(root,"min-height",`${total+6}px`);imp(root,"max-height",`${total+6}px`);imp(root,"overflow","visible");
  imp(grid,"display","grid");imp(grid,"grid-template-columns","repeat(3,minmax(0,1fr))");imp(grid,"grid-template-rows",`${total}px`);imp(grid,"grid-auto-rows",`${total}px`);imp(grid,"height",`${total}px`);imp(grid,"min-height",`${total}px`);imp(grid,"max-height",`${total}px`);imp(grid,"gap",`${gap}px`);
  const normal=grid.querySelector<HTMLElement>(".miv5-source-card.normal"),dash=grid.querySelector<HTMLElement>(".miv5-source-card.dashboard"),notice=grid.querySelector<HTMLElement>(".miv5-source-card.notice"),detail=grid.querySelector<HTMLElement>(".miv5-source-card.detail");
  const cards:[[HTMLElement|null,number],[HTMLElement|null,number],[HTMLElement|null,number]]=[[normal,1],[dash,2],[notice,3]];
  for(const[c,order]of cards){if(!c)continue;imp(c,"display","grid");imp(c,"order",String(order));imp(c,"height",`${total}px`);imp(c,"min-height",`${total}px`);imp(c,"max-height",`${total}px`)}
  imp(detail,"display","none");
  const update=normal?.querySelector<HTMLElement>(":scope > .miv5-install-link.update-ready");normal?.classList.toggle("mumei-has-app-update",Boolean(update));
  const normalMain=normal?.querySelector<HTMLElement>(":scope > .miv5-source-main"),dashMain=dash?.querySelector<HTMLElement>(":scope > .miv5-source-main"),noticeMain=notice?.querySelector<HTMLElement>(":scope > .miv5-source-main");
  imp(normalMain,"height",update?`${main}px`:`${total}px`);imp(normalMain,"min-height",update?`${main}px`:`${total}px`);imp(normalMain,"max-height",update?`${main}px`:`${total}px`);
  for(const el of[dashMain,noticeMain]){imp(el,"height",`${main}px`);imp(el,"min-height",`${main}px`);imp(el,"max-height",`${main}px`)}
}

function run(){installStyle();ensureOne("dashboard");ensureOne("notice");ensureDetailProxy();normalizeCopy();enforce()}
function schedule(ms=20){window.clearTimeout(timer);timer=window.setTimeout(run,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule(20)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","aria-busy"]});
window.addEventListener("pageshow",()=>schedule(0));window.addEventListener("focus",()=>schedule(0));window.addEventListener("resize",()=>schedule(0));
