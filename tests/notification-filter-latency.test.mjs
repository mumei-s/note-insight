import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(process.env.FILTER_LATENCY_SOURCE||'public/note-insight-notification-filter-v4.js','utf8');
const FILTER='mumei_insight_magazine_filter_enabled_v3:tester',GROUPS='mumei_insight_notification_groups_v1:tester',PROFILES='mumei_insight_magazine_mute_profiles_v5:tester';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,message){for(let i=0;i<100;i++){if(check())return;await pause(10)}assert.ok(check(),message)}
const row=(id,text)=>`<li class="m-navbarNoticeItem" id="${id}">${text}<time>1分前</time></li>`;
const added='さん他36名が共同マガジンに新しい記事を40本追加しました';

function fixture(t,{body,ids=['slow','fast'],profiles=[],mode='modern',readGate}={}){
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="panel" class="notificationList" style="height:420px;overflow:auto">'+body+'</div></body></html>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>w.close());const panel=w.document.getElementById('panel'),values=new Map([[FILTER,true],[GROUPS,[{enabled:true,ids}]],[PROFILES,profiles]]),calls=[],pending=new Map(),deadlines=[];
 const nativeTimeout=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>{if(ms===20000)deadlines.push(fn);return nativeTimeout(fn,ms,...args)};
 if(mode==='modern')w.GM={getValue:async(k,d)=>{await readGate?.(k);return values.get(k)??d},setValue:async(k,v)=>values.set(k,v)};
 else{w.GM_getValue=(k,d)=>values.get(k)??d;w.GM_setValue=(k,v)=>values.set(k,v)}
 w.fetch=async url=>{calls.push(String(url));if(url==='/api/v2/current_user')return Response.json({data:{urlname:'tester'}});return new Promise(resolve=>pending.set(String(url).split('/').at(-1),resolve))};
 w.HTMLElement.prototype.getBoundingClientRect=function(){return{top:80,bottom:140,left:0,right:360,width:360,height:60}};
 w.__mumeiNotificationReaderV4={findPanel:()=>panel};w.eval(source);
 const refresh=()=>w.__mumeiNotificationFilterV4.refresh(true),hidden=id=>w.document.getElementById(id).classList.contains('mumei-muted-v2939');
 return{w,panel,values,calls,pending,deadlines,refresh,hidden,profiles:()=>calls.filter(x=>x.startsWith('/api/v2/creators/')),resolve:(id,name)=>pending.get(id)(Response.json({data:{nickname:name,urlname:id}}))};
}

for(const mode of ['modern','legacy'])test(`確定した先頭IDには人物全員の名前取得を待たず、無関係な100人を読み込まない (${mode})`,async t=>{
 const ids=['actor',...Array.from({length:100},(_,i)=>'unrelated_'+i)],f=fixture(t,{mode,ids,body:row('target','<a href="/actor">架空の先頭人物…</a>'+added)+row('keep','<a href="/actor">架空の先頭人物…</a>さんがあなたの記事にスキしました')});
 await f.refresh();assert.equal(f.hidden('target'),true,'本人確認済みの初回判定で隠す');assert.equal(f.hidden('keep'),false);
 await pause(160);assert.equal(f.profiles().length,0,'先頭IDで判定済みならプロフィールAPIは不要');
 for(let i=0;i<5;i++)await f.refresh();assert.equal(f.calls.length,1,'再判定で本人・通知一覧・保存先を読み直さない');
});

test('保持する通知だけなら未解決の登録名を読み込まない',async t=>{
 const f=fixture(t,{body:row('keep','架空の人物さんがあなたの記事を購入しました')});await f.refresh();await pause(160);assert.equal(f.profiles().length,0);assert.equal(f.hidden('keep'),false);
});

for(const mode of ['modern','legacy'])test(`速い人物応答を同じバッチの遅い人物待ちにせず、通知を直ちに再判定する (${mode})`,async t=>{
 const f=fixture(t,{mode,body:row('slow-row','架空の遅い人物…'+added)+row('fast-row','架空の速い人物…'+added)});
 await f.refresh();await until(()=>f.pending.has('slow')&&f.pending.has('fast'),'two needed lookups start');
 f.resolve('fast','架空の速い人物の正式名');
 await until(()=>f.hidden('fast-row'),'fast result must apply while slow response remains unresolved');
 assert.equal(f.hidden('slow-row'),false,'未知の人物を待ち時間隠しでごまかさない');assert.equal(f.values.get(PROFILES).find(p=>p.id==='fast').name,'架空の速い人物の正式名');
 f.resolve('slow','架空の遅い人物の正式名');await until(()=>f.hidden('slow-row'),'slow result applies when ready');
 assert.deepEqual([...f.values.get(PROFILES)].map(p=>p.id).sort(),['fast','slow']);assert.equal(f.profiles().length,2);
 assert.equal(f.calls.filter(x=>x==='/api/v2/current_user').length,1);
});

test('集合avatarは照合の優先候補だけに使い、名前判明後は無関係な残り100人を読まない',async t=>{
 const ids=[...Array.from({length:100},(_,i)=>'unrelated_'+i),'actor'];
 const avatars='<a href="/actor"><img alt=""></a><a href="/unlisted"><img alt=""></a>';
 const f=fixture(t,{ids,body:row('target',avatars+'架空の対象人物…'+added)});await f.refresh();
 await until(()=>f.pending.size===4,'bounded first batch');assert.equal(f.profiles()[0],'/api/v2/creators/actor','visible candidate does not wait behind 100 stored IDs');assert.equal(f.hidden('target'),false,'an avatar by itself is not leading-actor proof');
 f.values.set(PROFILES,[{id:'settings_saved',name:'設定画面で並行保存した別名'}]);
 f.resolve('actor','架空の対象人物の正式名');await until(()=>f.hidden('target'),'matching name applies before other requests');
 for(const id of [...f.pending.keys()].filter(id=>id!=='actor'))f.resolve(id,'無関係な名前'+id);
 await pause(160);assert.equal(f.profiles().length,4,'remaining queued registrations are cancelled after identification');assert.equal(f.values.get(PROFILES).some(p=>p.id==='settings_saved'),true,'concurrent settings data is preserved');
});

for(const action of ['off','feature-off','close','hidden'])test(`人物名の取得中に${action}にしたら、残りの登録者を読み続けない`,async t=>{
 const ids=Array.from({length:12},(_,i)=>'actor_'+i),f=fixture(t,{ids,body:row('target','架空の対象人物…'+added)});await f.refresh();await until(()=>f.pending.size===4,'first batch');
 if(action==='off')f.values.set(FILTER,false);
 else if(action==='feature-off')f.w.__mumeiNotificationFeatureV1={isEnabled:()=>false};
 else if(action==='hidden')Object.defineProperty(f.w.document,'visibilityState',{value:'hidden',configurable:true});
 else f.panel.remove();await f.refresh();
 for(const id of [...f.pending.keys()])f.resolve(id,id==='actor_0'?'架空の対象人物の正式名':'無関係な名前'+id);
 await pause(160);assert.equal(f.profiles().length,4);if(action!=='hidden')assert.equal(f.panel.querySelector('#target').classList.contains('mumei-muted-v2939'),false);assert.equal(f.panel.isConnected,action!=='close');
});

test('無応答プロフィールは期限で次の必要な候補へ進み、遅延応答を採用しない',async t=>{
 const ids=['blocked_0','blocked_1','blocked_2','blocked_3','actor'],f=fixture(t,{ids,body:row('target','架空の対象人物…'+added)});await f.refresh();await until(()=>f.deadlines.length===4,'four active deadlines');
 for(const deadline of f.deadlines.slice())deadline();await until(()=>f.pending.has('actor'),'unanswered batch must not block the queue forever');
 f.resolve('actor','架空の対象人物の正式名');await until(()=>f.hidden('target'),'later needed candidate applies');
 f.resolve('blocked_0','期限後の名前');await pause(100);assert.equal(f.values.get(PROFILES).some(p=>p.id==='blocked_0'),false);assert.equal(f.profiles().length,5,'timeouts do not automatically retry');
});

test('GMの設定読み込みが遅くても、再判定前に次の不要バッチを開始しない',async t=>{
 let hold=false,held=0,release;const barrier=new Promise(resolve=>{release=resolve});
 const ids=['actor','other_1','other_2','other_3','unneeded_after_resolve'],f=fixture(t,{ids,body:row('target','架空の対象人物…'+added),readGate:async key=>{if(hold&&key===FILTER){held++;await barrier}}});
 await f.refresh();await until(()=>f.pending.size===4,'first batch');hold=true;
 for(const id of [...f.pending.keys()])f.resolve(id,id==='actor'?'架空の対象人物の正式名':'その他の人物'+id);
 await until(()=>held>0,'slow storage read holds the classification pass');await pause(100);
 assert.equal(f.profiles().length,4,'no fifth lookup while current need is not yet verified');
 hold=false;release();await until(()=>f.hidden('target'),'apply after storage becomes ready');await pause(100);assert.equal(f.profiles().length,4);
});
