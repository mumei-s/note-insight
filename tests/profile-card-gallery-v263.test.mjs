import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync('public/note-profile-card-gallery-v263.js','utf8');
const context=vm.createContext({URL,Date,console});vm.runInContext(code,context);const api=context.__MUMEI_PROFILE_CARD_GALLERY__;
const creator={urlname:'alice',creator:'Alice'};
const article=(number,extra={})=>({key:'n'+number.toString(16).padStart(12,'0'),publishAt:new Date(Date.UTC(2000,0,1)+number*1000).toISOString(),user:{urlname:'alice'},name:'記事'+number,...extra});
const convert=(raw,person)=>({key:raw.key,urlname:person.urlname,url:'https://note.com/'+person.urlname+'/n/'+raw.key,publishAt:raw.publishAt,title:raw.name});
function endpoint({count=51,size=20,total=true,last=true,mutate}={}){
 const calls=[];
 const requestJSON=async url=>{const params=new URL(url).searchParams,page=Number(params.get('page'));calls.push(page);assert.equal(params.get('disabled_pinned'),'true');assert.equal(params.get('with_notes'),'false');
  const start=count-(page-1)*size,end=Math.max(0,start-size),contents=[];for(let i=start;i>end&&i>0;i--)contents.push(article(i));
  const data={contents};if(total)data.totalCount=count;if(last)data.isLastPage=start<=size;
  return mutate?mutate({data},page,calls):{data}
 };
 return{requestJSON,calls}
}
const choose=(source,extra={})=>api.chooseOldestArticle(creator,{requestJSON:source.requestJSON,articleFromRaw:convert,...extra});

test('the standalone owner wins over an unrelated page global',()=>{
 const owner={},unrelated={};const target=vm.createContext({URL,Date,owner,page:unrelated});vm.runInContext(code,target);assert.equal(owner.__MUMEI_PROFILE_CARD_GALLERY__.version,'2.6.3');assert.equal(unrelated.__MUMEI_PROFILE_CARD_GALLERY__,undefined);
});

test('the committed Halloween manifest has exactly126 distinct note identities',()=>{
 const manifest=JSON.parse(readFileSync('public/note-profile-card-halloween126.json','utf8'));
 assert.equal(manifest.count,126);assert.equal(api.validateParticipants(manifest.people),manifest.people);assert.equal(manifest.people[0].id,'c001');assert.equal(manifest.people.at(-1).id,'c127');
});

test('CSV preserves quoted commas, quoted newlines, BOM and registry gaps',()=>{
 const rows=api.parseCreatorsCsv('\uFEFFid,name,note_url\r\nc076,"A, B",https://note.com/alice\r\nc078,"C\nD",https://note.com/bob\r\n');
 assert.deepEqual(Array.from(rows,row=>[row.galleryId,row.creator,row.urlname]),[['c076','A, B','alice'],['c078','C\nD','bob']]);assert.equal(api.validateParticipants(rows,2),rows);
});
test('CSV count, duplicate identity and malformed rows fail before work begins',()=>{
 const rows=api.parseCreatorsCsv('id,name,note_url\n1,A,https://note.com/alice\n2,B,https://note.com/ALICE');
 assert.throws(()=>api.validateParticipants(rows,126),{code:'MANIFEST_COUNT'});assert.throws(()=>api.validateParticipants(rows,2),{code:'DUPLICATE_CREATOR'});
 for(const text of ['id,name,note_url\n1,A,https://evil.example/alice','id,name,note_url\n1,A,https://note.com/alice,extra','id,name,note_url\n1,"A,https://note.com/alice'])assert.throws(()=>api.parseCreatorsCsv(text),{code:'INVALID_MANIFEST'});
});
test('known total jumps directly to oldest page and verifies adjacent boundary and unchanged first page',async()=>{
 const source=endpoint();const row=await choose(source);assert.equal(row.key,article(1).key);assert.equal(row.firstArticleProof.terminalPage,3);assert.equal(row.firstArticleProof.totalCount,51);assert.deepEqual(source.calls,[1,3,4,2,1]);assert.equal(row.articleSelection,'oldest-confirmed');assert.equal(row.oldestVerified,true);assert.equal(row.oldestEvidence,row.firstArticleProof);assert.ok(row.oldestEvidence.verifiedAt);
});
test('live API empty terminal totalCount0 sentinel preserves the real total',async()=>{
 const source=endpoint({count:567,size:6,mutate(payload,page){if(page>1&&!payload.data.contents.length)payload.data.totalCount=0;return payload}});
 const row=await choose(source);assert.equal(row.key,article(1).key);assert.equal(row.oldestEvidence.totalCount,567);assert.equal(row.oldestEvidence.terminalPage,95);assert.deepEqual(source.calls,[1,95,96,94,1]);
});
test('a zero total on a nonempty page cannot masquerade as the terminal sentinel',async()=>{
 await assert.rejects(choose(endpoint({count:51,mutate(payload,page){if(page>1&&payload.data.contents.length)payload.data.totalCount=0;return payload}})),{code:'STALE_PAGINATION'});
});
test('more than five hundred pages has no arbitrary last-page clamp',async()=>{
 const source=endpoint({count:12021});const row=await choose(source);assert.equal(row.key,article(1).key);assert.equal(row.firstArticleProof.terminalPage,602);assert.ok(source.calls.length<=5);assert.ok(source.calls.includes(603));
});
test('missing total searches exponentially and by binary search',async()=>{
 const source=endpoint({count:12021,total:false,last:false,mutate(payload,page){if(!payload.data.contents.length)payload.data.isLastPage=true;return payload}});const row=await choose(source);assert.equal(row.key,article(1).key);assert.equal(row.firstArticleProof.terminalPage,602);assert.equal(row.firstArticleProof.totalCount,null);assert.ok(source.calls.length<25);
});
test('single-page publication list is confirmed by a following empty page',async()=>{
 const source=endpoint({count:3});const row=await choose(source);assert.equal(row.key,article(1).key);assert.deepEqual(source.calls,[1,2,1]);
});
test('missing isLastPage can use an exact total and verified following empty page',async()=>{
 const source=endpoint({count:51,last:false});const row=await choose(source);assert.equal(row.key,article(1).key);assert.equal(row.firstArticleProof.terminalPage,3);
});
test('an empty account and malformed first lists never select a substitute',async()=>{
 await assert.rejects(choose(endpoint({count:0})),{code:'NO_PUBLIC_ARTICLE'});
 await assert.rejects(choose(endpoint({count:0,total:false})),{code:'INVALID_PAGINATION'});
 await assert.rejects(choose({requestJSON:async()=>({data:{notes:[article(1)],totalCount:1,isLastPage:true}})}),{code:'INVALID_PAGINATION'});
});
test('missing or invalid publication cannot fall back to created_at',async()=>{
 for(const changes of [{publishAt:null,created_at:'1999-01-01T00:00:00Z'},{publishAt:'not-a-date'},{publishAt:new Date(Date.now()+86400000).toISOString()}])await assert.rejects(choose(endpoint({count:1,mutate(payload){Object.assign(payload.data.contents[0]||{},changes);return payload}})),{code:'INVALID_PUBLICATION'});
});
test('HTTP errors propagate and no new latest/fixed fallback is attempted',async()=>{
 let calls=0;const failure=Object.assign(new Error('403'),{status:403});await assert.rejects(choose({requestJSON:async()=>{calls++;throw failure}}),failure);assert.equal(calls,1);
});
test('wrong author is rejected before converter can supply the expected creator',async()=>{
 await assert.rejects(choose(endpoint({count:1,mutate(payload){if(payload.data.contents[0])payload.data.contents[0].user.urlname='someone_else';return payload}})),{code:'WRONG_AUTHOR'});
 await assert.rejects(choose(endpoint({count:1,mutate(payload){if(payload.data.contents[0])payload.data.contents[0].url='https://note.com/someone_else/n/'+article(1).key;return payload}})),{code:'WRONG_AUTHOR'});
});
test('repeated pages reject an endpoint that ignored page numbers',async()=>{
 const first=endpoint({count:51});let saved;const source={requestJSON:async url=>{const payload=await first.requestJSON(url);if(!saved)saved=payload;return saved}};await assert.rejects(choose(source),{code:'DUPLICATE_PAGE'});
});
test('stale totals cannot silently turn a later article into the first article',async()=>{
 await assert.rejects(choose(endpoint({count:51,mutate(payload){payload.data.totalCount=40;return payload}})),{code:'STALE_PAGINATION'});
 await assert.rejects(choose(endpoint({count:51,mutate(payload,page){if(page>1)payload.data.totalCount=52;return payload}})),{code:'STALE_PAGINATION'});
});
test('a pin that breaks chronology is rejected, and a genuinely oldest pinned note remains eligible',async()=>{
 await assert.rejects(choose(endpoint({count:3,mutate(payload){if(payload.data.contents.length)payload.data.contents.unshift(article(0,{isPinned:true}));return payload}})),{code:'UNSORTED_ARTICLES'});
 const row=await choose(endpoint({count:3,mutate(payload){if(payload.data.contents.length)payload.data.contents.at(-1).isPinned=true;return payload}}));assert.equal(row.key,article(1).key);
});
test('chronology across page boundaries is checked',async()=>{
 await assert.rejects(choose(endpoint({count:51,mutate(payload,page){if(page===3)payload.data.contents=[article(100)];return payload}})),{code:'UNSORTED_ARTICLES'});
});
test('publications appearing while reading cause a retryable stop',async()=>{
 await assert.rejects(choose(endpoint({count:3,mutate(payload,page,calls){if(page===1&&calls.length>1)payload.data.contents[0]=article(4);return payload}})),{code:'STALE_PAGINATION'});
});
test('the first-page recheck explicitly bypasses an injected GET cache',async()=>{
 const source=endpoint({count:3}),options=[];
 const row=await choose({requestJSON:async(url,requestOptions)=>{options.push(requestOptions);return source.requestJSON(url)}});
 assert.deepEqual(options.map(option=>option.refresh),[false,false,true]);assert.ok(options.every(option=>option.cache==='no-store'));assert.equal(row.oldestEvidence.firstPageSize,3);assert.ok(row.oldestEvidence.firstPageFingerprint.includes(article(3).key));
});
test('stop request prevents network or interrupts after an awaited response',async()=>{
 let stopped=true;const source=endpoint();await assert.rejects(choose(source,{stopRequested:()=>stopped}),{code:'STOPPED'});assert.equal(source.calls.length,0);
 stopped=false;await assert.rejects(choose({requestJSON:async url=>{const payload=await source.requestJSON(url);stopped=true;return payload}},{stopRequested:()=>stopped}),{code:'STOPPED'});assert.equal(source.calls.length,1);
});
