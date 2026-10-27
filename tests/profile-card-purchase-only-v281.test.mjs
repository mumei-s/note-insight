import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const path='public/note-profile-card-paster-purchased.user.js';
const code=readFileSync(path,'utf8'),panelId='mumei-purchased-review-panel';
function data(count=27){return{format:'mumei-note-purchase-review-v1',items:Array.from({length:count},(_,i)=>({urlname:'creator'+i,key:'n'+i.toString(16).padStart(12,'0'),url:'https://note.com/creator'+i+'/n/n'+i.toString(16).padStart(12,'0'),creator:'作者'+i,displayCreator:'作者'+i+'さん',title:'記事'+i,summary:'無料公開部分から作成した短い紹介文です。',thumbUrl:'https://assets.st-note.com/test.jpg',sourceScope:'public-free-section',sourceCheckedAt:'2026-10-27T00:00:00Z'}))}}
async function runtime(t,url='https://editor.note.com/notes/n123456789abc/edit'){
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="original">元の記事</div><div id="mumei-profile-card-paster-v1">旧パネル</div><button id="mumei-profile-card-paster-v1-mini">旧</button></body></html>',{url,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,observers=[],gm=new Map(),errors=[],counts={network:0,writes:0,reads:0};
 const NativeObserver=w.MutationObserver;
 w.MutationObserver=class extends NativeObserver{constructor(cb){super(cb);observers.push(this)}};
 w.unsafeWindow=w;w.GM_getValue=(key,fallback)=>{counts.reads++;return gm.get(key)??fallback};w.GM_setValue=(key,value)=>{counts.writes++;gm.set(key,structuredClone(value))};
 w.GM_xmlhttpRequest=()=>{counts.network++;throw Error('Unexpected network request')};
 w.addEventListener('error',event=>{errors.push(event.error||event.message);event.preventDefault()});
 t.after(()=>{observers.forEach(x=>x.disconnect());w.close()});
 const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(errors,[])};
 w.eval(code);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await flush();
 return{w,counts,gm,flush,panel:()=>w.document.getElementById(panelId)};
}
test('dedicated publication includes no gallery, profile, like-history or URL-entry workflow',()=>{
 assert.match(code,/@name\s+無名S note 購入記事紹介/);assert.match(code,/@version\s+2\.8\.2/);
 assert.doesNotMatch(code,/ハロウィン|スキ履歴|data-sources|data-gallery126|data-like300|@require|createInsight|gallery126/);
 assert.ok(Buffer.byteLength(code)<80000,'the dedicated tool does not include the general-purpose bundle');
});
test('purchase actions are visible at startup with no disclosure, and old panels cannot cover them',async t=>{
 const r=await runtime(t),panel=r.panel();assert.ok(panel);
 assert.equal(panel.querySelectorAll('details,textarea,select').length,0);
 for(const selector of ['[data-purchase-import]','[data-purchase-start]','[data-purchase-pause]','[data-purchase-stop]','[data-purchase-delete]','[data-purchase-cards]','[data-purchase-delete-cards]']){
  const button=panel.querySelector(selector);assert.ok(button);assert.equal(button.type,'button');assert.equal(button.disabled,false);
  assert.equal(button.closest('[hidden],details'),null);
 }
 assert.equal(r.w.getComputedStyle(r.w.document.getElementById('mumei-profile-card-paster-v1')).display,'none');
 assert.equal(r.w.getComputedStyle(r.w.document.getElementById('mumei-profile-card-paster-v1-mini')).display,'none');
 assert.equal(r.w.document.getElementById('original').textContent,'元の記事');
 assert.deepEqual(r.counts,{network:0,writes:0,reads:0});
});
test('the visible picker imports all 27 verified rows and one gesture opens it only once',async t=>{
 const r=await runtime(t),file=r.panel().querySelector('[data-purchase-file]');let opens=0;
 file.click=()=>{opens++};r.panel().querySelector('[data-purchase-import]').click();assert.equal(opens,1);
 Object.defineProperty(file,'files',{configurable:true,value:[{size:30000,text:async()=>JSON.stringify(data())}]});
 file.dispatchEvent(new r.w.Event('change'));await r.flush();
 assert.equal(r.gm.get('mumei_purchase_review_prepared_v1').items.length,27);
 assert.match(r.w.document.getElementById(panelId+'-status').textContent,/27件を読込済み/);
 assert.equal(r.counts.network,0);assert.equal(r.counts.writes,1);
});
test('dedicated mount is idempotent, restores its own panel, and remains separate from stored source preferences',async t=>{
 const r=await runtime(t);r.w.localStorage.setItem('mumei_profile_card_paster_v1',JSON.stringify({sources:'古い記事名'}));
 r.w.eval(code);r.w.dispatchEvent(new r.w.Event('pageshow'));await r.flush();
 assert.equal(r.w.document.querySelectorAll('#'+panelId).length,1);
 assert.doesNotMatch(r.panel().textContent,/古い記事名/);
 r.panel().remove();await r.flush();assert.ok(r.panel().querySelector('[data-purchase-start]'));
 assert.equal(r.w.document.querySelectorAll('#'+panelId+'-mini').length,1);
 assert.equal(r.w.localStorage.getItem('mumei_profile_card_paster_v1'),JSON.stringify({sources:'古い記事名'}));
});
test('dedicated close/reopen and pause controls preserve the article and never invoke host navigation',async t=>{
 const r=await runtime(t);let navigations=0;r.w.document.addEventListener('click',()=>navigations++);
 r.panel().querySelector('[data-close]').click();assert.ok(r.panel().classList.contains('tiny'));
 r.w.document.getElementById(panelId+'-mini').click();assert.ok(!r.panel().classList.contains('tiny'));
 const pause=r.panel().querySelector('[data-purchase-pause]');pause.dispatchEvent(new r.w.Event('pointerdown',{bubbles:true,cancelable:true}));pause.click();await r.flush();
 assert.equal(pause.disabled,false);assert.match(r.w.document.getElementById(panelId+'-status').textContent,/停止中/);
 assert.equal(navigations,0);assert.equal(r.w.document.getElementById('original').textContent,'元の記事');
 assert.equal(r.counts.network,0);assert.equal(r.counts.writes,0);
});
test('the dedicated tool is inert outside the note editor',async t=>{
 for(const url of ['https://note.com/ss_yr','https://mumei-s.github.io/note-insight/']){
  const r=await runtime(t,url);assert.equal(r.panel(),null);assert.deepEqual(r.counts,{network:0,writes:0,reads:0});
  assert.notEqual(r.w.getComputedStyle(r.w.document.getElementById('mumei-profile-card-paster-v1')).display,'none');
 }
});

test('the actual dedicated bundle pastes the 27 imported entries, confirms native saving and resumes without duplication',async t=>{
 const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:'https://editor.note.com/notes/n123456789abc/edit',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,gm=new Map(),blocks=[];let uploads=0,saves=0;
 w.unsafeWindow=w;w.MutationObserver=undefined;w.GM_getValue=(key,fallback)=>gm.get(key)??fallback;w.GM_setValue=(key,value)=>gm.set(key,structuredClone(value));
 w.noteEditor={registerNoteDraft(){saves++;return true}};
 t.after(()=>w.close());
 gm.set('mumei_purchase_review_prepared_v1',data());
 w.__fixture={blocks,get uploads(){return uploads},saveUpload(){uploads++}};
 const injection=`
 const fixture=page.__fixture;
 const view={state:{doc:{content:{get size(){return fixture.blocks.length}}},selection:{from:0}}};
 findView=()=>view;nativeImageCommand=()=>()=>true;selectionApi=()=>({});
 imageNodes=()=>fixture.blocks.flatMap((node,pos)=>node.image?[{node,pos}]:[]);embedNodes=()=>[];
 makePurchasedReviewFile=async row=>({name:row.key+'.png'});
 uploadOne=async(_view,row,_file,pos)=>{const node={image:true,attrs:{id:row.key,src:row.key+'.png',link:row.url},nodeSize:1};fixture.blocks.splice(pos,0,node);fixture.saveUpload();return{hit:{node,pos},nextPos:pos+1}};
 addDivider=(_view,hit)=>{const pos=hit.pos+1;if(!fixture.blocks[pos]?.divider)fixture.blocks.splice(pos,0,{divider:true});return pos+1};
 page.__test={pastePurchasedReview,readRun};
 `;
 const at=code.lastIndexOf('})();');w.eval(code.slice(0,at)+injection+code.slice(at));
 await w.__test.pastePurchasedReview();
 assert.equal(uploads,27);assert.equal(saves,1);assert.equal(w.__test.readRun().count,27);
 assert.equal(w.__test.readRun().draftSaveState,'confirmed');
 assert.match(w.document.getElementById(panelId+'-status').textContent,/下書き保存確認済み/);
 assert.equal(gm.get('mumei_purchase_review_backup_v1:n123456789abc').value.items.length,27);
 await w.__test.pastePurchasedReview();assert.equal(uploads,27);assert.equal(saves,1);
});
