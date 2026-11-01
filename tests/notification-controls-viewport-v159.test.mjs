import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync('public/note-insight-notification-controls-v1.js','utf8'),ID='mumei-inline-notification-controls-v1';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let i=0;i<80&&!check();i++)await pause(10);assert.ok(check(),'toolbar settles')}
async function fixture(t,{visual=true,width=360,height=800}={}){
 const dom=new JSDOM('<main><section class="m-navbarNotice" id="panel"><button>通知</button><button>お知らせ</button><div class="m-navbarNoticeItem">人物さんがスキしました 1分前</div></section></main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>w.close());
 const dimensions={width,height},view=new w.EventTarget();Object.assign(view,{width,height,offsetLeft:0,offsetTop:0,scale:1});
 Object.defineProperties(w.document.documentElement,{clientWidth:{get:()=>dimensions.width},clientHeight:{get:()=>dimensions.height}});
 Object.defineProperty(w,'visualViewport',{value:visual?view:undefined,configurable:true});
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:300,top:0,left:0,bottom:300,right:360});
 const values=new Map();w.GM={getValue:async(key,fallback)=>values.get(key)??fallback,setValue:async(key,value)=>values.set(key,value)};
 let requests=0;w.fetch=async()=>{requests++;return Response.json({data:{urlname:'tester'}})};
 w.__mumeiNotificationReaderV4={findPanel:()=>w.document.getElementById('panel')};
 w.document.getElementById('panel').scrollTop=270;w.document.body.style.overflow='hidden';
 w.eval(source);await until(()=>w.document.getElementById(ID));await pause(220);
 return{w,view,dimensions,values,bar:()=>w.document.getElementById(ID),requests:()=>requests,emit:type=>view.dispatchEvent(new w.Event(type))};
}
function geometry(f){const bar=f.bar();return{left:parseFloat(bar.style.left),width:parseFloat(bar.style.width),occludedBottom:parseFloat(bar.style.getPropertyValue('--mumei-notification-viewport-bottom'))}}

test('browser bottom controls shrink only the visible viewport: keep the entire dock above their measured boundary',async t=>{
 const f=await fixture(t);Object.assign(f.view,{height:625});f.emit('resize');
 await until(()=>geometry(f).occludedBottom===175);
 assert.deepEqual(geometry(f),{left:8,width:344,occludedBottom:175});
 assert.equal(f.w.getComputedStyle(f.bar()).boxSizing,'border-box');
 for(const button of f.bar().querySelectorAll(':scope > button'))assert.equal(f.w.getComputedStyle(button).height,'32px');
 assert.equal(f.w.document.getElementById('panel').scrollTop,270,'native notification scroll remains untouched');assert.equal(f.w.document.body.style.overflow,'hidden');
});

test('pinch panning uses visible CSS width and offsets without changing zoom or creating horizontal dock overflow',async t=>{
 const f=await fixture(t);Object.assign(f.view,{width:180,height:400,offsetLeft:90,offsetTop:180,scale:2});f.emit('resize');f.emit('scroll');
 await until(()=>geometry(f).width===164);
 assert.deepEqual(geometry(f),{left:98,width:164,occludedBottom:220});
 assert.ok(geometry(f).left>=f.view.offsetLeft);assert.ok(geometry(f).left+geometry(f).width<=f.view.offsetLeft+f.view.width);
 assert.equal(f.view.scale,2);assert.equal(f.bar().style.transform,'');
});

test('browser bars expanding and collapsing update one existing toolbar without fetching accounts or changing its DOM',async t=>{
 const f=await fixture(t),bar=f.bar(),buttons=[...bar.children],requests=f.requests();
 Object.assign(f.view,{height:600});for(let i=0;i<50;i++){f.emit('resize');f.emit('scroll')}
 await until(()=>geometry(f).occludedBottom===200);
 Object.assign(f.view,{height:800});f.emit('resize');await until(()=>geometry(f).occludedBottom===0);await pause(220);
 assert.equal(f.bar(),bar);assert.deepEqual([...bar.children],buttons);assert.equal(f.requests(),requests,'geometry events never resync or refetch notification state');
 let writes=0;const observer=new f.w.MutationObserver(records=>{writes+=records.length});observer.observe(bar,{attributes:true,attributeFilter:['style']});
 for(let i=0;i<50;i++){f.emit('resize');f.emit('scroll')}
 await pause(70);observer.disconnect();assert.equal(writes,0,'unchanged viewport does not rewrite inline geometry');
});

test('orientation change works without VisualViewport and retains compact text/track constraints',async t=>{
 const f=await fixture(t,{visual:false});assert.deepEqual(geometry(f),{left:8,width:344,occludedBottom:0});
 Object.assign(f.dimensions,{width:688,height:360});f.w.dispatchEvent(new f.w.Event('orientationchange'));
 await until(()=>geometry(f).width===672);assert.deepEqual(geometry(f),{left:8,width:672,occludedBottom:0});
 assert.equal(f.w.getComputedStyle(f.bar().querySelector('.read-status')).whiteSpace,'normal','keep saved progress and failure reasons readable');assert.equal(f.w.getComputedStyle(f.bar().querySelector('.read-status')).overflowWrap,'anywhere');
 assert.match(f.w.getComputedStyle(f.bar()).gridTemplateColumns,/minmax\(0,\s*\.95fr\)/);
});

test('zero/nonfinite transient viewport reports fall back without invalid positions or stuck offsets',async t=>{
 const f=await fixture(t);Object.assign(f.view,{width:0,height:NaN,offsetLeft:NaN,offsetTop:Infinity});f.emit('resize');await pause(70);
 assert.deepEqual(geometry(f),{left:8,width:344,occludedBottom:0});
 Object.assign(f.view,{width:344,height:700,offsetLeft:-12,offsetTop:-50});f.emit('scroll');await until(()=>geometry(f).occludedBottom===100);
 assert.deepEqual(geometry(f),{left:8,width:328,occludedBottom:100});
});

test('viewport events while the controls are OFF do not remount them or make background requests',async t=>{
 const f=await fixture(t);f.values.set('mumei_insight_notification_panel_enabled_v1',false);await f.w.__mumeiNotificationControlsV1.refreshPanel();
 assert.equal(f.bar(),null);const requests=f.requests();for(let i=0;i<30;i++){f.emit('resize');f.emit('scroll');f.w.dispatchEvent(new f.w.Event('resize'))}
 await pause(250);assert.equal(f.bar(),null);assert.equal(f.requests(),requests);
});
