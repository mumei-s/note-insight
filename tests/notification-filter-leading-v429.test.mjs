import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(process.env.FILTER_LEADING_SOURCE||'public/note-insight-notification-filter-v4.js','utf8');
const GROUPS='mumei_insight_notification_groups_v1:tester',PROFILES='mumei_insight_magazine_mute_profiles_v5:tester',ENABLED='mumei_insight_magazine_filter_enabled_v3:tester';
const people=[{id:'actor_a',name:'架空の作家A'},{id:'actor_c',name:'架空さんと散歩する会'},{id:'actor_d',name:'架空さん、の読書便り'}];
const link=(id,name)=>`<a href="/${id}">${name}</a>`;
const a=link('actor_a',people[0].name),b=link('actor_b','架空の作家B');
const added='架空の共同作品棚に新しい記事を36本追加しました';
const row=(id,body,tag='li',href='')=>`<${tag} class="m-navbarNoticeItem" id="${id}"${href?` href="${href}"`:''}>${body}<time>1分前</time></${tag}>`;

function fixture(t,{mode='modern',rows=[],profiles=people}={}){
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="panel" class="notificationList" style="height:420px;overflow:auto">'+rows.join('')+'</div></body></html>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>w.close());const panel=w.document.getElementById('panel'),values=new Map([[ENABLED,true],[GROUPS,[{name:'架空の登録先',enabled:true,ids:people.map(p=>p.id)}]],[PROFILES,profiles]]),requests=[];
 if(mode==='modern')w.GM={getValue:async(key,fallback)=>values.get(key)??fallback,setValue:async(key,value)=>values.set(key,value)};
 else{w.GM_getValue=(key,fallback)=>values.get(key)??fallback;w.GM_setValue=(key,value)=>values.set(key,value)}
 w.fetch=async url=>{requests.push(String(url));if(String(url)==='/api/v2/current_user')return Response.json({data:{urlname:'tester'}});return new Promise(()=>{})};
 w.HTMLElement.prototype.getBoundingClientRect=function(){return{top:80,bottom:140,left:0,right:360,width:360,height:60}};
 w.__mumeiNotificationReaderV4={findPanel:()=>panel};w.eval(source);
 const refresh=()=>w.__mumeiNotificationFilterV4.refresh(true);
 return{w,panel,values,requests,refresh,hidden:id=>w.document.getElementById(id).classList.contains('mumei-muted-v2939')};
}

for(const mode of ['modern','legacy'])test(`同じ通知に複数の人物がいても先頭の登録IDだけで判定する (${mode})`,async t=>{
 const cases=[
  ['single',`${a}さんが${added}`,true],
  ['comma',`${a}さん、${b}さん他35名が${added}`,true],
  ['ascii-comma',`${a}さん, ${b}さんが${added}`,true],
  ['wide-comma',`${a}さん，${b}さん他35名が${added}`,true],
  ['and',`${a}さんと${b}さんが${added}`,true],
  ['nested',`<p><span>${a}さん</span><span>、${b}さん他35名が</span></p><p>${added}</p><div class="preview">架空の記事プレビュー</div>`,true],
  ['truncated',`${link('actor_a','架空の作…')}さん、${b}さんが${added}`,true],
  ['unlisted-first',`${b}さん、${a}さん他35名が${added}`,false],
  ['unlisted-first-and',`${b}さんと${a}さんが${added}`,false],
  ['preview-only',`${b}さんが${added}<div class="preview">${a}さんの記事プレビュー</div>`,false],
  ['ambiguous-no-link',`架空の作家Aさん、架空の作家Bさん他35名が${added}`,false],
 ];
 const f=fixture(t,{mode,rows:cases.map(([id,body])=>row(id,body))}),originals=cases.map(([id])=>f.w.document.getElementById(id));await f.refresh();
 for(const[id,,expected]of cases)assert.equal(f.hidden(id),expected,id);
 assert.equal(f.requests.filter(url=>url==='/api/v2/current_user').length,1);
 f.values.set(ENABLED,false);await f.refresh();
 for(let i=0;i<cases.length;i++){assert.equal(f.hidden(cases[i][0]),false,cases[i][0]+' off');assert.equal(f.w.document.getElementById(cases[i][0]),originals[i],'native行を作り直さない')}
});

for(const mode of ['modern','legacy'])test(`複数人物でも購入・スキ・返信・紹介や対象文言を含む記事タイトルは保持する (${mode})`,async t=>{
 const lead=`${a}さん、${b}さん他35名が`,cases=[
  ['like',lead+'あなたの記事にスキしました'],
  ['reply',lead+'あなたのコメントに返信しました'],
  ['purchase',lead+'あなたの記事を購入しました'],
  ['introduced',lead+'記事内であなたの記事を紹介しました'],
  ['buzz',`${a}さん、${b}さんの記事であなたの記事が紹介されて話題になりました`],
  ['joined',lead+'共同運営マガジンに仲間入りしました'],
  ['own-article',lead+'あなたの記事をマガジン「架空の作品棚」に追加しました'],
  ['quoted-purchase',lead+`「${added}」という記事を購入しました`],
  ['split-title',lead+`<div>${added}</div><div>という記事にスキしました</div>`],
  ['linked-title',lead+`<a href="/fictional_writer/n/n123456789abc">${added}</a><div>という記事を購入しました</div>`],
 ];
 const f=fixture(t,{mode,rows:[row('positive',`${a}さんが${added}`),...cases.map(([id,body])=>row(id,body))]});await f.refresh();assert.equal(f.hidden('positive'),true);
 for(const[id]of cases)assert.equal(f.hidden(id),false,id);
});

for(const mode of ['modern','legacy'])test(`名前の中の「さんと」「さん、」を別人物に分解しない (${mode})`,async t=>{
 const c=link(people[1].id,people[1].name),d=link(people[2].id,people[2].name),cases=[
  ['exact-and',`${c}さんが${added}`,true],
  ['exact-comma',`${d}さんが${added}`,true],
  ['group-and',`${c}さん、${b}さんが${added}`,true],
  ['group-comma',`${d}さんと${b}さんが${added}`,true],
  ['unlisted-prefix-and',`${link('unlisted_and','架空の作家Aさんと歩く会')}さんが${added}`,false],
  ['unlisted-prefix-comma',`${link('unlisted_comma','架空の作家Aさん、の集い')}さんが${added}`,false],
 ];
 const f=fixture(t,{mode,rows:cases.map(([id,body])=>row(id,body))});await f.refresh();for(const[id,,expected]of cases)assert.equal(f.hidden(id),expected,id);
});

for(const mode of ['modern','legacy'])test(`省略名・単一人物＋他N名・人物リンクがないマガジン全体リンクを維持する (${mode})`,async t=>{
 const cases=[row('collapsed',`${a}さん他1,234名が${added}`),row('whole-magazine','架空の作家Aさん他35名が'+added,'a','/actor_a/m/mfictional')],f=fixture(t,{mode,rows:cases});await f.refresh();assert.equal(f.hidden('collapsed'),true);assert.equal(f.hidden('whole-magazine'),true);
});

for(const mode of ['modern','legacy'])test(`プロフィール名の後着でも同じ行を再判定し、複数人物のID判定とOFF復元を保つ (${mode})`,async t=>{
 const f=fixture(t,{mode,profiles:[],rows:[row('group',`${a}さん、${b}さん他35名が${added}`),row('name-only','架空の作家Aさん他35名が'+added,'a','/actor_a/m/mfictional')]});
 const original=f.w.document.getElementById('group'),originalText=original.textContent;await f.refresh();assert.equal(f.hidden('group'),true,'人物プロフィールの取得待ちでも先頭リンクのIDを使う');assert.equal(f.hidden('name-only'),false);
 f.values.set(PROFILES,people);await f.refresh();assert.equal(f.hidden('group'),true);assert.equal(f.hidden('name-only'),true);assert.equal(f.w.document.getElementById('group'),original);assert.equal(original.textContent,originalText);
 f.values.set(ENABLED,false);await f.refresh();assert.equal(f.hidden('group'),false);assert.equal(f.hidden('name-only'),false);assert.equal(f.w.document.getElementById('group'),original);assert.equal(original.textContent,originalText);
});

for(const mode of ['modern','legacy'])test(`古い保存名でも単独の先頭avatar IDで判定し、曖昧・後続・未信頼URLは保持する (${mode})`,async t=>{
 const avatar=href=>`<a href="${href}"><img alt=""></a>`,changed='架空の新しい表示名さん他35名が'+added,profiles=people.map(p=>({...p,name:p.id==='actor_a'?'架空の以前の表示名':p.name}));
 const cases=[
  ['leading-avatar',avatar('https://note.com/actor_a')+changed,true],
  ['same-avatar',avatar('https://note.com/actor_a')+avatar('https://note.com/actor_a')+changed,true],
  ['ambiguous-avatars',avatar('https://note.com/actor_a')+avatar('https://note.com/actor_b')+changed,false],
  ['preview-avatar','架空の別人物さんが'+added+'<div class="preview">'+avatar('https://note.com/actor_a')+'架空の記事プレビュー</div>',false],
  ['later-avatar','架空の別人物さんが'+avatar('https://note.com/actor_a')+added,false],
  ['untrusted-host',avatar('https://evilnote.com/actor_a')+changed,false],
  ['http',avatar('http://note.com/actor_a')+changed,false],
  ['javascript',avatar('javascript://note.com/actor_a')+changed,false],
  ['credentials',avatar('https://fake:fictional@note.com/actor_a')+changed,false],
  ['port',avatar('https://note.com:8443/actor_a')+changed,false],
  ['magazine-avatar',avatar('https://note.com/actor_a/m/mfictional')+changed,false],
 ];
 const f=fixture(t,{mode,profiles,rows:[...cases.map(([id,body])=>row(id,body)),row('stale-whole-magazine',changed,'a','https://note.com/actor_a/m/mfictional')]});await f.refresh();
 for(const[id,,expected]of cases)assert.equal(f.hidden(id),expected,id);assert.equal(f.hidden('stale-whole-magazine'),false,'IDを確認できない全体リンクでは別人の通知を推測して消さない');
 assert.deepEqual(f.requests,['/api/v2/current_user','/api/v2/creators/actor_a'],'曖昧な集合avatarにいる登録人物だけ再確認し、既知の他人物は再取得しない');
 f.values.set(ENABLED,false);await f.refresh();for(const[id]of cases)assert.equal(f.hidden(id),false,id+' off');
});

for(const mode of ['modern','legacy'])test(`同じ表示名でも先頭の確定IDを保存名より優先し、preview人物へ置き換えない (${mode})`,async t=>{
 const common='共通の架空表示名',avatar=id=>`<a href="https://note.com/${id}"><img alt=""></a>`,profiles=people.map(p=>({...p,name:p.id==='actor_a'?common:p.name}));
 const cases=[
  ['named-a',`${link('actor_a',common)}さんが${added}`,true],
  ['named-b',`${link('actor_b',common)}さんが${added}`,false],
  ['avatar-b',avatar('actor_b')+common+'さんが'+added,false],
  ['eight-avatars-visible-a',Array.from({length:8},(_,i)=>avatar(i===3?'actor_a':'group_'+i)).join('')+common+'さん他35名が'+added,true],
  ['eight-avatars-visible-b',Array.from({length:8},(_,i)=>avatar(i===3?'actor_a':'group_'+i)).join('')+'架空の未登録者Bさん他35名が'+added,false],
  ['eight-avatars-linked-b',Array.from({length:8},(_,i)=>avatar(i===3?'actor_a':'group_'+i)).join('')+link('actor_b',common)+'さん他35名が'+added,false],
  ['renamed-avatar-a',avatar('actor_a')+'架空の改名後の人物さんが'+added,true],
  ['b-with-preview-a',`${link('actor_b',common)}さんが${added}<div class="preview">${link('actor_a',common)}</div>`,false],
  ['b-avatar-with-preview-a',avatar('actor_b')+common+'さんが'+added+`<div class="preview">${link('actor_a',common)}</div>`,false],
 ];
 const f=fixture(t,{mode,profiles,rows:cases.map(([id,body])=>row(id,body))});await f.refresh();for(const[id,,expected]of cases)assert.equal(f.hidden(id),expected,id);
 f.values.set(ENABLED,false);await f.refresh();for(const[id]of cases)assert.equal(f.hidden(id),false,id+' off');
});
