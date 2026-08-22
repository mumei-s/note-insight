// ==UserScript==
// @name         無名S note DIRECT SUCCESS 3.0
// @namespace    https://github.com/mumei-s/note-insight/direct-success-300
// @version      3.2.0
// @description  成功済みProseMirror DIRECT URL設定版。進捗・再開＋note公式埋め込み通知1件テスト
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
'use strict';
if(window.__MUMEI_DIRECT_SUCCESS_320__) return;
window.__MUMEI_DIRECT_SUCCESS_320__=true;

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
const N_PANEL='mumei-notify-test-panel';
const N_BTN='mumei-notify-test-btn';
const N_CLEAN='mumei-notify-clean-btn';
const TEST_URL=URLS[0];
const TEST_KEY='mumei_notify_test_v1';
let busy=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function editor(){return document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror')}
function status(t,bad=false){const p=document.getElementById(PANEL);if(!p)return;p.textContent=t;p.style.background=bad?'#991b1b':'#065f46'}
function nstatus(t,bad=false){const p=document.getElementById(N_PANEL);if(!p)return;p.textContent=t;p.style.background=bad?'#991b1b':'#1f2937';p.style.display='block'}
function emit(name,detail={}){document.dispatchEvent(new CustomEvent(name,{detail}))}
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
      view.dispatch(view.state.tr.setNodeMarkup(pos,node.type,attrs,node.marks));
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
    const fresh=view.state.doc.nodeAt(pos);if(nodeHasLink(fresh,url))return true;
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
function nodeList(view,img){
  const hit=findNodeForImg(view,img);if(!hit)return [];
  return [hit,...parentCandidates(view,hit.pos)];
}
function alreadyLinked(view,img,url){return nodeList(view,img).some(c=>nodeHasLink(c.node,url))}
function setDirect(view,img,url){
  const list=nodeList(view,img);if(!list.length)return {ok:false,reason:'node'};
  const hit=list[0];
  for(const c of list){if(trySetAttr(view,c.pos,c.node,url))return {ok:true,mode:'attr',type:c.node.type.name}}
  for(const c of list){if(trySetMark(view,c.pos,c.node,url))return {ok:true,mode:'mark',type:c.node.type.name}}
  return {ok:false,reason:'schema',type:hit.node.type?.name||'?',attrs:Object.keys(hit.node.attrs||{}),marks:Object.keys(view.state.schema.marks||{})};
}
function resetButton(){const b=document.getElementById(BTN);if(b)b.textContent='DIRECT SUCCESS 3.0'}
async function run(){
  if(busy)return;busy=true;const b=document.getElementById(BTN);if(b)b.disabled=true;
  try{
    const imgs=cards();if(imgs.length!==10){status(`カード ${imgs.length}/10`,true);emit('mumei-direct-stopped',{index:0,ok:0,reason:'cards'});return}
    status('EditorViewを探しています…');
    const view=findView();
    if(!view){status('DIRECT停止：EditorViewを取得できません',true);emit('mumei-direct-stopped',{index:0,ok:0,reason:'view'});return}
    let ok=0;
    for(let i=0;i<10;i++){
      const index=i+1;
      if(alreadyLinked(view,imgs[i],URLS[i])){
        ok++;status(`URL書き込み ${index}/10（設定済み）`);emit('mumei-direct-progress',{index,ok,skipped:true});continue
      }
      status(`URL書き込み ${index}/10…`);emit('mumei-direct-progress',{index,ok,skipped:false});
      let r={ok:false,reason:'unknown'};
      for(let attempt=1;attempt<=3;attempt++){r=setDirect(view,imgs[i],URLS[i]);if(r.ok)break;if(attempt<3)await sleep(350)}
      if(!r.ok){status(`URL ${index}/10で停止 → 同じボタンで再開`,true);if(b)b.textContent=`${index}枚目から再開`;emit('mumei-direct-stopped',{index,ok,reason:r.reason||'unknown'});return}
      ok++;emit('mumei-direct-progress',{index,ok,skipped:false});await sleep(100)
    }
    resetButton();status('URL完了 10/10 ✅');emit('mumei-direct-success-done',{ok:10});
  }catch(e){status('DIRECTエラー：'+(e?.message||String(e)),true);emit('mumei-direct-stopped',{index:0,ok:0,reason:'exception'})}
  finally{busy=false;if(b)b.disabled=false}
}

function nodeCarriesUrl(node,url){
  if(!node||!node.attrs)return false;
  const key=url.split('/').pop();
  try{const s=JSON.stringify(node.attrs);return s.includes(url)||s.includes(key)}catch(_){return false}
}
function findEmbed(view,url,typeName=null){
  let hit=null;
  view.state.doc.descendants((node,pos)=>{
    if(hit)return false;
    if(typeName&&node.type?.name!==typeName)return;
    if(nodeCarriesUrl(node,url)&&!node.isTextblock&&!/image|picture|photo/i.test(node.type?.name||'')){hit={node,pos};return false}
  });
  return hit;
}
function setSelectionAtEnd(view){
  try{const Sel=view.state.selection.constructor;view.dispatch(view.state.tr.setSelection(Sel.atEnd(view.state.doc)));return true}catch(_){return false}
}
async function waitEmbed(view,url,ms=8000){
  const end=Date.now()+ms;
  while(Date.now()<end){const hit=findEmbed(view,url);if(hit)return hit;await sleep(250)}
  return null;
}
async function notifyTest(){
  const nb=document.getElementById(N_BTN);if(nb)nb.disabled=true;
  try{
    const view=findView();if(!view){nstatus('通知テスト停止：EditorViewなし',true);return}
    const old=findEmbed(view,TEST_URL);if(old){localStorage.setItem(TEST_KEY,JSON.stringify({url:TEST_URL,type:old.node.type.name}));nstatus('通知カード1/1 すでに有り ✅');return}
    const p=view.state.schema.nodes.paragraph;if(!p){nstatus('通知テスト停止：paragraphなし',true);return}
    nstatus('通知カード 1/1 作成中…');
    const start=view.state.doc.content.size;
    view.dispatch(view.state.tr.insert(start,p.create(null,view.state.schema.text(TEST_URL))));
    setSelectionAtEnd(view);view.focus();await sleep(120);
    view.dom.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
    let hit=await waitEmbed(view,TEST_URL,2500);
    if(!hit){
      try{
        const pos=Math.min(start+1+TEST_URL.length,view.state.doc.content.size);
        const Sel=view.state.selection.constructor;
        if(typeof Sel.near==='function')view.dispatch(view.state.tr.setSelection(Sel.near(view.state.doc.resolve(pos),-1)));
      }catch(_){}
      view.focus();
      try{view.dom.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true}))}catch(_){}
      hit=await waitEmbed(view,TEST_URL,5500);
    }
    if(!hit){nstatus('末尾URLの後で改行を1回押して',true);return}
    localStorage.setItem(TEST_KEY,JSON.stringify({url:TEST_URL,type:hit.node.type.name}));
    nstatus('通知カード 1/1 ✅ この状態で公開して通知確認');
    const cb=document.getElementById(N_CLEAN);if(cb)cb.style.display='block';
  }catch(e){nstatus('通知テスト停止：'+(e?.message||String(e)),true)}
  finally{if(nb)nb.disabled=false}
}
function cleanNotifyTest(){
  try{
    const view=findView();if(!view){nstatus('削除停止：EditorViewなし',true);return}
    let saved=null;try{saved=JSON.parse(localStorage.getItem(TEST_KEY)||'null')}catch(_){}
    if(!saved?.type){nstatus('削除対象が記録されていません',true);return}
    const hits=[];
    view.state.doc.descendants((node,pos)=>{if(node.type?.name===saved.type&&nodeCarriesUrl(node,saved.url))hits.push({node,pos})});
    if(!hits.length){nstatus('通知カードは見つかりません');return}
    let tr=view.state.tr;
    for(const h of hits.sort((a,b)=>b.pos-a.pos))tr=tr.delete(h.pos,h.pos+h.node.nodeSize);
    view.dispatch(tr);localStorage.removeItem(TEST_KEY);
    nstatus('通知カード削除 ✅ 極薄カードだけ残しました');
    const cb=document.getElementById(N_CLEAN);if(cb)cb.style.display='none';
  }catch(e){nstatus('削除停止：'+(e?.message||String(e)),true)}
}
function mountNotify(){
  if(!document.body)return;
  let p=document.getElementById(N_PANEL);if(!p){p=document.createElement('div');p.id=N_PANEL;p.textContent='通知方式テスト';document.body.appendChild(p)}
  Object.assign(p.style,{position:'fixed',right:'8px',bottom:'170px',zIndex:'2147483645',maxWidth:'250px',padding:'6px 8px',borderRadius:'8px',background:'#1f2937',color:'#fff',fontSize:'10px',lineHeight:'1.3',boxShadow:'0 3px 12px rgba(0,0,0,.25)',pointerEvents:'none'});
  let b=document.getElementById(N_BTN);if(!b){b=document.createElement('button');b.id=N_BTN;b.type='button';b.textContent='通知テスト 1件';b.addEventListener('click',notifyTest);document.body.appendChild(b)}
  Object.assign(b.style,{position:'fixed',right:'8px',bottom:'125px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'10px 13px',background:'#2563eb',color:'#fff',fontSize:'13px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});
  let c=document.getElementById(N_CLEAN);if(!c){c=document.createElement('button');c.id=N_CLEAN;c.type='button';c.textContent='通知カード削除';c.addEventListener('click',cleanNotifyTest);document.body.appendChild(c)}
  Object.assign(c.style,{position:'fixed',right:'8px',bottom:'80px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'9px 12px',background:'#b45309',color:'#fff',fontSize:'12px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});
  let saved=null;try{saved=JSON.parse(localStorage.getItem(TEST_KEY)||'null')}catch(_){}
  c.style.display=saved?.type?'block':'none';
}
function mount(){
  if(!document.body)return;
  if(!document.getElementById(PANEL)){
    const p=document.createElement('div');p.id=PANEL;p.textContent='DIRECT SUCCESS 3.2';
    Object.assign(p.style,{position:'fixed',right:'8px',top:'72px',zIndex:'2147483646',maxWidth:'340px',padding:'6px 8px',borderRadius:'8px',background:'#065f46',color:'#fff',fontSize:'11px',lineHeight:'1.3',boxShadow:'0 4px 12px rgba(0,0,0,.25)',pointerEvents:'none'});document.body.appendChild(p)
  }
  if(!document.getElementById(BTN)){
    const b=document.createElement('button');b.id=BTN;b.type='button';b.textContent='DIRECT SUCCESS 3.0';
    Object.assign(b.style,{position:'fixed',right:'8px',top:'110px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'10px 13px',background:'#059669',color:'#fff',fontSize:'13px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});b.addEventListener('click',run);document.body.appendChild(b)
  }
  mountNotify();
}
setInterval(mount,800);mount();
})();
