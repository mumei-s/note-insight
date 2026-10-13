import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync('public/insight-likes-export.html','utf8');
function reader(saved){
 const dom=new JSDOM('',{url:'https://mumei-s.github.io/note-insight/insight-likes-export.html',runScripts:'outside-only'});
 for(const[k,v]of Object.entries(saved))dom.window.localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
 const script=html.match(/function savedMemberToken\(\)[\s\S]*?(?=\n  async function run)/)[0];
 dom.window.eval('const TOKEN_KEY="mumei-insight-access-token";'+script+';window.readToken=savedMemberToken;');return dom;
}
test('the export page reuses the selected saved login without switching accounts or writing storage',()=>{
 const d=reader({'mumei-insight-active-account-v3':'ss_yr','mumei-insight-saved-accounts-v3':[{noteId:'ss_yr',status:'active',memberToken:'test-token'},{noteId:'other',status:'active',memberToken:'other-token'}]});
 assert.equal(d.window.readToken(),'test-token');assert.equal(d.window.localStorage.getItem('mumei-insight-access-token'),null);d.window.close();
});
test('export never resurrects an explicitly logged-out account or guesses between identities',()=>{
 for(const saved of [
  {'mumei-insight-active-account-v3':'ss_yr','mumei-insight-explicit-logout:ss_yr':'1','mumei-insight-access-token':'test-token'},
  {'mumei-insight-saved-accounts-v3':[{noteId:'ss_yr',status:'active',memberToken:'test-token'},{noteId:'other',status:'active',memberToken:'other-token'}]}
 ]){const d=reader(saved);assert.equal(d.window.readToken(),'');d.window.close();}
});
test('a single saved active login is reusable on the standalone export page',()=>{
 const d=reader({'mumei-insight-saved-accounts-v2':[{noteId:'ss_yr',status:'active',memberToken:'test-token'}]});assert.equal(d.window.readToken(),'test-token');d.window.close();
});

test('standalone export only requests likes and returns them to the editor without starting INSIGHT or changing storage',async()=>{
 const dom=new JSDOM(html,{url:'https://mumei-s.github.io/note-insight/insight-likes-export.html?request=test-300&count=500&unique=1&scope=recent-articles',runScripts:'outside-only'});
 const w=dom.window,requests=[],messages=[];
 w.localStorage.setItem('mumei-insight-access-token','saved-session');
 const initialStorage=JSON.stringify({...w.localStorage});
 w.opener={closed:false,postMessage:(payload,origin)=>messages.push({payload,origin})};
 w.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({ok:true,rows:[{urlname:'creator'}],sourceArticles:[{articleKey:'test'}]})}};
 w.eval(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests.length,1);assert.match(requests[0].url,/\/functions\/v1\/insight-likes-export$/);
 assert.deepEqual(JSON.parse(requests[0].options.body),{count:500,unique:true,scope:'recent-articles'});
 assert.equal(requests[0].options.headers['X-Insight-Token'],'saved-session');
 assert.equal(messages[0].origin,'https://editor.note.com');assert.equal(messages[0].payload.requestId,'test-300');assert.equal(messages[0].payload.rows[0].urlname,'creator');
 assert.equal(JSON.stringify({...w.localStorage}),initialStorage);assert.equal(w.document.querySelector('script[src]'),null);
 assert.equal(w.location.pathname,'/note-insight/insight-likes-export.html');dom.window.close();
});
