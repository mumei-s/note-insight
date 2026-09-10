export {};

const STYLE_ID="mumei-insight-mobile-v15-style";
const DETAIL_CLASS="mumei-detail-analysis-proxy";
let timer=0;

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");
  s.id=STYLE_ID;
  s.textContent=`
/* v15 final TOP ownership:
   1) 通常データ 2) 分析 3) 本人通知
   詳細分析はアカウント切替の横。ツールのインストール更新は通常データ更新と別操作。 */
.miv5-update .miv5-source-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-template-rows:auto!important;grid-auto-rows:auto!important;gap:4px!important;align-items:stretch!important;align-content:start!important;min-height:0!important;height:auto!important;max-height:none!important;margin:0!important;padding:0!important;overflow:visible!important}
.miv5-update .miv5-source-card.normal{display:block!important;order:1!important}
.miv5-update .miv5-source-card.dashboard{display:block!important;order:2!important}
.miv5-update .miv5-source-card.notice{display:block!important;order:3!important}
.miv5-update .miv5-source-card.detail{display:none!important}
.miv5-update .miv5-source-card{position:relative!important;box-sizing:border-box!important;min-width:0!important;min-height:0!important;height:82px!important;max-height:82px!important;margin:0!important;padding:0!important;overflow:hidden!important}
.miv5-update .miv5-source-main{box-sizing:border-box!important;width:100%!important;height:82px!important;min-height:82px!important;max-height:82px!important;border-radius:14px!important;padding:7px 7px!important;align-content:center!important;overflow:hidden!important}
.miv5-update .miv5-source-card.notice .miv5-source-main,.miv5-update .miv5-source-card.dashboard .miv5-source-main{padding-bottom:25px!important}
.miv5-update .miv5-source-main strong{font-size:9.5px!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-source-main small{font-size:6.9px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-source-main span{font-size:6.4px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
/* 本人通知 / Dashboard のツール導入はカード本体とは別ボタン。 */
.miv5-update .miv5-source-card.notice>.miv5-install-link,.miv5-update .miv5-source-card.dashboard>.miv5-install-link{display:flex!important;position:absolute!important;z-index:4!important;left:5px!important;right:5px!important;bottom:5px!important;height:18px!important;min-height:18px!important;margin:0!important;padding:0 5px!important;align-items:center!important;justify-content:center!important;border-radius:999px!important;font-size:6.8px!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
/* INSIGHT本体更新は通常データ側。ただし「インストール」とは呼ばず別操作。 */
.miv5-update .miv5-source-card.normal>.miv5-install-link.update-ready{display:flex!important;position:absolute!important;z-index:4!important;left:5px!important;right:5px!important;bottom:5px!important;height:18px!important;min-height:18px!important;margin:0!important;padding:0 5px!important;align-items:center!important;justify-content:center!important;border-radius:999px!important;font-size:6.8px!important;line-height:1!important}
.miv5-update .miv5-source-card.normal:has(>.miv5-install-link.update-ready) .miv5-source-main{padding-bottom:25px!important}
/* v14のアカウント横「通常データ」代理ボタンは使わない。 */
.miu-topactions .mumei-public-refresh-proxy{display:none!important}
.miu-topactions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;align-items:stretch!important}
.miu-topactions .${DETAIL_CLASS}{display:grid!important;place-items:center!important;align-content:center!important;gap:2px!important;min-width:0!important;min-height:50px!important;border:1px solid #6a4a91!important;background:#171126!important;color:#eadcff!important;border-radius:11px!important;padding:7px 8px!important;font-weight:950!important}
.miu-topactions .${DETAIL_CLASS} span{font-size:10px!important;line-height:1.15!important}.miu-topactions .${DETAIL_CLASS} small{font-size:7px!important;color:#bca9d1!important;line-height:1.2!important}
@media(max-width:620px){.miv5-update{width:calc(100% - 8px)!important;padding:3px!important}.miv5-update .miv5-source-grid{gap:3px!important}.miv5-update .miv5-source-card,.miv5-update .miv5-source-main{height:78px!important;min-height:78px!important;max-height:78px!important}.miv5-update .miv5-source-main{padding:6px!important}.miv5-update .miv5-source-card.notice .miv5-source-main,.miv5-update .miv5-source-card.dashboard .miv5-source-main,.miv5-update .miv5-source-card.normal:has(>.miv5-install-link.update-ready) .miv5-source-main{padding-bottom:24px!important}.miv5-update .miv5-source-main strong{font-size:8.7px!important}.miv5-update .miv5-source-main small{font-size:6.2px!important}.miv5-update .miv5-source-main span{font-size:5.8px!important}.miv5-update .miv5-source-card.notice>.miv5-install-link,.miv5-update .miv5-source-card.dashboard>.miv5-install-link,.miv5-update .miv5-source-card.normal>.miv5-install-link.update-ready{height:17px!important;min-height:17px!important;bottom:4px!important;font-size:6.2px!important}.miu-topactions .${DETAIL_CLASS}{min-height:48px!important}}
`;
  document.head.appendChild(s)
}

function ensureDetailProxy(){
  const actions=document.querySelector<HTMLElement>(".miu-topactions");
  const source=document.querySelector<HTMLButtonElement>(".miv5-source-card.detail .miv5-source-main");
  if(!actions||!source)return;
  let proxy=actions.querySelector<HTMLButtonElement>(`.${DETAIL_CLASS}`);
  if(!proxy){
    proxy=document.createElement("button");
    proxy.type="button";
    proxy.className=DETAIL_CLASS;
    proxy.innerHTML="<span>🔎 詳細分析</span><small>インストール不要</small>";
    proxy.addEventListener("click",()=>source.click());
    actions.appendChild(proxy)
  }
}

function normalizeInstallLabels(){
  const root=document.querySelector<HTMLElement>(".miv5-update");if(!root)return;
  const notice=root.querySelector<HTMLElement>(".miv5-source-card.notice"),dash=root.querySelector<HTMLElement>(".miv5-source-card.dashboard");
  const na=notice?.querySelector<HTMLElement>(":scope > .miv5-install-link"),da=dash?.querySelector<HTMLElement>(":scope > .miv5-install-link");
  if(na)na.textContent="インストール / 更新";
  if(da)da.textContent="インストール / 更新";
  const normalUpdate=root.querySelector<HTMLElement>(".miv5-source-card.normal > .miv5-install-link.update-ready");
  if(normalUpdate&&!/本体/.test(normalUpdate.textContent||""))normalUpdate.textContent="INSIGHT本体を更新"
}

function fitLauncher(){
  const root=document.querySelector<HTMLElement>(".miv5-update"),grid=root?.querySelector<HTMLElement>(":scope > .miv5-source-grid");if(!root||!grid)return;
  requestAnimationFrame(()=>{
    const r=grid.getBoundingClientRect(),cs=getComputedStyle(root),extra=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0)+(parseFloat(cs.borderTopWidth)||0)+(parseFloat(cs.borderBottomWidth)||0),h=Math.ceil(r.height+extra);
    if(h>0){root.style.setProperty("height",`${h}px`,"important");root.style.setProperty("min-height",`${h}px`,"important");root.style.setProperty("max-height",`${h}px`,"important")}
  })
}

function run(){installStyle();ensureDetailProxy();normalizeInstallLabels();fitLauncher()}
function schedule(ms=80){window.clearTimeout(timer);timer=window.setTimeout(run,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule(100)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","aria-busy"]});
window.addEventListener("resize",()=>schedule(30));window.addEventListener("pageshow",()=>schedule(30));
