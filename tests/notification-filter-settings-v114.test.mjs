import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync('public/notification-filter-settings.html','utf8');
const pageCode=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const bridgeCode=readFileSync('public/note-insight-notification-settings-bridge-v1.js','utf8');
const PAGE='mumei-filter-page-v1',BRIDGE='mumei-filter-bridge-v1',GROUPS='mumei_insight_notification_groups_v1:',MUTES='mumei_insight_magazine_mute_ids_v5:',PROFILES='mumei_insight_magazine_mute_profiles_v5:';
const plain=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(){for(let i=0;i<10;i++)await tick()}
function ui(t,{groups=[{name:'既存フォルダ',enabled:true,ids:[]}],profiles=[],capable=true,account='tester',load=true}={}){
 const dom=new JSDOM(html,{url:'https://mumei-s.github.io/note-insight/notification-filter-settings.html?notificationAccount='+account,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>w.close());const posts=[],timeouts=[],returnTimers=[],saveTimeouts=[];w.postMessage=(data,origin)=>posts.push({data:plain(data),origin});
 const timeout=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>{const target=ms===22000?timeouts:ms===900?returnTimers:ms===20000?saveTimeouts:null;return target?(target.push(fn),100000+timeouts.length+returnTimers.length+saveTimeouts.length):timeout(fn,ms,...args)};
 w.eval(pageCode);
 const message=(type,payload={},origin=w.location.origin)=>w.dispatchEvent(new w.MessageEvent('message',{origin,data:{source:BRIDGE,account,type,...payload}}));
 if(load)message('state',{groups:plain(groups),profiles,canResolveArticles:capable});
 const input=w.document.getElementById('quickInput'),target=w.document.getElementById('folderTarget'),view=w.document.getElementById('folderView');
 const add=value=>{input.value=value;w.document.getElementById('addCreator').click()};
 const choose=index=>{target.value=String(index);target.dispatchEvent(new w.Event('change',{bubbles:true}))};
 const chooseView=index=>{view.value=String(index);view.dispatchEvent(new w.Event('change',{bubbles:true}))};
 const filter=value=>{const input=w.document.getElementById('search');input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}))};
 const toggle=(index=0)=>w.document.querySelectorAll('.group-toggle')[index].click();
 return{w,posts,message,input,target,view,add,choose,chooseView,filter,toggle,timeouts,returnTimers,saveTimeouts,requests:()=>posts.filter(p=>p.data.type==='resolve-creator').map(p=>p.data),status:()=>w.document.getElementById('status').textContent};
}

test('記事URLの投稿者を選択フォルダへ追加し、既存登録・オフ状態を保存する',async t=>{
 const h=ui(t,{groups:[{name:'保留',enabled:false,ids:['kept']},{name:'追加先',enabled:true,ids:['prior']}]});
 h.choose(1);h.add('https://note.com/Article_Author/n/n123456789abc?from=share#part');
 assert.equal(h.requests().length,0,'投稿者入りURLに追加APIは不要');
 assert.equal(h.w.document.querySelectorAll('.group').length,1);assert.match(h.w.document.querySelector('.group').textContent,/@article_author/);assert.equal(h.view.value,'1');
 assert.equal(h.input.value,'');
 await new Promise(r=>setTimeout(r,160));
 const saved=h.posts.filter(p=>p.data.type==='save').at(-1).data.groups;
 assert.deepEqual(saved,[{name:'保留',enabled:false,ids:['kept']},{name:'追加先',enabled:true,ids:['prior','article_author']}]);
 h.add('@ARTICLE_AUTHOR');assert.match(h.status(),/登録済み/);
 assert.equal(h.w.document.querySelectorAll('[data-profile-id="article_author"]').length,1);
});

test('新しいフォルダは上部で作成して直ちに追加先へ選択できる',t=>{
 const h=ui(t);const name=h.w.document.getElementById('newFolderName');name.value='  新しい   対象  ';h.w.document.getElementById('addGroup').click();
 assert.match(h.target.selectedOptions[0].textContent,/新しい 対象/);assert.equal(name.value,'');
 h.add('@new_person');assert.equal(h.w.document.querySelectorAll('.group').length,1);assert.match(h.w.document.querySelector('.group').textContent,/@new_person/);assert.equal(h.view.value,h.target.value);assert.equal(h.target.options.length,2);
});

test('100フォルダでも1件だけ表示し、選択・検索・作成・削除後も追加先と保存内容を保つ',t=>{
 const groups=Array.from({length:100},(_,i)=>({name:'分類'+String(i).padStart(3,'0'),enabled:i!==77,ids:['person_'+i,'other_'+i]}));
 const h=ui(t,{groups,profiles:[{id:'person_77',nickname:'架空の作者77'}]}),doc=h.w.document,prev=doc.getElementById('prevFolder'),next=doc.getElementById('nextFolder'),position=()=>doc.getElementById('folderPosition').textContent;
 const bounded=()=>{assert.equal(doc.querySelectorAll('.group').length,1);assert.equal(h.target.value,h.view.value,'表示中と追加先は同じフォルダ');assert.ok(doc.querySelectorAll('.member').length<=50)};
 bounded();assert.equal(h.target.options.length,100);assert.equal(h.view.options.length,100);assert.equal(doc.querySelectorAll('.member').length,0);assert.equal(h.posts.filter(p=>p.data.type==='profiles').length,0);assert.equal(position(),'1 / 100');assert.equal(prev.disabled,true);assert.equal(next.disabled,false);
 next.click();bounded();assert.equal(h.target.value,'1');assert.equal(position(),'2 / 100');prev.click();bounded();assert.equal(h.target.value,'0');
 h.chooseView(99);bounded();assert.equal(h.target.value,'99');assert.equal(position(),'100 / 100');assert.equal(next.disabled,true);
 h.filter('作者77');bounded();assert.equal(h.view.options.length,1);assert.equal(h.target.options.length,100);assert.equal(h.target.value,'77');assert.equal(position(),'1 / 1');assert.equal(prev.disabled,true);assert.equal(next.disabled,true);h.toggle();assert.equal(doc.querySelectorAll('.member').length,1);assert.match(doc.querySelector('.member').textContent,/架空の作者77/);
 h.filter('person_42');bounded();assert.equal(h.target.value,'42');assert.match(doc.querySelector('.gtitle').textContent,/分類042/);
 h.filter('person_');bounded();assert.equal(h.view.options.length,100);next.click();bounded();assert.equal(h.target.value,'43');
 h.choose(77);bounded();assert.equal(doc.getElementById('search').value,'');assert.equal(position(),'78 / 100');assert.equal(doc.querySelector('.switch input').checked,false);
 const check=doc.querySelector('.switch input');check.click();assert.equal(check.checked,true);check.click();assert.equal(check.checked,false);
 h.filter('一致しない検索');assert.equal(doc.querySelectorAll('.group').length,0);assert.equal(h.view.options.length,0);assert.equal(h.view.disabled,true);assert.equal(h.target.options.length,100);assert.equal(h.target.value,'77');assert.equal(position(),'0 / 0');assert.equal(prev.disabled,true);assert.equal(next.disabled,true);
 h.add('@added_while_search_empty');bounded();assert.equal(doc.getElementById('search').value,'');assert.equal(h.target.value,'77');assert.equal(doc.querySelector('.switch input').checked,false);assert.match(doc.querySelector('.group').textContent,/@added_while_search_empty/);
 h.filter('分類000');doc.getElementById('newFolderName').value='新しい対象';doc.getElementById('addGroup').click();bounded();assert.equal(doc.getElementById('search').value,'');assert.equal(h.target.value,'100');assert.equal(position(),'101 / 101');assert.match(doc.querySelector('.gtitle').textContent,/新しい対象/);h.add('@new_person');bounded();
 h.choose(42);h.toggle();doc.querySelector('.manage .del').click();bounded();assert.equal(h.target.options.length,100);assert.equal(h.target.value,'42');assert.match(doc.querySelector('.gtitle').textContent,/分類043/);h.add('@after_delete');bounded();
 doc.getElementById('back').click();const save=h.posts.filter(p=>p.data.type==='save').at(-1).data;
 const expected=plain(groups);expected[77].ids.push('added_while_search_empty');expected[43].ids.push('after_delete');expected.splice(42,1);expected.push({name:'新しい対象',enabled:true,ids:['new_person']});assert.deepEqual(save.groups,expected);assert.equal(save.groups.find(g=>g.name==='分類077').enabled,false);
 assert.equal(h.posts.some(p=>p.data.type==='return-bell'),false);h.message('saved',{requestId:save.requestId});assert.equal(h.posts.filter(p=>p.data.type==='return-bell').length,1);
});

test('不正URL・予約ルートを人物IDとして追加しない',t=>{
 const h=ui(t);
 for(const value of ['https://note.com.evil/person/n/n123456789abc','https://evil.test/person','https://note.com/settings','https://note.com/person/m/m123456789abc','https://user:secret@note.com/person','javascript:alert(1)','@n','https://note.com/person/n/not-an-article']){
  h.add(value);assert.equal(h.input.value,value);assert.equal(h.w.document.querySelectorAll('.member').length,0);assert.equal(h.requests().length,0);
 }
 assert.equal(h.posts.filter(p=>p.data.type==='save').length,0);
});

test('短縮記事URLは相関IDとアカウントが合った応答だけを適用する',t=>{
 const h=ui(t);h.add('https://note.com/n/n123456789abc');const request=h.requests()[0];
 assert.equal(h.input.disabled,true);assert.equal(h.target.disabled,true);
 h.message('creator-resolved',{requestId:'stale',id:'wrong'});h.message('creator-resolved',{requestId:request.requestId,id:'wrong',account:'other'});
 assert.equal(h.input.disabled,true);assert.equal(h.w.document.querySelectorAll('.member').length,0);
 h.message('creator-resolved',{requestId:request.requestId,id:'actual_author'});
 assert.equal(h.input.disabled,false);assert.equal(h.input.value,'');assert.match(h.w.document.querySelector('.member').textContent,/@actual_author/);
 assert.equal(h.w.document.querySelector('[data-profile-id="n"]'),null);
});

test('失敗・時間切れ・遅い応答は入力と既存フォルダを保持する',t=>{
 const h=ui(t,{groups:[{name:'既存',enabled:false,ids:['kept']}]});const value='https://note.com/n/n123456789abc';
 h.add(value);const first=h.requests()[0];h.message('creator-error',{requestId:first.requestId,message:'記事が見つかりません'});
 assert.equal(h.input.value,value);assert.equal(h.input.disabled,false);assert.match(h.status(),/記事が見つかりません/);
 h.add(value);const second=h.requests()[1];h.timeouts.at(-1)();assert.equal(h.input.value,value);assert.equal(h.input.disabled,false);
 h.message('creator-resolved',{requestId:second.requestId,id:'too_late'});
 assert.equal(h.w.document.querySelector('[data-profile-id="too_late"]'),null);assert.match(h.w.document.querySelector('.count').textContent,/1人/);
});

test('取得中に追加先を削除しても別フォルダへ誤登録しない',t=>{
 const h=ui(t,{groups:[{name:'消すフォルダ',enabled:true,ids:[]},{name:'残すフォルダ',enabled:false,ids:['kept']}]});
 h.toggle(0);h.add('https://note.com/n/n123456789abc');const request=h.requests()[0];
 h.w.document.querySelector('.manage .del').click();h.message('creator-resolved',{requestId:request.requestId,id:'unwanted'});
 assert.match(h.status(),/追加先が変わった/);assert.equal(h.input.value,'https://note.com/n/n123456789abc');assert.equal(h.w.document.querySelectorAll('.group').length,1);assert.equal(h.w.document.querySelector('[data-profile-id="unwanted"]'),null);
});

test('プロフィール更新で入力・フォーカス・既存人物DOMを作り直さない',async t=>{
 const h=ui(t,{groups:[{name:'対象',enabled:true,ids:['person']}]});h.toggle(0);const row=h.w.document.querySelector('.member');
 h.input.value='https://note.com/typing';h.input.focus();h.input.setSelectionRange(5,10);
 h.message('profiles',{profiles:[{id:'person',nickname:'更新した人物名',profileImageUrl:'https://assets.st-note.com/icon.png'}]});
 assert.equal(h.w.document.querySelector('.member'),row);assert.equal(h.w.document.activeElement,h.input);assert.equal(h.input.value,'https://note.com/typing');assert.equal(h.input.selectionStart,5);assert.equal(h.input.selectionEnd,10);assert.match(row.textContent,/更新した人物名/);
 const mutations=[];const observer=new h.w.MutationObserver(records=>mutations.push(...records));observer.observe(row,{subtree:true,childList:true,attributes:true,characterData:true});
 h.message('profiles',{profiles:[{id:'person',nickname:'更新した人物名',profileImageUrl:'https://assets.st-note.com/icon.png'}]});await settle();observer.disconnect();assert.equal(mutations.length,0,'同じ名前・画像を再書込しない');
});

test('人数が多くても閉じたフォルダを描画・取得せず、50人ずつ表示する',t=>{
 const ids=Array.from({length:230},(_,i)=>'person'+i),h=ui(t,{groups:[{name:'大きなフォルダ',enabled:true,ids},{name:'閉じたまま',enabled:true,ids:['untouched']}]});
 assert.equal(h.w.document.querySelectorAll('.member').length,0);assert.equal(h.posts.filter(p=>p.data.type==='profiles').length,0);
 h.toggle(0);assert.equal(h.w.document.querySelectorAll('.member').length,50);assert.equal(h.posts.filter(p=>p.data.type==='profiles')[0].data.ids.length,50);
 h.w.document.querySelector('.more').click();assert.equal(h.w.document.querySelectorAll('.member').length,100);assert.equal(h.posts.filter(p=>p.data.type==='profiles').at(-1).data.ids.length,50);
 assert.ok(h.posts.filter(p=>p.data.type==='profiles').every(p=>!p.data.ids.includes('untouched')));
});

test('保存済みの名前・ID・フォルダ名を検索し、入力を保持する',t=>{
 const h=ui(t,{groups:[{name:'旅行',enabled:true,ids:['journey']},{name:'創作',enabled:true,ids:['writer']}],profiles:[{id:'writer',nickname:'架空の執筆者'}]});
 const search=h.w.document.getElementById('search');search.value='執筆者';search.dispatchEvent(new h.w.Event('input',{bubbles:true}));assert.equal(h.w.document.querySelectorAll('.group').length,1);assert.match(h.w.document.querySelector('.gtitle').textContent,/創作/);h.toggle(0);assert.match(h.w.document.querySelector('.member').textContent,/架空の執筆者/);assert.equal(search.value,'執筆者');
 search.value='旅行';search.dispatchEvent(new h.w.Event('input',{bubbles:true}));assert.equal(h.w.document.querySelectorAll('.group').length,1);assert.match(h.w.document.querySelector('.gtitle').textContent,/旅行/);
});

test('古いbridgeでも通常記事URL・IDは追加でき、短縮URLは更新案内にとどめる',t=>{
 const h=ui(t,{capable:false});h.add('https://note.com/author/n/n123456789abc');assert.match(h.w.document.querySelector('.member').textContent,/@author/);
 h.add('https://note.com/n/nabcdef123456');assert.match(h.status(),/本人通知ツールを更新/);assert.equal(h.input.disabled,false);assert.equal(h.requests().length,0);
});

test('二重の初期state・別アカウントstateで編集中の登録や入力を上書きしない',t=>{
 const h=ui(t);h.add('@kept');h.input.value='入力中';h.message('state',{groups:[],account:'other'});h.message('state',{groups:[]});assert.match(h.w.document.querySelector('.member').textContent,/@kept/);assert.equal(h.input.value,'入力中');
});

test('アカウント不明の設定画面は読み取り専用を維持する',t=>{
 const h=ui(t,{account:'',load:false});h.message('state',{groups:[]});assert.equal(h.input.disabled,true);assert.equal(h.posts.length,0);assert.match(h.status(),/アカウントを確認できません/);
});

function bridge(t,mode,{account='tester',values=new Map(),respond=options=>options.onload({status:200,responseText:JSON.stringify({data:{user:{urlname:'resolved_author'}}})}),setValue}={}){
 const dom=new JSDOM('',{url:'https://mumei-s.github.io/note-insight/notification-filter-settings.html?notificationAccount='+account,runScripts:'outside-only'}),w=dom.window,posts=[],calls=[],writes=[];
 t.after(()=>w.close());w.postMessage=(data,origin)=>posts.push({data:plain(data),origin});
 const get=(key,fallback)=>values.has(key)?values.get(key):fallback;
 const set=async(key,value)=>{writes.push({key,value:plain(value)});if(setValue)await setValue(key,value);values.set(key,plain(value))};
 const xhr=options=>{calls.push(options);respond(options)};
 if(mode==='modern')w.GM={getValue:async(k,d)=>get(k,d),setValue:set,xmlHttpRequest:xhr};else{w.GM_getValue=get;w.GM_setValue=set;w.GM_xmlhttpRequest=xhr}
 w.eval(bridgeCode);
 const send=(type,payload={},origin=w.location.origin)=>w.dispatchEvent(new w.MessageEvent('message',{origin,data:{source:PAGE,account,type,...payload}}));
 return{w,posts,calls,writes,values,send,resolved:()=>posts.filter(p=>p.data.type==='creator-resolved').map(p=>p.data),errors:()=>posts.filter(p=>p.data.type==='creator-error').map(p=>p.data)};
}

for(const mode of ['modern','legacy'])test(`短縮記事URLを公開APIから一度だけ解決し、要求ごとに本人の応答を返す (${mode})`,async t=>{
 const h=bridge(t,mode);const value='https://note.com/n/n123456789abc';h.send('resolve-creator',{requestId:'one',value});h.send('resolve-creator',{requestId:'two',value});await settle();
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].url,'https://note.com/api/v3/notes/n123456789abc');assert.equal(h.calls[0].method,'GET');assert.equal(h.calls[0].anonymous,true);
 assert.deepEqual(h.resolved().map(x=>[x.requestId,x.id,x.account]),[['one','resolved_author','tester'],['two','resolved_author','tester']]);assert.equal(h.writes.length,0);
});

for(const mode of ['modern','legacy'])test(`通常記事URLとプロフィールIDには余分なAPIを呼ばず、予約ルートを拒否する (${mode})`,async t=>{
 const h=bridge(t,mode);for(const [requestId,value] of [['article','https://note.com/Author/n/n123456789abc'],['profile','https://note.com/author'],['bare','@author'],['invalid','https://note.com/n/not-a-key'],['reserved','https://note.com/settings']])h.send('resolve-creator',{requestId,value});await settle();
 assert.equal(h.calls.length,0);assert.deepEqual(h.resolved().map(x=>x.id),['author','author','author']);assert.equal(h.errors().length,2);assert.equal(h.writes.length,0);
});

for(const mode of ['modern','legacy'])test(`別origin・別account・不正要求では公開APIも保存も実行しない (${mode})`,async t=>{
 const h=bridge(t,mode);h.send('resolve-creator',{requestId:'wrong-account',value:'https://note.com/n/n123456789abc',account:'other'});h.send('resolve-creator',{requestId:'wrong-origin',value:'https://note.com/n/n123456789abc'},'https://evil.test');h.send('resolve-creator',{requestId:'x'.repeat(101),value:'https://note.com/n/n123456789abc'});h.send('resolve-creator',{requestId:'untrusted',value:'https://note.com.evil/n/n123456789abc'});await settle();
 assert.equal(h.calls.length,0);assert.equal(h.resolved().length,0);assert.equal(h.writes.length,0);
});

for(const mode of ['modern','legacy'])test(`取得失敗・不明な投稿者は保存せず再試行できる (${mode})`,async t=>{
 let fail=true;const h=bridge(t,mode,{respond:o=>o.onload(fail?{status:200,responseText:JSON.stringify({data:{user:{urlname:'n'}}})}:{status:200,responseText:JSON.stringify({data:{author:{urlname:'valid_author'}}})})});
 h.send('resolve-creator',{requestId:'failure',value:'https://note.com/n/n123456789abc'});await settle();assert.equal(h.errors().length,1);assert.equal(h.resolved().length,0);assert.equal(h.writes.length,0);
 fail=false;h.send('resolve-creator',{requestId:'retry',value:'https://note.com/n/n123456789abc'});await settle();assert.equal(h.calls.length,2);assert.equal(h.resolved()[0].id,'valid_author');
});

for(const mode of ['modern','legacy'])test(`既存profilesを検索用に返し、別アカウントを変えず有効フォルダの和集合を保存する (${mode})`,async t=>{
 const other=[{name:'別アカウント',enabled:true,ids:['untouched']}],values=new Map([[GROUPS+'tester',[{name:'既存',enabled:false,ids:['old']}]], [GROUPS+'other',other],[PROFILES+'tester',[{id:'old',name:'保存された人物',image:'https://assets.st-note.com/old.jpg'}]]]);
 const h=bridge(t,mode,{values});await settle();const state=h.posts.find(p=>p.data.type==='state').data;assert.equal(state.profiles[0].nickname,'保存された人物');assert.equal(state.canResolveArticles,true);assert.equal(h.calls.length,0);
 h.send('save',{groups:[{name:'オフ',enabled:false,ids:['kept']},{name:'オン',enabled:true,ids:['one','ONE','two']}]});await settle();
 assert.deepEqual(values.get(GROUPS+'other'),other);assert.deepEqual(values.get(MUTES+'tester'),['one','two']);assert.equal(values.get(GROUPS+'tester')[0].enabled,false);
});

for(const mode of ['modern','legacy'])test(`連続保存と戻る応答はGM書込の順番を守る (${mode})`,async t=>{
 let release,held=true;const h=bridge(t,mode,{setValue:async key=>{if(held&&key===GROUPS+'tester'){held=false;await new Promise(resolve=>release=resolve)}}});
 h.send('save',{groups:[{name:'一度目',enabled:true,ids:['one']}]});h.send('save',{groups:[{name:'二度目',enabled:true,ids:['two']}]});h.send('return-bell');await settle();assert.equal(h.posts.some(p=>p.data.type==='return-ready'),false);release();await settle();
 assert.deepEqual(h.values.get(MUTES+'tester'),['two']);assert.equal(h.values.get(GROUPS+'tester')[0].name,'二度目');assert.equal(h.posts.some(p=>p.data.type==='return-ready'),true);
 assert.deepEqual(h.writes.slice(0,4).map(w=>w.key),[GROUPS+'tester',MUTES+'tester',GROUPS+'tester',MUTES+'tester']);
});

test('追加直後に戻っても、900msを過ぎた未確認保存を迂回しない',async t=>{
 const h=ui(t);h.add('@new_person');h.w.document.getElementById('back').click();
 const save=h.posts.find(p=>p.data.type==='save').data;assert.ok(save.requestId);assert.equal(h.returnTimers.length,0);assert.equal(h.posts.some(p=>p.data.type==='return-bell'),false);
 await new Promise(r=>setTimeout(r,950));assert.equal(h.returnTimers.length,0);assert.match(h.status(),/保存してから/);assert.match(h.w.document.querySelector('.member').textContent,/@new_person/);
 h.message('saved',{requestId:'stale'});assert.equal(h.posts.some(p=>p.data.type==='return-bell'),false);
 h.message('saved',{requestId:save.requestId});assert.equal(h.posts.filter(p=>p.data.type==='return-bell').length,1);assert.equal(h.returnTimers.length,1);
});

test('保存失敗では登録内容と入力を残し、明示再試行の成功前に戻らない',t=>{
 const h=ui(t);h.add('@new_person');h.input.value='入力中';h.w.document.getElementById('back').click();const original=h.posts.find(p=>p.data.type==='save').data;
 h.message('error',{action:'save',requestId:original.requestId,message:'保存に失敗しました'});
 const retry=h.w.document.getElementById('retrySave');assert.equal(retry.hidden,false);assert.equal(h.returnTimers.length,0);assert.equal(h.input.value,'入力中');assert.match(h.w.document.querySelector('.member').textContent,/@new_person/);
 retry.click();const next=h.posts.filter(p=>p.data.type==='save').at(-1).data;assert.notEqual(next.requestId,original.requestId);assert.deepEqual(next.groups,original.groups);
 h.message('saved',{requestId:original.requestId});assert.equal(h.posts.some(p=>p.data.type==='return-bell'),false);
 h.message('saved',{requestId:next.requestId});assert.equal(retry.hidden,true);assert.equal(h.posts.some(p=>p.data.type==='return-bell'),false,'失敗後は勝手に画面を離れない');
 h.w.document.getElementById('back').click();assert.equal(h.posts.filter(p=>p.data.type==='return-bell').length,1);
});

test('保存中の追加を直列化し、最後のスナップショットの確認まで戻らない',async t=>{
 const h=ui(t);h.add('@one');await new Promise(r=>setTimeout(r,150));const first=h.posts.find(p=>p.data.type==='save').data;
 h.add('@two');h.w.document.getElementById('back').click();assert.equal(h.posts.filter(p=>p.data.type==='save').length,1);assert.equal(h.returnTimers.length,0);
 h.message('saved',{requestId:first.requestId});const saves=h.posts.filter(p=>p.data.type==='save').map(p=>p.data);assert.equal(saves.length,2);assert.deepEqual(saves[1].groups[0].ids,['one','two']);assert.equal(h.returnTimers.length,0);
 h.message('saved',{requestId:saves[1].requestId});assert.equal(h.posts.filter(p=>p.data.type==='return-bell').length,1);
});

test('記事の投稿者取得中に戻った後の遅い応答で追加しない',t=>{
 const h=ui(t);h.add('https://note.com/n/n123456789abc');const request=h.requests()[0];h.w.document.getElementById('back').click();h.message('creator-resolved',{requestId:request.requestId,id:'late_author'});
 assert.equal(h.posts.some(p=>p.data.type==='save'),false);assert.equal(h.w.document.querySelector('[data-profile-id="late_author"]'),null);assert.equal(h.input.value,'https://note.com/n/n123456789abc');
});

for(const mode of ['modern','legacy'])test(`HTTP成功を確認できない記事応答は採用しない (${mode})`,async t=>{
 for(const status of [undefined,'unknown',199,300]){
  const h=bridge(t,mode,{respond:o=>o.onload({status,responseText:JSON.stringify({data:{user:{urlname:'unverified_author'}}})})});h.send('resolve-creator',{requestId:'check',value:'https://note.com/n/n123456789abc'});await settle();assert.equal(h.resolved().length,0);assert.equal(h.errors().length,1);assert.equal(h.writes.length,0);
 }
});

for(const mode of ['modern','legacy'])test(`保存失敗は要求ID付きで報告し、成功応答を出さない (${mode})`,async t=>{
 const h=bridge(t,mode,{setValue:async()=>{throw new Error('保存先エラー')}});h.send('save',{requestId:'failed-save',groups:[{name:'保持',enabled:true,ids:['one']}]});await settle();const error=h.posts.find(p=>p.data.type==='error'&&p.data.action==='save')?.data;assert.equal(error.requestId,'failed-save');assert.equal(h.posts.some(p=>p.data.type==='saved'),false);
});

test('戻り先への移動待ちで追加した変更も保存前の古いタイマーで失わない',t=>{
 const h=ui(t),navigation=[];h.w._virtualConsole.on('jsdomError',error=>navigation.push(error));h.w.document.getElementById('back').click();assert.equal(h.returnTimers.length,1);
 h.add('@kept_after_back');h.returnTimers[0]();assert.equal(navigation.length,0,'旧fallbackは未保存の変更があれば移動しない');assert.match(h.w.document.querySelector('.member').textContent,/@kept_after_back/);
});

test('旧bridgeの遅い無相関の保存応答は時間切れ後の再試行を完了扱いしない',t=>{
 const h=ui(t,{capable:false});h.add('@one');h.w.document.getElementById('back').click();h.saveTimeouts.at(-1)();const retry=h.w.document.getElementById('retrySave');assert.equal(retry.hidden,false);
 retry.click();const latest=h.posts.filter(p=>p.data.type==='save').at(-1).data;h.w.document.getElementById('back').click();h.message('saved');
 assert.equal(h.posts.some(p=>p.data.type==='return-bell'),false);assert.equal(h.returnTimers.length,0);assert.match(h.status(),/本人通知ツールの更新/);assert.match(h.w.document.querySelector('.member').textContent,/@one/);
 h.message('saved',{requestId:latest.requestId});assert.equal(retry.hidden,true,'新bridgeの明確な確認なら保存は完了できる');
});
