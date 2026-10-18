import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
function runtime(){
 const paint=[],assets={avatar:{id:'avatar',width:96,height:96,close(){}},thumb:{id:'thumb',width:640,height:360,close(){}}};
 const context=vm.createContext({W:860,H:140,paint,assets,mediaUrl:value=>String(value||''),bitmapFromUrl:async url=>assets[url]||null,page:{File:class{constructor(parts,name,options){this.parts=parts;this.name=name;this.type=options.type}}}});
 const ctx=new Proxy({measureText(text){const size=Number(String(this.font||'14px').match(/([\d.]+)px/)?.[1]||14);return{width:[...String(text)].length*8*size/14}}},{
  get(target,key){if(key in target)return target[key];return(...args)=>paint.push([key,...args.map(value=>value?.id?{asset:value.id}:value)])},
  set(target,key,value){target[key]=value;paint.push([key,value]);return true}
 });
 context.document={createElement:tag=>{assert.equal(tag,'canvas');return{getContext:()=>ctx,toBlob:callback=>callback({png:true})}}};
 const body=source.slice(source.indexOf('function rounded('),source.indexOf('function headingText('));
 vm.runInContext(body+';globalThis.api={assignDesigns,makeFile,galleryDesign,fitGalleryCreatorName};',context);
 return{...context,paint,assets,ctx,api:context.api};
}
const rows=()=>Array.from({length:126},(_,i)=>({gallery126:true,index:i+1,creator:'作者'+i,title:'最初の公開記事',actorImageUrl:'avatar',thumbUrl:'thumb'}));

test('the 126-person gallery uses every distinct design exactly once and keeps saved assignments',()=>{
 const {api}=runtime(),plans=[];
 for(let attempt=0;attempt<8;attempt++){
  const assigned=api.assignDesigns(rows());
  assert.equal(assigned.length,126);
  assert.deepEqual(Array.from(assigned,row=>row.designIndex).sort((a,b)=>a-b),Array.from({length:126},(_,i)=>i));
  assert.equal(api.assignDesigns(assigned),assigned);
  plans.push(Array.from(assigned,row=>row.designIndex).join(','));
 }
 assert.ok(new Set(plans).size>1);
});

test('partial recovery preserves valid saved designs and only fills unassigned or duplicate slots',()=>{
 const {api}=runtime(),partial=rows();partial[0].designIndex=125;partial[1].designIndex=48;partial[2].designIndex=48;partial[3].designIndex=0;
 const assigned=api.assignDesigns(partial);
 assert.equal(assigned[0],partial[0]);assert.equal(assigned[1],partial[1]);assert.equal(assigned[3],partial[3]);
 assert.equal(new Set(Array.from(assigned,row=>row.designIndex)).size,126);
 assert.notEqual(assigned[2].designIndex,48);
 assert.throws(()=>api.assignDesigns([...rows(),{gallery126:true}]),/126デザイン/);
 const subset=[{gallery126:true,designIndex:125},{gallery126:true,designIndex:17}];assert.equal(api.assignDesigns(subset),subset);
});

test('the existing likes workflow retains its 50-design pools and stable resume',()=>{
 const {api}=runtime(),assigned=api.assignDesigns(Array.from({length:301},(_,i)=>({index:i+1})));
 for(let i=1;i<assigned.length;i++)assert.notEqual(assigned[i].designIndex,assigned[i-1].designIndex);
 for(let i=0;i<300;i+=50)assert.equal(new Set(Array.from(assigned.slice(i,i+50),row=>row.designIndex)).size,50);
 assert.equal(api.assignDesigns(assigned),assigned);
});

test('126 gallery compositions have visible layout, motif and palette differences and fit the thin canvas',()=>{
 const {api}=runtime(),layouts=new Set(),motifs=new Set(),palettes=new Set(),specs=new Set();
 const intersects=(a,b)=>a[0]<b[0]+b[2]&&a[0]+a[2]>b[0]&&a[1]<b[1]+b[3]&&a[1]+a[3]>b[1];
 for(let index=0;index<126;index++){
  const spec=api.galleryDesign(index),{layout}=spec;
  layouts.add(spec.layoutIndex);motifs.add(spec.motif);palettes.add(spec.paletteIndex);specs.add(JSON.stringify(spec));
  const [ax,ay,ar]=layout.avatar,[tx,ty,tw]=layout.text,[nx,ny,nw]=layout.name;
  const boxes=[[ax-ar,ay-ar,ar*2,ar*2],[tx-3,ty-3,tw+6,57],[nx-3,ny-2,nw+6,23],Array.from(layout.thumb)];
  for(const [x,y,w,h] of boxes){assert.ok(x>=0&&y>=0&&x+w<=860&&y+h<=140,`design ${index} fits`)}
  for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++)assert.equal(intersects(boxes[a],boxes[b]),false,`design ${index}: content ${a} and ${b} do not overlap`);
 }
 assert.equal(layouts.size,9);assert.equal(motifs.size,7);assert.equal(palettes.size,14);assert.equal(specs.size,126);
 assert.throws(()=>api.galleryDesign(126),/デザイン番号/);
});

test('all 126 complete renderer outputs differ while retaining actual icon, article thumbnail, title and honorific',async()=>{
 const {api,paint}=runtime(),signatures=new Set();
 for(let designIndex=0;designIndex<126;designIndex++){
  paint.length=0;
  const file=await api.makeFile({...rows()[0],creator:'花',designIndex});
  assert.equal(file.type,'image/png');
  assert.deepEqual(paint.filter(command=>command[0]==='drawImage').map(command=>command[1].asset),['avatar','thumb']);
  assert.ok(paint.some(command=>command[0]==='fillText'&&command[1]==='最初の公開記事'));
  assert.ok(paint.some(command=>command[0]==='fillText'&&command[1]==='花さん'));
  signatures.add(JSON.stringify(paint));
 }
 assert.equal(signatures.size,126);
});

test('missing icons use initials but configured inaccessible icons and missing thumbnails stop rendering',async()=>{
 const {api,paint}=runtime();
 await api.makeFile({...rows()[0],creator:'花',designIndex:83,actorImageUrl:''});
 assert.ok(paint.some(command=>command[0]==='fillText'&&command[1]==='花'));
 assert.deepEqual(paint.filter(command=>command[0]==='drawImage').map(command=>command[1].asset),['thumb']);
 await assert.rejects(api.makeFile({...rows()[0],designIndex:5,actorImageUrl:'unreachable'}),error=>error.code==='ASSET_UNAVAILABLE'&&/アイコン/.test(error.message));
 await assert.rejects(api.makeFile({...rows()[0],designIndex:5,thumbUrl:'unreachable'}),error=>error.code==='ASSET_UNAVAILABLE'&&/記事サムネイル/.test(error.message));
});


test('long image names adapt down to 10px and always keep the honorific without changing the native full name',()=>{
 const {api,ctx}=runtime(),creator='名'.repeat(65),fitted=api.fitGalleryCreatorName(ctx,creator,430);
 assert.equal(fitted.text,creator+'さん');assert.ok(fitted.size>=10&&fitted.size<14);assert.equal(fitted.truncated,false);assert.ok(ctx.measureText(fitted.text).width<=430);
 const immense='👨‍👩‍👧‍👦'+('極めて長い名前'.repeat(40)),shortened=api.fitGalleryCreatorName(ctx,immense,430);
 assert.equal(shortened.size,10);assert.equal(shortened.truncated,true);assert.ok(shortened.text.endsWith('…さん'));assert.ok(!shortened.text.endsWith('\u200d…さん'));assert.ok(ctx.measureText(shortened.text).width<=430);
});

test('only exact article-specific missing-thumbnail evidence enables an explicit text tile, while retaining the real icon',async()=>{
 const {api,paint}=runtime(),row={...rows()[0],key:'n814d3f7335ce',url:'https://note.com/furikakemen/n/n814d3f7335ce',thumbUrl:'dead',articleThumbnailMissing:true,thumbnailMissingEvidence:{key:'n814d3f7335ce',articleUrl:'https://note.com/furikakemen/n/n814d3f7335ce'}};
 await api.makeFile(row);
 assert.deepEqual(paint.filter(command=>command[0]==='drawImage').map(command=>command[1].asset),['avatar']);
 for(const label of ['記事画像未設定','最初の記事へ'])assert.ok(paint.some(command=>command[0]==='fillText'&&command[1]===label));
 for(const changed of [{articleThumbnailMissing:false},{thumbnailMissingEvidence:null},{thumbnailMissingEvidence:{...row.thumbnailMissingEvidence,key:'n000000000000'}},{thumbnailMissingEvidence:{...row.thumbnailMissingEvidence,articleUrl:'https://note.com/other/n/n814d3f7335ce'}},{gallery126:false}])await assert.rejects(api.makeFile({...row,...changed}),error=>error.code==='ASSET_UNAVAILABLE'&&/記事サムネイル/.test(error.message));
 await assert.rejects(api.makeFile({...row,actorImageUrl:'dead'}),error=>error.code==='ASSET_UNAVAILABLE'&&/アイコン/.test(error.message));
});
