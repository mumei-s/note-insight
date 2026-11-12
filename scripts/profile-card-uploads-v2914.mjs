function once(source, from, to) {
 if(source.split(from).length!==2)throw Error('Image upload hook must match once: '+from.slice(0,120));
 return source.replace(from,()=>to);
}
function edit(source,name,apply){
 const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));
 if(start<0)throw Error('Missing image upload function: '+name);
 const next=/\n(?:async )?function [A-Za-z]/.exec(source.slice(start)),end=next?start+next.index+1:source.length;
 return source.slice(0,start)+apply(source.slice(start,end))+source.slice(end);
}

const helpers=String.raw`
async function linkUploadedImage(view,row,before){
 const detected=await waitNewNoteImage(view,before),run=readRun();
 if(!run||run.articleKey!==editorArticleKey()||!run.rows?.some(person=>norm(person.url)===norm(row.url)))throw new Error('貼り付けた画像の作成記録を確認できません');
 const {id='',src=''}=detected.node.attrs||{},url=norm(row.url);
 const matches=imageNodes(view).filter(({node})=>node.attrs?.src===src&&(!id||node.attrs?.id===id));
 const hit=matches[0],existingLink=hit?.node.attrs?.link;
 if(matches.length!==1||(existingLink&&norm(existingLink)!==url))throw new Error('貼り付けた画像と記事の対応を確認できません');
 if(!run.gallery126)writeRun({...run,pendingImage:{runId:run.createdAt,id:String(id||''),src:String(src),url},updatedAt:Date.now()});
 return relinkCaption(view,hit,row);
}
function pendingImageForResume(view,run){
 const pending=run?.pendingImage;
 if(!pending)return null;
 if(run.articleKey!==editorArticleKey()||pending.runId!==run.createdAt)throw new Error('別の作成分の画像です');
 const row=run.rows?.[completedContinuousCount(run.rows||[],run.items)];
 if(!row||norm(row.url)!==pending.url)throw new Error('リンクを設定する画像の順序を確認できません');
 const matching=imageNodes(view).filter(({node})=>String(node.attrs?.src||'')===pending.src||pending.id&&String(node.attrs?.id||'')===pending.id);
 if(!matching.length){
  writeRun({...run,pendingImage:null,updatedAt:Date.now()});
  return null;
 }
 const hit=matching[0],link=hit.node.attrs?.link?norm(hit.node.attrs.link):'',caption=String(hit.node.textContent||'').trim();
 if(matching.length!==1||String(hit.node.attrs?.src||'')!==pending.src||!remoteImage(hit.node)||(link&&link!==pending.url)||(caption&&caption!==row.creator+'さん'))throw new Error('途中の画像と記事の対応を確認できません。画像のリンクを確認してください');
 return {row,hit:link===pending.url&&caption===row.creator+'さん'?hit:relinkCaption(view,hit,row)};
}
`;

function shared(source){
 source=once(source,'async function uploadOne(view,row,file,insertPos){',helpers+'\nasync function uploadOne(view,row,file,insertPos){');
 source=edit(source,'uploadOne',part=>{
  const baseline=/^ const before=new Set\(imageNodes\(view\).*?\);$/m;
  const link=/ const hit=await waitNewNoteImage\(view,before(?:,150000)?\);\n  ?const linked=relinkCaption\(view,hit,row\);/;
  if(!baseline.test(part)||!link.test(part))throw Error('Missing native image upload and link hooks');
  return part.replace(baseline,' const before=imageUploadBaseline(view);').replace(link,' const linked=await linkUploadedImage(view,row,before);');
 });
 return edit(source,'recordImage',part=>once(part,'items,','items,...(run.pendingImage?.url===norm(row.url)?{pendingImage:null}:{}),'));
}

export function transformCoreUploads(source){
 source=shared(source);
 source=edit(source,'uploadOne',part=>once(part,'if(requested!==true){cleanupCoreImageAnchor','if(requested!==true&&!freshUploadedImages(view,before).length){cleanupCoreImageAnchor'));
 source=edit(source,'pasteSavedSpecial',part=>once(part,'  run=await normalizeOwnedIntroductions(view,run);',`  const pending=pendingImageForResume(view,run);
  if(pending)await appendCoreDivider(view,pending.row,pending.hit);
  run=await normalizeOwnedIntroductions(view,readRun()||run);`));
 source=once(source,'function coreEmptyAnchorNeighborhood(doc,pos){','page.__MUMEI_PROFILE_CARD_IMAGE_ANCHOR__={prepare:prepareCoreImageAnchor,cleanup:cleanupCoreImageAnchor};\nfunction coreEmptyAnchorNeighborhood(doc,pos){');
 source=once(source,'font:7.2px/1.18 system-ui;max-height:34vh}', 'font:7.2px/1.18 system-ui;max-height:40vh;display:flex;flex-direction:column;box-sizing:border-box}');
 source=once(source,'#${PANEL} .body{max-height:calc(34vh - 23px);overflow:auto;padding-right:1px}', '#${PANEL} .body{min-height:0;overflow:auto;padding-right:1px}\n #${PANEL} [hidden]{display:none!important}');
 source=once(source,'color:#fff;font-size:7px}', 'color:#fff;font-size:7px;min-width:0;box-sizing:border-box}');
 source=once(source,'font-size:6.2px;color:#bfe8ff;word-break:break-word}', 'font-size:6.8px;color:#bfe8ff;overflow:auto;overflow-wrap:anywhere;max-height:11vh;flex-shrink:0}');
 return once(source,'  <div id="${STATUS}">①画像一覧は自動。②は本文で置く場所をタップしてから押す。</div>\n </div>`;',' </div>\n <div id="${STATUS}" role="status">②は本文でカードを置く場所をタップしてから押す。</div>`;');
}

export function transformEditorUploads(source){
 source=shared(source);
 source=edit(source,'uploadOne',part=>{
  part=once(part,' const selected=setSelectionForInsert(view,insertPos);',` const anchorApi=page.__MUMEI_PROFILE_CARD_IMAGE_ANCHOR__;
 const anchor=anchorApi?.prepare(view,insertPos);
 const selected=anchor?.selected??setSelectionForInsert(view,insertPos);`);
  part=once(part,"  if(nativeImageCommand()(view,dt.files,Math.max(0,selected-1),'image')!==true)throw new Error(row.index+'番 画像アップロードを開始できません');",`  const accepted=nativeImageCommand()(view,dt.files,Math.max(0,selected-1),'image');
  if(accepted!==true&&!freshUploadedImages(view,before).length){
   anchorApi?.cleanup(view,anchor);
   throw new Error(row.index+'番 画像アップロードを開始できません');
  }`);
  part=once(part,'  const actual=imageNodes(view).find(x=>{',`  if(anchor?.work){
   const workPos=[anchor.work.pos,linked.pos+linked.node.nodeSize].find(pos=>view.state.doc.nodeAt(pos)===anchor.work.node);
   if(workPos!==undefined)anchorApi.cleanup(view,{work:{...anchor.work,pos:workPos}});
  }
  const actual=imageNodes(view).find(x=>{`);
  return once(part,'||x.pos===linked.pos','||x.node===linked.node');
 });
 source=edit(source,'createFixed300',part=>{
  part=once(part,'  existing=await page.__MUMEI_PROFILE_CARD_NORMALIZE_INTROS__?.(view,existing)||existing;',`  if(existing?.pendingImage){
   const pending=pendingImageForResume(view,existing);
   if(pending){recordImage(pending.hit,pending.row);addDivider(view,pending.hit,pending.row);await flushRunBackup();}
   existing=readRun()||existing;
  }
  existing=await page.__MUMEI_PROFILE_CARD_NORMALIZE_INTROS__?.(view,existing)||existing;`);
  return once(part,"   setStatus(saved?.confirmed===false?'画像 '+rows.length+'件は貼付済み｜下書き保存は未確認。note画面で保存完了を確認してください':'極薄'+rows.length+'件完了 ✅ '+(gallery&&availableOnly?'やとさん1人は記事公開待ち。':'')+'カードを置く本文位置をタップ→②カード続き/開始')",`   const visible=ownedImages(view),creators=visible.filter(hit=>norm(hit.node.attrs?.link)!==norm(FINAL_URL)).length;
   const final=visible.length-creators,short=requested.mode==='number'&&rows.length-1<requested.count;
   const result='画像 '+creators+'人'+(final?'＋実績1件':'')+(short?'／指定 '+requested.count+'人':'');
   const note=saved?.confirmed===false?'｜下書き保存を確認':'';
   setStatus(result+note+'｜カード位置をタップ → ② 通知カード');`);
 });
 source=edit(source,'restartFixed300',part=>{
  part=once(part,'  stopRequested=false;','  stopRequested=false;\n  if(run?.pendingImage)throw new Error(\'リンクを確認する画像が1枚あります。「再開」で続けてください\');');
  return once(part,"dividerUrls:[],stage:'images_building'","dividerUrls:[],pendingCard:null,pendingImage:null,partialCardCount:null,cardAnchorPos:null,imagesCompletedAt:null,cardsCompletedAt:null,draftSaveState:null,paused:false,pauseStage:null,stage:'images_building'");
 });
 return edit(source,'stopFix',part=>once(part," setStatus('修正版を停止しました｜完成分は保持')"," setStatus(nativeImageUploadActive?'停止を受付｜今の画像のリンクを確認中':'停止しました｜貼り付け済み分を保持')"));
}
