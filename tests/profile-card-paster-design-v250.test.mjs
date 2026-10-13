import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
test('50 random designs cover each pool without adjacent repeats, including pool boundaries and resume',()=>{
 const body=source.slice(source.indexOf('function assignDesigns('),source.indexOf('const palettes='));
 const context=vm.createContext({});vm.runInContext(body,context);
 const rows=Array.from({length:301},(_,i)=>({index:i+1}));
 const plans=[];
 for(let trial=0;trial<12;trial++){
  const plan=context.assignDesigns(rows);plans.push(plan.map(r=>r.designIndex).join(','));
  assert.equal(plan.length,301);
  for(let i=1;i<plan.length;i++)assert.notEqual(plan[i].designIndex,plan[i-1].designIndex);
  for(let i=0;i<300;i+=50)assert.equal(new Set(plan.slice(i,i+50).map(r=>r.designIndex)).size,50);
  assert.equal(context.assignDesigns(plan),plan);
 }
 assert.ok(new Set(plans).size>1);
});

test('dedicated history page requests only saved history and leaves INSIGHT state intact',async()=>{
 const html=readFileSync('public/note-profile-card-paster-history-export.html','utf8');
 const dom=new JSDOM(html,{url:'https://mumei-s.github.io/note-insight/note-profile-card-paster-history-export.html?request=test&count=500',runScripts:'outside-only'});
 const w=dom.window;w.localStorage.setItem('mumei-insight-active-account-v3','ss_yr');w.localStorage.setItem('mumei-insight-access-token','saved-token');
 let posted,request;w.opener={closed:false,postMessage:(payload,origin)=>{posted={payload,origin}}};w.close=()=>{};w.setTimeout=()=>1;
 w.fetch=async(url,options)=>{request={url,options};return{ok:true,json:async()=>({ok:true,member:{noteId:'ss_yr'},rows:[{urlname:'one'}]})}};
 const set=w.localStorage.setItem.bind(w.localStorage);w.Storage.prototype.setItem=()=>{throw Error('unexpected auth write')};
 w.eval(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(JSON.parse(request.options.body).scope,'recent-likes');
 assert.equal(posted.origin,'https://editor.note.com');assert.equal(posted.payload.ok,true);
 assert.equal(w.localStorage.getItem('mumei-insight-access-token'),'saved-token');assert.equal(w.localStorage.length,2);
 assert.doesNotMatch(html,/<(?:script[^>]*src|iframe)|location\.(?:replace|assign)|localStorage\.(?:setItem|removeItem|clear)/);
 w.Storage.prototype.setItem=set;dom.window.close();
});
