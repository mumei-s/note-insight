(() => {
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(page.__MUMEI_PON_V28_CORE__)return;page.__MUMEI_PON_V28_CORE__=true;
['__MUMEI_PON_V15_ADDON__','__MUMEI_PON_V16_ADDON__','__MUMEI_PON_V171_ADDON__','__MUMEI_PON_V172_ADDON__','__MUMEI_PON_V173_ADDON__','__MUMEI_PON_V18__','__MUMEI_PON_V181__','__MUMEI_PON_V19__','__MUMEI_PON_V20__','__MUMEI_PON_V21__','__MUMEI_PON_V22__','__MUMEI_PON_V23_CORE__','__MUMEI_PON_V24_CORE__','__MUMEI_PON_V25_CORE__','__MUMEI_PON_V26_CORE__','__MUMEI_PON_V27_CORE__'].forEach(k=>page[k]=true);

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let busy=false,viewCache=null,selectionCache=null,noteUrlCommand=null;
const normalize=value=>{try{const u=new URL(String(value||'').trim(),location.href);u.search='';u.hash='';return u.href}catch{return String(value||'').trim()}};
const isMag=u=>/^https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+$/i.test(String(u||''));
const isArt=u=>/^https:\/\/note\.com\/[^/]+\/n\/n[a-z0-9]+$/i.test(String(u||''));
const isNote=u=>isMag(u)||isArt(u);

function editor(){return document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror')}
function looksLikeView(v){try{return!!(v&&typeof v==='object'&&v.state?.doc&&v.state?.schema&&typeof v.dispatch==='function'&&v.dom&&typeof v.posAtDOM==='function')}catch{return false}}
function findView(){if(looksLikeView(viewCache)&&viewCache.dom?.isConnected)return viewCache;const root=editor();if(!root)return null;const seen=new Set(),queue=[];let seed=root;for(let i=0;i<6&&seed;i++,seed=seed.parentElement)queue.push([seed,0]);let steps=0;while(queue.length&&steps++<14000){const[v,d]=queue.shift();if(!v||seen.has(v))continue;seen.add(v);if(looksLikeView(v))return(viewCache=v);let keys=[];try{keys=Object.getOwnPropertyNames(v)}catch{continue}for(const k of keys){if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k))continue;let x;try{x=v[k]}catch{continue}if(looksLikeView(x))return(viewCache=x);if(d<7&&x&&(typeof x==='object'||typeof x==='function')&&x!==page&&x!==document)queue.push([x,d+1])}}return null}
function webpackRequire(){const chunks=page.webpackChunk_N_E;if(!chunks||typeof chunks.push!=='function')return null;let req=null;try{chunks.push([[996000000+Math.floor(Math.random()*3000000)],{},r=>{req=r}])}catch{}return req}
function selectionApi(){if(selectionCache)return selectionCache;const req=webpackRequire();if(!req)throw new Error('note内部Selectionを取得できません');let mod;try{mod=req(44044)}catch{}const Selection=mod?.Y1;if(typeof Selection?.near!=='function')throw new Error('note Selectionが見つかりません');return(selectionCache=Selection)}
function noteUrlCommandFactory(){if(typeof noteUrlCommand==='function')return noteUrlCommand;const req=webpackRequire();if(!req)throw new Error('note内部URL処理を取得できません');let mod;try{mod=req(94928)}catch{}let candidate=typeof mod?.fjT==='function'?mod.fjT:null;const looksRight=value=>{if(typeof value!=='function')return false;let s='';try{s=Function.prototype.toString.call(value)}catch{}return s.includes('state.selection')&&s.includes('nodeBefore')&&s.includes('replaceRangeWith')&&s.includes('.then')};if(!looksRight(candidate)){const loaded=Object.values(req.c||{}).flatMap(e=>{const ex=e?.exports;if(typeof ex==='function')return[ex];return ex&&typeof ex==='object'?Object.values(ex):[]});candidate=loaded.find(looksRight)||null}if(!looksRight(candidate))throw new Error('note正規URLコマンドが見つかりません');return(noteUrlCommand=candidate)}

function rawRows(view,url=null){const wanted=url?normalize(url):null,out=[];view.state.doc.descendants((node,pos)=>{if(!node.isTextblock)return;const raw=(node.textContent||'').trim();if(!/^https:\/\/note\.com\/[^\s]+$/i.test(raw))return;const value=normalize(raw);if(!isNote(value))return;if(!wanted||value===wanted)out.push({node,pos,url:value})});return out.sort((a,b)=>a.pos-b.pos)}
function embedNodes(view){const out=[];view.state.doc.descendants((node,pos)=>{if(node.type?.name==='embed')out.push({node,pos})});return out}
function cardKey(hit){return String(hit?.node?.attrs?.embeddedContentKey||'')}
function cardUrl(hit){return normalize(hit?.node?.attrs?.src)}
function genuineCard(hit,url){const key=cardKey(hit),html=String(hit?.node?.attrs?.htmlForEmbed||'');return cardUrl(hit)===normalize(url)&&/^emb[a-z0-9]+$/i.test(key)&&html.includes('note-embed')}
function deleteHits(view,hits){if(!hits?.length)return 0;let tr=view.state.tr;[...hits].sort((a,b)=>b.pos-a.pos).forEach(h=>{tr=tr.delete(h.pos,h.pos+h.node.nodeSize)});view.dispatch(tr);view.focus();return hits.length}
function deleteDuplicateRaw(view){const groups=new Map();for(const h of rawRows(view)){if(!groups.has(h.url))groups.set(h.url,[]);groups.get(h.url).push(h)}const del=[];for(const hs of groups.values())del.push(...hs.slice(1));return deleteHits(view,del)}
function findRaw(view,url){return rawRows(view,url)[0]||null}

function addTemporaryBlankAfter(view,hit){
  const paragraph=view.state.schema.nodes.paragraph;if(!paragraph)throw new Error('paragraphなし');
  const after=hit.pos+hit.node.nodeSize;
  const next=view.state.doc.nodeAt(after);
  if(next?.type===paragraph&&next.textContent==='')return{pos:after,inserted:false};
  view.dispatch(view.state.tr.insert(after,paragraph.create()));
  return{pos:after,inserted:true};
}
function setSelectionInBlank(view,blankPos){
  const Selection=selectionApi();
  const max=view.state.doc.content.size;
  const inside=Math.max(1,Math.min(max,blankPos+1));
  const sel=Selection.near(view.state.doc.resolve(inside),1);
  view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
  view.focus();
}
function removeTemporaryBlank(view,blankPos){
  const node=view.state.doc.nodeAt(blankPos);
  if(node?.isTextblock&&node.textContent===''&&node.type?.name==='paragraph'){
    try{view.dispatch(view.state.tr.delete(blankPos,blankPos+node.nodeSize))}catch{}
  }
}
async function waitForCardNear(view,url,beforeKeys,originalPos,timeout=45000){const deadline=Date.now()+timeout;while(Date.now()<deadline){const hits=embedNodes(view).filter(h=>{const key=cardKey(h);return key&&!beforeKeys.has(key)&&genuineCard(h,url)}).sort((a,b)=>Math.abs(a.pos-originalPos)-Math.abs(b.pos-originalPos));if(hits[0])return hits[0];await sleep(250)}return null}

async function cardifyOne(view,url){
  const hit=findRaw(view,url);if(!hit)return true;
  const originalPos=hit.pos;
  const beforeKeys=new Set(embedNodes(view).map(cardKey).filter(Boolean));
  const blank=addTemporaryBlankAfter(view,hit);
  setSelectionInBlank(view,blank.pos);
  let handled=false;
  try{
    const command=noteUrlCommandFactory()(url);
    handled=command(view.state,tr=>view.dispatch(tr),view);
  }catch(e){if(blank.inserted)removeTemporaryBlank(view,blank.pos);throw e}
  if(!handled){if(blank.inserted)removeTemporaryBlank(view,blank.pos);throw new Error('note正規URLコマンド未処理')}
  const card=await waitForCardNear(view,url,beforeKeys,originalPos,45000);
  if(!card){if(blank.inserted)removeTemporaryBlank(view,blank.pos);throw new Error('カード生成タイムアウト')}
  // URL直後へ入れた一時空行だけ消す。本文中の既存文字・見出しは触らない。
  if(blank.inserted){
    const candidates=[];
    view.state.doc.descendants((node,pos)=>{if(node.type?.name==='paragraph'&&node.textContent===''&&pos>=card.pos&&pos<=card.pos+card.node.nodeSize+6)candidates.push({node,pos})});
    if(candidates[0])removeTemporaryBlank(view,candidates[0].pos);
  }
  const remaining=findRaw(view,url);
  if(remaining)throw new Error('生URLが残っています');
  return true;
}

async function cardifyAll(show){
  const view=findView();if(!view)throw new Error('EditorViewなし');selectionApi();noteUrlCommandFactory();
  const dup=deleteDuplicateRaw(view);if(dup)show(`🧹 重複URL ${dup}件削除`);
  let urls=[...new Set(rawRows(view).map(x=>x.url))];
  if(!urls.length)return 0;
  // 下から処理するので、上側にある文字や見出しの位置変化に影響されない。
  urls=urls.reverse();
  for(let i=0;i<urls.length;i++){
    show(`🃏 ${i+1}/${urls.length}｜${isArt(urls[i])?'固定記事':'マガジン'}カード化`);
    await cardifyOne(view,urls[i]);
    show(`✅ ${i+1}/${urls.length} カード化完了`);
    if(i<urls.length-1)await sleep(650);
  }
  return rawRows(view).length;
}

function install(){
  const root=document.getElementById('__mumei_pon_v14_root__');if(!root)return setTimeout(install,200);
  const panel=root.querySelector('#ponPanel14'),src=root.querySelector('#ponSrc14'),st=root.querySelector('#ponStatus14'),head=root.querySelector('#ponDrag14 b');if(!panel||!st)return setTimeout(install,200);
  if(head)head.textContent='↔️ ポン出し v28｜今あるURLだけ';
  ['ponMags19','ponClearList21','ponMake21','ponCards21','ponClearList22','ponMake22','ponCards22','ponClear23','ponMake23','ponCards23','ponClear24','ponMake24','ponCards24','ponClear25','ponMake25','ponCards25','ponClear26','ponMake26','ponCards26','ponClear27','ponMake27','ponCards27','ponCards28'].forEach(id=>document.getElementById(id)?.remove());
  // 一覧生成ボタン・固定記事取得はv28では出さない。今の本文を一切変更せず、生URLだけカード化する。
  const oldButtons=[...panel.querySelectorAll('button')].filter(b=>/回数整理|共同マガジン|全カード|URL.*カード|カード.*URL/.test(b.textContent||''));oldButtons.forEach(b=>b.remove());
  const say=t=>st.textContent=t;
  const card=document.createElement('button');card.id='ponCards28';card.textContent='🃏 今ある生URLだけ全部カード化';card.style.cssText='display:block;width:100%;border:0;border-radius:8px;padding:10px 5px;background:#72f1c9;color:#032b25;font-weight:900;font-size:12px;margin-bottom:5px';panel.insertBefore(card,src||panel.firstChild);
  card.onclick=async()=>{if(busy)return;busy=true;card.disabled=true;try{const view=findView();const count=view?rawRows(view).length:0;if(!count)throw new Error('カード化する生URLがありません');say(`生URL ${count}件を確認…`);const left=await cardifyAll(say);say(left?`❌ 生URL残り ${left}件｜停止`:'✅ 今ある生URLを全部カード化 完了')}catch(e){say('❌ '+(e?.message||e))}finally{busy=false;card.disabled=false}};
}
install();
})();