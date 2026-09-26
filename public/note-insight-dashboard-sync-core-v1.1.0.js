// ==UserScript==
// @name         無名S note INSIGHT｜公式Dashboard同期
// @namespace    https://mumei-s.github.io/note-insight/
// @version      1.5.3
// @description  note公式Dashboardを本人アカウント完全一致でINSIGHTへ手動同期。インプレッション・PV・スキ・コメント・売上・流入元・日別系列・記事/メンシプ/マガジン対応。本人通知とは独立しています。
// @match        https://note.com/sitesettings/stats*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// ==/UserScript==

(function startDashboardCore() {
  'use strict';
  if(location.origin!=='https://note.com')return;
  if(!/^\/(?:sitesettings\/stats|dashboard)(?:\/|$)/.test(location.pathname)){
    // SPA navigation from a normal note page must start the reader only on the dashboard.
    document.addEventListener('mumei-dashboard-mount',function enterDashboard(){
      if(!/^\/(?:sitesettings\/stats|dashboard)(?:\/|$)/.test(location.pathname))return;
      document.removeEventListener('mumei-dashboard-mount',enterDashboard);startDashboardCore();
    });return;
  }
  const VERSION='1.5.3';
  const TOKEN_API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-import-token';
  const DASH_API='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-data';
  const TOKEN_KEY='mumei-dashboard-ingest-token-v1';
  const NOTE_KEY='mumei-dashboard-note-id-v1';
  const CAPTURE=[];
  let panel=null,status=null,busy=false,pendingStats=0,captureRevision=0,autoTimer=0,lastSnapshotSignature='';
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const num=(v)=>{if(v==null)return 0;const s=String(v).replace(/[￥¥円,%\s]/g,'').replace(/,/g,'');const n=Number(s);return Number.isFinite(n)?n:0};
  const text=(v)=>String(v??'').replace(/\s+/g,' ').trim();
  const uniq=(rows,keyFn)=>{const m=new Map();for(const r of rows){const k=keyFn(r);if(k&&!m.has(k))m.set(k,r);else if(k)m.set(k,{...m.get(k),...r})}return [...m.values()]};
  function xhr(url,body,headers={}){return new Promise((resolve,reject)=>(typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:typeof GM!=='undefined'&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest.bind(GM):()=>reject(new Error('DASHBOARD_REQUEST_UNAVAILABLE')))({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:60000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{}if(r.status>=200&&r.status<300&&p?.ok!==false)resolve(p);else reject(new Error(p?.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))}))}
  function cleanUrl(){const u=new URL(location.href);for(const k of ['mumei_dashboard_pair','mumei_dashboard_sync','mumei_dashboard_return'])u.searchParams.delete(k);history.replaceState(history.state,'',u.href)}
  function safeReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
  async function currentNoteId(){const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store',signal:c.signal});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=text(u?.urlname||u?.url_name||u?.username).replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?id:''}catch{return''}finally{clearTimeout(timer)}}
  const isDashboard=()=>location.origin==='https://note.com'&&/\/(?:sitesettings\/stats|dashboard)(?:\/|$)/.test(location.pathname);
  const statsUrl=url=>{try{const u=new URL(url,location.href);return u.origin==='https://note.com'&&/^\/api\/v\d+\/(?:stats|dashboards?|analytics)(?:\/|$)/.test(u.pathname)}catch{return false}};
  const contentTab=el=>/^(?:記事|マガジン|メンバーシップ)$/.test(text(el.getAttribute('aria-label')||el.textContent));
  const periodKey=()=>{const p=detectPeriod();return JSON.stringify([p.periodStart,p.periodEnd,[...document.querySelectorAll('main [role="tab"][aria-selected="true"]')].filter(el=>!contentTab(el)).map(el=>text(el.textContent))])};
  const captureScope=()=>({href:location.href,period:periodKey()});
  function captureJson(url,payload,scope=captureScope()){
    if(!isDashboard()||scope.href!==location.href||scope.period!==periodKey()||!payload||typeof payload!=='object'||(!statsUrl(url)&&!String(url).startsWith('hydration:')))return;
    const idx=CAPTURE.findIndex(x=>x.url===String(url));if(idx>=0)CAPTURE.splice(idx,1);
    CAPTURE.push({url:String(url),payload,...scope,at:Date.now()});captureRevision++;if(CAPTURE.length>40)CAPTURE.shift();
    // A period change or a manually opened lazy panel must also reach INSIGHT.
    if(!busy&&localStorage.getItem(TOKEN_KEY)&&localStorage.getItem(NOTE_KEY)){
      clearTimeout(autoTimer);autoTimer=setTimeout(()=>void syncNow(),900);
    }
  }

  const pageWindow=()=>{try{return typeof unsafeWindow!=='undefined'?unsafeWindow:window}catch{return window}};
  const originalFetch=window.fetch.bind(window);
  function observe(p){
   if(p?.fetch&&!p.fetch.__mumeiDashboardCapture){const original=p.fetch.bind(p),wrapped=async function(...args){const url=typeof args[0]==='string'?args[0]:args[0]?.url||'',tracked=statsUrl(url)&&isDashboard(),scope=captureScope();if(tracked)pendingStats++;try{const res=await original(...args);if(tracked){res.clone().json().then(data=>{if(res.ok)captureJson(url,data,scope)}).catch(()=>{}).finally(()=>pendingStats--)}return res}catch(e){if(tracked)pendingStats--;throw e}};wrapped.__mumeiDashboardCapture=true;try{p.fetch=wrapped}catch{}}
   const proto=p?.XMLHttpRequest?.prototype;if(!proto||proto.__mumeiDashboardCapture)return;
   const open=proto.open,send=proto.send;
   proto.open=function(method,url,...rest){this.__mumeiDashboardUrl=String(url||'');return open.call(this,method,url,...rest)};
   proto.send=function(...args){const tracked=statsUrl(this.__mumeiDashboardUrl)&&isDashboard(),scope=captureScope();if(tracked)pendingStats++;this.addEventListener('loadend',()=>{try{if(tracked&&this.status>=200&&this.status<300)captureJson(this.__mumeiDashboardUrl,this.responseType==='json'?this.response:JSON.parse(this.responseText),scope)}catch{}finally{if(tracked)pendingStats--}},{once:true});try{return send.apply(this,args)}catch(e){if(tracked)pendingStats--;throw e}};
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
  function readHydration(){
    let index=0;
   for(const script of document.querySelectorAll('script[type="application/json"],script#__NEXT_DATA__')){try{const payload=JSON.parse(script.textContent||''),url='hydration:'+index++;if(!CAPTURE.some(c=>c.url===url&&c.href===location.href&&c.period===periodKey()&&JSON.stringify(c.payload)===JSON.stringify(payload)))captureJson(url,payload)}catch{}}
  }
  async function refreshChartSources(){
   readHydration();
   // Only the latest observed request for each endpoint belongs to the selected view.
   const latest=new Map();
   const current=CAPTURE.filter(cap=>statsUrl(cap.url)&&cap.href===location.href&&cap.period===periodKey());
   const urls=current.length?current.filter(cap=>Date.now()-cap.at>10000).map(cap=>cap.url):CAPTURE.some(cap=>statsUrl(cap.url))?[]:(performance.getEntriesByType?.('resource')||[]).map(entry=>entry.name);
   for(const name of urls){if(statsUrl(name)){const url=new URL(name,location.href);latest.set(url.origin+url.pathname,url.href)}}
   await Promise.all([...latest.values()].slice(-8).map(async url=>{const scope=captureScope(),c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);try{const r=await originalFetch(url,{method:'GET',credentials:'include',cache:'no-store',signal:c.signal});if(r.ok)captureJson(url,await r.json(),scope)}catch{}finally{clearTimeout(timer)}}));
  }
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
      heading=text(p.querySelector('h2,h3,h4,caption,[role="heading"]')?.textContent);if(heading)break;
    }
    return text([el.getAttribute('aria-label'),el.textContent,controlled?.getAttribute('aria-label'),controlled?.querySelector('h2,h3,h4,caption')?.textContent,heading].filter(Boolean).join(' '));
  }
  function panelControls(){return [...dashboardRoot().querySelectorAll('details:not([open]) > summary,button,[role="button"],[role="tab"]')].filter(el=>{
    if(!readable(el)||el.disabled||el.getAttribute('aria-disabled')==='true'||el.hasAttribute('aria-haspopup')||el.matches('a,[type="submit"]'))return false;
    if(contentTab(el))return el.getAttribute('aria-selected')!=='true'&&el.getAttribute('aria-pressed')!=='true';
    if(el.matches('[role="tab"]'))return false;
    const disclosure=el.matches('details:not([open]) > summary')||el.getAttribute('aria-expanded')==='false';
    const named=!el.hasAttribute('aria-expanded')&&/^(?:グラフを(?:表示|開く)|詳細を表示|詳細を見る|もっと見る|さらに表示|続きを表示|開く|表示する)$/.test(text(el.getAttribute('aria-label')||el.textContent));
    return (disclosure||named)&&metricPanel.test(panelLabel(el));
  })}
  async function expandDashboardPanels(href,initialPeriod,collect){
    const seen=new WeakSet(),visitedTabs=new Set([...dashboardRoot().querySelectorAll('[role="tab"][aria-selected="true"]')].filter(contentTab).map(el=>text(el.textContent)));let opened=0;
    collect();
    for(let pass=0;pass<60;pass++){
      if(!isDashboard()||location.href!==href||(initialPeriod!==null&&periodKey()!==initialPeriod))throw new Error('表示期間または画面が変わりました。現在の画面で再読込してください');
      // Re-query after each render. Read one panel before another accordion/tab can hide it.
      const candidates=panelControls().filter(el=>!seen.has(el)&&(!contentTab(el)||!visitedTabs.has(text(el.textContent))));
      const control=candidates.find(el=>!contentTab(el))||candidates[0];
      if(!control)return opened;
      seen.add(control);if(contentTab(control))visitedTabs.add(text(control.textContent));
      control.scrollIntoView?.({block:'center',behavior:'instant'});control.click();opened++;
      setStatus(`公式パネルを読込中… ${opened}項目`);
      await waitForDashboard(href,initialPeriod);collect(contentTab(control)?text(control.textContent):'');
      if(control.isConnected&&readable(control)&&control.getAttribute('aria-expanded')==='false')throw new Error('公式パネルを開けませんでした：'+text(control.textContent));
    }
    throw new Error('公式パネルの読込が途中です。再読込してください');
  }
  async function waitForDashboard(href,initialPeriod){
    let quiet=0,previous='';
    for(let tick=0;tick<60;tick++){
      if(!isDashboard()||location.href!==href||(initialPeriod!==null&&periodKey()!==initialPeriod))throw new Error('表示期間または画面が変わりました。現在の画面で再読込してください');
      const loading=[...dashboardRoot().querySelectorAll('[aria-busy="true"],[role="progressbar"]')].some(readable);
      const signature=JSON.stringify([captureRevision,tableArticles(),detectTotals(),text(dashboardRoot().innerText||dashboardRoot().textContent).replace(text(panel?.textContent),'')]);
      quiet=!pendingStats&&!loading&&signature===previous?quiet+1:0;previous=signature;
      if(quiet>=6)return;
      if(tick%4===0)setStatus(`公式データを読込中…${pendingStats?' 通信 '+pendingStats+'件':''}`);
      await sleep(250);
    }
    throw new Error('公式パネルの読込が完了していません。表示が落ち着いてから再読込してください');
  }

  function mineNetwork(){const articles=[],sources=[],trafficSeries=[],metricRows=[];for(const cap of CAPTURE){if(cap.href!==location.href||cap.period!==periodKey())continue;metricRows.push(...dailyMetrics(cap.payload));walk(cap.payload,o=>{const title=titleOf(o),url=urlOf(o),key=keyOf(o),pv=pick(o,aliases.pageViews),imp=pick(o,aliases.impressions),likes=pick(o,aliases.likes),comments=pick(o,aliases.comments),sales=pick(o,aliases.sales),shares=pick(o,aliases.shares),date=dateOf(o);if(title&&(url||key)&&(pv||imp||likes||comments||sales||shares)){articles.push({key:key||url,title,url,impressions:imp,pageViews:pv,views:pv,likes,comments,salesYen:sales,shares,status:text(o.status),publishedAt:text(o.published_at||o.publishedAt||o.publish_at),contentType:text(o.content_type||o.contentType||'article')})}const source=text(o.referrer||o.referrer_name||o.source||o.domain||o.host);const spv=pick(o,['pv','page_views','pageViews','count','value']);if(source&&spv&&!/^https?:/i.test(source)&&source.length<100){if(date)trafficSeries.push({date,source,pv:spv});else sources.push({source,pv:spv})}})}return{articles:uniq(articles,r=>r.url||r.key||r.title),sources:uniq(sources,r=>r.source.toLowerCase()),trafficSeries,metricSeries:mergeMetrics(metricRows)}}
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

  function detectTotals(){const body=document.body?.innerText||'';return{impressions:labelledNumber('インプレッション',body),pageViews:labelledNumber('(?:ページビュー|全体ビュー|ビュー数)',body),likes:labelledNumber('スキ',body),comments:labelledNumber('コメント',body),salesYen:labelledNumber('売上',body)}}
  function detectPeriod(){const body=document.body?.innerText||'',range=body.match(/(20\d{2})[\/.年](\d{1,2})[\/.月](\d{1,2})[^\d]{1,5}(?:〜|~|-)[^\d]*(?:(20\d{2})[\/.年])?(\d{1,2})[\/.月](\d{1,2})/);if(!range)return{periodType:'custom',periodStart:null,periodEnd:null};const year2=range[4]||range[1],pad=x=>String(x).padStart(2,'0');return{periodType:'custom',periodStart:`${range[1]}-${pad(range[2])}-${pad(range[3])}`,periodEnd:`${year2}-${pad(range[5])}-${pad(range[6])}`}}
  function detectCollected(){const m=(document.body?.innerText||'').match(/(20\d{2})[\/.年](\d{1,2})[\/.月](\d{1,2})[^\d]+(\d{1,2}):(\d{2})\s*集計/);if(!m)return null;const p=x=>String(x).padStart(2,'0');return`${m[1]}-${p(m[2])}-${p(m[3])}T${p(m[4])}:${p(m[5])}:00+09:00`}
  function detectTraffic(){const body=document.body?.innerText||'',rows=[];const rx=/(^|\n)\s*([A-Za-z0-9._-]+|X|Facebook|Instagram|no referrer|other)\s+([0-9.]+)%\s*\(([0-9,]+)PV\)/g;let m;while((m=rx.exec(body)))rows.push({source:text(m[2]),percent:num(m[3]),pv:num(m[4])});return uniq(rows,r=>r.source.toLowerCase())}
  function detectSummary(){const body=document.body?.innerText||'',a=body.match(/記事数\s*([0-9,]+)\s*本/),s=body.match(/シェアされた記事\s*([0-9,]+)\s*回/),r=body.match(/収益\s*[￥¥]?\s*([0-9,]+)/);return{articles:a?num(a[1]):0,sharedArticles:s?num(s[1]):0,revenueYen:r?num(r[1]):0}}
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
  function collector(){
    let activeType=currentContentType();
    const result={articles:[],sources:[],trafficSeries:[],metricSeries:[],totals:{},summary:{}};
    return {result,collect(label=''){
      if(label)activeType=label==='マガジン'?'magazine':label==='メンバーシップ'?'membership':'article';
      readHydration();const mined=mineNetwork();
      result.articles=uniq([...result.articles,...mined.articles,...tableArticles(activeType)],r=>r.url||r.key||r.title);
      result.sources=uniq([...result.sources,...mined.sources,...detectTraffic()],r=>r.source.toLowerCase());
      result.trafficSeries=uniq([...result.trafficSeries,...mined.trafficSeries],r=>r.date+':'+r.source);
      result.metricSeries=mergeMetrics([...result.metricSeries,...mined.metricSeries,...dailyTableMetrics()]);
      for(const [key,value]of Object.entries(detectTotals()))if(value!==null&&result.totals[key]==null)result.totals[key]=value;
      for(const [key,value]of Object.entries(detectSummary()))if(value)result.summary[key]=value;
    }};
  }
  async function syncNow(){
    if(busy||!isDashboard())return;clearTimeout(autoTimer);busy=true;mount();setStatus('公式データを確認中…');
    const tokenAtStart=localStorage.getItem(TOKEN_KEY);
    const button=panel?.querySelector('#mumei-dash-read');if(button)button.disabled=true;
    try{
      const startLocation=location.href,paired=(localStorage.getItem(NOTE_KEY)||'').toLowerCase(),current=await currentNoteId();
      if(!paired)throw new Error('INSIGHTの分析からダッシュボードを連携してください');
      if(!current)throw new Error('noteへのログインを確認してください');
      if(current!==paired)throw new Error(`DASHBOARD_ACCOUNT_MISMATCH：note @${current} / INSIGHT @${paired}`);
      const token=localStorage.getItem(TOKEN_KEY)||'';if(!token)throw new Error('INSIGHTの分析からダッシュボードを再連携してください');
      setStatus('保存先の連携を確認中…');
      const connection=await xhr(DASH_API,{action:'sync-status',noteId:paired},{'X-Ingest-Token':token});
      if(connection.noteId!==paired||connection.paired!==true)throw new Error('保存先の確認ができませんでした');
      // Expand disclosure panels within the selected period; never switch period tabs.
      for(let i=0;i<20;i++){if(!isDashboard()||location.href!==startLocation)return;if(dashboardRoot().querySelector('details,[aria-expanded],table')||detectTotals().pageViews!==null||mineNetwork().metricSeries.length)break;await sleep(250)}
      await waitForDashboard(startLocation,null);
      const selectedPeriod=periodKey(),read=collector();
      const openedPanels=await expandDashboardPanels(startLocation,selectedPeriod,read.collect);
      await refreshChartSources();
      await waitForDashboard(startLocation,selectedPeriod);read.collect();
      const mined=read.result,articles=mined.articles,traffic=mined.sources;
      const totals={impressions:null,pageViews:null,likes:null,comments:null,salesYen:null,...mined.totals},period=detectPeriod(),collected=detectCollected(),summary=mined.summary;
      const dailyPvDays=mined.metricSeries.filter(r=>r.pageViews!==null).length;
      if(!articles.length&&totals.pageViews===null&&totals.impressions===null&&!mined.metricSeries.length)throw new Error('公式データが見つかりません。グラフ表示後に「再読込」を押してください');
      setStatus(`読込 記事${articles.length}件／日別PV ${dailyPvDays}日 → 保存中…`);
      const payload={action:'ingest',schemaVersion:4,connectorVersion:VERSION,noteId:paired,articles,totals,
        trafficSources:traffic,trafficSeries:mined.trafficSeries,metricSeries:mined.metricSeries,summary,
        contentSections:{article:{count:articles.length,scope:'current-period-expanded'},openedPanels},officialCollectedAt:collected,...period,pages:1};
      const readRevision=captureRevision;
      if(!isDashboard()||location.href!==startLocation||periodKey()!==selectedPeriod||localStorage.getItem(NOTE_KEY)?.toLowerCase()!==paired||await currentNoteId()!==paired)throw new Error('DASHBOARD_ACCOUNT_MISMATCH');
      const signature=JSON.stringify({...payload,contentSections:{article:payload.contentSections.article}});
      if(signature===lastSnapshotSignature){setStatus(localStorage.getItem('mumei-dashboard-last-result:'+paired)||'取得済みデータを保存済み',dailyPvDays?'ok':'partial');return}
      const saved=await xhr(DASH_API,payload,{'X-Ingest-Token':token});
      if(!saved.snapshotId)throw new Error('保存結果を確認できませんでした。再読込してください');
      setStatus(`読込 記事${articles.length}件／日別PV ${dailyPvDays}日 → 保存を照合中…`);
      const verified=await xhr(DASH_API,{action:'sync-status',noteId:paired,snapshotId:saved.snapshotId},{'X-Ingest-Token':token});
      if(verified.noteId!==paired||String(verified.snapshotId)!==String(saved.snapshotId)||verified.confirmed!==true||Number(verified.articleCount)!==articles.length||Number(verified.dailyPvDays)!==dailyPvDays||Number(verified.dailyMetricCount)!==mined.metricSeries.length)throw new Error('保存件数が一致しません。再読込してください');
      for(const key of Object.keys(totals))if(totals[key]!==null&&optionalNumber(verified.totals?.[key])!==totals[key])throw new Error('保存した数値を確認できません。再読込してください');
      if(!isDashboard()||location.href!==startLocation||periodKey()!==selectedPeriod||localStorage.getItem(TOKEN_KEY)!==token||await currentNoteId()!==paired)throw new Error('DASHBOARD_ACCOUNT_MISMATCH');
      if(captureRevision!==readRevision){setStatus('保存確認済み｜遅れて届いた公式データを追加読込中…');autoTimer=setTimeout(()=>void syncNow(),900);return}
      const count=Number(verified.dailyPvDays),at=new Date(verified.capturedAt||saved.capturedAt||Date.now()).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'});
      localStorage.setItem('mumei-dashboard-last-sync',String(Date.now()));
      const message=count?`✓ 同期完了 ${at}｜保存確認 記事${verified.articleCount}件・日別PV ${count}日`:`保存済み ${at}｜記事${verified.articleCount}件・日別PV 0日（未取得：公式の日別グラフを開いて再読込）`;
      lastSnapshotSignature=signature;
      localStorage.setItem('mumei-dashboard-last-result:'+paired,message);setStatus(message,count?'ok':'partial');
    }catch(e){const message=String(e?.message||e);if(/INGEST_TOKEN_INVALID|INGEST_TOKEN_REQUIRED/.test(message)&&localStorage.getItem(TOKEN_KEY)===tokenAtStart){localStorage.removeItem(TOKEN_KEY);clearTimeout(autoTimer)}setStatus(/INGEST_TOKEN_INVALID|INGEST_TOKEN_REQUIRED/.test(message)?'連携が無効｜接続し直してください':`⚠ ${message}`,'warn',/INGEST_TOKEN|再連携|ACCOUNT_MISMATCH|からダッシュボードを連携/.test(message)?'connect':'read')}
    finally{busy=false;if(button){button.disabled=false;button.textContent=needsPair?'連携して読み込む':'再読込'}}
  }
  let needsPair=false,connecting=false;
  function setStatus(message,kind='',action=''){
    if(action)needsPair=action==='connect';if(!status)return;
    status.textContent=message;status.title=message;status.dataset.kind=kind;
    const button=panel?.querySelector('#mumei-dash-read');if(button){button.textContent=needsPair?'連携して読み込む':busy?'読込中…':'再読込';button.dataset.action=needsPair?'connect':'read'}
  }
  async function connectAndRead(){
    if(connecting||busy)return;connecting=true;const button=panel?.querySelector('#mumei-dash-read');if(button)button.disabled=true;
    setStatus('noteアカウントを確認中…');
    try{const id=await currentNoteId();if(!id)throw new Error('noteへのログインを確認してください');
      const url=new URL('https://mumei-s.github.io/note-insight/dashboard-setup.html');url.searchParams.set('account',id);url.searchParams.set('auto','1');url.searchParams.set('from','note');
      location.assign(url.href);
    }catch(e){setStatus(String(e?.message||e),'warn','connect')}finally{connecting=false;if(button)button.disabled=false}
  }
  document.addEventListener('mumei-dashboard-status',e=>{const d=e.detail||{};setStatus(String(d.message||''),String(d.kind||''),String(d.action||''))});
  function mount(){
    if(!isDashboard()||!document.body)return;
    if(panel?.isConnected)return;panel=document.createElement('div');panel.id='mumei-dashboard-sync';
    panel.innerHTML=`<style>#mumei-dashboard-sync{position:fixed;z-index:2147483646;left:8px;right:8px;bottom:max(8px,env(safe-area-inset-bottom));font:11px/1.35 system-ui;color:#eaf6ff;background:#07131df5;border:1px solid #4cc9e8;border-radius:10px;padding:5px 6px;box-shadow:0 3px 12px #0006;box-sizing:border-box}#mumei-dashboard-sync .row{display:flex;gap:5px;align-items:center}#mumei-dashboard-sync button{flex-shrink:0;border:1px solid #5fd7f0;background:#103048;color:#eafaff;border-radius:7px;font:800 11px/1.2 system-ui;min-height:34px;margin:0;padding:0 8px;white-space:nowrap;touch-action:manipulation}#mumei-dashboard-sync button:disabled{opacity:.55}#mumei-dashboard-sync #mumei-dash-close{width:28px;padding:0;border-color:#466677}#mumei-dashboard-sync .status{min-width:0;flex:1;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}#mumei-dashboard-sync .status[data-kind=ok]{color:#aaffcf}#mumei-dashboard-sync .status[data-kind=warn],#mumei-dashboard-sync .status[data-kind=partial]{color:#ffd68a}</style><div class="row"><div class="status" role="status" aria-live="polite"></div><button id="mumei-dash-read" type="button">再読込</button><button id="mumei-dash-close" type="button" aria-label="読込パネルを閉じる">×</button></div>`;
    document.body.append(panel);status=panel.querySelector('.status');needsPair=!localStorage.getItem(TOKEN_KEY)||!localStorage.getItem(NOTE_KEY);
    setStatus(needsPair?'未連携｜保存先を設定':`ダッシュボード v${VERSION}`,'',needsPair?'connect':'read');
    panel.querySelector('#mumei-dash-read').onclick=()=>needsPair?void connectAndRead():void syncNow();
    panel.querySelector('#mumei-dash-close').onclick=()=>{panel.remove();panel=null;status=null};
  }
  window.addEventListener('DOMContentLoaded',mount,{once:true});
  document.addEventListener('mumei-dashboard-mount',mount);
  if(document.readyState!=='loading')mount();
})();
