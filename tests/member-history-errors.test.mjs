import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';

const validSession={id:'session-a',application_id:'application-a',expires_at:'2099-01-01T00:00:00Z',revoked_at:null};
const validApplication={id:'application-a',note_id:'tester',display_name:'本人',image_url:null,status:'active'};
const timeout={code:'57014',message:'canceling statement due to statement timeout PRIVATE_INPUT',details:'select private_body from private_table where token=PRIVATE_TOKEN',hint:'PRIVATE_HINT'};
function fixture({session=validSession,application=validApplication,sessionError=null,applicationError=null,rpcErrors={},ranking=Array.from({length:160},(_,i)=>({actor_key:'actor-'+i,actor_name:'作者'+i,comments:160-i}))}={}){
 let handler;
 const logs=[],rpcCalls=[],tableCalls=[];
 const db={
  from(table){
   const call={table,mode:'select',filters:[],columns:'',options:{},limit:null};tableCalls.push(call);
   const result=()=>{
    if(call.mode==='update')return{data:null,error:null};
    if(table==='insight_member_sessions')return{data:session,error:sessionError};
    if(table==='insight_access_applications')return{data:application,error:applicationError};
    if(call.options.head)return{data:null,count:table==='insight_public_comments'?12:table==='insight_notifications'?44:call.filters.some(([key,value])=>key==='direction'&&value==='followers')?22:33,error:null};
    if(table==='insight_public_articles')return{data:[{article_key:'article-a',title:'記事A',url:'https://note.test/a',like_count:3,comment_count:2}],error:null};
    return{data:[],error:null};
   };
   const q={select(columns,options={}){call.columns=columns;call.options=options;return q},eq(key,value){call.filters.push([key,value]);return q},in(key,value){call.filters.push([key,value]);return q},update(value){call.mode='update';return q},order(){return q},limit(value){call.limit=value;return q},maybeSingle:async()=>result(),then:(resolve,reject)=>Promise.resolve(result()).then(resolve,reject)};return q;
  },
  async rpc(name,args){rpcCalls.push({name,args:JSON.parse(JSON.stringify(args))});if(rpcErrors[name])return{data:null,error:rpcErrors[name]};return{data:name==='insight_fast_summary'?{likes:321}:name==='insight_fast_analysis_v2'?{days:7}:name==='insight_fast_commenter_ranking'?ranking.slice(args.p_offset,args.p_offset+args.p_limit):name==='insight_fast_commenter_ranking_count'?ranking.length:[],error:null}}
 };
 const source=readFileSync('supabase/functions/insight-member-history/index.ts','utf8').replace(/^import[^\n]+\n/,'');
 const context=vm.createContext({createClient:()=>db,Request,Response,TextEncoder,crypto:webcrypto,console:{error:(...values)=>logs.push(values)},Deno:{env:{get:()=>''},serve:value=>{handler=value}}});
 vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return{logs,rpcCalls,tableCalls,async request(body={action:'summary'},{token='PRIVATE_TOKEN',method='POST'}={}){const response=await handler(new Request('https://example.test/member-history',{method,headers:token?{'X-Insight-Token':token}:{},...(method==='POST'?{body:JSON.stringify(body)}:{})}));return{status:response.status,body:await response.json()}}};
}
function safeFailure(h,result,{action='summary',code}={}){
 assert.equal(result.status,500);assert.equal(result.body.ok,false);assert.equal(typeof result.body.error,'string');assert.ok(result.body.error.length>0);assert.doesNotMatch(result.body.error,/\[object Object\]|PRIVATE|select |private_table/);
 if(code)assert.equal(result.body.code,code);else assert.equal('code'in result.body,false);
 assert.equal(h.logs.length,1);const entry=JSON.parse(h.logs[0][1]);assert.equal(h.logs[0][0],'insight-member-history');assert.equal(entry.action,action);assert.equal(entry.code,code||null);assert.equal(typeof entry.reason,'string');assert.doesNotMatch(JSON.stringify(h.logs),/PRIVATE|private_table|select |details|hint|token_hash/);return entry;
}

for(const name of ['insight_fast_summary','insight_fast_analysis_v2'])test(`${name}のplain SQLSTATE 57014を安全な500メッセージとcodeへ正規化する`,async()=>{
 const h=fixture({rpcErrors:{[name]:timeout}}),result=await h.request();const entry=safeFailure(h,result,{code:'57014'});assert.match(result.body.error,/時間/);assert.equal(entry.reason,'DATABASE_QUERY_TIMEOUT');assert.deepEqual(h.rpcCalls.map(call=>call.name),['insight_fast_summary','insight_fast_analysis_v2']);
});

test('messageもcodeもない任意objectを文字列化せず一般的な500にする',async()=>{
 const h=fixture({rpcErrors:{insight_fast_summary:{unexpected:'PRIVATE_INPUT'}}});const result=await h.request();assert.equal(safeFailure(h,result).reason,'HISTORY_REQUEST_FAILED');
});

test('不正なcodeやDBの入力・SQLをエラー応答とログに含めない',async()=>{
 const h=fixture({rpcErrors:{insight_fast_summary:{code:'57014 PRIVATE_INPUT',message:'PRIVATE_INPUT',details:'select PRIVATE_INPUT'}}});safeFailure(h,await h.request());
});

test('認証エラーに似たDBmessageもデータベース失敗500として扱う',async()=>{
 const h=fixture({rpcErrors:{insight_fast_summary:{code:'42P01',message:'INSIGHT_SESSION_INVALID',details:'PRIVATE_INPUT'}}});const result=await h.request();assert.equal(safeFailure(h,result,{code:'42P01'}).reason,'DATABASE_REQUEST_FAILED');assert.doesNotMatch(result.body.error,/SESSION_INVALID/);
});

for(const stage of ['session','application'])test(`${stage}の認証読取エラーをSESSION_INVALID/INACTIVE 401へ誤変換しない`,async()=>{
 const h=fixture(stage==='session'?{session:null,sessionError:timeout}:{application:null,applicationError:timeout});const result=await h.request();safeFailure(h,result,{action:'auth',code:'57014'});assert.equal(h.rpcCalls.length,0);assert.equal(h.tableCalls.some(call=>call.mode==='update'),false);if(stage==='session')assert.equal(h.tableCalls.some(call=>call.table==='insight_access_applications'),false);
});

for(const [label,options,error]of[
 ['session欠落',{session:null},'INSIGHT_SESSION_INVALID'],
 ['session失効',{session:{...validSession,revoked_at:'2026-01-01T00:00:00Z'}},'INSIGHT_SESSION_INVALID'],
 ['session期限切れ',{session:{...validSession,expires_at:'2000-01-01T00:00:00Z'}},'INSIGHT_SESSION_INVALID'],
 ['申請欠落',{application:null},'INSIGHT_MEMBER_INACTIVE'],
 ['参加停止',{application:{...validApplication,status:'revoked'}},'INSIGHT_MEMBER_INACTIVE'],
])test(`${label}の本当の認証拒否は従来のexact messageと401を維持する`,async()=>{
 const h=fixture(options),result=await h.request();assert.equal(result.status,401);assert.deepEqual(result.body,{ok:false,error});assert.equal(h.rpcCalls.length,0);assert.equal(JSON.parse(h.logs[0][1]).reason,error);
});

test('token無しはDBを読まずINSIGHT_LOGIN_REQUIRED 401を返す',async()=>{
 const h=fixture(),result=await h.request({}, {token:''});assert.equal(result.status,401);assert.deepEqual(result.body,{ok:false,error:'INSIGHT_LOGIN_REQUIRED'});assert.equal(h.tableCalls.length,0);assert.equal(h.rpcCalls.length,0);
});

test('正常summaryのmember・集計・件数・記事の契約を維持する',async()=>{
 const h=fixture(),result=await h.request();assert.equal(result.status,200);assert.equal(result.body.member.scope,'application-a');assert.equal(result.body.member.noteId,'tester');assert.deepEqual(result.body.summary,{likes:321});assert.deepEqual(result.body.analysis,{days:7});assert.deepEqual(result.body.counts,{comments:12,followers:22,followings:33,notifications:44});assert.equal(result.body.articles[0].article_key,'article-a');assert.equal(h.tableCalls.find(call=>call.table==='insight_public_articles').limit,1000);assert.equal(h.logs.length,0);
});

test('正常コメント順位は認証scope・最大100件・選択ページを変えない',async()=>{
 const h=fixture(),result=await h.request({action:'comment_ranking',page:2,pageSize:500,query:'検索条件',memberId:'other',p_member:'owner'});assert.equal(result.status,200);assert.equal(result.body.page,2);assert.equal(result.body.pageSize,100);assert.equal(result.body.total,160);assert.equal(result.body.rows.length,60);assert.equal(result.body.rows[0].actor_key,'actor-100');assert.equal(result.body.rows.at(-1).actor_key,'actor-159');
 assert.deepEqual(h.rpcCalls[0],{name:'insight_fast_commenter_ranking',args:{p_member:'application-a',p_offset:100,p_limit:100,p_query:'検索条件'}});assert.deepEqual(h.rpcCalls[1],{name:'insight_fast_commenter_ranking_count',args:{p_member:'application-a',p_query:'検索条件'}});assert.equal(h.logs.length,0);
});

test('既存の入力検証エラー文字列は維持し、不正な入力本文をログに出さない',async()=>{
 const h=fixture(),result=await h.request({action:'like_completion',completed:'PRIVATE_INPUT'});assert.equal(result.status,500);assert.deepEqual(result.body,{ok:false,error:'INVALID_COMPLETION'});assert.deepEqual(JSON.parse(h.logs[0][1]),{action:'like_completion',code:null,reason:'INVALID_COMPLETION'});
});
