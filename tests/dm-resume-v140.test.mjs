import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/note-insight-dm-reader-v1.js','utf8');
function harness(){
 const gm=new Map(),local=new Map(),events=new EventTarget(),doc=new EventTarget(),visited=[];let fail='r3';
 doc.documentElement={};
 doc.querySelectorAll=()=>[];
 const start=source.indexOf('function syncFrame('),end=source.indexOf('async function syncRoomsInBackground',start);
 const injectable=source.slice(0,start)+'function syncFrame(a,url,key){return fixtureFrame(key)}\n'+source.slice(end);
 const context={URL,Event,Map,Set,Date,Math,String,Number,Boolean,JSON,Promise,location:{hostname:'note.com',pathname:'/messages/rooms',href:'https://note.com/messages/rooms',search:''},document:doc,GM:{getValue:async(k,d)=>gm.get(k)??d,setValue:async(k,v)=>gm.set(k,structuredClone(v))},localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},sessionStorage:{removeItem(){}},MutationObserver:class{observe(){}},setTimeout:()=>1,clearTimeout(){},addEventListener:events.addEventListener.bind(events),fixtureFrame:async key=>{visited.push(key);return key===fail?{read:0,saved:0,error:'fixture-failure'}:{read:2,saved:2,complete:true}}};context.window=context;vm.createContext(context);vm.runInContext(injectable,context);
 return{api:context.__mumeiInsightDmReaderV1Api,gm,visited,recover(){fail=''},status(){return gm.get('mumei_insight_dm_checkpoint_v1:tester')}};
}
test('DM全5人を飛ばさず処理し、失敗1人は完了扱いせず次回に再開',async()=>{const h=harness(),rooms=Array.from({length:5},(_,i)=>({key:'r'+(i+1),url:'https://note.com/messages/rooms/r'+(i+1)}));await h.api.syncRoomsInBackground({id:'tester'},rooms);assert.deepEqual(h.visited,['r1','r2','r3','r4','r5']);assert.equal(h.status().lastRunComplete,false);assert.equal(h.status().currentThread,4);h.recover();await h.api.syncRoomsInBackground({id:'tester'},rooms);assert.deepEqual(h.visited,['r1','r2','r3','r4','r5','r3']);assert.equal(h.status().lastRunComplete,true);assert.equal(h.status().currentThread,5);});
test('DM画面にSPA遷移しても専用Readerを起動できるマッチ範囲',()=>{const wrapper=readFileSync('public/note-insight-dm.user.js','utf8');assert.match(wrapper,/@match\s+https:\/\/note\.com\/\*/);assert.doesNotMatch(source,/if\(dmRoute\(\)\)\{let timer/);assert.match(source,/confirmedMessageKeys/);assert.match(source,/DM_MESSAGE_BODY_NOT_FOUND/);});

test('DM本文のdivを取得・保存し、相対時刻が変わっても同じ本文を重複保存しない',async()=>{
 const {JSDOM}=await import('jsdom');
 const dom=new JSDOM('<main><section class="conversation"><div class="messageText">こんにちは 1分前</div><form><textarea></textarea></form></section></main>',{url:'https://note.com/messages/rooms/11111111-1111-1111-1111-111111111111',runScripts:'outside-only'}),w=dom.window,gm=new Map(),saved=[];
 w.HTMLElement.prototype.getBoundingClientRect=function(){return{width:360,height:60,left:0,top:0,right:360,bottom:60}};
 w.fetch=async()=>({ok:true,json:async()=>({data:{urlname:'tester'}})});
 gm.set('mumei_insight_dm_sync_token_v1:tester','fixture-token');
 w.GM={getValue:async(k,d)=>gm.get(k)??d,setValue:async(k,v)=>gm.set(k,v),xmlHttpRequest:opts=>{const rows=JSON.parse(opts.data).messages||[];saved.push(...rows);opts.onload({status:200,responseText:JSON.stringify({ok:true,confirmedMessageKeys:rows.map(x=>x.message_key)})})}};
 const bootstrap=source.lastIndexOf('{let timer=0,running=false;');
 w.eval((source.slice(0,bootstrap)+'window.__dmTest={candidateNodes,messageData,scanRoom};})();').replace('sleep=ms=>new Promise(r=>setTimeout(r,ms))','sleep=async()=>{}'));
 const root=w.document.querySelector('section'),bubble=w.document.querySelector('.messageText');
 const first=w.__dmTest.messageData(bubble,'room',root,'tester');w.Date.now=()=>Date.now()+120000;const later=w.__dmTest.messageData(bubble,'room',root,'tester');assert.equal(first.message_key,later.message_key);
 const result=await w.__dmTest.scanRoom({id:'tester'},'room');assert.equal(result.complete,true);assert.equal(result.read,1);assert.equal(result.saved,1);assert.equal(saved[0].body,'こんにちは');
 const again=await w.__dmTest.scanRoom({id:'tester'},'room');assert.equal(again.saved,0);assert.equal(saved.length,1);dom.window.close();
});
