import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';

const source=readFileSync('supabase/functions/insight-social-events/index.ts','utf8');
function splitLogic(expression){let depth=0,start=0;const parts=[];for(let i=0;i<expression.length;i++){if(expression[i]==='(')depth++;if(expression[i]===')')depth--;if(expression[i]===','&&depth===0){parts.push(expression.slice(start,i));start=i+1}}parts.push(expression.slice(start));return parts}
function matchesLogic(expression,row){
 const one=part=>{if(part.startsWith('and('))return splitLogic(part.slice(4,-1)).every(one);if(part.startsWith('or('))return splitLogic(part.slice(3,-1)).some(one);const match=part.match(/^([a-z_]+)\.(eq|ilike)\.(.*)$/);assert.ok(match,'supported PostgREST logical predicate '+part);const[,key,operator,value]=match;return operator==='eq'?String(row[key])===value:String(row[key]||'').toLowerCase().includes(value.replaceAll('%','').toLowerCase())};
 return splitLogic(expression).some(one);
}
function reader(rows){
 const calls=[],orCalls=[];
 const context=vm.createContext({
  valid:v=>v||null,searchText:v=>String(v||''),annotate:async(_scope,data)=>data,
  db:{from(table){calls.push(table);let data=rows.slice(),orders=[];
   const q={select(){return q},eq(k,v){data=data.filter(r=>r[k]===v);return q},
    not(k,_op,v){data=data.filter(r=>!String(r[k]).startsWith(v.replace('%','')));return q},
    in(k,values){data=data.filter(r=>values.includes(r[k]));return q},
    or(expression){orCalls.push(expression);data=data.filter(r=>matchesLogic(expression,r));return q},gte(k,v){data=data.filter(r=>r[k]>=v);return q},lt(k,v){data=data.filter(r=>r[k]<v);return q},
    order(k,{ascending=false}={}){orders.push([k,ascending]);return q},
    async range(a,b){data.sort((x,y)=>{for(const[k,ascending] of orders){const result=String(x[k]).localeCompare(String(y[k]));if(result)return ascending?result:-result}return 0});return{data:data.slice(a,b+1),count:data.length,error:null}}};return q;}}
 });
 const part=source.slice(source.indexOf('const EVENT_FIELDS='),source.indexOf('function comparisonWindow('));
 vm.runInContext(ts.transpileModule(part+'\nthis.read=windowEvents;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
 return {read:context.read,calls,orCalls};
}
const base={member_id:'owner',direction:'followers',event_type:'removed',detected_at:'2026-10-28T00:00:00Z'};
function row(id,extra={}){return{...base,id,person_key:id,identity_exact:false,candidate_resolved:false,...extra};}
const fixtures=[
 row('actual-loss',{identity_exact:true,evidence:'authenticated_relationship',current_relation:'following_only',current_is_follower:false}),
 row('refollowed',{identity_exact:true,evidence:'authenticated_relationship',current_relation:'mutual',current_is_following:true,current_is_follower:true,current_verified_at:'2026-10-28T01:00:00Z'}),
 row('still-mutual',{evidence:'window_candidate',candidate_resolved:true,current_relation:'mutual',current_is_follower:true}),
 row('still-follower',{evidence:'window_candidate',candidate_resolved:true,current_relation:'follower_only',current_is_follower:true}),
 row('unresolved',{evidence:'window_candidate',current_relation:'unknown'}),
 row('unknown:1',{evidence:'count_only',change_count:3}),
 row('confirmed-add',{event_type:'added',identity_exact:true,evidence:'complete_snapshot'}),
 row('unconfirmed-add',{event_type:'added',evidence:'window_candidate'}),
 row('foreign',{member_id:'other',identity_exact:true})
];
test('減は確認済みの履歴だけを数え、現在相互の人には再フォロー後の状態も残す',async()=>{
 const h=reader(fixtures),result=await h.read('owner',{action:'events',change:'removed'},null,0,50);
 assert.deepEqual(Array.from(result.rows,r=>r.person_key).sort(),['actual-loss','refollowed']);
 assert.equal(result.total,2);
 const returned=result.rows.find(r=>r.person_key==='refollowed');
 assert.equal(returned.current_relation,'mutual');assert.equal(returned.current_is_follower,true);assert.equal(returned.identity_exact,true);
 assert.deepEqual(h.calls,['insight_relation_history_current']);
});
test('調査は人数のみと未解決の候補だけで、現時点のフォロワーや相互は候補に混ざらない',async()=>{
 const h=reader(fixtures),result=await h.read('owner',{action:'investigation',change:'added'},null,0,50);
 assert.deepEqual(Array.from(result.rows,r=>r.person_key).sort(),['unknown:1','unresolved']);assert.equal(result.total,2);
 assert.equal(result.rows.find(r=>r.person_key==='unknown:1').change_count,3,'人数の減少を候補者へ勝手に割り当てない');
});
test('すべての増減履歴は増加の人物記録を残し、人数不明と範囲外の観測を解除として表示しない',async()=>{
 const h=reader(fixtures),result=await h.read('owner',{action:'events',change:'all'},null,0,50);
 assert.deepEqual(Array.from(result.rows,r=>r.person_key).sort(),['actual-loss','confirmed-add','refollowed','unconfirmed-add']);assert.equal(result.total,4);
});
test('確定判定は範囲選択とページ送りより先に行い、件数とページの内容が一致する',async()=>{
 const rows=Array.from({length:90},(_,i)=>row('p'+String(i).padStart(3,'0'),{identity_exact:i%3===0}));
 const h=reader(rows),keys=rows.map(r=>r.person_key),first=await h.read('owner',{action:'events',change:'removed'},keys,0,20),second=await h.read('owner',{action:'events',change:'removed'},keys,20,20);
 assert.equal(first.total,30);assert.equal(first.rows.length,20);assert.equal(second.rows.length,10);
 const returned=[...first.rows,...second.rows].map(r=>r.person_key);assert.equal(new Set(returned).size,30);assert.ok([...first.rows,...second.rows].every(r=>r.identity_exact));
});
test('人物詳細も現在関係を含む統合ビューを参照して過去の観測は残す',()=>{
 const body=source.slice(source.indexOf('async function investigate('),source.indexOf('async function windowPeople('));
 assert.match(body,/insight_relation_history_current/);assert.doesNotMatch(body,/\.eq\("identity_exact"/);
 assert.match(source,/current_direction_present,current_direction_verified_at,candidate_resolved/);
});
test('次ページの取得では同じnote公式プロフィールを読み直さない',async()=>{
 let externalReads=0;
 const run={direction:'followers',expected_count:2306,received_count:1000,complete:false,created_at:'2026-10-28T00:00:00Z'};
 const ctx=vm.createContext({liveCounts:async()=>{externalReads++;return{followers:2306,followings:886,at:'2026-10-28T01:00:00Z'}},db:{from(){const q={select(){return q},eq(){return q},order(){return q},limit:async()=>({data:[run],error:null})};return q}}});
 const part=source.slice(source.indexOf('async function latestRuns('),source.indexOf('const PERSON_FIELDS='));
 vm.runInContext(ts.transpileModule(part+'\nthis.read=latestRuns;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,ctx);
 const first=await ctx.read('owner','tester');assert.equal(externalReads,1);assert.equal(first.followers.live_expected_count,2306);
 const next=await ctx.read('owner','tester',false);assert.equal(externalReads,1);assert.equal(next.followers.expected_count,2306);
 assert.match(source,/latestRuns\(m\.scope,m\.noteId,page===1\|\|b\.refreshLive===true\)/);
});
test('全履歴の確認件数・人数不明・未解決人数は同じ条件で一度に集計する',async()=>{
 const calls=[],summary={confirmedRemoved:7,unknownDecrease:48,unresolvedCandidates:12,resolvedCandidates:9,savedPeople:1500};
 const ctx=vm.createContext({valid:v=>v||null,searchText:v=>String(v||''),db:{rpc:async(name,args)=>{calls.push({name,args});return{data:summary,error:null}}}});
 const part=source.slice(source.indexOf('async function historySummary('),source.indexOf('function comparisonWindow('));
 vm.runInContext(ts.transpileModule(part+'\nthis.read=historySummary;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,ctx);
 const actual=await ctx.read('owner',{direction:'followers',dateFrom:'2026-09-01',dateTo:'2026-10-01',query:'creator',page:4,window:'latest'});
 assert.equal(actual,summary);assert.equal(calls.length,1);assert.equal(calls[0].name,'insight_social_history_summary');
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args)),{p_member:'owner',p_direction:'followers',p_from:'2026-09-01',p_to:'2026-10-01',p_query:'creator'});
 assert.match(source,/historySummary:summary/);
});
test('すべての履歴を検索しても検索ORが減少の確認条件を置き換えない',async()=>{
 const matching=fixtures.map(r=>({...r,actor_name:'matching creator'}));
 matching.push(row('nonmatching-confirmed',{identity_exact:true,actor_name:'different person'}));
 const h=reader(matching),result=await h.read('owner',{action:'events',change:'all',query:'matching'},null,0,50);
 assert.equal(h.orCalls.length,1,'policy and search must share one PostgREST or parameter');
 assert.equal(h.orCalls[0],'and(or(event_type.eq.added,identity_exact.eq.true),or(actor_name.ilike.%matching%,actor_url.ilike.%matching%))');
 assert.deepEqual(Array.from(result.rows,r=>r.person_key).sort(),['actual-loss','confirmed-add','refollowed','unconfirmed-add']);
 assert.equal(result.total,4);assert.ok(!result.rows.some(r=>r.person_key==='unresolved'||r.person_key==='unknown:1'));
});
