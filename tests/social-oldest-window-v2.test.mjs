import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const source=readFileSync('supabase/functions/insight-social-events/index.ts','utf8');
function harness(rows){
 const ctx=vm.createContext({PERSON_FIELDS:'*',db:{from(name){assert.equal(name,'insight_relations');let data=rows.slice(),orders=[];const q={select(){return q},eq(k,v){data=data.filter(r=>r[k]===v);return q},order(k,{ascending=true}={}){orders.push([k,ascending]);return q},async limit(n){data.sort((a,b)=>{for(const[k,asc]of orders){const av=a[k],bv=b[k];const d=av<bv?-1:av>bv?1:0;if(d)return asc?d:-d}return 0});return{data:data.slice(0,n),error:null}}};return q}}});
 const part=source.slice(source.indexOf('async function windowPeople('),source.indexOf('const EVENT_FIELDS='));
 vm.runInContext(ts.transpileModule(part+'\nthis.read=windowPeople;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,ctx);return ctx.read;
}
test('過去から1000人は最初に保存した人物を残し、現在一覧外の人物を除外しない',async()=>{
 const rows=Array.from({length:1100},(_,i)=>({member_id:'owner',direction:'followers',person_key:`p${String(i).padStart(4,'0')}`,first_seen_at:new Date(Date.UTC(2026,8,1,0,i)).toISOString(),source_rank:1100-i,active:i>=200}));
 rows.push({...rows[0],member_id:'other',person_key:'foreign'},{...rows[0],direction:'followings',person_key:'wrong-direction'});
 const actual=await harness(rows)('owner','followers','oldest');assert.equal(actual.length,1000);assert.equal(actual[0].person_key,'p0000');assert.equal(actual[999].person_key,'p0999');assert.equal(actual[0].active,false);assert.equal(actual.some(r=>r.person_key==='foreign'||r.person_key==='wrong-direction'),false);
});
test('最新1000人は現在の一覧だけをnote上の順番で表示する',async()=>{
 const rows=[{member_id:'owner',direction:'followers',person_key:'old',active:false,source_rank:1,first_seen_at:'2026-08-01'}, {member_id:'owner',direction:'followers',person_key:'last',active:true,source_rank:1000,first_seen_at:'2026-08-01'}, {member_id:'owner',direction:'followers',person_key:'first',active:true,source_rank:1,first_seen_at:'2026-10-01'}];
 const actual=await harness(rows)('owner','followers','latest');assert.deepEqual(Array.from(actual,r=>r.person_key),['first','last']);
});
test('同じ初回保存日時でも人物キーで1000人の境界を固定する',async()=>{
 const rows=Array.from({length:1001},(_,i)=>({member_id:'owner',direction:'followers',person_key:`p${String(1000-i).padStart(4,'0')}`,first_seen_at:'2026-09-01T00:00:00Z',active:false}));
 const actual=await harness(rows)('owner','followers','oldest');assert.equal(actual[0].person_key,'p0000');assert.equal(actual.at(-1).person_key,'p0999');
});
function rowEvidence(row,run){const ctx=vm.createContext({});const part=source.slice(source.indexOf('function evidence('),source.indexOf('async function annotate('));vm.runInContext(ts.transpileModule(part+'\nthis.read=evidence;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,ctx);return ctx.read(row,run)}
test('関係確認の減少は同期runがなくても確認済みの証拠を保持する',()=>{
 const r=rowEvidence({person_key:'p',evidence:'authenticated_relationship',identity_exact:true},null);assert.equal(r.identity_exact,true);assert.equal(r.evidence,'authenticated_relationship');assert.equal(r.comparison_complete,false);
});
test('過去の一覧消失候補を全件照合の確定人物へ昇格させない',()=>{
 const r=rowEvidence({person_key:'p',evidence:'window_candidate',identity_exact:false},{complete:true});assert.equal(r.identity_exact,false);assert.equal(r.evidence,'window_candidate');
});
test('人物不明の総数変化は供給されたフラグにかかわらず人物確定しない',()=>{
 const r=rowEvidence({person_key:'unknown:7',evidence:'authenticated_relationship',identity_exact:true},{complete:true});assert.equal(r.identity_exact,false);assert.equal(r.evidence,'count_only');
});
test('ページ間で同時刻の仮想履歴IDの順番をサーバーと同じ文字列順に保つ',async()=>{
 const part=source.slice(source.indexOf('const EVENT_FIELDS='),source.indexOf('function comparisonRows('));
 const rows=[{id:'archive:9',person_key:'p1',member_id:'owner',direction:'followers',event_type:'removed',detected_at:'2026-10-28T00:00:00Z'}, {id:'event:2',person_key:'p2',member_id:'owner',direction:'followers',event_type:'removed',detected_at:'2026-10-28T00:00:00Z'}, {id:'archive:10',person_key:'p3',member_id:'owner',direction:'followers',event_type:'removed',detected_at:'2026-10-28T00:00:00Z'}];
 const ctx=vm.createContext({valid:()=>null,searchText:()=>'',annotate:async(_s,rs)=>rs,db:{from(table){assert.equal(table,'insight_relation_history_rows');const q={select(){return q},eq(){return q},not(){return q},in(){return q},order(){return q},range:async()=>({data:rows,count:rows.length,error:null})};return q}}});
 vm.runInContext(ts.transpileModule(part+'\nthis.read=windowEvents;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,ctx);
 const actual=await ctx.read('owner',{action:'events',direction:'followers',change:'removed'},['p1','p2','p3'],0,20);assert.deepEqual(Array.from(actual.rows,r=>r.id),['event:2','archive:9','archive:10']);
});
