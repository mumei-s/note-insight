// ==UserScript==
// @name         note 巡回BOOST｜タグ検索・スキ・マガジン v4.2
// @namespace    https://github.com/mumei-s/note-insight
// @version      4.2.0
// @description  複数タグ選択・初回記事厳密判定・女性自己表現フィルター・サムネイル・アカウント別安全カウンター・マガジン追加対応。
// @match        https://note.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
  'use strict';

  const VERSION = '4.2.0';
  const K = 'note巡回BOOST_v4';
  const DEFAULTS = {
    likeHour: 18, likeDay: 80,
    magHour: 20, magDay: 50,
    followGap: 20,
    days: 7, count: 50, mode: 'new', tagMode: 'OR', femaleMode: 'all',
    onePerCreator: true,
  };

  const TAG_CATEGORIES = {
    '🌱 note入門': ['はじめてのnote','note初心者','note'],
    '✍️ 日記・エッセイ': ['エッセイ','日記','日常','暮らし','雑記'],
    '📚 創作': ['小説','短編小説','詩','創作','イラスト','漫画'],
    '👪 家族・暮らし': ['子育て','育児','家族','料理','主婦','ママ'],
    '💄 美容・恋愛': ['美容','コスメ','ファッション','恋愛','結婚'],
    '🤖 AI・仕事': ['AI','生成AI','ChatGPT','仕事','働き方','副業'],
    '🎧 趣味・学び': ['読書','本','映画','音楽','ゲーム','旅行','写真','勉強','教育'],
  };

  const FIXED_NG = {
    'ギャンブル': [/ギャンブル/i,/競馬/i,/競輪/i,/競艇/i,/ボートレース/i,/オートレース/i,/パチンコ/i,/パチスロ/i,/オンラインカジノ/i,/カジノ/i,/ブックメーカー/i,/スポーツベット/i,/賭博/i,/馬券/i,/舟券/i],
    'アダルト': [/アダルト/i,/18禁/i,/成人向け/i,/ポルノ/i,/風俗/i,/性風俗/i,/AV女優/i,/AV男優/i,/セフレ/i,/援交/i,/パパ活/i,/出会い系/i,/エロ/i,/性行為/i,/性的サービス/i,/アダルトアフィリ/i],
    '投資': [/(?:^|[^A-Za-z])FX(?:[^A-Za-z]|$)/i,/外国為替/i,/仮想通貨/i,/暗号資産/i,/ビットコイン/i,/bitcoin/i,/投資/i,/株式/i,/株価/i,/銘柄/i,/NISA/i,/iDeCo/i,/資産運用/i,/高配当/i,/デイトレ/i,/トレード/i,/バイナリーオプション/i,/投資信託/i,/不動産投資/i],
  };

  const FEMALE_SIGNALS = [
    [/女性|女です|女子|女の子/g, 3], [/主婦|専業主婦|兼業主婦|妻です/g, 3],
    [/ママ|母です|母親|お母さん/g, 3], [/妊娠|出産|産休|育休/g, 2],
    [/旦那|夫と|彼氏|娘と/g, 1], [/コスメ|メイク|ネイル|美容/g, 1],
  ];

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pick = (o, ks, fb='') => { for (const k of ks) if (o && o[k] != null) return o[k]; return fb; };
  const boolPick = (o, ks) => { for (const k of ks) if (o && typeof o[k] === 'boolean') return o[k]; return null; };
  const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
  const parseMs = s => Date.parse(s || '') || 0;
  const load = (name, fb) => { try { return JSON.parse(localStorage.getItem(`${K}:${name}`)) ?? fb; } catch { return fb; } };
  const save = (name, v) => { try { localStorage.setItem(`${K}:${name}`, JSON.stringify(v)); } catch(e) { console.warn('[note巡回BOOST] save failed', name, e); } };
  const settings = Object.assign({}, DEFAULTS, load('settings', {}));

  let queue = [], index = 0, running = false, currentUser = null, magazines = [], accountKey = 'guest';
  let lastStatus = '待機中';
  let lastDebug = `固定NG：ギャンブル・アダルト・投資｜フォロー差 +${settings.followGap}以上は除外`;

  async function api(url, init={}) {
    const headers = Object.assign({accept:'application/json'}, init.headers || {});
    const r = await fetch(url, Object.assign({credentials:'include'}, init, {headers}));
    const text = await r.text();
    let json = null; try { json = text ? JSON.parse(text) : {}; } catch {}
    if (!r.ok) { const e = new Error(`${r.status} ${r.statusText}`); e.status=r.status; e.body=text.slice(0,300); throw e; }
    return json ?? {};
  }

  const userOf = n => n?.user || n?.creator || n?.note_user || {};
  const keyOf = n => pick(n,['key','note_key','noteKey','slug']);
  const titleOf = n => pick(n,['name','title']);
  const publishOf = n => pick(n,['publish_at','publishAt','published_at','publishedAt','created_at','createdAt']);
  const urlnameOf = n => pick(userOf(n),['urlname','url_name','username'],pick(n,['urlname']));
  const nicknameOf = n => pick(userOf(n),['nickname','name'],pick(n,['nickname'],urlnameOf(n)));
  const likesOf = n => num(pick(n,['like_count','likeCount','likes_count'],0)) ?? 0;
  const textOfHtml = html => {
    const d = new DOMParser().parseFromString(String(html || ''),'text/html');
    return (d.body?.textContent || '').replace(/\s+/g,' ').trim();
  };
  function imageOf(n) {
    const candidates = [
      n?.eyecatch, n?.eyecatch_image, n?.eyecatchImage, n?.eyecatch_url, n?.eyecatchUrl,
      n?.thumbnail, n?.thumbnail_url, n?.thumbnailUrl, n?.image_url, n?.imageUrl, n?.picture_url,
      n?.image?.url, n?.eyecatch?.url, n?.thumbnail?.url,
    ];
    const hit = candidates.find(v => typeof v === 'string' && /^https?:\/\//.test(v));
    return hit || '';
  }
  function collectTags(j) {
    const out=new Set(), seen=new Set();
    const walk=(x,d=0)=>{
      if(!x||typeof x!=='object'||seen.has(x)||d>7)return; seen.add(x);
      if(Array.isArray(x)) return x.forEach(v=>walk(v,d+1));
      for(const [k,v] of Object.entries(x)){
        if(/hashtag/i.test(k)){
          if(typeof v==='string') out.add(v.replace(/^#/,''));
          if(Array.isArray(v)) v.forEach(h=>{ const z=typeof h==='string'?h:(h?.name||h?.hashtag||h?.tag||h?.hashtag_name); if(z) out.add(String(z).replace(/^#/,'')); });
        }
        if(v&&typeof v==='object') walk(v,d+1);
      }
    }; walk(j); return [...out];
  }
  function normalizeSearch(j){
    const d=j?.data??j??{}, notes=d.notes||{}, arr=notes.contents||notes.notes||d.contents||[];
    return {arr:Array.isArray(arr)?arr:[],cursor:d?.cursor?.note??d.note_cursor??notes.next_cursor??notes.cursor??null,last:notes.is_last_page===true||notes.isLastPage===true};
  }
  const normalizeTags = raw => [...new Set(String(raw||'').split(/[\s,、]+/).map(x=>x.trim().replace(/^#+/,'')).filter(Boolean))];
  function ngReason(text){ for(const [label,regs] of Object.entries(FIXED_NG)) if(regs.some(r=>r.test(text))) return label; return ''; }
  function femaleScore(text){
    let score=0; const s=String(text||'');
    for(const [re,w] of FEMALE_SIGNALS){ re.lastIndex=0; const m=s.match(re); if(m) score += Math.min(3,m.length)*w; }
    return score;
  }
  const isFirstTag = tags => tags.some(t => /^(?:はじめて|初めて)のnote$/i.test(t));

  function acctName(name){ return `acct:${accountKey}:${name}`; }
  function globalHistory(name){
    const arr=load(name,[]), cutoff=Date.now()-48*3600e3;
    return arr.filter(x=>x&&x.t>=cutoff);
  }
  function history(name){
    const arr=load(acctName(name),[]), cutoff=Date.now()-48*3600e3;
    return arr.filter(x=>x&&x.t>=cutoff);
  }
  function addHistory(name,data={}){
    const arr=history(name); arr.push(Object.assign({t:Date.now()},data)); save(acctName(name),arr.slice(-500));
    const acts=load(acctName('actions'),[]); acts.push(Object.assign({t:Date.now(),type:name},data)); save(acctName('actions'),acts.slice(-800));
  }
  function usage(name,ms){ const now=Date.now(); return history(name).filter(x=>now-x.t<ms).length; }
  function remainingAt(name,ms,limit){
    const arr=history(name).filter(x=>Date.now()-x.t<ms).sort((a,b)=>a.t-b.t); if(arr.length<limit)return 0; return Math.max(0,arr[0].t+ms-Date.now());
  }
  function fmtWait(ms){ if(!ms)return ''; const m=Math.ceil(ms/60000); return m<60?`${m}分`:`${Math.floor(m/60)}時間${m%60}分`; }
  function canDo(kind){
    const isLike=kind==='like', h=isLike?settings.likeHour:settings.magHour, d=isLike?settings.likeDay:settings.magDay, n=isLike?'likes':'mags';
    const uh=usage(n,3600e3), ud=usage(n,86400e3);
    if(uh>=h)return{ok:false,why:`60分安全値 ${uh}/${h}`,wait:remainingAt(n,3600e3,h)};
    if(ud>=d)return{ok:false,why:`24時間安全値 ${ud}/${d}`,wait:remainingAt(n,86400e3,d)};
    return{ok:true,uh,ud,h,d};
  }

  async function getCurrentUser(){
    try{
      const j=await api('/api/v2/current_user'); currentUser=j?.data??j??null;
      accountKey=String(currentUser?.urlname||currentUser?.username||currentUser?.id||'guest');
      rememberAccount(); claimLegacyIfNeeded(); loadAccountSession(); return currentUser;
    }catch{ currentUser=null; accountKey='guest'; return null; }
  }
  function rememberAccount(){
    if(accountKey==='guest')return; const a=load('accounts',{}); a[accountKey]={name:currentUser?.nickname||currentUser?.name||accountKey,lastSeen:Date.now()}; save('accounts',a);
  }
  function claimLegacyIfNeeded(){
    if(accountKey==='guest')return;
    const owner=load('legacyOwner',''); if(owner) return;
    const oldLikes=globalHistory('likes'), oldMags=globalHistory('mags');
    if(!oldLikes.length&&!oldMags.length){ save('legacyOwner',accountKey); return; }
    save(acctName('likes'),oldLikes); save(acctName('mags'),oldMags);
    const oldSession=load('session',null), oldForm=load('form',null);
    if(oldSession&&!load(acctName('session'),null)) save(acctName('session'),oldSession);
    if(oldForm&&!load(acctName('form'),null)) save(acctName('form'),oldForm);
    save('legacyOwner',accountKey);
    lastStatus=`旧カウントと途中状態を @${accountKey} に引き継ぎました`;
  }
  function loadAccountSession(){
    const s=load(acctName('session'),null);
    if(s&&Array.isArray(s.queue)){ queue=s.queue; index=Math.max(0,Math.min(Number(s.index)||0,queue.length)); lastStatus=s.status||lastStatus; lastDebug=s.debug||lastDebug; }
    else { queue=[]; index=0; }
  }
  function saveSession(){
    if(accountKey==='guest')return;
    save(acctName('session'),{queue:queue.map(c=>{const {body,profile,...r}=c||{};return r;}),index,status:lastStatus,debug:lastDebug,savedAt:Date.now()});
  }
  function setStatus(s){ lastStatus=String(s||''); const el=$('#nb-status'); if(el)el.textContent=lastStatus; }
  function setDebug(s){ lastDebug=String(s||''); const el=$('#nb-debug'); if(el)el.textContent=lastDebug; }

  async function getMagazines(noteKey=''){
    try{
      const q=noteKey?`&note_key=${encodeURIComponent(noteKey)}`:'';
      const j=await api(`/api/v1/my/magazines?includes_editable=true${q}`);
      magazines=(j?.data?.magazines||[]).map(m=>({id:m.id,key:m.key,name:m.name||'',price:num(m.price)??0,noteCount:num(m.note_count)??0,selected:!!(m.is_added||m.isAdded)}));
    }catch{magazines=[];} return magazines;
  }

  async function rawSearch(tags,days,target){
    const cutoff=Date.now()-days*86400e3, maxRaw=Math.max(target*4,80), all=new Map();
    for(const tag of tags){
      let cursor='0',page=0,done=false;
      while(!done&&page<250&&all.size<maxRaw){
        page++; setStatus(`検索中 #${tag}｜${page}ページ｜候補${all.size}`);
        const s=normalizeSearch(await api(`/api/v3/searches?context=note&q=${encodeURIComponent(tag)}&size=20&start=${encodeURIComponent(cursor)}&sort=new`));
        if(!s.arr.length)break; let oldest=Infinity;
        for(const n of s.arr){
          const t=parseMs(publishOf(n)); if(t)oldest=Math.min(oldest,t); if(!t||t<cutoff)continue;
          const key=keyOf(n),urlname=urlnameOf(n); if(!key||!urlname)continue; const prev=all.get(key)||{};
          all.set(key,Object.assign(prev,{key,urlname,name:nicknameOf(n),title:titleOf(n),publish:publishOf(n),likes:likesOf(n),thumb:imageOf(n)||prev.thumb||'',matched:[...new Set([...(prev.matched||[]),tag])]}));
        }
        if(oldest<cutoff||s.last||s.cursor==null||String(s.cursor)===String(cursor))done=true; else cursor=String(s.cursor);
        await sleep(70);
      }
    } return [...all.values()];
  }

  async function verifyFirstNote(c){
    try{
      const j1=await api(`/api/v2/creators/${encodeURIComponent(c.urlname)}/contents?kind=note&page=1`);
      const d1=j1?.data??j1??{}, arr1=Array.isArray(d1.contents)?d1.contents:[], total=num(d1.totalCount)??arr1.length;
      if(total<=1) return true;
      const per=Math.max(1,arr1.length||10), lastPage=Math.max(1,Math.ceil(total/per));
      let arr=arr1;
      if(lastPage>1){ const jl=await api(`/api/v2/creators/${encodeURIComponent(c.urlname)}/contents?kind=note&page=${lastPage}`); const dl=jl?.data??jl??{}; arr=Array.isArray(dl.contents)?dl.contents:[]; }
      if(!arr.length)return null;
      const oldest=[...arr].sort((a,b)=>parseMs(publishOf(a))-parseMs(publishOf(b)))[0];
      return keyOf(oldest)===c.key;
    }catch{return null;}
  }

  async function inspect(c,tags,tagMode,needFirst){
    try{
      const [nj,cj]=await Promise.all([api(`/api/v3/notes/${encodeURIComponent(c.key)}`),api(`/api/v2/creators/${encodeURIComponent(c.urlname)}`)]);
      const d=nj?.data??nj??{}, n=d.note||d, cr=cj?.data??cj??{};
      c.id=pick(n,['id','note_id','noteId'],null); c.title=titleOf(n)||c.title; c.publish=publishOf(n)||c.publish; c.likes=likesOf(n)||c.likes; c.thumb=imageOf(n)||c.thumb||'';
      c.tags=collectTags(nj); c.body=pick(n,['body','free_body','freeBody','description','peekBody'],''); c.excerpt=textOfHtml(c.body).slice(0,420);
      c.liked=boolPick(n,['isLiked','is_liked','liked','hasLiked'])===true;
      c.followers=num(pick(cr,['followerCount','follower_count','followersCount','followers_count'],null)); c.following=num(pick(cr,['followingCount','following_count','followCount','follow_count'],null));
      c.profile=String(pick(cr,['profile','description','bio'],'')); c.followingAlready=boolPick(cr,['isFollowing','is_following','following'])===true;
      const hay=[c.title,c.excerpt,c.tags.join(' '),c.profile].join(' '); c.ng=ngReason(hay); c.female=femaleScore(hay); c.gap=c.following!=null&&c.followers!=null?c.following-c.followers:null;
      const lower=c.tags.map(x=>x.toLowerCase()), wanted=tags.map(x=>x.toLowerCase()), matched=(c.matched||[]).map(x=>x.toLowerCase());
      c.tagMatch=tagMode==='AND'?wanted.every(t=>lower.includes(t)||matched.includes(t)):true;
      c.needsFirst=(c.matched||[]).some(t=>/^(?:はじめて|初めて)のnote$/i.test(t));
      if(c.needsFirst)c.firstVerified=await verifyFirstNote(c); else c.firstVerified=null;
      const ageH=Math.max(.5,(Date.now()-parseMs(c.publish))/3600e3); c.velocity=c.likes/Math.max(1,ageH); c.discovery=c.likes/Math.max(20,c.followers??100); return c;
    }catch(e){c.error=String(e.message||e);return c;}
  }

  function filterAndSort(list,mode,target,femaleMode,needFirst){
    const black=new Set(load('blacklist',[])), seen=new Set(), skips={ng:0,gap:0,black:0,tag:0,self:0,dup:0,error:0,first:0,female:0};
    const me=currentUser?.urlname||currentUser?.username||'', out=[];
    for(const c of list){
      if(c.error){skips.error++;continue;} if(!c.tagMatch){skips.tag++;continue;} if(c.urlname===me){skips.self++;continue;} if(black.has(c.urlname)){skips.black++;continue;}
      if(c.ng){skips.ng++;continue;} if(c.gap!=null&&c.gap>=settings.followGap){skips.gap++;continue;} if(c.needsFirst&&c.firstVerified!==true){skips.first++;continue;} if(femaleMode==='female'&&c.female<2){skips.female++;continue;}
      if(settings.onePerCreator&&seen.has(c.urlname)){skips.dup++;continue;} seen.add(c.urlname); out.push(c);
    }
    const base={new:(a,b)=>parseMs(b.publish)-parseMs(a.publish),popular:(a,b)=>b.likes-a.likes,rising:(a,b)=>b.velocity-a.velocity||b.likes-a.likes,discover:(a,b)=>b.discovery-a.discovery||b.likes-a.likes}[mode]||(()=>0);
    out.sort((a,b)=>femaleMode==='prefer'?(b.female-a.female||base(a,b)):base(a,b)); return{items:out.slice(0,target),skips};
  }

  function selectedTags(){ return $$('.nb-tagcheck:checked').map(x=>x.value); }
  function formState(){
    return{manual:$('#nb-tags')?.value||'',selected:selectedTags(),days:Number($('#nb-days')?.value||settings.days),count:Number($('#nb-count')?.value||settings.count),mode:$('#nb-mode')?.value||settings.mode,tagMode:$('#nb-tagmode')?.value||settings.tagMode,femaleMode:$('#nb-female')?.value||settings.femaleMode};
  }
  function saveForm(){ const f=formState(); Object.assign(settings,{days:f.days,count:f.count,mode:f.mode,tagMode:f.tagMode,femaleMode:f.femaleMode}); save('settings',settings); if(accountKey!=='guest')save(acctName('form'),f); updateTagCount(); }
  function allFormTags(f){ return [...new Set([...normalizeTags(f.manual),...(f.selected||[])])]; }

  async function scan(){
    if(running)return; const f=formState(), tags=allFormTags(f); if(!tags.length)return toast('タグを1つ以上選んでね','bad'); saveForm();
    const prevQ=queue,prevI=index; running=true; renderCurrent();
    try{
      await getCurrentUser(); const needFirst=isFirstTag(tags), raw=await rawSearch(tags,f.days,f.count), inspected=[];
      for(let i=0;i<raw.length;i++){setStatus(`安全確認 ${i+1}/${raw.length}｜${raw[i].name}`);inspected.push(await inspect(raw[i],tags,f.tagMode,needFirst));if(i%5===0)setDebug(`検索${raw.length} / 確認${i+1}`);await sleep(70);}
      const z=filterAndSort(inspected,f.mode,f.count,f.femaleMode,needFirst); queue=z.items; index=0;
      setDebug(`表示${queue.length}｜NG${z.skips.ng}｜フォロー差${z.skips.gap}｜初回違い${z.skips.first}｜女性条件${z.skips.female}｜手動除外${z.skips.black}｜重複${z.skips.dup}`);
      setStatus(queue.length?`完了：${queue.length}件。1件ずつ確認できます。`:'完了：表示できる記事は0件。黄色欄に除外内訳を表示。'); saveSession();
    }catch(e){queue=prevQ;index=prevI;setStatus(`エラー：${e.message||e}｜前回結果は保持しました`);saveSession();}
    finally{running=false;await refreshMagSelector();renderCurrent();saveSession();}
  }

  async function like(c){
    const lim=canDo('like'); if(!lim.ok)return toast(`⛔ スキ停止：${lim.why}。再開目安 ${fmtWait(lim.wait)}`,'bad'); if(c.liked){toast('すでにスキ済み');return next();}
    try{await api(`/api/v3/notes/${encodeURIComponent(c.key)}/likes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:'{}'});c.liked=true;addHistory('likes',{key:c.key,urlname:c.urlname});saveSession();updateMeters();toast('❤️ スキしました','ok');setTimeout(next,220);}catch(e){toast([403,429].includes(e.status)?`⛔ note側で制限の可能性 (${e.status})`:`スキ失敗：${e.message||e}`,'bad');}
  }
  async function addMagazine(c){
    const lim=canDo('mag'); if(!lim.ok)return toast(`⛔ マガジン追加停止：${lim.why}。再開目安 ${fmtWait(lim.wait)}`,'bad'); const sel=$('#nb-mag'); if(!sel?.value)return toast('追加先マガジンを選んでね','bad'); const mag=magazines.find(m=>m.key===sel.value); if(!mag)return toast('マガジンを再読込してね','bad');
    if(mag.price>0&&currentUser?.urlname!==c.urlname)return toast('他人の記事は有料マガジンへ追加できません','bad');
    try{if(!c.id){const j=await api(`/api/v3/notes/${encodeURIComponent(c.key)}`);c.id=pick(j?.data??j,['id','note_id','noteId'],null);}await api(`/api/v1/our/magazines/${encodeURIComponent(mag.key)}/notes`,{method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:JSON.stringify({note_id:c.id,note_key:c.key})});addHistory('mags',{key:c.key,mag:mag.key,urlname:c.urlname});updateMeters();toast(`📚「${mag.name}」へ追加しました`,'ok');}catch(e){toast([403,429].includes(e.status)?`⛔ note側で制限の可能性 (${e.status})`:`追加失敗：${e.message||e}`,'bad');}
  }
  function next(){if(!queue.length)return;index=Math.min(queue.length,index+1);saveSession();renderCurrent();}
  function prev(){if(!queue.length)return;index=Math.max(0,index-1);saveSession();renderCurrent();}
  function block(c){const arr=new Set(load('blacklist',[]));arr.add(c.urlname);save('blacklist',[...arr]);queue=queue.filter(x=>x.urlname!==c.urlname);if(index>queue.length)index=queue.length;setStatus(`🚫 @${c.urlname} を今後すべての検索から除外`);saveSession();toast(`🚫 @${c.urlname} を除外しました`,'ok');renderCurrent();}

  async function refreshMagSelector(){
    const sel=$('#nb-mag'); if(!sel)return; const keep=sel.value||load(acctName('defaultMag'),''); sel.innerHTML='<option value="">📚 マガジン選択</option>'; await getMagazines(queue[index]?.key||'');
    for(const m of magazines){const o=document.createElement('option');o.value=m.key;o.textContent=`${m.price>0?'💴':'📚'} ${m.name} (${m.noteCount})`;sel.appendChild(o);} if(magazines.some(m=>m.key===keep))sel.value=keep; sel.onchange=()=>save(acctName('defaultMag'),sel.value);
  }
  function updateMeters(){
    const el=$('#nb-meters');if(!el)return;const lh=usage('likes',3600e3),ld=usage('likes',86400e3),mh=usage('mags',3600e3),md=usage('mags',86400e3);const name=currentUser?.nickname||currentUser?.name||accountKey;
    el.innerHTML=`<b>@${esc(accountKey)}</b> ${esc(name)}<br>❤️ ${lh}/${settings.likeHour}h・${ld}/${settings.likeDay}日　📚 ${mh}/${settings.magHour}h・${md}/${settings.magDay}日`;
  }
  function updateTagCount(){const b=$('#nb-tagbtn');if(b)b.textContent=`🏷 タグを選ぶ (${selectedTags().length})`;}
  function fmtTime(s){const t=parseMs(s);if(!t)return '';const d=Date.now()-t,m=Math.max(0,Math.floor(d/60000));if(m<60)return `${m}分前`;const h=Math.floor(m/60);if(h<24)return `${h}時間前`;return `${Math.floor(h/24)}日前`;}

  function renderCurrent(){
    const box=$('#nb-card');if(!box)return;updateMeters();if(running)return box.innerHTML='<div class="nb-empty">検索・安全確認中…<br><small>閉じても前回結果は消えません</small></div>';if(!queue.length)return box.innerHTML=`<div class="nb-empty">${esc(lastStatus.includes('0件')?lastStatus:'タグを選んで「巡回開始」')}</div>`;
    if(index>=queue.length){box.innerHTML=`<div class="nb-empty"><b>✅ 今回の巡回は終了</b><br>${queue.length}件確認<br><button id="nb-again">先頭へ</button></div>`;$('#nb-again').onclick=()=>{index=0;saveSession();renderCurrent();};return;}
    const c=queue[index],url=`https://note.com/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`,gap=c.gap==null?'?':(c.gap>=0?`+${c.gap}`:`${c.gap}`),mode=$('#nb-mode')?.value||settings.mode;
    box.innerHTML=`
      ${c.thumb?`<img class="nb-thumb" src="${esc(c.thumb)}" referrerpolicy="no-referrer">`:''}
      <div class="nb-pos">${index+1}/${queue.length}　${esc(fmtTime(c.publish))}${c.firstVerified===true?'　🌱初投稿確認':''}${c.female>=2?'　♀文章シグナル':''}</div>
      <div class="nb-user"><b>${esc(c.name)}</b> <span>@${esc(c.urlname)}</span></div>
      <div class="nb-stat">フォロー ${c.following??'?'} / フォロワー ${c.followers??'?'} / 差 ${gap}　❤️${c.likes}</div>
      <h3>${esc(c.title)}</h3><div class="nb-tags">${(c.tags||[]).slice(0,8).map(t=>`#${esc(t)}`).join(' ')}</div>
      <div class="nb-ex">${esc(c.excerpt||'本文プレビューなし')}</div>
      <div class="nb-rank">${mode==='rising'?`🔥 ${Number(c.velocity||0).toFixed(2)}スキ/時`:mode==='discover'?`🎯 発掘 ${Number(c.discovery||0).toFixed(2)}`:''}</div>
      <div class="nb-actions"><button id="nb-like" class="heart">${c.liked?'❤️ スキ済み':'♡ スキ'}</button><button id="nb-skip">⏭ 次へ</button><button id="nb-magadd">📚 追加</button></div>
      <div class="nb-actions sub"><a href="${url}" target="_blank">📖記事</a><a href="https://note.com/${encodeURIComponent(c.urlname)}" target="_blank">👤プロフィール</a><button id="nb-block">🚫除外</button><button id="nb-prev">←戻る</button></div>`;
    $('#nb-like').onclick=()=>like(c);$('#nb-skip').onclick=next;$('#nb-magadd').onclick=()=>addMagazine(c);$('#nb-block').onclick=()=>block(c);$('#nb-prev').onclick=prev;
  }
  function toast(msg,kind=''){const t=$('#nb-toast');if(!t)return alert(msg);t.textContent=msg;t.className=`nb-toast ${kind}`;t.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(()=>t.style.display='none',3000);}
  function openSettings(){
    const h=prompt('スキ安全値：60分,24時間',`${settings.likeHour},${settings.likeDay}`);if(h){const[a,b]=h.split(',').map(Number);if(a>0&&b>0){settings.likeHour=a;settings.likeDay=b;}}
    const m=prompt('マガジン追加の安全値：60分,24時間',`${settings.magHour},${settings.magDay}`);if(m){const[a,b]=m.split(',').map(Number);if(a>0&&b>0){settings.magHour=a;settings.magDay=b;}}
    const g=prompt('除外する「フォロー数−フォロワー数」の差',String(settings.followGap));if(g&&Number(g)>=0)settings.followGap=Number(g);save('settings',settings);updateMeters();toast('設定保存','ok');
  }

  function makeTagDrawer(form){
    return Object.entries(TAG_CATEGORIES).map(([cat,tags])=>`<div class="nb-tagcat"><b>${esc(cat)}</b><div>${tags.map(t=>`<label><input class="nb-tagcheck" type="checkbox" value="${esc(t)}" ${(form.selected||[]).includes(t)?'checked':''}>#${esc(t)}</label>`).join('')}</div></div>`).join('');
  }
  async function switchDetectedAccount(){
    const before=accountKey;await getCurrentUser();if(before!==accountKey){restoreForm();await refreshMagSelector();renderCurrent();toast(`@${accountKey} に切替`,'ok');}else toast(`現在 @${accountKey}`,'ok');updateMeters();
  }
  function restoreForm(){
    const f=load(acctName('form'),{});if($('#nb-tags'))$('#nb-tags').value=f.manual||'';if($('#nb-days'))$('#nb-days').value=String(f.days??settings.days);if($('#nb-count'))$('#nb-count').value=String(f.count??settings.count);if($('#nb-mode'))$('#nb-mode').value=f.mode||settings.mode;if($('#nb-tagmode'))$('#nb-tagmode').value=f.tagMode||settings.tagMode;if($('#nb-female'))$('#nb-female').value=f.femaleMode||settings.femaleMode;
    $$('.nb-tagcheck').forEach(x=>x.checked=(f.selected||[]).includes(x.value));updateTagCount();
  }

  function makeUI(){
    if($('#note巡回boost-v4'))return;const host=document.createElement('div');host.id='note巡回boost-v4';const form={selected:[]};
    host.innerHTML=`<style>
      #note巡回boost-v4{position:fixed;right:8px;bottom:9px;z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;color:#151515}
      #nb-open{border:0;border-radius:999px;padding:10px 13px;background:#111;color:#fff;font-weight:900;box-shadow:0 4px 16px #0004}
      #nb-panel{display:none;width:min(92vw,430px);max-height:58vh;overflow:auto;background:#fff;border-radius:15px;box-shadow:0 10px 34px #0006;padding:9px}
      .nb-head{display:flex;gap:5px;align-items:center;position:sticky;top:-9px;background:#fff;padding:6px 0;z-index:3}.nb-head b{flex:1;font-size:13px}.nb-head button{padding:6px 7px}
      .nb-tools{display:grid;grid-template-columns:1fr 1fr;gap:5px}.nb-tools input,.nb-tools select,.nb-tools button{min-width:0;padding:7px;border:1px solid #ccc;border-radius:8px;background:#fff;font-size:12px}.nb-wide{grid-column:1/-1}
      #nb-tagdrawer{display:none;border:1px solid #ddd;border-radius:9px;padding:7px;margin:5px 0;max-height:220px;overflow:auto;background:#fafafa}.nb-tagcat{padding:5px 0;border-bottom:1px solid #eee}.nb-tagcat:last-child{border:0}.nb-tagcat b{font-size:12px}.nb-tagcat div{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.nb-tagcat label{font-size:11px;background:#fff;border:1px solid #ddd;border-radius:999px;padding:4px 6px;white-space:nowrap}
      #nb-run{width:100%;margin:6px 0;padding:9px;border:0;border-radius:9px;background:#111;color:#fff;font-weight:900}
      #nb-status,#nb-debug,#nb-meters{font-size:11px;padding:6px 7px;border-radius:7px;margin:4px 0}#nb-status{background:#f2f2f2}#nb-debug{background:#fff5cf}#nb-meters{background:#eef8f0}
      .nb-magrow{display:flex;gap:5px;margin:5px 0}.nb-magrow select{flex:1;min-width:0;padding:7px;border-radius:8px;font-size:12px}.nb-magrow button{padding:6px}
      #nb-card{border:1px solid #ddd;border-radius:11px;padding:8px;margin-top:5px;min-height:150px}.nb-thumb{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;margin-bottom:6px}.nb-pos{font-size:10px;font-weight:800;color:#666}.nb-user{font-size:15px}.nb-user span,.nb-stat,.nb-tags{font-size:10px;color:#666}#nb-card h3{font-size:14px;margin:6px 0}.nb-ex{margin:6px 0;background:#f7f7f7;padding:7px;border-radius:7px;line-height:1.45;max-height:92px;overflow:auto;font-size:11px}.nb-rank{font-size:10px;font-weight:800}
      .nb-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:5px}.nb-actions.sub{grid-template-columns:repeat(4,1fr)}.nb-actions button,.nb-actions a{padding:7px 3px;border:1px solid #ddd;border-radius:7px;background:#fff;text-align:center;text-decoration:none;color:#111;font-weight:800;font-size:10px}.nb-actions .heart{background:#fff1f4}
      .nb-empty{text-align:center;padding:25px 8px;color:#666}.nb-toast{display:none;position:sticky;bottom:2px;padding:8px;border-radius:7px;background:#222;color:#fff;font-weight:800;margin-top:5px;font-size:11px}.nb-toast.ok{background:#146c43}.nb-toast.bad{background:#a61b1b}
    </style>
    <button id="nb-open">💗 巡回BOOST</button>
    <div id="nb-panel"><div class="nb-head"><b>巡回BOOST v${VERSION}</b><button id="nb-account">👤</button><button id="nb-set">⚙</button><button id="nb-x">×</button></div>
      <div class="nb-tools">
        <button id="nb-tagbtn" class="nb-wide">🏷 タグを選ぶ (0)</button><input id="nb-tags" class="nb-wide" placeholder="自由タグも追加可：#写真 #旅行">
        <select id="nb-tagmode"><option value="OR">どれか一致（OR）</option><option value="AND">全部一致（AND）</option></select>
        <select id="nb-female"><option value="all">女性条件なし</option><option value="prefer">女性文章を優先</option><option value="female">女性文章のみ</option></select>
        <select id="nb-mode"><option value="new">🆕新着</option><option value="popular">🏆人気</option><option value="rising">🔥急上昇</option><option value="discover">🎯発掘</option></select>
        <select id="nb-days"><option value="1">今日</option><option value="3">3日</option><option value="7">7日</option><option value="30">30日</option></select>
        <select id="nb-count"><option>20</option><option>50</option><option>100</option></select>
      </div>
      <div id="nb-tagdrawer">${makeTagDrawer(form)}</div><button id="nb-run">🔎 巡回開始</button>
      <div id="nb-status">${esc(lastStatus)}</div><div id="nb-debug">${esc(lastDebug)}</div><div id="nb-meters"></div>
      <div class="nb-magrow"><select id="nb-mag"><option value="">📚 マガジン選択</option></select><button id="nb-magrefresh">↻</button></div>
      <div id="nb-card"></div><div id="nb-toast" class="nb-toast"></div>
    </div>`;
    document.body.appendChild(host);const panel=$('#nb-panel',host),drawer=$('#nb-tagdrawer',host);
    $('#nb-open',host).onclick=()=>panel.style.display=panel.style.display==='none'?'block':'none';$('#nb-x',host).onclick=()=>{saveForm();saveSession();panel.style.display='none';};$('#nb-set',host).onclick=openSettings;$('#nb-account',host).onclick=switchDetectedAccount;
    $('#nb-tagbtn',host).onclick=()=>drawer.style.display=drawer.style.display==='none'?'block':'none';$('#nb-run',host).onclick=scan;$('#nb-magrefresh',host).onclick=refreshMagSelector;
    for(const el of $$('#nb-tags,#nb-days,#nb-count,#nb-mode,#nb-tagmode,#nb-female,.nb-tagcheck',host))el.addEventListener('change',saveForm);$('#nb-tags',host).addEventListener('input',saveForm);
    updateTagCount();renderCurrent();
  }

  async function init(){ if(document.body)makeUI();else await new Promise(r=>addEventListener('DOMContentLoaded',r,{once:true})); if(!$('#note巡回boost-v4'))makeUI(); await getCurrentUser(); restoreForm(); updateMeters(); await refreshMagSelector(); renderCurrent(); }
  init();
})();
