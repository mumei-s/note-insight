export {};

const STYLE_ID="mumei-notification-ui-v18-style";
const TOGGLE_CLASS="mumei-notification-category-button";
const PUBLIC_DUPLICATE_LABELS=new Set(["スキ","人物フォロー","通常コメント","記事投稿"]);
let timer=0;

function clean(v:any){return String(v||"").replace(/\s+/g," ").trim()}
function labelOf(b:HTMLButtonElement){const first=[...b.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);return clean(first?.textContent||b.textContent).replace(/\d+$/," ").trim()}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`
#minf-notifications .${TOGGLE_CLASS}{width:100%;min-height:42px;display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0;padding:9px 12px;border:1px solid #45687d;border-radius:10px;background:#0a1c28;color:#e8f8ff;font:900 11px/1.2 system-ui;text-align:left;box-shadow:0 3px 12px rgba(0,0,0,.18)}
#minf-notifications .${TOGGLE_CLASS} small{color:#82dff1;font-size:8px;font-weight:850}
#minf-notifications .minf-tabs[data-mumei-category-open="0"]{display:none!important}
#minf-notifications .minf-tabs[data-mumei-category-open="1"]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;margin:0 0 8px!important}
#minf-notifications .minf-tabs[data-mumei-category-open="1"] button{min-width:0!important;width:100%!important}
@media(max-width:430px){#minf-notifications .minf-tabs[data-mumei-category-open="1"]{grid-template-columns:1fr!important}}
`;
  document.head.appendChild(s)
}
function activeLabel(tabs:HTMLElement){const b=tabs.querySelector<HTMLButtonElement>("button.active");return b?labelOf(b):"すべて"}
function removePublicDuplicateButtons(tabs:HTMLElement){for(const b of tabs.querySelectorAll<HTMLButtonElement>("button")){const l=labelOf(b);if(PUBLIC_DUPLICATE_LABELS.has(l)){b.hidden=true;b.setAttribute("aria-hidden","true");b.tabIndex=-1}else if(b.dataset.mumeiPublicHidden==="1"){b.hidden=false;b.removeAttribute("aria-hidden");b.tabIndex=0}b.dataset.mumeiPublicHidden=PUBLIC_DUPLICATE_LABELS.has(l)?"1":"0"}}
function ensurePicker(){
  const root=document.querySelector<HTMLElement>("#minf-notifications");const tabs=root?.querySelector<HTMLElement>(".minf-tabs");if(!root||!tabs)return;
  removePublicDuplicateButtons(tabs);
  let toggle=root.querySelector<HTMLButtonElement>(`.${TOGGLE_CLASS}`);
  if(!toggle){toggle=document.createElement("button");toggle.type="button";toggle.className=`${TOGGLE_CLASS} mumei-category-toggle`;tabs.insertAdjacentElement("beforebegin",toggle)}
  if(!tabs.dataset.mumeiCategoryOpen)tabs.dataset.mumeiCategoryOpen="0";
  const paint=()=>{const open=tabs.dataset.mumeiCategoryOpen==="1",label=activeLabel(tabs);toggle!.innerHTML=`<span>通知項目：${label}</span><small>${open?"▲ 閉じる":"▼ 選ぶ"}</small>`;toggle!.setAttribute("aria-expanded",open?"true":"false");toggle!.setAttribute("aria-controls","minf-notification-category-list");tabs.id="minf-notification-category-list"};
  if(toggle.dataset.mumeiBound!=="1"){toggle.dataset.mumeiBound="1";toggle.addEventListener("click",()=>{tabs.dataset.mumeiCategoryOpen=tabs.dataset.mumeiCategoryOpen==="1"?"0":"1";paint()})}
  if(tabs.dataset.mumeiCollapseBound!=="1"){tabs.dataset.mumeiCollapseBound="1";tabs.addEventListener("click",e=>{const b=(e.target as Element|null)?.closest<HTMLButtonElement>("button");if(!b||b.hidden)return;window.setTimeout(()=>{tabs.dataset.mumeiCategoryOpen="0";paint()},0)})}
  paint()
}
function run(){installStyle();ensurePicker()}
function schedule(ms=80){window.clearTimeout(timer);timer=window.setTimeout(run,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule(100)).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener("pageshow",()=>schedule(30));
