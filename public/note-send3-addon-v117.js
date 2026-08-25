(function(){
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(page.__MUMEI_SEND3_V117__)return;
page.__MUMEI_SEND3_V117__=true;

const VERSION='11.7';
const URLS=[
 'https://note.com/sashisashi/n/n9aa1f20bf25a',
 'https://note.com/sashisashi/n/na86375655ee5',
 'https://note.com/sashisashi/n/n9865f0786672'
];
const TITLES=[
 'さっし〜｜副業note×AI時短',
 '有料noteが出せない人へ。「自分には売り物がない」を終わらせる設計図',
 'かわいいだけのサムネは読まれない｜AIイラストでnoteの第一印象を変える方法'
];
const W=860,H=140,CREATOR='さっし〜｜副業note×AI時短';
const BTN='mumei-send3-v117',STATUS='mumei-send3-status-v117';
const ACTIVE='mumei_send3_active_v117',ROWS='mumei_send3_rows_v117';
let busy=false,viewCache=null,coreCache=null,imageArm=null,inputObserver=null,nativeInputClick=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class FatalError extends Error{}

function editor(){return document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror')}
function isEdit(){return /^\/notes\/n[a-z0-9]{8,}\/edit\/?$/i.test(location.pathname)}
function norm(v){try{const u=new URL(String(v||''),location.href);u.search='';u.hash='';return u.href}catch(_){return String(v||'')}}
function status(t,bad=false){const s=document.getElementById(STATUS);if(!s)return;s.textContent=t;s.style.background=bad?'#991b1b':'#92400e'}
function setRows(v){localStorage.setItem(ROWS,JSON.stringify(v))}
function getRows(){try{const a=JSON.parse(localStorage.getItem(ROWS)||'[]');return Array.isArray(a)?a:[]}catch(_){return[]}}

function roundedRect(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function textLines(c,text,maxWidth,maxLines){const out=[];let line='';for(const ch of[...text]){const test=line+ch;if(line&&c.measureText(test).width>maxWidth){out.push(line);line=ch;if(out.length===maxLines-1)break}else line=test}if(out.length<maxLines&&line){let rest=[...text].slice(out.join('').length).join('');if(c.measureText(rest).width>maxWidth){while(rest&&c.measureText(rest+'…').width>maxWidth)rest=rest.slice(0,-1);rest+='…'}out.push(rest)}return out.slice(0,maxLines)}
async function makeLocalFile(index){
 const title=TITLES[index-1],canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d');
 c.fillStyle='#fff';c.fillRect(0,0,W,H);c.strokeStyle='#d9dde3';c.lineWidth=1.5;roundedRect(c,1,1,W-2,H-2,12);c.stroke();
 const rightX=570,rightW=278;c.fillStyle=index===1?'#111827':index===2?'#312e81':'#4c1d95';roundedRect(c,rightX,8,rightW,124,8);c.fill();
 c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';c.font='800 22px system-ui,-apple-system,sans-serif';c.fillText(index===1?'さっし〜':index===2?'有料note':'AIサムネ',rightX+rightW/2,61);c.font='700 13px system-ui,-apple-system,sans-serif';c.fillText('過去記事リンク',rightX+rightW/2,91);c.textAlign='left';c.textBaseline='top';
 c.fillStyle='#171b21';c.font='700 18px system-ui,-apple-system,sans-serif';textLines(c,title,530,3).forEach((line,i)=>c.fillText(line,16,12+i*24));
 c.fillStyle='#626975';c.font='14px system-ui,-apple-system,sans-serif';c.fillText(CREATOR,16,110);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('画像生成失敗')),'image/png',1));
 return new page.File([blob],`${String(index).padStart(2,'0')}_send3.png`,{type:'image/png'});
}

function looksLikeView(v){try{return !!v&&typeof v==='object'&&v.state?.doc&&v.state?.schema&&typeof v.dispatch==='function'&&v.dom&&typeof v.posAtDOM==='function'}catch(_){return false}}
function findView(){if(looksLikeView(viewCache)&&viewCache.dom?.isConnected)return viewCache;const root=editor();if(!root)return null;const seen=new Set(),q=[];let seed=root;for(let i=0;i<6&&seed;i++,seed=seed.parentElement)q.push([seed,0]);let steps=0;while(q.length&&steps++<14000){const[v,d]=q.shift();if(!v||seen.has(v))continue;seen.add(v);if(looksLikeView(v))return(viewCache=v);let keys=[];try{keys=Object.getOwnPropertyNames(v)}catch(_){continue}for(const key of keys){if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(key))continue;let x;try{x=v[key]}catch(_){continue}if(looksLikeView(x))return(viewCache=x);if(d<7&&x&&(typeof x==='object'||typeof x==='function')&&x!==page&&x!==document)q.push([x,d+1])}}return null}
function webpackRequire(){const chunks=page.webpackChunk_N_E;if(!chunks||typeof chunks.push!=='function')return null;let req=null;const id=991000000+Math.floor(Math.random()*8000000);try{chunks.push([[id],{},r=>{req=r}])}catch(_){}return req}
function core(){if(coreCache)return coreCache;const r=webpackRequire();if(!r)throw new FatalError('note内部処理を取得できません');let sm,sc,hm;try{sm=r(44044)}catch(_){}try{sc=r(35130)}catch(_){}try{hm=r(51910)}catch(_){}const Selection=sm?.Y1,serialize=sc?.BF,normalizeDOM=hm?.zc,cleanHTML=hm?.jF;if(typeof Selection?.atEnd!=='function'||typeof serialize!=='function'||typeof normalizeDOM!=='function'||typeof cleanHTML!=='function')throw new FatalError('note本文・保存処理を取得できません');return(coreCache={Selection,serialize,normalizeDOM,cleanHTML})}
function imageNodes(v){const a=[];v.state.doc.descendants((n,p)=>{if(n.type?.name==='image')a.push({node:n,pos:p})});return a}
function embedNodes(v){const a=[];v.state.doc.descendants((n,p)=>{if(n.type?.name==='embed')a.push({node:n,pos:p})});return a}
function officialCards(v,url){const w=norm(url);return embedNodes(v).filter(e=>norm(e.node.attrs?.src)===w&&e.node.attrs?.htmlForEmbed&&e.node.attrs?.embeddedContentKey)}
function findImage(v,url,id=''){const w=norm(url);return imageNodes(v).find(e=>(id&&String(e.node.attrs?.id||'')===String(id))||norm(e.node.attrs?.link)===w)||null}
function exactUrlParagraphs(v,url){const w=norm(url),a=[];v.state.doc.descendants((n,p)=>{if(n.isTextblock&&norm((n.textContent||'').trim())===w)a.push({node:n,pos:p})});return a}
function targetUrlTextblocks(v){const t=new Set(URLS.map(norm)),a=[];v.state.doc.descendants((n,p)=>{if(!n.isTextblock)return;const text=n.textBetween(0,n.content.size,'\n','\n').trim(),tokens=text.split(/\s+/).filter(Boolean);if(tokens.length&&tokens.every(x=>t.has(norm(x))))a.push({node:n,pos:p})});return a}
function ensureEnd(v){const p=v.state.schema.nodes.paragraph;if(!p)throw new FatalError('paragraphなし');if(v.state.doc.lastChild?.type!==p||v.state.doc.lastChild.textContent!=='')v.dispatch(v.state.tr.insert(v.state.doc.content.size,p.create()));v.dispatch(v.state.tr.setSelection(core().Selection.atEnd(v.state.doc)).scrollIntoView());v.focus()}
function deleteHits(v,hits){const u=new Map();hits.forEach(h=>h?.node&&u.set(`${h.pos}:${h.node.nodeSize}`,h));if(!u.size)return 0;let tr=v.state.tr;[...u.values()].sort((a,b)=>b.pos-a.pos).forEach(h=>tr=tr.delete(h.pos,h.pos+h.node.nodeSize));v.dispatch(tr.scrollIntoView());ensureEnd(v);return u.size}
function remoteImage(n){const s=String(n?.attrs?.src||'');return /^https:\/\//i.test(s)&&!/^https:\/\/editor\.note\.com\/icons\//i.test(s)}
function serializedBody(v){const f=core().serialize(v.state),h=document.createElement('div');h.appendChild(f);core().normalizeDOM(h);return core().cleanHTML(h.innerHTML)}
async function saveDraft(v,label,verify){verify();status(label);await sleep(4200);const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()==='一時保存'&&x.getClientRects().length);if(b&&!b.disabled)b.click();await sleep(6500);verify()}

function imageInput(input){if(!input||input.tagName!=='INPUT'||input.type!=='file')return false;const a=String(input.accept||'').toLowerCase();return!a||a.includes('image')||a.includes('.png')||a.includes('.jpg')||a.includes('.jpeg')||a.includes('.webp')}
function uninstall(){try{inputObserver?.disconnect()}catch(_){}inputObserver=null;if(nativeInputClick&&page.HTMLInputElement?.prototype){try{page.HTMLInputElement.prototype.click=nativeInputClick}catch(_){}}nativeInputClick=null}
function cancelArm(){const a=imageArm;imageArm=null;if(a?.timer)clearTimeout(a.timer);uninstall()}
function install(){if(inputObserver||nativeInputClick||!document.documentElement)return;inputObserver=new MutationObserver(ms=>{const a=imageArm;if(!a||a.used)return;for(const m of ms)for(const n of m.addedNodes){if(!(n instanceof Element))continue;if(imageInput(n)&&!a.beforeInputs.has(n)){inject(n);return}for(const i of n.querySelectorAll?.('input[type="file"]')||[])if(imageInput(i)&&!a.beforeInputs.has(i)){inject(i);return}}});inputObserver.observe(document.documentElement,{childList:true,subtree:true});const p=page.HTMLInputElement?.prototype;if(!p)return;nativeInputClick=p.click;p.click=function(...args){const a=imageArm;if(a&&imageInput(this)&&!a.beforeInputs.has(this)){if(!a.used)inject(this);return}return nativeInputClick.apply(this,args)}}
async function waitImages(a){const end=Date.now()+300000;while(Date.now()<end){if(!imageArm)throw new FatalError('停止しました');const fresh=imageNodes(a.view).filter(e=>{const id=String(e.node.attrs?.id||'');return id&&!a.beforeIds.has(id)}).sort((x,y)=>x.pos-y.pos);if(fresh.length>=3){const s=fresh.slice(0,3);if(s.every(e=>remoteImage(e.node)))return s}await sleep(280)}throw new FatalError('画像3枚のアップロードを確認できません')}
function verifyImages(v,rows){for(const r of rows){const h=findImage(v,r.url,r.nodeId);if(!h||!remoteImage(h.node)||norm(h.node.attrs?.link)!==norm(r.url))throw new FatalError(`画像リンク不足 ${r.index}`)}return serializedBody(v)}

function shutdownForManual(){
 cancelArm();busy=false;
 if(typeof GM_setClipboard!=='function')throw new FatalError('URL一覧をコピーできません');
 GM_setClipboard(URLS.join('\n\n'),'text');localStorage.setItem(ACTIVE,'1');
 const old=document.getElementById('mumei-notify-panel-v1100');try{old?.querySelector('[data-action="close"]')?.click()}catch(_){}
 document.getElementById(BTN)?.remove();status('3件URLコピー済み ✅ 最下部へ貼付→各URL末尾で実Enter');
 page.alert('画像🔗3枚を保存しました。\n\n3件URLはコピー済みです。\n本文最下部へ貼付 → 各URL末尾で実Enter → 公開→更新 → サブ垢で通知確認。\n\n確認後は編集画面を再読み込みして「削」。カード3件だけ消します。');
}

async function inject(input){const a=imageArm;if(!a||a.used||!imageInput(input))return;a.used=true;try{const dt=new page.DataTransfer();a.files.forEach(f=>dt.items.add(f));input.files=dt.files;input.dispatchEvent(new page.Event('input',{bubbles:true}));input.dispatchEvent(new page.Event('change',{bubbles:true}));status('画像3枚を10と同じ方式で一括アップロード中…');const created=await waitImages(a);let tr=a.view.state.tr;created.forEach((h,i)=>{tr=tr.setNodeMarkup(h.pos,h.node.type,{...h.node.attrs,link:URLS[i]},h.node.marks);a.rows[i].nodeId=String(h.node.attrs?.id||'')});a.view.dispatch(tr);ensureEnd(a.view);setRows(a.rows);await saveDraft(a.view,'画像🔗3枚を保存中…',()=>verifyImages(a.view,a.rows));shutdownForManual()}catch(e){status('3送停止：'+(e?.message||String(e)),true);cancelArm();busy=false}}

async function runSend3(){if(busy||!isEdit())return;busy=true;try{const v=findView();if(!v)throw new FatalError('EditorViewなし');core();status('端末内でサムネ3枚を作成中…');const files=[];for(let i=1;i<=3;i++){files.push(await makeLocalFile(i));status(`画像準備 ${i}/3…`)}const rows=URLS.map((url,i)=>({index:i+1,url,title:TITLES[i],nodeId:''}));setRows(rows);imageArm={view:v,rows,files,used:false,beforeIds:new Set(imageNodes(v).map(e=>String(e.node.attrs?.id||'')).filter(Boolean)),beforeInputs:new Set(document.querySelectorAll('input[type="file"]')),timer:null};install();imageArm.timer=setTimeout(()=>{status('画像選択待機が3分を超えました',true);cancelArm();busy=false},180000);status('準備OK｜本文をタップ→「＋」→「画像」を1回だけ')}catch(e){status('3送停止：'+(e?.message||String(e)),true);busy=false}}

async function deleteCardsOnly(){if(busy||!isEdit())return;busy=true;try{const v=findView();if(!v)throw new FatalError('EditorViewなし');core();const rows=getRows(),hits=[];for(const u of URLS)hits.push(...officialCards(v,u),...exactUrlParagraphs(v,u));hits.push(...targetUrlTextblocks(v));const n=deleteHits(v,hits);await saveDraft(v,`通知カード/URL ${n}ブロック削除・保存中…`,()=>{for(const u of URLS)if(officialCards(v,u).length||exactUrlParagraphs(v,u).length)throw new FatalError('カード削除残り');return serializedBody(v)});if(rows.length===3)verifyImages(v,rows);localStorage.removeItem(ACTIVE);status(`通知カード/URL ${n}ブロック削除 ✅ 画像🔗3枚は保持`)}catch(e){status('削除停止：'+(e?.message||String(e)),true)}finally{busy=false}}

function mount(){if(!document.body||!isEdit())return;const old=document.getElementById('mumei-notify-panel-v1100');if(old){const old3=old.querySelector('[data-main-action="3"]');if(old3)old3.style.display='none';if(!document.getElementById(BTN)){const b=document.createElement('button');b.id=BTN;b.type='button';b.textContent='3送';b.title='10と同じ画像一括挿入方式';b.style.background='#d97706';b.addEventListener('click',e=>{e.stopPropagation();runSend3()});old.insertBefore(b,old.firstChild)}const d=old.querySelector('[data-action="delete"]');if(d&&!d.dataset.send3v117){d.dataset.send3v117='1';d.addEventListener('click',e=>{if(localStorage.getItem(ACTIVE)==='1'){e.preventDefault();e.stopImmediatePropagation();deleteCardsOnly()}},true)}}if(!document.getElementById(STATUS)){const s=document.createElement('div');s.id=STATUS;Object.assign(s.style,{position:'fixed',right:'4px',bottom:'156px',zIndex:'2147483647',maxWidth:'320px',padding:'5px 7px',borderRadius:'7px',background:'#92400e',color:'#fff',font:'700 10px/1.35 system-ui',boxShadow:'0 2px 8px rgba(0,0,0,.25)'});document.body.appendChild(s);status(`3送 ${VERSION}｜通信なし・10と同画像方式`)}}
setInterval(mount,500);mount();
})();