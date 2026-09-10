export {};

const STYLE_ID="mumei-insight-mobile-v14-style";
const CAT_ORDER_KEY="mumei-notification-category-order-v14";
const FEATURE_VERSION="2026.09.10.2";
const FEATURE_PREFIX="mumei-insight-feature-seen-v14:";
const COMMENTS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-comment-events";
const FEED_MARK="insight-notification-feed-final";
const TOKEN_KEY="mumei-insight-access-token";
const HOLD_MS=520;
let timer=0;
let topObserver:ResizeObserver|null=null;
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
  const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`
/* TOP launcher v14: public-data refresh lives beside account switch. The launcher itself is three equal cards only. */
.miv5-update{box-sizing:border-box!important;display:block!important;min-height:0!important;height:auto!important;max-height:none!important;block-size:auto!important;min-block-size:0!important;max-block-size:none!important;aspect-ratio:auto!important;overflow:hidden!important;padding:4px!important;margin:3px auto 2px!important;align-self:flex-start!important}
.miv5-update::before,.miv5-update::after,.miv5-source-grid::before,.miv5-source-grid::after{content:none!important;display:none!important}
.miv5-update .miv5-source-card.normal{display:none!important}
.miv5-update .miv5-source-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-template-rows:auto!important;grid-auto-rows:auto!important;gap:4px!important;align-items:stretch!important;align-content:start!important;min-height:0!important;height:auto!important;max-height:none!important;margin:0!important;padding:0!important;overflow:visible!important}
.miv5-update .miv5-source-card{display:block!important;min-width:0!important;min-height:0!important;height:auto!important;max-height:none!important;margin:0!important;padding:0!important;align-self:stretch!important}
.miv5-update .miv5-source-main{width:100%!important;height:78px!important;min-height:78px!important;max-height:78px!important;border-radius:14px!important;padding:7px 8px!important;align-content:center!important;overflow:hidden!important}
.miv5-update .miv5-source-main strong{font-size:10px!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-source-main small{font-size:7.2px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-source-main span{font-size:6.8px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.miv5-update .miv5-install-link{display:none!important}
.miv5-update+.micmp{margin-top:2px!important}
.mumei-feature-new{display:inline-flex!important;align-items:center!important;justify-content:center!important;margin-left:4px!important;padding:2px 4px!important;border-radius:999px!important;background:#b6ff38!important;color:#101700!important;font:950 6.5px/1 system-ui!important;vertical-align:middle!important}
/* Public data control beside account switch. */
.miu-topactions .mumei-public-refresh-proxy{position:relative!important;display:grid!important;place-items:center!important;align-content:center!important;gap:2px!important;min-width:0!important;min-height:38px!important;border:1px solid #47745c!important;background:#0c2119!important;color:#c8ffda!important;border-radius:10px!important;padding:5px 8px!important;font-weight:950!important}
.miu-topactions .mumei-public-refresh-proxy span{font-size:9.5px!important;line-height:1.15!important}.miu-topactions .mumei-public-refresh-proxy small{font-size:6.8px!important;color:#86a99a!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}.miu-topactions .mumei-public-refresh-proxy.busy{opacity:.8!important}.miu-topactions .mumei-public-refresh-proxy .mumei-feature-new{position:absolute!important;right:4px!important;top:3px!important}
@media(max-width:620px){.miv5-update{width:calc(100% - 8px)!important;padding:3px!important}.miv5-update .miv5-source-grid{gap:3px!important}.miv5-update .miv5-source-main{height:72px!important;min-height:72px!important;max-height:72px!important;padding:6px!important}.miv5-update .miv5-source-main strong{font-size:9px!important}.miv5-update .miv5-source-main small{font-size:6.5px!important}.miv5-update .miv5-source-main span{font-size:6.1px!important}.miu-topactions{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important}}
/* Comment body must be visible whenever the disclosure is open. */
.minf-list article.mumei-comment-open>.mumei-comment-body,.minf-list article.mumei-comment-open .mumei-comment-body{display:grid!important;gap:3px!important;margin:6px 0 2px!important;padding:8px 9px!important;border:1px solid #4e8198!important;border-radius:9px!important;background:#071a26!important;color:#e4f8ff!important}
.mumei-comment-body b{font-size:9px!important;color:#8feaff!important}.mumei-comment-body p{margin:0!important;font-size:10px!important;line-height:1.55!important;white-space:pre-wrap!important}.mumei-comment-body small{font-size:7.5px!important;color:#8da7b7!important}
/* Long press category reorder, while keeping the one-panel design. */
.minf-tabs button.mumei-cat-held{outline:2px solid #b6ff38!important;box-shadow:0 0 18px rgba(182,255,56,.28)!important;transform:scale(.98)!important;z-index:5!important}.minf-tabs.mumei-cat-reorder-mode{touch-action:none!important}.mumei-category-toggle[data-reorder-hint="1"]::before{content:'長押しで並替 ';font-size:7px;color:#8db6c7;margin-right:6px;font-weight:750}
`;document.head.appendChild(s)
}

function featureKey(name:string){return FEATURE_PREFIX+name}
function unseen(name:string){try{return localStorage.getItem(featureKey(name))!==FEATURE_VERSION}catch{return true}}
function markSeen(name:string){try{localStorage.setItem(featureKey(name),FEATURE_VERSION)}catch{}}
function badgeInto(el:HTMLElement|null,name:string){if(!el)return;let badge=el.querySelector<HTMLElement>(`.mumei-feature-new[data-feature="${name}"]`);if(!unseen(name)){badge?.remove();return}if(!badge){badge=document.createElement("em");badge.className="mumei-feature-new";badge.dataset.feature=name;badge.textContent="NEW";el.appendChild(badge)}}

function paintFeatureBadges(){
  const root=document.querySelector<HTMLElement>(".miv5-update");if(!root)return;
  const pairs:[string,string][]=[["notice","notification"],["dashboard","dashboard"],["detail","detail"]];
  for(const[cls,name]of pairs){const card=root.querySelector<HTMLElement>(`.miv5-source-card.${cls}`),strong=card?.querySelector<HTMLElement>(".miv5-source-main strong");badgeInto(strong||null,name);const btn=card?.querySelector<HTMLButtonElement>(".miv5-source-main");if(btn&&btn.dataset.mumeiFeatureBound!=="1"){btn.dataset.mumeiFeatureBound="1";btn.addEventListener("click",()=>{markSeen(name);badgeInto(strong||null,name)})}}
}

function shrinkLauncher(){
  const root=document.querySelector<HTMLElement>(".miv5-update"),grid=root?.querySelector<HTMLElement>(":scope > .miv5-source-grid");if(!root||!grid)return;
  const rect=grid.getBoundingClientRect(),cs=getComputedStyle(root),extra=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0)+(parseFloat(cs.borderTopWidth)||0)+(parseFloat(cs.borderBottomWidth)||0),height=Math.max(0,Math.ceil(rect.height+extra));
  if(height>0){root.style.setProperty("height",`${height}px`,"important");root.style.setProperty("min-height",`${height}px`,"important");root.style.setProperty("max-height",`${height}px`,"important")}
  if(topObserver){topObserver.disconnect();topObserver=null}
  if("ResizeObserver" in window){topObserver=new ResizeObserver(()=>{const r=grid.getBoundingClientRect(),c=getComputedStyle(root),x=(parseFloat(c.paddingTop)||0)+(parseFloat(c.paddingBottom)||0)+(parseFloat(c.borderTopWidth)||0)+(parseFloat(c.borderBottomWidth)||0),h=Math.max(0,Math.ceil(r.height+x));if(h>0&&Math.abs(root.getBoundingClientRect().height-h)>1){root.style.setProperty("height",`${h}px`,"important");root.style.setProperty("min-height",`${h}px`,"important");root.style.setProperty("max-height",`${h}px`,"important")}});topObserver.observe(grid)}
}

function ensurePublicProxy(){
  const actions=document.querySelector<HTMLElement>(".miu-topactions"),source=document.querySelector<HTMLButtonElement>(".miv5-source-card.normal .miv5-source-main");if(!actions||!source)return;
  let proxy=actions.querySelector<HTMLButtonElement>(".mumei-public-refresh-proxy");if(!proxy){proxy=document.createElement("button");proxy.type="button";proxy.className="mumei-public-refresh-proxy";proxy.innerHTML="<span>↻ 通常データ</span><small>タップで公開データ更新</small>";actions.appendChild(proxy);proxy.addEventListener("click",()=>{markSeen("normal");paintPublicProxy();source.click();window.setTimeout(paintPublicProxy,80);window.setTimeout(paintPublicProxy,1500);window.setTimeout(paintPublicProxy,12000)})}
  paintPublicProxy()
}
function paintPublicProxy(){
  const proxy=document.querySelector<HTMLButtonElement>(".mumei-public-refresh-proxy"),source=document.querySelector<HTMLButtonElement>(".miv5-source-card.normal .miv5-source-main");if(!proxy||!source)return;const busy=source.getAttribute("aria-busy")==="true",status=clean(source.querySelector("span")?.textContent||"");proxy.classList.toggle("busy",busy);const label=proxy.querySelector<HTMLElement>("span"),sub=proxy.querySelector<HTMLElement>("small");if(label)label.textContent=busy?"↻ 通常データ更新中":"↻ 通常データ更新";if(sub)sub.textContent=busy?"保存済みデータは利用可・自動解除":"保存済みデータを維持して更新";proxy.title=status||"公開データを更新";badgeInto(proxy,"normal")
}

function readOrder(buttons:HTMLButtonElement[]){const ids=buttons.map(b=>clean(b.textContent).replace(/\d+$/,""));try{const raw=JSON.parse(localStorage.getItem(CAT_ORDER_KEY)||"[]") as string[];return[...raw.filter(x=>ids.includes(x)),...ids.filter(x=>!raw.includes(x))]}catch{return ids}}
function saveOrder(order:string[]){try{localStorage.setItem(CAT_ORDER_KEY,JSON.stringify(order))}catch{}}
function applyCategoryOrder(){const tabs=document.querySelector<HTMLElement>("#minf-notifications .minf-tabs");if(!tabs)return;const buttons=[...tabs.querySelectorAll<HTMLButtonElement>("button")],order=readOrder(buttons);for(const b of buttons){const id=clean(b.textContent).replace(/\d+$/,""),i=order.indexOf(id);b.style.order=String(i<0?999:i);b.dataset.mumeiCatId=id}const toggle=document.querySelector<HTMLElement>("#minf-notifications .mumei-category-toggle");if(toggle)toggle.dataset.reorderHint="1"}
function bindCategoryReorder(){
  const tabs=document.querySelector<HTMLElement>("#minf-notifications .minf-tabs");if(!tabs||tabs.dataset.mumeiReorderBound==="1"){applyCategoryOrder();return}tabs.dataset.mumeiReorderBound="1";applyCategoryOrder();let hold=0,pointer=-1,held:HTMLButtonElement|null=null;
  const stop=()=>{if(hold)window.clearTimeout(hold);hold=0;held?.classList.remove("mumei-cat-held");tabs.classList.remove("mumei-cat-reorder-mode");held=null;pointer=-1;draggingId=""};
  tabs.addEventListener("pointerdown",e=>{const b=(e.target as Element)?.closest<HTMLButtonElement>("button");if(!b)return;pointer=e.pointerId;held=b;hold=window.setTimeout(()=>{if(!held)return;draggingId=held.dataset.mumeiCatId||clean(held.textContent);dragOrder=readOrder([...tabs.querySelectorAll<HTMLButtonElement>("button")]);held.classList.add("mumei-cat-held");tabs.classList.add("mumei-cat-reorder-mode");suppressClickUntil=Date.now()+1000;try{navigator.vibrate?.(35)}catch{}},HOLD_MS)});
  tabs.addEventListener("pointermove",e=>{if(!draggingId||e.pointerId!==pointer)return;if(e.cancelable)e.preventDefault();const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLButtonElement>("#minf-notifications .minf-tabs button");const to=target?.dataset.mumeiCatId||"";if(!to||to===draggingId)return;const a=dragOrder.indexOf(draggingId),b=dragOrder.indexOf(to);if(a<0||b<0)return;dragOrder.splice(a,1);dragOrder.splice(b,0,draggingId);saveOrder(dragOrder);applyCategoryOrder();suppressClickUntil=Date.now()+1000});
  tabs.addEventListener("pointerup",stop);tabs.addEventListener("pointercancel",stop);tabs.addEventListener("pointerleave",e=>{if(!draggingId&&e.pointerId===pointer)stop()});tabs.addEventListener("click",e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation()}},true)
}

function pushFeedBody(r:any){const body=clean(r?.meta?.body||r?.meta?.comment_body||r?.comment_body||r?.body);if(!body)return;const entry={body,actor:idFromProfile(r.actor_url),article:articleKey(r.target_url||r.source_url),at:Date.parse(String(r.occurred_at||r.captured_at||""))||0,type:String(r.display_category||r.notification_type||"")};feedBodies.push(entry);if(feedBodies.length>800)feedBodies.splice(0,feedBodies.length-800)}
const fetchBeforeV14=window.fetch.bind(window);
window.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{const response=await fetchBeforeV14(input as any,init);try{const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;if(url.includes(FEED_MARK)){const clone=response.clone();void clone.json().then(p=>{for(const r of p?.rows||[])pushFeedBody(r)}).catch(()=>{})}}catch{}return response}) as typeof window.fetch;

async function loadCommentWindow(day:string){
  if(dayCache.has(day))return dayCache.get(day)!;const token=localStorage.getItem(TOKEN_KEY)||"";if(!token)return[];const base=Date.parse(`${day}T00:00:00+09:00`),dateFrom=new Date(base-86400000).toISOString(),dateTo=new Date(base+2*86400000).toISOString(),rows:any[]=[];
  for(let page=1;page<=4;page++){try{const r=await fetchBeforeV14(COMMENTS,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify({page,pageSize:500,dateFrom,dateTo}),cache:"no-store"}),p=await r.json().catch(()=>({}));if(!r.ok||p?.ok===false)break;rows.push(...(p.rows||[]));if(rows.length>=Number(p.total||0)||!(p.rows||[]).length)break}catch{break}}
  dayCache.set(day,rows);return rows
}
function commentTarget(article:HTMLElement){return{actor:idFromProfile((article.querySelector('.minf-who a[href*="note.com/"]') as HTMLAnchorElement|null)?.href||""),article:articleKey((article.querySelector('.minf-main[href*="/n/"],.minf-target[href*="/n/"]') as HTMLAnchorElement|null)?.href||""),at:timeMs(article.querySelector("time")?.textContent||""),type:clean(article.querySelector(".mumei-comment-toggle")?.textContent||"")}}
function bestCached(t:any){let best:any=null,score=-1;for(const r of feedBodies){let s=0;if(t.actor&&r.actor===t.actor)s+=100;if(t.article&&r.article===t.article)s+=110;const gap=t.at&&r.at?Math.abs(t.at-r.at):Infinity;if(gap<=5*60000)s+=100;else if(gap<=60*60000)s+=60;else if(gap<=24*3600000)s+=15;if(s>score){score=s;best=r}}return score>=170?best:null}
function bestApi(t:any,rows:any[]){let best:any=null,score=-1;for(const r of rows){const body=clean(r.body||r.comment_body||r.text);if(!body)continue;let s=0;const actor=idFromProfile(r.actor_url),akey=articleKey(r.article_url);if(t.actor&&actor===t.actor)s+=110;if(t.article&&akey===t.article)s+=120;const at=Date.parse(String(r.occurred_at||""))||0,gap=t.at&&at?Math.abs(t.at-at):Infinity;if(gap<=5*60000)s+=100;else if(gap<=60*60000)s+=60;else if(gap<=24*3600000)s+=15;if(s>score){score=s;best={...r,body}}}return score>=180?best:null}
async function ensureCommentBody(article:HTMLElement){
  if(!article.classList.contains("mumei-comment-open"))return;let box=article.querySelector<HTMLElement>(".mumei-comment-body");if(!box){box=document.createElement("div");box.className="mumei-comment-body";article.querySelector(".minf-main")?.insertAdjacentElement("afterend",box)}if(!box)return;if(box.dataset.v14Loaded==="1"||box.dataset.v14Loading==="1")return;box.dataset.v14Loading="1";box.innerHTML="<b>コメント本文</b><p>本文を取得中…</p>";const t=commentTarget(article);try{const cached=bestCached(t);let body=clean(cached?.body);let source="通知feedの保存本文";if(!body){const day=jstDay(article.querySelector("time")?.textContent||""),rows=day?await loadCommentWindow(day):[],hit=bestApi(t,rows);body=clean(hit?.body);source="通常コメント履歴から照合"}if(body){box.innerHTML="";const b=document.createElement("b"),p=document.createElement("p"),small=document.createElement("small");b.textContent=/返信/.test(t.type)?"返信本文":"コメント本文";p.textContent=body;small.textContent=source;box.append(b,p,small)}else{const fallback=clean(article.querySelector(".minf-main small")?.textContent||"");box.innerHTML="";const b=document.createElement("b"),p=document.createElement("p"),small=document.createElement("small");b.textContent=/返信/.test(t.type)?"返信本文":"コメント本文";p.textContent=fallback&&fallback.length>8?fallback:"保存済み本文を特定できませんでした。対象記事から確認できます。";small.textContent=fallback?"通知本文を表示":"本文照合結果なし";box.append(b,p,small)}box.dataset.v14Loaded="1"}finally{delete box.dataset.v14Loading}
}
function bindCommentBody(){if(document.documentElement.dataset.mumeiCommentBodyV14==="1")return;document.documentElement.dataset.mumeiCommentBodyV14="1";document.addEventListener("click",e=>{const target=(e.target as Element|null)?.closest("#minf-notifications .mumei-comment-toggle");if(!target)return;const article=target.closest("article") as HTMLElement|null;if(article)window.setTimeout(()=>void ensureCommentBody(article),60)},true);document.addEventListener("keydown",e=>{const k=e as KeyboardEvent;if(k.key!=="Enter"&&k.key!==" ")return;const target=(e.target as Element|null)?.closest("#minf-notifications .mumei-comment-toggle");if(!target)return;const article=target.closest("article") as HTMLElement|null;if(article)window.setTimeout(()=>void ensureCommentBody(article),60)},true)}

function run(){installStyle();paintFeatureBadges();ensurePublicProxy();paintPublicProxy();applyCategoryOrder();bindCategoryReorder();bindCommentBody();requestAnimationFrame(shrinkLauncher)}
function schedule(ms=100){window.clearTimeout(timer);timer=window.setTimeout(run,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule(120)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","aria-busy"]});
window.addEventListener("resize",()=>schedule(40));window.addEventListener("pageshow",()=>schedule(40));
