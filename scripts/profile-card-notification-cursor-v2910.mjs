// Keep this fix in the standalone thumbnail tool. The historical shared core
// and the independent purchase-introduction distribution remain unchanged.
function once(source,from,to){
 if(source.split(from).length!==2)throw Error('Notification cursor hook must match once: '+from.slice(0,100));
 return source.replace(from,()=>to);
}
const helper=String.raw`
function notificationTextSelection(doc,pos){
 const resolved=doc.resolve(pos),Selection=selectionApi();
 if(!resolved.parent.inlineContent)throw new Error('通知カード用URLの文字位置を確認できません');
 // A nearest-selection search may choose a neighboring block on mobile.
 // Ask the editor's own registered text-selection type for this exact cursor.
 const candidates=[];
 // NodeSelection/GapCursor may override fromJSON. Their base Selection has
 // the registry that can construct a text cursor independently of that type.
 for(let api=Selection,depth=0;api&&depth<6;api=Object.getPrototypeOf(api),depth++){
  const current=api;if(typeof current.fromJSON==='function')candidates.push(()=>current.fromJSON(doc,{type:'text',anchor:pos,head:pos}));
 }
 candidates.push(()=>Selection.near(resolved,-1));
 for(const make of candidates){
  try{const selected=make();if(selected?.from===pos&&selected.to===pos&&selected.$from?.doc===doc&&selected.$from.parent.inlineContent)return selected}catch{}
 }
 throw new Error('通知カード用URLのカーソル位置を確認できません');
}
`;
export function transformCoreNotificationCursor(source){
 source=once(source,'function insertWorkUrlAt(view,url,pos){',helper+'\nfunction insertWorkUrlAt(view,url,pos){');
 source=once(source,' const work=matches[0],Selection=selectionApi(),near=Selection.near(tr.doc.resolve(work.pos+node.nodeSize-1),-1);',' const work=matches[0],near=notificationTextSelection(tr.doc,work.pos+node.nodeSize-1);');
 return once(source,' view.focus();return work',String.raw` view.focus();
 // Focusing a mobile editor can restore its previous cursor. Re-select only
 // the verified temporary URL, before handing it to native card conversion.
 const focused=view.state.doc.nodeAt(work.pos);
 if(focused?.type!==p||focused.textContent!==url)throw new Error('通知カード用URLの配置結果を確認できません');
 const cursor=work.pos+focused.nodeSize-1;
 if(view.state.selection.from!==cursor||view.state.selection.to!==cursor)view.dispatch(view.state.tr.setSelection(notificationTextSelection(view.state.doc,cursor)));
 const live=view.state.doc.nodeAt(work.pos);
 if(live?.type!==p||live.textContent!==url)throw new Error('通知カード用URLの配置結果を確認できません');
 work.node=live;return work`);
}
