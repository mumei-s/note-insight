import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=name=>readFileSync(`public/note-insight-notification-${name}.js`,'utf8');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){for(let i=0;i<100&&!check();i++)await sleep(15);assert.ok(check(),label)}
const BAR='mumei-inline-notification-controls-v1';
function fixture(t){
 const dom=new JSDOM('<header><button aria-label="通知">🔔</button></header><main id="app"></main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:300,top:0,left:0,right:360,bottom:300});
 const values=new Map([
  ['mumei_insight_magazine_filter_enabled_v3:tester',true],
  ['mumei_insight_notification_groups_v1:tester',[{enabled:true,ids:['actor']}]],
  ['mumei_insight_magazine_mute_profiles_v5:tester',[{id:'actor',name:'登録人物'}]],
 ]),listeners=[];
 w.GM={getValue:async(k,d)=>values.has(k)?values.get(k):d,setValue:async(k,v)=>{const old=values.get(k);values.set(k,v);for(const x of listeners)if(x.k===k)x.fn(k,old,v,true)},addValueChangeListener:(k,fn)=>listeners.push({k,fn})};
 let requests=0;w.fetch=async input=>{requests++;assert.equal(new URL(input,w.location.href).pathname,'/api/v2/current_user');return Response.json({data:{urlname:'tester'}})};
 w.sessionStorage.setItem('mumei-notification-read-paused-v1','1');
 const panel=w.document.createElement('section');panel.className='m-navbarNotice';panel.id='panel';
 panel.innerHTML='<button>通知</button><button>お知らせ</button><div class="m-navbarNoticeItem" id="muted"><a href="/actor">登録人物</a>さんが共同マガジンに新しい記事を3本追加しました 1分前</div><div class="m-navbarNoticeItem" id="kept">登録人物さんがあなたの記事にスキしました 1分前</div>';
 w.document.getElementById('app').append(panel);
 return{w,values,panel,requests:()=>requests};
}

test('document-start before html exists still starts the saved filter and one toolbar after DOM is ready',async t=>{
 const f=fixture(t),root=f.w.document.documentElement;root.remove();
 const errors=[];f.w.addEventListener('error',event=>{errors.push(event.error);event.preventDefault()});
 for(const name of ['feature-bridge-v1','reader-v4','controls-v1','filter-v4'])assert.doesNotThrow(()=>f.w.eval(source(name)),`${name} must not abort later @require modules`);
 await sleep(90);assert.deepEqual(errors,[],'feature readiness before html must not crash scheduled work');
 f.w.document.append(root);f.w.document.dispatchEvent(new f.w.Event('DOMContentLoaded'));
 await until(()=>f.w.document.getElementById('muted').classList.contains('mumei-muted-v2939'),'saved ON filter runs without toggling settings');
 await until(()=>f.w.document.querySelectorAll('#'+BAR).length===1,'one toolbar mounts');
 assert.ok(!f.w.document.getElementById('kept').classList.contains('mumei-muted-v2939'),'likes stay visible');
 assert.equal(f.values.get('mumei_insight_magazine_filter_enabled_v3:tester'),true);
});

