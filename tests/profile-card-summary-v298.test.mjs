import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {contentRuntime} from '../scripts/profile-card-content-v292.mjs';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';

const pref='mumei_profile_card_presentation_v292';
const freeBody='<p>週末の記録を書きます。</p><h2>観察の方法</h2><p>葉物野菜の保存で、容器を密閉する方法を試しました。</p><h2>保存後の比較</h2><p>冷蔵庫で3日後に確認すると、湿らせた紙で包んだ葉物野菜は乾燥しませんでした。</p>';
const row={urlname:'summary_creator',key:'n000000000001',url:'https://note.com/summary_creator/n/n000000000001',creator:'作者'};
const note={name:'葉物野菜の保存',key:row.key,user:{urlname:row.urlname},note_url:row.url,price:0,is_limited:false,body:freeBody,paywall:{is_simple_paid_note:true,context:{is_membership_connected:false}}};
const profile={urlname:row.urlname,profile:'園芸や家庭菜園を発信しています。'};

function helper(){
 const dom=new JSDOM('<div id="panel"><div class="body"><div class="amount"></div></div></div>',{url:'https://editor.note.com'});
 const page={},document=dom.window.document,localStorage=dom.window.localStorage;
 vm.runInNewContext(contentRuntime,{window:page,document,DOMParser:dom.window.DOMParser,localStorage});
 return {api:page.__MUMEI_PROFILE_CARD_CONTENT__,dom,document,localStorage};
}

test('the menu lists name, profile, opening and summary in order and saves the heading choice',t=>{
 const h=helper();t.after(()=>h.dom.window.close());
 h.api.mount(h.document.getElementById('panel'));
 const select=h.document.querySelector('[data-presentation-content]'),checkbox=h.document.querySelector('[data-presentation-ranges]');
 assert.deepEqual(Array.from(select.options,option=>option.textContent),['名前だけ','プロフィール','読み始め','要約']);
 assert.equal(checkbox.checked,false);
 select.value='lead';select.dispatchEvent(new h.dom.window.Event('change',{bubbles:true}));
 checkbox.click();
 assert.deepEqual(JSON.parse(h.localStorage.getItem(pref)),{size:'thin',content:'lead',showCreatorRanges:true});
});

test('a summary explains the method and later result in the public body without using the opening',t=>{
 const h=helper();t.after(()=>h.dom.window.close());
 const summary=h.api.compose(row,note,profile,{content:'summary',size:'medium'});
 assert.equal(summary.display,'summary');
 assert.equal(h.api.label(summary),'記事の要約');
 assert.match(summary.text,/容器を密閉する方法/);
 assert.match(summary.text,/3日後.*乾燥しなかった/);
 assert.doesNotMatch(summary.text,/週末の記録|抜粋/);
 assert.equal(summary.source.account,row.urlname);
 assert.equal(summary.source.key,row.key);
 assert.equal(summary.source.field,'free-article-body');
 const opening=h.api.compose(row,note,profile,{content:'lead'});
 assert.equal(opening.display,'lead');
 assert.match(opening.text,/^週末の記録/);
 assert.equal(h.api.label(opening),'読み始め');
});

test('reading mode and fallback preserve the requested mode, and missing profiles display just the name',t=>{
 const h=helper();t.after(()=>h.dom.window.close());
 for(const content of ['lead','summary']){
  const requested={content},opening=h.api.compose(row,{...note,body:'',description:'公開ページの読み始めです。'},profile,requested);
  assert.equal(opening.content,content);
  assert.equal(opening.display,'lead');
  assert.equal(opening.text,'公開ページの読み始めです。');
  const fallback=h.api.compose(row,{},profile,requested);
  assert.equal(fallback.display,'profile');
  assert.equal(fallback.source.kind,'profile');
  const missing=h.api.compose(row,{...note,price:500,description:''},{},requested);
  assert.equal(missing.display,'name');
  assert.equal(h.api.aboveText({...row,presentation:missing}),'');
 }
 assert.equal(h.api.compose(row,note,profile,{content:'profile'}).text,profile.profile);
 assert.equal(h.api.compose(row,note,{}, {content:'profile'}).display,'name');
 assert.equal(h.api.compose(row,note,profile,{content:'name'}).display,'name');
});

test('a public lead is not promoted to summary, and paid or membership bodies respect the free boundary',t=>{
 const h=helper();t.after(()=>h.dom.window.close());
 for(const restriction of [{price:980},{price:null},{price:undefined},{is_limited:true},{isLimited:true},{is_membership_only:true},{isMembershipOnly:true},{is_trial:true},{can_read:false},{paywall:{context:{is_membership_connected:true}}}]){
  const value=h.api.compose(row,{...note,...restriction},profile,{content:'summary'});
  assert.equal(value.display,'profile',JSON.stringify(restriction));
 }
 const paid={...note,price:980,separator:'paid',body:freeBody+'<p id="paid">購入者だけの秘密の本文です。</p>'};
 const partial=h.api.compose(row,paid,profile,{content:'summary',size:'medium'});
 assert.equal(partial.display,'summary');
 assert.equal(h.api.label(partial),'公開部分の要約');
 assert.doesNotMatch(partial.text,/購入者だけの秘密/);
 const lead=h.api.compose(row,{...note,price:980,description:freeBody},profile,{content:'summary'});
 assert.equal(lead.display,'lead');
});

test('generated creator cards, embedded formulas and generic opening text do not become summary points',t=>{
 const h=helper();t.after(()=>h.dom.window.close());
 const extended=freeBody+'<p>$$\u005ctext{プロフィールにある独自の語句です。}$$</p><figure>埋め込みカードの独自の語句です。</figure><h2>【スキをありがとう】</h2><p>埋め込みプロフィールの独自の語句を何回も表示しました。</p>';
 const value=h.api.compose(row,{...note,body:extended},profile,{content:'summary',size:'medium'});
 assert.equal(value.display,'summary');
 assert.doesNotMatch(value.text,/独自の語句|週末の記録/);
 assert.equal(h.api.compose(row,{...note,body:'<p>この一文から始まります。</p>'},profile,{content:'summary'}).display,'lead');
});

const compiled=(name,fn)=>test(name,{skip:!dependencies?'PM and canvas are required':false},fn);
for(const flow of ['normal','history'])for(const size of ['thin','medium'])compiled(flow+' '+size+' uses all three fallbacks and keeps each selected image link',async t=>{
 const localStorageMap=new Map([[pref,JSON.stringify({size,content:'summary'})]]);
 const r=await runtime({count:4,localStorageMap,requestMutator:(url,payload)=>{
  const path=new URL(url).pathname;
  if(path.endsWith('/notes/n000000000001'))Object.assign(payload.data,{name:note.name,body:freeBody,paywall:note.paywall});
  if(path.endsWith('/notes/n000000000002'))Object.assign(payload.data,{body:'',description:'冒頭の紹介です。'});
  if(/\/notes\/n00000000000[34]$/.test(path))Object.assign(payload.data,{body:'',description:''});
  if(path.endsWith('/creators/quality_person_3'))payload.data.creator.profile='';
  return payload;
 }});
 t.after(()=>r.close());
 if(flow==='history')r.editor.patch(`const originalGet=xhrJSON;xhrJSON=url=>url.endsWith('/creators/quality_person_3')?Promise.reject(new Error('プロフィール取得失敗')):originalGet(url);`);
 const run=await r[flow]();
 assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);
 assert.deepEqual(Array.from(run.rows.slice(0,4),item=>item.presentation.display),['summary','lead','profile','name']);
 assert.deepEqual(Array.from(run.rows.slice(0,4),item=>item.key),['n000000000001','n000000000002','n000000000003','n000000000004']);
 assert.equal(run.items.length,5);
 assert.deepEqual(Array.from(run.items,item=>item.url),Array.from(run.rows,item=>item.url));
 assert.ok(r.state.imageDimensions.every(image=>image.height===(size==='medium'?360:140)));
 assert.doesNotMatch(r.view.state.doc.textContent,/抜粋|無料公開本文を取得できません|人目/);
 await r.core.createCardsAtTap();
 assert.equal(r.editor.readRun().stage,'complete',r.state.statuses.at(-1)?.text);
 assert.deepEqual(r.state.cards,Array.from(run.rows,item=>item.url));
});

for(const flow of ['normal','history'])compiled(flow+' writes creator ranges only when enabled and retains them on resume',async t=>{
 const localStorageMap=new Map([[pref,JSON.stringify({showCreatorRanges:true})]]);
 const r=await runtime({count:2,localStorageMap});t.after(()=>r.close());
 r.state.failAt=2;await r[flow]();
 assert.equal(r.editor.readRun().showCreatorRanges,true);
 localStorageMap.set(pref,JSON.stringify({showCreatorRanges:false}));
 r.state.failAt=0;
 if(flow==='normal')await r.core.pasteSavedSpecial();
 else await r.editor.createFixed300();
 const run=r.editor.readRun();
 assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);
 assert.equal(run.showCreatorRanges,true);
 assert.equal(run.sectionHeadings.filter(heading=>/人目/.test(heading)).length,1);
});

compiled('history start-over applies the newly selected mode and heading preference',async t=>{
 const localStorageMap=new Map([[pref,JSON.stringify({content:'profile',showCreatorRanges:true})]]);
 const r=await runtime({count:2,localStorageMap});t.after(()=>r.close());
 await r.history();r.state.clock+=10;
 localStorageMap.set(pref,JSON.stringify({content:'lead',showCreatorRanges:false}));
 r.editor.patch('const testHistoryOptions=historyOptions;historyOptions=run=>testHistoryOptions(run||readRun());');
 await r.editor.patch('restartFixed300()');
 const run=r.editor.readRun();
 assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);
 assert.equal(run.showCreatorRanges,false);
 assert.equal(run.rows[0].presentation.display,'lead');
 assert.doesNotMatch(r.view.state.doc.textContent,/人目/);
});
