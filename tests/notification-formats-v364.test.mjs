import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(p,'utf8'),settle=()=>new Promise(r=>setImmediate(r));
function classifier(file){const source=read(file),start=source.indexOf('const KIND_TYPES'),end=source.indexOf('\nasync function identity')>0?source.indexOf('\nasync function identity'):source.indexOf('\nfunction noise');const context=vm.createContext({URL,actionText:v=>String(v),canonicalText:v=>String(v)});vm.runInContext(ts.transpileModule(source.slice(start,end)+'\nthis.classify=classify',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);return context.classify}
for(const name of ['ingest-v2','reclassify'])test(name+'：画像使用を分類し、embed_noteの話題と引用を区別する',()=>{
 const f=classifier('supabase/functions/insight-notification-'+name+'/index.ts');
 assert.equal(f('猫田さんが記事であなたの画像を使用しました',null,{kind:'stock_photo'}),'image_used');
 assert.equal(f('ななさんの紹介記事で、 あなたの記事 が話題です！',null,{kind:'embed_note'}),'buzz');
 assert.equal(f('あなたの記事が引用されました',null,{kind:'embed_note'}),'quote');
 assert.equal(f('「あなたの記事が話題です」を購入しました',null,{kind:'purchase'}),'purchase');
 assert.equal(f('知らない新形式の通知です',null,{kind:'future_format'}),'other');
});
function filterEnv(t){
 const dom=new JSDOM('<section id="notices"><button>通知</button><button>お知らせ</button><div class="m-navbarNoticeItem" id="mute"><a href="/person"><img></a>登録人物さん他4名が共同マガジンに新しい記事を5本追加しました</div><div class="m-navbarNoticeItem" id="like">登録人物さんがあなたの記事にスキしました</div><div class="m-navbarNoticeItem" id="keep">別の人さん他4名が共同マガジンに新しい記事を5本追加しました</div></section>',{url:'https://note.com/',runScripts:'outside-only'}),w=dom.window,gm=new Map();
 t.after(()=>w.close());w.HTMLElement.prototype.getBoundingClientRect=()=>({width:350,height:200,top:0,left:0});w.setTimeout=()=>0;w.clearTimeout=()=>{};
 w.fetch=async url=>({ok:true,json:async()=>String(url).includes('current_user')?{data:{urlname:'tester'}}:{data:{nickname:'登録人物'}}});
 w.GM={getValue:async(k,d)=>gm.get(k)??d,setValue:async(k,v)=>gm.set(k,v)};gm.set('mumei_insight_magazine_filter_enabled_v3:tester',true);gm.set('mumei_insight_notification_groups_v1:tester',[{name:'対象',ids:['person'],enabled:true}]);
 w.eval(read('public/note-insight-notification-filter-v4.js'));return{w,gm};
}
test('既存登録に人物名がなくても自動補完し、ONで対象のマガジン通知だけを非表示にする',async t=>{
 const h=filterEnv(t);await h.w.__mumeiNotificationFilterV4.refresh(true);for(let i=0;i<10;i++)await settle();await h.w.__mumeiNotificationFilterV4.refresh(true);
 assert.equal(h.gm.get('mumei_insight_magazine_mute_profiles_v5:tester')[0].name,'登録人物');
 assert.equal(h.w.document.getElementById('mute').classList.contains('mumei-muted-v2939'),true);assert.equal(h.w.document.getElementById('like').classList.contains('mumei-muted-v2939'),false);assert.equal(h.w.document.getElementById('keep').classList.contains('mumei-muted-v2939'),false);
 h.gm.set('mumei_insight_magazine_filter_enabled_v3:tester',false);await h.w.__mumeiNotificationFilterV4.refresh(true);assert.equal(h.w.document.getElementById('mute').classList.contains('mumei-muted-v2939'),false);
});
test('設定画面のプロフィール取得はフィルター判定用の人物名も永続保存する',async t=>{
 const dom=new JSDOM('',{url:'https://mumei-s.github.io/note-insight/notification-filter-settings.html?notificationAccount=tester',runScripts:'outside-only'}),w=dom.window,gm=new Map();t.after(()=>w.close());
 w.GM={getValue:async(k,d)=>gm.get(k)??d,setValue:async(k,v)=>gm.set(k,v),xmlHttpRequest:o=>o.onload({status:200,responseText:JSON.stringify({data:{nickname:'登録人物',profileImageUrl:'https://example.test/icon.jpg'}})})};w.eval(read('public/note-insight-notification-settings-bridge-v1.js'));
 w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,data:{source:'mumei-filter-page-v1',account:'tester',type:'profiles',ids:['person']}}));for(let i=0;i<8;i++)await settle();assert.equal(human(gm),'登録人物');
 function human(m){return m.get('mumei_insight_magazine_mute_profiles_v5:tester')?.[0]?.name}
});
async function ownerBackend({noteId='tester',ownerToken=false,expired=false}={}){
 let handler,calls=0,writes=[];const db={rpc:async()=>{calls++;return{data:[{kind:'future_kind',notification_count:2,read_at:null}]}},from(table){let payload=null;const q={};for(const m of ['select','eq'])q[m]=()=>q;q.upsert=v=>{payload=v;return q};const result=()=>{if(payload){writes.push(payload);return{data:[]}}if(table==='unified_owner_sessions')return{data:{note_urlname:noteId,expires_at:expired?'2000-01-01':'2099-01-01'}};if(table==='insight_member_sessions')return{data:{application_id:'member',expires_at:expired?'2000-01-01':'2099-01-01'}};if(table==='insight_access_applications')return{data:{note_id:noteId,status:'active',verified_at:'2026-01-01'}};return{data:[]}};q.maybeSingle=async()=>result();q.then=(y,n)=>Promise.resolve(result()).then(y,n);return q}};
 const context=vm.createContext({Deno:{env:{get:()=>''},serve:fn=>handler=fn},crypto:globalThis.crypto,TextEncoder,Response,Request});const js=ts.transpileModule(read('supabase/functions/insight-notification-format-reviews/index.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,mod=new vm.SourceTextModule(js,{context});await mod.link(()=>new vm.SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>db)},{context}));await mod.evaluate();
 return{calls:()=>calls,writes,request:body=>handler(new Request('https://example.test',{method:'POST',headers:{[ownerToken?'X-Owner-Token':'X-Insight-Token']:'fixture'},body:JSON.stringify(body)}))};
}
test('参加者は他参加者の分類案内を取得・既読操作できない',async()=>{for(const action of ['list','read']){const h=await ownerBackend(),r=await h.request({action,kind:'future_kind'});assert.equal(r.status,403);assert.equal(h.calls(),0);assert.equal(h.writes.length,0)}});
test('認証済み運営者だけに全参加者分の形式と件数を返し、既読を保存する',async()=>{for(const ownerToken of [false,true]){const h=await ownerBackend({noteId:'ss_yr',ownerToken}),r=await h.request({action:'read',kind:'future_kind'}),p=await r.json();assert.equal(r.status,200);assert.equal(p.alerts[0].notification_count,2);assert.ok(h.writes[0].read_at);assert.equal('raw_text' in p.alerts[0],false)}});
test('運営者でも期限切れセッションは拒否する',async()=>{const h=await ownerBackend({noteId:'ss_yr',expired:true}),r=await h.request({});assert.equal(r.status,403);assert.equal(h.calls(),0)});
