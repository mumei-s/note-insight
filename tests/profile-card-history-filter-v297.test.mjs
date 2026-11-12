import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';

const distribution=readFileSync('public/note-profile-card-likes300-fix-v220.user.js','utf8');
const html=readFileSync('public/note-profile-card-paster-history-export.html','utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const filter={fromDate:'2026-11-09',toDate:'2026-11-09',articleKey:'',timezone:'Asia/Tokyo'};
const plain=value=>JSON.parse(JSON.stringify(value));

function editor(){
 const dom=new JSDOM('<section id="mumei-profile-card-paster-v1"><div class="body"><select data-mode><option value="number">number</option><option value="all">all</option></select><input data-count value="200"><details data-like300><div class="special-actions"></div></details></div></section>',{url:'https://editor.note.com/notes/n123456789abc/edit',runScripts:'outside-only'});
 const w=dom.window,panel=w.document.querySelector('section'),detail=w.document.querySelector('details');
 const start=distribution.indexOf("const HISTORY_FILTER_PREF="),end=distribution.indexOf('function mediaUrl(',start);
 let code=distribution.slice(start,end);
 code=code.slice(0,code.indexOf("window.addEventListener('message'"));
 w.unsafeWindow=w;w.Date=class extends Date{static now(){return Date.parse('2026-11-08T15:00:01Z')}};
 w.eval(`const PANEL='mumei-profile-card-paster-v1',HISTORY_CANDIDATE_CAP=1500;let exportWaiter=null;const notifyFixedState=()=>{},setStatus=()=>{};function bindPanelAction(button,key,fn){button.addEventListener(key.split(':')[0],fn)};${code};window.api={historyToday,selectedHistoryFilter,historyOptions,checkpointHistoryOptions,historyFilterContains,patchHistoryFilterPanel,prepareLikesHistoryExport};`);
 w.api.patchHistoryFilterPanel(panel,detail);
 return{dom,w,panel,detail,api:w.api,field:name=>detail.querySelector('[data-history-'+name+']')};
}

test('the top count applies to all dates and to a selected day in Japan',()=>{
 const r=editor();try{
  assert.equal(r.api.selectedHistoryFilter(),null);
  assert.equal(r.field('period').value,'all');assert.equal(r.field('articles').value,'all');
  assert.equal(r.w.document.querySelector('[data-history-dates]').hidden,true);
  assert.equal(r.api.historyOptions().target,200);
  r.detail.querySelector('[data-a="history-today"]').click();
  assert.deepEqual(plain(r.api.selectedHistoryFilter()),filter);
  const options=r.api.historyOptions();assert.equal(options.mode,'number');assert.equal(options.target,200);
  r.panel.querySelector('[data-mode]').value='all';assert.equal(r.api.historyOptions().target,Infinity);
 }finally{r.dom.window.close()}
});

test('single day, inclusive range, selected article and invalid values do not fall back to recent likes',()=>{
 const r=editor();try{
  r.field('period').value='date';r.field('from').value='2026-10-03';
  assert.equal(r.api.selectedHistoryFilter().toDate,'2026-10-03');
  r.field('period').value='range';r.field('to').value='2026-10-05';r.field('articles').value='selected';r.field('article').value='https://note.com/ss_yr/n/n123456789abc?x=1';
  assert.deepEqual(plain(r.api.selectedHistoryFilter()),{...filter,fromDate:'2026-10-03',toDate:'2026-10-05',articleKey:'n123456789abc'});
  r.field('to').value='2026-10-01';assert.throws(()=>r.api.historyOptions(),/日付/);
  r.field('to').value='2026-10-05';r.field('article').value='https://example.com/n/n123456789abc';assert.throws(()=>r.api.historyOptions(),/記事URL/);
  r.field('article').value='n123456789abc';r.field('period').value='all';assert.equal(r.api.historyOptions().mode,'number');
 }finally{r.dom.window.close()}
});

test('filter controls survive repeated patching without losing typing and saved plans keep their original date',()=>{
 const r=editor();try{
  r.field('period').value='date';r.field('from').value='2026-10-12';r.field('from').dispatchEvent(new r.w.Event('input',{bubbles:true}));
  const input=r.field('from');r.api.patchHistoryFilterPanel(r.panel,r.detail);assert.equal(r.field('from'),input);
  assert.equal(JSON.parse(r.w.localStorage.getItem('mumei_profile_card_history_filter_v297')).fromDate,'2026-10-12');
  const saved=r.api.historyOptions({likesHistory:true,mode:'all',count:116,historyFilter:filter});assert.deepEqual(plain(saved.historyFilter),filter);
  assert.deepEqual(plain(r.api.checkpointHistoryOptions({historyFilter:filter}).historyFilter),filter);
  r.detail.querySelector('[data-history-filter]').remove();r.api.patchHistoryFilterPanel(r.panel,r.detail);assert.equal(r.field('from').value,'2026-10-12');
 }finally{r.dom.window.close()}
});

test('popup includes exact filter and a row at next midnight or with unknown like time is refused',async()=>{
 const r=editor();try{
  let url;r.w.open=value=>{url=new URL(value);return{close(){}}};r.field('period').value='today';
  const promise=r.api.prepareLikesHistoryExport(r.api.historyOptions());promise.catch(()=>{});
  assert.equal(url.searchParams.get('scope'),'filtered-likes');assert.equal(url.searchParams.get('fromDate'),'2026-11-09');assert.equal(url.searchParams.get('count'),'1500');
  assert.ok(r.api.historyFilterContains(filter,{likedAt:'2026-11-08T15:00:00Z'}));
  assert.ok(!r.api.historyFilterContains(filter,{likedAt:'2026-11-09T15:00:00Z'}));
  assert.ok(!r.api.historyFilterContains(filter,{likedAt:null,firstSeenAt:'2026-11-09T01:00:00Z'}));
 }finally{r.dom.window.close()}
});

async function reader(payload){
 const query=new URLSearchParams({request:'test',scope:'filtered-likes',count:'1500',...filter});
 const dom=new JSDOM(html,{url:'https://mumei-s.github.io/note-insight/note-profile-card-paster-history-export.html?'+query,runScripts:'outside-only'}),w=dom.window,messages=[],requests=[];
 w.localStorage.setItem('mumei-insight-active-account-v3','ss_yr');w.localStorage.setItem('mumei-insight-access-token','test-token');
 const before=JSON.stringify({...w.localStorage});w.opener={closed:false,postMessage:message=>messages.push(plain(message))};w.setTimeout=()=>1;
 w.fetch=async(url,options)=>{requests.push(JSON.parse(options.body));return{ok:true,json:async()=>payload}};
 w.eval(html.match(/<script>([\s\S]*?)<\/script>/)[1]);await tick();
 assert.equal(JSON.stringify({...w.localStorage}),before);assert.equal(requests[0].scope,'filtered-likes');assert.deepEqual(requests[0].filter,filter);
 w.close();return messages;
}
test('reader validates server contract, selected account and completeness before returning any rows',async()=>{
 const valid={ok:true,apiVersion:2,scope:'filtered-likes',filter,member:{noteId:'ss_yr'},total:1,rows:[{urlname:'person',likedAt:'2026-11-09T01:00:00Z'}]};
 assert.equal((await reader(valid))[0].ok,true);
 for(const payload of [{...valid,apiVersion:undefined},{...valid,filter:{...filter,toDate:'2026-11-10'}},{...valid,truncated:true},{...valid,rows:[]},{...valid,member:{noteId:'other'}}]){
  const [message]=await reader(payload);assert.equal(message.ok,false);assert.equal(message.rows,undefined);
 }
});

async function backend({likes=[],notifications=[],noteId='ss_yr'}={}){
 const requests=[],applicationId='member-uuid';let handler;
 const data={insight_public_likes:likes,insight_notifications:notifications,insight_member_sessions:[{id:'session',application_id:applicationId,expires_at:'2099-01-01',revoked_at:null}],insight_access_applications:[{id:applicationId,note_id:noteId,status:'active'}]};
 const db={from(table){const state={table,filters:[],orders:[],range:null},q={select(){return q},eq(k,v){state.filters.push(['eq',k,v]);return q},gte(k,v){state.filters.push(['gte',k,v]);return q},lt(k,v){state.filters.push(['lt',k,v]);return q},order(k,v={}){state.orders.push([k,v]);return q},range(a,b){state.range=[a,b];return q},update(){return q},maybeSingle(){return Promise.resolve({data:data[table][0],error:null})},then(resolve){requests.push(plain(state));let rows=[...(data[table]||[])].filter(row=>state.filters.every(([op,k,v])=>op==='eq'?row[k]===v:row[k]!=null&&(op==='gte'?Date.parse(row[k])>=Date.parse(v):Date.parse(row[k])<Date.parse(v))));rows.sort((a,b)=>{for(const[k,o]of state.orders){const order=String(a[k]||'').localeCompare(String(b[k]||''));if(order)return o.ascending===false?-order:order}return 0});if(state.range)rows=rows.slice(state.range[0],state.range[1]+1);return Promise.resolve({data:rows,error:null}).then(resolve)}};return q}};
 const source=readFileSync('supabase/functions/insight-likes-export/index.ts','utf8').replace(/^import .*\n/,'');
 const context={createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handler=fn},crypto:webcrypto,TextEncoder,Response,console:{error(){}}};
 vm.runInNewContext(stripTypeScriptTypes(source),context);
 return{requests,async run(body){const response=await handler(new Request('https://test/insight-likes-export',{method:'POST',headers:{'Content-Type':'application/json','X-Insight-Token':'fixture'},body:JSON.stringify({count:1500,scope:'filtered-likes',filter,...body})}));return{status:response.status,payload:await response.json()}}};
}
const article='n123456789abc';
const like=(id,at,extra={})=>({member_id:'owner',article_key:article,liker_key:id,actor_url:'https://note.com/'+id,actor_name:id,liked_at:at,...extra});
const event=(id,at,extra={})=>({id,member_id:'owner',notification_type:'like',actor_url:'https://note.com/'+id,actor_name:id,target_url:'https://note.com/ss_yr/n/'+article,occurred_at:at,...extra});

test('backend merges dated article likes with notification-only people, excluding other events, dates and accounts',async()=>{
 const r=await backend({likes:[like('alpha','2026-11-08T15:00:00Z'),like('alpha','2026-11-09T02:00:00Z'),like('end','2026-11-09T15:00:00Z'),like('old','2026-11-08T14:59:59Z'),like('unknown',null),like('foreign','2026-11-09T01:00:00Z',{member_id:'other'})],notifications:[event('alpha','2026-11-09T02:00:00Z'),event('beta','2026-11-09T03:00:00Z'),event('comment','2026-11-09T04:00:00Z',{notification_type:'comment_like'}),event('summary','2026-11-09T04:00:00Z',{meta:{summary:true}}),event('wrong-article','2026-11-09T04:00:00Z',{target_url:'https://note.com/other/n/'+article})]});
 const {payload,status}=await r.run();assert.equal(status,200);assert.equal(payload.apiVersion,2);assert.deepEqual(payload.filter,filter);assert.deepEqual(payload.rows.map(row=>row.urlname),['beta','alpha']);assert.equal(payload.total,2);assert.equal(payload.truncated,false);
 for(const request of r.requests.filter(r=>r.range)){
  assert.ok(request.filters.some(([op,k,v])=>op==='gte'&&v==='2026-11-08T15:00:00.000Z'));assert.ok(request.filters.some(([op,k,v])=>op==='lt'&&v==='2026-11-09T15:00:00.000Z'));
  assert.ok(request.filters.some(([op,k,v])=>k==='member_id'&&v==='owner'));
 }
});

test('selected article is filtered before creator deduplication and pagination crosses 1000 records',async()=>{
 const other='nffffffffffff',likes=Array.from({length:1002},(_,i)=>like('p'+i,'2026-11-09T03:00:00Z'));
 likes.push(like('p0','2026-11-09T04:00:00Z',{article_key:other}));
 const r=await backend({likes,notifications:[event('notification-only','2026-11-09T05:00:00Z'),event('wrong','2026-11-09T06:00:00Z',{target_url:'https://note.com/ss_yr/n/'+other})]});
 const {payload}=await r.run({filter:{...filter,articleKey:article}});assert.equal(payload.total,1003);assert.equal(payload.rows[0].urlname,'notification-only');assert.ok(payload.rows.every(row=>row.likedArticleKey===article));
 assert.ok(r.requests.some(row=>row.range?.[0]===1000));
});

test('backend refuses invalid dates, does not label a capped result complete and preserves member isolation',async()=>{
 for(const invalid of [{...filter,fromDate:'2026-02-30'},{...filter,toDate:'2026-11-08'},{...filter,articleKey:'malformed'}])assert.equal((await(await backend()).run({filter:invalid})).status,400);
 const r=await backend({likes:[like('one','2026-11-09T01:00:00Z'),like('two','2026-11-09T02:00:00Z')]});const {payload}=await r.run({count:1});assert.equal(payload.truncated,true);assert.equal(payload.total,2);assert.equal(payload.rows.length,1);
 const member=await backend({noteId:'another',likes:[like('private','2026-11-09T01:00:00Z',{member_id:'member-uuid'}),like('owner-private','2026-11-09T01:00:00Z')]});assert.deepEqual((await member.run()).payload.rows.map(row=>row.urlname),['private']);
});

test('real dated image flow saves the filter and pauses/resumes the exact plan, keeping the final extra entry',{skip:!dependencies},async t=>{
 const r=await runtime({count:3});t.after(()=>r.close());
 r.gm.set('mumei_profile_card_likes_300_v2',{at:297,historyFilter:filter,people:r.people.slice(0,3).map(p=>({...p,likedAt:'2026-11-09T01:00:00Z',likedArticleKey:article}))});
 r.state.pauseAt=1;await r.editor.createFixed300({mode:'all',count:1500,target:Infinity,historyFilter:filter});
 const initial=r.editor.readRun();assert.equal(initial.paused,true);assert.deepEqual(plain(initial.historyFilter),filter);assert.equal(initial.count,3);
 const reloaded=await r.reload();t.after(()=>reloaded.close());reloaded.state.pauseAt=0;await reloaded.history();
 const result=reloaded.editor.readRun();assert.equal(result.stage,'images_ready');assert.deepEqual(plain(result.historyFilter),filter);assert.equal(result.rows.length,4);
 assert.deepEqual(Array.from(result.rows.slice(0,-1),row=>row.likedArticleKey),[article,article,article]);assert.equal(result.rows.at(-1).urlname,'fuku444');assert.equal(result.items.length,4);
});

test('starting a dated batch again fetches a fresh snapshot before clearing the previous owned paste',{skip:!dependencies},async t=>{
 const r=await runtime({count:2});t.after(()=>r.close());
 const opts={mode:'all',count:1500,target:Infinity,historyFilter:filter};r.c.opts=opts;r.c.events=[];
 r.gm.set('mumei_profile_card_likes_300_v2',{at:297,historyFilter:filter,people:r.people.slice(0,2)});
 await r.editor.createFixed300(opts);r.editor.patch(`globalThis.restart=restartFixed300;const existingHistoryOptions=historyOptions;historyOptions=run=>run?existingHistoryOptions(run):opts;prepareLikesHistoryExport=async()=>{events.push('fetch')};const existingClear=clearCurrentPaste;clearCurrentPaste=(...args)=>{events.push('clear');return existingClear(...args)};createFixed300=async()=>{events.push('create')};`);
 await r.c.restart();assert.deepEqual(Array.from(r.c.events),['fetch','clear','create']);assert.deepEqual(plain(r.editor.readRun().historyFilter),filter);
});
