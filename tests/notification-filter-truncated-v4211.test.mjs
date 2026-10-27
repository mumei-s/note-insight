import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(process.env.FILTER_TRUNCATED_SOURCE||'public/note-insight-notification-filter-v4.js','utf8');
const FIL='mumei_insight_magazine_filter_enabled_v3:tester',GRP='mumei_insight_notification_groups_v1:tester',PRO='mumei_insight_magazine_mute_profiles_v5:tester';
const actor='<a href="/fictional_actor">架空の先頭人物</a>',lead=actor+'さん他46名が',suffix='に新しい記事を52本追加しました';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const row=(id,html,tag='li',href='')=>`<${tag} class="m-navbarNoticeItem" id="${id}"${href?` href="${href}"`:''}>${html}<time>2分前</time></${tag}>`;
function fixture(t,{mode='modern',items=[],enabled=true}={}){
 const dom=new JSDOM('<!doctype html><html><body><ul id="panel" class="notificationList" style="height:420px;overflow:auto">'+items.join('')+'</ul></body></html>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
 const values=new Map([[FIL,enabled],[GRP,[{name:'架空の登録先',enabled:true,ids:['fictional_actor']}]],[PRO,[{id:'fictional_actor',name:'架空の先頭人物'}]]]),requests=[],events=[];let readError=false,currentResponse=()=>Response.json({data:{urlname:'tester'}});
 const get=(key,fallback)=>{if(readError)throw Error('fixture storage unavailable');return values.get(key)??fallback};
 if(mode==='modern')w.GM={getValue:async(...args)=>get(...args),setValue:async(key,value)=>values.set(key,value)};else{w.GM_getValue=get;w.GM_setValue=(key,value)=>values.set(key,value)}
 w.fetch=async url=>{requests.push(String(url));if(String(url)==='/api/v2/current_user')return currentResponse();throw Error('unexpected fixture network')};
 w.HTMLElement.prototype.getBoundingClientRect=()=>({top:80,bottom:140,left:0,right:360,width:360,height:60});
 w.__mumeiNotificationReaderV4={findPanel:()=>w.document.getElementById('panel')};
 w.addEventListener('mumei-notification-filter-status',event=>events.push(event.detail));w.eval(source);
 return{w,values,requests,events,refresh:()=>w.__mumeiNotificationFilterV4.refresh(true),state:()=>w.__mumeiNotificationFilterV4.getState(),hidden:id=>w.document.getElementById(id).classList.contains('mumei-muted-v2939'),failReads:()=>{readError=true},currentReply:fn=>{currentResponse=fn}};
}

for(const mode of ['modern','legacy'])test(`省略されたマガジン名で括弧が閉じなくても追加通知を判定する (${mode})`,async t=>{
 const cases=[
  ['plain',lead+'架空の成長ラウンジ【...'+suffix],
  ['ellipsis',lead+'🍀架空の【可能性を…'+suffix],
  ['double-ellipsis',lead+'架空の『作品棚⋯⋯'+suffix],
  ['parenthesis',lead+'架空の作品棚（...'+suffix],
  ['split',`<p>${lead}</p><p>架空の【作品棚...${suffix}</p><div>架空の記事プレビュー</div>`],
  ['linked-title',lead+`<a href="/fictional_owner/m/mfictional">架空の【閉じない作品棚</a>${suffix}`],
  ['linked-magazine-route',lead+`<a href="/magazine/mfictional">架空の『閉じない作品棚</a>${suffix}`],
  ['linked-short-route',lead+`<a href="/m/mfictional">架空の（閉じない作品棚</a>${suffix}`],
  ['linked-action',lead+`<a href="/magazine/mfictional">架空の成長ラウンジ【...${suffix}</a>`],
  ['paragraph-linked-action',`<p>${lead}<a href="/fictional_owner/m/mfictional">架空の成長ラウンジ【...${suffix}</a></p>`],
  ['whole-child',`<a href="/magazine/mfictional">架空の先頭人物さん他46名が架空の成長ラウンジ【...${suffix}</a>`],
 ];
 const whole=row('whole-root','架空の先頭人物さん他32名が🍀架空の【可能性を...'+suffix,'a','/fictional_owner/m/mfictional');
 const f=fixture(t,{mode,items:[...cases.map(([id,html])=>row(id,html)),whole,row('visible',actor+'さんがあなたの記事にスキしました')]});
 const originals=new Map([...f.w.document.querySelectorAll('.m-navbarNoticeItem')].map(el=>[el.id,el]));await f.refresh();
 for(const[id]of cases)assert.equal(f.hidden(id),true,id);assert.equal(f.hidden('whole-root'),true);assert.equal(f.hidden('visible'),false);
 assert.deepEqual(f.requests,['/api/v2/current_user'],'省略名の判定にプロフィールや通知APIを追加で呼ばない');
 f.values.set(FIL,false);await f.refresh();
 for(const[id,el]of originals){assert.equal(f.hidden(id),false,id+' off');assert.equal(f.w.document.getElementById(id),el,'native DOMを保持する')}
});

for(const mode of ['modern','legacy'])test(`省略した括弧付きタイトルでも購入・紹介・交流・自分の記事追加を残す (${mode})`,async t=>{
 const title='架空の成長ラウンジ【...'+suffix,cases=[
  ['like',lead+'あなたの記事にスキしました'],
  ['reply',lead+'あなたのコメントに返信しました'],
  ['purchase',lead+'あなたの記事を購入しました'],
  ['introduced',lead+'記事内であなたの記事を紹介しました'],
  ['quoted',lead+`「${title}」という記事を購入しました`],
  ['quoted-like',lead+`「${title}」という記事にスキしました`],
  ['quoted-reply',lead+`「${title}」という記事に返信しました`],
  ['quoted-introduced',lead+`「${title}」という記事であなたの記事を紹介しました`],
  ['quoted-embedded',lead+`「${title}」という記事にあなたの記事を埋め込みました`],
  ['split-purchase',lead+`<div>${title}</div><div>という記事を購入しました</div>`],
  ['split-quote',lead+`<p>「${title}</p><p>」という記事にスキしました</p>`],
  ['linked-article',lead+`<a href="/fictional_writer/n/n123456789abc">${title}</a>という記事を購入しました`],
  ['purchase-preview',lead+`あなたの記事を購入しました<div>${title}</div>`],
  ['like-preview',lead+`あなたの記事にスキしました<div>${title}</div>`],
  ['reply-preview',lead+`あなたのコメントに返信しました<div>${title}</div>`],
  ['introduced-preview',lead+`あなたの記事を紹介しました<div>${title}</div>`],
  ['linked-earlier-purchase',lead+`<a href="/magazine/mfictional">あなたの記事を購入しました</a><div>${title}</div>`],
  ['linked-earlier-introduced',lead+`<a href="/magazine/mfictional">あなたの記事を紹介しました</a>${title}`],
  ['linked-earlier-action',lead+`<a href="/magazine/mfictional">購入しました</a>${suffix}`],
  ['own-article',lead+'あなたの記事をマガジン「架空の【作品棚...」に追加しました'],
  ['own-article-passive',lead+'あなたの記事がマガジン「架空の【作品棚...」に追加されました'],
  ['buzz',actor+'さんの記事であなたの記事が紹介されて話題になりました<div>'+title+'</div>'],
  ['joined',lead+'共同マガジン「架空の【作品棚...」に仲間入りしました'],
  ['no-ellipsis',lead+'架空の【作品棚'+suffix],
  ['external-title',lead+`<a href="https://evilnote.com/fictional_owner/m/mfictional">架空の【作品棚</a>${suffix}`],
  ['http-title',lead+`<a href="http://note.com/fictional_owner/m/mfictional">架空の【作品棚</a>${suffix}`],
  ['credential-title',lead+`<a href="https://fake:fictional@note.com/m/mfictional">架空の【作品棚</a>${suffix}`],
  ['port-title',lead+`<a href="https://note.com:8443/m/mfictional">架空の【作品棚</a>${suffix}`],
  ['profile-title',lead+`<a href="/fictional_magazine">架空の【作品棚</a>${suffix}`],
  ['unregistered','<a href="/other">架空の別人物</a>さんが架空の【作品棚...'+suffix],
 ];
 const f=fixture(t,{mode,items:[row('positive',lead+'架空の【作品棚...'+suffix),...cases.map(([id,html])=>row(id,html))]});await f.refresh();assert.equal(f.hidden('positive'),true);
 for(const[id]of cases)assert.equal(f.hidden(id),false,id);
});

for(const mode of ['modern','legacy'])test(`状態報告は匿名の件数だけを返し、再判定・通信を増やさない (${mode})`,async t=>{
 const f=fixture(t,{mode,items:[row('matched',lead+'架空の【作品棚...'+suffix),row('other','<a href="/other">別人物</a>さんが架空の【作品棚...'+suffix),row('unresolved','未確認の架空人物さんが架空の【作品棚...'+suffix),row('like',lead+'あなたの記事にスキしました')]});await f.refresh();
 assert.deepEqual(JSON.parse(JSON.stringify(f.state())),{version:f.w.__mumeiNotificationFilterV4.version,enabled:true,registered:1,total:4,hidden:1,magazineAdd:3,unresolved:1});
 assert.doesNotMatch(JSON.stringify(f.state()),/fictional_actor|架空|tester|https:/);
 const before=f.requests.length;await f.refresh();assert.equal(f.requests.length,before,'状態確認のための追加APIなし');
 f.values.set(FIL,false);await f.refresh();const off=JSON.parse(JSON.stringify(f.state()));assert.equal(off.enabled,false);assert.equal(off.hidden,0);assert.equal(off.registered,1);
});

test('アカウントやパネルを切り替えた間は前の件数を返さない',async t=>{
 const f=fixture(t,{items:[row('matched',lead+'架空の【作品棚...'+suffix)]});await f.refresh();assert.equal(f.state().hidden,1);
 let deliver;f.currentReply(()=>new Promise(resolve=>{deliver=resolve}));
 const old=f.w.document.getElementById('panel'),next=old.cloneNode(true);old.replaceWith(next);const pending=f.refresh();await pause(0);
 assert.equal(f.state(),null);assert.equal(f.events.at(-1),null);
 deliver(new Response('',{status:403}));await pending;assert.equal(f.state(),null);
});

test('保存設定を確認できない時は以前の判定数を成功として残さない',async t=>{
 const f=fixture(t,{items:[row('matched',lead+'架空の【作品棚...'+suffix)]});await f.refresh();assert.equal(f.state().hidden,1);f.failReads();await f.refresh();assert.equal(f.state(),null);assert.equal(f.events.at(-1),null);
});
