import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import './profile-card-paster-data-v250.test.mjs';
import './profile-card-paster-design-v250.test.mjs';
import './profile-card-paster-core-v250.test.mjs';
import './profile-card-paster-eligible-v251.test.mjs';
import './profile-card-paster-loading-resume-v251.test.mjs';
import './profile-card-paster-assets-flow-v252.test.mjs';
import './profile-card-paster-assets-v252.test.mjs';
import './profile-card-paster-storage-v253.test.mjs';
import './profile-card-paster-recover-v253.test.mjs';
import './profile-card-paster-cards-ready-v255.test.mjs';
import './profile-card-paster-card-duplicates-v256.test.mjs';
import './profile-card-paster-card-delete-v257.test.mjs';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
function runtime(overrides={}){
 const dom=new JSDOM('',{url:'https://editor.note.com/notes/n123456789abc/edit'});
 const context=vm.createContext({window:dom.window,document:dom.window.document,location:dom.window.location,localStorage:dom.window.localStorage,DOMParser:dom.window.DOMParser,GM_getValue:()=>null,GM_xmlhttpRequest(){throw Error('unexpected network')},setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,URL,Blob,File,console,...overrides});
 context.unsafeWindow={Blob,File,URL,...overrides.page};
 const exposed=source.replace('const sleep=','let sleep=').replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),patchPanel,clearCurrentPaste,insertActivityAt,restartFixed300,resumeFixed300,addDivider,prepareInsightExport,startFixed300,preparePerson,thumbnailUrl,avatarUrl,profileText,activityText,bitmapFromUrl,makeFile,assignDesigns,uniquePeople,buildRows,createFixed300,headingText,enrichFinal};})();`);
 vm.runInContext(exposed,context);return context;
}

function setPanelFixture(c,html){
 c.document.body.innerHTML=html;
 const panel=c.document.getElementById('mumei-profile-card-paster-v1');
 if(panel&&!panel.querySelector('.body')){
  const body=c.document.createElement('div');body.className='body';
  while(panel.firstChild)body.appendChild(panel.firstChild);
  panel.appendChild(body);
 }
}

test('note API string eyecatch and both avatar field conventions are supported',()=>{
 const {api}=runtime();
 assert.equal(api.thumbnailUrl({eyecatch:'https://assets.st-note.com/article.png'}),'https://assets.st-note.com/article.png');
 assert.equal(api.avatarUrl({userProfileImagePath:'https://assets.st-note.com/profile.png'}),'https://assets.st-note.com/profile.png');
 assert.equal(api.avatarUrl({user_profile_image_path:'https://assets.st-note.com/profile.png'}),'https://assets.st-note.com/profile.png');
});
test('profile text preserves the actual biography without guessing from articles',async()=>{
 const c=runtime();
 c.payloads={profile:{data:{nickname:'花',profile:'料理ではなく、小説を書いています。\n旅も好き。',profileImageUrl:'https://assets.st-note.com/avatar.png'}},contents:{data:{contents:[{key:'n123456789abc',name:'AIと投資の記事',eyecatch:'https://assets.st-note.com/thumb.png'}]}},note:{data:{name:'AIと投資の記事',eyecatch:'https://assets.st-note.com/thumb.png'}}};
 c.api.patch(`xhrJSON=async url=>url.includes('/contents?')?payloads.contents:url.includes('/api/v3/')?payloads.note:payloads.profile;articleMetaImage=async()=>''`);
 const row=await c.api.preparePerson({urlname:'creator'});
 assert.equal(row.profileText,'料理ではなく、小説を書いています。\n旅も好き。');
 assert.equal(row.thumbUrl,'https://assets.st-note.com/thumb.png');
 assert.equal(row.profileLayout,'compact-v272');
 const formula=c.api.activityText(row);
 assert.ok(formula.startsWith('$${\\scriptsize\\begin{array}{l}'));
 assert.ok(formula.includes('小説を書いています。'));
 assert.ok(!formula.includes('AIと投資の記事'));
 assert.equal(c.api.activityText({creator:'空',profileText:''}),'プロフィール｜空さん：プロフィール未設定');
});
test('duplicates use creator identity, and fuku444 is reserved for the final extra entry',async()=>{
 const people=Array.from({length:300},(_,i)=>({urlname:'person'+i,likerKey:String(i)}));
 const c=runtime({GM_getValue:()=>({at:1,people:[{urlname:'fuku444'},people[0],{...people[0],urlname:'PERSON0',likerKey:'other'},...people]})});
 c.api.patch(`preparePerson=async person=>({...person,profileText:'紹介'});sleep=async()=>{}`);
 const rows=await c.api.buildRows();
 assert.equal(rows.length,300);assert.equal(new Set(rows.map(r=>r.urlname.toLowerCase())).size,300);
 assert.ok(!rows.some(r=>r.urlname==='fuku444'));assert.equal(rows.at(-1).index,300);
 c.api.patch(`xhrJSON=async()=>({data:{nickname:'実績の算数',profileImageUrl:'https://assets.st-note.com/avatar.png',eyecatch:'https://assets.st-note.com/thumb.png'}});articleMetaImage=async()=>''`);
 const final=await c.api.enrichFinal();
 assert.equal(final.index,301);assert.equal(final.urlname,'fuku444');assert.ok(final.finalMarker);assert.equal(final.url,'https://note.com/fuku444/n/nb4f6934381e9');
});
test('image decoding falls back to Image after createImageBitmap rejects',async()=>{
 let revoked=false;
 const c=runtime({page:{createImageBitmap:async()=>{throw Error('decoder')},Image:class{set src(url){queueMicrotask(()=>this.onload())}},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{revoked=true}}}});
 c.response=new Blob(['image'],{type:'image/png'});c.api.patch('xhr=async()=>response');
 assert.ok(await c.api.bitmapFromUrl('https://assets.st-note.com/test.png'));assert.ok(revoked);
});
test('unavailable configured image stops before any partial thumbnail is returned',async()=>{
 const c=runtime();c.api.patch(`bitmapFromUrl=async url=>url&&url!=='unavailable'?{width:10,height:10,close(){}}:null`);
 await assert.rejects(c.api.makeFile({creator:'花',actorImageUrl:'unavailable',thumbUrl:'thumb'}),/アイコンを表示できません/);
 await assert.rejects(c.api.makeFile({creator:'花',actorImageUrl:'avatar',thumbUrl:''}),/記事サムネイルを表示できません/);
});
test('paste inserts a profile paragraph before the image and the final extra entry has no profile',async()=>{
 const c=runtime();c.events=[];
 c.api.patch(`
findView=()=>({state:{doc:{nodeAt:()=>null}}});nativeImageCommand=()=>{};selectionApi=()=>{};
readRun=()=>globalThis.saved||null;writeRun=r=>{globalThis.saved=r};
buildRows=async()=>Array.from({length:300},(_,i)=>({index:i+1,creator:'人'+i,urlname:'p'+i,url:'https://note.com/p'+i+'/n/n123456789abc',profileText:'本人の紹介'}));
enrichFinal=async()=>({index:301,urlname:'fuku444',url:'https://note.com/fuku444/n/nb4f6934381e9',creator:'実績の算数',finalMarker:true});
embedNodes=()=>[];cardAnchorFromSelection=()=>0;ownedImages=()=>[];isDivider=()=>false;addDivider=(view,hit)=>0;
makeFile=async row=>{events.push(['make',row.index]);return {}};
findHeading=()=>null;findActivity=()=>null;
insertHeadingAt=(view,text,pos)=>{events.push(['heading',text]);return {nextPos:pos+1}};
insertActivityAt=(view,row,pos)=>{events.push(['profile',row.index]);return {text:activityText(row),nextPos:pos+1}};
uploadOne=async(view,row,file,pos)=>{events.push(['image',row.index]);return {hit:{},nextPos:pos+1}};
recordImage=()=>{};recordActivity=()=>{};recordHeading=()=>{};sleep=async()=>{};
`);
 await c.api.createFixed300();
 const first=c.events.filter(e=>e[1]===1).map(e=>e[0]);assert.deepEqual(Array.from(first),['make','profile','image']);
 assert.equal(c.events.filter(e=>e[0]==='profile').length,300);
 assert.deepEqual(Array.from(c.events.at(-1)),['image',301]);
 assert.equal(c.events.filter(e=>e[0]==='heading').at(-1)[1],'最後に｜実績の算数');
 assert.equal(c.saved.count,300);assert.equal(c.saved.rows.length,301);assert.equal(c.saved.stage,'images_ready');
});
test('current run with completed images can resume without forcing a reset',async()=>{
 const c=runtime();c.events=[];
 c.api.patch(`
const rows=Array.from({length:301},(_,i)=>({creator:'人',index:i+1,urlname:i===300?'fuku444':'p'+i,url:i===300?'https://note.com/fuku444/n/nb4f6934381e9':'https://note.com/p'+i+'/n/n123456789abc',finalMarker:i===300}));
let saved={likesHistoryFix230:true,rows,items:[{id:'done'}],imageAnchorPos:0};
readRun=()=>saved;writeRun=r=>saved=r;findView=()=>({state:{doc:{nodeAt:()=>null}}});nativeImageCommand=()=>{};selectionApi=()=>{};
isDivider=()=>false;addDivider=()=>302;ownedImages=()=>Array.from({length:300},(_,i)=>({pos:i,node:{nodeSize:1,attrs:{link:rows[i].url}}}));
makeFile=async row=>{events.push(row.index);return {}};findHeading=()=>null;
insertHeadingAt=(view,text,pos)=>({nextPos:pos+1});recordHeading=()=>{};
uploadOne=async()=>({hit:{},nextPos:302});recordImage=()=>{};sleep=async()=>{};
`);
 await c.api.createFixed300();assert.deepEqual(Array.from(c.events),[301]);
});
test('direct installer preserves the fix identity and all entries load the same guarded implementation',()=>{
 const installer=readFileSync('public/note-profile-card-paster-install.html','utf8');
 assert.match(installer,/location\.replace\('https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-profile-card-likes300-fix-v220.user.js\?v=2.9.0/);
 assert.match(source,/@namespace\s+https:\/\/github.com\/mumei-s\/note-insight\/profile-card-paster\n/);
 assert.doesNotMatch(readFileSync('public/note-profile-card-likes300-fix-v220.user.js','utf8'),/@require/);
});

test('the original bridge update replaces the original installed identity rather than the separate fix',()=>{
 const installer=readFileSync('public/note-profile-card-paster-original-update.html','utf8');
 const original=readFileSync('public/note-profile-card-paster-v1.user.js','utf8');
 assert.match(installer,/location\.replace\('https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-profile-card-paster-v1.user.js\?v=2.9.0/);
 assert.doesNotMatch(installer,/likes300-fix/);
 assert.match(original,/@namespace\s+https:\/\/github.com\/mumei-s\/note-insight\/profile-card-paster\n/);
 assert.match(original,/@version\s+2.9.0/);
 assert.doesNotMatch(original,/@require/);
 assert.doesNotMatch(original,/@match.*mumei-s\.github\.io/);
});


test('the independent export flow uses recent like history and accepts only the matching popup response',async()=>{
 let written;const c=runtime({GM_setValue:(key,value)=>{written={key,value}}}),popup={};let opened;
 c.window.open=url=>{opened=url;return popup};
 const pending=c.api.prepareInsightExport(),requestId=new URL(opened).searchParams.get('request');
 assert.equal(new URL(opened).pathname,'/note-insight/note-profile-card-paster-history-export.html');
 assert.equal(new URL(opened).searchParams.get('scope'),'recent-likes');
 function deliver(origin,source,request){const event=new c.window.Event('message');Object.defineProperties(event,{origin:{value:origin},source:{value:source},data:{value:{type:'MUMEI_INSIGHT_LIKES_V1',requestId:request,ok:true,rows:[{urlname:'person'},{urlname:'PERSON'},{urlname:'fuku444'}]}}});c.window.dispatchEvent(event)}
 deliver('https://example.com',popup,requestId);deliver('https://mumei-s.github.io',{},requestId);deliver('https://mumei-s.github.io',popup,'other');
 assert.equal(written,undefined);deliver('https://mumei-s.github.io',popup,requestId);
 const people=await pending;assert.equal(people.length,1);assert.equal(written.value.version,231);assert.equal(written.value.scope,'recent-likes');
});


test('the redundant prepare button is removed while the editor start remains',()=>{
 const c=runtime();setPanelFixture(c,'<div id="mumei-profile-card-paster-v1"><b class="title"></b><details data-like300><summary></summary><div class="hint"></div><div class="special-actions"><button data-a="like300-prep">INSIGHTで準備</button><button data-a="like300-images">①</button></div></details></div>');
 assert.equal(c.api.patchPanel(),true);assert.equal(c.document.querySelector('[data-a="like300-prep"]'),null);
 assert.equal(c.document.querySelector('[data-a="like300-fixed"]').textContent,'① 最初から');
 assert.equal(c.document.querySelector('[data-a="like300-resume"]').textContent,'続きから');
 c.api.patchPanel();assert.equal(c.document.querySelectorAll('[data-a="like300-resume"]').length,1);
});

test('the original card action stays visible beside continue without duplicating its listener',()=>{
 const c=runtime();let clicked=0;
 setPanelFixture(c,'<div id="mumei-profile-card-paster-v1"><b class="title"></b><div class="phase"><button data-a="cards">②</button></div><details data-like300><summary></summary><div class="hint"></div><div class="special-actions"><button data-a="like300-images">①</button></div></details></div>');
 const button=c.document.querySelector('[data-a="cards"]');button.addEventListener('click',()=>clicked++);
 c.api.patchPanel();c.api.patchPanel();
 const actions=c.document.querySelector('[data-like300] .special-actions');
 assert.equal(actions.querySelector('[data-a="cards"]'),button);assert.equal(button.previousElementSibling.dataset.a,'like300-resume');
 assert.equal(c.document.querySelectorAll('[data-a="cards"]').length,1);
 button.click();assert.equal(clicked,1);
});

test('the visible card button uses the current exported action when an old installed listener remains',()=>{
 let current=0,legacy=0;const c=runtime({page:{__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__:()=>current++}});
 setPanelFixture(c,'<div id="mumei-profile-card-paster-v1"><b class="title"></b><button data-a="cards">②</button><details data-like300><summary></summary><div class="hint"></div><div class="special-actions"><button data-a="like300-images">①</button></div></details></div>');
 const button=c.document.querySelector('[data-a="cards"]');button.addEventListener('click',()=>legacy++);
 c.api.patchPanel();c.api.patchPanel();button.click();
 assert.equal(current,1);assert.equal(legacy,0);
});

test('the visible duplicate audit action is single and invokes the current read-only action',()=>{
 let audited=0;const c=runtime({page:{__MUMEI_PROFILE_CARD_AUDIT_DUPLICATES__:()=>audited++}});
 setPanelFixture(c,'<div id="mumei-profile-card-paster-v1"><b class="title"></b><button data-a="cards">②</button><details data-like300><summary></summary><div class="hint"></div><div class="special-actions"><button data-a="like300-images">①</button></div></details></div>');
 c.api.patchPanel();c.api.patchPanel();
 const buttons=c.document.querySelectorAll('[data-a="check-duplicates"]');assert.equal(buttons.length,1);buttons[0].click();assert.equal(audited,1);
});

test('the delete button invokes the current exported action rather than an older installed handler',()=>{
 let current=0,legacy=0;const c=runtime({page:{__MUMEI_PROFILE_CARD_DELETE_CARDS__:()=>current++}});
 setPanelFixture(c,'<div id="mumei-profile-card-paster-v1"><b class="title"></b><button data-a="delete">通知カード削除</button><details data-like300><summary></summary><div class="hint"></div><div class="special-actions"><button data-a="like300-images">①</button></div></details></div>');
 const button=c.document.querySelector('[data-a="delete"]');button.addEventListener('click',()=>legacy++);
 c.api.patchPanel();c.api.patchPanel();button.click();assert.equal(current,1);assert.equal(legacy,0);
});

function blockView(initial=[],withSmall=false){
 let blocks=[...initial];
 const type=name=>({name,create:(attrs,child)=>({type:types[name],attrs:attrs||{},textContent:child?.text||'',marks:child?.marks||[],nodeSize:1})});
 const types={paragraph:type('paragraph'),heading:type('heading'),image:type('image'),horizontal_rule:type('horizontal_rule')};
 types.horizontal_rule.createAndFill=()=>types.horizontal_rule.create();
 const state={schema:{nodes:types,marks:withSmall?{small:{create:()=>({type:'small'})}}:{strong:{create:()=>({type:'strong'})}},text:(text,marks=[])=>({text,marks})}};
 Object.defineProperty(state,'doc',{get:()=>({content:{size:blocks.length},nodeAt:pos=>blocks[pos]||null,descendants:fn=>blocks.forEach((node,pos)=>fn(node,pos))})});
 Object.defineProperty(state,'tr',{get:()=>({steps:[],insert(pos,node){this.steps.push(['insert',pos,node]);return this},delete(from,to){this.steps.push(['delete',from,to]);return this}})});
 return{state,dispatch(tr){for(const [action,pos,value] of tr.steps){if(action==='insert')blocks.splice(pos,0,value);else blocks.splice(pos,value-pos)}},blocks:()=>blocks};
}
test('full profiles use normal text, with small formatting only when the editor supports it',()=>{
 for(const supportsSmall of [false,true]){
  const c=runtime(),view=blockView([],supportsSmall),profile='紹介全文。'.repeat(100);
  c.api.insertActivityAt(view,{creator:'花',profileText:profile},0);
  assert.equal(view.blocks()[0].textContent,'プロフィール｜花さん：'+profile);
  assert.deepEqual(Array.from(view.blocks()[0].marks,m=>m.type),supportsSmall?['small']:[]);
 }
});
test('each image receives one native divider and restart removes only tracked paste content',()=>{
 const c=runtime(),view=blockView(),nodes=view.state.schema.nodes;
 const paragraph=text=>nodes.paragraph.create(null,{text}),image=(id,url)=>nodes.image.create({id,src:id,link:url});
 view.dispatch(view.state.tr.insert(0,paragraph('既存の本文')).insert(1,nodes.heading.create(null,{text:'01｜紹介'})).insert(2,paragraph('本人のプロフィール')).insert(3,image('owned','https://note.com/p/n/n123456789abc')).insert(4,image('unrelated','https://note.com/other/n/n111111111111')));
 c.saved={likesHistoryFix230:true,items:[{id:'owned',src:'owned',url:'https://note.com/p/n/n123456789abc'}],activityTexts:['本人のプロフィール'],sectionHeadings:['01｜紹介'],imageAnchorPos:1};
 c.api.patch('readRun=()=>saved;writeRun=run=>{saved=run}');
 const hit={pos:3,node:view.state.doc.nodeAt(3)},row={url:'https://note.com/p/n/n123456789abc'};
 assert.equal(c.api.addDivider(view,hit,row),5);assert.equal(c.api.addDivider(view,hit,row),5);
 assert.equal(view.blocks().filter(n=>n.type.name==='horizontal_rule').length,1);
 assert.equal(c.api.clearCurrentPaste(view,c.saved),4);
 assert.deepEqual(view.blocks().map(n=>n.textContent||n.attrs.id),['既存の本文','unrelated']);
});
test('restart reuses prepared rows from person one, while resume leaves the current content intact',async()=>{
 const c=runtime();c.events=[];c.saved={likesHistoryFix230:true,rows:Array.from({length:301},(_,i)=>({index:i+1})),items:[{id:'done'}],activityTexts:['profile'],sectionHeadings:['heading'],dividerUrls:['url'],imageAnchorPos:2};
 setPanelFixture(c,'<div id="mumei-profile-card-paster-v1"><select data-mode><option value="number" selected>件数</option></select><input data-count value="300"></div>');
 c.api.patch(`validateFixedRows=rows=>rows;readRun=()=>saved;writeRun=run=>{saved=run};findView=()=>({state:{doc:{content:{size:10}}}});clearCurrentPaste=()=>{events.push('clear')};embedNodes=()=>[];createFixed300=async()=>{events.push('create')};startFixed300=()=>{throw Error('must not reopen INSIGHT')}`);
 await c.api.resumeFixed300();assert.deepEqual(Array.from(c.events),['create']);assert.equal(c.saved.items.length,1);
 await c.api.restartFixed300();assert.deepEqual(Array.from(c.events),['create','clear','create']);
 assert.equal(c.saved.rows.length,301);assert.equal(c.saved.rows[0].index,1);assert.equal(c.saved.items.length,0);assert.equal(c.saved.activityTexts.length,0);assert.equal(c.saved.dividerUrls.length,0);assert.equal(c.saved.imageAnchorPos,2);
});
test('all current and legacy entries are inert on INSIGHT, with no observer, storage or DOM mutation',()=>{
 for(const path of ['note-profile-card-paster-v22.user.js','note-profile-card-paster-core-v232.js','note-profile-card-paster-v1.user.js','note-profile-card-likes300-fix-v220.user.js']){
  const code=readFileSync('public/'+path,'utf8');
  const dom=new JSDOM('<main id="root">INSIGHT</main>',{url:'https://mumei-s.github.io/note-insight/',runScripts:'outside-only'});
  const w=dom.window,initial=w.document.documentElement.outerHTML;
  w.MutationObserver=class {constructor(){throw Error('observer on INSIGHT')}};
  w.fetch=()=>{throw Error('network on INSIGHT')};w.open=()=>{throw Error('navigation on INSIGHT')};
  w.localStorage.setItem('mumei-insight-access-token','saved-session');w.eval(code);
  assert.equal(w.document.documentElement.outerHTML,initial);assert.equal(w.localStorage.length,1);
  assert.equal(w.localStorage.getItem('mumei-insight-access-token'),'saved-session');
  if(path.endsWith('.user.js')){assert.match(code,/@match\s+https:\/\/editor\.note\.com\/\*/);assert.doesNotMatch(code,/@match.*mumei-s\.github\.io/)}
  dom.window.close();
 }
 const core=readFileSync('public/note-profile-card-paster-core-v232.js','utf8');
 assert.doesNotMatch(core,/window\.open|like300prep=1/);
});

test('the shared dependency exits on INSIGHT before mounting or requesting history',()=>{
 const core=readFileSync('public/note-profile-card-paster-core-v232.js','utf8');const dom=new JSDOM('<main id="root">INSIGHT</main>',{url:'https://mumei-s.github.io/note-insight/',runScripts:'outside-only'});
 dom.window.eval(core);assert.equal(dom.window.document.body.children.length,1);assert.equal(dom.window.document.getElementById('root').textContent,'INSIGHT');
 assert.match(source,/@require.*paster-core-v232.js/);assert.doesNotMatch(source,/@require.*ceca4b92/);dom.window.close();
});


