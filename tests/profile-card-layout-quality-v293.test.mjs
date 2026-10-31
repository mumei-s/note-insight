import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import vm from 'node:vm';
import {qualityRefreshHelpers} from '../scripts/profile-card-quality-refresh.mjs';
import {instrumentCore} from '../scripts/profile-card-quality-instrument.mjs';
import {transformCoreContent} from '../scripts/profile-card-content-v292.mjs';

const source=readFileSync('public/note-profile-card-paster-quality-v290.js','utf8');
const contentSource=readFileSync('public/note-profile-card-paster-content-v292.js','utf8');
const literal='$${\\tiny\\boxed{\\begin{array}{l}\\text{プロフィール}\\\\\\text{元の紹介文}\\end{array}}}$$';
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture({rendered=true,overflow=false,font=12,owned=true,annotation=true,detached=false,wrongPosition=false}={}){
 const dom=new JSDOM('<div id="mumei-profile-card-paster-v1"><div class="head"><span>極薄</span><button>－</button><button>×</button></div><div class="body">元の操作</div></div><div id="editor"><p id="intro"></p><figure id="figure"><img id="card"></figure></div>',{url:'https://editor.note.com/notes/naaaaaaaaaaaa/edit',runScripts:'outside-only'});
 const w=dom.window,document=w.document;class Clock extends Date{static now(){return 1000}}w.Date=Clock;
 const row={urlname:'layout_person',key:'n000000000001',url:'https://note.com/layout_person/n/n000000000001',creator:'作者',presentation:{size:'thin',content:'profile',status:'available',text:'元の紹介文',source:{kind:'profile',account:'layout_person'}}};
 const layout={version:2,font:'tiny',cellBudget:14,lineCount:2,bodyWidthPx:320,maxHeightPx:140,maxFontPx:14,truncated:false};
 const editor=document.getElementById('editor'),intro=document.getElementById('intro'),figure=document.getElementById('figure'),image=document.getElementById('card');
 const rect=(element,left,top,width,height)=>{element.getBoundingClientRect=()=>({left,right:left+width,top,bottom:top+height,width,height})};
 rect(editor,100,0,320,500);rect(intro,100,0,320,80);rect(figure,100,100,320,52);rect(image,100,100,320,52);
 if(rendered){
  const box=document.createElement('span');box.className='katex';
  if(annotation){const math=document.createElement('span');math.className='katex-mathml';const note=document.createElement('annotation');note.setAttribute('encoding','application/x-tex');note.textContent=literal.slice(2,-2);math.append(note);box.append(math)}
  const html=document.createElement('span');html.className='katex-html';box.append(html);intro.append(box);rect(box,100,0,320,80);rect(html,100,0,320,80);
  for(const [text,top,width] of [['プロフィール',10,140],['元の紹介文',35,overflow?701:240]]){const leaf=document.createElement('span');leaf.className='mord text';leaf.style.fontSize=font+'px';leaf.textContent=text;html.append(leaf);rect(leaf,110,top,width,font)}
  if(overflow){intro.style.overflowX='hidden';Object.defineProperty(intro,'clientWidth',{value:320});Object.defineProperty(intro,'scrollWidth',{value:711})}
 }else intro.textContent=literal;
 if(detached)intro.remove();
 const paragraph={type:{name:'paragraph'},textContent:literal,nodeSize:literal.length+2},imageNode={type:{name:'image'},attrs:{link:row.url},nodeSize:1},positions=new Map([[5,paragraph],[100,imageNode]]),reads=[];
 const view={dom:editor,state:{doc:{nodeAt(pos){reads.push(pos);return positions.get(pos)||null},descendants(){throw Error('Whole-editor scan is forbidden')}}},nodeDOM(pos){if(pos===5)return intro;if(pos===100)return figure;throw Error('Unrelated DOM position requested')}};
 const run={articleKey:'naaaaaaaaaaaa',createdAt:1000,rows:[row],items:[],presentationTexts:owned?{[row.url]:literal}:{},presentationPositions:{[row.url]:wrongPosition?6:5},presentationLayouts:{[row.url]:layout}};
 w.__MUMEI_PROFILE_CARD_RUN_STORE__={read:()=>run};w.__MUMEI_PROFILE_CARD_CONTENT__={matchesAboveText:(_,text)=>text===literal,aboveText:()=>literal};
 w.eval(source);const q=w.__MUMEI_PROFILE_CARD_QUALITY__,result={text:literal,pos:5,nextPos:5+paragraph.nodeSize,layout},hit={pos:100,node:imageNode};
 return{w,document,q,row,view,run,result,hit,positions,reads,intro,editor,close:()=>w.close(),observe(){q.presentationAt(row,view,result);q.presentationPasted(row,view,hit);return clone(q.snapshot().records.at(-1)?.findings||[])}};
}
const finding=(findings,check,status)=>findings.some(item=>item.check===check&&item.status===status);

test('source and bounded-geometry fixture evidence are recorded separately for one explicitly owned paragraph',()=>{
 const r=fixture();try{
  const before=r.editor.outerHTML,findings=r.observe();
  assert.ok(finding(findings,'紹介式の対応','confirmed'));assert.ok(finding(findings,'紹介DOMの対応','confirmed'));assert.ok(finding(findings,'紹介の表示幅','confirmed'));assert.ok(finding(findings,'紹介の実文字サイズ','confirmed'));
  assert.ok(finding(findings,'公開後の表示','unperformed'),'editor measurements never claim the published page was measured');
  assert.equal(r.editor.outerHTML,before,'the observer never changes the paragraph, image, style or body');
  assert.ok(r.reads.every(pos=>[5,100].includes(pos)));assert.equal(r.q.preflight(r.row),null);
 }finally{r.close()}
});

test('glyph overflow and oversized actual-font fixtures are candidates even when the formula wrapper fits',()=>{
 const r=fixture({overflow:true,font:32});try{
  const findings=r.observe();
  assert.ok(finding(findings,'紹介の表示幅','candidate'));assert.ok(finding(findings,'紹介の実文字サイズ','candidate'));assert.ok(finding(findings,'紹介の横方向の欠け','candidate'));
  assert.ok(!finding(findings,'紹介の表示幅','confirmed'));assert.equal(r.q.preflight(r.row),null,'a display problem is never an account/article identity hold');
 }finally{r.close()}
});

for(const options of [{rendered:false},{detached:true}])test('unrendered or detached owned DOM stays unperformed '+JSON.stringify(options),()=>{
 const r=fixture(options);try{
  const findings=r.observe();assert.ok(finding(findings,'紹介の実表示','unperformed'));
  assert.ok(!findings.some(item=>['紹介の表示幅','紹介の表示高さ','紹介の実文字サイズ'].includes(item.check)&&item.status==='confirmed'));
 }finally{r.close()}
});

test('a missing DOM formula signature cannot turn source-only wrapping into a measured pass',()=>{
 const r=fixture({annotation:false});try{
  const findings=r.observe();assert.ok(finding(findings,'紹介式の対応','confirmed'));assert.ok(finding(findings,'紹介DOMの対応','unperformed'));assert.ok(finding(findings,'紹介の表示幅','unperformed'));assert.ok(finding(findings,'紹介の実文字サイズ','unperformed'));
 }finally{r.close()}
});

test('zero-size geometry and a changed paragraph never reuse a previous measured pass',()=>{
 const r=fixture();try{
  r.q.presentationAt(r.row,r.view,r.result);r.positions.get(5).textContent='利用者が変更した文章';r.q.presentationPasted(r.row,r.view,r.hit);
  let findings=r.q.snapshot().records.at(-1).findings;assert.ok(finding(findings,'紹介の実表示','insufficient'));assert.ok(!finding(findings,'紹介の表示幅','confirmed'));
  r.positions.get(5).textContent=literal;r.intro.getBoundingClientRect=()=>({left:0,right:0,top:0,bottom:0,width:0,height:0});r.q.presentationPasted(r.row,r.view,r.hit);
  findings=r.q.snapshot().records.at(-1).findings;assert.ok(finding(findings,'紹介の実表示','unperformed'));assert.ok(!finding(findings,'紹介の実文字サイズ','confirmed'));
 }finally{r.close()}
});

test('formula wrapping candidates are independent from a measured physical fit',()=>{
 const r=fixture();try{r.result.layout={...r.result.layout,wordSplitCandidate:true};const findings=r.observe();assert.ok(finding(findings,'紹介式の折り返し','candidate'));assert.ok(finding(findings,'紹介の表示幅','confirmed'));assert.equal(r.q.preflight(r.row),null)}finally{r.close()}
});

for(const options of [{owned:false},{wrongPosition:true}])test('an unproven paragraph scope is not inspected '+JSON.stringify(options),()=>{
 const r=fixture(options);try{const findings=r.observe();assert.ok(finding(findings,'紹介の所有範囲','insufficient'));assert.equal(r.reads.length,0)}finally{r.close()}
});

test('required HR checks inspect only the current image boundary and never become identity holds',()=>{
 const r=fixture();try{
  r.q.imageBoundary(r.row,r.view,r.hit,{dividerRequired:true});assert.ok(finding(r.q.snapshot().records.at(-1).findings,'直後の区切り','mismatch'));
  r.positions.set(101,{type:{name:'horizontal_rule'},nodeSize:1});r.q.imageBoundary(r.row,r.view,r.hit,{dividerRequired:true});assert.ok(finding(r.q.snapshot().records.at(-1).findings,'直後の区切り','confirmed'));
  assert.ok(r.reads.every(pos=>[100,101].includes(pos)));assert.equal(r.q.preflight(r.row),null);
 }finally{r.close()}
});

test('missing introduction values are insufficient instead of an equal-empty text confirmation',()=>{
 const r=fixture();try{r.q.activity(r.row,undefined,undefined);assert.ok(finding(r.q.snapshot().records.at(-1).findings,'挿入した紹介','insufficient'));assert.ok(!finding(r.q.snapshot().records.at(-1).findings,'挿入した紹介','confirmed'))}finally{r.close()}
});

test('repair controls stay inside details, require a preview and explicit single-use apply, and preserve pending save wording',async()=>{
 const r=fixture();try{
  let previews=0,applies=0;const body=r.document.querySelector('.body').textContent;
  r.w.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__={preview:async()=>{previews++;return{token:'one-use',changeCount:2,paragraphs:1,dividers:1,samples:[{name:'作者',before:'旧表示',after:'小さい表示',reason:'実寸を確認'}],message:'候補のみ'}},apply:async token=>{assert.equal(token,'one-use');applies++;return{applied:true,saved:'pending',message:'2件を適用'}}};
  r.q.mountUI();assert.equal(previews,0);assert.equal(applies,0);r.document.querySelector('[data-quality-badge]').click();
  const detail=r.document.querySelector('[data-quality-detail]'),button=text=>Array.from(detail.querySelectorAll('button')).find(item=>item.textContent===text);
  assert.equal(button('この修正を適用'),undefined);button('今回分の表示を整える').click();await new Promise(setImmediate);
  assert.equal(previews,1);assert.equal(applies,0);assert.ok(detail.textContent.includes('旧表示 → 小さい表示'));assert.ok(detail.textContent.includes('実寸を確認'));
  const apply=button('この修正を適用');apply.click();apply.click();await new Promise(setImmediate);apply.click();
  assert.equal(applies,1);assert.ok(detail.textContent.includes('下書き保存は未確認'));assert.ok(!detail.textContent.includes('下書き保存を確認済み'));assert.equal(r.document.querySelector('.body').textContent,body);
 }finally{r.close()}
});

test('held pending introductions use their saved adaptive context and preserve unchanged legacy literals',async()=>{
 for(const kind of ['adaptive','legacy','legacy-changed-text','legacy-corrected-source','legacy-changed-source-kind']){
  const r=fixture();try{
   r.w.eval(contentSource);const content=r.w.__MUMEI_PROFILE_CARD_CONTENT__;
   const profile={urlname:r.row.urlname,nickname:r.row.creator,profile:'元のプロフィールです。communicationを通じて日々のことを書きます。'},note={key:r.row.key,noteUrl:r.row.url,title:'元の記事',user:{urlname:r.row.urlname},eyecatch:'https://assets.st-note.com/thumb.png'};
   r.row.presentation=content.compose(r.row,note,profile,{size:'thin',content:'profile'});
   if(kind==='legacy-corrected-source')r.row.presentation.source={...r.row.presentation.source,account:'wrong_person',url:'https://note.com/wrong_person'};
   if(kind==='legacy-changed-source-kind')r.row.presentation.source={kind:'note-free',account:r.row.urlname,key:r.row.key,url:r.row.url};
   const adaptive=content.aboveLayout(r.row,196,32),contract=kind==='adaptive'?content.layoutContract(adaptive):{version:1,font:'scriptsize',maxFontPx:14,maxHeightPx:140},owned=kind==='adaptive'?adaptive.text:content.legacyAboveText(r.row);
   assert.notEqual(owned,content.aboveText(r.row),'the fixture must actually differ from the new default-width formula');
   r.run.presentationTexts[r.row.url]=owned;r.run.presentationLayouts[r.row.url]=contract;r.positions.get(5).textContent=owned;r.intro.textContent=owned;
   r.run.qualityHold={version:1,kind:'source',phase:'images',index:0,identity:{account:r.row.urlname,key:r.row.key,url:r.row.url},runId:r.run.createdAt,articleKey:r.run.articleKey,reasons:[{code:'ARTICLE_ACCOUNT',expected:r.row.urlname,actual:'wrong_person'}],at:1000};
   let saved=r.run;const before=clone(saved);r.w.page=r.w;r.w.readRun=()=>saved;r.w.writeRun=value=>{saved=clone(value)};r.w.editorArticleKey=()=>saved.articleKey;
   r.w.qualityCall=(method,args,fallback)=>r.q[method]?.(...args)??fallback;r.w.qualityBlock=async hold=>{throw Object.assign(new Error('held'),{code:'QUALITY_HOLD',qualityHold:hold})};
   r.w.mediaUrl=value=>typeof value==='object'?value?.url||'':String(value||'');r.w.articleMetaImage=async()=>'';
   r.w.xhrJSON=async url=>url.includes('/api/v3/notes/')?{data:note}:{data:{creator:{...profile,profile:kind==='legacy-changed-text'?'新しいプロフィールです':profile.profile}}};
   r.w.__MUMEI_PROFILE_CARD_RUN_STORE__={read:()=>saved,flush:async()=>{}};r.w.eval(qualityRefreshHelpers);
   if(kind.startsWith('legacy-changed')){await assert.rejects(r.w.qualityRetryHeldRun(saved),error=>error.code==='QUALITY_HOLD');assert.deepEqual(clone(saved),before)}
   else{await r.w.qualityRetryHeldRun(saved);assert.equal(saved.qualityHold,undefined);assert.equal(saved.presentationTexts[r.row.url],owned);assert.deepEqual(clone(saved.presentationLayouts[r.row.url]),clone(contract))}
   assert.equal(r.intro.textContent,owned,'a retry never rewrites the existing introduction DOM');
  }finally{r.close()}
 }
});

function scopedRow(r,noteExtra={},scopeExtra={}){
 const base={...r.row,sourceScope:{kind:'tag',tag:'選択タグ',articleKey:r.row.key,...scopeExtra}};delete base.presentation;
 const note={key:base.key,noteUrl:base.url,user:{urlname:base.urlname},title:'#選択タグ と書いた別記事',body:'本文にも #選択タグ',eyecatch:'https://assets.st-note.com/thumb.png',...noteExtra};
 const selected=r.q.rawRow(base,{...note,hashtags:['選択タグ']},{urlname:base.urlname});
 return r.q.acquired(selected,{target:base.urlname,note,profile:{urlname:base.urlname,nickname:base.creator},selected});
}

test('tag scopes use the exact same article detail assigned tags across supported API schemas',()=>{
 const r=fixture();try{
  for(const [field,value] of [['hashtags',['#Cafe\u0301']],['tags',[{name:'＃Cafe\u0301'}]],['hashtag_names',['Cafe\u0301']],['tag_names',[{tag:{name:'Café'}}]],['note_hashtags',[{name:'Café'}]],['hashtag_notes',[{hashtag:{name:'Café'}}]]]){
   const row=scopedRow(r,{[field]:value},{tag:'＃Cafe\u0301'});
   assert.equal(r.q.preflight(row),null);assert.equal(r.q.hasVerifiedFreshIdentity(row),true);
   const detail=r.q.provenance(row).articles.find(item=>item.source==='note-api');assert.deepEqual(clone(detail.assignedTags.names),['Café']);assert.equal(detail.assignedTags.complete,true);
   assert.ok(finding(r.q.assessIdentity(row),'選択タグと記事タグ','confirmed'));
  }
  const mismatch=scopedRow(r,{hashtag_notes:[{hashtag:{name:'別のタグ'}}]});
  const verdict=r.q.preflight(mismatch),reason=verdict.reasons.find(item=>item.code==='TAG_SCOPE');
  assert.equal(reason.expected,'選択タグ');assert.deepEqual(clone(reason.actual),['別のタグ']);assert.equal(reason.articleKey,mismatch.key);
  assert.ok(mismatch.qualitySourceIssue.reasons.some(item=>item.code==='TAG_SCOPE'),'the clear condition contradiction is retained on the row before any paste');
  mismatch.sourceScope.tag='さらに別のタグ';assert.deepEqual(clone(r.q.provenance(mismatch).articles.find(item=>item.source==='note-api').assignedTags.names),['別のタグ'],'actual tag evidence never comes from the requested scope');
  assert.ok(r.q.preflight(scopedRow(r,{tags:['選択タグの別名']})).reasons.some(item=>item.code==='TAG_SCOPE'),'a substring does not satisfy an assigned tag');
  assert.ok(r.q.preflight(scopedRow(r,{tags:['café']},{tag:'Café'})).reasons.some(item=>item.code==='TAG_SCOPE'),'tag names are not case-folded');
 }finally{r.close()}
});

test('missing, incomplete and wrong-article tag metadata stay insufficient while an explicit empty tag set can contradict scope',()=>{
 const r=fixture();try{
  for(const extra of [{},{tags:{name:'選択タグ'}},{hashtag_notes:[null]},{tags:Array.from({length:51},(_,index)=>index===50?'選択タグ':'別タグ'+index)}]){
   const row=scopedRow(r,extra);assert.equal(r.q.preflight(row),null);assert.equal(r.q.hasVerifiedFreshIdentity(row),false);assert.ok(finding(r.q.assessIdentity(row),'選択タグと記事タグ','insufficient'));
   for(const item of r.q.provenance(row).articles)assert.ok(!item.assignedTags||item.assignedTags.names.length<=50);
  }
  assert.ok(r.q.preflight(scopedRow(r,{hashtags:[]})).reasons.some(item=>item.code==='TAG_SCOPE'));
  const wrongBound=scopedRow(r,{tags:['別タグ']},{articleKey:'nffffffffffff'});assert.equal(r.q.preflight(wrongBound),null);assert.ok(finding(r.q.assessIdentity(wrongBound),'選択タグと記事タグ','insufficient'));
  const unscoped=scopedRow(r,{tags:['別タグ']});delete unscoped.sourceScope;delete unscoped.qualitySourceIssue;assert.equal(r.q.preflight(unscoped),null);assert.ok(!r.q.assessIdentity(unscoped).some(item=>item.check==='選択タグと記事タグ'));
 }finally{r.close()}
});

test('the actual adapter validates durable tag reasons separately from IDs and blocks with its inspector disabled',async()=>{
 const r=fixture();try{
  const row=scopedRow(r,{hashtag_notes:[{hashtag:{name:'別タグ'}}]}),compiled=instrumentCore(transformCoreContent(readFileSync('public/note-profile-card-paster-core-v232.js','utf8')));
  const recorded=compiled.slice(compiled.indexOf('function qualityRecordedReasons('),compiled.indexOf('function qualityHoldApplies(')),gate=compiled.slice(compiled.indexOf('async function qualityGate('),compiled.indexOf('const originalArticleFromRaw='));
  let run={articleKey:'naaaaaaaaaaaa',createdAt:1000,rows:[row],items:[]};const context=vm.createContext({readRun:()=>run,qualityHoldApplies:()=>false,qualityIdentity:value=>({account:value.urlname,key:value.key,url:value.url}),qualityCall:()=>[],editorArticleKey:()=>run.articleKey,Date,qualityBlock:async hold=>{run={...run,qualityHold:hold};throw Object.assign(new Error('held'),{code:'QUALITY_HOLD'})}});
  vm.runInContext(recorded+gate+'\nglobalThis.recorded=qualityRecordedReasons;globalThis.gate=qualityGate;',context);
  assert.equal(context.recorded(row).length,1);
  const mixed={...row,qualitySourceIssue:{version:1,reasons:[...row.qualitySourceIssue.reasons,{code:'ARTICLE_ACCOUNT',expected:row.urlname,actual:'other_account'},{code:'ARTICLE_ACCOUNT',expected:'不正なID',actual:'別ID'},{code:'TAG_SCOPE',expected:'未正規化\nタグ',actual:[],articleKey:row.key}]}};
  assert.equal(context.recorded(mixed).length,2,'adding tag validation does not broaden the existing account-ID rules');
  await assert.rejects(context.gate(row),error=>error.code==='QUALITY_HOLD');assert.equal(run.qualityHold.reasons[0].code,'TAG_SCOPE');assert.equal(run.qualityHold.identity.key,row.key);
 }finally{r.close()}
});

test('a known TAG_SCOPE hold needs fresh matching assigned tags before an identity-correct retry can clear it',async()=>{
 for(const freshTags of [null,[],['選択タグ']]){
  const r=fixture();try{
   const row=scopedRow(r,{hashtags:['別タグ']}),reason=r.q.preflight(row).reasons.find(item=>item.code==='TAG_SCOPE');
   let saved={articleKey:'naaaaaaaaaaaa',createdAt:1000,rows:[row],items:[],qualityHold:{version:1,kind:'source',phase:'images',index:0,identity:{account:row.urlname,key:row.key,url:row.url},runId:1000,articleKey:'naaaaaaaaaaaa',reasons:[reason],at:1000}};const before=clone(saved);
   r.w.page=r.w;r.w.readRun=()=>saved;r.w.writeRun=value=>{saved=clone(value)};r.w.editorArticleKey=()=>saved.articleKey;r.w.qualityCall=(method,args,fallback)=>r.q[method]?.(...args)??fallback;r.w.qualityBlock=async()=>{throw Object.assign(new Error('held'),{code:'QUALITY_HOLD'})};
   r.w.mediaUrl=value=>typeof value==='object'?value?.url||'':String(value||'');r.w.articleMetaImage=async()=>'';
   r.w.xhrJSON=async url=>url.includes('/api/v3/notes/')?{data:{key:row.key,noteUrl:row.url,user:{urlname:row.urlname},title:'記事',eyecatch:'https://assets.st-note.com/thumb.png',...(freshTags===null?{}:{hashtag_notes:freshTags.map(name=>({hashtag:{name}}))})}}:{data:{creator:{urlname:row.urlname,nickname:row.creator}}};
   r.w.__MUMEI_PROFILE_CARD_RUN_STORE__={read:()=>saved,flush:async()=>{}};r.w.eval(qualityRefreshHelpers);
   if(freshTags?.includes('選択タグ')){await r.w.qualityRetryHeldRun(saved);assert.equal(saved.qualityHold,undefined);assert.equal(r.q.hasVerifiedFreshIdentity(saved.rows[0]),true);assert.ok(!saved.rows[0].qualitySourceIssue)}
   else{await assert.rejects(r.w.qualityRetryHeldRun(saved),error=>error.code==='QUALITY_HOLD');assert.deepEqual(clone(saved),before)}
  }finally{r.close()}
 }
});
