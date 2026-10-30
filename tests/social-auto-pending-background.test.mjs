import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('public/note-insight-social-compare-v1.js','utf8');
const begin=source.indexOf('async function autoPending(){');
const end=source.indexOf('function start(){',begin);
assert.ok(begin>=0&&end>begin,'the bounded background review is installed');
const scan=source.slice(begin,end);

test('owner note session checks stored missing relationships without full list reload',()=>{
 assert.match(scan,/id='ss_yr'/);
 assert.match(scan,/own\.isMyself!==true/);
 assert.match(scan,/batch\.rows\.slice\(0,12\)/);
 assert.match(scan,/6\*60\*60\*1000/);
 assert.match(scan,/action:'history_candidates',pendingOnly:true/);
 assert.match(scan,/row\.person_key===candidate\.person_key/);
 assert.match(scan,/typeof row\.is_following==='boolean'&&typeof row\.is_follower==='boolean'/);
 assert.match(scan,/confirmedPersonKeys/);
 assert.match(scan,/cursor=String\(candidate\.person_key\|\|''\)/);
 assert.doesNotMatch(scan,/\/api\/v3\/users\//);
 assert.match(source,/void autoPending\(\)/);
});

async function backgroundReview({afterProfile,rows=1}={}){
 const state={account:'ss_yr',auth:{kind:'notification',token:'owner-token'},visibility:'visible',explicit:false};
 const writes=[],checkpoints=[],accountChecks=[];
 const context={
  running:false,STATE:'state:',ACTIVE:'active',Date,Number,String,URL,
  document:{get visibilityState(){return state.visibility}},
  sessionStorage:{getItem:()=>state.explicit?'active':null},
  get:async()=>null,set:async(key,value)=>checkpoints.push({...value}),
  account:async()=>{accountChecks.push(state.account);return state.account},
  tokenFor:async()=>state.auth?{...state.auth}:null,
  json:async path=>{
   if(path==='/api/v2/creators/ss_yr')return{data:{isMyself:true,urlname:'ss_yr'}};
   const id=path.split('/').at(-1);afterProfile?.(state,context);
   return{data:{key:id,urlname:id,followings:{actively:false,passively:false}}};
  },
  person:u=>({person_key:u.key,actor_url:'https://note.com/'+u.urlname,is_following:u.followings.actively,is_follower:u.followings.passively}),
  save:async(body,auth)=>{
   if(body.action==='history_candidates')return{rows:Array.from({length:rows},(_,i)=>({person_key:'saved_'+i,actor_url:'https://note.com/saved_'+i})),nextCursor:rows>12?'more':null};
   writes.push({body,auth:{...auth}});return{confirmedPersonKeys:body.rows.map(row=>row.person_key)};
  },
  sleep:async()=>{}
 };
 context.pageWindow=()=>context;
 await vm.runInNewContext(scan+';autoPending()',context);
 return{writes,checkpoints,accountChecks};
}

test('automatic review rechecks the note login after each profile before saving owner relationships',async()=>{
 const result=await backgroundReview({afterProfile:state=>{state.account='another_account'}});
 assert.deepEqual(result.accountChecks,['ss_yr','another_account']);
 assert.equal(result.writes.length,0,'another login must never write absence flags into the owner scope');
 assert.ok(result.checkpoints.every(value=>value.cursor===''),'a rejected profile remains pending');
});

test('automatic review rejects a changed, removed or switched reader credential before saving',async()=>{
 for(const auth of [null,{kind:'notification',token:'replacement-token'},{kind:'dm',token:'owner-token'}]){
  const result=await backgroundReview({afterProfile:state=>{state.auth=auth}});
  assert.equal(result.writes.length,0);
  assert.ok(result.checkpoints.every(value=>value.cursor===''));
 }
});

test('automatic review stops if hidden or an explicit scan starts during a profile request',async()=>{
 for(const pause of [state=>{state.visibility='hidden'},state=>{state.explicit=true}]){
  const result=await backgroundReview({afterProfile:pause});
  assert.equal(result.writes.length,0);
  assert.ok(result.checkpoints.every(value=>value.cursor===''));
 }
});

test('verified owner review retains the twelve-person budget and advances only acknowledged profiles',async()=>{
 const result=await backgroundReview({rows:20});
 assert.equal(result.writes.length,12);
 assert.equal(result.accountChecks.length,13);
 assert.ok(result.writes.every(({body,auth})=>body.noteId==='ss_yr'&&auth.kind==='notification'&&auth.token==='owner-token'));
 assert.equal(result.checkpoints.at(-1).cursor,'saved_11');
});
