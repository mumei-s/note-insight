export {};

const STYLE_ID="mumei-notification-enhancements-v17-style";
const CAT_ORDER_KEY="mumei-notification-category-order-v17";
const FEED_MARK="insight-notification-feed-final";
const TOKEN_KEY="mumei-insight-access-token";
const HOLD_MS=520;
let timer=0;
let suppressClickUntil=0;
let draggingId="";
let dragOrder:string[]=[];
const feedBodies:{identity:string;body:string;token:string}[]=[];

function clean(v:any){return String(v||"").replace(/\s+/g," ").trim()}
function currentToken(){try{return localStorage.getItem(TOKEN_KEY)||""}catch{return""}}
function commentIdentity(raw:any){try{const u=new URL(String(raw||"")),m=u.pathname.match(/^\/([A-Za-z0-9_-]+)\/n\/(n[A-Za-z0-9]+)$/),key=u.searchParams.get("c");return /^https?:$/.test(u.protocol)&&u.hostname==="note.com"&&m&&key&&/^nc[A-Za-z0-9]+$/.test(key)?{identity:`${m[1].toLowerCase()}/${m[2]}:${key}`,key}:null}catch{return null}}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");
  s.id=STYLE_ID;
  s.textContent=`
.minf-list article.mumei-comment-open>.mumei-comment-body,.minf-list article.mumei-comment-open .mumei-comment-body{display:grid!important;gap:3px!important;margin:6px 0 2px!important;padding:8px 9px!important;border:1px solid #4e8198!important;border-radius:9px!important;background:#071a26!important;color:#e4f8ff!important}
.mumei-comment-body b{font-size:9px!important;color:#8feaff!important}.mumei-comment-body p{margin:0!important;font-size:10px!important;line-height:1.55!important;white-space:pre-wrap!important}.mumei-comment-body small{font-size:7.5px!important;color:#8da7b7!important}
.minf-tabs button.mumei-cat-held{outline:2px solid #b6ff38!important;box-shadow:0 0 18px rgba(182,255,56,.28)!important;transform:scale(.98)!important;z-index:5!important}.minf-tabs.mumei-cat-reorder-mode{touch-action:none!important}.mumei-category-toggle[data-reorder-hint="1"]::before{content:'長押しで並替 ';font-size:7px;color:#8db6c7;margin-right:6px;font-weight:750}
`;
  document.head.appendChild(s);
}

function readOrder(buttons:HTMLButtonElement[]){
  const ids=buttons.map(b=>clean(b.textContent).replace(/\d+$/,""));
  try{const raw=JSON.parse(localStorage.getItem(CAT_ORDER_KEY)||"[]") as string[];return[...raw.filter(x=>ids.includes(x)),...ids.filter(x=>!raw.includes(x))]}catch{return ids}
}
function saveOrder(order:string[]){try{localStorage.setItem(CAT_ORDER_KEY,JSON.stringify(order))}catch{}}
function applyCategoryOrder(){
  const tabs=document.querySelector<HTMLElement>("#minf-notifications .minf-tabs");if(!tabs)return;
  const buttons=[...tabs.querySelectorAll<HTMLButtonElement>("button")],order=readOrder(buttons);
  for(const b of buttons){const id=clean(b.textContent).replace(/\d+$/,""),i=order.indexOf(id);b.style.order=String(i<0?999:i);b.dataset.mumeiCatId=id}
  const toggle=document.querySelector<HTMLElement>("#minf-notifications .mumei-category-toggle");if(toggle)toggle.dataset.reorderHint="1";
}
function bindCategoryReorder(){
  const tabs=document.querySelector<HTMLElement>("#minf-notifications .minf-tabs");if(!tabs||tabs.dataset.mumeiReorderBoundV17==="1"){applyCategoryOrder();return}
  tabs.dataset.mumeiReorderBoundV17="1";applyCategoryOrder();let hold=0,pointer=-1,held:HTMLButtonElement|null=null;
  const stop=()=>{if(hold)window.clearTimeout(hold);hold=0;held?.classList.remove("mumei-cat-held");tabs.classList.remove("mumei-cat-reorder-mode");held=null;pointer=-1;draggingId=""};
  tabs.addEventListener("pointerdown",e=>{const b=(e.target as Element)?.closest<HTMLButtonElement>("button");if(!b)return;pointer=e.pointerId;held=b;hold=window.setTimeout(()=>{if(!held)return;draggingId=held.dataset.mumeiCatId||clean(held.textContent);dragOrder=readOrder([...tabs.querySelectorAll<HTMLButtonElement>("button")]);held.classList.add("mumei-cat-held");tabs.classList.add("mumei-cat-reorder-mode");suppressClickUntil=Date.now()+1000;try{navigator.vibrate?.(35)}catch{}},HOLD_MS)});
  tabs.addEventListener("pointermove",e=>{if(!draggingId||e.pointerId!==pointer)return;if(e.cancelable)e.preventDefault();const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLButtonElement>("#minf-notifications .minf-tabs button");const to=target?.dataset.mumeiCatId||"";if(!to||to===draggingId)return;const a=dragOrder.indexOf(draggingId),b=dragOrder.indexOf(to);if(a<0||b<0)return;dragOrder.splice(a,1);dragOrder.splice(b,0,draggingId);saveOrder(dragOrder);applyCategoryOrder();suppressClickUntil=Date.now()+1000});
  tabs.addEventListener("pointerup",stop);tabs.addEventListener("pointercancel",stop);tabs.addEventListener("pointerleave",e=>{if(!draggingId&&e.pointerId===pointer)stop()});tabs.addEventListener("click",e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
}

// Notification body/raw_text and the card description are action summaries, not replies.
// The legacy view may use only a separately resolved body with an exact comment locator.
function pushFeedBody(r:any,token:string){
  if(!token||token!==currentToken())return;const meta=r?.meta||{},verified=meta.comment_body_source==="exact-comment-id",canonical=meta.source==="canonical-public-comments";
  if(!verified&&!canonical)return;const value=meta.comment_body||r?.comment_body||(canonical?meta.body:"");if(typeof value!=="string"||!value.trim())return;
  const key=String(meta.comment_key||r?.comment_identity?.commentKey||""),identity=[r?.target_url,r?.source_url,meta.all_area_url,meta.featured_area_url,r?.comment_identity?.url].map(commentIdentity).find(x=>x?.key===key);if(!identity)return;
  feedBodies.push({identity:identity.identity,body:value.replace(/\r\n?/g,"\n").trim(),token});if(feedBodies.length>1000)feedBodies.splice(0,feedBodies.length-1000);
}
const fetchBeforeV17=window.fetch.bind(window);
window.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{const token=currentToken();let requestToken="";try{requestToken=new Headers(init?.headers||(typeof Request!=="undefined"&&input instanceof Request?input.headers:undefined)).get("X-Insight-Token")||""}catch{}const response=await fetchBeforeV17(input as any,init);try{const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;if(response.ok&&url.includes(FEED_MARK)&&(!requestToken||requestToken===token)){const clone=response.clone();void clone.json().then(p=>{if(p?.ok===false||token!==currentToken())return;for(const r of p?.rows||[])pushFeedBody(r,token)}).catch(()=>{})}}catch{}return response}) as typeof window.fetch;

function removeLegacyBody(article:HTMLElement){for(const box of article.querySelectorAll(".mumei-comment-body"))box.remove()}
function cachedBody(identity:string,token:string){for(let i=feedBodies.length-1;i>=0;i--)if(feedBodies[i].identity===identity&&feedBodies[i].token===token)return feedBodies[i];return null}
function ensureCommentBody(article:HTMLElement){
  if(article.dataset.commentContextNative==="true"){removeLegacyBody(article);return}
  if(!article.isConnected||!article.classList.contains("mumei-comment-open"))return;let box=article.querySelector<HTMLElement>(".mumei-comment-body");if(!box){box=document.createElement("div");box.className="mumei-comment-body";article.querySelector(".minf-main")?.insertAdjacentElement("afterend",box)}if(!box)return;
  const identity=[...article.querySelectorAll<HTMLAnchorElement>("a.minf-main,a.minf-target")].map(a=>commentIdentity(a.href)).find(Boolean),token=currentToken(),cached=identity?cachedBody(identity.identity,token):null;
  box.innerHTML="";const b=document.createElement("b"),p=document.createElement("p"),small=document.createElement("small");b.textContent=cached?(/返信/.test(clean(article.querySelector(".mumei-comment-toggle")?.textContent))?"返信本文":"コメント本文"):"本文未取得";p.textContent=cached?.body||"対象IDに一致する保存本文がありません。対象ページから確認できます。";small.textContent=cached?"対象コメントIDを確認済み":"通知文は返信本文として表示しません。";box.append(b,p,small);box.dataset.v17Loaded="1";
}
function bindCommentBody(){
  for(const article of document.querySelectorAll<HTMLElement>('#minf-notifications article[data-comment-context-native="true"]'))removeLegacyBody(article);
  if(document.documentElement.dataset.mumeiCommentBodyV17==="1")return;document.documentElement.dataset.mumeiCommentBodyV17="1";
  const open=(target:EventTarget|null)=>{const el=target instanceof Element?target.closest("#minf-notifications .mumei-comment-toggle"):null;if(!el)return;const article=el.closest("article") as HTMLElement|null;if(article&&article.dataset.commentContextNative!=="true")window.setTimeout(()=>ensureCommentBody(article),60)};
  document.addEventListener("click",e=>open(e.target),true);document.addEventListener("keydown",e=>{const k=e as KeyboardEvent;if(k.key==="Enter"||k.key===" ")open(e.target)},true);
}
function run(){installStyle();applyCategoryOrder();bindCategoryReorder();bindCommentBody()}
function schedule(ms=100){window.clearTimeout(timer);timer=window.setTimeout(run,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule(120)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["data-comment-context-native"]});
window.addEventListener("pageshow",()=>schedule(40));
