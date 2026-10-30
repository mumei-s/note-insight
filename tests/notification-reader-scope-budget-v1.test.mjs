import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const reader=readFileSync('public/note-insight-notification-reader-v4.js','utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('new notification head is observed and unrelated note changes are ignored',async t=>{
 const d=new JSDOM('<main id="other"></main><section data-mumei-notice-shell-v2958="1"><div class="m-navbarNoticeItem" data-notice-id="1">通知 1分前</div></section>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=d.window;t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,top:0,bottom:100,left:0,right:360});
 w.GM={getValue:async(_k,v)=>v};
 let calls=0;
 w.__mumeiNotificationNetwork3300={syncCurrent:async()=>{calls++;return{historyComplete:true}},stop(){}};
 w.eval(reader);
 await wait(450);assert.equal(calls,1);
 for(let i=0;i<25;i++)w.document.getElementById('other').append(w.document.createElement('span'));
 await wait(300);assert.equal(calls,1);
 const shell=w.document.querySelector('[data-mumei-notice-shell-v2958="1"]');
 const n=w.document.createElement('div');n.className='m-navbarNoticeItem';n.dataset.noticeId='2';n.textContent='新しい通知 たった今';shell.prepend(n);
 await wait(450);assert.equal(calls,2,'native head change still starts one delta');
});
test('reader scopes mutation callbacks and avoids indefinitely postponing an earlier scan',()=>{
 assert.match(reader,/records\.some\(noticeMutation\)/);
 assert.match(reader,/if\(autoTimer&&wait>0&&autoDueAt<=due\)return/);
 assert.match(reader,/now-lastIdleProbe>=30000/);
 assert.match(reader,/messages.*rooms/);
});
