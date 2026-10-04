// ==UserScript==
// @name         無名S note INSIGHT｜公式Dashboard同期
// @namespace    https://mumei-s.github.io/note-insight/
// @version      1.6.6
// @description  note公式Dashboardを本人アカウント完全一致でINSIGHTへ自動同期。インプレッション・PV・スキ・コメント・売上・流入元・日別系列・記事/メンシプ/マガジン対応。本人通知とは独立しています。
// @match        https://note.com/sitesettings/stats*
// @match        https://note.com/dashboard*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// ==/UserScript==

(function startDashboardCore() {
  'use strict';
  if(location.origin!=='https://note.com')return;
  const featureOn=()=>window.__mumeiDashboardFeatureV1?.isEnabled?.()!==false;
  if(!featureOn()){
    const resume=()=>{if(featureOn()){window.removeEventListener('mumei-dashboard-feature-changed',resume);startDashboardCore()}};
    window.addEventListener('mumei-dashboard-feature-changed',resume);return;
  }
  if(!/^\/(?:sitesettings\/stats|dashboard)(?:\/|$)/.test(location.pathname)){
    // SPA navigation from a normal note page must start the reader only on the dashboard.
    document.addEventListener('mumei-dashboard-mount',function enterDashboard(){
      if(!/^\/(?:sitesettings\/stats|dashboard)(?:\/|$)/.test(location.pathname))return;
      document.removeEventListener('mumei-dashboard-mount',enterDashboard);startDashboardCore();
    });return;
  }
  if(!document.documentElement){const ready=new MutationObserver(()=>{if(document.documentElement){ready.disconnect();startDashboardCore()}});ready.observe(document,{childList:true});return}
  const VERSION='1.6.6';
  if(document.documentElement?.getAttribute('data-mumei-dashboard-core'))return;
  document.documentElement?.setAttribute('data-mumei-dashboard-core',VERSION);
  const TOKEN_API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-import-token';
  const DASH_API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-data';
  const TOKEN_KEY='mumei-dashboard-ingest-token-v1';
  const NOTE_KEY='mumei-dashboard-note-id-v1';
  const MODE_KEY='mumei_insight_dashboard_auto_enabled_v1';
  let fallbackAutomatic=localStorage.getItem(MODE_KEY)!=='false',activeReadAutomatic=false,modeResumePending=false;
  const autoOn=()=>window.__mumeiDashboardFeatureV1?.isAutomatic?.()??fallbackAutomatic;
  const CAPTURE=[];
  let panel=null,panelResizeObserver=null,status=null,busy=false,pendingStats=0,captureRevision=0,autoTimer=0,lastSnapshotSignature='',lastCollection=null,autoBlockedScope=null,lastCaptureDataSignature='',resumeLabel='',readStage='準備',cancelRequested=false,stickyStatus=null,lastPresentation=null,runStarted=0,viewLease=null,userViewChanged=false,featureResumePending=false;
  const CHECKPOINT_KEY='mumei-dashboard-read-checkpoint-v1',CHECKPOINT_AGE=10*60*1000;
  const HISTORY_KEY='mumei-dashboard-read-history-v1';
  let historyRows=[],historyAccount=localStorage.getItem(NOTE_KEY);
  try{const saved=JSON.parse(sessionStorage.getItem(HISTORY_KEY)||'null');if(saved?.version===VERSION&&saved.noteId===localStorage.getItem(NOTE_KEY)&&Array.isArray(saved.rows)){historyRows=saved.rows.slice(-40);if(saved.sticky){stickyStatus=saved.sticky;lastPresentation=saved.sticky;autoBlockedScope={}}}}catch{}
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const num=(v)=>{if(v==null)return 0;const s=String(v).replace(/[￥¥円,%\s]/g,'').replace(/,/g,'');const n=Number(s);return Number.isFinite(n)?n:0};
  const text=(v)=>String(v??'').replace(/\s+/g,' ').trim();
  const uniq=(rows,keyFn)=>{const m=new Map();for(const r of rows){const k=keyFn(r);if(k&&!m.has(k))m.set(k,r);else if(k)m.set(k,{...m.get(k),...r})}return [...m.values()]};
  function xhr(url,body,headers={},timeout=60000){return new Promise((resolve,reject)=>(typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:typeof GM!=='undefined'&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest.bind(GM):()=>reject(new Error('DASHBOARD_REQUEST_UNAVAILABLE')))({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{}if(r.status>=200&&r.status<300&&p?.ok!==false){resolve(p);return}if(r.status===402){reject(new Error('INSIGHT保存先がSupabaseの利用制限中です [HTTP_402]'));return}reject(new Error(p?.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))}))}
  function cleanUrl(){const u=new URL(location.href);for(const k of ['mumei_dashboard_pair','mumei_dashboard_sync','mumei_dashboard_return'])u.searchParams.delete(k);history.replaceState(history.state,'',u.href)}
  function safeReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
  async function currentNoteId(){const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store',signal:c.signal});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=text(u?.urlname||u?.url_name||u?.username).replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?id:''}catch{return''}finally{clearTimeout(timer)}}
  let surfaceSuspended=false,surfaceActive=true;
  function notificationSurface(){
    const visible=el=>{for(let p=el;p&&p!==document.documentElement;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.hasAttribute('inert')||p.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden'||s.opacity==='0')return false}return el.isConnected};
    for(const el of document.querySelectorAll('[data-mumei-notice-shell-v2958="1"],[data-mumei-notice-shell-v3="1"],.m-navbarNotice,[class*="navbarNoticeList"],[role="dialog"],[role="menu"],[popover]')){
      if(el.closest('#mumei-dashboard-sync'))continue;
      if(!visible(el))continue;
      if(el.matches('[data-mumei-notice-shell-v2958="1"],[data-mumei-notice-shell-v3="1"]')||el.matches('[role="dialog"],[role="menu"],[popover]')&&/通知|お知らせ|notification/i.test(el.getAttribute('aria-label')||''))return true;
      const labels=[...el.querySelectorAll('a,button,[role="tab"]')].filter(visible).map(x=>text(x.textContent));if(labels.some(x=>/^通知(?:\s*\d+)?$/.test(x))&&labels.some(x=>x==='お知らせ'))return true;
      if(el.matches('.m-navbarNotice,[class*="navbarNoticeList"]')&&[...el.querySelectorAll('.m-navbarNoticeItem,[class*="navbarNoticeItem"],[data-testid="notification-item"]')].some(visible))return true;
    }
    // The mobile bell can render as an ordinary sheet with no dialog/class hint.
    const tabs=[...document.querySelectorAll('a,button,[role="tab"],[role="button"]')].filter(el=>/^(?:通知|お知らせ)(?:\s*\d+)?$/.test(text(el.textContent))&&!el.closest('#mumei-dashboard-sync')&&visible(el));
    const notices=tabs.filter(el=>/^通知(?:\s*\d+)?$/.test(text(el.textContent))),news=tabs.filter(el=>/^お知らせ(?:\s*\d+)?$/.test(text(el.textContent)));
    for(const n of notices)for(const o of news){let p=n.parentElement;for(let i=0;i<6&&p&&p!==document.body;i++,p=p.parentElement)if(p.contains(o))return true}
    return false;
  }
  const isDashboardRoute=()=>location.origin==='https://note.com'&&/^\/(?:sitesettings\/stats|dashboard)(?:\/|$)/.test(location.pathname);
  const isDashboard=()=>featureOn()&&isDashboardRoute()&&document.visibilityState!=='hidden'&&!notificationSurface();
  const statsUrl=url=>{try{const u=new URL(url,location.href);return u.origin==='https://note.com'&&/^\/api\/v\d+\/(?:stats|dashboards?|analytics)(?:\/|$)/.test(u.pathname)}catch{return false}};
  const graphqlUrl=url=>{try{const u=new URL(url,location.href);return u.origin==='https://graphql.note.com'&&u.pathname==='/graphql'}catch{return false}};
  const contentTab=el=>/^(?:記事|マガジン|メンバーシップ)$/.test(text(el.getAttribute('aria-label')||el.textContent));
  const connectionKey=()=>JSON.stringify([localStorage.getItem(NOTE_KEY),localStorage.getItem(TOKEN_KEY)]);
  const dashboardRouteRoot=()=>location.pathname.match(/^\/(?:sitesettings\/stats|dashboard)(?=\/|$)/)?.[0]||'';
  const usableLease=()=>viewLease&&viewLease.root===dashboardRouteRoot()&&viewLease.connection===connectionKey();
  function renderedPeriodKey(){
    const p=detectPeriod();
    // Selected navigation and chart-metric tabs are not date selectors.
    const tabs=[...dashboardRoot().querySelectorAll('[role="tab"][aria-selected="true"]')].map(el=>text(el.textContent)).filter(label=>/^(?:全期間|過去\d+日間|週間|月間|年間|週|月|年|日|今週|今月|今年)$/.test(label));
    return JSON.stringify([p.periodStart,p.periodEnd,p.periodStart&&p.periodEnd?[]:p.periodType==='all'?['全期間']:tabs]);
  }
  const periodKey=()=>{const raw=renderedPeriodKey();return raw==='[null,null,[]]'&&usableLease()?viewLease.period:raw};
  // A content tab controlled by this reader may remount its dates or change a subroute.
  const dashboardLocation=()=>usableLease()?viewLease.href:location.origin+location.pathname;
  const captureScope=()=>({href:dashboardLocation(),period:periodKey(),connection:connectionKey()});
  const currentCapture=scope=>scope.href===dashboardLocation()&&scope.period===periodKey()&&scope.connection===connectionKey();
  function captureJson(url,payload,scope=captureScope()){
    if(!featureOn()||!isDashboardRoute()||!currentCapture(scope)||!payload||typeof payload!=='object'||(!statsUrl(url)&&!(graphqlUrl(url)&&scope.operation)&&!String(url).startsWith('hydration:')))return;
    const idx=CAPTURE.findIndex(x=>x.url===String(url)&&currentCapture(x));
    if(idx>=0){if(JSON.stringify(CAPTURE[idx].payload)===JSON.stringify(payload)){CAPTURE[idx].at=Date.now();return}CAPTURE.splice(idx,1)}
    CAPTURE.push({url:String(url),payload,...scope,at:Date.now()});if(CAPTURE.length>40)CAPTURE.shift();
    const dataSignature=JSON.stringify([scope,Object.values(mineNetwork()).map(rows=>rows.map(row=>JSON.stringify(row)).sort()),officialDataSignature()]);
    if(dataSignature===lastCaptureDataSignature)return;
    lastCaptureDataSignature=dataSignature;captureRevision++;
    // A period change or a manually opened lazy panel must also reach INSIGHT.
    if(autoOn()&&!busy&&!autoBlockedScope&&!cancelRequested&&isDashboard()&&localStorage.getItem(TOKEN_KEY)&&localStorage.getItem(NOTE_KEY)){
      clearTimeout(autoTimer);autoTimer=setTimeout(()=>void syncNow({automatic:true}),900);
    }
  }

  const pageWindow=()=>{try{return typeof unsafeWindow!=='undefined'?unsafeWindow:window}catch{return window}};
  const originalFetch=window.fetch.bind(window);
  function dashboardRequest(url,body){
    if(!isDashboard())return null;
    if(statsUrl(url))return {key:String(url),scope:captureScope()};
    if(!graphqlUrl(url))return null;
    try{const request=typeof body==='string'?JSON.parse(body):body;
      if(!/^Dashboard_(?:MetricChart|StatPage|StatsLayoutSummary|ReferrerSection)Query$/.test(request?.operationName||''))return null;
      const v=request.variables||{},safe={};for(const k of ['unit','date','endDate','metric','after'])if(v[k]!=null)safe[k]=v[k];
      return {key:String(url)+'#dashboard='+encodeURIComponent(request.operationName+JSON.stringify(safe)),scope:{...captureScope(),operation:request.operationName,metric:metricName(v.metric)}};
    }catch{return null}
  }
  function dashboardGraphPayload(payload){
    // Keep only dashboard results, never unrelated GraphQL account or payment data.
    const data=payload?.data||{},out={};
    for(const key of ['dashboardMetricChart','dashboardNoteListConnection','dashboardSummary','dashboardNoteReferrersChart'])if(data[key]!=null)out[key]=data[key];
    return Object.keys(out).length?{data:out}:null;
  }
  async function capturedResponse(res,request){
    const raw=await res.text();let payload;
    try{payload=JSON.parse(raw)}catch{
      // Apollo can stream deferred GraphQL results as multipart JSON chunks.
      const rows=raw.split(/\r?\n/).filter(line=>line.trim().startsWith('{'));for(const line of rows)try{const part=JSON.parse(line),filtered=dashboardGraphPayload(part);if(filtered)captureJson(request.key,filtered,request.scope);for(const item of part.incremental||[]){const key=item.path?.[0];if(key&&item.data)captureJson(request.key+':'+key,dashboardGraphPayload({data:{[key]:item.data}}),request.scope)}}catch{}return;
    }
    captureJson(request.key,request.scope.operation?dashboardGraphPayload(payload):payload,request.scope);
  }
  function observe(p){
   if(p?.fetch&&!p.fetch.__mumeiDashboardCapture){const original=p.fetch.bind(p),wrapped=async function(...args){
    if(!featureOn()||!isDashboardRoute())return original(...args);
    const url=typeof args[0]==='string'?args[0]:args[0]?.url||'';let body=args[1]?.body;
    if(graphqlUrl(url)&&body==null&&args[0]?.clone)try{body=await args[0].clone().text()}catch{}
    const request=dashboardRequest(url,body);if(request)pendingStats++;
    try{const res=await original(...args);if(request){if(res.ok)capturedResponse(res.clone(),request).catch(()=>{}).finally(()=>pendingStats--);else pendingStats--}return res}catch(e){if(request)pendingStats--;throw e}
   };wrapped.__mumeiDashboardCapture=true;try{p.fetch=wrapped}catch{}}
   const proto=p?.XMLHttpRequest?.prototype;if(!proto||proto.__mumeiDashboardCapture)return;
   const open=proto.open,send=proto.send;
   proto.open=function(method,url,...rest){this.__mumeiDashboardUrl=String(url||'');return open.call(this,method,url,...rest)};
   proto.send=function(...args){if(!featureOn()||!isDashboardRoute())return send.apply(this,args);const request=dashboardRequest(this.__mumeiDashboardUrl,args[0]);if(request)pendingStats++;this.addEventListener('loadend',()=>{try{if(request&&this.status>=200&&this.status<300){const data=this.responseType==='json'?this.response:JSON.parse(this.responseText);captureJson(request.key,request.scope.operation?dashboardGraphPayload(data):data,request.scope)}}catch{}finally{if(request)pendingStats--}},{once:true});try{return send.apply(this,args)}catch(e){if(request)pendingStats--;throw e}};
   proto.__mumeiDashboardCapture=true;
  }
  observe(pageWindow());if(pageWindow()!==window)observe(window);
  const aliases={impressions:['impressions','impression','impression_count','impressionCount'],pageViews:['page_views','pageViews','pageViewCount','pageview','page_view','page_view_count','views','view_count','viewCount','pv','read_count','readCount'],likes:['likes','like_count','likeCount','like'],comments:['comments','comment_count','commentCount','comment'],sales:['sales_yen','salesYen','sales_amount','salesAmount','sales','amount','revenue'],shares:['shares','share_count','shareCount','shared_count']};
  const pick=(o,keys)=>{for(const k of keys)if(o&&Object.prototype.hasOwnProperty.call(o,k)&&num(o[k])>=0)return num(o[k]);return 0};
  const titleOf=o=>text(o?.title||o?.name||o?.note_name||o?.noteName||o?.article_title||o?.articleTitle);
  const urlOf=o=>text(o?.url||o?.note_url||o?.noteUrl||o?.permalink);
  const keyOf=o=>text(o?.key||o?.note_key||o?.noteKey||o?.id||urlOf(o));
  const dateOf=o=>{
    const value=o?.startDate??o?.date??o?.day??o?.target_date??o?.targetDate??o?.aggregated_at??o?.aggregatedAt??o?.timestamp??o?.x;
    if(typeof value==='number'&&value>1e9){const d=new Date(value<1e12?value*1000:value);if(!Number.isNaN(+d))return new Date(+d+9*3600000).toISOString().slice(0,10)}
    const m=text(value).match(/^(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})(?:日|T|$|\s)/);if(!m)return'';
    const day=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const parsed=new Date(day+'T00:00:00Z');return Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===day?day:'';
  };
  function walk(value,visit,depth=0){if(depth>10||value==null)return;if(Array.isArray(value)){for(const x of value.slice(0,6000))walk(x,visit,depth+1);return}if(typeof value!=='object')return;visit(value);for(const v of Object.values(value))if(v&&typeof v==='object')walk(v,visit,depth+1)}
  const metricFields={pageViews:aliases.pageViews,impressions:aliases.impressions,likes:aliases.likes,comments:aliases.comments,salesYen:aliases.sales};
  const optionalNumber=v=>v===null||v===undefined||v===''||typeof v==='boolean'||!['number','string'].includes(typeof v)||!Number.isFinite(Number(String(v).replace(/,/g,'')))?null:Number(String(v).replace(/,/g,''));
  function metricName(v){const k=text(v).toLowerCase();if(k==='page_view')return 'pageViews';for(const[field,names]of Object.entries(metricFields))if(field.toLowerCase()===k||names.some(x=>x.toLowerCase()===k))return field;return({'ページビュー':'pageViews','pv':'pageViews','インプレッション':'impressions','スキ':'likes','コメント':'comments','売上':'salesYen'})[k]||''}
  function mergeMetrics(rows){const m=new Map();for(const r of rows){if(!r.date)continue;const old=m.get(r.date)||{date:r.date,impressions:null,pageViews:null,likes:null,comments:null,salesYen:null};let found=false;for(const f of Object.keys(metricFields)){const v=optionalNumber(r[f]);if(v!==null&&v>=0){old[f]=v;found=true}}if(found)m.set(r.date,old)}return[...m.values()].sort((a,b)=>a.date.localeCompare(b.date))}
  function dailyMetrics(payload,context={}){
   const rows=[];
   const chartDate=value=>{
    const full=dateOf({date:value});if(full)return full;
    const m=text(value).match(/^(\d{1,2})[\/月-](\d{1,2})(?:日)?$/),p=context.period;
    if(!m||!p?.periodStart||!p.periodEnd)return '';
    const matches=[];for(let y=Number(p.periodStart.slice(0,4));y<=Number(p.periodEnd.slice(0,4))&&matches.length<2;y++){const d=dateOf({date:`${y}-${m[1]}-${m[2]}`});if(d&&d>=p.periodStart&&d<=p.periodEnd)matches.push(d)}
    return matches.length===1?matches[0]:'';
   };
   const add=(date,field,value)=>{const day=chartDate(date),n=optionalNumber(value);if(day&&field&&n!==null&&n>=0)rows.push({date:day,[field]:n})};
   function visit(v,field='',depth=0){
    if(depth>10||v==null)return;if(Array.isArray(v)){if(field&&v.length===2&&chartDate(v[0])){add(v[0],field,v[1]);return}for(const x of v.slice(0,6000))visit(x,field,depth+1);return}if(typeof v!=='object')return;
    if(/^(?:month|monthly|week|weekly|year|yearly)$/i.test(text(v.granularity||v.interval)))return;
    field=metricName(v.metric||v.type||v.label||v.name)||field;
    const article=Boolean(titleOf(v)&&(v.note_key||v.noteKey||v.article_key||v.url||v.key)),referrer=Boolean(v.referrer||v.referrer_name||v.source||v.domain||v.host),day=dateOf(v)||chartDate(v.date??v.day??v.x??v.name??v.label);
    if(!article&&!referrer&&!(v.startDate&&v.endDate&&v.startDate!==v.endDate)){
     if(day){for(const[f,names]of Object.entries(metricFields)){const key=names.find(k=>Object.prototype.hasOwnProperty.call(v,k));if(key)add(day,f,v[key])}if(field)add(day,field,v.value??v.count??v.y)}
     const dates=v.labels||v.dates||v.days;
     if(Array.isArray(dates)){
      for(const dataset of (Array.isArray(v.datasets)?v.datasets:Array.isArray(v.series)?v.series:[])){const f=metricName(dataset.label||dataset.name||dataset.key)||field;if(f&&Array.isArray(dataset.data))dates.forEach((d,i)=>add(d,f,dataset.data[i]))}
      if(field&&Array.isArray(v.data))dates.forEach((d,i)=>add(d,field,v.data[i]));
      for(const[k,x]of Object.entries(v)){const f=metricName(k);if(f&&Array.isArray(x))dates.forEach((d,i)=>add(d,f,x[i]))}
     }
     for(const[k,x]of Object.entries(v)){if(field&&/^20\d{2}[-/]\d{1,2}[-/]\d{1,2}$/.test(k))add(k,field,x);else if(x&&typeof x==='object')visit(x,metricName(k)||field,depth+1)}
    }
   }
   visit(payload,context.field||'');return mergeMetrics(rows);
  }
  function mergeChartMetrics(rows){
    const map=new Map();for(const row of rows){const key=row.granularity+row.startDate+row.endDate,old=map.get(key)||{...row};for(const f of Object.keys(metricFields)){const v=optionalNumber(row[f]);if(v!==null&&v>=0)old[f]=v}map.set(key,old)}return [...map.values()].sort((a,b)=>a.startDate.localeCompare(b.startDate));
  }
  function chartMetrics(payload,context={}){
    const rows=[];walk(payload,v=>{const granularity=text(v.granularity).toUpperCase(),field=context.field||metricName(v.metric);if(!['DAY','WEEK','MONTH'].includes(granularity)||!field||!Array.isArray(v.points))return;
      for(const p of v.points){const startDate=dateOf({date:p.startDate}),endDate=dateOf({date:p.endDate}),value=optionalNumber(p.value);if(!startDate||!endDate||startDate>endDate||granularity==='DAY'&&startDate!==endDate||value===null||value<0)continue;rows.push({granularity,startDate,endDate,[field]:value})}
    });return mergeChartMetrics(rows);
  }
  function readHydration(){
    let index=0;
   for(const script of document.querySelectorAll('script[type="application/json"],script#__NEXT_DATA__')){try{const payload=JSON.parse(script.textContent||''),url='hydration:'+index++;if(!CAPTURE.some(c=>c.url===url&&currentCapture(c)&&JSON.stringify(c.payload)===JSON.stringify(payload)))captureJson(url,payload)}catch{}}
  }
  async function refreshChartSources(){
   ensureRunning();
   readHydration();
   // Only the latest observed request for each endpoint belongs to the selected view.
   const latest=new Map();
   const current=CAPTURE.filter(cap=>statsUrl(cap.url)&&currentCapture(cap));
   const urls=current.length?current.filter(cap=>Date.now()-cap.at>10000).map(cap=>cap.url):CAPTURE.some(cap=>statsUrl(cap.url))?[]:(performance.getEntriesByType?.('resource')||[]).map(entry=>entry.name);
   for(const name of urls){if(statsUrl(name)){const url=new URL(name,location.href);latest.set(url.origin+url.pathname,url.href)}}
   await Promise.all([...latest.values()].slice(-8).map(async url=>{const scope=captureScope(),c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);try{const r=await originalFetch(url,{method:'GET',credentials:'include',cache:'no-store',signal:c.signal});if(r.ok)captureJson(url,await r.json(),scope)}catch{}finally{clearTimeout(timer)}}));
  }
  function ensureRunning(){if(!featureOn())throw new Error('パネルOFFのため停止しました [STOPPED]');if(surfaceSuspended||!isDashboard()){surfaceSuspended=true;throw new Error('表示期間または画面が変わりました。ダッシュボードに戻るまで停止します [SURFACE_LEFT]')}if(userViewChanged)throw new Error('表示期間または画面が変わりました。変更前の読込は停止しました [VIEW_CHANGED]');if(cancelRequested)throw new Error('停止しました [STOPPED]')}
  function dashboardText(){const root=dashboardRoot();return root===document.body?[...root.children].filter(el=>el!==panel&&readable(el)).map(el=>el.innerText||el.textContent||'').join('\n'):(root.innerText||root.textContent||'')}
  function dashboardRoot(){return document.querySelector('main,[role="main"]')||document.body}
  function readable(el){
    if(!el?.isConnected||el.closest('#mumei-dashboard-sync,nav,footer,[role="dialog"],[role="menu"],script,style,template,[hidden],[aria-hidden="true"]'))return false;
    for(let node=el;node&&node!==document.body;node=node.parentElement){if(node.tagName==='DETAILS'&&!node.open&&!node.querySelector(':scope > summary')?.contains(el))return false;const css=getComputedStyle(node);if(css.display==='none'||css.visibility==='hidden')return false}
    return true;
  }
  const metricPanel=/アクセス|ビュー|PV|インプレッション|スキ|コメント|売上|収益|流入|日別|グラフ|記事|マガジン|メンバーシップ/i;
  function panelLabel(el){
    const controlled=document.getElementById(el.getAttribute('aria-controls')||'');
    let heading='';for(let p=el.parentElement,depth=0;p&&p!==dashboardRoot()&&depth<4;p=p.parentElement,depth++){
      heading=text(p.querySelector('h2,h3,h4,caption,[role="heading"]')?.textContent)||text(p.querySelector('table thead')?.textContent);if(heading)break;
    }
    return text([el.getAttribute('aria-label'),el.textContent,controlled?.getAttribute('aria-label'),controlled?.querySelector('h2,h3,h4,caption')?.textContent,heading].filter(Boolean).join(' '));
  }
  function panelControls(){return [...dashboardRoot().querySelectorAll('details:not([open]) > summary,button,[role="button"],[role="tab"]')].filter(el=>{
    if(!readable(el)||el.disabled||el.getAttribute('aria-disabled')==='true'||el.hasAttribute('aria-haspopup')||el.matches('a,[type="submit"]'))return false;
    if(contentTab(el))return text(el.getAttribute('aria-label')||el.textContent)!=='マガジン'&&el.getAttribute('aria-selected')!=='true'&&el.getAttribute('aria-pressed')!=='true';
    if(el.matches('[role="tab"]'))return false;
    if(/^(?:過去.*|.*日間|.*順|期間.*|並び替え.*)$/.test(text(el.getAttribute('aria-label')||el.textContent)))return false;
    const disclosure=el.matches('details:not([open]) > summary')||el.getAttribute('aria-expanded')==='false';
    const named=!el.hasAttribute('aria-expanded')&&/^(?:グラフを(?:表示|開く)|詳細を表示|詳細を見る|もっと(?:見る|みる)|さらに表示|続きを表示|開く|表示する)$/.test(text(el.getAttribute('aria-label')||el.textContent));
    return (disclosure||named)&&metricPanel.test(panelLabel(el));
  })}
  function activeContentLabel(){return text([...dashboardRoot().querySelectorAll('[aria-selected="true"],[aria-pressed="true"]')].find(contentTab)?.textContent)}
  function controlKey(el,progress){
    if(contentTab(el))return 'tab:'+text(el.getAttribute('aria-label')||el.textContent);
    const label=panelLabel(el),base=JSON.stringify([progress.activeLabel,el.id,el.getAttribute('aria-controls'),label]);
    // Pagination may reuse one button, but reopening a remounted accordion is not progress.
    return /^(もっと(?:見る|みる)|さらに表示|続きを表示)$/.test(text(el.textContent))?base+JSON.stringify([tableArticles(),dailyTableMetrics()]):base;
  }
  const chartMetricLabels={pageViews:'ページビュー',impressions:'インプレッション',likes:'スキ',comments:'コメント',salesYen:'売上'};
  function metricSelect(){
    return [...dashboardRoot().querySelectorAll('select')].find(el=>{
      if(el.disabled||!el.isConnected||el.closest('#mumei-dashboard-sync'))return false;
      const fields=[...el.options].map(o=>metricName(o.textContent));if(fields.filter(Boolean).length<2||!fields.includes('pageViews'))return false;
      if(readable(el))return true;
      // note's custom select has a native select in its aria-hidden accessibility container.
      const container=el.closest('[aria-hidden="true"]')?.parentElement;
      return Boolean(container&&[...container.querySelectorAll('button,[role="combobox"]')].some(b=>readable(b)&&/グラフに表示する指標/.test(b.getAttribute('aria-label')||'')));
    });
  }
  function metricTrigger(){return [...dashboardRoot().querySelectorAll('button,[role="combobox"]')].find(el=>readable(el)&&!el.disabled&&el.getAttribute('aria-disabled')!=='true'&&(/グラフに表示する指標/.test(el.getAttribute('aria-label')||'')||metricName(text(el.textContent))&&el.getAttribute('aria-haspopup')==='listbox'))}
  function selectedChartMetric(){const select=metricSelect();if(select)return metricName(select.selectedOptions[0]?.textContent);const trigger=metricTrigger();return trigger?metricName(text(trigger.textContent)):''}
  function chartDomMetrics(aggregate=false){
    const rows=[],period=detectPeriod();
    for(const figure of (pageWindow().document.querySelector('main,[role="main"]')||pageWindow().document.body).querySelectorAll('figure[data-name="StackedBarChart"]')){
      if(!readable(figure))continue;
      // Read only this official chart's data props, never the surrounding application's state.
      const fiberKey=Object.getOwnPropertyNames(figure).find(k=>k.startsWith('__reactFiber$'));
      const labelled=(figure.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ');
      const visibleMetric=metricName(text(labelled)||text(figure.querySelector('figcaption')?.textContent))||selectedChartMetric();
      let fallback=[];
      chartParents: for(let fiber=fiberKey&&figure[fiberKey],depth=0;fiber&&depth<16;fiber=fiber.return,depth++){
       // React keeps two trees; the DOM may still point at the previous render's fiber.
       for(const candidate of [fiber,fiber.alternate]){
        const props=candidate?.memoizedProps;
        if(!props||typeof props!=='object')continue;
        const field=metricName(props.seriesLabel||props.title);
        if(!field||(visibleMetric&&field!==visibleMetric))continue;
        if(field&&props.data?.granularity&&Array.isArray(props.data.points)){
          rows.push(...(aggregate?chartMetrics:dailyMetrics)(props.data,{field,period}));fallback=[];break chartParents;
        }
        if(!aggregate&&field&&props.xKey==='label'&&Array.isArray(props.data)&&period.periodStart&&period.periodEnd&&(Date.parse(period.periodEnd)-Date.parse(period.periodStart))/86400000<31){
          fallback=dailyMetrics(props.data,{field,period});
        }
       }
        if(fiber.stateNode===dashboardRoot())break;
      }
      rows.push(...fallback);
    }
    return aggregate?mergeChartMetrics(rows):mergeMetrics(rows);
  }
  async function selectChartMetric(field,href,period){
    ensureRunning();if(!usableLease())viewLease={href,period,root:dashboardRouteRoot(),connection:connectionKey()};
    const select=metricSelect();
    if(select){
      const option=[...select.options].find(o=>metricName(o.textContent)===field);if(!option)return false;
      const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')?.set;
      if(setter)setter.call(select,option.value);else select.value=option.value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }else{
      const trigger=metricTrigger();if(!trigger)return false;trigger.click();
      let option=null;
      for(let tick=0;tick<20;tick++){
        ensureRunning();const id=trigger.getAttribute('aria-controls'),list=id?document.getElementById(id):document.querySelector('[role="listbox"]');
        option=list&&[...list.querySelectorAll('[role="option"]')].find(el=>metricName(text(el.textContent))===field&&el.getAttribute('aria-disabled')!=='true'&&!el.closest('[hidden],[aria-hidden="true"]'));
        if(option)break;await sleep(100);
      }
      if(!option)throw new Error('公式グラフの指標を選択できませんでした [METRIC_OPTION]');
      option.click();
    }
    await waitForDashboard(href,period);
    if(selectedChartMetric()!==field)throw new Error('公式グラフの指標が切り替わりませんでした [METRIC_NOT_SELECTED]');
    return true;
  }
  async function readDashboardCharts(href,period,read,checkpoint){
    if(!metricSelect()&&!metricTrigger())return;
    const progress=checkpoint.progress,graph=progress.graph||(progress.graph={done:[],original:selectedChartMetric(),complete:false});
    if(graph.complete)return;
    const collect=()=>{read.collect(progress.activeLabel);checkpoint.result=read.result;saveCheckpoint(checkpoint)};
    collect();
    // Finish on the initial metric; no endless switching on subsequent saves/retries.
    const fields=[...Object.keys(chartMetricLabels).filter(f=>f!==graph.original),graph.original].filter(Boolean);
    for(const field of fields){
      if(graph.done.includes(field))continue;
      readStage='公式グラフ：'+chartMetricLabels[field];setStatus(readStage+'を自動読込中…');
      if(!await selectChartMetric(field,href,period))continue;
      collect();graph.done.push(field);saveCheckpoint(checkpoint);
    }
    graph.complete=true;saveCheckpoint(checkpoint);
  }
  async function expandDashboardPanels(href,initialPeriod,read,checkpoint){
    const progress=checkpoint.progress;
    const collect=()=>{read.collect(progress.activeLabel);checkpoint.result=read.result;saveCheckpoint(checkpoint)};
    if(progress.pending){
      readStage=progress.pending.label;await waitForDashboard(href,initialPeriod);
      const target=panelControls().find(el=>controlKey(el,progress)===progress.pending.key);
      if(target&&(progress.pending.tab||target.getAttribute('aria-expanded')==='false'))progress.pending=null;
      else{if(progress.pending.tab)progress.activeLabel=progress.pending.label;collect();progress.done.push(progress.pending.key);progress.pending=null;saveCheckpoint(checkpoint)}
    }
    collect();
    if(!progress.started){const active=activeContentLabel();progress.activeLabel=active||'記事';progress.done.push('tab:'+progress.activeLabel);progress.started=true;saveCheckpoint(checkpoint)}
    for(let pass=0;pass<60;pass++){
      ensureRunning();
      if(!isDashboard()||dashboardLocation()!==href||(initialPeriod!==null&&periodKey()!==initialPeriod))throw new Error('表示期間または画面が変わりました。変更前の読込は停止しました [VIEW_CHANGED]');
      await readDashboardCharts(href,initialPeriod,read,checkpoint);
      const candidates=panelControls().filter(el=>!progress.done.includes(controlKey(el,progress)));
      const control=candidates.find(el=>!contentTab(el))||candidates[0];
      if(!control){
        if(!progress.scannedBottom){progress.scannedBottom=true;dashboardRoot().lastElementChild?.scrollIntoView?.({block:'end',behavior:'instant'});await waitForDashboard(href,initialPeriod);collect();continue}
        progress.complete=true;saveCheckpoint(checkpoint);return progress.opened;
      }
      const key=controlKey(control,progress),tab=contentTab(control),label=text(control.getAttribute('aria-label')||control.textContent);
      progress.pending={key,tab,label};readStage=label;saveCheckpoint(checkpoint);
      if(!usableLease())viewLease={href,period:initialPeriod,root:dashboardRouteRoot(),connection:connectionKey()};
      control.scrollIntoView?.({block:'center',behavior:'instant'});control.click();progress.opened++;
      setStatus(`公式パネルを読込中… ${label}（取得済み ${read.result.articles.length}件）`);
      await waitForDashboard(href,initialPeriod);
      if(panelControls().some(el=>controlKey(el,progress)===key&&el.getAttribute('aria-expanded')==='false')){progress.pending=null;saveCheckpoint(checkpoint);throw new Error('公式パネルを開けませんでした：'+label+' [PANEL_NOT_OPEN]')}
      if(tab&&activeContentLabel()&&activeContentLabel()!==label){progress.pending=null;saveCheckpoint(checkpoint);throw new Error('公式タブを切り替えられませんでした：'+label+' [TAB_NOT_OPEN]')}
      if(tab)progress.activeLabel=label;
      collect();progress.done.push(key);progress.pending=null;saveCheckpoint(checkpoint);
    }
    throw new Error('公式パネルが60回以上更新されました。取得済みの続きで停止しています [PANEL_LIMIT]');
  }
  function officialDataSignature(){
    // Live help text and response timestamps are not dashboard values.
    return JSON.stringify([tableArticles(),dailyTableMetrics(),chartDomMetrics(),detectTotals(),detectSummary(),detectTraffic(),panelControls().map(el=>[panelLabel(el),el.getAttribute('aria-expanded')])]);
  }
  async function waitForDashboard(href,initialPeriod){
    let quiet=0,previous='';
    for(let tick=0;tick<60;tick++){
      ensureRunning();
      if(!isDashboard()||dashboardLocation()!==href||(initialPeriod!==null&&periodKey()!==initialPeriod))throw new Error('表示期間または画面が変わりました。変更前の読込は停止しました [VIEW_CHANGED]');
      const loading=[...dashboardRoot().querySelectorAll('[aria-busy="true"],[role="progressbar"]:not([aria-valuenow])')].some(readable);
      const signature=JSON.stringify([captureRevision,officialDataSignature()]);
      quiet=!pendingStats&&!loading&&signature===previous?quiet+1:0;previous=signature;
      if(quiet>=6)return;
      if(tick%4===0)setStatus(`公式データを読込中…${pendingStats?' 通信 '+pendingStats+'件':''}`);
      await sleep(250);
    }
    throw new Error('公式データの待機が15秒を超えました [READ_WAIT]');
  }

  function mineNetwork(){const articles=[],sources=[],trafficSeries=[],metricRows=[],chartRows=[];for(const cap of CAPTURE){if(!currentCapture(cap))continue;
    const official=cap.payload?.data||{};
    for(const edge of official.dashboardNoteListConnection?.edges||[]){const o=edge.node,n=o?.note,m=o?.metrics;if(!n?.title||!m)continue;const url=text(n.link?.absoluteUrl),pv=pick(m,aliases.pageViews);articles.push({key:url||text(o.id),title:text(n.title),url,impressions:pick(m,aliases.impressions),pageViews:pv,views:pv,likes:pick(m,aliases.likes),comments:pick(m,aliases.comments),salesYen:pick(m,aliases.sales),contentType:'article',status:text(n.status).toLowerCase(),publishedAt:text(n.publishedAt)})}
    const referrers=official.dashboardNoteReferrersChart;
    for(const row of referrers?.legend||[]){const pv=optionalNumber(row.count);if(text(row.name)&&pv!==null)sources.push({source:text(row.name),pv})}
    const chart=referrers?.timeSeriesBarChart;
    if(chart&&Array.isArray(chart.labels))for(const series of chart.data||[])for(let i=0;i<chart.labels.length;i++){const date=dateOf({date:chart.labels[i]}),pv=optionalNumber(series.data?.[i]);if(date&&pv!==null)trafficSeries.push({date,source:text(series.label),pv})}
    chartRows.push(...chartMetrics(cap.payload,{field:cap.metric}));metricRows.push(...dailyMetrics(cap.payload,{field:cap.metric}));walk(cap.payload,o=>{const title=titleOf(o),url=urlOf(o),key=keyOf(o),pv=pick(o,aliases.pageViews),imp=pick(o,aliases.impressions),likes=pick(o,aliases.likes),comments=pick(o,aliases.comments),sales=pick(o,aliases.sales),shares=pick(o,aliases.shares),date=dateOf(o);if(title&&(url||key)&&(pv||imp||likes||comments||sales||shares)){articles.push({key:key||url,title,url,impressions:imp,pageViews:pv,views:pv,likes,comments,salesYen:sales,shares,status:text(o.status),publishedAt:text(o.published_at||o.publishedAt||o.publish_at),contentType:text(o.content_type||o.contentType||'article')})}const source=text(o.referrer||o.referrer_name||o.source||o.domain||o.host);const spv=pick(o,['pv','page_views','pageViews','count','value']);if(source&&spv&&!/^https?:/i.test(source)&&source.length<100){if(date)trafficSeries.push({date,source,pv:spv});else sources.push({source,pv:spv})}})}return{articles:uniq(articles,r=>r.url||r.key||r.title),sources:uniq(sources,r=>r.source.toLowerCase()),trafficSeries,metricSeries:mergeMetrics(metricRows),chartSeries:mergeChartMetrics(chartRows)}}
  function dashboardNetworkTotals(){
    const totals={};for(const cap of CAPTURE){if(!currentCapture(cap))continue;const values=cap.payload?.data?.dashboardSummary?.metrics;if(!values)continue;for(const [field,names]of Object.entries(metricFields)){const key=names.find(k=>Object.prototype.hasOwnProperty.call(values,k)),value=optionalNumber(values[key]);if(value!==null&&value>=0)totals[field]=value}}
    return totals;
  }
  function labelledNumber(label){
    const labelOnly=new RegExp('^(?:'+label+')$','i'),value='([￥¥]?[0-9][0-9,]*(?:\\.[0-9]+)?(?:円)?)';
    const before=new RegExp('^'+value+'\\s*(?:'+label+')$','i'),after=new RegExp('^(?:'+label+')[\\s：:]*'+value+'$','i');
    const elements=[...dashboardRoot().querySelectorAll('p,span,div,strong,b,dt,dd,h2,h3')].filter(el=>readable(el)&&!el.closest('table,[role="table"]'));
    for(const el of elements){const content=text(el.textContent),match=content.match(before)||content.match(after);if(match)return num(match[1])}
    for(const el of elements.filter(el=>labelOnly.test(text(el.textContent)))){
      for(let container=el.parentElement,depth=0;container&&depth<3;container=container.parentElement,depth++){
        const labels=[...container.querySelectorAll('*')].filter(x=>!x.children.length&&/^(インプレッション|ページビュー|全体ビュー|ビュー数|スキ|コメント|売上)$/.test(text(x.textContent)));
        if(labels.some(x=>!labelOnly.test(text(x.textContent))))break;
        const values=[...container.querySelectorAll('*')].filter(x=>!x.children.length&&readable(x)&&/^[￥¥]?[0-9][0-9,]*(?:\.[0-9]+)?円?$/.test(text(x.textContent)));
        if(values.length===1)return num(values[0].textContent);
      }
    }
    return null;
  }

  function detectTotals(){const body=dashboardText();return{impressions:labelledNumber('インプレッション',body),pageViews:labelledNumber('(?:ページビュー|全体ビュー|ビュー数)',body),likes:labelledNumber('スキ',body),comments:labelledNumber('コメント',body),salesYen:labelledNumber('売上',body)}}
  const periodLabels={week:'過去7日間',month:'過去28日間',all:'全期間'};
  function periodSelect(){return [...dashboardRoot().querySelectorAll('select')].find(el=>[...el.options].some(o=>text(o.textContent)==='全期間')&&[...el.options].some(o=>text(o.textContent)==='過去28日間'))}
  function periodTrigger(){return [...dashboardRoot().querySelectorAll('button,[role="combobox"]')].find(el=>readable(el)&&el.getAttribute('aria-label')==='期間選択')}
  function selectedPeriodType(){const select=periodSelect(),label=text(select?.selectedOptions[0]?.textContent||periodTrigger()?.textContent);return Object.keys(periodLabels).find(k=>periodLabels[k]===label)||'custom'}
  async function selectRequestedPeriod(href){
    let request;try{request=JSON.parse(sessionStorage.getItem('mumei-dashboard-requested-period')||'null')}catch{}if(!request||request.noteId!==localStorage.getItem(NOTE_KEY)||!periodLabels[request.period])return;
    await waitForDashboard(href,null);
    if(selectedPeriodType()!==request.period){
      viewLease=null;const select=periodSelect();
      if(select){const option=[...select.options].find(o=>text(o.textContent)===periodLabels[request.period]);if(!option||select.disabled)throw new Error('期間を選択できませんでした [PERIOD_SELECT]');const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')?.set;if(setter)setter.call(select,option.value);else select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}))}
      else{const trigger=periodTrigger();if(!trigger)throw new Error('期間選択が見つかりません [PERIOD_SELECT]');trigger.click();let option;for(let i=0;i<20;i++){ensureRunning();option=[...document.querySelectorAll('[role="listbox"] [role="option"]')].find(el=>text(el.textContent)===periodLabels[request.period]&&el.getAttribute('aria-disabled')!=='true');if(option)break;await sleep(100)}if(!option)throw new Error('期間を選択できませんでした [PERIOD_SELECT]');option.click()}
      await waitForDashboard(href,null);
      if(selectedPeriodType()!==request.period)throw new Error('指定の期間へ切り替わりませんでした [PERIOD_SELECT]');
    }
    sessionStorage.removeItem('mumei-dashboard-requested-period');
  }
  function detectPeriod(){const periodType=selectedPeriodType();if(periodType==='all')return{periodType,periodStart:null,periodEnd:null};const body=dashboardText(),range=body.match(/(20\d{2})[\/.年-](\d{1,2})[\/.月-](\d{1,2})(?:日)?\s*(?:〜|～|~|-|–|—)\s*(?:(20\d{2})[\/.年-])?(\d{1,2})[\/.月-](\d{1,2})/);if(!range)return{periodType,periodStart:null,periodEnd:null};const year2=range[4]||range[1],pad=x=>String(x).padStart(2,'0');return{periodType,periodStart:`${range[1]}-${pad(range[2])}-${pad(range[3])}`,periodEnd:`${year2}-${pad(range[5])}-${pad(range[6])}`}}
  function detectCollected(){const m=(dashboardText()).match(/(20\d{2})[\/.年](\d{1,2})[\/.月](\d{1,2})[^\d]+(\d{1,2}):(\d{2})\s*集計/);if(!m)return null;const p=x=>String(x).padStart(2,'0');return`${m[1]}-${p(m[2])}-${p(m[3])}T${p(m[4])}:${p(m[5])}:00+09:00`}
  function detectTraffic(){const body=dashboardText(),rows=[];const rx=/(^|\n)\s*([A-Za-z0-9._-]+|X|Facebook|Instagram|no referrer|other)\s+([0-9.]+)%\s*\(([0-9,]+)PV\)/g;let m;while((m=rx.exec(body)))rows.push({source:text(m[2]),percent:num(m[3]),pv:num(m[4])});return uniq(rows,r=>r.source.toLowerCase())}
  function detectSummary(){const body=dashboardText(),a=body.match(/記事数\s*([0-9,]+)\s*本/),s=body.match(/シェアされた記事\s*([0-9,]+)\s*回/),r=body.match(/収益\s*[￥¥]?\s*([0-9,]+)/);return{articles:a?num(a[1]):0,sharedArticles:s?num(s[1]):0,revenueYen:r?num(r[1]):0}}
  function tableArticles(contentType='article'){const out=[];for(const table of dashboardRoot().querySelectorAll('table')){if(!readable(table))continue;const headers=[...table.querySelectorAll('thead th')].map(x=>text(x.textContent));if(!headers.some(x=>/タイトル|^記事$/.test(x)))continue;const idx=(rx)=>headers.findIndex(x=>rx.test(x));const I={title:idx(/タイトル|^記事$/),imp:idx(/インプレッション/),pv:idx(/ページビュー|PV|^ビュー$/),like:idx(/スキ/),comment:idx(/コメント/),sales:idx(/売上/)};for(const tr of table.querySelectorAll('tbody tr')){if(!readable(tr))continue;const cells=[...tr.querySelectorAll('td')];if(!cells.length)continue;const c=i=>i>=0?text(cells[i]?.textContent):'';const a=tr.querySelector('a[href*="/n/"]');const title=c(I.title)||text(a?.textContent);if(!title)continue;const url=a?.href||'';out.push({key:url||title,title,url,impressions:num(c(I.imp)),pageViews:num(c(I.pv)),views:num(c(I.pv)),likes:num(c(I.like)),comments:num(c(I.comment)),salesYen:num(c(I.sales)),contentType,status:/公開中/.test(text(tr.textContent))?'published':'',publishedAt:(text(tr.textContent).match(/20\d{2}年\d{1,2}月\d{1,2}日/)||[])[0]||''})}}return out}
  function dailyTableMetrics(){
    const rows=[];
    for(const table of dashboardRoot().querySelectorAll('table,[role="table"]')){
      if(!readable(table))continue;
      const headers=[...table.querySelectorAll('thead th,[role="columnheader"]')].map(el=>text(el.textContent));
      const dayIndex=headers.findIndex(h=>/^(日付|年月日|集計日)$/.test(h));if(dayIndex<0)continue;
      const fields=headers.map(metricName);if(!fields.some(Boolean))continue;
      for(const tr of table.querySelectorAll('tbody tr,[role="row"]')){
        if(!readable(tr))continue;const cells=[...tr.querySelectorAll('td,[role="cell"]')];
        const date=dateOf({date:text(cells[dayIndex]?.textContent)});if(!date)continue;
        const row={date};fields.forEach((field,i)=>{if(field){const n=optionalNumber(text(cells[i]?.textContent));if(n!==null)row[field]=n}});rows.push(row);
      }
    }
    return mergeMetrics(rows);
  }
  function currentContentType(){const label=text([...dashboardRoot().querySelectorAll('[role="tab"][aria-selected="true"]')].find(contentTab)?.textContent);return label==='マガジン'?'magazine':label==='メンバーシップ'?'membership':'article'}
  function collector(seed){
    let activeType=currentContentType();
    const result=seed?JSON.parse(JSON.stringify(seed)):{articles:[],sources:[],trafficSeries:[],metricSeries:[],chartSeries:[],totals:{},summary:{}},freshTotals=new Set();
    return {result,collect(label=''){
      if(label)activeType=label==='マガジン'?'magazine':label==='メンバーシップ'?'membership':'article';
      readHydration();const mined=mineNetwork();
      result.articles=uniq([...result.articles,...mined.articles,...(activeType==='magazine'?[]:tableArticles(activeType))],r=>r.url||r.key||r.title);
      result.sources=uniq([...result.sources,...mined.sources,...detectTraffic()],r=>r.source.toLowerCase());
      result.trafficSeries=uniq([...result.trafficSeries,...mined.trafficSeries],r=>r.date+':'+r.source);
      // React may expose the previous period's chart props until its next metric render.
      // Replace each metric's buckets as a set; never append stale DAY points to MONTH history.
      let charts=result.chartSeries||[];const domCharts=chartDomMetrics(true);
      for(const field of Object.keys(metricFields)){
        const network=mined.chartSeries.filter(r=>r[field]!=null),current=network.length?network:domCharts.filter(r=>r[field]!=null);
        if(!current.length)continue;
        charts=charts.map(r=>({...r,[field]:null}));
        charts.push(...current.map(r=>({granularity:r.granularity,startDate:r.startDate,endDate:r.endDate,[field]:r[field]})));
      }
      result.chartSeries=mergeChartMetrics(charts).filter(r=>Object.keys(metricFields).some(f=>r[f]!=null));
      result.metricSeries=mergeMetrics([...result.metricSeries,...mined.metricSeries,...dailyTableMetrics(),...chartDomMetrics()]);
      for(const field of Object.keys(metricFields))if(result.chartSeries.some(r=>r[field]!=null&&r.granularity!=='DAY'))result.metricSeries.forEach(r=>r[field]=null);
      result.metricSeries=result.metricSeries.filter(r=>Object.keys(metricFields).some(f=>r[f]!=null));
      for(const [key,value]of Object.entries({...detectTotals(),...dashboardNetworkTotals()}))if(value!==null&&!freshTotals.has(key)){result.totals[key]=value;freshTotals.add(key)}
      for(const [key,value]of Object.entries(detectSummary()))if(value)result.summary[key]=value;
    }};
  }
  async function checkpointHash(scope){
    try{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(scope)));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')}catch{return ''}
  }
  function saveCheckpoint(checkpoint){
    checkpoint.at=Date.now();lastCollection=checkpoint;
    if(!checkpoint.hash)return;
    // Store data and progress in this tab only; never copy the connection token.
    const {scope,...safe}=checkpoint;
    try{sessionStorage.setItem(CHECKPOINT_KEY,JSON.stringify({...safe,version:VERSION}))}catch{/* Memory checkpoint still permits retry if browser storage is full. */}
  }
  async function getCheckpoint(scope){
    if(lastCollection&&currentCapture(lastCollection.scope)&&Date.now()-lastCollection.at<CHECKPOINT_AGE)return lastCollection;
    const hash=await checkpointHash(scope);
    if(hash)try{const cached=JSON.parse(sessionStorage.getItem(CHECKPOINT_KEY)||'null');if(cached?.version===VERSION&&cached.hash===hash&&Date.now()-cached.at<CHECKPOINT_AGE&&cached.result&&cached.progress){lastCollection={...cached,scope};return lastCollection}}catch{}
    // A loading page may not expose its period yet; keep the last checkpoint until a new read is collected.
    return {scope,hash,period:detectPeriod(),at:Date.now(),result:null,progress:{started:false,activeLabel:activeContentLabel()||'記事',done:[],opened:0,pending:null,complete:false},pendingSave:null};
  }
  async function syncNow({automatic=false}={}){
    // A different/temporarily absent period must never restart a failed run.
    if(automatic&&(!autoOn()||autoBlockedScope||stickyStatus||cancelRequested))return;
    if(busy||!isDashboard())return;clearTimeout(autoTimer);cancelRequested=false;userViewChanged=false;stickyStatus=null;resumeLabel='';busy=true;activeReadAutomatic=automatic;runStarted=Date.now();mount();setStatus('公式データを確認中…');
    const tokenAtStart=localStorage.getItem(TOKEN_KEY);let runScope=captureScope(),checkpoint=null,connectionVerified=false;
    if(!automatic){autoBlockedScope=null;surfaceSuspended=false}
    const button=panel?.querySelector('#mumei-dash-read');if(button)button.disabled=true;
    try{
      readStage='保存先の本人確認';
      const startLocation=dashboardLocation(),paired=(localStorage.getItem(NOTE_KEY)||'').toLowerCase(),current=await currentNoteId();
      ensureRunning();
      if(!paired)throw new Error('INSIGHTの分析からダッシュボードを連携してください');
      if(!current)throw new Error('noteへのログインを確認してください');
      if(current!==paired)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${paired}`);
      const token=localStorage.getItem(TOKEN_KEY)||'';if(!token)throw new Error('INSIGHTの分析からダッシュボードを再連携してください');
      setStatus('保存先の連携を確認中…');
      const connection=await xhr(DASH_API,{action:'sync-status',noteId:paired},{'X-Ingest-Token':token});
      if(connection.noteId!==paired||connection.paired!==true)throw new Error('保存先の確認ができませんでした');
      connectionVerified=true;ensureRunning();
      for(let i=0;i<20;i++){if(!isDashboard()||dashboardLocation()!==startLocation)return;if(dashboardRoot().querySelector('details,[aria-expanded],table')||detectTotals().pageViews!==null||mineNetwork().metricSeries.length)break;await sleep(250)}
      await selectRequestedPeriod(startLocation);
      let selectedPeriod=periodKey(),scope=captureScope();runScope=scope;
      checkpoint=await getCheckpoint(scope);
      if(!checkpoint.pendingSave){
        readStage=checkpoint.progress.pending?.label||'表示中の公式データ';
        await waitForDashboard(startLocation,checkpoint.progress.started?selectedPeriod:null);
        if(periodKey()!==selectedPeriod){selectedPeriod=periodKey();scope=captureScope();runScope=scope;checkpoint=await getCheckpoint(scope)}
        if(!checkpoint.pendingSave){
        const read=collector(checkpoint.result);
        if(!checkpoint.progress.complete)await expandDashboardPanels(startLocation,selectedPeriod,read,checkpoint);
        await refreshChartSources();await waitForDashboard(startLocation,selectedPeriod);read.collect();
        const mined=read.result,articles=mined.articles;
        checkpoint.result=mined;saveCheckpoint(checkpoint);
        const totals={impressions:null,pageViews:null,likes:null,comments:null,salesYen:null,...mined.totals};
        if(!articles.length&&totals.pageViews===null&&totals.impressions===null&&!mined.metricSeries.length)throw new Error('表示中の公式データを取得できませんでした [NO_DATA]');
        const payload={action:'ingest',schemaVersion:5,connectorVersion:VERSION,noteId:paired,articles,totals,
          trafficSources:mined.sources,trafficSeries:mined.trafficSeries,metricSeries:mined.metricSeries,chartSeries:mined.chartSeries,summary:mined.summary,
          contentSections:{article:{count:articles.length,scope:'current-period-expanded'},openedPanels:checkpoint.progress.opened},officialCollectedAt:detectCollected(),...checkpoint.period,pages:1};
        const signature=JSON.stringify([connectionKey(),{...payload,contentSections:{article:payload.contentSections.article}}]);
        if(signature===lastSnapshotSignature){setStatus(localStorage.getItem('mumei-dashboard-last-result:'+paired)||'取得済みデータを保存済み',mined.metricSeries.some(r=>r.pageViews!==null)?'ok':'partial');return}
        checkpoint.pendingSave={payload,readRevision:captureRevision,readSignature:officialDataSignature(),saved:null};saveCheckpoint(checkpoint);
        }
      }
      const pending=checkpoint.pendingSave,{payload}=pending,{articles,totals}=payload,dailyPvDays=payload.metricSeries.filter(r=>r.pageViews!==null).length,chartCount=payload.chartSeries?.length||0;
      const checkAccount=async()=>{ensureRunning();const actual=await currentNoteId();ensureRunning();if(!currentCapture(scope)||localStorage.getItem(NOTE_KEY)?.toLowerCase()!==paired||localStorage.getItem(TOKEN_KEY)!==token||actual!==paired)throw new Error('DASHBOARD_ACCOUNT_MISMATCH')};
      readStage='取得済みデータの保存';await checkAccount();
      if(!pending.saved){
        setStatus(`読込 記事${articles.length}件／日別PV ${dailyPvDays}日 → 保存中…`);
        const saved=await xhr(DASH_API,payload,{'X-Ingest-Token':token});
        if(!saved.snapshotId)throw new Error('保存応答に記録番号がありません [SAVE_RESPONSE]');
        pending.saved=saved;saveCheckpoint(checkpoint);
      }
      ensureRunning();const saved=pending.saved;readStage='保存結果の照合';
      setStatus(`読込 記事${articles.length}件／日別PV ${dailyPvDays}日 → 保存を照合中…`);
      const verified=await xhr(DASH_API,{action:'sync-status',noteId:paired,snapshotId:saved.snapshotId},{'X-Ingest-Token':token});
      if(verified.noteId!==paired||String(verified.snapshotId)!==String(saved.snapshotId)||verified.confirmed!==true||Number(verified.articleCount)!==articles.length||Number(verified.dailyPvDays)!==dailyPvDays||Number(verified.dailyMetricCount)!==payload.metricSeries.length)throw new Error('保存件数が一致しません [SAVE_COUNT]');
      if(chartCount&&Number(verified.chartMetricCount)!==chartCount)throw new Error('保存したグラフ件数が一致しません [SAVE_COUNT]');
      for(const key of Object.keys(totals))if(totals[key]!==null&&optionalNumber(verified.totals?.[key])!==totals[key])throw new Error('保存した数値を確認できません [SAVE_VALUE]');
      await checkAccount();
      checkpoint.pendingSave=null;saveCheckpoint(checkpoint);resumeLabel='';
      const count=Number(verified.dailyPvDays),at=new Date(verified.capturedAt||saved.capturedAt||Date.now()).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'});
      localStorage.setItem('mumei-dashboard-last-sync',String(Date.now()));
      const longPeriod=payload.periodStart&&payload.periodEnd&&Date.parse(payload.periodEnd)-Date.parse(payload.periodStart)>30*86400000;
      const missingDaily=longPeriod?'選択期間が32日以上のため、公式グラフは週・月単位です。期間合計と記事別は保存済みですが、今回の日別PVはありません':'自動取得で日別値を確認できませんでした。日別の推移・曜日分析には今回の値を使えません';
      const graphSaved=payload.chartSeries?.some(r=>r.pageViews!=null),complete=count||graphSaved;
      const message=complete?`✓ 同期完了 ${at}｜保存確認 記事${verified.articleCount}件・${count?'日別PV '+count+'日':'全期間グラフ '+chartCount+'点'}`:`保存済み ${at}｜記事${verified.articleCount}件・日別PV 0日（未取得：${missingDaily}）`;
      lastSnapshotSignature=JSON.stringify([connectionKey(),{...payload,contentSections:{article:payload.contentSections.article}}]);
      localStorage.setItem('mumei-dashboard-last-result:'+paired,message);
      if(captureRevision!==pending.readRevision||officialDataSignature()!==pending.readSignature){if(autoOn()){setStatus('保存確認済み｜遅れて届いた公式データを追加読込中…');autoTimer=setTimeout(()=>void syncNow({automatic:true}),900)}else setStatus('保存確認済み｜追加データあり。読込で保存します','ok');return}
      setStatus(message,complete?'ok':'partial');
      if(!complete)reportDiagnostic('[DAILY_NOT_FOUND]',checkpoint,scope,token);
    }catch(e){
      autoBlockedScope=runScope;clearTimeout(autoTimer);const message=cancelRequested?'停止しました [STOPPED]':String(e?.message||e),valid=checkpoint&&currentCapture(checkpoint.scope);
      if(valid)saveCheckpoint(checkpoint);
      if(/INGEST_TOKEN_INVALID|INGEST_TOKEN_REQUIRED/.test(message)&&localStorage.getItem(TOKEN_KEY)===tokenAtStart)localStorage.removeItem(TOKEN_KEY);
      resumeLabel=valid?(checkpoint.pendingSave?(checkpoint.pendingSave.saved?'保存確認を再試行':'保存を再試行'):'続きから読込'):'';
      if(connectionVerified&&!message.includes('[SURFACE_LEFT]'))reportDiagnostic(message,checkpoint,runScope,tokenAtStart);
      const kept=valid&&checkpoint.result?`｜取得済み 記事${checkpoint.result.articles.length}件・日別${checkpoint.result.metricSeries.length}日を保持`:'';
      setStatus(/INGEST_TOKEN_INVALID|INGEST_TOKEN_REQUIRED/.test(message)?'連携が無効｜接続し直してください':`${cancelRequested?'':'⚠ '}${readStage}：${message}${kept}`,cancelRequested?'paused':'warn',/INGEST_TOKEN|再連携|ACCOUNT_MISMATCH|からダッシュボードを連携/.test(message)?'connect':'read',true);
    }finally{busy=false;activeReadAutomatic=false;panel?.querySelector('#mumei-dash-stop')?.setAttribute('hidden','');if(button){button.disabled=false;button.textContent=needsPair?'連携して読み込む':resumeLabel||'再読込'}paintMode();if(featureResumePending&&featureOn()){featureResumePending=false;cancelRequested=false;stickyStatus=null;autoBlockedScope=null;surfaceSuspended=true;saveHistory()}if(modeResumePending){modeResumePending=false;if(autoOn())resumeAutomaticMode()}else resumeSurfaceRead()}
  }
  let needsPair=false,connecting=false;
  function saveHistory(){try{sessionStorage.setItem(HISTORY_KEY,JSON.stringify({version:VERSION,noteId:localStorage.getItem(NOTE_KEY),rows:historyRows,sticky:stickyStatus}))}catch{}}
  function historyText(){return `ダッシュボード v${VERSION}\n`+historyRows.map(r=>`${r.at} ${r.message}`).join('\n')}
  function recordStatus(message,kind){
    if(historyAccount!==localStorage.getItem(NOTE_KEY)){historyAccount=localStorage.getItem(NOTE_KEY);historyRows=[];stickyStatus=null;lastPresentation=null;autoBlockedScope=null}
    const token=localStorage.getItem(TOKEN_KEY);if(token)message=message.split(token).join('[接続情報]');
    message=message.slice(0,600);
    if(historyRows.at(-1)?.message!==message){historyRows.push({at:new Date().toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo'}),message,kind});historyRows=historyRows.slice(-40)}
    saveHistory();
  }
  function setStatus(message,kind='',action='',force=false){
    recordStatus(message,kind);
    if(stickyStatus&&!force)return;
    if(action)needsPair=action==='connect';
    if(busy&&!kind){const r=lastCollection&&currentCapture(lastCollection.scope)?lastCollection.result:null;message=`読み込み中｜取得 記事${r?.articles.length||0}件・日別PV ${r?.metricSeries.filter(x=>x.pageViews!==null).length||0}日`}
    lastPresentation={message,kind,action};
    if(kind==='warn'||kind==='paused'){stickyStatus=lastPresentation;autoBlockedScope=autoBlockedScope||{};clearTimeout(autoTimer);saveHistory()}
    renderCompactStatus(message,kind);
    if(!status)return;
    if(status.textContent!==message)status.textContent=message;status.title=message;status.dataset.kind=kind;
    const stop=panel?.querySelector('#mumei-dash-stop');if(stop)stop.hidden=!busy||cancelRequested;
    const button=panel?.querySelector('#mumei-dash-read');if(button){button.textContent=needsPair?'連携して読み込む':busy?'読込中…':resumeLabel||'再読込';button.dataset.action=needsPair?'connect':'read'}
    paintMode();
  }
  function stopReading(){
    cancelRequested=true;autoBlockedScope={};clearTimeout(autoTimer);resumeLabel='続きから読込';
    setStatus('停止しました。取得済みデータは保持しています。','paused','read',true);
  }
  function reportDiagnostic(message,checkpoint,scope,token){
    if(!featureOn()||!token||localStorage.getItem(TOKEN_KEY)!==token)return;
    const code=message.match(/\[([A-Z_]+)\]/)?.[1]||message.match(/^(?:NETWORK_ERROR|TIMEOUT|DASHBOARD_[A-Z_]+|HTTP_\d+)$/)?.[0]||'READ_ERROR';
    const stage=/照合/.test(readStage)?'verify':/保存/.test(readStage)?'save':checkpoint?.progress.pending?'panel':'read';
    const payload={action:'client-status',noteId:localStorage.getItem(NOTE_KEY),connectorVersion:VERSION,code,stage,
      readArticles:checkpoint?.result?.articles.length||0,readDaily:checkpoint?.result?.metricSeries.length||0,
      waitingRequests:pendingStats,loadingElements:[...dashboardRoot().querySelectorAll('[aria-busy="true"],[role="progressbar"]:not([aria-valuenow])')].filter(readable).length,
      elapsedMs:Date.now()-runStarted,panelsOpened:checkpoint?.progress.opened||0,
      activeTab:checkpoint?.progress.activeLabel||'',periodKnown:Boolean(detectPeriod().periodStart),periodChanged:scope.period!==periodKey(),routeChanged:scope.href!==dashboardLocation()};
    void xhr(DASH_API,payload,{'X-Ingest-Token':token},10000).catch(()=>{});
  }
  async function connectAndRead(){
    if(!isDashboard()||connecting||busy)return;stickyStatus=null;autoBlockedScope=null;cancelRequested=false;connecting=true;const button=panel?.querySelector('#mumei-dash-read');if(button)button.disabled=true;
    setStatus('noteアカウントを確認中…');
    try{const id=await currentNoteId();if(!isDashboard())return;if(!id)throw new Error('noteへのログインを確認してください');
      const url=new URL('https://mumei-s.github.io/note-insight/dashboard-setup.html');url.searchParams.set('account',id);url.searchParams.set('auto','1');url.searchParams.set('from','note');
      location.assign(url.href);
    }catch(e){setStatus(String(e?.message||e),'warn','connect')}finally{connecting=false;if(button)button.disabled=false}
  }
  function userNavigation(e){if(!e.isTrusted||e.target?.closest?.('#mumei-dashboard-sync'))return;if(e.type!=='popstate'&&(!dashboardRoot().contains(e.target)||!e.target?.closest?.('a,button,input,select,[role=tab],[role=button]')))return;viewLease=null;if(busy)userViewChanged=true;else{lastCollection=null;try{sessionStorage.removeItem(CHECKPOINT_KEY)}catch{}}}
  document.addEventListener('click',userNavigation,true);document.addEventListener('change',userNavigation,true);window.addEventListener('popstate',userNavigation);
  document.addEventListener('mumei-dashboard-connection-ready',()=>{stickyStatus=null;autoBlockedScope=null;cancelRequested=false;needsPair=false;saveHistory()});
  document.addEventListener('mumei-dashboard-status',e=>{const d=e.detail||{};setStatus(String(d.message||''),String(d.kind||''),String(d.action||''))});
  document.addEventListener('mumei-dashboard-read',e=>void syncNow({automatic:e.detail?.automatic!==false}));
  function resumeSurfaceRead(){
    if(!autoOn()||!surfaceSuspended||busy||cancelRequested||!isDashboard())return;
    surfaceSuspended=false;stickyStatus=null;autoBlockedScope=null;userViewChanged=false;saveHistory();
    clearTimeout(autoTimer);autoTimer=setTimeout(()=>void syncNow({automatic:true}),500);
  }
  function updateDashboardSurface(){
    const active=isDashboard(),returned=active&&!surfaceActive;surfaceActive=active;
    const surface=active?'dashboard':'other';if(document.documentElement.getAttribute('data-mumei-dashboard-surface')!==surface)document.documentElement.setAttribute('data-mumei-dashboard-surface',surface);
    if(!active){clearTimeout(autoTimer);if(busy)surfaceSuspended=true;panelResizeObserver?.disconnect();panelResizeObserver=null;panel?.remove();document.getElementById('mumei-dashboard-clearance')?.remove();panel=null;status=null}
    else{if(returned||!panel?.isConnected)mount();resumeSurfaceRead()}
    if(returned)document.dispatchEvent(new Event('mumei-dashboard-visible'));
  }
  function renderCompactStatus(message,kind){
    const line=panel?.querySelector('#mumei-dash-brief');if(!line)return;
    const counts=message.match(/記事\d+件・日別PV \d+日/)?.[0];
    const reason=/HTTP_402/.test(message)?'保存先が利用制限中':/VIEW_CHANGED/.test(message)?'期間・画面変更で停止':/SURFACE_LEFT/.test(message)?'画面を離れたため一時停止':/READ_WAIT|TIMEOUT/.test(message)?'公式データの応答待ちで停止':/SAVE_COUNT|SAVE_VALUE|SAVE_RESPONSE/.test(message)?'保存を確認できません':/ACCOUNT_MISMATCH|アカウント不一致/.test(message)?'アカウント不一致':/連携/.test(message)?'保存先の連携を確認':/PANEL_NOT_OPEN|TAB_NOT_OPEN|METRIC_NOT_SELECTED/.test(message)?'公式表示を開けず停止':'読込が止まりました';
    line.textContent=kind==='warn'?reason:kind==='paused'?'読込停止｜読込で再開':kind==='partial'?(/週・月単位/.test(message)?'記事保存済み｜グラフは週・月単位':'記事保存済み｜日別PV未取得'):kind==='ok'?`保存済み｜${counts||'保存確認済み'}`:busy?(activeReadAutomatic?'自動':'手動')+'読込中'+(counts?'｜'+counts:''):needsPair?'未連携｜連携してください':autoOn()?'ダッシュボード同期':'手動｜読込で開始';
    line.dataset.kind=kind;
  }
  function paintMode(){
    const mode=panel?.querySelector('#mumei-dash-mode'),quick=panel?.querySelector('#mumei-dash-run');
    if(mode){mode.textContent=autoOn()?'自動':'手動';mode.setAttribute('aria-pressed',String(autoOn()));mode.setAttribute('aria-label',(autoOn()?'自動読込中。手動に切り替える':'手動読込。自動に切り替える'));mode.dataset.mode=autoOn()?'automatic':'manual'}
    if(quick){quick.textContent=busy?(cancelRequested?'停止中':'停止'):needsPair?'連携':'読込';quick.disabled=busy&&cancelRequested;quick.setAttribute('aria-label',busy?'ダッシュボードの読込を停止':'ダッシュボードを読み込む')}
  }
  function resumeAutomaticMode(){
    if(!autoOn()||!featureOn())return;
    cancelRequested=false;stickyStatus=null;autoBlockedScope=null;surfaceSuspended=false;saveHistory();
    if(isDashboard()){setStatus('自動読込を準備中');clearTimeout(autoTimer);autoTimer=setTimeout(()=>void syncNow({automatic:true}),80)}
  }
  async function toggleMode(){
    const button=panel?.querySelector('#mumei-dash-mode');if(button?.disabled)return;
    if(button)button.disabled=true;
    try{const next=!autoOn(),bridge=window.__mumeiDashboardFeatureV1;if(bridge?.setAutomatic)await bridge.setAutomatic(next);else{localStorage.setItem(MODE_KEY,String(next));fallbackAutomatic=next;window.dispatchEvent(new CustomEvent('mumei-dashboard-mode-changed',{detail:{automatic:next}}))}}
    catch(e){setStatus(String(e?.message||'読込モードを保存できませんでした'),'warn','',true)}
    finally{if(button)button.disabled=false;paintMode()}
  }
  window.addEventListener('mumei-dashboard-mode-changed',()=>{
    clearTimeout(autoTimer);
    if(!autoOn()){modeResumePending=false;if(busy&&activeReadAutomatic)stopReading();else if(!busy&&!stickyStatus)setStatus('手動｜読込で開始')}
    else if(busy)modeResumePending=true;
    else resumeAutomaticMode();
    paintMode();
  });
  function mount(){
    if(!isDashboard()||!document.body)return;
    if(panel?.isConnected)return;panel=document.createElement('div');panel.id='mumei-dashboard-sync';panel.dataset.coreVersion=VERSION;
    panel.innerHTML=`<style>
#mumei-dashboard-sync{position:fixed;z-index:2147483646;left:8px;right:8px;max-width:520px;bottom:max(6px,env(safe-area-inset-bottom));font:10px/1.3 system-ui;color:#eaf6ff;background:#07131df5;border:1px solid #4cc9e8;border-radius:7px;padding:3px 5px;box-shadow:0 3px 12px #0006;box-sizing:border-box}
#mumei-dashboard-sync .row{display:flex;gap:3px;align-items:center}
#mumei-dashboard-sync button{flex-shrink:0;border:1px solid #5fd7f0;background:#103048;color:#eafaff;border-radius:5px;font:700 10px/1.2 system-ui;min-height:28px!important;height:28px!important;margin:0!important;padding:0 5px!important;white-space:nowrap;touch-action:manipulation}
#mumei-dashboard-sync #mumei-dash-mode[data-mode=automatic]{background:#163b2b;border-color:#65cb91}
#mumei-dashboard-sync .settings-note{display:block;text-align:right;color:#bed9e6;font:9px/1.4 system-ui;padding-top:2px}
#mumei-dashboard-sync button:disabled{opacity:.55}
#mumei-dashboard-sync #mumei-dash-brief{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#mumei-dashboard-sync .status{white-space:pre-wrap;overflow-wrap:anywhere;padding:8px 0;font-size:12px}
#mumei-dashboard-sync [data-kind=ok]{color:#aaffcf}
#mumei-dashboard-sync [data-kind=warn],#mumei-dashboard-sync [data-kind=partial]{color:#ffd68a}
#mumei-dashboard-sync #mumei-dash-details{max-height:35vh;overflow:auto;overscroll-behavior:contain;border-top:1px solid #466677;margin-top:3px;padding-bottom:4px}
#mumei-dashboard-sync .tools{display:flex;align-items:center;gap:8px;margin:4px 0;color:#b9cddd}
#mumei-dashboard-sync summary{cursor:pointer;padding:6px 0}
#mumei-dashboard-sync textarea{display:block;box-sizing:border-box;width:100%;height:16vh;min-height:70px;resize:none;color:#eaf6ff;background:#07131d;border:1px solid #466677;border-radius:6px;font:12px/1.5 system-ui;padding:6px}
#mumei-dashboard-sync [hidden]{display:none!important}
#mumei-dashboard-clearance{height:58px;pointer-events:none}
</style><div class="row"><span id="mumei-dash-brief" role="status" aria-live="polite">自動読込を準備中</span><button id="mumei-dash-mode" type="button">自動</button><button id="mumei-dash-run" type="button">読込</button><button id="mumei-dash-toggle" type="button" aria-controls="mumei-dash-details" aria-expanded="false">詳細</button><button id="mumei-dash-feature-off" type="button" aria-label="ダッシュボード パネルをOFFにする。再びONにするには設定を開いてください">OFF</button></div><a id="mumei-dash-settings" class="settings-note" href="https://mumei-s.github.io/note-insight/dashboard-setup.html?from=note">ON/OFFは設定から</a><div id="mumei-dash-details" hidden><div class="status"></div><div class="tools"><button id="mumei-dash-read" type="button">再読込</button><button type="button" id="mumei-dash-stop" hidden>停止</button><span>v${VERSION}</span><button id="mumei-dash-close" type="button" aria-label="詳細を縮小する">縮小</button></div><details id="mumei-dash-history"><summary>履歴</summary><textarea readonly aria-label="読込履歴"></textarea><button type="button" id="mumei-dash-copy">履歴をコピー</button></details></div>`;
    document.body.append(panel);status=panel.querySelector('.status');needsPair=!localStorage.getItem(TOKEN_KEY)||!localStorage.getItem(NOTE_KEY);
    if(lastPresentation){status.textContent=lastPresentation.message;status.dataset.kind=lastPresentation.kind;renderCompactStatus(lastPresentation.message,lastPresentation.kind)}else setStatus(needsPair?'未連携｜保存先を設定':`ダッシュボード v${VERSION}`,'',needsPair?'connect':'read');
    panel.querySelector('#mumei-dash-read').onclick=()=>needsPair?void connectAndRead():void syncNow();
    panel.querySelector('#mumei-dash-mode').onclick=()=>void toggleMode();
    panel.querySelector('#mumei-dash-run').onclick=()=>busy?stopReading():needsPair?void connectAndRead():void syncNow();
    paintMode();
    const toggle=panel.querySelector('#mumei-dash-toggle'),drawer=panel.querySelector('#mumei-dash-details');
    const expand=open=>{drawer.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'縮小':'詳細'};
    toggle.onclick=()=>expand(drawer.hidden);panel.querySelector('#mumei-dash-close').onclick=()=>expand(false);
    panel.querySelector('#mumei-dash-stop').onclick=stopReading;
    const off=panel.querySelector('#mumei-dash-feature-off');
    off.hidden=!window.__mumeiDashboardFeatureV1;
    off.onclick=async()=>{off.disabled=true;try{await window.__mumeiDashboardFeatureV1.setEnabled(false)}catch(e){setStatus(String(e?.message||'OFFを保存できませんでした'),'warn','',true);off.disabled=false}};
    const details=panel.querySelector('#mumei-dash-history'),area=details.querySelector('textarea');
    details.addEventListener('toggle',()=>{if(details.open)area.value=historyText()});
    panel.querySelector('#mumei-dash-copy').onclick=async()=>{const button=panel.querySelector('#mumei-dash-copy');try{await navigator.clipboard.writeText(area.value||historyText());button.textContent='コピーしました'}catch{area.value=area.value||historyText();area.focus();area.select();button.textContent='選択した履歴をコピー'}};
    let clearance=document.getElementById('mumei-dashboard-clearance');if(!clearance){clearance=document.createElement('div');clearance.id='mumei-dashboard-clearance';clearance.setAttribute('aria-hidden','true');document.body.append(clearance)}
    if(typeof ResizeObserver!=='undefined'){panelResizeObserver?.disconnect();panelResizeObserver=new ResizeObserver(()=>{if(panel)clearance.style.height=(panel.getBoundingClientRect().height+16)+'px'});panelResizeObserver.observe(panel)}
  }
  window.addEventListener('mumei-dashboard-feature-changed',()=>{
    clearTimeout(autoTimer);
    if(!featureOn()){featureResumePending=false;stopReading();surfaceSuspended=false;panelResizeObserver?.disconnect();panelResizeObserver=null;panel?.remove();document.getElementById('mumei-dashboard-clearance')?.remove();panel=null;status=null}
    else if(busy){featureResumePending=true}
    else{cancelRequested=false;stickyStatus=null;autoBlockedScope=null;saveHistory()}
    updateDashboardSurface();
  });
  window.addEventListener('DOMContentLoaded',mount,{once:true});
  document.addEventListener('mumei-dashboard-mount',mount);
  let surfaceTimer=0;
  new MutationObserver(records=>{if(!featureOn()||!document?.documentElement||document.visibilityState==='hidden'||records.every(r=>r.target?.closest?.('#mumei-dashboard-sync,#mumei-dashboard-clearance')))return;clearTimeout(surfaceTimer);surfaceTimer=setTimeout(updateDashboardSurface,50)}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden','data-mumei-notice-shell-v2958','data-mumei-notice-shell-v3']});
  window.addEventListener('popstate',updateDashboardSurface);document.addEventListener('visibilitychange',updateDashboardSurface);document.addEventListener('mumei-dashboard-surface',updateDashboardSurface);
  if(document.readyState!=='loading')mount();
})();
