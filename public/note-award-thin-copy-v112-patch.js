(function(){
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_AWARD_THIN_PATCH_121__) return;
  page.__MUMEI_AWARD_THIN_PATCH_121__ = true;

  const DATA_KEY = 'mumei_award_thin_dataset_v100';
  const SHARED_KEY = 'mumei_award_thin_shared_dataset_v112';
  const IS_EDITOR = location.origin === 'https://editor.note.com';
  let sharedCache = null;
  let lastLocal = '';
  let autoOpening = false;
  let autoExtracting = false;

  function parse(value){
    try { return JSON.parse(value || 'null'); } catch (_) { return null; }
  }
  function valid(value){
    return Boolean(value && value.sourceKey === 'nde66a065c21c' && Array.isArray(value.rows) && value.rows.length);
  }
  function status(){ return document.querySelector('[id^="mumei-award-thin-status-"]'); }
  function panel(){ return document.querySelector('[id^="mumei-award-thin-panel-"]'); }
  function setPatchStatus(text,bad=false){
    const el=status();
    if(!el) return;
    el.textContent=text;
    el.dataset.bad=bad?'1':'0';
  }

  async function loadShared(){
    try {
      const value = await GM_getValue(SHARED_KEY, null);
      sharedCache = valid(value) ? value : null;
      if (IS_EDITOR && sharedCache) {
        const local = parse(localStorage.getItem(DATA_KEY));
        if (!valid(local) || Number(sharedCache.extractedAt ? Date.parse(sharedCache.extractedAt) : 0) >= Number(local?.extractedAt ? Date.parse(local.extractedAt) : 0)) {
          const text=JSON.stringify(sharedCache);
          localStorage.setItem(DATA_KEY,text);
          lastLocal=text;
        }
      }
    } catch (_) {}
  }

  async function syncLocalToShared(){
    const raw=localStorage.getItem(DATA_KEY)||'';
    if(!raw || raw===lastLocal) return;
    lastLocal=raw;
    const value=parse(raw);
    if(!valid(value)) return;
    sharedCache=value;
    try { await GM_setValue(SHARED_KEY,value); } catch (_) {}
  }

  function visible(el){
    return Boolean(el && el.getClientRects && el.getClientRects().length && getComputedStyle(el).visibility!=='hidden');
  }
  function plusCandidate(){
    const nodes=[...document.querySelectorAll('button,[role="button"]')].filter(visible);
    const strong=nodes.find((el)=>{
      const label=[el.getAttribute('aria-label'),el.getAttribute('title'),el.textContent].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
      return /^(?:\+|追加|ブロックを追加|コンテンツを追加|挿入)$/.test(label) || /ブロック.*追加|コンテンツ.*追加/.test(label);
    });
    if(strong) return strong;
    return nodes.find((el)=>{
      const label=[el.getAttribute('aria-label'),el.getAttribute('title')].filter(Boolean).join(' ');
      return /追加|挿入/.test(label) && el.querySelector('svg');
    })||null;
  }
  function imageChoice(){
    const nodes=[...document.querySelectorAll('button,[role="button"],label,[role="menuitem"],li')].filter(visible);
    return nodes.find((el)=>/^(?:画像|写真|画像を追加|写真を追加)$/.test(String(el.textContent||'').replace(/\s+/g,' ').trim()))||null;
  }
  async function autoOpenImage(){
    if(!IS_EDITOR || autoOpening) return;
    autoOpening=true;
    try{
      await new Promise(r=>setTimeout(r,180));
      const plus=plusCandidate();
      if(!plus){ setPatchStatus('極薄画像の準備完了 ✅ 本文の「＋」→「画像」を1回押してください'); return; }
      plus.click();
      const deadline=Date.now()+5000;
      while(Date.now()<deadline){
        const image=imageChoice();
        if(image){ image.click(); return; }
        await new Promise(r=>setTimeout(r,80));
      }
      setPatchStatus('極薄画像の準備完了 ✅ 「＋」は開きました。表示された「画像」を1回押してください');
    }catch(_){
      setPatchStatus('極薄画像の準備完了 ✅ 本文の「＋」→「画像」を1回押してください');
    }finally{
      setTimeout(()=>{autoOpening=false;},1200);
    }
  }

  async function autoExtractThenImage(){
    if(autoExtracting) return;
    autoExtracting=true;
    try{
      const p=panel();
      const extract=p?.querySelector('button[data-a="extract"]');
      const images=p?.querySelector('button[data-a="images"]');
      if(!extract || !images) throw new Error('表彰ツールのボタンが見つかりません');
      setPatchStatus('抽出データなし → 元記事から自動抽出中…');
      extract.click();
      const deadline=Date.now()+90000;
      let data=null;
      while(Date.now()<deadline){
        data=parse(localStorage.getItem(DATA_KEY));
        if(valid(data) && !extract.disabled && !images.disabled) break;
        await new Promise(r=>setTimeout(r,250));
      }
      if(!valid(data)) throw new Error('自動抽出が完了しませんでした');
      await syncLocalToShared();
      setPatchStatus(`自動抽出 ${data.linkedCount ?? data.rows.filter(r=>r.url).length}件 ✅ 極薄画像を準備開始…`);
      await new Promise(r=>setTimeout(r,150));
      autoExtracting=false;
      images.click();
    }catch(error){
      setPatchStatus(`画の自動開始失敗：${error?.message||String(error)}`,true);
    }finally{
      autoExtracting=false;
    }
  }

  function observeStatus(){
    const attach=()=>{
      const el=status();
      if(!el || el.dataset.patch121==='1') return false;
      el.dataset.patch121='1';
      const observer=new MutationObserver(()=>{
        const text=String(el.textContent||'');
        if(/準備完了\s*\d+件.*「＋」.*「画像」/.test(text)) void autoOpenImage();
        if(/抽出\s*\d+名.*記事URL\s*\d+件/.test(text)) void syncLocalToShared();
      });
      observer.observe(el,{childList:true,subtree:true,characterData:true});
      return true;
    };
    if(attach()) return;
    const timer=setInterval(()=>{ if(attach()) clearInterval(timer); },250);
    setTimeout(()=>clearInterval(timer),30000);
  }

  function installImagePreflight(){
    if(!IS_EDITOR) return;
    document.addEventListener('click',(event)=>{
      const button=event.target?.closest?.('button[data-a="images"]');
      if(!button) return;
      const local=parse(localStorage.getItem(DATA_KEY));
      if(valid(local)) return;
      if(valid(sharedCache)){
        const text=JSON.stringify(sharedCache);
        localStorage.setItem(DATA_KEY,text);
        lastLocal=text;
        setPatchStatus(`抽出データ ${sharedCache.linkedCount ?? sharedCache.rows.filter(r=>r.url).length}件を復元 ✅ 「画」を続行`);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      void autoExtractThenImage();
    },true);
  }

  async function boot(){
    await loadShared();
    observeStatus();
    installImagePreflight();
    setInterval(()=>void syncLocalToShared(),500);
    if(IS_EDITOR && sharedCache){
      const el=status();
      if(el && !/対象\d+件/.test(el.textContent||'')) setPatchStatus(`抽出データ ${sharedCache.linkedCount ?? sharedCache.rows.filter(r=>r.url).length}件を共有保存から復元済み ✅`);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>void boot(),{once:true}); else void boot();
})();