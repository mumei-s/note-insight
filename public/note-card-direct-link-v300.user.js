// ==UserScript==
// @name         無名S note DIRECT URL 3.0
// @namespace    https://github.com/mumei-s/note-insight/direct-link
// @version      4.0.0
// @description  極薄カード10枚を固定サイズで一括生成・一括挿入し、ProseMirrorへ対応URLをDIRECT直書きする完成統合版
// @match        https://editor.note.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @connect      assets.st-note.com
// ==/UserScript==

(function(){
'use strict';
if(window.__MUMEI_CARD_COMPLETE_400__) return;
window.__MUMEI_CARD_COMPLETE_400__=true;

const ITEMS=[
  ['https://note.com/ss_yr/n/nc14eb3f2ea9f','【言葉と行動、その間にあるもの】 第2回スキ動画コンテスト『夏の陣』🏖'],
  ['https://note.com/ss_yr/n/na8cf287a7152','忘れたくない夏を、ひとつ増やした。【#あいびよりあそび】'],
  ['https://note.com/ss_yr/n/nafb8a53d1fe7','『営業パパ クリエイター図鑑』│無名S note【クリエイター名鑑〇〇編】'],
  ['https://note.com/ss_yr/n/nca7a49a69d3c','【時を閉じ込める番人】│コングラ◯◯冠⁉️『クリエイター名鑑』'],
  ['https://note.com/ss_yr/n/n752f333ddd80','鬼もほどける艶ポーズ👹【スイ式 AI創作レシピ】で描くヨガ道場 📔貼り付け小さくしてみた。'],
  ['https://note.com/ss_yr/n/n426982b5d60b','彗星、縫ってます。☄️そのフォロー外し… 見えてるよ🧐'],
  ['https://note.com/ss_yr/n/n20f58cb3ec59','【TEnGU】'],
  ['https://note.com/ss_yr/n/n5cda670acdcf','【書いた言葉が、朝の部屋から飛び立つまで】 210000PV＆32000スキ達成'],
  ['https://note.com/ss_yr/n/n2dfac2d0b184',"( 'ω'o[おしらせ]o【業界保有数No.1⁉️】"],
  ['https://note.com/ss_yr/n/na51322616876','【企画📝】あなたが、まだ名前をつけていないもの。 共同マガジンの引き継ぎのお知らせ']
].map(([url,title],i)=>({url,title,index:i+1}));

const CREATOR='無名S note';
const CARD_W=860, CARD_H=140;
const BTN='mumei-direct-url-300-btn';
const PANEL='mumei-direct-url-300-panel';
const OLD_PREFIXES=['mumei-batch10','mumei-url-repair','mumei-thin-card-auto'];
const OLD_EXACT=['mumei-url-repair-new231-btn','mumei-url-repair-new231-panel'];
let armed=false,consumed=false,busy=false,preparedFiles=[],beforeInputs=new Set(),beforeImages=new Set(),timer=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function editor(){return document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror')}
function status(t,bad=false){const p=document.getElementById(PANEL);if(!p)return;p.textContent=t;p.style.background=bad?'#991b1b':'#065f46'}
function hideOld(){
  for(const el of [...document.querySelectorAll('[id]')]){
    if((OLD_PREFIXES.some(p=>el.id.startsWith(p))||OLD_EXACT.includes(el.id))&&el.id!==BTN&&el.id!==PANEL){
      el.style.setProperty('display','none','important');
      el.style.setProperty('pointer-events','none','important');
    }
  }
}
function xhr(url,responseType='text'){
  return new Promise((resolve,reject)=>GM_xmlhttpRequest({
    method:'GET',url,responseType,timeout:25000,
    onload:r=>r.status>=200&&r.status<300?resolve(r.response):reject(new Error('取得失敗 '+r.status)),
    onerror:()=>reject(new Error('通信失敗')),
    ontimeout:()=>reject(new Error('通信タイムアウト'))
  }));
}
function imageInput(input){
  if(!(input instanceof HTMLInputElement)||input.type!=='file')return false;
  const a=(input.accept||'').toLowerCase();
  return !a||a.includes('image')||a.includes('.png')||a.includes('.jpg')||a.includes('.jpeg');
}
function metaContent(html,property){
  const doc=new DOMParser().parseFromString(html,'text/html');
  return doc.querySelector(`meta[property="${property}"]`)?.content||doc.querySelector(`meta[name="${property}"]`)?.content||'';
}
async function getThumb(url){
  const html=await xhr(url,'text');
  const thumb=metaContent(html,'og:image');
  if(!thumb)throw new Error('サムネ取得失敗');
  return thumb;
}
async function blobToBitmap(blob){
  if('createImageBitmap' in window)return await createImageBitmap(blob);
  return await new Promise((resolve,reject)=>{
    const img=new Image(),u=URL.createObjectURL(blob);
    img.onload=()=>{URL.revokeObjectURL(u);resolve(img)};
    img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('画像読込失敗'))};
    img.src=u;
  });
}
function roundedRect(c,x,y,w,h,r){
  const rr=Math.min(r,w/2,h/2);
  c.beginPath();c.moveTo(x+rr,y);c.arcTo(x+w,y,x+w,y+h,rr);c.arcTo(x+w,y+h,x,y+h,rr);c.arcTo(x,y+h,x,y,rr);c.arcTo(x,y,x+w,y,rr);c.closePath();
}
function fitLines(c,text,maxWidth,maxLines){
  const chars=[...text],lines=[];let line='',used=0;
  for(let i=0;i<chars.length;i++){
    const test=line+chars[i];
    if(c.measureText(test).width>maxWidth&&line){
      lines.push(line);used+=line.length;line=chars[i];
      if(lines.length===maxLines-1)break;
    }else line=test;
  }
  if(lines.length<maxLines&&line){
    let rest=[...text].slice(used).join('');
    if(c.measureText(rest).width>maxWidth){while(rest&&c.measureText(rest+'…').width>maxWidth)rest=rest.slice(0,-1);rest+='…'}
    lines.push(rest);
  }
  return lines.slice(0,maxLines);
}
async function makeCard(item){
  const thumbUrl=await getThumb(item.url);
  const thumbBlob=await xhr(thumbUrl,'blob');
  const bmp=await blobToBitmap(thumbBlob);
  const canvas=document.createElement('canvas');canvas.width=CARD_W;canvas.height=CARD_H;
  const c=canvas.getContext('2d');
  c.fillStyle='#fff';c.fillRect(0,0,CARD_W,CARD_H);
  c.strokeStyle='#d9dde3';c.lineWidth=1.5;roundedRect(c,1,1,CARD_W-2,CARD_H-2,12);c.stroke();

  const thumbW=220,thumbH=124,thumbX=CARD_W-thumbW-8,thumbY=8;
  const textX=16,textW=thumbX-textX-14;
  c.fillStyle='#171b21';c.font='700 20px system-ui, -apple-system, sans-serif';c.textBaseline='top';
  fitLines(c,item.title,textW,2).forEach((line,i)=>c.fillText(line,textX,14+i*27));
  c.fillStyle='#626975';c.font='15px system-ui, -apple-system, sans-serif';c.fillText(CREATOR,textX,108);

  const iw=bmp.width||bmp.naturalWidth,ih=bmp.height||bmp.naturalHeight;
  const scale=Math.min(thumbW/iw,thumbH/ih),dw=iw*scale,dh=ih*scale;
  c.fillStyle='#f7f8fa';roundedRect(c,thumbX,thumbY,thumbW,thumbH,8);c.fill();
  c.save();roundedRect(c,thumbX,thumbY,thumbW,thumbH,8);c.clip();
  c.drawImage(bmp,thumbX+(thumbW-dw)/2,thumbY+(thumbH-dh)/2,dw,dh);c.restore();
  if(bmp.close)bmp.close();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('カード生成失敗')),'image/png',1));
  return new File([blob],String(item.index).padStart(2,'0')+'_thin.png',{type:'image/png'});
}
async function prepare(){
  const out=[];
  for(let i=0;i<ITEMS.length;i++){
    status(`カード生成 ${i+1}/10…`);
    out.push(await makeCard(ITEMS[i]));
  }
  return out;
}
function looksLikeView(v){
  try{return !!v&&typeof v==='object'&&v.state&&v.state.doc&&v.state.schema&&typeof v.dispatch==='function'&&v.dom&&typeof v.posAtDOM==='function'}catch(_){return false}
}
function findView(){
  const root=editor();if(!root)return null;
  const seeds=[];let n=root;for(let i=0;i<6&&n;i++,n=n.parentElement)seeds.push(n);
  const seen=new Set(),q=[];const push=(v,d=0)=>{if(!v||seen.has(v)||d>7)return;if(typeof v!=='object'&&typeof v!=='function')return;seen.add(v);q.push([v,d])};
  seeds.forEach(s=>push(s,0));let steps=0;
  while(q.length&&steps<12000){
    steps++;const [v,d]=q.shift();if(looksLikeView(v))return v;
    let keys=[];try{keys=Object.getOwnPropertyNames(v)}catch(_){continue}
    for(const k of keys){
      if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k))continue;
      let x;try{x=v[k]}catch(_){continue}
      if(looksLikeView(x))return x;
      if(d<7&&x&&(typeof x==='object'||typeof x==='function')){if(x!==window&&x!==document)push(x,d+1)}
    }
  }
  return null;
}
function norm(u){try{const x=new URL(u,location.href);x.search='';x.hash='';return x.href}catch(_){return String(u||'')}}
function sameSrc(a,b){const A=norm(a),B=norm(b);if(A===B)return true;const pa=A.split('/').pop(),pb=B.split('/').pop();return !!pa&&!!pb&&pa===pb}
function findNodeForImg(view,img){
  let domPos=null;try{domPos=view.posAtDOM(img,0)}catch(_){}
  const candidates=[],doc=view.state.doc;
  if(Number.isInteger(domPos))for(const p of [domPos,domPos-1,domPos+1]){if(p<0||p>doc.content.size)continue;try{const node=doc.nodeAt(p);if(node)candidates.push({node,pos:p})}catch(_){}}
  let exact=null;
  doc.descendants((node,pos)=>{if(exact||!node.attrs)return;for(const [k,v] of Object.entries(node.attrs)){if(typeof v==='string'&&/src|image|url/i.test(k)&&sameSrc(v,img.src)){exact={node,pos};return false}}});
  if(exact)return exact;
  for(const c of candidates){if(/image|picture|photo/i.test(c.node.type?.name||''))return c;if(c.node.attrs&&Object.keys(c.node.attrs).some(k=>/src|image/i.test(k)))return c}
  return candidates[0]||null;
}
function linkMarkType(schema){if(schema.marks?.link)return schema.marks.link;for(const [name,t] of Object.entries(schema.marks||{}))if(/link/i.test(name))return t;return null}
function buildLinkAttrs(type,url){const spec=type?.spec?.attrs||{},attrs={};for(const k of Object.keys(spec)){if(/href|url|link/i.test(k))attrs[k]=url;else if('default'in spec[k])attrs[k]=spec[k].default;else attrs[k]=null}if(!Object.keys(attrs).some(k=>/href|url|link/i.test(k)))attrs.href=url;return attrs}
function nodeHasLink(node,url){if(!node)return false;for(const m of node.marks||[]){if(/link/i.test(m.type?.name||'')){const vals=Object.values(m.attrs||{}).map(String);if(vals.includes(url))return true}}for(const [k,v] of Object.entries(node.attrs||{}))if(/href|link|url/i.test(k)&&String(v)===url)return true;return false}
function attrKeys(node){const keys=new Set([...Object.keys(node.attrs||{}),...Object.keys(node.type?.spec?.attrs||{})]);return [...keys].filter(k=>/href|link|url/i.test(k))}
function trySetAttr(view,pos,node,url){for(const key of attrKeys(node)){try{const attrs={...node.attrs,[key]:url};view.dispatch(view.state.tr.setNodeMarkup(pos,node.type,attrs,node.marks));const fresh=view.state.doc.nodeAt(pos);if(nodeHasLink(fresh,url))return true}catch(_){}}return false}
function trySetMark(view,pos,node,url){const type=linkMarkType(view.state.schema);if(!type)return false;let mark;try{mark=type.create(buildLinkAttrs(type,url))}catch(_){return false}try{const marks=(node.marks||[]).filter(m=>m.type!==type).concat(mark);view.dispatch(view.state.tr.setNodeMarkup(pos,node.type,node.attrs,marks));if(nodeHasLink(view.state.doc.nodeAt(pos),url))return true}catch(_){}try{view.dispatch(view.state.tr.addMark(pos,pos+node.nodeSize,mark));if(nodeHasLink(view.state.doc.nodeAt(pos),url))return true}catch(_){}return false}
function parentCandidates(view,pos){const out=[];try{const $p=view.state.doc.resolve(Math.max(0,Math.min(pos,view.state.doc.content.size)));for(let d=$p.depth;d>=1;d--){const node=$p.node(d);let p;try{p=$p.before(d)}catch(_){continue}out.push({node,pos:p})}}catch(_){}return out}
function setDirect(view,img,url){const hit=findNodeForImg(view,img);if(!hit)return false;const list=[hit,...parentCandidates(view,hit.pos)];for(const c of list)if(trySetAttr(view,c.pos,c.node,url))return true;for(const c of list)if(trySetMark(view,c.pos,c.node,url))return true;return false}
async function waitInserted(timeout=45000){
  const root=editor();if(!root)return[];const end=Date.now()+timeout;
  while(Date.now()<end){const added=[...root.querySelectorAll('img')].filter(x=>!beforeImages.has(x));if(added.length>=10)return added;await sleep(350)}
  return [...root.querySelectorAll('img')].filter(x=>!beforeImages.has(x));
}
async function directAll(imgs){
  status('DIRECT URLを書き込み中…');
  const view=findView();if(!view)throw new Error('EditorView取得失敗');
  let ok=0;
  for(let i=0;i<Math.min(10,imgs.length);i++){
    status(`DIRECT URL ${i+1}/10…`);
    if(setDirect(view,imgs[i],ITEMS[i].url))ok++;else throw new Error(`${i+1}枚目URL設定失敗`);
    await sleep(80);
  }
  return ok;
}
async function waitInserted(timeout=45000){
  const root=editor();if(!root)return[];const end=Date.now()+timeout;
  while(Date.now()<end){const added=[...root.querySelectorAll('img')].filter(x=>!beforeImages.has(x));if(added.length>=10)return added;await sleep(350)}
  return [...root.querySelectorAll('img')].filter(x=>!beforeImages.has(x));
}
async function inject(input){
  if(!armed||consumed||!preparedFiles.length||!imageInput(input)||beforeInputs.has(input))return false;
  consumed=true;armed=false;if(timer)clearTimeout(timer);timer=null;
  const send=preparedFiles;preparedFiles=[];
  try{
    const dt=new DataTransfer();send.forEach(f=>dt.items.add(f));input.files=dt.files;
    input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
    status('10枚を一括挿入中…');
    const imgs=await waitInserted();
    if(imgs.length<10)throw new Error(`画像 ${imgs.length}/10`);
    const ok=await directAll(imgs.slice(0,10));
    status(`完成：画像 10/10・URL ${ok}/10 ✅`);
    consumed=false;return true;
  }catch(e){consumed=false;status('停止：'+(e?.message||String(e)),true);return false}
}
const observer=new MutationObserver(ms=>{
  if(!armed||consumed)return;
  for(const m of ms)for(const node of m.addedNodes){
    if(!(node instanceof Element))continue;
    if(imageInput(node)){inject(node);return}
    for(const input of node.querySelectorAll?.('input[type="file"]')||[]){if(imageInput(input)){inject(input);return}}
  }
});
function startObs(){if(!document.documentElement)return setTimeout(startObs,50);observer.observe(document.documentElement,{childList:true,subtree:true})}startObs();
const nativeClick=HTMLInputElement.prototype.click;
HTMLInputElement.prototype.click=function(...args){if(armed&&!consumed&&imageInput(this)&&!beforeInputs.has(this)){inject(this);return}return nativeClick.apply(this,args)};

async function arm(){
  if(busy)return;busy=true;const b=document.getElementById(BTN);if(b)b.disabled=true;
  try{
    hideOld();const root=editor();if(!root)throw new Error('note本文欄が見つかりません');
    beforeImages=new Set(root.querySelectorAll('img'));
    status('固定サイズカード10枚を準備中…');
    preparedFiles=await prepare();
    beforeInputs=new Set(document.querySelectorAll('input[type="file"]'));
    armed=true;consumed=false;
    status('準備OK → 本文をタップ →「＋」→「画像」を1回');
    timer=setTimeout(()=>{if(armed){armed=false;preparedFiles=[];status('時間切れ。もう一度押して',true)}},60000);
  }catch(e){armed=false;preparedFiles=[];status('停止：'+(e?.message||String(e)),true)}
  finally{busy=false;if(b)b.disabled=false}
}
function mount(){
  if(!document.body)return;hideOld();
  let p=document.getElementById(PANEL);
  if(!p){p=document.createElement('div');p.id=PANEL;document.body.appendChild(p)}
  p.textContent=p.textContent||'完成版 4.0：860×140固定';
  Object.assign(p.style,{position:'fixed',left:'8px',bottom:'58px',zIndex:'2147483646',maxWidth:'320px',padding:'6px 8px',borderRadius:'8px',background:'#065f46',color:'#fff',fontSize:'11px',lineHeight:'1.3',boxShadow:'0 4px 12px rgba(0,0,0,.25)',pointerEvents:'none'});
  let b=document.getElementById(BTN);
  if(!b){b=document.createElement('button');b.id=BTN;b.type='button';document.body.appendChild(b);b.addEventListener('click',arm)}
  b.textContent='10枚 完成版 4.0';
  Object.assign(b.style,{position:'fixed',left:'8px',bottom:'10px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'10px 13px',background:'#059669',color:'#fff',fontSize:'13px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});
}
setInterval(mount,800);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
