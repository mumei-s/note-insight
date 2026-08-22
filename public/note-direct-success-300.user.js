// ==UserScript==
// @name         無名S note DIRECT SUCCESS 3.0
// @namespace    https://github.com/mumei-s/note-insight/direct-success-300
// @version      3.5.0
// @description  成功済みProseMirror DIRECT URL設定版。実表示確認付きnote通知カード生成・再試行・一括削除
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
'use strict';
if(window.__MUMEI_DIRECT_SUCCESS_350__) return;
window.__MUMEI_DIRECT_SUCCESS_350__=true;

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
const TEST_URL=URLS[0];
const PANEL='mumei-direct-success-panel',BTN='mumei-direct-success-btn';
const N_PANEL='mumei-notify-test-panel',N_BTN='mumei-notify-test-btn',N_CLEAN='mumei-notify-clean-btn';
const REGISTRY_KEY='mumei_notify_registry_v1';
let busy=false,testBusy=false,testArmed=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function editor(){return document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror')}
function status(t,bad=false){const p=document.getElementById(PANEL);if(!p)return;p.textContent=t;p.style.background=bad?'#991b1b':'#065f46'}
function nstatus(t,bad=false){const p=document.getElementById(N_PANEL);if(!p)return;p.textContent=t;p.style.background=bad?'#991b1b':'#1f2937';p.style.display='block'}
function emit(name,detail={}){document.dispatchEvent(new CustomEvent(name,{detail}))}
function norm(u){try{const x=new URL(u,location.href);x.search='';x.hash='';return x.href}catch(_){return String(u||'')}}
function sameSrc(a,b){const A=norm(a),B=norm(b);if(A===B)return true;const pa=A.split('/').pop(),pb=B.split('/').pop();return !!pa&&!!pb&&pa===pb}
function getRegistry(){try{const a=JSON.parse(localStorage.getItem(REGISTRY_KEY)||'[]');return Array.isArray(a)?a.filter(x=>x&&x.url&&x.type):[]}catch(_){return[]}}
function saveRegistry(a){const out=[],seen=new Set();for(const x of a){if(!x?.url||!x?.type)continue;const k=x.url+'|'+x.type;if(seen.has(k))continue;seen.add(k);out.push({url:x.url,type:x.type})}localStorage.setItem(REGISTRY_KEY,JSON.stringify(out));return out}
function rememberNotify(url,type){const a=getRegistry();a.push({url,type});return saveRegistry(a)}
function forgetNotifyUrl(url){return saveRegistry(getRegistry().filter(x=>x.url!==url))}

function wideImages(){const root=editor();if(!root)return[];return [...root.querySelectorAll('img')].filter(img=>{const r=img.getBoundingClientRect(),w=img.naturalWidth||r.width,h=img.naturalHeight||r.height;return h>0&&w/h>4.5})}
function cards(){return wideImages().slice(-10)}
function looksLikeView(v){try{return !!v&&typeof v==='object'&&v.state&&v.state.doc&&v.state.schema&&typeof v.dispatch==='function'&&v.dom&&typeof v.posAtDOM==='function'}catch(_){return false}}
function findView(){
 const root=editor();if(!root)return null;const seeds=[];let n=root;for(let i=0;i<6&&n;i++,n=n.parentElement)seeds.push(n);
 const seen=new Set(),q=[];const push=(v,d=0)=>{if(!v||seen.has(v)||d>7)return;if(typeof v!=='object'&&typeof v!=='function')return;seen.add(v);q.push([v,d])};seeds.forEach(s=>push(s));
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
function nodeHasLink(node,url){if(!node)return false;for(const m of node.marks||[]){if(/link/i.test(m.type?.name||'')){if(Object.values(m.attrs||{}).map(String).includes(url))return true}}for(const [k,v] of Object.entries(node.attrs||{}))if(/href|link|url/i.test(k)&&String(v)===url)return true;return false}
function attrKeys(node){const keys=new Set([...Object.keys(node.attrs||{}),...Object.keys(node.type?.spec?.attrs||{})]);return [...keys].filter(k=>/href|link|url/i.test(k))}
function trySetAttr(view,pos,node,url){for(const key of attrKeys(node)){try{view.dispatch(view.state.tr.setNodeMarkup(pos,node.type,{...node.attrs,[key]:url},node.marks));const fresh=view.state.doc.nodeAt(pos);if(nodeHasLink(fresh,url))return true}catch(_){}}return false}
function trySetMark(view,pos,node,url){const type=linkMarkType(view.state.schema);if(!type)return false;let mark;try{mark=type.create(buildLinkAttrs(type,url))}catch(_){return false}try{const marks=(node.marks||[]).filter(m=>m.type!==type).concat(mark);view.dispatch(view.state.tr.setNodeMarkup(pos,node.type,node.attrs,marks));if(nodeHasLink(view.state.doc.nodeAt(pos),url))return true}catch(_){}try{view.dispatch(view.state.tr.addMark(pos,pos+node.nodeSize,mark));if(nodeHasLink(view.state.doc.nodeAt(pos),url))return true}catch(_){}return false}
function parentCandidates(view,pos){const out=[];try{const $p=view.state.doc.resolve(Math.max(0,Math.min(pos,view.state.doc.content.size)));for(let d=$p.depth;d>=1;d--){const node=$p.node(d);let p;try{p=$p.before(d)}catch(_){continue}out.push({node,pos:p})}}catch(_){}return out}
function nodeList(view,img){const hit=findNodeForImg(view,img);return hit?[hit,...parentCandidates(view,hit.pos)]:[]}
function alreadyLinked(view,img,url){return nodeList(view,img).some(c=>nodeHasLink(c.node,url))}
function setDirect(view,img,url){const list=nodeList(view,img);if(!list.length)return{ok:false,reason:'node'};for(const c of list)if(trySetAttr(view,c.pos,c.node,url))return{ok:true};for(const c of list)if(trySetMark(view,c.pos,c.node,url))return{ok:true};return{ok:false,reason:'schema'}}

async function run(){
 if(busy)return;busy=true;const b=document.getElementById(BTN);if(b)b.disabled=true;
 try{const imgs=cards();if(imgs.length!==10){status(`カード ${imgs.length}/10`,true);emit('mumei-direct-stopped',{index:0,ok:0,reason:'cards'});return}const view=findView();if(!view){status('DIRECT停止：EditorViewなし',true);emit('mumei-direct-stopped',{index:0,ok:0,reason:'view'});return}let ok=0;
 for(let i=0;i<10;i++){const index=i+1;if(alreadyLinked(view,imgs[i],URLS[i])){ok++;status(`URL書き込み ${index}/10（設定済み）`);emit('mumei-direct-progress',{index,ok,skipped:true});continue}status(`URL書き込み ${index}/10…`);emit('mumei-direct-progress',{index,ok});let r={ok:false,reason:'unknown'};for(let a=0;a<3;a++){r=setDirect(view,imgs[i],URLS[i]);if(r.ok)break;await sleep(350)}if(!r.ok){status(`URL ${index}/10で停止 → 同じボタンで再開`,true);if(b)b.textContent=`${index}枚目から再開`;emit('mumei-direct-stopped',{index,ok,reason:r.reason});return}ok++;await sleep(100)}
 if(b)b.textContent='DIRECT SUCCESS 3.0';status('URL完了 10/10 ✅');emit('mumei-direct-success-done',{ok:10})
 }catch(e){status('DIRECTエラー：'+(e?.message||String(e)),true);emit('mumei-direct-stopped',{index:0,ok:0,reason:'exception'})}finally{busy=false;if(b)b.disabled=false}
}

function nodeCarriesUrl(node,url){if(!node||!node.attrs)return false;const key=url.split('/').pop();try{const s=JSON.stringify(node.attrs);return s.includes(url)||s.includes(key)}catch(_){return false}}
function isEmbedNode(node){const name=node?.type?.name||'';return !!node&&!node.isTextblock&&!/image|picture|photo/i.test(name)&&(node.isAtom||/embed|card|bookmark|oembed|external|iframe|preview/i.test(name))}
function embedHits(view,url,typeName=null){const out=[];view.state.doc.descendants((node,pos)=>{if(typeName&&node.type?.name!==typeName)return;if(isEmbedNode(node)&&nodeCarriesUrl(node,url))out.push({node,pos})});return out}
function visibleDom(view,pos){try{const d=view.nodeDOM(pos);if(!(d instanceof Element)||!d.isConnected)return null;const r=d.getBoundingClientRect();return (r.width>0||r.height>0)?d:null}catch(_){return null}}
function findVisibleEmbed(view,url,typeName=null){for(const h of embedHits(view,url,typeName)){if(visibleDom(view,h.pos))return h}return null}
function findAnyEmbed(view,url,typeName=null){return embedHits(view,url,typeName)[0]||null}
function setCursor(view,pos){try{const Sel=view.state.selection.constructor;let s=null;if(typeof Sel.near==='function')s=Sel.near(view.state.doc.resolve(Math.max(0,Math.min(pos,view.state.doc.content.size))),-1);else if(typeof Sel.atEnd==='function')s=Sel.atEnd(view.state.doc);if(s)view.dispatch(view.state.tr.setSelection(s));view.focus();return true}catch(_){return false}}
function invokeNativeEnter(view){
 const ev=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true});let handled=false;
 try{if(typeof view.someProp==='function')view.someProp('handleKeyDown',fn=>{try{if(fn(view,ev)){handled=true;return true}}catch(_){}return false})}catch(_){}
 if(!handled){try{if(typeof view.someProp==='function')view.someProp('handleDOMEvents',handlers=>{const fn=handlers?.keydown;if(typeof fn!=='function')return false;try{if(fn(view,ev)){handled=true;return true}}catch(_){}return false})}catch(_){}}
 if(!handled){try{view.dom.dispatchEvent(ev);handled=ev.defaultPrevented}catch(_){}}
 return handled
}
function deleteExactUrlParagraph(view,url){try{let target=null;view.state.doc.descendants((node,pos)=>{if(target||!node.isTextblock)return;const txt=(node.textContent||'').trim();if(txt===url)target={node,pos}});if(target)view.dispatch(view.state.tr.delete(target.pos,target.pos+target.node.nodeSize))}catch(_){}}
function purgeRegisteredPhantom(view,url){
 const reg=getRegistry().filter(x=>x.url===url);if(!reg.length)return false;
 let tr=view.state.tr,changed=false;
 const hits=[];for(const rec of reg)for(const h of embedHits(view,url,rec.type))if(!visibleDom(view,h.pos))hits.push(h);
 for(const h of hits.sort((a,b)=>b.pos-a.pos)){try{tr=tr.delete(h.pos,h.pos+h.node.nodeSize);changed=true}catch(_){}}
 if(changed)view.dispatch(tr);forgetNotifyUrl(url);updateCleanButton();return changed
}
async function waitVisibleEmbed(view,url,ms=12000){const end=Date.now()+ms;while(Date.now()<end){const h=findVisibleEmbed(view,url);if(h)return h;await sleep(250)}return null}
async function createNotificationCard(view,url){
 const existing=findVisibleEmbed(view,url);if(existing)return{hit:existing,existing:true};
 purgeRegisteredPhantom(view,url);deleteExactUrlParagraph(view,url);
 const p=view.state.schema.nodes.paragraph;if(!p)return null;
 const start=view.state.doc.content.size;try{view.dispatch(view.state.tr.insert(start,p.create(null,view.state.schema.text(url))))}catch(_){return null}
 const cursor=Math.min(start+1+url.length,view.state.doc.content.size);setCursor(view,cursor);await sleep(120);invokeNativeEnter(view);
 const hit=await waitVisibleEmbed(view,url,12000);if(hit)return{hit,existing:false};
 deleteExactUrlParagraph(view,url);return null
}

function updateCleanButton(){const c=document.getElementById(N_CLEAN);if(!c)return;const n=getRegistry().length;c.textContent=n?`通知カード一括削除（${n}件）`:'通知カード一括削除';c.style.display=n?'block':'none'}
function collectRegisteredHits(view,registry){const hits=[];for(const rec of registry)for(const h of embedHits(view,rec.url,rec.type))hits.push(h);const out=[],seen=new Set();for(const h of hits){const k=h.pos+'|'+h.node.nodeSize;if(!seen.has(k)){seen.add(k);out.push(h)}}return out}
function cleanAllNotifyCards(){const c=document.getElementById(N_CLEAN);if(c)c.disabled=true;try{const view=findView();if(!view){nstatus('削除停止：EditorViewなし',true);return}const reg=getRegistry();if(!reg.length){nstatus('削除対象 0件');return}const hits=collectRegisteredHits(view,reg);if(!hits.length){nstatus('本文内の通知カード 0件');saveRegistry([]);updateCleanButton();return}let tr=view.state.tr;for(const h of hits.sort((a,b)=>b.pos-a.pos))tr=tr.delete(h.pos,h.pos+h.node.nodeSize);view.dispatch(tr);saveRegistry([]);nstatus(`通知カード ${hits.length}/${hits.length} 一括削除 ✅ 極薄画像は残っています`);updateCleanButton()}catch(e){nstatus('削除停止：'+(e?.message||String(e)),true)}finally{if(c)c.disabled=false}}

async function finishCombinedTest(img){
 if(testBusy)return;testBusy=true;const nb=document.getElementById(N_BTN);if(nb)nb.disabled=true;
 try{const view=findView();if(!view){nstatus('完成形テスト停止：EditorViewなし',true);return}if(!img){nstatus('完成形テスト停止：極薄画像が見つかりません',true);return}
 if(!alreadyLinked(view,img,TEST_URL)){nstatus('極薄画像 1/1 ✅ → 画像URL設定中…');let r={ok:false};for(let a=0;a<3;a++){r=setDirect(view,img,TEST_URL);if(r.ok)break;await sleep(300)}if(!r.ok){nstatus('完成形テスト停止：画像URL設定に失敗',true);return}}
 else nstatus('極薄画像＋画像URL 1/1 ✅ → 通知カード再生成中…');
 const registered=getRegistry().find(x=>x.url===TEST_URL);if(registered){const visible=findVisibleEmbed(view,TEST_URL,registered.type);if(visible){nstatus('完成形テスト 1/1 ✅ 極薄画像＋通知カード。公開して通知確認');emit('mumei-combined-test-complete',{url:TEST_URL,type:visible.node.type.name});return}purgeRegisteredPhantom(view,TEST_URL)}
 const foreign=findVisibleEmbed(view,TEST_URL);if(foreign&&!getRegistry().some(x=>x.url===TEST_URL&&x.type===foreign.node.type.name)){nstatus('同じ記事の既存標準カードがあります。これは削除対象にしません',true);return}
 nstatus('画像URL 1/1 ✅ → note標準カードを実表示で生成中…');const made=await createNotificationCard(view,TEST_URL);if(!made){nstatus('停止：note標準カードが画面に生成されませんでした',true);return}
 if(made.existing&&!getRegistry().some(x=>x.url===TEST_URL&&x.type===made.hit.node.type.name)){nstatus('既存の標準カードを検出。削除対象には登録しません',true);return}
 rememberNotify(TEST_URL,made.hit.node.type.name);updateCleanButton();nstatus('完成形テスト 1/1 ✅ 極薄画像＋通知カード。公開して通知確認');emit('mumei-combined-test-complete',{url:TEST_URL,type:made.hit.node.type.name})
 }catch(e){nstatus('完成形テスト停止：'+(e?.message||String(e)),true)}finally{testBusy=false;if(nb)nb.disabled=false}
}
function startCombinedTest(){
 if(testBusy||testArmed)return;const view=findView();if(view){purgeRegisteredPhantom(view,TEST_URL);const existing=[...wideImages()].reverse().find(img=>alreadyLinked(view,img,TEST_URL));if(existing){nstatus('前回の極薄画像を再利用 → 通知カードだけ再生成');finishCombinedTest(existing);return}}
 testArmed=true;nstatus('完成形テスト：極薄画像1枚を準備中…');emit('mumei-combined-test-request',{url:TEST_URL});setTimeout(()=>{if(testArmed){testArmed=false;nstatus('COMPLETE 6.3が応答しません。2本とも更新して再読み込み',true)}},2500)
}
document.addEventListener('mumei-combined-test-armed',()=>{testArmed=false;nstatus('テスト準備OK → 本文タップ →「＋」→「画像」を1回')});
document.addEventListener('mumei-combined-test-image-ready',e=>{const src=e.detail?.src||'';const img=wideImages().find(x=>src&&sameSrc(x.src,src))||wideImages().slice(-1)[0];finishCombinedTest(img)});

function mountNotify(){if(!document.body)return;let p=document.getElementById(N_PANEL);if(!p){p=document.createElement('div');p.id=N_PANEL;p.textContent='完成形通知テスト';document.body.appendChild(p)}Object.assign(p.style,{position:'fixed',right:'8px',bottom:'170px',zIndex:'2147483645',maxWidth:'280px',padding:'6px 8px',borderRadius:'8px',background:'#1f2937',color:'#fff',fontSize:'10px',lineHeight:'1.3',boxShadow:'0 3px 12px rgba(0,0,0,.25)',pointerEvents:'none'});let b=document.getElementById(N_BTN);if(!b){b=document.createElement('button');b.id=N_BTN;b.type='button';b.textContent='画像＋通知テスト 1件';b.addEventListener('click',startCombinedTest);document.body.appendChild(b)}Object.assign(b.style,{position:'fixed',right:'8px',bottom:'125px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'10px 13px',background:'#2563eb',color:'#fff',fontSize:'13px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});let c=document.getElementById(N_CLEAN);if(!c){c=document.createElement('button');c.id=N_CLEAN;c.type='button';c.addEventListener('click',cleanAllNotifyCards);document.body.appendChild(c)}Object.assign(c.style,{position:'fixed',right:'8px',bottom:'80px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'9px 12px',background:'#b45309',color:'#fff',fontSize:'12px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});updateCleanButton()}
function mount(){if(!document.body)return;if(!document.getElementById(PANEL)){const p=document.createElement('div');p.id=PANEL;p.textContent='DIRECT SUCCESS 3.5';Object.assign(p.style,{position:'fixed',right:'8px',top:'72px',zIndex:'2147483646',maxWidth:'340px',padding:'6px 8px',borderRadius:'8px',background:'#065f46',color:'#fff',fontSize:'11px',lineHeight:'1.3',boxShadow:'0 4px 12px rgba(0,0,0,.25)',pointerEvents:'none'});document.body.appendChild(p)}if(!document.getElementById(BTN)){const b=document.createElement('button');b.id=BTN;b.type='button';b.textContent='DIRECT SUCCESS 3.0';Object.assign(b.style,{position:'fixed',right:'8px',top:'110px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'10px 13px',background:'#059669',color:'#fff',fontSize:'13px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});b.addEventListener('click',run);document.body.appendChild(b)}mountNotify()}
setInterval(mount,800);mount();
})();
