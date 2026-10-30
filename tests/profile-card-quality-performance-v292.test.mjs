import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {qualityRefreshHelpers} from '../scripts/profile-card-quality-refresh.mjs';
import {runtime as compiledRuntime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';

const currentCode=readFileSync('public/note-profile-card-paster-quality-v290.js','utf8');
let previousCode;
try{previousCode=execFileSync('git',['show','260d7c3:public/note-profile-card-paster-quality-v290.js'],{encoding:'utf8',stdio:['ignore','pipe','ignore']})}catch{}
const clone=value=>JSON.parse(JSON.stringify(value));
function runtime(code=currentCode){
 const local=new Map(),calls={urls:0,writes:0,draws:0,measures:0};
 class ObservedURL extends URL{constructor(...args){calls.urls++;super(...args)}}
 class Clock extends Date{static now(){return 1000}}
 const page={location:new URL('https://editor.note.com/notes/naaaaaaaaaaaa/edit'),addEventListener(){}};
 const context=vm.createContext({unsafeWindow:page,window:page,location:page.location,URL:ObservedURL,Date:Clock,document:{querySelector(){return null}},localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>{calls.writes++;local.set(key,value)},removeItem:key=>local.delete(key)}});
 vm.runInContext(code,context);
 const q=page.__MUMEI_PROFILE_CARD_QUALITY__;
 const canvas=()=>({fillText(){calls.draws++;return 17},measureText(){calls.measures++;return{width:20,actualBoundingBoxLeft:0,actualBoundingBoxRight:20,actualBoundingBoxAscent:5,actualBoundingBoxDescent:2}}});
 return{q,calls,canvas,local,context,page};
}
function acquire(q,index=0,extra={}){
 const id='speed_person_'+index,key='n'+(index+1).toString(16).padStart(12,'0'),url='https://note.com/'+id+'/n/'+key;
 const raw={key,noteUrl:url,user:{urlname:id,nickname:'以前の名前'},name:'記事',eyecatch:{url:'https://assets.st-note.com/thumb.png'}};
 const row={index:index+1,urlname:id,key,url,creator:'作者🌸'+index,actorImageUrl:'https://assets.st-note.com/icon.png',thumbUrl:'https://assets.st-note.com/thumb.png',profileText:'原文のプロフィールです。AIも美容も書きます。\n'.repeat(12),...extra};
 const selected=q.rawRow(row,raw,{urlname:id});
 return q.acquired(selected,{target:id,note:raw,profile:{urlname:id,nickname:row.creator},selected});
}
function workload(code,count=100){
 const r=runtime(code),start=performance.now();r.q.beginBatch({});
 for(let i=0;i<count;i++){
  const row=acquire(r.q,i),file={},ctx=r.canvas();
  assert.equal(r.q.preflight(row),null);
  r.q.observeContext(ctx,row,860,140);
  for(const value of ['note','記事',row.creator+'さん','装飾'])assert.equal(ctx.fillText(value,100,50),17);
  r.q.generated(row,file);assert.equal(r.q.preflight(row,{file}),null);
  const lines=[row.profileText];r.q.layout(row,{lines,maxWidth:1000},row.profileText,text=>text.length);
  r.q.layout(row,{lines:lines.slice(),maxWidth:1000},row.profileText,text=>text.length);
  r.q.beforePaste(row,file);r.q.activity(row,{text:row.profileText},row.profileText);
  r.q.pasted(row,file,{hit:{node:{attrs:{link:row.url},textContent:row.creator+'さん'},pos:i}});
  r.q.divider(row,{},()=>true);
 }
 return{...r,elapsed:performance.now()-start,snapshot:clone(r.q.snapshot())};
}

test('the same full quality workload preserves verdicts while reducing repeated URL parsing',t=>{
 const result=workload(currentCode);
 assert.equal(result.snapshot.fault,false);assert.equal(result.calls.draws,400);assert.equal(result.calls.measures,400);
 assert.equal(result.calls.writes,0,'normal per-person observations must not flush the full quality log');
 result.q.flush();assert.equal(result.calls.writes,2,'the explicit checkpoint flush still saves the bounded log and recent-draft index');
 if(!previousCode){t.diagnostic('The fixed v2.9.1 source is unavailable; current invariants were still checked');return}
 const previous=workload(previousCode);
 assert.deepEqual(result.snapshot,previous.snapshot);
 assert.ok(result.calls.urls<previous.calls.urls*.65,'unchanged metadata should require materially fewer URL parses without skipping observations');
 t.diagnostic('100-person quality-only workload: URL parses '+previous.calls.urls+' -> '+result.calls.urls+'; CPU '+previous.elapsed.toFixed(1)+'ms -> '+result.elapsed.toFixed(1)+'ms (timing is informational)');
});

test('cached calculations observe edits to the same row and never expose mutable cached bindings',()=>{
 const r=runtime(),row=acquire(r.q),first=r.q.sourceBinding(row),original=clone(first);
 first.account='mutated_return';first.profileHash='mutated_return';
 assert.deepEqual(clone(r.q.sourceBinding(row)),original);
 row.creator='改名✨';row.profileText='新しい原文';row.actorImageUrl='';row.thumbUrl='';
 const changed=r.q.sourceBinding(row);
 assert.equal(changed.nameHash,r.q.fingerprint(row.creator));assert.equal(changed.profileHash,r.q.fingerprint(row.profileText));assert.equal(changed.icon,'');assert.equal(changed.thumbnail,'');
 assert.equal(r.q.preflight(row),null,'display-name and profile edits remain nonblocking');
 row.url='https://note.com/another_person/n/'+row.key;
 assert.ok(r.q.preflight(row).reasons.some(reason=>reason.code==='URL_ACCOUNT'));
 row.url='https://note.com/'+row.urlname+'/n/'+row.key;
 assert.equal(r.q.preflight(row),null);
 const file={},ctx=r.canvas();r.q.observeContext(ctx,row,860,220);ctx.fillText(row.creator+'さん',100,190);r.q.generated(row,file);
 assert.ok(!r.q.snapshot().records.at(-1).findings.some(finding=>finding.check==='画像内の文字枠'&&finding.status==='candidate'),'actual medium-canvas bounds are observed');
 row.key='nffffffffffff';row.url='https://note.com/'+row.urlname+'/n/'+row.key;
 assert.ok(r.q.preflight(row,{file}).reasons.some(reason=>reason.code==='FILE_ARTICLE'),'a previously rendered File remains bound to its original article');
});

test('changing layout lines is rechecked even when the source text and row are unchanged',()=>{
 const r=runtime(),row=acquire(r.q),text='communication';
 r.q.layout(row,{lines:[text],maxWidth:200},text,value=>value.length);
 r.q.layout(row,{lines:['communi','cation'],maxWidth:200},text,value=>value.length);
 r.q.activity(row,{text},text);
 assert.ok(r.q.snapshot().records.at(-1).findings.some(finding=>finding.check==='単語の境界'&&finding.status==='candidate'));
});

test('identity normalization stays bounded and the fixed final article is checked without using its display name',()=>{
 const r=runtime(),first={urlname:'cache_person_0',key:'n000000000001',url:'https://note.com/cache_person_0/n/n000000000001'};
 assert.equal(r.q.preflight(first),null);
 for(let i=1;i<=2100;i++)assert.equal(r.q.preflight({urlname:'cache_person_'+i,key:first.key,url:'https://note.com/cache_person_'+i+'/n/'+first.key}),null);
 const parses=r.calls.urls;assert.equal(r.q.preflight(first),null);assert.ok(r.calls.urls>parses,'old URL calculations are evicted instead of retaining every draft forever');
 const final={urlname:'fuku444',key:'nb4f6934381e9',url:'https://note.com/fuku444/n/nb4f6934381e9',creator:'以前の実績名',finalMarker:true,actorImageUrl:'',thumbUrl:''};
 const raw={key:final.key,noteUrl:final.url,title:'異なる表示タイトル',user:{urlname:'fuku444',nickname:'変更後の実績名'}};
 const row=r.q.acquired(final,{target:'fuku444',note:raw,profile:{urlname:'fuku444',nickname:'さらに新しい名前'}});
 row.renderAssetStatus={avatar:'missing',thumbnail:'failed'};
 assert.equal(r.q.preflight(row),null,'the fixed final target and article are valid despite display-name and asset changes');
 const wrong=r.q.acquired(final,{target:'fuku444',note:{...raw,user:{urlname:'different_account'}},profile:{urlname:'fuku444'}});
 assert.ok(r.q.preflight(wrong).reasons.some(reason=>reason.code==='ARTICLE_ACCOUNT'),'the final marker never exempts a real identity contradiction');
});

test('fresh batches still inspect changing people and presentation sources while final asset failures do not hold',()=>{
 const r=runtime();
 for(let i=0;i<4;i++){
  r.q.beginBatch({});const row=acquire(r.q,i,{finalMarker:i===3});
  row.presentation={content:'summary',status:'available',text:'公開文',source:{kind:'note-free',account:row.urlname,key:row.key,url:row.url}};
  assert.equal(r.q.preflight(row),null);
  row.presentation.source.account='another_person';
  assert.ok(r.q.preflight(row).reasons.some(reason=>reason.code==='PRESENTATION_ACCOUNT'));
  row.presentation.status='unavailable';assert.equal(r.q.preflight(row),null);
  row.presentation.status='available';row.presentation.source={kind:'note-free'};assert.equal(r.q.preflight(row),null,'missing evidence is not a contradiction');
  row.renderAssetStatus={avatar:'failed',thumbnail:'missing'};
  const ctx=r.canvas();r.q.observeContext(ctx,row,860,140);ctx.fillText(row.creator+'さん',100,50);r.q.generated(row,{});
  const findings=r.q.snapshot().records.at(-1).findings;
  assert.ok(findings.some(finding=>finding.check==='表示本文の投稿者'&&finding.status==='insufficient'));
  if(row.finalMarker){
   assert.ok(findings.some(finding=>finding.check==='アイコン取得元'&&finding.status==='insufficient'));
   assert.ok(findings.some(finding=>finding.check==='記事画像取得元'&&finding.status==='candidate'));
   assert.ok(!findings.some(finding=>['アイコン取得元','記事画像取得元'].includes(finding.check)&&finding.status==='confirmed'));
  }
 }
});

test('public article leads receive the same identity gates and insufficient observations as free article text',()=>{
 const r=runtime(),row=acquire(r.q),present=source=>({size:'thin',content:'summary',status:'available',text:'公開されている紹介文',source:{kind:'note-public-lead',...source}});
 const original=clone(row),valid={account:row.urlname,key:row.key,url:row.url};
 row.presentation=present(valid);
 assert.equal(r.q.preflight(row),null);assert.equal(r.q.hasVerifiedFreshIdentity(row),true);
 const observe=()=>{const ctx=r.canvas();r.q.observeContext(ctx,row,860,140);ctx.fillText(row.creator+'さん',100,50);r.q.generated(row,{});return r.q.snapshot().records.at(-1).findings};
 let findings=observe();assert.ok(findings.some(finding=>finding.check==='表示本文の投稿者'&&finding.status==='confirmed'));assert.ok(findings.some(finding=>finding.check==='表示本文の記事ID'&&finding.status==='confirmed'));
 for(const [source,codes] of [
  [{...valid,account:'wrong_person',key:'nffffffffffff'},['PRESENTATION_ACCOUNT','PRESENTATION_ARTICLE']],
  [{...valid,url:'https://note.com/wrong_person/n/nffffffffffff'},['PRESENTATION_URL_ACCOUNT','PRESENTATION_URL_ARTICLE']]
 ]){
  row.presentation=present(source);const verdict=r.q.preflight(row);
  for(const code of codes)assert.ok(verdict.reasons.some(reason=>reason.code===code));
  assert.deepEqual(clone(r.q.provenance(row)),clone(r.q.provenance(original)),'the negative case changes only the adopted lead source, not the valid row or acquired proof');
 }
 row.presentation=present({});assert.equal(r.q.preflight(row),null);
 findings=observe();assert.ok(findings.some(finding=>finding.check==='表示本文の投稿者'&&finding.status==='insufficient'));assert.ok(findings.some(finding=>finding.check==='表示本文の記事ID'&&finding.status==='insufficient'));
 row.presentation={...present({account:'wrong_person',key:'nffffffffffff'}),status:'unavailable'};assert.equal(r.q.preflight(row),null);
});

test('a held presentation is recomposed from fresh responses before its original source hold can clear',async()=>{
 for(const available of [false,true]){
  const r=runtime(),row=acquire(r.q,0,{gallery126:true});
  row.presentation={size:'medium',content:'profile',status:'available',text:'wrong text',source:{kind:'profile',account:'wrong_person'}};
  const verdict=r.q.preflight(row),hold={version:1,kind:'source',phase:'images',index:0,identity:{account:row.urlname,key:row.key,url:row.url},runId:1000,articleKey:'naaaaaaaaaaaa',reasons:verdict.reasons,at:1000};
  let run={articleKey:'naaaaaaaaaaaa',createdAt:1000,rows:[row],items:[],gallery126:true,qualityHold:hold};
  const original=clone(run);let compositions=0;
  r.context.page=r.page;r.context.readRun=()=>run;r.context.writeRun=value=>{run=clone(value)};r.context.editorArticleKey=()=>run.articleKey;
  r.context.qualityCall=(method,args,fallback)=>r.q[method]?.(...args)??fallback;
  r.context.qualityBlock=async retained=>{throw Object.assign(new Error('held'),{code:'QUALITY_HOLD',qualityHold:retained})};
  r.context.mediaUrl=value=>typeof value==='object'?value?.url||'':String(value||'');
  r.context.articleMetaImage=async()=>'';
  r.context.xhrJSON=async url=>url.includes('/api/v3/notes/')?{data:{key:row.key,noteUrl:row.url,user:{urlname:row.urlname},title:'fresh title',eyecatch:'https://assets.st-note.com/fresh.png'}}:{data:{creator:{urlname:row.urlname,nickname:'fresh name',profile:'fresh profile'}}};
  r.page.__MUMEI_PROFILE_CARD_RUN_STORE__={read:()=>run,flush:async()=>{}};
  if(available)r.page.__MUMEI_PROFILE_CARD_CONTENT__={compose:(pending,note,profile,options)=>{compositions++;assert.equal(options.size,'medium');assert.equal(options.content,'profile');return{size:options.size,content:options.content,status:'available',text:profile.profile,source:{kind:'profile',account:profile.urlname,url:'https://note.com/'+profile.urlname}}}};
  vm.runInContext(qualityRefreshHelpers,r.context);
  if(!available){await assert.rejects(r.context.qualityRetryHeldRun(run),error=>error.code==='QUALITY_HOLD');assert.deepEqual(clone(run),original);continue}
  await r.context.qualityRetryHeldRun(run);
  assert.equal(compositions,1);assert.equal(run.qualityHold,undefined);assert.equal(run.rows[0].presentation.text,'fresh profile');assert.equal(run.rows[0].presentation.source.account,row.urlname);
  assert.equal(r.q.preflight(run.rows[0]),null);assert.equal(r.q.hasVerifiedFreshIdentity(run.rows[0]),true);
 }
});

function pendingRetry({finalMarker=false,presentation=false}={}){
 const r=runtime(),row=acquire(r.q,0,{finalMarker});delete row.profileText;delete row.likesHistory;
 if(finalMarker){row.urlname='fuku444';row.key='nb4f6934381e9';row.url='https://note.com/fuku444/n/'+row.key;row.actorUrl='https://note.com/fuku444'}
 if(presentation)row.presentation={size:'thin',content:'profile',status:'available',text:'old profile',source:{kind:'profile',account:'wrong_person'}};
 const hold={version:1,kind:'source',phase:'images',index:0,identity:{account:row.urlname,key:row.key,url:row.url},runId:1000,articleKey:'naaaaaaaaaaaa',reasons:[{code:'ARTICLE_ACCOUNT',expected:row.urlname,actual:'wrong_person'}],at:1000};
 let run={articleKey:'naaaaaaaaaaaa',createdAt:1000,rows:[row],items:[],coreImageRun:!finalMarker,likesHistoryFix230:finalMarker,qualityHold:hold};
 r.context.page=r.page;r.context.readRun=()=>run;r.context.writeRun=value=>{run=clone(value)};r.context.editorArticleKey=()=>run.articleKey;
 r.context.norm=value=>{const url=new URL(value);url.search='';url.hash='';return url.href};
 r.context.qualityCall=(method,args,fallback)=>r.q[method]?.(...args)??fallback;
 r.context.qualityBlock=async retained=>{throw Object.assign(new Error('held'),{code:'QUALITY_HOLD',qualityHold:retained})};
 r.context.mediaUrl=value=>typeof value==='object'?value?.url||'':String(value||'');r.context.articleMetaImage=async()=>'';
 r.context.xhrJSON=async url=>url.includes('/api/v3/notes/')?{data:{key:row.key,noteUrl:row.url,user:{urlname:row.urlname},title:'fresh title',eyecatch:finalMarker?null:'https://assets.st-note.com/fresh.png'}}:{data:{creator:{urlname:row.urlname,nickname:'fresh name',profile:'fresh profile'}}};
 r.page.__MUMEI_PROFILE_CARD_RUN_STORE__={read:()=>run,flush:async()=>{}};
 vm.runInContext(qualityRefreshHelpers,r.context);
 return{...r,row,get run(){return run},retry:()=>r.context.qualityRetryHeldRun(run)};
}

test('fresh core presentation metadata cannot clear a hold when its owned pending paragraph would change',async()=>{
 const r=pendingRetry({presentation:true});r.row.url+='?from=resume#saved';r.run.qualityHold.identity.url=r.row.url;
 const key=r.context.norm(r.row.url);
 const aboveText=row=>'intro: '+row.presentation.text;
 r.run.presentationTexts={[key]:aboveText(r.row)};r.run.activityTexts=[aboveText(r.row)];
 const original=clone(r.run);
 r.page.__MUMEI_PROFILE_CARD_CONTENT__={aboveText,compose:(pending,note,profile,options)=>({...options,text:profile.profile,status:'available',source:{kind:'profile',account:profile.urlname}})};
 assert.equal(r.context.activityText,undefined,'the normal core implementation has no legacy activityText function');
 await assert.rejects(r.retry(),error=>error.code==='QUALITY_HOLD');
 assert.deepEqual(clone(r.run),original,'the pending row, explicit ownership and original hold all remain unchanged');
});

test('a fresh final-row identity may clear its source hold when the thumbnail is absent',async()=>{
 const r=pendingRetry({finalMarker:true}),selected={account:r.row.urlname,key:r.row.key,url:r.row.url,index:r.row.index,designIndex:r.row.designIndex};
 await r.retry();
 assert.equal(r.run.qualityHold,undefined);assert.equal(r.run.rows[0].thumbUrl,'');
 assert.equal(r.q.preflight(r.run.rows[0]),null);assert.equal(r.q.hasVerifiedFreshIdentity(r.run.rows[0]),true);
 const fresh=r.run.rows[0];assert.deepEqual({account:fresh.urlname,key:fresh.key,url:fresh.url,index:fresh.index,designIndex:fresh.designIndex},selected);
});

const exposeHistoryActions=r=>r.editor.patch(`const restartTestHistoryOptions=historyOptions;historyOptions=run=>run?restartTestHistoryOptions(run):{mode:'number',count:state.targetCount,target:state.targetCount};globalThis.restartQualityTest=restartFixed300;globalThis.startQualityTest=startFixed300;`);

test('compiled healthy history restart replaces only its owned output and keeps the requested count',{skip:!dependencies?'Real PM/canvas dependencies are required':false},async t=>{
 const r=await compiledRuntime({count:3});t.after(()=>r.close());
 await r.history();const before=clone(r.editor.readRun()),requests=r.state.requests.length;
 assert.equal(before.stage,'images_ready');exposeHistoryActions(r);r.state.clock+=1000;
 await r.c.restartQualityTest();
 const after=r.editor.readRun(),images=[];r.view.state.doc.descendants(node=>{if(node.type.name==='image')images.push(node)});
 assert.equal(after.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.equal(after.qualityHold??null,null);assert.equal(after.rows.length,4);assert.equal(after.items.length,4);assert.equal(images.length,4);assert.equal(after.count,3);
 assert.ok(after.createdAt>before.createdAt);assert.equal(r.state.images.length,8);assert.equal(r.state.requests.length,requests,'a same-count healthy restart reuses its selected rows');
 assert.deepEqual(Array.from(after.rows,row=>({url:row.url,index:row.index,designIndex:row.designIndex})),Array.from(before.rows,row=>({url:row.url,index:row.index,designIndex:row.designIndex})));
 const allText=r.view.state.doc.textContent;assert.equal(allText.split('元の文章です。').length,2);
 for(const item of before.items)assert.ok(!images.some(node=>node.attrs.id===item.id),'the previous owned image prefix was replaced instead of duplicated');
});

test('compiled restart and start preserve a known file hold and owned prefix while quality is OFF',{skip:!dependencies?'Real PM/canvas dependencies are required':false},async t=>{
 const r=await compiledRuntime({count:3});t.after(()=>r.close());
 r.editor.patch(`const restartTestMakeFile=makeFile;makeFile=async row=>{const file=await restartTestMakeFile(row);if(row.index===1)state.restartFirstFile=file;return row.index===2?state.restartFirstFile:file};`);
 await r.history();const held=r.editor.readRun();assert.equal(held.qualityHold?.kind,'file');assert.equal(held.items.length,1);
 r.local.set('mumei_profile_quality_mode_v1','off');const off=await r.reload();t.after(()=>off.close());exposeHistoryActions(off);
 const before=clone(off.editor.readRun()),body=off.doc(),requestCount=off.state.requests.length,canvasCount=off.state.canvasCount;
 await off.c.restartQualityTest();await off.c.startQualityTest();
 const after=off.editor.readRun();assert.deepEqual(off.doc(),body,'neither action may clear the already owned prefix before noticing its hold');
 assert.equal(after.createdAt,before.createdAt);assert.deepEqual(clone(after.qualityHold),before.qualityHold);assert.deepEqual(clone(after.items),before.items);assert.equal(off.state.images.length,1);assert.equal(off.state.requests.length,requestCount);assert.equal(off.state.canvasCount,canvasCount);
 assert.equal(off.quality.snapshot().mode,'off');
});
