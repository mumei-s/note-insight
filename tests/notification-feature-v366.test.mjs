import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
const KEY='mumei_insight_notification_feature_enabled_v1';
const read=name=>readFileSync('public/note-insight-notification-'+name,'utf8');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100&&!fn();i++)await pause(20);assert.ok(fn());}
for(const mode of ['modern','legacy','focus'])test(`別タブでOFFにするとパネル・読取・フィルターを止め、ONと再訪も反映する (${mode})`,async t=>{
 const values=new Map([[KEY,true],['mumei_insight_magazine_filter_enabled_v3:tester',true],['mumei_insight_notification_groups_v1:tester',[{name:'G',enabled:true,ids:['actor']}]],['mumei_insight_magazine_mute_profiles_v5:tester',[{id:'actor',name:'人物'}]]]),listeners=[];
 const create=(url,html)=>{const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,top:0,left:0,right:360,bottom:100});
  const get=(k,d)=>values.has(k)?values.get(k):d,set=(k,v)=>{const old=values.get(k);values.set(k,v);for(const l of listeners)if(l.key===k)l.fn(k,old,v,l.w!==w)},listen=(key,fn)=>listeners.push({w,key,fn});
  if(mode==='legacy'){w.GM_getValue=get;w.GM_setValue=set;w.GM_addValueChangeListener=listen}else w.GM={getValue:async(...args)=>get(...args),setValue:async(...args)=>set(...args),...(mode==='modern'?{addValueChangeListener:listen}:{})};
  w.fetch=async()=>Response.json({data:{urlname:'tester'}});w.matchMedia=()=>({matches:true});
  w.postMessage=data=>w.setTimeout(()=>w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,data})),0);
  w.eval(read('feature-bridge-v1.js'));return w;
 };
 const app=create('https://mumei-s.github.io/note-insight/','<div class="miv5-update"><div class="miv5-source-grid"><div class="miv5-source-card notice"><button class="miv5-source-main">本人通知</button></div></div></div>');
 app.eval('(()=>{'+ts.transpileModule(readFileSync('src/insight-top-install-v16.ts','utf8').replace('export {};',''),{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText+'})()');
 const markup='<button aria-label="通知" id="bell">🔔</button><main id="native"><button>通知</button><button>お知らせ</button><div class="m-navbarNoticeItem"><a href="/actor">人物</a>さんがマガジンに新しい記事を1本追加しました 1分前</div><div class="m-navbarNoticeItem">別の人物さんがスキしました 2分前</div></main>';
 const note=create('https://note.com/',markup);let starts=0,stops=0,finish;
 note.__mumeiNotificationNetwork3300={syncCurrent:()=>{starts++;return new Promise(r=>finish=r)},stop:()=>{stops++;finish?.({saved:0});finish=null}};
 for(const name of ['reader-v4.js','controls-v1.js','filter-v4.js'])note.eval(read(name));
 const bar=()=>note.document.getElementById('mumei-inline-notification-controls-v1'),toggle=()=>app.document.querySelector('.mumei-notice-feature-toggle');
 await until(()=>bar()&&starts>0&&toggle()?.textContent==='note公式🔔パネル ON');
 note.document.querySelectorAll('.m-navbarNoticeItem')[1].remove();
 await note.__mumeiNotificationFilterV4.refresh(true);await pause(250);
 assert.ok(bar(),'全件がフィルター対象でも解除用パネルを残す');
 const stoppedBefore=stops;toggle().click();await until(()=>toggle().textContent==='note公式🔔パネル OFF');
 if(mode==='focus')note.dispatchEvent(new note.Event('focus'));
 await until(()=>!bar()&&stops>stoppedBefore);
 assert.equal(note.document.querySelector('.mumei-muted-v2939'),null);assert.ok(note.document.querySelector('#native'));assert.ok(note.document.querySelector('#bell'));
 const before=starts;
 for(let i=0;i<3;i++){note.__mumeiNotificationControlsV1.mount();await note.__mumeiNotificationReaderV4.scan();note.document.querySelector('#native').append(note.document.createElement('span'))}
 await pause(250);assert.equal(bar(),null);assert.equal(starts,before,'OFF後に自動読取が再開しない');
 const revisited=create('https://note.com/',markup);revisited.__mumeiNotificationReaderV4={findPanel:()=>revisited.document.querySelector('#native')};revisited.eval(read('controls-v1.js'));await revisited.__mumeiNotificationFeatureV1.ready;revisited.__mumeiNotificationControlsV1.mount();assert.equal(revisited.document.getElementById('mumei-inline-notification-controls-v1'),null);
 toggle().click();await until(()=>toggle().textContent==='note公式🔔パネル ON');if(mode==='focus')note.dispatchEvent(new note.Event('focus'));await until(()=>bar()&&starts>before);
});
