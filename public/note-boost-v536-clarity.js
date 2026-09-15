(() => {
'use strict';
if(window.__NOTE_BOOST_V536_CLARITY__)return;
window.__NOTE_BOOST_V536_CLARITY__=true;

const K='note巡回BOOST_v531';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(`${K}:${k}`))??fb}catch{return fb}};
let activeKey='',activeState='checking',seq=0,cardObserver=null;
const cache=new Map();
const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};
function q(){const a=load('queue',[]);return Array.isArray(a)?a:[]}
function idx(){return Math.max(0,Number(load('index',0))||0)}
function cur(){return q()[idx()]||null}
function done(s){return s==='preexisting'||s==='liked_now'}
function readLiked(j){const d=j?.data??j??{},n=d.note||d;for(const k of ['isLiked','is_liked','liked','hasLiked'])if(typeof n?.[k]==='boolean')return n[k];return null}
function ensureBand(){
  const card=$('#nb532-card');if(!card)return null;let e=$('#nb536-currentlike');
  if(!e){e=document.createElement('div');e.id='nb536-currentlike';e.style.cssText='margin:6px 0;padding:8px 10px;border:1px solid #466b7d;border-radius:9px;background:#07151e;color:#fff;font:950 12px/1.35 system-ui;text-align:center;letter-spacing:.02em';const top=card.querySelector('.nb532-top');if(top)top.insertAdjacentElement('afterend',e);else card.prepend(e)}
  return e;
}
function paint(state,x){
  const e=ensureBand();if(!e||!x)return;activeState=state;
  let text='🔎 この人のスキ状態を確認中',btn='🔎 確認中',border='#466b7d',bg='#07151e';
  if(x.likeState==='liked_now'){text='❤️ この人は今回スキ済み ✓';btn='❤️ 今回済';border='#d95079';bg='#32101b'}
  else if(x.likeState==='preexisting'||state==='preexisting'){text='💗 この人は元からスキ済み ✓';btn='💗 元から済';border='#c94d98';bg='#2a1024'}
  else if(state==='unliked'){text='♡ この人は未スキ';btn='♡ スキ';border='#6d8794';bg='#101a20'}
  else if(state==='error'){text='⚠ この人のスキ状態を判定できません';btn='♡ 判定不能';border='#b06a54';bg='#2b1710'}
  setText(e,text);if(e.style.borderColor!==border)e.style.borderColor=border;if(e.style.background!==bg)e.style.background=bg;
  const b=$('#nb532-like');setText(b,btn);
  const strong=$('#nb532-card .nb532-top strong');setText(strong,text.replace(/^.[^ ]* /,''));
  const st=$('#nb532-status');if(st){setText(st,`現在 @${x.urlname||'?'}｜${text}`);st.dataset.bad=state==='error'?'1':'0'}
}
async function probe(force=false){
  const x=cur();if(!x?.key)return;const key=String(x.key);
  if(key!==activeKey){activeKey=key;activeState='checking';seq++;paint('checking',x)}
  if(done(x.likeState)){paint(x.likeState,x);return}
  const c=cache.get(key);if(!force&&c&&Date.now()-c.t<30000){paint(c.state,x);return}
  const s=++seq;
  try{const r=await fetch(`/api/v3/notes/${encodeURIComponent(key)}`,{credentials:'include',headers:{accept:'application/json'}});if(!r.ok)throw 0;const j=await r.json();if(s!==seq||cur()?.key!==key)return;const liked=readLiked(j),state=liked===true?'preexisting':liked===false?'unliked':'error';cache.set(key,{state,t:Date.now()});paint(state,cur())}
  catch{if(s===seq&&cur()?.key===key)paint('error',cur())}
}
function fixHistory(){const a=q();for(const row of $$('.nb532-state-row')){const i=Number(row.dataset.i),x=a[i],s=x?.likeState||'pending';row.dataset.state=s;const span=row.querySelector('span');setText(span,s==='preexisting'?'💗元から':s==='liked_now'?'❤️今回':'⏸未処理')}}
function updateVersion(){setText($('#nb532-panel .nb532-head b'),'巡回BOOST 5.3.7')}
function onCardChanged(){
  const x=cur(),key=String(x?.key||'');if(!key)return;
  updateVersion();
  if(key!==activeKey){activeKey='';void probe(true);return}
  // コアがカードを再描画して帯が消えた場合だけ、取得済み状態を戻す。
  if(!$('#nb536-currentlike'))paint(activeState,x);
}
function attachCard(){
  const card=$('#nb532-card');if(!card||cardObserver)return false;
  cardObserver=new MutationObserver(()=>{clearTimeout(window.__nb536CardT);window.__nb536CardT=setTimeout(onCardChanged,0)});
  cardObserver.observe(card,{childList:true,subtree:true});onCardChanged();return true;
}
// 元からスキ済みで「次へ」を押した場合はコアの安全判定を通して完了記録してから進む。
document.addEventListener('click',e=>{
  const t=e.target instanceof Element?e.target.closest('#nb532-next,#nb533-prev,#nb532-start,#nb532-states'):null;
  if(!t)return;
  if(t.id==='nb532-next'&&activeState==='preexisting'){
    const x=cur();if(x&&!done(x.likeState)){e.preventDefault();e.stopImmediatePropagation();$('#nb532-like')?.click();return}
  }
  if(t.id==='nb532-states')setTimeout(fixHistory,0);
  setTimeout(()=>{attachCard();onCardChanged()},0);
},true);

function boot(){
  updateVersion();
  if(attachCard())return;
  const root=document.body||document.documentElement;
  const wait=new MutationObserver(()=>{if(attachCard())wait.disconnect()});wait.observe(root,{childList:true,subtree:true});
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();