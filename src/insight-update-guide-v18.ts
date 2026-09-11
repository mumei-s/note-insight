export {};

const PANEL_ID="mumei-insight-update-guide-v18";
const STYLE_ID="mumei-insight-update-guide-v18-style";
let timer=0;

function text(v:unknown){return String(v||"").replace(/\s+/g," ").trim()}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");
  s.id=STYLE_ID;
  s.textContent=`
#${PANEL_ID}{width:calc(100% - 8px);margin:4px auto 6px;padding:7px;border:1px solid #806a32;border-radius:12px;background:linear-gradient(135deg,#201708,#101722);color:#f8fbff;box-sizing:border-box}
#${PANEL_ID} .mug-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px}
#${PANEL_ID} .mug-head b{font-size:11px;color:#ffe6a0}#${PANEL_ID} .mug-head small{font-size:7px;color:#a7b8c8;text-align:right}
#${PANEL_ID} .mug-items{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
#${PANEL_ID} .mug-item{min-width:0;border:1px solid #3b5266;border-radius:9px;background:#0b1620;padding:5px;display:grid;grid-template-rows:auto auto 1fr auto;gap:2px}
#${PANEL_ID} .mug-item strong{font-size:8.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#${PANEL_ID} .mug-item span{font-size:6.6px;line-height:1.25;color:#9eb2c2;min-height:16px}#${PANEL_ID} .mug-item em{font-style:normal;font-size:6.6px;color:#ffe2a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${PANEL_ID} .mug-item button{min-height:24px;border:1px solid #6d7e35;border-radius:7px;background:#b6ff38;color:#071016;font:900 7px/1 system-ui;padding:4px;cursor:pointer}#${PANEL_ID} .mug-item button:disabled{opacity:.5;cursor:default}
@media(max-width:520px){#${PANEL_ID}{padding:6px}#${PANEL_ID} .mug-items{gap:3px}#${PANEL_ID} .mug-item{padding:4px}#${PANEL_ID} .mug-head b{font-size:10px}#${PANEL_ID} .mug-head small{font-size:6.4px}}
`;
  document.head.appendChild(s);
}

function row(kind:"normal"|"notice"|"dashboard"){
  const card=document.querySelector<HTMLElement>(`.miv5-source-card.${kind}`);
  if(!card||!card.classList.contains("needs-update"))return null;
  const small=text(card.querySelector(".miv5-source-main small")?.textContent);
  const label=kind==="normal"?"INSIGHT本体":kind==="notice"?"本人通知":"Dashboard同期";
  const desc=kind==="normal"?"画面・機能本体を最新版へ更新":kind==="notice"?"note通知読取ツールを最新版へ更新":"公式Dashboard同期ツールを最新版へ更新";
  return{kind,label,desc,small};
}

function act(kind:string){
  const card=document.querySelector<HTMLElement>(`.miv5-source-card.${kind}`);
  if(!card)return;
  if(kind==="normal"){
    const b=card.querySelector<HTMLButtonElement>(":scope > .miv5-install-link.update-ready");
    b?.click();return;
  }
  const a=card.querySelector<HTMLAnchorElement>(":scope > .miv5-install-link.mumei-canonical-install");
  if(a?.href){location.assign(a.href);return}
  const back=encodeURIComponent(location.href),role=/note\.com\/ss_yr(?:\/|$)/.test(document.body.innerHTML)?"owner":"member";
  location.assign(kind==="notice"?`./notification-update.html?from=top&role=${role}&return=${back}`:`./dashboard-setup.html?from=top&role=${role}&return=${back}&auto=0`);
}

function paint(){
  installStyle();
  const top=document.querySelector<HTMLElement>(".miv5-update");
  if(!top)return;
  const rows=[row("normal"),row("dashboard"),row("notice")].filter(Boolean) as Array<{kind:string,label:string,desc:string,small:string}>;
  let panel=document.getElementById(PANEL_ID) as HTMLElement|null;
  if(!rows.length){panel?.remove();return}
  if(!panel){panel=document.createElement("section");panel.id=PANEL_ID;panel.setAttribute("role","status");top.insertAdjacentElement("afterend",panel)}
  panel.innerHTML=`<div class="mug-head"><b>⬆ 更新があります</b><small>必要な項目だけ表示｜完了後に自動再確認</small></div><div class="mug-items">${rows.map(r=>`<div class="mug-item" data-kind="${r.kind}"><strong>${r.label}</strong><span>${r.desc}</span><em>${r.small||"最新版を確認してください"}</em><button type="button">更新案内を開く</button></div>`).join("")}</div>`;
  for(const b of panel.querySelectorAll<HTMLButtonElement>("button[data-bound!='1'], .mug-item button")){
    if(b.dataset.bound==="1")continue;b.dataset.bound="1";b.addEventListener("click",()=>{const kind=b.closest<HTMLElement>(".mug-item")?.dataset.kind;if(kind)act(kind)});
  }
}
function schedule(ms=80){window.clearTimeout(timer);timer=window.setTimeout(paint,ms)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule()).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","disabled"]});
window.addEventListener("pageshow",()=>schedule(0));window.addEventListener("focus",()=>schedule(0));window.addEventListener("storage",()=>schedule(0));
