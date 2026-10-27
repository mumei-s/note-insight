import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';

const source=readFileSync('supabase/functions/insight-social-events/index.ts','utf8');
const part=source.slice(source.indexOf('function currentRelationship('),source.indexOf('async function windowPeople('));
function fixture(current,{currentError=null}={}){
 const calls=[];
 const db={from(table){const call={table,filters:[],single:false};calls.push(call);
  const result=()=>({data:table==='insight_social_current_people'?current:[],count:0,error:table==='insight_social_current_people'?currentError:null});
  const q={select(){return q},eq(field,value){call.filters.push([field,value]);return q},order(){return q},range(){return Promise.resolve(result())},maybeSingle(){call.single=true;return Promise.resolve(result())},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}};return q;
 }};
 const context=vm.createContext({db,PERSON_FIELDS:'person_key,direction',HISTORY_FIELDS:'id,person_key',annotate:async(_,rows)=>rows,investigateUnknown:async()=>({unknown:true})});
 vm.runInContext(ts.transpileModule(part+'\nthis.read=investigate;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
 return{read:context.read,calls};
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('人物履歴がない場合も、調査時の最新関係を本人と人物の1件に限定して返す',async()=>{
 const h=fixture({person_key:'person',relation:'mutual',is_following:true,is_follower:true,checked_at:'2026-10-28T01:00:00Z',following_verified_at:'2026-10-27T20:00:00Z',follower_verified_at:'2026-10-28T01:00:00Z',evidence:'mixed'});
 const value=await h.read('member-a','person',2);
 assert.equal(value.currentRelationship.current_relation,'mutual');
 assert.equal(value.currentRelationship.current_is_follower,true);
 assert.equal(value.currentRelationship.current_following_verified_at,'2026-10-27T20:00:00Z');
 assert.equal(value.currentRelationship.current_follower_verified_at,'2026-10-28T01:00:00Z');
 assert.deepEqual(plain(value.events),[]);assert.deepEqual(plain(value.relationshipHistory),[]);
 assert.equal(value.inspectionPage,2);
 assert.equal(h.calls.length,4,'one current-person lookup accompanies the three existing scoped detail reads');
 for(const call of h.calls)assert.deepEqual(call.filters,[['member_id','member-a'],['person_key','person']]);
 const current=h.calls.filter(c=>c.table==='insight_social_current_people');assert.equal(current.length,1);assert.equal(current[0].single,true);
});
test('最新が不明なら古い肯定を補完せず、falseと方向ごとの欠落をそのまま返す',async()=>{
 const h=fixture({relation:'unknown',is_following:false,is_follower:null,following_verified_at:'2026-10-28T01:00:00Z',follower_verified_at:null});
 const value=await h.read('member-b','person');
 assert.equal(value.currentRelationship.current_is_following,false);
 assert.equal(value.currentRelationship.current_is_follower,null);
 assert.equal(value.currentRelationship.current_follower_verified_at,null);
 const missing=await fixture(null).read('member-b','missing');
 assert.deepEqual(plain(missing.currentRelationship),{person_key:'missing',current_relation:'unknown',current_is_following:null,current_is_follower:null,current_verified_at:null,current_following_verified_at:null,current_follower_verified_at:null,current_evidence:null});
});
test('最新関係の取得失敗は古い行で隠さず、不明の人数調査には個人照合を追加しない',async()=>{
 const error=new Error('current relationship unavailable');
 await assert.rejects(fixture(null,{currentError:error}).read('member-a','person'),/current relationship unavailable/);
 const h=fixture(null);assert.deepEqual(plain(await h.read('member-a','unknown:run:followers:removed')),{unknown:true});assert.equal(h.calls.length,0);
});
