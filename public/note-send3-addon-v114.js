(function(){
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(page.__MUMEI_SEND3_ADDON_114__)return;
page.__MUMEI_SEND3_ADDON_114__=true;

const VERSION='11.4';
const URLS=[
 'https://note.com/sashisashi/n/n9aa1f20bf25a',
 'https://note.com/sashisashi/n/na86375655ee5',
 'https://note.com/sashisashi/n/n9865f0786672'
];
const TEMPLATE_KEY='mumei_notify_template_v1';
const ACTIVE_KEY='mumei_send3_active_v114';
const ROWS_KEY='mumei_send3_rows_v114';
const BTN_ID='mumei-send3-v114';
const STATUS_ID='mumei-send3-status-v114';
const W=860,H=140;
let busy=false,viewCache=null,coreCache=null,arm=null,observer=null,nativeClick=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class FatalError extends Error{}

function editor(){return document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror')}
function isEdit(){return /^\/notes\/n[a-z0-9]{8,}\/edit\/?$/i.test(location.pathname)}
function norm(v){try{const u=new URL(String(v||''),location.href);u.search='';u.hash='';return u.href}catch(_){return String(v||'')}}
function status(t,bad=false){const s=document.getElementById(STATUS_ID);if(!s)return;s.textContent=t;s.dataset.bad=bad?'1':'0';s.style.background=bad?'#991b1b':'#92400e'}
function getRows(){try{const a=JSON.parse(localStorage.getItem(ROWS_KEY)||'[]');return Array.isArray(a)?a:[]}catch(_){return[]}}
function saveRows(a){localStorage.setItem(ROWS_KEY,JSON.stringify(a))}
function getTemplate(){try{return JSON.parse(localStorage.getItem(TEMPLATE_KEY)||'null')}catch(_){return null}}
function saveTemplate(v){localStorage.setItem(TEMPLATE_KEY,JSON.stringify(v))}
function validTemplate(t){return !!(t?.json&&t?.sourceUrl)}

function looksLikeView(v){try{return !!v&&typeof v==='object'&&v.state?.doc&&v.state?.schema&&typeof v.dispatch==='function'&&v.dom&&typeof v.posAtDOM==='function'}catch(_){return false}}
function findView(){
 if(looksLikeView(viewCache)&&viewCache.dom?.isConnected)return viewCache;
 const root=editor();if(!root)return null;const seen=new Set(),q=[];let n=root;
 for(let i=0;i<6&&n;i++,n=n.parentElement)q.push([n,0]);let steps=0;
 while(q.length&&steps++<14000){const [v,d]=q.shift();if(!v||seen.has(v))continue;seen.add(v);if(looksLikeView(v))return(viewCache=v);let ks=[];try{ks=Object.getOwnPropertyNames(v)}catch(_){continue}
  for(const k of ks){if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k))continue;let x;try{x=v[k]}catch(_){continue}if(looksLikeView(x))return(viewCache=x);if(d<7&&x&&(typeof x==='object'||typeof x==='function')&&x!==page&&x!==document)q.push([x,d+1])}
 }
 return null;
}
function webpackRequire(){const chunks=page.webpackChunk_N_E;if(!chunks||typeof chunks.push!=='function')return null;let req=null;const id=981000000+Math.floor(Math.random()*10000000);try{chunks.push([[id],{},r=>{req=r}])}catch(_){}return req}
function core(){if(coreCache)return coreCache;const r=webpackRequire();if(!r)throw new FatalError('note内部処理を取得できません');let sm,sc,hm;try{sm=r(44044)}catch(_){}try{sc=r(35130)}catch(_){}try{hm=r(51910)}catch(_){}const Selection=sm?.Y1,serialize=sc?.BF,normalizeDOM=hm?.zc,cleanHTML=hm?.jF;if(typeof Selection?.atEnd!=='function'||typeof serialize!=='function'||typeof normalizeDOM!=='function'||typeof cleanHTML!=='function')throw new FatalError('note本文処理を取得できません');return(coreCache={Selection,serialize,normalizeDOM,cleanHTML})}
function imageNodes(v){const a=[];v.state.doc.descendants((n,p)=>{if(n.type?.name==='image')a.push({node:n,pos:p})});return a}
function embedNodes(v){const a=[];v.state.doc.descendants((n,p)=>{if(n.type?.name==='embed')a.push({node:n,pos:p})});return a}
function officialCards(v,url){const w=norm(url);return embedNodes(v).filter(e=>norm(e.node.attrs?.src)===w&&e.node.attrs?.htmlForEmbed&&e.node.attrs?.embeddedContentKey)}
function findImage(v,url,id=''){const w=norm(url);return imageNodes(v).find(e=>(id&&String(e.node.attrs?.id||'')===String(id))||norm(e.node.attrs?.link)===w)||null}
function exactUrlParagraphs(v,url){const w=norm(url),a=[];v.state.doc.descendants((n,p)=>{if(n.isTextblock&&norm((n.textContent||'').trim())===w)a.push({node:n,pos:p})});return a}
function ensureEnd(v){const p=v.state.schema.nodes.paragraph;if(!p)throw new FatalError('paragraphなし');if(v.state.doc.lastChild?.type!==p||v.state.doc.lastChild.textContent!=='')v.dispatch(v.state.tr.insert(v.state.doc.content.size,p.create()));v.dispatch(v.state.tr.setSelection(core().Selection.atEnd(v.state.doc)).scrollIntoView());v.focus()}
function deleteHits(v,hits){const u=new Map();hits.forEach(h=>h?.node&&u.set(`${h.pos}:${h.node.nodeSize}`,h));if(!u.size)return 0;let tr=v.state.tr;[...u.values()].sort((a,b)=>b.pos-a.pos).forEach(h=>{tr=tr.delete(h.pos,h.pos+h.node.nodeSize)});v.dispatch(tr.scrollIntoView());ensureEnd(v);return u.size}
function remoteImage(n){const s=String(n?.attrs?.src||'');return /^https:\/\//i.test(s)&&!/^https:\/\/editor\.note\.com\/icons\//i.test(s)}

function captureTemplate(v){const old=getTemplate();if(validTemplate(old))return old;const hit=embedNodes(v).find(e=>{const s=String(e.node.attrs?.src||'');return /^https:\/\/note\.com\//i.test(s)&&e.node.attrs?.htmlForEmbed&&e.node.attrs?.embeddedContentKey});if(!hit)return null;const t={sourceUrl:String(hit.node.attrs.src),type:hit.node.type?.name||'embed',json:hit.node.toJSON(),capturedAt:Date.now()};saveTemplate(t);return t}
function replaceDeep(v,from,to){if(typeof v==='string')return v.split(from).join(to);if(Array.isArray(v))return v.map(x=>replaceDeep(x,from,to));if(v&&typeof v==='object'){const o={};for(const[k,x]of Object.entries(v))o[k]=replaceDeep(x,from,to);return o}return v}
async function cloneCard(v,url){const t=getTemplate();if(!validTemplate(t))throw new FatalError('標準カード学習データなし');let j=replaceDeep(t.json,t.sourceUrl,url);if(j?.attrs&&'src'in j.attrs)j.attrs.src=url;let n;try{n=v.state.schema.nodeFromJSON(j)}catch(_){throw new FatalError('カードJSON復元失敗')}try{v.dispatch(v.state.tr.insert(v.state.doc.content.size,n))}catch(_){throw new FatalError('カード挿入失敗')}const end=Date.now()+8000;while(Date.now()<end){const hit=officialCards(v,url).slice(-1)[0];if(hit)return hit;await sleep(200)}throw new FatalError('カード確認失敗 '+url.split('/').pop())}

function gmRequest(url,type='text',headers={}){
 return new Promise((resolve,reject)=>{
  const done=r=>{if(r.status>=200&&r.status<300)resolve(r.response);else reject(new Error('HTTP '+r.status))};
  const fail=()=>reject(new Error('network'));
  try{
   if(typeof GM_xmlhttpRequest==='function'){
    GM_xmlhttpRequest({method:'GET',url,responseType:type,timeout:20000,headers,anonymous:false,onload:done,onerror:fail,ontimeout:fail});return;
   }
   if(typeof GM!=='undefined'&&typeof GM.xmlHttpRequest==='function'){
    GM.xmlHttpRequest({method:'GET',url,responseType:type,timeout:20000,headers,anonymous:false,onload:done,onerror:fail,ontimeout:fail});return;
   }
  }catch(_){ }
  fetch(url,{credentials:'include'}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return type==='blob'?r.blob():r.text()}).then(resolve,reject);
 });
}
function articleKey(url){return String(url).match(/\/n\/(n[a-z0-9]+)/i)?.[1]||''}
function meta(html,key){try{const d=new DOMParser().parseFromString(html,'text/html');return d.querySelector(`meta[property="${key}"]`)?.content||d.querySelector(`meta[name="${key}"]`)?.content||''}catch(_){return''}}
function likelyImageFromObject(obj){
 const seen=new Set();let best='';
 function walk(v,key='',depth=0){if(best||depth>6||v==null)return;if(typeof v==='string'){
   if(/^https:\/\//i.test(v)&&/(image|eyecatch|thumbnail|picture|cover|og)/i.test(key)&&/\.(?:png|jpe?g|webp)(?:\?|$)|st-note|cloudfront/i.test(v))best=v;
   return;
  }
  if(typeof v!=='object'||seen.has(v))return;seen.add(v);
  if(Array.isArray(v)){for(const x of v)walk(x,key,depth+1);return}
  for(const [k,x] of Object.entries(v))walk(x,k,depth+1);
 }
 walk(obj);return best;
}
async function noteInfo(url,index){
 const key=articleKey(url);let title='',author='さっし〜｜副業note×AI時短',imageUrl='';
 if(key){
  try{
   const txt=await gmRequest(`https://note.com/api/v3/notes/${key}`,'text',{'Accept':'application/json','Cache-Control':'no-cache'});
   const payload=JSON.parse(txt),d=payload?.data||payload||{};title=String(d.name||d.title||'');author=String(d.user?.nickname||d.user?.name||d.nickname||author);imageUrl=String(d.eyecatch||d.eyecatch_url||d.image_url||d.thumbnail_url||d.picture_url||likelyImageFromObject(d)||'');
  }catch(_){ }
 }
 if(!title||!imageUrl){
  try{
   const html=await gmRequest(url,'text',{'Accept':'text/html,*/*','Cache-Control':'no-cache'});title=title||meta(html,'og:title');imageUrl=imageUrl||meta(html,'og:image');author=meta(html,'author')||author;
  }catch(_){ }
 }
 return{index,url,title:title||`さっし〜記事 ${index}`,author,imageUrl};
}
async function bitmap(blob){if('createImageBitmap'in page)return page.createImageBitmap(blob);return new Promise((res,rej)=>{const i=new page.Image(),u=URL.createObjectURL(blob);i.onload=()=>{URL.revokeObjectURL(u);res(i)};i.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('image'))};i.src=u})}
function rounded(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function lines(c,text,max,maxLines){const out=[];let line='';for(const ch of[...String(text||'')]){const t=line+ch;if(line&&c.measureText(t).width>max){out.push(line);line=ch;if(out.length===maxLines-1)break}else line=t}if(out.length<maxLines&&line){let rest=[...String(text||'')].slice(out.join('').length).join('');while(rest&&c.measureText(rest+'…').width>max)rest=rest.slice(0,-1);out.push(rest+(rest.length<String(text||'').length?'…':''))}return out.slice(0,maxLines)}
async function makeFile(url,index){
 const info=await noteInfo(url,index);let img=null;
 if(info.imageUrl){try{img=await bitmap(await gmRequest(info.imageUrl,'blob',{'Accept':'image/avif,image/webp,image/png,image/jpeg,*/*'}))}catch(_){img=null}}
 const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,W,H);c.strokeStyle='#d9dde3';c.lineWidth=1.5;rounded(c,1,1,W-2,H-2,12);c.stroke();const tw=320,th=124,tx=W-tw-8,ty=8,textX=16,textW=tx-textX-12;c.textBaseline='top';c.fillStyle='#171b21';c.font='700 18px system-ui';lines(c,info.title,textW,3).forEach((x,i)=>c.fillText(x,textX,12+i*24));c.fillStyle='#626975';c.font='14px system-ui';c.fillText(info.author,textX,110);
 c.fillStyle='#f7f8fa';rounded(c,tx,ty,tw,th,8);c.fill();
 if(img){const iw=img.width||img.naturalWidth,ih=img.height||img.naturalHeight,sc=Math.min(tw/iw,th/ih),dw=iw*sc,dh=ih*sc;c.save();rounded(c,tx,ty,tw,th,8);c.clip();c.drawImage(img,tx+(tw-dw)/2,ty+(th-dh)/2,dw,dh);c.restore();if(img.close)img.close();}
 else{c.fillStyle='#e5e7eb';c.font='700 18px system-ui';c.fillText('note',tx+135,ty+50);}
 const out=await new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(new Error('画像生成失敗')),'image/png',1));
 return{file:new page.File([out],`${String(index).padStart(2,'0')}_send3.png`,{type:'image/png'}),title:info.title,author:info.author,fallback:!img};
}

function imageInput(i){if(!i||i.tagName!=='INPUT'||i.type!=='file')return false;const a=String(i.accept||'').toLowerCase();return!a||a.includes('image')||a.includes('.png')||a.includes('.jpg')||a.includes('.jpeg')||a.includes('.webp')}
function uninstall(){try{observer?.disconnect()}catch(_){}observer=null;if(nativeClick&&page.HTMLInputElement?.prototype){try{page.HTMLInputElement.prototype.click=nativeClick}catch(_){}}nativeClick=null}
function cancelArm(){const a=arm;arm=null;if(a?.timer)clearTimeout(a.timer);uninstall()}
function install(){if(observer||nativeClick||!document.documentElement)return;observer=new MutationObserver(ms=>{const a=arm;if(!a||a.used)return;for(const m of ms)for(const n of m.addedNodes){if(!(n instanceof Element))continue;if(imageInput(n)&&!a.beforeInputs.has(n)){inject(n);return}for(const i of n.querySelectorAll?.('input[type="file"]')||[])if(imageInput(i)&&!a.beforeInputs.has(i)){inject(i);return}}});observer.observe(document.documentElement,{childList:true,subtree:true});const p=page.HTMLInputElement?.prototype;if(!p)return;nativeClick=p.click;p.click=function(...args){const a=arm;if(a&&imageInput(this)&&!a.beforeInputs.has(this)){if(!a.used)inject(this);return}return nativeClick.apply(this,args)}}
async function waitImages(a){const end=Date.now()+300000;while(Date.now()<end){if(!arm)throw new FatalError('停止しました');const fresh=imageNodes(a.view).filter(e=>{const id=String(e.node.attrs?.id||'');return id&&!a.beforeIds.has(id)}).sort((x,y)=>x.pos-y.pos);if(fresh.length>=3){const s=fresh.slice(0,3);if(s.every(e=>remoteImage(e.node)))return s}await sleep(280)}throw new FatalError('画像3枚のアップロードを確認できません')}
async function saveDraft(v,label,verify){verify();status(label);await sleep(4200);const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()==='一時保存'&&x.getClientRects().length);if(b&&!b.disabled)b.click();await sleep(6500);verify()}
function verifyImages(v,rows){for(const r of rows){const h=findImage(v,r.url,r.nodeId);if(!h||!remoteImage(h.node)||norm(h.node.attrs?.link)!==norm(r.url))throw new FatalError('画像リンク不足 '+r.index)}}
function verifyReady(v,rows){verifyImages(v,rows);for(const r of rows)if(!officialCards(v,r.url).length)throw new FatalError('通知カード不足 '+r.index)}

async function inject(input){const a=arm;if(!a||a.used||!imageInput(input))return;a.used=true;try{const dt=new page.DataTransfer();a.files.forEach(f=>dt.items.add(f));input.files=dt.files;input.dispatchEvent(new page.Event('input',{bubbles:true}));input.dispatchEvent(new page.Event('change',{bubbles:true}));status('画像3枚を一括アップロード中…');const created=await waitImages(a);let tr=a.view.state.tr;created.forEach((h,i)=>{tr=tr.setNodeMarkup(h.pos,h.node.type,{...h.node.attrs,link:URLS[i]},h.node.marks);a.rows[i].nodeId=String(h.node.attrs?.id||'')});a.view.dispatch(tr);ensureEnd(a.view);saveRows(a.rows);await saveDraft(a.view,'画像🔗3枚を先に保存中…',()=>verifyImages(a.view,a.rows));status('画像保存完了｜標準カード3件を連続自動作成中…');for(let i=0;i<3;i++){await cloneCard(a.view,URLS[i]);status(`標準カード ${i+1}/3 自動作成…`);await sleep(250)}ensureEnd(a.view);await saveDraft(a.view,'画像🔗3枚＋通知カード3件を保存中…',()=>verifyReady(a.view,a.rows));localStorage.setItem(ACTIVE_KEY,'1');status('3送 完成 ✅ 公開→更新→サブ垢通知確認');page.alert('3送 完成。\n画像リンク3枚の最下部に通知用標準カード3件を自動作成しました。\n\n公開→更新→通知確認。\n確認後は「削」でカードだけ一括削除します。')}catch(e){status('3送停止：'+(e?.message||String(e)),true)}finally{cancelArm();busy=false}}

async function runSend3(){if(busy||!isEdit())return;busy=true;try{const v=findView();if(!v)throw new FatalError('EditorViewなし');core();captureTemplate(v);const hits=[];for(const u of URLS){hits.push(...officialCards(v,u),...exactUrlParagraphs(v,u));const im=findImage(v,u);if(im)hits.push(im)}deleteHits(v,hits);ensureEnd(v);await saveDraft(v,'3送の旧データを消して保存中…',()=>{for(const u of URLS)if(officialCards(v,u).length||exactUrlParagraphs(v,u).length||findImage(v,u))throw new FatalError('初期化残り')});if(!validTemplate(getTemplate()))throw new FatalError('標準カード学習データなし。過去の完全自動カード学習データが見つかりません');status('3件の過去サムネイルを取得・生成中…');const made=await Promise.all(URLS.map((u,i)=>makeFile(u,i+1)));const rows=made.map((m,i)=>({index:i+1,url:URLS[i],title:m.title,author:m.author,nodeId:'',fallback:m.fallback}));saveRows(rows);const fallbackCount=rows.filter(r=>r.fallback).length;arm={view:v,rows,files:made.map(x=>x.file),used:false,beforeIds:new Set(imageNodes(v).map(e=>String(e.node.attrs?.id||'')).filter(Boolean)),beforeInputs:new Set(document.querySelectorAll('input[type="file"]')),timer:null};install();arm.timer=setTimeout(()=>{status('画像選択待機が3分を超えました',true);cancelArm();busy=false},180000);status(`準備OK${fallbackCount?`（画像取得${fallbackCount}件フォールバック）`:''}｜本文→＋→画像を1回`)}catch(e){status('3送停止：'+(e?.message||String(e)),true);busy=false}}

async function deleteCardsOnly(){if(busy||!isEdit())return;busy=true;try{const v=findView();if(!v)throw new FatalError('EditorViewなし');core();const rows=getRows();const hits=[];for(const u of URLS)hits.push(...officialCards(v,u),...exactUrlParagraphs(v,u));const n=deleteHits(v,hits);await saveDraft(v,`通知カード ${n}ブロック削除・保存中…`,()=>{for(const u of URLS)if(officialCards(v,u).length||exactUrlParagraphs(v,u).length)throw new FatalError('カード削除残り')});if(rows.length===3)verifyImages(v,rows);localStorage.removeItem(ACTIVE_KEY);status(`通知カード ${n}ブロック削除 ✅ 画像🔗3枚は保持`)}catch(e){status('削除停止：'+(e?.message||String(e)),true)}finally{busy=false}}

function mount(){if(!document.body||!isEdit())return;const old=document.querySelector('#mumei-notify-panel-v1100');if(old){for(const id of ['mumei-send3-v112'])document.getElementById(id)?.remove();const old3=old.querySelector('[data-main-action="3"]');if(old3)old3.style.display='none';if(!document.getElementById(BTN_ID)){const b=document.createElement('button');b.id=BTN_ID;b.type='button';b.textContent='3送';b.title='画像3枚→URL→標準カード3件自動生成';b.style.background='#d97706';b.addEventListener('click',e=>{e.stopPropagation();runSend3()});old.insertBefore(b,old.firstChild)}const del=old.querySelector('[data-action="delete"]');if(del&&!del.dataset.send3hook114){del.dataset.send3hook114='1';del.addEventListener('click',e=>{if(localStorage.getItem(ACTIVE_KEY)==='1'){e.preventDefault();e.stopImmediatePropagation();deleteCardsOnly()}},true)}if(!document.getElementById(STATUS_ID)){const s=document.createElement('div');s.id=STATUS_ID;s.dataset.bad='0';Object.assign(s.style,{position:'fixed',right:'4px',bottom:'156px',zIndex:'2147483647',maxWidth:'320px',padding:'5px 7px',borderRadius:'7px',background:'#92400e',color:'#fff',font:'700 10px/1.35 system-ui',boxShadow:'0 2px 8px rgba(0,0,0,.25)'});document.body.appendChild(s);status(`3送 ${VERSION}｜待機`)}}
}
setInterval(mount,500);mount();
})();