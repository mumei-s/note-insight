// ==UserScript==
// @name         無名S note DIRECT SUCCESS 3.0
// @namespace    https://github.com/mumei-s/note-insight/direct-success-300
// @version      3.15.0
// @description  極薄10枚DIRECT URL＋note実リクエスト捕獲＋同一ノード型attrs差替えで公式通知カード10件＋一括削除
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
'use strict';
if(window.__MUMEI_DIRECT_SUCCESS_3150__) return;
window.__MUMEI_DIRECT_SUCCESS_3150__=true;

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

const PANEL='mumei-direct-success-panel', BTN='mumei-direct-success-btn';
const N_PANEL='mumei-notify-test-panel', N_BTN='mumei-notify-test-btn', N_CLEAN='mumei-notify-clean-btn';
const CAP='mumei_capture_v315', REG='mumei_registry_v315';
let busy=false, notifyBusy=false, captureArmed=false, replaying=false, watcher=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function editor(){return document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror')}
function status(t,bad=false){const p=document.getElementById(PANEL);if(p){p.textContent=t;p.style.background=bad?'#991b1b':'#065f46'}}
function nstatus(t,bad=false){const p=document.getElementById(N_PANEL);if(p){p.textContent=t;p.style.background=bad?'#991b1b':'#1f2937'}}
function emit(name,detail={}){document.dispatchEvent(new CustomEvent(name,{detail}))}
function getj(k,d=null){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??d}catch(_){return d}}
function setj(k,v){if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v))}
function registry(){const a=getj(REG,[]);return Array.isArray(a)?a:[]}
function saveRegistry(a){const out=[],seen=new Set();for(const x of a){if(!x?.url||!x?.type)continue;const k=x.url+'|'+x.type;if(seen.has(k))continue;seen.add(k);out.push({url:x.url,type:x.type})}setj(REG,out);updateClean();return out}
function remember(url,type){saveRegistry([...registry().filter(x=>x.url!==url),{url,type}])}
function norm(u){try{const x=new URL(u,location.href);x.search='';x.hash='';return x.href}catch(_){return String(u||'')}}
function sameSrc(a,b){const A=norm(a),B=norm(b);if(A===B)return true;const pa=A.split('/').pop(),pb=B.split('/').pop();return !!pa&&!!pb&&pa.split('?')[0]===pb.split('?')[0]}
function isThin(img){if(!(img instanceof HTMLImageElement))return false;const r=img.getBoundingClientRect(),w=img.naturalWidth||r.width,h=img.naturalHeight||r.height;return h>0&&w/h>4.5}
function cards(){const e=editor();return e?[...e.querySelectorAll('img')].filter(isThin).slice(-10):[]}

function mount(){
 if(!document.body)return;
 let p=document.getElementById(PANEL);
 if(!p){p=document.createElement('div');p.id=PANEL;document.body.appendChild(p)}
 p.textContent=p.textContent||'DIRECT SUCCESS 3.15';
 Object.assign(p.style,{position:'fixed',right:'8px',top:'72px',zIndex:'2147483646',maxWidth:'340px',padding:'6px 8px',borderRadius:'8px',background:'#065f46',color:'#fff',fontSize:'11px',lineHeight:'1.3',boxShadow:'0 4px 12px rgba(0,0,0,.25)',pointerEvents:'none',display:'block'});
 let b=document.getElementById(BTN);
 if(!b){b=document.createElement('button');b.id=BTN;b.type='button';b.textContent='DIRECT SUCCESS 3.0';b.addEventListener('click',runLinks);document.body.appendChild(b)}
 Object.assign(b.style,{position:'fixed',right:'8px',top:'110px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'10px 13px',background:'#059669',color:'#fff',fontSize:'13px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});
 let np=document.getElementById(N_PANEL);
 if(!np){np=document.createElement('div');np.id=N_PANEL;np.textContent='10件通知 READY';document.body.appendChild(np)}
 Object.assign(np.style,{position:'fixed',right:'8px',bottom:'170px',zIndex:'2147483646',maxWidth:'330px',padding:'6px 8px',borderRadius:'8px',background:'#1f2937',color:'#fff',fontSize:'10px',lineHeight:'1.3',boxShadow:'0 3px 12px rgba(0,0,0,.25)',pointerEvents:'none',display:'block'});
 let nb=document.getElementById(N_BTN);
 if(!nb){nb=document.createElement('button');nb.id=N_BTN;nb.type='button';nb.textContent='通知カード10件 FINAL';nb.addEventListener('click',notify10);document.body.appendChild(nb)}
 Object.assign(nb.style,{position:'fixed',right:'8px',bottom:'125px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'10px 13px',background:'#2563eb',color:'#fff',fontSize:'13px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation',display:'block',visibility:'visible',opacity:'1'});
 let c=document.getElementById(N_CLEAN);
 if(!c){c=document.createElement('button');c.id=N_CLEAN;c.type='button';c.addEventListener('click',cleanCards);document.body.appendChild(c)}
 Object.assign(c.style,{position:'fixed',right:'8px',bottom:'80px',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'9px 12px',background:'#b45309',color:'#fff',fontSize:'12px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'});
 updateClean();
}
function updateClean(){const c=document.getElementById(N_CLEAN);if(!c)return;const n=registry().length;c.textContent=n?`通知カード一括削除（${n}件）`:'通知カード一括削除';c.style.display=n?'block':'none'}
mount();setInterval(mount,700);

function looksLikeView(v){try{return !!v&&typeof v==='object'&&v.state?.doc&&v.state?.schema&&typeof v.dispatch==='function'&&v.dom&&typeof v.posAtDOM==='function'}catch(_){return false}}
function findView(){const root=editor();if(!root)return null;const seeds=[];let n=root;for(let i=0;i<6&&n;i++,n=n.parentElement)seeds.push(n);const seen=new Set(),q=[];const push=(v,d=0)=>{if(!v||seen.has(v)||d>7)return;if(typeof v!=='object'&&typeof v!=='function')return;seen.add(v);q.push([v,d])};seeds.forEach(s=>push(s));let steps=0;while(q.length&&steps<12000){steps++;const [v,d]=q.shift();if(looksLikeView(v))return v;let keys=[];try{keys=Object.getOwnPropertyNames(v)}catch(_){continue}for(const k of keys){if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k))continue;let x;try{x=v[k]}catch(_){continue}if(looksLikeView(x))return x;if(d<7&&x&&(typeof x==='object'||typeof x==='function')&&x!==window&&x!==document)push(x,d+1)}}return null}
function findNodeForImg(view,img){let domPos=null;try{domPos=view.posAtDOM(img,0)}catch(_){}const candidates=[],doc=view.state.doc;if(Number.isInteger(domPos))for(const p of [domPos,domPos-1,domPos+1]){if(p<0||p>doc.content.size)continue;try{const node=doc.nodeAt(p);if(node)candidates.push({node,pos:p})}catch(_){}}let exact=null;doc.descendants((node,pos)=>{if(exact||!node.attrs)return;for(const [k,v] of Object.entries(node.attrs)){if(typeof v==='string'&&/src|image|url/i.test(k)&&sameSrc(v,img.src)){exact={node,pos};return false}}});if(exact)return exact;for(const c of candidates){if(/image|picture|photo/i.test(c.node.type?.name||''))return c;if(c.node.attrs&&Object.keys(c.node.attrs).some(k=>/src|image/i.test(k)))return c}return candidates[0]||null}
function parentCandidates(view,pos){const out=[];try{const $p=view.state.doc.resolve(Math.max(0,Math.min(pos,view.state.doc.content.size)));for(let d=$p.depth;d>=1;d--){const node=$p.node(d);let p;try{p=$p.before(d)}catch(_){continue}out.push({node,pos:p})}}catch(_){}return out}
function nodeList(view,img){const hit=findNodeForImg(view,img);return hit?[hit,...parentCandidates(view,hit.pos)]:[]}
function nodeHasLink(node,url){if(!node)return false;for(const m of node.marks||[])if(/link/i.test(m.type?.name||'')&&Object.values(m.attrs||{}).map(String).includes(url))return true;for(const [k,v] of Object.entries(node.attrs||{}))if(/href|link|url/i.test(k)&&String(v)===url)return true;return false}
function alreadyLinked(view,img,url){return nodeList(view,img).some(c=>nodeHasLink(c.node,url))}
function linkMarkType(schema){if(schema.marks?.link)return schema.marks.link;for(const [name,t] of Object.entries(schema.marks||{}))if(/link/i.test(name))return t;return null}
function buildLinkAttrs(type,url){const spec=type?.spec?.attrs||{},attrs={};for(const k of Object.keys(spec)){if(/href|url|link/i.test(k))attrs[k]=url;else if('default'in spec[k])attrs[k]=spec[k].default;else attrs[k]=null}if(!Object.keys(attrs).some(k=>/href|url|link/i.test(k)))attrs.href=url;return attrs}
function trySetAttr(view,pos,node,url){const keys=new Set([...Object.keys(node.attrs||{}),...Object.keys(node.type?.spec?.attrs||{})]);for(const key of [...keys].filter(k=>/href|link|url/i.test(k))){try{view.dispatch(view.state.tr.setNodeMarkup(pos,node.type,{...node.attrs,[key]:url},node.marks));if(nodeHasLink(view.state.doc.nodeAt(pos),url))return true}catch(_){}}return false}
function trySetMark(view,pos,node,url){const type=linkMarkType(view.state.schema);if(!type)return false;let mark;try{mark=type.create(buildLinkAttrs(type,url))}catch(_){return false}try{const marks=(node.marks||[]).filter(m=>m.type!==type).concat(mark);view.dispatch(view.state.tr.setNodeMarkup(pos,node.type,node.attrs,marks));if(nodeHasLink(view.state.doc.nodeAt(pos),url))return true}catch(_){}return false}
function setDirect(view,img,url){const list=nodeList(view,img);for(const c of list)if(trySetAttr(view,c.pos,c.node,url))return true;for(const c of list)if(trySetMark(view,c.pos,c.node,url))return true;return false}
async function ensureLinks(view,imgs){for(let i=0;i<10;i++){if(alreadyLinked(view,imgs[i],URLS[i]))continue;status(`URL書き込み ${i+1}/10…`);let ok=false;for(let a=0;a<3;a++){ok=setDirect(view,imgs[i],URLS[i]);if(ok)break;await sleep(250)}if(!ok)return{i:i+1};await sleep(60)}return null}
async function runLinks(){if(busy)return;busy=true;const b=document.getElementById(BTN);if(b)b.disabled=true;try{const imgs=cards();if(imgs.length!==10){status(`カード ${imgs.length}/10`,true);return}const view=findView();if(!view){status('DIRECT停止：EditorViewなし',true);return}const err=await ensureLinks(view,imgs);if(err){status(`URL ${err.i}/10で停止`,true);return}status('URL完了 10/10 ✅');emit('mumei-direct-success-done',{ok:10})}catch(e){status('DIRECTエラー：'+(e?.message||String(e)),true)}finally{busy=false;if(b)b.disabled=false}}

function nodeCarriesUrl(node,url){try{const s=JSON.stringify(node.toJSON?node.toJSON():node.attrs||{});return s.includes(url)||s.includes(url.split('/').pop())}catch(_){return false}}
function visibleDom(view,pos){try{const d=view.nodeDOM(pos);if(!(d instanceof Element)||!d.isConnected)return null;const r=d.getBoundingClientRect();return (r.width>0||r.height>0)?d:null}catch(_){return null}}
function containsThin(dom){if(!dom)return false;if(dom instanceof HTMLImageElement&&isThin(dom))return true;return [...dom.querySelectorAll('img')].some(isThin)}
function notifyHits(view,url,type=null){const out=[];view.state.doc.descendants((node,pos)=>{const name=node.type?.name||'';if(type&&name!==type)return;if(node.isTextblock||/image|picture|photo/i.test(name)||!nodeCarriesUrl(node,url))return;const dom=visibleDom(view,pos);if(!dom||containsThin(dom))return;let score=(node.isAtom?100:0)+(/embed|card|bookmark|oembed|external|preview|iframe/i.test(name)?80:0);if(score>0)out.push({node,pos,dom,score})});return out.sort((a,b)=>b.pos-a.pos)}
function findNotify(view,url,type=null){return notifyHits(view,url,type)[0]||null}
function deleteUrlParagraph(view,url){const hits=[];view.state.doc.descendants((node,pos)=>{if(node.isTextblock&&(node.textContent||'').trim()===url)hits.push({node,pos})});if(!hits.length)return;let tr=view.state.tr;for(const h of hits.sort((a,b)=>b.pos-a.pos))tr=tr.delete(h.pos,h.pos+h.node.nodeSize);view.dispatch(tr)}
function cursorEnd(view){try{const Sel=view.state.selection.constructor;view.dispatch(view.state.tr.setSelection(Sel.atEnd(view.state.doc)));view.focus()}catch(_){}}

function headersObj(h){const out={};try{new Headers(h||{}).forEach((v,k)=>out[k]=v)}catch(_){}return out}
function snapBody(body){if(body instanceof FormData)return{type:'formdata',fields:[...body.entries()].filter(([,v])=>typeof v==='string')};if(body instanceof URLSearchParams)return{type:'urlsearch',fields:[...body.entries()]};if(typeof body==='string'){try{return{type:'json',value:JSON.parse(body)}}catch(_){return{type:'text',value:body}}}return{type:'none'}}
function isEmbedReq(url,method){return /\/api\/v1\/embed(?:\?|$)/.test(String(url||''))&&String(method||'GET').toUpperCase()==='POST'}
function storeCapture(req,res){if(!req||!res)return;setj(CAP,{req,res});captureArmed=false;nstatus('1件目の本物データ取得 ✅ → 残り9件を生成中…')}
let nativeFetch=null,nativeOpen=null,nativeSend=null,nativeSetHeader=null;
function installHooks(){try{nativeFetch=window.fetch.bind(window);window.fetch=async function(input,init){const url=input instanceof Request?input.url:String(input),method=(init?.method)||(input instanceof Request?input.method:'GET');const want=captureArmed&&!replaying&&isEmbedReq(url,method);let req=null;if(want&&init&&'body'in init)req={transport:'fetch',endpoint:url,method:String(method).toUpperCase(),headers:headersObj(init.headers),credentials:init.credentials||'include',mode:init.mode||null,...snapBody(init.body)};else if(want&&input instanceof Request){try{const cl=input.clone(),ct=cl.headers.get('content-type')||'';let q;if(ct.includes('multipart/form-data')){const fd=await cl.formData();q={type:'formdata',fields:[...fd.entries()].filter(([,v])=>typeof v==='string')}}else if(ct.includes('application/json'))q={type:'json',value:await cl.json()};else q=snapBody(await cl.text());req={transport:'fetch',endpoint:url,method:String(method).toUpperCase(),headers:headersObj(input.headers),credentials:input.credentials||'include',mode:input.mode||null,...q}}catch(_){}}const response=await nativeFetch(input,init);if(want&&req&&response.ok){try{storeCapture(req,await response.clone().json())}catch(_){}}return response};const X=XMLHttpRequest.prototype;nativeOpen=X.open;nativeSend=X.send;nativeSetHeader=X.setRequestHeader;X.open=function(method,url,...rest){this.__m315={method:String(method||'GET').toUpperCase(),url:String(url||''),headers:{}};return nativeOpen.call(this,method,url,...rest)};X.setRequestHeader=function(k,v){if(this.__m315)this.__m315.headers[String(k).toLowerCase()]=String(v);return nativeSetHeader.call(this,k,v)};X.send=function(body){const m=this.__m315,want=captureArmed&&!replaying&&m&&isEmbedReq(m.url,m.method);const req=want?{transport:'xhr',endpoint:m.url,method:m.method,headers:m.headers||{},withCredentials:!!this.withCredentials,...snapBody(body)}:null;if(want&&req)this.addEventListener('load',()=>{if(this.status>=200&&this.status<300)try{storeCapture(req,JSON.parse(this.responseText||'{}'))}catch(_){}},{once:true});return nativeSend.call(this,body)};status('DIRECT SUCCESS 3.15')}catch(e){status('HOOK失敗：'+(e?.message||String(e)),true)}}
installHooks();

function seedReplaceText(s,url){const a=URLS[0],ak=a.split('/').pop(),bk=url.split('/').pop();return String(s).split(a).join(url).split(ak).join(bk)}
function replayBody(c,url){if(c.type==='formdata'){const fd=new FormData();for(const [k,v] of c.fields||[])fd.append(k,seedReplaceText(v,url));return fd}if(c.type==='urlsearch'){const p=new URLSearchParams();for(const [k,v] of c.fields||[])p.append(k,seedReplaceText(v,url));return p}if(c.type==='json'){const walk=v=>typeof v==='string'?seedReplaceText(v,url):Array.isArray(v)?v.map(walk):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,walk(x)])):v;return JSON.stringify(walk(c.value||{}))}if(c.type==='text')return seedReplaceText(c.value||'',url);return undefined}
function replayHeaders(c){const h={...(c.headers||{})};for(const k of Object.keys(h))if(/^(content-length|host|connection|origin|referer|sec-|cookie)/i.test(k)||(c.type==='formdata'&&k.toLowerCase()==='content-type'))delete h[k];return h}
async function replay(url){const cap=getj(CAP);const c=cap?.req;if(!c)throw new Error('実リクエストなし');replaying=true;try{let code=0,data=null;if(c.transport==='xhr'){const text=await new Promise((resolve,reject)=>{const x=new XMLHttpRequest();nativeOpen.call(x,c.method||'POST',c.endpoint,true);x.withCredentials=c.withCredentials;for(const [k,v] of Object.entries(replayHeaders(c)))try{nativeSetHeader.call(x,k,v)}catch(_){}x.onload=()=>{code=x.status;resolve(x.responseText||'')};x.onerror=()=>reject(new Error('API通信失敗'));nativeSend.call(x,replayBody(c,url))});try{data=JSON.parse(text)}catch(_){}}else{const r=await nativeFetch(c.endpoint,{method:c.method||'POST',body:replayBody(c,url),headers:replayHeaders(c),credentials:c.credentials||'include',mode:c.mode||undefined});code=r.status;try{data=await r.json()}catch(_){}}if(code<200||code>=300)throw new Error(`note実API ${code}`);return data}finally{replaying=false}}
function embedded(res){return res?.data?.embedded_content||res?.embedded_content||res?.data||null}
function deepPatch(v,seedEmb,targetEmb,url){if(Array.isArray(v))return v.map(x=>deepPatch(x,seedEmb,targetEmb,url));if(v&&typeof v==='object'){const o={};for(const [k,x] of Object.entries(v))o[k]=deepPatch(x,seedEmb,targetEmb,url);return o}if(typeof v!=='string')return v;let s=seedReplaceText(v,url);if(seedEmb&&targetEmb){const entries=[];for(const [k,a] of Object.entries(seedEmb)){const b=targetEmb[k];if(typeof a==='string'&&a&&typeof b==='string'&&a!==b)entries.push([a,b])}entries.sort((a,b)=>b[0].length-a[0].length);for(const [a,b] of entries)if(s.includes(a))s=s.split(a).join(b)}return s}
function makeNodeFromSeed(seed,targetRes,url){const cap=getj(CAP),seedEmb=embedded(cap?.res),targetEmb=embedded(targetRes);const attrs=deepPatch(seed.node.attrs||{},seedEmb,targetEmb,url);try{return seed.node.type.create(attrs,seed.node.content,seed.node.marks)}catch(e){throw new Error('同一ノード型生成失敗：'+(e?.message||String(e)))}}
async function insertTarget(view,seed,url,targetRes){const node=makeNodeFromSeed(seed,targetRes,url),pos=view.state.doc.content.size;view.dispatch(view.state.tr.insert(pos,node));const end=Date.now()+6000;while(Date.now()<end){const h=findNotify(view,url);if(h)return h;await sleep(200)}return null}
async function buildNine(view,seed){const cap=getj(CAP);if(!cap?.res)throw new Error('1件目レスポンスなし');saveRegistry([]);remember(URLS[0],seed.node.type.name);for(let i=1;i<10;i++){const ex=findNotify(view,URLS[i]);if(ex){remember(URLS[i],ex.node.type.name);nstatus(`通知カード ${i+1}/10（既存）`);continue}nstatus(`通知カード ${i+1}/10 公式生成中…`);const targetRes=await replay(URLS[i]);const hit=await insertTarget(view,seed,URLS[i],targetRes);if(!hit)throw new Error(`カード ${i+1}/10 表示失敗`);remember(URLS[i],hit.node.type.name);await sleep(120)}nstatus('通知カード 10/10 ✅ 公開して通知確認')}
async function watchFirst(view){if(watcher)return;watcher=true;try{const end=Date.now()+45000;while(Date.now()<end){const cap=getj(CAP),seed=findNotify(view,URLS[0]);if(cap?.res&&seed){await buildNine(view,seed);return}await sleep(200)}throw new Error('1件目の本物カード/実応答を取得できません')}catch(e){nstatus('停止：'+(e?.message||String(e)),true)}finally{watcher=false;notifyBusy=false;const b=document.getElementById(N_BTN);if(b)b.disabled=false}}
async function notify10(){if(notifyBusy||watcher)return;notifyBusy=true;const b=document.getElementById(N_BTN);if(b)b.disabled=true;try{const view=findView();if(!view)throw new Error('EditorViewなし');const imgs=cards();if(imgs.length!==10)throw new Error(`極薄画像 ${imgs.length}/10。先に緑の10枚`);const err=await ensureLinks(view,imgs);if(err)throw new Error(`極薄URL ${err.i}/10で停止`);setj(CAP,null);saveRegistry([]);deleteUrlParagraph(view,URLS[0]);const p=view.state.schema.nodes.paragraph;if(!p)throw new Error('paragraphなし');const start=view.state.doc.content.size;view.dispatch(view.state.tr.insert(start,p.create(null,view.state.schema.text(URLS[0]))));cursorEnd(view);captureArmed=true;nstatus('1件目だけ：末尾URLでEnterを1回 → 残り9件は自動');watchFirst(view)}catch(e){captureArmed=false;notifyBusy=false;if(b)b.disabled=false;nstatus('停止：'+(e?.message||String(e)),true)}}
function cleanCards(){const c=document.getElementById(N_CLEAN);if(c)c.disabled=true;try{const view=findView();if(!view)throw new Error('EditorViewなし');const hits=[];for(const r of registry()){const h=findNotify(view,r.url,r.type);if(h)hits.push(h)}if(!hits.length)throw new Error('削除対象カードなし');let tr=view.state.tr;for(const h of hits.sort((a,b)=>b.pos-a.pos))tr=tr.delete(h.pos,h.pos+h.node.nodeSize);view.dispatch(tr);saveRegistry([]);nstatus(`通知カード ${hits.length}/${hits.length} 一括削除 ✅ 極薄10枚は残しました`)}catch(e){nstatus('削除停止：'+(e?.message||String(e)),true)}finally{if(c)c.disabled=false}}
})();