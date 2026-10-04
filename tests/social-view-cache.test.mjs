import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const source=readFileSync('src/member-insight-social-v2.tsx','utf8'),part=source.slice(source.indexOf('const SOCIAL_CACHE='),source.indexOf('const n='));
const query={action:'comparison',window:'oldest',relationship:'following_only',query:'',page:1,pageSize:50};
function fixture(storage=new Map(),post=async()=>({noteId:'a',rows:[{person_key:'saved'}]})){
 const accounts=[{noteId:'a',memberToken:'secret-a'},{noteId:'b',memberToken:'secret-b'}];if(!storage.has('token'))storage.set('token','secret-a');
 const context=vm.createContext({localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},INSIGHT_TOKEN_KEY:'token',readStoredInsightAccounts:()=>accounts,post});
 vm.runInContext(ts.transpileModule(part+'\nthis.api={cachedSocial,savedSocial};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);return{api:context.api,storage};
}
test('INSIGHTを閉じてコードを作り直しても本人の保存済み照合を即復元し、他人に流用しない',async()=>{
 const a=fixture();await a.api.savedSocial(query);assert.equal(a.api.cachedSocial(query).rows[0].person_key,'saved');
 const reopened=fixture(a.storage);assert.equal(reopened.api.cachedSocial(query).rows[0].person_key,'saved');
 const persisted=a.storage.get('mumei-social-view-cache-v1:a');assert.doesNotMatch(persisted,/secret-a/);
 a.storage.set('token','secret-b');assert.equal(reopened.api.cachedSocial(query),null);a.storage.delete('token');assert.equal(reopened.api.cachedSocial(query),null);
});
test('同時に要求された同じ表示は通信を一つにし、前の本人の遅延応答はキャッシュに入れない',async()=>{
 let finish,calls=0;const a=fixture(new Map(),()=>{calls++;return new Promise(r=>finish=r)});
 const first=a.api.savedSocial(query),second=a.api.savedSocial(query);assert.equal(calls,1);a.storage.set('token','secret-b');finish({noteId:'a',rows:[{person_key:'private-a'}]});await Promise.all([first,second]);
 assert.equal(a.api.cachedSocial(query),null);assert.equal(a.storage.has('mumei-social-view-cache-v1:b'),false);assert.equal(a.storage.has('mumei-social-view-cache-v1:a'),false);
});
