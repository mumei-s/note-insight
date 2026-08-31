// ==UserScript==
// @name         note 巡回BOOST｜タグ検索・スキ・マガジン v4.0
// @namespace    https://github.com/mumei-s/note-insight
// @version      4.0.0
// @description  ハッシュタグから記事を抽出し、安全フィルターを通した記事を1件ずつ確認してスキ・保存・マガジン追加できる巡回ツール。新着/人気/急上昇/発掘、履歴・安全カウンター付き。
// @match        https://note.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
  'use strict';

  const VERSION = '4.0.0';
  const K = 'note巡回BOOST_v4';
  const DEFAULTS = {
    likeHour: 18,
    likeDay: 80,
    magHour: 20,
    magDay: 50,
    followGap: 20,
    days: 7,
    count: 50,
    mode: 'new',
    tagMode: 'OR',
    excludeFollowing: false,
    onePerCreator: true,
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

  const $ = (s, r=document) => r.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pick = (o, ks, fb='') => { for (const k of ks) if (o && o[k] != null) return o[k]; return fb; };
  const boolPick = (o, ks) => { for (const k of ks) if (o && typeof o[k] === 'boolean') return o[k]; return null; };
  const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
  const parseMs = s => Date.parse(s || '') || 0;
  const load = (name, fb) => { try { return JSON.parse(localStorage.getItem(`${K}:${name}`)) ?? fb; } catch { return fb; } };
  const save = (name, v) => localStorage.setItem(`${K}:${name}`, JSON.stringify(v));
  const settings = Object.assign({}, DEFAULTS, load('settings', {}));
  let queue = [], index = 0, running = false, currentUser = null, magazines = [];

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

  function history(name) {
    const arr = load(name, []);
    const cutoff = Date.now() - 48*3600e3;
    return arr.filter(x => x && x.t >= cutoff);
  }
  function addHistory(name, data={}) {
    const arr = history(name); arr.push(Object.assign({t:Date.now()}, data)); save(name, arr.slice(-500));
  }
  function usage(name, ms) {
    const now = Date.now(); return history(name).filter(x => now - x.t < ms).length;
  }
  function remainingAt(name, ms, limit) {
    const arr = history(name).filter(x => Date.now()-x.t < ms).sort((a,b)=>a.t-b.t);
    if (arr.length < limit) return 0;
    return Math.max(0, arr[0].t + ms - Date.now());
  }
  function fmtWait(ms) {
    if (!ms) return '';
    const m = Math.ceil(ms/60000); return m < 60 ? `${m}分` : `${Math.floor(m/60)}時間${m%60}分`;
  }
  function canDo(kind) {
    const isLike = kind === 'like';
    const h = isLike ? settings.likeHour : settings.magHour;
    const d = isLike ? settings.likeDay : settings.magDay;
    const n = isLike ? 'likes' : 'mags';
    const uh = usage(n, 3600e3), ud = usage(n, 86400e3);
    if (uh >= h) return {ok:false, why:`60分安全値 ${uh}/${h}`, wait:remainingAt(n,3600e3,h)};
    if (ud >= d) return {ok:false, why:`24時間安全値 ${ud}/${d}`, wait:remainingAt(n,86400e3,d)};
    return {ok:true, uh, ud, h, d};
  }

  async function getCurrentUser() {
    try {
      const j = await api('/api/v2/current_user');
      currentUser = j?.data ?? j ?? null;
      return currentUser;
    } catch { currentUser = null; return null; }
  }

  async function getMagazines(noteKey='') {
    try {
      const q = noteKey ? `&note_key=${encodeURIComponent(noteKey)}` : '';
      const j = await api(`/api/v1/my/magazines?includes_editable=true${q}`);
      magazines = (j?.data?.magazines || []).map(m => ({
        id:m.id, key:m.key, name:m.name || '', price:num(m.price) ?? 0,
        noteCount:num(m.note_count) ?? 0, status:m.status || '',
        selected: !!(m.is_added || m.isAdded)
      }));
    } catch { magazines = []; }
    return magazines;
  }

  async function rawSearch(tags, days, target, status) {
    const cutoff = Date.now() - days*86400e3;
    const maxRaw = Math.max(target*4, 80), all = new Map();
    for (const tag of tags) {
      let cursor='0', page=0, done=false;
      while (!done && page < 250 && all.size < maxRaw) {
        page++;
        status(`検索中 #${tag}｜${page}ページ｜候補${all.size}`);
        const j = await api(`/api/v3/searches?context=note&q=${encodeURIComponent(tag)}&size=20&start=${encodeURIComponent(cursor)}&sort=new`);
        const s = normalizeSearch(j); if (!s.arr.length) break;
        let oldest = Infinity;
        for (const n of s.arr) {
          const t = parseMs(publishOf(n)); if (t) oldest = Math.min(oldest,t);
          if (t && t < cutoff) continue;
          const key=keyOf(n), urlname=urlnameOf(n); if (!key || !urlname) continue;
          const prev = all.get(key) || {};
          all.set(key, Object.assign(prev, {
            key, urlname, name:nicknameOf(n), title:titleOf(n), publish:publishOf(n), likes:likesOf(n),
            matched:[...new Set([...(prev.matched||[]), tag])]
          }));
        }
        if (oldest < cutoff || s.last || s.cursor == null || String(s.cursor)===String(cursor)) done=true;
        else cursor=String(s.cursor);
        await sleep(70);
      }
    }
    return [...all.values()];
  }

  async function inspect(c, tags, tagMode) {
    try {
      const [nj, cj] = await Promise.all([
        api(`/api/v3/notes/${encodeURIComponent(c.key)}`),
        api(`/api/v2/creators/${encodeURIComponent(c.urlname)}`)
      ]);
      const d = nj?.data ?? nj ?? {}, n=d.note || d, cr=cj?.data ?? cj ?? {};
      c.id = pick(n,['id','note_id','noteId'],null);
      c.title = titleOf(n) || c.title; c.publish=publishOf(n)||c.publish; c.likes=likesOf(n)||c.likes;
      c.tags = collectTags(nj);
      c.body = pick(n,['body','free_body','freeBody','description','peekBody'],'');
      c.excerpt = textOfHtml(c.body).slice(0,520);
      c.liked = boolPick(n,['isLiked','is_liked','liked','hasLiked']) === true;
      c.followers = num(pick(cr,['followerCount','follower_count','followersCount','followers_count'],null));
      c.following = num(pick(cr,['followingCount','following_count','followCount','follow_count'],null));
      c.profile = String(pick(cr,['profile','description','bio'],''));
      c.followingAlready = boolPick(cr,['isFollowing','is_following','following']) === true;
      const hay = [c.title,c.excerpt,c.tags.join(' '),c.profile].join(' ');
      c.ng = ngReason(hay);
      c.gap = c.following != null && c.followers != null ? c.following - c.followers : null;
      const lowerTags = c.tags.map(x=>x.toLowerCase());
      const wanted = tags.map(x=>x.toLowerCase());
      c.tagMatch = tagMode === 'AND' ? wanted.every(t=>lowerTags.includes(t) || (c.matched||[]).map(x=>x.toLowerCase()).includes(t)) : true;
      const ageH = Math.max(0.5,(Date.now()-parseMs(c.publish))/3600e3);
      c.velocity = c.likes / Math.max(1, ageH);
      c.discovery = c.likes / Math.max(20, c.followers ?? 100);
      return c;
    } catch (e) { c.error=String(e.message||e); return c; }
  }

  function filterAndSort(list, mode, target) {
    const black = new Set(load('blacklist',[]));
    const seen = new Set(), skips = {ng:0,gap:0,black:0,tag:0,self:0,followed:0,dup:0,error:0};
    const me = currentUser?.urlname || currentUser?.username || '';
    const out = [];
    for (const c of list) {
      if (c.error) { skips.error++; continue; }
      if (!c.tagMatch) { skips.tag++; continue; }
      if (c.urlname === me) { skips.self++; continue; }
      if (black.has(c.urlname)) { skips.black++; continue; }
      if (c.ng) { skips.ng++; continue; }
      if (c.gap != null && c.gap >= settings.followGap) { skips.gap++; continue; }
      if (settings.excludeFollowing && c.followingAlready) { skips.followed++; continue; }
      if (settings.onePerCreator && seen.has(c.urlname)) { skips.dup++; continue; }
      seen.add(c.urlname); out.push(c);
    }
    const by = {
      new:(a,b)=>parseMs(b.publish)-parseMs(a.publish),
      popular:(a,b)=>b.likes-a.likes,
      rising:(a,b)=>b.velocity-a.velocity || b.likes-a.likes,
      discover:(a,b)=>b.discovery-a.discovery || b.likes-a.likes
    }[mode] || ((a,b)=>0);
    out.sort(by);
    return {items:out.slice(0,target), skips};
  }

  async function scan(status, debug) {
    if (running) return;
    running=true; queue=[]; index=0; renderCurrent();
    try {
      const tags=normalizeTags($('#nb-tags')?.value); if (!tags.length) throw new Error('#タグを入力してね');
      const days=Number($('#nb-days').value), target=Number($('#nb-count').value), mode=$('#nb-mode').value, tagMode=$('#nb-tagmode').value;
      Object.assign(settings,{days,count:target,mode,tagMode}); save('settings',settings);
      await getCurrentUser();
      const raw = await rawSearch(tags,days,target,status);
      const inspected=[];
      for (let i=0;i<raw.length;i++) {
        status(`安全確認 ${i+1}/${raw.length}｜${raw[i].name}`);
        inspected.push(await inspect(raw[i],tags,tagMode));
        if (i%5===0) debug(`検索${raw.length} / 確認${i+1}`);
        await sleep(70);
      }
      const f=filterAndSort(inspected,mode,target); queue=f.items;
      debug(`表示${queue.length}｜NG${f.skips.ng}｜フォロー差${f.skips.gap}｜手動除外${f.skips.black}｜重複${f.skips.dup}`);
      status(`完了：${queue.length}件。1件ずつ確認して操作できます。`);
      index=0; await refreshMagSelector(); renderCurrent();
    } catch(e) { status(`エラー：${e.message||e}`); }
    finally { running=false; }
  }

  async function like(c) {
    const lim=canDo('like');
    if (!lim.ok) return toast(`⛔ スキ停止：${lim.why}。再開目安 ${fmtWait(lim.wait)}`,'bad');
    if (c.liked) { toast('すでにスキ済み'); return next(); }
    try {
      await api(`/api/v3/notes/${encodeURIComponent(c.key)}/likes`,{
        method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},body:'{}'
      });
      c.liked=true; addHistory('likes',{key:c.key,urlname:c.urlname}); addHistory('actions',{type:'like',key:c.key,urlname:c.urlname});
      updateMeters(); toast('❤️ スキしました','ok'); setTimeout(next,250);
    } catch(e) {
      if ([403,429].includes(e.status)) toast(`⛔ note側で制限の可能性。自動停止しました (${e.status})`,'bad');
      else toast(`スキ失敗：${e.message||e}`,'bad');
    }
  }

  async function addMagazine(c) {
    const lim=canDo('mag');
    if (!lim.ok) return toast(`⛔ マガジン追加停止：${lim.why}。再開目安 ${fmtWait(lim.wait)}`,'bad');
    const sel=$('#nb-mag'); if (!sel?.value) return toast('先に追加先マガジンを選んでね','bad');
    const mag=magazines.find(m=>m.key===sel.value); if (!mag) return toast('マガジンを再読込してね','bad');
    if (mag.price > 0 && currentUser?.urlname !== c.urlname) return toast('他人の記事は有料マガジンへ追加できません','bad');
    try {
      if (!c.id) {
        const j=await api(`/api/v3/notes/${encodeURIComponent(c.key)}`); c.id=pick(j?.data??j,['id','note_id','noteId'],null);
      }
      await api(`/api/v1/our/magazines/${encodeURIComponent(mag.key)}/notes`,{
        method:'POST',headers:{'content-type':'application/json','x-requested-with':'XMLHttpRequest'},
        body:JSON.stringify({note_id:c.id,note_key:c.key})
      });
      const j=await api(`/api/v3/notes/${encodeURIComponent(c.key)}`);
      const belongs=(j?.data?.belonging_magazine_keys || j?.belonging_magazine_keys || []);
      if (!belongs.includes(mag.key)) throw new Error('追加後の所属確認ができませんでした');
      addHistory('mags',{key:c.key,mag:mag.key,urlname:c.urlname}); addHistory('actions',{type:'mag',key:c.key,mag:mag.key,urlname:c.urlname});
      updateMeters(); toast(`📚「${mag.name}」へ追加しました`,'ok');
    } catch(e) {
      if ([403,429].includes(e.status)) toast(`⛔ note側で制限の可能性。マガジン追加を停止 (${e.status})`,'bad');
      else if (String(e.body||'').includes('already')) toast('すでに追加済みです');
      else toast(`追加失敗：${e.message||e}`,'bad');
    }
  }

  function next(){ if (!queue.length) return; index=Math.min(queue.length,index+1); renderCurrent(); }
  function prev(){ if (!queue.length) return; index=Math.max(0,index-1); renderCurrent(); }
  function block(c){
    const arr=new Set(load('blacklist',[])); arr.add(c.urlname); save('blacklist',[...arr]);
    addHistory('actions',{type:'block',urlname:c.urlname}); toast(`🚫 @${c.urlname} を今後除外`); next();
  }
  function favorite(c){ const a=new Set(load('favorites',[])); a.add(c.urlname); save('favorites',[...a]); toast('⭐ 保存しました','ok'); }

  async function refreshMagSelector() {
    const sel=$('#nb-mag'); if (!sel) return;
    const keep=sel.value || load('defaultMag','');
    sel.innerHTML='<option value="">マガジン選択</option>';
    await getMagazines(queue[index]?.key || '');
    for (const m of magazines) {
      const o=document.createElement('option'); o.value=m.key; o.textContent=`${m.price>0?'💴':'📚'} ${m.name} (${m.noteCount})`; sel.appendChild(o);
    }
    if (magazines.some(m=>m.key===keep)) sel.value=keep;
    sel.onchange=()=>save('defaultMag',sel.value);
  }

  function updateMeters() {
    const el=$('#nb-meters'); if (!el) return;
    const lh=usage('likes',3600e3), ld=usage('likes',86400e3), mh=usage('mags',3600e3), md=usage('mags',86400e3);
    el.innerHTML=`❤️ ${lh}/${settings.likeHour}h・${ld}/${settings.likeDay}日　📚 ${mh}/${settings.magHour}h・${md}/${settings.magDay}日`;
  }

  function renderCurrent() {
    const box=$('#nb-card'); if (!box) return;
    updateMeters();
    if (running) return box.innerHTML='<div class="nb-empty">検索・安全確認中…</div>';
    if (!queue.length) return box.innerHTML='<div class="nb-empty">#タグを入れて「巡回開始」</div>';
    if (index >= queue.length) return box.innerHTML=`<div class="nb-empty"><b>✅ 今回の巡回は終了</b><br>${queue.length}件確認しました。<br><button id="nb-again">先頭へ戻る</button></div>`;
    const c=queue[index], url=`https://note.com/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`;
    const gap=c.gap==null?'?':(c.gap>=0?`+${c.gap}`:`${c.gap}`);
    box.innerHTML=`
      <div class="nb-pos">${index+1}/${queue.length}</div>
      <div class="nb-user"><b>${esc(c.name)}</b> <span>@${esc(c.urlname)}</span></div>
      <div class="nb-stat">フォロー ${c.following??'?'} / フォロワー ${c.followers??'?'} / 差 ${gap}　❤️${c.likes}</div>
      <h3>${esc(c.title)}</h3>
      <div class="nb-tags">${(c.tags||[]).slice(0,10).map(t=>`#${esc(t)}`).join(' ')}</div>
      <div class="nb-ex">${esc(c.excerpt || '本文プレビューを取得できませんでした')}</div>
      <div class="nb-rank">${$('#nb-mode')?.value==='rising'?`🔥 急上昇 ${c.velocity.toFixed(2)}スキ/時`:$('#nb-mode')?.value==='discover'?`🎯 発掘スコア ${c.discovery.toFixed(2)}`:''}</div>
      <div class="nb-actions">
        <button id="nb-like" class="heart">${c.liked?'❤️ スキ済み':'♡ スキ'}</button>
        <button id="nb-skip">⏭ 次へ</button>
        <button id="nb-magadd">📚 追加</button>
        <button id="nb-fav">⭐保存</button>
      </div>
      <div class="nb-actions sub">
        <a href="${url}" target="_blank">📖 記事を開く</a>
        <a href="https://note.com/${encodeURIComponent(c.urlname)}" target="_blank">👤プロフィール</a>
        <button id="nb-block">🚫今後除外</button>
        <button id="nb-prev">←戻る</button>
      </div>`;
    $('#nb-like').onclick=()=>like(c); $('#nb-skip').onclick=next; $('#nb-magadd').onclick=()=>addMagazine(c);
    $('#nb-fav').onclick=()=>favorite(c); $('#nb-block').onclick=()=>block(c); $('#nb-prev').onclick=prev;
    $('#nb-again')?.addEventListener('click',()=>{index=0;renderCurrent();});
  }

  function toast(msg, kind='') {
    const t=$('#nb-toast'); if (!t) return alert(msg);
    t.textContent=msg; t.className=`nb-toast ${kind}`; t.style.display='block'; clearTimeout(toast._t); toast._t=setTimeout(()=>t.style.display='none',3200);
  }

  function openSettings() {
    const h=prompt('スキ安全値：60分,24時間',`${settings.likeHour},${settings.likeDay}`);
    if (h) { const [a,b]=h.split(',').map(Number); if (a>0&&b>0){settings.likeHour=a;settings.likeDay=b;} }
    const m=prompt('マガジン追加の安全値：60分,24時間（note公式の数値上限ではなく、このツールの安全値）',`${settings.magHour},${settings.magDay}`);
    if (m) { const [a,b]=m.split(',').map(Number); if (a>0&&b>0){settings.magHour=a;settings.magDay=b;} }
    const g=prompt('自動スキップする「フォロー数−フォロワー数」の差',String(settings.followGap));
    if (g && Number(g)>=0) settings.followGap=Number(g);
    save('settings',settings); updateMeters(); toast('設定を保存しました','ok');
  }

  function makeUI() {
    if ($('#note巡回boost-v4')) return;
    const host=document.createElement('div'); host.id='note巡回boost-v4';
    host.innerHTML=`<style>
      #note巡回boost-v4{position:fixed;right:8px;bottom:10px;z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;color:#151515}
      #nb-open{border:0;border-radius:999px;padding:12px 15px;background:#111;color:#fff;font-weight:900;box-shadow:0 4px 16px #0004}
      #nb-panel{display:none;width:min(96vw,760px);max-height:88vh;overflow:auto;background:#fff;border-radius:16px;box-shadow:0 10px 34px #0006;padding:12px}
      .nb-head{display:flex;gap:7px;align-items:center;position:sticky;top:-12px;background:#fff;padding:8px 0;z-index:3}.nb-head b{flex:1}.nb-head button{padding:7px 9px}
      .nb-grid{display:grid;grid-template-columns:1fr 100px 118px 90px;gap:6px}.nb-grid input,.nb-grid select{min-width:0;padding:9px;border:1px solid #ccc;border-radius:9px;background:#fff}
      #nb-run{width:100%;margin:8px 0;padding:11px;border:0;border-radius:10px;background:#111;color:#fff;font-weight:900}
      #nb-status,#nb-debug,#nb-meters{font-size:12px;padding:7px 9px;border-radius:8px;margin:5px 0}#nb-status{background:#f2f2f2}#nb-debug{background:#fff5cf}#nb-meters{background:#eef8f0;font-weight:800}
      .nb-magrow{display:flex;gap:6px;margin:7px 0}.nb-magrow select{flex:1;min-width:0;padding:8px;border-radius:9px}.nb-magrow button{padding:8px}
      #nb-card{border:1px solid #ddd;border-radius:13px;padding:12px;margin-top:8px;min-height:230px}.nb-pos{font-size:12px;font-weight:900;color:#666}.nb-user{font-size:18px}.nb-user span,.nb-stat,.nb-tags{font-size:12px;color:#666}.nb-ex{margin:10px 0;background:#f7f7f7;padding:10px;border-radius:9px;line-height:1.55;max-height:190px;overflow:auto}.nb-rank{font-size:12px;font-weight:800}
      .nb-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}.nb-actions button,.nb-actions a{padding:10px 5px;border:1px solid #ddd;border-radius:9px;background:#fff;text-align:center;text-decoration:none;color:#111;font-weight:800;font-size:13px}.nb-actions .heart{background:#fff1f4}.nb-actions.sub{grid-template-columns:repeat(4,1fr)}
      .nb-empty{text-align:center;padding:45px 10px;color:#666}.nb-toast{display:none;position:sticky;bottom:4px;padding:10px;border-radius:9px;background:#222;color:#fff;font-weight:800;margin-top:8px}.nb-toast.ok{background:#146c43}.nb-toast.bad{background:#a61b1b}
      @media(max-width:560px){.nb-grid{grid-template-columns:1fr 1fr}.nb-grid input{grid-column:1/-1}.nb-actions,.nb-actions.sub{grid-template-columns:1fr 1fr}#nb-panel{padding:10px}.nb-head{top:-10px}}
    </style>
    <button id="nb-open">💗 note巡回BOOST</button>
    <div id="nb-panel">
      <div class="nb-head"><b>note巡回BOOST v${VERSION}</b><button id="nb-set">⚙</button><button id="nb-x">×</button></div>
      <div class="nb-grid">
        <input id="nb-tags" placeholder="#はじめてのnote  #エッセイ">
        <select id="nb-tagmode"><option>OR</option><option>AND</option></select>
        <select id="nb-mode"><option value="new">🆕新着</option><option value="popular">🏆人気</option><option value="rising">🔥急上昇</option><option value="discover">🎯発掘</option></select>
        <select id="nb-days"><option value="1">今日</option><option value="3">3日</option><option value="7">7日</option><option value="30">30日</option></select>
        <select id="nb-count"><option>20</option><option>50</option><option>100</option></select>
      </div>
      <button id="nb-run">🔎 巡回開始</button>
      <div id="nb-status">待機中</div><div id="nb-debug">固定NG：ギャンブル・アダルト・投資｜フォロー差 +${settings.followGap}以上は自動除外</div><div id="nb-meters"></div>
      <div class="nb-magrow"><select id="nb-mag"><option value="">マガジン選択</option></select><button id="nb-magrefresh">↻</button></div>
      <div id="nb-card"></div><div id="nb-toast" class="nb-toast"></div>
    </div>`;
    document.body.appendChild(host);
    const panel=$('#nb-panel',host), status=s=>$('#nb-status',host).textContent=s, debug=s=>$('#nb-debug',host).textContent=s;
    $('#nb-open',host).onclick=()=>panel.style.display=panel.style.display==='none'?'block':'none';
    $('#nb-x',host).onclick=()=>panel.style.display='none'; $('#nb-set',host).onclick=openSettings;
    $('#nb-run',host).onclick=()=>scan(status,debug); $('#nb-magrefresh',host).onclick=refreshMagSelector;
    $('#nb-days',host).value=String(settings.days); $('#nb-count',host).value=String(settings.count); $('#nb-mode',host).value=settings.mode; $('#nb-tagmode',host).value=settings.tagMode;
    updateMeters(); refreshMagSelector(); renderCurrent();
  }

  if (document.body) makeUI(); else addEventListener('DOMContentLoaded',makeUI,{once:true});
})();
