import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const storeSource=fs.readFileSync(new URL('../src/insight-account-store.ts',import.meta.url),'utf8');
const mainSource=fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');

function loadStore(seed={}){
  const values=new Map(Object.entries(seed));
  const localStorage={
    getItem:key=>values.has(key)?String(values.get(key)):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
  };
  const window={dispatchEvent(){}};
  const Event=function Event(type){this.type=type};
  const source=storeSource.replace(/\bexport\s+/g,'')+'\nglobalThis.testAPI={readStoredInsightAccounts,currentStoredInsightAccount,restoreStoredMemberSession,mergeStoredAccount};';
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const context={localStorage,window,Event,Map,Set,JSON,Math,Date,String,Number,Array,Object,globalThis:null};
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(js,context);
  return {api:context.testAPI,values};
}

test('v3 profile metadata merges legacy v2 auth secrets instead of hiding them',()=>{
  const v3=[{noteId:'ss_yr',displayName:'new name',imageUrl:'new.jpg',status:'logged-out',updatedAt:200}];
  const v2=[{noteId:'ss_yr',displayName:'old name',imageUrl:'old.jpg',status:'active',memberToken:'legacy-member',applicantToken:'legacy-applicant',passcode:'legacy-pass',updatedAt:100}];
  const {api,values}=loadStore({
    'mumei-insight-saved-accounts-v3':JSON.stringify(v3),
    'mumei-insight-saved-accounts-v2':JSON.stringify(v2),
  });
  const [account]=api.readStoredInsightAccounts();
  assert.equal(account.noteId,'ss_yr');
  assert.equal(account.displayName,'new name');
  assert.equal(account.imageUrl,'new.jpg');
  assert.equal(account.memberToken,'legacy-member');
  assert.equal(account.applicantToken,'legacy-applicant');
  assert.equal(account.passcode,'legacy-pass');
  const repaired=JSON.parse(values.get('mumei-insight-saved-accounts-v3'));
  assert.equal(repaired[0].applicantToken,'legacy-applicant');
  assert.equal(repaired[0].memberToken,'legacy-member');
});

test('explicit logout keeps identity recovery data but never resurrects legacy member token',()=>{
  const v3=[{noteId:'ss_yr',displayName:'S',status:'logged-out',updatedAt:200}];
  const v2=[{noteId:'ss_yr',status:'active',memberToken:'legacy-member',applicantToken:'legacy-applicant',updatedAt:100}];
  const {api}=loadStore({
    'mumei-insight-saved-accounts-v3':JSON.stringify(v3),
    'mumei-insight-saved-accounts-v2':JSON.stringify(v2),
    'mumei-insight-explicit-logout:ss_yr':'1',
  });
  const [account]=api.readStoredInsightAccounts();
  assert.equal(account.memberToken,undefined);
  assert.equal(account.applicantToken,'legacy-applicant');
  assert.equal(api.restoreStoredMemberSession(),null);
});

test('startup recovery validates a current token and then iterates every saved identity',()=>{
  assert.match(mainSource,/async function validateCurrentMemberToken\(\)/);
  assert.match(mainSource,/if \(window\.location\.hash\.includes\("access\/insight"\)\) window\.location\.hash = "dashboard"/);
  assert.match(mainSource,/function resumeCandidates\(\)/);
  assert.match(mainSource,/for \(const account of readStoredInsightAccounts\(\)\) add\(account\)/);
  assert.match(mainSource,/for \(const account of resumeCandidates\(\)\)/);
  assert.match(mainSource,/One stale\/inactive saved account must never block another active saved account/);
  assert.match(mainSource,/continue;/);
  assert.match(mainSource,/EXPLICIT_LOGOUT_KEY_PREFIX \+ account\.noteId/);
});
