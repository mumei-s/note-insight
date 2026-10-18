/* Gallery manifest and first-publication checks. No network or editor access on load. */
(function(root){
'use strict';
const VERSION='2.6.3';
const error=(code,message)=>Object.assign(new Error(message),{code});
const idOf=value=>String(value||'').trim().toLowerCase();
function csvRecords(text){
 const rows=[];let row=[],field='',quoted=false;
 const input=String(text??'').replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(quoted){if(ch==='"'&&input[i+1]==='"'){field+='"';i++}else if(ch==='"')quoted=false;else field+=ch;continue}
  if(ch==='"'){if(field)throw error('INVALID_MANIFEST','CSVの引用符を確認できません');quoted=true}
  else if(ch===','){row.push(field);field=''}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field=''}
  else field+=ch;
 }
 if(quoted)throw error('INVALID_MANIFEST','CSVの引用符が閉じられていません');
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 return rows
}
function parseCreatorsCsv(text){
 const rows=csvRecords(text);if(rows.length<2)throw error('INVALID_MANIFEST','参加者CSVが空です');
 const headers=rows.shift().map(x=>x.trim().toLowerCase());
 const column=names=>headers.findIndex(x=>names.includes(x));
 const nameColumn=column(['name','creator','creator_name','nickname','クリエイター名','名前']);
 const noteColumn=column(['note','note_url','noteurl','profile_url','profileurl','url','noteリンク','noteurlname']);
 const idColumn=column(['note_id','noteid','urlname','note_username']);
 const manifestColumn=column(['id','creator_id','number','no']);
 if(nameColumn<0||(noteColumn<0&&idColumn<0))throw error('INVALID_MANIFEST','参加者CSVの名前・note URL列を確認できません');
 return rows.map((values,index)=>{
  if(values.length!==headers.length)throw error('INVALID_MANIFEST',(index+2)+'行目の列数が一致しません');
  const raw=String(values[noteColumn]||'').trim(),explicit=idColumn>=0?String(values[idColumn]||'').trim():'';
  let urlname=explicit;
  if(raw){let url;try{url=new URL(raw)}catch{throw error('INVALID_MANIFEST',(index+2)+'行目のnote URLが不正です')}
   if(url.protocol!=='https:'||url.hostname!=='note.com'||url.username||url.password)throw error('INVALID_MANIFEST',(index+2)+'行目がnoteのURLではありません');
   const match=url.pathname.match(/^\/([A-Za-z0-9_\-]+)(?:\/|$)/);if(!match)throw error('INVALID_MANIFEST',(index+2)+'行目のnote IDが不正です');
   if(explicit&&idOf(explicit)!==idOf(match[1]))throw error('INVALID_MANIFEST',(index+2)+'行目のnote IDとURLが一致しません');urlname=match[1]
  }
  const creator=String(values[nameColumn]||'').trim();
  if(!creator||!/^[A-Za-z0-9_\-]+$/.test(urlname))throw error('INVALID_MANIFEST',(index+2)+'行目の名前・note IDが空または不正です');
  return{urlname,creator,likerKey:'gallery:'+idOf(urlname),actorUrl:'https://note.com/'+urlname,galleryId:manifestColumn>=0?String(values[manifestColumn]||'').trim():String(index+1)}
 })
}
function validateParticipants(creators,expected=126){
 if(!Array.isArray(creators)||creators.length!==expected)throw error('MANIFEST_COUNT','参加者数が'+expected+'人と一致しません');
 const seen=new Set();
 for(const creator of creators){const id=idOf(creator?.urlname);if(!/^[a-z0-9_\-]+$/.test(id)||!String(creator?.creator||'').trim())throw error('INVALID_MANIFEST','参加者の名前・note IDを確認できません');if(seen.has(id))throw error('DUPLICATE_CREATOR','参加者のnote IDが重複しています：'+id);seen.add(id)}
 return creators
}
function rawArticle(raw,creator){
 const note=raw?.note&&typeof raw.note==='object'?raw.note:raw;
 if(!note||typeof note!=='object')throw error('INVALID_ARTICLE','記事データが不正です');
 const key=String(note.key||'').trim();if(!/^n[a-f0-9]{12}$/i.test(key))throw error('INVALID_ARTICLE','記事IDを確認できません');
 const publication=String(note.publishAt||note.publish_at||note.published_at||'').trim(),time=Date.parse(publication);
 if(!publication||!Number.isFinite(time)||time>Date.now()+5000)throw error('INVALID_PUBLICATION','公開日時を確認できません：'+key);
 if(note.isPublished===false||note.is_published===false||note.isPublic===false||note.is_public===false||['draft','scheduled','private'].includes(String(note.status||'').toLowerCase()))throw error('UNPUBLISHED_ARTICLE','公開済みの記事ではありません：'+key);
 const expected=idOf(creator.urlname),user=note.user||note.author||{},author=String(user.urlname||user.urlName||note.urlname||'').trim();
 let urlAuthor='',urlKey='';const rawUrl=String(note.noteUrl||note.url||'').trim();
 if(rawUrl){let url;try{url=new URL(rawUrl)}catch{throw error('INVALID_ARTICLE','記事URLを確認できません：'+key)}
  const match=url.pathname.match(/^\/([A-Za-z0-9_\-]+)\/n\/(n[a-f0-9]{12})\/?$/i);
  if(url.protocol!=='https:'||url.hostname!=='note.com'||!match)throw error('INVALID_ARTICLE','記事URLがnote記事ではありません：'+key);urlAuthor=match[1];urlKey=match[2];
  if(urlKey.toLowerCase()!==key.toLowerCase())throw error('INVALID_ARTICLE','記事IDとURLが一致しません：'+key)
 }
 if((author&&idOf(author)!==expected)||(urlAuthor&&idOf(urlAuthor)!==expected)||(!author&&!urlAuthor))throw error('WRONG_AUTHOR','記事の投稿者が参加者と一致しません：'+key);
 return{raw,note,key,time,publication}
}
/** Returns a normal article row plus firstArticleProof; rejects instead of replacing/skipping. */
async function chooseOldestArticle(creator,options={}){
 const {requestJSON,articleFromRaw,stopRequested,onProgress}=options;
 if(typeof requestJSON!=='function'||typeof articleFromRaw!=='function')throw error('INVALID_OPTIONS','記事取得関数がありません');
 const creatorId=String(creator?.urlname||'').trim();if(!/^[A-Za-z0-9_\-]+$/.test(creatorId))throw error('INVALID_CREATOR','クリエイターIDを確認できません');
 const pages=new Map(),seenKeys=new Map();let knownTotal=null,requests=0;
 const stop=()=>{if(stopRequested?.())throw error('STOPPED','読み込みを停止しました')};
 async function fetchPage(pageNo,refresh=false){
  stop();if(!Number.isSafeInteger(pageNo)||pageNo<1)throw error('INVALID_PAGINATION','記事ページ番号が不正です');
  if(!refresh&&pages.has(pageNo))return pages.get(pageNo);
  if(++requests>72)throw error('PAGINATION_LIMIT','最初の記事を確認するためのページ探索が完了しません');
  const payload=await requestJSON('https://note.com/api/v2/creators/'+encodeURIComponent(creatorId)+'/contents?kind=note&page='+pageNo+'&disabled_pinned=true&with_notes=false',{refresh,cache:'no-store'});stop();
  const data=payload?.data;if(!data||typeof data!=='object'||!Array.isArray(data.contents))throw error('INVALID_PAGINATION','記事一覧の形式を確認できません');
  const rawTotal=data.totalCount??data.total_count,total=rawTotal===undefined||rawTotal===null?null:Number(rawTotal);
  if(total!==null&&(!Number.isSafeInteger(total)||total<0))throw error('INVALID_PAGINATION','記事総数が不正です');
  const flag=data.isLastPage??data.is_last_page;
  if(flag!==undefined&&typeof flag!=='boolean')throw error('INVALID_PAGINATION','最終ページ情報が不正です');
  // The live contents API reports totalCount:0 beyond the last real page.
  // Only this explicit empty terminal sentinel is exempt from snapshot totals.
  const emptyTerminalSentinel=pageNo>1&&data.contents.length===0&&flag===true&&total===0;
  if(total!==null&&!emptyTerminalSentinel){if(knownTotal!==null&&knownTotal!==total)throw error('STALE_PAGINATION','取得中に記事総数が変わりました。再読み込みしてください');knownTotal=total}
  const articles=data.contents.map(raw=>rawArticle(raw,creator)),keys=new Set();
  for(let i=0;i<articles.length;i++){const article=articles[i];if(keys.has(article.key))throw error('DUPLICATE_ARTICLE','同一ページの記事が重複しています');keys.add(article.key);if(i&&articles[i-1].time<article.time)throw error('UNSORTED_ARTICLES','固定記事を含む一覧の公開順を確認できません');const previous=seenKeys.get(article.key);if(previous!==undefined&&previous!==pageNo)throw error('DUPLICATE_PAGE','ページ送りで同じ記事が繰り返されました')}
  if(!articles.length&&flag===false)throw error('INVALID_PAGINATION','空の記事ページが最終ページではありません');
  const result={pageNo,articles,last:flag,total,fingerprint:articles.map(x=>x.key+':'+x.publication).join('|')};
  const previous=pages.get(pageNo);
  if(previous&&(previous.fingerprint!==result.fingerprint||previous.last!==result.last||previous.total!==result.total))throw error('STALE_PAGINATION','取得中に記事一覧が変わりました。再読み込みしてください');
  for(const [otherPage,other]of pages){if(otherPage===pageNo||!articles.length||!other.articles.length)continue;const earlier=otherPage<pageNo?other:result,later=otherPage<pageNo?result:other;if(earlier.articles.at(-1).time<later.articles[0].time)throw error('UNSORTED_ARTICLES','ページ間の公開順が一致しません')}
  articles.forEach(article=>seenKeys.set(article.key,pageNo));pages.set(pageNo,result);onProgress?.({creator:creatorId,page:pageNo,requests,total:knownTotal});return result
 }
 const first=await fetchPage(1);
 if(!first.articles.length){if(first.last===true&&knownTotal===0)throw error('NO_PUBLIC_ARTICLE','公開記事がありません：'+creatorId);throw error('INVALID_PAGINATION','最初の記事一覧が空で公開記事を確認できません：'+creatorId)}
 if(knownTotal!==null&&knownTotal<first.articles.length)throw error('STALE_PAGINATION','記事総数と一覧件数が一致しません');
 const perPage=first.articles.length;
 let low=1,high=null,terminal=null;
 if(first.last===true)terminal=first;
 else{
  let probe=knownTotal===null?2:Math.max(2,Math.ceil(knownTotal/perPage));
  for(;;){const page=await fetchPage(probe);if(!page.articles.length){high=probe;break}if(page.last===true){terminal=page;break}low=probe;probe*=2;if(!Number.isSafeInteger(probe))throw error('PAGINATION_LIMIT','記事一覧の終端を確認できません')}
  while(!terminal&&high-low>1){const page=await fetchPage(Math.floor((low+high)/2));if(!page.articles.length)high=page.pageNo;else if(page.last===true)terminal=page;else low=page.pageNo}
  if(!terminal)terminal=await fetchPage(low)
 }
 const next=await fetchPage(terminal.pageNo+1);
 if(next.articles.length)throw error('STALE_PAGINATION','最終ページの次にも記事があり、最初の記事を確定できません');
 if(terminal.last===false)throw error('INVALID_PAGINATION','最終ページの情報が一覧と一致しません');
 if(terminal.last!==true&&next.last!==true&&knownTotal===null)throw error('INVALID_PAGINATION','記事一覧の終端を確認できません');
 if(terminal.pageNo>1){const previous=await fetchPage(terminal.pageNo-1);if(!previous.articles.length||previous.last===true||previous.articles.length!==perPage)throw error('INVALID_PAGINATION','最終ページ直前の記事一覧が一致しません')}
 if(knownTotal!==null){const expected=(terminal.pageNo-1)*perPage+terminal.articles.length;if(expected!==knownTotal)throw error('STALE_PAGINATION','記事総数と最終ページが一致しません')}
 await fetchPage(1,true);
 const oldest=terminal.articles.reduce((best,item)=>item.time<best.time?item:best),row=articleFromRaw(oldest.raw,creator);
 if(!row||idOf(row.urlname)!==idOf(creatorId)||String(row.key||'').toLowerCase()!==oldest.key.toLowerCase())throw error('INVALID_ARTICLE','最初の記事への変換結果が一致しません');
 const canonicalUrl='https://note.com/'+creatorId+'/n/'+oldest.key;
 if(row.url){let url;try{url=new URL(row.url)}catch{throw error('INVALID_ARTICLE','最初の記事のリンクが不正です')}
  if(url.origin!=='https://note.com'||url.pathname.toLowerCase()!==new URL(canonicalUrl).pathname.toLowerCase())throw error('INVALID_ARTICLE','最初の記事のリンクが投稿者・記事IDと一致しません')}
 const evidence={version:VERSION,creator:creatorId,key:oldest.key,publishAt:oldest.publication,terminalPage:terminal.pageNo,totalCount:knownTotal,firstPageFingerprint:first.fingerprint,firstPageSize:first.articles.length,pagesChecked:[...pages.keys()].sort((a,b)=>a-b),requests,verifiedAt:new Date().toISOString()};
 // Never use a creation timestamp supplied by a permissive legacy converter.
 return{...row,url:canonicalUrl,publishAt:oldest.publication,articleSelection:'oldest-confirmed',oldestVerified:true,oldestEvidence:evidence,firstArticleProof:evidence}
}
root.__MUMEI_PROFILE_CARD_GALLERY__={version:VERSION,parseCreatorsCsv,validateParticipants,chooseOldestArticle};
})(typeof owner!=='undefined'?owner:typeof page!=='undefined'?page:typeof unsafeWindow!=='undefined'?unsafeWindow:typeof window!=='undefined'?window:globalThis);
