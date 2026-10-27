import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const source=readFileSync('supabase/functions/insight-relations/index.ts','utf8');
function harness(initial){
 let activeRows=initial.map(r=>({...r})),runId=0,reads=0;const events=[],runs=[];
 const ctx=vm.createContext({
  active:async()=>{reads++;return activeRows.filter(r=>r.active!==false).map(r=>({...r}))},
  markRemoved:async(_s,_d,keys)=>{for(const r of activeRows)if(keys.includes(r.person_key))r.active=false},
  upsertPeople:async(_s,_d,people)=>{for(const p of people){let r=activeRows.find(r=>r.person_key===p.key);if(!r)activeRows.push(r={person_key:p.key});Object.assign(r,{actor_name:p.name,active:true,source_rank:p.rank})}},
  db:{from(table){
   return{insert(value){
    if(table==='insight_relation_events'){events.push(...(Array.isArray(value)?value:[value]));return{error:null}}
    assert.equal(table,'insight_relation_sync_runs');runs.push(value);
    return{select(){return{single:async()=>({data:{id:++runId},error:null})}}};
   }};
  }}
 });
 const part=source.slice(source.indexOf('async function eventRows('),source.indexOf('async function syncDirection('));
 vm.runInContext(ts.transpileModule(part+'\nthis.sync=syncCappedFollowers;this.events=eventRows;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,ctx);
 return{sync:ctx.sync,write:ctx.events,events,runs,get reads(){return reads}};
}
const previous=count=>({expected_count:count,received_count:2,complete:false,error:`NOTE_IDENTITY_LIST_CAPPED_AT_1000:${count}`});
const feed=(count,keys)=>({official:count,people:keys.map((key,i)=>({key,name:key,rank:i+1})),pages:1,error:`NOTE_IDENTITY_LIST_CAPPED_AT_1000:${count}`,sources:{v3:keys.length}});
const old=()=>['old','retained'].map((key,i)=>({person_key:key,actor_name:key,source_rank:i+1,active:true}));
test('窓外の人物は増減数0の観測として残し、公式減少人数に割り当てない',async()=>{
 const h=harness(old()),r=await h.sync('owner','followers',feed(1999,['retained','new']),previous(2000),'2026-10-28T00:00:00Z');
 assert.equal(r.removed,1);assert.equal(r.unknownRemoved,1);assert.equal(r.windowMissing,1);assert.equal(h.reads,1);
 const candidate=h.events.find(e=>e.person_key==='old');assert.equal(candidate.change_count,0);assert.equal(candidate.actor_name,'old');assert.equal(h.events.find(e=>e.person_key.startsWith('unknown:')).change_count,1);assert.equal(h.runs[0].removed_count,1);
});
test('公式総数が増加したときも窓外の人物の観測を保存する',async()=>{
 const h=harness(old()),r=await h.sync('owner','followers',feed(2002,['retained','new1','new2']),previous(2000),'2026-10-28T00:00:00Z');
 assert.equal(r.added,2);assert.equal(r.removed,0);assert.equal(r.windowMissing,1);assert.equal(h.runs[0].removed_count,0);assert.equal(h.events.find(e=>e.person_key==='old').change_count,0);assert.equal(h.events.filter(e=>e.event_type==='added').length,2);
});
test('同じ取得範囲を繰り返しても窓外の観測を重複保存しない',async()=>{
 const h=harness(old());await h.sync('owner','followers',feed(2000,['retained','new']),previous(2000),'2026-10-28T00:00:00Z');
 const before=h.events.length,r=await h.sync('owner','followers',feed(2000,['retained','new']),previous(2000),'2026-10-28T01:00:00Z');
 assert.equal(r.windowMissing,0);assert.equal(h.events.length,before);assert.equal(h.reads,2);
});
test('初回や旧方式からの切替は過去の消失観測を捏造しない',async()=>{
 for(const p of [null,{...previous(2000),complete:true},{...previous(2000),error:'legacy'}]){const h=harness(old()),r=await h.sync('owner','followers',feed(1999,['retained','new']),p,'2026-10-28T00:00:00Z');assert.equal(r.baseline,true);assert.equal(r.windowMissing,0);assert.equal(h.events.length,0);assert.equal(h.runs[0].removed_count,0)}
});
test('人物が一覧へ戻っても保存した窓外観測は残る',async()=>{
 const h=harness(old());await h.sync('owner','followers',feed(2000,['retained','new']),previous(2000),'2026-10-28T00:00:00Z');await h.sync('owner','followers',feed(2000,['retained','old']),previous(2000),'2026-10-28T01:00:00Z');
 assert.equal(h.events.filter(e=>e.person_key==='old'&&e.event_type==='removed').length,1);assert.equal(h.events.find(e=>e.person_key==='old').change_count,0);
});
test('空の人物差分は書き込まず、従来の確定イベントは人数1を維持する',async()=>{
 const h=harness([]);await h.write('owner',1,'followers','removed',[],'2026-10-28T00:00:00Z',0);assert.equal(h.events.length,0);await h.write('owner',1,'followers','removed',[{key:'real',name:'real'}],'2026-10-28T00:00:00Z');assert.equal(h.events[0].change_count,1);
});
