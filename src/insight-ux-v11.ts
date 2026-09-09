const UX_STYLE_ID="mumei-insight-ux-v11-style";
const CAT_ORDER_KEY="mumei-notification-category-order-v11";
const ANALYSIS_SCOPE_KEY="mumei-analysis-scope-v11";
const COMMENT_LABELS=new Set(["コメント♡","コメント","自分の記事返信","相手の記事返信","掲示板返信"]);
let uxTimer=0;
let holdTimer=0;
let movingLabel="";
let swallowLongClick=false;

function installUxStyle(){
  if(document.getElementById(UX_STYLE_ID))return;
  const s=document.createElement("style");s.id=UX_STYLE_ID;s.textContent=`
/* top source frame */
.miv5-update{border:1px solid #29465d!important;border-radius:16px!important;background:linear-gradient(180deg,#0a1722,#071019)!important;padding:5px!important;margin:3px auto 2px!important;box-shadow:inset 0 0 0 1px rgba(116,222,255,.025)}
.miv5-source-grid{gap:4px!important}.miv5-source-card{min-height:76px!important}.miv5-source-main{padding:7px 8px!important;min-height:43px!important}.miv5-source-main b{font-size:13px!important}.miv5-source-main small{font-size:8.6px!important}.miv5-install-link{min-height:26px!important;font-size:8.5px!important;margin:2px 4px 4px!important}.micmp{margin-top:2px!important}
/* notification header */
.minf{padding:8px!important;margin-top:5px!important}.minf-head{display:grid!important;grid-template-columns:1fr!important;gap:4px!important;padding-bottom:4px!important}.minf-head>div:first-child{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:2px 7px}.minf-head small{font-size:10px!important;letter-spacing:.11em}.mumei-history-frequency{font-size:8.4px;color:#8bdff3;border:1px solid #315a6a;border-radius:999px;padding:2px 7px;letter-spacing:0;white-space:nowrap}.minf-head h2{grid-column:1/-1;display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:27px!important;margin:0!important}.mumei-notification-updated{font-size:9px;color:#b7eec6;font-weight:850;white-space:nowrap}.minf-head p,.minf-compact-status{display:none!important}.minf-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:4px!important;width:100%!important;position:relative}.minf-actions>a,.minf-actions>.minf-state{min-width:0!important;min-height:35px!important;margin:0!important;border-radius:10px!important}.minf-actions>a{display:flex!important;align-items:center!important;justify-content:center!important;padding:5px!important;font-size:10px!important}.minf-actions>.minf-state{display:block!important;padding:0!important;border:1px solid #3b5a70!important;background:#0e1d2a!important}.minf-actions>.minf-state>summary{min-height:33px!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:4px!important;font-size:9.6px!important;list-style:none!important}.minf-actions>.minf-state>summary::-webkit-details-marker{display:none}.minf-actions>.minf-state>div{position:absolute;z-index:30;left:0;right:0;top:39px;border:1px solid #35546a;border-radius:10px;background:#091722;padding:7px;box-shadow:0 8px 24px rgba(0,0,0,.45)}
/* two-row horizontally scrollable category rail */
.minf-tabs{display:grid!important;grid-template-rows:repeat(2,34px)!important;grid-auto-flow:column!important;grid-auto-columns:minmax(88px,auto)!important;gap:4px!important;overflow-x:auto!important;overflow-y:hidden!important;padding:4px 0 5px!important;scroll-snap-type:x proximity}.minf-tabs button{min-width:88px!important;min-height:34px!important;height:34px!important;padding:4px 10px!important;border-radius:10px!important;font-size:10px!important;scroll-snap-align:start}.minf-tabs button:first-child,.minf-tabs button.mumei-all-tab{background:#173c2c!important;border-color:#66d39b!important;color:#e1ffec!important;font-weight:950!important}.minf-tabs button.active{background:#153c51!important;border-color:#63daf7!important;color:#fff!important}.minf-tabs button.mumei-all-tab.active{background:#205d3e!important;border-color:#89f0b8!important;box-shadow:0 0 12px rgba(91,239,154,.18)!important}.mumei-tab-help{margin:1px 0 3px;font-size:8.2px;color:#7695aa}.mumei-tab-help.moving{color:#ffe18c;font-weight:900}.minf-tabs button.mumei-moving{outline:2px solid #ffd85b!important;box-shadow:0 0 12px rgba(255,216,91,.3)!important}
/* comment labels become obvious rectangular disclosure controls */
.minf-meta .mumei-comment-toggle{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:132px!important;min-height:29px!important;padding:4px 10px!important;border:1px solid #5b8ba8!important;border-radius:8px!important;background:#10283a!important;color:#e5f8ff!important;cursor:pointer!important;font-weight:900!important}.minf-meta .mumei-comment-toggle::after{content:' ▾';color:#85e7ff}.minf-list article.mumei-comment-article:not(.mumei-comment-open) .minf-main small{display:none!important}.minf-list article.mumei-comment-open .minf-main small{display:block!important;white-space:normal!important;overflow:visible!important;max-height:none!important}.minf-list article.mumei-comment-open .mumei-comment-toggle::after{content:' ▴'}.minf-list article{padding-top:5px!important;padding-bottom:5px!important}.minf-meta{gap:4px!important;margin-bottom:3px!important}.minf-main{padding-top:3px!important;padding-bottom:3px!important}
/* dashboard analysis scope */
#mumei-analysis-scope{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:4px 0}.mumei-scope-btn{min-height:37px;border:1px solid #35536b;border-radius:10px;background:#0c1b28;color:#d9eefb;font:900 10px/1.2 system-ui;padding:5px}.mumei-scope-btn.active{border-color:#58d7ef;background:#12364a;color:#fff;box-shadow:0 0 10px rgba(88,215,239,.12)}.mumei-scope-note{grid-column:1/-1;margin:0;color:#8ba4b6;font-size:8.5px;line-height:1.35}.mumei-analysis-no-notification article:has(.mia2-people){display:none!important}.mumei-analysis-scope-banner{margin:3px 0 5px;padding:5px 7px;border:1px solid #35526a;border-radius:9px;background:#0a1722;color:#b9d7e8;font-size:9px}.mumei-analysis-scope-banner.with{border-color:#5b7140;background:#111d0d;color:#d9ffc3}
@media(max-width:620px){.miv5-update{width:calc(100% - 8px)!important;padding:4px!important}.miv5-source-card{min-height:72px!important}.miv5-source-main b{font-size:12.5px!important}.minf{padding:7px!important}.minf-tabs{grid-auto-columns:minmax(84px,auto)!important}.minf-tabs button{min-width:84px!important;font-size:9.7px!important}.minf-head h2{font-size:25px!important}.mumei-notification-updated{font-size:8.6px}}
`;document.head.append(s)
}

function clean(v:string|null|undefined){return String(v||"").replace(/\s+/g," ").trim()}
function storedOrder(){try{const x=JSON.parse(localStorage.getItem(CAT_ORDER_KEY)||"[]");return Array.isArray(x)?x.map(clean).filter(Boolean):[]}catch{return[]}}
function saveOrder(labels:string[]){try{localStorage.setItem(CAT_ORDER_KEY,JSON.stringify(labels))}catch{}}
function applyTabOrder(tabs:HTMLElement){
  const buttons=[...tabs.querySelectorAll<HTMLButtonElement>("button")];if(!buttons.length)return;
  const order=storedOrder(),by=new Map(buttons.map(b=>[clean(b.textContent),b])),known=order.filter(x=>by.has(x)),rest=buttons.map(b=>clean(b.textContent)).filter(x=>!known.includes(x)),final=[...known,...rest];
  final.forEach(x=>{const b=by.get(x);if(b)tabs.appendChild(b)});saveOrder(final);
  buttons.forEach(b=>b.classList.toggle("mumei-all-tab",clean(b.textContent)==="すべて"));
}
function bindTabReorder(root:HTMLElement){
  const tabs=root.querySelector<HTMLElement>(".minf-tabs");if(!tabs)return;applyTabOrder(tabs);
  let help=root.querySelector<HTMLElement>(".mumei-tab-help");if(!help){help=document.createElement("div");help.className="mumei-tab-help";help.textContent="項目は長押しで並べ替え → 移動先をタップ";tabs.insertAdjacentElement("beforebegin",help)}
  if(tabs.dataset.mumeiReorderBound==="1")return;tabs.dataset.mumeiReorderBound="1";
  tabs.addEventListener("pointerdown",e=>{const b=(e.target as Element)?.closest("button") as HTMLButtonElement|null;if(!b)return;window.clearTimeout(holdTimer);holdTimer=window.setTimeout(()=>{movingLabel=clean(b.textContent);swallowLongClick=true;b.classList.add("mumei-moving");help!.textContent=`「${movingLabel}」を移動中・置きたい位置をタップ`;help!.classList.add("moving");try{navigator.vibrate?.(18)}catch{}},580)});
  const cancel=()=>window.clearTimeout(holdTimer);tabs.addEventListener("pointerup",cancel);tabs.addEventListener("pointercancel",cancel);tabs.addEventListener("pointerleave",cancel);
  tabs.addEventListener("click",e=>{const b=(e.target as Element)?.closest("button") as HTMLButtonElement|null;if(!b)return;if(swallowLongClick){swallowLongClick=false;e.preventDefault();e.stopPropagation();return}if(!movingLabel)return;const target=clean(b.textContent);e.preventDefault();e.stopPropagation();if(target!==movingLabel){const labels=[...tabs.querySelectorAll<HTMLButtonElement>("button")].map(x=>clean(x.textContent)),from=labels.indexOf(movingLabel),to=labels.indexOf(target);if(from>=0&&to>=0){labels.splice(from,1);labels.splice(to,0,movingLabel);saveOrder(labels);applyTabOrder(tabs)}}tabs.querySelectorAll(".mumei-moving").forEach(x=>x.classList.remove("mumei-moving"));movingLabel="";help!.textContent="項目は長押しで並べ替え → 移動先をタップ";help!.classList.remove("moving")},true)
}

function enhanceNotification(){
  const root=document.querySelector<HTMLElement>("#minf-notifications");if(!root)return;
  const head=root.querySelector<HTMLElement>(".minf-head"),title=head?.querySelector<HTMLHeadingElement>("h2"),kicker=head?.querySelector<HTMLElement>("small"),compact=head?.querySelector<HTMLElement>(".minf-compact-status"),actions=head?.querySelector<HTMLElement>(".minf-actions"),state=root.querySelector<HTMLElement>(".minf-state");
  if(kicker&&!kicker.querySelector(".mumei-history-frequency")){const f=document.createElement("b");f.className="mumei-history-frequency";f.textContent="自動反映 3秒";kicker.append(" ",f)}
  if(title){let u=title.querySelector<HTMLElement>(".mumei-notification-updated");if(!u){u=document.createElement("span");u.className="mumei-notification-updated";title.appendChild(u)}const strong=compact?.querySelector("strong");u.textContent=strong?`更新 ${clean(strong.textContent)}`:"更新確認中"}
  if(actions&&state&&state.parentElement!==actions)actions.appendChild(state);
  bindTabReorder(root);
  root.querySelectorAll<HTMLElement>(".minf-list article").forEach(article=>{const badge=article.querySelector<HTMLElement>(".minf-meta span");if(!badge)return;const label=clean(badge.textContent);const isComment=COMMENT_LABELS.has(label);article.classList.toggle("mumei-comment-article",isComment);if(!isComment)return;badge.classList.add("mumei-comment-toggle");badge.setAttribute("role","button");badge.setAttribute("tabindex","0");badge.setAttribute("aria-label",`${label}の内容を開閉`);if(badge.dataset.mumeiCommentBound!=="1"){badge.dataset.mumeiCommentBound="1";const toggle=(e:Event)=>{e.preventDefault();e.stopPropagation();article.classList.toggle("mumei-comment-open")};badge.addEventListener("click",toggle);badge.addEventListener("keydown",e=>{if((e as KeyboardEvent).key==="Enter"||(e as KeyboardEvent).key===" ")toggle(e)})}})
}

function analysisScope(){return sessionStorage.getItem(ANALYSIS_SCOPE_KEY)==="with"?"with":"base"}
function setAnalysisScope(scope:"base"|"with"){
  sessionStorage.setItem(ANALYSIS_SCOPE_KEY,scope);paintAnalysisScope();const refresh=[...document.querySelectorAll<HTMLButtonElement>(".mia2 button")].find(b=>/再分析|分析中/.test(clean(b.textContent)));if(refresh&&!refresh.disabled)refresh.click()
}
function paintAnalysisScope(){
  const root=document.querySelector<HTMLElement>(".mia2");if(!root)return;const scope=analysisScope();root.classList.toggle("mumei-analysis-no-notification",scope==="base");root.classList.toggle("mumei-analysis-with-notification",scope==="with");
  let banner=root.querySelector<HTMLElement>(".mumei-analysis-scope-banner");if(!banner){banner=document.createElement("div");banner.className="mumei-analysis-scope-banner";root.querySelector(".mia2-hero")?.insertAdjacentElement("afterend",banner)}banner.classList.toggle("with",scope==="with");banner.textContent=scope==="with"?"分析範囲：通常データ＋公式ダッシュボード＋本人通知の補完":"分析範囲：通常データ＋公式ダッシュボード（本人通知なしでも利用できます）";
  document.querySelectorAll<HTMLButtonElement>("#mumei-analysis-scope .mumei-scope-btn").forEach(b=>b.classList.toggle("active",b.dataset.scope===scope))
}
function enhanceDashboardScope(){
  const tools=document.querySelector<HTMLElement>(".miv5-dashboard-tools");if(!tools)return;
  let wrap=tools.querySelector<HTMLElement>("#mumei-analysis-scope");if(!wrap){wrap=document.createElement("div");wrap.id="mumei-analysis-scope";wrap.innerHTML=`<button type="button" class="mumei-scope-btn" data-scope="base">📊 通常＋ダッシュボード</button><button type="button" class="mumei-scope-btn" data-scope="with">🔔 本人通知も含める</button><p class="mumei-scope-note">本人通知を入れなくても公式値・記事・PV・流入・売上など利用可能。導入済みなら通知由来の補完だけ追加できます。</p>`;tools.prepend(wrap);wrap.querySelectorAll<HTMLButtonElement>("button").forEach(b=>b.addEventListener("click",()=>setAnalysisScope(b.dataset.scope==="with"?"with":"base")))}paintAnalysisScope()
}

/* Analytics asks FEED only for comment_like. In base scope, analysis deliberately receives an empty notification supplement. Other INSIGHT notification pages are untouched. */
const nativeFetch=window.fetch.bind(window);
window.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  try{const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;const body=typeof init?.body==="string"?init.body:"";if(analysisScope()==="base"&&history.state?.insightMode==="analysis"&&url.includes("insight-notification-feed-final")&&body.includes('"kind":"comment_like"'))return new Response(JSON.stringify({ok:true,rows:[],total:0,noteId:"",lastUpdatedAt:null,lastSyncAt:null}),{status:200,headers:{"Content-Type":"application/json"}})}catch{}return nativeFetch(input as any,init)
}) as typeof window.fetch;

function runUx(){installUxStyle();enhanceNotification();enhanceDashboardScope()}
function scheduleUx(delay=120){window.clearTimeout(uxTimer);uxTimer=window.setTimeout(runUx,delay)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>scheduleUx(0),{once:true});else scheduleUx(0);
new MutationObserver(()=>scheduleUx(120)).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener("pageshow",()=>scheduleUx(60));
