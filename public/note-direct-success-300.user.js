// ==UserScript==
// @name         無名S note DIRECT SUCCESS 3.0
// @namespace    https://github.com/mumei-s/note-insight/direct-success-300
// @version      3.0.0
// @description  実際に成功したProseMirror DIRECT URL設定版を別名で固定復元
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
'use strict';
if(window.__MUMEI_DIRECT_SUCCESS_300__) return;
window.__MUMEI_DIRECT_SUCCESS_300__=true;

const URLS=[
'https://note.com/ss_yr/n/nc14eb3f2ea9f',
'https://note.com/ss_yr/n/na8cf287a7152',
'https://note.com/ss_yr/n/nafb8a53d1fe7',
'https://note.com/ss_yr/n/nca7a49a69d3c',
'https://note.com/ss_yr/n/n752f333ddd80',
'https://note.com/ss_yr/n/n426982b5d60b',
'https://note.com/ss_yr/n/n20f58cb3ec59',
'https://note.com/ss_yr/n/n5cda670acdcf',
'https://note.com/ss_yr/n/n2dfac2d0b184',
'https://note.com/ss_yr/n/na51322616876'
];
const PANEL='mumei-direct-success-panel';
const BTN='mumei-direct-success-btn';
let busy=false;

function editor(){return document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror')}
function status(t,bad=false){const p=document.getElementById(PANEL);if(!p)return;p.textContent=t;p.style.background=bad?'#991b1b':'#065f46'}
function cards(){
  const root=editor();if(!root)return[];
  return [...root.querySelectorAll('img')].filter(img=>{
    const r=img.getBoundingClientRect(),w=img.naturalWidth||r.width,h=img.naturalHeight||r.height;
    return h>0&&w/h>4.5;
  }).slice(-10);
}
function looksLikeView(v){
  try{return !!v&&typeof v==='object'&&v.state&&v.state.doc&&v.state.schema&&typeof v.dispatch==='function'&&v.dom&&typeof v.posAtDOM==='function'}catch(_){return false}
}
function findView(){
  const root=editor();if(!root)return null;
  const seeds=[];
  let n=root;for(let i=0;i<6&&n;i++,n=n.parentElement)seeds.push(n);
  const seen=new Set(),q=[];
  const push=(v,d=0)=>{if(!v||seen.has(v)||d>7)return;if(typeof v!=='object'&&typeof v!=='function')return;seen.add(v);q.push([v,d])};
  seeds.forEach(s=>push(s,0));
  let steps=0;
  while(q.length&&steps<12000){
    steps++;
    const [v,d]=q.shift();
    if(looksLikeView(v))return v;
    let keys=[];
    try{keys=Object.getOwnPropertyNames(v)}catch(_){continue}
    for(const k of keys){
      if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k))continue;
      let x;try{x=v[k]}catch(_){continue}
      if(looksLikeView(x))return x;
      if(d<7&&x&&(typeof x==='object'||typeof x==='function')){
        if(x===window||x===document)continue;
        push(x,d+1);
      }
    }
  }
  return null;
}
function norm(u){try{const x=new URL(u,location.href);x.search='';x.hash='';return x.href}catch(_){return String(u||'')}}
function sameSrc(a,b){
  const A=norm(a),B=norm(b);if(A===B)return true;
  const pa=A.split('/').pop(),pb=B.split('/').pop();
  return !!pa&&!!pb&&(pa===pb||pa.split('?')[0]===pb.split('?')[0]);
}
function findNodeForImg(view,img){
  let domPos=null;
  try{domPos=view.posAtDOM(img,0)}catch(_){}
  const candidates=[];
  const doc=view.state.doc;
  if(Number.isInteger(domPos)){
    for(const p of [domPos,domPos-1,domPos+1]){
      if(p<0||p>doc.content.size)continue;
      try{const node=doc.nodeAt(p);if(node)candidates.push({node,pos:p})}catch(_){}
    }
  }
  let exact=null;
  doc.descendants((node,pos)=>{
    if(exact||!node.attrs)return;
    for(const [k,v] of Object.entries(node.attrs)){
      if(typeof v==='string'&&/src|image|url/i.test(k)&&sameSrc(v,img.src)){exact={node,pos};return false}
    }
  });
  if(exact)return exact;
  for(const c of candidates){
    if(/image|picture|photo/i.test(c.node.type?.name||''))return c;
    if(c.node.attrs&&Object.keys(c.node.attrs).some(k=>/src|image/i.test(k)))return c;
  }
  return candidates[0]||null;
}
function linkMarkType(schema){
  if(schema.marks?.link)return schema.marks.link;
  for(const [name,t] of Object.entries(schema.marks||{}))if(/link/i.test(name))return t;
  return null;
}
function buildLinkAttrs(type,url){
  const spec=type?.spec?.attrs||{};const attrs={};
  for(const k of Object.keys(spec)){
    if(/href|url|link/i.test(k))attrs[k]=url;
    else if('default' in spec[k])attrs[k]=spec[k].default;
    else attrs[k]=null;
  }
  if(!Object.keys(attrs).some(k=>/href|url|link/i.test(k)))attrs.href=url;
  return attrs;
}
function nodeHasLink(node,url){
  if(!node)return false;
  for(const m of node.marks||[]){
    if(/link/i.test(m.type?.name||'')){
      const vals=Object.values(m.attrs||{}).map(String);if(vals.includes(url))return true;
    }
  }
  for(const [k,v] of Object.entries(node.attrs||{}))if(/href|link|url/i.test(k)&&String(v)===url)return true;
  return false;
}
function attrKeys(node){
  const keys=new Set([...Object.keys(node.attrs||{}),...Object.keys(node.type?.spec?.attrs||{})]);
  return [...keys].filter(k=>/href|link|url/i.test(k));
}
function trySetAttr(view,pos,node,url){
  const keys=attrKeys(node);if(!keys.length)return false;
  for(const key of keys){
    try{
      const attrs={...node.attrs,[key]:url};
      const tr=view.state.tr.setNodeMarkup(pos,node.type,attrs,node.marks);
      view.dispatch(tr);
      const fresh=view.state.doc.nodeAt(pos);
      if(nodeHasLink(fresh,url))return true;
    }catch(_){}
  }
  return false;
}
function trySetMark(view,pos,node,url){
  const type=linkMarkType(view.state.schema);if(!type)return false;
  let mark;try{mark=type.create(buildLinkAttrs(type,url))}catch(_){return false}
  try{
    const marks=(node.marks||[]).filter(m=>m.type!==type).concat(mark);
    view.dispatch(view.state.tr.setNodeMarkup(pos,node.type,node.attrs,marks));
    let fresh=view.state.doc.nodeAt(pos);if(nodeHasLink(fresh,url))return true;
  }catch(_){}
  try{
    view.dispatch(view.state.tr.addMark(pos,pos+node.nodeSize,mark));
    const fresh=view.state.doc.nodeAt(pos);if(nodeHasLink(fresh,url))return true;
  }catch(_){}
  return false;
}
function parentCandidates(view,pos){
  const out=[];
  try{
    const $p=view.state.doc.resolve(Math.max(0,Math.min(pos,view.state.doc.content.size)));
    for(let d=$p.depth;d>=1;d--){
      const node=$p.node(d);let p;try{p=$p.before(d)}catch(_){continue}
      out.push({node,pos:p});
    }
  }catch(_){}
  return out;
}
function setDirect(view,img,url){
  const hit=findNodeForImg(view,img);if(!hit)return {ok:false,reason:'node'};
  const list=[hit,...parentCandidates(view,hit.pos)];
  for(const c of list){if(trySetAttr(view,c.pos,c.node,url))return {ok:true,mode:'attr',type:c.node.type.name}}
  for(const c of list){if(trySetMark(view,c.pos,c.node,url))return {ok:true,mode:'mark',type:c.node.type.name}}
  return {ok:false,reason:'schema',type:hit.node.type?.name||'?',attrs:Object.keys(hit.node.attrs||{}),marks:Object.keys(view.state.schema.marks||{})};
}
async function run(){
  if(busy)return;busy=true;const b=document.getElementById(BTN);if(b)b.disabled=true;
  try{
    const imgs=cards();if(imgs.length!==10){status(`カード ${imgs.length}/10`,true);return}
    status('EditorViewを探しています…');
    const view=findView();
    if(!view){status('DIRECT停止：EditorViewを取得できません',true);return}
    status('DIRECT：1枚目だけURL設定テスト…');
    const first=setDirect(view,imgs[0],URLS[0]);
    if(!first.ok){status(`DIRECT停止：${first.reason} / ${first.type||''} / attrs:${(first.attrs||[]).join(',')} / marks:${(first.marks||[]).join(',')}`,true);return}
    let ok=1;
    for(let i=1;i<10;i++){
      status(`DIRECT URL ${i+1}/10…`);
      const r=setDirect(view,imgs[i],URLS[i]);if(r.ok)ok++;else{status(`DIRECT停止 ${i+1}枚目：${r.reason}`,true);return}
      await new Promise(r=>setTimeout(r,80));
    }
    status(`DIRECT完了 ${ok}/10。下書き保存して確認`,ok!==10);
    document.dispatchEvent(new CustomEvent('mumei-direct-success-done',{detail:{ok}}));
  }catch(e){status('DIRECTエラー：'+(e?.message||String(e)),true)}finally{busy=false;if(b)b.disabled=false}
}
function mount(){
  if(!document.body)return;
  if(!document.getElementById(PANEL)){
    const p=document.createElement('div');p.id=PANEL;p.textContent='DIRECT SUCCESS 3.0';
    Object.assign(p.style,{position:'fixed',right:'8px',top:'72px',zIndex:'2147483646',maxWidth:'340px',padding:'6px 8px',borderRadius:'8px',background:'#065f46',color:'#fff',fontSize:'11px',lineHeight:'1.3',boxShadow:'0 4px 12px rgba(0,0,0,.25)',pointerEvents:'none'});document.body.appendChild(p)
  }
  if(!document.getElementById(BTN)){
    const b=document.createElement('button');b.id=BTN;b.type='button';b.textContent='DIRECT SUCCESS 3.0';
    Object.assign(b.style,{position:'fixed',right:'8px',top:'110px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'10px 13px',background:'#059669',color:'#fff',fontSize:'13px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});b.addEventListener('click',run);document.body.appendChild(b)
  }
}
setInterval(mount,800);mount();
})();
