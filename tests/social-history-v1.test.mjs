import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
function evaluate(source,context={}){const ctx=vm.createContext(context);vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,ctx);return ctx}
test('最新1000人からの消失と総数減少が重なっても、解除した人物を推測で確定しない',async()=>{
 const src=readFileSync('supabase/functions/insight-relations/index.ts','utf8'),start=src.indexOf('async function syncCappedFollowers'),end=src.indexOf('async function syncDirection',start),named=[],unknown=[];
 const old=[{person_key:'left-window',actor_name:'A'},{person_key:'retained',actor_name:'B'}];
 const ctx=evaluate(src.slice(start,end)+'\nthis.syncCappedFollowers=syncCappedFollowers;',{
  active:async()=>old,markRemoved:async()=>{},upsertPeople:async()=>{},
  db:{from:()=>({insert:()=>({select:()=>({single:async()=>({data:{id:7},error:null})})})})},
  eventRows:async(scope,run,direction,type,people)=>named.push(...people.map(p=>({type,...p}))),unknownEvent:async(scope,run,direction,type,count)=>{if(count)unknown.push({type,count})}
 });
 const result=await ctx.syncCappedFollowers('member','followers',{official:1999,people:[{key:'retained',rank:1},{key:'new-person',rank:2}],pages:1,error:'NOTE_IDENTITY_LIST_CAPPED_AT_1000:1999',sources:{}},{expected_count:2000,received_count:2,complete:false,error:'NOTE_IDENTITY_LIST_CAPPED_AT_1000:2000'},'2026-09-22T00:00:00Z');
 assert.equal(result.removed,1);assert.equal(result.unknownRemoved,1);assert.equal(named.length,0);assert.deepEqual(unknown,[{type:'removed',count:1}]);
});
test('全件照合・1000人範囲の候補・人数のみの減少を証拠別に分ける',()=>{
 const src=readFileSync('supabase/functions/insight-social-events/index.ts','utf8'),start=src.indexOf('function evidence('),end=src.indexOf('async function annotate',start),ctx=evaluate(src.slice(start,end)+'\nthis.evidence=evidence;');
 assert.equal(ctx.evidence({person_key:'p'},{complete:true}).identity_exact,true);
 assert.equal(ctx.evidence({person_key:'p'},{complete:false}).evidence,'window_candidate');
 assert.equal(ctx.evidence({person_key:'unknown:7'},{complete:true}).identity_exact,false);
});
test('過去1000人の増減履歴は選択した人物だけを全体順にページ分けする',async()=>{
 const src=readFileSync('supabase/functions/insight-social-events/index.ts','utf8'),part=src.slice(src.indexOf('const EVENT_FIELDS='),src.indexOf('Deno.serve('));
 const rows=Array.from({length:170},(_,i)=>({id:i,member_id:i===169?'other':'owner',person_key:'p'+i,direction:'followers',event_type:i%2?'added':'removed',detected_at:new Date(1700000000000+i*60000).toISOString()}));
 const ctx=evaluate(part+'\nthis.windowEvents=windowEvents;',{
  valid:x=>x||null,searchText:()=>'',annotate:async(scope,rs)=>rs,
  db:{from:()=>{let data=rows;const q={select(){return q},eq(k,v){data=data.filter(r=>r[k]===v);return q},not(){return q},in(k,vs){data=data.filter(r=>vs.includes(r[k]));return q},order(){data=data.slice().sort((a,b)=>b.id-a.id);return q},range:async(a,b)=>({data:data.slice(a,b+1),count:data.length,error:null})};return q}}
 });
 const result=await ctx.windowEvents('owner',{action:'events',direction:'followers'},Array.from({length:170},(_,i)=>'p'+i),20,20);
 assert.equal(result.total,169);assert.deepEqual(Array.from(result.rows,r=>r.id),Array.from({length:20},(_,i)=>148-i));
 const empty=await ctx.windowEvents('owner',{direction:'followers'},[],0,20);assert.equal(empty.total,0);assert.equal(empty.rows.length,0);
});
