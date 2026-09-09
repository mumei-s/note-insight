const PANEL_ID="mumei-data-source-boundaries";
const STYLE_ID="mumei-data-source-boundaries-style";
let graphsOpen=false;
let runTimer=0;
let lastRun=0;

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`
#${PANEL_ID}{margin:6px 0 8px;color:#eaf7ff}
#${PANEL_ID} .msb-attention{border:1px solid #6a592f;border-radius:11px;background:#151209;overflow:hidden}
#${PANEL_ID} .msb-attention summary{list-style:none;min-height:40px;padding:7px 10px;display:flex;align-items:center;gap:7px;cursor:pointer;color:#ffe2a0;font:950 10px/1.2 system-ui}
#${PANEL_ID} .msb-attention summary::-webkit-details-marker{display:none}
#${PANEL_ID} .msb-attention summary:after{content:'›';margin-left:auto;color:#bca46e;font-size:18px;line-height:1;transition:transform .15s ease}
#${PANEL_ID} .msb-attention[open]>summary:after{transform:rotate(90deg)}
#${PANEL_ID} .msb-attention-body{padding:0 9px 9px;display:grid;gap:7px;color:#aeb9c4;font-size:8px;line-height:1.5}
#${PANEL_ID} .msb-explain{display:grid;gap:5px}
#${PANEL_ID} .msb-explain div{padding:6px 7px;border:1px solid #2c3e4c;border-radius:8px;background:#0a151d}
#${PANEL_ID} .msb-explain b{color:#d8edf7}
#${PANEL_ID} .msb-warning{padding:7px;border:1px solid #785f2d;border-radius:8px;background:#1a1509;color:#d8c89f}
#${PANEL_ID} .msb-warning strong{color:#ffd98a}
.miv5-version-status.mumei-versions-relocated,.miv5-data-warning.mumei-warning-relocated{display:none!important}
.mia2 .mia2-tabs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;overflow:visible!important}
.mia2 .mia2-tabs button{width:100%!important;min-width:0!important;padding:0 7px!important;font-size:10px!important}
#mumei-analysis-graph-toggle{width:100%;min-height:36px;margin:2px 0 8px;border:1px solid #35576d;border-radius:10px;background:#0a1d29;color:#cdefff;font:900 9px/1 system-ui}
#mumei-analysis-graph-toggle[hidden]{display:none!important}
.mia2.mumei-overview-graphs-collapsed>.mia2-panel.mia2-wave,.mia2.mumei-overview-graphs-collapsed>.mia2-grid{display:none!important}
@media(max-width:560px){#${PANEL_ID}{margin-top:5px}#${PANEL_ID} .msb-attention summary{min-height:38px;padding:6px 8px}.mia2 .mia2-tabs button{font-size:9px!important;min-height:36px!important}}
`;document.head.append(s)
}
function sourcePanel(){
  const section=document.createElement("section");section.id=PANEL_ID;section.setAttribute("aria-label","注意・説明");section.innerHTML=`<details class="msb-attention" id="mumei-attention"><summary>⚠️ 注意・説明</summary><div class="msb-attention-body"><div class="msb-explain"><div><b>✓ 通常データ：</b>公開記事・スキ・コメント・お気に入り・フォロー／フォロワー・フォロワー推移・公開プロフィールをINSIGHT本体で取得します。本人通知ツールなしでも利用できます。</div><div><b>🔔 本人通知：</b>note通知欄にしかない履歴、メンシプ参加／反応、掲示板返信、通知由来の補完を追加取得します。</div><div><b>📊 公式Dashboard：</b>公式値の分析・記事別PVを表示します。同期ツールのインストール／更新と新しい公式値の読み込みは「公式Dashboard分析」の中から行います。</div><div><b>公開データ確認済み：</b>公開一覧とnote公式総数は分けて扱います。プロフィール非表示・限定公開など公開一覧外の記事があっても、公開一覧の取得完了を不足扱いにはしません。</div></div><div class="msb-warning"><strong>データ精度：</strong>取得条件・ブラウザ・note側表示により欠落・重複・時刻ずれが生じる場合があります。特に本人通知は推定・補完を含むため誤差が大きくなることがあります。重要な確認はnote本体を優先してください。</div></div></details>`;return section
}
function enhanceSourcePanel(){
  if(!location.hash.includes("dashboard")&&!location.hash.includes("owner-insight"))return;
  const anchor=document.querySelector<HTMLElement>(".miv5-update");if(!anchor||document.getElementById(PANEL_ID))return;anchor.insertAdjacentElement("afterend",sourcePanel())
}
function syncRelocated(){
  document.querySelector<HTMLElement>(".miv5-version-status")?.classList.add("mumei-versions-relocated");
  document.querySelector<HTMLElement>(".miv5-data-warning")?.classList.add("mumei-warning-relocated")
}
function enhanceAnalysis(){
  const root=document.querySelector<HTMLElement>(".mia2");if(!root)return;const tabs=root.querySelector<HTMLElement>(".mia2-tabs");if(!tabs)return;
  let toggle=document.getElementById("mumei-analysis-graph-toggle") as HTMLButtonElement|null;if(!toggle){toggle=document.createElement("button");toggle.id="mumei-analysis-graph-toggle";tabs.insertAdjacentElement("afterend",toggle);toggle.addEventListener("click",()=>{graphsOpen=!graphsOpen;paintAnalysis(root,toggle!)})}paintAnalysis(root,toggle)
}
function paintAnalysis(root:HTMLElement,toggle:HTMLButtonElement){
  const active=[...root.querySelectorAll<HTMLButtonElement>(".mia2-tabs button")].find(b=>b.classList.contains("active"));const overview=active?.textContent?.trim()==="総合";toggle.hidden=!overview;if(!overview){root.classList.remove("mumei-overview-graphs-collapsed");return}root.classList.toggle("mumei-overview-graphs-collapsed",!graphsOpen);const label=graphsOpen?"▲ 詳細分析グラフを閉じる":"▼ 詳細分析グラフを開く（流入・波形・星図）";if(toggle.textContent!==label)toggle.textContent=label
}
function run(){lastRun=Date.now();installStyle();enhanceSourcePanel();syncRelocated();enhanceAnalysis()}
function scheduleRun(delay=180){if(runTimer)window.clearTimeout(runTimer);const elapsed=Date.now()-lastRun;runTimer=window.setTimeout(()=>{runTimer=0;run()},Math.max(delay,elapsed<250?250-elapsed:0))}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>scheduleRun(0),{once:true});else scheduleRun(0);
const observer=new MutationObserver(()=>scheduleRun(220));observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener("hashchange",()=>scheduleRun(80));window.addEventListener("pageshow",()=>scheduleRun(80));
