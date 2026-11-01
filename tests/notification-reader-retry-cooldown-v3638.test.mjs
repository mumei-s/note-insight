import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(process.env.NOTIFICATION_RETRY_SOURCE||'public/note-insight-notification-reader-v4.js','utf8');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){for(let i=0;i<100&&!check();i++)await sleep(10);assert.ok(check(),label)}
const failure=(code='NOTE_HTTP_ERROR',retryable=true)=>Object.assign(new Error(code==='SAVE_HTTP_ERROR'?'通知を保存できませんでした（HTTP 503）':'noteの通信に失敗しました（HTTP 429）'),{code,retryable});

function fixture(t,{run=()=>{throw failure()}}={}){
 const dom=new JSDOM('<body><main id="app"></main></body>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,top:0,bottom:100,left:0,right:360});
 let now=1700000000000,account='account_a';w.Date.now=()=>now;
 const counts={runs:0,fetches:0},events=[];
 w.fetch=async()=>{counts.fetches++;throw new Error('The Reader must not add an account probe during cooldown')};
 w.GM={getValue:async(k,d)=>d};
 w.__mumeiNotificationNetwork3300={syncCurrent:async opts=>{counts.runs++;return run({account,opts,count:counts.runs})},stop(){}};
 w.addEventListener('mumei-notification-reader-status',event=>events.push(event.detail));
 let panel;
 function mount(){panel=w.document.createElement('section');panel.dataset.mumeiNoticeShellV2958='1';panel.innerHTML='<div class="m-navbarNoticeItem" data-notice-id="1">人物さんがあなたの記事にスキしました<time datetime="2026-11-01T10:00:00Z">1分前</time></div>';w.document.getElementById('app').append(panel);return panel}
 mount();w.eval(source);
 const settle=async()=>{w.__mumeiNotificationReaderV4.scheduleAuto(0);await sleep(90)};
 // An explicit click after the panel has left is a real bell reopen. This
 // exercises the same opening branch without waiting for the 500ms DOM grace.
 async function reopen(){panel.remove();w.document.dispatchEvent(new w.Event('pointerdown',{bubbles:true}));mount();await settle()}
 return{w,counts,events,settle,reopen,advance:ms=>{now+=ms},now:()=>now,switchAccount:id=>{account=id},panel:()=>panel,last:()=>events.at(-1),ready:()=>until(()=>events.some(e=>e.state==='error'),'initial retryable transport failure is reported')};
}

for(const code of ['NOTE_HTTP_ERROR','SAVE_HTTP_ERROR'])test(`HTTP failure cooldown survives article/bell reopen and repeated native captures (${code})`,async t=>{
 const f=fixture(t,{run:()=>{throw failure(code)}});await f.ready();assert.equal(f.counts.runs,1);const deadline=f.last().retryAt;assert.equal(deadline-f.now(),30000);
 for(let i=0;i<3;i++){await f.reopen();f.w.document.dispatchEvent(new f.w.CustomEvent('mumei-notification-captured',{detail:{signature:'head-'+i,page:1}}));await f.settle()}
 assert.equal(f.counts.runs,1,'automatic reopen and native changes cannot bypass the promised cooldown');assert.equal(f.last().retryAt,deadline);assert.equal(f.counts.fetches,0);
 f.advance(29999);await f.settle();assert.equal(f.counts.runs,1);
 f.advance(1);await f.settle();assert.equal(f.counts.runs,2,'the existing scheduler can retry once the deadline passes');assert.equal(f.last().retryAt-f.now(),60000,'reopening does not reset the exponential failure streak');
});

test('the real absent-panel grace interval also preserves a pending finite retry deadline',async t=>{
 const f=fixture(t);await f.ready();const deadline=f.last().retryAt;
 const old=f.panel();old.remove();f.w.__mumeiNotificationReaderV4.scheduleAuto(0);await sleep(570);f.advance(570);
 f.w.document.getElementById('app').append(old);await f.settle();assert.equal(f.counts.runs,1);assert.equal(f.last().retryAt,deadline);assert.equal(f.counts.fetches,0);
});

test('explicit resume may retry immediately and a successful save clears the old failure streak',async t=>{
 const f=fixture(t,{run:({count})=>{if(count===1||count===3)throw failure();return{historyComplete:true}}});await f.ready();
 await f.w.__mumeiNotificationReaderV4.resume();await f.settle();assert.equal(f.counts.runs,2,'the user-requested retry bypasses a finite cooldown');
 f.w.document.dispatchEvent(new f.w.CustomEvent('mumei-notification-captured',{detail:{signature:'new-head',page:1}}));await until(()=>f.counts.runs===3,'genuine new head starts a delta after success');await until(()=>f.last().state==='error','new failure has a retry status');assert.equal(f.last().retryAt-f.now(),30000,'a successful sync resets exponential backoff');assert.equal(f.counts.fetches,0);
});

test('a switched note account is not trapped by the previous account terminal error',async t=>{
 const owners=[];const f=fixture(t,{run:({account})=>{owners.push(account);if(account==='account_a')throw failure('PAIR_REQUIRED',false);return{historyComplete:true}}});await f.ready();assert.equal(f.last().retryAt,Infinity);
 await f.settle();assert.equal(f.counts.runs,1,'terminal error does not loop on the same open panel');
 f.switchAccount('account_b');await f.reopen();assert.equal(f.counts.runs,2,'reopening lets the existing network layer verify the new owner');assert.deepEqual(owners,['account_a','account_b']);assert.equal(f.counts.fetches,0,'Reader adds no owner lookup or account storage');
});

test('explicit pause still blocks automatic reopening and retry expiry until resume',async t=>{
 const f=fixture(t);await f.ready();await f.w.__mumeiNotificationReaderV4.pause();f.advance(60000);await f.reopen();assert.equal(f.counts.runs,1);assert.equal(f.w.__mumeiNotificationReaderV4.isPaused(),true);
 await f.w.__mumeiNotificationReaderV4.resume();assert.equal(f.counts.runs,2);assert.equal(f.w.__mumeiNotificationReaderV4.isPaused(),false);assert.equal(f.counts.fetches,0);
});
