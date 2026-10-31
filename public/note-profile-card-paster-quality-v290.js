// Additive, local-only quality observation. No editor writes or network requests.
// Validated account/article/file or assigned-tag contradictions hold before writes. No auto edits.
(function(page){
'use strict';
if(!page||page.__MUMEI_PROFILE_CARD_QUALITY__)return;
const VERSION='2.9.4',LIMIT=160,SOURCE_LIMIT=1024,PREF='mumei_profile_quality_mode_v1',PREFIX='mumei_profile_quality_log_v1:';
const state={records:[],counts:{},mode:'on',fault:false,scope:'',dirty:false,batchId:'',batchSerial:0,runId:null,attention:''};
const renderings=new WeakMap(),files=new WeakMap(),layouts=new WeakMap();
const presentationNodes=new WeakMap();
const bindings=new WeakMap(),urlIdentities=new Map(),URL_IDENTITY_LIMIT=2048;
let scopePath='',scopeKey='';
let sources=new Map();
let legacyDiagnoses=new Map();
const fingerprint=value=>{let h=2166136261;for(const c of String(value??'')){h^=c.codePointAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(16)};
const account=value=>/^[a-z0-9_-]+$/i.test(String(value||'').trim())?String(value).trim().toLowerCase():'';
const cleanUrl=value=>{try{const u=new URL(String(value||''));if(u.protocol!=='https:')return'';u.search='';u.hash='';u.username='';u.password='';return u.href}catch{return''}};
function urlIdentity(value){
 const text=String(value||'');if(urlIdentities.has(text))return urlIdentities.get(text);
 let result={};
 try{const u=new URL(text);if(u.protocol==='https:'&&['note.com','www.note.com'].includes(u.hostname)&&!u.username&&!u.password){const match=u.pathname.match(/^\/([a-z0-9_-]+)(?:\/n\/(n[a-f0-9]{12}))?\/?$/i);if(match)result={account:account(match[1]),key:(match[2]||'').toLowerCase()}}}catch{}
 urlIdentities.set(text,result);if(urlIdentities.size>URL_IDENTITY_LIMIT)urlIdentities.delete(urlIdentities.keys().next().value);
 return result;
}
function tagName(value){
 if(typeof value!=='string')return'';
 const normalized=value.trim().replace(/^[#＃]+/u,'').normalize('NFC').trim();
 return normalized&&Array.from(normalized).length<=100&&!/[\u0000-\u001f\u007f]/u.test(normalized)?normalized:'';
}
function assignedTagEvidence(note){
 const fields=['hashtags','tags','hashtag_names','tag_names','note_hashtags','hashtag_notes'],names=[],seen=new Set();let present=false,complete=true;
 for(const field of fields){
  if(!Object.prototype.hasOwnProperty.call(note,field))continue;
  present=true;const entries=note[field];if(!Array.isArray(entries)){complete=false;continue}
  if(entries.length>50)complete=false;
  for(const entry of entries.slice(0,50)){
   const name=[entry,entry?.name,entry?.hashtag?.name,entry?.tag?.name].map(tagName).find(Boolean);
   if(!name){complete=false;continue}if(seen.has(name))continue;
   if(names.length>=50){complete=false;continue}seen.add(name);names.push(name);
  }
 }
 return present?{names,complete}:null;
}
function articleEvidence(raw,source='creator-list'){
 const note=raw?.note&&typeof raw.note==='object'?raw.note:raw||{},user=note.user||note.author||{};
 const result={source,key:String(note.key||'').toLowerCase(),account:account(user.urlname||user.urlName||note.urlname),url:cleanUrl(note.noteUrl||note.url),nameHash:fingerprint(user.nickname||user.name||''),icon:cleanUrl(user.profileImageUrl||user.user_profile_image_url||user.profile_image_url||user.user_profile_image_path||user.profile_image_path||user.profileImagePath||user.icon_url||user.image_url),thumbnail:cleanUrl(typeof note.eyecatch==='string'?note.eyecatch:note.eyecatch?.url||note.eyecatch_url||note.thumbnailExternalUrl||note.image_url||note.imageUrl||note.thumbnail_url||note.thumbnailUrl||note.eyecatch_image?.url||note.eyecatchImage?.url||note.image?.url||note.thumbnail?.url)};
 if(source==='note-api'){const tags=assignedTagEvidence(note);if(tags)result.assignedTags=tags}
 return result;
}
function profileEvidence(raw,target){
 const p=raw||{};
 return{source:'creator-api',requested:account(target),account:account(p.urlname||p.urlName),nameHash:fingerprint(p.nickname||p.name||''),icon:cleanUrl(p.profileImageUrl||p.user_profile_image_url||p.profile_image_url||p.user_profile_image_path||p.profile_image_path||p.profileImagePath||p.icon_url||p.image_url)};
}
function sourceBinding(row){
 // Reuse only calculations for exactly equal scalar inputs. Every gate still
 // inspects the current row and source; edits to the same object invalidate it.
 const inputs=[row?.urlname,row?.key,row?.url,row?.creator,row?.profileText,row?.actorImageUrl,row?.thumbUrl];
 const cacheable=row&&typeof row==='object'&&inputs.every(value=>value==null||['string','number','boolean'].includes(typeof value)),cached=cacheable?bindings.get(row):null;
 if(cached&&inputs.every((value,index)=>value===cached.inputs[index]))return{...cached.binding};
 const binding={account:account(inputs[0]),key:String(inputs[1]||'').toLowerCase(),url:cleanUrl(inputs[2]),nameHash:fingerprint(inputs[3]),profileHash:typeof inputs[4]==='string'?fingerprint(inputs[4]):null,icon:cleanUrl(inputs[5]),thumbnail:cleanUrl(inputs[6])};
 if(cacheable)bindings.set(row,{inputs,binding});
 return{...binding};
}
const provenance=row=>row?.qualitySource||sources.get(row?.qualityRef);
function attach(row,proof){
 selectScope();
 const ref='q1:'+proof.target+'/'+String(row.key||'')+'/'+fingerprint(JSON.stringify(proof));
 sources.set(ref,proof);if(sources.size>SOURCE_LIMIT)sources.delete(sources.keys().next().value);state.dirty=true;
 // Only a short reference travels through the original frequently flushed run.
 const result={...row,qualityRef:ref};
 const reasons=[...(row?.qualitySourceIssue?.version===1?row.qualitySourceIssue.reasons||[]:[]),...strictIdentityReasons(row,proof)];
 if(reasons.length)result.qualitySourceIssue={version:1,reasons:[...new Map(reasons.map(reason=>[JSON.stringify(reason),reason])).values()]};
 return result;
}
function beginBatch({run=null,resume=false}={}){
 safe(()=>{
  const runId=run?.createdAt??null;
  // Keep the same inspection session only for the same saved run. A new
  // selection/count/source is not graded using the preceding run's results.
  if(resume&&runId!==null&&state.runId===runId&&state.batchId)return;
  state.batchId=Date.now().toString(36)+'-'+String(++state.batchSerial);
  state.runId=resume?runId:null;state.counts={};state.attention='';state.dirty=true;updateBadge();
 });
}
function rawRow(row,raw,creator={}){
 if(!row)return row;
 return attach(row,{version:1,target:account(creator.urlname)||account(row.urlname),articles:[articleEvidence(raw)],actor:creator.urlname?{account:account(creator.urlname),icon:cleanUrl(creator.actorImageUrl),source:'target-selection'}:null,binding:sourceBinding(row)});
}
function acquired(row,{target,note,profile,selected,normalizedProfile=false}={}){
 if(!row)return row;
 const previous=provenance(selected)||provenance(row);
 const articles=[...(previous?.articles||[]),...(note&&typeof note==='object'?[articleEvidence(note,'note-api')]:[])].slice(-3);
 const result=attach(row,{version:1,target:account(target)||previous?.target||account(row.urlname),articles,actor:previous?.actor||null,profile:profile?(normalizedProfile?profile:profileEvidence(profile,target||row.urlname)):previous?.profile||null,binding:sourceBinding(row)});
 record(result,'取得',assessIdentity(result));
 return result;
}
const finding=(status,check,reason,evidence={})=>({status,check,reason,evidence});
function compare(out,check,expected,actual,evidence={}){
 out.push(!expected||!actual?finding('insufficient',check,'比較する識別情報が不足',evidence):finding(expected===actual?'confirmed':'mismatch',check,expected===actual?'この識別情報は一致':'取得元の識別情報が矛盾',{expected,actual,...evidence}));
}
// Pure inspectors: no mutation, semantic inference, OCR, or DOM traversal.
function assessIdentity(row){
 const out=[],proof=provenance(row),target=proof?.target;
 if(!proof)return[finding('insufficient','取得元','以前の保存分には取得元の照合記録がない'),...assessTagScope(row,proof)];
 compare(out,'対象と記事URL',target,urlIdentity(row.url).account);
 if(!row.profileOnly)compare(out,'記事IDとURL',articleKey(row.key),urlIdentity(row.url).key);
 for(const source of proof.articles||[]){
  compare(out,'対象と投稿者',target,source.account,{source:source.source});
  compare(out,'選択記事と取得記事',articleKey(row.key),articleKey(source.key),{source:source.source});
  if(source.url){compare(out,'投稿者の原URL',target,urlIdentity(source.url).account,{source:source.source});compare(out,'記事の原URL',articleKey(row.key),urlIdentity(source.url).key,{source:source.source})}
 }
 if(proof.profile)compare(out,'対象とプロフィール',target,proof.profile.account,{source:proof.profile.source});
 else out.push(finding('insufficient','プロフィール','投稿者プロフィールの独立したIDが未取得'));
 if(row.profileOnly)out.push(finding('unperformed','記事照合','記事なしの既存経路。記事の一致は判定しない'));
 if(!(proof.articles||[]).length&&!row.profileOnly)out.push(finding('insufficient','記事投稿者','取得記事の投稿者情報が未記録'));
 return[...out,...assessTagScope(row,proof)];
}
const articleKey=value=>/^n[a-f0-9]{12}$/i.test(String(value||''))?String(value).toLowerCase():'';
function tagScopeEvidence(row,proof){
 if(row?.sourceScope?.kind!=='tag')return null;
 const expected=tagName(row.sourceScope.tag),key=articleKey(row.key),bound=articleKey(row.sourceScope.articleKey);
 if(!expected||!key||key!==bound)return{status:'insufficient',expected,key,reason:'選択タグの条件をこの有効な記事IDに結びつける材料が不足'};
 const source=(proof?.articles||[]).filter(item=>item.source==='note-api'&&articleKey(item.key)===key).at(-1),tags=source?.assignedTags;
 if(!tags||!Array.isArray(tags.names)||tags.names.length>50||!tags.names.every(name=>tagName(name)&&tagName(name)===name)||typeof tags.complete!=='boolean')return{status:'insufficient',expected,key,reason:'この記事の詳細APIに有効な割り当てタグ情報がない。タイトル・本文・取得元のタグ名では代用しない'};
 if(tags.names.includes(expected))return{status:'confirmed',expected,key,actual:tags.names,reason:'この同じ記事の詳細APIに選択タグの完全一致がある'};
 if(tags.complete!==true)return{status:'insufficient',expected,key,actual:tags.names,reason:'実際のタグ一覧が不完全、形式不明、または保持上限を超えるため不存在とは判定しない'};
 return{status:'mismatch',expected,key,actual:tags.names,reason:'この同じ記事の詳細APIが返した完全な割り当てタグ一覧に選択タグがない'};
}
function assessTagScope(row,proof){
 const scope=tagScopeEvidence(row,proof);if(!scope)return[];
 return[finding(scope.status,'選択タグと記事タグ',scope.reason,{expected:scope.expected||'',actual:scope.actual||null,articleKey:scope.key||'',source:'note-api-tags'})];
}
function identityOf(row){const url=urlIdentity(row?.url);return{account:account(row?.urlname),key:articleKey(row?.key),urlAccount:url.account||'',urlKey:url.key||''}}
function strictIdentityReasons(row,proof,binding=null){
 const reasons=[],current=identityOf(row),target=account(proof?.target)||current.account;
 const compareId=(code,expected,actual,source)=>{if(expected&&actual&&expected!==actual)reasons.push({code,expected,actual,source})};
 compareId('ROW_ACCOUNT',account(proof?.target),current.account,'selected-target');
 compareId('URL_ACCOUNT',target,current.urlAccount,'article-url');
 if(!row?.profileOnly)compareId('URL_ARTICLE',current.key,current.urlKey,'article-url');
 for(const source of proof?.articles||[]){
  compareId('ARTICLE_ACCOUNT',target,account(source.account),source.source);
  if(!row?.profileOnly)compareId('ARTICLE_KEY',current.key,articleKey(source.key),source.source);
  const url=urlIdentity(source.url);
  compareId('ORIGINAL_URL_ACCOUNT',target,url.account,source.source);
  if(!row?.profileOnly)compareId('ORIGINAL_URL_ARTICLE',current.key,url.key,source.source);
 }
 if(proof?.profile){compareId('PROFILE_ACCOUNT',target,account(proof.profile.account),'creator-api');compareId('PROFILE_REQUEST',target,account(proof.profile.requested),'creator-api')}
 const tagScope=tagScopeEvidence(row,proof);if(tagScope?.status==='mismatch')reasons.push({code:'TAG_SCOPE',expected:tagScope.expected,actual:tagScope.actual.slice(),articleKey:tagScope.key,source:'note-api-tags'});
 const presentation=row?.presentation;
 if(presentation?.status==='available'&&['profile','note-free','note-public-lead'].includes(presentation.source?.kind)){
  const source=presentation.source,url=urlIdentity(source.url);
  compareId('PRESENTATION_ACCOUNT',target,account(source.account),'presentation-'+source.kind);
  compareId('PRESENTATION_URL_ACCOUNT',target,url.account,'presentation-'+source.kind);
  if(['note-free','note-public-lead'].includes(source.kind)&&!row?.profileOnly){compareId('PRESENTATION_ARTICLE',current.key,articleKey(source.key),'presentation-'+source.kind);compareId('PRESENTATION_URL_ARTICLE',current.key,url.key,'presentation-'+source.kind)}
 }
 if(binding){
  compareId('FILE_ACCOUNT',current.account,account(binding.account),'generated-file');
  const url=urlIdentity(binding.url);compareId('FILE_URL_ACCOUNT',current.urlAccount,url.account,'generated-file');
  if(!row?.profileOnly){compareId('FILE_ARTICLE',current.key,articleKey(binding.key),'generated-file');compareId('FILE_URL_ARTICLE',current.urlKey,url.key,'generated-file')}
 }
 return reasons;
}
function preflight(row,{file=null,phase='images'}={}){
 return safe(()=>{
  const source=strictIdentityReasons(row,provenance(row));
  const bound=file?strictIdentityReasons(row,null,files.get(file)?.binding).filter(reason=>reason.code.startsWith('FILE_')):[];
  const reasons=[...source,...bound];
  return reasons.length?{hold:true,kind:source.length?'source':'file',phase,reasons}:null;
 },null);
}
function hasVerifiedFreshIdentity(row){
 return safe(()=>{
  const proof=provenance(row),id=identityOf(row),target=account(proof?.target);
  if(!target||id.account!==target||id.urlAccount!==target||proof?.profile?.account!==target||strictIdentityReasons(row,proof).length)return false;
  if(row?.sourceScope?.kind==='tag'&&tagScopeEvidence(row,proof)?.status!=='confirmed')return false;
  if(row.profileOnly)return !id.key&&!id.urlKey;
  return !!id.key&&id.key===id.urlKey&&(proof?.articles||[]).some(source=>source.source==='note-api'&&account(source.account)===target&&articleKey(source.key)===id.key);
 },false);
}
function hasVerifiedFileIdentity(row,file){
 return safe(()=>{
  const binding=files.get(file)?.binding,id=identityOf(row),url=urlIdentity(binding?.url);
  return !!binding&&!!id.account&&id.urlAccount===id.account&&id.account===account(binding.account)&&id.urlAccount===url.account&&(row.profileOnly?!id.key&&!id.urlKey&&!articleKey(binding.key)&&!url.key:!!id.key&&id.urlKey===id.key&&id.key===articleKey(binding.key)&&id.urlKey===url.key);
 },false);
}
function refreshed(row,{target,note,profile}={}){
 return safe(()=>{
  const clean={...row};delete clean.qualityRef;delete clean.qualitySource;delete clean.qualitySourceIssue;
  return acquired(clean,{target,note,profile});
 },null);
}
function historicalReasons(entry){
 const codes={'対象と記事URL':'URL_ACCOUNT','記事IDとURL':'URL_ARTICLE','対象と投稿者':'ARTICLE_ACCOUNT','選択記事と取得記事':'ARTICLE_KEY','投稿者の原URL':'ORIGINAL_URL_ACCOUNT','記事の原URL':'ORIGINAL_URL_ARTICLE','対象とプロフィール':'PROFILE_ACCOUNT'};
 const reasons=[];
 const add=(code,expected,actual)=>{const valid=code.endsWith('ARTICLE')||code==='ARTICLE_KEY'?articleKey:account;const a=valid(expected),b=valid(actual);if(a&&b&&a!==b)reasons.push({code,expected:a,actual:b,source:'previous-quality-record'})};
 for(const item of entry.findings||[]){
  if(item.status!=='mismatch')continue;
  const {expected,actual}=item.evidence||{};
  if(['選択タグと記事タグ','TAG_SCOPE'].includes(item.check)&&tagName(expected)&&tagName(expected)===expected&&Array.isArray(actual)&&actual.length<=50&&actual.every(name=>tagName(name)&&tagName(name)===name)&&!actual.includes(expected)&&articleKey(item.evidence?.articleKey)&&articleKey(item.evidence.articleKey)===articleKey(entry.key))reasons.push({code:'TAG_SCOPE',expected,actual:actual.slice(),articleKey:articleKey(item.evidence.articleKey),source:'previous-quality-record'});
  if(codes[item.check])add(codes[item.check],expected,actual);
  const field=String(item.check||'').match(/^(?:生成→リンク|生成→貼付画像) \/ (account|key|url)$/)?.[1];
  if(field==='account')add('LEGACY_FILE_ACCOUNT',expected,actual);
  if(field==='key')add('LEGACY_FILE_ARTICLE',expected,actual);
  if(field==='url'){const first=urlIdentity(expected),second=urlIdentity(actual);add('LEGACY_FILE_ACCOUNT',first.account,second.account);add('LEGACY_FILE_ARTICLE',first.key,second.key)}
 }
 return reasons;
}
function loadHistoricalDiagnoses(){
 legacyDiagnoses=new Map();
 for(const entry of state.records){
  if(entry.resolvedAt||entry.batchId!==state.batchId||!account(entry.target))continue;
  const reasons=historicalReasons(entry);if(!reasons.length)continue;
  const key=account(entry.target)+'|'+String(entry.key||'').toLowerCase(),previous=legacyDiagnoses.get(key);
  legacyDiagnoses.set(key,{account:account(entry.target),key:String(entry.key||'').toLowerCase(),runId:state.runId,reasons:[...(previous?.reasons||[]),...reasons]});
 }
}
function knownDiagnosis(row,run){
 try{
  selectScope();if(!legacyDiagnoses.size)return[];
  const previous=legacyDiagnoses.get(account(row?.urlname)+'|'+String(row?.key||'').toLowerCase());
  if(!previous)return[];
  // Match the same persisted run, or the same still-cached contradictory
  // snapshot. A fresh selection of the same person must not inherit a grade.
  if(previous.runId!==run?.createdAt&&(!row?.qualityRef||!strictIdentityReasons(row,provenance(row)).length))return[];
  return previous.reasons;
 }catch{return[]}
}
function resolved(row){
 safe(()=>{
  const target=account(row?.urlname),key=String(row?.key||'').toLowerCase();
  legacyDiagnoses.delete(target+'|'+key);
  for(const entry of state.records)if(entry.target===target&&entry.key===key&&entry.findings.some(item=>item.status==='mismatch'))entry.resolvedAt=Date.now();
  record(row,'再確認',[finding('confirmed','保留理由の再確認','この行の元の識別情報と対応が確認できたため保留を解除。未検査項目は保証しない')]);
 });flush();updateBadge();
}
function assessBinding(row,binding,stage){
 if(!binding)return[finding('insufficient',stage,'生成元の対応記録がない')];
 const current=sourceBinding(row),out=[];
 for(const key of ['account','key','url','nameHash']){
  if(row.profileOnly&&key==='key')continue;
  compare(out,stage+' / '+key,binding[key],current[key]);
 }
 if(binding.profileHash!==null&&binding.profileHash!==undefined)compare(out,stage+' / 紹介原文',binding.profileHash,current.profileHash);
 for(const key of ['icon','thumbnail'])if(binding[key]||current[key])compare(out,stage+' / '+key,binding[key],current[key]);
 return out;
}
function assessAssets(row){
 const proof=provenance(row),out=[],binding=sourceBinding(row);
 for(const [field,label] of [['icon','アイコン取得元'],['thumbnail','記事画像取得元']]){
  const rendered=row?.finalMarker?row.renderAssetStatus?.[field==='icon'?'avatar':'thumbnail']:null;
  if(rendered==='missing'||rendered==='failed'){out.push(finding(rendered==='missing'?'candidate':'insufficient',label,'最後の実績画像の'+(rendered==='missing'?'画像が未設定':'画像を読み込めず代替表示')+'。実画像の表示確認は未実施'));continue}
  const selected=binding[field];
  if(!selected){out.push(finding('unperformed',label,'画像未設定の既存経路。人物認識の判定はしない'));continue}
  const evidence=[...(proof?.articles||[]),...(field==='icon'?[proof?.profile,proof?.actor].filter(Boolean):[])];
  const matched=evidence.find(source=>source.account===proof?.target&&source[field]===selected);
  out.push(matched?finding('confirmed',label,'同じアカウントの取得情報に採用URLがある。絵柄の本人認識ではない',{source:matched.source,url:selected}):finding('insufficient',label,'採用画像のURLは保持。独立した取得元との照合材料が不足'));
 }
 return out;
}
function assessPresentation(row){
 const value=row?.presentation;if(!value)return[];
 if(value.status!=='available')return[finding('candidate','表示本文の取得元','選択した本文を確認できないため未取得として表示。自動補完しない')];
 const source=value.source||{},out=[];
 if(!['profile','note-free','note-public-lead'].includes(source.kind))return[finding('insufficient','表示本文の取得元','独立した取得元の識別情報が不足')];
 compare(out,'表示本文の投稿者',account(row.urlname),account(source.account),{source:source.kind});
 const url=urlIdentity(source.url);if(source.url)compare(out,'表示本文の原URL投稿者',account(row.urlname),url.account,{source:source.kind});
 if(['note-free','note-public-lead'].includes(source.kind)&&!row.profileOnly){compare(out,'表示本文の記事ID',articleKey(row.key),articleKey(source.key),{source:source.kind});if(source.url)compare(out,'表示本文の原URL記事ID',articleKey(row.key),url.key,{source:source.kind})}
 return out;
}
function assessText(value,{lines,manualSource,maxWidth,measure}={}){
 const out=[],source=String(value??'');
 if(lines){
  const expected=source.replace(/\r\n?/g,'\n').replace(/\n/g,''),actual=lines.join('');
  compare(out,'本文の文字保持',fingerprint(expected),fingerprint(actual));
  if(measure&&Number.isFinite(maxWidth))for(const line of lines)if(measure(line)>maxWidth+.01){out.push(finding('candidate','本文の行幅','長い語句などが設定幅を超える候補。貼付先での欠けは未確認'));break}
  const manualBreaks=new Set();let manualOffset=0;
  for(const part of source.replace(/\r\n?/g,'\n').split('\n').slice(0,-1)){manualOffset+=part.length;manualBreaks.add(manualOffset)}
  let offset=0;
  for(let i=0;i+1<lines.length;i++){offset+=lines[i].length;if(!manualBreaks.has(offset)&&/[A-Za-z0-9]$/.test(lines[i])&&/^[A-Za-z0-9]/.test(lines[i+1])){out.push(finding('candidate','単語の境界','元の手動改行以外で英数字の途中が分かれる候補。自動修正しない'));break}}
 }
 if(manualSource!==undefined&&fingerprint(source)!==fingerprint(manualSource))out.push(finding('mismatch','紹介原文','保持していた原文と現在の文字列が異なる'));
 if(/\r|\n/.test(source))out.push(finding('confirmed','手動改行','取得原文の改行を観測。自動修正しない',{count:(source.match(/\r\n|\r|\n/g)||[]).length}));
 out.push(finding('unperformed','本文の表示幅','noteの自然な折り返し・表示上の欠けは検査していない'));
 return out;
}
function assessGeometry(samples,width,height){
 const out=[];
 if(!samples.length)return[finding('unperformed','画像内の文字','描画条件を取得できなかった')];
 for(const sample of samples){
  if(!sample.measured){out.push(finding('insufficient','画像内の文字枠','実際の文字境界を測定できない'));continue}
  if(sample.left<-.5||sample.top<-.5||sample.right>width+.5||sample.bottom>height+.5)out.push(finding('candidate','画像内の文字枠','実描画の文字境界がキャンバス外に達する。字形の欠けを要確認',{bounds:[sample.left,sample.top,sample.right,sample.bottom].map(x=>Math.round(x*100)/100),canvas:[width,height]}));
 }
 if(!out.length)out.push(finding('confirmed','画像内の文字枠','観測できた文字境界はキャンバス内',{draws:samples.length}));
 out.push(finding('unperformed','画像内の重なり','文字同士・装飾との視覚的な重なりは未検査'));
 return out;
}
function scope(){const path=String(page.location?.pathname||location.pathname);if(path!==scopePath){scopePath=path;scopeKey=path.match(/\/notes\/(n[a-z0-9]+)\/edit/i)?.[1]||'unknown'}return scopeKey||'unknown'}
function selectScope(){
 const key=scope();if(state.scope===key)return;
 flush();state.scope=key;state.records=[];state.counts={};state.batchId='';state.batchSerial=0;state.runId=null;state.attention='';sources=new Map();
 try{state.mode=localStorage.getItem(PREF)==='off'?'off':'on';const saved=JSON.parse(localStorage.getItem(PREFIX+key)||'null');if(saved?.version===1&&Array.isArray(saved.records)){state.records=saved.records.slice(-LIMIT);state.counts=saved.counts||{};state.batchId=String(saved.batchId||'');state.batchSerial=Number(saved.batchSerial)||0;state.runId=saved.runId??null;sources=new Map((Array.isArray(saved.sources)?saved.sources:[]).slice(-SOURCE_LIMIT))}}catch{}
 loadHistoricalDiagnoses();
}
function record(row,stage,findings){
 selectScope();if(state.mode==='off'||state.fault)return;
 const record={target:account(row?.urlname),key:String(row?.key||''),index:Number(row?.index)||null,stage,findings,at:Date.now(),batchId:state.batchId};
 state.records.push(record);if(state.records.length>LIMIT)state.records.splice(0,state.records.length-LIMIT);
 for(const f of findings)state.counts[f.status]=(Number(state.counts[f.status])||0)+1;
 state.dirty=true;
 const attention=state.counts.mismatch?'mismatch':state.counts.candidate?'candidate':'';
 if(attention!==state.attention){state.attention=attention;updateBadge()}
}
function flush(){
 if(!state.dirty||!state.scope)return;
 try{
  localStorage.setItem(PREFIX+state.scope,JSON.stringify({version:1,records:state.records,counts:state.counts,sources:[...sources],batchId:state.batchId,batchSerial:state.batchSerial,runId:state.runId}));
  const indexKey=PREFIX+'recent',previous=JSON.parse(localStorage.getItem(indexKey)||'[]');
  const recent=[state.scope,...(Array.isArray(previous)?previous:[]).filter(key=>key!==state.scope&&/^n[a-z0-9]+$/.test(key))];
  for(const key of recent.slice(3))localStorage.removeItem(PREFIX+key);
  localStorage.setItem(indexKey,JSON.stringify(recent.slice(0,3)));state.dirty=false;
 }catch{/* Existing inputs/checkpoints remain independent. */}
}
function failure(reason='検査の例外'){
 if(!state.fault){state.records.push({target:'',key:'',stage:'追加検査',at:Date.now(),batchId:state.batchId,findings:[finding('failed','追加検査',reason+'。追加検査を無効化し、既存処理は維持')]});state.records=state.records.slice(-LIMIT);state.counts.failed=(Number(state.counts.failed)||0)+1;state.dirty=true}
 state.fault=true;updateBadge();
}
function safe(fn,fallback){
 try{
  selectScope();if(state.mode==='off'||state.fault)return fallback;
  const start=Date.now(),result=fn();
  // A synchronous observer has no outstanding request to wait on. Stop future
  // observations if a call exceeds the time budget; never wait/retry it.
  if(Date.now()-start>30)failure('1回の追加検査が30msを超過');
  return result;
 }catch{failure();return fallback}
}
function observeContext(ctx,row,width,height){
 return safe(()=>{
  const samples=[];renderings.set(row,{samples,width,height,binding:sourceBinding(row)});
  // Only fillText is observed. Delegate the exact original call and arguments.
  const original=ctx.fillText;
  ctx.fillText=function(...args){
   const result=Reflect.apply(original,this,args);
   safe(()=>{
    const [value,x,y,maxWidth]=args,metrics=this.measureText(String(value));
    const measured=['actualBoundingBoxLeft','actualBoundingBoxRight','actualBoundingBoxAscent','actualBoundingBoxDescent'].every(k=>Number.isFinite(metrics[k]));
    const transform=this.getTransform?.(),identity=!transform||transform.a===1&&transform.b===0&&transform.c===0&&transform.d===1&&transform.e===0&&transform.f===0;
    samples.push({textHash:fingerprint(value),measured:measured&&identity&&maxWidth===undefined,left:x-metrics.actualBoundingBoxLeft,right:x+metrics.actualBoundingBoxRight,top:y-metrics.actualBoundingBoxAscent,bottom:y+metrics.actualBoundingBoxDescent});
   });return result;
  };
  return ctx;
 },ctx);
}
function generated(row,file){
 return safe(()=>{
  state.runId=page.__MUMEI_PROFILE_CARD_RUN_STORE__?.read?.()?.createdAt??state.runId;
  const drawing=renderings.get(row);if(drawing)files.set(file,drawing);
  const out=[...assessIdentity(row),...assessBinding(row,provenance(row)?.binding,'取得→生成'),...assessAssets(row),...assessPresentation(row)];
  out.push(...(drawing?assessGeometry(drawing.samples,drawing.width,drawing.height):[finding('unperformed','画像内の文字','描画記録なし')]));
  const nameHash=fingerprint(String(row.creator||'')+'さん'),exactName=drawing?.samples.some(sample=>sample.textHash===nameHash);
  out.push(finding(exactName?'confirmed':drawing?'candidate':'unperformed','キャプチャ内の名前',exactName?'実際のfillTextに完全名＋敬称を渡した記録がある。OCRは未実施':'既存の省略表示などにより、描画文字と完全名の一致は未確認。名前を追加・修正しない'));
  out.push(finding('unperformed','絵柄からの人物認識','画像の取得元を追跡するだけで、絵柄の本人認識はしない'));
  record(row,'画像生成',out);return file;
 },file);
}
function beforePaste(row,file){
 safe(()=>{const draw=files.get(file);record(row,'貼付前',[...assessIdentity(row),...assessBinding(row,draw?.binding,'生成→リンク'),...assessBinding(row,provenance(row)?.binding,'取得→貼付')])});
}
function pasted(row,file,result){
 safe(()=>{
  const draw=files.get(file),node=result?.hit?.node;
  const out=assessBinding(row,draw?.binding,'生成→貼付画像');
  compare(out,'実画像リンク',draw?.binding?.url,cleanUrl(node?.attrs?.link));
  compare(out,'実キャプション',fingerprint(String(row.creator||'')+'さん'),fingerprint(node?.textContent));
  out.push(finding('confirmed','紹介の範囲','この挿入結果だけを確認。区切りの隣の文章は別の人でも正常',{position:result?.hit?.pos}));
  record(row,'貼付後',out);
 });
}
function activity(row,result,actual,layout){
 safe(()=>{
  const out=assessBinding(row,provenance(row)?.binding,'紹介原文');
  if(typeof result?.text==='string'&&typeof actual==='string')compare(out,'挿入した紹介',fingerprint(result.text),fingerprint(actual));
  else out.push(finding('insufficient','挿入した紹介','この挿入結果の文字列を取得できないため一致を判定しない'));
  out.push(...(layouts.get(row)?.findings||assessText(row.profileText)));
  record(row,'本文',out);
 });
}
function measuredRect(node){
 try{const rect=node?.getBoundingClientRect?.(),keys=['left','right','top','bottom','width','height'];return rect&&keys.every(key=>Number.isFinite(rect[key]))&&rect.width>0&&rect.height>0?Object.fromEntries(keys.map(key=>[key,rect[key]])):null}catch{return null}
}
function computedStyle(node){try{return node?.ownerDocument?.defaultView?.getComputedStyle?.(node)||null}catch{return null}}
const rectEvidence=rect=>rect?['left','top','right','bottom'].map(key=>Math.round(rect[key]*10)/10):null;
const formulaSource=text=>String(text||'').trim().replace(/^\$\$/,'').replace(/\$\$$/,'').trim();
function inspectPresentationDOM(row,view,entry,imageHit=null){
 const out=[],unperformed=(check,reason,evidence={})=>out.push(finding('unperformed',check,reason,evidence));
 const pos=entry?.pos,text=entry?.text;
 if(!Number.isFinite(pos)||typeof text!=='string'||!text){unperformed('紹介の実表示','所有している紹介段落の位置・元文字列を取得できない');return out}
 const run=page.__MUMEI_PROFILE_CARD_RUN_STORE__?.read?.(),ownedKey=cleanUrl(row?.url),ownedPos=run?.presentationPositions?.[ownedKey];
 if(!run||run.articleKey!==scope()||!ownedKey||run.presentationTexts?.[ownedKey]!==text||Number.isFinite(ownedPos)&&ownedPos!==pos){out.push(finding('insufficient','紹介の所有範囲','この紹介の元文字列・位置を今回分の所有記録で確認できないため実表示を推測しない'));return out}
 const node=view?.state?.doc?.nodeAt?.(pos);
 if(node?.type?.name!=='paragraph'||node.textContent!==text){out.push(finding('insufficient','紹介の実表示','記録した位置の段落が元文字列と一致しないため表示範囲を推測しない'));return out}
 const content=page.__MUMEI_PROFILE_CARD_CONTENT__,layout=entry.layout||run.presentationLayouts?.[ownedKey]||null;
 let signature=null;
 try{if(typeof content?.matchesAboveText==='function')signature=content.matchesAboveText(row,text,layout);else if(typeof content?.aboveText==='function')signature=content.aboveText(row,layout?.bodyWidthPx)===text}catch{}
 out.push(finding(signature===true?'confirmed':signature===false?'candidate':'unperformed','紹介式の対応',signature===true?'この所有段落の数式文字列とレイアウト仕様が対応。実際の表示幅とは別の検査':signature===false?'この所有段落の式が現在のレイアウト仕様と異なる候補':'数式文字列のレイアウト仕様との対応は未検査',{sourceHash:fingerprint(text),layoutVersion:layout?.version||null,font:layout?.font||null,cellBudget:layout?.cellBudget??null,lineCount:layout?.lineCount??null}));
 if(signature===true&&layout?.version>=2&&Number.isFinite(layout.cellBudget)&&Number.isFinite(layout.lineCount))out.push(finding(layout.wordSplitCandidate||layout.kinsokuCandidate?'candidate':'confirmed','紹介式の折り返し',layout.wordSplitCandidate?'式の行境界で英数字の語が分かれる候補。自動補正しない':layout.kinsokuCandidate?'式の行境界に句読点などが来る候補。自動補正しない':'元の数式に対応する行数・折り返し指定を確認。実際の画面幅の保証ではない',{cellBudget:layout.cellBudget,lineCount:layout.lineCount}));
 else unperformed('紹介式の折り返し','この保存式の行数・折り返し仕様との対応は未検査');
 unperformed('公開後の表示','ここで測定するのは現在の編集DOMだけ。公開記事・別の画面幅での表示は未実測');
 if(layout?.truncated)out.push(finding('candidate','紹介文の省略','この紹介式は行数の上限に合わせた抜粋。省略表示の採用を記録',{lineCount:layout.lineCount??null}));
 let dom=null;try{dom=view?.nodeDOM?.(pos)}catch{}
 if(!dom||dom.nodeType!==1||dom.isConnected!==true||typeof view?.dom?.contains!=='function'||!view.dom.contains(dom)){unperformed('紹介の実表示','この所有段落の現在のDOMを取得できない。表示を待ったり合格扱いにしたりしない');return out}
 const paragraphRect=measuredRect(dom),paragraphStyle=computedStyle(dom);
 if(!paragraphRect||paragraphStyle?.display==='none'||paragraphStyle?.visibility==='hidden'){unperformed('紹介の実表示','この所有段落は非表示、または実際の大きさを測定できない');return out}
 const boxes=dom.querySelectorAll?.('.katex');
 if(!boxes||boxes.length!==1){unperformed('紹介の実表示',boxes?.length?'この所有段落の数式表示を一つに特定できない':'この所有段落のKaTeX表示は現在まだ取得できない。元の式だけで表示成功とは判定しない');return out}
 const box=boxes[0],html=box.querySelector?.('.katex-html'),boxRect=measuredRect(html)||measuredRect(box);
 if(!html||!boxRect){unperformed('紹介の実表示','可視KaTeX部分の実寸を取得できない');return out}
 const annotation=box.querySelector?.('annotation[encoding="application/x-tex"]'),annotationText=annotation?.textContent,domSignature=typeof annotationText==='string'&&annotationText.length?formulaSource(annotationText)===formulaSource(text):null;
 out.push(finding(domSignature===true?'confirmed':domSignature===false?'candidate':'unperformed','紹介DOMの対応',domSignature===true?'現在のKaTeX DOM内の式がこの所有段落の式と対応':domSignature===false?'現在のKaTeX DOM内の式がこの所有段落と異なる候補。表示更新待ちの可能性もある':'DOM内の元の式を取得できないため、現在の表示との対応は未確認'));
 let imageDOM=null;try{if(imageHit&&Number.isFinite(imageHit.pos))imageDOM=view.nodeDOM?.(imageHit.pos)}catch{}
 const imageCurrent=imageHit&&view?.state?.doc?.nodeAt?.(imageHit.pos);
 const imageLink=cleanUrl(row.url),imageOwned=Boolean(imageLink&&imageDOM?.nodeType===1&&imageDOM.isConnected===true&&view.dom.contains(imageDOM)&&imageCurrent?.type?.name==='image'&&cleanUrl(imageCurrent.attrs?.link)===imageLink);
 const imageRect=imageOwned?(measuredRect(imageDOM.querySelector?.('img'))||measuredRect(imageDOM)):null;
 const leaves=Array.from(html.querySelectorAll?.('.mord, .text')||[]).filter(item=>item.children.length===0&&String(item.textContent||'').trim()),limit=128,selected=leaves.slice(0,limit),leafRects=selected.map(measuredRect),fonts=selected.map(item=>Number.parseFloat(computedStyle(item)?.fontSize));
 const complete=leaves.length>0&&leaves.length<=limit&&leafRects.every(Boolean),fontComplete=complete&&fonts.every(Number.isFinite),rects=[boxRect,...leafRects.filter(Boolean)];
 const bounds={left:Math.min(...rects.map(rect=>rect.left)),right:Math.max(...rects.map(rect=>rect.right)),top:Math.min(...rects.map(rect=>rect.top)),bottom:Math.max(...rects.map(rect=>rect.bottom))};bounds.width=bounds.right-bounds.left;bounds.height=bounds.bottom-bounds.top;
 const evidence={bounds:rectEvidence(bounds),paragraph:rectEvidence(paragraphRect),image:rectEvidence(imageRect),measuredLeaves:leafRects.filter(Boolean).length,totalLeaves:leaves.length};
 const reference=imageRect||paragraphRect,overflow=bounds.left<reference.left-1||bounds.right>reference.right+1;
 if(overflow)out.push(finding('candidate','紹介の表示幅','実測した文字または数式枠が、この画像または所有段落の横幅を超える候補',evidence));
 else if(imageRect&&complete&&signature===true&&domSignature===true)out.push(finding('confirmed','紹介の表示幅','現在の実測範囲では文字と数式枠がこの画像の幅内',evidence));
 else unperformed('紹介の表示幅','画像の実幅・全ての文字境界・表示の対応のいずれかが未確認。元の改行指定だけで幅内とは判定しない',evidence);
 const maxHeight=Number(layout?.maxHeightPx),maxFont=Number(layout?.maxFontPx),fontValues=fonts.filter(Number.isFinite),observedFont=fontValues.length?Math.max(...fontValues):null;
 if(Number.isFinite(maxHeight)&&maxHeight>0&&bounds.height>maxHeight+1)out.push(finding('candidate','紹介の表示高さ','現在の実測文字・枠の高さが、この紹介の高さ上限を超える候補',{height:Math.round(bounds.height*10)/10,maxHeight}));
 else if(Number.isFinite(maxHeight)&&maxHeight>0&&complete&&signature===true&&domSignature===true)out.push(finding('confirmed','紹介の表示高さ','現在の実測文字・枠の高さは、この紹介の高さ上限内',{height:Math.round(bounds.height*10)/10,maxHeight}));
 else unperformed('紹介の表示高さ','紹介の高さ上限または全ての文字境界との対応は未確認');
 if(observedFont!==null&&Number.isFinite(maxFont)&&maxFont>0&&observedFont>maxFont+.1)out.push(finding('candidate','紹介の実文字サイズ','実際のKaTeX文字サイズが、この紹介の上限を超える候補',{fontPx:Math.round(observedFont*10)/10,maxFontPx:maxFont}));
 else if(fontComplete&&Number.isFinite(maxFont)&&maxFont>0&&signature===true&&domSignature===true)out.push(finding('confirmed','紹介の実文字サイズ','測定できた全ての可視文字サイズが、この紹介の上限内',{fontPx:Math.round(observedFont*10)/10,maxFontPx:maxFont}));
 else unperformed('紹介の実文字サイズ','全ての可視文字の実サイズまたは仕様上限は未確認',{fontPx:observedFont===null?null:Math.round(observedFont*10)/10,maxFontPx:Number.isFinite(maxFont)&&maxFont>0?maxFont:null});
 let ancestor=box;for(let depth=0;ancestor&&depth<12;depth++,ancestor=ancestor.parentElement){
  const style=computedStyle(ancestor),rect=measuredRect(ancestor),width=Number(ancestor.clientWidth),scroll=Number(ancestor.scrollWidth),clipped=style&&/(?:hidden|clip|auto|scroll)/.test(String(style.overflowX||style.overflow||''));
  if(rect&&clipped&&(bounds.left<rect.left-1||bounds.right>rect.right+1||width>0&&Number.isFinite(scroll)&&scroll>width+1)){out.push(finding('candidate','紹介の横方向の欠け','この所有段落から編集欄までの実際の表示枠に横方向の切り詰め・スクロールの候補',{ancestor:ancestor.tagName||'',bounds:rectEvidence(bounds),clip:rectEvidence(rect),clientWidth:width||null,scrollWidth:Number.isFinite(scroll)?scroll:null}));break}
  if(ancestor===view.dom)break;
 }
 return out;
}
function presentationAt(row,view,result){safe(()=>{if(typeof result?.text!=='string'||!Number.isFinite(result?.pos))return;presentationNodes.set(row,{view,pos:result.pos,text:result.text,layout:result.layout||null});record(row,'紹介表示（挿入直後）',inspectPresentationDOM(row,view,result))})}
function presentationPasted(row,view,hit){safe(()=>{const entry=presentationNodes.get(row);if(entry&&entry.view===view)record(row,'紹介表示（画像直後）',inspectPresentationDOM(row,view,entry,hit))})}
function imageBoundary(row,view,hit,{dividerRequired=false,isDivider:predicate=null}={}){safe(()=>{
 const entry=presentationNodes.get(row);if(entry&&entry.view===view)record(row,'紹介表示（区切り直後）',inspectPresentationDOM(row,view,entry,hit));
 if(!dividerRequired)return;
 const current=Number.isFinite(hit?.pos)?view?.state?.doc?.nodeAt?.(hit.pos):null;
 if(!current||current.type?.name!=='image'||!cleanUrl(row?.url)||cleanUrl(current.attrs?.link)!==cleanUrl(row?.url)){record(row,'区切り',[finding('insufficient','直後の区切り','この画像の現在の位置・リンクを確認できないため隣接ノードを推測しない')]);return}
 const next=view.state.doc.nodeAt(hit.pos+current.nodeSize);let isDivider=typeof predicate==='function'?Boolean(predicate(next)):['horizontal_rule','horizontalRule','horizontal-rule','divider','separator','hr'].includes(next?.type?.name);
 if(typeof predicate!=='function'&&!isDivider&&next?.type?.spec?.toDOM)try{const dom=next.type.spec.toDOM(next);isDivider=Array.isArray(dom)&&dom[0]==='hr'}catch{}
 record(row,'区切り',[finding(isDivider?'confirmed':'mismatch','直後の区切り',isDivider?'この画像の直後のnative区切りを確認':'区切りが必要なこの画像の直後にnative区切りがない')]);
 })}
function divider(row,node,isDivider){safe(()=>record(row,'区切り',[finding(isDivider(node)?'confirmed':'mismatch','直後の区切り',isDivider(node)?'この画像直後の区切りを確認':'この画像直後に区切りがない')]))}
function externalBoundary(row,view,hit,options={}){
 imageBoundary(row,view,hit,{...options,dividerRequired:true});
 safe(()=>record(row,'区切りの所有',[finding('insufficient','既存区切りの所有','区切りの存在と所有記録は別です。この既存の線の所有・属性の由来は未確認のまま保持し、一括削除の対象にしません',{imageId:String(hit?.node?.attrs?.id||''),url:cleanUrl(row?.url),ownership:'unconfirmed',deleteEligible:false})]));
}
function nativeCard(row,result){safe(()=>{const identity=urlIdentity(result?.hit?.node?.attrs?.src);const out=assessIdentity(row);compare(out,'通知カードの記事ID',row.key,identity.key);compare(out,'通知カードの投稿者',account(row.urlname),identity.account);record(row,'通知カード',out)})}
function saved(result,error){safe(()=>{state.runId=page.__MUMEI_PROFILE_CARD_RUN_STORE__?.read?.()?.createdAt??state.runId;record(null,'下書き保存',[finding(error?'failed':result===true||result?.confirmed===true?'confirmed':'insufficient','保存結果',error?'既存保存処理が失敗。完了と判定しない':result===true||result?.confirmed===true?'既存処理の肯定的な保存結果を確認':'保存要求済みだが成功未確認')])});flush()}
function updateBadge(){
  try{const button=document.querySelector?.('[data-quality-badge]');if(button){const held=page.__MUMEI_PROFILE_CARD_RUN_STORE__?.read?.()?.qualityHold,unresolved=state.records.some(entry=>!entry.resolvedAt&&entry.batchId===state.batchId&&entry.findings.some(item=>item.status==='mismatch'));button.textContent=held?'検査保留':state.fault?'検査×':state.mode==='off'?'検査OFF':unresolved?'検査相違':state.counts.candidate?'検査候補':'品質検査';button.title='品質検査：'+(held?'明確な不一致を保留。再開時にこの一件を再確認':state.fault?'検査失敗。追加検査を無効化':state.mode==='off'?'追加検査は無効。既知の保留は維持':'識別情報・実タグ条件の明確な矛盾だけ保留。候補・材料不足は停止しない')}}catch{}
}
const labels={confirmed:'確認済み（その検査の範囲）',candidate:'確認候補',mismatch:'明確な不一致',insufficient:'照合材料不足',failed:'検査失敗',unperformed:'未実施'};
function mountUI(){
 try{
  selectScope();
  const panel=document.getElementById('mumei-profile-card-paster-v1'),head=panel?.querySelector('.head');if(!head||head.querySelector('[data-quality-badge]'))return;
  const style=document.createElement('style');style.textContent='#mumei-profile-card-paster-v1 .head{grid-template-columns:minmax(0,1fr) auto 20px 20px}#mumei-profile-card-paster-v1 [data-quality-badge]{font-size:6px;padding:1px 2px;white-space:nowrap}#mumei-profile-card-paster-v1 [data-quality-detail]{position:absolute;left:0;right:0;top:26px;z-index:10;max-height:min(38vh,260px);overflow:auto;padding:6px;background:#07131d;border:1px solid #365b70;font:9px/1.4 system-ui;color:#edf8ff}#mumei-profile-card-paster-v1 [data-quality-detail][hidden]{display:none}';panel.append(style);
  const button=document.createElement('button');button.type='button';button.dataset.qualityBadge='1';button.setAttribute('aria-expanded','false');head.insertBefore(button,head.children[1]);
  const detail=document.createElement('div');detail.dataset.qualityDetail='1';detail.hidden=true;panel.append(detail);
  for(const type of ['mousedown','pointerdown','touchstart'])button.addEventListener(type,event=>{event.stopPropagation();if(type==='mousedown')event.preventDefault()});
  let repairPreview=null,repairBusy=false,repairMessage='';
  const render=()=>{
   detail.replaceChildren();const intro=document.createElement('p');intro.textContent='毎回の対象を検査。明確な識別情報または実際のタグ条件の矛盾だけ保留します。候補・材料不足では止めません。以前の検査はnote側の実際の表示幅・文字サイズを測定していませんでした。現在の表示を取得できる場合だけ実測し、取得できない場合は未実施と記録します。';detail.append(intro);
   const hold=page.__MUMEI_PROFILE_CARD_RUN_STORE__?.read?.()?.qualityHold;
   if(hold){const notice=document.createElement('p');notice.textContent='保留：'+(hold.identity?.account||'対象')+'。元の「再開」でこの一件だけ再確認します。既知の保留は検査OFFでも解除しません。'+(hold.reasons||[]).map(reason=>reason.code+': '+reason.expected+' / '+reason.actual).join('、');detail.append(notice)}
   const toggle=document.createElement('button');toggle.type='button';toggle.textContent=state.mode==='off'?'追加検査を有効にする':'追加検査を無効化';toggle.onclick=()=>{state.mode=state.mode==='off'?'on':'off';state.fault=false;try{localStorage.setItem(PREF,state.mode)}catch{}updateBadge();render()};detail.append(toggle);
   const repair=page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__;
   if(typeof repair?.preview==='function'&&typeof repair?.apply==='function'){
    const previewButton=document.createElement('button');previewButton.type='button';previewButton.textContent='今回分の表示を整える';previewButton.disabled=repairBusy;
    previewButton.onclick=async()=>{if(repairBusy)return;repairBusy=true;repairPreview=null;repairMessage='今回分の所有記録を確認中…';render();try{repairPreview=await repair.preview();repairMessage=String(repairPreview?.message||'変更候補を確認しました')}catch(error){repairMessage='修正候補を確認できません：'+String(error?.message||error)}finally{repairBusy=false;render()}};detail.append(previewButton);
    if(repairMessage){const message=document.createElement('p');message.textContent=repairMessage;detail.append(message)}
    if(repairPreview){
     const count=Number(repairPreview.changeCount)||0,counts=document.createElement('p');counts.textContent='変更候補 '+count+'件｜紹介 '+(Number(repairPreview.paragraphs)||0)+'件｜区切り '+(Number(repairPreview.dividers)||0)+'件';detail.append(counts);
     for(const sample of (Array.isArray(repairPreview.samples)?repairPreview.samples:[]).slice(0,3)){const line=document.createElement('p');line.style.whiteSpace='pre-wrap';line.textContent=(sample.name?String(sample.name)+'：':'')+String(sample.before??sample.beforeText??'').slice(0,200)+' → '+String(sample.after??sample.afterText??'').slice(0,200)+(sample.reason?'｜'+String(sample.reason).slice(0,200):'');detail.append(line)}
     if(Array.isArray(repairPreview.reasons)&&repairPreview.reasons.length){const reasons=document.createElement('p');reasons.textContent=repairPreview.reasons.slice(0,3).map(reason=>String(reason).slice(0,200)).join(' / ');detail.append(reasons)}
     if(count>0&&repairPreview.token){const applyButton=document.createElement('button');applyButton.type='button';applyButton.textContent='この修正を適用';applyButton.disabled=repairBusy;applyButton.onclick=async()=>{if(repairBusy||!repairPreview?.token)return;const token=repairPreview.token;repairPreview=null;repairBusy=true;repairMessage='選択した修正を適用中…';render();try{const result=await repair.apply(token);repairMessage=String(result?.message||(result?.applied?'選択した修正を適用しました':'修正は適用されていません'))+(result?.applied?(result.saved==='confirmed'?'｜下書き保存を確認済み':'｜下書き保存は未確認。note画面で保存完了を確認してください。')+'表示の実測結果は取得できた範囲だけ記録します。':'')}catch(error){repairMessage='修正を適用できません：'+String(error?.message||error)}finally{repairBusy=false;updateBadge();render()}};detail.append(applyButton)}
    }
   }
   const summary=document.createElement('p');summary.textContent='今回の作成分の検査回数：'+Object.entries(labels).map(([key,label])=>label+' '+(state.counts[key]||0)).join(' / ')+'。根拠は直近'+LIMIT+'記録まで。';detail.append(summary);
   for(const entry of [...state.records].filter(entry=>(entry.batchId||'')===state.batchId).reverse().slice(0,30)){const line=document.createElement('details'),title=document.createElement('summary');title.textContent=(entry.resolvedAt?'［解決済みの記録］':'')+(entry.target||'今回分')+' / '+entry.stage;line.append(title);for(const f of entry.findings){const text=document.createElement('p');text.textContent=labels[f.status]+'：'+f.check+' — '+f.reason+(Object.keys(f.evidence||{}).length?' '+JSON.stringify(f.evidence):'');line.append(text)}detail.append(line)}
  };
  button.onclick=event=>{event.stopPropagation();detail.hidden=!detail.hidden;button.setAttribute('aria-expanded',String(!detail.hidden));if(!detail.hidden){flush();render()}};updateBadge();
 }catch{failure('検査表示の初期化失敗')}
}
const api={VERSION,beginBatch,preflight,knownDiagnosis,knownDiagnoses:run=>{try{selectScope();return legacyDiagnoses.size&&Array.isArray(run?.rows)?run.rows.flatMap(row=>{const reasons=knownDiagnosis(row,run);return reasons.length?[{identity:{account:account(row.urlname),key:String(row.key||'').toLowerCase(),url:String(row.url||'')},reasons}]:[]}):[]}catch{return[]}},resolved,enabled:()=>safe(()=>true,false),refreshed,hasVerifiedFreshIdentity,hasVerifiedFileIdentity,rawRow:(...args)=>safe(()=>rawRow(...args),args[0]),acquired:(...args)=>safe(()=>acquired(...args),args[0]),profileEvidence,observeContext,generated,beforePaste,pasted,activity,presentationAt,presentationPasted,imageBoundary,externalBoundary,divider,nativeCard,saved,flush,mountUI,failed:()=>failure(),held:hold=>{safe(()=>{state.runId=hold.runId??state.runId;record({urlname:hold.identity?.account,key:hold.identity?.key,index:hold.index+1},'保留',(hold.reasons||[]).map(reason=>finding('mismatch',reason.code,reason.code==='TAG_SCOPE'?'貼付前に記事の実タグ条件の矛盾を保留':'貼付前に明確な識別情報の矛盾を保留',reason)))});flush();updateBadge()},
 layout:(row,layout,text,measure)=>safe(()=>{const cached=layouts.get(row);if(cached&&cached.text===text&&cached.maxWidth===layout.maxWidth&&cached.lines.length===layout.lines.length&&cached.lines.every((line,index)=>line===layout.lines[index]))return;layouts.set(row,{text,lines:layout.lines.slice(),maxWidth:layout.maxWidth,findings:assessText(text,{lines:layout.lines,maxWidth:layout.maxWidth,measure})})}),
 // Pure functions are also used by the anonymous regression fixtures.
 assessIdentity,assessBinding,assessText,assessGeometry,fingerprint,sourceBinding,provenance:row=>{const proof=provenance(row);return proof?JSON.parse(JSON.stringify(proof)):null},
 snapshot:()=>({mode:state.mode,fault:state.fault,batchId:state.batchId,runId:state.runId,records:JSON.parse(JSON.stringify(state.records)),counts:{...state.counts}})};
page.__MUMEI_PROFILE_CARD_QUALITY__=api;
page.addEventListener?.('mumei-profile-card-panel-ready',mountUI);
page.addEventListener?.('pagehide',flush);
page.addEventListener?.('mumei-profile-card-stop',flush);
})(typeof owner!=='undefined'?owner:typeof unsafeWindow!=='undefined'?unsafeWindow:window);
