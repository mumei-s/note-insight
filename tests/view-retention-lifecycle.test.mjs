import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture(start=1000000){
 let now=start;
 class Clock extends Date{static now(){return now}}
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync('src/insight-view-lifecycle.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,Date:Clock,URL,AbortController,setTimeout,clearTimeout,fetch:()=>{throw new Error('no network needed')}});
 return{...exports,advance:ms=>{now+=ms},now:()=>now};
}

test('同じpageで確認済みの表示は再確認期限を超えても保持できる',()=>{
 const h=fixture(),checkedAt=h.now();
 assert.equal(h.isFreshInsightView(checkedAt),true);assert.equal(h.canRetainInsightView(checkedAt),true);
 h.advance(60001);
 assert.equal(h.isFreshInsightView(checkedAt),false,'60秒後は最新確認の対象に戻る');
 assert.equal(h.canRetainInsightView(checkedAt),true,'戻り/背景確認で確認済み本文を消す理由にしない');
 h.advance(30*60000);assert.equal(h.canRetainInsightView(checkedAt),true);
});

test('新しいpageの起動前snapshotは保持可能な最新表示と扱わない',()=>{
 const first=fixture(),checkedAt=first.now();
 const reloaded=fixture(checkedAt+1000);
 assert.equal(reloaded.canRetainInsightView(checkedAt),false);assert.equal(reloaded.isFreshInsightView(checkedAt),false);
 assert.equal(reloaded.canRetainInsightView(reloaded.now()),true,'新しいpageでのサーバー確認後だけ保持する');
});

test('未来や不正な確認時刻を保持せず、短い最新確認間隔の意味は維持する',()=>{
 const h=fixture(),checkedAt=h.now();
 for(const invalid of [checkedAt+1,NaN,Infinity,'not-a-time',undefined]){assert.equal(h.canRetainInsightView(invalid),false);assert.equal(h.isFreshInsightView(invalid),false)}
 h.advance(15001);assert.equal(h.isFreshInsightView(checkedAt,15000),false);assert.equal(h.canRetainInsightView(checkedAt),true);
 assert.equal(h.isFreshInsightView(checkedAt,60000),true);
});
