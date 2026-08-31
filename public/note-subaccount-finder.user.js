// ==UserScript==
// @name         note 巡回BOOST｜タグ検索・スキ・マガジン v4.3
// @namespace    https://github.com/mumei-s/note-insight
// @version      4.3.0
// @description  複数タグ・初投稿確認・女性向けテーマ・サムネイル・アカウント別安全カウンター・マガジン追加・スキ返し履歴を備えた巡回ツール。
// @match        https://note.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
  'use strict';

  const VERSION = '4.3.0';
  const K = 'note巡回BOOST_v4';
  const DEFAULTS = {
    likeHour: 18, likeDay: 80,
    magHour: 20, magDay: 50,
    followGap: 20,
    days: 7, count: 50, mode: 'new', tagMode: 'OR',
    womenMode: 'off',
    excludeFollowing: false, onePerCreator: true,
  };

  const TAG_GROUPS = {
    '🌱 note・初心者': ['はじめてのnote','note初心者','note','自己紹介','プロフィール'],
    '✍️ エッセイ・日常': ['エッセイ','日記','暮らし','日常','雑記','コラム'],
    '📚 小説・創作': ['小説','短編小説','創作','詩','読書','文学','物語'],
    '🏠 暮らし・家族': ['子育て','育児','家事','料理','おうち時間','家族','ワーママ'],
    '💼 仕事・学び': ['仕事','働き方','キャリア','学び','勉強','転職','副業'],
    '🤖 AI・テック': ['AI','生成AI','ChatGPT','テクノロジー','プログラミング'],
    '🎨 趣味・おでかけ': ['写真','イラスト','旅行','グルメ','カフェ','美容','ファッション','音楽','映画'],
  };

  const FIXED_NG = {
    'ギャンブル': [
      /ギャンブル/i,/競馬/i,/競輪/i,/競艇/i,/ボートレース/i,/オートレース/i,
      /パチンコ/i,/パチスロ/i,/オンラインカジノ/i,/カジノ/i,/ブックメーカー/i,
      /スポーツベット/i,/賭博/i,/馬券/i,/舟券/i
    ],
    'アダルト': [
      /アダルト/i,/18禁/i,/成人向け/i,/ポルノ/i,/風俗/i,/性風俗/i,/AV女優/i,/AV男優/i,
      /セフレ/i,/援交/i,/パパ活/i,/出会い系/i,/エロ/i,/性行為/i,/性的サービス/i,/アダルトアフィリ/i
    ],
    '投資': [
      /(?:^|[^A-Za-z])FX(?:[^A-Za-z]|$)/i,/外国為替/i,/仮想通貨/i,/暗号資産/i,/ビットコイン/i,/bitcoin/i,
      /投資/i,/株式/i,/株価/i,/銘柄/i,/NISA/i,/iDeCo/i,/資産運用/i,/高配当/i,
      /デイトレ/i,/トレード/i,/バイナリーオプション/i,/投資信託/i,/不動産投資/i
    ]
  };

  // 作者の性別を推測せず、文章中に明示された語や女性向けテーマだけを使う。
  const WOMEN_TOPIC = [
    /女性/i,/女子/i,/主婦/i,/妻\b/i,/ママ/i,/母(?:です|親|として)/i,/ワーママ/i,
    /子育て/i,/育児/i,/妊娠/i,/出産/i,/美容/i,/コスメ/i,/メイク/i,/スキンケア/i,
    /ファッション/i,/ネイル/i,/ヘアケア/i,/暮らし/i,/家事/i,/料理/i
  ];
  const WOMEN_EXPLICIT = [
    /(?:私は|わたしは|筆者は)?\s*女性(?:です|で|として)/i,
    /(?:私は|わたしは)?\s*(?:主婦|妻|ママ|母親|ワーママ)(?:です|で|として)/i
  ];

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pick = (o, ks, fb='') => { for (const k of ks) if (o && o[k] != null) return o[k]; return fb; };
  const boolPick = (o, ks) => { for (const k of ks) if (o && typeof o[k] === 'boolean') return o[k]; return null; };
  const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
  const parseMs = s => Date.parse(s || '') || 0;
  const gload = (name, fb) => { try { return JSON.parse(localStorage.getItem(`${K}:${name}`)) ?? fb; } catch { return fb; } };
  const gsave = (name, v) => { try { localStorage.setItem(`${K}:${name}`, JSON.stringify(v)); } catch (e) { console.warn('[note巡回BOOST]', e); } };
  const settings = Object.assign({}, DEFAULTS, gload('settings', {}));

  let authAccount = 'unknown';
  let accountName = '';
  let accountAvatar = '';
  let queue = [], index = 0, running = false, currentUser = null, magazines = [];
  let lastStatus = '待機中';
  let lastDebug = `固定NG：ギャンブル・アダルト・投資｜フォロー差 +${settings.followGap}以上は自動除外`;
  let selectedTags = [];
  let reactionsOpen = false;

  const acctKey = (name, id=authAccount) => `${K}:acct:${id}:${name}`;
  const aload = (name, fb, id=authAccount) => { try { return JSON.parse(localStorage.getItem(acctKey(name,id))) ?? fb; } catch { return fb; } };
  const asave = (name, v, id=authAccount) => { try { localStorage.setItem(acctKey(name,id), JSON.stringify(v)); } catch (e) { console.warn('[note巡回BOOST]', e); } };

  async function api(url, init={}) {
    const headers = Object.assign({accept:'application/json'}, init.headers || {});
    const r = await fetch(url, Object.assign({credentials:'include'}, init, {headers}));
    const text = await r.text();
    let json = null; try { json = text ? JSON.parse(text) : {}; } catch {}
    if (!r.ok) {
      const e = new Error(`${r.status} ${r.statusText}`);
      e.status = r.status; e.body = text.slice(0,300); throw e;
    }
    return json ?? {};
  }

  const userOf = n => n?.user || n?.creator || n?.note_user || {};
  const keyOf = n => pick(n, ['key','note_key','noteKey','slug']);
  const titleOf = n => pick(n, ['name','title']);
  const publishOf = n => pick(n, ['publish_at','publishAt','published_at','publishedAt','created_at','createdAt']);
  const urlnameOf = n => pick(userOf(n), ['urlname','url_name','username'], pick(n,['urlname']));
  const nicknameOf = n => pick(userOf(n), ['nickname','name'], pick(n,['nickname'],urlnameOf(n)));
  const likesOf = n => num(pick(n,['like_count','likeCount','likes_count'],0)) ?? 0;
  const thumbOf = n => {
    const candidates = [
      n?.eyecatch, n?.eyecatch_image, n?.eyecatchImage, n?.image, n?.image_url, n?.imageUrl,
      n?.thumbnail, n?.thumbnail_url, n?.thumbnailUrl,
      n?.eyecatch?.url, n?.eyecatch?.src, n?.eyecatchImage?.url, n?.eyecatchImage?.src,
      n?.image?.url, n?.image?.src, n?.thumbnail?.url, n?.thumbnail?.src
    ];
    for (const x of candidates) if (typeof x === 'string' && /^https?:\/\//.test(x)) return x;
    return '';
  };
  const textOfHtml = html => {
    const d = new DOMParser().parseFromString(String(html || ''),'text/html');
    return (d.body?.textContent || '').replace(/\s+/g,' ').trim();
  };

  function collectTags(j) {
    const out = new Set(), seen = new Set();
    const walk = (x, depth=0) => {
      if (!x || typeof x !== 'object' || seen.has(x) || depth > 7) return;
      seen.add(x);
      if (Array.isArray(x)) return x.forEach(v => walk(v, depth+1));
      for (const [k,v] of Object.entries(x)) {
        if (/hashtag/i.test(k)) {
          if (typeof v === 'string') out.add(v.replace(/^#/,''));
          if (Array.isArray(v)) v.forEach(h => {
            const n = typeof h === 'string' ? h : (h?.name || h?.hashtag || h?.tag || h?.hashtag_name);
            if (n) out.add(String(n).replace(/^#/,''));
          });
        }
        if (v && typeof v === 'object') walk(v, depth+1);
      }
    };
    walk(j); return [...out];
  }

  function normalizeSearch(j) {
    const d = j?.data ?? j ?? {}, notes = d.notes || {};
    const arr = notes.contents || notes.notes || d.contents || [];
    return {
      arr: Array.isArray(arr) ? arr : [],
      cursor: d?.cursor?.note ?? d.note_cursor ?? notes.next_cursor ?? notes.cursor ?? null,
      last: notes.is_last_page === true || notes.isLastPage === true
    };
  }

  const normalizeTags = raw => [...new Set(String(raw||'').split(/[\s,、]+/).map(x=>x.trim().replace(/^#+/,'')).filter(Boolean))];

  function ngReason(text) {
    for (const [label, regs] of Object.entries(FIXED_NG)) if (regs.some(r => r.test(text))) return label;
    return '';
  }

  function womenScore(text) {
    const t = String(text || '');
    return {
      topic: WOMEN_TOPIC.filter(r => r.test(t)).length,
      explicit: WOMEN_EXPLICIT.filter(r => r.test(t)).length
    };
  }

  async function getCurrentUser() {
    try {
      const j = await api('/api/v2/current_user');
      currentUser = j?.data ?? j ?? null;
      const u = currentUser?.user || currentUser || {};
      authAccount = String(u.urlname || u.url_name || u.username || 'unknown');
      accountName = String(u.nickname || u.name || authAccount);
      accountAvatar = String(u.profile_image_path || u.profileImagePath || '');
      if (authAccount !== 'unknown') {
        try {
          const cj = await api(`/api/v2/creators/${encodeURIComponent(authAccount)}`);
          const cr = cj?.data ?? cj ?? {};
          accountName = String(cr.nickname || cr.name || accountName);
          accountAvatar = String(cr.profile_image_path || cr.profileImagePath || accountAvatar);
        } catch {}
        registerAccount();
        migrateLegacyOnce();
        loadAccountState();
      }
      return currentUser;
    } catch {
      currentUser = null; authAccount = 'unknown'; return null;
    }
  }

  function registerAccount() {
    if (authAccount === 'unknown') return;
    const list = gload('knownAccounts', []);
    const next = list.filter(x => x?.id !== authAccount);
    next.unshift({id:authAccount,name:accountName,avatar:accountAvatar,lastSeen:Date.now()});
    gsave('knownAccounts', next.slice(0,6));
    gsave('lastActiveAccount', authAccount);
  }

  function migrateLegacyOnce() {
    try { localStorage.removeItem(`${K}:favorites`); } catch {}
    if (authAccount === 'unknown' || gload('v42MigrationAccount','')) return;
    const legacyNames = ['likes','mags','actions','session','form','defaultMag'];
    for (const name of legacyNames) {
      const v = gload(name, null);
      if (v != null && localStorage.getItem(acctKey(name)) == null) asave(name, v);
    }
    const oldLikes = gload('likes', []);
    if (Array.isArray(oldLikes) && oldLikes.length && !aload('outbound',[]).length) {
      asave('outbound', oldLikes.map(x => ({t:x.t || Date.now(), key:x.key, urlname:x.urlname})).filter(x=>x.urlname));
    }
    gsave('v42MigrationAccount', authAccount);
  }

  function loadAccountState() {
    const s = aload('session', null);
    queue = s && Array.isArray(s.queue) ? s.queue : [];
    index = Math.max(0, Math.min(Number(s?.index)||0, queue.length));
    lastStatus = s?.status || (queue.length ? `@${authAccount} の前回${queue.length}件を復元` : '待機中');
    lastDebug = s?.debug || `固定NG：ギャンブル・アダルト・投資｜フォロー差 +${settings.followGap}以上は自動除外`;
    const f = aload('form',{});
    selectedTags = Array.isArray(f.selectedTags) ? f.selectedTags : [];
  }

  function slim(c) {
    const { body, profile, ...rest } = c || {};
    return rest;
  }

  function saveSession() {
    if (authAccount === 'unknown') return;
    asave('session', {queue:queue.map(slim),index,status:lastStatus,debug:lastDebug,savedAt:Date.now()});
  }

  function setStatus(s) {
    lastStatus = String(s || '');
    const el = $('#nb-status'); if (el) el.textContent = lastStatus;
  }
  function setDebug(s) {
    lastDebug = String(s || '');
    const el = $('#nb-debug'); if (el) el.textContent = lastDebug;
  }

  function history(name) {
    const arr = aload(name, []);
    const cutoff = Date.now() - 48*3600e3;
    return Array.isArray(arr) ? arr.filter(x => x && x.t >= cutoff) : [];
  }
  function addHistory(name, data={}) {
    const arr = history(name); arr.push(Object.assign({t:Date.now()}, data)); asave(name, arr.slice(-500));
  }
  function usage(name, ms) {
    const now=Date.now(); return history(name).filter(x=>now-x.t<ms).length;
  }
  function remainingAt(name, ms, limit) {
    const arr=history(name).filter(x=>Date.now()-x.t<ms).sort((a,b)=>a.t-b.t);
    if (arr.length<limit) return 0;
    return Math.max(0,arr[0].t+ms-Date.now());
  }
  function fmtWait(ms) {
    if (!ms) return '';
    const m=Math.ceil(ms/60000); return m<60?`${m}分`:`${Math.floor(m/60)}時間${m%60}分`;
  }
  function canDo(kind) {
    const isLike=kind==='like';
    const h=isLike?settings.likeHour:settings.magHour;
    const d=isLike?settings.likeDay:settings.magDay;
    const n=isLike?'likes':'mags';
    const uh=usage(n,3600e3),ud=usage(n,86400e3);
    if(uh>=h)return{ok:false,why:`60分安全値 ${uh}/${h}`,wait:remainingAt(n,3600e3,h)};
    if(ud>=d)return{ok:false,why:`24時間安全値 ${ud}/${d}`,wait:remainingAt(n,86400e3,d)};
    return{ok:true,uh,ud,h,d};
  }

  async function getMagazines(noteKey='') {
    try {
      const q = noteKey ? `&note_key=${encodeURIComponent(noteKey)}` : '';
      const j = await api(`/api/v1/my/magazines?includes_editable=true${q}`);
      magazines = (j?.data?.magazines || []).map(m => ({
        id:m.id,key:m.key,name:m.name||'',price:num(m.price)??0,
        noteCount:num(m.note_count)??0,status:m.status||'',
        selected:!!(m.is_added||m.isAdded)
      }));
    } catch { magazines=[]; }
    return magazines;
  }

  async function rawSearch(tags, days, target) {
    const cutoff=Date.now()-days*86400e3;
    const maxRaw=Math.max(target*4,80),all=new Map();
    for(const tag of tags){
      let cursor='0',page=0,done=false;
      while(!done&&page<250&&all.size<maxRaw){
        page++;
        setStatus(`検索中 #${tag}｜${page}ページ｜候補${all.size}`);
        const j=await api(`/api/v3/searches?context=note&q=${encodeURIComponent(tag)}&size=20&start=${encodeURIComponent(cursor)}&sort=new`);
        const s=normalizeSearch(j); if(!s.arr.length)break;
        let oldest=Infinity;
        for(const n of s.arr){
          const t=parseMs(publishOf(n)); if(t)oldest=Math.min(oldest,t);
          if(t&&t<cutoff)continue;
          const key=keyOf(n),urlname=urlnameOf(n); if(!key||!urlname)continue;
          const prev=all.get(key)||{};
          all.set(key,Object.assign(prev,{
            key,urlname,name:nicknameOf(n),title:titleOf(n),publish:publishOf(n),likes:likesOf(n),
            thumb:thumbOf(n)||prev.thumb||'',
            matched:[...new Set([...(prev.matched||[]),tag])]
          }));
        }
        if(oldest<cutoff||s.last||s.cursor==null||String(s.cursor)===String(cursor))done=true;
        else cursor=String(s.cursor);
        await sleep(70);
      }
    }
    return [...all.values()];
  }

  async function articleTextFallback(c) {
    try {
      const r = await fetch(`/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`, {credentials:'include'});
      if (!r.ok) return '';
      const html = await r.text();
      const d = new DOMParser().parseFromString(html,'text/html');
      return (d.querySelector('article')?.textContent || d.querySelector('main')?.textContent || '').replace(/\s+/g,' ').trim();
    } catch { return ''; }
  }

  async function verifyFirstArticle(c) {
    try {
      const j=await api(`/api/v2/creators/${encodeURIComponent(c.urlname)}/contents?kind=note&page=1`);
      const d=j?.data??j??{},arr=Array.isArray(d.contents)?d.contents:[];
      const total=num(d.totalCount)??arr.length;
      const limit=Math.max(1,num(d.limit)??arr.length??10);
      if(total<=1)return true;
      const lastPage=Math.max(1,Math.ceil(total/limit));
      let tail=arr;
      if(lastPage>1){
        const lj=await api(`/api/v2/creators/${encodeURIComponent(c.urlname)}/contents?kind=note&page=${lastPage}`);
        tail=Array.isArray(lj?.data?.contents)?lj.data.contents:[];
      }
      if(!tail.length)return null;
      const oldest=[...tail].sort((a,b)=>parseMs(publishOf(a))-parseMs(publishOf(b)))[0];
      if(!oldest)return null;
      return keyOf(oldest)===c.key;
    } catch { return null; }
  }

  async function inspect(c,tags,tagMode,needFirst) {
    try {
      const [nj,cj]=await Promise.all([
        api(`/api/v3/notes/${encodeURIComponent(c.key)}`),
        api(`/api/v2/creators/${encodeURIComponent(c.urlname)}`)
      ]);
      const d=nj?.data??nj??{},n=d.note||d,cr=cj?.data??cj??{};
      c.id=pick(n,['id','note_id','noteId'],null);
      c.title=titleOf(n)||c.title;c.publish=publishOf(n)||c.publish;c.likes=likesOf(n)||c.likes;
      c.thumb=thumbOf(n)||c.thumb||'';
      c.tags=collectTags(nj);
      c.body=pick(n,['body','free_body','freeBody','description','peekBody'],'');
      let bodyText=textOfHtml(c.body);
      if(!bodyText) bodyText=await articleTextFallback(c);
      c.excerpt=bodyText.slice(0,520);
      c.liked=boolPick(n,['isLiked','is_liked','liked','hasLiked'])===true;
      c.followers=num(pick(cr,['followerCount','follower_count','followersCount','followers_count'],null));
      c.following=num(pick(cr,['followingCount','following_count','followCount','follow_count'],null));
      c.profile=String(pick(cr,['profile','description','bio'],''));
      c.followingAlready=boolPick(cr,['isFollowing','is_following','following'])===true;
      const hay=[c.title,bodyText,c.tags.join(' '),c.profile].join(' ');
      c.ng=ngReason(hay);
      c.gap=c.following!=null&&c.followers!=null?c.following-c.followers:null;
      const ws=womenScore(hay); c.womenTopic=ws.topic; c.womenExplicit=ws.explicit;
      const lowerTags=c.tags.map(x=>x.toLowerCase()),wanted=tags.map(x=>x.toLowerCase()),matched=(c.matched||[]).map(x=>x.toLowerCase());
      c.tagMatch=tagMode==='AND'?wanted.every(t=>lowerTags.includes(t)||matched.includes(t)):true;
      c.actualFirst=needFirst?await verifyFirstArticle(c):null;
      const ageH=Math.max(0.5,(Date.now()-parseMs(c.publish))/3600e3);
      c.velocity=c.likes/Math.max(1,ageH);
      c.discovery=c.likes/Math.max(20,c.followers??100);
      return c;
    } catch(e){c.error=String(e.message||e);return c;}
  }

  function filterAndSort(list,mode,target,needFirst,womenMode){
    const black=new Set(gload('blacklist',[]));
    const seen=new Set(),skips={ng:0,gap:0,black:0,tag:0,self:0,followed:0,dup:0,error:0,notFirst:0,women:0};
    const out=[];
    for(const c of list){
      if(c.error){skips.error++;continue;}
      if(!c.tagMatch){skips.tag++;continue;}
      if(c.urlname===authAccount){skips.self++;continue;}
      if(black.has(c.urlname)){skips.black++;continue;}
      if(c.ng){skips.ng++;continue;}
      if(needFirst&&c.actualFirst!==true){skips.notFirst++;continue;}
      if(womenMode==='topic'&&!(c.womenTopic>0)){skips.women++;continue;}
      if(womenMode==='explicit'&&!(c.womenExplicit>0)){skips.women++;continue;}
      if(c.gap!=null&&c.gap>=settings.followGap){skips.gap++;continue;}
      if(settings.excludeFollowing&&c.followingAlready){skips.followed++;continue;}
      if(settings.onePerCreator&&seen.has(c.urlname)){skips.dup++;continue;}
      seen.add(c.urlname);out.push(c);
    }
    const by={
      new:(a,b)=>parseMs(b.publish)-parseMs(a.publish),
      popular:(a,b)=>b.likes-a.likes,
      rising:(a,b)=>b.velocity-a.velocity||b.likes-a.likes,
      discover:(a,b)=>b.discovery-a.discovery||b.likes-a.likes
    }[mode]||(()=>0);
    if(womenMode==='prefer') out.sort((a,b)=>(b.womenTopic-a.womenTopic)||by(a,b));
    else out.sort(by);
    return{items:out.slice(0,target),skips};
  }

  function selectedTagsFromUI(){
    return $$('.nb-tagcheck:checked').map(x=>x.value);
  }
  function formState(){
    return{
      tags:$('#nb-tags')?.value||'',
      selectedTags:selectedTagsFromUI(),
      days:Number($('#nb-days')?.value||settings.days),
      count:Number($('#nb-count')?.value||settings.count),
      mode:$('#nb-mode')?.value||settings.mode,
      tagMode:$('#nb-tagmode')?.value||settings.tagMode,
      womenMode:$('#nb-women')?.value||settings.womenMode,
    };
  }
  function saveForm(){
    const f=formState();
    selectedTags=f.selectedTags;
    Object.assign(settings,{days:f.days,count:f.count,mode:f.mode,tagMode:f.tagMode,womenMode:f.womenMode});
    gsave('settings',settings); if(authAccount!=='unknown')asave('form',f);
    updateTagSummary();
  }

  function allSearchTags(f){
    return [...new Set([...normalizeTags(f.tags),...(f.selectedTags||[])])];
  }

  async function scan(){
    if(running)return;
    const f=formState(),tags=allSearchTags(f);
    if(!tags.length)return toast('タグを1つ以上選んでね','bad');
    saveForm();
    const previousQueue=queue,previousIndex=index;
    running=true;renderCurrent();
    try{
      if(authAccount==='unknown')await getCurrentUser();
      const needFirst=tags.some(t=>/^(?:はじめて|初めて)のnote$/i.test(t));
      const raw=await rawSearch(tags,f.days,f.count);
      const inspected=[];
      for(let i=0;i<raw.length;i++){
        setStatus(`安全確認 ${i+1}/${raw.length}｜${raw[i].name}${needFirst?'｜初投稿確認':''}`);
        inspected.push(await inspect(raw[i],tags,f.tagMode,needFirst));
        if(i%5===0)setDebug(`検索${raw.length} / 確認${i+1}`);
        await sleep(70);
      }
      const filtered=filterAndSort(inspected,f.mode,f.count,needFirst,f.womenMode);
      queue=filtered.items;index=0;
      setDebug(`表示${queue.length}｜NG${filtered.skips.ng}｜初投稿でない${filtered.skips.notFirst}｜女性向け条件${filtered.skips.women}｜フォロー差${filtered.skips.gap}｜手動除外${filtered.skips.black}｜重複${filtered.skips.dup}`);
      setStatus(queue.length?`完了：${queue.length}件。@${authAccount} の続きとして保存しました。`:'完了：表示できる記事は0件。黄色欄に除外理由を表示。');
      saveSession();
    }catch(e){
      queue=previousQueue;index=previousIndex;
      setStatus(`エラー：${e.message||e}｜前回結果は保持`);
      saveSession();
    }finally{
      running=false;await refreshMagSelector();renderCurrent();saveSession();
    }
  }

  function rememberOutbound(c){
    const arr=aload('outbound',[]);
    arr.push({t:Date.now(),key:c.key,title:c.title,urlname:c.urlname,name:c.name});
    const uniq=new Map();
    for(const x of arr)if(x?.urlname)uniq.set(`${x.urlname}|${x.key||''}`,x);
    asave('outbound',[...uniq.values()].slice(-2000));
  }

  async function like(c){
    const lim=canDo('like');
    if(!lim.ok)return toast(`⛔ スキ停止：${lim.why}。再開目安 ${fmtWait(lim.wait)}`,'bad');
    if(c.liked){toast('すでにスキ済み');return next();}
    try{
      await api(`/api/v3/notes/${encodeURIComponent(c.key)}/likes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:'{}'});
      c.liked=true;addHistory('likes',{key:c.key,urlname:c.urlname});addHistory('actions',{type:'like',key:c.key,urlname:c.urlname});rememberOutbound(c);
      saveSession();updateMeters();toast('❤️ スキしました','ok');setTimeout(next,250);
    }catch(e){
      if([403,429].includes(e.status))toast(`⛔ note側で制限の可能性。停止 (${e.status})`,'bad');
      else toast(`スキ失敗：${e.message||e}`,'bad');
    }
  }

  async function addMagazine(c){
    const lim=canDo('mag');
    if(!lim.ok)return toast(`⛔ マガジン追加停止：${lim.why}。再開目安 ${fmtWait(lim.wait)}`,'bad');
    const sel=$('#nb-mag');if(!sel?.value)return toast('追加先マガジンを選んでね','bad');
    const mag=magazines.find(m=>m.key===sel.value);if(!mag)return toast('マガジンを再読込してね','bad');
    if(mag.price>0&&authAccount!==c.urlname)return toast('他人の記事は有料マガジンへ追加できません','bad');
    try{
      if(!c.id){
        const j=await api(`/api/v3/notes/${encodeURIComponent(c.key)}`);const d=j?.data??j??{},n=d.note||d;
        c.id=pick(n,['id','note_id','noteId'],null);
      }
      await api(`/api/v1/our/magazines/${encodeURIComponent(mag.key)}/notes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:JSON.stringify({note_id:c.id,note_key:c.key})});
      const j=await api(`/api/v3/notes/${encodeURIComponent(c.key)}`);
      const belongs=(j?.data?.belonging_magazine_keys||j?.belonging_magazine_keys||[]);
      if(Array.isArray(belongs)&&belongs.length&&!belongs.includes(mag.key))throw new Error('追加後の所属確認ができませんでした');
      addHistory('mags',{key:c.key,mag:mag.key,urlname:c.urlname});addHistory('actions',{type:'mag',key:c.key,mag:mag.key,urlname:c.urlname});
      updateMeters();toast(`📚「${mag.name}」へ追加`,'ok');
    }catch(e){
      if([403,429].includes(e.status))toast(`⛔ note側で制限の可能性。マガジン追加停止 (${e.status})`,'bad');
      else if(String(e.body||'').includes('already'))toast('すでに追加済み');
      else toast(`追加失敗：${e.message||e}`,'bad');
    }
  }

  function next(){if(!queue.length)return;index=Math.min(queue.length,index+1);saveSession();renderCurrent();}
  function prev(){if(!queue.length)return;index=Math.max(0,index-1);saveSession();renderCurrent();}
  function block(c){
    const arr=new Set(gload('blacklist',[]));arr.add(c.urlname);gsave('blacklist',[...arr]);
    addHistory('actions',{type:'block',urlname:c.urlname});
    queue=queue.filter(x=>x.urlname!==c.urlname);if(index>queue.length)index=queue.length;
    setStatus(`🚫 @${c.urlname} を本垢・サブ垢とも今後除外`);
    saveSession();toast(`🚫 @${c.urlname} を除外`,'ok');renderCurrent();
  }

  async function refreshMagSelector(){
    const sel=$('#nb-mag');if(!sel)return;
    const keep=sel.value||aload('defaultMag','');
    sel.innerHTML='<option value="">📚 追加先マガジン</option>';
    await getMagazines(queue[index]?.key||'');
    for(const m of magazines){
      const o=document.createElement('option');o.value=m.key;o.textContent=`${m.price>0?'💴':'📚'} ${m.name} (${m.noteCount})`;sel.appendChild(o);
    }
    if(magazines.some(m=>m.key===keep))sel.value=keep;
    sel.onchange=()=>asave('defaultMag',sel.value);
    const cnt=$('#nb-magcount');if(cnt)cnt.textContent=`保有 ${magazines.length}`;
  }

  function updateMeters(){
    const el=$('#nb-meters');if(!el)return;
    const lh=usage('likes',3600e3),ld=usage('likes',86400e3),mh=usage('mags',3600e3),md=usage('mags',86400e3);
    el.innerHTML=`<b>@${esc(authAccount)}</b>　❤️ ${lh}/${settings.likeHour}h・${ld}/${settings.likeDay}日　📚 ${mh}/${settings.magHour}h・${md}/${settings.magDay}日`;
  }

  function renderCurrent(){
    const box=$('#nb-card');if(!box)return;
    updateMeters();
    if(running)return box.innerHTML='<div class="nb-empty">検索・安全確認中…<br><small>閉じても途中データは残ります</small></div>';
    if(!queue.length)return box.innerHTML=`<div class="nb-empty">${esc(lastStatus.includes('0件')?lastStatus:'🏷 タグを選んで「巡回開始」')}</div>`;
    if(index>=queue.length){
      box.innerHTML=`<div class="nb-empty"><b>✅ 今回の巡回終了</b><br>${queue.length}件<br><button id="nb-again">先頭へ</button></div>`;
      $('#nb-again').onclick=()=>{index=0;saveSession();renderCurrent();};return;
    }
    const c=queue[index],url=`https://note.com/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`;
    const gap=c.gap==null?'?':(c.gap>=0?`+${c.gap}`:`${c.gap}`);
    const mode=$('#nb-mode')?.value||settings.mode;
    const when=c.publish?new Date(c.publish).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'日時不明';
    box.innerHTML=`
      <div class="nb-cardtop">
        ${c.thumb?`<img class="nb-thumb" src="${esc(c.thumb)}" alt="">`:''}
        <div class="nb-main">
          <div class="nb-pos">${index+1}/${queue.length}　${esc(when)} ${c.actualFirst===true?'🌱初投稿':''}</div>
          <div class="nb-user"><b>${esc(c.name)}</b> <span>@${esc(c.urlname)}</span></div>
          <div class="nb-stat">フォロー ${c.following??'?'} / フォロワー ${c.followers??'?'} / 差 ${gap}　❤️${c.likes}</div>
          <h3>${esc(c.title)}</h3>
        </div>
      </div>
      <div class="nb-tags">${(c.tags||[]).slice(0,10).map(t=>`#${esc(t)}`).join(' ')}</div>
      <div class="nb-ex">${esc(c.excerpt||'本文プレビューなし')}</div>
      <div class="nb-rank">${mode==='rising'?`🔥 ${Number(c.velocity||0).toFixed(2)}スキ/時`:mode==='discover'?`🎯 発掘 ${Number(c.discovery||0).toFixed(2)}`:''}${c.womenTopic>0?`　🌷関連語${c.womenTopic}`:''}</div>
      <div class="nb-actions">
        <button id="nb-like" class="heart">${c.liked?'❤️ スキ済み':'♡ スキ'}</button>
        <button id="nb-skip">⏭ 次へ</button>
        <button id="nb-magadd">📚 追加</button>
      </div>
      <div class="nb-actions sub">
        <a href="${url}" target="_blank">📖 記事</a>
        <a href="https://note.com/${encodeURIComponent(c.urlname)}" target="_blank">👤人物</a>
        <button id="nb-block">🚫 除外</button>
        <button id="nb-prev">← 戻る</button>
      </div>`;
    $('#nb-like').onclick=()=>like(c);$('#nb-skip').onclick=next;$('#nb-magadd').onclick=()=>addMagazine(c);
    $('#nb-block').onclick=()=>block(c);$('#nb-prev').onclick=prev;
  }

  function normalizeLikeUsers(j){
    const d=j?.data??j??{};
    const arr=Array.isArray(d)?d:(d.likes||d.users||d.contents||[]);
    return arr.map(x=>x?.user||x?.creator||x).filter(Boolean);
  }

  async function checkReactions(){
    if(authAccount==='unknown')return toast('ログイン中アカウントを取得できません','bad');
    const outbound=aload('outbound',[]);
    if(!outbound.length)return toast('このアカウントからのスキ履歴がまだありません');
    const targets=new Set(outbound.map(x=>x.urlname).filter(Boolean));
    const found=aload('reactions',[]);
    const seen=new Set(found.map(x=>`${x.from}|${x.myKey}`));
    let added=0;
    try{
      setStatus('↩ スキ返しを確認中…');
      const notes=[];
      for(let p=1;p<=2;p++){
        const j=await api(`/api/v2/creators/${encodeURIComponent(authAccount)}/contents?kind=note&page=${p}`);
        const arr=Array.isArray(j?.data?.contents)?j.data.contents:[];
        notes.push(...arr);if(arr.length<10)break;
      }
      for(let i=0;i<Math.min(notes.length,15);i++){
        const n=notes[i],key=keyOf(n);if(!key)continue;
        setStatus(`↩ 反応確認 ${i+1}/${Math.min(notes.length,15)}｜${titleOf(n)}`);
        for(let p=1;p<=2;p++){
          const lj=await api(`/api/v3/notes/${encodeURIComponent(key)}/likes?page=${p}&per_page=100`);
          const users=normalizeLikeUsers(lj);
          for(const u of users){
            const from=String(u.urlname||u.url_name||u.username||'');
            if(!from||!targets.has(from))continue;
            const rk=`${from}|${key}`;
            if(seen.has(rk))continue;
            seen.add(rk);found.push({t:Date.now(),from,name:u.nickname||u.name||from,myKey:key,myTitle:titleOf(n)});
            added++;
          }
          if(users.length<100)break;
          await sleep(60);
        }
        await sleep(60);
      }
      asave('reactions',found.slice(-500));
      setStatus(`↩ 反応確認完了：新規 ${added}件 / 累計 ${found.length}件`);
      renderReactions();
      toast(added?`↩ 新しいスキ返し ${added}件`:'新しいスキ返しはまだなし',added?'ok':'');
    }catch(e){setStatus(`反応確認エラー：${e.message||e}`);toast('反応確認に失敗','bad');}
  }

  function renderReactions(){
    const box=$('#nb-reactions');if(!box)return;
    const arr=[...aload('reactions',[])].sort((a,b)=>b.t-a.t);
    $('#nb-reaction-count').textContent=String(arr.length);
    if(!reactionsOpen){box.style.display='none';return;}
    box.style.display='block';
    box.innerHTML=arr.length?arr.slice(0,30).map(x=>`
      <div class="nb-reactrow">
        <b>↩ ${esc(x.name||x.from)}</b> <span>@${esc(x.from)}</span><br>
        <small>あなたの記事「${esc(x.myTitle||x.myKey)}」へスキ返し</small>
      </div>`).join(''):'<div class="nb-empty small">反応履歴はまだありません</div>';
  }

  function toast(msg,kind=''){
    const t=$('#nb-toast');if(!t)return alert(msg);
    t.textContent=msg;t.className=`nb-toast ${kind}`;t.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(()=>t.style.display='none',3200);
  }

  function openSettings(){
    const h=prompt('スキ安全値：60分,24時間',`${settings.likeHour},${settings.likeDay}`);
    if(h){const[a,b]=h.split(',').map(Number);if(a>0&&b>0){settings.likeHour=a;settings.likeDay=b;}}
    const m=prompt('マガジン追加安全値：60分,24時間',`${settings.magHour},${settings.magDay}`);
    if(m){const[a,b]=m.split(',').map(Number);if(a>0&&b>0){settings.magHour=a;settings.magDay=b;}}
    const g=prompt('自動除外する「フォロー数−フォロワー数」の差',String(settings.followGap));
    if(g&&Number(g)>=0)settings.followGap=Number(g);
    gsave('settings',settings);updateMeters();toast('設定保存','ok');
  }

  function updateTagSummary(){
    const el=$('#nb-tag-summary');if(!el)return;
    const f=formState(),tags=allSearchTags(f);
    el.textContent=tags.length?tags.map(t=>`#${t}`).join(' '):'未選択';
  }

  function renderTagDrawer(){
    const box=$('#nb-tagdrawer');if(!box)return;
    const selected=new Set(selectedTags);
    box.innerHTML=Object.entries(TAG_GROUPS).map(([group,tags])=>`
      <div class="nb-taggroup"><b>${esc(group)}</b>
        <div class="nb-tagchecks">${tags.map(t=>`<label><input type="checkbox" class="nb-tagcheck" value="${esc(t)}" ${selected.has(t)?'checked':''}>#${esc(t)}</label>`).join('')}</div>
      </div>`).join('');
    for(const el of $$('.nb-tagcheck',box))el.onchange=saveForm;
  }

  function renderAccounts(){
    const box=$('#nb-accounts');if(!box)return;
    const list=gload('knownAccounts',[]);
    box.innerHTML=list.slice(0,2).map(a=>{
      const active=a.id===authAccount;
      const likes=(()=>{try{return JSON.parse(localStorage.getItem(acctKey('likes',a.id))||'[]')}catch{return[]}})();
      const mags=(()=>{try{return JSON.parse(localStorage.getItem(acctKey('mags',a.id))||'[]')}catch{return[]}})();
      const lh=likes.filter(x=>Date.now()-(x.t||0)<3600e3).length;
      const mh=mags.filter(x=>Date.now()-(x.t||0)<3600e3).length;
      return `<div class="nb-account ${active?'active':''}" title="${active?'現在ログイン中':'このアカウントへnote側を切替すると自動で続きから再開'}"><b>${active?'● ':''}${esc(a.name||a.id)}</b><span>@${esc(a.id)}</span><small>❤️${lh}/${settings.likeHour}　📚${mh}/${settings.magHour}</small></div>`;
    }).join('');
  }

  async function boot(){
    await getCurrentUser();
    makeUI();
  }

  function makeUI(){
    if($('#note巡回boost-v4'))return;
    const form=aload('form',{});
    selectedTags=Array.isArray(form.selectedTags)?form.selectedTags:selectedTags;
    const host=document.createElement('div');host.id='note巡回boost-v4';
    host.innerHTML=`<style>
      #note巡回boost-v4{position:fixed;right:8px;bottom:8px;z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;color:#151515}
      #nb-open{border:0;border-radius:999px;padding:11px 14px;background:#111;color:#fff;font-weight:900;box-shadow:0 4px 16px #0004}
      #nb-panel{display:none;width:min(92vw,430px);max-height:52vh;overflow:auto;background:#fff;border-radius:15px;box-shadow:0 10px 34px #0006;padding:10px}
      .nb-head{display:flex;gap:6px;align-items:center;position:sticky;top:-10px;background:#fff;padding:6px 0;z-index:4}.nb-head b{flex:1}.nb-head button{padding:6px 8px}
      #nb-accounts{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:4px 0}.nb-account{border:1px solid #ddd;border-radius:9px;padding:5px 7px;display:grid;font-size:11px}.nb-account.active{background:#eef8f0;border-color:#8bc9a3}.nb-account span{color:#666}.nb-account small{font-weight:800}
      .nb-toprow{display:grid;grid-template-columns:1fr 110px;gap:6px}.nb-toprow input,.nb-toprow select,.nb-grid select{min-width:0;padding:8px;border:1px solid #ccc;border-radius:8px;background:#fff}
      .nb-drawerbtn{display:flex;gap:6px;margin:6px 0}.nb-drawerbtn button{flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;background:#fff;font-weight:800}
      #nb-tagdrawer{display:none;border:1px solid #ddd;border-radius:9px;padding:7px;max-height:180px;overflow:auto}.nb-taggroup{padding:5px 0;border-bottom:1px solid #eee}.nb-tagchecks{display:flex;flex-wrap:wrap;gap:4px 8px;margin-top:4px}.nb-tagchecks label{font-size:12px;white-space:nowrap}
      #nb-tag-summary{font-size:11px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:4px 2px}
      .nb-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px}.nb-grid select{font-size:12px}
      #nb-run{width:100%;margin:6px 0;padding:9px;border:0;border-radius:9px;background:#111;color:#fff;font-weight:900}
      #nb-status,#nb-debug,#nb-meters{font-size:11px;padding:6px 8px;border-radius:8px;margin:4px 0}#nb-status{background:#f2f2f2}#nb-debug{background:#fff5cf}#nb-meters{background:#eef8f0}
      .nb-magrow{display:flex;gap:5px;margin:5px 0}.nb-magrow select{flex:1;min-width:0;padding:7px;border-radius:8px}.nb-magrow button{padding:7px}.nb-magrow span{font-size:11px;align-self:center}
      #nb-card{border:1px solid #ddd;border-radius:11px;padding:9px;margin-top:6px;min-height:150px}.nb-cardtop{display:flex;gap:9px}.nb-thumb{width:112px;height:70px;object-fit:cover;border-radius:8px;background:#eee}.nb-main{min-width:0;flex:1}.nb-pos{font-size:11px;font-weight:900;color:#666}.nb-user{font-size:15px}.nb-user span,.nb-stat,.nb-tags{font-size:11px;color:#666}#nb-card h3{font-size:15px;margin:4px 0}.nb-ex{margin:6px 0;background:#f7f7f7;padding:7px;border-radius:8px;line-height:1.45;max-height:72px;overflow:auto;font-size:12px}.nb-rank{font-size:11px;font-weight:800}
      .nb-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:6px}.nb-actions.sub{grid-template-columns:repeat(4,1fr)}.nb-actions button,.nb-actions a{padding:8px 3px;border:1px solid #ddd;border-radius:8px;background:#fff;text-align:center;text-decoration:none;color:#111;font-weight:800;font-size:12px}.nb-actions .heart{background:#fff1f4}
      #nb-reactions{display:none;border:1px solid #ddd;border-radius:9px;padding:6px;margin-top:6px;max-height:160px;overflow:auto}.nb-reactrow{padding:6px;border-bottom:1px solid #eee;font-size:12px}.nb-reactrow span{color:#666}
      .nb-empty{text-align:center;padding:25px 8px;color:#666}.nb-empty.small{padding:10px}.nb-toast{display:none;position:sticky;bottom:2px;padding:8px;border-radius:8px;background:#222;color:#fff;font-weight:800;margin-top:5px;font-size:12px}.nb-toast.ok{background:#146c43}.nb-toast.bad{background:#a61b1b}
      @media(max-width:560px){#nb-panel{width:92vw;max-height:52vh}.nb-grid{grid-template-columns:1fr 1fr}.nb-toprow{grid-template-columns:1fr}.nb-thumb{width:96px;height:60px}.nb-actions.sub{grid-template-columns:1fr 1fr}}
    </style>
    <button id="nb-open">💗 巡回BOOST</button>
    <div id="nb-panel">
      <div class="nb-head"><b>巡回BOOST v${VERSION}</b><button id="nb-react">↩反応 <span id="nb-reaction-count">0</span></button><button id="nb-set">⚙</button><button id="nb-x">×</button></div>
      <div id="nb-accounts"></div>
      <div class="nb-toprow">
        <input id="nb-tags" placeholder="手入力タグ（任意）" value="${esc(form.tags||'')}">
        <select id="nb-women"><option value="off">🌷女性向け OFF</option><option value="prefer">🌷テーマ優先</option><option value="topic">🌷テーマのみ</option><option value="explicit">🌷明示のみ</option></select>
      </div>
      <div class="nb-drawerbtn"><button id="nb-tags-open">🏷 タグを選ぶ</button><button id="nb-tags-clear">選択クリア</button></div>
      <div id="nb-tag-summary">未選択</div>
      <div id="nb-tagdrawer"></div>
      <div class="nb-grid">
        <select id="nb-tagmode"><option value="OR">OR＝どれか1つ</option><option value="AND">AND＝全部一致</option></select>
        <select id="nb-mode"><option value="new">🆕新着</option><option value="popular">🏆人気</option><option value="rising">🔥急上昇</option><option value="discover">🎯発掘</option></select>
        <select id="nb-days"><option value="1">今日</option><option value="3">3日</option><option value="7">7日</option><option value="30">30日</option></select>
        <select id="nb-count"><option>20</option><option>50</option><option>100</option></select>
      </div>
      <button id="nb-run">🔎 巡回開始</button>
      <div id="nb-status">${esc(lastStatus)}</div><div id="nb-debug">${esc(lastDebug)}</div><div id="nb-meters"></div>
      <div class="nb-magrow"><select id="nb-mag"><option value="">📚 追加先マガジン</option></select><button id="nb-magrefresh">↻</button><span id="nb-magcount"></span></div>
      <div id="nb-card"></div>
      <div id="nb-reactions"></div>
      <div id="nb-toast" class="nb-toast"></div>
    </div>`;
    document.body.appendChild(host);

    const panel=$('#nb-panel',host),drawer=$('#nb-tagdrawer',host);
    renderTagDrawer();
    $('#nb-open',host).onclick=()=>panel.style.display=panel.style.display==='none'?'block':'none';
    $('#nb-x',host).onclick=()=>{saveForm();saveSession();panel.style.display='none';};
    $('#nb-set',host).onclick=openSettings;
    $('#nb-run',host).onclick=scan;
    $('#nb-magrefresh',host).onclick=refreshMagSelector;
    $('#nb-tags-open',host).onclick=()=>{drawer.style.display=drawer.style.display==='none'?'block':'none';};
    $('#nb-tags-clear',host).onclick=()=>{for(const x of $$('.nb-tagcheck',drawer))x.checked=false;selectedTags=[];saveForm();};
    $('#nb-react',host).onclick=()=>{reactionsOpen=!reactionsOpen;renderReactions();if(reactionsOpen)checkReactions();};

    $('#nb-days',host).value=String(form.days??settings.days);
    $('#nb-count',host).value=String(form.count??settings.count);
    $('#nb-mode',host).value=form.mode||settings.mode;
    $('#nb-tagmode',host).value=form.tagMode||settings.tagMode;
    $('#nb-women',host).value=form.womenMode||settings.womenMode;

    for(const el of $$('#nb-tags,#nb-days,#nb-count,#nb-mode,#nb-tagmode,#nb-women',host))el.addEventListener('change',saveForm);
    $('#nb-tags',host).addEventListener('input',saveForm);

    renderAccounts();updateTagSummary();updateMeters();refreshMagSelector();renderCurrent();renderReactions();
  }

  if(document.body)boot();else addEventListener('DOMContentLoaded',boot,{once:true});
})();
