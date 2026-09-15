// ==UserScript==
// @name         無名S note INSIGHT 本人通知 V3
// @namespace    https://github.com/mumei-s/note-insight/notification-v3
// @version      3.2.3
// @description  本人通知V3。通知一覧だけに1段4列パネルを表示し、読込・フィルター・INSIGHT連携・ダッシュボード同期を1本に統合。
// @match        https://note.com/*
// @match        https://mumei-s.github.io/note-insight/tool-setup.html*
// @match        https://mumei-s.github.io/note-insight/dashboard-setup.html*
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.deleteValue
// @grant        GM_deleteValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      mumei-s.github.io
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-notification-v3.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-notification-v3.user.js
// ==/UserScript==

(function(){'use strict';
window.__mumeiStartDashboard323=function(){
(() => {
  'use strict';
  if(document.documentElement?.dataset.mumeiDashboardCore318)return;
  if(document.documentElement)document.documentElement.dataset.mumeiDashboardCore318='1';
  const VERSION='1.1.0';
  const TOKEN_API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-import-token';
  const DASH_API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-data';
  const TOKEN_KEY='mumei-dashboard-ingest-token-v1';
  const NOTE_KEY='mumei-dashboard-note-id-v1';
  const CAPTURE=[];
  let panel=null,status=null,busy=false;
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const num=(v)=>{if(v==null)return 0;const s=String(v).replace(/[￥¥円,%\s]/g,'').replace(/,/g,'');const n=Number(s);return Number.isFinite(n)?n:0};
  const text=(v)=>String(v??'').replace(/\s+/g,' ').trim();
  const uniq=(rows,keyFn)=>{const m=new Map();for(const r of rows){const k=keyFn(r);if(k&&!m.has(k))m.set(k,r);else if(k)m.set(k,{...m.get(k),...r})}return [...m.values()]};
  function xhr(url,body,headers={}){return new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:60000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{}if(r.status>=200&&r.status<300&&p?.ok!==false)resolve(p);else reject(new Error(p?.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))}))}
  function cleanUrl(){const u=new URL(location.href);for(const k of ['mumei_dashboard_pair','mumei_dashboard_sync','mumei_dashboard_return'])u.searchParams.delete(k);history.replaceState(history.state,'',u.href)}
  function safeReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
  async function currentNoteId(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=text(u?.urlname||u?.url_name||u?.username).replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?id:''}catch{return''}}
  function captureJson(url,payload){if(!payload||typeof payload!=='object')return;CAPTURE.push({url:String(url||''),payload,at:Date.now()});if(CAPTURE.length>100)CAPTURE.shift()}
  const originalFetch=window.fetch;
  window.fetch=async function(...args){const res=await originalFetch.apply(this,args);try{const url=typeof args[0]==='string'?args[0]:args[0]?.url||'';if(String(url).includes('/api/'))res.clone().json().then(p=>captureJson(url,p)).catch(()=>{})}catch{}return res};
  const XO=XMLHttpRequest.prototype.open,XS=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(method,url,...rest){this.__mumeiUrl=String(url||'');return XO.call(this,method,url,...rest)};
  XMLHttpRequest.prototype.send=function(...args){this.addEventListener('load',()=>{try{if(String(this.__mumeiUrl||'').includes('/api/')&&String(this.responseType||'')!=='blob'){const p=typeof this.response==='object'&&this.response?this.response:JSON.parse(String(this.responseText||'{}'));captureJson(this.__mumeiUrl,p)}}catch{}});return XS.apply(this,args)};
  const aliases={impressions:['impressions','impression','impression_count','impressionCount'],pageViews:['page_views','pageViews','pageview','page_view','page_view_count','pv','read_count','readCount'],likes:['likes','like_count','likeCount','like'],comments:['comments','comment_count','commentCount','comment'],sales:['sales_yen','salesYen','sales_amount','salesAmount','sales','amount','revenue'],shares:['shares','share_count','shareCount','shared_count']};
  const pick=(o,keys)=>{for(const k of keys)if(o&&Object.prototype.hasOwnProperty.call(o,k)&&num(o[k])>=0)return num(o[k]);return 0};
  const titleOf=o=>text(o?.title||o?.name||o?.note_name||o?.noteName||o?.article_title||o?.articleTitle);
  const urlOf=o=>text(o?.url||o?.note_url||o?.noteUrl||o?.permalink);
  const keyOf=o=>text(o?.key||o?.note_key||o?.noteKey||o?.id||urlOf(o));
  const dateOf=o=>{const raw=text(o?.date||o?.day||o?.target_date||o?.targetDate||o?.aggregated_at||o?.aggregatedAt);const m=raw.match(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}/);return m?m[0].replaceAll('/','-').split('-').map((x,i)=>i?x.padStart(2,'0'):x).join('-'):''};
  function walk(value,visit,depth=0){if(depth>10||value==null)return;if(Array.isArray(value)){for(const x of value.slice(0,6000))walk(x,visit,depth+1);return}if(typeof value!=='object')return;visit(value);for(const v of Object.values(value))if(v&&typeof v==='object')walk(v,visit,depth+1)}
  function mergeMetrics(rows){const m=new Map();for(const r of rows){if(!r.date)continue;const old=m.get(r.date)||{date:r.date,impressions:0,pageViews:0,likes:0,comments:0,salesYen:0};m.set(r.date,{date:r.date,impressions:Math.max(num(old.impressions),num(r.impressions)),pageViews:Math.max(num(old.pageViews),num(r.pageViews)),likes:Math.max(num(old.likes),num(r.likes)),comments:Math.max(num(old.comments),num(r.comments)),salesYen:Math.max(num(old.salesYen),num(r.salesYen))})}return[...m.values()].sort((a,b)=>a.date.localeCompare(b.date))}
  function mineNetwork(){const articles=[],sources=[],trafficSeries=[],metricRows=[];for(const cap of CAPTURE){walk(cap.payload,o=>{const title=titleOf(o),url=urlOf(o),key=keyOf(o),pv=pick(o,aliases.pageViews),imp=pick(o,aliases.impressions),likes=pick(o,aliases.likes),comments=pick(o,aliases.comments),sales=pick(o,aliases.sales),shares=pick(o,aliases.shares),date=dateOf(o);if(title&&(url||key)&&(pv||imp||likes||comments||sales||shares)){articles.push({key:key||url,title,url,impressions:imp,pageViews:pv,views:pv,likes,comments,salesYen:sales,shares,status:text(o.status),publishedAt:text(o.published_at||o.publishedAt||o.publish_at),contentType:text(o.content_type||o.contentType||'article')})}if(date&&(pv||imp||likes||comments||sales))metricRows.push({date,impressions:imp,pageViews:pv,likes,comments,salesYen:sales});const source=text(o.referrer||o.referrer_name||o.source||o.domain||o.host);const spv=pick(o,['pv','page_views','pageViews','count','value']);if(source&&spv&&!/^https?:/i.test(source)&&source.length<100){if(date)trafficSeries.push({date,source,pv:spv});else sources.push({source,pv:spv})}})}return{articles:uniq(articles,r=>r.url||r.key||r.title),sources:uniq(sources,r=>r.source.toLowerCase()),trafficSeries,metricSeries:mergeMetrics(metricRows)}}
  function labelledNumber(label,body=document.body?.innerText||''){const rx=new RegExp(`${label}\\s*[：:]?\\s*[￥¥]?([0-9][0-9,]*|-)`,'i'),m=body.match(rx);return m&&m[1]!=='-'?num(m[1]):0}
  function detectTotals(){const body=document.body?.innerText||'';return{impressions:labelledNumber('インプレッション',body),pageViews:labelledNumber('ページビュー',body),likes:labelledNumber('スキ',body),comments:labelledNumber('コメント',body),salesYen:labelledNumber('売上',body)}}
  function detectPeriod(){const body=document.body?.innerText||'',range=body.match(/(20\d{2})[\/.年](\d{1,2})[\/.月](\d{1,2})[^\d]{1,5}(?:〜|~|-)[^\d]*(?:(20\d{2})[\/.年])?(\d{1,2})[\/.月](\d{1,2})/);if(!range)return{periodType:'custom',periodStart:null,periodEnd:null};const year2=range[4]||range[1],pad=x=>String(x).padStart(2,'0');return{periodType:'custom',periodStart:`${range[1]}-${pad(range[2])}-${pad(range[3])}`,periodEnd:`${year2}-${pad(range[5])}-${pad(range[6])}`}}
  function detectCollected(){const m=(document.body?.innerText||'').match(/(20\d{2})[\/.年](\d{1,2})[\/.月](\d{1,2})[^\d]+(\d{1,2}):(\d{2})\s*集計/);if(!m)return null;const p=x=>String(x).padStart(2,'0');return`${m[1]}-${p(m[2])}-${p(m[3])}T${p(m[4])}:${p(m[5])}:00+09:00`}
  function detectTraffic(){const body=document.body?.innerText||'',rows=[];const rx=/(^|\n)\s*([A-Za-z0-9._-]+|X|Facebook|Instagram|no referrer|other)\s+([0-9.]+)%\s*\(([0-9,]+)PV\)/g;let m;while((m=rx.exec(body)))rows.push({source:text(m[2]),percent:num(m[3]),pv:num(m[4])});return uniq(rows,r=>r.source.toLowerCase())}
  function detectSummary(){const body=document.body?.innerText||'',a=body.match(/記事数\s*([0-9,]+)\s*本/),s=body.match(/シェアされた記事\s*([0-9,]+)\s*回/),r=body.match(/収益\s*[￥¥]?\s*([0-9,]+)/);return{articles:a?num(a[1]):0,sharedArticles:s?num(s[1]):0,revenueYen:r?num(r[1]):0}}
  function tableArticles(contentType='article'){const out=[];for(const table of document.querySelectorAll('table')){const headers=[...table.querySelectorAll('thead th')].map(x=>text(x.textContent));if(!headers.some(x=>/タイトル/.test(x)))continue;const idx=(rx)=>headers.findIndex(x=>rx.test(x));const I={title:idx(/タイトル/),imp:idx(/インプレッション/),pv:idx(/ページビュー|PV/),like:idx(/スキ/),comment:idx(/コメント/),sales:idx(/売上/)};for(const tr of table.querySelectorAll('tbody tr')){const cells=[...tr.querySelectorAll('td')];if(!cells.length)continue;const c=i=>i>=0?text(cells[i]?.textContent):'';const a=tr.querySelector('a[href*="/n/"]');const title=c(I.title)||text(a?.textContent);if(!title)continue;const url=a?.href||'';out.push({key:url||title,title,url,impressions:num(c(I.imp)),pageViews:num(c(I.pv)),views:num(c(I.pv)),likes:num(c(I.like)),comments:num(c(I.comment)),salesYen:num(c(I.sales)),contentType,status:/公開中/.test(text(tr.textContent))?'published':'',publishedAt:(text(tr.textContent).match(/20\d{2}年\d{1,2}月\d{1,2}日/)||[])[0]||''})}}return out}
  async function expandAll(){for(let i=0;i<50;i++){const btn=[...document.querySelectorAll('button')].find(b=>/もっとみる|もっと見る/.test(text(b.textContent))&&!b.disabled);if(!btn)break;btn.click();await sleep(260)}}
  async function scanTabs(){const sections={},all=[];const tabs=[['article','記事'],['membership','メンバーシップ'],['magazine','マガジン']];for(const[type,label]of tabs){const candidates=[...document.querySelectorAll('[role="tab"],button,a')].filter(x=>text(x.textContent)===label);const tab=candidates.find(x=>x.closest('main'))||candidates[0];if(tab){try{tab.click()}catch{}await sleep(500);await expandAll()}const rows=tableArticles(type);sections[type]={count:rows.length};all.push(...rows)}return{sections,articles:uniq(all,r=>`${r.contentType}:${r.url||r.key||r.title}`)}}
  async function legacyFallback(){const out=[];for(let page=1;page<=30;page++){try{const r=await originalFetch(`/api/v1/stats/pv?filter=all&page=${page}&sort=pv`,{credentials:'include',cache:'no-store'});if(!r.ok)break;const j=await r.json(),rows=j?.data?.note_stats||j?.data?.notes||[];captureJson(r.url,j);if(!Array.isArray(rows)||!rows.length)break;for(const x of rows)out.push({key:text(x.key||x.id),title:text(x.name||x.title),url:x.key?`https://note.com/${localStorage.getItem(NOTE_KEY)||''}/n/${x.key}`:'',pageViews:num(x.read_count),views:num(x.read_count),likes:num(x.like_count),comments:num(x.comment_count),contentType:'article'});if(rows.length<10)break}catch{break}}return uniq(out,r=>r.key||r.title)}
  function mergeArticles(...lists){const m=new Map();for(const list of lists)for(const r of list||[]){const k=r.url||r.key||`${r.contentType||'article'}:${r.title}`;if(!k)continue;const old=m.get(k)||{};const next={...old,...r};for(const f of ['impressions','pageViews','views','likes','comments','salesYen','shares'])next[f]=Math.max(num(old[f]),num(r[f]));m.set(k,next)}return[...m.values()]}
  async function syncNow(){if(busy)return;busy=true;setStatus('公式ダッシュボードを読込中…');try{const paired=(localStorage.getItem(NOTE_KEY)||'').toLowerCase(),current=await currentNoteId();if(!paired)throw new Error('DASHBOARD_PAIR_REQUIRED');if(!current)throw new Error('NOTE_LOGIN_REQUIRED');if(current!==paired)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${paired}`);await expandAll();const tab=await scanTabs();const mined=mineNetwork(),legacy=await legacyFallback();const articles=mergeArticles(tab.articles,mined.articles,legacy),totals=detectTotals(),traffic=uniq([...detectTraffic(),...mined.sources],r=>String(r.source).toLowerCase()),summary=detectSummary(),period=detectPeriod(),noteId=paired,token=localStorage.getItem(TOKEN_KEY)||'';if(!token)throw new Error('DASHBOARD_PAIR_REQUIRED');if(!articles.length&&!totals.pageViews&&!totals.impressions)throw new Error('DASHBOARD_DATA_NOT_FOUND');const calc={impressions:totals.impressions||articles.reduce((s,r)=>s+num(r.impressions),0),pageViews:totals.pageViews||articles.reduce((s,r)=>s+num(r.pageViews),0),likes:totals.likes||articles.reduce((s,r)=>s+num(r.likes),0),comments:totals.comments||articles.reduce((s,r)=>s+num(r.comments),0),salesYen:totals.salesYen||summary.revenueYen||articles.reduce((s,r)=>s+num(r.salesYen),0)};const payload={action:'ingest',schemaVersion:3,connectorVersion:VERSION,noteId,articles,totals:calc,trafficSources:traffic,trafficSeries:mined.trafficSeries,metricSeries:mined.metricSeries,summary,contentSections:tab.sections,officialCollectedAt:detectCollected(),...period,pages:1};const p=await xhr(DASH_API,payload,{'X-Ingest-Token':token});localStorage.setItem('mumei-dashboard-last-sync',String(Date.now()));setStatus(`✓ @${noteId} 同期完了｜${articles.length}件・PV ${calc.pageViews.toLocaleString()}・売上 ¥${calc.salesYen.toLocaleString()}`,'ok');const q=new URLSearchParams(location.search),back=safeReturn(q.get('mumei_dashboard_return'));if(back){const u=new URL(back);u.searchParams.set('dashboardSync','ok');u.searchParams.set('dashboardVersion',VERSION);u.searchParams.set('dashboardSnapshot',String(p.snapshotId||''));u.searchParams.set('dashboardAt',new Date().toISOString());setTimeout(()=>location.assign(u.href),1400)}}catch(e){setStatus(`⚠ ${e?.message||e}`,'warn')}finally{busy=false}}
  function setStatus(message,kind=''){if(!status)return;status.textContent=message;status.dataset.kind=kind}
  function mount(){if(panel||!document.body)return;panel=document.createElement('div');panel.id='mumei-dashboard-sync';panel.innerHTML=`<style>#mumei-dashboard-sync{position:fixed;z-index:2147483646;left:10px;right:10px;bottom:max(10px,env(safe-area-inset-bottom));font:12px/1.35 system-ui;color:#eaf6ff;background:#07131dec;border:1px solid #4cc9e8;border-radius:14px;padding:7px;box-shadow:0 10px 30px #0008;backdrop-filter:blur(10px)}#mumei-dashboard-sync .row{display:flex;gap:7px;align-items:center}#mumei-dashboard-sync button{border:1px solid #5fd7f0;background:#103048;color:#eafaff;border-radius:10px;font-weight:900;min-height:38px;padding:0 13px;white-space:nowrap}#mumei-dashboard-sync button:first-child{background:#0d5b48;border-color:#55dcb4}#mumei-dashboard-sync .status{min-width:0;flex:1;color:#b9cddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#mumei-dashboard-sync .status[data-kind=ok]{color:#aaffcf}#mumei-dashboard-sync .status[data-kind=warn]{color:#ffd68a}</style><div class="row"><button id="mumei-dash-read">📊 INSIGHT読込</button><button id="mumei-dash-close">×</button><div class="status">ダッシュボード同期 v${VERSION}</div></div>`;document.body.append(panel);status=panel.querySelector('.status');panel.querySelector('#mumei-dash-read').onclick=()=>void syncNow();panel.querySelector('#mumei-dash-close').onclick=()=>{panel.remove();panel=null;status=null}}
  async function pairIfNeeded(){const q=new URLSearchParams(location.search),code=(q.get('mumei_dashboard_pair')||'').replace(/\D/g,'').slice(0,8);if(!code)return false;setStatus('INSIGHTとダッシュボードを連携中…');const p=await xhr(TOKEN_API,{action:'pair-exchange',code}),current=await currentNoteId(),expected=String(p.noteId||'').toLowerCase();if(!current)throw new Error('NOTE_LOGIN_REQUIRED');if(current!==expected)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${expected}`);localStorage.setItem(TOKEN_KEY,p.ingestToken||'');localStorage.setItem(NOTE_KEY,expected);localStorage.setItem('mumei-dashboard-tool-version',VERSION);setStatus(`✓ @${expected} とダッシュボード連携済み`,'ok');return true}
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
(() => {
  'use strict';
  if(document.documentElement?.dataset.mumeiDashboardAdapter318)return;
  if(document.documentElement)document.documentElement.dataset.mumeiDashboardAdapter318='1';
  const VERSION='1.4.4';
  const TOKEN_API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-import-token';
  const TOKEN_KEY='mumei-dashboard-ingest-token-v1';
  const NOTE_KEY='mumei-dashboard-note-id-v1';
  const RETURN_KEY='mumei-dashboard-return-v143';
  const FLOW_KEY='mumei-dashboard-flow-v143';
  const HANDOFF_KEY='mumei-dashboard-handoff-v143';
  const HANDOFF_ID='mumei-dashboard-handoff';
  const HIDE_STYLE_ID='mumei-dashboard-panel-hide-v143';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const modern=()=>Boolean(globalThis.GM);
  const modernRequest=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest.bind(GM):null;
  if(typeof globalThis.GM_xmlhttpRequest!=='function'&&modernRequest){try{globalThis.GM_xmlhttpRequest=opts=>modernRequest(opts)}catch{}}
  async function gmGet(k,d=''){if(modern()&&typeof GM.getValue==='function')return GM.getValue(k,d);if(typeof globalThis.GM_getValue==='function')return globalThis.GM_getValue(k,d);return d}
  async function gmSet(k,v){if(modern()&&typeof GM.setValue==='function')return GM.setValue(k,v);if(typeof globalThis.GM_setValue==='function')return globalThis.GM_setValue(k,v)}
  async function gmDel(k){if(modern()&&typeof GM.deleteValue==='function')return GM.deleteValue(k);if(typeof globalThis.GM_deleteValue==='function')return globalThis.GM_deleteValue(k)}
  function request(body){const fn=modernRequest||(typeof globalThis.GM_xmlhttpRequest==='function'?globalThis.GM_xmlhttpRequest:null);if(fn)return new Promise((resolve,reject)=>fn({method:'POST',url:TOKEN_API,headers:{'Content-Type':'application/json'},data:JSON.stringify(body),timeout:60000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{}if(r.status>=200&&r.status<300&&p?.ok!==false)resolve(p);else reject(new Error(p?.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))}));return fetch(TOKEN_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}).then(async r=>{const p=await r.json().catch(()=>({}));if(!r.ok||p?.ok===false)throw new Error(p?.error||`HTTP_${r.status}`);return p})}
  function safeReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
  function markVersion(){try{localStorage.setItem('mumei-dashboard-tool-version',VERSION)}catch{}}
  function installHideStyle(forceAll=false){if(document.getElementById(HIDE_STYLE_ID))return;const s=document.createElement('style');s.id=HIDE_STYLE_ID;s.textContent=forceAll?'#mumei-dashboard-sync{display:none!important}':'#mumei-dashboard-sync{display:none!important}#mumei-dashboard-sync[data-mumei-recovery="1"]{display:block!important}';(document.head||document.documentElement).appendChild(s)}

  if(location.origin==='https://mumei-s.github.io'){
    installHideStyle(true);markVersion();
    const markBridge=()=>{if(document.documentElement)document.documentElement.setAttribute('data-mumei-dashboard-bridge',VERSION)};
    const cleanup=()=>{document.getElementById('mumei-dashboard-sync')?.remove();markVersion();markBridge()};
    const saveHandoff=async()=>{const el=document.getElementById(HANDOFF_ID),raw=el?.getAttribute('data-payload')||'';if(!raw)return;try{const p=JSON.parse(raw);if(!/^\d{8}$/.test(String(p.code||''))||!/^[a-z0-9_-]+$/i.test(String(p.noteId||'')))throw new Error('HANDOFF_INVALID');p.version=VERSION;p.savedAt=Date.now();await gmSet(HANDOFF_KEY,JSON.stringify(p));document.documentElement?.setAttribute('data-mumei-dashboard-handoff-saved','1');document.dispatchEvent(new Event('mumei-dashboard-handoff-saved'))}catch(e){document.documentElement?.setAttribute('data-mumei-dashboard-handoff-saved','0');document.documentElement?.setAttribute('data-mumei-dashboard-handoff-error',String(e?.message||e));document.dispatchEvent(new Event('mumei-dashboard-handoff-saved'))}};
    markBridge();document.addEventListener('mumei-dashboard-handoff',()=>void saveHandoff());if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cleanup,{once:true});else cleanup();window.addEventListener('pageshow',cleanup);new MutationObserver(cleanup).observe(document.documentElement,{subtree:true,childList:true});return;
  }

  if(location.origin!=='https://note.com')return;
  installHideStyle(false);markVersion();
  async function currentNoteIdV143(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u?.urlname||u?.url_name||u?.username||'').replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?id:''}catch{return''}}
  function panel(){return document.getElementById('mumei-dashboard-sync')}
  function hidePanel(){const p=panel();if(p){p.removeAttribute('data-mumei-recovery');p.style.setProperty('display','none','important');p.setAttribute('aria-hidden','true')}}
  function showPanel(){const p=panel();if(p){p.setAttribute('data-mumei-recovery','1');p.style.setProperty('display','block','important');p.removeAttribute('aria-hidden')}}
  function setCoreStatus(message,kind=''){const s=document.querySelector('#mumei-dashboard-sync .status');if(s){s.textContent=message;s.dataset.kind=kind}}
  function ensureCorePanel(){if(panel()){hidePanel();return true}if(document.readyState!=='loading'){try{window.dispatchEvent(new Event('DOMContentLoaded'))}catch{}}const ok=!!panel();if(ok)hidePanel();return ok}
  function looksダッシュボード(){const p=location.pathname.toLowerCase(),body=(document.body?.innerText||'').slice(0,12000);return p.includes('/sitesettings/stats')||p.includes('/dashboard')||(/アクセス状況/.test(body)&&(/インプレッション|ページビュー|スキ/.test(body)))}
  function directPayload(){const q=new URLSearchParams(location.search),code=String(q.get('mumei_dashboard_pair')||'').replace(/\D/g,'').slice(0,8),noteId=String(q.get('mumei_dashboard_account')||'').replace(/^@/,'').toLowerCase(),returnTo=safeReturn(q.get('mumei_dashboard_return'));if(q.get('mumei_dashboard_sync')!=='1'||!/^\d{8}$/.test(code)||!/^[a-z0-9_-]+$/.test(noteId))return null;return{code,noteId,returnTo}}
  function clearDirectParams(){const u=new URL(location.href);for(const k of ['mumei_dashboard_pair','mumei_dashboard_sync','mumei_dashboard_account','mumei_dashboard_return','mumei_dashboard_tool_version'])u.searchParams.delete(k);history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash)}
  async function pairDirect(){const p=directPayload();if(!p)return false;ensureCorePanel();setCoreStatus('INSIGHTアカウント照合中…');const current=await currentNoteIdV143();if(!current)throw new Error('NOTE_LOGIN_REQUIRED');if(current!==p.noteId)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${p.noteId}`);const x=await request({action:'pair-exchange',code:p.code}),issued=String(x.noteId||'').toLowerCase();if(issued!==current)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${issued}`);localStorage.setItem(TOKEN_KEY,String(x.ingestToken||''));localStorage.setItem(NOTE_KEY,current);if(p.returnTo)localStorage.setItem(RETURN_KEY,p.returnTo);sessionStorage.setItem(FLOW_KEY,'1');markVersion();clearDirectParams();setCoreStatus(`✓ @${current} アカウント一致。公式ダッシュボードを読み込みます`,'ok');return true}
  async function loadPending(){const raw=await gmGet(HANDOFF_KEY,'');if(!raw)return null;try{const p=JSON.parse(String(raw));if(Date.now()-Number(p.savedAt||p.createdAt||0)>15*60*1000){await gmDel(HANDOFF_KEY);return null}return p}catch{await gmDel(HANDOFF_KEY);return null}}
  async function pairPending(){const p=await loadPending();if(!p)return false;ensureCorePanel();setCoreStatus('INSIGHTアカウント照合中…');const current=await currentNoteIdV143(),expected=String(p.noteId||'').toLowerCase();if(!current)throw new Error('NOTE_LOGIN_REQUIRED');if(current!==expected)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${expected}`);const x=await request({action:'pair-exchange',code:String(p.code||'')});const issued=String(x.noteId||'').toLowerCase();if(issued!==current)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${issued}`);localStorage.setItem(TOKEN_KEY,String(x.ingestToken||''));localStorage.setItem(NOTE_KEY,current);markVersion();const back=safeReturn(p.returnTo);if(back)localStorage.setItem(RETURN_KEY,back);sessionStorage.setItem(FLOW_KEY,'1');await gmDel(HANDOFF_KEY);setCoreStatus(`✓ @${current} アカウント一致。公式ダッシュボードを読み込みます`,'ok');return true}
  async function waitPanel(){for(let i=0;i<25;i++){if(ensureCorePanel())return true;await sleep(120)}return false}
  function watchCompletion(){const done=()=>{const s=document.querySelector('#mumei-dashboard-sync .status'),t=s?.textContent||'';if(!/同期完了/.test(t))return false;sessionStorage.removeItem(FLOW_KEY);markVersion();hidePanel();const back=safeReturn(localStorage.getItem(RETURN_KEY)||'');localStorage.removeItem(RETURN_KEY);if(back){const u=new URL(back);u.searchParams.set('dashboardSync','ok');u.searchParams.set('dashboardVersion',VERSION);u.searchParams.set('dashboardAt',new Date().toISOString());setTimeout(()=>location.assign(u.href),350)}return true};if(done())return;const o=new MutationObserver(()=>{hidePanel();if(done())o.disconnect()});o.observe(document.documentElement,{subtree:true,childList:true,characterData:true});setTimeout(()=>o.disconnect(),90000)}
  async function startRead(){if(!await waitPanel())throw new Error('DASHBOARD_TOOL_CORE_NOT_READY');hidePanel();watchCompletion();await sleep(1200);const btn=document.getElementById('mumei-dash-read');if(!btn)throw new Error('DASHBOARD_READ_BUTTON_NOT_FOUND');btn.click();hidePanel()}
  let booting=false;
  async function boot(){
    if(booting)return;booting=true;
    try{
      installHideStyle(false);
      const pairedDirect=await pairDirect();
      const pairedPending=pairedDirect?false:await pairPending();
      const flow=sessionStorage.getItem(FLOW_KEY)==='1';
      if(!pairedDirect&&!pairedPending&&!flow){panel()?.remove();return}
      if(!looksダッシュボード()){setCoreStatus('公式ダッシュボードへ移動中…');if(location.pathname!=='/sitesettings/stats'){location.assign('https://note.com/sitesettings/stats');return}}
      await startRead();
    }catch(e){ensureCorePanel();showPanel();setCoreStatus(`⚠ ${e?.message||e}｜自動読込に失敗した時だけこの復旧パネルを表示します`,'warn')}
  }
  const run=()=>void boot();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();window.addEventListener('pageshow',run);window.addEventListener('popstate',run);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')run()});
})();


};
})();

// bundled component: note-insight-notification-dock-watch-v312.js
(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationDock322)return;window.__mumeiNotificationDock322=true;

const VERSION='3.2.3';
const ROOT='mumei-v3-visible-dock-v322';
const SHELL_ATTR='data-mumei-notice-shell-v3';
const OLD_IDS=['mumei-v2948-frame','mumei-notice-reader-v2963','mumei-v3-panel-clean-v1','mumei-v3-fixed-dock','mumei-v3-notification-launcher','mumei-v3-visible-dock-v321','mumei-v3-notification-frame'];
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const FIL='mumei_insight_magazine_filter_enabled_v3:',GRP='mumei_insight_notification_groups_v1:',MUT='mumei_insight_magazine_mute_ids_v5:';
const FILTER_BASE='https://mumei-s.github.io/note-insight/notification-filter.html';
const INSIGHT='https://mumei-s.github.io/note-insight/notification-entry.html?from=note&insightMode=notifications#dashboard';
const HIDE='mumei-v3-panel-hide-v322';
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const modern=()=>Boolean(globalThis.GM);
let shell=null,lastHref=location.href,intentUntil=0,inspectTimer=0,accountId='',filterLoaded=false,filterOn=false,autoStarted=false,pendingRead=false,readerReady=Boolean(window.__mumeiV3Reader322Ready),readerBusy=false,lastPointerActionAt=0;

async function getValue(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function setValue(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function visible(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1||r.bottom<=0||r.right<=0||r.left>=innerWidth||r.top>=innerHeight)return false;for(let p=el,d=0;p&&d++<14;p=p.parentElement){const s=getComputedStyle(p);if(p.hasAttribute('hidden')||p.getAttribute('aria-hidden')==='true'||p.hasAttribute('inert')||s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)<=.01)return false}return true}
function text(el){return clean(el?.textContent||el?.getAttribute?.('aria-label')||el?.getAttribute?.('title')||el?.getAttribute?.('data-testid')||'')}
function notificationRoute(){return /^\/notifications(?:\/|$)/i.test(location.pathname)}
function messageContext(){const p=location.pathname.toLowerCase();if(/(?:^|\/)(?:messages?|dm|chat|talk|inbox)(?:\/|$)/i.test(p))return true;for(const el of document.querySelectorAll('textarea,[contenteditable="true"]'))if(visible(el)){const h=clean([...document.querySelectorAll('header,h1,h2,[role="banner"]')].slice(0,24).map(x=>x.textContent).join(' '));if(/(?:メッセージ|トーク|チャット)/u.test(h))return true}return false}
function exactTab(root,label){for(const el of root.querySelectorAll?.('button,a,[role="tab"],[role="button"]')||[])if(visible(el)&&new RegExp('^'+label+'(?:\\s*\\d+)?$','u').test(text(el)))return el;return null}
function commonAncestor(a,b){let p=a,d=0;while(p&&p!==document.body&&p!==document.documentElement&&d++<14){if(p.contains(b)&&visible(p))return p;p=p.parentElement}return null}
function plausibleShell(el){if(!visible(el)||el===document.body||el===document.documentElement)return false;const r=el.getBoundingClientRect();return r.width>=180&&r.height>=80&&r.top<Math.max(360,innerHeight*.62)&&r.height<=innerHeight*1.45}
function expandShell(base){let p=base,d=0,best=null;while(p&&p!==document.body&&p!==document.documentElement&&d++<8){if(plausibleShell(p)){best=p;if(p.matches('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notificationList" i],[class*="noticeList" i]'))return p}p=p.parentElement}return best}
function rowCandidate(el){if(!(el instanceof Element)||!visible(el))return false;const t=clean(el.textContent);return t.length>=3&&t.length<=4000}
function rows(root){return root?[...root.querySelectorAll(ITEM)].filter(rowCandidate):[]}
function findShell(){if(document.visibilityState==='hidden'||messageContext())return null;const route=notificationRoute();if(!route&&Date.now()>intentUntil&&!shell)return null;for(const root of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notificationList" i],[class*="noticeList" i],header,nav,main')){if(!visible(root))continue;const a=exactTab(root,'通知'),b=exactTab(root,'お知らせ');if(a&&b){const found=expandShell(commonAncestor(a,b)||root);if(found)return found}}const controls=[...document.querySelectorAll('button,a,[role="tab"],[role="button"]')].filter(visible),ns=controls.filter(x=>/^通知(?:\s*\d+)?$/u.test(text(x))),os=controls.filter(x=>/^お知らせ(?:\s*\d+)?$/u.test(text(x)));for(const a of ns)for(const b of os){const found=expandShell(commonAncestor(a,b));if(found)return found}if(route){for(const el of document.querySelectorAll('main,[role="main"],section'))if(visible(el)&&rows(el).length)return el}if(Date.now()<=intentUntil){for(const el of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],section,aside'))if(plausibleShell(el)&&rows(el).length)return el}return null}
function markShell(next){if(shell&&shell!==next)shell.removeAttribute(SHELL_ATTR);shell=next;if(shell&&shell.getAttribute(SHELL_ATTR)!=='1')shell.setAttribute(SHELL_ATTR,'1')}
function retireOld(){for(const id of OLD_IDS){const el=document.getElementById(id);if(!el)continue;if(id==='mumei-v3-notification-launcher'){el.remove();continue}if(el instanceof HTMLElement){el.style.setProperty('display','none','important');el.style.setProperty('visibility','hidden','important');el.style.setProperty('pointer-events','none','important');el.style.setProperty('width','0px','important');el.style.setProperty('height','0px','important')}}}
function ensureStyle(){if(document.getElementById('mumei-v3-dock-style-v322'))return;const s=document.createElement('style');s.id='mumei-v3-dock-style-v322';s.textContent=`.${HIDE}{display:none!important}#${ROOT}{position:fixed;left:8px;right:8px;bottom:max(10px,calc(env(safe-area-inset-bottom,0px) + 6px));height:34px;z-index:2147483647;display:none;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;padding:3px;border:1px solid #355063;border-radius:8px;background:#0e1c26;box-shadow:0 -3px 10px rgba(0,0,0,.30);font-family:system-ui,-apple-system,sans-serif;pointer-events:auto!important;touch-action:none!important;user-select:none!important}#${ROOT} button{display:flex;align-items:center;justify-content:center;min-width:0;height:25px;margin:0;padding:0 3px;border:1px solid #42667b;border-radius:6px;background:#102737;color:#e3f8ff;font:900 10px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:auto!important;touch-action:none!important;user-select:none!important}#${ROOT} button.on{background:#17422f;border-color:#56a77b}#${ROOT} button.ins{border-color:#55d8f1;background:#11374a}#${ROOT} button.err{border-color:#c95b68;color:#ffd5da}`;(document.head||document.documentElement).appendChild(s)}
function frameHtml(){return '<div class="dock"><button>下から読込</button><button>フィルターOFF</button><button>フィルター設定</button><button>INSIGHT【通知】</button></div>'}
function ensureRoot(){let r=document.getElementById(ROOT);if(r)return r;r=document.createElement('div');r.id=ROOT;r.dataset.mumeiNotificationDock='1';r.setAttribute('role','toolbar');r.setAttribute('aria-label','INSIGHT 本人通知');r.innerHTML='<button type="button" data-act="read">下から読込</button><button type="button" data-act="filter">フィルターOFF</button><button type="button" data-act="settings">フィルター設定</button><button type="button" class="ins" data-act="ins">INSIGHT【通知】</button>';(document.body||document.documentElement).appendChild(r);bindRoot(r);return r}
function uiButton(act){return ensureRoot().querySelector(`[data-act="${act}"]`)}
function showDock(on){const r=ensureRoot();if(r.dataset.open===(on?'1':'0'))return;r.style.setProperty('display',on?'grid':'none','important');r.style.setProperty('pointer-events',on?'auto':'none','important');r.dataset.open=on?'1':'0'}
async function account(){if(accountId)return accountId;try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=clean(u?.urlname||u?.url_name||u?.username).replace(/^@/,'').toLowerCase();if(!/^[a-z0-9_-]+$/.test(id))return'';accountId=id;return id}catch{return''}}
function creatorId(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean),id=(p[0]||'').toLowerCase();return u.hostname.endsWith('note.com')&&p.length===1&&/^[a-z0-9_-]+$/.test(id)&&!['settings','sitesettings','membership','notifications'].includes(id)?id:''}catch{return''}}
function rowCreator(el){for(const a of el.querySelectorAll?.('a[href]')||[]){const id=creatorId(a.getAttribute('href'));if(id)return id}return''}
function magazineNoise(t){const s=clean(t);if(/新しい記事を\s*\d+\s*本追加しました/u.test(s))return true;if(!/(?:マガジン|共同運営|共同マガ|運営メンバー)/u.test(s))return false;return /(?:記事を\s*\d+\s*本追加|追加しました|追加されました|仲間入りしました|運営メンバー)/u.test(s)}
function clearFilter(){for(const el of document.querySelectorAll('.'+HIDE))el.classList.remove(HIDE)}
async function filterIds(){const id=await account();if(!id)return new Set();const gs=await getValue(GRP+id,[]);if(Array.isArray(gs)&&gs.length)return new Set(gs.filter(g=>g?.enabled!==false).flatMap(g=>Array.isArray(g?.ids)?g.ids:Array.isArray(g?.members)?g.members.filter(m=>m?.enabled!==false).map(m=>m.id):[]).map(x=>String(x).toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)));const raw=await getValue(MUT+id,[]);return new Set((Array.isArray(raw)?raw:[]).map(x=>String(x).toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))}
function renderFilter(){const b=uiButton('filter');if(b){const label=filterOn?'フィルターON':'フィルターOFF';if(b.textContent!==label)b.textContent=label;if(b.classList.contains('on')!==filterOn)b.classList.toggle('on',filterOn)}}
async function applyFilter(){clearFilter();renderFilter();if(!filterOn||!shell)return;const ids=await filterIds();if(!ids.size)return;for(const el of rows(shell))if(magazineNoise(el.textContent)&&ids.has(rowCreator(el)))el.classList.add(HIDE)}
async function initFilter(){if(filterLoaded){renderFilter();return}const id=await account();filterOn=id?Boolean(await getValue(FIL+id,false)):false;filterLoaded=true;renderFilter();if(filterOn)await applyFilter()}
async function toggleFilter(){await initFilter();filterOn=!filterOn;const id=await account();if(id)await setValue(FIL+id,filterOn);await applyFilter()}
function b64(v){return btoa(unescape(encodeURIComponent(v))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64(v){try{const raw=String(v||'').replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(String(v||'').length/4)*4,'=');return decodeURIComponent(escape(atob(raw)))}catch{return''}}
function safeInsightReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
async function processFilterCommands(){const q=new URLSearchParams(location.search);if(![...q.keys()].some(k=>/^mumei_(?:groups_sync|filter_reset|filter_export|account|return)$/.test(k)))return;const id=await account();if(!id)return;const expected=clean(q.get('mumei_account')).replace(/^@/,'').toLowerCase();if(expected&&expected!==id)return;if(q.get('mumei_filter_export')==='1'){const back=safeInsightReturn(q.get('mumei_return'));if(back){const groups=await getValue(GRP+id,[]),mutes=await getValue(MUT+id,[]),target=new URL(back);target.searchParams.set('mumei_imported','1');target.searchParams.set('mumei_account',id);target.searchParams.set('mumei_existing',b64(JSON.stringify({version:VERSION,noteId:id,groups:Array.isArray(groups)?groups:[],mutes:Array.isArray(mutes)?mutes:[]})));location.replace(target.href)}return}if(q.get('mumei_filter_reset')==='1'){await setValue(GRP+id,[]);await setValue(MUT+id,[]);await setValue(FIL+id,false);filterLoaded=false;filterOn=false}else if(q.get('mumei_groups_sync')){try{const parsed=JSON.parse(unb64(q.get('mumei_groups_sync'))||'[]'),groups=Array.isArray(parsed)?parsed:[];await setValue(GRP+id,groups);const active=[...new Set(groups.filter(g=>g?.enabled!==false).flatMap(g=>Array.isArray(g?.ids)?g.ids:[]).map(x=>String(x).toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))];await setValue(MUT+id,active);await setValue(FIL+id,active.length>0);filterLoaded=false;filterOn=active.length>0}catch{}}const u=new URL(location.href);for(const k of['mumei_groups_sync','mumei_filter_reset','mumei_filter_export','mumei_account','mumei_return'])u.searchParams.delete(k);history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash)}
async function openInsight(){const id=await account(),u=new URL(INSIGHT);if(id)u.searchParams.set('account',id);showDock(false);location.href=u.href}
function openSettings(){const u=new URL(FILTER_BASE);u.searchParams.set('from','note');u.searchParams.set('mumei_return','https://note.com/notifications');u.searchParams.set('v','322');u.searchParams.set('ts',String(Date.now()));markShell(null);showDock(false);clearFilter();setTimeout(()=>{location.href=u.href},0)}
function requestRead(){filterOn=false;clearFilter();renderFilter();autoStarted=true;if(!readerReady&&!window.__mumeiV3Reader322Ready){pendingRead=true;const b=uiButton('read');if(b)b.textContent='準備中…';return}readerReady=true;pendingRead=false;document.dispatchEvent(new Event('mumei-v3-read-request'))}
function performAction(act){if(act==='read'){requestRead();return}if(act==='filter'){void toggleFilter();return}if(act==='settings'){openSettings();return}if(act==='ins'){void openInsight()}}
function bindRoot(root){if(root.dataset.bound==='1')return;root.dataset.bound='1';let pressed='';root.addEventListener('pointerdown',e=>{const b=e.target instanceof Element?e.target.closest('button[data-act]'):null;if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();pressed=b.dataset.act||'';try{b.setPointerCapture?.(e.pointerId)}catch{}},{capture:true});root.addEventListener('pointerup',e=>{const b=e.target instanceof Element?e.target.closest('button[data-act]'):null;const act=pressed||b?.dataset.act||'';pressed='';if(!act)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();lastPointerActionAt=Date.now();performAction(act)},{capture:true});root.addEventListener('pointercancel',e=>{pressed='';e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()},{capture:true});root.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest('button[data-act]'):null;if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(Date.now()-lastPointerActionAt<700)return;performAction(b.dataset.act||'')},true);for(const type of['touchstart','touchend','mousedown','mouseup'])root.addEventListener(type,e=>{e.stopPropagation()},{capture:true,passive:true})}
async function tryAutoStart(){if(!shell||autoStarted||!readerReady)return;autoStarted=true;await new Promise(r=>setTimeout(r,180));if(shell&&visible(shell))document.dispatchEvent(new Event('mumei-v3-read-request'))}
function isBellClick(target){const hit=target instanceof Element?target.closest('button,a,[role="button"],[role="tab"]'):null;if(!hit||hit.closest('#'+ROOT))return false;const r=hit.getBoundingClientRect();if(r.top>210||r.bottom<0)return false;const meta=clean([hit.getAttribute('aria-label'),hit.getAttribute('title'),hit.getAttribute('data-testid'),hit.id,hit.className].join(' '));if(/(?:notification|notice|通知|お知らせ)/i.test(meta)&&!/setting|filter/i.test(meta))return true;if(hit.querySelector('svg')&&!hit.querySelector('img'))for(const x of hit.querySelectorAll('span,div'))if(/^\d{1,3}$/.test(clean(x.textContent)))return true;return false}
function topClick(e){if(!isBellClick(e.target))return;intentUntil=Date.now()+5000;for(const ms of[20,70,140,260,500,900,1500])setTimeout(inspect,ms)}
function blockNoticeNavigationWhileReading(e){if(!readerBusy||!shell)return;const a=e.target instanceof Element?e.target.closest('a[href]'):null;if(a&&shell.contains(a)){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}}
function onReaderStatus(e){const d=e.detail||{},b=uiButton('read');readerBusy=Boolean(d.scanning)||['saving'].includes(d.kind);if(!b)return;b.classList.toggle('err',d.kind==='error');b.textContent=clean(d.label)||'下から読込';b.title=clean(d.message);if(d.kind==='idle'&&!readerBusy)b.textContent='下から読込'}
function inspect(){retireOld();const next=findShell();if(next!==shell){markShell(next);autoStarted=false}const open=!!shell;showDock(open);if(!open){clearFilter();return}void initFilter();if(filterOn)void applyFilter();void tryAutoStart()}
function schedule(ms=40){clearTimeout(inspectTimer);inspectTimer=setTimeout(inspect,ms)}
function routeChanged(){if(location.href===lastHref)return;lastHref=location.href;intentUntil=0;markShell(null);showDock(false);autoStarted=false;clearFilter();schedule(0)}
function installRouteWatch(){for(const name of['pushState','replaceState']){const orig=history[name];if(typeof orig!=='function'||orig.__mumeiDock322Wrapped)continue;const fn=function(){const out=orig.apply(this,arguments);queueMicrotask(routeChanged);return out};fn.__mumeiDock322Wrapped=true;history[name]=fn}addEventListener('popstate',routeChanged);addEventListener('hashchange',routeChanged)}
function boot(){ensureStyle();ensureRoot();retireOld();installRouteWatch();void processFilterCommands().finally(()=>{inspect()});document.addEventListener('click',topClick,true);document.addEventListener('click',blockNoticeNavigationWhileReading,true);new MutationObserver(ms=>{if(ms.some(m=>!m.target.closest?.('#'+ROOT)&&!OLD_IDS.includes(m.target.id)&&!m.target.matches?.('script,style')))schedule(60)}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-hidden','class','style']});addEventListener('pageshow',()=>schedule(80));addEventListener('focus',()=>schedule(80));document.addEventListener('visibilitychange',()=>schedule(40));setInterval(routeChanged,1000)}
document.addEventListener('mumei-v3-reader-status',onReaderStatus);
document.addEventListener('mumei-v3-reader-stopped',()=>{readerBusy=false});
document.addEventListener('mumei-v3-reader-ready',()=>{readerReady=true;if(pendingRead){pendingRead=false;requestRead()}schedule(0)});
if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot,{once:true});
})();

// bundled component: note-insight-notification-reader-v322.js
(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationReader322)return;window.__mumeiNotificationReader322=true;

const VERSION='3.2.3',PROTOCOL='3.2.3';
const INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-ingest-v2';
const TOKEN='mumei_insight_notification_sync_token_v2:',SAVED='mumei_insight_notification_saved_v2919:',CHECK='mumei_insight_notification_checkpoint_v2922:';
const SHELL='[data-mumei-notice-shell-v3="1"]';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[class*="NotificationItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const TIME_RE=/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)/u;
const EXCLUDE=new Set(['settings','sitesettings','membership','memberships','notifications','messages','search','explore','login','signup']);
const OUTBOX='mumei-notification-outbox-v322:';
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const stripTime=v=>clean(v).replace(/\s*(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)$/u,'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase();

async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function request(url,body,headers={}){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));fn({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300&&p?.ok!==false?resolve(p):reject(new Error(p?.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
function shown(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1||r.right<=0||r.bottom<=0||r.left>=innerWidth||r.top>=innerHeight)return false;for(let p=el,d=0;p&&d++<14;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||p.hasAttribute('inert')||s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)<=.01)return false}return true}
function creatorId(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean),id=(p[0]||'').toLowerCase();return u.hostname.endsWith('note.com')&&p.length===1&&/^[a-z0-9_-]+$/.test(id)&&!EXCLUDE.has(id)?id:''}catch{return''}}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u?.urlname||u?.url_name||u?.username||'').replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?{id}:null}catch{return null}}
function rowish(el,trusted=false){if(!shown(el))return false;const t=clean(el.textContent);return t.length>=3&&t.length<=4000&&(trusted||TIME_RE.test(t))}
function rows(root){if(!root?.querySelectorAll)return[];const exact=[...root.querySelectorAll('.m-navbarNoticeItem,[data-testid="notification-item"],[data-testid="notice-item"]')].filter(el=>rowish(el,true));if(exact.length)return exact.filter(el=>!exact.some(other=>other!==el&&other.contains(el)));const known=[...root.querySelectorAll(ITEM)].filter(el=>rowish(el,true)&&!String(el.className).includes('__'));if(known.length)return known.filter(el=>!known.some(other=>other!==el&&other.contains(el)));const out=[];for(const el of root.querySelectorAll('li,[role="listitem"],a[href]')){if(!rowish(el))continue;if(out.some(x=>x.contains(el)))continue;for(let i=out.length-1;i>=0;i--)if(el.contains(out[i]))out.splice(i,1);out.push(el)}return out}
function panel(){const p=document.querySelector(SHELL);return p&&shown(p)&&p!==document.body&&p!==document.documentElement?p:null}
function scrollHost(p){const xs=rows(p);let x=xs[0]||p;while(x&&p.contains(x)){if(x.scrollHeight>x.clientHeight+20&&/(auto|scroll)/.test(getComputedStyle(x).overflowY))return x;if(x===p)break;x=x.parentElement}return p.scrollHeight>p.clientHeight+20?p:null}
function links(el){const out=[];for(const a of [...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')]){try{const u=new URL(a.getAttribute('href'),location.href);if(u.hostname.endsWith('note.com'))out.push({u:u.href,t:clean(a.textContent)})}catch{}if(out.length>=18)break}return out}
function estimatedTime(raw){const m=clean(raw).match(/(\d+)\s*(秒|分|時間|日|週)前$/u);if(!m)return null;const scale={'秒':1000,'分':60000,'時間':3600000,'日':86400000,'週':604800000};return new Date(Date.now()-Number(m[1])*scale[m[2]]).toISOString()}
function eventIdentity(el,raw,tm){const id=el.getAttribute('data-notification-id')||el.getAttribute('data-notice-id')||el.querySelector('[data-notification-id]')?.getAttribute('data-notification-id');if(id)return'notice:'+id;for(const a of [...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')]){try{const u=new URL(a.href);for(const k of['notification_id','notice_id','c','comment_id'])if(u.searchParams.get(k))return'notice:'+u.searchParams.get(k)}catch{}}if(tm&&!Number.isNaN(Date.parse(tm)))return'time:'+new Date(tm).toISOString();const m=clean(raw).match(/(\d+)\s*(秒|分|時間|日|週)前$/u);if(m){const scale={'秒':1000,'分':60000,'時間':3600000,'日':86400000,'週':604800000},at=Date.now()-Number(m[1])*scale[m[2]],bucket=Math.max(60000,scale[m[2]]);return'estimated:'+Math.floor(at/bucket)+':'+bucket}return'label:'+(clean(raw).match(TIME_RE)?.[0]||'unknown')}
function rowData(el){const raw=clean(el.textContent);if(!raw||raw.length>4000)return null;const ls=links(el),actor=ls.find(x=>creatorId(x.u))||null,target=ls.find(x=>/[?&]kind=/.test(x.u))||ls.find(x=>/\/n\/|\/m\/|\/membership|kind=|scrollpos=comment/i.test(x.u))||null,tm=el.querySelector('time[datetime]')?.getAttribute('datetime')||el.querySelector('[datetime]')?.getAttribute('datetime')||null,m=stripTime(raw).match(/^(.{1,180}?)\s*さん/u);let img=null;for(const x of el.querySelectorAll('img[src]')){const src=String(x.currentSrc||x.src||'');if(src&&!/cover|ogp|magazine/i.test(src)){img=src;break}}return{raw_text:raw,actor_name:actor?.t||m?.[1]||null,actor_url:actor?.u||null,actor_image_url:img,target_title:target?.t||null,target_url:target?.u||null,source_url:target?.u||actor?.u||'https://note.com/',occurred_at:tm||estimatedTime(raw),meta:{source:'note-notification-manual-sync-v2968',capture_source:'note-notification-reader-v322',userscript:VERSION,protocol:PROTOCOL,scan_mode:'verified-shell-bottom-to-top',event_identity:eventIdentity(el,raw,tm),verified_shell:true,time_estimated:!tm,article_url:ls.find(x=>/\/n\//.test(x.u))?.u||null,magazine_url:ls.find(x=>/\/m\//.test(x.u))?.u||null,links:ls.map(x=>({url:x.u,title:x.t}))}}}
const sig=r=>[stripTime(r.raw_text),String(r.target_url||'').split('#')[0],String(r.actor_url||'').split('?')[0],r.meta?.event_identity||r.occurred_at||'unknown'].join('|');
function readOutbox(id){try{const v=JSON.parse(localStorage.getItem(key(OUTBOX,id))||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function writeOutbox(id,rs){localStorage.setItem(key(OUTBOX,id),JSON.stringify(rs))}
function retain(id,rs){const m=new Map(readOutbox(id).map(r=>[sig(r),r]));for(const r of rs)m.set(sig(r),r);writeOutbox(id,[...m.values()])}
function status(message,kind='info',label=''){document.dispatchEvent(new CustomEvent('mumei-v3-reader-status',{detail:{message:String(message||''),kind,label,scanning}}))}
async function sendBatch(input,a,saved){if(!input.length)return 0;retain(a.id,input.filter(r=>!saved.has(sig(r))));const token=String(await get(key(TOKEN,a.id),'')||'');if(!token)throw new Error('本人連携が必要です');let total=0;for(let i=0;i<input.length;i+=20){const part=input.slice(i,i+20).filter(r=>!saved.has(sig(r)));if(!part.length)continue;const current=await account();if(current?.id!==a.id)throw new Error('NOTE_ACCOUNT_CHANGED');const payload=part.map(r=>({...r,meta:{...(r.meta||{}),client_signature:sig(r)}}));const p=await request(INGEST,{noteId:a.id,notifications:payload},{'X-Ingest-Token':token});const sent=new Set(payload.map(sig)),confirmed=[...new Set(Array.isArray(p.confirmedClientSignatures)?p.confirmedClientSignatures.map(String).filter(s=>sent.has(s)):[])];for(const s of confirmed)saved.add(s);await set(key(SAVED,a.id),[...saved]);if(confirmed.length){const last=part.filter(r=>confirmed.includes(sig(r))).at(-1),cp=await get(key(CHECK,a.id),{}),now=Date.now();await set(key(CHECK,a.id),{...cp,lastSaveAt:now,lastCheckAt:now,savedCount:saved.size,lastError:'',version:VERSION,boundarySignature:sig(last),boundaryEventIdentity:last.meta?.event_identity,boundaryLegacySignature:[stripTime(last.raw_text),String(last.target_url||'').split('#')[0],String(last.actor_url||'').split('?')[0]].join('|'),boundaryAt:now,boundarySource:'reader-confirmed-v322'});document.dispatchEvent(new Event('mumei-notification-checkpoint'))}writeOutbox(a.id,readOutbox(a.id).filter(r=>!saved.has(sig(r))));total+=confirmed.length;if(confirmed.length!==payload.length)throw new Error('一部の通知が未保存です。再読込で再試行します')}return total}

let scanning=false,stop=false,active=null;
function capturePending(){if(!active)return;const{a,p,saved}=active;try{const rs=rows(p).slice().reverse().map(rowData).filter(r=>r&&!saved.has(sig(r)));retain(a.id,rs)}catch{}}
function pauseCapture(){capturePending();stop=true}
addEventListener('pagehide',pauseCapture,{capture:true});
addEventListener('popstate',pauseCapture,{capture:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')pauseCapture()},{capture:true});

async function scan(){
 if(scanning){stop=true;capturePending();status('停止地点まで保存します…','saving','保存中…');return}
 scanning=true;stop=false;let a=null,saved=null,count=0,seen=new Set(),p=null,host=null,startTop=0,complete=false;
 status('通知を読み込みます…','saving','■ 停止保存');
 try{
  p=panel();if(!p)throw new Error('本物の🔔通知一覧を開いてください');
  a=await account();if(!a)throw new Error('noteログインを確認してください');
  if(!String(await get(key(TOKEN,a.id),'')||''))throw new Error('本人連携が必要です');
  const cp=await get(key(CHECK,a.id),{}),savedRaw=await get(key(SAVED,a.id),[]),previous=new Set(Array.isArray(savedRaw)?savedRaw.map(String):[]);saved=new Set(previous);active={a,p,saved};
  count+=await sendBatch(readOutbox(a.id),a,saved);
  host=scrollHost(p);if(host)startTop=host.scrollTop;
  const current=()=>rows(p).map(el=>{const r=rowData(el);if(r)el.dataset.mumeiReaderSignature=sig(r);return r}).filter(Boolean);
  const overlap=()=>cp.historyComplete===true&&current().some(r=>previous.has(sig(r)));
  const capture=async()=>{const rs=current().slice().reverse();for(const r of rs)seen.add(sig(r));retain(a.id,rs.filter(r=>!saved.has(sig(r))));if(readOutbox(a.id).length>=20)count+=await sendBatch(readOutbox(a.id),a,saved);status(`読込 ${seen.size}件｜保存 ${count}件`,'saving','■ 停止保存')};
  await capture();
  if(host&&!overlap()){
   let stable=0,last=-1;
   for(let i=0;i<70&&!stop;i++){
    if(panel()!==p)throw new Error('通知一覧を閉じたため中断しました');
    host.scrollTop=Math.max(0,host.scrollHeight-host.clientHeight);await sleep(320);await capture();if(overlap()){complete=true;break}
    const h=host.scrollHeight;if(h===last)stable++;else stable=0;last=h;if(stable>=3){complete=true;break}
   }
  }else complete=true;
  await capture();count+=await sendBatch(readOutbox(a.id),a,saved);
  complete=complete&&!stop;
  const latest=await get(key(CHECK,a.id),{}),visibleRows=current();const top=visibleRows.find(r=>saved.has(sig(r)));if(top){latest.boundarySignature=sig(top);latest.boundaryEventIdentity=top.meta?.event_identity;latest.boundaryLegacySignature=[stripTime(top.raw_text),String(top.target_url||'').split('#')[0],String(top.actor_url||'').split('?')[0]].join('|')}
  await set(key(CHECK,a.id),{...latest,lastCheckAt:Date.now(),manualNewCount:count,manualSeenCount:seen.size,historyComplete:cp.historyComplete===true||complete,lastError:''});
  status(`${stop?'停止・':''}${count}件保存確認｜${seen.size}件読取${complete?'':'｜続きは次回'}`,'done','下から読込');
 }catch(e){capturePending();if(a){try{const cp=await get(key(CHECK,a.id),{});await set(key(CHECK,a.id),{...cp,lastError:String(e?.message||e),lastCheckAt:Date.now()})}catch{}}status(`⚠ ${String(e?.message||e)}`,'error',/連携/.test(String(e?.message||e))?'連携必要':'再読込')}
 finally{if(host&&host.isConnected){try{host.scrollTop=startTop}catch{}}active=null;scanning=false;stop=false;document.dispatchEvent(new CustomEvent('mumei-v3-reader-stopped'))}
}

document.addEventListener('mumei-v3-read-request',()=>void scan());
window.__mumeiV3Reader322={scan,isScanning:()=>scanning};
window.__mumeiV3Reader322Ready=true;
document.dispatchEvent(new Event('mumei-v3-reader-ready'));
})();

// bundled component: note-insight-notification-loader-v318.js
(function(){
'use strict';
if(!['note.com','mumei-s.github.io'].includes(location.hostname))return;
if(window.__mumeiNotificationLoader322)return;window.__mumeiNotificationLoader322=true;
const VERSION='3.2.3';
const BASE='https://mumei-s.github.io/note-insight/';
const IS_NOTE=location.hostname==='note.com';
const CACHE='mumei-v322-runtime-cache:';
const FLOW_KEY='mumei-dashboard-flow-v143';
const HARD_KEY='mumei-v322-dashboard-hardload';
let dashboardLoaded=false,loading=false,lastHref=location.href;

function modern(){return Boolean(globalThis.GM)}
async function getValue(k,d=''){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function setValue(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function safeReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
function gmRequest(url){return new Promise((resolve,reject)=>{const d={method:'GET',url,headers:{'Cache-Control':'no-cache'},timeout:20000,onload:r=>r.status>=200&&r.status<300?resolve(String(r.responseText||'')):reject(new Error('HTTP_'+r.status)),onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))};try{if(modern()&&typeof GM.xmlHttpRequest==='function'){GM.xmlHttpRequest(d);return}if(typeof GM_xmlhttpRequest==='function'){GM_xmlhttpRequest(d);return}}catch(e){reject(e);return}reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'))})}
async function componentText(name){const url=BASE+name+'?v=322&ts='+Date.now();let last=null;for(let i=0;i<2;i++){try{const t=await gmRequest(url);if(t.trim()){await setValue(CACHE+name,t);return t}}catch(e){last=e}try{const r=await fetch(url,{cache:'no-store'});if(r.ok){const t=await r.text();if(t.trim()){await setValue(CACHE+name,t);return t}}}catch(e){last=e}await new Promise(r=>setTimeout(r,180+i*220))}const cached=String(await getValue(CACHE+name,'')||'');if(cached.trim())return cached;throw last||new Error('EMPTY_'+name)}
async function ensureDashboard(){if(dashboardLoaded)return;if(typeof window.__mumeiStartDashboard323==='function'){window.__mumeiStartDashboard323();dashboardLoaded=true;return}try{let src=await componentText('note-insight-dashboard-integrated-v318.js');src=src.replaceAll('mumeiDashboardCore318','mumeiDashboardCore322').replaceAll('mumeiDashboardAdapter318','mumeiDashboardAdapter322');eval(src+'\n//# sourceURL='+(BASE+'note-insight-dashboard-integrated-v318.js'));dashboardLoaded=true;try{localStorage.setItem('mumei-dashboard-integrated-runtime',VERSION)}catch{}}catch(e){console.warn('[INSIGHT] ダッシュボード接続失敗',e)}}
function maybeHardDashboard(){if(!IS_NOTE)return false;const onStats=/^\/sitesettings\/stats(?:\/|$)/i.test(location.pathname),flow=sessionStorage.getItem(FLOW_KEY)==='1';if(!onStats||!flow){if(!onStats)sessionStorage.removeItem(HARD_KEY);return false}const mark=location.pathname+location.search;if(sessionStorage.getItem(HARD_KEY)===mark)return false;sessionStorage.setItem(HARD_KEY,mark);location.reload();return true}
function versionCheck(){if(!IS_NOTE)return;const u=new URL(location.href);if(u.searchParams.get('mumei_insight_version_check')!=='1')return;const back=safeReturn(u.searchParams.get('mumei_return'));u.searchParams.delete('mumei_insight_version_check');u.searchParams.delete('mumei_return');history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);if(back){const b=new URL(back);b.searchParams.set('notificationInstalled',VERSION);b.searchParams.set('notificationCheckedAt',String(Date.now()));b.searchParams.set('notificationUpdateResult','runtime-checked-v323');location.replace(b.href)}}
async function pairNotice(){
 const u=new URL(location.href),code=u.searchParams.get('mumei_pair');if(!code)return false;
 const back=safeReturn(u.searchParams.get('mumei_return')),expected=String(u.searchParams.get('mumei_account')||'').toLowerCase();
 try{
  const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)throw new Error('noteにログインしてください');
  const j=await r.json(),user=(j.data??j).user||(j.data??j),id=String(user.urlname||user.url_name||user.username||'').toLowerCase();
  if(!expected||id!==expected)throw new Error('noteとINSIGHTのアカウントが一致しません');
  const storage='mumei_insight_notification_sync_token_v2:'+id;
  if(!await getValue(storage,'')){
   const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;
   if(!fn)throw new Error('ユーザースクリプトの実行許可を確認してください');
   const token=await new Promise((resolve,reject)=>fn({method:'POST',url:'https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-import-token',headers:{'Content-Type':'application/json'},data:JSON.stringify({action:'pair-exchange',code}),timeout:20000,onload:x=>{try{const p=JSON.parse(x.responseText);if(x.status<200||x.status>=300||!p.ok||p.noteId!==id||!p.ingestToken)throw new Error('連携を確認できません。導入画面で再試行してください');resolve(p.ingestToken)}catch(e){reject(e)}},onerror:()=>reject(new Error('連携通信に失敗しました')),ontimeout:()=>reject(new Error('連携が時間切れです'))}));
   if(modern()&&typeof GM.setValue==='function')await GM.setValue(storage,token);else if(typeof GM_setValue==='function')GM_setValue(storage,token);else throw new Error('連携情報を保存できません');
  }
  for(const k of ['mumei_pair','mumei_account','mumei_return'])u.searchParams.delete(k);history.replaceState(history.state,'',u.href);
  if(back){const dest=new URL(back);dest.searchParams.set('notificationPaired','1');location.replace(dest.href)}
 }catch(e){const dest=back?new URL(back):new URL(BASE+'tool-setup.html');dest.searchParams.set('notificationPairError',String(e.message||e));location.replace(dest.href)}
 return true;
}
async function start(){if(loading)return;loading=true;try{if(IS_NOTE&&await pairNotice())return;if(!IS_NOTE||/^\/sitesettings\/stats(?:\/|$)/.test(location.pathname))await ensureDashboard();if(maybeHardDashboard())return;if(!IS_NOTE||window.__mumeiV3Reader322Ready)versionCheck();try{localStorage.setItem('mumei-notification-v3-loader',VERSION)}catch{}document.dispatchEvent(new Event('mumei-v3-core-ready'))}finally{loading=false}}
function routeChanged(){if(location.href===lastHref)return;lastHref=location.href;void start()}
function installRouteWatch(){for(const name of['pushState','replaceState']){const orig=history[name];if(typeof orig!=='function'||orig.__mumeiLoader322Wrapped)continue;const fn=function(){const out=orig.apply(this,arguments);queueMicrotask(routeChanged);return out};fn.__mumeiLoader322Wrapped=true;history[name]=fn}addEventListener('popstate',routeChanged);addEventListener('hashchange',routeChanged)}
installRouteWatch();
addEventListener('pageshow',()=>void start());
addEventListener('focus',()=>void start());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void start()});
void start();
})();
