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
