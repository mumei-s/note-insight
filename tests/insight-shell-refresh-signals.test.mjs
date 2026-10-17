import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=ts.createSourceFile('member-insight-live-v2.tsx',readFileSync('src/member-insight-live-v2.tsx','utf8'),ts.ScriptTarget.ES2022,true,ts.ScriptKind.TSX);
const shell=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='MemberInsightLiveV2');
assert.ok(shell?.body,'実際のシェル関数を取得できる');

function fixture(name){
 const declaration=shell.body.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
 assert.ok(declaration,`${name}を実際のシェルから抽出できる`);
 let now=1_000_000,revision=0,officialReads=0,relationReads=0;
 const storage=new Map(),statuses=[],busy=[],calls=[];
 class Clock extends Date{static now(){return now}}
 const ref=current=>({current});
 const context=vm.createContext({Date:Clock,AbortController,
  MEMBER:'member-api',RELATIONS:'relations',AUTO_MS:900_000,RELATION_MS:1_800_000,QUIET_MS:5000,PUBLIC_SYNC_TIMEOUT:60_000,
  document:{visibilityState:'visible'},localStorage:{setItem:(key,value)=>storage.set(key,value)},autoSyncKey:'auto:creator',relationSyncKey:'relations:creator',
  running:ref(false),manualRefreshRunning:ref(false),relationRunning:ref(false),lastSavedCheck:ref(now-1000),lastRun:ref(0),lastRelationRun:ref(0),lastInteraction:ref(0),autoSyncEnabledRef:ref(true),publicSyncRun:ref(0),publicSyncController:ref(null),
  setRevision:change=>{revision=change(revision)},setStatus:value=>statuses.push(value),setDataBusy:value=>busy.push(value),fmt:String,timeNow:()=> '12:00',
  post:async(...args)=>{calls.push(args);return{catalog:{stored:1}}},loadOfficial:async()=>{officialReads++;return true},relationSync:async()=>{relationReads++;return true},
 });
 vm.runInContext(ts.transpileModule(declaration.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
 return{context,run:(...args)=>context[name](...args),advance:ms=>{now+=ms},now:()=>now,revision:()=>revision,officialReads:()=>officialReads,relationReads:()=>relationReads,storage,statuses,busy,calls};
}

test('明示publicSyncの保存成功だけがrevisionと復帰確認時刻を更新し、失敗・旧runは更新しない',async()=>{
 const success=fixture('publicSync'),started=success.now();
 success.context.post=async()=>{success.advance(250);return{scannedArticles:1,catalog:{stored:1}}};
 assert.equal(await success.run(true),true);assert.equal(success.revision(),1);assert.equal(success.context.lastSavedCheck.current,started+250);assert.equal(success.storage.get('auto:creator'),String(started));assert.equal(success.officialReads(),1);assert.equal(success.relationReads(),1);assert.equal(success.context.running.current,false);
 for(const outcome of ['failed','superseded']){
  const h=fixture('publicSync'),before=h.context.lastSavedCheck.current;
  h.context.post=async()=>{h.advance(250);if(outcome==='failed')throw new Error('SAVE_FAILED');h.context.publicSyncRun.current++;return{catalog:{stored:1}}};
  assert.equal(await h.run(true),false);assert.equal(h.revision(),0);assert.equal(h.context.lastSavedCheck.current,before);assert.equal(h.storage.has('auto:creator'),false);assert.equal(h.officialReads(),0);assert.equal(h.relationReads(),0);
 }
});

test('relationSyncは一方の保存成功もrevisionへ反映し、両方向失敗を新鮮な保存確認にしない',async()=>{
 for(const succeeds of [true,false]){
  const h=fixture('relationSync'),started=h.now(),before=h.context.lastSavedCheck.current,directions=[];
  h.context.post=async(_endpoint,_action,{direction})=>{directions.push(direction);h.advance(10);if(succeeds&&direction==='followers')return{ok:true};throw new Error('RELATION_SAVE_FAILED')};
  assert.equal(await h.run(true),succeeds);assert.deepEqual(directions,['followers','followings']);assert.equal(h.revision(),Number(succeeds));assert.equal(h.context.lastSavedCheck.current,succeeds?started+20:before);assert.equal(h.storage.get('relations:creator'),succeeds?String(started):undefined);assert.equal(h.context.relationRunning.current,false);
 }
});

test('明示refreshSavedDataは60秒以内でも各sceneへrevisionを送り、実行中の重複要求は送らない',async()=>{
 const h=fixture('refreshSavedData'),before=h.context.lastSavedCheck.current;let finish;
 h.context.loadOfficial=()=>new Promise(resolve=>{finish=resolve});
 assert.ok(h.now()-before<60_000);
 const pending=h.run(true);assert.equal(h.revision(),1);assert.equal(h.context.lastSavedCheck.current,h.now());assert.equal(h.context.manualRefreshRunning.current,true);assert.deepEqual(h.busy,[true]);
 await h.run(true);assert.equal(h.revision(),1);assert.deepEqual(h.busy,[true]);
 finish(true);await pending;assert.equal(h.context.manualRefreshRunning.current,false);assert.deepEqual(h.busy,[true,false]);assert.match(h.statuses.at(-1),/TOPの最新データを反映/);
});
