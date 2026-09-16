(async function(){
'use strict';
/* compatibility markers: rediscoverPanel confirmedClientSignatures mumei-v3-reader-status */
if(location.hostname!=='note.com')return;
const LEGACY='https://mumei-s.github.io/note-insight/note-insight-notification-reader-v323-legacy.js?v=resume-20260917b';
const CHECK='mumei_insight_notification_checkpoint_v2922:';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[class*="NotificationItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const TIME_RE=/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)/u;
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const stripTime=v=>clean(v).replace(/\s*(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)$/u,'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const modern=()=>Boolean(globalThis.GM);
async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function currentId(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j);return String(u?.urlname||u?.url_name||u?.username||'').replace(/^@/,'').toLowerCase()}catch{return''}}
function legacyText(){return new Promise((resolve,reject)=>{const req={method:'GET',url:LEGACY,headers:{'Cache-Control':'no-cache'},timeout:20000,onload:r=>r.status>=200&&r.status<300?resolve(String(r.responseText||'')):reject(new Error('LEGACY_HTTP_'+r.status)),onerror:()=>reject(new Error('LEGACY_NETWORK_ERROR')),ontimeout:()=>reject(new Error('LEGACY_TIMEOUT'))};try{if(modern()&&typeof GM.xmlHttpRequest==='function'){GM.xmlHttpRequest(req);return}if(typeof GM_xmlhttpRequest==='function'){GM_xmlhttpRequest(req);return}}catch{}fetch(LEGACY,{cache:'no-store'}).then(r=>r.ok?r.text():Promise.reject(new Error('LEGACY_HTTP_'+r.status))).then(resolve,reject)})}
function visible(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'}
function rows(){return [...document.querySelectorAll(ITEM)].filter(visible).filter(el=>{const t=clean(el.textContent);return t.length>=3&&t.length<=4000&&(el.matches('.m-navbarNoticeItem,[data-testid="notification-item"],[data-testid="notice-item"]')||TIME_RE.test(t))})}
function links(el){const out=[];for(const a of [...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')]){try{const u=new URL(a.getAttribute('href'),location.href);if(u.hostname.endsWith('note.com'))out.push(u.href)}catch{}}return out}
function legacySig(el){const raw=clean(el.textContent),ls=links(el),actor=ls.find(u=>{try{const p=new URL(u).pathname.split('/').filter(Boolean);return p.length===1}catch{return false}})||'',target=ls.find(u=>/\/n\/|\/m\/|\/membership|kind=|scrollpos=comment/i.test(u))||'';return[stripTime(raw),String(target).split('#')[0],String(actor).split('?')[0]].join('|')}
function scrollHost(){const rs=rows();let x=rs[0];while(x){if(x.scrollHeight>x.clientHeight+20&&/(auto|scroll)/.test(getComputedStyle(x).overflowY))return x;x=x.parentElement}return document.scrollingElement||document.documentElement}
function status(message,label='下から自動読込',kind='saving'){document.dispatchEvent(new CustomEvent('mumei-v3-reader-status',{detail:{message,kind,label}}))}
async function findCheckpoint(host,boundary){if(!boundary)return false;let stable=0,last=-1;for(let i=0;i<100;i++){if(rows().some(r=>legacySig(r)===boundary))return true;host.scrollTop=Math.max(0,host.scrollHeight-host.clientHeight);await sleep(280);const h=host.scrollHeight;if(h===last)stable++;else stable=0;last=h;if(stable>=4)break}return rows().some(r=>legacySig(r)===boundary)}
let swallowed=false;const swallow=e=>{if(!swallowed){swallowed=true;e.stopImmediatePropagation()}};document.addEventListener('mumei-v3-reader-ready',swallow,true);
try{
 const src=await legacyText();
 if(!src.trim())throw new Error('LEGACY_READER_EMPTY');
 (0,eval)(src+'\n//# sourceURL='+LEGACY);
}finally{document.removeEventListener('mumei-v3-reader-ready',swallow,true)}
const api=window.__mumeiV3Reader323;if(!api||typeof api.scan!=='function')throw new Error('LEGACY_READER_NOT_READY');
const original=api.scan.bind(api);let resumeRunning=false,resumeStop=false;
api.scan=async function(){
 if(resumeRunning){
  resumeStop=true;
  try{if(typeof api.isScanning==='function'&&api.isScanning())await original()}catch{}
  return;
 }
 const id=await currentId(),cp=id?await get(CHECK+id,{}):{};
 if(!id||cp?.historyComplete!==true||!cp?.boundaryLegacySignature)return original();
 resumeRunning=true;resumeStop=false;const host=scrollHost(),restore=Number(host?.scrollTop||0);
 try{
  status('前回の保存完了位置を探しています…','前回位置へ');
  const found=host?await findCheckpoint(host,cp.boundaryLegacySignature):false;
  if(!found){status('前回位置を確認できないため通常読込へ切り替えます','通常読込');return await original()}
  const boundaryRow=rows().find(r=>legacySig(r)===cp.boundaryLegacySignature);if(boundaryRow)try{boundaryRow.scrollIntoView({block:'center',behavior:'auto'})}catch{}
  status('前回保存位置から新しい通知へ、下→上で読み込みます…','下から自動読込');
  let last=Infinity,guard=0;
  while(host&&host.scrollTop>1&&!resumeStop&&guard++<100){
   await original();
   if(resumeStop)break;
   const step=Math.max(180,Math.floor(host.clientHeight*.72));host.scrollTop=Math.max(0,host.scrollTop-step);await sleep(220);
   if(host.scrollTop===last)break;last=host.scrollTop;
  }
  if(!resumeStop)await original();
  else status('停止位置まで保存しました。次回は保存済み位置から再開します','停止保存','done');
 }finally{try{if(host)host.scrollTop=restore}catch{}resumeRunning=false;resumeStop=false}
};
window.__mumeiV3Reader323=api;window.__mumeiV3Reader323Ready=true;document.dispatchEvent(new Event('mumei-v3-reader-ready'));
})();