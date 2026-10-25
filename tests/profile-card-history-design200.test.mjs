import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
function runtime(code=source){
 const paint=[],assets={avatar:{id:'avatar',width:96,height:96,close(){}},thumb:{id:'thumb',width:640,height:360,close(){}}};
 const context=vm.createContext({W:860,H:140,mediaUrl:value=>String(value||''),bitmapFromUrl:async value=>assets[value]||null,page:{File:class{constructor(parts,name,options){this.parts=parts;this.name=name;this.type=options.type}}}});
 const ctx=new Proxy({measureText(text){const size=Number(String(this.font||'14px').match(/([\d.]+)px/)?.[1]||14);return{width:[...String(text)].length*8*size/14}}},{
  get(target,key){if(key in target)return target[key];return(...args)=>paint.push([key,...args.map(value=>value?.id?{asset:value.id}:value)])},
  set(target,key,value){target[key]=value;paint.push([key,value]);return true}
 });
 context.document={createElement:tag=>{assert.equal(tag,'canvas');return{getContext:()=>ctx,toBlob:callback=>callback({png:true})}}};
 const body=code.slice(code.indexOf('function rounded('),code.indexOf('function headingText('));
 vm.runInContext(body+';globalThis.api={assignDesigns,makeFile,historyDesign};',context);
 return{api:context.api,paint};
}
const rows=count=>Array.from({length:count},(_,i)=>({index:i+1,creator:'作者'+i,title:'直近の公開記事',actorImageUrl:'avatar',thumbUrl:'thumb'}));

test('a new 200-creator batch uses all 200 designs exactly once before its extra final card',()=>{
 const {api}=runtime(),people=rows(200),last={...rows(1)[0],index:201,finalMarker:true},plans=[];
 for(let attempt=0;attempt<8;attempt++){
  const result=api.assignDesigns([...people,last]);
  assert.deepEqual(Array.from(result.slice(0,200),row=>row.designIndex).sort((a,b)=>a-b),Array.from({length:200},(_,i)=>i));
  assert.notEqual(result[200].designIndex,result[199].designIndex);
  assert.equal(api.assignDesigns(result),result);
  plans.push(Array.from(result,row=>row.designIndex).join(','));
 }
 assert.ok(new Set(plans).size>1);
});

test('partial 200-design preparation preserves saved choices and fills only unused designs',()=>{
 const {api}=runtime(),partial=rows(200);
 for(const [position,index] of [[0,199],[8,50],[93,0],[198,125]])partial[position].designIndex=index;
 const result=api.assignDesigns(partial);
 for(const position of [0,8,93,198])assert.equal(result[position],partial[position]);
 assert.equal(new Set(Array.from(result,row=>row.designIndex)).size,200);
 const legacy=rows(301).map((row,index)=>({...row,designIndex:index%50}));
 assert.equal(api.assignDesigns(legacy),legacy,'already saved 50-design batches are not restyled');
});

test('all 200 design specifications have distinct visible combinations and nonoverlapping content',()=>{
 const {api}=runtime(),specifications=new Set(),layouts=new Set(),motifs=new Set(),palettes=new Set();
 const intersects=(a,b)=>a[0]<b[0]+b[2]&&a[0]+a[2]>b[0]&&a[1]<b[1]+b[3]&&a[1]+a[3]>b[1];
 for(let index=0;index<200;index++){
  const design=api.historyDesign(index),{layout}=design,[ax,ay,ar]=layout.avatar,[tx,ty,tw]=layout.text,[nx,ny,nw]=layout.name,[bx,by]=layout.brand;
  specifications.add(JSON.stringify(design));layouts.add(design.layoutIndex);motifs.add(design.motif);palettes.add(design.paletteIndex);
  const boxes=[[ax-ar-3,ay-ar-3,(ar+3)*2,(ar+3)*2],[tx-3,ty-3,tw+6,57],[nx-3,ny-3,nw+6,22],[bx,by,30,16],Array.from(layout.thumb)];
  for(const [x,y,w,h] of boxes)assert.ok(x>=0&&y>=0&&x+w<=860&&y+h<=140,'design '+index+' stays in the canvas');
  for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++)assert.equal(intersects(boxes[a],boxes[b]),false,'design '+index+' content '+a+'/'+b+' must not overlap');
 }
 assert.equal(specifications.size,200);assert.equal(layouts.size,4);assert.equal(motifs.size,10);assert.equal(palettes.size,5);
 for(const index of [-1,200,1.5])assert.throws(()=>api.historyDesign(index),/デザイン番号/);
});

test('all 200 renderer outputs differ and retain the actual avatar, article thumbnail, title and honorific',async()=>{
 const {api,paint}=runtime(),signatures=new Set(),placements=new Set();
 for(let designIndex=0;designIndex<200;designIndex++){
  paint.length=0;
  const file=await api.makeFile({...rows(1)[0],creator:'花',designIndex});
  assert.equal(file.type,'image/png');
  assert.deepEqual(paint.filter(command=>command[0]==='drawImage').map(command=>command[1].asset),['avatar','thumb']);
  assert.ok(paint.some(command=>command[0]==='fillText'&&command[1]==='直近の公開記事'));
  assert.ok(paint.some(command=>command[0]==='fillText'&&command[1]==='花さん'));
  signatures.add(JSON.stringify(paint));
  if(designIndex%50===0)placements.add(JSON.stringify(paint.filter(command=>command[0]==='drawImage')));
 }
 assert.equal(signatures.size,200);assert.equal(placements.size,4);
});

test('the first 50 saved design appearances retain their previous drawing commands',async()=>{
 const {api,paint}=runtime(),hash=createHash('sha256');
 for(let designIndex=0;designIndex<50;designIndex++){
  paint.length=0;await api.makeFile({...rows(1)[0],creator:'花',designIndex});hash.update(JSON.stringify(paint));
 }
 assert.equal(hash.digest('hex'),'cfc323a43c1afec1d41c9345438c321b0a7e284faaac1b8a4ad84ef78ade0e93');
});
