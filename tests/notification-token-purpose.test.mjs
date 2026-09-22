import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createHash,webcrypto} from 'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex');
const token=(purpose,member_id='owner')=>({member_id,purpose,expires_at:'2099-01-01',created_at:'2026-01-01',revoked_at:null});
async function backend(tokens=[],codes=[]){
 let handle;
 const tables={unified_owner_sessions:[{id:'owner',token_hash:hash('fixture'),revoked_at:null,expires_at:'2099-01-01'}],insight_notification_ingest_tokens:tokens,insight_notification_pair_codes:codes,insight_notifications:[]};
 const db={from(name){let filters=[],action='select',payload,max=Infinity;const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},is(k,v){filters.push(r=>r[k]===v);return q},gt(k,v){filters.push(r=>r[k]>v);return q},order(){return q},limit(n){max=n;return q},update(v){action='update';payload=v;return q},delete(){action='delete';return q},insert(v){action='insert';payload=v;return q}};
  const execute=()=>{const rows=tables[name]??[],matches=rows.filter(r=>filters.every(f=>f(r))).slice(0,max);if(action==='insert')rows.push({id:'new',used_at:null,revoked_at:null,...payload});if(action==='update')matches.forEach(r=>Object.assign(r,payload));if(action==='delete')tables[name]=rows.filter(r=>!matches.includes(r));return {data:matches,error:null}};
  q.maybeSingle=async()=>{const r=execute();return {...r,data:r.data[0]??null}};q.then=(a,b)=>Promise.resolve(execute()).then(a,b);return q;
 }};
 const ctx=vm.createContext({Request,Response,TextEncoder,crypto:webcrypto,console:{error(){}},Deno:{env:{get:()=>''},serve:fn=>handle=fn}});
 const code=ts.transpileModule(readFileSync('supabase/functions/insight-notification-import-token/index.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,mod=new vm.SourceTextModule(code,{context:ctx});
 await mod.link(()=>new vm.SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>db)},{context:ctx}));await mod.evaluate();
 return {tables,call:async(body,auth=true)=>{const r=await handle(new Request('https://example.test',{method:'POST',headers:auth?{'X-Owner-Token':'fixture'}:{},body:JSON.stringify({...body,role:'owner'})}));return {status:r.status,body:await r.json()}}};
}
test('本人通知の再連携でDashboard・DM・別アカウントの連携を失効させない',async()=>{
 const rows=[token('note_notification_auto_sync'),token('note_dashboard_sync'),token('note_dm_sync'),token('note_notification_auto_sync','another')],h=await backend(rows),r=await h.call({action:'issue'});
 assert.equal(r.status,200);assert.ok(rows[0].revoked_at);assert.deepEqual(rows.slice(1,4).map(x=>x.revoked_at),[null,null,null]);assert.equal(rows.at(-1).purpose,'note_notification_auto_sync');
});
test('Dashboardだけ連携済みでも本人通知を連携済みと誤判定しない',async()=>{const h=await backend([token('note_dashboard_sync')]),r=await h.call({action:'stats'});assert.equal(r.status,200);assert.equal(r.body.paired,false)});
test('本人通知のコード再発行でDashboardの待機中コードを削除しない',async()=>{
 const h=await backend([],[{id:'dash',member_id:'owner',purpose:'dashboard',used_at:null},{id:'notice',member_id:'owner',purpose:'notification',used_at:null}]);assert.equal((await h.call({action:'pair-start'})).status,200);
 const rows=h.tables.insight_notification_pair_codes;assert.ok(rows.some(r=>r.id==='dash'));assert.equal(rows.some(r=>r.id==='notice'),false);assert.equal(rows.at(-1).purpose,'notification');
});
test('Dashboard用コードを本人通知へ交換せず、認証なしの発行も拒否する',async()=>{
 const h=await backend([],[{id:'dash',member_id:'owner',purpose:'dashboard',code_hash:hash('12345678'),used_at:null,expires_at:'2099-01-01'}]);assert.equal((await h.call({action:'pair-exchange',code:'12345678'},false)).status,401);assert.equal((await h.call({action:'issue'},false)).status,401);assert.equal(h.tables.insight_notification_ingest_tokens.length,0);assert.equal(h.tables.insight_notification_pair_codes[0].used_at,null);
});
