(function(){
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
const PREF='mumei_profile_card_presentation_v292';
function options(value={}){
 return {
  size:value.size==='medium'?'medium':'thin',
  content:['profile','summary','lead'].includes(value.content)?value.content:'name',
  showCreatorRanges:value.showCreatorRanges===true
 };
}
function readOptions(){try{return options(JSON.parse(localStorage.getItem(PREF)||'{}'))}catch{return options()}}
function account(value){return String(value?.urlname||value?.urlName||value?.url_name||value?.presentationAccount||'').trim().toLowerCase()}
function clean(value){
 if(typeof value!=='string')return'';
 const doc=new DOMParser().parseFromString(value.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|h[1-6]|li|blockquote)>/gi,'\n'),'text/html');
 doc.querySelectorAll('script,style,iframe,form,button,nav').forEach(node=>node.remove());
 return String(doc.body.textContent||'').replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function excerpt(value,budget=220){
 const text=String(value||'').trim(),units=graphemes(text);if(units.length<=budget)return{text,truncated:false};
 const prefix=units.slice(0,budget-1).join('');
 const boundaries=[...prefix.matchAll(/[。！？.!?](?:[」』）)]|\s|$)?|\n/g)].map(match=>match.index+match[0].length);
 const end=boundaries.filter(index=>index>=Math.floor(budget*.5)).at(-1);
 return{text:prefix.slice(0,end||prefix.length).trimEnd()+'…',truncated:true};
}
function readingBlocks(body){
 const doc=new DOMParser().parseFromString(body.replace(/<br\s*\/?\s*>/gi,'\uFDD3\n').replace(/<\/(?:p|div|h[1-6]|li|ul|ol|section)>/gi,'\n$&'),'text/html');
 doc.body.querySelectorAll('script,style,iframe,form,button,nav,figure,figcaption,pre,table,[hidden]').forEach(node=>node.remove());
 for(const quote of doc.body.querySelectorAll('blockquote')){
  quote.prepend('\n\uFDD1\n');
  quote.append('\n\uFDD2\n');
 }
 for(const heading of doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6'))heading.prepend('\n\uFDD0');
 let quoteDepth=0;
 return String(doc.body.textContent||'').split(/\r?\n/).flatMap(line=>{
  if(line.trim()==='\uFDD1'){quoteDepth++;return [];}
  if(line.trim()==='\uFDD2'){quoteDepth=Math.max(0,quoteDepth-1);return [];}
  const text=line.replace(/^[\s\uFDD0]+|[\s\uFDD3]+$/g,'').replace(/[\t\u00a0 ]+/g,' ');
  if(!text||/\$\$|\\(?:begin|text|char|boxed|large|scriptsize|tiny)\b/u.test(text)||/^https?:\/\/\S+$/i.test(text)||/^(?:[#＃]\S+\s*)+$/u.test(text)||!/[\p{L}\p{N}]/u.test(text))return [];
  const markdown=/^#{1,6}\s+/.test(text);
  return [{text:markdown?text.replace(/^#{1,6}\s+/,''):text,heading:markdown||line.includes('\uFDD0'),quote:quoteDepth>0,soft:line.endsWith('\uFDD3')}];
 });
}
function publicBody(body,field,partial=false){
 const blocks=readingBlocks(body);
 return {text:blocks.map(block=>block.text).join('\n'),blocks,field,kind:'note-free',partial};
}
function published(note){return note.status!=='draft'&&note.is_draft!==true&&note.isDraft!==true&&note.is_published!==false&&note.isPublished!==false&&note.is_published_preview_note!==true}
function restricted(note){
 return Boolean(Number(note.price)>0||note.is_limited||note.isLimited||note.is_membership_only||note.isMembershipOnly||note.is_trial||note.isTrial||note.can_read===false||note.canRead===false||note.can_read_note_all===false||note.isMembershipConnected||note.paywall?.context?.is_membership_connected);
}
function freeBody(note={}){
 if(!published(note))return {text:'',blocks:[]};
 const bodies=new Set([note.body,note.body_html,note.bodyHtml,note.body_text,note.bodyText].filter(body=>typeof body==='string'&&body.trim()));
 const separator=String(note.separator||'').trim();
 // The v3 paywall UI feature flag is also present on unrestricted articles.
 const explicitlyFree=(note.price===0||note.price==='0')&&!restricted(note);
 if(separator)for(const body of bodies){
  const doc=new DOMParser().parseFromString(body,'text/html'),nodes=[...doc.body.querySelectorAll('[id],[name]')];
  const marker=nodes.find(node=>node.getAttribute('id')===separator||node.getAttribute('name')===separator);
  if(marker){
   const range=doc.createRange();range.setStart(doc.body,0);range.setEndBefore(marker);
   const holder=doc.createElement('div');holder.append(range.cloneContents());
   const available=publicBody(holder.innerHTML,'body-before-separator',true);
   if(available.text)return available;
  }
 }
 if(explicitlyFree&&!separator){
  let longest=null;
  for(const body of bodies){
   const available=publicBody(body,'free-article-body');
   if(available.text.length>(longest?.text.length||0))longest=available;
  }
  if(longest)return longest;
 }
 const explicit=['free_body','freeBody','free_body_html','freeBodyHtml','free_body_text','freeBodyText','free_content','freeContent'];
 for(const field of explicit){
  if(typeof note[field]!=='string'||!note[field].trim())continue;
  const available=publicBody(note[field],field,!explicitlyFree||Boolean(separator));
  if(available.text)return available;
 }
 const title=clean(note.name||note.title);
 for(const field of ['lead','description']){
  const text=clean(note[field]);
  if(text&&text!==title&&/[\p{L}\p{N}]/u.test(text))return {text,blocks:[],field,kind:'note-public-lead'};
 }
 return {text:'',blocks:[]};
}
function noteSource(note={}){
 const user=note.user||note.author||{},id=account(user),key=String(note.key||note.note_key||note.noteKey||'').toLowerCase();
 let url=String(note.note_url||note.noteUrl||'');
 if(!url&&id&&/^n[a-f0-9]{12}$/.test(key))url='https://note.com/'+encodeURIComponent(id)+'/n/'+key;
 return{account:id,key,url};
}
const listedArticles=new Map();
function clearListedArticles(){listedArticles.clear()}
function rememberListedArticle(note){
 const source=noteSource(note);
 if(!source.account||!/^n[a-f0-9]{12}$/.test(source.key))return;
 const key=source.account+'|'+source.key;
 listedArticles.delete(key);
 listedArticles.set(key,note);
 if(listedArticles.size>1500)listedArticles.delete(listedArticles.keys().next().value);
}
const wordSegmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ja',{granularity:'word'}):null;
const commonTerms=new Set(['こと','もの','ため','よう','ところ','これ','それ','こちら','わたし','という','この','です','ます','いる','する','なる','ある','ない','さん','自分','今回','記事','the','with','from','this','that','have','into','about','when','what','were']);
function readingTerms(text){
 const normalized=text.normalize('NFKC').toLowerCase();
 const words=wordSegmenter?Array.from(wordSegmenter.segment(normalized),part=>part.isWordLike?part.segment:''):normalized.match(/[\p{Script=Han}\p{Script=Katakana}]+|[a-z0-9]+/gu)||[];
 return new Set(words.filter(word=>/^\d+$/.test(word)||word.length>=2&&/[\p{Script=Han}\p{Script=Katakana}a-z]/u.test(word)&&!commonTerms.has(word)));
}
const readingBoilerplate=/^(?:[\p{Extended_Pictographic}\s\uFE0F【◆]+)?(?:はじめまして|ごきげんよう|こんにちは|こんばんは|おはようございます|いつも(?:読ん|見)|(?:最後|ここ)まで(?:お読み|読ん|ご覧)|よろしければ|気に入ったら|応援よろしく|関連記事|あわせて読み|プロフィール|この記事をシェア|また次回|フォロー|チャンネル登録|スキ(?:をありがとう|[！♡\s])|[\d,]+文字[、で]|この(?:記事|ライン)より)/u;
const readingTopic=/^(?:今回(?:は|、)|まず[、：:]|そして[、：:]|そこで[、：:]|具体的には[、：:]|たとえば[、：:]|例えば[、：:]|その結果[、：:]|つまり[、：:]|私(?:は|たちは)|筆者は)\s*/u;
function summaryParagraphs(blocks){
 const paragraphs=[];
 for(const block of blocks){
  const previous=paragraphs.at(-1);
  if(previous?.soft&&!previous.heading&&!previous.quote&&!block.heading&&!block.quote){
   const space=/[a-z0-9]$/i.test(previous.text)&&/^[a-z0-9]/i.test(block.text)?' ':'';
   previous.text+=space+block.text;
   previous.soft=block.soft;
  }else paragraphs.push({...block});
 }
 return paragraphs;
}
function summaryPoints(blocks,title){
 const candidates=[],seen=new Set(),headings=[];
 let heading='',inFooter=false;
 for(const block of summaryParagraphs(blocks)){
  if(block.quote)continue;
  if(block.heading){
   heading=block.text.replace(/^[\s【◆●◼︎◇]+|[】\s]+$/gu,'');
   inFooter=readingBoilerplate.test(heading)||/^(?:その他の|関連する).*(?:こちら|一覧)|\d+人目.*クリエイター/u.test(heading);
   if(!inFooter&&heading.length<=32&&heading.length>=4&&!/[?!！？]$/.test(heading)&&readingTerms(heading).size)headings.push(heading);
   continue;
  }
  if(inFooter||readingBoilerplate.test(block.text))continue;
  const sentences=block.text.replace(/https?:\/\/[^\s<]+/gi,'').match(/[^。！？!?]+[。！？!?]?[」』]?/gu)||[];
  for(const value of sentences){
   const text=value.trim().replace(/^[-*・●◆▶]\s*/u,'').replace(/[\s\p{Extended_Pictographic}\uFE0F]+$/u,'');
   const minLength=/^\d/.test(text)?10:15;
   if(text.length<minLength||text.length>125||seen.has(text)||readingBoilerplate.test(text)||/^[「『（【#＃①-⑳]|[!?！？][」』]?$|(?:ではなく|してから|を使って|で遊んで|という|[はがを、…:：」』])$/u.test(text))continue;
   seen.add(text);candidates.push({text,heading,position:candidates.length});
  }
 }
 if(candidates.length<2||candidates.reduce((length,point)=>length+point.text.length,0)<52)return null;
 // Sample across the article for long reads, keeping the end in the scoring pool.
 const pool=candidates.length<=96?candidates:Array.from({length:96},(_,index)=>candidates[Math.round(index*(candidates.length-1)/95)]);
 const topic=readingTerms(title),frequency=new Map();
 for(const point of pool){
  point.terms=readingTerms(point.text);
  for(const term of point.terms)frequency.set(term,(frequency.get(term)||0)+1);
 }
 for(const point of pool){
  const topical=[...point.terms].filter(term=>topic.has(term)).length;
  const repeated=[...point.terms].filter(term=>frequency.get(term)>1).length;
  const specific=/[0-9０-９]|(?:結果|理由|比較|確認|方法|使う|試し|特徴|ために|ことで|分か|違い|条件|必要)/u.test(point.text);
  point.score=topical*2.4+Math.min(repeated,5)*.65+(specific?1.4:0)+(headings.includes(point.heading)?.75:0)-Math.abs(point.text.length-40)*.035;
  if(/(?:ありがとう|リンクから|下記|応援|ご参加|ご覧ください|販売中|募集しています|フォロー)/u.test(point.text))point.score-=4;
 }
 const ranked=pool.filter(point=>point.terms.size>=2&&point.score>=.7).sort((a,b)=>b.score-a.score);
 return {ranked,headings,midpoint:Math.floor(candidates.length/2)};
}
function summarizePoint(value){
 let point=value.replace(readingTopic,'').replace(/[。．.]+$/u,'').trim();
 if(!point)return '';
 // Convert only known endings, preserving negation and the stated tense.
 point=point.replace(/していました$/u,'していたと振り返ります')
  .replace(/しています$/u,'しているといいます')
  .replace(/しませんでした$/u,'しなかったと述べています')
  .replace(/しました$/u,'したと述べています')
  .replace(/になりました$/u,'になったといいます')
  .replace(/できました$/u,'できたといいます')
  .replace(/必要です$/u,'必要だと説明しています')
  .replace(/^(.+まで)投稿(?:可|可能(?:です)?)$/u,'投稿は$1です');
 return point+'。';
}
function structuredSummary(title,available,outline,budget){
 const {headings,ranked}=outline;
 const directions=[...new Set(headings)].filter(text=>/^(?:参加方法|投稿ルール|応募方法|設定方法|使い方|利用方法|注意事項|手順|準備するもの)$/u.test(text));
 if(directions.length>=2&&title.length>=4&&title.length<=38){
  const selected=directions.slice(0,2);
  const topic='「'+title+'」の'+selected.join('や')+'を案内しています。';
  const points=ranked.filter(point=>selected.includes(point.heading));
  const limit=points.find(point=>/\d+(?:人|日|件|記事|回).*まで/u.test(point.text));
  const details=(limit?[limit,...points]:points).map(point=>summarizePoint(point.text));
  const detail=details.find(text=>text&&text.length+topic.length<=budget);
  if(detail)return topic+detail;
 }
 const names=[...new Set(headings)].filter(text=>/^(?:.{1,19})(?:さん|様)$/u.test(text));
 if(names.length>=2&&names.length===headings.length&&/プロンプト(?:で遊ん|を試し|を使って|で作っ)/u.test(available.text)){
  const context=/文化祭/u.test(available.blocks.slice(0,15).map(block=>block.text).join(''))?'文化祭の企画で、':'';
  const topic=context+names.slice(0,3).join('、')+(names.length>3?'ら'+names.length+'人':'')+'のプロンプトを試した記録です。';
  const example=available.text.match(/『([^』\n]{2,24})』で(?:遊ん|作っ|試し)/u);
  const detail=example?'「'+example[1]+'」を使った作例も紹介しています。':'';
  return topic.length+detail.length<=budget?topic+detail:topic;
 }
 return '';
}
function summarizeBody(available,note,budget){
 if(available.kind!=='note-free')return '';
 const title=clean(note.name||note.title);
 const outline=summaryPoints(available.blocks,title);
 if(!outline)return '';
 const structured=structuredSummary(title,available,outline,budget);
 if(structured&&structured.length<=budget)return structured;
 const {ranked,headings,midpoint}=outline;
 let best='',bestScore=-Infinity;
 for(const first of ranked.slice(0,12)){
  for(const second of ranked.slice(0,20)){
   if(first.position>=second.position)continue;
   const shared=[...first.terms].filter(term=>second.terms.has(term)).length;
   if(shared>=.65*Math.min(first.terms.size,second.terms.size))continue;
   const main=summarizePoint(first.text),detail=summarizePoint(second.text);
   if(!main||!detail||main.length+detail.length>budget)continue;
   const topics=[...new Set([first.heading,second.heading])].filter(topic=>headings.includes(topic));
   const context=topics.length===2?'「'+topics.join('」と「')+'」を取り上げています。':'';
   const hasContext=context&&context.length+main.length+detail.length<=budget;
   const rewritten=main!==first.text.replace(/[。．.]+$/u,'')+'。'||detail!==second.text.replace(/[。．.]+$/u,'')+'。';
   if(!hasContext&&!rewritten)continue;
   const text=hasContext?context+main+detail:main+detail;
   const spansBody=first.position<midpoint&&second.position>=midpoint;
   const score=first.score+second.score+(spansBody?1.8:0)+(topics.length===2?1:0)+Math.min(shared,2)*.8;
   if(score>bestScore){best=text;bestScore=score;}
  }
 }
 // With too little distinct material, leave the original opening in its own mode.
 return best&&best.replace(/\s+/g,'')!==available.text.replace(/\s+/g,'')?best:'';
}
function profileIntro(profile){
 const raw=profile?.rawProfile||profile||{};
 let text=typeof raw.profileText==='string'?raw.profileText.trim():'';
 for(const field of ['profile','description','bio','introduction','self_introduction','note_intro']){
  if(text)break;
  text=clean(raw[field]);
 }
 const id=account(raw);
 return {text,source:{kind:'profile',account:id,key:'',url:id?'https://note.com/'+encodeURIComponent(id):''}};
}
function compose(row,note={},profile={},requested=readOptions()){
 const selected=options(requested),base={version:3,...selected,display:'name',text:'',status:'available',source:{kind:'name'}};
 if(selected.content==='name')return base;
 const budget=selected.size==='medium'?150:108;
 const listed=listedArticles.get(account(row)+'|'+String(row?.key||'').toLowerCase());
 const useListed=listed&&listed!==note&&published(note)&&(!restricted(note)||restricted(listed));
 const sources=useListed?[note,listed]:[note];
 if(selected.content!=='profile'){
  let opening=null;
  for(const article of sources){
   const available=freeBody(article);
   if(!available.text)continue;
   const source={kind:available.kind,field:available.field,...noteSource(article)};
   const summary=selected.content==='summary'?summarizeBody(available,article,budget):'';
   if(summary)return {...base,display:'summary',text:summary,partial:available.partial,source};
   if(!opening||opening.source.kind!=='note-free'&&available.kind==='note-free'){
    opening={...base,...excerpt(available.text,budget),display:'lead',source};
   }
   if(selected.content==='lead'&&available.kind==='note-free')return opening;
  }
  if(opening)return opening;
 }
 for(const candidate of [profile,...sources.map(article=>article.user||article.author)]){
  const intro=profileIntro(candidate);
  if(intro.text)return {...base,...excerpt(intro.text,budget),display:'profile',source:intro.source};
 }
 return base;
}
function visibleContent(value){return value?.display||value?.content||'name'}
function introText(value){return String(value?.text||'').trim().replace(/…（抜粋）$/u,'…')}
function label(value){
 switch(visibleContent(value)){
  case 'summary':return value.version<2||!value.version?'無料公開部分の要約':value.partial?'公開部分の要約':'記事の要約';
  case 'lead':return '読み始め';
  case 'profile':return 'プロフィール';
  default:return '';
 }
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
function legacyResponsiveAboveLayout(row,widthPx=288,fontBasePx=20){
 const value=row?.presentation;
 const bodyWidthPx=Number.isFinite(Number(widthPx))&&Number(widthPx)>0?Math.max(96,Math.min(1600,Number(widthPx))):288;
 const base=Number.isFinite(Number(fontBasePx))&&Number(fontBasePx)>0?Math.max(10,Math.min(64,Number(fontBasePx))):20;
 // KaTeX's smallest supported size is relative: .katex 1.21em × tiny .5.
 // Reserve the box's padding and one extra glyph. This is a layout estimate;
 // the independent inspector must still measure the actual rendered DOM.
 const estimatedFontPx=base*.605,cellBudget=Math.max(3,Math.min(22,Math.floor((bodyWidthPx-estimatedFontPx*1.5-20)/estimatedFontPx)));
 const contract={version:2,font:'tiny',cellBudget,bodyWidthPx,fontBasePx:base,maxFontPx:14,maxHeightPx:140};
 if(!value||value.size!=='thin'||visibleContent(value)==='name'||row.finalMarker)return{...contract,text:'',lines:[],lineCount:0,wordSplitCandidate:false,kinsokuCandidate:false,truncated:false};
 const header=responsiveWrap('◇ '+label(value),cellBudget),body=responsiveWrap(value.text,cellBudget),plain=[...header.lines,...body.lines];
 const formula=plain.map(line=>'\\text{'+tex(line)+'}');
 return{...contract,text:'$${\\tiny\\boxed{\\begin{array}{l}'+formula.join('\\\\')+'\\end{array}}}$$',lines:plain,lineCount:plain.length,wordSplitCandidate:body.wordSplitCandidate,kinsokuCandidate:header.kinsokuCandidate||body.kinsokuCandidate,truncated:Boolean(value.truncated)};
}
function aboveLayout(row,widthPx=288,fontBasePx=20){
 const value=row?.presentation;
 const text=value?.size==='thin'&&visibleContent(value)!=='name'&&!row.finalMarker?introText(value):'';
 const width=Number(widthPx)||288,font=Number(fontBasePx)||20;
 const cellBudget=Math.max(3,Math.floor(width/font));
 const wrapped=text?responsiveWrap(text,cellBudget):{lines:[],wordSplitCandidate:false,kinsokuCandidate:false};
 return {version:3,font:'paragraph',bodyWidthPx:width,fontBasePx:font,cellBudget,text,...wrapped,lineCount:wrapped.lines.length,truncated:Boolean(value?.truncated)};
}
function aboveText(row,widthPx,fontBasePx){return aboveLayout(row,widthPx,fontBasePx).text}
function layoutContract(layout){
 if(!layout||![2,3].includes(layout.version))return null;
 const {version,font,cellBudget,bodyWidthPx,fontBasePx,maxFontPx,maxHeightPx,lineCount,wordSplitCandidate,kinsokuCandidate,truncated}=layout;
 return{version,font,cellBudget,bodyWidthPx,fontBasePx,maxFontPx,maxHeightPx,lineCount,wordSplitCandidate,kinsokuCandidate,truncated};
}
function matchesAboveText(row,literal,contract){
 if(typeof literal!=='string')return false;
 if(literal===aboveText(row))return true;
 return contract?.version!==3&&(literal===legacyAboveText(row)||literal===legacyResponsiveAboveLayout(row,contract?.bodyWidthPx,contract?.fontBasePx).text);
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
 row.innerHTML='<select data-presentation-size aria-label="サムネイルの大きさ"><option value="thin">極薄</option><option value="medium">中型</option></select><select data-presentation-content aria-label="紹介内容"><option value="name">名前だけ</option><option value="profile">プロフィール</option><option value="lead">読み始め</option><option value="summary">要約</option></select>';
 row.querySelector('[data-presentation-size]').value=saved.size;row.querySelector('[data-presentation-content]').value=saved.content;
 const amount=panel.querySelector('.amount');if(amount)amount.before(row);else panel.querySelector('.body')?.append(row);
 const rangeLabel=document.createElement('label');
 rangeLabel.className='hint';
 rangeLabel.style.cssText='display:flex;align-items:center;gap:4px;min-height:24px;color:#dff6ff;font-size:9px;cursor:pointer';
 const ranges=document.createElement('input');
 ranges.type='checkbox';ranges.dataset.presentationRanges='';ranges.checked=saved.showCreatorRanges;
 ranges.style.cssText='width:14px;height:14px;margin:0;flex:none;accent-color:#68d6ec';
 rangeLabel.append(ranges,'何人目かの見出し');
 row.after(rangeLabel);
 const update=()=>{
  const selected=options({size:row.querySelector('[data-presentation-size]').value,content:row.querySelector('[data-presentation-content]').value,showCreatorRanges:ranges.checked});
  try{localStorage.setItem(PREF,JSON.stringify(selected))}catch{}
 };
 row.addEventListener('change',update);ranges.addEventListener('change',update);
}
 page.__MUMEI_PROFILE_CARD_CONTENT__={readOptions,options,compose,visibleContent,label,introText,aboveText,aboveLayout,legacyAboveText,legacyResponsiveAboveLayout,matchesAboveText,layoutContract,presentationContext,mount,clean,excerpt,freeBody,profileIntro,rememberListedArticle,clearListedArticles};
})();
