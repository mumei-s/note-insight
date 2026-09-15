(() => {
'use strict';
if (window.__NOTE_BOOST_V533_PATCH__) return;
window.__NOTE_BOOST_V533_PATCH__ = true;

const K='note巡回BOOST_v531';
const SHORT_CAP=18, SHORT_MS=60*60*1000, DAY_CAP=80, DAY_MS=24*60*60*1000;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const now=()=>Date.now();
const fmt=t=>t?new Date(t).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'—';
const loadRaw=(key,fb)=>{try{return JSON.parse(localStorage.getItem(key))??fb}catch{return fb}};
const saveRaw=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v))}catch{}};
const load=(k,fb)=>loadRaw(`${K}:${k}`,fb);
const save=(k,v)=>saveRaw(`${K}:${k}`,v);

function hist(kind){
  const a=load(`hist:${kind}`,[]),cut=now()-48*60*60*1000;
  return Array.isArray(a)?a.filter(x=>x&&Number(x.t)>=cut):[];
}
function within(kind,ms){return hist(kind).filter(x=>now()-Number(x.t)<ms)}
function release(kind,cap,ms){
  const a=within(kind,ms).sort((x,y)=>Number(x.t)-Number(y.t));
  return a.length<cap?0:Number(a[0].t)+ms;
}
function guardUntil(kind){
  const candidates=[
    release(kind,SHORT_CAP,SHORT_MS),
    release(kind,DAY_CAP,DAY_MS),
    Number(load(`guard533:${kind}`,{}).until||0),
    Number(load(`guard:${kind}`,{}).until||0)
  ].filter(x=>x>now());
  return candidates.length?Math.max(...candidates):0;
}
function stats(kind){
  return {short:within(kind,SHORT_MS).length,day:within(kind,DAY_MS).length,until:guardUntil(kind)};
}
function markGuard(kind,reason,until){
  save(`guard533:${kind}`,{until,reason});
  save(`guard:${kind}`,{until,strikes:[],reason});
}
function setConfig(){
  const c=Object.assign({},load('cfg',{}),{likeCap:DAY_CAP,magCap:DAY_CAP,batchCap:9999,batchCoolMin:60});
  save('cfg',c);
}
setConfig();

function retryResponse(until,reason){
  const sec=Math.max(60,Math.ceil((until-now())/1000));
  return new Response(JSON.stringify({error:'巡回BOOST limiter',reason}),{
    status:429,
    headers:{'content-type':'application/json','retry-after':String(sec)}
  });
}

const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const method=String(init?.method||input?.method||'GET').toUpperCase();
  let kind=null;
  if(method==='POST'&&/\/api\/v3\/notes\/[^/]+\/likes(?:\?|$)/.test(url))kind='likes';
  if(method==='POST'&&/\/api\/v1\/our\/magazines\/[^/]+\/notes(?:\?|$)/.test(url))kind='mags';

  if(kind){
    const s=stats(kind);
    if(s.until>now())return retryResponse(s.until,`${kind==='likes'?'スキ':'マガジン'}上限`);
    if(s.short>=SHORT_CAP){
      const until=release(kind,SHORT_CAP,SHORT_MS);
      markGuard(kind,`1時間上限 ${SHORT_CAP}`,until);
      return retryResponse(until,'1時間上限');
    }
    if(s.day>=DAY_CAP){
      const until=release(kind,DAY_CAP,DAY_MS);
      markGuard(kind,`24時間上限 ${DAY_CAP}`,until);
      return retryResponse(until,'24時間上限');
    }
  }

  const r=await nativeFetch(input,init);

  if(kind&&r.status===403){
    markGuard(kind,'403検出・60分保護',now()+SHORT_MS);
  }else if(kind&&r.status===429){
    const ra=r.headers.get('retry-after');
    let ms=SHORT_MS;
    if(ra){
      if(/^\d+$/.test(ra))ms=Math.max(ms,Number(ra)*1000);
      else{const t=Date.parse(ra);if(Number.isFinite(t))ms=Math.max(ms,t-now())}
    }
    markGuard(kind,'429検出',now()+ms);
  }

  if(kind==='likes'&&r.ok){
    const m=url.match(/\/api\/v3\/notes\/([^/]+)\/likes/);
    const key=m?.[1] ? decodeURIComponent(m[1]) : '';
    if(key){
      let confirmed=false;
      for(const wait of [250,650,1200]){
        await new Promise(res=>setTimeout(res,wait));
        try{
          const c=await nativeFetch(`/api/v3/notes/${encodeURIComponent(key)}`,{credentials:'include',headers:{accept:'application/json'}});
          const text=await c.text();let j={};try{j=text?JSON.parse(text):{}}catch{}
          const d=j?.data??j??{},n=d.note||d;
          for(const k of ['isLiked','is_liked','liked','hasLiked']){
            if(n?.[k]===true){confirmed=true;break}
          }
          if(confirmed)break;
        }catch{}
      }
      if(!confirmed){
        const until=now()+SHORT_MS;
        markGuard('likes','スキ反映未確認・60分保護',until);
        return retryResponse(until,'スキ反映未確認');
      }
    }
  }
  return r;
};

function cleanup(){
  const remove=['#nb53-open','#nb52-open','#note巡回boost-v4','#nb-v46','#nb-open','#nb-panel','.nb-v48-panel','.nb-v50-panel'];
  for(const s of remove)for(const e of $$(s))e.remove();

  const current=$('#nb532-open');
  const fixed=$$('button').filter(e=>getComputedStyle(e).position==='fixed'&&/[♥♡💗]/.test((e.textContent||'').trim()));
  for(const e of fixed)if(e!==current&&!e.id?.startsWith('nb532'))e.remove();

  for(const e of $$('button,a')){
    if(e===current||e.closest('#nb532-panel')||e.closest('#nb532-modal'))continue;
    if(/巡回BOOST/.test((e.textContent||'').replace(/\s+/g,'')))e.remove();
  }
}
function labelFor(state){
  if(state==='preexisting')return'💗 元からスキ済み';
  if(state==='liked_now')return'❤️ 今回スキ確認済み';
  return'⏸ 未処理';
}
function readQueue(){const q=load('queue',[]);return Array.isArray(q)?q:[]}
function readIndex(){return Math.max(0,Number(load('index',0))||0)}
function updateStatusClarity(){
  const card=$('#nb532-card'),status=$('#nb532-status');
  if(!card||!status)return;
  const q=readQueue(),i=readIndex(),x=q[i];
  if(!x)return;
  const pending=!['preexisting','liked_now'].includes(x.likeState);
  const last=load('lastAction',null);

  if(pending&&/(完了|スキ済み|送信なし|今回スキ)/.test(status.textContent||'')){
    status.textContent=`現在 @${x.urlname||'?'}｜⏸ 未処理${last?`　直前 @${last.urlname} ${last.label}`:''}`;
    status.dataset.bad='0';
  }

  const strong=card.querySelector('.nb532-top strong');
  if(strong)strong.textContent=labelFor(x.likeState);
  const likeBtn=$('#nb532-like');
  if(likeBtn)likeBtn.textContent=pending?'♡ スキ':(x.likeState==='preexisting'?'💗 元から済':'❤️ 今回済');

  const sum=$('#nb532-summary');
  if(sum){
    const pre=q.filter(y=>y.likeState==='preexisting').length;
    const liked=q.filter(y=>y.likeState==='liked_now').length;
    const pend=q.filter(y=>!['preexisting','liked_now'].includes(y.likeState)).length;
    const b=sum.querySelector('#nb532-states');
    if(b)b.textContent='履歴';
    const spans=sum.querySelectorAll('span');
    if(spans[0])spans[0].textContent=`❤️今回 ${liked}`;
    if(spans[1])spans[1].textContent=`💗元から ${pre}`;
    if(spans[2])spans[2].textContent=`⏸未処理 ${pend}`;
  }
}
function updateLimiterUI(){
  const box=$('#nb532-limits');if(!box)return;
  const a=stats('likes'),m=stats('mags');
  box.style.gridTemplateColumns='1fr';
  box.innerHTML=`
    <span>♡ 1h <b>${a.short}/${SHORT_CAP}</b>・24h <b>${a.day}/${DAY_CAP}</b>・解除 <b>${a.until?fmt(a.until):'—'}</b></span>
    <span>📚 1h <b>${m.short}/${SHORT_CAP}</b>・24h <b>${m.day}/${DAY_CAP}</b>・解除 <b>${m.until?fmt(m.until):'—'}</b></span>`;
}
function updateVersion(){
  const h=$('#nb532-panel .nb532-head b');
  if(h)h.textContent='巡回BOOST 5.3.3';
  const cfgBox=$('#nb532-settings');
  if(cfgBox&&!$('#nb533-limiter-note')){
    const n=document.createElement('div');n.id='nb533-limiter-note';
    n.textContent='安全リミッター：♡/📚 共通 18回/1時間・80回/24時間（固定）';
    n.style.cssText='padding:5px;border:1px solid #38576a;border-radius:7px;font-size:9px;color:#bfeaff';
    cfgBox.prepend(n);
    for(const id of ['nb532-batchcap','nb532-cool','nb532-likecap','nb532-magcap']){
      const input=$('#'+id);if(input)input.closest('label')?.remove();
    }
  }
}
function tick(){cleanup();updateVersion();updateLimiterUI();updateStatusClarity()}
function boot(){
  cleanup();tick();
  const mo=new MutationObserver(()=>{clearTimeout(window.__nb533PatchT);window.__nb533PatchT=setTimeout(tick,60)});
  mo.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  setInterval(tick,1500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();