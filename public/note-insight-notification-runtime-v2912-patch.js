(function(){
'use strict';
const VERSION='2.9.12';
const INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-ingest-v2';
const TOKEN='mumei_insight_notification_sync_token_v2:';
const SOURCE='note-notification-manual-sync-v2912';
const SELF_ADDED=/あなたの記事が.{0,420}?に追加されました/u;
const ITEM_SELECTOR='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i],li[role="listitem"],article';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const stable=v=>clean(v).replace(/\s(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)$/u,'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function hasModern(){return Boolean(globalThis.GM)}
async function get(k,d){if(hasModern()&&typeof globalThis.GM.getValue==='function')return await globalThis.GM.getValue(k,d);if(typeof globalThis.GM_getValue==='function')return await globalThis.GM_getValue(k,d);return d}
function request(url,body,headers={}){return new Promise((resolve,reject)=>{const fn=hasModern()&&typeof globalThis.GM.xmlHttpRequest==='function'?globalThis.GM.xmlHttpRequest:typeof globalThis.GM_xmlhttpRequest==='function'?globalThis.GM_xmlhttpRequest:null;if(!fn){reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));return}fn({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300?resolve(p):reject(new Error(p.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
async function currentAccount(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',headers:{accept:'application/json'},cache:'no-store'});if(!r.ok)return null;const j=await r.json(),d=j?.data??j??{},u=d.user||d,id=String(u.urlname||u.url_name||u.username||'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?id:null}catch{return null}}
function noteLinks(el){return[...el.querySelectorAll('a[href]')].map(a=>{try{return{u:new URL(a.getAttribute('href'),location.href).href,t:clean(a.innerText)}}catch{return null}}).filter(Boolean).filter(x=>/^https:\/\/(?:www\.)?note\.com\//.test(x.u))}
function selfRows(){const out=new Map();for(const el of document.querySelectorAll(ITEM_SELECTOR)){if(el.id==='mumei-v297-actions'||el.closest?.('#mumei-v297-actions'))continue;const raw=clean(el.innerText||el.textContent);if(raw.length<8||raw.length>560||!SELF_ADDED.test(raw))continue;const ls=noteLinks(el),target=ls.find(x=>/\/m\//.test(x.u))||ls.find(x=>/\/n\//.test(x.u))||ls[0];if(!target)continue;const tm=el.querySelector('time[datetime]')?.getAttribute('datetime')||el.querySelector('[datetime]')?.getAttribute('datetime')||null,sig=[stable(raw),target.u,tm||''].join('|');if(out.has(sig))continue;out.set(sig,{raw_text:raw,actor_name:null,actor_url:null,actor_image_url:null,target_title:target.t||null,target_url:target.u,source_url:target.u,occurred_at:tm,meta:{source:SOURCE,via:'self-magazine-added-v2912',userscript:VERSION,supplement:true}})}return[...out.values()]}
async function save(rows){if(!rows.length)return;const id=await currentAccount();if(!id)return;const token=String(await get(TOKEN+id,'')||'');if(!token)return;for(let i=0;i<rows.length;i+=100)await request(INGEST,{noteId:id,notifications:rows.slice(i,i+100)},{'X-Ingest-Token':token})}
async function saveCurrent(){await sleep(120);await save(selfRows())}
async function followPast(button){const seen=new Map(),started=Date.now();for(let i=0;i<150;i++){for(const row of selfRows()){const k=[stable(row.raw_text),row.target_url||'',row.occurred_at||''].join('|');seen.set(k,row)}await sleep(250);if(Date.now()-started>1200&&!button.disabled)break;if(Date.now()-started>36000)break}for(const row of selfRows()){const k=[stable(row.raw_text),row.target_url||'',row.occurred_at||''].join('|');seen.set(k,row)}await save([...seen.values()])}
document.addEventListener('click',event=>{const button=event.target instanceof Element?event.target.closest('#mumei-v297-actions button'):null;if(!button)return;const label=clean(button.textContent);if(/表示分読込/.test(label))void saveCurrent();else if(/過去まで読込/.test(label))void followPast(button)},true);
})();
