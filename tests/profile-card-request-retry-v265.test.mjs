import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
function runtime(){
 const requests=[];
 const context=vm.createContext({
  window:{addEventListener(){},dispatchEvent(){},Event},
  document:{getElementById:()=>null},
  location:{hostname:'editor.note.com',pathname:'/notes/n123456789abc/edit'},
  localStorage:{getItem:()=>null},unsafeWindow:{},URL,setTimeout,clearTimeout,
  setInterval:()=>1,clearInterval(){},
  GM_xmlhttpRequest(options){const request={options,aborts:0,abort(){this.aborts++;options.onabort()}};requests.push(request);return request;}
 });
 const exposed=source.replace('const sleep=','let sleep=').replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),xhr,abortRequests,uploadOne,active:()=>activeRequests.size,uploading:()=>nativeImageUploadActive};})();`);
 vm.runInContext(exposed,context);context.api.patch('sleep=async()=>{}');
 return {context,api:context.api,requests};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('a nonmanual GET abort retries once without claiming the user stopped',async()=>{
 const r=runtime(),pending=r.api.xhr('https://note.com/api/v2/creators/example');
 assert.equal(r.requests.length,1);r.requests[0].options.onabort();await tick();
 assert.equal(r.requests.length,2);assert.equal(r.api.active(),1);
 assert.ok(r.requests.every(request=>request.options.method==='GET'));
 assert.equal(r.requests[0].options.url,r.requests[1].options.url);
 r.requests[1].options.onload({status:200,response:'actual profile'});
 assert.equal(await pending,'actual profile');assert.equal(r.api.active(),0);
});

test('a second aborted GET reports a communication interruption and is not retried again',async()=>{
 const r=runtime(),pending=r.api.xhr('https://assets.st-note.com/example.png','blob');
 const rejected=assert.rejects(pending,error=>error.code==='REQUEST_ABORTED'&&/通信が中断/.test(error.message)&&!/停止しました/.test(error.message));
 r.requests[0].options.onabort();await tick();r.requests[1].options.onabort();await rejected;
 assert.equal(r.requests.length,2);assert.equal(r.api.active(),0);
});

for(const callback of ['onerror','ontimeout'])test('one transient '+callback+' retries the same GET, while an HTTP error does not',async()=>{
 const r=runtime(),pending=r.api.xhr('https://note.com/example');
 r.requests[0].options[callback]();await tick();r.requests[1].options.onload({status:200,response:'ok'});
 assert.equal(await pending,'ok');assert.equal(r.requests.length,2);
 const denied=runtime(),failure=denied.api.xhr('https://note.com/missing');
 const rejected=assert.rejects(failure,/GET 404/);denied.requests[0].options.onload({status:404});await rejected;
 assert.equal(denied.requests.length,1);
});

test('an explicit stop aborts the pending GET without retrying it',async()=>{
 const r=runtime(),pending=r.api.xhr('https://note.com/example'),rejected=assert.rejects(pending,/停止しました/);
 r.api.patch('stopRequested=true');r.api.abortRequests();await rejected;await tick();
 assert.equal(r.requests.length,1);assert.equal(r.requests[0].aborts,1);assert.equal(r.api.active(),0);
 await assert.rejects(r.api.xhr('https://note.com/example'),/停止しました/);assert.equal(r.requests.length,1);
});

test('a stop during the retry delay prevents a second request',async()=>{
 const r=runtime();r.api.patch('sleep=()=>new Promise(resolve=>{globalThis.resumeDelay=resolve})');
 const pending=r.api.xhr('https://note.com/example'),rejected=assert.rejects(pending,/停止しました/);
 r.requests[0].options.onabort();await tick();r.api.patch('stopRequested=true');r.context.resumeDelay();await rejected;
 assert.equal(r.requests.length,1);assert.equal(r.api.active(),0);
});

test('reads are not retried while a native image upload is active or begins during the delay',async()=>{
 const r=runtime();r.api.patch('nativeImageUploadActive=true');
 const pending=r.api.xhr('https://assets.st-note.com/example.png','blob'),rejected=assert.rejects(pending,{code:'REQUEST_ABORTED'});
 r.requests[0].options.onabort();await rejected;assert.equal(r.requests.length,1);
 const delayed=runtime();delayed.api.patch('sleep=()=>new Promise(resolve=>{globalThis.resumeDelay=resolve})');
 const later=delayed.api.xhr('https://note.com/example'),laterRejected=assert.rejects(later,{code:'REQUEST_TIMEOUT'});
 delayed.requests[0].options.ontimeout();await tick();delayed.api.patch('nativeImageUploadActive=true');delayed.context.resumeDelay();await laterRejected;
 assert.equal(delayed.requests.length,1);
});

test('native upload stays single and clears its active flag on both completion and failure',async()=>{
 const r=runtime();r.context.uploadCalls=0;r.context.hit={pos:4,node:{nodeSize:2,attrs:{id:'new'}}};
 r.api.patch(`page.DataTransfer=class{constructor(){this.files=[];this.items={add:file=>this.files.push(file)}}};imageNodes=()=>[];setSelectionForInsert=()=>4;nativeImageCommand=()=>()=>{uploadCalls++;return true};waitNewNoteImage=()=>new Promise(resolve=>{globalThis.finishUpload=resolve});relinkCaption=()=>hit;`);
 const pending=r.api.uploadOne({}, {index:1},{},4);
 assert.equal(r.api.uploading(),true);assert.equal(r.context.uploadCalls,1);
 r.context.finishUpload(r.context.hit);assert.equal((await pending).nextPos,6);assert.equal(r.api.uploading(),false);
 r.api.patch('nativeImageCommand=()=>()=>{uploadCalls++;throw Error("upload failed")}');
 await assert.rejects(r.api.uploadOne({}, {index:2},{},4),/upload failed/);
 assert.equal(r.context.uploadCalls,2);assert.equal(r.api.uploading(),false);
});
