// ==UserScript==
// @name         note サブ垢探偵｜はじめてのnote候補スキャナ
// @namespace    https://github.com/mumei-s/note-insight
// @version      1.1.0
// @description  #はじめてのnoteを期間走査し、全文・記事総数・文末絵文字・句読点・べあのスキを照合して候補をランキングします。
// @match        https://note.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const CFG = {
    startJst: '2026-08-15T00:00:00+09:00',
    endJst: '2026-08-26T13:32:00+09:00',
    hashtag: 'はじめてのnote',
    maxTagPages: 300,
    tagDelayMs: 55,
    detailPool: 360,
    creatorPool: 220,
    likesPool: 90,
    concurrency: 6,
    targetLiker: 'bear_l_t_puzzle',
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = (s, root = document) => root.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dt = s => { const n = Date.parse(s || ''); return Number.isFinite(n) ? n : 0; };

  async function getJson(url) {
    const r = await fetch(url, {credentials:'include', headers:{Accept:'application/json'}});
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }

  async function pool(items, limit, worker) {
    let i = 0;
    const runners = Array.from({length: Math.min(limit, items.length)}, async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) return;
        await worker(items[idx], idx);
      }
    });
    await Promise.all(runners);
  }

  function dataOf(j) { return j?.data ?? j ?? {}; }
  function userOf(n) { return n?.user || n?.creator || n?.note_user || {}; }
  function keyOf(n) { return n?.key || n?.note_key || n?.noteKey || ''; }
  function titleOf(n) { return n?.name || n?.title || ''; }
  function bodyOf(n) { return n?.body || n?.free_body || n?.description || ''; }
  function publishOf(n) { return n?.publish_at || n?.publishAt || n?.published_at || n?.created_at || n?.createdAt || ''; }
  function urlnameOf(n) { const u=userOf(n); return u.urlname || u.url_name || u.username || n?.urlname || ''; }
  function nicknameOf(n) { const u=userOf(n); return u.nickname || u.name || n?.nickname || urlnameOf(n); }
  function likeCountOf(n) { return Number(n?.like_count ?? n?.likeCount ?? n?.likes_count ?? 0) || 0; }

  function htmlToText(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.innerText || d.textContent || '').replace(/\r/g,'');
  }

  const emojiRe = /\p{Extended_Pictographic}/gu;
  const emojiEndRe = /(?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?(?:\u200D(?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?)?(?:[\u{1F3FB}-\u{1F3FF}])?[」』）】]*\s*$/u;

  function signals(raw, title='', nickname='') {
    const text = htmlToText(raw);
    const lines = text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    let emojiEnd=0, dots3=0, ellipsis=0, short=0, emojiTotal=0;
    const em = new Map();

    for (const line of lines) {
      if (emojiEndRe.test(line)) emojiEnd++;
      dots3 += (line.match(/・・・/g)||[]).length;
      ellipsis += (line.match(/……/g)||[]).length;
      if (line.length <= 30) short++;
      for (const m of line.matchAll(emojiRe)) {
        emojiTotal++;
        em.set(m[0], (em.get(m[0])||0)+1);
      }
    }

    const top = [...em.entries()].sort((a,b)=>b[1]-a[1])[0] || ['',0];
    const emojiEndRatio = lines.length ? emojiEnd/lines.length : 0;
    const shortRatio = lines.length ? short/lines.length : 0;
    let score = 0;

    if (emojiEnd >= 2) score += Math.min(32, emojiEnd*5);
    if (emojiEnd >= 5) score += 15;
    if (emojiEndRatio >= .15) score += 8;
    if (top[1] >= 3) score += Math.min(18, top[1]*2);
    if (dots3) score += Math.min(16, dots3*4);
    if (ellipsis) score += Math.min(10, ellipsis*2);
    if (shortRatio >= .45) score += 5;
    if (/はじめてのnote|初めてのnote|自己紹介/i.test(title)) score += 8;

    const name = `${nickname} ${title}`;
    const nameClues=[];
    const clues=[
      [/花|はな|華|コスモス|cosmos/i,'花'],
      [/空|そら|星|月|宇宙|space|sky|star|moon/i,'宇宙'],
      [/三人|3人|三つ|トリオ|trio/i,'3人'],
      [/別|裏|影|もうひとり|ひとり|匿名|名無し|無名|sub|sab|サブ/i,'別人格'],
    ];
    for (const [re,label] of clues) if (re.test(name)) { nameClues.push(label); score += 3; }

    return {text, lines:lines.length, emojiEnd, emojiEndRatio, emojiTotal, topEmoji:top[0], topEmojiCount:top[1], dots3, ellipsis, shortRatio, nameClues, styleScore:score};
  }

  function normalizeTag(j) {
    const d=dataOf(j);
    const notes = d.notes || j?.notes || d.contents || [];
    return {
      notes: Array.isArray(notes) ? notes : [],
      next: d.next_page ?? j?.next_page ?? null,
      last: Boolean(d.is_last_page ?? j?.is_last_page ?? d.isLastPage ?? false),
    };
  }

  async function scanTag(status) {
    const start=dt(CFG.startJst), end=dt(CFG.endJst);
    const out=[];
    let page=1, reached=false, pages=0;

    while (page<=CFG.maxTagPages && !reached) {
      const j=await getJson(`/api/v3/hashtags/${encodeURIComponent(CFG.hashtag)}/notes?order=new&page=${page}&paid_only=false`);
      const {notes,next,last}=normalizeTag(j);
      pages++;
      if (!notes.length) break;

      let oldest=Infinity, newest=0;
      for (const n of notes) {
        const t=dt(publishOf(n));
        if (t) { oldest=Math.min(oldest,t); newest=Math.max(newest,t); }
        if (t>=start && t<=end) {
          const sig=signals(bodyOf(n),titleOf(n),nicknameOf(n));
          out.push({
            key:keyOf(n), title:titleOf(n), publishAt:publishOf(n), urlname:urlnameOf(n), nickname:nicknameOf(n), likes:likeCountOf(n), previewBody:bodyOf(n), ...sig,
          });
        }
      }

      const od = Number.isFinite(oldest) ? new Date(oldest).toLocaleString('ja-JP') : '?';
      status(`タグ走査 page ${page}｜期間内 ${out.length}件｜このページ最古 ${od}`);
      if (oldest<start) reached=true;
      if (last) break;
      page=Number(next)||page+1;
      await sleep(CFG.tagDelayMs);
    }

    return {items:out,pages,reached};
  }

  async function fetchFull(c) {
    const j=await getJson(`/api/v3/notes/${encodeURIComponent(c.key)}`);
    const d=dataOf(j);
    const s=signals(bodyOf(d), titleOf(d)||c.title, nicknameOf(d)||c.nickname);
    Object.assign(c,s);
    c.title=titleOf(d)||c.title;
    c.publishAt=publishOf(d)||c.publishAt;
    c.urlname=urlnameOf(d)||c.urlname;
    c.nickname=nicknameOf(d)||c.nickname;
    c.likes=likeCountOf(d)||c.likes;
    c.fullOk=true;
  }

  function noteCountFromProfile(j) {
    const d=dataOf(j);
    const values=[d.noteCount,d.note_count,d.notesCount,d.notes_count];
    for (const v of values) if (v!==undefined && v!==null && Number.isFinite(Number(v))) return Number(v);
    return null;
  }

  function noteCountFromArchives(j) {
    const d=dataOf(j);
    const arr=Array.isArray(d) ? d : (Array.isArray(d.archives) ? d.archives : []);
    if (!arr.length) return null;
    let total=0, seen=false;
    for (const y of arr) {
      if (Number.isFinite(Number(y.totalNum))) { total+=Number(y.totalNum); seen=true; continue; }
      if (Array.isArray(y.details)) {
        for (const m of y.details) if (Number.isFinite(Number(m.num))) { total+=Number(m.num); seen=true; }
      }
    }
    return seen ? total : null;
  }

  function notesArrayFromContents(j) {
    const d=dataOf(j);
    const arr=d.notes || d.contents || j?.notes || j?.contents || [];
    return Array.isArray(arr) ? arr : [];
  }

  function isLastContents(j) {
    const d=dataOf(j);
    return Boolean(d.isLastPage ?? d.is_last_page ?? j?.isLastPage ?? j?.is_last_page ?? false);
  }

  function findPinnedKey(obj, targetKey) {
    let hit=false;
    const seen=new Set();
    const walk=(o, parent='')=>{
      if (!o || typeof o!=='object' || seen.has(o) || hit) return;
      seen.add(o);
      for (const [k,v] of Object.entries(o)) {
        if (/pin|fixed|pickup/i.test(k)) {
          const txt=typeof v==='string' ? v : JSON.stringify(v);
          if (targetKey && txt?.includes(targetKey)) { hit=true; return; }
        }
        if (v && typeof v==='object') walk(v,k);
      }
    };
    walk(obj);
    return hit;
  }

  async function checkCreator(c) {
    const u=encodeURIComponent(c.urlname);
    let p=null,a=null,list=null;
    try { p=await getJson(`/api/v2/creators/${u}`); } catch(e) { c.profileErr=String(e.message||e); }
    try { a=await getJson(`/api/v2/creators/${u}/archives`); } catch(e) { c.archiveErr=String(e.message||e); }
    try { list=await getJson(`/api/v2/creators/${u}/contents?kind=note&page=1`); } catch(e) { c.contentsErr=String(e.message||e); }

    const pc=p ? noteCountFromProfile(p) : null;
    const ac=a ? noteCountFromArchives(a) : null;
    let lc=null;
    if (list) {
      const arr=notesArrayFromContents(list);
      if (isLastContents(list)) lc=arr.length;
    }

    c.noteCountProfile=pc;
    c.noteCountArchive=ac;
    c.noteCountContents=lc;
    c.noteCount = pc ?? ac ?? lc;
    c.countVerified = Number.isFinite(c.noteCount);
    c.isOneArticle = c.noteCount===1;
    c.isPinnedLikely = Boolean((p&&findPinnedKey(p,c.key)) || (list&&findPinnedKey(list,c.key)));
    c.creatorScore = c.isOneArticle ? 42 : (c.noteCount===2 ? -4 : (c.noteCount>2 ? -25 : 0));
    if (c.isPinnedLikely) c.creatorScore += 10;
  }

  function prelimScore(c) {
    return (c.styleScore||0) + Math.min(8,c.likes||0);
  }

  function finalScore(c) {
    return (c.styleScore||0) + (c.creatorScore||0) + (c.bearLiked?50:0);
  }

  async function bearLiked(key) {
    for (let page=1;page<=8;page++) {
      const j=await getJson(`/api/v3/notes/${encodeURIComponent(key)}/likes?page=${page}&per_page=100`);
      const d=dataOf(j);
      const arr=Array.isArray(d) ? d : (d.likes || d.users || []);
      if (arr.some(x=>{
        const u=x?.user || x?.creator || x;
        return (u?.urlname || u?.url_name || u?.username)===CFG.targetLiker;
      })) return true;
      const next=d.next_page ?? j?.next_page;
      const total=Number(d.total_count ?? j?.total_count ?? 0);
      if (!next && total<=page*100) break;
      if (!next && !total) break;
    }
    return false;
  }

  function reason(c) {
    const a=[];
    if (c.isOneArticle) a.push('✅公開1記事');
    else if (c.noteCount!==null && c.noteCount!==undefined) a.push(`記事${c.noteCount}件`);
    else a.push('記事数未取得');
    if (c.isPinnedLikely) a.push('固定一致');
    if (c.emojiEnd) a.push(`文末絵文字${c.emojiEnd}`);
    if (c.topEmoji) a.push(`最多${c.topEmoji}×${c.topEmojiCount}`);
    if (c.dots3) a.push(`・・・×${c.dots3}`);
    if (c.ellipsis) a.push(`……×${c.ellipsis}`);
    if (c.nameClues?.length) a.push(`名前:${c.nameClues.join('/')}`);
    if (c.bearLiked) a.push('🐻べあがスキ');
    return a.join(' / ');
  }

  function renderCard(c,i) {
    const article=`https://note.com/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`;
    const profile=`https://note.com/${encodeURIComponent(c.urlname)}`;
    const border=c.bearLiked?'2px solid #f0a000':(c.isOneArticle?'2px solid #22a06b':'1px solid #ddd');
    return `<div style="border:${border};border-radius:10px;padding:10px;margin:8px 0;background:#fff">
      <div style="display:flex;gap:8px;align-items:center"><b style="font-size:17px">#${i+1} ${esc(c.nickname)}</b><strong style="margin-left:auto">${finalScore(c)}点</strong></div>
      <div style="font-size:13px;margin-top:3px">${esc(c.title)}</div>
      <div style="font-size:11px;color:#666">${esc(c.publishAt)} / スキ${c.likes}</div>
      <div style="font-size:12px;margin:5px 0">${esc(reason(c))}</div>
      <div style="font-size:10px;color:#777">count: profile=${esc(c.noteCountProfile)} / archive=${esc(c.noteCountArchive)} / contents=${esc(c.noteCountContents)}</div>
      <div style="display:flex;gap:12px;margin-top:5px"><a href="${article}" target="_blank">記事</a><a href="${profile}" target="_blank">クリエイターページ</a></div>
    </div>`;
  }

  function makeUI() {
    const host=document.createElement('div');
    host.id='subacct-finder';
    host.style.cssText='position:fixed;right:8px;bottom:10px;z-index:2147483647;font-family:system-ui,sans-serif;color:#111';
    host.innerHTML=`
      <button id="saf-open" style="border:0;border-radius:999px;padding:12px 15px;background:#111;color:#fff;font-weight:800;box-shadow:0 4px 18px #0004">🕵️ サブ垢探偵 v1.1</button>
      <div id="saf-panel" style="display:none;width:min(95vw,760px);max-height:82vh;overflow:auto;background:#fff;border:1px solid #bbb;border-radius:14px;box-shadow:0 10px 35px #0005;margin-top:7px;padding:12px">
        <div style="display:flex;gap:7px;align-items:center;position:sticky;top:-12px;background:#fff;padding:8px 0;z-index:2"><b style="flex:1">#はじめてのnote 探偵 v1.1</b><button id="saf-run">高速スキャン</button><button id="saf-close">×</button></div>
        <div id="saf-status" style="font-size:12px;background:#f3f3f3;padding:8px;border-radius:8px;white-space:pre-wrap">待機中</div>
        <div style="font-size:11px;margin:7px 0">8/15〜8/26 13:32｜全文で文末絵文字を再計測｜記事数はプロフィール＋アーカイブ＋一覧で二重三重確認｜べあのスキ確認</div>
        <div id="saf-results"></div>
      </div>`;
    document.body.appendChild(host);

    const panel=$('#saf-panel',host), statusEl=$('#saf-status',host), results=$('#saf-results',host);
    $('#saf-open',host).onclick=()=>panel.style.display=panel.style.display==='none'?'block':'none';
    $('#saf-close',host).onclick=()=>panel.style.display='none';
    const status=s=>statusEl.textContent=s;

    $('#saf-run',host).onclick=async e=>{
      const btn=e.currentTarget; btn.disabled=true; results.innerHTML='';
      try {
        const scan=await scanTag(status);
        if (!scan.items.length) {
          status(`タグ走査は完了したが期間内0件。page=${scan.pages} reachedOld=${scan.reached}`);
          results.innerHTML='<b>タグ取得側の問題。候補判定前で0件です。</b>';
          return;
        }

        const dedup=new Map();
        for (const c of scan.items.sort((a,b)=>prelimScore(b)-prelimScore(a))) {
          if (c.urlname && !dedup.has(c.urlname)) dedup.set(c.urlname,c);
        }
        const all=[...dedup.values()];
        const detailTargets=all.slice(0,CFG.detailPool);
        status(`期間内 ${scan.items.length}記事 / ${all.length}人。全文取得 0/${detailTargets.length}`);
        let done=0;
        await pool(detailTargets,CFG.concurrency,async c=>{
          try { await fetchFull(c); } catch(e) { c.fullErr=String(e.message||e); }
          done++; if (done%10===0||done===detailTargets.length) status(`全文取得 ${done}/${detailTargets.length}`);
        });

        detailTargets.sort((a,b)=>prelimScore(b)-prelimScore(a));
        const creatorTargets=[];
        const seen=new Set();
        for (const c of detailTargets) {
          const strong=(c.emojiEnd>=2)||(c.topEmojiCount>=3)||(c.dots3>0)||(c.ellipsis>0);
          if ((strong || creatorTargets.length<CFG.creatorPool) && !seen.has(c.urlname)) {
            seen.add(c.urlname); creatorTargets.push(c);
          }
          if (creatorTargets.length>=CFG.creatorPool) break;
        }

        done=0;
        await pool(creatorTargets,CFG.concurrency,async c=>{
          try { await checkCreator(c); } catch(e) { c.creatorErr=String(e.message||e); }
          done++; if (done%10===0||done===creatorTargets.length) status(`クリエイターページ確認 ${done}/${creatorTargets.length}`);
        });

        const one=creatorTargets.filter(c=>c.isOneArticle).sort((a,b)=>finalScore(b)-finalScore(a));
        const likeTargets=one.slice(0,CFG.likesPool);
        done=0;
        await pool(likeTargets,4,async c=>{
          try { c.bearLiked=await bearLiked(c.key); } catch(e) { c.bearErr=String(e.message||e); c.bearLiked=false; }
          done++; if (done%10===0||done===likeTargets.length) status(`べあのスキ確認 ${done}/${likeTargets.length}`);
        });

        creatorTargets.sort((a,b)=>finalScore(b)-finalScore(a));
        const oneFinal=creatorTargets.filter(c=>c.isOneArticle).sort((a,b)=>finalScore(b)-finalScore(a));
        const unknown=creatorTargets.filter(c=>!c.countVerified).sort((a,b)=>finalScore(b)-finalScore(a));
        const others=creatorTargets.filter(c=>c.countVerified&&!c.isOneArticle).sort((a,b)=>finalScore(b)-finalScore(a));

        status(`完了\nタグ期間内 ${scan.items.length}記事 / ${all.length}人\n全文確認 ${detailTargets.length}人\nクリエイター確認 ${creatorTargets.length}人\n✅公開1記事 ${oneFinal.length}人 / 記事数未取得 ${unknown.length}人`);

        let html='';
        if (oneFinal.length) {
          html+=`<h3 style="margin:12px 0 4px">🔥 公開1記事 確定候補 ${oneFinal.length}人</h3>`;
          html+=oneFinal.slice(0,60).map(renderCard).join('');
        } else {
          html+='<h3>公開1記事の確定候補は0。ただし下の「記事数未取得」を確認。</h3>';
        }
        if (unknown.length) {
          html+=`<h3 style="margin:16px 0 4px">⚠ 記事数をAPIで確定できなかった候補 ${unknown.length}人</h3>`;
          html+=unknown.slice(0,30).map(renderCard).join('');
        }
        html+=`<details style="margin-top:14px"><summary>複数記事で除外 ${others.length}人</summary>${others.slice(0,40).map(renderCard).join('')}</details>`;
        results.innerHTML=html;
      } catch(err) {
        console.error('[subacct finder]',err);
        status(`エラー: ${err.message||err}`);
      } finally { btn.disabled=false; }
    };
  }

  if (!document.getElementById('subacct-finder')) makeUI();
})();
