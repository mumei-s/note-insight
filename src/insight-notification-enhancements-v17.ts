export {};

const STYLE_ID="mumei-notification-enhancements-v17-style";
const CAT_ORDER_KEY="mumei-notification-category-order-v17";
const COMMENTS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-comment-events";
const FEED_MARK="insight-notification-feed-final";
const TOKEN_KEY="mumei-insight-access-token";
const HOLD_MS=520;
let timer=0;
let suppressClickUntil=0;
let draggingId="";
let dragOrder:string[]=[];
const feedBodies:any[]=[];
const dayCache=new Map<string,any[]>();

function clean(v:any){return String(v||"").replace(/\s+/g," ").trim()}
function idFromProfile(url:any){try{return new URL(String(url||"")).pathname.split("/").filter(Boolean)[0]?.toLowerCase()||""}catch{return""}}
function articleKey(url:any){try{const u=new URL(String(url||"")),p=u.pathname.split("/").filter(Boolean),i=p.indexOf("n");return i>=0&&p[i+1]?`${String(p[0]||"").toLowerCase()}/${p[i+1]}`:""}catch{return""}}
function timeMs(text:any){const m=String(text||"").match(/(\d{4})[\/.年-](\d{1,2})[\/.月-](\d{1,2})[^\d]+(\d{1,2}):(\d{2})/);return m?Date.parse(`${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}T${String(m[4]).padStart(2,"0")}:${m[5]}:00+09:00`):0}
function jstDay(text:any){const m=String(text||"").match(/(\d{4})[\/.年-](\d{1,2})[\/.月-](\d{1,2})/);return m?`${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`:""}

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

function pushFeedBody(r:any){const body=clean(r?.meta?.body||r?.meta?.comment_body||r?.comment_body||r?.body||r?.message||r?.detail||r?.raw_text);if(!body)return;feedBodies.push({body,actor:idFromProfile(r.actor_url),article:articleKey(r.target_url||r.source_url),at:Date.parse(String(r.occurred_at||r.captured_at||""))||0,type:String(r.display_category||r.notification_type||"")});if(feedBodies.length>1000)feedBodies.splice(0,feedBodies.length-1000)}
const fetchBeforeV17=window.fetch.bind(window);
window.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{const response=await fetchBeforeV17(input as any,init);try{const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;if(url.includes(FEED_MARK)){const clone=response.clone();void clone.json().then(p=>{for(const r of p?.rows||[])pushFeedBody(r)}).catch(()=>{})}}catch{}return response}) as typeof window.fetch;

async function loadCommentWindow(day:string){
  if(dayCache.has(day))return dayCache.get(day)!;const token=localStorage.getItem(TOKEN_KEY)||"";if(!token)return[];const base=Date.parse(`${day}T00:00:00+09:00`),dateFrom=new Date(base-86400000).toISOString(),dateTo=new Date(base+2*86400000).toISOString(),rows:any[]=[];
  for(let page=1;page<=4;page++){try{const r=await fetchBeforeV17(COMMENTS,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify({page,pageSize:500,dateFrom,dateTo}),cache:"no-store"}),p=await r.json().catch(()=>({}));if(!r.ok||p?.ok===false)break;rows.push(...(p.rows||[]));if(rows.length>=Number(p.total||0)||!(p.rows||[]).length)break}catch{break}}
  dayCache.set(day,rows);return rows;
}
function commentTarget(article:HTMLElement){return{actor:idFromProfile((article.querySelector('.minf-who a[href*="note.com/"]') as HTMLAnchorElement|null)?.href||""),article:articleKey((article.querySelector('.minf-main[href*="/n/"],.minf-target[href*="/n/"]') as HTMLAnchorElement|null)?.href||""),at:timeMs(article.querySelector("time")?.textContent||""),type:clean(article.querySelector(".mumei-comment-toggle")?.textContent||"")}}
function bestCached(t:any){let best:any=null,score=-1;for(const r of feedBodies){let s=0;if(t.actor&&r.actor===t.actor)s+=100;if(t.article&&r.article===t.article)s+=110;const gap=t.at&&r.at?Math.abs(t.at-r.at):Infinity;if(gap<=5*60000)s+=100;else if(gap<=60*60000)s+=60;else if(gap<=24*3600000)s+=15;if(s>score){score=s;best=r}}return score>=170?best:null}
function bestApi(t:any,rows:any[]){let best:any=null,score=-1;for(const r of rows){const body=clean(r.body||r.comment_body||r.text||r.message||r.detail);if(!body)continue;let s=0;const actor=idFromProfile(r.actor_url),akey=articleKey(r.article_url);if(t.actor&&actor===t.actor)s+=110;if(t.article&&akey===t.article)s+=120;const at=Date.parse(String(r.occurred_at||""))||0,gap=t.at&&at?Math.abs(t.at-at):Infinity;if(gap<=5*60000)s+=100;else if(gap<=60*60000)s+=60;else if(gap<=24*3600000)s+=15;if(s>score){score=s;best={...r,body}}}return score>=180?best:null}
async function ensureCommentBody(article:HTMLElement){
  if(!article.classList.contains("mumei-comment-open"))return;let box=article.querySelector<HTMLElement>(".mumei-comment-body");if(!box){box=document.createElement("div");box.className="mumei-comment-body";article.querySelector(".minf-main")?.insertAdjacentElement("afterend",box)}if(!box||box.dataset.v17Loaded==="1"||box.dataset.v17Loading==="1")return;
  box.dataset.v17Loading="1";box.innerHTML="<b>コメント本文</b><p>本文を取得中…</p>";const t=commentTarget(article);
  try{const cached=bestCached(t);let body=clean(cached?.body),source="通知feedの保存本文";if(!body){const day=jstDay(article.querySelector("time")?.textContent||""),rows=day?await loadCommentWindow(day):[],hit=bestApi(t,rows);body=clean(hit?.body);source="通常コメント履歴から照合"}if(!body){body=clean(article.querySelector(".minf-main small")?.textContent||"");source=body?"通知本文を表示":"本文照合結果なし"}box.innerHTML="";const b=document.createElement("b"),p=document.createElement("p"),small=document.createElement("small");b.textContent=/返信/.test(t.type)?"返信本文":"コメント本文";p.textContent=body||"保存済み本文を特定できませんでした。対象記事から確認できます。";small.textContent=source;box.append(b,p,small);box.dataset.v17Loaded="1"}finally{delete box.dataset.v17Loading}
}
function bindCommentBody(){
  if(document.documentElement.dataset.mumeiCommentBodyV17==="1")return;document.documentElement.dataset.mumeiCommentBodyV17="1";
  const open=(target:EventTarget|null)=>{const el=target instanceof Element?target.closest("#minf-notifications .mumei-comment-toggle"):null;if(!el)return;const article=el.closest("article") as HTMLElement|null;if(article)window.setTimeout(()=>void ensureCommentBody(article),60)};
  document.addEventListener("click",e=>open(e.target),true);document.addEventListener("keydown",e=>{const k=e as KeyboardEvent;if(k.key==="Enter"||k.key===" ")open(e.target)},true);
}
function run(){installStyle();applyCategoryOrder();bindCategoryReorder();bindCommentBody()}
function schedule(ms=100){window.clearTimeout(timer);timer=window.setTimeout(run,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule(120)).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener("pageshow",()=>schedule(40));
