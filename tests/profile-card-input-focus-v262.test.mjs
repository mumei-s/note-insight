import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/note-profile-card-paster-core-v232.js','utf8');
const helper=source.slice(source.indexOf('function bindPanelInputEvents('),source.indexOf('\nfunction mount(',source.indexOf('function bindPanelInputEvents(')));
function runtime(){
 const doc={activeElement:{id:'editor'}},children=new Set(),panel=new EventTarget();panel.contains=control=>children.has(control);
 const context=vm.createContext({document:doc});vm.runInContext(helper+';globalThis.bind=bindPanelInputEvents;',context);context.bind(panel);
 function control(tag,extra={}){
  const element={tag,focuses:0,disabled:false,readOnly:false,matches:selector=>selector.split(',').includes(tag),closest:()=>element,focus(options){this.focuses++;this.options=options;doc.activeElement=this},...extra};children.add(element);return element;
 }
 function send(type,element){
  const event=new Event(type,{bubbles:true,cancelable:true});let stopped=false;const stop=event.stopPropagation.bind(event);
  event.stopPropagation=()=>{stopped=true;stop()};Object.defineProperty(event,'target',{value:element});panel.dispatchEvent(event);return{cancelled:event.defaultPrevented,stopped};
 }
 return{doc,panel,children,control,send};
}
test('URL and numeric inputs gain focus on pointer, touch and mouse without cancelling native caret behavior',()=>{
 for(const tag of ['textarea','input'])for(const type of ['pointerdown','touchstart','mousedown']){
  const c=runtime(),field=c.control(tag);const result=c.send(type,field);
  assert.equal(c.doc.activeElement,field);assert.equal(field.focuses,1);assert.equal(field.options.preventScroll,true);assert.deepEqual(result,{cancelled:false,stopped:true});
  c.send(type,field);assert.equal(field.focuses,1);
 }
});
test('select and disclosure controls retain their native defaults',()=>{
 for(const tag of ['select','summary']){const c=runtime(),field=c.control(tag);assert.deepEqual(c.send('mousedown',field),{cancelled:false,stopped:true});assert.equal(field.focuses,0)}
});
test('dynamic card buttons preserve editor focus while text editing never reaches editor shortcuts',()=>{
 const c=runtime(),editor=c.doc.activeElement,button=c.control('button');
 assert.deepEqual(c.send('mousedown',button),{cancelled:true,stopped:true});assert.equal(c.doc.activeElement,editor);
 for(const type of ['keydown','keypress','keyup','paste','cut','copy'])assert.deepEqual(c.send(type,c.control('textarea')),{cancelled:false,stopped:true});
});
test('disabled or readonly inputs are not forcibly focused and drag targets remain outside the shield',()=>{
 for(const extra of [{disabled:true},{readOnly:true}]){const c=runtime(),field=c.control('input',extra);c.send('pointerdown',field);assert.equal(field.focuses,0)}
 const c=runtime(),title=c.control('div');title.closest=()=>null;assert.deepEqual(c.send('mousedown',title),{cancelled:false,stopped:false});
});
