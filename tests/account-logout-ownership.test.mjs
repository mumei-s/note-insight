import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const account=(noteId,memberToken)=>({noteId,memberToken,applicantToken:'applicant-'+noteId,passcode:'pass-'+noteId,status:'active',updatedAt:1});
function fixture(current='token-a',{v3=[account('a','token-a'),account('b','token-b')],v2=[]}={}){
  const values=new Map([['mumei-insight-access-token',current],['mumei-insight-active-account-v3','a'],['mumei-insight-saved-accounts-v3',JSON.stringify(v3)],['mumei-insight-saved-accounts-v2',JSON.stringify(v2)],['mumei-insight-explicit-logout:a','1']]);
  const localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
  const context=vm.createContext({exports:{},localStorage,sessionStorage:localStorage,window:{dispatchEvent(){}},Event,Date});
  vm.runInContext(ts.transpileModule(readFileSync('src/insight-account-store.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
  return{api:context.exports,values};
}

test('flag設定後の本人logoutでも対象global tokenを消し、別本人と復帰情報を保持する',()=>{
  const h=fixture();h.api.forgetMemberSession('a');assert.equal(h.values.has('mumei-insight-access-token'),false);
  const a=h.api.getStoredInsightAccount('a'),b=h.api.getStoredInsightAccount('b');
  assert.equal(a.memberToken,undefined);assert.equal(a.status,'logged-out');assert.equal(a.applicantToken,'applicant-a');assert.equal(a.passcode,'pass-a');assert.equal(b.memberToken,'token-b');assert.equal(h.api.restoreStoredMemberSession().noteId,'b');
});

test('対象以外の本人に属するcurrent tokenはactiveIdが古くても削除しない',()=>{
  const h=fixture('token-b');h.api.forgetMemberSession('a');assert.equal(h.values.get('mumei-insight-access-token'),'token-b');assert.equal(h.api.getStoredInsightAccount('b').memberToken,'token-b');
});

test('現行profileがtokenを持たず旧storeにだけ残る本人tokenもlogoutで消す',()=>{
  const h=fixture('legacy-a',{v3:[{...account('a',undefined),status:'logged-out',updatedAt:2},account('b','token-b')],v2:[account('a','legacy-a')]});
  h.api.forgetMemberSession('a');assert.equal(h.values.has('mumei-insight-access-token'),false);assert.equal(h.api.getStoredInsightAccount('a').memberToken,undefined);assert.equal(h.values.get('mumei-insight-explicit-logout:a'),'1');assert.equal(h.api.getStoredInsightAccount('b').memberToken,'token-b');
});
