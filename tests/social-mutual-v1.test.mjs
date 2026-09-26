import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync('public/note-insight-social-compare-v1.js','utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
function comparison(){const src=readFileSync('supabase/functions/insight-social-events/index.ts','utf8'),part=src.slice(src.indexOf('function comparisonRows('),src.indexOf('async function comparison(')),ctx=vm.createContext({});vm.runInContext(ts.transpileModule(part+'\nthis.compare=comparisonRows;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx.compare}
const row=(key,direction)=>({person_key:key,direction,actor_name:key,source_rank:key==='older'?950:1,last_seen_at:'2026-09-22T00:00:00Z'});
test('フォローとフォロワーを相手ごとに照合し、1000人範囲外は解除としない',()=>{
 const r=comparison()([row('mutual','followings'),row('mutual','followers'),row('older','followings')],[],{followers:{complete:false},followings:{complete:true}});
 assert.equal(r.find(x=>x.person_key==='mutual').relation,'mutual');const older=r.find(x=>x.person_key==='older');assert.equal(older.is_follower,null);assert.equal(older.relation,'unknown');assert.equal(older.lost_at,null);
});
test('本人の実関係フラグで範囲外の相手も照合し、初回の非相互を過去の解除と混同しない',()=>{
 const r=comparison()([row('older','followings')],[{person_key:'older',is_following:true,is_follower:false,checked_at:'2026-09-22T01:00:00Z',lost_at:null}],{});
 assert.equal(r[0].relation,'following_only');assert.equal(r[0].identity_exact,true);assert.equal(r[0].lost_at,null);
 const lost=comparison()([row('older','followings')],[{person_key:'older',is_following:true,is_follower:false,checked_at:'2026-09-22T01:00:00Z',lost_at:'2026-09-22T01:00:00Z'}],{});assert.equal(lost[0].lost_at,'2026-09-22T01:00:00Z');
});
async function fixture(t,{legacy=false,authorized=true}={}){
 const dom=new JSDOM('<main></main>',{url:'https://note.com/tester',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,gm=new Map(),calls=[],writes=[];t.after(()=>dom.window.close());
 let account='tester',missing='',switchAt=0;
 if(authorized)w.sessionStorage.setItem('mumei_social_explicit_scan_v1','/tester');
 gm.set('mumei_insight_notification_sync_token_v2:tester','private-test-token');
 w.setTimeout=()=>0;w.clearTimeout=()=>{};w.setInterval=()=>0;const listen=w.addEventListener.bind(w);w.addEventListener=(event,...args)=>{if(event!=='pageshow')listen(event,...args)};
 w.fetch=async path=>{const u=new URL(path,w.location.href);if(u.pathname==='/api/v2/current_user')return Response.json({data:{user:{urlname:account}}});if(u.pathname==='/api/v2/creators/tester')return Response.json({data:{key:'self-key',urlname:'tester',isMyself:true,followingCount:45,followerCount:1}});
  const page=Number(u.searchParams.get('page')),direction=u.pathname.endsWith('/followings')?'followings':'followers';calls.push({direction,page});if(calls.length===switchAt)account='another';const total=direction==='followings'?45:1;
  return Response.json({data:{follows:Array.from({length:Math.min(20,Math.max(0,total-(page-1)*20))},(_,i)=>({key:'p'+((page-1)*20+i+1),urlname:'p'+((page-1)*20+i+1),is_following:true,is_followed:i%2===0})),is_last_page:page*20>=total}});
 };
 const getValue=async(k,d)=>gm.get(k)??d,setValue=async(k,v)=>gm.set(k,structuredClone(v)),xhr=o=>{const body=JSON.parse(o.data);writes.push(body);o.onload({status:200,responseText:JSON.stringify({ok:true,confirmedPersonKeys:body.rows.map(x=>x.person_key).filter(k=>k!==missing)})})};
 if(legacy){w.GM_getValue=getValue;w.GM_setValue=setValue;w.GM_xmlhttpRequest=xhr}else w.GM={getValue,setValue,xmlHttpRequest:xhr};
 w.eval(source.replace('sleep=ms=>new Promise(r=>setTimeout(r,ms))','sleep=async()=>{}'));
 return{api:w.__mumeiSocialComparisonV1,gm,calls,writes,omit:k=>missing=k,switchAt:n=>switchAt=n};
}
for(const legacy of [false,true])test(`下のページ・ページ内の下の人から照合し、保存済みは毎回全走査しない（${legacy?'GM互換':'GM標準'}）`,async t=>{
 const h=await fixture(t,{legacy});await h.api.run();assert.deepEqual(h.calls,[{direction:'followings',page:3},{direction:'followings',page:2},{direction:'followings',page:1},{direction:'followers',page:1}]);assert.equal(h.writes[0].rows[0].person_key,'p45');assert.equal(h.writes[0].rows[4].person_key,'p41');assert.equal(h.gm.get('mumei_social_comparison_v1:tester').complete,true);await h.api.run();assert.equal(h.calls.length,4);assert.equal(JSON.stringify([...h.gm.values()].slice(1)).includes('private-test-token'),false);
});
test('途中で保存確認を得られなかったページを飛ばさず再開する',async t=>{
 const h=await fixture(t);h.omit('p25');await h.api.run();assert.equal(h.gm.get('mumei_social_comparison_v1:tester').page,2);assert.equal(h.gm.get('mumei_social_comparison_v1:tester').complete,false);
 h.omit('');h.calls.length=0;await h.api.run();assert.deepEqual(h.calls.map(x=>x.page),[2,1,1]);assert.equal(h.gm.get('mumei_social_comparison_v1:tester').complete,true);
});
test('取得中の本人切替では他の会員に照合結果を保存しない',async t=>{
 const h=await fixture(t);h.switchAt(1);await h.api.run();assert.equal(h.writes.length,0);assert.equal(h.gm.get('mumei_social_comparison_v1:tester').error,'NOTE_ACCOUNT_CHANGED');
});
test('相手の状態が存在しない応答をfalseにしない',async t=>{
 const h=await fixture(t),p=h.api.person({key:'p1',urlname:'p1'},'followings',900);assert.equal(p.is_following,true);assert.equal(p.is_follower,null);
 const nested=h.api.person({key:'p2',urlname:'p2',followings:{actively:true,passively:false}},'followings',901);assert.equal(nested.is_follower,false);assert.equal(nested.following_rank,901);
});

test('通常のプロフィール訪問では明示した照合がなければ通信しない',async t=>{const h=await fixture(t,{authorized:false});await h.api.run();assert.equal(h.calls.length,0);assert.equal(h.writes.length,0)});
