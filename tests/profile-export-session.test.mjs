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
