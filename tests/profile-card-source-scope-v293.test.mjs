import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {transformCoreGeneral} from '../scripts/profile-card-general-v292.mjs';
import {transformCoreSourceScope} from '../scripts/profile-card-source-scope-v293.mjs';
import {runtime as compiledRuntime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';
const source=transformCoreSourceScope(transformCoreGeneral(readFileSync('public/note-profile-card-paster-core-v232.js','utf8')));
const key=index=>'n'+index.toString(16).padStart(12,'0');
const note=(account,index,tags=['指定タグ'],date='2026-10-01T00:00:00Z')=>({key:key(index),noteUrl:'https://note.com/'+account+'/n/'+key(index),name:account+'記事'+index,user:{urlname:account,key:'account-'+account,nickname:account},eyecatch_url:'https://assets.st-note.com/fixture.png',hashtags:tags,publishAt:date});
function runtime({search={},notes={},magazine=[],pin=null,searchFunction=null}={}){
 const dom=new JSDOM('',{url:'https://editor.note.com/notes/n123456789abc/edit',runScripts:'outside-only'}),window=dom.window;
 window.unsafeWindow=window;window.GM_getValue=()=>null;window.GM_setValue=()=>{};window.GM_xmlhttpRequest=()=>{throw Error('No real network')};window.setInterval=()=>1;window.clearInterval=()=>{};
 const ending="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();";
 const code=source.replace(ending,'globalThis.api={patch:code=>eval(code),collectUnified,enrich,scopeNote,assignedTags,sourceSelectionNotice};');vm.runInContext(code,dom.getInternalVMContext());
 const requests=[],statuses=[];let pages=0;
 window.request=async url=>{
  requests.push(url);const parsed=new URL(url);
  if(url.includes('/searches')){pages++;return searchFunction?searchFunction(parsed,pages):{data:{notes:{contents:search[parsed.searchParams.get('q')]||[],is_last_page:true}}};}
  if(url.includes('/magazines/'))return{data:{notes:magazine}};
  const match=parsed.pathname.match(/^\/api\/v3\/notes\/(n[a-f0-9]{12})$/);if(match)return{data:notes[match[1]]||{}};
  if(parsed.pathname.endsWith('/likes'))return{data:{likes:[{user:{urlname:'alpha',key:'account-alpha',nickname:'alpha'}}]}};
  if(parsed.pathname.endsWith('/contents'))return{data:{contents:pin?[{...pin,isPinned:true}]:[note('alpha',99,['他のタグ'])],isLastPage:true,totalCount:1}};
  if(parsed.pathname.includes('/api/v2/creators/'))return{data:{creator:{urlname:'alpha',nickname:'alpha',profile:'プロフィール'}}};
  throw Error('Unexpected request '+url);
 };
 window.captureScopeStatus=text=>statuses.push(text);window.api.patch('xhrJSON=request;setStatus=captureScopeStatus;');
 return{api:window.api,window,requests,statuses,close:()=>window.close(),pages:()=>pages};
}
test('hashtag latest keeps the matching article rather than the same author’s untagged newest article',async()=>{
 const tagged=note('alpha',1),r=runtime({search:{指定タグ:[tagged]},notes:{[key(1)]:tagged}});const rows=await r.api.collectUnified('#指定タグ','number',1,'latest');
 assert.equal(rows[0].key,key(1));assert.equal(rows[0].sourceScope.kind,'tag');assert.equal(rows[0].sourceScope.tag,'指定タグ');assert.ok(!r.requests.some(url=>url.includes('/contents')));
 await r.api.enrich(rows[0]);assert.equal(r.requests.filter(url=>url.includes('/api/v3/notes/'+key(1))).length,1,'scope proof and enrichment reuse the same note response');r.close();
});
test('metadata flattens all tag fields, including actual hashtag_notes after an empty hashtags array',async()=>{
 const tagged={...note('alpha',1,[]),hashtag_notes:[{hashtag:{name:'＃指定タグ'}}]},r=runtime({search:{指定タグ:[tagged]},notes:{[key(1)]:tagged}});assert.equal((await r.api.collectUnified('#指定タグ','number',1,'latest')).length,1);
 assert.deepEqual(Array.from(r.api.assignedTags({hashtags:[],tags:['猫'],hashtag_names:[{name:'AI'}],note_hashtags:[{hashtag:{name:'創作'}}],hashtag_notes:[{hashtag:{name:'指定タグ'}}]}).names),['猫','AI','創作','指定タグ']);r.close();
});
test('body mentions and similar longer tag names cannot substitute for the exact assigned tag',async()=>{
 const falseHit={...note('alpha',1,['指定タグの別名']),body:'#指定タグ と本文に書いてあります'},r=runtime({search:{指定タグ:[falseHit]},notes:{[key(1)]:falseHit}});assert.equal((await r.api.collectUnified('#指定タグ','number',1,'latest')).length,0);assert.equal(r.window.__MUMEI_PROFILE_CARD_SOURCE_SELECTION__.scopeRejected,1);r.close();
});
test('missing tag metadata remains explicitly unverified',async()=>{
 const tagged=note('alpha',1),unknown={...tagged};delete unknown.hashtags;const r=runtime({search:{指定タグ:[tagged]},notes:{[key(1)]:unknown}});assert.equal((await r.api.collectUnified('#指定タグ','number',1,'latest')).length,0);const selection=r.window.__MUMEI_PROFILE_CARD_SOURCE_SELECTION__;assert.equal(selection.scopeUnavailable,1);assert.ok(selection.issues[0].reason.includes('未確認'));r.close();
});
test('fixed fallback stays on the requested tag and strict fixed rejects an off-tag pin',async()=>{
 const tagged=note('alpha',1),offTag=note('alpha',2,['他のタグ']);for(const choice of ['fixed','pinned']){const r=runtime({search:{指定タグ:[tagged]},notes:{[key(1)]:tagged,[key(2)]:offTag},pin:offTag}),rows=await r.api.collectUnified('#指定タグ','number',1,choice);assert.equal(rows.length,choice==='fixed'?1:0);if(rows.length)assert.equal(rows[0].key,key(1));else assert.equal(r.window.__MUMEI_PROFILE_CARD_SOURCE_SELECTION__.fixedSkipped,1);r.close();}
});
test('a pin is selected only after its own exact assigned tag is verified',async()=>{
 const tagged=note('alpha',1),pinned=note('alpha',2,['指定タグ']);const r=runtime({search:{指定タグ:[tagged]},notes:{[key(1)]:tagged,[key(2)]:pinned},pin:pinned});const rows=await r.api.collectUnified('#指定タグ','number',1,'pinned');assert.equal(rows[0].key,key(2));assert.equal(rows[0].sourceScope.tag,'指定タグ');r.close();
});
test('failing one tag does not exclude that person from a later OR tag',async()=>{
 const article=note('alpha',1,['二つ目']),r=runtime({search:{一つ目:[article],二つ目:[article]},notes:{[key(1)]:article}});const rows=await r.api.collectUnified('#一つ目 #二つ目','number',1,'latest');assert.equal(rows.length,1);assert.equal(rows[0].sourceScope.tag,'二つ目');assert.equal(r.requests.filter(url=>url.includes('/api/v3/notes/'+key(1))).length,1);r.close();
});
test('magazine latest retains the listed article and never asks for the author’s newest article',async()=>{
 const listed=note('alpha',1),r=runtime({magazine:[listed]});const rows=await r.api.collectUnified('https://note.com/a/m/mfixture','number',1,'latest');assert.equal(rows[0].key,key(1));assert.equal(rows[0].sourceScope.magazineKey,'mfixture');assert.ok(!r.requests.some(url=>url.includes('/contents')));r.close();
});
test('an unlisted magazine pin requires explicit typed membership evidence',async()=>{
 const listed=note('alpha',1),pinned=note('alpha',2);for(const belongs of [false,true]){const proof={...pinned,...(belongs?{belonging_magazine_keys:['mfixture']}:{body:'mfixtureという文字だけ'})},r=runtime({magazine:[listed],notes:{[key(1)]:listed,[key(2)]:proof},pin:pinned});const rows=await r.api.collectUnified('https://note.com/a/m/mfixture','number',1,'fixed');assert.equal(rows[0].key,key(belongs?2:1));r.close();}
});
test('a listed magazine fallback survives missing detail while unlisted pins remain unverified',async()=>{
 const listed=note('alpha',1),pinned=note('alpha',2);
 for(const choice of ['fixed','pinned']){
  const r=runtime({magazine:[listed],pin:pinned}),original=r.window.request;let detailCalls=0;
  r.window.requestWithoutDetails=async url=>{if(new URL(url).pathname.match(/^\/api\/v3\/notes\/n[a-f0-9]{12}$/)){detailCalls++;throw Error('temporary note-detail failure')}return original(url)};
  r.api.patch('xhrJSON=requestWithoutDetails');const rows=await r.api.collectUnified('https://note.com/a/m/mfixture','number',1,choice);
  assert.equal(rows.length,choice==='fixed'?1:0);if(rows.length){assert.equal(rows[0].key,key(1));assert.equal(rows[0].sourceScope.magazineKey,'mfixture');await r.api.enrich(rows[0]);assert.equal(detailCalls,2,'the failed listed response is reused rather than refetched');}r.close();
 }
 const wrong={...listed,user:{urlname:'different_account'}},r=runtime({magazine:[listed],notes:{[key(1)]:wrong,[key(2)]:{...pinned,belonging_magazine_keys:['mfixture']}},pin:pinned});const rows=await r.api.collectUnified('https://note.com/a/m/mfixture','number',1,'fixed');assert.equal(rows[0].key,key(1));assert.ok(!r.requests.some(url=>url.includes('/contents')),'an actual contradictory response is retained for the gate before replacement');r.close();
});
test('scoped oldest reads source pages and chooses the earliest matching article per person',async()=>{
 const aNew=note('alpha',1,['指定タグ'],'2026-10-01T00:00:00Z'),aOld=note('alpha',2,['指定タグ'],'2020-01-01T00:00:00Z'),bNew=note('beta',3,['指定タグ'],'2026-09-01T00:00:00Z'),bOld=note('beta',4,['指定タグ'],'2021-01-01T00:00:00Z');
 const r=runtime({notes:{[key(1)]:aNew,[key(2)]:aOld,[key(3)]:bNew,[key(4)]:bOld},searchFunction:(url,page)=>({data:{notes:{contents:page===1?[aNew,bNew]:[aOld,bOld],is_last_page:page===2},cursor:{note:page===1?'next':null}}})});const rows=await r.api.collectUnified('#指定タグ','number',2,'oldest');assert.deepEqual(Array.from(rows,row=>row.key),[key(2),key(4)]);assert.equal(r.pages(),2);assert.ok(!r.requests.some(url=>url.includes('/contents')));assert.equal(r.window.__MUMEI_PROFILE_CARD_SOURCE_SELECTION__.cappedSources.length,0);r.close();
});
test('the bounded oldest search reports its limit instead of claiming complete history',async()=>{
 const r=runtime({searchFunction:(url,page)=>{
  const article=note('account_'+page,page,['指定タグ'],new Date(Date.UTC(2026,0,1)-page*86400000).toISOString());
  r.window.details??={};r.window.details[article.key]=article;
  return{data:{notes:{contents:[article]},cursor:{note:String(page)}}};
 }});
 const original=r.window.request;r.window.requestWithDetails=async url=>{const match=new URL(url).pathname.match(/^\/api\/v3\/notes\/(n[a-f0-9]{12})$/);return match?{data:r.window.details[match[1]]}:original(url)};r.api.patch('xhrJSON=requestWithDetails');
 const rows=await r.api.collectUnified('#指定タグ','number',1,'oldest');assert.equal(r.pages(),250);assert.equal(rows[0].key,key(250));assert.equal(r.window.__MUMEI_PROFILE_CARD_SOURCE_SELECTION__.cappedSources.length,1);assert.ok(r.statuses.at(-1).includes('確認範囲内'));r.close();
});
test('a clear detail identity contradiction is retained for the gate before a pin can disguise it',async()=>{
 const listed=note('alpha',1),wrong={...listed,user:{urlname:'different_account'}},pinned=note('alpha',2),r=runtime({search:{指定タグ:[listed]},notes:{[key(1)]:wrong,[key(2)]:pinned},pin:pinned});const rows=await r.api.collectUnified('#指定タグ','number',1,'fixed');assert.equal(rows[0].key,key(1));assert.equal(rows[0].urlname,'alpha');assert.ok(!r.requests.some(url=>url.includes('/contents')));r.close();
});
test('the per-run detail cache is reset for the next changing input',async()=>{
 const article=note('alpha',1),details={[key(1)]:article},r=runtime({search:{指定タグ:[article]},notes:details});assert.equal((await r.api.collectUnified('#指定タグ','number',1,'latest')).length,1);details[key(1)]={...article,hashtags:['別のタグ']};assert.equal((await r.api.collectUnified('#指定タグ','number',1,'latest')).length,0);assert.equal(r.requests.filter(url=>url.includes('/api/v3/notes/'+key(1))).length,2);r.close();
});
test('article-liker inputs retain their four per-person article choices',async()=>{
 for(const choice of ['latest','oldest','fixed','pinned']){const r=runtime(),calls=[];r.window.selectArticle=async(person,selected)=>{calls.push(selected);return{...person,key:key(7),url:'https://note.com/alpha/n/'+key(7)}};r.api.patch('chooseCreatorArticle=selectArticle');const rows=await r.api.collectUnified('https://note.com/a/n/'+key(1),'number',1,choice);assert.equal(rows[0].key,key(7));assert.deepEqual(calls,[choice]);assert.equal(rows[0].sourceScope,undefined);r.close();}
});
test('compiled hashtag selection holds a wrong detail author before writing',{skip:!dependencies?'PM and canvas dependencies are required':false},async()=>{
 const r=await compiledRuntime({count:2,requestMutator:(url,payload)=>{if(url.includes('/api/v3/notes/')&&!url.endsWith('/likes'))payload.data.user.urlname='different_account';return payload}});await r.normal({kind:'tag'});const run=r.editor.readRun();assert.ok(run.qualityHold);assert.equal(run.qualityHold.index,0);assert.equal(r.state.images.length,0);assert.ok(!r.state.requests.some(url=>url.includes('/contents')));r.close();
});
