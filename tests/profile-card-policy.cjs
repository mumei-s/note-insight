'use strict';
// Run directly with Node. Only the public note responses and editor storage are simulated.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/note-profile-card-likes300-fix-v220.user.js'),'utf8');
function section(start,end){
 const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
 assert(from>=0&&to>from,'Function missing: '+start);
 return source.slice(from,to);
}
const production=[
 section('const MIXED_TAG_SCAN_PREFIX=','const W=THUMBNAIL_WIDTH'),
 section('const FINAL_URL=','const SPEED_FACTOR='),
 section('const norm=v=>','const runKey='),
 section('function mediaUrl(v)','function getPrefs()'),
 section('function contentList(p)','function sourceSelectionNotice('),
 section('function readJSONKey(','function specialExcluded('),
 section('function specialBlockedReason(','async function specialArticleText('),
 section('async function specialTagAudit(','function saveSpecialLast(')
].join('\n');
const first='はじめてのnote',kanji='初めてのnote',intro='自己紹介',tags=[first,kanji,intro];
const input=tags.map(tag=>'#'+tag).join('\n');
const key=i=>'n'+i.toString(16).padStart(12,'0');
const url=id=>'https://note.com/'+id+'/n/';
const articles=new Map(),feeds=new Map(tags.map(tag=>[tag,[]])),creators=new Map();
function add(i,author,assigned,title,options={}){
 const user={urlname:author,nickname:author},publish_at=new Date(Date.UTC(2026,9,1,12,-i)).toISOString();
 const row={key:key(i),name:options.listingTitle||title,noteUrl:url(author)+key(i),user,publish_at};
 articles.set(row.key,{...row,name:title,body:options.body||'',hashtag_notes:assigned.map(tag=>({hashtag:{name:'#'+tag}}))});
 for(const tag of options.listed||assigned)feeds.get(tag).push(row);
 if(!creators.has(author))creators.set(author,{row,count:options.count??1,extraPinned:options.extraPinned});
}
add(1,'previous',[first],'前回掲載');
add(2,'several',[intro],'活動と自己紹介',{count:3});
add(3,'two',[first],'投稿を始めました',{count:2});
add(4,'new',[kanji],'初投稿');
add(5,'renamed',[intro],'近況',{body:'自己紹介だけ本文にある',listingTitle:'古い自己紹介'});
add(6,'both',[kanji,intro],'副業と収益化の自己紹介',{count:8});
add(7,'badcount',[first],'初投稿',{count:'unknown'});
add(8,'gambling',[intro],'自己紹介',{body:'馬券と競馬'});
add(9,'invest',[first],'私の投資記録');
add(10,'adult',[intro],'自己紹介',{body:'成人向け'});
add(11,'samework',[kanji,first],'副業・収益化の記録');
add(12,'several',[intro],'二度目の自己紹介',{count:3});
add(13,'wrongtag',[],'自己紹介',{listed:[intro]});
add(14,'pinned',[first],'初投稿',{extraPinned:true});
add(15,'newtitle',[intro],'改めて自己紹介',{listingTitle:'旧題'});
function harness(){
 const storage=new Map(),requests=[];let savedSpecial=null;
 const ctx=vm.createContext({
  URL,location:new URL('https://editor.note.com/notes/n000000000000/edit/'),
  localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  page:{},document:{hidden:false,querySelector:()=>({value:'200'})},PANEL:'test',
  readRun:()=>null,contentOptions:{size:'thin',content:'name'},setStatus(){},stopRequested:false,imagePauseRequested:false,
  keepAwake:async()=>{},recoverSpecialExclusionsFromPublishedArticles:async()=>{},sleep:async()=>{},
  specialExcludedSets:()=>({urls:new Set(),creators:new Set(),keys:new Set([key(1)])}),
  readScan:()=>savedSpecial,writeScan:value=>{savedSpecial=value},xhr:async()=>'',
  xhrJSON:async value=>{
   const route=new URL(value),parts=decodeURI(route.pathname).split('/');requests.push(route);
   if(parts[3]==='hashtags'){
    assert.equal(route.searchParams.get('order'),'new');
    const page=Number(route.searchParams.get('page')),list=feeds.get(parts[4]),size=2;
    assert(Number.isInteger(page)&&page>0);
    const last=page*size>=list.length;
    return{data:{notes:list.slice((page-1)*size,page*size),next_page:last?null:page+1,is_last_page:last}};
   }
   if(parts[3]==='notes')return{data:articles.get(parts[4])};
   if(parts[3]==='creators'){
    const {row,count,extraPinned}=creators.get(parts[4]),pinned=route.searchParams.get('disabled_pinned')==='false';
    const contents=route.searchParams.get('page')==='2'?[]:pinned&&extraPinned?[row,{...row,key:key(99),noteUrl:url(parts[4])+key(99)}]:[row];
    return{data:{contents,totalCount:count,isLastPage:true}};
   }
   throw new Error('Unexpected request '+value);
  }
 });
 vm.runInContext(production,ctx);
 return{ctx,requests,presetSpecial:value=>{savedSpecial=value},checkpoint:()=>savedSpecial};
}
const ids=rows=>Array.from(rows,row=>row.key);
async function testAppendCardOwnership(){
 const url='https://note.com/new_writer/n/n000000000001';
 const other='https://note.com/older_writer/n/n000000000002';
 const embed=(key,target,pos)=>({node:{attrs:{embeddedContentKey:key,src:target,htmlForEmbed:'note-embed'}},pos});
 const baseline=embed('emb1',url,0),manual=embed('emb2',url,2),previous=embed('emb3',other,4);
 const current=embed('emb4',url,6),thumbnail={node:{attrs:{link:url}},pos:8};
 let documentNodes=[baseline,manual,previous,current,thumbnail],confirmed=false;
 let savedRun={appendTagBatch:true,rows:[{url}],cardBaselineKeys:['emb1','emb3'],cardKeys:[{key:'emb4',url}]};
 const ctx=harness().ctx;
 Object.assign(ctx,{
  embedNodes:()=>documentNodes.filter(hit=>hit.node.attrs.embeddedContentKey),
  readRun:()=>savedRun,writeRun:value=>{savedRun=value},
  page:{confirm:()=>true},saveOnce:async()=>({confirmed}),
  deleteVerifiedNotificationCardHits(view,hits){
   const removed=new Set(hits.map(hit=>hit.node));
   documentNodes=documentNodes.filter(entry=>!removed.has(entry.node));
   return removed.size;
  }
 });
 const cardCode=[
  section('function cardKey(hit)','function exactUrlParagraphs('),
  section('function appendBatchCardHits(','function generatedCardHits('),
  section('async function deleteMagazineBatchCards(','async function deleteNotificationCards(')
 ].join('\n');
 vm.runInContext(cardCode,ctx);
 const {appendBatchCardHits:match,deleteMagazineBatchCards:remove}=ctx;
 const draft={};
 assert.equal(match(draft,{...savedRun,cardKeys:[],pendingCard:{pos:6,url}},[{url}]).length,0,
  'a matching URL/position is insufficient to claim a manual embed');
 assert.deepEqual(Array.from(match(draft,{...savedRun,cardKeys:[],pendingCard:{url,receiptKey:'emb4'}},[{url}]),hit=>hit.node),[current.node]);
 documentNodes.push(embed('emb4',url,10));
 assert.throws(()=>match(draft,savedRun,[{url}]),'ambiguous embed keys must stop deletion');
 documentNodes.pop();
 const result=await remove(draft,savedRun);
 assert.equal(result.removedCards,1);
 assert.deepEqual(documentNodes,[baseline,manual,previous,thumbnail]);
 assert.equal(savedRun.appendCardDeleteSavePending,true,'retain the receipt until the edited draft saves');
 savedRun=JSON.parse(JSON.stringify(savedRun));confirmed=true;
 await remove(draft,savedRun);
 assert.equal(savedRun.cardKeys.length,0);
 assert.equal(savedRun.stage,'images_ready');
 await remove(draft,savedRun);
 assert.deepEqual(documentNodes,[baseline,manual,previous,thumbnail]);
}

async function main(){
 await testAppendCardOwnership();
 assert(source.includes("'始めのnote'"),'historical tag alias missing');
 assert(source.includes('const specialMode=mode,specialCount=count;'),'visible count should control both modes');
 const interrupted=harness(),fetch=interrupted.ctx.xhrJSON;
 let failed=false;
 interrupted.ctx.xhrJSON=async value=>{
  const route=new URL(value);
  if(!failed&&decodeURI(route.pathname).includes('/'+kanji+'/')&&route.searchParams.get('page')==='2'){failed=true;throw new Error('fixture offline')}
  return fetch(value);
 };
 await assert.rejects(interrupted.ctx.collectUnified(input,'all',0,'listed-tags',null,new Set([key(1)])),{code:'TAG_FEED_PAUSED'});
 assert(failed);
 assert.deepEqual(ids(await interrupted.ctx.collectUnified(input,'all',0,'listed-tags',null,new Set([key(1)]))),[2,4,6,11,12,15].map(key));
 const listed=harness();
 const result=await listed.ctx.collectUnified(input,'all',0,'listed-tags',null,new Set([key(1)]));
 assert.deepEqual(ids(result),[2,4,6,11,12,15].map(key));
 assert.equal(result.find(row=>row.key===key(6)).sourceScope.tag,intro);
 assert(!listed.requests.some(route=>route.pathname.includes('/creators/several/')),'#自己紹介 must not depend on article count');
 assert(tags.every(tag=>listed.requests.some(route=>decodeURI(route.pathname).includes('/'+tag+'/')&&route.searchParams.get('page')==='2')));
 const limited=harness();
 const newest=await limited.ctx.collectUnified(input,'number',3,'listed-tags',null,new Set([key(1)]));
 assert.deepEqual(ids(newest),[2,4,6].map(key));
 const resume=await limited.ctx.collectUnified(input,'number',3,'listed-tags',null,new Set([key(1),key(2)]));
 assert.deepEqual(ids(resume),[4,6,11].map(key),'an existing thumbnail does not count toward the resumed batch');
 const special=harness();
 special.presetSpecial({version:1,signature:JSON.stringify({tags:[...tags].sort(),policy:'strict-first-note-v3'}),out:[{key:key(5)}],states:[]});
 const fresh=await special.ctx.collectFirstNoteSpecial('number',200,tags);
 assert.deepEqual(ids(fresh),[2,4,6,11,15].map(key),'old selection must be reconsidered under the title and count filters');
 const scanned=special.checkpoint().scanned,requestCount=special.requests.length;
 assert.deepEqual(ids(await special.ctx.collectFirstNoteSpecial('number',200,tags)),ids(fresh));
 assert.equal(special.checkpoint().scanned,scanned);assert.equal(special.requests.length,requestCount,'resume an unchanged current-policy checkpoint');
 console.log('PASS: chronological hashtag feeds, first-note counts, self-introduction titles, exclusions, overlaps, existing thumbnails, batch card ownership, deletion retries and resume');
}
main().catch(error=>{console.error(error);process.exitCode=1});
