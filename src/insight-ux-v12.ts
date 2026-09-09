export {};
const STYLE_ID="mumei-insight-ux-v12-style";
const COMMENTS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-comment-events";
const TOKEN_KEY="mumei-insight-access-token";
const dayCache=new Map<string,any[]>();
let timer=0;

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement("style");s.id=STYLE_ID;s.textContent=`
.miv5-update{display:block!important;min-height:0!important;height:auto!important;max-height:none!important;aspect-ratio:auto!important;align-content:start!important;overflow:visible!important;padding:4px!important;margin:2px auto 2px!important}
.miv5-source-grid{min-height:0!important;height:auto!important;max-height:none!important;align-items:start!important;align-content:start!important}
.miv5-source-card{min-height:0!important;height:auto!important;max-height:none!important;align-self:start!important}
.miv5-source-main{min-height:48px!important}
.micmp{margin-top:2px!important}
.minf-list article.mumei-comment-article .minf-main small{display:block!important;white-space:normal!important;overflow:visible!important;max-height:none!important}
.mumei-comment-body{display:none;margin:5px 0 0;padding:7px 8px;border:1px solid #42687d;border-radius:9px;background:#081824;color:#dff5ff}
.mumei-comment-open .mumei-comment-body{display:grid;gap:3px}
.mumei-comment-body b{font-size:8px;color:#8feaff}.mumei-comment-body p{margin:0;font-size:9px;line-height:1.5;white-space:pre-wrap}.mumei-comment-body small{font-size:7px;color:#839bab}
.mumei-comment-toggle::after{content:' 本文 ▾'!important}.mumei-comment-open .mumei-comment-toggle::after{content:' 本文 ▴'!important}
@media(max-width:620px){.miv5-update{padding:3px!important;margin-bottom:2px!important}.miv5-source-main{min-height:46px!important}}
`;document.head.appendChild(s)
}

function clean(v:any){return String(v||"").replace(/\s+/g," ").trim()}
function profileId(url:string){try{return new URL(url).pathname.split('/').filter(Boolean)[0]?.toLowerCase()||""}catch{return""}}
function articleKey(url:string){try{const u=new URL(url),p=u.pathname.split('/').filter(Boolean);const i=p.indexOf('n');return i>=0&&p[i+1]?`${p[0]}/${p[i+1]}`:""}catch{return""}}
function jstDay(text:string){const m=text.match(/(\d{4})[\/.年-](\d{1,2})[\/.月-](\d{1,2})/);return m?`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`:""}
function jstDateMs(text:string){const m=text.match(/(\d{4})[\/.年-](\d{1,2})[\/.月-](\d{1,2})[^\d]+(\d{1,2}):(\d{2})/);return m?Date.parse(`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}T${String(m[4]).padStart(2,'0')}:${m[5]}:00+09:00`):0}
async function loadDay(day:string){
  if(dayCache.has(day))return dayCache.get(day)!;
  const token=localStorage.getItem(TOKEN_KEY)||"";if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
  const start=`${day}T00:00:00+09:00`,end=new Date(Date.parse(start)+86400000).toISOString(),first=await fetch(COMMENTS,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify({page:1,pageSize:500,dateFrom:start,dateTo:end}),cache:"no-store"}),p=await first.json().catch(()=>({}));if(!first.ok||p?.ok===false)throw new Error(p?.error||"COMMENT_HISTORY_ERROR");
  const rows=[...(p.rows||[])],pages=Math.min(6,Math.max(1,Math.ceil(Number(p.total||0)/500)));
  for(let page=2;page<=pages;page++){const r=await fetch(COMMENTS,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify({page,pageSize:500,dateFrom:start,dateTo:end}),cache:"no-store"}),x=await r.json().catch(()=>({}));if(r.ok&&x?.ok!==false)rows.push(...(x.rows||[]))}
  dayCache.set(day,rows);return rows
}
function bodyLabel(article:HTMLElement){const t=clean(article.querySelector('.mumei-comment-toggle')?.textContent||'');return/返信|掲示板/.test(t)?'返信本文':'コメント本文'}
function bestComment(article:HTMLElement,rows:any[]){
  const actorUrl=(article.querySelector('.minf-who a[href*="note.com/"]') as HTMLAnchorElement|null)?.href||'',actor=profileId(actorUrl),target=(article.querySelector('.minf-main[href*="/n/"],.minf-target[href*="/n/"]') as HTMLAnchorElement|null)?.href||'',akey=articleKey(target),at=jstDateMs(article.querySelector('time')?.textContent||''),raw=clean(article.querySelector('.minf-main small')?.textContent||'');
  let best:any=null,score=-1;
  for(const r of rows){const body=clean(r.body);if(!body)continue;let s=0;const rid=profileId(String(r.actor_url||'')),rk=articleKey(String(r.article_url||''));if(actor&&rid===actor)s+=45;if(akey&&rk===akey)s+=35;if(raw.includes(body.slice(0,Math.min(18,body.length))))s+=80;const rat=Date.parse(String(r.occurred_at||''))||0,gap=at&&rat?Math.abs(at-rat):Infinity;if(gap<=15*60000)s+=30;else if(gap<=2*3600000)s+=15;if(s>score){score=s;best=r}}
  return score>=65?best:null
}
async function fillBody(article:HTMLElement){
  let box=article.querySelector<HTMLElement>('.mumei-comment-body');if(!box){box=document.createElement('div');box.className='mumei-comment-body';article.querySelector('.minf-main')?.insertAdjacentElement('afterend',box)}
  if(box.dataset.loaded==='1'||box.dataset.loading==='1')return;box.dataset.loading='1';const label=bodyLabel(article);box.innerHTML=`<b>${label}</b><p>本文を照合中…</p>`;
  try{const day=jstDay(article.querySelector('time')?.textContent||''),rows=day?await loadDay(day):[],hit=bestComment(article,rows),body=clean(hit?.body);if(body){box.innerHTML='';const b=document.createElement('b');b.textContent=label;const p=document.createElement('p');p.textContent=body;const small=document.createElement('small');small.textContent='コメント履歴から実本文を照合';box.append(b,p,small)}else{box.innerHTML=`<b>${label}</b><p>保存済みコメント履歴から実本文を特定できませんでした。対象記事を開いて確認してください。</p><small>通知概要は上に常時表示しています。</small>`}box.dataset.loaded='1'}catch{box.innerHTML=`<b>${label}</b><p>実本文を取得できませんでした。対象記事を開いて確認してください。</p><small>コメント履歴との照合に失敗</small>`;box.dataset.loaded='1'}finally{delete box.dataset.loading}
}
function bindComments(){
  document.querySelectorAll<HTMLElement>('#minf-notifications .mumei-comment-toggle').forEach(toggle=>{const article=toggle.closest('article') as HTMLElement|null;if(!article)return;const summary=article.querySelector<HTMLElement>('.minf-main small');summary?.style.setProperty('display','block','important');summary?.style.setProperty('white-space','normal','important');summary?.style.setProperty('overflow','visible','important');summary?.style.setProperty('max-height','none','important');if(toggle.dataset.mumeiBodyBound==='1')return;toggle.dataset.mumeiBodyBound='1';toggle.setAttribute('aria-label',`${clean(toggle.textContent)}の実本文を開閉`);toggle.addEventListener('click',()=>window.setTimeout(()=>{if(article.classList.contains('mumei-comment-open'))void fillBody(article)},30))})
}
function run(){installStyle();bindComments()}
function schedule(ms=120){window.clearTimeout(timer);timer=window.setTimeout(run,ms)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(0),{once:true});else schedule(0);
new MutationObserver(()=>schedule(180)).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('pageshow',()=>schedule(60));
