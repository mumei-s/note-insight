import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const source=readFileSync('src/member-insight-social-v2.tsx','utf8'),part=source.slice(source.indexOf('const SOCIAL_CACHE='),source.indexOf('const n='));
const query={action:'comparison',window:'oldest',relationship:'following_only',query:'',page:1,pageSize:50};
function fixture(storage=new Map(),post=async()=>({noteId:'a',total:1,rows:[{person_key:'saved'}]}),pageStartedAt=0,clock=Date){
 const accounts=[{noteId:'a',memberToken:'secret-a'},{noteId:'b',memberToken:'secret-b'}];if(!storage.has('token'))storage.set('token','secret-a');
 const context=vm.createContext({exports:{},Date:clock,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},INSIGHT_TOKEN_KEY:'token',readStoredInsightAccounts:()=>accounts,post,canRetainInsightView:at=>Number(at)>=pageStartedAt&&Number(at)<=clock.now()});
 vm.runInContext(ts.transpileModule(readFileSync('src/insight-saved-view.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);Object.assign(context,{readSavedInsightView:context.exports.readSavedInsightView,writeSavedInsightView:context.exports.writeSavedInsightView});
 vm.runInContext(ts.transpileModule(part+'\nthis.api={cachedSocial,savedSocial};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);return{api:context.api,storage};
}
test('別起動の照合は保存表示として復元し、最新確認済みや他人の表示に流用しない',async()=>{
 const a=fixture();await a.api.savedSocial(query);assert.equal(a.api.cachedSocial(query).rows[0].person_key,'saved');
 const reopened=fixture(a.storage);assert.equal(reopened.api.cachedSocial(query),null);assert.equal(reopened.api.cachedSocial(query,true).rows[0].person_key,'saved');
 const nextPage=fixture(a.storage,undefined,Date.now()+1);assert.equal(nextPage.api.cachedSocial(query),null);assert.equal(nextPage.api.cachedSocial(query,true).rows[0].person_key,'saved');
 const persisted=[...a.storage].filter(([key])=>key.startsWith('mumei-insight-data-cache-v1:saved:'));assert.equal(persisted.length,1);assert.doesNotMatch(JSON.stringify(persisted),/secret-a/);
 a.storage.set('token','secret-b');assert.equal(reopened.api.cachedSocial(query),null);a.storage.delete('token');assert.equal(reopened.api.cachedSocial(query),null);
});
test('同時に要求された同じ表示は通信を一つにし、前の本人の遅延応答はキャッシュに入れない',async()=>{
 let finish,calls=0;const a=fixture(new Map(),()=>{calls++;return new Promise(r=>finish=r)});
 const first=a.api.savedSocial(query),second=a.api.savedSocial(query);assert.equal(calls,1);a.storage.set('token','secret-b');finish({noteId:'a',total:1,rows:[{person_key:'private-a'}]});await Promise.all([first,second]);
 assert.equal(a.api.cachedSocial(query),null);assert.equal(a.storage.has('mumei-social-view-cache-v1:b'),false);assert.equal(a.storage.has('mumei-social-view-cache-v1:a'),false);
});


test('同じdocumentで確認済みの条件は時間経過だけで再読取せずrevisionと最新確認だけ失効する',async()=>{
 let now=Date.now(),calls=0;class Clock extends Date{static now(){return now}}
 const a=fixture(new Map(),async()=>({noteId:'a',total:1,rows:[{person_key:'read-'+(++calls)}]}),0,Clock);
 await a.api.savedSocial(query);now+=86400000;await a.api.savedSocial(query);assert.equal(calls,1);
 await a.api.savedSocial(query,1);assert.equal(calls,2);await a.api.savedSocial(query,1,true);assert.equal(calls,3);
});

test('最新確認の失敗を確認済みcacheへ戻さず次の確認で再試行する',async()=>{
 let calls=0;const a=fixture(new Map(),async()=>{if(++calls===2)throw Error('offline');return{noteId:'a',total:1,rows:[{person_key:'read-'+calls}]}});
 await a.api.savedSocial(query);await assert.rejects(a.api.savedSocial(query,0,true),/offline/);
 assert.equal(a.api.cachedSocial(query),null);assert.equal(a.api.cachedSocial(query,true).rows[0].person_key,'read-1');assert.ok(a.api.cachedSocial(query,true).__savedViewAt>0);
 await a.api.savedSocial(query);assert.equal(calls,3);assert.equal(a.api.cachedSocial(query).rows[0].person_key,'read-3');
});

test('前revisionの遅い応答で新revisionの確認済みcacheを上書きしない',async()=>{
 const pending=[];const a=fixture(new Map(),()=>new Promise(resolve=>pending.push(resolve)));
 const old=a.api.savedSocial(query,0),current=a.api.savedSocial(query,1);
 pending[1]({noteId:'a',total:1,rows:[{person_key:'current'}]});await current;
 pending[0]({noteId:'a',total:1,rows:[{person_key:'old'}]});await old;
 assert.equal(a.api.cachedSocial(query,false,1).rows[0].person_key,'current');
});

test('照合のdocument内cacheは12条件に限定する',async()=>{
 const a=fixture(new Map(),async extra=>({noteId:'a',total:(extra.page-1)*50+1,rows:[{person_key:'page-'+extra.page}]}));
 for(let page=1;page<=13;page++)await a.api.savedSocial({...query,page});
 assert.equal(a.api.cachedSocial(query),null);assert.equal(a.api.cachedSocial({...query,page:2}).rows[0].person_key,'page-2');
});


test('途中までしか届かなかったページを確認済みcacheにしない',async()=>{
 let calls=0;const a=fixture(new Map(),async()=>({noteId:'a',total:100,rows:[{person_key:'partial-'+(++calls)}]}));
 await a.api.savedSocial(query);assert.equal(a.api.cachedSocial(query),null);await a.api.savedSocial(query);assert.equal(calls,2);
});


test('最新確認で内容が変わった時だけ他ページも失効させ、古い並行応答で復活させない',async()=>{
 let version='a',calls=0,late;const a=fixture(new Map(),async extra=>{calls++;if(extra.query==='pending')return new Promise(resolve=>late=resolve);return{noteId:'a',total:51,rows:Array.from({length:extra.page===2?1:50},(_,i)=>({person_key:version+'-'+extra.page+'-'+i}))}});
 await a.api.savedSocial(query);await a.api.savedSocial({...query,page:2});await a.api.savedSocial({...query,page:2},0,true);
 const before=calls;await a.api.savedSocial(query);assert.equal(calls,before,'同じ応答だけでは他ページを再取得しない');
 const old=a.api.savedSocial({...query,query:'pending'});version='b';await a.api.savedSocial({...query,page:2},0,true);
 assert.equal(a.api.cachedSocial(query),null);assert.equal(a.api.cachedSocial(query,true).rows[0].person_key,'a-1-0');
 late({noteId:'a',total:1,rows:[{person_key:'old-pending'}]});await old;assert.equal(a.api.cachedSocial({...query,query:'pending'}),null);
 await a.api.savedSocial(query);assert.equal(a.api.cachedSocial(query).rows[0].person_key,'b-1-0');
});
