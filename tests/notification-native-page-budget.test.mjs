import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const networkSource=readFileSync('public/note-insight-notification-network-v3300.js','utf8');
const readerSource=readFileSync('public/note-insight-notification-reader-v4.js','utf8');
const filterSource=readFileSync('public/note-insight-notification-filter-v4.js','utf8');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){for(let i=0;i<150&&!check();i++)await sleep(20);assert.ok(check(),label)}
const notice=(id,extra={})=>({id,kind:'note_comment_like',body:`人物さんがあなたのコメントにスキしました ${id}`,noticed_at:new Date(1700000000000+id*60000).toISOString(),action_users:[{name:'人物',url:'https://note.com/person'}],...extra});

async function fixture(t,{count=24,partial=false,filtered=false}={}){
 const initial=Array.from({length:count},(_,i)=>notice(count-i,filtered?{kind:'magazine_note_add_follow',body:`人物さんが共同マガジンに新しい記事を1本追加しました ${count-i}`,all_area_url:'https://note.com/person/m/mFixture'}:{}));
 let notices=initial.map(row=>({...row}));
 const calls=[],saved=[],values=new Map([['mumei_insight_notification_sync_token_v2:tester','fixture-token']]);
 if(filtered){values.set('mumei_insight_magazine_filter_enabled_v3:tester',true);values.set('mumei_insight_notification_groups_v1:tester',[{enabled:true,ids:['person']}]);values.set('mumei_insight_magazine_mute_profiles_v5:tester',[{id:'person',name:'人物'}])}
 const dom=new JSDOM('<body><main class="m-navbarNotice"><button>通知</button><button>お知らせ</button><div id="notice-list"></div></main></body>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;t.after(()=>w.close());
 let clockOffset=0;const now=w.Date.now.bind(w.Date);w.Date.now=()=>now()+clockOffset;
 w.structuredClone=structuredClone;w.Response=Response;
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,top:0,bottom:100,left:0,right:360});
 w.GM={getValue:async(key,fallback)=>values.has(key)?values.get(key):fallback,setValue:async(key,value)=>values.set(key,structuredClone(value)),xmlHttpRequest(options){
  const body=JSON.parse(options.data),rows=body.notifications||[];
  if(options.url.includes('ingest'))saved.push(...structuredClone(rows));
  options.onload({status:200,responseText:JSON.stringify({ok:true,confirmedClientSignatures:rows.map(row=>row.meta.client_signature)})});
 }};
 w.fetch=async input=>{
  const url=new URL(String(input),w.location.href);
  if(url.pathname==='/api/v2/current_user')return Response.json({data:{urlname:'tester'}});
  assert.equal(url.pathname,'/api/v3/notices','the integration fixture permits only native notification reads');
  const page=Number(url.searchParams.get('page')||1),per=Number(url.searchParams.get('per')||12);
  calls.push({page,per,url:url.href});
  return Response.json({data:notices.slice((page-1)*per,page*per),total_count:notices.length,next_page:page*per<notices.length?page+1:null});
 };
 const list=w.document.getElementById('notice-list');
 function element(row){const el=w.document.createElement('div');el.className='m-navbarNoticeItem';el.dataset.noticeId=String(row.id);el.innerHTML='<a href="/person">人物</a><span></span><time></time>';el.querySelector('span').textContent=row.body.replace(/^人物/,'')+' 1分前';el.querySelector('time').dateTime=row.noticed_at;return el}
 list.append(...initial.slice(0,12).map(element));
 let nativeLoading=null,nativeSentinel=null;
 if(filtered){
  list.className='notificationList';list.style.cssText='height:400px;overflow-y:auto';
  nativeLoading=w.document.createElement('div');nativeLoading.id='native-loading';nativeSentinel=w.document.createElement('div');nativeSentinel.className='h-px';list.append(nativeLoading,nativeSentinel);
  const height=el=>el.hidden||w.getComputedStyle(el).display==='none'?0:el.matches('.m-navbarNoticeItem')?60:el.id==='mumei-notification-filter-continuation-v4'?parseFloat(el.style.minHeight)||118:el===nativeLoading?16:el===nativeSentinel?1:0;
  Object.defineProperties(list,{clientHeight:{get:()=>400},scrollHeight:{get:()=>Math.max(400,[...list.children].reduce((sum,el)=>sum+height(el),0))}});
  let top=0;Object.defineProperty(list,'scrollTop',{get:()=>top,set:value=>{top=Math.max(0,Math.min(Number(value)||0,list.scrollHeight-list.clientHeight))}});
  const rect=(top,height)=>({top,bottom:top+height,left:0,right:360,width:360,height});
  w.HTMLElement.prototype.getBoundingClientRect=function(){if(this===list)return rect(100,400);if(this.parentElement===list){let offset=0;for(const el of list.children){if(el===this)break;offset+=height(el)}return rect(100+offset-list.scrollTop,height(this))}return rect(0,100)};
 }
 // Exercise the existing capture parser directly without installing any new
 // production fetch hooks or exporting a test-only method from the product.
 w.eval(networkSource.replace(/\}\)\(\);?\s*$/,'window.__nativePageBudgetCapture=processCapture;})();'));w.eval(readerSource);
 await until(()=>{
  const checkpoint=values.get('mumei_insight_notification_checkpoint_v2922:tester');
  return partial?checkpoint?.lastRunComplete===false&&checkpoint?.lastRunSavedCount===300:checkpoint?.lastRunComplete===true;
 },partial?'the first bounded 300-row history window must be saved':'the initial native history traversal must finish');
 await sleep(250);
 if(filtered){w.eval(filterSource);await until(()=>list.querySelectorAll('.m-navbarNoticeItem.mumei-muted-v2939').length===12,'the real filter must hide the initial registered-person magazine notifications');await sleep(200)}
 return{w,list,calls,saved,values,initial,element,nativeLoading,nativeSentinel,appendNative(rows){const fragment=w.document.createDocumentFragment();fragment.append(...rows.map(element));list.insertBefore(fragment,nativeLoading)},setNotices(rows){notices=rows},advance(ms){clockOffset+=ms},headReads:()=>calls.filter(call=>call.page===1).length,
  capturePage:async(page,rows)=>w.__nativePageBudgetCapture({url:`https://note.com/api/v3/notices?page=${page}&per=12&body_ast=1`,method:'GET',json:{data:rows}}, {probe:false}),
  settle:async()=>{w.__mumeiNotificationReaderV4.scheduleAuto(0);await sleep(400)}};
}

// The DOM append is the real official list behavior. A native page-2 transport
// read is legitimate; a new Reader page-1 read of the same head is the regression.
test('completed native history does not re-read the twelve-row head when older native page 2 is appended',async t=>{
 const h=await fixture(t),before=h.headReads(),saved=h.saved.length,captures=[];
 assert.equal(saved,24,'the initial full history must still ingest the second native page');
 h.w.document.addEventListener('mumei-notification-captured',event=>captures.push(event.detail));
 const native=await h.w.fetch('/api/v3/notices?page=2&per=12&body_ast=1'),data=(await native.json()).data;
 h.list.append(...data.map(h.element));
 await h.capturePage(2,data);
 await h.settle();
 assert.equal(captures.at(-1)?.page,2);assert.equal(captures.at(-1)?.pageSize,12);assert.equal(captures.at(-1)?.pagination,true);
 assert.equal(h.headReads(),before,'older tail pagination must not restart completed head synchronization');
 assert.equal(h.calls.length,3,'two initial history reads plus one legitimate native page-2 read');
 assert.equal(h.saved.length,saved,'already saved older rows need no duplicate ingestion');
});

test('active registered-person magazine filtering preserves native rows without re-reading the completed head on an older twelve-row append',async t=>{
 const h=await fixture(t,{filtered:true}),before=h.headReads(),saved=h.saved.length,original=[...h.list.querySelectorAll('.m-navbarNoticeItem')],sentinel=h.nativeSentinel;
 assert.equal(saved,24,'filtering the official list must not prevent the initial full history from being ingested');
 assert.equal(original.length,12);assert.ok(original.every(el=>el.classList.contains('mumei-muted-v2939')),'the registered-person filter is active before pagination');
 const native=await h.w.fetch('/api/v3/notices?page=2&per=12&body_ast=1'),data=(await native.json()).data;
 h.appendNative(data);await h.capturePage(2,data);
 await until(()=>h.list.querySelectorAll('.m-navbarNoticeItem.mumei-muted-v2939').length===24,'the real filter must hide all twelve newly appended magazine notifications');
 await h.settle();
 const rows=[...h.list.querySelectorAll('.m-navbarNoticeItem')];
 assert.equal(h.headReads(),before,'filter-owned hiding and runway changes must not turn an older append into a new head synchronization');
 assert.equal(h.calls.length,3,'only the initial two history pages and legitimate native older page are read');
 assert.equal(h.saved.length,saved,'the already ingested older page is not saved again');
 for(const [index,node] of original.entries())assert.equal(rows[index],node,'each previously loaded native row remains the same node in its original order');
 assert.deepEqual(rows.slice(12).map(el=>el.dataset.noticeId),data.map(row=>String(row.id)));
 assert.ok(rows.slice(12).every(el=>el.classList.contains('mumei-muted-v2939')),'all twelve new native rows are actually filtered');
 assert.equal(h.list.querySelector('.h-px'),sentinel,'note’s native pagination sentinel remains the same node');
 assert.equal(h.list.querySelectorAll('#mumei-notification-filter-continuation-v4').length,1,'the real filter retains one continuation surface');
});

test('a native page-2 capture without any new DOM rows does not restart a completed head read',async t=>{
 const h=await fixture(t),before=h.headReads();
 await h.capturePage(2,h.initial.slice(12));await h.settle();
 assert.equal(h.headReads(),before,'page metadata distinguishes older pagination from a changed head capture');
});

test('older page-2 captures do not replace the last head signature used to recognize an unchanged page 1',async t=>{
 const h=await fixture(t),headA=h.initial.slice(0,12);
 await h.capturePage(1,headA);await h.settle();
 const checked=h.headReads();
 await h.capturePage(2,h.initial.slice(12));await h.settle();
 await h.capturePage(1,headA);await h.settle();
 assert.equal(h.headReads(),checked,'A → older B → unchanged A must not create another head read');
 const added=notice(25);h.setNotices([added,...h.initial]);
 await h.capturePage(1,[added,...h.initial.slice(0,11)]);await h.settle();
 await until(()=>h.saved.some(row=>row.meta.event_identity==='notice:25'),'a genuinely changed head C must still be saved');
 assert.ok(h.headReads()>checked);
});

test('a page-2 capture does not stop an incomplete initial history journal from continuing its next window',async t=>{
 const h=await fixture(t,{count:324,partial:true}),before=h.headReads();
 assert.equal(h.saved.length,300,'the first history window is deliberately incomplete');
 await h.capturePage(2,h.initial.slice(12,24));h.advance(6000);await h.settle();
 await until(()=>h.values.get('mumei_insight_notification_checkpoint_v2922:tester')?.lastRunComplete===true,'the remaining history must finish');
 assert.equal(h.saved.length,324);assert.equal(new Set(h.saved.map(row=>row.meta.event_identity)).size,324);
 assert.equal(h.headReads(),before,'the durable journal must continue at page 26 rather than restart at page 1');
 assert.ok(h.calls.some(call=>call.page===26));
});

test('a genuinely new head prepend still reads and saves the new notification after completed native history',async t=>{
 const h=await fixture(t),before=h.headReads(),added=notice(25);
 h.setNotices([added,...h.initial]);h.list.prepend(h.element(added));
 await h.settle();
 await until(()=>h.saved.some(row=>row.meta.event_identity==='notice:25'),'new head notification must be saved');
 assert.ok(h.headReads()>before,'new head evidence still starts a delta read');
});

test('a page-1 capture of a new head still starts the delta before the official DOM has rerendered',async t=>{
 const h=await fixture(t),before=h.headReads(),added=notice(25);
 h.setNotices([added,...h.initial]);await h.capturePage(1,[added,...h.initial.slice(0,11)]);
 await h.settle();
 await until(()=>h.saved.some(row=>row.meta.event_identity==='notice:25'),'new native head capture must be saved');
 assert.ok(h.headReads()>before);
});

test('changed existing head text is refreshed even when its native notice identity remains the same',async t=>{
 const h=await fixture(t),before=h.headReads(),updated=notice(24,{body:'人物さんがあなたのコメントにスキしました 24 追記があります'});
 h.setNotices([updated,...h.initial.slice(1)]);h.list.firstElementChild.replaceWith(h.element(updated));
 await h.settle();
 await until(()=>h.saved.some(row=>row.raw_text.includes('追記があります')),'updated head body must be saved');
 assert.ok(h.headReads()>before,'same-ID text changes are meaningful new evidence');
});

test('an explicit manual check still validates the head after automatic native history has completed',async t=>{
 const h=await fixture(t),before=h.headReads();
 await h.w.__mumeiNotificationReaderV4.scan();
 assert.equal(h.headReads(),before+1,'manual refresh must not be suppressed by completed automatic state');
});
