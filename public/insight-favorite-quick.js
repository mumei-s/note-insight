(()=>{
  'use strict';
  const FAST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-fast-api-v2';
  const OWNER_KEY='mumei-unified-owner-token';
  const SELF='ss_yr';
  const favorites=new Set();
  let loaded=false;
  let loading=false;

  function token(){return localStorage.getItem(OWNER_KEY)||''}
  function profile(href){
    try{
      const u=new URL(String(href||''),location.href);
      if(!/(^|\.)note\.com$/i.test(u.hostname))return null;
      const parts=u.pathname.split('/').filter(Boolean);
      if(parts.length!==1)return null;
      const id=String(parts[0]||'').toLowerCase();
      if(!/^[a-z0-9_-]+$/.test(id)||id===SELF)return null;
      return{id,url:`https://note.com/${id}`};
    }catch{return null}
  }
  async function post(body){
    const t=token();
    if(!t)throw new Error('OWNER_LOGIN_REQUIRED');
    const r=await fetch(FAST,{method:'POST',headers:{'Content-Type':'application/json','X-Owner-Token':t},body:JSON.stringify(body),cache:'no-store'});
    const p=await r.json().catch(()=>({}));
    if(!r.ok||p?.ok===false)throw new Error(p?.error||'FAVORITE_UPDATE_FAILED');
    return p;
  }
  function meta(anchor,id,url){
    const scope=anchor.closest('article,li,[class*="row"],[class*="person"],[class*="card"]')||anchor.parentElement;
    const text=String(scope?.querySelector('strong,b')?.textContent||'').replace(/\s+/g,' ').trim();
    const actorName=text&&text.length<=80&&!/^(note|プロフィール|記事|詳細|解除|追加)/i.test(text)?text:`@${id}`;
    const img=scope?.querySelector('img');
    return{creatorKey:id,actorName,actorUrl:url,actorImageUrl:img instanceof HTMLImageElement?img.src:null};
  }
  function updateButtons(id){
    document.querySelectorAll(`button.insight-fav-quick[data-creator-key="${CSS.escape(id)}"]`).forEach(el=>{
      const on=favorites.has(id);
      el.textContent=on?'★':'☆';
      el.setAttribute('aria-label',on?'お気に入り解除':'お気に入りに追加');
      el.title=on?'お気に入り解除':'お気に入りに追加';
      el.classList.toggle('is-favorite',on);
    });
  }
  async function toggle(button,anchor,info){
    if(button.disabled)return;
    button.disabled=true;
    const next=!favorites.has(info.id);
    try{
      const m=meta(anchor,info.id,info.url);
      await post({action:'favorite_toggle',...m,favorite:next});
      if(next)favorites.add(info.id);else favorites.delete(info.id);
      updateButtons(info.id);
      window.dispatchEvent(new CustomEvent('insight-favorites-changed',{detail:{creatorKey:info.id,favorite:next}}));
      button.animate?.([{transform:'scale(1)'},{transform:'scale(1.2)'},{transform:'scale(1)'}],{duration:220});
    }catch(e){
      button.title=e instanceof Error?e.message:'お気に入りを更新できませんでした';
    }finally{button.disabled=false}
  }
  function scan(){
    if(!loaded||!token())return;
    document.querySelectorAll('a[href]').forEach(anchor=>{
      if(!(anchor instanceof HTMLAnchorElement))return;
      const info=profile(anchor.href);
      if(!info||anchor.closest('.fav-reader,.iv8-favorite-mode'))return;
      const next=anchor.nextElementSibling;
      if(next instanceof HTMLButtonElement&&next.classList.contains('insight-fav-quick')&&next.dataset.creatorKey===info.id){updateButtons(info.id);return}
      const button=document.createElement('button');
      button.type='button';
      button.className='insight-fav-quick';
      button.dataset.creatorKey=info.id;
      button.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();void toggle(button,anchor,info)});
      anchor.insertAdjacentElement('afterend',button);
      updateButtons(info.id);
    });
  }
  async function load(){
    if(loading||!token())return;
    loading=true;
    try{
      const p=await post({action:'favorites'});
      favorites.clear();
      for(const row of Array.isArray(p?.rows)?p.rows:[]){const id=String(row?.creator_key||'').toLowerCase();if(id)favorites.add(id)}
      loaded=true;
      scan();
    }catch{loaded=false}
    finally{loading=false}
  }
  function style(){
    if(document.getElementById('insight-fav-quick-style'))return;
    const s=document.createElement('style');s.id='insight-fav-quick-style';s.textContent=`.insight-fav-quick{display:inline-grid;place-items:center;width:29px;height:29px;margin-left:5px;padding:0;border:1px solid #55657a;border-radius:999px;background:#101923;color:#a7b4c4;font:900 17px/1 system-ui;vertical-align:middle;cursor:pointer;box-shadow:none}.insight-fav-quick.is-favorite{border-color:#8a7132;background:#241c08;color:#ffd86a}.insight-fav-quick:disabled{opacity:.45}`;document.head.appendChild(s)
  }
  style();
  const observer=new MutationObserver(()=>scan());observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('storage',e=>{if(e.key===OWNER_KEY){loaded=false;void load()}});
  void load();
  window.setInterval(()=>{if(!loaded&&token())void load();else scan()},2500);
})();
