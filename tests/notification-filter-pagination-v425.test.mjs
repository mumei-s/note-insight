import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=process.env.FILTER_PAGINATION_CODE||readFileSync(process.env.FILTER_PAGINATION_SOURCE||'public/note-insight-notification-filter-v4.js','utf8');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<80&&!fn();i++)await pause(10);assert.ok(fn(),'通知フィルターの初期適用を待つ');}
const nativeRow=(id,{muted=true,fallback=false}={})=>`<${fallback?'article':'div'} ${fallback?'':'class="m-navbarNoticeItem"'} id="${id}"><div class="notice-body"><a href="/${muted?'actor':'other'}">${muted?'登録人物':'別の人物'}</a>さんが${muted?'共同マガジンに新しい記事を1本追加しました':'あなたの記事にスキしました'} 1分前</div></${fallback?'article':'div'}>`;
const trackedStyleNames=['overflow-y','max-height','touch-action','overscroll-behavior-y'];
const styles=el=>trackedStyleNames.map(name=>[name,el.style.getPropertyValue(name),el.style.getPropertyPriority(name)]);

function resolveDisplayVariables(w){
 // jsdom does not resolve display:var(...) and incorrectly falls back to a
 // prior display:none rule. Resolve that CSS variable from the actual matching
 // declaration, so this geometry fixture follows browser display semantics.
}

function fixture(t,mode,{clamped=false,mixed=false,footer=false}={}){
 const count=clamped?4:mixed?3:12,headerHeight=clamped?200:40;
 const markup=mixed?nativeRow('fallback-first',{fallback:true})+nativeRow('native-middle')+nativeRow('native-last'):Array.from({length:count},(_,i)=>nativeRow(i===count-1?'native-last':'native-'+i)).join('');
 const dom=new JSDOM(`<body style="overflow:hidden"><style>.m-navbarNoticeItem,article{height:60px}.notice-body{height:40px;margin-top:10px}</style><div id="native-scroll" style="height:400px;overflow-y:auto;overscroll-behavior-y:auto"><section id="panel"><header><button>通知</button><button>お知らせ</button></header><div id="list" class="notificationList" style="overflow-y:auto;${clamped?'max-height:400px;':''}overscroll-behavior-y:none;touch-action:pan-y">${markup}<div id="native-loader"></div>${footer?'<footer id="native-footer" style="height:600px">公式footer</footer>':''}</div></section></div></body>`,{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;t.after(()=>w.close());
 const values=new Map([['mumei_insight_magazine_filter_enabled_v3:tester',true],['mumei_insight_notification_groups_v1:tester',[{enabled:true,ids:['actor']}]],['mumei_insight_magazine_mute_profiles_v5:tester',[{id:'actor',name:'登録人物'}]]]);
 if(mode==='modern')w.GM={getValue:async(key,fallback)=>values.get(key)??fallback,setValue:async(key,value)=>values.set(key,value)};
 else{w.GM_getValue=(key,fallback)=>values.get(key)??fallback;w.GM_setValue=(key,value)=>values.set(key,value)}
 let requests=0;w.fetch=async()=>{requests++;return Response.json({data:{urlname:'tester'}})};
 const host=w.document.getElementById('native-scroll'),list=w.document.getElementById('list'),panel=w.document.getElementById('panel'),loader=w.document.getElementById('native-loader');
 const nativeNodes=[...list.children].filter(el=>el.matches('.m-navbarNoticeItem,article')),nativeLast=nativeNodes.at(-1),target=nativeLast.querySelector('.notice-body');
 const initialStyles={host:styles(host),list:styles(list)};
 resolveDisplayVariables(w);
 function displayed(el){for(let p=el;p;p=p.parentElement)if(p.hidden||w.getComputedStyle(p).display==='none')return false;return true}
 function height(el){
  if(!displayed(el))return 0;
  if(el.id==='mumei-notification-filter-continuation-v4')return Math.max(118,parseFloat(w.getComputedStyle(el).minHeight)||0);
  if(el===loader)return 16;
  if(el.id==='native-footer')return 600;
  if(el.classList.contains('notice-body'))return 40;
  if(nativeNodes.includes(el)||el.matches('.m-navbarNoticeItem'))return parseFloat(w.getComputedStyle(el).height)||60;
  return 36;
 }
 const content=()=>[...list.children].reduce((sum,el)=>sum+height(el),0);
 const listHeight=()=>{const max=parseFloat(w.getComputedStyle(list).maxHeight);return Math.min(content(),Number.isFinite(max)?max:Infinity)};
 Object.defineProperties(list,{clientHeight:{get:listHeight},scrollHeight:{get:content}});
 Object.defineProperties(host,{clientHeight:{get:()=>400},scrollHeight:{get:()=>Math.max(400,headerHeight+listHeight())}});
 for(const el of [host,list]){let offset=0;Object.defineProperty(el,'scrollTop',{get:()=>offset,set:value=>{offset=Math.max(0,Math.min(Number(value)||0,el.scrollHeight-el.clientHeight))}})}
 function rect(top,h){return{width:360,height:h,top,bottom:top+h,left:0,right:360}}
 function rowRect(el){let offset=0;for(const child of list.children){if(child===el)break;offset+=height(child)}return rect(100+headerHeight-host.scrollTop+offset-list.scrollTop,height(el))}
 w.HTMLElement.prototype.getBoundingClientRect=function(){
  if(this===w.document.body||this===w.document.documentElement)return rect(0,w.innerHeight);
  if(this===host)return rect(100,400);
  if(this===panel)return rect(100-host.scrollTop,headerHeight+listHeight());
  if(this===list)return rect(100+headerHeight-host.scrollTop,listHeight());
  if(this.parentElement===list)return rowRect(this);
  if(this.classList.contains('notice-body'))return rect(rowRect(this.parentElement).top+10,height(this));
  return rect(100,36);
 };
 // This models the browser's ancestor clipping, rather than considering any
 // nonzero row height enough to satisfy the native observer.
 function ratio(el){
  const r=el.getBoundingClientRect();if(!r.height)return 0;
  let top=r.top,bottom=r.bottom;
  for(let ancestor=el.parentElement;ancestor;ancestor=ancestor.parentElement){
   const css=w.getComputedStyle(ancestor);if(!/(?:auto|scroll|hidden|clip)/.test(css.overflowY+' '+css.overflow))continue;
   const bounds=ancestor.getBoundingClientRect();top=Math.max(top,bounds.top);bottom=Math.min(bottom,bounds.bottom);
  }
  return Math.max(0,bottom-top)/r.height;
 }
 const initial={innerClient:list.clientHeight,innerScroll:list.scrollHeight,outerClient:host.clientHeight,outerScroll:host.scrollHeight};
 w.__mumeiNotificationReaderV4={findPanel:()=>list};w.eval(source);
 async function ready(){await until(()=>panel.querySelectorAll('.mumei-muted-v2939').length===count&&panel.querySelector('#mumei-notification-filter-continuation-v4'))}
 async function disable(){values.set('mumei_insight_magazine_filter_enabled_v3:tester',false);await w.__mumeiNotificationFilterV4.refresh(true);assert.equal(panel.querySelector('#mumei-notification-filter-continuation-v4'),null);assert.equal(panel.querySelector('.mumei-muted-v2939'),null);assert.deepEqual(styles(host),initialStyles.host);assert.deepEqual(styles(list),initialStyles.list);assert.equal(nativeLast.hasAttribute('inert'),false);assert.equal(nativeLast.hasAttribute('aria-hidden'),false)}
 return{w,values,panel,list,host,loader,nativeNodes,nativeLast,target,initial,ratio,ready,disable,requests:()=>requests};
}

for(const mode of ['modern','legacy'])test(`フィルターのspacerが内側を後からoverflowにしても公式の外側scroll listenerへ進む (${mode})`,async t=>{
 const f=fixture(t,mode,{clamped:true});
 // 4 × 60px + 16px loader is below the 400px inner clamp. A 200px
 // native header makes only the outer 400px host scrollable before filtering.
 assert.equal(f.initial.innerClient,256);assert.equal(f.initial.innerScroll,256);
 assert.equal(f.initial.outerScroll,456);assert.equal(f.initial.outerClient,400);
 await f.ready();const bridge=f.panel.querySelector('#mumei-notification-filter-continuation-v4');
 assert.ok(parseFloat(bridge.style.minHeight)>400,'runway挿入で内側に新たなoverflowを作り得る条件');
 let nativePages=0,innerScrollEvents=0;
 f.list.addEventListener('scroll',()=>innerScrollEvents++);
 f.host.addEventListener('scroll',()=>{if(nativePages||f.host.scrollTop+f.host.clientHeight<f.host.scrollHeight-1)return;nativePages++;f.loader.insertAdjacentHTML('beforebegin',nativeRow('native-next',{muted:false}))});
 bridge.querySelector('button').click();
 assert.equal(nativePages,1,'後からoverflowになった内側へsurfaceを再選択すると公式listenerが一度も動かない');
 assert.equal(innerScrollEvents,0,'公式枠のscroll listenerへ送る');
 await f.w.__mumeiNotificationFilterV4.refresh();assert.ok(f.panel.querySelector('#native-next'));
 assert.equal(f.values.get('mumei_insight_magazine_filter_enabled_v3:tester'),true);assert.equal(f.requests(),1);
 for(const node of f.nativeNodes)assert.equal(f.w.document.getElementById(node.id),node);
 await f.disable();assert.equal(f.w.document.body.style.overflow,'hidden');
});

for(const mode of ['modern','legacy'])test(`最後の通知内部bodyを50%監視する公式IOでは1pxへ潰さず元のgeometryを保持する (${mode})`,async t=>{
 const f=fixture(t,mode);await f.ready();
 assert.equal(f.target.getBoundingClientRect().height,40);
 let nativePages=0,lastRatio=0;
 // note observes this child node with threshold 0.5. Merely retaining a 1px
 // parent still clips the child completely because its body starts at y + 10px.
 const observed=f.target;
 f.host.addEventListener('scroll',()=>{lastRatio=f.ratio(observed);if(nativePages||lastRatio<0.5)return;nativePages++;f.loader.insertAdjacentHTML('beforebegin',nativeRow('io-next',{muted:false}))});
 f.panel.querySelector('#mumei-notification-filter-continuation-v4 button').click();
 assert.ok(lastRatio>=0.5,`native body IO threshold未達: intersectionRatio=${lastRatio}`);
 assert.equal(nativePages,1);assert.equal(f.nativeLast.getBoundingClientRect().height,60);
 assert.equal(f.w.document.getElementById('native-last'),f.nativeLast);assert.equal(f.nativeLast.querySelector('.notice-body'),observed);
 assert.equal(f.w.getComputedStyle(f.nativeLast).opacity,'0');assert.equal(f.nativeLast.hasAttribute('inert'),true);
 assert.equal(f.values.get('mumei_insight_magazine_filter_enabled_v3:tester'),true);assert.equal(f.requests(),1);
 await f.disable();assert.equal(f.nativeLast.getBoundingClientRect().height,60);
});

for(const mode of ['modern','legacy'])test(`fallback先頭行があってもDOM上の本当の末尾native行を読み込み対象にする (${mode})`,async t=>{
 const f=fixture(t,mode,{mixed:true});await f.ready();
 const bridge=f.panel.querySelector('#mumei-notification-filter-continuation-v4');
 assert.equal(bridge.nextElementSibling.id,'native-last','known候補→fallback候補の配列順ではなくDOM順を使う');
 assert.equal(f.panel.querySelector('[data-mumei-filter-page-edge]').id,'native-last');
 assert.equal(f.w.document.getElementById('fallback-first').getAttribute('data-mumei-filter-page-edge'),null);
 let nativePages=0;f.host.addEventListener('scroll',()=>{if(nativePages||f.ratio(f.target)<0.5)return;nativePages++;f.loader.insertAdjacentHTML('beforebegin',nativeRow('mixed-next',{muted:false}))});
 bridge.querySelector('button').click();assert.equal(nativePages,1);assert.ok(f.panel.querySelector('#mixed-next'));
 for(const node of f.nativeNodes)assert.equal(f.w.document.getElementById(node.id),node);
 assert.equal(f.values.get('mumei_insight_magazine_filter_enabled_v3:tester'),true);assert.equal(f.requests(),1);
 await f.disable();
});

for(const mode of ['modern','legacy'])test(`公式footerが通知後に600pxあっても最下端へ通過せずnative targetとloaderへ進む (${mode})`,async t=>{
 const f=fixture(t,mode,{footer:true});await f.ready();
 assert.equal(f.w.document.getElementById('native-footer').getBoundingClientRect().height,600);
 let nativePages=0,lastRatio=0,loaderAtScroll=null;
 f.host.addEventListener('scroll',()=>{
  lastRatio=f.ratio(f.target);loaderAtScroll=f.loader.getBoundingClientRect();
  if(nativePages||lastRatio<0.5)return;nativePages++;f.loader.insertAdjacentHTML('beforebegin',nativeRow('footer-next',{muted:false}));
 });
 f.panel.querySelector('#mumei-notification-filter-continuation-v4 button').click();
 assert.ok(lastRatio>=0.5,`footerの末端へのscrollが監視対象を画面上へ通過: ratio=${lastRatio}`);
 assert.equal(nativePages,1);assert.ok(f.panel.querySelector('#footer-next'));
 const viewport=f.host.getBoundingClientRect();
 assert.ok(loaderAtScroll.top>=viewport.top&&loaderAtScroll.bottom<=viewport.bottom,'小さい公式loaderも最終通知と同じ表示領域に入る');
 assert.equal(f.values.get('mumei_insight_magazine_filter_enabled_v3:tester'),true);assert.equal(f.requests(),1);
 assert.equal(f.nativeLast.querySelector('.notice-body'),f.target);
 await f.disable();
});

// This structure and native gate follow note's public Notifications bundle:
// fixed-height ul -> notice li -> loading li -> independent .h-px target -> end li.
function officialSentinelFixture(t,mode,{initialCollapsed=false,terminal=false,shortNested=false}={}){
 const dom=new JSDOM(`<body style="overflow:hidden"><style>.native-notice{height:60px}.native-body{height:40px;margin-top:10px}</style>${shortNested?'<div id="official-outer" style="height:400px;overflow-y:auto"><header style="height:200px">':'<header>'}<button>通知</button><button>お知らせ</button></header><ul id="official-notices" class="min-h-0 flex-1 overflow-y-auto" style="height:400px;overflow-y:auto"><li id="official-loading" style="height:16px"></li><div id="official-sentinel" class="h-px" style="height:1px"><div class="h-px"></div></div><li id="official-end">${terminal?'最新の通知は以上です':''}</li></ul>${shortNested?'</div>':''}</body>`,{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;t.after(()=>w.close());resolveDisplayVariables(w);
 const outer=w.document.getElementById('official-outer'),root=w.document.getElementById('official-notices'),loading=w.document.getElementById('official-loading'),sentinel=w.document.getElementById('official-sentinel'),end=w.document.getElementById('official-end');
 const values=new Map([['mumei_insight_magazine_filter_enabled_v3:tester',true],['mumei_insight_notification_groups_v1:tester',[{enabled:true,ids:['actor']}]],['mumei_insight_magazine_mute_profiles_v5:tester',[{id:'actor',name:'登録人物'}]]]);
 if(mode==='modern')w.GM={getValue:async(key,fallback)=>values.get(key)??fallback,setValue:async(key,value)=>values.set(key,value)};
 else{w.GM_getValue=(key,fallback)=>values.get(key)??fallback;w.GM_setValue=(key,value)=>values.set(key,value)}
 let accountCalls=0;w.fetch=async()=>{accountCalls++;return Response.json({data:{urlname:'tester'}})};
 const frames=new Map();let frameId=0;
 w.requestAnimationFrame=callback=>{const id=++frameId;frames.set(id,callback);return id};w.cancelAnimationFrame=id=>frames.delete(id);
 const displayed=el=>{for(let node=el;node;node=node.parentElement)if(node.hidden||w.getComputedStyle(node).display==='none')return false;return true};
 function height(el){
  if(!displayed(el))return 0;
  if(el.id==='mumei-notification-filter-continuation-v4')return Math.max(118,parseFloat(w.getComputedStyle(el).minHeight)||0);
  if(el.classList.contains('native-notice'))return parseFloat(w.getComputedStyle(el).height)||60;
  if(el.classList.contains('native-body'))return 40;
  if(el===loading)return 16;if(el===sentinel)return 1;if(el===end)return end.textContent.trim()?48:0;
  return 36;
 }
 const content=()=>[...root.children].reduce((sum,el)=>sum+height(el),0);
 Object.defineProperties(root,{clientHeight:{get:()=>400},scrollHeight:{get:()=>Math.max(400,content())}});
 if(outer){Object.defineProperties(outer,{clientHeight:{get:()=>400},scrollHeight:{get:()=>600}});let offset=0;Object.defineProperty(outer,'scrollTop',{get:()=>offset,set:value=>{offset=Math.max(0,Math.min(Number(value)||0,200))}})}
 let scrollTop=0;Object.defineProperty(root,'scrollTop',{get:()=>scrollTop=Math.max(0,Math.min(scrollTop,root.scrollHeight-root.clientHeight)),set:value=>{scrollTop=Math.max(0,Math.min(Number(value)||0,root.scrollHeight-root.clientHeight))}});
 const rect=(top,h)=>({top,bottom:top+h,left:0,right:360,width:360,height:h});
 const childRect=el=>{let offset=0;for(const child of root.children){if(child===el)break;offset+=height(child)}return rect(100+(outer?200-outer.scrollTop:0)+offset-root.scrollTop,height(el))};
 w.HTMLElement.prototype.getBoundingClientRect=function(){if(this===outer)return rect(100,400);if(this===root)return rect(100+(outer?200-outer.scrollTop:0),400);if(this===w.document.body||this===w.document.documentElement)return rect(0,w.innerHeight);if(this.parentElement===root)return childRect(this);if(this.classList.contains('native-body'))return rect(childRect(this.parentElement).top+10,height(this));return rect(80,36)};
 let page=1,nativeFetches=0,rangeBlocked=0,appendPending=false;
 function appendPage(number,count=12){for(let i=0;i<count;i++)loading.insertAdjacentHTML('beforebegin',`<li class="native-notice relative flex border-border-weak border-t p-3" id="page-${number}-${i}"><div class="native-body"><a href="/actor">登録人物</a>さんが共同マガジンに新しい記事を1本追加しました 1分前</div></li>`)}
 class NativeIntersectionObserver{
  constructor(callback,options){this.callback=callback;this.options=options;this.target=null;this.last=null;this.entries=[]}
  observe(target){this.target=target;this.sample(true)}
  disconnect(){this.target=null}
  sample(force=false){
   if(!this.target)return;const r=this.target.getBoundingClientRect(),bounds=root.getBoundingClientRect(),margin=parseFloat(this.options.rootMargin);
   const top=bounds.top-margin,bottom=bounds.bottom+margin,isIntersecting=r.height>0&&r.bottom>=top&&r.top<=bottom,intersectionRatio=r.height?Math.max(0,Math.min(r.bottom,bottom)-Math.max(r.top,top))/r.height:0;
   const thresholdIndex=this.options.threshold.filter(value=>intersectionRatio>=value).length;
   if(!force&&this.last?.isIntersecting===isIntersecting&&this.last?.thresholdIndex===thresholdIndex)return;
   this.last={isIntersecting,thresholdIndex};const entry={target:this.target,isIntersecting,intersectionRatio};this.entries.push(entry);this.callback([entry]);
  }
 }
 const observer=new NativeIntersectionObserver(entries=>{
  if(!entries[0].isIntersecting||terminal)return;
  // The official infinite-loader checks this gate inside its IO callback.
  // A synthetic scroll with unchanged intersection does not invoke it again.
  if(root.scrollHeight<=root.clientHeight){rangeBlocked++;return}
  nativeFetches++;page++;appendPage(page);appendPending=true;
 },{root,rootMargin:'200px',threshold:[0,.5,1]});
 if(initialCollapsed){observer.observe(sentinel);assert.equal(rangeBlocked,1,'空の公式ulでは最初の交差をrange gateが抑止する');appendPage(1)}
 else{appendPage(1,shortNested?4:12);observer.observe(sentinel)}
 const original=[...root.querySelectorAll('.native-notice')];w.__mumeiNotificationReaderV4={findPanel:()=>root};w.eval(source);
 async function ready(){await until(()=>root.querySelectorAll('.native-notice.mumei-muted-v2939').length===(shortNested?4:12))}
 async function paint(){
  const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(Date.now());
  observer.sample();
  // note appends a full 12-item page. Apply the active filter before the next
  // observer paint, so the transient 720px unfiltered page cannot rearm it.
  if(appendPending){appendPending=false;await w.__mumeiNotificationFilterV4.refresh()}
  await pause(0);
 }
 async function clickAndPaint(){const button=root.querySelector('#mumei-notification-filter-continuation-v4 button');assert.ok(button);assert.equal(button.disabled,false);button.click();for(let i=0;i<5;i++)await paint()}
 return{w,root,outer,loading,sentinel,end,observer,original,values,ready,paint,clickAndPaint,page:()=>page,nativeFetches:()=>nativeFetches,rangeBlocked:()=>rangeBlocked,accountCalls:()=>accountCalls};
}

for(const mode of ['modern','legacy'])test(`公式の独立sentinelは全件filter後も境界を再armし、手動クリック2回でpage 2・3を取得する (${mode})`,async t=>{
 const f=officialSentinelFixture(t,mode);await f.ready();
 assert.equal(f.observer.options.root,f.root);assert.equal(f.observer.options.rootMargin,'200px');assert.deepEqual(f.observer.options.threshold,[0,.5,1]);
 await f.clickAndPaint();assert.equal(f.page(),2,'1回目で公式IOが次の12件を追加する');assert.equal(f.nativeFetches(),1);
 assert.equal(f.root.querySelectorAll('.native-notice.mumei-muted-v2939').length,24);
 const transitionsBefore=f.observer.entries.length;const observedNode=f.sentinel;
 // The previous positive intersection is retained after all twelve new rows
 // collapse. A raw scroll event alone must not produce a new IO callback.
 assert.equal(f.observer.last.isIntersecting,true);f.root.dispatchEvent(new f.w.Event('scroll'));await f.paint();assert.equal(f.nativeFetches(),1);
 await f.clickAndPaint();assert.equal(f.page(),3,'2回目でも既存sentinelに新しい交差を作り、次の12件を取得する');assert.equal(f.nativeFetches(),2);
 assert.ok(f.observer.entries.length>=transitionsBefore+2,'margin外→内への有限な交差変更を作る');assert.equal(f.root.querySelectorAll('.native-notice.mumei-muted-v2939').length,36);
 assert.equal(f.w.document.getElementById('official-sentinel'),observedNode);for(const row of f.original)assert.equal(f.w.document.getElementById(row.id),row);
 assert.equal(f.values.get('mumei_insight_magazine_filter_enabled_v3:tester'),true);assert.equal(f.accountCalls(),1);
});

for(const mode of ['modern','legacy'])test(`公式IOのinitial交差がrange gateで抑止済みでも、全件filterの続きクリックで再試行する (${mode})`,async t=>{
 const f=officialSentinelFixture(t,mode,{initialCollapsed:true});await f.ready();await f.paint();
 assert.equal(f.rangeBlocked(),1);assert.equal(f.nativeFetches(),0);
 await f.clickAndPaint();assert.equal(f.page(),2);assert.equal(f.nativeFetches(),1);assert.equal(f.accountCalls(),1);
});

for(const mode of ['modern','legacy'])test(`公式ulの「最新の通知は以上です」で取得終了なら続きrunwayを出さない (${mode})`,async t=>{
 const f=officialSentinelFixture(t,mode,{terminal:true});await f.ready();await f.paint();
 assert.equal(f.end.textContent,'最新の通知は以上です');assert.equal(f.root.querySelector('#mumei-notification-filter-continuation-v4'),null);
 assert.equal(f.root.querySelectorAll('.native-notice.mumei-muted-v2939').length,12);assert.equal(f.nativeFetches(),0);assert.equal(f.accountCalls(),1);
 assert.equal(f.values.get('mumei_insight_magazine_filter_enabled_v3:tester'),true);
});

for(const mode of ['modern','legacy'])test(`短い公式ulが最初はrangeなしでも外側hostへ移さずUL自身のIOを2回再armする (${mode})`,async t=>{
 const f=officialSentinelFixture(t,mode,{shortNested:true});
 assert.equal(f.root.scrollHeight,f.root.clientHeight);assert.ok(f.outer.scrollHeight>f.outer.clientHeight);assert.equal(f.rangeBlocked(),1);
 await f.ready();await f.paint();assert.ok(f.root.scrollHeight>f.root.clientHeight,'runway後に公式ulのrangeができる');
 await f.clickAndPaint();assert.equal(f.page(),2);assert.equal(f.nativeFetches(),1);
 assert.equal(f.outer.scrollTop,0,'内側IO rootとtargetを一緒に動かす外側scrollへ切り替えない');
 await f.clickAndPaint();assert.equal(f.page(),3);assert.equal(f.nativeFetches(),2);
 assert.equal(f.observer.options.root,f.root);assert.equal(f.w.document.getElementById('official-sentinel'),f.sentinel);
 assert.equal(f.root.querySelectorAll('.native-notice.mumei-muted-v2939').length,28);assert.equal(f.accountCalls(),1);
});
