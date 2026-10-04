import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(process.env.FILTER_PAGINATION_SOURCE||'public/note-insight-notification-filter-v4.js','utf8');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<80&&!fn();i++)await pause(15);assert.ok(fn());}
const row=(id,muted=true)=>`<div class="m-navbarNoticeItem" id="${id}"><a href="/${muted?'actor':'other'}">${muted?'登録人物':'別の人物'}</a>さんが${muted?'共同マガジンに新しい記事を1本追加しました':'あなたの記事にスキしました'} 1分前</div>`;

function fixture(t,mode,remaining=0){
 const dom=new JSDOM('<body style="overflow:hidden"><div id="native-scroll" style="height:400px;overflow-y:auto"><section id="panel"><header><button>通知</button><button>お知らせ</button></header><div id="list" class="notificationList" style="overflow-y:auto">'+Array.from({length:12},(_,i)=>row('muted-'+i)).join('')+Array.from({length:remaining},(_,i)=>row('visible-'+i,false)).join('')+'<div id="native-loader"></div></div></section></div></body>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>w.close());
 const values=new Map([['mumei_insight_magazine_filter_enabled_v3:tester',true],['mumei_insight_notification_groups_v1:tester',[{enabled:true,ids:['actor']}]],['mumei_insight_magazine_mute_profiles_v5:tester',[{id:'actor',name:'登録人物'}]]]);
 if(mode==='modern')w.GM={getValue:async(k,d)=>values.get(k)??d,setValue:async(k,v)=>values.set(k,v)};else{w.GM_getValue=(k,d)=>values.get(k)??d;w.GM_setValue=(k,v)=>values.set(k,v)}
 let requests=0;w.fetch=async()=>{requests++;return Response.json({data:{urlname:'tester'}})};
 const panel=w.document.getElementById('panel'),list=w.document.getElementById('list'),host=w.document.getElementById('native-scroll'),loader=w.document.getElementById('native-loader');
 function height(el){if(el.hidden||w.getComputedStyle(el).display==='none')return 0;if(el.hasAttribute('data-mumei-filter-page-edge'))return 1;if(el.id==='mumei-notification-filter-continuation-v4')return Number.parseFloat(el.style.minHeight)||0;if(el.classList.contains('m-navbarNoticeItem'))return 60;if(el===loader)return 16;return 40;}
 const content=()=>[...list.children].reduce((n,el)=>n+height(el),0);
 w.HTMLElement.prototype.getBoundingClientRect=function(){const h=this===host?400:this===list?content():height(this);return {width:360,height:h,top:100,left:0,right:360,bottom:100+h}};
 Object.defineProperties(list,{clientHeight:{get:content},scrollHeight:{get:content}});
 Object.defineProperties(host,{clientHeight:{get:()=>400},scrollHeight:{get:()=>Math.max(400,content()+40)}});
 w.__mumeiNotificationReaderV4={findPanel:()=>panel.hidden?null:list};
 w.eval(source);
 return {w,panel,list,host,loader,values,requests:()=>requests};
}

for(const mode of ['modern','legacy'])for(const remaining of [0,2])test(`全件非表示・2行の後も、伸びる内側リストではなく公式スクロール枠で次ページへ進む (${mode}, ${remaining}行)`,async t=>{
 const f=fixture(t,mode,remaining);await until(()=>f.panel.querySelectorAll('.mumei-muted-v2939').length===12);
 const bridge=f.panel.querySelector('#mumei-notification-filter-continuation-v4');assert.ok(bridge);assert.equal(bridge.nextElementSibling,f.loader);assert.ok(f.host.scrollHeight>f.host.clientHeight,'実際の公式枠にスクロール範囲が必要');assert.equal(f.list.style.maxHeight,'','内側に別のスクロール枠を作らない');assert.equal(f.list.style.overscrollBehaviorY,'auto','スクロール範囲がない内側の要素でスワイプを閉じ込めない');assert.equal(f.host.style.overscrollBehaviorY,'contain');
 let pages=0;f.host.addEventListener('scroll',()=>{if(pages||f.host.scrollTop+f.host.clientHeight<f.host.scrollHeight-1)return;pages++;f.loader.insertAdjacentHTML('beforebegin',row('next-page',false));});
 bridge.querySelector('button').click();await until(()=>f.panel.querySelector('#next-page'));assert.equal(pages,1);assert.equal(f.panel.querySelector('#next-page').classList.contains('mumei-muted-v2939'),false);assert.equal(f.values.get('mumei_insight_magazine_filter_enabled_v3:tester'),true);assert.equal(f.requests(),1,'ページ送りのために通知APIを再走査しない');assert.equal(f.w.document.body.style.overflow,'hidden');
});

for(const mode of ['modern','legacy'])test(`公式が最後の通知行を監視する場合も、非表示後に元の読み込み判定を維持する (${mode})`,async t=>{
 const f=fixture(t,mode);const watched=f.panel.querySelector('#muted-11');await until(()=>watched.classList.contains('mumei-muted-v2939'));await pause(20);
 assert.ok(watched.getBoundingClientRect().height>0,'display:noneだと公式IntersectionObserverの対象が消える');assert.equal(f.w.getComputedStyle(watched).opacity,'0');assert.equal(watched.getAttribute('aria-hidden'),'true');assert.equal(watched.hasAttribute('inert'),true);assert.equal(f.panel.querySelectorAll('[data-mumei-filter-page-edge]').length,1);
 // The native observer retains this node reference; userscript must not replace it.
 if(watched.getBoundingClientRect().height>0)f.loader.insertAdjacentHTML('beforebegin',row('native-observed-next',false));
 await f.w.__mumeiNotificationFilterV4.refresh();assert.ok(f.panel.querySelector('#native-observed-next'));assert.equal(watched.hasAttribute('data-mumei-filter-page-edge'),false);assert.equal(watched.hasAttribute('inert'),false);assert.equal(watched.hasAttribute('aria-hidden'),false);assert.equal(f.w.getComputedStyle(watched).display,'none');
 f.values.set('mumei_insight_magazine_filter_enabled_v3:tester',false);await f.w.__mumeiNotificationFilterV4.refresh(true);assert.equal(f.panel.querySelector('#mumei-notification-filter-continuation-v4'),null);assert.equal(f.panel.querySelector('.mumei-muted-v2939'),null);assert.equal(f.host.style.overflowY,'auto');assert.equal(f.host.style.overscrollBehaviorY,'');assert.equal(f.list.style.overscrollBehaviorY,'');
});
