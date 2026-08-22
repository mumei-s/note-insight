// ==UserScript==
// @name         無名S note 10枚 COMPLETE BRIDGE 6.1
// @namespace    https://github.com/mumei-s/note-insight/batch-bridge-610
// @version      6.3.0
// @description  成功済み10枚一括挿入方式＋DIRECT SUCCESS自動呼出し。完成形1件テスト/進捗/途中再開対応
// @match        https://editor.note.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @connect      assets.st-note.com
// ==/UserScript==

(function(){
'use strict';
if(window.__MUMEI_BATCH_BRIDGE_630__) return;
window.__MUMEI_BATCH_BRIDGE_630__=true;

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

const CREATOR='無名S note',W=860,H=140;
const BTN='mumei-bridge610-btn',PANEL='mumei-bridge610-panel';
const DIRECT_BTN='mumei-direct-success-btn',DIRECT_PANEL='mumei-direct-success-panel';
let armed=false,consumed=false,busy=false,files=[],beforeInputs=new Set(),beforeImages=new Set(),timer=null,retryMode=false,retryIndex=0,mode='idle';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function editor(){return document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror')}
function status(t,bad=false){const p=document.getElementById(PANEL);if(!p)return;p.textContent=t;p.style.background=bad?'#991b1b':'#111827';p.style.display='block'}
function showButton(v=true){const b=document.getElementById(BTN);if(b)b.style.display=v?'block':'none'}
function buttonText(t){const b=document.getElementById(BTN);if(b)b.textContent=t}
function hideDirectUI(){for(const id of [DIRECT_BTN,DIRECT_PANEL]){const el=document.getElementById(id);if(el){el.style.display='none';el.style.pointerEvents='none'}}}
function mount(){if(!document.body)return;hideDirectUI();let p=document.getElementById(PANEL);if(!p){p=document.createElement('div');p.id=PANEL;p.textContent='COMPLETE 6.3｜860×140固定';document.body.appendChild(p)}Object.assign(p.style,{position:'fixed',right:'8px',top:'42%',zIndex:'2147483646',maxWidth:'250px',padding:'6px 8px',borderRadius:'8px',background:'#111827',color:'#fff',fontSize:'10px',lineHeight:'1.3',boxShadow:'0 3px 12px rgba(0,0,0,.25)',pointerEvents:'none'});let b=document.getElementById(BTN);if(!b){b=document.createElement('button');b.id=BTN;b.type='button';b.textContent='10枚 COMPLETE 6.3';b.addEventListener('click',mainAction);document.body.appendChild(b)}Object.assign(b.style,{position:'fixed',right:'8px',top:'48%',zIndex:'2147483647',border:'0',borderRadius:'10px',padding:'10px 13px',background:'#059669',color:'#fff',fontSize:'13px',fontWeight:'800',boxShadow:'0 4px 14px rgba(0,0,0,.28)',touchAction:'manipulation'})}
function xhr(url,responseType='text'){return new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'GET',url,responseType,timeout:25000,onload:r=>r.status>=200&&r.status<300?resolve(r.response):reject(new Error('取得失敗 '+r.status)),onerror:()=>reject(new Error('通信失敗')),ontimeout:()=>reject(new Error('通信タイムアウト'))}))}
function imageInput(input){if(!(input instanceof HTMLInputElement)||input.type!=='file')return false;const a=(input.accept||'').toLowerCase();return !a||a.includes('image')||a.includes('.png')||a.includes('.jpg')||a.includes('.jpeg')}
function metaContent(html,property){const d=new DOMParser().parseFromString(html,'text/html');return d.querySelector(`meta[property="${property}"]`)?.content||d.querySelector(`meta[name="${property}"]`)?.content||''}
async function getThumb(url){const html=await xhr(url,'text'),thumb=metaContent(html,'og:image');if(!thumb)throw new Error('サムネ取得失敗');return thumb}
async function bitmap(blob){if('createImageBitmap'in window)return createImageBitmap(blob);return new Promise((resolve,reject)=>{const im=new Image(),u=URL.createObjectURL(blob);im.onload=()=>{URL.revokeObjectURL(u);resolve(im)};im.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('画像読込失敗'))};im.src=u})}
function rr(c,x,y,w,h,r){const q=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+q,y);c.arcTo(x+w,y,x+w,y+h,q);c.arcTo(x+w,y+h,x,y+h,q);c.arcTo(x,y+h,x,y,q);c.arcTo(x,y,x+w,y,q);c.closePath()}
function lines(c,text,max,maxLines){const out=[];let line='';for(const ch of [...text]){const t=line+ch;if(c.measureText(t).width>max&&line){out.push(line);line=ch;if(out.length===maxLines-1)break}else line=t}if(out.length<maxLines&&line){let used=out.join('').length,rest=[...text].slice(used).join('');if(c.measureText(rest).width>max){while(rest&&c.measureText(rest+'…').width>max)rest=rest.slice(0,-1);rest+='…'}out.push(rest)}return out.slice(0,maxLines)}
async function makeCard(item){const u=await getThumb(item.url),bl=await xhr(u,'blob'),im=await bitmap(bl),cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,W,H);c.strokeStyle='#d9dde3';c.lineWidth=1.5;rr(c,1,1,W-2,H-2,12);c.stroke();const tw=320,th=124,tx=W-tw-8,ty=8,x=16,textW=tx-x-12;c.textBaseline='top';c.fillStyle='#171b21';c.font='700 18px system-ui,-apple-system,sans-serif';lines(c,item.title,textW,3).forEach((s,i)=>c.fillText(s,x,12+i*24));c.fillStyle='#626975';c.font='14px system-ui,-apple-system,sans-serif';c.fillText(CREATOR,x,110);const iw=im.width||im.naturalWidth,ih=im.height||im.naturalHeight,sc=Math.min(tw/iw,th/ih),dw=iw*sc,dh=ih*sc;c.fillStyle='#f7f8fa';rr(c,tx,ty,tw,th,8);c.fill();c.save();rr(c,tx,ty,tw,th,8);c.clip();c.drawImage(im,tx+(tw-dw)/2,ty+(th-dh)/2,dw,dh);c.restore();if(im.close)im.close();const out=await new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(new Error('カード生成失敗')),'image/png',1));return new File([out],String(item.index).padStart(2,'0')+'_compact.png',{type:'image/png'})}
async function prepare10(){const a=[];for(let i=0;i<10;i++){status(`カード準備 ${i+1}/10…`);a.push(await makeCard(ITEMS[i]))}return a}
async function waitNew(count,timeout=45000){const ed=editor();if(!ed)return[];const end=Date.now()+timeout;while(Date.now()<end){const a=[...ed.querySelectorAll('img')].filter(x=>!beforeImages.has(x));if(a.length>=count)return a;await sleep(350)}return[...ed.querySelectorAll('img')].filter(x=>!beforeImages.has(x))}
async function triggerDirect(){for(let i=0;i<30;i++){const b=document.getElementById(DIRECT_BTN);if(b){status('URL書き込み 1/10…');b.click();return true}await sleep(200)}throw new Error('DIRECT SUCCESSが見つかりません')}
async function inject(input){
 if(!armed||consumed||!files.length||!imageInput(input)||beforeInputs.has(input))return false;consumed=true;armed=false;if(timer)clearTimeout(timer);timer=null;const send=files;files=[];const currentMode=mode;const expected=currentMode==='test'?1:10;
 try{const dt=new DataTransfer();send.forEach(f=>dt.items.add(f));input.files=dt.files;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));status(currentMode==='test'?'完成形テスト：極薄画像 1/1 挿入中…':'10枚を一括挿入中…');const imgs=await waitNew(expected);if(imgs.length<expected)throw new Error(`画像 ${imgs.length}/${expected}`);await sleep(900);
  if(currentMode==='test'){const img=imgs[0];mode='idle';consumed=false;status('極薄画像 1/1 ✅ → URL＋通知カード処理へ');showButton(true);document.dispatchEvent(new CustomEvent('mumei-combined-test-image-ready',{detail:{src:img?.src||''}}));return true}
  await triggerDirect();return true
 }catch(e){mode='idle';consumed=false;status('停止：'+(e?.message||String(e)),true);showButton(true);return false}
}
const obs=new MutationObserver(ms=>{if(!armed||consumed)return;for(const m of ms)for(const n of m.addedNodes){if(!(n instanceof Element))continue;if(imageInput(n)){inject(n);return}for(const i of n.querySelectorAll?.('input[type="file"]')||[]){if(imageInput(i)){inject(i);return}}}});
function startObs(){if(!document.documentElement)return setTimeout(startObs,50);obs.observe(document.documentElement,{childList:true,subtree:true})}startObs();
const nativeClick=HTMLInputElement.prototype.click;HTMLInputElement.prototype.click=function(...a){if(armed&&!consumed&&imageInput(this)&&!beforeInputs.has(this)){inject(this);return}return nativeClick.apply(this,a)};

document.addEventListener('mumei-direct-progress',e=>{const i=e.detail?.index||0;if(i)status(`URL書き込み ${i}/10…`)});
document.addEventListener('mumei-direct-stopped',e=>{const i=e.detail?.index||0;consumed=false;retryMode=true;retryIndex=i;status(i?`URL ${i}/10で停止 → ここから再開できます`:'URL処理で停止 → 再開できます',true);buttonText(i?`URL ${i}枚目から再開`:'URL再開');showButton(true);hideDirectUI()});
document.addEventListener('mumei-direct-success-done',e=>{const ok=e.detail?.ok||0;consumed=false;retryMode=false;retryIndex=0;status(`完成：画像10/10・URL ${ok}/10 ✅`,ok!==10);buttonText('10枚 COMPLETE 6.3');showButton(true);hideDirectUI()});
document.addEventListener('mumei-combined-test-complete',()=>status('完成形テスト 1/1 ✅ 公開して通知確認'));

document.addEventListener('mumei-combined-test-request',()=>armCombinedTest());
async function armCombinedTest(){
 if(busy||armed||consumed){status('別の処理中です',true);return}busy=true;showButton(false);mode='test';
 try{const ed=editor();if(!ed)throw new Error('note本文欄が見つかりません');beforeImages=new Set(ed.querySelectorAll('img'));status('完成形テスト：極薄画像 1/1 準備中…');files=[await makeCard(ITEMS[0])];beforeInputs=new Set(document.querySelectorAll('input[type="file"]'));armed=true;consumed=false;document.dispatchEvent(new CustomEvent('mumei-combined-test-armed'));status('テスト準備OK → 本文タップ →「＋」→「画像」を1回');timer=setTimeout(()=>{if(armed&&mode==='test'){armed=false;files=[];mode='idle';status('テスト時間切れ。青ボタンからもう一度',true);showButton(true)}},60000)
 }catch(e){armed=false;files=[];mode='idle';status('テスト停止：'+(e?.message||String(e)),true);showButton(true)}finally{busy=false}
}
async function retryDirect(){const d=document.getElementById(DIRECT_BTN);if(!d){status('DIRECT SUCCESSが見つかりません',true);return}showButton(false);status(retryIndex?`URL ${retryIndex}/10から再開…`:'URL再開…');d.click()}
async function arm(){if(busy)return;busy=true;showButton(false);mode='batch';try{const ed=editor();if(!ed)throw new Error('note本文欄が見つかりません');const d=document.getElementById(DIRECT_BTN);if(!d)throw new Error('先にDIRECT SUCCESSを入れてください');beforeImages=new Set(ed.querySelectorAll('img'));status('固定カード10枚を準備中…');files=await prepare10();beforeInputs=new Set(document.querySelectorAll('input[type="file"]'));armed=true;consumed=false;retryMode=false;retryIndex=0;status('準備OK → 本文タップ →「＋」→「画像」を1回');hideDirectUI();timer=setTimeout(()=>{if(armed&&mode==='batch'){armed=false;files=[];mode='idle';status('時間切れ。もう一度押して',true);showButton(true)}},60000)}catch(e){armed=false;files=[];mode='idle';status('停止：'+(e?.message||String(e)),true);showButton(true)}finally{busy=false}}
function mainAction(){if(retryMode)return retryDirect();return arm()}
setInterval(mount,700);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
