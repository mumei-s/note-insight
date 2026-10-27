import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {PGlite} from '@electric-sql/pglite';
const script=readFileSync('public/note-insight-social-compare-v1.js','utf8');
async function reader(t,{historyOnly=true,authorized=true,query='',people=['former','mutual'],profileFailure='',missingAck='',skipFlags='',switchAccount=''}={}){
 const dom=new JSDOM('<main></main>',{url:'https://note.com/tester'+query,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>w.close());
 if(authorized)w.sessionStorage.setItem('mumei_social_explicit_scan_v1','/tester');
 if(historyOnly)w.sessionStorage.setItem('mumei_social_explicit_scan_mode_v1','history');
 const fullState={complete:false,direction:'followers',page:23,followingKeys:['old-full-progress'],followerKeys:[],followingTotal:45,followerTotal:2100};
 const values=new Map([['mumei_insight_notification_sync_token_v2:tester','fixture-token'],['mumei_social_comparison_v1:tester',structuredClone(fullState)]]),requests=[],writes=[],batches=[];
 let account='tester',fail=profileFailure,omit=missingAck;
 w.setTimeout=()=>0;w.clearTimeout=()=>{};w.setInterval=()=>0;
 const listen=w.addEventListener.bind(w);w.addEventListener=(name,...rest)=>{if(name!=='pageshow')listen(name,...rest)};
 w.fetch=async input=>{const u=new URL(input,w.location.href);requests.push(u.pathname+u.search);
  if(u.pathname==='/api/v2/current_user')return Response.json({data:{user:{urlname:account}}});
  if(u.pathname==='/api/v2/creators/tester')return Response.json({data:{key:'self',urlname:'tester',isMyself:true,followingCount:45,followerCount:2100}});
  const name=u.pathname.split('/').at(-1);if(name===fail)return new Response('',{status:429});
  if(name===switchAccount)account='another';
  return Response.json({data:{key:name,urlname:name,...(name===skipFlags?{}:{isFollowing:name==='mutual',isFollowed:name==='mutual'})}});
 };
 w.GM={getValue:async(k,d)=>values.has(k)?structuredClone(values.get(k)):d,setValue:async(k,v)=>values.set(k,structuredClone(v)),xmlHttpRequest:o=>{
  const body=JSON.parse(o.data);
  if(body.action==='history_candidates'){
   batches.push(body);const remaining=people.filter(key=>key>(body.after||'')),selected=remaining.slice(0,2);
   o.onload({status:200,responseText:JSON.stringify({ok:true,rows:selected.map(person_key=>({person_key,actor_url:'https://note.com/'+person_key})),nextCursor:remaining.length>2?selected.at(-1):null,remaining:remaining.length})});return;
  }
  writes.push(body);o.onload({status:200,responseText:JSON.stringify({ok:true,confirmedPersonKeys:(body.rows||[]).map(row=>row.person_key).filter(key=>key!==omit)})});
 }};
 w.eval(script.replace('sleep=ms=>new Promise(r=>setTimeout(r,ms))','sleep=async()=>{}'));
 return{w,values,fullState,requests,writes,batches,run:w.__mumeiSocialComparisonV1.run,recover:()=>{fail='';omit=''}};
}
test('過去の人物の明示照合は最新一覧を読み直さず、全件照合の保存位置も変更しない',async t=>{
 const h=await reader(t);await h.run(true);
 assert.equal(h.requests.filter(path=>path.includes('/api/v3/')).length,0);
 assert.deepEqual(h.values.get('mumei_social_comparison_v1:tester'),h.fullState);
 assert.equal(h.values.get('mumei_social_comparison_v1:tester:history').historyChecked,2);
 assert.equal(h.values.get('mumei_social_comparison_v1:tester:history').complete,true);
 assert.ok(h.writes.every(body=>!body.status),'history-only scan must not erase whole-list coverage status');
 const rows=h.writes.flatMap(body=>body.rows);assert.equal(rows.find(row=>row.person_key==='former').is_follower,false);assert.equal(rows.find(row=>row.person_key==='mutual').is_follower,true);
 const reads=h.requests.length;await h.run();assert.equal(h.requests.length,reads,'finished scan performs no background refresh');
});
test('過去確認の専用リンクだけが明示した照合を開始し、リンクの指示は一度だけ消費する',async t=>{
 const h=await reader(t,{historyOnly:false,authorized:false,query:'?mumei_social_scan=history'});
 h.w.dispatchEvent(new h.w.Event('focus'));
 for(let i=0;i<20&&!h.values.get('mumei_social_comparison_v1:tester:history')?.complete;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.w.sessionStorage.getItem('mumei_social_explicit_scan_mode_v1'),'history');assert.equal(h.w.location.search,'');assert.equal(h.values.get('mumei_social_comparison_v1:tester:history').complete,true);assert.ok(!h.requests.some(path=>path.includes('/api/v3/')));
 const ordinary=await reader(t,{historyOnly:false,authorized:false,query:'?mumei_social_scan=other'});ordinary.w.dispatchEvent(new ordinary.w.Event('focus'));await new Promise(resolve=>setImmediate(resolve));assert.equal(ordinary.requests.length,0);
});
test('過去の照合は失敗した本人の手前で止まり、再開時に保存済みの人物を読み直さない',async t=>{
 const h=await reader(t,{people:['a','b','c'],profileFailure:'b'});await h.run(true);
 assert.equal(h.values.get('mumei_social_comparison_v1:tester:history').historyCursor,'a');
 assert.equal(h.values.get('mumei_social_comparison_v1:tester:history').complete,false);
 h.recover();const offset=h.requests.length;await h.run(true);
 const resumed=h.requests.slice(offset);assert.ok(!resumed.includes('/api/v2/creators/a'));assert.ok(resumed.includes('/api/v2/creators/b'));assert.ok(resumed.includes('/api/v2/creators/c'));
 assert.equal(h.values.get('mumei_social_comparison_v1:tester:history').historyChecked,3);
 assert.deepEqual(h.values.get('mumei_social_comparison_v1:tester'),h.fullState);
});
test('保存確認がない人物は照合の保存位置を進めない',async t=>{
 const h=await reader(t,{people:['a','b'],missingAck:'b'});await h.run(true);
 const state=h.values.get('mumei_social_comparison_v1:tester:history');assert.equal(state.historyCursor,'a');assert.equal(state.historyChecked,1);assert.equal(state.error,'SOCIAL_SAVE_UNCONFIRMED');
 h.recover();await h.run(true);assert.equal(h.values.get('mumei_social_comparison_v1:tester:history').historyChecked,2);
});
test('本人切替や実関係フラグの欠落を解除の証拠にしない',async t=>{
 const switched=await reader(t,{people:['a'],switchAccount:'a'});await switched.run(true);assert.equal(switched.writes.length,0);assert.equal(switched.values.get('mumei_social_comparison_v1:tester:history').error,'NOTE_ACCOUNT_CHANGED');
 const unknown=await reader(t,{people:['a'],skipFlags:'a'});await unknown.run(true);assert.equal(unknown.writes.length,0);assert.equal(unknown.values.get('mumei_social_comparison_v1:tester:history').historySkipped,1);assert.match(unknown.w.document.querySelector('[role=status]').textContent,/未確認 1人/);
});
function sql(){
 if(process.env.SOCIAL_HISTORY_SCAN_SQL)return readFileSync(process.env.SOCIAL_HISTORY_SCAN_SQL,'utf8');
 const name=readdirSync('supabase/migrations').filter(name=>name.endsWith('_social_history_scan.sql')).sort().at(-1);assert.ok(name,'canonical social history scan migration exists');return readFileSync('supabase/migrations/'+name,'utf8');
}
test('過去の照合候補はDB内で会員とカーソルを絞り、確認済みと重複を除いて返す',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table public.insight_relations(member_id text,person_key text,actor_name text,actor_url text,last_seen_at timestamptz);
   create table public.insight_social_comparisons(member_id text,person_key text,actor_name text,actor_url text,checked_at timestamptz,is_following boolean,is_follower boolean);
   insert into public.insight_relations select 'owner','p'||lpad(n::text,3,'0'),'Person '||n,'https://note.com/p'||lpad(n::text,3,'0'),now()-interval '2 days' from generate_series(1,53)n;
   insert into public.insight_relations select * from public.insight_relations where person_key='p001';
   insert into public.insight_relations values('other','foreign','Foreign','https://note.com/foreign',now());
   insert into public.insight_relations values('owner','bad','Bad','https://example.com/bad',now());
   insert into public.insight_social_comparisons values
    ('owner','p001','Fresh','https://note.com/p001',now(),true,false),
    ('owner','p002','Partial','https://note.com/p002',now(),true,null),
    ('owner','p003','Stale','https://note.com/p003',now()-interval '2 days',true,true),
    ('owner','zextra','Comparison only','https://note.com/zextra',now()-interval '2 days',false,false);
  `);
  await db.exec(sql());await db.exec(sql());
  const fetch=async(after='')=>(await db.query('select public.insight_social_history_candidates($1,$2,20) as payload',['owner',after])).rows[0].payload;
  const first=await fetch();assert.equal(first.remaining,53);assert.equal(first.rows.length,20);assert.equal(first.rows[0].person_key,'p002');assert.equal(first.nextCursor,'p021');
  const second=await fetch(first.nextCursor);assert.equal(second.rows.length,20);assert.equal(second.remaining,33);const third=await fetch(second.nextCursor);assert.equal(third.rows.length,13);assert.equal(third.nextCursor,null);
  const keys=[...first.rows,...second.rows,...third.rows].map(row=>row.person_key);assert.equal(new Set(keys).size,53);assert.ok(!keys.includes('p001'));assert.ok(!keys.includes('foreign'));assert.ok(!keys.includes('bad'));assert.ok(keys.includes('p002'));assert.ok(keys.includes('zextra'));
  const perms=(await db.query("select has_function_privilege('anon','public.insight_social_history_candidates(text,text,integer)','EXECUTE') as anon,has_function_privilege('authenticated','public.insight_social_history_candidates(text,text,integer)','EXECUTE') as authenticated,has_function_privilege('service_role','public.insight_social_history_candidates(text,text,integer)','EXECUTE') as service")).rows[0];assert.deepEqual(perms,{anon:false,authenticated:false,service:true});
 }finally{await db.close()}
});
