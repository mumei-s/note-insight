export {};

const STYLE_ID="mumei-top-final-v17-style";
const TOOL_CLASS="mumei-top-tool-install";
const CANONICAL="mumei-canonical-install";
const DETAIL_CLASS="mumei-detail-analysis-proxy";
const NOTICE_CONTROLS="mumei-notice-controls";
const NOTICE_TOGGLE="mumei-notice-feature-toggle";
const FEATURE_PAGE="mumei-notification-feature-ui-v1";
const FEATURE_BRIDGE="mumei-notification-feature-bridge-v1";
let timer=0,featureRequested=false,featureBridgeSeen=false;
let featureEnabled:boolean|null=null;

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
function hrefFor(kind:"dashboard"|"notice"){
  const id=activeNoteId(),back=encodeURIComponent(window.location.href),account=id?`&account=${encodeURIComponent(id)}`:"";
  return`./tool-setup.html?from=top&focus=${kind}${account}&return=${back}`;
}

function requestFeatureState(force=false){
  if(featureRequested&&!force)return;
  featureRequested=true;
  window.postMessage({source:FEATURE_PAGE,type:"get"},window.location.origin);
}
function setFeatureState(enabled:boolean){
  if(!featureBridgeSeen)return;
  featureEnabled=Boolean(enabled);
  window.postMessage({source:FEATURE_PAGE,type:"set",enabled:featureEnabled},window.location.origin);
  schedule(0);
}
window.addEventListener("message",e=>{
  if(e.origin!==window.location.origin||e.data?.source!==FEATURE_BRIDGE||e.data?.type!=="state")return;
  featureBridgeSeen=true;
  featureEnabled=Boolean(e.data.enabled);
  schedule(0);
});

function installStyle(){
  let s=document.getElementById(STYLE_ID) as HTMLStyleElement|null;
  if(!s){s=document.createElement("style");s.id=STYLE_ID;document.head.appendChild(s)}
  s.textContent=`
.miv5-update{box-sizing:border-box!important;display:block!important;width:calc(100% - 8px)!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;padding:3px!important;margin:3px auto 3px!important;aspect-ratio:auto!important}
.miv5-update::before,.miv5-update::after,.miv5-source-grid::before,.miv5-source-grid::after{content:none!important;display:none!important}
.miv5-update .miv5-source-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-template-rows:97px!important;grid-auto-rows:97px!important;gap:3px!important;align-items:stretch!important;align-content:start!important;height:97px!important;min-height:97px!important;max-height:97px!important;margin:0!important;padding:0!important;overflow:visible!important}
.miv5-update .miv5-source-card.normal{display:grid!important;order:1!important}.miv5-update .miv5-source-card.dashboard{display:grid!important;order:2!important}.miv5-update .miv5-source-card.notice{display:grid!important;order:3!important}.miv5-update .miv5-source-card.detail{display:none!important}
.miv5-update .miv5-source-card.normal,.miv5-update .miv5-source-card.dashboard,.miv5-update .miv5-source-card.notice{box-sizing:border-box!important;grid-template-rows:minmax(0,1fr) auto!important;gap:3px!important;width:auto!important;height:97px!important;min-height:97px!important;max-height:97px!important;margin:0!important;padding:0!important;overflow:visible!important;align-self:stretch!important}
.miv5-update .miv5-source-main{box-sizing:border-box!important;width:100%!important;height:72px!important;min-height:72px!important;max-height:72px!important;border-radius:14px!important;padding:6px!important;align-content:center!important;overflow:hidden!important}
.miv5-update .miv5-source-card.normal:not(.mumei-has-app-update)>.miv5-source-main{height:97px!important;min-height:97px!important;max-height:97px!important}
.miv5-update .miv5-source-main strong{font-size:8.4px!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.miv5-update .miv5-source-main small{font-size:6px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.miv5-update .miv5-source-main span{font-size:5.5px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-install-link.${CANONICAL},.miv5-update .miv5-source-card.normal>.miv5-install-link.update-ready{box-sizing:border-box!important;display:flex!important;position:static!important;width:100%!important;height:22px!important;min-height:22px!important;max-height:22px!important;margin:0!important;padding:0 4px!important;align-items:center!important;justify-content:center!important;border-radius:999px!important;text-decoration:none!important;font:900 6.1px/1 system-ui!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-source-card.dashboard>.miv5-install-link.${CANONICAL},.miv5-update .miv5-source-card.notice>.miv5-install-link.${CANONICAL},.miv5-update .miv5-source-card.notice .${NOTICE_CONTROLS}>.miv5-install-link.${CANONICAL}{border:1px solid #5e7b8d!important;background:#0d1e29!important;color:#e1f7ff!important}.miv5-update .miv5-source-card.normal>.miv5-install-link.update-ready{border:1px solid #4f7b5d!important;background:#0b2115!important;color:#c8ffdc!important}
.miv5-update .miv5-source-card.notice>.${NOTICE_CONTROLS}{display:grid!important;grid-template-columns:minmax(34px,.62fr) minmax(0,1fr)!important;gap:3px!important;width:100%!important;height:22px!important;min-height:22px!important;max-height:22px!important}
.miv5-update .miv5-source-card.notice .${NOTICE_CONTROLS}>.${NOTICE_TOGGLE}{box-sizing:border-box!important;width:100%!important;height:22px!important;min-height:22px!important;max-height:22px!important;margin:0!important;padding:0 3px!important;border-radius:999px!important;font:950 6.2px/1 system-ui!important;white-space:nowrap!important}
.miv5-update .miv5-source-card.notice .${NOTICE_CONTROLS}>.${NOTICE_TOGGLE}.on{border:1px solid #4f9c72!important;background:#0b2117!important;color:#caffdc!important}
.miv5-update .miv5-source-card.notice .${NOTICE_CONTROLS}>.${NOTICE_TOGGLE}.off{border:1px solid #8a5962!important;background:#2b151a!important;color:#ffd5db!important}
.miv5-update .miv5-source-card.notice .${NOTICE_CONTROLS}>.${NOTICE_TOGGLE}.wait{border:1px solid #516777!important;background:#101c24!important;color:#9fb4c1!important}
.miv5-update .miv5-source-card.needs-update .${CANONICAL}{border-color:#9a7b31!important;background:#2a2108!important;color:#ffe49a!important;box-shadow:0 0 0 1px rgba(255,214,103,.18) inset!important}
.miv5-update .miv5-source-card.needs-install .${CANONICAL}{border-color:#4f8b68!important;background:#10261b!important;color:#caffdc!important}
.miv5-update+.micmp{margin-top:3px!important}.miu-topactions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;align-items:stretch!important}.miu-topactions .${DETAIL_CLASS}{display:grid!important;place-items:center!important;align-content:center!important;gap:2px!important;min-width:0!important;min-height:48px!important;border:1px solid #6a4a91!important;background:#171126!important;color:#eadcff!important;border-radius:11px!important;padding:7px 8px!important;font-weight:950!important}.miu-topactions .${DETAIL_CLASS} span{font-size:10px!important;line-height:1.15!important}.miu-topactions .${DETAIL_CLASS} small{font-size:7px!important;color:#bca9d1!important;line-height:1.2!important}
@media(min-width:621px){.miv5-update .miv5-source-grid{grid-template-rows:102px!important;grid-auto-rows:102px!important;height:102px!important;min-height:102px!important;max-height:102px!important;gap:4px!important}.miv5-update .miv5-source-card.normal,.miv5-update .miv5-source-card.dashboard,.miv5-update .miv5-source-card.notice{height:102px!important;min-height:102px!important;max-height:102px!important;gap:4px!important}.miv5-update .miv5-source-main{height:76px!important;min-height:76px!important;max-height:76px!important;padding:7px!important}.miv5-update .miv5-source-card.normal:not(.mumei-has-app-update)>.miv5-source-main{height:102px!important;min-height:102px!important;max-height:102px!important}.miv5-update .miv5-source-main strong{font-size:9.2px!important}.miv5-update .miv5-source-main small{font-size:6.6px!important}.miv5-update .miv5-source-main span{font-size:6px!important}.miv5-update .miv5-install-link.${CANONICAL},.miv5-update .miv5-source-card.normal>.miv5-install-link.update-ready{height:22px!important;min-height:22px!important;max-height:22px!important;font-size:6.8px!important}}
`;
}

function ensureNoticeControls(){
  const card=document.querySelector<HTMLElement>(".miv5-source-card.notice");if(!card)return;
  let controls=card.querySelector<HTMLElement>(`:scope > .${NOTICE_CONTROLS}`);
  if(!controls){controls=document.createElement("div");controls.className=NOTICE_CONTROLS;card.appendChild(controls)}
  let toggle=controls.querySelector<HTMLButtonElement>(`.${NOTICE_TOGGLE}`);
  if(!toggle){
    toggle=document.createElement("button");toggle.type="button";toggle.className=NOTICE_TOGGLE;controls.prepend(toggle);
    toggle.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();if(featureBridgeSeen)setFeatureState(featureEnabled===false)})
  }
  toggle.disabled=!featureBridgeSeen;
  toggle.textContent=featureBridgeSeen?(featureEnabled===false?"OFF":"ON"):"確認中";
  toggle.className=`${NOTICE_TOGGLE} ${featureBridgeSeen?(featureEnabled===false?"off":"on"):"wait"}`;
  toggle.title=featureBridgeSeen?(featureEnabled===false?"本人通知機能をONにする":"本人通知機能をOFFにする"):"本人通知ツールの状態を確認中";

  let link=controls.querySelector<HTMLAnchorElement>(`a.${CANONICAL}`);
  if(!link){link=document.createElement("a");controls.appendChild(link)}
  link.className=`miv5-install-link ${TOOL_CLASS} ${CANONICAL}`;link.href=hrefFor("notice");link.textContent=card.classList.contains("needs-update")?"⬆ 更新あり":card.classList.contains("needs-install")?"＋ インストール":"設定 / 更新";link.title=card.classList.contains("needs-update")?"本人通知の更新があります":card.classList.contains("needs-install")?"本人通知をこの端末へインストール":"本人通知の設定・更新";link.onclick=e=>e.stopPropagation();

  for(const el of [...card.querySelectorAll<HTMLElement>(":scope > a,:scope > button")]){if(el.classList.contains("miv5-source-main"))continue;el.remove()}
  card.classList.toggle("mumei-notification-feature-off",featureEnabled===false);
}
function ensureOne(kind:"dashboard"|"notice"){
  if(kind==="notice"){ensureNoticeControls();return}
  const card=document.querySelector<HTMLElement>(`.miv5-source-card.${kind}`);if(!card)return;
  const all=[...card.querySelectorAll<HTMLElement>(":scope > a,:scope > button")];
  let keep=all.find(el=>el.classList.contains(CANONICAL)) as HTMLAnchorElement|undefined;
  if(!keep){const reusable=all.find(el=>el instanceof HTMLAnchorElement&&(el.classList.contains(TOOL_CLASS)||el.classList.contains("miv5-install-link"))) as HTMLAnchorElement|undefined;keep=reusable||document.createElement("a");if(!reusable)card.appendChild(keep)}
  keep.className=`miv5-install-link ${TOOL_CLASS} ${CANONICAL}`;keep.href=hrefFor(kind);keep.textContent=card.classList.contains("needs-update")?"⬆ 更新あり":card.classList.contains("needs-install")?"＋ インストール":"設定 / 更新";keep.title=card.classList.contains("needs-update")?"Dashboard同期の更新があります":card.classList.contains("needs-install")?"Dashboard同期をこの端末へインストール":"Dashboard同期の設定・更新";keep.onclick=e=>e.stopPropagation();
  for(const el of [...card.querySelectorAll<HTMLElement>(":scope > a,:scope > button")]){if(el===keep||el.classList.contains("miv5-source-main"))continue;if(el.classList.contains("miv5-install-link")||el.classList.contains(TOOL_CLASS)||clean(el.textContent)==="インストール / 更新")el.remove()}
}
function ensureDetailProxy(){const actions=document.querySelector<HTMLElement>(".miu-topactions"),source=document.querySelector<HTMLButtonElement>(".miv5-source-card.detail .miv5-source-main");if(!actions||!source)return;actions.querySelectorAll(".mumei-public-refresh-proxy").forEach(el=>el.remove());let proxy=actions.querySelector<HTMLButtonElement>(`.${DETAIL_CLASS}`);if(!proxy){proxy=document.createElement("button");proxy.type="button";proxy.className=DETAIL_CLASS;proxy.innerHTML="<span>🔎 詳細分析</span><small>インストール不要</small>";proxy.addEventListener("click",()=>source.click());actions.appendChild(proxy)}}
function normalizeCopy(){const dash=document.querySelector<HTMLElement>(".miv5-source-card.dashboard .miv5-source-main small");if(dash)dash.textContent="Dashboard同期ツール";const span=document.querySelector<HTMLElement>(".miv5-source-card.dashboard .miv5-source-main span");if(span)span.textContent="公式Dashboard＋INSIGHT Pro";const notice=document.querySelector<HTMLElement>(".miv5-source-card.notice .miv5-source-main small");if(notice)notice.textContent="本人通知ツール"}
function enforce(){const root=document.querySelector<HTMLElement>(".miv5-update"),grid=root?.querySelector<HTMLElement>(":scope > .miv5-source-grid");if(!root||!grid)return;const mobile=window.matchMedia("(max-width:620px)").matches,total=mobile?97:102,main=mobile?72:76,gap=mobile?3:4;imp(root,"height",`${total+6}px`);imp(root,"min-height",`${total+6}px`);imp(root,"max-height",`${total+6}px`);imp(root,"overflow","visible");imp(grid,"display","grid");imp(grid,"grid-template-columns","repeat(3,minmax(0,1fr))");imp(grid,"grid-template-rows",`${total}px`);imp(grid,"grid-auto-rows",`${total}px`);imp(grid,"height",`${total}px`);imp(grid,"min-height",`${total}px`);imp(grid,"max-height",`${total}px`);imp(grid,"gap",`${gap}px`);const normal=grid.querySelector<HTMLElement>(".miv5-source-card.normal"),dash=grid.querySelector<HTMLElement>(".miv5-source-card.dashboard"),notice=grid.querySelector<HTMLElement>(".miv5-source-card.notice"),detail=grid.querySelector<HTMLElement>(".miv5-source-card.detail");const cards:[[HTMLElement|null,number],[HTMLElement|null,number],[HTMLElement|null,number]]=[[normal,1],[dash,2],[notice,3]];for(const[c,order]of cards){if(!c)continue;imp(c,"display","grid");imp(c,"order",String(order));imp(c,"height",`${total}px`);imp(c,"min-height",`${total}px`);imp(c,"max-height",`${total}px`)}imp(detail,"display","none");const update=normal?.querySelector<HTMLElement>(":scope > .miv5-install-link.update-ready");normal?.classList.toggle("mumei-has-app-update",Boolean(update));const normalMain=normal?.querySelector<HTMLElement>(":scope > .miv5-source-main"),dashMain=dash?.querySelector<HTMLElement>(":scope > .miv5-source-main"),noticeMain=notice?.querySelector<HTMLElement>(":scope > .miv5-source-main");imp(normalMain,"height",update?`${main}px`:`${total}px`);imp(normalMain,"min-height",update?`${main}px`:`${total}px`);imp(normalMain,"max-height",update?`${main}px`:`${total}px`);for(const el of[dashMain,noticeMain]){imp(el,"height",`${main}px`);imp(el,"min-height",`${main}px`);imp(el,"max-height",`${main}px`)}}
function run(){installStyle();requestFeatureState();ensureOne("dashboard");ensureOne("notice");ensureDetailProxy();normalizeCopy();enforce()}
function schedule(ms=20){window.clearTimeout(timer);timer=window.setTimeout(run,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{requestFeatureState(true);schedule(0)},{once:true});else{requestFeatureState(true);schedule(0)}new MutationObserver(()=>schedule(20)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","aria-busy"]});window.addEventListener("pageshow",()=>{requestFeatureState(true);schedule(0)});window.addEventListener("focus",()=>{requestFeatureState(true);schedule(0)});window.addEventListener("resize",()=>schedule(0));
