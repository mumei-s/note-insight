import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const paths=['public/note-profile-card-paster-v22.user.js','public/note-profile-card-paster-core-v232.js'];

function runtime(path,{cache=true,table=true,webpack=true}={}){
 const source=readFileSync(path,'utf8');
 const helpers=source.slice(source.indexOf('function webpackRequire('),source.indexOf('function looksLikeView('));
 const commands=source.slice(source.indexOf('function nativeImageCommand('),source.indexOf('function imageNodes('));
 const urlStart=source.indexOf('function noteUrlCommandFactory(');
 const url=urlStart<0?'':source.slice(urlStart,source.indexOf('function embedNodes(',urlStart));
 const calls={required:[],command:0,selection:0,unrelated:0},factories={},cacheEntries={};
 function nativeFactory(module){
  module.exports={
   renamedImage:function(view,files,position,kind){
    calls.command++;
    for(const [index,file] of Array.from(files).entries())view.dispatch({event:'imageUploading',file,position:position+index,kind});
    return true;
   },
   renamedUrl:function(value){
    calls.command++;
    return function(state,dispatch,view){
     const before=view.state.selection.nodeBefore;
     return Promise.resolve(value).then(note=>dispatch(view.state.tr.replaceRangeWith(before.pos,before.pos,note)));
    };
   }
  };
 }
 const requireFn=id=>{
  const key=String(id);calls.required.push(key);
  if(cacheEntries[key])return cacheEntries[key].exports;
  const factory=factories[key];
  if(typeof factory!=='function')throw Error('No registered module '+key);
  const module={exports:{}};factory(module,module.exports,requireFn);cacheEntries[key]=module;return module.exports;
 };
 if(cache)requireFn.c=cacheEntries;
 if(table)requireFn.m=factories;
 const chunks=[];
 chunks.push=entry=>{const length=Array.prototype.push.call(chunks,entry);if(typeof entry?.[2]==='function')entry[2](requireFn);return length};
 const page=webpack?{webpackChunk_N_E:chunks}:{};
 const context=vm.createContext({page,findView:()=>context.view||null});
 vm.runInContext('let imageCommandCache=null,selectionCache=null,noteUrlCommandCache=null;'+helpers+commands+url+';globalThis.api={nativeEditorFunction,nativeImageCommand,selectionApi'+(url?',noteUrlCommandFactory':'')+'};',context);
 const freshExports=()=>{const module={exports:{}};nativeFactory(module);return module.exports};
 return{api:context.api,context,page,calls,factories,cacheEntries,chunks,nativeFactory,freshExports};
}

for(const path of paths){
 const label=path.includes('core')?'core':'history';

 test(label+' finds moved native modules and renamed exports without a webpack cache or command invocation',()=>{
  for(const id of ['35815','837291']){
   const r=runtime(path,{cache:false});
   r.factories[id]=r.nativeFactory;
   r.factories['94928']=function unrelated(){r.calls.unrelated++;throw Error('stale ID must not execute')};
   const image=r.api.nativeImageCommand(),url=r.api.nativeEditorFunction('url');
   assert.equal(image.length,4);assert.equal(typeof url,'function');
   assert.deepEqual(r.calls.required,[id,id]);
   assert.equal(r.calls.command,0);assert.equal(r.calls.unrelated,0);
   assert.equal(r.api.nativeImageCommand(),image,'the validated upload command is cached');
   assert.deepEqual(r.calls.required,[id,id]);
   if(r.api.noteUrlCommandFactory){
    assert.equal(r.api.noteUrlCommandFactory(),url);
    const count=r.calls.required.length;
    assert.equal(r.api.noteUrlCommandFactory(),url);assert.equal(r.calls.required.length,count);
   }
  }
 });

 test(label+' accepts aliases of one loaded native function and does not load registered factories',()=>{
  const r=runtime(path),exports=r.freshExports();
  r.cacheEntries.ready={exports:{a:exports.renamedImage,b:exports.renamedImage,c:exports.renamedUrl,d:exports.renamedUrl}};
  r.factories.unused=r.nativeFactory;
  assert.equal(r.api.nativeImageCommand(),exports.renamedImage);
  assert.equal(r.api.nativeEditorFunction('url'),exports.renamedUrl);
  assert.deepEqual(r.calls.required,[]);assert.equal(r.calls.command,0);
 });

 test(label+' ignores throwing export getters and continues to other validated exports',()=>{
  const r=runtime(path),exports=r.freshExports(),broken={};
  Object.defineProperty(broken,'throwing',{enumerable:true,get(){throw Error('broken export getter')}});
  r.cacheEntries.broken={exports:broken};
  r.cacheEntries.ready={exports:{image:exports.renamedImage,url:exports.renamedUrl}};
  assert.equal(r.api.nativeImageCommand(),exports.renamedImage);
  assert.equal(r.api.nativeEditorFunction('url'),exports.renamedUrl);
  assert.equal(r.calls.command,0);assert.deepEqual(r.calls.required,[]);
 });

 test(label+' rejects two distinct matching loaded functions without invoking either',()=>{
  for(const kind of ['image','url']){
   const r=runtime(path),first=r.freshExports(),second=r.freshExports();
   r.cacheEntries.one={exports:kind==='image'?first.renamedImage:first.renamedUrl};
   r.cacheEntries.two={exports:kind==='image'?second.renamedImage:second.renamedUrl};
   assert.throws(()=>r.api.nativeEditorFunction(kind),/一意/);
   assert.equal(r.calls.command,0);assert.deepEqual(r.calls.required,[]);
  }
 });

 test(label+' does not confuse ProseMirror classes with the one-argument native URL factory',()=>{
  const r=runtime(path),exports=r.freshExports();
  class NearbySelection{
   constructor(anchor,head){r.calls.command++;this.anchor=anchor;this.head=head}
   map(state){return Promise.resolve(state.selection.nodeBefore).then(node=>state.tr.replaceRangeWith(node.pos,node.pos,node))}
  }
  class TextSelection{
   constructor(anchor,head,options){r.calls.command++;this.anchor=anchor;this.head=head;this.options=options}
   map(state){return Promise.resolve(state.selection.nodeBefore).then(node=>state.tr.replaceRangeWith(node.pos,node.pos,node))}
  }
  r.cacheEntries.prosemirror={exports:{NearbySelection,TextSelection}};
  r.cacheEntries.commands={exports:{renamed:exports.renamedUrl}};
  assert.equal(r.api.nativeEditorFunction('url'),exports.renamedUrl);
  assert.deepEqual(r.calls.required,[]);assert.equal(r.calls.command,0);
 });

 test(label+' rejects ambiguous registered native modules while never executing unrelated factories',()=>{
  const r=runtime(path,{cache:false});
  r.factories.a=r.nativeFactory;r.factories.b=r.nativeFactory;
  r.factories.unrelated=function(){r.calls.unrelated++;throw Error('must not load')};
  assert.throws(()=>r.api.nativeImageCommand(),/一意/);
  assert.deepEqual(r.calls.required,['a','b']);assert.equal(r.calls.command,0);assert.equal(r.calls.unrelated,0);
 });

 test(label+' discovers already registered chunk factories when the runtime hides its module table',()=>{
  const r=runtime(path,{cache:false,table:false});
  r.factories['8675309']=r.nativeFactory;
  r.chunks.push([[15],{'8675309':r.nativeFactory}]);
  assert.equal(r.api.nativeImageCommand().length,4);
  assert.deepEqual(r.calls.required,['8675309']);assert.equal(r.calls.command,0);
 });

 test(label+' prefers the current runtime factory over a stale registered chunk with the same ID',()=>{
  const r=runtime(path,{cache:false});
  r.factories['35815']=function currentUnrelated(){r.calls.unrelated++};
  r.chunks.push([[15],{'35815':r.nativeFactory}]);
  assert.throws(()=>r.api.nativeImageCommand(),/取得できません/);
  assert.deepEqual(r.calls.required,[]);assert.equal(r.calls.command,0);assert.equal(r.calls.unrelated,0);
 });

 test(label+' a missing native command is not cached and can be found after its module is registered',()=>{
  const r=runtime(path,{cache:false});
  assert.throws(()=>r.api.nativeImageCommand(),/取得できません/);
  r.factories['35815']=r.nativeFactory;
  assert.equal(r.api.nativeImageCommand().length,4);
  assert.deepEqual(r.calls.required,['35815']);assert.equal(r.calls.command,0);
 });

 test(label+' validates actual exports after a factory match and refuses an incorrect command ABI',()=>{
  const r=runtime(path,{cache:false});
  r.factories.bad=function(module){
   module.exports=function(view,files,position){
    for(const [index,file] of Array.from(files).entries())view.dispatch({event:'imageUploading',file,position:position+index});
   };
  };
  assert.throws(()=>r.api.nativeImageCommand(),/取得できません/);
  assert.deepEqual(r.calls.required,['bad']);assert.equal(r.calls.command,0);
 });

 test(label+' refuses an excessive factory match set before loading or invoking any candidate',()=>{
  const r=runtime(path,{cache:false});
  for(let i=0;i<17;i++)r.factories['native'+i]=r.nativeFactory;
  assert.throws(()=>r.api.nativeImageCommand(),/多すぎる/);
  assert.deepEqual(r.calls.required,[]);assert.equal(r.calls.command,0);
 });

 test(label+' uses the active selection constructor including inherited static methods without webpack',()=>{
  const r=runtime(path,{webpack:false});
  class Selection{
   static atEnd(){r.calls.selection++;throw Error('discovery must not change selection')}
   static near(){r.calls.selection++;throw Error('discovery must not change selection')}
  }
  class TextSelection extends Selection{}
  r.context.view={state:{selection:new TextSelection()}};
  assert.equal(r.api.selectionApi(),TextSelection);
  assert.equal(r.calls.selection,0);assert.deepEqual(r.calls.required,[]);
 });

 test(label+' retains the known Selection module fallback when an active constructor is unavailable',()=>{
  const r=runtime(path);
  class Selection{static atEnd(){r.calls.selection++}}
  r.factories['44044']=module=>{module.exports={Y1:Selection}};
  assert.equal(r.api.selectionApi(),Selection);
  assert.deepEqual(r.calls.required,['44044']);assert.equal(r.calls.selection,0);
 });
}
