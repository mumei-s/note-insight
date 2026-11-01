import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const sources=['reader-v4','controls-v1','filter-v4','return-v1'].map(name=>readFileSync(`public/note-insight-notification-${name}.js`,'utf8'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<100&&!fn();i++)await sleep(20);assert.ok(fn(),label)}

async function fixture(t,{reuse=false}={}){
 const dom=new JSDOM('<header><button id="bell" aria-label="通知">🔔</button></header><main id="app"></main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;t.after(()=>w.close());
 const values=new Map([
  ['mumei_insight_magazine_filter_enabled_v3:tester',true],
  ['mumei_insight_notification_groups_v1:tester',[{enabled:true,ids:['actor']}]],
  ['mumei_insight_magazine_mute_profiles_v5:tester',[{id:'actor',name:'登録人物'}]],
 ]),listeners=[];
 w.sessionStorage.setItem('mumei-notification-read-paused-v1','1');
 w.GM={getValue:async(k,d)=>values.has(k)?values.get(k):d,setValue:async(k,v)=>{const old=values.get(k);values.set(k,v);for(const x of listeners)if(x.k===k)x.fn(k,old,v,true)},addValueChangeListener:(k,fn)=>listeners.push({k,fn})};
 let requests=0,bellClicks=0,outer=null;
 w.fetch=async input=>{requests++;assert.equal(new URL(String(input),w.location.href).pathname,'/api/v2/current_user');return Response.json({data:{urlname:'tester'}})};
 const rect=(height=300)=>({width:360,height,top:100,bottom:100+height,left:0,right:360});
 w.HTMLElement.prototype.getBoundingClientRect=function(){return rect(this.hidden||w.getComputedStyle(this).display==='none'?0:300)};
 function mount(){
  if(reuse&&outer){outer.hidden=false;return}
  outer=w.document.createElement('div');outer.id='scroll';outer.style.overflowY='auto';
  Object.defineProperties(outer,{clientHeight:{get:()=>400},scrollHeight:{get:()=>1200}});
  outer.innerHTML='<section class="m-navbarNotice"><button>通知</button><button>お知らせ</button><div class="notificationList" id="items"><div class="m-navbarNoticeItem" data-notice-id="like"><a href="/author/n/nabcdef012345">登録人物さんがあなたの記事にスキしました</a><time datetime="2026-11-01T10:00:00Z">1分前</time></div><div class="m-navbarNoticeItem" data-notice-id="magazine"><a href="/actor"><img src="https://assets.example/actor.png"></a>登録人物さんが共同マガジンに新しい記事を3本追加しました 1分前</div></div></section>';
  w.document.querySelector('#app').append(outer);
 }
 mount();outer.scrollTop=170;
 w.document.querySelector('#bell').addEventListener('click',()=>{bellClicks++;mount()});
 w.document.addEventListener('click',event=>{const link=event.target.closest('a[href*="/n/"]');if(!link)return;event.preventDefault();w.history.pushState({native:'article'},'',link.getAttribute('href'));if(reuse)outer.hidden=true;else outer.remove()});
 for(const source of sources)w.eval(source);
 const muted=()=>w.document.querySelector('[data-notice-id="magazine"]')?.classList.contains('mumei-muted-v2939');
 await until(muted,'real filter hides the configured magazine notification before opening its neighbor');
 return{w,values,muted,outer:()=>outer,requests:()=>requests,bellClicks:()=>bellClicks};
}

for(const reuse of [false,true])test(`article Back restores native bell with real Reader, filter and compact controls (${reuse?'reused panel':'recreated panel'})`,async t=>{
 const h=await fixture(t,{reuse});
 h.w.history.replaceState({native:'source',scroll:42},'',h.w.location.href);
 h.w.document.querySelector('[data-notice-id="like"] a').dispatchEvent(new h.w.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
 assert.equal(h.w.location.pathname,'/author/n/nabcdef012345');
 h.w.history.back();
 await until(()=>h.w.location.pathname==='/'&&h.bellClicks()===1&&h.muted()&&!h.outer().hidden,'Back reopens native notifications and reapplies the existing per-account filter');
 await until(()=>h.w.__mumeiNotificationReturnDone===true,'bounded return restoration completes');
 assert.equal(h.outer().scrollTop,170,'the actual outer scroll ancestor is restored');
 assert.equal(h.w.history.state.native,'source','native router state is preserved');
 assert.equal(h.w.history.state.scroll,42);
 assert.equal(h.values.get('mumei_insight_magazine_filter_enabled_v3:tester'),true);
 assert.ok(!h.w.document.querySelector('[data-notice-id="like"]').classList.contains('mumei-muted-v2939'),'a neighboring article-like notification remains visible');
 await until(()=>h.w.document.querySelectorAll('[data-mumei-notification-controls="1"]').length===1,'one toolbar mounts after Back');
 const bar=h.w.document.querySelector('[data-mumei-notification-controls="1"]');
 assert.equal(h.w.getComputedStyle(bar.querySelector('button')).height,'32px','return handling keeps the existing compact action row');
 const requests=h.requests();await sleep(400);
 assert.equal(h.requests(),requests,'settled restoration and filter rendering do not poll current_user');
 assert.equal(h.bellClicks(),1,'the bell is clicked once and does not toggle closed again');
});

test('duplicate row hiding remains visible as Reader evidence and cannot restart a completed history read',async t=>{
 const h=await fixture(t),list=h.w.document.querySelector('#items'),first=list.querySelector('[data-notice-id="like"]'),copy=first.cloneNode(true);
 list.append(copy);
 await until(()=>copy.classList.contains('mumei-muted-v2939'),'the actual filter hides the duplicate native ID');
 let scans=0;
 h.w.__mumeiNotificationNetwork3300={syncCurrent:async()=>{scans++;return{historyComplete:true,saved:0}},stop(){}};
 await h.w.__mumeiNotificationReaderV4.resume();
 await sleep(350);
 const completed=scans;assert.ok(completed>0,'the Reader has resumed and completed its native opening check');
 for(let i=0;i<3;i++)await h.w.__mumeiNotificationFilterV4.refresh();
 await sleep(500);
 assert.equal(scans,completed,'filter-owned duplicate visibility must not look like a new native head');
 assert.ok(copy.isConnected&&first.isConnected,'both original React row nodes remain intact');
 assert.equal(h.w.__mumeiNotificationReaderV4.findPanel(),list,'hidden duplicate evidence does not change the native panel identity');
});
