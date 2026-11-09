import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync('public/note-insight-notification-controls-v1.js','utf8'),ID='mumei-inline-notification-controls-v1';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){for(let i=0;i<100&&!check();i++)await sleep(15);assert.ok(check(),label)}

for(const attribute of ['hidden','style','class','aria-hidden'])test(`attribute-only notification reopen restores one toolbar (${attribute})`,async t=>{
 const dom=new JSDOM('<style>.closed{display:none}</style><header></header><main id="surface"><section class="m-navbarNotice"><button>通知</button><button>お知らせ</button><div class="m-navbarNoticeItem">人物さんがスキしました 1分前</div></section></main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:300,top:0,left:0,right:360,bottom:300});
 w.GM={getValue:async(_key,value)=>value,setValue:async()=>{}};
 let requests=0;w.fetch=async()=>{requests++;return Response.json({data:{urlname:'tester'}})};
 const surface=w.document.getElementById('surface');
 const show=visible=>{if(attribute==='style')surface.style.display=visible?'':'none';else if(attribute==='class')surface.className=visible?'':'closed';else if(visible)surface.removeAttribute(attribute);else surface.setAttribute(attribute,attribute==='hidden'?'':'true')};
 show(false);w.eval(source);await sleep(350);assert.equal(w.document.getElementById(ID),null);
 show(true);await until(()=>w.document.getElementById(ID),'reopening without child mutations restores toolbar');
 show(false);await until(()=>!w.document.getElementById(ID),'closing removes toolbar');
 show(true);await until(()=>w.document.querySelectorAll('#'+ID).length===1,'repeated reopen stays deduplicated');
 const before=requests;for(let i=0;i<30;i++)w.document.querySelector('header').classList.toggle('unrelated');await sleep(250);assert.equal(requests,before);
});
