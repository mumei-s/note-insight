import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {transformCoreDesign,transformEditorDesign} from '../scripts/profile-card-design-v292.mjs';

const require=createRequire(import.meta.url);
let createCanvas;
try{({createCanvas}=require(process.env.CANVAS_TEST_MODULE||'@napi-rs/canvas'))}catch{}
const sources={core:transformCoreDesign(readFileSync('public/note-profile-card-paster-core-v232.js','utf8')),editor:transformEditorDesign(readFileSync('public/note-profile-card-paster-v22.user.js','utf8'))};
function runtime(kind='editor',{color='#ffffff',real=false}={}){
 const assets={avatar:real?createCanvas(96,96):{width:96,height:96},thumb:real?createCanvas(640,360):{width:640,height:360}},paint=[],canvases=[];
 if(real)for(const canvas of Object.values(assets)){canvas.getContext('2d').fillStyle=color;canvas.getContext('2d').fillRect(0,0,canvas.width,canvas.height)}
 let seed=123456;const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const context=vm.createContext({W:860,H:140,Intl,Math:math,mediaUrl:value=>String(value||''),bitmapFromUrl:async value=>assets[value]||null,page:{File:class{constructor(parts,name,options){this.parts=parts;this.name=name;this.type=options.type}}}});
 context.document={createElement:tag=>{
  assert.equal(tag,'canvas');
  if(real){const canvas=createCanvas(860,140);canvas.toBlob=callback=>callback({bytes:canvas.toBuffer('image/png')});canvases.push(canvas);if(canvases.length>2)canvases.shift();return canvas}
  const canvas={width:860,height:140,toBlob:callback=>callback({png:true})};
  const ctx=new Proxy({canvas,measureText(text){const size=Number(String(this.font||'14px').match(/([\d.]+)px/)?.[1]||14);return{width:[...String(text)].length*size*.55}}},{get(target,key){if(key in target)return target[key];return(...args)=>{paint.push([key,...args.map(value=>value===assets.avatar?'avatar':value===assets.thumb?'thumb':value)])}},set(target,key,value){target[key]=value;paint.push([key,value]);return true}});
  canvas.getContext=()=>ctx;canvases.push(canvas);if(canvases.length>2)canvases.shift();return canvas;
 }};
 const source=sources[kind],body=source.slice(source.indexOf('function rounded('),source.indexOf(kind==='editor'?'function headingText(':'function sectionHeadingText('));
 vm.runInContext(body+';globalThis.api={makeFile,mediumTextLines,thinDesignOrdinal,drawDistinctThinDecor,drawThinContrastFrame,finishThinContrast,drawMediumThinCard'+(kind==='editor'?',assignDesigns,historyDesign':'')+'};',context);
 if(kind==='editor'){const start=source.indexOf('function replacementDesignChoices('),end=source.indexOf('\nasync function replaceUnavailableCreator(',start);vm.runInContext(source.slice(start,end)+';api.replacementDesignChoices=replacementDesignChoices;',context)}
 return{api:context.api,paint,canvases};
}
const row=index=>({index:index+1,creator:'Sample Creator',title:'A useful public article',actorImageUrl:'avatar',thumbUrl:'thumb',key:'n'+index.toString(16).padStart(12,'0')});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

test('design transformations validate exact source markers and preserve source files',()=>{
 assert.throws(()=>transformCoreDesign('invalid source'),/adapter/);
 assert.throws(()=>transformEditorDesign('invalid source'),/adapter/);
 for(const source of Object.values(sources))assert.doesNotThrow(()=>new Function(source));
 assert.match(readFileSync('public/note-profile-card-paster-v22.user.js','utf8'),/index>=HISTORY_DESIGN_COUNT/);
});

test('new batches use globally distinct designs for 1, 200, 201, 1501 and 4200 cards',()=>{
 const {api}=runtime();
 for(const count of [1,200,201,1501,4200]){
  const rows=Array.from({length:count},(_,index)=>row(index)),result=api.assignDesigns(rows);
  assert.equal(new Set(Array.from(result,item=>item.designIndex)).size,count);
  assert.equal(api.assignDesigns(result),result,'saved choices are stable on resume');
  for(const item of result)assert.ok(Number.isSafeInteger(item.designIndex)&&item.designIndex>=0);
 }
});

test('partial batches allocate only unused indices without changing saved rows',()=>{
 const {api}=runtime(),rows=Array.from({length:420},(_,index)=>row(index));
 rows[0].designIndex=0;rows[28].designIndex=199;rows[219].designIndex=234;
 const result=api.assignDesigns(rows);
 assert.equal(new Set(Array.from(result,item=>item.designIndex)).size,420);
 for(const index of [0,28,219])assert.equal(result[index],rows[index]);
 const legacy=rows.map((item,index)=>({...item,designIndex:index%50}));
 assert.equal(api.assignDesigns(legacy),legacy,'legacy saved appearance metadata is not rewritten');
 for(const index of [200,1500,4200])assert.equal(api.historyDesign(index).layoutIndex,Math.floor(index%200/50));
});

test('asset replacement reserves the complete extended design pool',()=>{
 const {api}=runtime(),rows=api.assignDesigns(Array.from({length:421},(_,index)=>row(index))),position=311,freed=rows[position].designIndex;
 rows[position]={...rows[position],designIndex:undefined};
 const used=new Set(Array.from(rows,item=>item.designIndex)),choices=Array.from(api.replacementDesignChoices(rows,position));
 assert.equal(choices.length,200);
 assert.ok(choices.every(index=>!used.has(index)),'new replacement cannot collide with any saved design, including indices over200');
 assert.ok(choices.includes(freed));
});

test('medium content uses reference horizontal layout and marks excerpts without altering source text',async()=>{
 for(const kind of ['core','editor']){
  const {api,paint,canvases}=runtime(kind),text='A long original profile.\n'+('Full source words '.repeat(100)),input={...row(0),designIndex:0,presentation:{size:'medium',content:'profile',text}},before=JSON.stringify(input.presentation);
  await api.makeFile(input);
  assert.equal(canvases.at(-1).width,860);assert.equal(canvases.at(-1).height,360);
  assert.equal(JSON.stringify(input.presentation),before);
  assert.ok(paint.some(command=>command[0]==='fillText'&&command[1]==='プロフィール（抜粋）'));
  assert.ok(paint.some(command=>command[0]==='fillText'&&command[1].endsWith('…（抜粋）')));
  assert.equal(input.presentationRender.fontSize,20);assert.equal(input.presentationRender.excerpt,true);
  const images=paint.filter(command=>command[0]==='drawImage');
  assert.ok(images.some(command=>command[1]==='thumb'&&command[2]<450),'article image is on the left');
  assert.ok(images.some(command=>command[1]==='avatar'&&command[2]>450),'avatar accompanies name on right');
 }
});

test('new name-only captures keep the creator and assets while omitting title and activity text',async()=>{
 for(const kind of ['core','editor'])for(const size of ['thin','medium'])for(const designIndex of [0,50,1500]){
  const {api,paint}=runtime(kind),input={...row(designIndex),designIndex,activityLabel:'活動の説明',presentation:{size,content:'name'}},title=input.title;
  await api.makeFile(input);
  const texts=paint.filter(command=>command[0]==='fillText').map(command=>command[1]);
  assert.ok(texts.some(value=>value.includes('Sample Creator')));
  assert.equal(texts.includes(title),false,kind+' '+size+' should not draw an article title');
  assert.equal(texts.some(value=>value.includes('活動｜')),false);
  assert.equal(input.title,title,'rendering keeps the source article title');
 }
 for(const kind of ['core','editor']){
  const {api,paint}=runtime(kind);await api.makeFile({...row(0),designIndex:0});
  assert.ok(paint.some(command=>command[0]==='fillText'&&command[1]==='A useful public article'),'legacy rows preserve their article title');
 }
});

test('measured wrapping keeps intentional lines, Japanese closing punctuation and honorific together',()=>{
 const {api}=runtime(),ctx={measureText:value=>({width:[...value].length*20})};
 const lines=Array.from(api.mediumTextLines(ctx,'試しました。次の実験です。',100));
 assert.equal(lines.some(line=>/^[。、]/.test(line)),false);
 assert.equal(lines.join(''),'試しました。次の実験です。');
 assert.deepEqual(Array.from(api.mediumTextLines(ctx,'あおいさん',80,{honorific:true})),['あおい','さん']);
 assert.deepEqual(Array.from(api.mediumTextLines(ctx,'手動\n。改行',100)),['手動','。改行']);
 const latin=Array.from(api.mediumTextLines(ctx,'Small creative experiments',240));
 assert.equal(latin.join(' '),'Small creative experiments');
});

test('contrast boundaries are painted after white and black assets in both renderers',async()=>{
 for(const kind of ['core','editor'])for(const size of ['thin','medium']){
  const {api,paint}=runtime(kind),input={...row(0),designIndex:0,presentation:{size,content:'name'}};
  await api.makeFile(input);
  const lastBitmap=paint.findLastIndex(command=>command[0]==='drawImage');
  assert.ok(lastBitmap>=0);
  assert.ok(paint.slice(lastBitmap+1).some(command=>command[0]==='strokeStyle'&&command[1]==='#18222f'));
  assert.ok(paint.slice(lastBitmap+1).some(command=>command[0]==='strokeStyle'&&command[1]==='#ffffff'));
 }
});

test('actual canvas borders retain dark and light pixels against white and black assets',{skip:!createCanvas},async()=>{
 for(const kind of ['core','editor'])for(const color of ['#ffffff','#000000'])for(const size of ['thin','medium']){
  const {api,canvases}=runtime(kind,{real:true,color});await api.makeFile({...row(0),designIndex:0,presentation:{size,content:'name'}});
  const canvas=canvases.at(-1),ctx=canvas.getContext('2d'),pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data),isDark=value=>value[0]<80&&value[1]<80&&value[2]<80&&value[3]>250,isLight=value=>value[0]>235&&value[1]>235&&value[2]>235&&value[3]>250;
  assert.ok(isDark(pixel(430,0)),kind+' '+size+' outer edge stays visible on white');
  assert.ok(isLight(pixel(430,2)),kind+' '+size+' inner edge stays visible on black');
  const [x,y]=size==='medium'?[80,65]:[650,8];
  assert.ok(isDark(pixel(x,y-2)),kind+' '+size+' article edge has a dark rail');
  assert.ok(isLight(pixel(x,y)),kind+' '+size+' article edge has a light rail');
 }
});

test('real canvas renders 1501 distinct thin patterns for each generic and history path',{skip:!createCanvas},async()=>{
 for(const kind of ['core','editor']){
  const {api}=runtime(kind,{real:true}),rows=Array.from({length:1501},(_,index)=>row(index)),planned=kind==='editor'?api.assignDesigns(rows):rows,signatures=new Set();
  for(const input of planned){const file=await api.makeFile({...input,presentation:{size:'thin',content:'name'}});signatures.add(digest(file.parts[0].bytes))}
  assert.equal(signatures.size,1501,kind+' must not cycle through 50/200 identical pictures');
 }
});

test('real medium renderer does not reuse patterns when article and creator content are identical',{skip:!createCanvas},async()=>{
 const {api}=runtime('editor',{real:true}),signatures=new Set();
 for(let index=0;index<401;index++){const file=await api.makeFile({...row(index),designIndex:index,presentation:{size:'medium',content:'summary',text:'A short extract from the publicly readable article.'}});signatures.add(digest(file.parts[0].bytes))}
 assert.equal(signatures.size,401);
});
