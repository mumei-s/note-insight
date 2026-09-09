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
function esc(v:string){return v.replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]||ch))}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`
#${PANEL_ID}{margin:7px 0 9px;border:1px solid #29485d;border-radius:14px;background:linear-gradient(145deg,#091923,#07131c);padding:8px;color:#eaf7ff}
#${PANEL_ID} .msb-title{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px}#${PANEL_ID} .msb-title b{font-size:11px;color:#9fefff;white-space:nowrap}#${PANEL_ID} .msb-title small{font-size:7.5px;color:#7891a4;white-space:nowrap}
#${PANEL_ID} .msb-routes{display:grid;gap:5px}#${PANEL_ID} .msb-route{min-height:39px;border:1px solid #29475b;border-radius:10px;background:#081722;padding:6px 8px;display:flex;align-items:center;gap:7px;min-width:0}#${PANEL_ID} .msb-route.normal{border-color:#376954;background:#091d18}#${PANEL_ID} .msb-route.notice{border-color:#665737;background:#20190d}#${PANEL_ID} .msb-route.dashboard{border-color:#36566d;background:#08151f}
#${PANEL_ID} .msb-copy{display:grid;gap:1px;min-width:0}#${PANEL_ID} .msb-copy strong{font-size:10px;line-height:1.2}#${PANEL_ID} .normal .msb-copy strong{color:#aaffcc}#${PANEL_ID} .notice .msb-copy strong{color:#ffe6a6}#${PANEL_ID} .dashboard .msb-copy strong{color:#bdefff}#${PANEL_ID} .msb-copy small{font-size:7.5px;color:#8ea3b2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${PANEL_ID} #mumei-normal-data-refresh{margin-left:auto;min-width:90px;min-height:30px;border:1px solid #5cdbb1;border-radius:8px;background:#0e4939;color:#eafff5;font-weight:950;font-size:8px;padding:0 8px;flex:0 0 auto}#${PANEL_ID} #mumei-normal-data-refresh:disabled{opacity:.55}#${PANEL_ID} .msb-status{min-height:20px;margin-top:5px;padding:0 3px;display:flex;align-items:center;color:#7f98aa;font-size:7.5px;line-height:1.3}
#${PANEL_ID} .msb-attention{margin-top:5px;border:1px solid #6a592f;border-radius:10px;background:#151209;overflow:hidden}#${PANEL_ID} .msb-attention summary{list-style:none;min-height:37px;padding:6px 8px;display:flex;align-items:center;gap:7px;cursor:pointer;color:#ffe2a0;font:950 9px/1.2 system-ui}#${PANEL_ID} .msb-attention summary::-webkit-details-marker{display:none}#${PANEL_ID} .msb-attention summary:after{content:'›';margin-left:auto;color:#bca46e;font-size:17px;line-height:1;transition:transform .15s ease}#${PANEL_ID} .msb-attention[open]>summary:after{transform:rotate(90deg)}#${PANEL_ID} .msb-attention.has-update summary{color:#dfff8b}#${PANEL_ID} .msb-attention.has-update summary:before{content:'NEW';padding:2px 5px;border-radius:999px;background:#b6ff38;color:#111a00;font:950 6px/1 system-ui}
#${PANEL_ID} .msb-attention-body{padding:0 8px 8px;display:grid;gap:7px;color:#aeb9c4;font-size:7.8px;line-height:1.5}#${PANEL_ID} .msb-explain{display:grid;gap:4px}#${PANEL_ID} .msb-explain div{padding:5px 6px;border:1px solid #2c3e4c;border-radius:7px;background:#0a151d}#${PANEL_ID} .msb-explain b{color:#d8edf7}#${PANEL_ID} .msb-version-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}#${PANEL_ID} .msb-version-card{min-width:0;padding:6px;border:1px solid #2c4355;border-radius:8px;background:#09151f;display:grid;gap:2px}#${PANEL_ID} .msb-version-card b{font-size:7.5px;color:#a7eaff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#${PANEL_ID} .msb-version-card span,#${PANEL_ID} .msb-version-card small{font-size:7px;color:#9aabbb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#${PANEL_ID} .msb-version-card.needs-update{border-color:#79a84d;background:#14200e}#${PANEL_ID} .msb-version-card.needs-update b{color:#dfff8b}#${PANEL_ID} .msb-warning{padding:6px;border:1px solid #785f2d;border-radius:8px;background:#1a1509;color:#d8c89f}#${PANEL_ID} .msb-warning strong{color:#ffd98a}
.miv5-update .app-update:not(.update-ready){min-height:34px!important;background:transparent!important;border-color:#31485a!important;color:#a8bfd0!important;box-shadow:none!important;pointer-events:none!important}.miv5-update .app-update:not(.update-ready) small{display:none!important}.miv5-update .app-update:not(.update-ready) strong{font-size:9px!important}.miv5-update .app-update.update-ready{background:#b6ff38!important;border-color:#b6ff38!important;color:#101700!important;box-shadow:0 0 22px rgba(182,255,56,.22)!important}
.miv5-version-status.mumei-versions-relocated{display:none!important}.miv5-version-status.mumei-versions-relocated.mumei-dashboard-update-visible{display:grid!important;grid-template-columns:1fr!important}.miv5-version-status.mumei-versions-relocated.mumei-dashboard-update-visible>div{display:none!important}.miv5-version-status.mumei-versions-relocated.mumei-dashboard-update-visible>div.mumei-dashboard-needs-update{display:grid!important}.miv5-data-warning.mumei-warning-relocated{display:none!important}
.mia2 .mia2-tabs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;overflow:visible!important}.mia2 .mia2-tabs button{width:100%!important;min-width:0!important;padding:0 7px!important;font-size:10px!important}.mia2 .mia2-tabs:after{content:'全項目を2段表示・横スライド不要';grid-column:1/-1;color:#6f899b;font-size:7px;text-align:right;padding-right:2px}
#mumei-analysis-graph-toggle{width:100%;min-height:36px;margin:2px 0 8px;border:1px solid #35576d;border-radius:10px;background:#0a1d29;color:#cdefff;font:900 9px/1 system-ui}#mumei-analysis-graph-toggle[hidden]{display:none!important}.mia2.mumei-overview-graphs-collapsed>.mia2-panel.mia2-wave,.mia2.mumei-overview-graphs-collapsed>.mia2-grid{display:none!important}
@media(max-width:560px){#${PANEL_ID}{padding:7px;margin-top:6px}#${PANEL_ID} .msb-title small{display:none}#${PANEL_ID} .msb-route{min-height:37px;padding:5px 7px}#${PANEL_ID} #mumei-normal-data-refresh{min-height:29px;min-width:82px;padding:0 7px}#${PANEL_ID} .msb-version-grid{grid-template-columns:1fr 1fr}.miv5-update>div:first-child>small{display:none!important}.mia2 .mia2-tabs button{font-size:9px!important;min-height:36px!important}}
`;document.head.append(s)
}
function sourcePanel(){
  const section=document.createElement("section");section.id=PANEL_ID;section.setAttribute("aria-label","データ取得経路");section.innerHTML=`<div class="msb-title"><b>DATA SOURCE｜取得経路</b><small>操作だけを常時表示</small></div><div class="msb-routes"><div class="msb-route normal"><span class="msb-copy"><strong>✓ 通常データ</strong><small>公開データを自動更新</small></span><button type="button" id="mumei-normal-data-refresh">↻ データ更新</button></div><div class="msb-route notice"><span class="msb-copy"><strong>🔔 本人通知で追加取得</strong><small>通知欄にしかない履歴・補完</small></span></div><div class="msb-route dashboard"><span class="msb-copy"><strong>📊 公式Dashboard</strong><small>新しい公式値だけ本人画面から同期</small></span></div></div><div class="msb-status" id="mumei-normal-data-status">通常データは自動更新中。必要な時だけ手動更新。</div><details class="msb-attention" id="mumei-attention"><summary>⚠️ 注意・説明</summary><div class="msb-attention-body"><div class="msb-explain"><div><b>✓ 通常データ：</b>公開記事・スキ・コメント・お気に入り・フォロー／フォロワー・フォロワー推移・公開プロフィール・保存済Dashboard分析。</div><div><b>🔔 本人通知：</b>通知履歴・メンシプ参加／反応・掲示板返信・通知由来の補完・前回保存位置からの差分。</div><div><b>📊 公式Dashboard：</b>新しい公式値だけ「Dashboard読み込み」で同期。本人通知とは別経路です。</div></div><div class="msb-version-grid" id="mumei-attention-versions"></div><div class="msb-warning"><strong>データ精度：</strong>取得条件・ブラウザ・note側表示により欠落・重複・時刻ずれが生じる場合があります。特に本人通知は推定・補完を含むため誤差が大きくなることがあります。重要な確認はnote本体を優先してください。</div></div></details>`;
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
function syncAttention(){
  const attention=document.getElementById("mumei-attention"),grid=document.getElementById("mumei-attention-versions");if(!attention||!grid)return;
  const version=document.querySelector<HTMLElement>(".miv5-version-status");
  if(version){
    version.classList.add("mumei-versions-relocated");let anyUpdate=false,dashboardUpdate=false;const cards=[...version.children] as HTMLElement[];
    for(const c of cards){const label=c.querySelector("b")?.textContent?.trim()||"版情報",needs=c.classList.contains("needs-update");anyUpdate ||= needs;const isDashboard=/Dashboard/i.test(label);c.classList.toggle("mumei-dashboard-needs-update",needs&&isDashboard);dashboardUpdate ||= needs&&isDashboard}
    version.classList.toggle("mumei-dashboard-update-visible",dashboardUpdate);
    const html=cards.map(c=>{const label=esc(c.querySelector("b")?.textContent?.trim()||"版情報"),current=esc(c.querySelector("span")?.textContent?.trim()||""),latest=esc(c.querySelector("small")?.textContent?.trim()||""),needs=c.classList.contains("needs-update");return`<div class="msb-version-card${needs?" needs-update":""}"><b>${label}${needs?"・更新あり":""}</b><span>${current}</span><small>${latest}</small></div>`}).join("");if(grid.innerHTML!==html)grid.innerHTML=html;attention.classList.toggle("has-update",anyUpdate)
  }
  const warning=document.querySelector<HTMLElement>(".miv5-data-warning");if(warning)warning.classList.add("mumei-warning-relocated")
}
function enhanceTopChrome(){
  const appButton=document.querySelector<HTMLButtonElement>(".miv5-update .app-update");if(appButton&&!appButton.classList.contains("update-ready")){const strong=appButton.querySelector("strong");if(strong&&strong.textContent!=="本体最新版")strong.textContent="本体最新版"}
  syncAttention()
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