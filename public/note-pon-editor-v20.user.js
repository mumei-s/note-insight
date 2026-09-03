// ==UserScript==
// @name         note ポン出し v22｜固定記事厳密＋即カード化
// @namespace    https://github.com/mumei-s/note-insight
// @version      22.0.0
// @description  最新版1本。各マガジンページ内の「固定された記事」直後1件だけを取得。マガジンURLと固定記事URLを本文へ直接挿入し、旧v14待ちなしで両方を即noteカード化。貼付一覧だけ全消し。
// @author       無名S note
// @match        https://editor.note.com/*
// @grant        GM_xmlhttpRequest
// @connect      note.com
// @connect      raw.githubusercontent.com
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v14.user.js?v=22.0.0
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v20.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v20.user.js
// ==/UserScript==

(() => {
'use strict';
if (window.__MUMEI_PON_V22__) return;
window.__MUMEI_PON_V22__ = true;
['__MUMEI_PON_V15_ADDON__','__MUMEI_PON_V16_ADDON__','__MUMEI_PON_V171_ADDON__','__MUMEI_PON_V172_ADDON__','__MUMEI_PON_V173_ADDON__','__MUMEI_PON_V18__','__MUMEI_PON_V181__','__MUMEI_PON_V19__','__MUMEI_PON_V20__','__MUMEI_PON_V21__'].forEach(k=>window[k]=true);

const SAVED='https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-pon-editor-v15.user.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EXKEY=new Set(['m535c97031825','m7ffeddfdfb3c']);
const EXTITLE=/(コメントできなくなりました|ちび創作大賞|スキ動画コンテスト)/;
const COUNT={mf534419e7479:10,m300d06308833:10,m9872a92a8af5:10,mbefcb2e5a397:5,m1df0b906bace:5,m74b154cd7893:5,m653e8e82ea44:5,m4d9b9698cacf:5,mb028566a46ee:5,md96759f4be5b:5,mb80f5e0f9b99:5,m3759ff7a5b9c:5,m9e01fdb0606f:5,ma475a8bdcecc:5,m254cc8180f92:5,mba58a6f9aacf:5,m9bb45783969e:5,m33495b5ea807:5,m752f734f7a1c:4,mef2032492c4a:3,mb3dc2cd9766e:3,macfef0fcc489:3,m5db97d398203:3,mc4827a8e939b:3,m9186cf842d83:3,me86c388d3826:3,m95b78222e9b9:3,m16580951510b:3,ma4dad1f25900:3,mf2e99e9aa411:2,mc9bf7875a8d7:2,meadce3d098b0:2,mf7c9271b4e5e:2,m8d6e2d4322c8:2,m4eb9deb52a78:1,mf21f18654494:1,md3a807653baf:1,mbe79c0d9105c:1,m9f1b6d83fe39:1,ma7a2c6649fa2:1};
const UNLIM=new Set(['mff26de4b50e8','m3a58ed12c332','ma8d107d9475f','m6cf909200081','mad3a5537da46','m97848c1bdf32']);
const PAID=new Set(['mb4495066c358']);
let cardCmd=null,busy=false;
const clean=u=>{try{const x=new URL(u,'https://note.com');x.search='';x.hash='';return x.href}catch{return''}};
const mkey=u=>(String(u).match(/\/m\/(m[a-z0-9]+)/i)||[])[1]||'';
const own=u=>{try{return new URL(u).pathname.split('/').filter(Boolean)[0]||''}catch{return''}};
const isMag=u=>/^https:\/\/note\.com\/[^/]+\/m\/m[a-z0-9]+$/i.test(u);
const isArt=u=>/^https:\/\/note\.com\/[^/]+\/n\/n[a-z0-9]+$/i.test(u);
const isNote=u=>isMag(u)||isArt(u);
const get=url=>new Promise((res,rej)=>GM_xmlhttpRequest({method:'GET',url,timeout:24000,onload:r=>r.status<400?res(r.responseText):rej(Error('HTTP '+r.status)),onerror:()=>rej(Error('通信失敗')),ontimeout:()=>rej(Error('timeout'))}));

function savedRows(src){const m=String(src).match(/const FALLBACK=`([\s\S]*?)`\.trim\(\)\.split/);if(!m)return[];const seen=new Set();return m[1].trim().split('\n').map((line,index)=>{const p=line.lastIndexOf('|');if(p<1)return null;const title=line.slice(0,p).trim(),url=clean(line.slice(p+1).trim()),k=mkey(url);if(!k||!isMag(url)||seen.has(k)||EXKEY.has(k)||EXTITLE.test(title))return null;seen.add(k);return{title,url,index}}).filter(Boolean)}
async function rows(){return savedRows(await get(SAVED))}
function artUrl(a){const u=clean(a?.getAttribute?.('href')||'');return isArt(u)?u:''}

function exactPinned(dom,ownerName){
  const all=[...dom.querySelectorAll('body *')];
  const marker=all.find(e=>e.children.length===0&&(e.textContent||'').trim()==='固定された記事');
  if(!marker)return'';
  const links=[...dom.querySelectorAll('a[href]')];
  for(const a of links){
    if(!(marker.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING))continue;
    const u=artUrl(a);
    if(u&&own(u)===ownerName)return u;
  }
  return'';
}
function desc(html,k,dom){const meta=dom.querySelector('meta[name="description"]')?.content||dom.querySelector('meta[property="og:description"]')?.content||'';const at=html.indexOf(k),r=at>=0?html.slice(Math.max(0,at-100000),Math.min(html.length,at+150000)):html;const re=/["']description["']\s*:\s*"((?:\\.|[^"\\])*)"/g;let m,b=meta;while((m=re.exec(r)))try{const v=JSON.parse('"'+m[1]+'"');if(v.length>b.length&&v.length<20000)b=v}catch{}return b}
function articleText(html){const d=new DOMParser().parseFromString(html,'text/html');d.querySelectorAll('del,s,strike,[style*="line-through"]').forEach(e=>e.remove());return(d.querySelector('article')?.innerText||d.body?.innerText||d.body?.textContent||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()}
const digit=t=>String(t||'').replace(/[０-９]/g,d=>String.fromCharCode(d.charCodeAt(0)-0xFEE0));
function limit(text){const t=digit(text).replace(/\s+/g,' ');if(!t)return null;if(/(?:投稿数|投稿回数|追加本数|記事追加|投稿|寄稿)[^。]{0,45}?(?:無制限|制限なし|上限なし)|(?:1日|一日|毎日)[^。]{0,65}?(?:上限|制限)[^。]{0,24}?(?:なし|ありません|ない|無い)|(?:何本でも|何記事でも)[^。]{0,20}?(?:投稿|追加|OK|可)/.test(t)&&!/(?:以前|過去|かつて)[^。]{0,30}(?:無制限|上限なし|制限なし)/.test(t))return{type:'unlimited'};const ps=[/(?:1人|お一人(?:様)?|ひとり)?\s*(?:につき|あたり|当たり|の)?\s*(?:1日|一日|毎日)[^0-9。]{0,22}?(\d+)\s*(?:本|記事|投稿|回|件)/,/(?:1日|一日|毎日)[^。]{0,55}?(?:投稿|追加|記事|本数|回数)?[^。0-9]{0,20}?(\d+)\s*(?:本|記事|投稿|回|件)/];for(const re of ps){const m=t.match(re);if(m){const n=+m[1];if(n>0&&n<100)return{type:'count',count:n}}}return null}
function paid(t){return/(?:有料記事|有料note)[^。]{0,32}(?:禁止|不可|NG|ご遠慮)|(?:無料記事のみ|無料の記事のみ)/i.test(digit(t))}
function fallback(k,title,o){if(UNLIM.has(k))return{type:'unlimited'};if(k in COUNT)return{type:'count',count:COUNT[k]};if(o==='ss_yr'){const m=String(title).match(/^([1-9])️⃣/);if(m)return{type:'count',count:+m[1]}}return{type:'none'}}
async function inspect(row){
  const k=mkey(row.url),o=own(row.url);let title=row.title,d='',pin='',pt='';
  try{
    const html=await get(row.url),dom=new DOMParser().parseFromString(html,'text/html');
    title=[...dom.querySelectorAll('h1')].map(x=>(x.textContent||'').trim()).find(Boolean)||title;
    d=desc(html,k,dom);
    pin=exactPinned(dom,o);
    if(pin)try{pt=articleText(await get(pin))}catch{pt=''}
  }catch{}
  let rule=limit(pt)||limit(d)||fallback(k,title,o);
  if(k==='m752f734f7a1c')rule={type:'count',count:4};
  if(k==='m8d6e2d4322c8')rule={type:'count',count:2};
  if(k==='ma4dad1f25900')rule={type:'count',count:3};
  if(['mbe79c0d9105c','m9f1b6d83fe39','ma7a2c6649fa2'].includes(k)&&rule.type==='none')rule={type:'count',count:1};
  return{...row,title,display:o==='ss_yr'?`👑 ${title}`:title,pin,rule,paid:PAID.has(k)||paid(pt+' '+d)};
}
async function inspectAll(input,show){const out=new Array(input.length);let cur=0,done=0;await Promise.all(Array.from({length:7},async()=>{while(true){const i=cur++;if(i>=input.length)return;out[i]=await inspect(input[i]);show(`投稿回数・固定記事を確認 ${++done}/${input.length}`)}}));return out.filter(Boolean)}
const gkey=r=>r.type==='count'?r.count:r.type;
const glabel=g=>g==='unlimited'?'♾️ 無制限・制限なし':g==='none'?'❓ 制限数の表記を確認できないマガジン':`${g===10?'🔟':g+'️⃣'} 1日${g}記事まで`;
function build(items){const gs=new Map();for(const x of items){const g=gkey(x.rule);if(!gs.has(g))gs.set(g,[]);gs.get(g).push(x)}const nums=[...gs.keys()].filter(x=>typeof x==='number').sort((a,b)=>b-a),order=[];if(gs.has('unlimited'))order.push('unlimited');order.push(...nums);if(gs.has('none'))order.push('none');const out=[];for(const g of order){out.push('# '+glabel(g),'');for(const x of gs.get(g).sort((a,b)=>a.index-b.index)){out.push('## '+x.display,'');if(x.paid)out.push('※有料記事追加不可','');out.push(`マガジンURL：${x.url}`,x.url,'');if(x.pin)out.push(`固定記事URL：${x.pin}`,x.pin,'');out.push('---','')}}return out.join('\n').replace(/\n{3,}/g,'\n\n').trim()}

function looksView(v){try{return!!(v&&v.state?.doc&&v.state?.schema&&typeof v.dispatch==='function'&&v.dom)}catch{return false}}
function findView(){const root=document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror');if(!root)return null;const q=[];let n=root;for(let i=0;i<8&&n;i++,n=n.parentElement)q.push([n,0]);const seen=new Set();while(q.length){const[v,d]=q.shift();if(!v||(typeof v!=='object'&&typeof v!=='function')||seen.has(v))continue;seen.add(v);if(looksView(v))return v;if(d>=6)continue;let ks=[];try{ks=Object.getOwnPropertyNames(v)}catch{continue}for(const k of ks){if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k))continue;let x;try{x=v[k]}catch{continue}if(x&&(typeof x==='object'||typeof x==='function')&&!seen.has(x))q.push([x,d+1])}}return null}
function webpackReq(){const c=window.webpackChunk_N_E;if(!c||typeof c.push!=='function')return null;let r=null;try{c.push([[988000000+Math.floor(Math.random()*8000000)],{},x=>{r=x}])}catch{}return r}
function factory(){if(typeof cardCmd==='function')return cardCmd;const r=webpackReq();if(!r)return null;try{const m=r(94928);if(typeof m?.fjT==='function')return cardCmd=m.fjT}catch{}return null}
function rawRows(v){const a=[];v.state.doc.descendants((n,p)=>{if(n.isTextblock){const u=(n.textContent||'').trim();if(isNote(u))a.push({pos:p,url:u})}return true});return a.sort((a,b)=>b.pos-a.pos)}
function cursor(v,p){const n=v.state.doc.nodeAt(p);if(!n)return false;try{const e=Math.max(1,Math.min(v.state.doc.content.size,p+n.nodeSize-1)),S=v.state.selection.constructor;v.dispatch(v.state.tr.setSelection(S.near(v.state.doc.resolve(e),-1)));v.focus();return true}catch{return false}}
function exists(v,u){let h=false;v.state.doc.descendants(n=>{if(h)return false;if(n.isTextblock&&(n.textContent||'').trim()===u){h=true;return false}return true});return h}
async function oneCard(v,row){const f=factory();if(!f||!cursor(v,row.pos))return false;try{const c=f(row.url);if(typeof c!=='function')return false;const r=c(v.state,tr=>v.dispatch(tr),v);if(r?.then)try{await r}catch{}}catch{return false}const end=Date.now()+4500;while(Date.now()<end){if(!exists(v,row.url))return true;await sleep(120)}return false}
async function cards(show){const v=findView();if(!v)throw Error('EditorViewなし');for(let pass=0;pass<4;pass++){const list=rawRows(v);if(!list.length)return 0;for(let i=0;i<list.length;i++){show(`🃏 カード化 ${i+1}/${list.length}｜マガジン＋固定記事`);await oneCard(v,list[i]);await sleep(110);if((i+1)%15===0)await sleep(350)}await sleep(450)}return rawRows(v).length}

function parseLine(schema,t){
  const text=s=>s?schema.text(s):null;
  if(/^#\s+/.test(t))return schema.nodes.heading.create({level:2},text(t.replace(/^#\s+/,'')));
  if(/^##\s+/.test(t))return schema.nodes.heading.create({level:3},text(t.replace(/^##\s+/,'')));
  if(/^-{3,}$/.test(t)){const hr=schema.nodes.horizontal_rule||schema.nodes.horizontalRule||schema.nodes.hr;if(!hr)throw Error('区切り線ノードなし');return hr.create()}
  const p=schema.nodes.paragraph;if(!p)throw Error('paragraphノードなし');return p.create(null,text(t));
}
function insertBuilt(source){
  const v=findView();if(!v)throw Error('EditorViewなし');
  const lines=String(source||'').replace(/\r/g,'').split('\n');
  const schema=v.state.schema;let tr=v.state.tr,pos=tr.doc.content.size;
  for(const raw of lines){const t=raw.trim();if(!t)continue;const node=parseLine(schema,t);tr=tr.insert(pos,node);pos+=node.nodeSize}
  v.dispatch(tr);return v;
}

function top(v){const a=[];v.state.doc.forEach((n,p)=>a.push({n,p,t:(n.textContent||'').trim()}));return a}
const isGroup=t=>/^(?:♾️ 無制限・制限なし|❓ 制限数の表記を確認できないマガジン|(?:🔟|[1-9]️⃣) 1日\d+記事まで)$/.test(t);
function clearList(src,show){const v=findView();if(!v)throw Error('EditorViewなし');const a=top(v);let start=-1,lastHr=-1,started=false;for(let i=0;i<a.length;i++){const x=a[i];if(!started&&isGroup(x.t)){start=x.p;started=true;continue}if(!started)continue;if(x.n.type?.name==='heading'&&x.n.attrs?.level===2&&!isGroup(x.t))break;if(/horizontal/i.test(x.n.type?.name||''))lastHr=x.p+x.n.nodeSize}if(start<0){src.value='';show('✅ 貼付一覧なし');return}const end=lastHr>start?lastHr:v.state.doc.content.size;v.dispatch(v.state.tr.delete(start,end));src.value='';show('🧹 ポン出し貼付分を全部削除 ✅')}

function install(){
  const root=document.getElementById('__mumei_pon_v14_root__');if(!root)return setTimeout(install,250);
  const panel=root.querySelector('#ponPanel14'),src=root.querySelector('#ponSrc14'),st=root.querySelector('#ponStatus14'),head=root.querySelector('#ponDrag14 b');
  if(!panel||!src||!st)return setTimeout(install,250);
  if(head)head.textContent='↔️ ポン出し v22';
  ['ponMags19','ponClearList21','ponMake21','ponCards21','ponClearList22','ponMake22','ponCards22'].forEach(id=>document.getElementById(id)?.remove());
  const say=t=>st.textContent=t;

  const del=document.createElement('button');del.id='ponClearList22';del.textContent='🧹 ポン出し貼付分を全部消す';del.style.cssText='display:block;width:100%;border:1px solid #ff8d8d;border-radius:8px;padding:9px 5px;background:#5b1f29;color:#fff;font-weight:900;font-size:11px;margin-bottom:5px';panel.insertBefore(del,src);del.onclick=()=>{try{clearList(src,say)}catch(e){say('❌ '+(e?.message||e))}};

  const make=document.createElement('button');make.id='ponMake22';make.textContent='📚 回数整理→マガジン＋固定記事を即カード';make.style.cssText='display:block;width:100%;border:0;border-radius:8px;padding:9px 5px;background:#ffd54a;color:#261f00;font-weight:900;font-size:11px;margin-bottom:5px';panel.insertBefore(make,src);
  make.onclick=async()=>{
    if(busy)return;busy=true;make.disabled=true;
    try{
      say('参加中一覧を取得…');
      const list=await rows();if(!list.length)throw Error('参加中マガジン一覧を取得できません');
      const items=await inspectAll(list,say);
      src.value=build(items);
      say(`本文へ挿入中｜固定記事 ${items.filter(x=>x.pin).length}件`);
      insertBuilt(src.value);
      const left=await cards(say);
      say(left?`⚠️ 生URL残り ${left}件｜下のカード化ボタンでもう一度`:`✅ 完了｜マガジン＋固定記事を全カード化`);
    }catch(e){say('❌ '+(e?.message||e))}
    finally{busy=false;make.disabled=false}
  };

  const card=document.createElement('button');card.id='ponCards22';card.textContent='🃏 残りURLを全部カード化';card.style.cssText='display:block;width:100%;border:0;border-radius:8px;padding:9px 5px;background:#72f1c9;color:#032b25;font-weight:900;font-size:11px;margin-bottom:5px';panel.insertBefore(card,src);
  card.onclick=async()=>{if(busy)return;busy=true;card.disabled=true;try{const left=await cards(say);say(left?`⚠️ 生URL残り ${left}件｜もう一度カード化`:'✅ マガジン＋固定記事カード化完了')}catch(e){say('❌ '+(e?.message||e))}finally{busy=false;card.disabled=false;make.disabled=false}};
}
install();
})();
