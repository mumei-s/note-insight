import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
function runtime(overrides={}){
 const dom=new JSDOM('',{url:'https://editor.note.com/notes/n123456789abc/edit'});
 const context=vm.createContext({window:dom.window,document:dom.window.document,location:dom.window.location,localStorage:dom.window.localStorage,DOMParser:dom.window.DOMParser,GM_getValue:()=>null,GM_xmlhttpRequest(){throw Error('unexpected network')},setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,URL,Blob,File,console,...overrides});
 context.unsafeWindow={Blob,File,URL,...overrides.page};
 const exposed=source.replace('const sleep=','let sleep=').replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),preparePerson,thumbnailUrl,avatarUrl,profileText,activityText,bitmapFromUrl,makeFile,uniquePeople,buildRows,createFixed300,headingText,enrichFinal};})();`);
 vm.runInContext(exposed,context);return context;
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
 assert.equal(c.api.activityText(row),'プロフィール｜花さん：料理ではなく、小説を書いています。\n旅も好き。');
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
test('missing image stops before any partial thumbnail is returned',async()=>{
 const c=runtime();c.api.patch(`bitmapFromUrl=async url=>url?{width:10,height:10,close(){}}:null`);
 await assert.rejects(c.api.makeFile({creator:'花',actorImageUrl:'',thumbUrl:'thumb'}),/アイコンを表示できません/);
 await assert.rejects(c.api.makeFile({creator:'花',actorImageUrl:'avatar',thumbUrl:''}),/記事サムネイルを表示できません/);
});
test('paste inserts a profile paragraph before the image and the final extra entry has no profile',async()=>{
 const c=runtime();c.events=[];
 c.api.patch(`
findView=()=>({});nativeImageCommand=()=>{};selectionApi=()=>{};
readRun=()=>globalThis.saved||null;writeRun=r=>{globalThis.saved=r};
buildRows=async()=>Array.from({length:300},(_,i)=>({index:i+1,creator:'人'+i,urlname:'p'+i,profileText:'本人の紹介'}));
enrichFinal=async()=>({index:301,creator:'実績の算数',finalMarker:true});
embedNodes=()=>[];cardAnchorFromSelection=()=>0;ownedImages=()=>[];
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
const rows=Array.from({length:301},(_,i)=>({creator:'人',index:i+1,finalMarker:i===300}));
let saved={likesHistoryFix230:true,rows,items:[{id:'done'}],imageAnchorPos:0};
readRun=()=>saved;writeRun=r=>saved=r;findView=()=>({});nativeImageCommand=()=>{};selectionApi=()=>{};
ownedImages=()=>Array.from({length:300},(_,i)=>({pos:i,node:{nodeSize:1}}));
makeFile=async row=>{events.push(row.index);return {}};findHeading=()=>null;
insertHeadingAt=(view,text,pos)=>({nextPos:pos+1});recordHeading=()=>{};
uploadOne=async()=>({hit:{},nextPos:302});recordImage=()=>{};sleep=async()=>{};
`);
 await c.api.createFixed300();assert.deepEqual(Array.from(c.events),[301]);
});
test('direct installer preserves the fix identity and all entries load the same guarded implementation',()=>{
 const installer=readFileSync('public/note-profile-card-paster-install.html','utf8');
 assert.match(installer,/location\.replace\('https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-profile-card-likes300-fix-v220.user.js\?v=2.3.0/);
 assert.match(source,/@namespace\s+https:\/\/github.com\/mumei-s\/note-insight\/profile-card-paster\n/);
 assert.match(readFileSync('public/note-profile-card-likes300-fix-v220.user.js','utf8'),/@require.*paster-v22.user.js\?v=230/);
});
