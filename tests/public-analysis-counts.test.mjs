import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import vm from 'node:vm';
import ts from 'typescript';

const html=readFileSync('public/install-free-analysis-v3.html','utf8');
const TOKEN='mumei-insight-access-token',ACTIVE='mumei-insight-active-account-v3',STORE='mumei-insight-saved-accounts-v3';
const cache=id=>'mumei-public-analysis-cache-v1:'+id;
const pause=()=>new Promise(r=>setTimeout(r,10));
async function until(fn){for(let i=0;i<100&&!fn();i++)await pause();assert.ok(fn());}
function payload(id='tester',followers=2132,following=883){return {ok:true,member:{noteId:id},creator:{noteId:id,followers,following},stats:{officialFollowers:followers,officialFollowing:following},articles:[{title:'保存済み記事',url:'https://note.com/'+id+'/n/n1',publish_at:'2026-09-25T00:00:00Z',like_count:30,comment_count:10}]};}
function page(t,{id='tester',token='test-token',saved,values={},fetcher=async()=>Response.json(payload(id||'tester'))}={}){
 const dom=new JSDOM(html,{url:'https://mumei-s.github.io/note-insight/install-free-analysis-v3.html',runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());
 if(id)w.localStorage.setItem(ACTIVE,id);if(token)w.localStorage.setItem(TOKEN,token);if(saved)w.localStorage.setItem(cache(id),JSON.stringify({at:Date.now()-60000,data:saved}));
 for(const [k,v] of Object.entries(values))w.localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
 const calls=[];w.fetch=async(url,init)=>{calls.push({url,...JSON.parse(init.body),token:init.headers['X-Insight-Token']});return fetcher(url,init)};
 w.eval([...w.document.scripts].map(s=>s.textContent).join('\n'));
 const card=label=>[...w.document.querySelectorAll('.kpi')].find(x=>x.querySelector('small').textContent===label);
 return {w,calls,card,value:label=>card(label)?.querySelector('b').textContent,ready:()=>until(()=>!w.document.querySelector('#refresh').disabled&&w.document.querySelector('#status').classList.contains('ok'))};
}

test('本番APIのcreator/statsを表示し、記事・人物一覧の全件再取得をしない',async t=>{
 const p=page(t);await p.ready();assert.equal(p.value('フォロワー'),'2,132');assert.equal(p.value('フォロー'),'883');
 assert.deepEqual(p.calls.map(c=>c.action),['dashboard']);assert.match(p.card('フォロー').textContent,/確認/);
});

test('0人・旧stats形式・未取得を区別し、不正な数値を0人に変換しない',async t=>{
 for(const [data,expected] of [[payload('tester',0,0),'0'],[{...payload(),creator:{noteId:'tester'},stats:{officialFollowers:7,officialFollowing:0}},'0'],[payload('tester',null,null),'未取得'],[payload('tester',-1,''),'未取得'],[{...payload(),creator:{noteId:'tester',followers:0,following:0,publicCounts:{followers:null,following:null}}},'未取得']]){
  const p=page(t,{fetcher:async()=>Response.json(data)});await p.ready();assert.equal(p.value('フォロー'),expected);
 }
});

test('保存値を先に表示し、最新応答と再読込後のキャッシュへ両方の数値を反映する',async t=>{
 let finish;const p=page(t,{saved:payload('tester',100,200),fetcher:()=>new Promise(r=>finish=r)});
 assert.equal(p.value('フォロー'),'200');assert.match(p.card('フォロー').textContent,/保存/);
 finish(Response.json(payload()));await p.ready();const stored=JSON.parse(p.w.localStorage.getItem(cache('tester')));assert.equal(stored.data.creator.following,883);
 const next=page(t,{saved:stored.data,fetcher:()=>new Promise(()=>{})});assert.equal(next.value('フォロー'),'883');assert.equal(next.value('フォロワー'),'2,132');
});

test('公開データ更新を押すと人数を先に更新し、記事同期が失敗しても人数は保持する',async t=>{
 let finishSync,latest=payload();const p=page(t,{fetcher:async(_url,init)=>JSON.parse(init.body).action==='sync'?new Promise(r=>finishSync=r):Response.json(latest)});await p.ready();
 latest=payload('tester',2133,884);p.w.document.querySelector('#refresh').click();await until(()=>Boolean(finishSync));
 assert.equal(p.value('フォロー'),'884');assert.equal(p.value('フォロワー'),'2,133');assert.equal(p.w.document.querySelector('#refresh').disabled,true);
 p.w.document.querySelector('#refresh').click();assert.equal(p.calls.filter(c=>c.action==='sync').length,1);
 finishSync(Response.json({ok:false,error:'sync-failed'},{status:500}));await until(()=>!p.w.document.querySelector('#refresh').disabled);assert.equal(p.value('フォロー'),'884');assert.match(p.w.document.querySelector('#status').textContent,/記事.*失敗/);
});

test('取得失敗時は保存値と更新失敗を表示し、初回失敗は未取得のままにする',async t=>{
 const fail=async()=>Response.json({ok:false,error:'NOTE_PUBLIC_503'},{status:500});
 const p=page(t,{saved:payload(),fetcher:fail});await until(()=>p.w.document.querySelector('#status').classList.contains('warn'));assert.equal(p.value('フォロー'),'883');assert.match(p.w.document.querySelector('#status').textContent,/保存済み.*更新失敗/);
 const empty=page(t,{fetcher:fail});await until(()=>empty.w.document.querySelector('#status').classList.contains('warn'));assert.ok(empty.w.document.querySelector('#content').classList.contains('hidden'));
});

test('参加者切替中に前のアカウントの応答を表示・保存しない',async t=>{
 let finishA;const p=page(t,{fetcher:(_url,init)=>init.headers['X-Insight-Token']==='test-token'?new Promise(r=>finishA=r):Promise.resolve(Response.json(payload('another',4,5)))});
 p.w.localStorage.setItem(ACTIVE,'another');p.w.localStorage.setItem(TOKEN,'another-token');p.w.dispatchEvent(new p.w.StorageEvent('storage',{key:ACTIVE}));
 await until(()=>p.value('フォロー')==='5');finishA(Response.json(payload()));await pause();assert.equal(p.value('フォロー'),'5');assert.equal(p.w.localStorage.getItem(cache('tester')),null);assert.equal(JSON.parse(p.w.localStorage.getItem(cache('another'))).data.creator.noteId,'another');
});

test('本人IDが違う応答・キャッシュを拒否し、明示ログアウトから自動復帰しない',async t=>{
 const p=page(t,{saved:payload('someone'),fetcher:async()=>Response.json(payload('someone'))});await until(()=>p.w.document.querySelector('#status').classList.contains('warn'));assert.equal(p.value('フォロー'),undefined);assert.match(p.w.document.querySelector('#status').textContent,/アカウント/);
 const off=page(t,{token:'',saved:payload(),values:{[STORE]:[{noteId:'tester',memberToken:'old-token',status:'active'}],'mumei-insight-explicit-logout:tester':'1'}});await pause();assert.equal(off.calls.length,0);assert.ok(off.w.document.querySelector('#content').classList.contains('hidden'));
});

test('保存ログインを復元してからキャッシュを選び、開く・収納操作で追加取得しない',async t=>{
 const p=page(t,{id:'',token:'',values:{[STORE]:[{noteId:'tester',memberToken:'test-token',status:'active'}]}});await p.ready();assert.equal(p.w.localStorage.getItem(ACTIVE),'tester');assert.ok(p.w.localStorage.getItem(cache('tester')));
 p.w.document.querySelector('#openAll').click();assert.ok([...p.w.document.querySelectorAll('details.section')].every(d=>d.open));p.w.document.querySelector('#closeAll').click();assert.ok([...p.w.document.querySelectorAll('details.section')].every(d=>!d.open));assert.equal(p.calls.length,1);
});

test('現行backendは本人だけの数値を返し、欠損・0人・別人の応答を区別する（運営者・参加者）',async()=>{
 for(const [id,raw,expected] of [['ss_yr',{followerCount:2132,followingCount:883},883],['participant',{followerCount:2132,followingCount:883},883],['participant',{followerCount:0,followingCount:0},0],['participant',{},null],['participant',{followerCount:-1,followingCount:'12'},null],['participant',{urlname:'wrong'},'mismatch']]){
  const reads=[],urls=[];let handler;
  const db={rpc:async()=>({data:{},error:null}),from(table){let action='read';const filters=[];const q={select:()=>q,order:()=>q,limit:()=>q,update:()=>{action='write';return q},eq:(k,v)=>{filters.push([k,v]);return q}};const result=()=>{reads.push({table,filters,action});return {data:table==='insight_member_sessions'?{id:'session',application_id:'member',expires_at:'2099-01-01',revoked_at:null}:table==='insight_access_applications'?{id:'member',note_id:id,status:'active'}:table==='insight_public_articles'?[]:{},error:null}};q.maybeSingle=async()=>result();q.then=(a,b)=>Promise.resolve(result()).then(a,b);return q;}};
  const context=vm.createContext({Request,Response,TextEncoder,crypto:globalThis.crypto,AbortController,setTimeout,clearTimeout,console,Deno:{env:{get:()=>''},serve:fn=>handler=fn},fetch:async url=>{urls.push(url);return Response.json({data:{urlname:id,noteCount:269,...raw}})}}),modules=new Map();
  async function load(name){if(modules.has(name))return modules.get(name);const code=ts.transpileModule(readFileSync('supabase/functions/insight-member-api/'+name,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,m=new vm.SourceTextModule(code,{context});modules.set(name,m);await m.link(spec=>spec.startsWith('npm:')?new vm.SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>db)},{context}):load(spec.replace('./','')));return m;}
  await (await load('index.ts')).evaluate();const body=JSON.stringify({action:'dashboard',noteId:'wrong',member_id:'someone'});
  assert.equal((await handler(new Request('https://example.test',{method:'POST',body}))).status,401);assert.equal(urls.length,0);
  const res=await handler(new Request('https://example.test',{method:'POST',body,headers:{'X-Insight-Token':'fixture'}})),data=await res.json();assert.deepEqual(urls,['https://note.com/api/v2/creators/'+id]);
  if(expected==='mismatch'){assert.equal(res.status,500);assert.equal(data.creator,undefined);continue}
  assert.equal(data.creator.noteId,id);assert.equal(data.creator.publicCounts.following,expected);assert.equal(data.creator.following,expected??0);assert.equal(typeof data.creator.publicCounts.checkedAt,'string');
  assert.ok(reads.filter(r=>r.table==='insight_public_articles').every(r=>r.filters.some(([k,v])=>k==='member_id'&&v===(id==='ss_yr'?'owner':'member'))));
 }
});
