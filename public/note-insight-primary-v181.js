(function(){
  'use strict';
  const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
  if(page.__MUMEI_INSIGHT_PRIMARY_181__)return;
  page.__MUMEI_INSIGHT_PRIMARY_181__=true;

  const PANEL='mumei-note-source-picker-v163';
  const STATUS='mumei-note-source-status-v163';
  const MODE_KEY='mumei_insight_all_likes_mode_v180';
  const CHOICE_KEY='mumei_insight_all_likes_choice_v180';
  const STYLE='mumei-insight-primary-v181-style';

  function installStyle(){
    if(document.getElementById(STYLE)||!document.head)return;
    const s=document.createElement('style');
    s.id=STYLE;
    s.textContent=`
      #${PANEL}{width:min(322px,calc(100vw - 12px))!important;right:6px!important;left:auto!important;max-width:calc(100vw - 12px)!important}
      #${PANEL} .grid2:first-of-type,
      #${PANEL} input[data-source],
      #${PANEL} [data-hint],
      #${PANEL} button[data-amount-mode],
      #${PANEL} input[data-amount]{display:none!important}
      #${PANEL} .grid3{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important;margin-bottom:7px!important}
      #${PANEL} .grid3 button{font-size:11px!important;padding:8px 4px!important}
      #${PANEL} .actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important;margin-top:5px!important}
      #${PANEL} .actions button{display:block!important;font-size:12px!important;padding:9px 3px!important}
      #${PANEL} .actions button[data-a="image"]{display:none!important}
      #${PANEL} .resume{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;margin-top:5px!important}
      #${PANEL} .resume button{font-size:10px!important;padding:7px 2px!important}
      #${PANEL} [data-insight-all-likes]{display:none!important}
      #${PANEL} .mumei-insight-primary-note{font-size:10px;line-height:1.35;color:#a7f3d0;background:#052e2b;border:1px solid #115e59;border-radius:8px;padding:7px;margin-bottom:7px}
      #${PANEL} .mumei-insight-primary-count{font-weight:900;color:#fff}
    `;
    document.head.appendChild(s);
  }

  function apply(){
    installStyle();
    const p=document.getElementById(PANEL);
    if(!p)return;
    localStorage.setItem(MODE_KEY,'1');

    const title=p.querySelector('.mumei-title-text-v164')||p.querySelector(':scope > .title');
    if(title)title.textContent='INSIGHT全体スキ100｜極薄＋通知';

    let note=p.querySelector('.mumei-insight-primary-note');
    if(!note){
      note=document.createElement('div');
      note.className='mumei-insight-primary-note';
      note.innerHTML='<span class="mumei-insight-primary-count">自分の記事全体についた直近スキ100人</span><br>URL入力なし｜1人1記事を選択 → 極薄🔗 → 通知カード → 投稿後カードだけ削除';
      const choice=p.querySelector('.grid3');
      if(choice)choice.before(note); else p.prepend(note);
    }

    const amount=p.querySelector('input[data-amount]');
    if(amount){ amount.value='100'; amount.dataset.insightTouched='1'; }

    const fixed=p.querySelector('button[data-choice="fixed"]');
    const latest=p.querySelector('button[data-choice="latest"]');
    const oldest=p.querySelector('button[data-choice="oldest"]');
    const auto=p.querySelector('[data-insight-auto-choice]');
    if(fixed)fixed.textContent='固定記事';
    if(latest)latest.textContent='最新記事';
    if(oldest)oldest.textContent='最初の記事';
    if(auto)auto.textContent='自動選択';

    if(!localStorage.getItem(CHOICE_KEY) && !p.querySelector('button[data-choice].active')){
      localStorage.setItem(CHOICE_KEY,'auto');
      auto?.classList.add('active');
    }

    const start=p.querySelector('button[data-a="extract"]');
    const send=p.querySelector('button[data-a="send"]');
    const del=p.querySelector('button[data-a="delete"]');
    if(start){start.textContent='開始';start.title='INSIGHTから直近スキ100人を取得して極薄画像準備へ';}
    if(send)send.textContent='送';
    if(del)del.textContent='削';

    const pause=p.querySelector('button[data-a="pause"]');
    const resume=p.querySelector('button[data-a="resume"]');
    const reset=p.querySelector('button[data-a="reset"]');
    const boost=p.querySelector('[data-insight-boost]');
    if(pause)pause.textContent='停';
    if(resume)resume.textContent='再開';
    if(reset)reset.textContent='初';
    if(boost)boost.textContent='巡回';

    const status=document.getElementById(STATUS);
    if(status && /URL・記事種別|抽出元URL|マガジン|スキ元/.test(String(status.textContent||''))){
      status.textContent='記事の選び方を決めて「開始」';
      status.dataset.bad='0';
    }
  }

  document.addEventListener('click',(e)=>{
    const t=e.target instanceof Element?e.target:null;
    if(!t)return;
    if(t.closest(`#${PANEL} button[data-mode],#${PANEL} button[data-amount-mode]`)){
      localStorage.setItem(MODE_KEY,'1');
    }
  },true);

  const mo=new MutationObserver(apply);
  function boot(){
    if(document.body)mo.observe(document.body,{childList:true,subtree:true});
    apply();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  setInterval(apply,800);
})();
