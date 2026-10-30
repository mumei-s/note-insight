import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync('public/note-insight-notification-reader-v4.js','utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,message){for(let i=0;i<100;i++){if(check())return;await wait(10)}assert.ok(check(),message)}
const nativeRow=id=>`<div id="row-${id}" class="m-navbarNoticeItem" data-notice-id="${id}"><a href="/fictional">架空の人物</a>さんがあなたの記事にスキしました<time datetime="2026-10-27T00:00:00Z">1分前</time></div>`;
function fixture(t,markup){
 const dom=new JSDOM('<main id="unrelated"></main><section id="panel" data-mumei-notice-shell-v2958="1">'+markup+'</section>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,top:0,bottom:100,left:0,right:360});w.GM={getValue:async(key,fallback)=>fallback};
 const measure={contains:0,scans:0,networkRuns:0},contains=w.Node.prototype.contains;
 w.Node.prototype.contains=function(node){measure.contains++;return contains.call(this,node)};
 w.__readerDomMeasure=measure;w.__mumeiNotificationNetwork3300={syncCurrent:async()=>{measure.networkRuns++;return{historyComplete:true}},stop(){}};
 // Expose the actual private DOM readers only inside this fixture. The product
 // keeps its existing public API and uses no test-only methods or fetch hooks.
 w.eval(source.replace('function noticeKeys(panel){','function noticeKeys(panel){window.__readerDomMeasure.scans++;').replace(/\}\)\(\);?\s*$/,'window.__readerDomProbe={rows,noticeKeys};})();'));
 return{w,panel:w.document.getElementById('panel'),probe:w.__readerDomProbe,measure};
}

test('300行の確認と12行追加で、通知同士の全組合せ比較をせず保存済み境界を再読込しない',async t=>{
 const f=fixture(t,Array.from({length:300},(_,i)=>nativeRow(i)).join(''));
 await until(()=>f.measure.networkRuns===1,'initial session confirms completion');await wait(180);
 f.measure.contains=0;const initialKeys=f.probe.noticeKeys(f.panel);assert.equal(initialKeys.length,300);assert.ok(f.measure.contains<5000,`300-row fingerprint uses bounded DOM work: ${f.measure.contains}`);
 const before=f.measure.scans;f.panel.insertAdjacentHTML('beforeend',Array.from({length:12},(_,i)=>nativeRow(i+300)).join(''));
 await until(()=>f.measure.scans>before,'native append is still observed');await wait(40);
 assert.equal(f.measure.networkRuns,1,'older tail does not start another network traversal');
 assert.deepEqual([...f.probe.noticeKeys(f.panel)], [...initialKeys], 'the 300-row head fingerprint keeps its original cap and ordering');
 f.measure.contains=0;const visible=f.probe.rows(f.panel);assert.equal(visible.length,312);assert.ok(f.measure.contains<5000,`312-row extraction avoids a quadratic comparison: ${f.measure.contains}`);
 assert.deepEqual([...visible].map(el=>el.id),Array.from({length:312},(_,i)=>'row-'+i));
});

test('完了後の無関係DOM更新では通知再走査を起こさない',async t=>{
 const f=fixture(t,Array.from({length:300},(_,i)=>nativeRow(i)).join(''));await until(()=>f.measure.networkRuns===1,'initial read');await wait(180);
 const before=f.measure.scans;f.measure.contains=0;for(let i=0;i<30;i++)f.w.document.getElementById('unrelated').append(f.w.document.createElement('span'));await wait(320);
 assert.equal(f.measure.scans,before,'unrelated DOM mutations must not rescan notices');assert.equal(f.measure.networkRuns,1);
});

test('入れ子の通知では外側だけを採用し、兄弟通知とDOM並び替えを保持する',t=>{
 const f=fixture(t,'<div id="outer" class="m-navbarNoticeItem" data-notice-id="outer">架空の外側通知'+nativeRow('inner')+'</div>'+nativeRow('sibling'));
 assert.deepEqual([...f.probe.rows(f.panel)].map(el=>el.id),['outer','row-sibling']);
 assert.deepEqual([...f.probe.noticeKeys(f.panel)].map(key=>key.split('|')[0]),['outer','sibling']);
 f.panel.prepend(f.w.document.getElementById('row-sibling'));
 assert.deepEqual([...f.probe.rows(f.panel)].map(el=>el.id),['row-sibling','outer']);
 assert.deepEqual([...f.probe.noticeKeys(f.panel)].map(key=>key.split('|')[0]),['sibling','outer']);
});

test('BEM要素と独立したcustom rootでも、外枠と対象rootの範囲を保つ',t=>{
 const f=fixture(t,'<section id="custom"><div class="noticeItem" id="known">架空の通知<time>1分前</time><div class="noticeItem__body">架空の本文</div></div><div class="noticeItem" id="second">別の架空通知<time>2分前</time></div></section>'+nativeRow('outside'));
 const custom=f.w.document.getElementById('custom');assert.deepEqual([...f.probe.rows(custom)].map(el=>el.id),['known','second']);assert.equal(f.probe.noticeKeys(custom).length,2);
 assert.equal(f.probe.rows(f.panel)[0].id,'row-outside','existing exact-selector priority is unchanged across the enclosing root');
});

test('大きすぎる親や非表示の親を除外し、適格な子の採用とfallback listを維持する',t=>{
 const f=fixture(t,'<div class="m-navbarNoticeItem">'+('長'.repeat(4100))+nativeRow('eligible')+'</div><div class="m-navbarNoticeItem" hidden>'+nativeRow('hidden')+'</div><section id="fallback"><ul><li id="li"><span>架空の通知 1分前</span><a href="/fictional">架空の人物</a></li></ul></section>');
 assert.deepEqual([...f.probe.rows(f.panel)].map(el=>el.id),['row-eligible']);
 assert.deepEqual([...f.probe.rows(f.w.document.getElementById('fallback'))].map(el=>el.id),['li']);
});
