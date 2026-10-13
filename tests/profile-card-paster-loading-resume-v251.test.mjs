import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

function runtime(bridge){
 const dom=new JSDOM('',{url:'https://editor.note.com/notes/n123456789abc/edit'}),w=dom.window;
 const context=vm.createContext({window:w,document:w.document,location:w.location,localStorage:w.localStorage,unsafeWindow:{},URL,GM_getValue:()=>bridge,GM_setValue(){throw Error('must preserve imported history')},setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,console});
 let source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
 source=source.replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),resumeFixed300};})();`);
 vm.runInContext(source,context);return context;
}
test('continue can resume creator loading before 301 rows exist, preserving the loaded history and checkpoint',async()=>{
 const bridge={at:99,people:[{urlname:'one'},{urlname:'two'}]},c=runtime(bridge);
 const key='mumei_profile_like300_fix_v230:n123456789abc',checkpoint={signature:'99|300|exact-v250',index:1,rows:[{urlname:'one'}]};
 c.localStorage.setItem(key,JSON.stringify(checkpoint));c.events=[];
 c.window.open=()=>{throw Error('must not refetch history or navigate')};
 c.api.patch(`createFixed300=async()=>{events.push('continue')};setStatus=text=>events.push(text)`);
 await c.api.resumeFixed300();
 assert.equal(c.events.at(-1),'continue');assert.match(c.events[0],/確認済み 1人/);
 assert.deepEqual(JSON.parse(c.localStorage.getItem(key)),checkpoint);
});
test('continue without imported history stops without resetting or navigating',async()=>{
 const c=runtime(null);c.events=[];c.localStorage.setItem('unrelated','original');
 c.window.open=()=>{throw Error('must not navigate')};
 c.api.patch(`createFixed300=async()=>{throw Error('must not start')};setStatus=(text,bad)=>events.push({text,bad})`);
 await c.api.resumeFixed300();
 assert.match(c.events[0].text,/読み込みの続きがありません/);assert.equal(c.events[0].bad,true);
 assert.equal(c.localStorage.getItem('unrelated'),'original');assert.equal(c.localStorage.length,1);
});
