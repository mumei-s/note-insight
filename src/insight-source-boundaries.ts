const MEMBER="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-api";
const RELATIONS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-relations";
const TOKEN_KEY="mumei-insight-access-token";
const PANEL_ID="mumei-data-source-boundaries";
const STYLE_ID="mumei-data-source-boundaries-style";
let normalBusy=false;
let graphsOpen=false;
let runTimer=0;
let lastRun=0;

function token(){return localStorage.getItem(TOKEN_KEY)||""}
async function post(endpoint:string,action:string,extra:Record<string,unknown>={},timeout=120000){
  const t=token();if(!t)throw new Error("INSIGHT_LOGIN_REQUIRED");
  const c=new AbortController(),timer=window.setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":t},body:JSON.stringify({action,...extra}),cache:"no-store",signal:c.signal});
    const p=await r.json().catch(()=>({}));if(!r.ok||p?.ok===false)throw new Error(p?.error||"INSIGHT_API_ERROR");return p;
  }finally{window.clearTimeout(timer)}
}
function now(){return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date())}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`
#${PANEL_ID}{margin:7px 0 9px;border:1px solid #29485d;border-radius:14px;background:linear-gradient(145deg,#091923,#07131c);padding:8px;color:#eaf7ff}
#${PANEL_ID} .msb-title{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px}#${PANEL_ID} .msb-title b{font-size:11px;color:#9fefff;white-space:nowrap}#${PANEL_ID} .msb-title small{font-size:7.5px;color:#7891a4;white-space:nowrap}
#${PANEL_ID} .msb-routes{display:grid;gap:5px}#${PANEL_ID} details{border:1px solid #29475b;border-radius:10px;background:#081722;overflow:hidden}#${PANEL_ID} details.normal{border-color:#376954;background:#091d18}#${PANEL_ID} details.notice{border-color:#665737;background:#20190d}#${PANEL_ID} details.dashboard{border-color:#36566d;background:#08151f}
#${PANEL_ID} summary{list-style:none;min-height:39px;padding:6px 8px;display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none}#${PANEL_ID} summary::-webkit-details-marker{display:none}#${PANEL_ID} summary:after{content:'›';margin-left:auto;color:#7390a3;font-size:17px;line-height:1;transform:rotate(0deg);transition:transform .15s ease}#${PANEL_ID} details[open]>summary:after{transform:rotate(90deg)}#${PANEL_ID} summary .msb-copy{display:grid;gap:1px;min-width:0}#${PANEL_ID} summary strong{font-size:10px;line-height:1.2}#${PANEL_ID} .normal summary strong{color:#aaffcc}#${PANEL_ID} .notice summary strong{color:#ffe6a6}#${PANEL_ID} .dashboard summary strong{color:#bdefff}#${PANEL_ID} summary small{font-size:7.5px;color:#8ea3b2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${PANEL_ID} .msb-body{padding:0 8px 8px;color:#91a7b7;font-size:8px;line-height:1.5}#${PANEL_ID} .msb-chips{display:flex;flex-wrap:wrap;gap:4px}#${PANEL_ID} .msb-chips span{border:1px solid #304d61;border-radius:999px;padding:3px 6px;background:#0b1c28;color:#c8dce9;font-size:7px;font-weight:800}#${PANEL_ID} .normal .msb-chips span{border-color:#315d4b}#${PANEL_ID} .notice .msb-chips span{border-color:#65542d}
#${PANEL_ID} #mumei-normal-data-refresh{margin-left:auto;min-width:90px;min-height:30px;border:1px solid #5cdbb1;border-radius:8px;background:#0e4939;color:#eafff5;font-weight:950;font-size:8px;padding:0 8px;flex:0 0 auto}#${PANEL_ID} #mumei-normal-data-refresh:disabled{opacity:.55}#${PANEL_ID} .msb-status{min-height:20px;margin-top:5px;padding:0 3px;display:flex;align-items:center;color:#7f98aa;font-size:7.5px;line-height:1.3}
.miv5-update .app-update:not(.update-ready){background:#102131!important;border-color:#3b5a74!important;color:#cceaff!important;box-shadow:none!important}.miv5-update .app-update:not(.update-ready) small{color:#7d9ab0!important}.miv5-update .app-update:not(.update-ready) strong{font-size:10px!important}.miv5-version-status{grid-template-columns:repeat(2,minmax(0,1fr))!important;overflow:visible!important}.miv5-version-status>.mumei-app-version-duplicate{display:none!important}
.miv5-data-warning.mumei-warning-folded{display:block!important;cursor:pointer;padding:8px 10px!important}.miv5-data-warning.mumei-warning-folded>b{display:block!important;font-size:10px!important;white-space:normal!important}.miv5-data-warning.mumei-warning-folded>b:after{content:'　詳細を見る ▾';font-size:8px;color:#bfae82;font-weight:800}.miv5-data-warning.mumei-warning-folded>span,.miv5-data-warning.mumei-warning-folded>strong,.miv5-data-warning.mumei-warning-folded>small{display:none!important}.miv5-data-warning.mumei-warning-folded.is-open>b:after{content:'　閉じる ▴'}.miv5-data-warning.mumei-warning-folded.is-open>span,.miv5-data-warning.mumei-warning-folded.is-open>strong,.miv5-data-warning.mumei-warning-folded.is-open>small{display:block!important;margin-top:4px}
.mia2 .mia2-tabs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;overflow:visible!important}.mia2 .mia2-tabs button{width:100%!important;min-width:0!important;padding:0 7px!important;font-size:10px!important}.mia2 .mia2-tabs:after{content:'全項目を2段表示・横スライド不要';grid-column:1/-1;color:#6f899b;font-size:7px;text-align:right;padding-right:2px}
#mumei-analysis-graph-toggle{width:100%;min-height:36px;margin:2px 0 8px;border:1px solid #35576d;border-radius:10px;background:#0a1d29;color:#cdefff;font:900 9px/1 system-ui}#mumei-analysis-graph-toggle[hidden]{display:none!important}.mia2.mumei-overview-graphs-collapsed>.mia2-panel.mia2-wave,.mia2.mumei-overview-graphs-collapsed>.mia2-grid{display:none!important}
@media(max-width:560px){#${PANEL_ID}{padding:7px;margin-top:6px}#${PANEL_ID} .msb-title small{display:none}#${PANEL_ID} summary{min-height:37px;padding:5px 7px}#${PANEL_ID} #mumei-normal-data-refresh{min-height:29px;min-width:82px;padding:0 7px}.miv5-update>div:first-child>small{display:none!important}.miv5-version-status{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important}.miv5-version-status>div{min-width:0!important;flex:none!important}.mia2 .mia2-tabs button{font-size:9px!important;min-height:36px!important}}
`;document.head.append(s)
}
function sourcePanel(){
  const section=document.createElement("section");section.id=PANEL_ID;section.setAttribute("aria-label","データ取得経路");section.innerHTML=`<div class="msb-title"><b>DATA SOURCE｜取得経路</b><small>通常 / 本人通知 / Dashboard</small></div><div class="msb-routes"><details class="normal"><summary><span class="msb-copy"><strong>✓ 通常データ</strong><small>自動更新あり・本人通知ツール不要</small></span><button type="button" id="mumei-normal-data-refresh">↻ データ更新</button></summary><div class="msb-body"><div class="msb-chips"><span>公開記事</span><span>スキ</span><span>コメント</span><span>お気に入り</span><span>フォロー</span><span>フォロワー</span><span>フォロワー推移</span><span>公開プロフィール</span><span>保存済Dashboard分析</span></div></div></details><details class="notice"><summary><span class="msb-copy"><strong>🔔 本人通知で追加取得</strong><small>通知欄にしかない履歴・補完だけ</small></span></summary><div class="msb-body"><div class="msb-chips"><span>通知履歴</span><span>メンシプ参加</span><span>メンシプ反応</span><span>掲示板返信</span><span>通知由来の補完</span><span>前回保存位置からの差分</span></div></div></details><details class="dashboard"><summary><span class="msb-copy"><strong>📊 公式Dashboard</strong><small>新しい公式値だけ本人画面から同期</small></span></summary><div class="msb-body">「Dashboard読み込み」で同期します。本人通知とは別経路です。同期済みDashboardの分析は通常データ側で再表示できます。</div></details></div><div class="msb-status" id="mumei-normal-data-status">自動更新中。必要な時だけ「データ更新」。</div>`;
  section.querySelector<HTMLButtonElement>("#mumei-normal-data-refresh")?.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();void normalRefresh(section)});return section
}
async function normalRefresh(section:HTMLElement){
  if(normalBusy)return;normalBusy=true;const b=section.querySelector<HTMLButtonElement>("#mumei-normal-data-refresh"),st=section.querySelector<HTMLElement>("#mumei-normal-data-status");if(b){b.disabled=true;b.textContent="更新中…"}if(st)st.textContent="公開データ＋フォロー関係を更新中…";
  try{
    const [pub,rels]=await Promise.all([post(MEMBER,"sync",{},90000),Promise.allSettled([post(RELATIONS,"sync",{direction:"followers"}),post(RELATIONS,"sync",{direction:"followings"})])]);
    const relationOk=rels.some(x=>x.status==="fulfilled");localStorage.setItem("mumei-normal-data-last-refresh",String(Date.now()));if(st)st.textContent=`✓ データ更新完了 ${now()}｜記事確認 ${Number(pub?.scannedArticles||0).toLocaleString()}件${relationOk?"・フォロー関係更新済":"・フォロー関係は次回再試行"}`;
    window.dispatchEvent(new Event("mumei-normal-data-refreshed"));window.setTimeout(()=>window.location.reload(),850);
  }catch(e){if(st)st.textContent=`⚠ データ更新エラー：${e instanceof Error?e.message:"一時エラー"}`}
  finally{normalBusy=false;if(b){b.disabled=false;b.textContent="↻ データ更新"}}
}
function enhanceSourcePanel(){
  if(!location.hash.includes("dashboard")&&!location.hash.includes("owner-insight"))return;
  const anchor=document.querySelector<HTMLElement>(".miv5-update");if(!anchor||document.getElementById(PANEL_ID))return;anchor.insertAdjacentElement("afterend",sourcePanel())
}
function enhanceTopChrome(){
  const appButton=document.querySelector<HTMLButtonElement>(".miv5-update .app-update");if(appButton&&!appButton.classList.contains("update-ready")){const strong=appButton.querySelector("strong");if(strong&&strong.textContent!=="本体最新版")strong.textContent="本体最新版"}
  const version=document.querySelector<HTMLElement>(".miv5-version-status");const first=version?.firstElementChild as HTMLElement|null;if(first&&!first.classList.contains("mumei-app-version-duplicate"))first.classList.add("mumei-app-version-duplicate")
  const warning=document.querySelector<HTMLElement>(".miv5-data-warning");if(warning&&!warning.dataset.mumeiFolded){warning.dataset.mumeiFolded="1";warning.classList.add("mumei-warning-folded");warning.setAttribute("aria-expanded","false");warning.addEventListener("click",e=>{if((e.target as HTMLElement)?.closest("a,button"))return;const open=warning.classList.toggle("is-open");warning.setAttribute("aria-expanded",open?"true":"false")})}
}
function enhanceAnalysis(){
  const root=document.querySelector<HTMLElement>(".mia2");if(!root)return;const tabs=root.querySelector<HTMLElement>(".mia2-tabs");if(!tabs)return;
  let toggle=document.getElementById("mumei-analysis-graph-toggle") as HTMLButtonElement|null;if(!toggle){toggle=document.createElement("button");toggle.id="mumei-analysis-graph-toggle";tabs.insertAdjacentElement("afterend",toggle);toggle.addEventListener("click",()=>{graphsOpen=!graphsOpen;paintAnalysis(root,toggle!)})}paintAnalysis(root,toggle)
}
function paintAnalysis(root:HTMLElement,toggle:HTMLButtonElement){
  const active=[...root.querySelectorAll<HTMLButtonElement>(".mia2-tabs button")].find(b=>b.classList.contains("active"));const overview=active?.textContent?.trim()==="総合";toggle.hidden=!overview;if(!overview){root.classList.remove("mumei-overview-graphs-collapsed");return}root.classList.toggle("mumei-overview-graphs-collapsed",!graphsOpen);const label=graphsOpen?"▲ 詳細分析グラフを閉じる":"▼ 詳細分析グラフを開く（流入・波形・星図）";if(toggle.textContent!==label)toggle.textContent=label
}
function run(){lastRun=Date.now();installStyle();enhanceSourcePanel();enhanceTopChrome();enhanceAnalysis()}
function scheduleRun(delay=180){
  if(runTimer)window.clearTimeout(runTimer);
  const elapsed=Date.now()-lastRun;
  runTimer=window.setTimeout(()=>{runTimer=0;run()},Math.max(delay,elapsed<250?250-elapsed:0));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>scheduleRun(0),{once:true});else scheduleRun(0);
const observer=new MutationObserver(()=>scheduleRun(220));observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener("hashchange",()=>scheduleRun(80));window.addEventListener("pageshow",()=>scheduleRun(80));