import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const src=readFileSync('public/note-insight-notification-controls-v1.js','utf8');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('unrelated note mutations do not keep searching for the native notification panel',async t=>{
 const d=new JSDOM('<main id="unrelated"></main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=d.window;t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,top:0,left:0,right:360,bottom:100});
 w.GM={getValue:async(_key,value)=>value,setValue:async()=>{}};
 w.fetch=async()=>Response.json({data:{urlname:'tester'}});
 let searches=0;
 w.__mumeiNotificationReaderV4={findPanel:()=>{searches++;return w.document.querySelector('.m-navbarNotice')}};
 w.eval(src);
 await sleep(300);const baseline=searches;
 for(let i=0;i<30;i++)w.document.getElementById('unrelated').append(w.document.createElement('span'));
 await sleep(310);
 assert.equal(searches,baseline,'non-notification text must not rescan the native panel');
 const panel=w.document.createElement('main');panel.className='m-navbarNotice';
 panel.innerHTML='<button>通知</button><button>お知らせ</button><div class="m-navbarNoticeItem">人物さんがスキしました 1分前</div>';
 w.document.body.append(panel);
 await sleep(340);
 assert.ok(searches>baseline,'new native notification panel is detected');
});
test('controls and wrapper keep the new @require fingerprint and no data-clear path',()=>{
 const wrapper=readFileSync('public/note-insight-notification-v3.user.js','utf8');
 assert.match(src,/function relevantNoticeChange/);
 assert.match(src,/records.some\(relevantNoticeChange\)/);
 const controlsVersion=src.match(/const VERSION='([^']+)'/)[1];
 assert.ok(wrapper.includes('note-insight-notification-controls-v1.js?v='+controlsVersion.replaceAll('.','')));
 const release=JSON.parse(readFileSync('public/insight-release.json','utf8'));
 assert.equal(wrapper.match(/^\/\/ @version\s+(\S+)/m)?.[1],release.notificationVersion);
 assert.doesNotMatch(src,/localStorage\.clear\(|GM\.deleteValue\(/);
});
