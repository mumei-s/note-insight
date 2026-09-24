(function(){
'use strict';
const PANEL='mumei-note-source-picker-v163';
const BOX='mumei-prince-special-v184';
const STYLE='mumei-generic-controls-v189-style';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(window.__MUMEI_GENERIC_CONTROLS_189__)return;
window.__MUMEI_GENERIC_CONTROLS_189__=true;

function css(){
 if(document.getElementById(STYLE)||!document.head)return;
 const s=document.createElement('style');s.id=STYLE;s.textContent=`
#${PANEL} .actions,#${PANEL} .resume{display:none!important}
#${PANEL} .mumei-generic-controls-v189{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-top:5px}
#${PANEL} .mumei-generic-controls-v189 button{min-width:0!important;height:30px!important;min-height:30px!important;padding:2px!important;border-radius:7px!important;color:#fff!important;font-size:10px!important;font-weight:900!important}
#${PANEL} .mumei-generic-controls-v189 [data-g="image"]{background:#2563eb!important}
#${PANEL} .mumei-generic-controls-v189 [data-g="send"]{background:#7c3aed!important}
#${PANEL} .mumei-generic-controls-v189 [data-g="delete"]{background:#b91c1c!important}
#${PANEL} .mumei-generic-controls-v189 [data-g="reset"]{background:#7f1d1d!important}
#${PANEL} .mumei-generic-controls-v189-note{font-size:8px;line-height:1.2;color:#94a3b8;margin-top:4px}
#${PANEL}[data-card-phase="work"] .mumei-prince-special-v184>:not(.mumei-generic-controls-v189):not(#mumei-prepared-load){display:none!important}
#${PANEL}[data-card-phase="work"] .mumei-generic-controls-v189{grid-template-columns:repeat(2,1fr)}
#${PANEL}[data-card-phase="work"] [data-g="reset"],#${PANEL}[data-card-phase="work"] [data-g="image"]{display:none!important}
#${PANEL}[data-card-combined="1"] [data-g="image"],#${PANEL}[data-card-combined="1"] #mumei-prepared-load{display:none!important}
#${PANEL}[data-card-phase="work"] #mumei-prepared-load>button:not([data-prepared-additions]){display:none!important}
#${PANEL}[data-card-phase="work"] #mumei-prepared-load{margin-top:0!important}
#${PANEL} [data-prepared-additions][hidden],#${PANEL} [data-safe][hidden]{display:none!important}
#${PANEL}[data-card-phase="work"][data-card-needs-recovery="0"] [data-safe="backup"]{display:none!important}
#${PANEL} #mumei-note-source-status-v163[data-bad="1"]{max-height:none!important;overflow:visible!important;white-space:normal!important;overflow-wrap:anywhere;font-size:10px!important}
`;
 document.head.appendChild(s);
}
function fire(action){
 const panel=document.getElementById(PANEL);if(!panel)return;
 const target=panel.querySelector(`button[data-a="${action}"]`);
 if(target&&!target.disabled)target.click();
}
function mount(){
 css();const panel=document.getElementById(PANEL);if(!panel)return false;
 const box=panel.querySelector(`.${BOX}`);if(!box)return false;
 updateControls(panel);
 if(box.querySelector('.mumei-generic-controls-v189'))return true;
 const row=document.createElement('div');row.className='mumei-generic-controls-v189';
 row.innerHTML='<button type="button" data-g="image">画</button><button type="button" data-g="send">送</button><button type="button" data-g="delete">削</button><button type="button" data-g="reset">初期化</button>';
 const note=document.createElement('div');note.className='mumei-generic-controls-v189-note';note.textContent='宵空セット＝作成済み画像を連続投入／削＝通知カード一括削除';
 box.append(row,note);
 row.addEventListener('click',e=>{
   const b=e.target.closest('button[data-g]');if(!b)return;
   e.preventDefault();e.stopPropagation();
   const a=b.dataset.g;
   if(a==='image')fire('image');
   if(a==='send')fire('send');
   if(a==='delete')fire('delete');
   if(a==='reset')fire('reset');
 });
 return true;
}
function updateControls(panel){
 try{
  const article=location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1];
  const data=JSON.parse(localStorage.getItem('mumei_likers_thin_dataset_v160')||'null');
  const run=JSON.parse(localStorage.getItem('mumei_likers_thin_run_v160:'+article)||'null');
  const matching=!!data&&!!run&&data.datasetId===run.datasetId;
  const count=matching?Object.keys(run.images||{}).length:0;
  const working=matching&&(count>0||run.cardKeys?.length>0||!!run.pending);
  panel.dataset.cardPhase=working?'work':'';
  panel.dataset.cardCombined=matching&&data.preparedBatch?'1':'0';
  panel.dataset.cardNeedsImages=matching&&count<data.count?'1':'0';
  panel.dataset.cardNeedsRecovery=page.__MUMEI_CARD_SAFETY__?.networkHold?.()||panel.querySelector('#mumei-note-source-status-v163')?.dataset.bad==='1'?'1':'0';
  const additions=panel.querySelector('[data-prepared-additions]');
  if(additions)additions.hidden=!!data?.preparedBatch||!matching||!(page.__MUMEI_PREPARED_BATCH__?.missingAdditions(data).length);
  const send=panel.querySelector('[data-g="send"]'),del=panel.querySelector('[data-g="delete"]'),img=panel.querySelector('[data-g="image"]');
  if(send)send.textContent=data?.preparedBatch?'追加＋カード続き':working?'送（続き）':'送';
  if(del)del.textContent=working?'削（一括）':'削';
  if(img)img.textContent=working?'不足画像のみ追加':'画';
 }catch(_){ /* Preserve the existing controls if metadata cannot be read. */ }
}
let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>120)clearInterval(timer)},300);
setInterval(()=>{const panel=document.getElementById(PANEL);if(panel)updateControls(panel)},1500);mount();
})();
