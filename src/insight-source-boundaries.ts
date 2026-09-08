const MEMBER="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-api";
const RELATIONS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-relations";
const TOKEN_KEY="mumei-insight-access-token";
const PANEL_ID="mumei-data-source-boundaries";
const STYLE_ID="mumei-data-source-boundaries-style";
let normalBusy=false;
let graphsOpen=false;

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
#${PANEL_ID}{margin:10px 0 12px;border:1px solid #29485d;border-radius:16px;background:linear-gradient(145deg,#091923,#07131c);padding:12px;color:#eaf7ff}
#${PANEL_ID} .msb-title{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:9px}#${PANEL_ID} .msb-title b{font-size:12px;color:#9fefff}#${PANEL_ID} .msb-title small{font-size:8px;color:#7891a4}
#${PANEL_ID} .msb-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}#${PANEL_ID} .msb-box{border:1px solid #244258;border-radius:12px;background:#081722;padding:9px;min-width:0}#${PANEL_ID} .msb-box.normal{border-color:#376954;background:#091d18}#${PANEL_ID} .msb-box.notice{border-color:#665737;background:#20190d}
#${PANEL_ID} .msb-box h3{margin:0 0 3px;font-size:12px}#${PANEL_ID} .msb-box.normal h3{color:#aaffcc}#${PANEL_ID} .msb-box.notice h3{color:#ffe6a6}#${PANEL_ID} .msb-box p{margin:0 0 7px;color:#91a7b7;font-size:8px;line-height:1.5}
#${PANEL_ID} .msb-chips{display:flex;flex-wrap:wrap;gap:4px}#${PANEL_ID} .msb-chips span{border:1px solid #304d61;border-radius:999px;padding:3px 6px;background:#0b1c28;color:#c8dce9;font-size:7px;font-weight:800}#${PANEL_ID} .normal .msb-chips span{border-color:#315d4b}#${PANEL_ID} .notice .msb-chips span{border-color:#65542d}
#${PANEL_ID} .msb-actions{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center;margin-top:9px}#${PANEL_ID} button{min-height:40px;border:1px solid #5cdbb1;border-radius:10px;background:#0e4939;color:#eafff5;font-weight:950;font-size:10px;padding:0 11px}#${PANEL_ID} button:disabled{opacity:.55}#${PANEL_ID} .msb-status{font-size:8px;color:#8da4b5;text-align:right;line-height:1.35}
#${PANEL_ID} .msb-dashboard{margin-top:8px;padding:7px 8px;border:1px dashed #36566d;border-radius:9px;background:#08151f;color:#8ea8ba;font-size:8px;line-height:1.55}#${PANEL_ID} .msb-dashboard b{color:#bdefff}
.mia2 .mia2-tabs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;overflow:visible!important}.mia2 .mia2-tabs button{width:100%!important;min-width:0!important;padding:0 7px!important;font-size:10px!important}.mia2 .mia2-tabs:after{content:"全項目を2段表示・横スライド不要";grid-column:1/-1;color:#6f899b;font-size:7px;text-align:right;padding-right:2px}
#mumei-analysis-graph-toggle{width:100%;min-height:36px;margin:2px 0 8px;border:1px solid #35576d;border-radius:10px;background:#0a1d29;color:#cdefff;font:900 9px/1 system-ui}#mumei-analysis-graph-toggle[hidden]{display:none!important}.mia2.mumei-overview-graphs-collapsed>.mia2-panel.mia2-wave,.mia2.mumei-overview-graphs-collapsed>.mia2-grid{display:none!important}
@media(max-width:560px){#${PANEL_ID} .msb-grid{grid-template-columns:1fr}#${PANEL_ID} .msb-actions{grid-template-columns:1fr}#${PANEL_ID} .msb-status{text-align:left}.mia2 .mia2-tabs button{font-size:9px!important;min-height:36px!important}}
`;document.head.append(s)
}
function sourcePanel(){
  const section=document.createElement("section");section.id=PANEL_ID;section.setAttribute("aria-label","データ取得経路");section.innerHTML=`<div class="msb-title"><b>DATA SOURCE｜取得経路を分離</b><small>通常更新と本人通知を混ぜません</small></div><div class="msb-grid"><div class="msb-box normal"><h3>✓ 通常更新（INSIGHT本体）</h3><p>本人通知ツールなしで取得・更新できる範囲。</p><div class="msb-chips"><span>公開記事</span><span>スキ</span><span>コメント</span><span>お気に入り</span><span>フォロー</span><span>フォロワー</span><span>フォロワー推移</span><span>公開プロフィール</span><span>保存済Dashboard分析</span></div></div><div class="msb-box notice"><h3>🔔 本人通知で追加取得</h3><p>note通知欄にしか存在しない履歴・補完だけ。</p><div class="msb-chips"><span>通知履歴</span><span>メンシプ参加</span><span>メンシプ反応</span><span>掲示板返信</span><span>通知由来の補完</span><span>前回保存位置からの差分</span></div></div></div><div class="msb-actions"><button type="button" id="mumei-normal-data-refresh">↻ 通常データを今すぐ更新</button><span class="msb-status" id="mumei-normal-data-status">自動更新あり。必要な時だけ手動更新。</span></div><div class="msb-dashboard"><b>📊 公式Dashboardの新しい値</b>だけは、note本人の公式画面を開く「Dashboard読み込み」で同期します。これは本人通知とは別経路です。同期済みDashboardの分析は通常更新側で再表示できます。</div>`;
  section.querySelector<HTMLButtonElement>("#mumei-normal-data-refresh")?.addEventListener("click",()=>void normalRefresh(section));return section
}
async function normalRefresh(section:HTMLElement){
  if(normalBusy)return;normalBusy=true;const b=section.querySelector<HTMLButtonElement>("#mumei-normal-data-refresh"),st=section.querySelector<HTMLElement>("#mumei-normal-data-status");if(b){b.disabled=true;b.textContent="更新中…"}if(st)st.textContent="公開データ＋フォロー関係を更新中…";
  try{
    const [pub,rels]=await Promise.all([post(MEMBER,"sync",{},90000),Promise.allSettled([post(RELATIONS,"sync",{direction:"followers"}),post(RELATIONS,"sync",{direction:"followings"})])]);
    const relationOk=rels.some(x=>x.status==="fulfilled");localStorage.setItem("mumei-normal-data-last-refresh",String(Date.now()));if(st)st.textContent=`✓ 通常更新完了 ${now()}｜記事確認 ${Number(pub?.scannedArticles||0).toLocaleString()}件${relationOk?"・フォロー関係更新済":"・フォロー関係は次回再試行"}`;
    window.dispatchEvent(new Event("mumei-normal-data-refreshed"));window.setTimeout(()=>window.location.reload(),850);
  }catch(e){if(st)st.textContent=`⚠ 通常更新エラー：${e instanceof Error?e.message:"一時エラー"}`}
  finally{normalBusy=false;if(b){b.disabled=false;b.textContent="↻ 通常データを今すぐ更新"}}
}
function enhanceSourcePanel(){
  if(!location.hash.includes("dashboard")&&!location.hash.includes("owner-insight"))return;
  const anchor=document.querySelector<HTMLElement>(".miv5-update");if(!anchor)return;if(document.getElementById(PANEL_ID))return;anchor.insertAdjacentElement("afterend",sourcePanel())
}
function enhanceAnalysis(){
  const root=document.querySelector<HTMLElement>(".mia2");if(!root)return;const tabs=root.querySelector<HTMLElement>(".mia2-tabs");if(!tabs)return;
  let toggle=document.getElementById("mumei-analysis-graph-toggle") as HTMLButtonElement|null;if(!toggle){toggle=document.createElement("button");toggle.id="mumei-analysis-graph-toggle";tabs.insertAdjacentElement("afterend",toggle);toggle.addEventListener("click",()=>{graphsOpen=!graphsOpen;paintAnalysis(root,toggle!)})}paintAnalysis(root,toggle)
}
function paintAnalysis(root:HTMLElement,toggle:HTMLButtonElement){
  const active=[...root.querySelectorAll<HTMLButtonElement>(".mia2-tabs button")].find(b=>b.classList.contains("active"));const overview=active?.textContent?.trim()==="総合";toggle.hidden=!overview;if(!overview){root.classList.remove("mumei-overview-graphs-collapsed");return}root.classList.toggle("mumei-overview-graphs-collapsed",!graphsOpen);toggle.textContent=graphsOpen?"▲ 詳細分析グラフを閉じる":"▼ 詳細分析グラフを開く（流入・波形・星図）"
}
function run(){installStyle();enhanceSourcePanel();enhanceAnalysis()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});else run();
const observer=new MutationObserver(()=>run());observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]});
window.addEventListener("hashchange",()=>setTimeout(run,30));window.addEventListener("pageshow",()=>setTimeout(run,30));
