import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const endpoints=[
 ['member-extras','socialChanges','pageOf'],
 ['member-history','changes','pg'],
 ['social-v2','changes','pg']
];
const at=n=>new Date(Date.UTC(2026,9,1,0,n)).toISOString();
function harness(endpoint,fn,pager){
 const rows=Array.from({length:40},(_,i)=>({id:i+1,member_id:'owner',direction:'followers',event_type:'removed',change_count:1,detected_at:at(i+1)}));
 rows.push({id:80,member_id:'owner',direction:'followers',event_type:'removed',person_key:'unknown:80',change_count:4,detected_at:at(80)}, {id:50,member_id:'owner',direction:'followers',event_type:'added',change_count:1,detected_at:at(50)}, {id:60,member_id:'owner',direction:'followings',event_type:'removed',change_count:1,detected_at:at(60)}, {id:70,member_id:'foreign',direction:'followers',event_type:'removed',change_count:1,detected_at:at(70)});
 for(let i=0;i<50;i++)rows.push({id:100+i,member_id:'owner',direction:'followers',event_type:'removed',change_count:0,detected_at:at(100+i)});
 const calls=[];
 const db={from(name){assert.equal(name,'insight_relation_events');let data=rows.slice(),orders=[];const q={
  select(){return q},eq(k,v){calls.push(['eq',k,v]);data=data.filter(r=>r[k]===v);return q},gt(k,v){calls.push(['gt',k,v]);data=data.filter(r=>r[k]>v);return q},gte(k,v){data=data.filter(r=>r[k]>=v);return q},lt(k,v){data=data.filter(r=>r[k]<v);return q},order(k,{ascending=true}={}){orders.push([k,ascending]);return q},async range(a,b){data.sort((x,y)=>{for(const[k,asc]of orders){const d=x[k]<y[k]?-1:x[k]>y[k]?1:0;if(d)return asc?d:-d}return 0});return{data:data.slice(a,b+1),count:data.length,error:null}}
 };return q}};
 const source=readFileSync(`supabase/functions/insight-${endpoint}/index.ts`,'utf8'),start=source.indexOf(`async function ${fn}(`),end=source.indexOf('\n',start);
 const page=b=>{const p=Math.max(1,Number(b.page)||1),size=Math.max(20,Math.min(100,Number(b.pageSize)||100));return{page:p,pageSize:size,size,offset:(p-1)*size,from:(p-1)*size,to:p*size-1}};
 const context=vm.createContext({db,[pager]:page,txt:(v,d='')=>typeof v==='string'?v:d,num:(v,d=0)=>Number.isFinite(Number(v))?Number(v):d,validDate:v=>v?new Date(v).toISOString():null,runInfo:async()=>({latest:{expected_count:2000,complete:false,created_at:at(0)},timeline:[]})});
 vm.runInContext(ts.transpileModule(source.slice(start,end)+`\nthis.run=${fn};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
 return{run:b=>context.run({scope:'owner',id:'application'},b),calls,rows};
}
for(const[endpoint,fn,pager]of endpoints){
 test(`${endpoint}: 候補を旧形式の減少やページ総数に混ぜず、通常履歴をページ分けする`,async()=>{
  const h=harness(endpoint,fn,pager),r=await h.run({page:2,pageSize:20,direction:'followers',change:'all'});
  const expected=h.rows.filter(r=>r.member_id==='owner'&&r.direction==='followers'&&r.change_count>0).sort((a,b)=>b.detected_at.localeCompare(a.detected_at));
  assert.equal(r.total,expected.length);assert.deepEqual(Array.from(r.rows,r=>r.id),expected.slice(20,40).map(r=>r.id));assert.ok(r.rows.every(r=>r.change_count>0));assert.ok(h.calls.some(c=>c[0]==='eq'&&c[1]==='member_id'&&c[2]==='owner'));
 });
 test(`${endpoint}: 既存の方向・増減フィルターと人数のみの正の記録を保持する`,async()=>{
  const h=harness(endpoint,fn,pager),r=await h.run({page:1,pageSize:100,direction:'followers',change:'removed'});
  assert.equal(r.total,41);assert.equal(r.rows.find(r=>r.person_key==='unknown:80').change_count,4);assert.equal(r.rows.some(r=>r.id===50||r.id===60||r.id===70||r.change_count===0),false);
 });
}
for(const[endpoint,fn,pager]of endpoints.filter(x=>x[0]!=='member-history'))test(`${endpoint}: 日付境界を保ったままゼロ件候補を除外する`,async()=>{
 const h=harness(endpoint,fn,pager),r=await h.run({page:1,pageSize:100,direction:'followers',change:'removed',dateFrom:at(10),dateTo:at(30)});assert.equal(r.total,20);assert.deepEqual(Array.from(r.rows,r=>r.id),Array.from({length:20},(_,i)=>29-i));
});
