import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';

const test=(name,fn)=>nodeTest(name,{skip:!dependencies?'PM and canvas dependencies are required':false},fn);
const images=r=>{
 const result=[];
 r.view.state.doc.forEach(node=>{if(node.type.name==='image')result.push(node)});
 return result;
};
function complete(r){
 const run=r.editor.readRun();
 assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);
 assert.equal(run.pendingImage??null,null);
 assert.deepEqual(images(r).filter(node=>node.attrs.link).map(node=>node.attrs.link),Array.from(run.rows,row=>row.url));
 assert.deepEqual(images(r).filter(node=>node.attrs.link).map(node=>node.textContent),Array.from(run.rows,row=>row.creator+'さん'));
 return run;
}

for(const flow of ['normal','history'])test(flow+' links every new image when note supplies a URL before an ID',async t=>{
 const r=await runtime({count:3});t.after(()=>r.close());
 const api=flow==='normal'?r.core:r.editor;
 api.patch(`
  const fixtureImageCommand=nativeImageCommand;
  nativeImageCommand=()=>{
   const native=fixtureImageCommand();
   return (v,...args)=>{
    const dispatch=v.dispatch;
    v.dispatch=transaction=>{
     transaction.doc.descendants((node,pos)=>{
      if(node.type.name==='image'&&node.attrs.id==='generated-'+state.serial)transaction.setNodeMarkup(pos,null,{...node.attrs,id:''});
     });
     dispatch.call(v,transaction);
    };
    try{return native(v,...args)}finally{v.dispatch=dispatch}
   };
  };
 `);
 await r[flow]();
 assert.equal(complete(r).items.length,4);
 assert.ok(images(r).every(node=>!node.attrs.id));
});

for(const flow of ['normal','history'])test(flow+' reloads and repairs the exact unfinished link without sending the image again',async t=>{
 const r=await runtime({count:3});t.after(()=>r.close());
 const api=flow==='normal'?r.core:r.editor;
 api.patch(`const linkOnce=relinkCaption;relinkCaption=(view,hit,row)=>{if(row.index===2)throw new Error('fixture rejected link');return linkOnce(view,hit,row)};`);
 await r[flow]();
 const partial=r.editor.readRun();
 assert.equal(partial.items.length,1);
 assert.equal(partial.pendingImage.url,partial.rows[1].url);
 assert.equal(images(r).length,2);
 assert.equal(images(r)[1].attrs.link,'');
 const resumed=await r.reload();t.after(()=>resumed.close());
 await resumed.editor.patch('resumeFixed300()');
 assert.equal(complete(resumed).items.length,4);
 assert.equal(resumed.state.images.length,4);
});

test('a stop after the native request finishes the current link and sends no second image',async t=>{
 const r=await runtime({count:3});t.after(()=>r.close());
 r.editor.patch(`const commandBeforeStop=nativeImageCommand;nativeImageCommand=()=>{
  const command=commandBeforeStop();
  return (...args)=>{setTimeout(()=>command(...args),10);stopRequested=true;return true};
 };`);
 await r.history();
 const run=r.editor.readRun();
 assert.equal(run.stage,'images_building');
 assert.equal(images(r).length,1);
 assert.equal(images(r)[0].attrs.link,run.rows[0].url);
 assert.equal(images(r)[0].textContent,run.rows[0].creator+'さん');
});

test('history replaces a short saved run using the new 200-person selection, keeping unrelated draft images',async t=>{
 const r=await runtime({count:200,render:false});t.after(()=>r.close());
 const bridge='mumei_profile_card_likes_300_v2';
 r.gm.set(bridge,{at:1,people:r.people.slice(0,73)});
 await r.editor.createFixed300({mode:'all',count:1500,target:Infinity});
 assert.equal(complete(r).items.length,74);
 const other=r.schema.nodes.image.create({id:'other-image',src:'https://assets.st-note.com/old-unlinked.png'});
 r.view.dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,other));
 r.c.nextHistory={at:2,people:r.people};
 r.editor.patch(`const historyBeforeRestart=historyOptions;
  historyOptions=run=>run?historyBeforeRestart(run):{mode:'number',count:200,target:200,historyFilter:null};
  prepareLikesHistoryExport=async()=>GM_setValue(BRIDGE_KEY,nextHistory);`);
 await r.editor.patch('restartFixed300()');
 assert.equal(complete(r).items.length,201);
 assert.equal(r.editor.readRun().historyRequestedCount,200);
 assert.equal(images(r).filter(node=>node.attrs.id==='other-image').length,1);
 assert.equal(images(r).filter(node=>!node.attrs.link).length,1);
});
