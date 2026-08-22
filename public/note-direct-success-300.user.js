// ==UserScript==
// @name         無名S note DIRECT SUCCESS 3.0
// @namespace    https://github.com/mumei-s/note-insight/direct-success-300
// @version      3.12.0
// @description  成功済みDIRECT URL設定＋note公式POST /api/v1/embedを10件通す通知テスト＋一括削除
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
'use strict';
if(window.__MUMEI_DIRECT_SUCCESS_3120__) return;
window.__MUMEI_DIRECT_SUCCESS_3120__=true;

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
const PANEL='mumei-direct-success-panel',BTN='mumei-direct-success-btn';
const N_PANEL='mumei-notify-test-panel',N_BTN='mumei-notify-test-btn',N_CLEAN='mumei-notify-clean-btn';
const TEMPLATE_KEY='mumei_notify_template_v10';
const REGISTRY_KEY='mumei_notify_registry_v12';
const SEED_PENDING='mumei_notify_seed_pending_v12';
let busy=false,notifyBusy=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function editor(){return document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror')}
function status(t,bad=false){const p=document.getElementById(PANEL);if(!p)return;p.textContent=t;p.style.background=bad?'#991b1b':'#065f46'}
function nstatus(t,bad=false){const p=document.getElementById(N_PANEL);if(!p)return;p.textContent=t;p.style.background=bad?'#991b1b':'#1f2937';p.style.display='block'}
function emit(name,detail={}){document.dispatchEvent(new CustomEvent(name,{detail}))}
function norm(u){try{const x=new URL(u,location.href);x.search='';x.hash='';return x.href}catch(_){return String(u||'')}}
function sameSrc(a,b){const A=norm(a),B=norm(b);if(A===B)return true;const pa=A.split('/').pop(),pb=B.split('/').pop();return !!pa&&!!pb&&(pa===pb||pa.split('?')[0]===pb.split('?')[0])}
function getTemplate(){try{return JSON.parse(localStorage.getItem(TEMPLATE_KEY)||'null')}catch(_){return null}}
function saveTemplate(v){localStorage.setItem(TEMPLATE_KEY,JSON.stringify(v))}
function getRegistry(){try{const a=JSON.parse(localStorage.getItem(REGISTRY_KEY)||'[]');return Array.isArray(a)?a.filter(x=>x&&x.url&&x.type):[]}catch(_){return[]}}
function saveRegistry(a){const out=[],seen=new Set();for(const x of a){if(!x?.url||!x?.type)continue;const k=x.url+'|'+x.type;if(seen.has(k))continue;seen.add(k);out.push({url:x.url,type:x.type})}localStorage.setItem(REGISTRY_KEY,JSON.stringify(out));return out}
function rememberNotify(url,type){const a=getRegistry().filter(x=>x.url!==url);a.push({url,type});return saveRegistry(a)}
function isThinImage(img){if(!(img instanceof HTMLImageElement))return false;const r=img.getBoundingClientRect(),w=img.naturalWidth||r.width,h=img.naturalHeight||r.height;return h>0&&w/h>4.5}
function cards(){const root=editor();if(!root)return[];return [...root.querySelectorAll('img')].filter(isThinImage).slice(-10)}

function looksLikeView(v){try{return !!v&&typeof v==='object'&&v.state&&v.state.doc&&v.state.schema&&typeof v.dispatch==='function'&&v.dom&&typeof v.posAtDOM==='function'}catch(_){return false}}
function findView(){
 const root=editor();if(!root)return null;const seeds=[];let n=root;for(let i=0;i<6&&n;i++,n=n.parentElement)seeds.push(n);
 const seen=new Set(),q=[];const push=(v,d=0)=>{if(!v||seen.has(v)||d>7)return;if(typeof v!=='object'&&typeof v!=='function')return;seen.add(v);q.push([v,d])};seeds.forEach(s=>push(s,0));
 let steps=0;while(q.length&&steps<12000){steps++;const [v,d]=q.shift();if(looksLikeView(v))return v;let keys=[];try{keys=Object.getOwnPropertyNames(v)}catch(_){continue}for(const k of keys){if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k))continue;let x;try{x=v[k]}catch(_){continue}if(looksLikeView(x))return x;if(d<7&&x&&(typeof x==='object'||typeof x==='function')){if(x===window||x===document)continue;push(x,d+1)}}}return null
}
function findNodeForImg(view,img){
 let domPos=null;try{domPos=view.posAtDOM(img,0)}catch(_){}const candidates=[],doc=view.state.doc;
 if(Number.isInteger(domPos))for(const p of [domPos,domPos-1,domPos+1]){if(p<0||p>doc.content.size)continue;try{const node=doc.nodeAt(p);if(node)candidates.push({node,pos:p})}catch(_){}}
 let exact=null;doc.descendants((node,pos)=>{if(exact||!node.attrs)return;for(const [k,v] of Object.entries(node.attrs)){if(typeof v==='string'&&/src|image|url/i.test(k)&&sameSrc(v,img.src)){exact={node,pos};return false}}});
 if(exact)return exact;for(const c of candidates){if(/image|picture|photo/i.test(c.node.type?.name||''))return c;if(c.node.attrs&&Object.keys(c.node.attrs).some(k=>/src|image/i.test(k)))return c}return candidates[0]||null
}
function linkMarkType(schema){if(schema.marks?.link)return schema.marks.link;for(const [name,t] of Object.entries(schema.marks||{}))if(/link/i.test(name))return t;return null}
function buildLinkAttrs(type,url){const spec=type?.spec?.attrs||{},attrs={};for(const k of Object.keys(spec)){if(/href|url|link/i.test(k))attrs[k]=url;else if('default'in spec[k])attrs[k]=spec[k].default;else attrs[k]=null}if(!Object.keys(attrs).some(k=>/href|url|link/i.test(k)))attrs.href=url;return attrs}
function nodeHasLink(node,url){if(!node)return false;for(const m of node.marks||[]){if(/link/i.test(m.type?.name||'')&&Object.values(m.attrs||{}).map(String).includes(url))return true}for(const [k,v] of Object.entries(node.attrs||{}))if(/href|link|url/i.test(k)&&String(v)===url)return true;return false}
function attrKeys(node){const keys=new Set([...Object.keys(node.attrs||{}),...Object.keys(node.type?.spec?.attrs||{})]);return [...keys].filter(k=>/href|link|url/i.test(k))}
function trySetAttr(view,pos,node,url){for(const key of attrKeys(node)){try{view.dispatch(view.state.tr.setNodeMarkup(pos,node.type,{...node.attrs,[key]:url},node.marks));if(nodeHasLink(view.state.doc.nodeAt(pos),url))return true}catch(_){}}return false}
function trySetMark(view,pos,node,url){const type=linkMarkType(view.state.schema);if(!type)return false;let mark;try{mark=type.create(buildLinkAttrs(type,url))}catch(_){return false}try{const marks=(node.marks||[]).filter(m=>m.type!==type).concat(mark);view.dispatch(view.state.tr.setNodeMarkup(pos,node.type,node.attrs,marks));if(nodeHasLink(view.state.doc.nodeAt(pos),url))return true}catch(_){}try{view.dispatch(view.state.tr.addMark(pos,pos+node.nodeSize,mark));if(nodeHasLink(view.state.doc.nodeAt(pos),url))return true}catch(_){}return false}
function parentCandidates(view,pos){const out=[];try{const $p=view.state.doc.resolve(Math.max(0,Math.min(pos,view.state.doc.content.size)));for(let d=$p.depth;d>=1;d--){const node=$p.node(d);let p;try{p=$p.before(d)}catch(_){continue}out.push({node,pos:p})}}catch(_){}return out}
function nodeList(view,img){const hit=findNodeForImg(view,img);return hit?[hit,...parentCandidates(view,hit.pos)]:[]}
function alreadyLinked(view,img,url){return nodeList(view,img).some(c=>nodeHasLink(c.node,url))}
function setDirect(view,img,url){const list=nodeList(view,img);if(!list.length)return{ok:false};for(const c of list)if(trySetAttr(view,c.pos,c.node,url))return{ok:true};for(const c of list)if(trySetMark(view,c.pos,c.node,url))return{ok:true};return{ok:false}}
async function ensureLinks(view,imgs){let ok=0;for(let i=0;i<10;i++){if(alreadyLinked(view,imgs[i],URLS[i])){ok++;continue}status(`URL書き込み ${i+1}/10…`);let r={ok:false};for(let a=0;a<3;a++){r=setDirect(view,imgs[i],URLS[i]);if(r.ok)break;await sleep(300)}if(!r.ok)return{ok:false,index:i+1};ok++;await sleep(80)}return{ok:true}}
async function run(){if(busy)return;busy=true;const b=document.getElementById(BTN);if(b)b.disabled=true;try{const imgs=cards();if(imgs.length!==10){status(`カード ${imgs.length}/10`,true);emit('mumei-direct-stopped',{index:0,ok:0,reason:'cards'});return}const view=findView();if(!view){status('DIRECT停止：EditorViewなし',true);return}const r=await ensureLinks(view,imgs);if(!r.ok){status(`URL ${r.index}/10で停止 → 同じボタンで再開`,true);emit('mumei-direct-stopped',{index:r.index,reason:'link'});return}status('URL完了 10/10 ✅');emit('mumei-direct-success-done',{ok:10})}catch(e){status('DIRECTエラー：'+(e?.message||String(e)),true)}finally{busy=false;if(b)b.disabled=false}}

function nodeCarriesUrl(node,url){try{const s=JSON.stringify(node.toJSON?node.toJSON():node.attrs||{});return s.includes(url)||s.includes(url.split('/').pop())}catch(_){return false}}
function visibleDom(view,pos){try{const d=view.nodeDOM(pos);if(!(d instanceof Element)||!d.isConnected)return null;const r=d.getBoundingClientRect();return (r.width>0||r.height>0)?d:null}catch(_){return null}}
function containsThin(dom){if(!dom)return false;if(dom instanceof HTMLImageElement&&isThinImage(dom))return true;return [...dom.querySelectorAll('img')].some(isThinImage)}
function realNotifyCandidates(view,url,typeName=null){const out=[];view.state.doc.descendants((node,pos)=>{const name=node.type?.name||'';if(typeName&&name!==typeName)return;if(node.isTextblock||/image|picture|photo/i.test(name)||!nodeCarriesUrl(node,url))return;const dom=visibleDom(view,pos);if(!dom||containsThin(dom))return;let score=0;if(node.isAtom)score+=100;if(/embed|card|bookmark|oembed|external|preview|iframe/i.test(name))score+=80;if(score>0)out.push({node,pos,dom,score})});return out.sort((a,b)=>b.score-a.score)}
function findRealNotify(view,url,typeName=null){return realNotifyCandidates(view,url,typeName)[0]||null}
function deleteExactUrlParagraph(view,url){try{const hits=[];view.state.doc.descendants((node,pos)=>{if(node.isTextblock&&(node.textContent||'').trim()===url)hits.push({node,pos})});let tr=view.state.tr;for(const h of hits.sort((a,b)=>b.pos-a.pos))tr=tr.delete(h.pos,h.pos+h.node.nodeSize);if(hits.length)view.dispatch(tr)}catch(_){}}
function setSelectionAtEnd(view){try{const Sel=view.state.selection.constructor;view.dispatch(view.state.tr.setSelection(Sel.atEnd(view.state.doc)));view.focus()}catch(_){}}
function updateCleanButton(){const c=document.getElementById(N_CLEAN);if(!c)return;const n=getRegistry().length;c.textContent=n?`通知カード一括削除（${n}件）`:'通知カード一括削除';c.style.display=n?'block':'none'}
function currentNoteKey(){const m=location.pathname.match(/\/notes\/(n[0-9a-f]+)\/edit/i);return m?m[1]:null}
function findFirstEmbKey(v){let hit=null;const walk=x=>{if(hit)return;if(typeof x==='string'){const m=x.match(/emb[0-9a-z]+/i);if(m)hit=m[0];return}if(Array.isArray(x)){for(const y of x)walk(y);return}if(x&&typeof x==='object')for(const y of Object.values(x))walk(y)};walk(v);return hit}
function deepReplace(v,repls){if(typeof v==='string'){let s=v;for(const [a,b] of repls)if(a)s=s.split(a).join(b);return s}if(Array.isArray(v))return v.map(x=>deepReplace(x,repls));if(v&&typeof v==='object'){const o={};for(const [k,x] of Object.entries(v))o[k]=deepReplace(x,repls);return o}return v}
function csrfToken(){const m=document.querySelector('meta[name="csrf-token"],meta[name="csrf_token"]');if(m?.content)return m.content;for(const part of document.cookie.split(';')){const [k,...rest]=part.trim().split('=');if(/csrf|xsrf/i.test(k))return decodeURIComponent(rest.join('='))}return ''}
async function createOfficialEmbed(url){
 const embeddableKey=currentNoteKey();if(!embeddableKey)throw new Error('編集中記事のnキーを取得できません');
 const fd=new FormData();fd.append('url',url);fd.append('height','211');fd.append('embeddable_type','Note');fd.append('embeddable_key',embeddableKey);
 const headers={Accept:'application/json'};const csrf=csrfToken();if(csrf)headers['X-CSRF-Token']=csrf;
 const r=await fetch('https://note.com/api/v1/embed',{method:'POST',body:fd,credentials:'include',headers});
 let data=null;try{data=await r.json()}catch(_){}
 if(!r.ok)throw new Error(`埋め込みAPI ${r.status}${data?.message?'：'+data.message:''}`);
 const e=data?.data?.embedded_content;if(!e?.key||!e?.url)throw new Error('埋め込みAPI応答にembedded_contentがありません');
 return e
}
function buildNodeJsonFromOfficial(template,official,targetUrl){
 const sourceUrl=template.sourceUrl||URLS[0];const sourceKey=sourceUrl.split('/').pop();const targetKey=(official.identifier||targetUrl.split('/').pop());const oldEmb=findFirstEmbKey(template.json);
 const repls=[[sourceUrl,official.url||targetUrl],[sourceKey,targetKey]];if(oldEmb)repls.push([oldEmb,official.key]);
 return deepReplace(template.json,repls)
}
async function insertOfficialNode(view,url,official){
 const t=getTemplate();if(!t?.json)return null;const json=buildNodeJsonFromOfficial(t,official,url);let node;try{node=view.state.schema.nodeFromJSON(json)}catch(e){throw new Error('標準カード構造の復元失敗')}
 const pos=view.state.doc.content.size;view.dispatch(view.state.tr.insert(pos,node));
 const end=Date.now()+7000;while(Date.now()<end){const hit=findRealNotify(view,url);if(hit)return hit;await sleep(250)}return null
}
async function learnSeedIfNeeded(view){
 const existing=findRealNotify(view,URLS[0]);if(existing){saveTemplate({sourceUrl:URLS[0],type:existing.node.type.name,json:existing.node.toJSON()});localStorage.removeItem(SEED_PENDING);return existing}
 if(getTemplate())return true;
 if(!localStorage.getItem(SEED_PENDING)){
  deleteExactUrlParagraph(view,URLS[0]);const p=view.state.schema.nodes.paragraph;if(!p)throw new Error('paragraphなし');const start=view.state.doc.content.size;view.dispatch(view.state.tr.insert(start,p.create(null,view.state.schema.text(URLS[0]))));setSelectionAtEnd(view);localStorage.setItem(SEED_PENDING,'1');nstatus('初回だけ：末尾URLでEnterを1回 → 本物カードが出たら青ボタンをもう一度');return false
 }
 nstatus('本物カード待ち。末尾URLでEnterを1回 → カードが出たら青ボタンをもう一度',true);return false
}
async function notify10(){
 if(notifyBusy)return;notifyBusy=true;const b=document.getElementById(N_BTN);if(b)b.disabled=true;
 try{
  const view=findView();if(!view){nstatus('停止：EditorViewなし',true);return}const imgs=cards();if(imgs.length!==10){nstatus(`極薄画像 ${imgs.length}/10。先に緑の「10枚 COMPLETE 6.3」`,true);return}
  const links=await ensureLinks(view,imgs);if(!links.ok){nstatus(`極薄URL ${links.index}/10で停止`,true);return}
  const seedReady=await learnSeedIfNeeded(view);if(!seedReady)return;
  saveRegistry([]);updateCleanButton();
  for(let i=0;i<10;i++){
   const url=URLS[i];const already=findRealNotify(view,url);if(already){rememberNotify(url,already.node.type.name);updateCleanButton();nstatus(`公式通知カード ${i+1}/10（既存）`);continue}
   nstatus(`公式埋め込みAPI ${i+1}/10 → カード生成中…`);const official=await createOfficialEmbed(url);const hit=await insertOfficialNode(view,url,official);if(!hit){nstatus(`公式カード ${i+1}/10で停止`,true);return}rememberNotify(url,hit.node.type.name);updateCleanButton();await sleep(150)
  }
  localStorage.removeItem(SEED_PENDING);nstatus('公式通知カード 10/10 ✅ 公開して通知確認')
 }catch(e){nstatus('通知10件停止：'+(e?.message||String(e)),true)}finally{notifyBusy=false;if(b)b.disabled=false}
}
function cleanAllNotifyCards(){const c=document.getElementById(N_CLEAN);if(c)c.disabled=true;try{const view=findView();if(!view){nstatus('削除停止：EditorViewなし',true);return}const reg=getRegistry();if(!reg.length){nstatus('削除対象 0件');return}const hits=[];for(const rec of reg){const h=findRealNotify(view,rec.url,rec.type);if(h)hits.push(h)}if(!hits.length){nstatus('削除対象カードなし',true);return}let tr=view.state.tr;for(const h of hits.sort((a,b)=>b.pos-a.pos))tr=tr.delete(h.pos,h.pos+h.node.nodeSize);view.dispatch(tr);saveRegistry([]);updateCleanButton();nstatus(`通知カード ${hits.length}/${hits.length} 一括削除 ✅ 極薄10枚は残しました`)}catch(e){nstatus('削除停止：'+(e?.message||String(e)),true)}finally{if(c)c.disabled=false}}

function mountNotify(){if(!document.body)return;let p=document.getElementById(N_PANEL);if(!p){p=document.createElement('div');p.id=N_PANEL;p.textContent='公式10件通知テスト';document.body.appendChild(p)}Object.assign(p.style,{position:'fixed',right:'8px',bottom:'170px',zIndex:'2147483645',maxWidth:'310px',padding:'6px 8px',borderRadius:'8px',background:'#1f2937',color:'#fff',fontSize:'10px',lineHeight:'1.3',boxShadow:'0 3px 12px rgba(0,0,0,.25)',pointerEvents:'none'});
 let b=document.getElementById(N_BTN);if(!b){b=document.createElement('button');b.id=N_BTN;b.type='button';b.textContent='公式通知カード10件';b.addEventListener('click',notify10);document.body.appendChild(b)}Object.assign(b.style,{position:'fixed',right:'8px',bottom:'125px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'10px 13px',background:'#2563eb',color:'#fff',fontSize:'13px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});
 let c=document.getElementById(N_CLEAN);if(!c){c=document.createElement('button');c.id=N_CLEAN;c.type='button';c.addEventListener('click',cleanAllNotifyCards);document.body.appendChild(c)}Object.assign(c.style,{position:'fixed',right:'8px',bottom:'80px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'9px 12px',background:'#b45309',color:'#fff',fontSize:'12px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});updateCleanButton()}
function mount(){if(!document.body)return;if(!document.getElementById(PANEL)){const p=document.createElement('div');p.id=PANEL;p.textContent='DIRECT SUCCESS 3.12';Object.assign(p.style,{position:'fixed',right:'8px',top:'72px',zIndex:'2147483646',maxWidth:'340px',padding:'6px 8px',borderRadius:'8px',background:'#065f46',color:'#fff',fontSize:'11px',lineHeight:'1.3',boxShadow:'0 4px 12px rgba(0,0,0,.25)',pointerEvents:'none'});document.body.appendChild(p)}if(!document.getElementById(BTN)){const b=document.createElement('button');b.id=BTN;b.type='button';b.textContent='DIRECT SUCCESS 3.0';Object.assign(b.style,{position:'fixed',right:'8px',top:'110px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'10px 13px',background:'#059669',color:'#fff',fontSize:'13px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});b.addEventListener('click',run);document.body.appendChild(b)}mountNotify()}
setInterval(mount,800);mount();
})();
