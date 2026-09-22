import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync('public/note-insight-notification-controls-v1.js','utf8');
const wait=()=>new Promise(r=>setTimeout(r,30));
for(const legacy of [false,true])test(`スマホタップ・キーボードclick・フィルターが機能し、自己再描画で通信しない（${legacy?'legacy GM':'modern GM'}）`,async()=>{
 const dom=new JSDOM('<main id="panel">通知</main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,gm=new Map();let scans=0,requests=0,leaks=0;
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:390,height:120,left:0,top:0});
 w.fetch=async()=>{requests++;return{ok:true,json:async()=>({data:{urlname:'tester'}})}};
 const get=(k,d)=>gm.get(k)??d,set=(k,v)=>gm.set(k,v);
 if(legacy){w.GM_getValue=get;w.GM_setValue=set}else w.GM={getValue:async(...a)=>get(...a),setValue:async(...a)=>set(...a)};
 w.__mumeiNotificationReaderV4={findPanel:()=>w.document.getElementById('panel'),scan:async()=>{scans++}};
 w.eval(source);w.__mumeiNotificationControlsV1.mount();await wait();
 w.document.addEventListener('click',()=>leaks++);
 const bar=w.document.getElementById('mumei-inline-notification-controls-v1'),read=bar.querySelector('[data-action=read]');
 for(const type of ['touchstart','touchend']){const e=new w.Event(type,{bubbles:true,cancelable:true});read.dispatchEvent(e);assert.equal(e.defaultPrevented,false,'touch cancellation would suppress click')}
 read.click();await wait();assert.equal(scans,1);assert.equal(leaks,0);
 bar.querySelector('[data-action=filter]').click();await wait();assert.equal(gm.get('mumei_insight_magazine_filter_enabled_v3:tester'),true);
 const before=requests;for(let i=0;i<5;i++)w.__mumeiNotificationControlsV1.mount();await wait();assert.equal(requests,before);
 const emit=detail=>w.dispatchEvent(new w.CustomEvent('mumei-notification-reader-status',{detail}));
 emit({state:'done',readCount:0,savedCount:0});assert.equal(read.textContent,'再確認');assert.match(bar.textContent,/未確認/);emit({state:'done',readCount:0,savedCount:0,historyComplete:true,checkedCount:12});assert.equal(read.textContent,'確認済み');assert.match(bar.textContent,/確認 12件・追加0件/);assert.doesNotMatch(read.textContent,/保存/);
 emit({state:'done',readCount:300,savedCount:20,partial:true,stopping:true});assert.equal(read.textContent,'続き読込');
 emit({state:'done',readCount:5,savedCount:5,historyComplete:true});assert.equal(read.textContent,'✓保存 5');
 w.fetch=()=>new Promise(()=>{});bar.querySelector('[data-action=settings]').click();assert.match(w.document.querySelector('#mumei-route-veil-v130').textContent,/設定/);
 dom.window.close();
});
test('DM JSONのroom.idを子メッセージへ引き継ぎ、一覧プレビューを本文へ混ぜない',()=>{
 const dom=new JSDOM('<main></main>',{url:'https://note.com/messages/rooms',runScripts:'outside-only'}),w=dom.window;
 w.setTimeout=()=>0;w.fetch=async()=>({ok:true,json:async()=>({data:{urlname:'tester'}})});
 w.eval(readFileSync('public/note-insight-dm-network-v2.js','utf8'));
 const id='11111111-1111-1111-1111-111111111111',json={data:{room:{id,messages:[{id:'m1',body:'会話の本文',created_at:'2026-09-22T00:00:00Z'}],last_message:{id:'preview',body:'一覧用要約',created_at:'2026-09-22T00:00:00Z'}}}};
 const script=w.document.createElement('script');script.type='application/json';script.textContent=JSON.stringify(json);w.document.body.append(script);
 const rows=w.__mumeiDmNetworkV2.fromDocument(w.document,'https://note.com/messages/rooms/'+id,'tester');assert.equal(rows.length,1);assert.equal(rows[0].body,'会話の本文');assert.equal(rows[0].thread_key,id);dom.window.close();
});
test('DM画面内に配置した不可視フレームと停止による破棄を実行する',async()=>{
 const dom=new JSDOM('<main></main>',{url:'https://note.com/messages/rooms',runScripts:'outside-only'}),w=dom.window;
 w.fetch=async()=>({ok:true,json:async()=>({data:{urlname:'tester'}})});
 const src=readFileSync('public/note-insight-dm-reader-v1.js','utf8'),end=src.lastIndexOf('{let timer=0,running=false;');
 w.eval(src.slice(0,end)+'window.__test={syncFrame,stop};})();');
 const pending=w.__test.syncFrame({id:'tester'},'https://note.com/messages/rooms/11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111');
 const frame=w.document.querySelector('iframe');assert.equal(frame.style.left,'0px');assert.equal(frame.style.opacity,'0');assert.equal(frame.style.pointerEvents,'none');w.__test.stop();const r=await pending;assert.equal(r.error,'途中保存');assert.equal(w.document.querySelector('iframe'),null);dom.window.close();
});
