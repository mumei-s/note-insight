import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {transformCoreGeneral,transformEditorGeneral} from '../scripts/profile-card-general-v292.mjs';

const rawCore=readFileSync('public/note-profile-card-paster-core-v232.js','utf8');
const rawEditor=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
const coreSource=transformCoreGeneral(rawCore),editorSource=transformEditorGeneral(rawEditor);
const key=index=>'n'+index.toString(16).padStart(12,'0');
const raw=(account,index,pinned=false)=>({key:key(index),name:account+'の記事',publishAt:'2026-10-01T00:00:00Z',isPinned:pinned,user:{urlname:account,key:'person-'+account,nickname:'名前'+account}});
const plain=value=>JSON.parse(JSON.stringify(value));
function runtime({preferences=null,panel=false}={}){
 const dom=new JSDOM('',{url:'https://editor.note.com/notes/n123456789abc/edit',runScripts:'outside-only'}),window=dom.window;
 window.unsafeWindow=window;window.GM_getValue=()=>null;window.GM_setValue=()=>{};window.GM_xmlhttpRequest=()=>{throw Error('Unexpected real network')};
 window.setInterval=()=>1;window.clearInterval=()=>{};window.confirm=()=>false;
 window.MutationObserver=class{observe(){}disconnect(){}};
 if(preferences)window.localStorage.setItem('mumei_profile_card_paster_v1',JSON.stringify(preferences));
 const end="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();";
 assert.equal(coreSource.split(end).length,2);
 const exposed=coreSource.replace('const sleep=','let sleep=').replace(end,'globalThis.api={patch:code=>eval(code),parseUnifiedSources,chooseCreatorArticle,collectUnified,enrich,mount,inputValues};');
 vm.runInContext(exposed,dom.getInternalVMContext());
 window.requests=[];window.statuses=[];window.waits=[];
 window.api.patch('setStatus=text=>statuses.push(text);sleep=async ms=>{waits.push(ms)}');
 if(panel){window.api.mount();vm.runInContext(editorSource,dom.getInternalVMContext());}
 return{dom,window,api:window.api,close:()=>window.close()};
}

test('mixed source tokens retain input order and do not turn URL fragments into hashtags',()=>{
 const r=runtime();
 const result=plain(r.api.parseUnifiedSources('#一つ https://note.com/a/n/n111111111111?x=1#ignored #二つ\nhttps://note.com/a/m/m123456789abc\n＃三つ\nhttps://note.com/hashtag/%E4%B8%80%E3%81%A4\n#一つ\nhttps://example.com/x#bad'));
 assert.deepEqual(result.map(source=>[source.type,source.value]),[['tag','一つ'],['note','https://note.com/a/n/n111111111111'],['tag','二つ'],['mag','https://note.com/a/m/m123456789abc'],['tag','三つ']]);
 r.close();
});

test('strict fixed requires explicit pin evidence while the existing fixed preference keeps its fallback',async()=>{
 const r=runtime();r.window.payload={data:{contents:[raw('a',1),{note:raw('a',2,true)}]}};
 r.api.patch('xhrJSON=async url=>{requests.push(url);return payload}');
 assert.equal((await r.api.chooseCreatorArticle({urlname:'a'},'pinned')).key,key(2));
 r.window.payload={data:{contents:[raw('a',1)]}};
 assert.equal(await r.api.chooseCreatorArticle({urlname:'a'},'pinned'),null);
 assert.equal((await r.api.chooseCreatorArticle({urlname:'a'},'fixed')).key,key(1));
 assert.ok(r.window.requests.every(url=>url.includes('disabled_pinned=false')));
 r.close();
});

test('all four choices apply to hashtag and magazine authors as well as article likers',async()=>{
 for(const choice of ['oldest','fixed','latest','pinned']){
  const r=runtime();r.window.raws=[raw('alpha',1),raw('beta',2),raw('alpha',3)];r.window.chosen=[];
  r.api.patch(`xhrJSON=async url=>url.includes('/searches')?{data:{notes:{contents:raws,is_last_page:true}}}:url.includes('/magazines/')?{data:{notes:raws}}:{data:{likes:raws.map(note=>({user:note.user}))}};
chooseCreatorArticle=async(creator,choice)=>{chosen.push([creator.urlname,choice]);return {...creator,key:'n222222222222',url:'https://note.com/'+creator.urlname+'/n/n222222222222'}};`);
  for(const source of ['#テスト','https://note.com/a/m/m123456789abc','https://note.com/a/n/n123456789abc']){
   r.window.chosen=[];const result=await r.api.collectUnified(source,'number',2,choice);
   assert.deepEqual(Array.from(result,row=>row.urlname),['alpha','beta']);
   assert.deepEqual(plain(r.window.chosen),[['alpha',choice],['beta',choice]]);
  }
  r.close();
 }
});

test('source unions keep the first occurrence of each account and preserve order under reversed completion',async()=>{
 const r=runtime();r.window.tags={'一つ':[raw('alpha',1),raw('beta',2)],'二つ':[raw('BETA',3),raw('gamma',4)]};r.window.mag=[raw('alpha',5),raw('delta',6)];r.window.chosen=[];
 r.api.patch(`xhrJSON=async url=>{const parsed=new URL(url);return url.includes('/searches')?{data:{notes:{contents:tags[parsed.searchParams.get('q')],is_last_page:true}}}:{data:{notes:mag}}};
chooseCreatorArticle=async(creator,choice)=>{chosen.push(creator.urlname);if(creator.urlname==='alpha')await new Promise(resolve=>setTimeout(resolve,8));return {...creator,key:'n333333333333',url:'https://note.com/'+creator.urlname+'/n/n333333333333'}};`);
 const rows=await r.api.collectUnified('#一つ #二つ\nhttps://note.com/a/m/m123456789abc','all',0,'latest');
 assert.deepEqual(Array.from(rows,row=>row.urlname),['alpha','beta','gamma','delta']);
 assert.deepEqual(plain(r.window.chosen),['alpha','beta','gamma','delta']);
 assert.deepEqual(plain(r.window.waits),[],'no artificial extraction wait');
 r.close();
});

test('strict fixed continues to later candidates and records the reason without substituting a latest article',async()=>{
 const r=runtime();r.window.raws=[raw('unfixed',1),raw('pinned',2),raw('later',3)];r.window.choices=[];
 r.api.patch(`xhrJSON=async()=>({data:{notes:{contents:raws,is_last_page:true}}});chooseCreatorArticle=async(creator,choice)=>{choices.push([creator.urlname,choice]);return creator.urlname==='unfixed'?null:{...creator,key:'n444444444444',url:'https://note.com/'+creator.urlname+'/n/n444444444444'}};`);
 const rows=await r.api.collectUnified('#テスト','number',2,'pinned');
 assert.deepEqual(Array.from(rows,row=>row.urlname),['pinned','later']);
 assert.equal(r.window.__MUMEI_PROFILE_CARD_SOURCE_SELECTION__.unavailable,1);
 assert.deepEqual(plain(r.window.__MUMEI_PROFILE_CARD_SOURCE_SELECTION__.issues),[{account:'unfixed',reason:'固定記事なし・未確認'}]);
 assert.ok(r.window.statuses.at(-1).includes('固定記事なし・未確認 1人'));
 r.close();
});

test('selection is bounded to six requests and finite counts avoid unnecessary speculative requests',async()=>{
 const r=runtime();r.window.raws=Array.from({length:20},(_,i)=>raw('p'+i,i+1));r.window.active=0;r.window.peak=0;r.window.calls=0;
 r.api.patch(`xhrJSON=async()=>({data:{notes:{contents:raws,is_last_page:true}}});chooseCreatorArticle=async creator=>{active++;peak=Math.max(peak,active);calls++;await Promise.resolve();active--;return {...creator,key:'n555555555555',url:'https://note.com/'+creator.urlname+'/n/n555555555555'}};`);
 assert.equal((await r.api.collectUnified('#テスト','number',13,'latest')).length,13);
 assert.equal(r.window.peak,6);assert.equal(r.window.calls,13);
 r.close();
});

test('repeated search cursors terminate and candidate order is maintained across pages',async()=>{
 const r=runtime();r.window.pages=0;r.window.raw=raw;
 r.api.patch(`xhrJSON=async()=>{pages++;return{data:{notes:{contents:[raw('p'+pages,pages)],cursor:'next'},cursor:{note:'next'}}}};chooseCreatorArticle=async creator=>({...creator,key:'n666666666666',url:'https://note.com/'+creator.urlname+'/n/n666666666666'});`);
 const rows=await r.api.collectUnified('#テスト','all',0,'latest');
 assert.equal(r.window.pages,2);assert.deepEqual(Array.from(rows,row=>row.urlname),['p1','p2']);r.close();
});

test('general enrichment starts the creator request before the article request resolves',async()=>{
 const r=runtime();r.window.profileCalled=false;r.window.resolveNote=null;
 r.api.patch(`xhrJSON=()=>new Promise(resolve=>{resolveNote=resolve});creatorProfile=async()=>{profileCalled=true;return{creator:'本人',avatar:'https://assets.st-note.com/icon.png'}};articleMetaImage=async()=>'';`);
 const promise=r.api.enrich({urlname:'person',key:key(1),url:'https://note.com/person/n/'+key(1)});
 await Promise.resolve();assert.equal(r.window.profileCalled,true);
 r.window.resolveNote({data:{key:key(1),name:'記事',eyecatch_url:'https://assets.st-note.com/thumb.png',user:{urlname:'person'}}});
 const row=await promise;assert.equal(row.creator,'本人');assert.equal(row.title,'記事');r.close();
});

test('the permanent panel removes campaigns and keeps mixed inputs, four choices, resume and both deletion actions',async()=>{
 const prefs={sources:'#一つ\n#二つ\nhttps://note.com/a/m/m123456789abc',mode:'number',count:17,choice:'pinned'};
 const r=runtime({preferences:prefs,panel:true}),panel=r.window.document.getElementById('mumei-profile-card-paster-v1');
 assert.ok(panel);assert.equal(panel.querySelector('[data-sources]').value,prefs.sources);assert.equal(panel.querySelector('[data-count]').value,'17');
 assert.equal(panel.querySelector('[data-choice="pinned"]').classList.contains('on'),true);
 assert.deepEqual(Array.from(panel.querySelectorAll('[data-choice]'),button=>button.dataset.choice),['oldest','fixed','latest','pinned']);
 assert.equal(panel.querySelector('[data-gallery126]'),null);assert.equal(panel.querySelector('[data-special]'),null);assert.ok(!panel.textContent.includes('ハロウィン'));
 for(const selector of ['[data-a="images"]','[data-a="cards"]','[data-a="resume"]','[data-a="pause"]','[data-a="delete"]','[data-a="reset"]'])assert.equal(panel.querySelectorAll(selector).length,1,selector);
 assert.equal(panel.querySelector('[data-like300]').open,false);
 r.window.dispatchEvent(new r.window.Event('mumei-profile-card-panel-ready'));await Promise.resolve();
 assert.equal(panel.querySelectorAll('[data-a="resume"]').length,1);assert.equal(panel.querySelector('[data-sources]').value,prefs.sources);
 r.close();
});

test('transforms keep legacy resume routing and bounded selection explanations in the original checkpoint',()=>{
 assert.ok(editorSource.includes("if(!run?.gallery126&&run?.coreImageRun&&typeof page.__MUMEI_PROFILE_CARD_RESUME_CORE_IMAGES__==='function')return page.__MUMEI_PROFILE_CARD_RESUME_CORE_IMAGES__();"));
 assert.ok(editorSource.includes("if(run?.items?.length||run?.rows?.length)return createFixed300();"));
 assert.ok(coreSource.includes('sourceSelection:!special&&!workmom&&!parenting?page.__MUMEI_PROFILE_CARD_SOURCE_SELECTION__||null:null'));
 assert.ok(coreSource.includes('issues.length<160'));
});

test('missing resume, card, or optional history controls heal without replacing a focused source field',async()=>{
 const r=runtime({panel:true}),panel=r.window.document.getElementById('mumei-profile-card-paster-v1'),field=panel.querySelector('[data-sources]');
 field.value='#保存前の入力\n#二つ';field.focus();field.setSelectionRange(2,5);
 for(const selector of ['[data-a="resume"]','[data-a="cards"]','details[data-like300]']){
  panel.querySelector(selector).remove();r.window.dispatchEvent(new r.window.Event('mumei-profile-card-panel-ready'));await Promise.resolve();
  assert.equal(r.window.document.getElementById('mumei-profile-card-paster-v1'),panel);assert.equal(panel.querySelector('[data-sources]'),field);
  assert.ok(panel.querySelector(selector),selector);assert.equal(r.window.document.activeElement,field);assert.equal(field.selectionStart,2);assert.equal(field.selectionEnd,5);
 }
 let cards=0;r.window.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__=()=>{cards++};
 panel.querySelector('[data-a="cards"]').dispatchEvent(new r.window.MouseEvent('click',{bubbles:true,cancelable:true}));assert.equal(cards,1);
 r.close();
});

test('a missing fundamental source control remount preserves live inputs, choice, focus and caret',async()=>{
 const r=runtime({panel:true}),panel=r.window.document.getElementById('mumei-profile-card-paster-v1'),field=panel.querySelector('[data-sources]');
 field.value='#まだ保存していない\n#次';panel.querySelector('[data-count]').value='42';
 panel.querySelector('[data-choice="pinned"]').classList.add('on');panel.querySelector('[data-choice="latest"]').classList.remove('on');
 field.focus();field.setSelectionRange(3,8);panel.querySelector('[data-choice="oldest"]').remove();
 r.window.dispatchEvent(new r.window.Event('mumei-profile-card-panel-ready'));await Promise.resolve();
 const restored=r.window.document.getElementById('mumei-profile-card-paster-v1'),input=restored.querySelector('[data-sources]');
 assert.notEqual(restored,panel);assert.equal(input.value,field.value);assert.equal(restored.querySelector('[data-count]').value,'42');assert.ok(restored.querySelector('[data-choice="pinned"]').classList.contains('on'));
 assert.equal(r.window.document.activeElement,input);assert.equal(input.selectionStart,3);assert.equal(input.selectionEnd,8);
 assert.equal(restored.querySelectorAll('[data-a="resume"]').length,1);r.close();
});
