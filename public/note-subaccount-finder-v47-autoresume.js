(() => {
  'use strict';

  const K='note巡回BOOST_v4';
  const JOB='autoMagJobV46';
  const AUTO='autoMagAutoResumeV47';
  const STARTUP='startupFreshScanV47';
  const DAY_LIMIT=200;
  const CHECK_MS=30000;
  const RETRY_429_MS=15*60*1000;
  let me=null,checking=false,last429Attempt=0,startupRan=false;

  const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const ak=(id,n)=>`${K}:acct:${id}:${n}`;
  const al=(id,n,f)=>load(ak(id,n),f);
  const as=(id,n,v)=>save(ak(id,n),v);

  async function api(url){const r=await fetch(url,{credentials:'include',headers:{accept:'application/json'}});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.json()}
  async function who(){const j=await api('/api/v2/current_user'),d=j?.data??j??{},u=d.user||d,id=String(u.urlname||u.url_name||u.username||'');if(!id)throw new Error('noteログイン中アカウントを取得できません');return{id,name:String(u.nickname||u.name||id)}}

  function forceDayLimit(){const key=`${K}:settings`,s=load(key,{});if(Number(s.magDay)!==DAY_LIMIT){s.magDay=DAY_LIMIT;save(key,s)}}
  function enabled(id){const v=al(id,AUTO,null);return v==null?true:!!v}
  function setEnabled(id,v){as(id,AUTO,!!v)}
  function hist(id){const a=al(id,'mags',[]),c=Date.now()-48*3600e3;return Array.isArray(a)?a.filter(x=>x&&Number(x.t)>=c):[]}
  function usage(id,ms){const n=Date.now();return hist(id).filter(x=>n-Number(x.t||0)<ms).length}
  function remain(id,ms,limit){const a=hist(id).filter(x=>Date.now()-Number(x.t||0)<ms).sort((x,y)=>Number(x.t)-Number(y.t));return a.length<limit?0:Math.max(0,Number(a[0].t)+ms-Date.now())}
  function safe(id){const s=Object.assign({magHour:20,magDay:DAY_LIMIT},load(`${K}:settings`,{}));s.magDay=DAY_LIMIT;const h=usage(id,3600e3),d=usage(id,86400e3);if(h>=s.magHour)return{ok:false,wait:remain(id,3600e3,s.magHour),why:`60分 ${h}/${s.magHour}`};if(d>=DAY_LIMIT)return{ok:false,wait:remain(id,86400e3,DAY_LIMIT),why:`24時間 ${d}/${DAY_LIMIT}`};return{ok:true,wait:0,why:''}}
  const fmt=ms=>{const m=Math.max(0,Math.ceil((ms||0)/60000));return m<60?`${m}分`:`${Math.floor(m/60)}時間${m%60}分`};

  function autoEligible(j){const last=String(j?.last||'');if(!j||j.complete)return false;if(/手動で一時停止/.test(last))return false;return /安全値で自動停止/.test(last)||/note側応答 429/.test(last)}
  function status(msg,bad=false){const e=document.querySelector('#nb-v47-auto-status');if(e){e.textContent=msg;e.style.color=bad?'#9a1d1d':'#444'}}
  function render(){if(!me)return;const b=document.querySelector('#nb-v47-auto');if(b){const on=enabled(me.id);b.textContent=`🔁 自動再開 ${on?'ON':'OFF'}`;b.dataset.on=on?'1':'0';b.style.background=on?'#e9f8ee':'#f2f2f2';b.style.borderColor=on?'#83c797':'#ccc'}const s=load(`${K}:settings`,{}),m=document.querySelector('#nb-meters');if(m&&Number(s.magDay)===DAY_LIMIT)m.innerHTML=m.innerHTML.replace(/📚 ([0-9]+)\/[^h]+h・([0-9]+)\/[0-9]+日/,(_,h,d)=>`📚 ${h}/${s.magHour||20}h・${d}/${DAY_LIMIT}日`)}

  function installUI(){const body=document.querySelector('#nb-v46-body');if(!body||document.querySelector('#nb-v47-auto'))return false;const row=document.createElement('div');row.className='v46r';row.innerHTML='<button id="nb-v47-auto" style="flex:1;padding:7px 9px;border:1px solid #ccc;border-radius:8px;font-weight:900">🔁 自動再開 ON</button><span id="nb-v47-limit" style="align-self:center;font-size:11px;font-weight:800">📚 24h上限 200</span>';const st=document.createElement('div');st.id='nb-v47-auto-status';st.style.cssText='font-size:11px;line-height:1.4;padding:5px 7px;margin-top:4px;background:#f8f8f8;border-radius:7px;color:#444';st.textContent='安全値・429で停止した時だけ自動再開します。手動停止は再開しません。';body.append(row,st);row.querySelector('#nb-v47-auto').onclick=()=>{if(!me)return;setEnabled(me.id,!enabled(me.id));render();status(enabled(me.id)?'自動再開をONにしました':'自動再開をOFFにしました。途中進捗は保持します')};render();return true}

  function hasSavedSearch(id){const f=al(id,'form',{});const manual=String(f?.tags||'').trim();const selected=Array.isArray(f?.selectedTags)?f.selectedTags.filter(Boolean):[];return !!manual||selected.length>0}
  function runStartupFreshScan(){if(startupRan||!me||!hasSavedSearch(me.id))return;const btn=document.querySelector('#nb-run');if(!btn||btn.disabled)return;startupRan=true;as(me.id,STARTUP,{t:Date.now(),account:me.id});setTimeout(()=>{status('🆕 起動時の新着読み込みを開始');btn.click()},900)}

  async function tick(){if(checking)return;checking=true;try{forceDayLimit();me=await who();installUI();render();runStartupFreshScan();if(!enabled(me.id))return;const j=al(me.id,JOB,null);if(!autoEligible(j))return;const lim=safe(me.id);if(!lim.ok){status(`⏳ 自動再開待ち：${lim.why}｜約${fmt(lim.wait)}`);return}if(/note側応答 429/.test(String(j.last||''))&&Date.now()-last429Attempt<RETRY_429_MS)return;const live=await who();if(live.id!==me.id)return;const start=document.querySelector('#nb-v46-start');if(!start)return;last429Attempt=Date.now();status('▶ 制限解除を確認。途中位置から自動再開します');start.click()}catch(e){status(`自動確認：${e?.message||e}`,true)}finally{checking=false}}

  forceDayLimit();
  const wait=()=>{if(installUI()){who().then(a=>{me=a;render();runStartupFreshScan();tick()}).catch(()=>{});return}const mo=new MutationObserver(()=>{if(installUI()){mo.disconnect();who().then(a=>{me=a;render();runStartupFreshScan();tick()}).catch(()=>{})}});mo.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>mo.disconnect(),20000)};
  wait();
  setInterval(tick,CHECK_MS);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
  window.addEventListener('focus',tick);
})();
