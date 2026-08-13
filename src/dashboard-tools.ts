function basePath(){const p=location.pathname;return p.endsWith("/")?p:p.slice(0,p.lastIndexOf("/")+1)}
function removeFloating(){
 document.querySelectorAll<HTMLElement>("button,a,div").forEach(el=>{
  const text=(el.textContent||"").trim();
  if(!text)return;
  const isOldNotification=/^本人通知\s*(\+|\d|$)/.test(text)&&text.length<28;
  const isOldEvidence=text==="スクショ保存 ＋"||text==="スクショ保存＋";
  if(!isOldNotification&&!isOldEvidence)return;
  let node:HTMLElement|null=el;
  for(let i=0;i<4&&node;i++,node=node.parentElement){
   if(getComputedStyle(node).position==="fixed"){node.style.display="none";break}
  }
 });
 document.getElementById("insight-dashboard-evidence-link")?.remove();
 document.querySelectorAll<HTMLElement>(".evidence-fab").forEach(x=>x.style.display="none");
}
function syncToolbar(){
 const route=location.hash.replace(/^#\/?/,"");
 const id="insight-static-tools";
 const old=document.getElementById(id);
 if(route!=="dashboard"){old?.remove();return}
 removeFloating();
 if(old)return;
 const bar=document.createElement("div");bar.id=id;
 bar.innerHTML=`<div class="insight-static-tools-inner"><strong>INSIGHTツール</strong><a href="${basePath()}notification-setup.html">本人通知を設定</a><a href="#evidence">ダッシュボード資料庫</a></div>`;
 bar.style.cssText="position:relative;z-index:70;background:#080d13;border-bottom:1px solid #243044;padding:9px 12px";
 const style=document.createElement("style");style.textContent="#insight-static-tools .insight-static-tools-inner{width:min(1280px,100%);margin:auto;display:flex;gap:8px;flex-wrap:wrap;align-items:center}#insight-static-tools strong{margin-right:auto;color:#dce7f4}#insight-static-tools a{border:1px solid #33465d;border-radius:999px;padding:8px 12px;color:#dce7f4;text-decoration:none;font-weight:850}#insight-static-tools a:first-of-type{color:#cfff64;border-color:#718b2f}#insight-static-tools a:last-of-type{color:#75e6ff;border-color:#2b7890}";bar.appendChild(style);
 document.body.insertBefore(bar,document.getElementById("root"));
}
if(typeof window!=="undefined"){
 const observer=new MutationObserver(()=>{if(location.hash.replace(/^#\/?/,"")==="dashboard")removeFloating()});
 window.addEventListener("hashchange",()=>setTimeout(syncToolbar,0));
 window.addEventListener("load",()=>{syncToolbar();observer.observe(document.body,{childList:true,subtree:true})});
 setTimeout(syncToolbar,0);
}
