'use strict';
/*
 * Regressions for #始めのnote, #はじめてのnote, #自己紹介 and the
 * shared visible count. Run: node tests/profile-card-policy.cjs
 * No note credentials, browser, external modules, or network required.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/note-profile-card-likes300-fix-v220.user.js'),'utf8');
function extract(start,end){
 const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
 assert(from>=0&&to>from,'source function missing: '+start);
 return source.slice(from,to);
}
function compile(start,end,dependencies,exportName){
 return new Function(...Object.keys(dependencies),extract(start,end)+';return '+exportName+';')(...Object.values(dependencies));
}
const tags=['始めのnote','自己紹介','はじめてのnote'];
const article=(id,n,tag)=>({
 urlname:id,key:'n'+n.padStart(12,'0'),
 url:'https://note.com/'+id+'/n/n'+n.padStart(12,'0'),
 publishAt:'2026-11-16T01:00:00+09:00',tag,sourceTag:tag
});
const strict=[article('multiple','a','始めのnote'),article('one','b','始めのnote')];
const general=[article('many_intro','c','自己紹介'),article('many_intro','d','自己紹介')];
const second=[article('another_one','e','はじめてのnote')];
const lookup={'始めのnote':strict,'自己紹介':general,'はじめてのnote':second};
const everything=[...strict,...general,...second];
const details=Object.fromEntries(everything.map(x=>[x.key,{key:x.key,user:{urlname:x.urlname},publishAt:x.publishAt,tags:[x.tag]}]));
const noteKey=v=>v.match(/\/(n[a-z0-9]+)$/)?.[1]||'';
const hasOnlyOne=async row=>row.urlname==='one'||row.urlname==='another_one';
function specialHarness(saved=null,visibleCount='200'){
 let latest=null;
 const dependencies={
  targetLimit:(mode,n)=>mode==='all'?Infinity:n,
  FIRST_TAGS:tags,STRICT_FIRST_TAGS:new Set(['始めのnote','はじめてのnote']),
  keepAwake:async()=>{},recoverSpecialExclusionsFromPublishedArticles:async()=>{},
  specialExcludedSets:()=>({urls:new Set(),creators:new Set(),keys:new Set()}),
  readScan:()=>saved,document:{hidden:false,querySelector:()=>({value:visibleCount})},
  PANEL:'test',norm:v=>v,noteKey,writeScan:v=>{latest=v},setStatus:()=>{},
  creatorSinglePublicArticle:hasOnlyOne,
  specialTagAudit:async(row,tag)=>({ok:row.tag===tag,tags:[tag]}),
  sleep:async()=>{},articleFromRaw:v=>v,
  xhrJSON:async url=>({data:{notes:{contents:lookup[decodeURIComponent(url.match(/[?&]q=([^&]+)/)?.[1]||'')]||[],is_last_page:true}}}),
  normalizeSearch:v=>({arr:v.data.notes.contents,cursor:null,last:true}),
  FINAL_URL:'https://note.com/fuku444/n/nb4f6934381e9',
  stopRequested:false,page:{}
 };
 const fn=compile('async function collectFirstNoteSpecial(','\nfunction saveSpecialLast(',dependencies,'collectFirstNoteSpecial');
 return{fn,get checkpoint(){return latest}};
}
async function testSpecial(){
 const h=specialHarness(),out=await h.fn('number',200,tags);
 assert.deepEqual(out.map(x=>x.urlname),['one','many_intro','another_one']);
 assert.equal(h.checkpoint.rejects['公開記事が1件ではない'],1);
 assert.equal(h.checkpoint.rejects['同一クリエイター重複'],1);
 const saved={
  version:1,signature:JSON.stringify({tags:[...tags].sort(),limit:50}),
  states:tags.map(tag=>({tag,cursor:'0',done:true,page:1,buffer:[]})),
  out:[strict[0],strict[1],general[0],general[1]].map(row=>({...row,specialSourceTag:row.sourceTag})),
  tested:everything.map(x=>x.url),scanned:5,rejects:{},anchorPos:0
 };
 const resumed=specialHarness(saved),reused=await resumed.fn('number',200,tags);
 assert.deepEqual(reused.map(x=>x.urlname),['one','many_intro']);
 assert.equal(resumed.checkpoint.scanned,5,'should retain the old scan progress');
}
async function testMixedTags(){
 const dependencies={
  resetSourceScopeNotes:()=>{},
  parseUnifiedSources:()=>['始めのnote','自己紹介'].map(value=>({type:'tag',value,label:'#'+value})),
  targetLimit:(mode,n)=>mode==='all'?Infinity:n,
  page:{},stopRequested:false,norm:v=>v,
  FINAL_URL:'https://note.com/fuku444/n/nb4f6934381e9',
  scopeAccount:v=>String(v||'').toLowerCase(),scopeUrlIdentity:()=>({}),noteKey,
  normalizeAssignedTag:v=>v,creatorSinglePublicArticle:hasOnlyOne,
  STRICT_FIRST_TAGS:new Set(['始めのnote','はじめてのnote']),
  scopeNote:async key=>({data:details[key]}),articleSafetyCheck:()=>({ok:true}),
  scopeIdentityMismatch:()=>false,magazineKey:()=>'',magazineMembership:()=>false,
  assignedTags:note=>({names:note.tags||[],available:true,complete:true}),
  chooseCreatorArticle:async()=>null,MIXED_TAG_SCAN_PREFIX:'mixed:',
  editorArticleKey:()=>'nTEST',readJSONKey:()=>null,writeJSONKey:()=>{},
  xhrJSON:async url=>({data:{notes:{contents:decodeURIComponent(url.match(/[?&]q=([^&]+)/)?.[1]||'')==='始めのnote'?strict:general,is_last_page:true}}}),
  articleFromRaw:v=>v,normalizeSearch:v=>({arr:v.data.notes.contents,last:true,cursor:null}),
  setStatus:()=>{},imagePauseRequested:false,parseLiker:v=>v
 };
 const fn=compile('async function collectUnified(','\nfunction sourceSelectionNotice(',dependencies,'collectUnified');
 const out=await fn('#始めのnote\n#自己紹介','number',200,'latest');
 assert.deepEqual(out.map(x=>x.urlname),['one','many_intro']);
 assert.equal(dependencies.page.__MUMEI_PROFILE_CARD_SOURCE_SELECTION__.scopeRejected,1);
}
async function testSingleArticleEvidence(){
 const raw=k=>({key:k,url:'https://note.com/one/n/'+k});
 function make(items){
  const dependencies={
   creatorContents:async(id,page)=>({data:{contents:page===2?items.slice(1):items,totalCount:items.length}}),
   contentList:v=>v.data.contents,articleFromRaw:v=>v,noteKey
  };
  return compile('async function creatorSinglePublicArticle(','\nasync function specialArticleText(',dependencies,'creatorSinglePublicArticle');
 }
 const row={urlname:'one',url:'https://note.com/one/n/n000000000001'};
 assert.equal(await make([raw('n000000000001')])(row),true);
 assert.equal(await make([raw('n000000000001'),raw('n000000000002')])(row),false);
}
async function main(){
 assert(source.includes("'始めのnote'"),'exact first-note tag missing');
 assert(source.includes("const specialMode=mode,specialCount=count;"),'two independent count selectors returned');
 await testSingleArticleEvidence();
 await testSpecial();
 await testMixedTags();
 console.log('PASS: first-note exact tags, strict count, unique creators, saved progress, mixed-tag policy');
}
main().catch(err=>{console.error(err);process.exitCode=1});
