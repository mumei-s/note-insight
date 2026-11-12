// Date and article selection belongs to the standalone reader, not INSIGHT's UI.
function once(source, from, to) {
  if (source.split(from).length !== 2) throw Error('History filter hook must match once: ' + from.slice(0, 100));
  return source.replace(from, () => to);
}
const helpers = String.raw`
const HISTORY_FILTER_PREF='mumei_profile_card_history_filter_v297';
function historyToday(){return new Date(Date.now()+9*3600000).toISOString().slice(0,10)}
function validHistoryDate(text){return /^\d{4}-\d{2}-\d{2}$/.test(text)&&Number.isFinite(Date.parse(text+'T00:00:00Z'))&&new Date(text+'T00:00:00Z').toISOString().slice(0,10)===text}
function selectedHistoryFilter(){
 const panel=document.getElementById(PANEL),period=panel?.querySelector('[data-history-period]')?.value;
 if(!period)return null;
 let fromDate='',toDate='',articleKey='';
 if(period==='today')fromDate=toDate=historyToday();
 else if(period==='date'||period==='range'){
  fromDate=String(panel.querySelector('[data-history-from]')?.value||'');
  toDate=period==='range'?String(panel.querySelector('[data-history-to]')?.value||''):fromDate;
  if(!validHistoryDate(fromDate)||!validHistoryDate(toDate)||fromDate>toDate)throw new Error('スキされた日付を正しく指定してください');
 }
 if(panel.querySelector('[data-history-articles]')?.value==='selected'){
  const input=String(panel.querySelector('[data-history-article]')?.value||'').trim();
  articleKey=input.match(/^n[a-f0-9]{12}$/i)?.[0]?.toLowerCase()||input.match(/^https:\/\/(?:www\.)?note\.com\/[^/?#]+\/n\/(n[a-f0-9]{12})(?:[/?#]|$)/i)?.[1]?.toLowerCase()||'';
  if(!articleKey)throw new Error('スキを受け取った自分の記事URLを指定してください');
 }
 return fromDate||articleKey?{fromDate,toDate,articleKey,timezone:'Asia/Tokyo'}:null;
}
function sameHistoryFilter(a,b){return ['fromDate','toDate','articleKey','timezone'].every(key=>String(a?.[key]||'')===String(b?.[key]||''))}
function historyFilterContains(filter,row){
 if(filter.articleKey&&String(row.likedArticleKey||'').toLowerCase()!==filter.articleKey)return false;
 if(!filter.fromDate)return true;
 const at=Date.parse(row.likedAt),from=Date.parse(filter.fromDate+'T00:00:00+09:00'),until=Date.parse(filter.toDate+'T00:00:00+09:00')+86400000;
 return Number.isFinite(at)&&at>=from&&at<until;
}
function patchHistoryFilterPanel(panel,detail){
 let controls=detail.querySelector('[data-history-filter]');
 if(controls)return;
 controls=document.createElement('div');controls.dataset.historyFilter='';
 controls.style.cssText='display:grid;gap:6px;margin:8px 0;padding:8px;border:1px solid #355064;border-radius:9px';
 controls.innerHTML='<label>スキされた日（日本時間）<select data-history-period style="width:100%;min-width:0"><option value="today">今日</option><option value="date">指定日</option><option value="range">期間指定</option><option value="all">全期間・直近順</option></select></label><div data-history-dates hidden><div style="display:flex;gap:6px"><label style="min-width:0;flex:1">日付<input data-history-from type="date" style="width:100%;min-width:0;box-sizing:border-box"></label><label data-history-until hidden style="min-width:0;flex:1">終了日<input data-history-to type="date" style="width:100%;min-width:0;box-sizing:border-box"></label></div></div><label>スキを受け取った記事<select data-history-articles style="width:100%;min-width:0"><option value="all">全記事（過去の記事を含む）</option><option value="selected">記事を指定</option></select></label><label data-history-article-field hidden>自分の記事URL<input data-history-article type="url" placeholder="https://note.com/…/n/…" style="width:100%;min-width:0;box-sizing:border-box"></label><button type="button" data-a="history-today">今日・全記事に設定</button>';
 (detail.querySelector('.special-actions')||detail.lastElementChild)?.before(controls);
 let saved={};try{saved=JSON.parse(localStorage.getItem(HISTORY_FILTER_PREF)||'{}')||{}}catch{}
 const field=name=>controls.querySelector('[data-history-'+name+']');
 field('period').value=['today','date','range','all'].includes(saved.period)?saved.period:'all';
 field('from').value=validHistoryDate(saved.fromDate||'')?saved.fromDate:historyToday();
 field('to').value=validHistoryDate(saved.toDate||'')?saved.toDate:historyToday();
 field('articles').value=saved.articles==='selected'?'selected':'all';field('article').value=String(saved.article||'');
 const update=()=>{
  const period=field('period').value,selected=field('articles').value==='selected';
  controls.querySelector('[data-history-dates]').hidden=!['date','range'].includes(period);
  controls.querySelector('[data-history-until]').hidden=period!=='range';controls.querySelector('[data-history-article-field]').hidden=!selected;
 };
 const save=()=>{update();try{localStorage.setItem(HISTORY_FILTER_PREF,JSON.stringify({period:field('period').value,fromDate:field('from').value,toDate:field('to').value,articles:field('articles').value,article:field('article').value}))}catch{}};
 controls.addEventListener('change',save);controls.addEventListener('input',save);
 bindPanelAction(controls.querySelector('[data-a="history-today"]'),'click:today',event=>{event.preventDefault();field('period').value='today';field('articles').value='all';save();setStatus('今日（日本時間）・全記事に設定しました｜「履歴から開始」で取得')});
 update();
}
`;
export function transformEditorHistoryFilter(source) {
  source = once(source, 'let exportWaiter=null;', 'let exportWaiter=null;\n' + helpers);
  source = once(source, "const count=Array.isArray(run.rows)&&run.rows.at(-1)?.finalMarker?run.rows.length-1:Number(run.historyRequestedCount||run.count)||300;", "const count=Number(run.historyRequestedCount)||(Array.isArray(run.rows)&&run.rows.at(-1)?.finalMarker?run.rows.length-1:Number(run.count)||300);");
  source = once(source, "return{mode:run.mode==='all'?'all':'number',count,target:run.mode==='all'?Infinity:count};", "return{mode:run.mode==='all'?'all':'number',count,target:run.mode==='all'?Infinity:count,historyFilter:run.historyFilter||null};");
  source = once(source, "return{mode,count:mode==='all'?HISTORY_CANDIDATE_CAP:count,target:mode==='all'?Infinity:count};", "return{mode,count:mode==='all'?HISTORY_CANDIDATE_CAP:count,target:mode==='all'?Infinity:count,historyFilter:selectedHistoryFilter()};");
  source = once(source, 'function checkpointHistoryOptions(saved){', 'function checkpointHistoryOptions(saved,bridge=null){');
  source = once(source, " if(token)return{mode:token==='all'?'all':'number',count:token==='all'?HISTORY_CANDIDATE_CAP:Number(token),target:token==='all'?Infinity:Number(token)};", ` const selected=bridge?.selection,filter=bridge?.historyFilter||saved?.historyFilter||null;
 const requested=token||(selected?.mode==='all'?'all':selected?.count);
 if(requested==='all')return{mode:'all',count:HISTORY_CANDIDATE_CAP,target:Infinity,historyFilter:filter};
 if(Number.isInteger(Number(requested))&&Number(requested)>=1&&Number(requested)<=HISTORY_CANDIDATE_CAP)return{mode:'number',count:Number(requested),target:Number(requested),historyFilter:filter};
 if(filter)return{mode:'all',count:HISTORY_CANDIDATE_CAP,target:Infinity,historyFilter:filter};`);
  source = once(source, "function historyExportCount(options){return options.mode==='all'?", "function historyExportCount(options){return options.historyFilter||options.mode==='all'?");
  source = once(source, "url.searchParams.set('unique','1');url.searchParams.set('scope','recent-likes');", "url.searchParams.set('unique','1');url.searchParams.set('scope',options.historyFilter?'filtered-likes':'recent-likes');\n if(options.historyFilter)for(const [key,value]of Object.entries(options.historyFilter))url.searchParams.set(key,value);");
  source = once(source, 'exportWaiter={requestId,popup,promise,resolve,reject,timer};', 'exportWaiter={requestId,popup,promise,resolve,reject,timer,historyFilter:options.historyFilter||null,selection:{mode:options.mode,count:options.count}};');
  source = once(source, "  const people=uniquePeople(Array.isArray(payload.rows)?payload.rows:[]);", "  if(waiting.historyFilter&&(payload.apiVersion!==2||payload.scope!=='filtered-likes'||!sameHistoryFilter(waiting.historyFilter,payload.filter)))throw new Error('日付・記事の絞り込み結果を確認できません');\n  if(waiting.historyFilter&&(payload.rows||[]).some(row=>!historyFilterContains(waiting.historyFilter,row)))throw new Error('指定した日付・記事と異なるスキ履歴を検出しました');\n  const people=uniquePeople(Array.isArray(payload.rows)?payload.rows:[]);");
  source = once(source, "{version:231,scope:'recent-likes',at:Date.now(),people}", "{version:297,scope:waiting.historyFilter?'filtered-likes':'recent-likes',historyFilter:waiting.historyFilter,selection:waiting.selection,at:Date.now(),people}");
  source = once(source, "writePrep({signature,index,rows,skipped,presentationOptions:", "writePrep({signature,index,rows,skipped,historyFilter:bridge.historyFilter||null,presentationOptions:");
  source = once(source, 'if(target!==Infinity&&rows.length<target)throw', 'if(!bridge.historyFilter&&target!==Infinity&&rows.length<target)throw');
  source = once(source, "likedAt:String(person.likedAt||'')", "likedAt:String(person.likedAt||''),likedArticleKey:String(person.likedArticleKey||'')");
  source = once(source, "const previous=historyOptions(run),same=previous.mode===options.mode&&(options.mode==='all'||previous.count===options.count);", "const previous=historyOptions(run),same=!options.historyFilter&&!previous.historyFilter&&previous.mode===options.mode&&options.mode==='number'&&previous.count===options.count&&run.rows.length-1===options.count;");
  source = once(source, 'writeRun({...run,version:VERSION,mode:options.mode,count:rows.length-1,historyRequestedCount:', 'writeRun({...run,version:VERSION,mode:options.mode,historyFilter:options.historyFilter||null,count:rows.length-1,historyRequestedCount:');
  source = once(source, "return createFixed300(checkpointHistoryOptions(saved));", "return createFixed300(checkpointHistoryOptions(String(saved?.signature||'').startsWith(String(bridge.at||0)+'|')?saved:null,bridge));");
  source = once(source, "historyRequestedCount:!gallery&&requested.mode==='number'?requested.count:null,choice:", "historyRequestedCount:!gallery&&requested.mode==='number'?requested.count:null,historyFilter:!gallery?requested.historyFilter||null:null,choice:");
  source = once(source, " const hint=detail.querySelector('.hint'),hintText=", " patchHistoryFilterPanel(panel,detail);\n const hint=detail.querySelector('.hint'),hintText=");
  return source;
}
