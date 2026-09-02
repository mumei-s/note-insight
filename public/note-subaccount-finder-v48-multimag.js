(() => {
  'use strict';

  const K='note巡回BOOST_v4';
  const JOB='autoMagJobV46';
  const LAST_ONE='autoMagLastMagV46';
  const LAST_MULTI='autoMagLastMagsV48';
  const VER='4.8.0';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const ak=(id,n)=>`${K}:acct:${id}:${n}`;
  const al=(id,n,f)=>load(ak(id,n),f);
  const as=(id,n,v)=>save(ak(id,n),v);
  const settings=()=>Object.assign({magHour:20,magDay:200},load(`${K}:settings`,{}),{magDay:200});

  let me=null;
  let mags=[];
  let busy=false;
  let stop=false;
  let detailCache=new Map();

  async function api(url,init={}){
    const headers=Object.assign({accept:'application/json'},init.headers||{});
    const r=await fetch(url,Object.assign({credentials:'include'},init,{headers}));
    const text=await r.text();
    let json={}; try{json=text?JSON.parse(text):{}}catch{}
    if(!r.ok){const e=new Error(`${r.status} ${r.statusText}`);e.status=r.status;e.body=text.slice(0,500);throw e}
    return json;
  }

  async function who(){
    const j=await api('/api/v2/current_user');
    const d=j?.data??j??{},u=d.user||d;
    const id=String(u.urlname||u.url_name||u.username||'');
    if(!id)throw new Error('noteログイン中アカウントを取得できません');
    return {id,name:String(u.nickname||u.name||id)};
  }

  function hist(id,name='mags'){
    const a=al(id,name,[]),cut=Date.now()-48*3600e3;
    return Array.isArray(a)?a.filter(x=>x&&Number(x.t)>=cut):[];
  }
  function usage(id,ms){const now=Date.now();return hist(id).filter(x=>now-Number(x.t||0)<ms).length}
  function remaining(id,ms,limit){const a=hist(id).filter(x=>Date.now()-Number(x.t||0)<ms).sort((x,y)=>Number(x.t)-Number(y.t));return a.length<limit?0:Math.max(0,Number(a[0].t)+ms-Date.now())}
  function safe(id){
    const s=settings(),h=usage(id,3600e3),d=usage(id,86400e3);
    if(h>=s.magHour)return{ok:false,why:`60分安全値 ${h}/${s.magHour}`,wait:remaining(id,3600e3,s.magHour)};
    if(d>=200)return{ok:false,why:`24時間安全値 ${d}/200`,wait:remaining(id,86400e3,200)};
    return{ok:true};
  }
  const fmt=ms=>{const m=Math.max(0,Math.ceil((ms||0)/60000));return m<60?`${m}分`:`${Math.floor(m/60)}時間${m%60}分`};

  function queue(id){
    const s=al(id,'session',null),q=Array.isArray(s?.queue)?s.queue:[];
    return q.map(x=>({key:String(x?.key||''),id:x?.id??null,urlname:String(x?.urlname||''),name:String(x?.name||x?.urlname||''),title:String(x?.title||x?.key||'')})).filter(x=>x.key&&x.urlname);
  }

  function getJob(){return me?al(me.id,JOB,null):null}
  function putJob(j){if(me)as(me.id,JOB,j)}

  function migrateJob(j){
    if(!j||j.complete)return j;
    if(Array.isArray(j.targets)&&j.targets.length){
      j.itemIndex=Number.isFinite(Number(j.itemIndex))?Number(j.itemIndex):Number(j.index)||0;
      j.targetIndex=Number.isFinite(Number(j.targetIndex))?Number(j.targetIndex):0;
      j.index=j.itemIndex;
      return j;
    }
    if(j.magKey){
      j.version=VER;
      j.targets=[{key:String(j.magKey),name:String(j.magName||j.magKey),price:Number(j.magPrice)||0}];
      j.itemIndex=Number(j.index)||0;
      j.targetIndex=0;
      j.index=j.itemIndex;
      j.last=`旧1マガジン進捗をそのまま継続：${j.last||'再開待ち'}`;
      putJob(j);
    }
    return j;
  }

  function status(msg,bad=false){
    const e=document.querySelector('#nb-v46-status');
    if(e){e.textContent=msg;e.style.background=bad?'#fff0f0':'#f4f6ff';e.style.color=bad?'#981b1b':'#222'}
  }

  function record(id,item,target){
    const t=Date.now();
    const mh=hist(id);mh.push({t,key:item.key,mag:target.key,urlname:item.urlname,source:'batch-v48'});as(id,'mags',mh.slice(-800));
    const ah=hist(id,'actions');ah.push({t,type:'mag',key:item.key,mag:target.key,urlname:item.urlname,source:'batch-v48'});as(id,'actions',ah.slice(-800));
  }

  function meter(){
    if(!me)return;
    const e=document.querySelector('#nb-meters');if(!e)return;
    const s=settings(),now=Date.now(),likes=al(me.id,'likes',[]);
    const lh=Array.isArray(likes)?likes.filter(x=>now-Number(x?.t||0)<3600e3).length:0;
    const ld=Array.isArray(likes)?likes.filter(x=>now-Number(x?.t||0)<86400e3).length:0;
    e.innerHTML=`<b>@${esc(me.id)}</b>　❤️ ${lh}/${s.likeHour||18}h・${ld}/${s.likeDay||80}日　📚 ${usage(me.id,3600e3)}/${s.magHour}h・${usage(me.id,86400e3)}/200日`;
  }

  function renderProgress(){
    if(!me)return;
    let j=migrateJob(getJob());
    const e=document.querySelector('#nb-v46-progress'),b=document.querySelector('#nb-v46-start');
    if(!e)return;
    if(!j){
      const q=queue(me.id);
      e.innerHTML=`現在の検索結果 <b>${q.length}件</b>｜複数マガジンを選択できます`;
      if(b)b.textContent='▶ 今の検索結果を追加';
      renderTargets();
      return;
    }
    const total=j.items?.length||0;
    const names=(j.targets||[]).map(x=>x.name||x.key).join(' / ');
    const state=j.complete?'✅ 完了':busy?'▶ 実行中':'⏸ 停止中';
    const ii=Math.min(Number(j.itemIndex)||0,total);
    const ti=Math.min((Number(j.targetIndex)||0)+1,Math.max(1,j.targets?.length||1));
    e.innerHTML=`<b>${state}</b>｜${esc(names)}<br>記事 ${ii}/${total}｜マガジン ${ti}/${j.targets?.length||1}｜追加 ${j.added||0}｜スキップ ${j.skipped||0}｜失敗 ${j.failed||0}${j.last?`<br><small>${esc(j.last)}</small>`:''}`;
    if(b)b.textContent=j.complete?'▶ 今の検索結果で新しく開始':busy?'⏸ 一時停止':'▶ 続きから再開';
    renderTargets();
  }

  function normalizeMagList(j){
    const a=j?.data?.magazines||j?.magazines||[];
    return (Array.isArray(a)?a:[]).map(m=>({key:String(m?.key||''),name:String(m?.name||''),price:Number(m?.price)||0,noteCount:Number(m?.note_count??m?.noteCount)||0})).filter(x=>x.key);
  }

  function domMagFallback(){
    const sel=document.querySelector('#nb-mag');
    if(!sel)return[];
    return [...sel.options].filter(o=>o.value).map(o=>({
      key:String(o.value),
      name:String(o.textContent||o.value).replace(/^[📚💴]\s*/,'').replace(/\s*\(\d+\)\s*$/,''),
      price:String(o.textContent||'').includes('💴')?1:0,
      noteCount:Number((String(o.textContent||'').match(/\((\d+)\)\s*$/)||[])[1])||0
    }));
  }

  async function loadMags(force=false){
    if(!me)me=await who();
    if(mags.length&&!force)return mags;
    const fallback=domMagFallback();
    try{
      const j=await api('/api/v1/my/magazines?includes_editable=true');
      mags=normalizeMagList(j);
      if(!mags.length&&fallback.length)mags=fallback;
      status(`📚 保有マガジン ${mags.length}件を読込。複数選択できます。`);
    }catch(e){
      if(fallback.length){mags=fallback;status(`📚 一覧APIは${e.status||'エラー'}。画面上の保有マガジン ${mags.length}件を使います。`)}
      else{mags=[];status(`マガジン一覧の取得失敗：${e.message||e}`,true)}
    }
    renderTargets();
    return mags;
  }

  function selectedKeys(){return [...document.querySelectorAll('.nb-v48-magcheck:checked')].map(x=>x.value)}
  function saveSelected(){if(me)as(me.id,LAST_MULTI,selectedKeys())}

  function renderTargets(){
    const box=document.querySelector('#nb-v48-targets');if(!box||!me)return;
    const j=migrateJob(getJob());
    const active=!!(j&&!j.complete);
    const filter=String(document.querySelector('#nb-v46-filter')?.value||'').toLowerCase();
    const oldOne=al(me.id,LAST_ONE,'');
    let saved=al(me.id,LAST_MULTI,null);
    if(!Array.isArray(saved))saved=oldOne?[oldOne]:[];
    const fixed=new Set(active?(j.targets||[]).map(x=>x.key):saved);
    const source=active?(j.targets||[]):mags;
    const list=source.filter(m=>!filter||String(m.name||'').toLowerCase().includes(filter));
    if(!list.length){box.innerHTML=`<div class="nb-v48-empty">${active?'現在の途中ジョブの追加先を保持中':'マガジンを読込してください'}</div>`;return}
    box.innerHTML=list.map(m=>`<label class="nb-v48-item"><input class="nb-v48-magcheck" type="checkbox" value="${esc(m.key)}" ${fixed.has(m.key)?'checked':''} ${active?'disabled':''}><span><b>${m.price>0?'💴':'📚'} ${esc(m.name||m.key)}</b><small>${m.noteCount?`${m.noteCount}記事`:' '}</small></span></label>`).join('');
    for(const x of box.querySelectorAll('.nb-v48-magcheck'))x.addEventListener('change',saveSelected);
  }

  async function noteDetail(item){
    if(detailCache.has(item.key))return detailCache.get(item.key);
    try{
      const j=await api(`/api/v3/notes/${encodeURIComponent(item.key)}`);
      const d=j?.data??j??{},n=d.note||d;
      const out={ok:true,id:item.id??n.id??n.note_id??n.noteId??null,belongs:Array.isArray(d.belonging_magazine_keys||n.belonging_magazine_keys||j?.belonging_magazine_keys)?(d.belonging_magazine_keys||n.belonging_magazine_keys||j?.belonging_magazine_keys):[]};
      detailCache.set(item.key,out);return out;
    }catch(e){
      if([403,404].includes(e.status)){const out={ok:false,skip:true,reason:`記事を取得できないためスキップ (${e.status})`};detailCache.set(item.key,out);return out}
      throw e;
    }
  }

  async function addPair(item,target){
    const d=await noteDetail(item);
    if(!d.ok&&d.skip)return['item-skip',`${d.reason}：${item.title}`];
    if(d.belongs.includes(target.key))return['skip',`追加済み：${item.title} → ${target.name}`];
    if(target.price>0&&item.urlname!==me.id)return['skip',`有料マガジンのため他人記事を除外：${item.title} → ${target.name}`];
    if(!d.id)return['fail',`記事ID取得失敗：${item.title}`];
    try{
      await api(`/api/v1/our/magazines/${encodeURIComponent(target.key)}/notes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:JSON.stringify({note_id:d.id,note_key:item.key})});
      record(me.id,item,target);
      d.belongs.push(target.key);
      return['add',`追加：${item.title} → ${target.name}`];
    }catch(e){
      const body=String(e.body||'');
      if(body.includes('already')){d.belongs.push(target.key);return['skip',`追加済み：${item.title} → ${target.name}`]}
      if(e.status===403)return['fail',`権限403のためこの組み合わせだけスキップ：${item.title} → ${target.name}`];
      throw e;
    }
  }

  function advance(j,kind){
    if(kind==='item-skip'){
      j.skipped=(j.skipped||0)+Math.max(1,(j.targets?.length||1)-(j.targetIndex||0));
      j.itemIndex=(j.itemIndex||0)+1;j.targetIndex=0;j.index=j.itemIndex;return;
    }
    if(kind==='add')j.added=(j.added||0)+1;
    else if(kind==='skip')j.skipped=(j.skipped||0)+1;
    else j.failed=(j.failed||0)+1;
    j.targetIndex=(j.targetIndex||0)+1;
    if(j.targetIndex>=(j.targets?.length||1)){j.itemIndex=(j.itemIndex||0)+1;j.targetIndex=0;j.index=j.itemIndex}
  }

  async function run(){
    if(busy){stop=true;status('⏸ 現在の1件が終わったら停止します');return}
    try{
      me=await who();
      let j=migrateJob(getJob());
      if(!(j&&!j.complete&&j.account===me.id)){
        await loadMags();
        const keys=selectedKeys();
        const targets=mags.filter(x=>keys.includes(x.key));
        const q=queue(me.id);
        if(!targets.length)return status('追加先マガジンを1つ以上チェックしてください',true);
        if(!q.length)return status('先に巡回検索を実行してください。現在の検索結果は0件です',true);
        if(!confirm(`現在の検索結果 ${q.length}件を、選択した${targets.length}個のマガジンへ順番に追加します。\n既追加はスキップ、24時間上限200件で自動停止します。開始しますか？`))return;
        as(me.id,LAST_MULTI,targets.map(x=>x.key));
        j={version:VER,account:me.id,targets:targets.map(x=>({key:x.key,name:x.name,price:x.price,noteCount:x.noteCount})),items:q,itemIndex:0,targetIndex:0,index:0,added:0,skipped:0,failed:0,complete:false,last:'開始',updatedAt:Date.now()};
        putJob(j);
      }

      busy=true;stop=false;detailCache=new Map();renderProgress();
      while((j.itemIndex||0)<(j.items?.length||0)){
        if(stop){j.last='手動で一時停止';putJob(j);break}
        const lim=safe(me.id);
        if(!lim.ok){j.last=`安全値で自動停止：${lim.why}｜再開目安 ${fmt(lim.wait)}`;putJob(j);status(`⛔ ${j.last}`,true);break}
        const live=await who();
        if(live.id!==me.id){j.last=`アカウントが @${me.id} → @${live.id} に変わったため停止`;putJob(j);status(`⛔ ${j.last}`,true);break}

        const item=j.items[j.itemIndex],target=j.targets[j.targetIndex||0];
        if(!item||!target){j.failed=(j.failed||0)+1;j.itemIndex=(j.itemIndex||0)+1;j.targetIndex=0;j.index=j.itemIndex;putJob(j);continue}
        status(`📦 記事 ${j.itemIndex+1}/${j.items.length}｜${item.title} → ${target.name}`);
        try{
          const [kind,msg]=await addPair(item,target);
          advance(j,kind);j.last=msg;
        }catch(e){
          if(e.status===401){j.last=`認証401で停止：${item.title}`;putJob(j);status(`⛔ ${j.last}`,true);break}
          if(e.status===429){j.last=`note側応答 429 で安全停止：${item.title} → ${target.name}`;putJob(j);status(`⛔ ${j.last}`,true);break}
          if(e.status===403){advance(j,'fail');j.last=`403をこの組み合わせだけスキップ：${item.title} → ${target.name}`}
          else{advance(j,'fail');j.last=`失敗して次へ：${item.title} → ${target.name} (${e.message||e})`}
        }
        j.updatedAt=Date.now();putJob(j);renderProgress();meter();await sleep(1200);
      }

      if((j.itemIndex||0)>=(j.items?.length||0)){
        j.complete=true;j.index=j.items.length;j.last=`完了：追加 ${j.added||0} / スキップ ${j.skipped||0} / 失敗 ${j.failed||0}`;putJob(j);status(`✅ ${j.last}`);
      }
    }catch(e){status(`エラー：${e.message||e}`,true)}
    finally{busy=false;stop=false;renderProgress();meter()}
  }

  function reset(){
    if(!me)return;if(busy)return status('実行中は先に一時停止してください',true);
    const j=getJob();if(!j)return status('保存中の一括追加はありません');
    if(!confirm('進捗だけをリセットします。既に追加した記事はマガジンから削除しません。よろしいですか？'))return;
    localStorage.removeItem(ak(me.id,JOB));detailCache.clear();status('進捗をリセットしました');renderProgress();
  }

  function install(){
    const body=document.querySelector('#nb-v46-body');
    if(!body||document.querySelector('#nb-v48-targets'))return false;
    const oldSel=document.querySelector('#nb-v46-mag');if(oldSel)oldSel.style.display='none';
    const selectRow=oldSel?.closest('.v46r');
    const box=document.createElement('div');box.id='nb-v48-targets';box.innerHTML='<div class="nb-v48-empty">マガジン読込中…</div>';
    if(selectRow)selectRow.insertAdjacentElement('afterend',box);else body.prepend(box);

    const style=document.createElement('style');
    style.textContent=`#nb-v48-targets{max-height:190px;overflow:auto;border:1px solid #d9ddea;border-radius:9px;padding:5px;margin:5px 0;background:#fff}.nb-v48-item{display:flex;gap:7px;align-items:center;padding:7px 5px;border-bottom:1px solid #eee}.nb-v48-item:last-child{border-bottom:0}.nb-v48-item input{width:20px;height:20px;flex:0 0 20px}.nb-v48-item span{display:flex;flex:1;min-width:0;justify-content:space-between;gap:8px}.nb-v48-item b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nb-v48-item small{font-size:10px;color:#777;white-space:nowrap}.nb-v48-empty{padding:9px;font-size:11px;color:#666;text-align:center}`;
    document.documentElement.appendChild(style);

    const filter=document.querySelector('#nb-v46-filter');
    if(filter){filter.placeholder='マガジン名で絞り込み（複数選択）';filter.addEventListener('input',renderTargets)}

    const oldStart=document.querySelector('#nb-v46-start');
    if(oldStart){const n=oldStart.cloneNode(true);oldStart.replaceWith(n);n.id='nb-v46-start';n.onclick=run}
    const oldReset=document.querySelector('#nb-v46-reset');
    if(oldReset){const n=oldReset.cloneNode(true);oldReset.replaceWith(n);n.id='nb-v46-reset';n.onclick=reset}
    const oldRefresh=document.querySelector('#nb-v46-refresh');
    if(oldRefresh){const n=oldRefresh.cloneNode(true);oldRefresh.replaceWith(n);n.id='nb-v46-refresh';n.onclick=()=>{mags=[];loadMags(true)}}

    who().then(async a=>{me=a;const j=migrateJob(getJob());if(j&&!j.complete){mags=(j.targets||[]).map(x=>({...x}));status('🔄 現在の途中進捗をそのまま引き継ぎました。403記事は個別スキップして継続します。');renderTargets()}else await loadMags();renderProgress();meter()}).catch(e=>status(`ログイン確認失敗：${e.message||e}`,true));
    return true;
  }

  const wait=()=>{
    if(install())return;
    const mo=new MutationObserver(()=>{if(install())mo.disconnect()});
    mo.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>mo.disconnect(),20000);
  };
  wait();
})();
