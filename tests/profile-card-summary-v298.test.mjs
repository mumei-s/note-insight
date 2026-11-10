import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {contentRuntime} from '../scripts/profile-card-content-v292.mjs';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';

function helper(){
 const dom=new JSDOM(''),page={};
 vm.runInNewContext(contentRuntime,{window:page,document:dom.window.document,DOMParser:dom.window.DOMParser,localStorage:{getItem:()=>null,setItem(){}}});
 return{api:page.__MUMEI_PROFILE_CARD_CONTENT__,close:()=>dom.window.close()};
}
const row={urlname:'summary_creator',key:'n000000000001',url:'https://note.com/summary_creator/n/n000000000001',creator:'作者'};
// Mirrors the public v3 response observed for the reported ioRe article:
// a zero price and no access restriction, alongside a true UI feature flag.
const note={key:row.key,user:{urlname:row.urlname},note_url:row.url,price:0,is_limited:false,separator:'',description:'',body:'<p>公開された本文を読み取ります。</p><p>紹介文として使う段落です。</p>',paywall:{is_simple_paid_note:true,is_simple_paid_note_test_a:false,context:{is_show_limited_pay_note_paywall:false,is_membership_connected:false}}};

test('v3 paywall display flag does not hide a free unrestricted article',()=>{
 const h=helper(),value=h.api.compose(row,note,{},{content:'summary',size:'medium'});
 assert.equal(value.status,'available');assert.equal(value.text,'公開された本文を読み取ります。\n紹介文として使う段落です。');
 assert.equal(value.source.field,'free-article-body');assert.equal(value.source.account,row.urlname);assert.equal(value.source.key,row.key);h.close();
});
test('price and real access restrictions still prevent using an unbounded body',()=>{
 const h=helper();
 for(const override of [{price:980},{price:980,paywall:{is_simple_paid_note:false}},{price:null},{price:undefined},{price:0,is_limited:true},{price:0,isLimited:true},{price:0,is_membership_only:true},{price:0,isMembershipOnly:true},{price:0,paywall:{context:{is_membership_connected:true}}}]){
  assert.equal(h.api.compose(row,{...note,...override},{},{content:'summary'}).status,'unavailable',JSON.stringify(override));
 }
 h.close();
});
test('paid article uses only content before its verified separator',()=>{
 const h=helper(),value=h.api.compose(row,{...note,price:980,separator:'paid',body:'<p>無料で読める部分です。</p><p id="paid">購入者だけの本文です。</p>'},{},{content:'summary'});
 assert.equal(value.status,'available');assert.equal(value.text,'無料で読める部分です。');assert.equal(value.source.field,'body-before-separator');h.close();
});
test('public lead remains available when the full-body boundary is unknown',()=>{
 const h=helper(),value=h.api.compose(row,{...note,price:980,description:'著者が公開している記事の説明。'},{},{content:'summary'});
 assert.equal(value.status,'available');assert.equal(value.source.field,'description');h.close();
});

const compiled=(name,fn)=>test(name,{skip:!dependencies?'PM and canvas are required':false},fn);
for(const flow of ['normal','history'])for(const size of ['thin','medium'])compiled(flow+' '+size+' generates real summaries when the UI flag is true',async()=>{
 const localStorageMap=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size,content:'summary'})]]);
 const r=await runtime({count:2,localStorageMap,requestMutator:(url,payload)=>{
  if(/\/api\/v3\/notes\/n[a-f0-9]+$/.test(new URL(url).pathname))Object.assign(payload.data,{price:0,is_limited:false,body:note.body,paywall:note.paywall});return payload;
 }});
 try{
  const run=await r[flow]();assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.equal(r.state.images.length,3);
  assert.ok(run.rows.every(person=>person.presentation.status==='available'&&person.presentation.text.includes('公開された本文')));
  assert.ok(!JSON.stringify(run).includes('無料公開本文を取得できません'));assert.ok(!r.view.state.doc.textContent.includes('無料公開本文を取得できません'));
  assert.ok(r.state.imageDimensions.every(image=>image.height===(size==='medium'?360:140)));
 }finally{r.close();}
});

function alternateFixture({unavailable=new Set([0]),noAlternative=new Set(),outsideScope=false}={}){
 const alternatives=new Map();
 return(url,payload)=>{
  const path=new URL(url).pathname,creator=path.match(/\/creators\/(quality_person_(\d+))\/contents$/),detail=path.match(/\/notes\/(n[a-f0-9]{12})$/);
  if(creator&&unavailable.has(Number(creator[2]))&&!noAlternative.has(Number(creator[2]))){
   const original=payload.data.contents[0];if(original){
    const number=Number(creator[2]),key='n'+(0x100000+number).toString(16).padStart(12,'0');
    const value={...original,key,noteUrl:'https://note.com/'+creator[1]+'/n/'+key,name:'切り替えた別の記事 '+number,body:'<p>別の記事の無料公開部分です。</p>',price:0,eyecatch_url:'https://assets.st-note.com/alternate'+number+'.png',eyecatch:{url:'https://assets.st-note.com/alternate'+number+'.png'},paywall:note.paywall};
    if(outsideScope)value.hashtags=['別のタグ'];alternatives.set(key,value);payload.data.contents.push(value);
   }
  }
  if(detail){
   if(alternatives.has(detail[1]))payload.data={...alternatives.get(detail[1])};
   else{const index=parseInt(detail[1].slice(1),16)-1;if(unavailable.has(index))Object.assign(payload.data,{body:'',description:'',price:0});}
  }
  return payload;
 };
}
for(const flow of ['normal','history'])for(const size of ['thin','medium'])compiled(flow+' '+size+' switches the summary, cover and link to the same alternate article',async()=>{
 const localStorageMap=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size,content:'summary'})]]);
 const r=await runtime({count:2,localStorageMap,requestMutator:alternateFixture()});
 try{
  const run=await r[flow]();assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.equal(run.items.length,3);
  const first=run.rows[0];assert.equal(first.urlname,'quality_person_0');assert.equal(first.key,'n000000100000');
  assert.equal(first.presentation.status,'available');assert.equal(first.presentation.text,'別の記事の無料公開部分です。');assert.equal(first.presentation.source.key,first.key);
  assert.equal(first.thumbUrl,'https://assets.st-note.com/alternate0.png');assert.equal(first.title,'切り替えた別の記事 0');assert.equal(first.summaryFallback.fromKey,'n000000000001');assert.ok(!run.qualityHold);
  const images=[];r.view.state.doc.descendants(node=>{if(node.type.name==='image')images.push(node)});assert.equal(images[0].attrs.link,first.url);
  if(flow==='normal'){await r.core.createCardsAtTap();assert.equal(r.state.cards[0],first.url);}else{assert.equal(r.quality.assessIdentity(first).some(value=>value.status==='mismatch'),false);}
 }finally{r.close();}
});
for(const flow of ['normal','history'])compiled(flow+' skips creators with no readable article and keeps running',async()=>{
 const localStorageMap=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'})]]);
 const r=await runtime({count:2,localStorageMap,requestMutator:alternateFixture({noAlternative:new Set([0])})});
 try{
  const run=await r[flow]();assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);
  assert.ok(run.rows.every(row=>row.urlname!=='quality_person_0'));assert.equal(run.rows.at(-1).finalMarker,true);
  assert.ok(run.rows.every(row=>row.presentation.status==='available'));assert.equal(r.state.images.length,flow==='history'?3:2);
 }finally{r.close();}
});
for(const flow of ['normal','history'])compiled(flow+' still finishes when every creator lacks a summary',async()=>{
 const localStorageMap=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'})]]);
 const r=await runtime({count:2,localStorageMap,requestMutator:(url,payload)=>{
  if(/\/api\/v3\/notes\/n[a-f0-9]+$/.test(new URL(url).pathname))Object.assign(payload.data,{body:'',description:'',price:0});return payload;
 }});
 try{
  const run=await r[flow]();assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.equal(r.state.images.length,1);
  assert.equal(run.rows.length,1);assert.equal(run.rows[0].finalMarker,true);assert.equal(run.rows[0].presentation.content,'name');
 }finally{r.close();}
});
compiled('fallback keeps the selected hashtag instead of using an unrelated article',async()=>{
 const localStorageMap=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'summary'})]]);
 const r=await runtime({count:2,localStorageMap,requestMutator:alternateFixture({outsideScope:true})});
 try{const run=await r.normal();assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.ok(run.rows.every(person=>person.urlname!=='quality_person_0'));assert.ok(!run.qualityHold);}finally{r.close();}
});
compiled('resume refreshes only missing pending summaries and retains the completed image',async()=>{
 const localStorageMap=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'})]]);
 const r=await runtime({count:3,localStorageMap});
 try{
  r.state.pauseAt=1;await r.history();const paused=r.editor.readRun();assert.equal(paused.items.length,1);
  const first=r.state.images[0].png;r.editor.writeRun({...paused,rows:paused.rows.map((row,index)=>index===1?{...row,presentation:{...row.presentation,status:'unavailable',text:'無料公開本文を取得できません'}}:row)});
  r.state.requestMutator=alternateFixture({unavailable:new Set([1])});r.state.pauseAt=0;
  const run=await r.history();assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.equal(run.items.length,4);assert.equal(r.state.images.length,4);assert.equal(r.state.images[0].png,first);
  assert.equal(run.rows[1].summaryFallback.fromKey,'n000000000002');assert.equal(run.rows[1].presentation.status,'available');
 }finally{r.close();}
});
compiled('restart refreshes cached unavailable summaries before replacing old generated images',async()=>{
 const localStorageMap=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'})]]);
 const r=await runtime({count:2,localStorageMap});
 try{
  const previous=await r.history();r.editor.writeRun({...previous,version:'2.9.7',rows:previous.rows.map(row=>({...row,presentation:{...row.presentation,status:'unavailable',text:'無料公開本文を取得できません'}}))});
  r.state.requestMutator=(url,payload)=>{if(/\/api\/v3\/notes\/n[a-f0-9]+$/.test(new URL(url).pathname))Object.assign(payload.data,{price:0,body:note.body,paywall:note.paywall});return payload;};
  r.editor.patch("const beforeSummaryHistoryOptions=historyOptions;historyOptions=run=>run?beforeSummaryHistoryOptions(run):{mode:'number',count:state.targetCount,target:state.targetCount};globalThis.restartSummaryHistory=restartFixed300;");
  await r.c.restartSummaryHistory();const run=r.editor.readRun();assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.ok(run.rows.every(row=>row.presentation.status==='available'&&row.presentation.text.includes('公開された本文')));
  assert.equal(run.items.length,3);const images=[];r.view.state.doc.descendants(node=>{if(node.type.name==='image')images.push(node)});assert.equal(images.length,3);
 }finally{r.close();}
});
