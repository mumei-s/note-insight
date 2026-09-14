(() => {
'use strict';
const K='note巡回BOOST_v4';
const JOB='autoMagJobV46';
const OLD_AUTO='autoMagAutoResumeV47';
const AUTO='autoMagAutoResumeV51';
const LIMIT_KEY=`${K}:limitV51`;
const VER='5.1.0';
const DEFAULT_LIMIT=200;
let me=null,busy=false,starting=false,stop=false,resumeTimer=0;
const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(k))??fb}catch{return fb}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const ak=(id,n)=>`${K}:acct:${id}:${n}`;
const al=(id,n,fb)=>load(ak(id,n),fb);
const as=(id,n,v)=>save(ak(id,n),v);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const limit=()=>Math.max(1,Math.min(5000,Number(load(LIMIT_KEY,DEFAULT_LIMIT))||DEFAULT_LIMIT));
const setLimit=v=>save(LIMIT_KEY,Math.max(1,Math.min(5000,Number(v)||DEFAULT_LIMIT)));
function hist(id,name='mags'){
  const cut=Date.now()-48*3600e3,a=al(id,name,[]);
  return Array.isArray(a)?a.filter(x=>x&&Number(x.t)>=cut):[];
}
function usage(id){const now=Date.now();return hist(id).filter(x=>now-Number(x.t||0)<86400e3).length;}
function remain(id){const a=hist(id).filter(x=>Date.now()-Number(x.t||0)<86400e3).sort((x,y)=>Number(x.t)-Number(y.t));return a.length<limit()?0:Math.max(0,Number(a[0].t)+86400e3-Date.now());}
function fmt(ms){const m=Math.ceil(Math.max(0,ms)/60000);return m<60?`${m}分`:`${Math.floor(m/60)}時間${m%60}分`;}
function autoEnabled(id){const v=al(id,AUTO,null);return v==null?true:!!v;}
function setAuto(id,v){as(id,AUTO,!!v);}
function disableOldAuto(id){if(id)as(id,OLD_AUTO,false);}
function status(msg,bad=false){
  const e=document.querySelector('#nb-v51-status')||document.querySelector('#nb-v50-status')||document.querySelector('#nb-v46-status');
  if(!e)return;
  e.textContent=msg;e.dataset.bad=bad?'1':'0';
  e.style.background=bad?'#3a0b0b':'#071c2c';e.style.color=bad?'#ffd7d7':'#fff';
}
async function api(url,init={}){
  const headers=Object.assign({accept:'application/json'},init.headers||{});
  const r=await fetch(url,Object.assign({credentials:'include'},init,{headers}));
  const text=await r.text();let json={};try{json=text?JSON.parse(text):{}}catch{}
  if(!r.ok){const e=new Error(`${r.status} ${r.statusText}`);e.status=r.status;e.body=text.slice(0,500);const ra=r.headers?.get?.('retry-after');e.retryAfter=ra?(/^\d+$/.test(ra)?Number(ra)*1000:Math.max(0,Date.parse(ra)-Date.now())):0;throw e;}
  return json;
}
async function who(){
  const j=await api('/api/v2/current_user'),d=j?.data??j??{},u=d.user||d,id=String(u.urlname||u.url_name||u.username||'');
  if(!id)throw new Error('noteログイン中アカウントを取得できません');
  return{id,name:String(u.nickname||u.name||id)};
}
function queue(id){
  const s=al(id,'session',null),q=Array.isArray(s?.queue)?s.queue:[];
  return q.map(x=>({key:String(x?.key||''),id:x?.id??null,urlname:String(x?.urlname||''),name:String(x?.name||x?.urlname||''),title:String(x?.title||x?.key||'')})).filter(x=>x.key&&x.urlname);
}
function selectedTargets(){
  return[...document.querySelectorAll('.nb-v48-magcheck:checked')].map(ch=>{
    const label=ch.closest('label'),text=String(label?.textContent||ch.value).trim();
    const name=text.replace(/^\s*[📚💴]\s*/,'').replace(/\s+\d+記事\s*$/,'').trim()||ch.value;
    return{key:String(ch.value),name,price:text.includes('💴')?1:0};
  });
}
function currentJob(id){return al(id,JOB,null);}
function putJob(id,j){as(id,JOB,j);}
function migrateJob(id,j){
  if(!j||j.complete)return j;
  if(Array.isArray(j.targets)&&j.targets.length){j.itemIndex=Number.isFinite(Number(j.itemIndex))?Number(j.itemIndex):Number(j.index)||0;j.targetIndex=Number.isFinite(Number(j.targetIndex))?Number(j.targetIndex):0;j.index=j.itemIndex;return j;}
  if(j.magKey){j.version=VER;j.targets=[{key:String(j.magKey),name:String(j.magName||j.magKey),price:Number(j.magPrice)||0}];j.itemIndex=Number(j.index)||0;j.targetIndex=0;j.index=j.itemIndex;putJob(id,j);}return j;
}
function record(id,item,target){
  const t=Date.now(),mh=hist(id);mh.push({t,key:item.key,mag:target.key,urlname:item.urlname,source:'batch-v51'});as(id,'mags',mh.slice(-1200));
  const ah=hist(id,'actions');ah.push({t,type:'mag',key:item.key,mag:target.key,urlname:item.urlname,source:'batch-v51'});as(id,'actions',ah.slice(-1200));
}
function meter(id){
  const used=usage(id),max=limit(),left=Math.max(0,max-used);
  const e=document.querySelector('#nb-v51-meter');if(e)e.innerHTML=`<span>📚 24h使用</span><b>${used}</b><span>/</span><b>${max}</b><span>残り</span><strong>${left}</strong>`;
  const old=document.querySelector('#nb-meters');if(old)old.innerHTML=`<b>@${id}</b>　📚 24h ${used}/${max}　残り ${left}`;
}
function render(id){
  const j=migrateJob(id,currentJob(id)),p=document.querySelector('#nb-v46-progress'),b=document.querySelector('#nb-v46-start');
  if(p){
    if(!j)p.innerHTML=`<b>検索結果 ${queue(id).length}件</b>｜追加先を選んで開始`;
    else{const total=j.items?.length||0,names=(j.targets||[]).map(x=>x.name||x.key).join(' / '),state=j.complete?'✅ 完了':busy?'▶ 実行中':'⏸ 待機';p.innerHTML=`<b>${state}</b>｜${names}<br><strong>${Math.min(Number(j.itemIndex)||0,total)}/${total}</strong>　追加 <b>${j.added||0}</b>　スキップ ${j.skipped||0}　失敗 ${j.failed||0}${j.last?`<br><small>${String(j.last)}</small>`:''}`;}
  }
  if(b)b.textContent=busy?'⏸ 一時停止':(j?.complete?'▶ 新しく開始':(j?'▶ 続きから再開':'▶ 今の検索結果を追加'));
  const a=document.querySelector('#nb-v51-auto');if(a){const on=autoEnabled(id);a.textContent=`🔁 自動再開 ${on?'ON':'OFF'}`;a.dataset.on=on?'1':'0';}
  meter(id);
}
async function noteDetail(item){
  try{const j=await api(`/api/v3/notes/${encodeURIComponent(item.key)}`),d=j?.data??j??{},n=d.note||d,belongs=d.belonging_magazine_keys||n.belonging_magazine_keys||j?.belonging_magazine_keys||[];return{id:item.id??n.id??n.note_id??n.noteId??null,belongs:Array.isArray(belongs)?belongs:[]};}
  catch(e){if(e.status===404)return{skip:true,reason:'記事404'};throw e;}
}
async function addPair(id,item,target,detail){
  if(detail.belongs.includes(target.key))return['skip',`追加済み：${item.title} → ${target.name}`];
  if(target.price>0&&item.urlname!==id)return['skip',`有料マガジンのため他人記事を除外：${item.title} → ${target.name}`];
  if(!detail.id)return['fail',`記事ID取得失敗：${item.title}`];
  try{
    await api(`/api/v1/our/magazines/${encodeURIComponent(target.key)}/notes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:JSON.stringify({note_id:detail.id,note_key:item.key})});
    record(id,item,target);detail.belongs.push(target.key);return['add',`追加：${item.title} → ${target.name}`];
  }catch(e){if(String(e.body||'').includes('already')){detail.belongs.push(target.key);return['skip',`追加済み：${item.title} → ${target.name}`];}throw e;}
}
function advance(j,kind){
  if(kind==='item-skip'){j.skipped=(j.skipped||0)+Math.max(1,(j.targets?.length||1)-(j.targetIndex||0));j.itemIndex=(j.itemIndex||0)+1;j.targetIndex=0;j.index=j.itemIndex;return;}
  if(kind==='add')j.added=(j.added||0)+1;else if(kind==='skip')j.skipped=(j.skipped||0)+1;else j.failed=(j.failed||0)+1;
  j.targetIndex=(j.targetIndex||0)+1;if(j.targetIndex>=(j.targets?.length||1)){j.itemIndex=(j.itemIndex||0)+1;j.targetIndex=0;j.index=j.itemIndex;}
}
function scheduleResume(id,ms){if(resumeTimer)clearTimeout(resumeTimer);if(!autoEnabled(id)||ms<=0)return;resumeTimer=setTimeout(()=>{resumeTimer=0;autoResume('制限解除');},Math.min(ms+1000,2147480000));}
async function run({automatic=false}={}){
  if(busy||starting){if(busy&&!automatic){stop=true;status('⏸ 今の1件が終わったら停止');}return;}
  starting=true;
  try{
    me=await who();disableOldAuto(me.id);save(`${K}:lastActiveAccount`,me.id);const id=me.id;
    let j=migrateJob(id,currentJob(id));
    if(!(j&&!j.complete&&j.account===id)){
      if(automatic)return;
      const targets=selectedTargets(),items=queue(id);if(!targets.length){status('追加先マガジンを1つ以上チェックしてください',true);return;}if(!items.length){status('検索結果が0件です。先に巡回検索してください',true);return;}
      if(!confirm(`検索結果 ${items.length}件 × 選択${targets.length}誌を追加します。\n制御は24時間上限 ${limit()}件のみです。開始しますか？`))return;
      j={version:VER,account:id,targets,items,itemIndex:0,targetIndex:0,index:0,added:0,skipped:0,failed:0,complete:false,last:'開始',updatedAt:Date.now()};putJob(id,j);
    }
    busy=true;starting=false;stop=false;render(id);let cachedKey='',detail=null;
    while((j.itemIndex||0)<(j.items?.length||0)){
      if(stop){j.last='手動で一時停止';putJob(id,j);break;}
      const used=usage(id),max=limit();if(used>=max){const wait=remain(id);j.last=`24時間上限 ${used}/${max} で停止`;putJob(id,j);status(`⏳ ${j.last}｜約${fmt(wait)}後に再開`);scheduleResume(id,wait);break;}
      const item=j.items[j.itemIndex],target=j.targets[j.targetIndex||0];if(!item||!target){j.failed=(j.failed||0)+1;j.itemIndex=(j.itemIndex||0)+1;j.targetIndex=0;j.index=j.itemIndex;putJob(id,j);continue;}
      status(`📦 ${j.itemIndex+1}/${j.items.length}｜${item.title} → ${target.name}`);
      try{
        if(cachedKey!==item.key){detail=await noteDetail(item);cachedKey=item.key;}
        if(detail?.skip){j.last=`${detail.reason}：${item.title}`;advance(j,'item-skip');cachedKey='';detail=null;}
        else{const[kind,msg]=await addPair(id,item,target,detail);j.last=msg;advance(j,kind);if((j.targetIndex||0)===0){cachedKey='';detail=null;}}
        j.updatedAt=Date.now();putJob(id,j);render(id);
      }catch(e){
        if(e.status===429){const wait=Math.max(60000,Number(e.retryAfter)||15*60*1000);j.last=`note側429。${fmt(wait)}後に再開`;putJob(id,j);status(`⏳ ${j.last}`,true);scheduleResume(id,wait);break;}
        if(e.status===403){j.last='note側403で停止。上限とは別のため自動連打しません';putJob(id,j);status(`🛑 ${j.last}`,true);break;}
        if(e.status===401){j.last='401認証エラーで停止';putJob(id,j);status(`🛑 ${j.last}`,true);break;}
        j.failed=(j.failed||0)+1;j.last=`失敗して次へ：${e.message||e}`;advance(j,'fail');putJob(id,j);
      }
      if(stop)break;
      await Promise.resolve();
    }
    if((j.itemIndex||0)>=(j.items?.length||0)){j.complete=true;j.last=`完了：追加 ${j.added||0} / スキップ ${j.skipped||0} / 失敗 ${j.failed||0}`;putJob(id,j);status(`✅ ${j.last}`);}
  }catch(e){status(`エラー：${e?.message||e}`,true);}finally{starting=false;busy=false;stop=false;if(me?.id)render(me.id);}
}
async function autoResume(source='起動'){
  if(document.hidden||busy)return;
  try{const id=load(`${K}:lastActiveAccount`,'');if(!id||!autoEnabled(id))return;disableOldAuto(id);const j=migrateJob(id,currentJob(id));if(!j||j.complete||j.account!==id)return;if(/手動で一時停止|401|403/.test(String(j.last||'')))return;if(usage(id)>=limit()){scheduleResume(id,remain(id));return;}status(`▶ ${source}：途中から自動再開`);await run({automatic:true});}catch{}
}
function installStyle(){if(document.querySelector('#nb-v51-style'))return;const s=document.createElement('style');s.id='nb-v51-style';s.textContent=`
#note巡回boost-v4,#nb-v46{color:#fff!important}
#nb-v46{background:#090d12!important;border:2px solid #37a8ff!important;border-radius:14px!important;padding:9px!important;box-shadow:0 8px 24px rgba(0,0,0,.45)!important}
#nb-v46-toggle{background:#071c2c!important;color:#fff!important;font-size:15px!important;font-weight:1000!important;line-height:1.3!important;padding:12px!important;border:1px solid #37a8ff!important}
#nb-v46-body{color:#fff!important;font-size:13px!important;font-weight:800!important}
#nb-v46-body button{font-size:13px!important;font-weight:1000!important;min-height:42px!important;border:1px solid #61788e!important;background:#17222e!important;color:#fff!important;text-shadow:0 1px 2px #000!important}
#nb-v46-start{background:#0878d1!important;border-color:#55bdff!important;font-size:15px!important}
#nb-v46-reset{background:#2b3038!important;color:#fff!important}
#nb-v46-body input,#nb-v46-body select{font-size:13px!important;font-weight:800!important;min-height:40px!important;background:#fff!important;color:#111!important;border:2px solid #a9c8df!important}
#nb-v48-targets{background:#111923!important;color:#fff!important;border:1px solid #334a60!important;border-radius:10px!important;padding:7px!important}
#nb-v48-targets label{color:#fff!important;font-size:13px!important;font-weight:850!important;line-height:1.45!important}
#nb-v46-progress,#nb-v46-status,#nb-v50-status,#nb-v51-status{font-size:13px!important;line-height:1.5!important;font-weight:800!important;padding:9px!important;color:#fff!important;background:#101923!important;border:1px solid #2d4b65!important}
#nb-v46-progress b,#nb-v46-progress strong{color:#72d2ff!important;font-size:15px!important}
#nb-v51-control{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:8px 0;padding:9px;background:#05080c;border:1px solid #37a8ff;border-radius:11px}
#nb-v51-meter{grid-column:1/-1;display:flex;align-items:baseline;justify-content:center;gap:7px;padding:8px;background:#071c2c;border-radius:9px;color:#fff;font-size:13px;font-weight:900}
#nb-v51-meter b{font-size:20px;color:#72d2ff}#nb-v51-meter strong{font-size:22px;color:#7dffae}
#nb-v51-limitwrap{display:flex;align-items:center;gap:6px;background:#151d26;padding:6px 8px;border-radius:8px;color:#fff;font-size:12px;font-weight:900}
#nb-v51-limit{width:74px!important;min-height:34px!important;padding:3px 6px!important}
#nb-v51-auto[data-on="1"]{background:#09663b!important;border-color:#52f7a1!important}
#nb-v51-status{grid-column:1/-1;margin:0!important}
#nb-meters{font-size:13px!important;font-weight:900!important;color:#fff!important;background:#0d1822!important;padding:7px!important;border-radius:8px!important}
`;document.documentElement.appendChild(s);}
function installUI(){
  const body=document.querySelector('#nb-v46-body'),start=document.querySelector('#nb-v46-start');if(!body||!start||!document.querySelector('#nb-v48-targets'))return false;
  installStyle();
  const last=load(`${K}:lastActiveAccount`,'');if(last)disableOldAuto(last);
  start.onclick=e=>{e?.preventDefault?.();run({automatic:false});};
  document.querySelector('#nb-v50-safe')?.remove();document.querySelector('#nb-v50-status')?.remove();
  if(!document.querySelector('#nb-v51-control')){
    const box=document.createElement('div');box.id='nb-v51-control';box.innerHTML=`<div id="nb-v51-meter">読込中…</div><label id="nb-v51-limitwrap">24h上限 <input id="nb-v51-limit" type="number" min="1" max="5000" step="1" value="${limit()}"></label><button id="nb-v51-auto" type="button">🔁 自動再開 ON</button><div id="nb-v51-status">制限は24時間上限だけ。時間ごとの件数制限・固定待機はありません。</div>`;
    start.closest('.v46r')?.insertAdjacentElement('beforebegin',box);
    box.querySelector('#nb-v51-limit').onchange=e=>{setLimit(e.target.value);e.target.value=String(limit());if(me?.id)render(me.id);status(`上限を ${limit()}件 に変更`);};
    box.querySelector('#nb-v51-auto').onclick=()=>{const id=me?.id||load(`${K}:lastActiveAccount`,'');if(!id)return;setAuto(id,!autoEnabled(id));render(id);status(autoEnabled(id)?'🔁 自動再開ON':'⏸ 自動再開OFF。進捗は保持');if(autoEnabled(id))autoResume('ON切替');};
  }
  who().then(a=>{me=a;const old=al(a.id,OLD_AUTO,null);if(al(a.id,AUTO,null)==null&&old!=null)setAuto(a.id,!!old);disableOldAuto(a.id);save(`${K}:lastActiveAccount`,a.id);render(a.id);}).catch(e=>status(`ログイン確認失敗：${e?.message||e}`,true));
  return true;
}
const boot=()=>{if(installUI()){setTimeout(()=>autoResume('起動'),900);return;}const mo=new MutationObserver(()=>{if(installUI()){mo.disconnect();setTimeout(()=>autoResume('起動'),900);}});mo.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>mo.disconnect(),20000);};
boot();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>autoResume('タブ復帰'),500);});
window.addEventListener('focus',()=>setTimeout(()=>autoResume('画面復帰'),500));
})();