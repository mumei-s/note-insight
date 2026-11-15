import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {isFreshInsightView,canRetainInsightView} from '../src/insight-view-lifecycle.ts';

const source=readFileSync('src/member-insight-comments-final.tsx','utf8');

test('同一セッション内の古いコメントキャッシュは表示用に保持しつつ最新確認では失効させる',()=>{
 const old=Date.now()-5*60_000;
 assert.equal(canRetainInsightView(old),true);
 assert.equal(isFreshInsightView(old,60_000),false);
 assert.equal(isFreshInsightView(Date.now()-1000,60_000),true);
 assert.match(source,/cached\.revision===revision&&!cached\.invalidated&&isFreshInsightView\(cached\.at,60_000\)/);
 assert.match(source,/saved\.revision===revision&&isFreshInsightView\(saved\.at,120_000\)/);
});
test('他のタブから戻ったときは古い履歴だけ再検証し、連続focusや別アカウントでは再取得しない',()=>{
 const start=source.indexOf('const onReturn=()=>{'),end=source.indexOf('\n  };',start);
 assert.ok(start>0&&end>start,'production focus handler exists');
 let calls=0;
 const cached=new Map([['own',{at:Date.now()-180_000}]]);
 const state={current:0};
 let currentToken='tok',visibilityState='visible';
 const ctx=vm.createContext({
  Date,document:{get visibilityState(){return visibilityState}},
  localStorage:{getItem:()=>currentToken},INSIGHT_TOKEN_KEY:'token',
  token:'tok',cacheKey:'own',focusRecheckAt:state,
  COMMENT_CACHE:cached,isFreshInsightView,
  reloadSaved:{current:()=>{calls++}}
 });
 vm.runInContext(source.slice(start,end+5)+'\nthis.onReturn=onReturn;',ctx);
 ctx.onReturn();
 assert.equal(calls,1,'stale view is refreshed');
 ctx.onReturn();
 assert.equal(calls,1,'rapid consecutive focus requests do not refetch');
 state.current=Date.now()-70_000;
 cached.set('own',{at:Date.now()-20_000});
 ctx.onReturn();
 assert.equal(calls,1,'fresh cached view is reused');
 cached.set('own',{at:Date.now()-130_000});
 currentToken='another-member';ctx.onReturn();
 assert.equal(calls,1,'other account cannot trigger request');
 currentToken='tok';visibilityState='hidden';ctx.onReturn();
 assert.equal(calls,1,'hidden document does not trigger request');
});
