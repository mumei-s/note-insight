import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

const source=readFileSync('src/insight-notification-enhancements-v17.ts','utf8');
const TOKEN='mumei-insight-access-token';
const FEED='https://fixture.invalid/functions/v1/insight-notification-feed-final';
const summary='返信者さんがあなたのコメントに返信しました';
const publicUrl='https://note.com/author/n/narticle?scrollpos=comment&c=nc222';
const boardUrl='https://note.com/author/membership/boards/board1/posts/post2';
const pause=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};

function fixture(t,{url=boardUrl,fetch=async()=>Response.json({ok:true,rows:[]}),native=false}={}){
  const dom=new JSDOM(`<section id="minf-notifications"><button class="mumei-category-toggle">分類</button><div class="minf-tabs"><button>返信2</button><button>チップ1</button></div><div class="minf-list"><article class="mumei-comment-open"${native?' data-comment-context-native="true"':''}><time>2026/10/14 09:00</time><div class="minf-who"><a href="https://note.com/replier">返信者</a></div><a class="minf-main" href="${url}"><strong>掲示板返信</strong><small>${summary}</small></a><button class="mumei-comment-toggle">返信を見る</button><details class="minf-comment-context"><summary>対象本文</summary><p>native本文</p></details></article></div></section>`,{url:'https://mumei-s.github.io/note-insight/',runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());const w=dom.window,calls=[],timers=new Map();let nextTimer=0;
  w.Headers=Headers;w.Request=Request;w.Response=Response;
  w.localStorage.setItem(TOKEN,'owner-a');
  w.fetch=async(input,init)=>{calls.push({input,init});return fetch(input,init)};
  w.setTimeout=(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id};w.clearTimeout=id=>timers.delete(id);
  w.exports={};vm.runInContext(ts.transpileModule(source+'\nthis.testAPI={run,ensureCommentBody};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,dom.getInternalVMContext());
  const article=w.document.querySelector('article'),api=w.testAPI;api.run();
  return{w,article,api,calls,body:()=>article.querySelector('.mumei-comment-body'),runTimers(ms){for(const[id,timer]of [...timers])if(timer.ms===ms){timers.delete(id);timer.fn()}},async feed(headers={'X-Insight-Token':w.localStorage.getItem(TOKEN)}){await w.fetch(FEED,{method:'POST',headers});await pause();await pause()},open(){article.querySelector('.mumei-comment-toggle').click();for(const[id,timer]of [...timers])if(timer.ms===60){timers.delete(id);timer.fn()}}};
}
function exact(body='実際の返信\n二行目です',key='nc222'){
  return{notification_type:'reply',actor_url:'https://note.com/replier',occurred_at:'2026-10-14T00:00:00Z',target_url:publicUrl.replace('nc222',key),raw_text:summary,meta:{body:summary,comment_body:body,comment_key:key,comment_body_source:'exact-comment-id'}};
}

test('掲示板の通知body/raw_text/カード説明は返信本文にせず、日付検索も送信しない',async t=>{
  const row={notification_type:'membership_board_reply',actor_url:'https://note.com/replier',occurred_at:'2026-10-14T00:00:00Z',target_url:boardUrl,raw_text:summary,meta:{kind:'board_reply_comment',body:summary,body_ast:{text:summary}}};
  const h=fixture(t,{fetch:async()=>Response.json({ok:true,rows:[row]})});await h.feed();h.open();
  assert.equal(h.body().querySelector('b').textContent,'本文未取得');assert.doesNotMatch(h.body().textContent,/返信者さん|あなたのコメントに返信しました/);
  assert.equal(h.article.querySelector('.minf-main small').textContent,summary);assert.equal(h.calls.length,1);assert.equal(h.calls[0].input,FEED);
});

test('同じ相手・同時刻でも別コメントIDの本文を代用しない',async t=>{
  const h=fixture(t,{url:publicUrl,fetch:async()=>Response.json({ok:true,rows:[exact('別コメントの本文','nc333')]})});await h.feed();h.open();
  assert.equal(h.body().querySelector('b').textContent,'本文未取得');assert.doesNotMatch(h.body().textContent,/別コメントの本文/);assert.equal(h.calls.length,1);
});

test('取得sourceと正確なコメントIDの一致した専用本文だけを改行込みで表示する',async t=>{
  const h=fixture(t,{url:publicUrl,fetch:async()=>Response.json({ok:true,rows:[exact()]})});await h.feed();h.open();
  assert.equal(h.body().querySelector('b').textContent,'返信本文');assert.equal(h.body().querySelector('p').textContent,'実際の返信\n二行目です');
  assert.equal(h.article.querySelector('.minf-main small').textContent,summary);assert.equal(h.calls.length,1);
});

test('本文だけ・未確認source・URLと異なる保存キーは採用しない',async t=>{
  const valid=exact(),rows=[{...valid,meta:{body:summary,comment_body:'source未確認',comment_key:'nc222'}},{...valid,meta:{...valid.meta,comment_body:'キー不一致',comment_key:'nc444'}},{...valid,meta:{body:summary},body:'generic本文',message:'message本文',detail:'detail本文'}];
  const h=fixture(t,{url:publicUrl,fetch:async()=>Response.json({ok:true,rows})});await h.feed();h.open();assert.equal(h.body().querySelector('b').textContent,'本文未取得');
});

test('native本文のカードでは旧本文を除去し、遅延クリックも注入しない',t=>{
  const h=fixture(t,{native:true});h.article.insertAdjacentHTML('beforeend','<div class="mumei-comment-body">旧通知文</div>');h.api.run();h.open();
  assert.equal(h.body(),null);assert.equal(h.article.querySelector('.minf-comment-context p').textContent,'native本文');
  delete h.article.dataset.commentContextNative;h.article.querySelector('.mumei-comment-toggle').click();h.article.dataset.commentContextNative='true';h.runTimers(60);assert.equal(h.body(),null);
});

test('アカウント切替後は保存済み本文と遅れて届いた旧アカウントのfeedを利用しない',async t=>{
  const delayed=deferred();let request=0;const h=fixture(t,{url:publicUrl,fetch:async()=>++request===1?Response.json({ok:true,rows:[exact('owner-a本文')]}):delayed.promise});
  await h.feed();h.open();assert.equal(h.body().querySelector('p').textContent,'owner-a本文');
  const pending=h.w.fetch(FEED,{headers:{'X-Insight-Token':'owner-a'}});h.w.localStorage.setItem(TOKEN,'owner-b');delayed.resolve(Response.json({ok:true,rows:[exact('遅延owner-a本文')]}));await pending;await pause();await pause();h.open();
  assert.equal(h.body().querySelector('b').textContent,'本文未取得');assert.doesNotMatch(h.body().textContent,/owner-a本文/);
});

test('JSON待機中のアカウント切替と別token付き要求を本文cacheへ入れない',async t=>{
  const json=deferred();let request=0;const h=fixture(t,{url:publicUrl,fetch:async()=>++request===1?{ok:true,clone:()=>({json:()=>json.promise})}:Response.json({ok:true,rows:[exact('別token本文')]})});
  await h.w.fetch(FEED,{headers:{'X-Insight-Token':'owner-a'}});h.w.localStorage.setItem(TOKEN,'owner-b');json.resolve({ok:true,rows:[exact('旧JSON本文')]});await pause();await h.w.fetch(FEED,{headers:{'X-Insight-Token':'owner-a'}});await pause();await pause();h.open();
  assert.equal(h.body().querySelector('b').textContent,'本文未取得');assert.doesNotMatch(h.body().textContent,/旧JSON本文|別token本文/);
});

test('分類順序と通常fetchの応答・引数はそのまま保つ',async t=>{
  const response=Response.json({ok:true}),h=fixture(t,{fetch:async()=>response});h.w.localStorage.setItem('mumei-notification-category-order-v17',JSON.stringify(['チップ','返信']));h.api.run();
  const buttons=[...h.w.document.querySelectorAll('.minf-tabs button')];assert.deepEqual(buttons.map(b=>b.style.order),['1','0']);assert.equal(h.w.document.querySelector('.minf-tabs').dataset.mumeiReorderBoundV17,'1');
  const init={method:'POST',headers:{'Content-Type':'application/json'},body:'{"ordinary":true}'};assert.equal(await h.w.fetch('https://fixture.invalid/ordinary',init),response);assert.equal(h.calls[0].init,init);assert.equal(h.calls[0].input,'https://fixture.invalid/ordinary');
});
