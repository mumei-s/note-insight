(() => {
'use strict';
if (window.__MUMEI_PON_V23_CORE__) return;
window.__MUMEI_PON_V23_CORE__ = true;
['__MUMEI_PON_V15_ADDON__','__MUMEI_PON_V16_ADDON__','__MUMEI_PON_V171_ADDON__','__MUMEI_PON_V172_ADDON__','__MUMEI_PON_V173_ADDON__','__MUMEI_PON_V18__','__MUMEI_PON_V181__','__MUMEI_PON_V19__','__MUMEI_PON_V20__','__MUMEI_PON_V21__','__MUMEI_PON_V22__'].forEach(k=>window[k]=true);

const SAVED='https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v15.user.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EXKEY=new Set(['m535c97031825','m7ffeddfdfb3c']);
const EXTITLE=/(コメントできなくなりました|ちび創作大賞|スキ動画コンテスト)/;
const COUNT={
  mf534419e7479:10,m300d06308833:10,m9872a92a8af5:10,
  mbefcb2e5a397:5,m1df0b906bace:5,m74b154cd7893:5,m653e8e82ea44:5,m4d9b9698cacf:5,mb028566a46ee:5,md96759f4be5b:5,mb80f5e0f9b99:5,m3759ff7a5b9c:5,m9e01fdb0606f:5,ma475a8bdcecc:5,m254cc8180f92:5,mba58a6f9aacf:5,m9bb45783969e:5,m33495b5ea807:5,
  m752f734f7a1c:4,
  mef2032492c4a:3,mb3dc2cd9766e:3,macfef0fcc489:3,m5db97d398203:3,mc4827a8e939b:3,m9186cf842d83:3,me86c388d3826:3,m95b78222e9b9:3,m16580951510b:3,ma4dad1f25900:3,
  mf2e99e9aa411:2,mc9bf7875a8d7:2,meadce3d098b0:2,mf7c9271b4e5e:2,m8d6e2d4322c8:2,
  m4eb9deb52a78:1,mf21f18654494:1,md3a807653baf:1,mbe79c0d9105c:1,m9f1b6d83fe39:1,ma7a2c6649fa2:1
};
const UNLIMITED=new Set(['mff26de4b50e8','m3a58ed12c332','ma8d107d9475f','m6cf909200081','mad3a5537da46','m97848c1bdf32']);
const PAID=new Set(['mb4495066c358']);
// 誤取得防止：固定記事は確認済みだけを出す。自動推測はしない。
const FIXED={
  mff26de4b50e8:'https://note.com/mameshibamendako/n/n5001ef7fe6b7',
  ma8d107d9475f:'https://note.com/tatsuopapa/n/n6a405735ec8d',
  m300d06308833:'https://note.com/ayumu_ai/n/nc12952774db5',
  m1df0b906bace:'https://note.com/sui_ai_drawing/n/n7f5bc24a0753',
  m74b154cd7893:'https://note.com/ss_yr/n/nfabe8366745e'
};
let busy=false,noteUrlCommand=null;

const clean=u=>{try{const x=new URL(u,'https://note.com');x.search='';x.hash='';return x.href}catch{return''}};
const mkey=u=>(String(u).match(/\/m\/(m[a-z0-9]+)/i)||[])[1]||'';
const owner=u=>{try{return new URL(u).pathname.split('/').filter(Boolean)[0]||''}catch{return''}};
const isMag=u=>/^https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+$/i.test(String(u||''));
const isArt=u=>/^https:\/\/note\.com\/[^/]+\/n\/n[a-z0-9]+$/i.test(String(u||''));
const isNote=u=>isMag(u)||isArt(u);
const get=url=>new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'GET',url,timeout:20000,onload:r=>r.status<400?resolve(r.responseText):reject(Error('HTTP '+r.status)),onerror:()=>reject(Error('通信失敗')),ontimeout:()=>reject(Error('timeout'))}));

function savedRows(src){
  const m=String(src).match(/const FALLBACK=`([\s\S]*?)`\.trim\(\)\.split/);if(!m)return[];
  const seen=new Set();
  return m[1].trim().split('\n').map((line,index)=>{
    const p=line.lastIndexOf('|');if(p<1)return null;
    const title=line.slice(0,p).trim(),url=clean(line.slice(p+1).trim()),k=mkey(url);
    if(!k||!isMag(url)||seen.has(k)||EXKEY.has(k)||EXTITLE.test(title))return null;
    seen.add(k);return{title,url,index,key:k,owner:owner(url)};
  }).filter(Boolean);
}
async function rows(){return savedRows(await get(SAVED))}
function ruleFor(row){
  if(UNLIMITED.has(row.key))return{type:'unlimited'};
  if(row.key in COUNT)return{type:'count',count:COUNT[row.key]};
  if(row.owner==='ss_yr'){const m=String(row.title).match(/^([1-9])️⃣/);if(m)return{type:'count',count:+m[1]}}
  return{type:'none'};
}
const gkey=r=>r.rule.type==='count'?r.rule.count:r.rule.type;
const glabel=g=>g==='unlimited'?'♾️ 無制限・制限なし':g==='none'?'❓ 制限数の表記を確認できないマガジン':`${g===10?'🔟':g+'️⃣'} 1日${g}記事まで`;
function transmissionOrder(title){return /^トランスミッション$/.test(title)?1:/トランスミッション[２2]$/.test(title)?2:/トランスミッション[３3]$/.test(title)?3:0}
function ordered(items){
  const a=[...items].sort((x,y)=>x.index-y.index),tr=a.filter(x=>transmissionOrder(x.title)).sort((x,y)=>transmissionOrder(x.title)-transmissionOrder(y.title));
  if(tr.length<2)return a;const first=Math.min(...tr.map(x=>a.indexOf(x))),rest=a.filter(x=>!tr.includes(x));rest.splice(first,0,...tr);return rest;
}
function build(input){
  const items=input.map(row=>({...row,rule:ruleFor(row),pin:FIXED[row.key]||'',display:row.owner==='ss_yr'?`👑 ${row.title}`:row.title,paid:PAID.has(row.key)}));
  const groups=new Map();for(const x of items){const g=gkey(x);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(x)}
  const nums=[...groups.keys()].filter(x=>typeof x==='number').sort((a,b)=>b-a),order=[];if(groups.has('unlimited'))order.push('unlimited');order.push(...nums);if(groups.has('none'))order.push('none');
  const out=[];for(const g of order){out.push('# '+glabel(g),'');for(const x of ordered(groups.get(g))){out.push('## '+x.display,'');if(x.paid)out.push('※有料記事追加不可','');out.push(`マガジンURL：${x.url}`,x.url,'');if(x.pin)out.push(`固定記事URL：${x.pin}`,x.pin,'');out.push('---','')}}
  return{items,source:out.join('\n').replace(/\n{3,}/g,'\n\n').trim()};
}

function looksLikeView(v){try{return!!(v&&v.state?.doc&&v.state?.schema&&typeof v.dispatch==='function'&&v.dom&&typeof v.posAtDOM==='function')}catch{return false}}
function findView(){
  const root=document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror');if(!root)return null;
  const q=[];let n=root;for(let i=0;i<7&&n;i++,n=n.parentElement)q.push([n,0]);const seen=new Set();let steps=0;
  while(q.length&&steps++<14000){const[v,d]=q.shift();if(!v||(typeof v!=='object'&&typeof v!=='function')||seen.has(v))continue;seen.add(v);if(looksLikeView(v))return v;if(d>=6)continue;let keys=[];try{keys=Object.getOwnPropertyNames(v)}catch{continue}for(const k of keys){if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k))continue;let x;try{x=v[k]}catch{continue}if(x&&(typeof x==='object'||typeof x==='function')&&!seen.has(x))q.push([x,d+1])}}
  return null;
}
function webpackRequire(){const chunks=window.webpackChunk_N_E;if(!chunks||typeof chunks.push!=='function')return null;let req=null;try{chunks.push([[930000000+Math.floor(Math.random()*60000000)],{},r=>{req=r}])}catch{}return req}
function factory(){
  if(typeof noteUrlCommand==='function')return noteUrlCommand;
  const req=webpackRequire();if(!req)throw Error('note内部処理を取得できません');let mod;try{mod=req(94928)}catch{}
  let candidate=typeof mod?.fjT==='function'?mod.fjT:null;
  const right=value=>{if(typeof value!=='function')return false;let s='';try{s=Function.prototype.toString.call(value)}catch{}return s.includes('state.selection')&&s.includes('nodeBefore')&&s.includes('replaceRangeWith')&&s.includes('.then')};
  if(!right(candidate)){const loaded=Object.values(req.c||{}).flatMap(e=>{const ex=e?.exports;if(!ex)return[];if(typeof ex==='function')return[ex];try{return Object.values(ex)}catch{return[]}});candidate=loaded.find(right)||candidate}
  if(typeof candidate!=='function')throw Error('note正規URLコマンドが見つかりません');noteUrlCommand=candidate;return candidate;
}
function rawRows(view){const out=[];view.state.doc.descendants((node,pos)=>{if(node.isTextblock){const u=(node.textContent||'').trim();if(isNote(u))out.push({node,pos,url:u})}return true});return out.sort((a,b)=>b.pos-a.pos)}
function setEnd(view){try{const S=view.state.selection.constructor;view.dispatch(view.state.tr.setSelection(S.atEnd(view.state.doc)));view.focus();return true}catch{return false}}
function topCardHits(view,url){
  const key=url.split('/').pop(),out=[];view.state.doc.forEach((node,pos)=>{if(node.isTextblock)return;let j='';try{j=JSON.stringify(node.toJSON())}catch{}if(j.includes(url)||(key&&j.includes(key)))out.push({node,pos})});return out;
}
function deleteTop(view,hit){if(!hit)return;view.dispatch(view.state.tr.delete(hit.pos,hit.pos+hit.node.nodeSize))}
function removeTempRaw(view,url,exceptPos){
  const hits=rawRows(view).filter(x=>x.url===url&&x.pos!==exceptPos).sort((a,b)=>b.pos-a.pos);if(!hits.length)return;
  let tr=view.state.tr;for(const h of hits)tr=tr.delete(h.pos,h.pos+h.node.nodeSize);view.dispatch(tr);
}
async function createNativeAtEnd(view,url,originalPos){
  const paragraph=view.state.schema.nodes.paragraph;if(!paragraph)throw Error('paragraphなし');
  const before=new Set(topCardHits(view,url).map(x=>`${x.pos}:${x.node.nodeSize}`));
  const temp=paragraph.create(null,view.state.schema.text(url));
  view.dispatch(view.state.tr.insert(view.state.doc.content.size,temp));
  setEnd(view);
  const command=factory()(url);if(typeof command!=='function'){removeTempRaw(view,url,originalPos);throw Error('note正規URLコマンド未処理')}
  const handled=command(view.state,tr=>view.dispatch(tr),view);if(handled?.then)try{await handled}catch{}
  if(handled===false){removeTempRaw(view,url,originalPos);throw Error('note正規URLコマンド未処理')}
  const deadline=Date.now()+18000;let hit=null;
  while(Date.now()<deadline){const all=topCardHits(view,url);hit=all.find(x=>!before.has(`${x.pos}:${x.node.nodeSize}`))||all.sort((a,b)=>b.pos-a.pos)[0]||null;if(hit)break;await sleep(180)}
  removeTempRaw(view,url,originalPos);
  if(!hit)throw Error('純正カード生成を確認できません');
  return hit;
}
async function cardifyOne(view,row){
  const current=rawRows(view).find(x=>x.url===row.url&&x.pos===row.pos)||rawRows(view).find(x=>x.url===row.url);if(!current)return true;
  const originalPos=current.pos,originalSize=current.node.nodeSize;
  const hit=await createNativeAtEnd(view,row.url,originalPos);
  const fresh=topCardHits(view,row.url).sort((a,b)=>b.pos-a.pos).find(x=>x.pos>=hit.pos-4)||hit;
  const cardNode=fresh.node,cardPos=fresh.pos;
  let tr=view.state.tr;
  if(cardPos>originalPos){tr=tr.delete(cardPos,cardPos+cardNode.nodeSize);tr=tr.delete(originalPos,originalPos+originalSize);tr=tr.insert(originalPos,cardNode)}
  else{tr=tr.delete(originalPos,originalPos+originalSize);const adjusted=cardPos>originalPos?cardPos-originalSize:cardPos;tr=tr.delete(adjusted,adjusted+cardNode.nodeSize);tr=tr.insert(originalPos,cardNode)}
  view.dispatch(tr);return true;
}
async function cardifyAll(show){
  const view=findView();if(!view)throw Error('EditorViewなし');const initial=rawRows(view);if(!initial.length)return 0;
  let ok=0;for(let i=0;i<initial.length;i++){show(`🃏 純正カード ${i+1}/${initial.length}｜${isArt(initial[i].url)?'固定記事':'マガジン'}`);try{await cardifyOne(view,initial[i]);ok++}catch(e){show(`⚠️ ${i+1}/${initial.length} ${e?.message||e}`)}await sleep(260)}
  return rawRows(view).length;
}

function textNode(schema,text){return text?schema.text(text):null}
function nodeForLine(schema,t){
  if(/^#\s+/.test(t))return schema.nodes.heading.create({level:2},textNode(schema,t.replace(/^#\s+/,'')));
  if(/^##\s+/.test(t))return schema.nodes.heading.create({level:3},textNode(schema,t.replace(/^##\s+/,'')));
  if(/^-{3,}$/.test(t)){const hr=schema.nodes.horizontal_rule||schema.nodes.horizontalRule||schema.nodes.hr;if(!hr)throw Error('区切り線ノードなし');return hr.create()}
  const p=schema.nodes.paragraph;if(!p)throw Error('paragraphなし');return p.create(null,textNode(schema,t));
}
function insertSource(source){
  const view=findView();if(!view)throw Error('EditorViewなし');const schema=view.state.schema,lines=String(source).replace(/\r/g,'').split('\n');let tr=view.state.tr,pos=tr.doc.content.size;
  for(const raw of lines){const t=raw.trim();if(!t)continue;const node=nodeForLine(schema,t);tr=tr.insert(pos,node);pos+=node.nodeSize}
  view.dispatch(tr);return view;
}
function linkMarkType(schema){if(schema.marks?.link)return schema.marks.link;for(const[name,type]of Object.entries(schema.marks||{}))if(/link/i.test(name))return type;return null}
function linkifyLabels(view){
  const type=linkMarkType(view.state.schema);if(!type)return 0;const re=/^(マガジンURL|固定記事URL)：(https:\/\/note\.com\/\S+)$/;const rows=[];
  view.state.doc.descendants((node,pos)=>{if(!node.isTextblock)return true;const t=(node.textContent||'').trim(),m=t.match(re);if(m){const at=t.indexOf(m[2]);rows.push({start:pos+1+at,end:pos+1+at+m[2].length,url:m[2]})}return true});
  let tr=view.state.tr,n=0;for(const r of rows){try{tr=tr.addMark(r.start,r.end,type.create({href:r.url,target:'_blank',rel:'noopener noreferrer'}));n++}catch{try{tr=tr.addMark(r.start,r.end,type.create({href:r.url}));n++}catch{}}}if(n)view.dispatch(tr);return n;
}
function topRows(view){const a=[];view.state.doc.forEach((node,pos)=>a.push({node,pos,text:(node.textContent||'').trim()}));return a}
const isGroup=t=>/^(?:♾️ 無制限・制限なし|❓ 制限数の表記を確認できないマガジン|(?:🔟|[1-9]️⃣) 1日\d+記事まで)$/.test(t);
function clearAll(src,show){
  const view=findView();if(!view)throw Error('EditorViewなし');const a=topRows(view);let start=-1,end=-1;
  for(const x of a){if(isGroup(x.text)&&start<0)start=x.pos;if(start>=0&&/horizontal/i.test(x.node.type?.name||''))end=x.pos+x.node.nodeSize}
  if(start<0){src.value='';show('✅ 貼付一覧なし');return}
  if(end<start)end=view.state.doc.content.size;view.dispatch(view.state.tr.delete(start,end));src.value='';show('🧹 ポン出し貼付分を全部削除 ✅');
}

function install(){
  const root=document.getElementById('__mumei_pon_v14_root__');if(!root)return setTimeout(install,200);
  const panel=root.querySelector('#ponPanel14'),src=root.querySelector('#ponSrc14'),st=root.querySelector('#ponStatus14'),head=root.querySelector('#ponDrag14 b');if(!panel||!src||!st)return setTimeout(install,200);
  if(head)head.textContent='↔️ ポン出し v23';
  ['ponMags19','ponClearList21','ponMake21','ponCards21','ponClearList22','ponMake22','ponCards22','ponClear23','ponMake23','ponCards23'].forEach(id=>document.getElementById(id)?.remove());
  const say=t=>st.textContent=t;
  const del=document.createElement('button');del.id='ponClear23';del.textContent='🧹 ポン出し貼付分を全部消す';del.style.cssText='display:block;width:100%;border:1px solid #ff8d8d;border-radius:8px;padding:9px 5px;background:#5b1f29;color:#fff;font-weight:900;font-size:11px;margin-bottom:5px';panel.insertBefore(del,src);del.onclick=()=>{try{clearAll(src,say)}catch(e){say('❌ '+(e?.message||e))}};
  const make=document.createElement('button');make.id='ponMake23';make.textContent='📚 回数整理→両方を純正カード化';make.style.cssText='display:block;width:100%;border:0;border-radius:8px;padding:9px 5px;background:#ffd54a;color:#261f00;font-weight:900;font-size:11px;margin-bottom:5px';panel.insertBefore(make,src);
  make.onclick=async()=>{if(busy)return;busy=true;make.disabled=true;try{say('参加中保存一覧を取得…');const list=await rows();if(!list.length)throw Error('参加中一覧を取得できません');const built=build(list);src.value=built.source;say(`本文へ挿入｜${built.items.length}誌・確認済み固定記事 ${built.items.filter(x=>x.pin).length}件`);const view=insertSource(src.value);linkifyLabels(view);const left=await cardifyAll(say);say(left?`⚠️ 生URL残り ${left}件｜緑ボタンで再実行`:'✅ マガジン＋固定記事を純正カード化完了')}catch(e){say('❌ '+(e?.message||e))}finally{busy=false;make.disabled=false}};
  const card=document.createElement('button');card.id='ponCards23';card.textContent='🃏 今あるURLを純正カード化';card.style.cssText='display:block;width:100%;border:0;border-radius:8px;padding:9px 5px;background:#72f1c9;color:#032b25;font-weight:900;font-size:11px;margin-bottom:5px';panel.insertBefore(card,src);card.onclick=async()=>{if(busy)return;busy=true;card.disabled=true;try{const view=findView();if(view)linkifyLabels(view);const left=await cardifyAll(say);say(left?`⚠️ 生URL残り ${left}件`:'✅ マガジン＋固定記事を純正カード化完了')}catch(e){say('❌ '+(e?.message||e))}finally{busy=false;card.disabled=false;make.disabled=false}};
}
install();
})();