import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const code=readFileSync('public/note-profile-card-paster-quality-v290.js','utf8');
function runtime({storage=new Map(),clock=Date,moduleCode=code}={}){
 const dom=new JSDOM('<div id="mumei-profile-card-paster-v1"><div class="head"><span class="title">極薄</span><button>－</button><button>×</button></div><div class="body">元の操作</div></div>',{url:'https://editor.note.com/notes/naaaaaaaaaaaa/edit',runScripts:'outside-only'});
 const w=dom.window;w.Date=clock;
 Object.defineProperty(w,'localStorage',{value:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)}});
 w.eval(moduleCode);const q=w.__MUMEI_PROFILE_CARD_QUALITY__;
 return{q,w,storage,close:()=>w.close()};
}
const row=(id='person_a',extra={})=>({index:1,urlname:id,key:'n000000000001',url:'https://note.com/'+id+'/n/n000000000001',creator:'飾り🌸作者',profileText:'美容もAIも書きます。\n手動改行です。',actorImageUrl:'https://assets.st-note.com/icon.jpg',thumbUrl:'https://assets.st-note.com/thumb.jpg',...extra});
const raw=(id='person_a',extra={})=>({key:'n000000000001',user:{urlname:id,nickname:'以前の名前'},name:'AIの話題',...extra});
function acquire(q,output=row(),article=raw(),profile={urlname:'person_a',nickname:'新しい名前',profile:'美容を発信'}){
 const selected=q.rawRow(output,article,{urlname:'person_a',creator:'さらに前の名前'});
 return q.acquired({...selected,creator:output.creator},{target:'person_a',note:article,profile,selected});
}
const statuses=findings=>Array.from(findings,f=>f.status);

test('source inspection is pure and does not treat display names, honorifics or topics as identity',()=>{
 const r=runtime(),source=acquire(r.q),before=JSON.stringify(source);
 const output=r.q.assessIdentity(source);
 assert.ok(output.some(f=>f.check==='対象と投稿者'&&f.status==='confirmed'));
 assert.ok(!statuses(output).includes('mismatch'));
 assert.equal(JSON.stringify(source),before);
 for(const creator of ['別名🐰','🌸作者🌸','飾り🌸作者さん'])assert.ok(!statuses(r.q.assessIdentity({...source,creator,title:'美容の話'})).includes('mismatch'));
 r.close();
});
test('same display name on another account and an intentionally mixed article are detected by independent raw IDs',()=>{
 const r=runtime();const source=acquire(r.q,row(),raw('person_b'));
 const found=r.q.assessIdentity(source).filter(f=>f.status==='mismatch');
 assert.ok(found.some(f=>f.check==='対象と投稿者'&&f.evidence.expected==='person_a'&&f.evidence.actual==='person_b'));
 assert.ok(!r.q.assessIdentity(acquire(r.q)).some(f=>f.status==='mismatch'),'the negative-control fixture must also pass');
 const changed=acquire(r.q,row(),raw('person_a',{key:'n000000000099'}));
 assert.ok(r.q.assessIdentity(changed).some(f=>f.status==='mismatch'&&f.check==='選択記事と取得記事'));
 r.close();
});
test('the negative-fixture assertion itself rejects an intentionally broken all-pass inspector',()=>{
 const r=runtime({moduleCode:code.replaceAll("'mismatch'","'confirmed'")});
 const source=acquire(r.q,row(),raw('person_b'));
 assert.throws(()=>assert.ok(r.q.assessIdentity(source).some(f=>f.status==='mismatch')),assert.AssertionError);
 r.close();
});
test('legacy/missing materials stay insufficient and unperformed rather than passed or blamed',()=>{
 const r=runtime();assert.deepEqual(statuses(r.q.assessIdentity(row())),['insufficient']);
 const source=r.q.rawRow(row(),{key:'n000000000001'},{urlname:'person_a'});
 assert.ok(r.q.assessIdentity(source).some(f=>f.check==='対象と投稿者'&&f.status==='insufficient'));
 const noArticle=r.q.acquired(row('person_a',{profileOnly:true,key:'',url:'https://note.com/person_a',actorImageUrl:'',thumbUrl:''}),{target:'person_a',profile:{urlname:'person_a'}});
 assert.ok(!statuses(r.q.assessIdentity(noArticle)).includes('mismatch'));
 assert.ok(r.q.assessIdentity(noArticle).some(f=>f.status==='unperformed'&&f.check==='記事照合'));
 r.close();
});
test('the generated-file binding catches a swapped account/file without reading an adjacent introduction',()=>{
 const r=runtime(),a=acquire(r.q),b={...a,urlname:'person_b',url:'https://note.com/person_b/n/n000000000001'};
 const findings=r.q.assessBinding(b,r.q.sourceBinding(a),'生成→リンク');
 assert.ok(findings.some(f=>f.status==='mismatch'&&f.check.endsWith('account')));
 const file={};r.q.beforePaste(a,file);assert.ok(r.q.snapshot().records.at(-1).findings.some(f=>f.status==='insufficient'));
 r.close();
});
test('divider-separated A image/name then B profile is normal; no nearby text is inspected or modified',()=>{
 const r=runtime(),a=acquire(r.q),b=acquire(r.q,row('person_b'),raw('person_b'),{urlname:'person_b'});
 const file={},ctx={fillText(){},measureText(){return{width:20,actualBoundingBoxLeft:0,actualBoundingBoxRight:20,actualBoundingBoxAscent:0,actualBoundingBoxDescent:10}}};
 r.q.observeContext(ctx,a,860,140);ctx.fillText(a.creator+'さん',100,86);r.q.generated(a,file);
 const body=[{type:'image',attrs:{link:a.url},textContent:a.creator+'さん'},{type:'horizontal_rule'},{type:'paragraph',textContent:'プロフィール｜'+b.creator+'さん：'+b.profileText}];
 const before=JSON.stringify(body);r.q.pasted(a,file,{hit:{node:body[0],pos:8}});r.q.divider(a,body[1],node=>node.type==='horizontal_rule');
 const records=r.q.snapshot().records.slice(-2);assert.ok(records.every(entry=>entry.findings.every(f=>f.status!=='mismatch')));
 assert.equal(JSON.stringify(body),before);assert.equal(body[0].textContent,a.creator+'さん');
 assert.equal(body[0].textContent.split('さん').length,2,'no second name or honorific is added');r.close();
});
test('manual newlines, natural wrapping, suspicious word breaks and measured clipping are distinguished',()=>{
 const r=runtime(),q=r.q;
 const good=q.assessText('前半\n後半',{lines:['前半','後半']});
 assert.ok(good.some(f=>f.check==='手動改行'&&f.status==='confirmed'));
 assert.ok(good.some(f=>f.check==='本文の表示幅'&&f.status==='unperformed'));assert.ok(!statuses(good).includes('mismatch'));
 const natural=q.assessText('自然な折り返し',{lines:['自然な','折り返し']});assert.ok(!statuses(natural).includes('candidate'));
 const word=q.assessText('communication',{lines:['communi','cation']});assert.ok(word.some(f=>f.check==='単語の境界'&&f.status==='candidate'));
 const intentional=q.assessText('communi\ncation',{lines:['communi','cation']});assert.ok(!intentional.some(f=>f.check==='単語の境界'&&f.status==='candidate'),'a known manual break is not blamed as an automatic split');
 const cut=q.assessText('全部残す',{lines:['全部']});assert.ok(statuses(cut).includes('mismatch'));
 const outside=q.assessGeometry([{measured:true,left:0,top:10,right:865,bottom:25}],860,140);
 assert.ok(outside.some(f=>f.status==='candidate'&&f.evidence.bounds[2]===865));
 assert.ok(q.assessGeometry([],860,140).every(f=>f.status!=='confirmed'));r.close();
});
test('the observation API records mismatch evidence without rewriting the original data or File',()=>{
 const r=runtime(),source=acquire(r.q,row(),raw('person_b')),before=JSON.stringify(source),file={name:'original.png'};
 assert.equal(r.q.generated(source,file),file);r.q.beforePaste(source,file);
 assert.equal(JSON.stringify(source),before);assert.ok(r.q.snapshot().records.some(rec=>rec.findings.some(f=>f.status==='mismatch')));
 assert.equal(r.q.snapshot().mode,'on');r.close();
});
test('render observation delegates the exact original fillText arguments once and uses actual metrics',()=>{
 const r=runtime(),calls=[],ctx={fillText(...args){calls.push(args);return 42},measureText(){return{width:20,actualBoundingBoxLeft:0,actualBoundingBoxRight:20,actualBoundingBoxAscent:0,actualBoundingBoxDescent:10}}},source=acquire(r.q),file={};
 const observed=r.q.observeContext(ctx,source,860,140);assert.equal(observed,ctx);assert.equal(ctx.fillText('作者さん',100,86),42);
 r.q.generated(source,file);assert.deepEqual(calls,[['作者さん',100,86]]);
 assert.ok(r.q.snapshot().records.at(-1).findings.some(f=>f.check==='画像内の文字枠'&&f.status==='confirmed'));r.close();
});
test('an inspector exception disables additional checks, records failure, and leaves the old output usable',()=>{
 // This exercises the injected exception, independently from OS scheduling.
 // The separate budget-exhaustion test supplies an advancing clock.
 class ExceptionClock extends Date{static now(){return 1000}}
 const r=runtime({clock:ExceptionClock}),file={name:'original'},source=row(),ctx={fillText(){return 7},measureText(){throw Error('measurement failed')}};
 r.q.beginBatch({});
 r.q.observeContext(ctx,source,860,140);assert.equal(ctx.fillText('same',100,86),7);
 assert.equal(r.q.generated(source,file),file);assert.equal(r.q.snapshot().fault,true);
 assert.ok(r.q.snapshot().records.at(-1).findings.some(f=>f.status==='failed'));assert.ok(!r.q.snapshot().records.at(-1).findings.some(f=>f.status==='confirmed'));
 r.q.mountUI();assert.equal(r.w.document.querySelector('[data-quality-badge]').textContent,'検査×');r.w.document.querySelector('[data-quality-badge]').click();assert.match(r.w.document.querySelector('[data-quality-detail]').textContent,/検査の例外/);r.close();
});
test('time-budget exhaustion records failure without retrying or adding a delay',()=>{
 let now=1000;class Clock extends Date{static now(){now+=40;return now}}
 const r=runtime({clock:Clock}),source=row(),file={};assert.equal(r.q.generated(source,file),file);
 assert.equal(r.q.snapshot().fault,true);assert.ok(r.q.snapshot().records.some(entry=>entry.findings.some(f=>/30ms/.test(f.reason))));r.close();
});
test('quality UI is in the same header row, details overlay only after tap, and off can be reversed after reload',()=>{
 const storage=new Map(),r=runtime({storage});r.q.mountUI();r.q.mountUI();
 const doc=r.w.document,head=doc.querySelector('.head'),badge=doc.querySelector('[data-quality-badge]');
 assert.equal(head.children.length,4);assert.equal(head.querySelectorAll('[data-quality-badge]').length,1);assert.equal(doc.querySelector('.body').textContent,'元の操作');
 assert.equal(doc.querySelector('[data-quality-detail]').hidden,true);badge.click();assert.equal(doc.querySelector('[data-quality-detail]').hidden,false);
 doc.querySelector('[data-quality-detail] button').click();assert.equal(badge.textContent,'検査OFF');r.close();
 const next=runtime({storage});next.q.mountUI();assert.equal(next.w.document.querySelector('[data-quality-badge]').textContent,'検査OFF');next.w.document.querySelector('[data-quality-badge]').click();next.w.document.querySelector('[data-quality-detail] button').click();assert.equal(next.q.snapshot().mode,'on');next.close();
});
test('quality storage is bounded, separate, contains no profile copies, and disabling retains prior evidence and checkpoints',()=>{
 const storage=new Map([['mumei_profile_card_paster_run_v15:naaaaaaaaaaaa','original-checkpoint']]),r=runtime({storage});
 for(let i=0;i<240;i++)acquire(r.q);
 assert.ok(r.q.snapshot().records.length<=160);r.q.flush();
 const log=storage.get('mumei_profile_quality_log_v1:naaaaaaaaaaaa');assert.ok(log);assert.ok(!log.includes('美容もAIも'));assert.equal(storage.get('mumei_profile_card_paster_run_v15:naaaaaaaaaaaa'),'original-checkpoint');
 r.q.mountUI();r.w.document.querySelector('[data-quality-badge]').click();r.w.document.querySelector('[data-quality-detail] button').click();
 const count=r.q.snapshot().records.length;acquire(r.q);assert.equal(r.q.snapshot().records.length,count);assert.ok(r.q.snapshot().records.some(rec=>rec.findings.some(f=>f.status==='confirmed')));r.close();
});
test('a saved source reference survives reload without putting full provenance into the original run',()=>{
 const storage=new Map(),r=runtime({storage}),source=acquire(r.q);assert.ok(source.qualityRef);assert.ok(!source.qualitySource);r.q.flush();r.close();
 const next=runtime({storage});next.q.mountUI();const proof=next.q.provenance(JSON.parse(JSON.stringify(source)));assert.equal(proof.target,'person_a');assert.ok(next.q.assessIdentity(source).some(f=>f.status==='confirmed'));next.close();
});
test('the compact badge reports evidence-backed mismatches while details stay closed',()=>{
 const r=runtime();r.q.mountUI();acquire(r.q,row(),raw('person_b'));assert.equal(r.w.document.querySelector('[data-quality-badge]').textContent,'検査相違');assert.equal(r.w.document.querySelector('[data-quality-detail]').hidden,true);r.close();
});
test('a missing or failed draft result never becomes a successful save in the quality record',()=>{
 const r=runtime();r.q.saved({requested:true,confirmed:false});assert.equal(r.q.snapshot().records.at(-1).findings[0].status,'insufficient');
 r.q.saved(null,Error('save rejected'));assert.equal(r.q.snapshot().records.at(-1).findings[0].status,'failed');
 r.q.saved(true);assert.equal(r.q.snapshot().records.at(-1).findings[0].status,'confirmed');r.close();
});
test('the shipped pair includes quality hooks, preserves update identity, excludes purchase UI and needs no @require',()=>{
 const a=readFileSync('public/note-profile-card-likes300-fix-v220.user.js','utf8'),b=readFileSync('public/note-profile-card-paster-v1.user.js','utf8');
 assert.equal(a.slice(a.indexOf('(function(){')),b.slice(b.indexOf('(function(){')));
 assert.match(a,/@version\s+2\.9\.2/);assert.ok(a.includes('BEGIN READ-ONLY QUALITY ADAPTERS'));assert.ok(a.includes('observeContext'));assert.ok(a.includes('qualityCall(\'acquired\''));assert.ok(!a.includes('patchPurchasedReviewPanel'));assert.ok(!a.includes('PURCHASE_REVIEW_FORMAT'));assert.ok(!a.includes('@require'));
 assert.match(a,/@namespace\s+https:\/\/github.com\/mumei-s\/note-insight\/likes300-fix/);
});
