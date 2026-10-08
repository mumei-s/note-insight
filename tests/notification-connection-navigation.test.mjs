import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';

const APP='https://mumei-s.github.io/note-insight/';
const DEFAULT_RETURN=APP+'?insightMode=notifications#dashboard';
const MEMBER='mumei-insight-access-token';
const TOKENS={a:'synthetic-member-a',b:'synthetic-member-b'};
const pause=()=>new Promise(resolve=>setImmediate(resolve));
const settle=async()=>{await pause();await pause();await pause();};
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};}
function stats(account){return{ok:true,noteId:account,paired:true,activeDeviceCount:1};}

async function fixture(t,{params={},token=TOKENS.a,onStats,onPair}={}){
 const url=new URL('notification-connection.html',APP);
 for(const [key,value] of Object.entries(params))if(value!==null)url.searchParams.set(key,value);
 const requests=[],errors=[],virtualConsole=new VirtualConsole();
 virtualConsole.on('jsdomError',error=>{if(!/Not implemented: navigation/i.test(error.message))errors.push(error);});
 const dom=new JSDOM(readFileSync('public/notification-connection.html','utf8'),{
  url:url.href,runScripts:'dangerously',virtualConsole,
  beforeParse(w){
   if(token)w.localStorage.setItem(MEMBER,token);
   w.localStorage.setItem('mumei-notification-tool-version','3.6.38');
   w.fetch=async(raw,init={})=>{
    const endpoint=new URL(String(raw),url);
    if(endpoint.pathname.endsWith('/insight-release.json'))return Response.json({notificationVersion:'3.6.38'});
    assert.match(endpoint.pathname,/\/functions\/v1\/insight-notification-import-token$/);
    const body=JSON.parse(init.body||'{}'),headers=new Headers(init.headers||{});
    const request={action:body.action,role:body.role,token:headers.get('X-Insight-Token')||headers.get('X-Owner-Token'),signal:init.signal};
    requests.push(request);
    if(body.action==='stats')return Response.json(await(onStats?onStats(request):stats(request.token===TOKENS.b?'account_b':'account_a')));
    if(body.action==='pair-start')return Response.json(await(onPair?onPair(request):{ok:true,noteUrl:'https://note.com/?mumei_pair=synthetic'}));
    throw new Error('Unexpected action: '+body.action);
   };
  },
 });
 t.after(async()=>{await settle();dom.window.close();});
 await settle();
 assert.deepEqual(errors,[],'page scripts execute without errors');
 return{w:dom.window,requests,el:id=>dom.window.document.getElementById(id)};
}

for(const [name,raw] of [
 ['missing',null],['empty',''],['blank',' \t '],
 ['self','./notification-connection.html?from=note'],
 ['sibling','./notification-browser-install.html?from=notification-connection'],
 ['external','https://note.com/notifications'],
]){
 test(`${name} return uses the INSIGHT notifications fallback`,async t=>{
  const h=await fixture(t,{params:{from:'note',return:raw},token:''});
  assert.equal(h.el('back').href,DEFAULT_RETURN);
 });
}

test('valid app return preserves its query and dashboard hash',async t=>{
 const target=APP+'?insightMode=comments&insightAppVersion=3.6.38&keep=value#dashboard';
 const h=await fixture(t,{params:{return:target},token:''});
 assert.equal(h.el('back').href,target);
});

test('top-right action returns to INSIGHT and top-left action switches accounts',async t=>{
 const h=await fixture(t,{token:''}),links=[...h.w.document.querySelectorAll('nav.top a')];
 assert.equal(links[0]?.id,'accountSwitch');
 assert.equal(links.at(-1)?.id,'back');
 assert.match(links[0].textContent,/INSIGHTアカウント切替/);
 assert.equal(links.at(-1).textContent.trim(),'← INSIGHTへ戻る');
});

test('account switch records all manual-intent keys before navigating',async t=>{
 const h=await fixture(t),link=h.el('accountSwitch');
 assert.ok(link);
 link.addEventListener('click',event=>event.preventDefault());
 link.click();
 assert.equal(h.w.sessionStorage.getItem('mumei-insight-access-intent'),'switch');
 assert.equal(h.w.sessionStorage.getItem('mumei-insight-manual-access-intent-v1'),'switch');
 assert.equal(h.w.sessionStorage.getItem('mumei-insight-account-switch-lock-v1'),'1');
 assert.equal(new URL(link.href).hash,'#access/insight');
});

function changeAccount(h,eventName){
 h.w.localStorage.setItem(MEMBER,TOKENS.b);
 if(eventName==='storage')h.w.dispatchEvent(new h.w.StorageEvent('storage',{key:MEMBER,oldValue:TOKENS.a,newValue:TOKENS.b}));
 else h.w.dispatchEvent(new h.w.PageTransitionEvent('pageshow',{persisted:true}));
}

for(const eventName of ['storage','pageshow']){
 test(`${eventName} rechecks the new account before allowing pairing`,async t=>{
  const pendingB=deferred(),target=APP+'?insightMode=notifications&notificationAccount=account_a#dashboard';
  const h=await fixture(t,{
   params:{notificationAccount:'account_a',return:target},
   onStats:request=>request.token===TOKENS.b?pendingB.promise:stats('account_a'),
  });
  assert.match(h.el('accountState').textContent,/@account_a/);
  assert.equal(h.el('pair').disabled,false);
  changeAccount(h,eventName);
  assert.equal(h.el('pair').disabled,true,'pairing is locked immediately while account B is being checked');
  h.el('pair').click();
  await settle();
  assert.equal(h.requests.filter(request=>request.action==='pair-start').length,0);
  assert.ok(h.requests.some(request=>request.action==='stats'&&request.token===TOKENS.b));
  pendingB.resolve(stats('account_b'));
  await settle();
  assert.match(h.el('accountState').textContent,/@account_b/);
  assert.equal(h.el('pair').disabled,false);
  for(const id of ['back','history','filter'])assert.notEqual(new URL(h.el(id).href).searchParams.get('notificationAccount'),'account_a',id+' must not target the previous account');
  assert.equal(new URL(h.el('history').href).searchParams.get('notificationAccount'),'account_b');
  assert.equal(new URL(h.el('filter').href).searchParams.get('notificationAccount'),'account_b');
  h.el('pair').click();
  await settle();
  const pairing=h.requests.filter(request=>request.action==='pair-start');
  assert.equal(pairing.length,1);
  assert.equal(pairing[0].token,TOKENS.b);
 });
}

test('a delayed old-account stats response cannot overwrite the newly verified account',async t=>{
 const pendingA=deferred(),pendingB=deferred();
 const h=await fixture(t,{params:{notificationAccount:'account_a'},onStats:request=>request.token===TOKENS.b?pendingB.promise:pendingA.promise});
 assert.ok(h.requests.some(request=>request.action==='stats'&&request.token===TOKENS.a));
 changeAccount(h,'storage');
 await settle();
 assert.ok(h.requests.some(request=>request.action==='stats'&&request.token===TOKENS.b));
 pendingB.resolve(stats('account_b'));
 await settle();
 assert.match(h.el('accountState').textContent,/@account_b/);
 // Ignore abort in this transport and deliver the superseded A response last.
 pendingA.resolve(stats('account_a'));
 await settle();
 assert.match(h.el('accountState').textContent,/@account_b/);
 assert.doesNotMatch(h.el('accountState').textContent,/@account_a/);
 assert.equal(h.el('pair').disabled,false);
 for(const id of ['back','history','filter'])assert.notEqual(new URL(h.el(id).href).searchParams.get('notificationAccount'),'account_a');
});
