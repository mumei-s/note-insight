import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const backend=readFileSync('supabase/functions/insight-social-events/index.ts','utf8');
const part=backend.slice(backend.indexOf('function comparisonRows('),backend.indexOf('async function comparison('));
const context=vm.createContext({});vm.runInContext(ts.transpileModule(part+'\nthis.rows=comparisonRows;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
test('最新1000人の枠外を相手の解除として確定しない',()=>{
 const r=context.rows([{person_key:'p',direction:'followings',source_rank:895,last_seen_at:'2026-09-22T01:00:00Z'}],[],{followers:{complete:false}})[0];
 assert.equal(r.is_following,true);assert.equal(r.is_follower,null);assert.equal(r.relation,'unknown');assert.equal(r.lost_at,null);
});
test('本人の相互確認で減少した相手は古い取得範囲にいなくても表示する',()=>{
 const r=context.rows([{person_key:'p',direction:'followings',source_rank:895,last_seen_at:'2026-09-22T01:00:00Z'}],[{person_key:'p',is_following:true,is_follower:false,checked_at:'2026-09-22T02:00:00Z',lost_at:'2026-09-22T02:00:00Z'}],{followers:{complete:false}})[0];
 assert.equal(r.relation,'following_only');assert.equal(r.lost_at,'2026-09-22T02:00:00Z');assert.equal(r.identity_exact,true);
});
test('初回のフォロー返しなしを新しい減少履歴にしない',()=>{
 const r=context.rows([],[{person_key:'p',is_following:true,is_follower:false,checked_at:'2026-09-22T02:00:00Z'}],{})[0];
 assert.equal(r.relation,'following_only');assert.equal(r.lost_at,null);
});
test('新しい全件照合を古い相互確認で上書きしない',()=>{
 const r=context.rows([{person_key:'p',direction:'followers',last_seen_at:'2026-09-22T03:00:00Z'}],[{person_key:'p',is_following:true,is_follower:true,checked_at:'2026-09-22T02:00:00Z'}],{followings:{complete:true,created_at:'2026-09-22T03:00:00Z'}})[0];
 assert.equal(r.is_following,false);assert.equal(r.relation,'follower_only');
});
function reader(t,myself=true,legacy=false){
 const dom=new JSDOM('<main></main>',{url:'https://note.com/tester',runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());
 const values=new Map([['mumei_insight_notification_sync_token_v2:tester','fixture-token']]),calls=[],writes=[];
 Object.defineProperty(w.document,'visibilityState',{value:'visible'});w.setInterval=()=>0;w.clearTimeout=()=>{};w.setTimeout=(fn,ms)=>ms===200?setImmediate(fn):0;
 w.fetch=async input=>{const u=new URL(input,w.location.href);if(u.pathname==='/api/v2/current_user')return new Response(JSON.stringify({data:{user:{urlname:'tester'}}}));
  if(u.pathname==='/api/v2/creators/tester')return new Response(JSON.stringify({data:{isMyself:myself,urlname:'tester',key:'fixture-key',followingCount:45,followerCount:0}}));
  const page=Number(u.searchParams.get('page'));calls.push(page);return new Response(JSON.stringify({data:{follows:Array.from({length:Math.min(20,45-(page-1)*20)},(_,i)=>({key:'p'+((page-1)*20+i+1),urlname:'p'+((page-1)*20+i+1),is_following:true,is_followed:false}))}}));
 };
 const api={getValue:async(k,d)=>values.has(k)?values.get(k):d,setValue:async(k,v)=>values.set(k,v),xmlHttpRequest:o=>{const p=JSON.parse(o.data);writes.push(p);o.onload({status:200,responseText:JSON.stringify({ok:true,confirmedPersonKeys:p.rows.map(r=>r.person_key)})})}};
 if(legacy){w.GM_getValue=api.getValue;w.GM_setValue=api.setValue;w.GM_xmlhttpRequest=api.xmlHttpRequest}else w.GM=api;
 w.eval(readFileSync('public/note-insight-social-compare-v1.js','utf8'));return{run:w.__mumeiSocialComparisonV1.run,calls,writes,values};
}
for(const legacy of [false,true])test('本人フォロー一覧を下から保存する '+(legacy?'旧GM':'新GM'),async t=>{
 const h=reader(t,true,legacy);await h.run(true);assert.deepEqual(h.calls,[3,2,1]);assert.deepEqual(h.writes.flatMap(p=>p.rows.map(r=>r.following_rank)),Array.from({length:45},(_,i)=>45-i));assert.equal(h.writes.at(-1).status.complete,true);
});
test('本人と確認できない公開プロフィールでは照合を保存しない',async t=>{
 const h=reader(t,false);await h.run(true);assert.equal(h.calls.length,0);assert.equal(h.writes.length,0);
});
