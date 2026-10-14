import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const paths=['public/note-profile-card-paster-v1.user.js','public/note-profile-card-likes300-fix-v220.user.js'];
const codes=paths.map(path=>readFileSync(path,'utf8'));
function runtime(url){
 const counts={events:0,timers:0,storage:0,network:0},page={addEventListener(){counts.events++}};
 const window={addEventListener(){counts.events++},dispatchEvent(){},Event};
 const document={readyState:'loading',addEventListener(){counts.events++},getElementById(){return null}};
 const localStorage={getItem(){counts.storage++;return null},setItem(){counts.storage++},removeItem(){counts.storage++}};
 const context=vm.createContext({unsafeWindow:page,window,document,localStorage,location:new URL(url),URL,Event,GM_getValue(){counts.storage++;return null},GM_setValue(){counts.storage++},GM_xmlhttpRequest(){counts.network++;throw Error('unexpected network')},setInterval(){counts.timers++;return 1},clearInterval(){},setTimeout(){counts.timers++;return 1},clearTimeout(){}});
 return{context,page,counts};
}
test('both installed identities are self-contained editor tools with the same implementation',()=>{
 for(const code of codes){assert.match(code,/@version\s+2\.6\.2/);assert.match(code,/@name\s+無名S note 極薄サムネイル\n/);assert.doesNotMatch(code,/@name[ \t]+[^\n]*(?:INSIGHT|300)/);assert.doesNotMatch(code,/@require/);assert.match(code,/@match\s+https:\/\/editor\.note\.com\/\*/);assert.doesNotMatch(code,/createInsightLikes300|buildInsightLikeRows|INSIGHTで準備/);assert.match(code,/極薄サム v/);}
 assert.equal(codes[0].slice(codes[0].indexOf('(function(){')),codes[1].slice(codes[1].indexOf('(function(){')));
});
test('neither identity runs on INSIGHT, note profile pages, or the history reader',()=>{
 for(const code of codes)for(const url of ['https://mumei-s.github.io/note-insight/','https://note.com/ss_yr','https://mumei-s.github.io/note-insight/note-profile-card-paster-history-export.html']){
  const c=runtime(url),keys=Object.keys(c.page);vm.runInContext(code,c.context);assert.deepEqual(c.counts,{events:0,timers:0,storage:0,network:0});assert.deepEqual(Object.keys(c.page),keys);
 }
});
test('both identities enabled still register the editor and message handlers only once',()=>{
 for(const ordered of [codes,[...codes].reverse()]){
  const c=runtime('https://editor.note.com/notes/n123456789abc/edit');vm.runInContext(ordered[0],c.context);
  const first={...c.counts},store=c.page.__MUMEI_PROFILE_CARD_RUN_STORE__;
  assert.equal(c.page.__MUMEI_PROFILE_CARD_STANDALONE_VERSION__,'2.6.2');assert.ok(store);assert.equal(c.counts.network,0);
  vm.runInContext(ordered[1],c.context);assert.deepEqual(c.counts,first);assert.equal(c.page.__MUMEI_PROFILE_CARD_RUN_STORE__,store);
 }
});
test('legacy checkpoint prefixes are preserved in the single-file builds',()=>{
 for(const code of codes)for(const key of ['mumei_profile_card_paster_run_v15:','mumei_profile_card_run_backup_v253:','mumei_profile_card_likes_300_v2'])assert.ok(code.includes(key));
});
