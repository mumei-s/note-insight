import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const member={id:'member-a',noteId:'fixture_a',displayName:'本人A',status:'active',imageUrl:null};
const other={id:'member-b',noteId:'fixture_b',displayName:'本人B',status:'active',imageUrl:null};
const saved=(app,token)=>({...app,memberToken:token,updatedAt:1});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve}};
const settle=async()=>{for(let i=0;i<4;i++)await new Promise(done=>setImmediate(done))};
function storage(seed={}){const data=new Map(Object.entries(seed));return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)}}
function withoutImports(source){const file=ts.createSourceFile('fixture.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);for(const statement of [...file.statements].reverse())if(ts.isImportDeclaration(statement))source=source.slice(0,statement.getFullStart())+source.slice(statement.end);return source}
function compile(source,context){vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context)}

function fixture({hash='#dashboard',accounts=[saved(member,'token-a'),saved(other,'token-b')],respond=async()=>Response.json({ok:true,application:member})}={}){
  const localStorage=storage({'mumei-insight-access-token':'token-a','mumei-insight-active-account-v3':member.noteId,'mumei-insight-saved-accounts-v3':JSON.stringify(accounts)}),sessionStorage=storage();
  const timers=new Map(),calls=[],window=new EventTarget();let timer=0,reloads=0,clock=1000;
  const page=new URL('https://mumei-s.github.io/note-insight/'+hash),viewCache=new Map();
  const location={get href(){return page.href},get hash(){return page.hash},set hash(value){page.hash=value},reload(){reloads++;viewCache.clear();clock+=100;loadLifecycle()}};
  const document={visibilityState:'visible',getElementById:()=>null,createElement:()=>({style:{},remove(){}}),body:{appendChild(){}}};
  Object.assign(window,{location,history:{state:null,replaceState(_state,_title,url){page.href=new URL(url,page.href).href}},setTimeout(fn,ms){const id=++timer;timers.set(id,{fn,ms});return id},clearTimeout(id){timers.delete(id)},setInterval:()=>++timer});
  class Clock extends Date{static now(){return clock}}
  const context=vm.createContext({window,document,location,localStorage,sessionStorage,Event,URL,Response,AbortController,setTimeout,clearTimeout,console,Date:Clock,exports:{},installApiBridge(){},registerServiceWorker(){},fetch:async(url,init)=>{const body=JSON.parse(init.body||'{}');calls.push({url,action:body.action});return body.action==='touch'?Response.json({ok:true}):respond(url,init,body)}});
  compile(readFileSync('src/insight-account-store.ts','utf8'),context);
  const store=context.exports;Object.assign(context,store);
  let lifecycle;
  function loadLifecycle(){const target=vm.createContext({exports:{},Date:Clock,fetch:context.fetch,AbortController,setTimeout,clearTimeout,URL});compile(readFileSync('src/insight-view-lifecycle.ts','utf8'),target);lifecycle=target.exports}
  loadLifecycle();
  const sessionContext=vm.createContext({...context,exports:{},require:name=>name==='./insight-account-store'?store:lifecycle});
  compile(readFileSync('src/insight-session-request.ts','utf8'),sessionContext);Object.assign(context,sessionContext.exports);
  clock+=10;const verifiedAt=clock;viewCache.set('verified',{at:verifiedAt,rows:['saved-view']});
  const source=readFileSync('src/main.tsx','utf8'),startup=source.slice(0,source.indexOf('function startupFailureLabel('));
  compile(withoutImports(startup)+'\nthis.startup={validateCurrentMemberToken,tryReturningMemberResume};',context);
  const flush=()=>{for(let n=0;n<20;n++){const next=[...timers].find(([,entry])=>entry.ms<=30);if(!next)return;timers.delete(next[0]);next[1].fn()}throw new Error('Unexpected account event loop')};
  return{store,calls,window,localStorage,sessionStorage,viewCache,startup:context.startup,reloads:()=>reloads,advance:()=>clock+=10,retainsVerified:()=>lifecycle.isFreshInsightView(verifiedAt),navigate(hash){location.hash=hash;window.dispatchEvent(new Event('hashchange'))},flush};
}

test('実mainの起動・同一session確認・プロフィール更新はdocumentを再読込しない',async()=>{
  const h=fixture();await settle();h.flush();
  assert.equal(h.calls.filter(x=>x.action==='session').length,1,'起動時の実セッション確認を維持');
  assert.equal(h.calls.filter(x=>x.action==='touch').length,1);
  assert.equal(h.reloads(),0);assert.equal(h.retainsVerified(),true);
  h.advance();h.store.rememberMemberSession({...member,displayName:'更新した本人名',imageUrl:'https://example.test/new.jpg'},'token-a');h.flush();
  assert.equal(h.store.currentStoredInsightAccount().displayName,'更新した本人名');assert.equal(h.reloads(),0);assert.deepEqual(h.viewCache.get('verified').rows,['saved-view']);
});

test('TOPから開き直し・focus・pageshowでも実検証を続け、同じpageの確認済み表示を保持する',async()=>{
  const h=fixture();await settle();h.flush();
  h.navigate('');await settle();h.flush();h.navigate('#dashboard');await settle();h.flush();
  h.window.dispatchEvent(new Event('focus'));await settle();h.flush();h.window.dispatchEvent(new Event('pageshow'));await settle();h.flush();
  assert.equal(h.calls.filter(x=>x.action==='session').length,4);
  assert.equal(h.reloads(),0);assert.equal(h.retainsVerified(),true);assert.equal(h.viewCache.has('verified'),true);
});

test('実アカウント切替は重複イベントをまとめ、旧本人の確認済み表示を再利用しない',async()=>{
  const h=fixture();await settle();h.flush();h.advance();h.store.activateStoredInsightAccount(other.noteId);
  h.window.dispatchEvent(new Event('mumei-insight-accounts'));h.flush();
  assert.equal(h.reloads(),1);assert.equal(h.localStorage.getItem('mumei-insight-access-token'),'token-b');assert.equal(h.store.currentStoredInsightAccount().noteId,other.noteId);
  assert.equal(h.viewCache.size,0);assert.equal(h.retainsVerified(),false);
});

test('同じ本人のtoken更新もstoreの書換完了後に判定し、一度だけ反映する',async()=>{
  const h=fixture();await settle();h.flush();h.advance();h.store.rememberMemberSession(member,'token-a-new');h.flush();
  assert.equal(h.reloads(),1);assert.equal(h.localStorage.getItem('mumei-insight-access-token'),'token-a-new');assert.equal(h.store.currentStoredInsightAccount().noteId,member.noteId);
});

test('明示ログアウトはイベント後のtoken削除を認識し、旧本人表示と認証を残さない',async()=>{
  const h=fixture();await settle();h.flush();h.localStorage.setItem('mumei-insight-explicit-logout:'+member.noteId,'1');h.advance();h.store.forgetMemberSession(member.noteId);h.flush();
  assert.equal(h.localStorage.getItem('mumei-insight-access-token'),null);assert.equal(h.reloads(),1);assert.equal(h.viewCache.size,0);assert.equal(h.store.getStoredInsightAccount(member.noteId).memberToken,undefined);
});

test('logout後にAppが別の保存済み本人を復帰してもdocument再読込を重ねない',async()=>{
  const h=fixture();await settle();h.flush();
  h.window.addEventListener('mumei-insight-accounts',()=>{if(!h.localStorage.getItem('mumei-insight-access-token'))h.store.restoreStoredMemberSession()});
  h.localStorage.setItem('mumei-insight-explicit-logout:'+member.noteId,'1');h.advance();h.store.forgetMemberSession(member.noteId);h.flush();
  assert.equal(h.localStorage.getItem('mumei-insight-access-token'),'token-b');assert.equal(h.reloads(),1);assert.equal(h.store.getStoredInsightAccount(member.noteId).memberToken,undefined);
});

for(const action of ['switch','logout'])test(`遅い旧session検証は${action}後の本人・tokenを書き戻さない`,async()=>{
  const pending=deferred(),h=fixture({respond:()=>pending.promise});await settle();
  h.advance();if(action==='switch')h.store.activateStoredInsightAccount(other.noteId);else{h.localStorage.setItem('mumei-insight-explicit-logout:'+member.noteId,'1');h.store.forgetMemberSession(member.noteId)}
  // Deliver before the deferred account listener to exercise the fetch guard itself.
  pending.resolve(Response.json({ok:true,application:member}));await settle();h.flush();
  assert.equal(h.localStorage.getItem('mumei-insight-access-token'),action==='switch'?'token-b':null);assert.equal(h.reloads(),1);
  if(action==='logout')assert.equal(h.localStorage.getItem('mumei-insight-explicit-logout:'+member.noteId),'1');
});

test('失効したsessionは保存profileがactiveでも実検証からinvalidを返す',async()=>{
  const h=fixture({hash:'',respond:async()=>Response.json({ok:false,error:'INSIGHT_SESSION_INVALID'},{status:401})});
  h.window.location.hash='#dashboard';assert.equal(await h.startup.validateCurrentMemberToken(),'invalid');
  assert.equal(h.calls.filter(x=>x.action==='session').length,1);assert.equal(h.reloads(),0);
});

test('実検証で失効したtokenは保存済み本人の復帰認証へ進み、serverの新tokenだけを使う',async()=>{
  const h=fixture({accounts:[{...saved(member,'token-a'),applicantToken:'saved-applicant',passcode:'saved-passcode'}],respond:async(_url,_init,body)=>body.action==='session'?Response.json({ok:false,error:'INSIGHT_SESSION_INVALID'},{status:401}):Response.json({ok:true,application:member,memberToken:'server-restored-token'})});
  await settle();h.flush();
  assert.deepEqual(h.calls.filter(x=>x.action!=='touch').map(x=>x.action),['session','resume']);
  assert.equal(h.localStorage.getItem('mumei-insight-access-token'),'server-restored-token');assert.equal(h.store.currentStoredInsightAccount().noteId,member.noteId);assert.equal(h.store.getStoredInsightAccount(member.noteId).passcode,'saved-passcode');assert.equal(h.reloads(),1);
});
