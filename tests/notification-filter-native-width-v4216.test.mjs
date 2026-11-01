import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(process.env.NOTIFICATION_WIDTH_SOURCE||'public/note-insight-notification-filter-v4.js','utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){for(let i=0;i<80&&!check();i++)await wait(10);assert.ok(check(),label)}
function fixture(t,{viewport=344,nativeWidth=376,rowWidth=500,visualWidth=172,reading=false,count=2}={}){
 const dom=new JSDOM('<header id="header">note</header><aside id="shell" class="m-navbarNotice" style="min-width:376px;max-width:800px!important;box-sizing:content-box"><button>通知</button><button>お知らせ</button><ul id="list" class="notificationList"><li class="m-navbarNoticeItem" id="first"><img id="avatar"><span>人物さんがあなたの記事にスキしました 1分前</span></li><li class="m-navbarNoticeItem" id="second">別人物さんがあなたの記事にスキしました 2分前</li></ul></aside><article id="unrelated">無関係の記事</article>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;t.after(()=>w.close());let layoutWidth=viewport,enabled=true,calls=0;
 Object.defineProperty(w.document.documentElement,'clientWidth',{get:()=>layoutWidth});Object.defineProperty(w,'innerWidth',{get:()=>layoutWidth});
 w.visualViewport={width:visualWidth,scale:2};
 const shell=w.document.querySelector('#shell'),list=w.document.querySelector('#list'),first=w.document.querySelector('#first');
 for(let i=2;i<count;i++){const row=w.document.querySelector('#second').cloneNode(true);row.id='row-'+i;list.append(row)}
 const reads={rows:0};
 const originals=new Map([shell,list,first].map(node=>[node,node.getAttribute('style')]));
 if(nativeWidth!==376)shell.style.minWidth=nativeWidth+'px';
 const bounds=width=>({width,height:300,top:0,bottom:300,left:0,right:width});
 function width(node){
  if(node===shell){const cap=parseFloat(node.style.maxWidth),min=parseFloat(node.style.minWidth)||0;return Math.max(min,Math.min(nativeWidth,Number.isFinite(cap)?cap:Infinity))}
  if(node===list)return width(shell);
  if(node===first){const natural=parseFloat(node.style.width)||rowWidth;return node.style.maxWidth==='100%'?Math.min(natural,width(list)):natural}
  return layoutWidth;
 }
 if(reading){list.style.overflowY='auto';list.scrollTop=400;Object.defineProperties(list,{clientHeight:{get:()=>200},scrollHeight:{get:()=>1500}})}
 w.HTMLElement.prototype.getBoundingClientRect=function(){if(this.classList.contains('m-navbarNoticeItem'))reads.rows++;const rect=bounds(width(this));if(reading&&this===first)return{...rect,top:-list.scrollTop,bottom:(first.style.maxWidth==='100%'?600:400)-list.scrollTop,height:first.style.maxWidth==='100%'?600:400};if(reading&&this.id==='second'){const top=(first.style.maxWidth==='100%'?600:400)-list.scrollTop;return{...rect,top,bottom:top+300}}return rect};
 w.GM={getValue:async(k,d)=>k.includes('filter_enabled')?true:d};w.fetch=async()=>{calls++;return Response.json({data:{urlname:'tester'}})};
 w.__mumeiNotificationFeatureV1={isEnabled:()=>enabled};w.__mumeiNotificationReaderV4={findPanel:()=>shell.isConnected?shell.querySelector('#list'):null};w.eval(source);
 return{w,shell,list,first,originals,reads,calls:()=>calls,width,viewport:value=>{layoutWidth=value;w.dispatchEvent(new w.Event('resize'))},off:()=>{enabled=false;w.dispatchEvent(new w.CustomEvent('mumei-notification-feature-changed',{detail:{enabled:false}}))},ready:()=>until(()=>w.__mumeiNotificationFilterV4.getState(),'native notification filter settles')};
}

test('measured native376px shell and500px row fit layout344px without using pinch-zoom visual172px',async t=>{
 const f=fixture(t);const originals=[...f.list.children];await f.ready();
 assert.equal(f.width(f.shell),344);assert.equal(f.width(f.first),344);assert.equal(f.shell.style.maxWidth,'344px');assert.equal(f.shell.style.minWidth,'0px');assert.equal(f.shell.style.boxSizing,'border-box');
 assert.equal(f.list.style.maxWidth,'100%');assert.equal(f.first.style.maxWidth,'100%');
 assert.deepEqual([...f.list.children],originals,'native notification nodes and order are unchanged');
 for(const id of ['header','unrelated','avatar'])assert.equal(f.w.document.getElementById(id).getAttribute('style'),null,'unrelated content and avatars are untouched');
 assert.equal(f.w.document.body.getAttribute('style'),null);assert.equal(f.w.document.documentElement.getAttribute('style'),null);assert.equal(f.calls(),1,'layout repair makes no additional request');
 const changes=[];const observer=new f.w.MutationObserver(records=>changes.push(...records));observer.observe(f.shell,{attributes:true,subtree:true});await wait(240);observer.disconnect();assert.equal(changes.length,0,'settled native width is not rewritten in a mutation loop');
});

test('ordinary narrow notification layout and desktop overflow keep their native inline widths',async t=>{
 for(const options of [{nativeWidth:320,rowWidth:320},{viewport:1024,nativeWidth:1200,rowWidth:1200}]){
  const f=fixture(t,options),before=f.shell.getAttribute('style');await f.ready();assert.equal(f.shell.getAttribute('style'),before);assert.equal(f.list.getAttribute('style'),null);assert.equal(f.first.style.maxWidth,'');
 }
});

test('orientation uses new layout width, and desktop transition or featureOFF restores native declarations',async t=>{
 const f=fixture(t);await f.ready();f.viewport(430);await until(()=>f.shell.style.maxWidth==='430px','orientation applies the layout viewport, not visual width');assert.equal(f.width(f.shell),376);
 f.viewport(1024);await until(()=>f.shell.style.minWidth==='376px','desktop transition restores native CSS');assert.equal(f.shell.style.maxWidth,'800px');assert.equal(f.shell.style.getPropertyPriority('max-width'),'important');assert.equal(f.shell.style.boxSizing,'content-box');assert.equal(f.first.style.maxWidth,'');
 f.viewport(344);await until(()=>f.shell.style.maxWidth==='344px');f.off();await until(()=>f.shell.style.maxWidth==='800px');assert.equal(f.shell.style.minWidth,'376px');assert.equal(f.list.style.maxWidth,'');assert.equal(f.first.style.maxWidth,'');
});

test('detaching a native panel restores inline styles and does not overwrite later native style changes',async t=>{
 const f=fixture(t);await f.ready();f.first.style.setProperty('max-width','333px');f.shell.remove();await until(()=>f.shell.style.minWidth==='376px','detached native shell is restored');assert.equal(f.first.style.maxWidth,'333px','an intervening native write remains authoritative');assert.equal(f.list.style.maxWidth,'');
});

test('width reflow preserves the lower notification being read before first classification',async t=>{
 const f=fixture(t,{reading:true}),second=f.w.document.getElementById('second');const before=second.getBoundingClientRect().top;await f.ready();
 assert.equal(f.list.scrollTop,600,'the existing scroll ancestor compensates for earlier text becoming taller');assert.equal(second.getBoundingClientRect().top,before,'the visible native row keeps its position');
});

test('300 normal mobile rows reuse width validation across idle and settings passes, while native changes invalidate it',async t=>{
 const f=fixture(t,{nativeWidth:344,rowWidth:344,count:300});await f.ready();await wait(150);f.reads.rows=0;
 for(let i=0;i<3;i++)await f.w.__mumeiNotificationFilterV4.refresh(true);
 assert.equal(f.reads.rows,0,'unchanged mobile rows do not need another300 layout reads per pass');
 const added=f.w.document.querySelector('#second').cloneNode(true);added.id='added';f.list.append(added);await until(()=>f.w.__mumeiNotificationFilterV4.getState()?.total===301,'native append invalidates width evidence');
 assert.equal(f.reads.rows,301,'the changed native collection is measured once');
 f.first.style.width='500px';await until(()=>f.first.style.maxWidth==='100%','external native row style invalidates the fitting-width cache');assert.equal(f.width(f.first),344);
});
