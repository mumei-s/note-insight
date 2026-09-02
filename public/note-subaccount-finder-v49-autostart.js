(() => {
  'use strict';

  const K='note巡回BOOST_v4';
  const JOB='autoMagJobV46';
  const AUTO='autoMagAutoResumeV47';
  const DAY_LIMIT=200;
  const CHECK_MS=10000;
  let checking=false;
  let lastStart=0;

  const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
  const ak=(id,n)=>`${K}:acct:${id}:${n}`;
  const al=(id,n,f)=>load(ak(id,n),f);

  async function who(){
    const r=await fetch('/api/v2/current_user',{credentials:'include',headers:{accept:'application/json'}});
    if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);
    const j=await r.json(),d=j?.data??j??{},u=d.user||d;
    const id=String(u.urlname||u.url_name||u.username||'');
    if(!id)throw new Error('noteログイン中アカウントを取得できません');
    return{id};
  }

  function enabled(id){
    const v=al(id,AUTO,null);
    return v==null?true:!!v;
  }

  function hist(id){
    const a=al(id,'mags',[]),cut=Date.now()-48*3600e3;
    return Array.isArray(a)?a.filter(x=>x&&Number(x.t)>=cut):[];
  }

  function usage(id,ms){
    const now=Date.now();
    return hist(id).filter(x=>now-Number(x.t||0)<ms).length;
  }

  function safe(id){
    const s=Object.assign({magHour:20,magDay:DAY_LIMIT},load(`${K}:settings`,{}),{magDay:DAY_LIMIT});
    return usage(id,3600e3)<Number(s.magHour||20)&&usage(id,86400e3)<DAY_LIMIT;
  }

  function status(msg){
    const e=document.querySelector('#nb-v47-auto-status')||document.querySelector('#nb-v46-status');
    if(e)e.textContent=msg;
  }

  function shouldStart(j,id){
    if(!j||j.complete||j.account!==id)return false;
    const last=String(j.last||'');
    if(/手動で一時停止/.test(last))return false;
    if(/アカウントが .* に変わったため停止/.test(last))return false;
    if(/401|認証/.test(last))return false;
    return true;
  }

  async function tick(){
    if(checking||document.hidden)return;
    checking=true;
    try{
      const me=await who();
      if(!enabled(me.id))return;
      const j=al(me.id,JOB,null);
      if(!shouldStart(j,me.id))return;
      if(!safe(me.id))return;

      const btn=document.querySelector('#nb-v46-start');
      if(!btn||btn.disabled)return;
      const text=String(btn.textContent||'');
      if(/一時停止|実行中/.test(text))return;
      if(Date.now()-lastStart<5000)return;

      lastStart=Date.now();
      status('▶ 未完了ジョブを自動で続きから再開します');
      btn.click();
    }catch{}
    finally{checking=false;}
  }

  const kick=()=>setTimeout(tick,1200);
  kick();
  setInterval(tick,CHECK_MS);
  window.addEventListener('focus',kick);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)kick()});
})();
