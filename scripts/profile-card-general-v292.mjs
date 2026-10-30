// Permanent general-source controls. These transforms deliberately leave the
// historical source modules usable by the independent purchase-only builder.
function once(source,from,to){
 if(source.split(from).length!==2)throw Error('General tool hook no longer matches exactly once: '+from.slice(0,100));
 return source.replace(from,()=>to);
}
function replaceFunction(source,name,replacement){
 const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));
 if(start<0)throw Error('Missing general tool function '+name);
 // The source modules close top-level function bodies at column zero. Stop at
 // that closing brace, preserving adapters, event bindings, and declarations
 // between this function and the next declaration.
 const next=/\n}\r?\n/.exec(source.slice(start));
 if(!next)throw Error('Missing general tool function boundary '+name);
 const end=start+next.index+next[0].length;
 return source.slice(0,start)+replacement.trimEnd()+'\n'+source.slice(end);
}

const chooseCreatorArticle=String.raw`async function chooseCreatorArticle(creator,choice){
 try{
  if(choice==='fixed'||choice==='pinned'){
   const payload=await creatorContents(creator.urlname,1,false),list=contentList(payload);
   const fixed=list.find(raw=>{const note=raw?.note||raw;return note?.isPinned===true||note?.is_pinned===true});
   // A strict fixed request must never quietly use the newest article.
   if(choice==='pinned')return fixed?articleFromRaw(fixed,creator):null;
   return articleFromRaw(fixed||list[0],creator);
  }
  if(choice==='oldest'){
   const first=await creatorContents(creator.urlname,1,true),list=contentList(first);if(!list.length)return null;
   const data=first?.data&&typeof first.data==='object'?first.data:{};
   const total=Number(data.totalCount||data.total_count||0),per=Math.max(1,list.length),lastPage=Math.min(500,total>0?Math.max(1,Math.ceil(total/per)):1);
   const last=lastPage===1?first:await creatorContents(creator.urlname,lastPage,true);
   const candidates=contentList(last).map(raw=>articleFromRaw(raw,creator)).filter(Boolean);
   candidates.sort((a,b)=>{const at=Date.parse(a.publishAt||''),bt=Date.parse(b.publishAt||'');return Number.isFinite(at)&&Number.isFinite(bt)?at-bt:0});
   return candidates[0]||null;
  }
  const payload=await creatorContents(creator.urlname,1,true);
  return articleFromRaw(contentList(payload)[0],creator);
 }catch(error){if(stopRequested)throw error;return null}
}`;

const parseUnifiedSources=String.raw`function parseUnifiedSources(raw){
 const out=[],seen=new Set();
 const add=(type,value)=>{
  if(!value)return;
  const signature=type+'|'+(type==='note'?noteKey(value):type==='mag'?magazineKey(value):value);
  if(seen.has(signature))return;seen.add(signature);out.push({type,value,label:type==='tag'?'#'+value:value});
 };
 for(const rawLine of String(raw||'').split(/\r?\n/)){
  const line=rawLine.trim();if(!line)continue;
  const tokens=line.match(/https?:\/\/[^\s,、]+|[#＃][^#＃\s,、]+/g)||[];
  for(const token of tokens){
   if(/^https?:\/\//i.test(token)){
    let url;try{url=new URL(token)}catch{continue}
    if(!/^(?:www\.)?note\.com$/i.test(url.hostname))continue;
    if(noteKey(url.href))add('note',norm(url.href));
    else if(magazineKey(url.href))add('mag',norm(url.href));
    else{
     const tag=url.pathname.match(/^\/hashtag\/([^/]+)\/?$/)?.[1];
     if(tag){try{add('tag',decodeURIComponent(tag))}catch{add('tag',tag)}}
    }
   }else add('tag',token.slice(1).trim());
  }
  if(!tokens.length&&!/^https?:\/\//i.test(line))add('tag',line.replace(/^[#＃]+/,'').trim());
 }
 return out;
}`;

const collectUnified=String.raw`async function collectUnified(raw,mode,count,choice){
 const sources=parseUnifiedSources(raw),limit=targetLimit(mode,count);
 if(!sources.length||limit===0)return[];
 const out=[],seenUrls=new Set(),collectedCreators=new Set(['fuku444']),selectedCreators=new Set(),selectedKeys=new Set(),choices=new Map();
 const issues=[];let unavailable=0;
 const add=row=>{
  if(!row)return false;
  const url=norm(row.url),creator=String(row.urlname||url.match(/^https:\/\/note\.com\/([^/?#]+)\/n\//i)?.[1]||row.likerKey||'').trim().toLowerCase();
  if(!url||url===norm(FINAL_URL)||seenUrls.has(url)||(creator&&collectedCreators.has(creator)))return false;
  seenUrls.add(url);if(creator)collectedCreators.add(creator);out.push({...row,url});return true;
 };
 const acceptCreators=async candidates=>{
  const fresh=[];
  for(const candidate of candidates){
   if(!candidate)continue;
   const id=String(candidate.urlname||'').trim().toLowerCase(),stable=String(candidate.likerKey||id).trim();
   if(!id||collectedCreators.has(id)||selectedCreators.has(id)||(stable&&selectedKeys.has(stable)))continue;
   selectedCreators.add(id);if(stable)selectedKeys.add(stable);fresh.push({...candidate,urlname:id});
  }
  for(let offset=0;offset<fresh.length&&out.length<limit;){
   if(stopRequested)throw new Error('停止しました');
   const size=Math.min(6,Number.isFinite(limit)?Math.max(1,limit-out.length):6),batch=fresh.slice(offset,offset+size);offset+=batch.length;
   const rows=await Promise.all(batch.map(creator=>{
    const key=creator.urlname+'|'+choice;
    if(!choices.has(key))choices.set(key,chooseCreatorArticle(creator,choice));
    return choices.get(key);
   }));
   // Promise.all preserves source order even when HTTP completions are reversed.
   for(let index=0;index<rows.length;index++){
    if(rows[index])add(rows[index]);
    else{unavailable++;if(issues.length<160)issues.push({account:batch[index].urlname,reason:choice==='pinned'?'固定記事なし・未確認':'公開記事なし・未確認'});}
    if(out.length>=limit)break;
   }
  }
 };
 for(let sourceIndex=0;sourceIndex<sources.length&&out.length<limit;sourceIndex++){
  const source=sources[sourceIndex];
  if(stopRequested)throw new Error('停止しました');
  const status=label=>setStatus('入力 '+(sourceIndex+1)+'/'+sources.length+'｜'+label+' '+out.length+(mode==='all'?' / 全数':' / '+limit)+(unavailable?'｜記事未確認 '+unavailable+'人':''));
  if(source.type==='note'){
   const key=noteKey(source.value);if(!key)continue;
   for(let page=1;page<=200&&out.length<limit;page++){
    status('記事のスキ');
    const payload=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(key)+'/likes?page='+page+'&per=50');
    const list=Array.isArray(payload?.data?.likes)?payload.data.likes:[];
    await acceptCreators(list.map(parseLiker));if(list.length<50)break;
   }
  }else if(source.type==='mag'){
   const key=magazineKey(source.value);if(!key)continue;
   let start=0;
   while(out.length<limit&&start<10000){
    status('マガジン');
    const payload=await xhrJSON('https://note.com/api/v1/magazines/'+encodeURIComponent(key)+'/notes?start='+start+'&limit=100');
    const data=payload?.data&&typeof payload.data==='object'?payload.data:{},list=Array.isArray(data.notes)?data.notes:[];
    await acceptCreators(list.map(raw=>articleFromRaw(raw,{})));start+=list.length;
    if(!list.length||list.length<100)break;
   }
  }else if(source.type==='tag'){
   let cursor='0';const cursors=new Set([cursor]);
   for(let page=1;page<=250&&out.length<limit;page++){
    status('#'+source.value);
    const payload=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(source.value)+'&size=20&start='+encodeURIComponent(cursor)+'&sort=new');
    const result=normalizeSearch(payload);if(!result.arr.length)break;
    await acceptCreators(result.arr.map(raw=>articleFromRaw(raw,{})));
    if(result.last||result.cursor==null||cursors.has(String(result.cursor)))break;
    cursor=String(result.cursor);cursors.add(cursor);
   }
  }
 }
 page.__MUMEI_PROFILE_CARD_SOURCE_SELECTION__={choice,unavailable,issues,recorded:issues.length};
 if(unavailable)setStatus('抽出 '+out.length+'人｜'+(choice==='pinned'?'固定記事なし・未確認':'公開記事なし・未確認')+' '+unavailable+'人（別記事への差し替えなし）');
 return out;
}`;

const patchPanel=String.raw`function patchPanel(){
 const panel=document.getElementById(PANEL),body=panel?.querySelector('.body');
 if(!panel||!body)return false;
 let detail=panel.querySelector('details[data-like300]');
 if(!detail){
  detail=document.createElement('details');detail.dataset.like300='';
  detail.innerHTML='<summary>＋ 自分のスキ履歴</summary><div class="hint"></div><div class="special-actions"><button type="button" data-a="like300-images">履歴から開始</button></div>';
  const tools=body.querySelector('.tools');if(tools)tools.before(detail);else body.append(detail);
 }
 const imagePhase=panel.querySelector('[data-a="images"]')?.parentElement||body;
 let cardsControl=panel.querySelector('[data-a="cards"]');
 if(!cardsControl){cardsControl=document.createElement('button');cardsControl.dataset.a='cards';cardsControl.textContent='② 通知カード';imagePhase.append(cardsControl);}
 let resumePhase=panel.querySelector('[data-a="pause"]')?.parentElement||panel.querySelector('[data-a="resume"]')?.parentElement;
 if(!resumePhase){resumePhase=document.createElement('div');resumePhase.className='phase';imagePhase.after(resumePhase);}
 for(const [action,label] of [['resume','再開'],['pause','一時停止']])if(!panel.querySelector('[data-a="'+action+'"]')){
  const button=document.createElement('button');button.dataset.a=action;button.textContent=label;resumePhase.append(button);
 }
 panel.querySelector('[data-gallery126]')?.remove();
 const title=panel.querySelector('.title');if(title&&title.textContent!=='極薄サム v'+VERSION)title.textContent='極薄サム v'+VERSION;
 const summary=detail.querySelector('summary');if(summary&&summary.textContent!=='＋ 自分のスキ履歴')summary.textContent='＋ 自分のスキ履歴';
 const hint=detail.querySelector('.hint'),hintText='直近順・同じ人は1回｜最新記事｜上の件数・全数を使用｜実績1件を追加';
 if(hint&&hint.textContent!==hintText)hint.textContent=hintText;
 let preset=detail.querySelector('[data-a="like200-preset"]');
 if(!preset){preset=document.createElement('button');preset.type='button';preset.dataset.a='like200-preset';preset.textContent='200人に設定';(detail.querySelector('.special-actions')||detail).prepend(preset);}
 bindPanelAction(preset,'click:recent200',event=>{
  event.preventDefault();const mode=panel.querySelector('[data-mode]'),count=panel.querySelector('[data-count]');if(!mode||!count)return;
  mode.value='number';count.value='200';count.disabled=false;mode.dispatchEvent(new Event('change',{bubbles:true}));count.dispatchEvent(new Event('change',{bubbles:true}));
  setStatus('スキ履歴を直近200人に設定しました｜「履歴から開始」で取得');
 });
 const oldButton=detail.querySelector('[data-a="like300-images"],[data-a="like300-fixed"]');
 if(oldButton&&!panelBindings.get(oldButton)?.has('click:history')){
  const button=oldButton.cloneNode(true);button.dataset.a='like300-fixed';button.textContent='履歴から開始';button.style.background='#176b54';button.style.borderColor='#5bd7a7';oldButton.replaceWith(button);
  bindPanelAction(button,'click:history',event=>{event.preventDefault();void restartFixed300()});
 }
 const resume=panel.querySelector('[data-a="resume"]');
 bindPanelAction(resume,'click:resume',event=>{event.preventDefault();void resumeFixed300()});
 const cards=panel.querySelector('[data-a="cards"]');
 if(cards){
  if(cards.textContent!=='② 通知カード')cards.textContent='② 通知カード';
  if(!panelBindings.get(cards)?.has('click:cards'))bindPanelAction(cards,'click:cards',event=>{
   const create=page.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__;if(typeof create!=='function')return;
   event.preventDefault();event.stopImmediatePropagation();void create();
  },{capture:true});
 }
 let audit=detail.querySelector('[data-a="check-duplicates"]');
 if(!audit){audit=document.createElement('button');audit.dataset.a='check-duplicates';audit.textContent='重複確認';(detail.querySelector('.special-actions')||detail).appendChild(audit);}
 bindPanelAction(audit,'click:audit',event=>{event.preventDefault();const check=page.__MUMEI_PROFILE_CARD_AUDIT_DUPLICATES__;if(typeof check==='function')void check()});
 const deleteCards=panel.querySelector('[data-a="delete"]');
 bindPanelAction(deleteCards,'click:delete',event=>{
  const remove=page.__MUMEI_PROFILE_CARD_DELETE_CARDS__;if(typeof remove!=='function')return;
  event.preventDefault();event.stopImmediatePropagation();void remove();
 },{capture:true});
 panel.querySelectorAll('button').forEach(button=>button.type='button');
 const stop=panel.querySelector('[data-a="stop"]');bindPanelAction(stop,'pointerdown:stop',()=>stopFix(),{capture:true});bindPanelAction(stop,'touchstart:stop',()=>stopFix(),{capture:true,passive:true});
 return true;
}`;

export function transformCoreGeneral(source){
 source=replaceFunction(source,'chooseCreatorArticle',chooseCreatorArticle);
 source=replaceFunction(source,'parseUnifiedSources',parseUnifiedSources);
 source=replaceFunction(source,'collectUnified',collectUnified);
 source=once(source,'function readJSONKey(key,fallback){',String.raw`function sourceSelectionNotice(run=readRun()){
 const count=Number(run?.sourceSelection?.unavailable||0);if(!count)return'';
 return'｜'+(run.sourceSelection.choice==='pinned'?'固定記事なし・未確認':'公開記事なし・未確認')+' '+count+'人';
}
function readJSONKey(key,fallback){`);
 source=once(source,"function choiceLabel(c){return c==='oldest'?'最初の記事':c==='fixed'?'固定→最新':'最新記事'}","function choiceLabel(c){return c==='oldest'?'最初の記事':c==='pinned'?'固定記事のみ':c==='fixed'?'固定→最新':'最新記事'}");
 source=once(source,'  <label>URL / マガジン / #（上から優先）</label>','  <label>#・記事のスキ・マガジン（複合可／上から優先）</label>');
 source=once(source,'  <div class="choices"><button data-choice="oldest">最初</button><button data-choice="fixed">固定→最新</button><button data-choice="latest">最新</button></div>','  <div class="choices"><button data-choice="oldest">最初</button><button data-choice="fixed">固定→最新</button><button data-choice="latest">最新</button><button data-choice="pinned">固定のみ</button></div>');
 source=once(source,'.choices{display:grid;grid-template-columns:repeat(3,1fr);','.choices{display:grid;grid-template-columns:repeat(2,1fr);');
 source=once(source," const choice=['oldest','fixed','latest'].includes(g.choice)?g.choice:'latest';"," const choice=['oldest','fixed','latest','pinned'].includes(g.choice)?g.choice:'latest';");
 const specialStart=source.indexOf('  <details data-special open>'),specialEnd=source.indexOf('  <details data-like300 open>',specialStart);
 if(specialStart<0||specialEnd<=specialStart)throw Error('General tool special panel boundaries changed');
 source=source.slice(0,specialStart)+source.slice(specialEnd);
 source=once(source,'  <details data-like300 open>','  <details data-like300>');
 source=once(source,'  <div class="phase"><button data-a="images">①画像一覧</button><button data-a="cards">②カード続き/開始</button></div>','  <div class="phase"><button data-a="images">① 画像を貼る</button><button data-a="cards">② 通知カード</button></div>\n  <div class="phase"><button data-a="resume">再開</button><button type="button" data-a="pause">一時停止</button></div>');
 source=once(source,'  <div class="tools"><button type="button" data-a="pause">一時停止</button><button type="button" data-a="stop">停止</button></div>','  <div class="tools"><button type="button" data-a="stop">停止</button></div>');
 source=once(source,'<button data-a="reset">最初に戻る</button>','<button data-a="reset">今回分を全削除</button>');
 source=once(source,'今回作った紹介画像＋正規通知カードを削除し、入力・件数・途中記録を最初に戻します。元本文・元画像・元カードは残します。実行しますか？','今回作った紹介画像・紹介文・通知カードと途中記録を削除します。入力・件数・表示設定、元本文・元画像・元カードは残します。実行しますか？');
 source=once(source,'  localStorage.removeItem(PREF);clearScan();resetFields();','  clearScan();');
 source=once(source,"mini.title='極薄サムを開く（ハロウィンアート2026・再開）'","mini.title='極薄サムを開く（再開）'");
 source=once(source,String.raw`function restorePanel(){
 const current=document.getElementById(PANEL);
 if(current&&(current!==mountedPanel||current.querySelector('.body')!==mountedPanelBody||!document.getElementById(PANEL+'-mini')))current.remove();
 mount();
}`,String.raw`function restorePanel(){
 const current=document.getElementById(PANEL);
 const broken=current&&(current!==mountedPanel||current.querySelector('.body')!==mountedPanelBody||!document.getElementById(PANEL+'-mini')||['[data-sources]','[data-mode]','[data-count]','[data-a="images"]','[data-choice="oldest"]','[data-choice="fixed"]','[data-choice="latest"]','[data-choice="pinned"]'].some(selector=>!current.querySelector(selector)));
 if(!broken){mount();return;}
 const selectors=['[data-sources]','[data-mode]','[data-count]','[data-presentation-size]','[data-presentation-content]'];
 const fields=selectors.map(selector=>({selector,element:current.querySelector(selector)})).filter(item=>item.element).map(item=>({selector:item.selector,value:item.element.value}));
 const choice=current.querySelector('[data-choice].on')?.dataset.choice,active=document.activeElement,focused=selectors.find(selector=>current.querySelector(selector)===active);
 const caret=focused&&typeof active.selectionStart==='number'?{start:active.selectionStart,end:active.selectionEnd,direction:active.selectionDirection}:null;
 const wasTiny=current.classList.contains('tiny'),wasCollapsed=current.classList.contains('collapsed'),position=current.style.cssText;
 current.remove();mount();
 const restored=document.getElementById(PANEL);if(!restored)return;
 for(const field of fields){const control=restored.querySelector(field.selector);if(control)control.value=field.value;}
 if(choice&&restored.querySelector('[data-choice="'+choice+'"]'))restored.querySelectorAll('[data-choice]').forEach(button=>button.classList.toggle('on',button.dataset.choice===choice));
 restored.classList.toggle('tiny',wasTiny);restored.classList.toggle('collapsed',wasCollapsed);if(position)restored.style.cssText=position;
 const mini=document.getElementById(PANEL+'-mini');if(mini)mini.style.display=wasTiny?'flex':'none';
 applyAmountMode();
 if(focused){const control=restored.querySelector(focused);control?.focus?.({preventScroll:true});if(caret)try{control.setSelectionRange(caret.start,caret.end,caret.direction)}catch{}}
}`);
 source=once(source," p.querySelector('[data-special-mode]').value=g.specialMode==='all'?'all':'number';"," const specialModeControl=p.querySelector('[data-special-mode]');if(specialModeControl)specialModeControl.value=g.specialMode==='all'?'all':'number';");
 source=once(source," p.querySelector('[data-special-mode]').addEventListener('change',()=>{applySpecialAmountMode();saveUiState()});"," p.querySelector('[data-special-mode]')?.addEventListener('change',()=>{applySpecialAmountMode();saveUiState()});");
 for(const action of ['special-images','scan-stats','paste-saved','clear-excluded'])source=once(source," p.querySelector('[data-a=\""+action+"\"]').addEventListener("," p.querySelector('[data-a=\""+action+"\"]')?.addEventListener(");
 source=once(source,' let note={},user={},profile=null;\n try{\n  const p=await xhrJSON(\'https://note.com/api/v3/notes/\'+encodeURIComponent(row.key));\n  note=p?.data||p||{};user=note.user||note.author||{}\n }catch{}\n profile=await creatorProfile(row.urlname||String(user.urlname||\'\')).catch(()=>null);',String.raw` let note={},user={},profile=null;
 const notePromise=xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key)).catch(()=>({}));
 const profilePromise=row.urlname?creatorProfile(row.urlname).catch(()=>null):Promise.resolve(null);
 const [payload,selectedProfile]=await Promise.all([notePromise,profilePromise]);
 note=payload?.data||payload||{};user=note.user||note.author||{};
 profile=row.urlname?selectedProfile:await creatorProfile(String(user.urlname||'')).catch(()=>null);`);
 source=once(source,' for(let i=0;i<rows.length;i+=5){\n  if(stopRequested)throw new Error(\'停止しました\');\n  setStatus(\'画像情報 \'+out.length+\'/\'+rows.length+\'…\');\n  out.push(...await Promise.all(rows.slice(i,i+5).map(enrich)))',' for(let i=0;i<rows.length;i+=8){\n  if(stopRequested)throw new Error(\'停止しました\');\n  setStatus(\'画像情報 \'+out.length+\'/\'+rows.length+\'…\');\n  out.push(...await Promise.all(rows.slice(i,i+8).map(enrich)))');
 // Keep skipped-selection explanations attached to this one run; no biography,
 // tokens, images, or unbounded logs are added to the checkpoint.
 source=once(source,"   mode:effective.mode,count:requestedCount,choice:input.choice","   mode:effective.mode,count:requestedCount,choice:input.choice,sourceSelection:!special&&!workmom&&!parenting?page.__MUMEI_PROFILE_CARD_SOURCE_SELECTION__||null:null");
 source=once(source,"setStatus('①画像一覧 完了 ✅ '+rows.length+'件｜カードを置く位置を本文でタップ →「②ここから通知カード」')","setStatus('①画像一覧 完了 ✅ '+rows.length+'件｜カードを置く位置を本文でタップ →「②ここから通知カード」'+sourceSelectionNotice())");
 source=once(source,"setStatus('保存分の続き貼付完了 ✅ '+rows.length+'件｜次は本文位置をタップ→②ここから通知カード')","setStatus('保存分の続き貼付完了 ✅ '+rows.length+'件｜次は本文位置をタップ→②ここから通知カード'+sourceSelectionNotice())");
 return source;
}

export function transformEditorGeneral(source){
 source=replaceFunction(source,'patchPanel',patchPanel);
 source=replaceFunction(source,'panelControlsMissing',String.raw`function panelControlsMissing(){
 const panel=document.getElementById(PANEL),body=panel?.querySelector('.body');
 return !panel||!document.getElementById(PANEL+'-mini')||panel!==observedPanel||!body||body!==observedBody||['[data-sources]','[data-mode]','[data-count]','[data-a="images"]','[data-choice="oldest"]','[data-choice="fixed"]','[data-choice="latest"]','[data-choice="pinned"]','[data-a="resume"]','[data-a="pause"]','[data-a="cards"]','details[data-like300]'].some(selector=>!panel.querySelector(selector));
}`);
 source=once(source,' if(reveal&&observedGallery){observedGallery.open=true;observedBody.scrollTop=0;}',' if(reveal&&observedBody)observedBody.scrollTop=0;');
 return source;
}
