(function(){
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
const PREF='mumei_profile_card_presentation_v292';
function options(value={}){return{size:value.size==='medium'?'medium':'thin',content:['profile','summary'].includes(value.content)?value.content:'name'}}
function readOptions(){try{return options(JSON.parse(localStorage.getItem(PREF)||'{}'))}catch{return options()}}
function account(value){return String(value?.urlname||value?.urlName||value?.url_name||value?.presentationAccount||'').trim().toLowerCase()}
function clean(value){
 if(typeof value!=='string')return'';
 const doc=new DOMParser().parseFromString(value.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|h[1-6]|li|blockquote)>/gi,'\n'),'text/html');
 doc.querySelectorAll('script,style,iframe,form,button,nav').forEach(node=>node.remove());
 return String(doc.body.textContent||'').replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function excerpt(value,budget=220){
 const text=String(value||'').trim(),units=Array.from(text);if(units.length<=budget)return{text,truncated:false};
 const prefix=units.slice(0,budget-7).join('');
 const boundaries=[...prefix.matchAll(/[。！？.!?](?:[」』）)]|\s|$)?|\n/g)].map(match=>match.index+match[0].length);
 const end=boundaries.filter(index=>index>=Math.floor(budget*.5)).at(-1);
 return{text:prefix.slice(0,end||prefix.length).trim()+'…（抜粋）',truncated:true};
}
function freeBody(note={}){
 const explicit=['free_body','freeBody','free_body_html','freeBodyHtml','free_body_text','freeBodyText','free_content','freeContent'];
 for(const field of explicit)if(typeof note[field]==='string'&&clean(note[field]))return{text:clean(note[field]),field,kind:'note-free'};
 const body=typeof note.body==='string'?note.body:typeof note.body_html==='string'?note.body_html:typeof note.body_text==='string'?note.body_text:typeof note.bodyText==='string'?note.bodyText:'';
 const separator=String(note.separator||'').trim();
 if(body&&separator){
  const doc=new DOMParser().parseFromString(body,'text/html'),nodes=[...doc.body.querySelectorAll('[id],[name]')];
  const marker=nodes.find(node=>node.getAttribute('id')===separator||node.getAttribute('name')===separator);
  if(marker){
   const range=doc.createRange();range.setStart(doc.body,0);range.setEndBefore(marker);
   const holder=doc.createElement('div');holder.append(range.cloneContents());
   return{text:clean(holder.innerHTML),field:'body-before-separator',kind:'note-free'};
  }
 }
 const numericPrice=Object.prototype.hasOwnProperty.call(note,'price')&&note.price!==null&&note.price!==''&&Number.isFinite(Number(note.price));
 const explicitlyFree=numericPrice&&Number(note.price)===0&&!note.is_limited&&!note.isLimited&&!note.is_membership_only&&!note.isMembershipOnly&&!note.paywall?.is_simple_paid_note&&!note.paywall?.context?.is_membership_connected;
 if(body&&explicitlyFree)return{text:clean(body),field:'free-article-body',kind:'note-free'};
 // Publisher-supplied public leads are useful even when the full/free boundary
 // is unknown. Never use a title or an authenticated paid body as a summary.
 for(const field of ['lead','description','excerpt','summary'])if(typeof note[field]==='string'&&clean(note[field]))return{text:clean(note[field]),field,kind:'note-public-lead'};
 return{text:'',field:'',kind:'note-free'};
}
function noteSource(note={}){
 const user=note.user||note.author||{},id=account(user),key=String(note.key||note.note_key||note.noteKey||'').toLowerCase();
 let url=String(note.note_url||note.noteUrl||'');
 if(!url&&id&&/^n[a-f0-9]{12}$/.test(key))url='https://note.com/'+encodeURIComponent(id)+'/n/'+key;
 return{account:id,key,url};
}
function compose(row,note={},profile={},requested=readOptions()){
 const selected=options(requested),base={version:1,...selected,text:'',status:'available',source:{kind:'name'}};
 if(selected.content==='name')return base;
 const rawProfile=profile?.rawProfile||profile||{};
 if(selected.content==='profile'){
  const text=typeof rawProfile.profileText==='string'?rawProfile.profileText:clean(rawProfile.profile??rawProfile.description??rawProfile.bio??rawProfile.introduction??rawProfile.self_introduction??rawProfile.note_intro??'');
  const shown=excerpt(text,selected.size==='medium'?220:118);
  return{...base,...shown,status:text?'available':'unavailable',text:text?shown.text:'プロフィール未設定',source:{kind:'profile',account:account(rawProfile),key:'',url:account(rawProfile)?'https://note.com/'+encodeURIComponent(account(rawProfile)):''}};
 }
 const available=freeBody(note),shown=excerpt(available.text,selected.size==='medium'?220:118);
 return{...base,...shown,status:available.text?'available':'unavailable',text:available.text?shown.text:'無料公開本文を取得できません',source:{kind:available.kind,field:available.field,...noteSource(note)}};
}
function tex(value){
 const escapes={'\\':'\\textbackslash{}','{':'\\{','}':'\\}','$':'\\$','&':'\\&','#':'\\#','_':'\\_','%':'\\%','^':'\\textasciicircum{}','~':'\\textasciitilde{}','\t':'\\quad ',' ':'\\space ','`':'\\verb+`+',"'":"\\verb+'+"};
 return Array.from(String(value||''),char=>{
  if(Object.prototype.hasOwnProperty.call(escapes,char))return escapes[char];
  if(/[‼⁇⁈⁉｜|《》-]|\p{Mark}/u.test(char)||char.normalize('NFD')!==char)return'\\char"'+char.codePointAt(0).toString(16).toUpperCase()+'{}';
  return char;
 }).join('');
}
function legacyWrap(value,budget=26){
 const lines=[];for(const original of String(value||'').split('\n')){
  let line='',width=0;for(const char of Array.from(original)){
   const size=/^[\x20-\x7e]$/.test(char)?.53:1;
   if(line&&width+size>budget){lines.push(line);line='';width=0}line+=char;width+=size;
  }lines.push(line);
 }return lines;
}
function legacyAboveText(row){
 const value=row?.presentation;if(!value||value.size!=='thin'||value.content==='name'||row.finalMarker)return'';
 const label=value.content==='profile'?'プロフィール':'無料公開部分の要約';
 const lines=['◇ '+label,...legacyWrap(value.text)].map(line=>'\\text{'+tex(line)+'}');
 return'$${\\scriptsize\\boxed{\\begin{array}{l}'+lines.join('\\\\')+'\\end{array}}}$$';
}
const graphemeSegmenter=(()=>{try{return typeof Intl?.Segmenter==='function'?new Intl.Segmenter('ja',{granularity:'grapheme'}):null}catch{return null}})();
function graphemes(value){
 const text=String(value??'');try{if(graphemeSegmenter)return Array.from(graphemeSegmenter.segment(text),part=>part.segment)}catch{}
 return Array.from(text);
}
const noLineStart=/^[、。，．・：；？！ー…‥）〕］｝〉》」』】〙〗〟’”｠»ヽヾ々〻ゝゞぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ,.:;!?\)\]\}]/u;
const noLineEnd=/[（〔［｛〈《「『【〘〖〝‘“｟«\(\[\{]$/u;
function cells(value){return graphemes(value).reduce((sum,part)=>sum+(/^\s+$/.test(part)?.55:/^[\x20-\x7e]$/.test(part)?/[MWmw@%]/.test(part)?1:.72:/\p{Extended_Pictographic}/u.test(part)?1.6:1),0)}
function responsiveWrap(value,budget){
 const lines=[];let wordSplitCandidate=false,kinsokuCandidate=false;
 const segment=original=>{
  const units=graphemes(original),words=[];
  for(let index=0;index<units.length;){
   if(/^[A-Za-z0-9_]+$/.test(units[index])){
    let end=index+1;while(end<units.length&&/^[A-Za-z0-9_]+$/.test(units[end]))end++;
    const word=units.slice(index,end).join('');
    if(cells(word)<=budget-2)words.push(word);else{words.push(...units.slice(index,end));wordSplitCandidate=true}index=end;
   }else words.push(units[index++]);
  }
  const joined=[];
  for(const unit of words){const previous=joined.at(-1);if(previous&&(noLineStart.test(unit)||noLineEnd.test(previous))&&cells(previous+unit)<=budget)joined[joined.length-1]+=unit;else joined.push(unit)}
  let line='',width=0;
  for(const unit of joined){
   const size=cells(unit);if(line&&width+size>budget){lines.push(line);line='';width=0}
   if(!line&&noLineStart.test(unit))kinsokuCandidate=true;
   line+=unit;width+=size;
  }
  if(noLineEnd.test(line))kinsokuCandidate=true;
  lines.push(line);
 };
 for(const original of String(value??'').replace(/\r\n?/g,'\n').split('\n'))segment(original);
 return{lines,wordSplitCandidate,kinsokuCandidate};
}
function aboveLayout(row,widthPx=288,fontBasePx=20){
 const value=row?.presentation;
 const bodyWidthPx=Number.isFinite(Number(widthPx))&&Number(widthPx)>0?Math.max(96,Math.min(1600,Number(widthPx))):288;
 const base=Number.isFinite(Number(fontBasePx))&&Number(fontBasePx)>0?Math.max(10,Math.min(64,Number(fontBasePx))):20;
 // KaTeX's smallest supported size is relative: .katex 1.21em × tiny .5.
 // Reserve the box's padding and one extra glyph. This is a layout estimate;
 // the independent inspector must still measure the actual rendered DOM.
 const estimatedFontPx=base*.605,cellBudget=Math.max(3,Math.min(22,Math.floor((bodyWidthPx-estimatedFontPx*1.5-20)/estimatedFontPx)));
 const contract={version:2,font:'tiny',cellBudget,bodyWidthPx,fontBasePx:base,maxFontPx:14,maxHeightPx:140};
 if(!value||value.size!=='thin'||value.content==='name'||row.finalMarker)return{...contract,text:'',lines:[],lineCount:0,wordSplitCandidate:false,kinsokuCandidate:false,truncated:false};
 const label=value.content==='profile'?'◇ プロフィール':'◇ 無料公開部分の要約';
 const header=responsiveWrap(label,cellBudget),body=responsiveWrap(value.text,cellBudget),plain=[...header.lines,...body.lines];
 const formula=plain.map(line=>'\\text{'+tex(line)+'}');
 return{...contract,text:'$${\\tiny\\boxed{\\begin{array}{l}'+formula.join('\\\\')+'\\end{array}}}$$',lines:plain,lineCount:plain.length,wordSplitCandidate:body.wordSplitCandidate,kinsokuCandidate:header.kinsokuCandidate||body.kinsokuCandidate,truncated:Boolean(value.truncated)};
}
function aboveText(row,widthPx,fontBasePx){return aboveLayout(row,widthPx,fontBasePx).text}
function layoutContract(layout){
 if(!layout||layout.version!==2)return null;
 const {version,font,cellBudget,bodyWidthPx,fontBasePx,maxFontPx,maxHeightPx,lineCount,wordSplitCandidate,kinsokuCandidate,truncated}=layout;
 return{version,font,cellBudget,bodyWidthPx,fontBasePx,maxFontPx,maxHeightPx,lineCount,wordSplitCandidate,kinsokuCandidate,truncated};
}
function matchesAboveText(row,literal,contract){
 if(typeof literal!=='string')return false;
 return literal===legacyAboveText(row)||literal===aboveText(row,contract?.bodyWidthPx,contract?.fontBasePx);
}
function presentationContext(view){
 const element=view?.dom;let bodyWidthPx=288,fontBasePx=20,measured=false;
 try{
  if(element?.getBoundingClientRect){
   const style=element.ownerDocument?.defaultView?.getComputedStyle?.(element)||page.getComputedStyle?.(element),rect=element.getBoundingClientRect();
   const inset=['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'].reduce((sum,key)=>sum+(Number.parseFloat(style?.[key])||0),0),width=rect.width-inset;
   if(width>0){bodyWidthPx=width;measured=true}
   const font=Number.parseFloat(style?.fontSize);if(font>0)fontBasePx=font;
  }
  const viewport=Number(page.visualViewport?.width||page.innerWidth||0);if(viewport>64)bodyWidthPx=Math.min(bodyWidthPx,viewport-32);
 }catch{}
 return{bodyWidthPx,fontBasePx,measured};
}
function mount(panel){
 if(!panel||panel.querySelector('[data-presentation-size]'))return;
 const saved=readOptions(),row=document.createElement('div');row.className='amount presentation';row.style.gridTemplateColumns='1fr 1fr';
 row.innerHTML='<select data-presentation-size aria-label="サムネイルの大きさ"><option value="thin">極薄</option><option value="medium">中型</option></select><select data-presentation-content aria-label="紹介内容"><option value="name">名前のみ</option><option value="profile">プロフィール</option><option value="summary">記事の要約</option></select>';
 row.querySelector('[data-presentation-size]').value=saved.size;row.querySelector('[data-presentation-content]').value=saved.content;
 const amount=panel.querySelector('.amount');if(amount)amount.before(row);else panel.querySelector('.body')?.append(row);
 const hint=document.createElement('div');hint.className='hint';hint.dataset.presentationHint='';row.after(hint);
 const update=()=>{const selected=options({size:row.querySelector('[data-presentation-size]').value,content:row.querySelector('[data-presentation-content]').value});try{localStorage.setItem(PREF,JSON.stringify(selected))}catch{}hint.textContent=selected.content==='name'?'名前は画像の中':selected.size==='thin'?'紹介文は画像の上｜長文は抜粋':'紹介文は画像の中｜長文は抜粋';};
 row.addEventListener('change',update);update();
}
page.__MUMEI_PROFILE_CARD_CONTENT__={readOptions,options,compose,aboveText,aboveLayout,legacyAboveText,matchesAboveText,layoutContract,presentationContext,mount,clean,excerpt,freeBody};
})();
