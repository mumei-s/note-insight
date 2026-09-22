// ==UserScript==
// @name         無名S note INSIGHT｜公式Dashboard同期
// @namespace    https://mumei-s.github.io/note-insight/
// @version      1.4.7
// @description  note公式Dashboardを本人アカウント完全一致でINSIGHTへ手動同期。インプレッション・PV・スキ・コメント・売上・流入元・日別系列・記事/メンシプ/マガジン対応。本人通知とは独立しています。
// @match        https://note.com/sitesettings/stats*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// ==/UserScript==

(() => {
  'use strict';
  const VERSION='1.4.7';
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
  function xhr(url,body,headers={}){return new Promise((resolve,reject)=>(typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:typeof GM!=='undefined'&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest.bind(GM):()=>reject(new Error('DASHBOARD_REQUEST_UNAVAILABLE')))({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:60000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{}if(r.status>=200&&r.status<300&&p?.ok!==false)resolve(p);else reject(new Error(p?.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))}))}
  function cleanUrl(){const u=new URL(location.href);for(const k of ['mumei_dashboard_pair','mumei_dashboard_sync','mumei_dashboard_return'])u.searchParams.delete(k);history.replaceState(history.state,'',u.href)}
  function safeReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
  async function currentNoteId(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=text(u?.urlname||u?.url_name||u?.username).replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?id:''}catch{return''}}
  const isDashboard=()=>location.origin==='https://note.com'&&/\/(?:sitesettings\/stats|dashboard)(?:\/|$)/.test(location.pathname);
  const statsUrl=url=>{try{const u=new URL(url,location.href);return u.origin==='https://note.com'&&/^\/api\/v\d+\/(?:stats|dashboards?|analytics)(?:\/|$)/.test(u.pathname)}catch{return false}};
  function captureJson(url,payload){if(!payload||typeof payload!=='object'||(!statsUrl(url)&&url!=='hydration'))return;const idx=CAPTURE.findIndex(x=>x.url===String(url));if(idx>=0)CAPTURE.splice(idx,1);CAPTURE.push({url:String(url),payload,at:Date.now()});if(CAPTURE.length>40)CAPTURE.shift()}

  const pageWindow=()=>{try{return typeof unsafeWindow!=='undefined'?unsafeWindow:window}catch{return window}};
  const originalFetch=window.fetch.bind(window);
  function observe(p){
   if(p?.fetch&&!p.fetch.__mumeiDashboardCapture){const original=p.fetch.bind(p),wrapped=async function(...args){const res=await original(...args);try{const url=typeof args[0]==='string'?args[0]:args[0]?.url||'';if(statsUrl(url))res.clone().json().then(data=>captureJson(url,data)).catch(()=>{})}catch{}return res};wrapped.__mumeiDashboardCapture=true;try{p.fetch=wrapped}catch{}}
   const proto=p?.XMLHttpRequest?.prototype;if(!proto||proto.__mumeiDashboardCapture)return;
   const open=proto.open,send=proto.send;
   proto.open=function(method,url,...rest){this.__mumeiDashboardUrl=String(url||'');return open.call(this,method,url,...rest)};
   proto.send=function(...args){this.addEventListener('load',()=>{try{if(statsUrl(this.__mumeiDashboardUrl))captureJson(this.__mumeiDashboardUrl,this.responseType==='json'?this.response:JSON.parse(this.responseText))}catch{}},{once:true});return send.apply(this,args)};
   proto.__mumeiDashboardCapture=true;
  }
  observe(pageWindow());if(pageWindow()!==window)observe(window);
  const aliases={impressions:['impressions','impression','impression_count','impressionCount'],pageViews:['page_views','pageViews','pageview','page_view','page_view_count','views','view_count','viewCount','pv','read_count','readCount'],likes:['likes','like_count','likeCount','like'],comments:['comments','comment_count','commentCount','comment'],sales:['sales_yen','salesYen','sales_amount','salesAmount','sales','amount','revenue'],shares:['shares','share_count','shareCount','shared_count']};
  const pick=(o,keys)=>{for(const k of keys)if(o&&Object.prototype.hasOwnProperty.call(o,k)&&num(o[k])>=0)return num(o[k]);return 0};
  const titleOf=o=>text(o?.title||o?.name||o?.note_name||o?.noteName||o?.article_title||o?.articleTitle);
  const urlOf=o=>text(o?.url||o?.note_url||o?.noteUrl||o?.permalink);
  const keyOf=o=>text(o?.key||o?.note_key||o?.noteKey||o?.id||urlOf(o));
  const dateOf=o=>{
    const value=o?.date??o?.day??o?.target_date??o?.targetDate??o?.aggregated_at??o?.aggregatedAt??o?.timestamp??o?.x;
    if(typeof value==='number'&&value>1e9){const d=new Date(value<1e12?value*1000:value);if(!Number.isNaN(+d))return new Date(+d+9*3600000).toISOString().slice(0,10)}
    const m=text(value).match(/^(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})(?:日|T|$|\s)/);if(!m)return'';
    const day=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const parsed=new Date(day+'T00:00:00Z');return Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===day?day:'';
  };
  function walk(value,visit,depth=0){if(depth>10||value==null)return;if(Array.isArray(value)){for(const x of value.slice(0,6000))walk(x,visit,depth+1);return}if(typeof value!=='object')return;visit(value);for(const v of Object.values(value))if(v&&typeof v==='object')walk(v,visit,depth+1)}
  const metricFields={pageViews:aliases.pageViews,impressions:aliases.impressions,likes:aliases.likes,comments:aliases.comments,salesYen:aliases.sales};
  const optionalNumber=v=>v===null||v===undefined||v===''||typeof v==='boolean'||!['number','string'].includes(typeof v)||!Number.isFinite(Number(String(v).replace(/,/g,'')))?null:Number(String(v).replace(/,/g,''));
  function metricName(v){const k=text(v).toLowerCase();for(const[field,names]of Object.entries(metricFields))if(field.toLowerCase()===k||names.some(x=>x.toLowerCase()===k))return field;return({'ページビュー':'pageViews','pv':'pageViews','インプレッション':'impressions','スキ':'likes','コメント':'comments','売上':'salesYen'})[k]||''}
  function mergeMetrics(rows){const m=new Map();for(const r of rows){if(!r.date)continue;const old=m.get(r.date)||{date:r.date,impressions:null,pageViews:null,likes:null,comments:null,salesYen:null};let found=false;for(const f of Object.keys(metricFields)){const v=optionalNumber(r[f]);if(v!==null&&v>=0){old[f]=v;found=true}}if(found)m.set(r.date,old)}return[...m.values()].sort((a,b)=>a.date.localeCompare(b.date))}
  function dailyMetrics(payload){
   const rows=[];
   const add=(date,field,value)=>{const day=dateOf({date}),n=optionalNumber(value);if(day&&field&&n!==null&&n>=0)rows.push({date:day,[field]:n})};
   function visit(v,field='',depth=0){
    if(depth>10||v==null)return;if(Array.isArray(v)){if(field&&v.length===2&&dateOf({date:v[0]})){add(v[0],field,v[1]);return}for(const x of v.slice(0,6000))visit(x,field,depth+1);return}if(typeof v!=='object')return;
    if(/^(?:month|monthly|week|weekly|year|yearly)$/i.test(text(v.granularity||v.interval)))return;
    field=metricName(v.metric||v.type||v.label||v.name)||field;
    const article=Boolean(titleOf(v)&&(v.note_key||v.noteKey||v.article_key||v.url||v.key)),referrer=Boolean(v.referrer||v.referrer_name||v.source||v.domain||v.host),day=dateOf(v);
    if(!article&&!referrer){
     if(day){for(const[f,names]of Object.entries(metricFields)){const key=names.find(k=>Object.prototype.hasOwnProperty.call(v,k));if(key)add(day,f,v[key])}if(field)add(day,field,v.value??v.count??v.y)}
     const dates=v.labels||v.dates||v.days;
     if(Array.isArray(dates)){
      for(const dataset of (Array.isArray(v.datasets)?v.datasets:Array.isArray(v.series)?v.series:[])){const f=metricName(dataset.label||dataset.name||dataset.key);if(f&&Array.isArray(dataset.data))dates.forEach((d,i)=>add(d,f,dataset.data[i]))}
      for(const[k,x]of Object.entries(v)){const f=metricName(k);if(f&&Array.isArray(x))dates.forEach((d,i)=>add(d,f,x[i]))}
     }
     for(const[k,x]of Object.entries(v)){if(field&&/^20\d{2}[-/]\d{1,2}[-/]\d{1,2}$/.test(k))add(k,field,x);else if(x&&typeof x==='object')visit(x,metricName(k)||field,depth+1)}
    }
   }
   visit(payload);return mergeMetrics(rows);
  }
  async function refreshChartSources(){
   for(const script of document.querySelectorAll('script[type="application/json"],script#__NEXT_DATA__')){try{captureJson('hydration',JSON.parse(script.textContent||''))}catch{}}
   const urls=[...new Set((performance.getEntriesByType?.('resource')||[]).map(r=>r.name).filter(v=>{try{const u=new URL(v);return u.origin==='https://note.com'&&/^\/api\/v[0-9]+\/(?:stats|dashboard|dashboards|analytics)(?:\/|$)/.test(u.pathname)}catch{return false}}))].slice(-8);
   await Promise.all(urls.map(async url=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);try{const r=await originalFetch(url,{method:'GET',credentials:'include',cache:'no-store',signal:c.signal});if(r.ok)captureJson(url,await r.json())}catch{}finally{clearTimeout(timer)}}));
  }
  function mineNetwork(){const articles=[],sources=[],trafficSeries=[],metricRows=[];for(const cap of CAPTURE){metricRows.push(...dailyMetrics(cap.payload));walk(cap.payload,o=>{const title=titleOf(o),url=urlOf(o),key=keyOf(o),pv=pick(o,aliases.pageViews),imp=pick(o,aliases.impressions),likes=pick(o,aliases.likes),comments=pick(o,aliases.comments),sales=pick(o,aliases.sales),shares=pick(o,aliases.shares),date=dateOf(o);if(title&&(url||key)&&(pv||imp||likes||comments||sales||shares)){articles.push({key:key||url,title,url,impressions:imp,pageViews:pv,views:pv,likes,comments,salesYen:sales,shares,status:text(o.status),publishedAt:text(o.published_at||o.publishedAt||o.publish_at),contentType:text(o.content_type||o.contentType||'article')})}const source=text(o.referrer||o.referrer_name||o.source||o.domain||o.host);const spv=pick(o,['pv','page_views','pageViews','count','value']);if(source&&spv&&!/^https?:/i.test(source)&&source.length<100){if(date)trafficSeries.push({date,source,pv:spv});else sources.push({source,pv:spv})}})}return{articles:uniq(articles,r=>r.url||r.key||r.title),sources:uniq(sources,r=>r.source.toLowerCase()),trafficSeries,metricSeries:mergeMetrics(metricRows)}}
  function labelledNumber(label,body=document.body?.innerText||''){const rx=new RegExp(`${label}\\s*[：:]?\\s*[￥¥]?([0-9][0-9,]*|-)`,'i'),m=body.match(rx);return m&&m[1]!=='-'?num(m[1]):null}
  function detectTotals(){const body=document.body?.innerText||'';return{impressions:labelledNumber('インプレッション',body),pageViews:labelledNumber('(?:ページビュー|全体ビュー|ビュー数)',body),likes:labelledNumber('スキ',body),comments:labelledNumber('コメント',body),salesYen:labelledNumber('売上',body)}}
  function detectPeriod(){const body=document.body?.innerText||'',range=body.match(/(20\d{2})[\/.年](\d{1,2})[\/.月](\d{1,2})[^\d]{1,5}(?:〜|~|-)[^\d]*(?:(20\d{2})[\/.年])?(\d{1,2})[\/.月](\d{1,2})/);if(!range)return{periodType:'custom',periodStart:null,periodEnd:null};const year2=range[4]||range[1],pad=x=>String(x).padStart(2,'0');return{periodType:'custom',periodStart:`${range[1]}-${pad(range[2])}-${pad(range[3])}`,periodEnd:`${year2}-${pad(range[5])}-${pad(range[6])}`}}
  function detectCollected(){const m=(document.body?.innerText||'').match(/(20\d{2})[\/.年](\d{1,2})[\/.月](\d{1,2})[^\d]+(\d{1,2}):(\d{2})\s*集計/);if(!m)return null;const p=x=>String(x).padStart(2,'0');return`${m[1]}-${p(m[2])}-${p(m[3])}T${p(m[4])}:${p(m[5])}:00+09:00`}
  function detectTraffic(){const body=document.body?.innerText||'',rows=[];const rx=/(^|\n)\s*([A-Za-z0-9._-]+|X|Facebook|Instagram|no referrer|other)\s+([0-9.]+)%\s*\(([0-9,]+)PV\)/g;let m;while((m=rx.exec(body)))rows.push({source:text(m[2]),percent:num(m[3]),pv:num(m[4])});return uniq(rows,r=>r.source.toLowerCase())}
  function detectSummary(){const body=document.body?.innerText||'',a=body.match(/記事数\s*([0-9,]+)\s*本/),s=body.match(/シェアされた記事\s*([0-9,]+)\s*回/),r=body.match(/収益\s*[￥¥]?\s*([0-9,]+)/);return{articles:a?num(a[1]):0,sharedArticles:s?num(s[1]):0,revenueYen:r?num(r[1]):0}}
  function tableArticles(contentType='article'){const out=[];for(const table of document.querySelectorAll('table')){const headers=[...table.querySelectorAll('thead th')].map(x=>text(x.textContent));if(!headers.some(x=>/タイトル/.test(x)))continue;const idx=(rx)=>headers.findIndex(x=>rx.test(x));const I={title:idx(/タイトル/),imp:idx(/インプレッション/),pv:idx(/ページビュー|PV/),like:idx(/スキ/),comment:idx(/コメント/),sales:idx(/売上/)};for(const tr of table.querySelectorAll('tbody tr')){const cells=[...tr.querySelectorAll('td')];if(!cells.length)continue;const c=i=>i>=0?text(cells[i]?.textContent):'';const a=tr.querySelector('a[href*="/n/"]');const title=c(I.title)||text(a?.textContent);if(!title)continue;const url=a?.href||'';out.push({key:url||title,title,url,impressions:num(c(I.imp)),pageViews:num(c(I.pv)),views:num(c(I.pv)),likes:num(c(I.like)),comments:num(c(I.comment)),salesYen:num(c(I.sales)),contentType,status:/公開中/.test(text(tr.textContent))?'published':'',publishedAt:(text(tr.textContent).match(/20\d{2}年\d{1,2}月\d{1,2}日/)||[])[0]||''})}}return out}
  async function syncNow(){
    if(busy||!isDashboard())return;busy=true;mount();setStatus('公式データを確認中…');
    const button=panel?.querySelector('#mumei-dash-read');if(button)button.disabled=true;
    try{
      const startLocation=location.href,paired=(localStorage.getItem(NOTE_KEY)||'').toLowerCase(),current=await currentNoteId();
      if(!paired)throw new Error('INSIGHTの分析からダッシュボードを連携してください');
      if(!current)throw new Error('noteへのログインを確認してください');
      if(current!==paired)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${paired}`);
      // Read the currently selected official period. Never click other tabs or mix their totals.
      await refreshChartSources();
      for(let i=0;i<40;i++){if(!isDashboard())return;const t=detectTotals();if(t.pageViews!==null||tableArticles().length||mineNetwork().metricSeries.length)break;await sleep(300)}
      const totals=detectTotals(),period=detectPeriod(),collected=detectCollected(),summary=detectSummary();
      const mined=mineNetwork(),visible=tableArticles();
      const articles=visible.length?visible:mined.articles;
      const traffic=uniq([...detectTraffic(),...mined.sources],r=>String(r.source).toLowerCase());
      const dailyPvDays=mined.metricSeries.filter(r=>r.pageViews!==null).length;
      if(!articles.length&&totals.pageViews===null&&totals.impressions===null&&!mined.metricSeries.length)throw new Error('公式データが見つかりません。グラフ表示後に「再読込」を押してください');
      const token=localStorage.getItem(TOKEN_KEY)||'';if(!token)throw new Error('INSIGHTの分析からダッシュボードを再連携してください');
      setStatus(`読込 記事${articles.length}件／日別PV ${dailyPvDays}日 → 保存中…`);
      const payload={action:'ingest',schemaVersion:4,connectorVersion:VERSION,noteId:paired,articles,totals,
        trafficSources:traffic,trafficSeries:mined.trafficSeries,metricSeries:mined.metricSeries,summary,
        contentSections:{article:{count:articles.length,scope:'visible-period'}},officialCollectedAt:collected,...period,pages:1};
      if(!isDashboard()||location.href!==startLocation||localStorage.getItem(NOTE_KEY)?.toLowerCase()!==paired||await currentNoteId()!==paired)throw new Error('DASHBOARD_ACCOUNT_MISMATCH');
      const saved=await xhr(DASH_API,payload,{'X-Ingest-Token':token});
      if(!saved.snapshotId)throw new Error('保存結果を確認できませんでした。再読込してください');
      const count=Number(saved.dailyPvDays??dailyPvDays),at=new Date(saved.capturedAt||Date.now()).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'});
      localStorage.setItem('mumei-dashboard-last-sync',String(Date.now()));
      const message=`✓ 同期完了 ${at}｜記事${saved.articleCount??articles.length}件・日別PV ${count}日${count?'':'（日別グラフを開いて再読込）'}`;
      localStorage.setItem('mumei-dashboard-last-result:'+paired,message);setStatus(message,count?'ok':'partial');
    }catch(e){setStatus(`⚠ ${e?.message||e}`,'warn')}
    finally{busy=false;if(button)button.disabled=false}
  }
  function setStatus(message,kind=''){if(!status)return;status.textContent=message;status.dataset.kind=kind}
  function mount(){
    if(!isDashboard()||!document.body)return;
    if(panel?.isConnected)return;panel=document.createElement('div');panel.id='mumei-dashboard-sync';
    panel.innerHTML=`<style>#mumei-dashboard-sync{position:fixed;z-index:2147483646;left:10px;right:10px;bottom:max(10px,env(safe-area-inset-bottom));font:12px/1.5 system-ui;color:#eaf6ff;background:#07131df5;border:1px solid #4cc9e8;border-radius:14px;padding:10px;box-shadow:0 10px 30px #0008;backdrop-filter:blur(10px)}#mumei-dashboard-sync .row{display:flex;gap:8px;align-items:center}#mumei-dashboard-sync button{border:1px solid #5fd7f0;background:#103048;color:#eafaff;border-radius:10px;font-weight:900;min-height:40px;padding:0 12px;white-space:nowrap}#mumei-dashboard-sync button:disabled{opacity:.55}#mumei-dashboard-sync .status{min-width:0;flex:1;overflow-wrap:anywhere}#mumei-dashboard-sync .status[data-kind=ok]{color:#aaffcf}#mumei-dashboard-sync .status[data-kind=warn],#mumei-dashboard-sync .status[data-kind=partial]{color:#ffd68a}</style><div class="row"><div class="status" role="status" aria-live="polite"></div><button id="mumei-dash-read">再読込</button><button id="mumei-dash-close" aria-label="読込パネルを閉じる">×</button></div>`;
    document.body.append(panel);status=panel.querySelector('.status');setStatus(`INSIGHT ダッシュボード v${VERSION}｜起動しました`);
    panel.querySelector('#mumei-dash-read').onclick=()=>void syncNow();
    panel.querySelector('#mumei-dash-close').onclick=()=>{panel.remove();panel=null;status=null};
  }
  window.addEventListener('DOMContentLoaded',mount,{once:true});
  document.addEventListener('mumei-dashboard-mount',mount);
  if(document.readyState!=='loading')mount();
})();
