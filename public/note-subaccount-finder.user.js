// ==UserScript==
// @name         note サブ垢探偵｜コスモス固定1記事専用
// @namespace    https://github.com/mumei-s/note-insight
// @version      2.2.0
// @description  コスモス本人記事の条件どおり「プロフィール＋公開1記事＋その1記事を固定」を先に厳密確認し、その後に文末の同一絵文字反復を探します。
// @match        https://note.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const CFG = {
    startJst: '2026-08-01T00:00:00+09:00',
    likelyStartJst: '2026-08-23T00:00:00+09:00',
    endJst: '2026-08-26T13:32:00+09:00',
    query: 'はじめてのnote',
    pageSize: 20,
    maxSearchPages: 1200,
    delayMs: 70,
    targetLiker: 'bear_l_t_puzzle',
    maxBearChecks: 50,
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = (s, root = document) => root.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toMs = s => { const v = Date.parse(s || ''); return Number.isFinite(v) ? v : 0; };
  const pick = (o, keys, fallback = '') => { for (const k of keys) if (o && o[k] != null) return o[k]; return fallback; };

  async function getJson(url) {
    const r = await fetch(url, { credentials: 'include', headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }
  async function getText(url) {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.text();
  }

  const unwrapNote = j => { const d = j?.data ?? j ?? {}; return d.note || d; };
  const userOf = n => n?.user || n?.creator || n?.note_user || {};
  const keyOf = n => pick(n, ['key','note_key','noteKey','slug']);
  const titleOf = n => pick(n, ['name','title']);
  const publishOf = n => pick(n, ['publish_at','publishAt','published_at','publishedAt','created_at','createdAt']);
  const urlnameOf = n => pick(userOf(n), ['urlname','url_name','username'], pick(n,['urlname']));
  const nicknameOf = n => pick(userOf(n), ['nickname','name'], pick(n,['nickname'], urlnameOf(n)));
  const likesOf = n => Number(pick(n,['like_count','likeCount','likes_count'],0)) || 0;

  function normalizeSearch(j) {
    const d = j?.data ?? j ?? {};
    const notesObj = d.notes || {};
    return {
      notes: notesObj.contents || notesObj.notes || d.contents || [],
      cursor: d?.cursor?.note ?? d.note_cursor ?? notesObj.next_cursor ?? notesObj.cursor ?? null,
      last: notesObj.is_last_page === true || notesObj.isLastPage === true,
    };
  }

  async function searchPeriod(status) {
    const start = toMs(CFG.startJst), end = toMs(CFG.endJst);
    let cursor = '0', pages = 0, reachedOld = false;
    const byKey = new Map();

    while (pages < CFG.maxSearchPages && !reachedOld) {
      pages++;
      status(`① #はじめてのnote を8/1まで遡り中… ${pages}ページ / 期間内${byKey.size}件`);
      const u = `/api/v3/searches?context=note&q=${encodeURIComponent(CFG.query)}&size=${CFG.pageSize}&start=${encodeURIComponent(cursor)}&sort=new`;
      const j = await getJson(u);
      const s = normalizeSearch(j);
      if (!Array.isArray(s.notes) || !s.notes.length) break;

      let oldest = Infinity;
      for (const n of s.notes) {
        const t = toMs(publishOf(n));
        if (t) oldest = Math.min(oldest, t);
        if (t >= start && t <= end) {
          const key = keyOf(n);
          if (!key) continue;
          byKey.set(key, {
            key,
            title: titleOf(n),
            publishAt: publishOf(n),
            urlname: urlnameOf(n),
            nickname: nicknameOf(n),
            likes: likesOf(n),
          });
        }
      }
      if (oldest < start) reachedOld = true;
      if (s.last || s.cursor == null || String(s.cursor) === String(cursor)) break;
      cursor = String(s.cursor);
      await sleep(CFG.delayMs);
    }
    return { cands:[...byKey.values()], pages, reachedOld };
  }

  function collectHashtags(j) {
    const names = new Set(), seen = new Set();
    const walk = (x, depth=0) => {
      if (!x || typeof x !== 'object' || seen.has(x) || depth > 8) return;
      seen.add(x);
      if (Array.isArray(x)) { x.forEach(v => walk(v, depth+1)); return; }
      for (const [k,v] of Object.entries(x)) {
        if (/hashtag/i.test(k)) {
          if (typeof v === 'string') names.add(v.replace(/^#/,''));
          if (Array.isArray(v)) for (const h of v) {
            if (typeof h === 'string') names.add(h.replace(/^#/,''));
            else if (h && typeof h === 'object') {
              const nm = h.name || h.hashtag || h.tag || h.hashtag_name;
              if (nm) names.add(String(nm).replace(/^#/,''));
            }
          }
        }
        if (v && typeof v === 'object') walk(v, depth+1);
      }
    };
    walk(j);
    return [...names];
  }

  const emojiCluster = String.raw`(?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?(?:[\u{1F3FB}-\u{1F3FF}])?(?:\u200D(?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?(?:[\u{1F3FB}-\u{1F3FF}])?)*`;
  const emojiGlobal = new RegExp(emojiCluster, 'gu');
  const emojiAtEnd = new RegExp(`((?:${emojiCluster}\\s*)+)(?:[。．.!！?？…・~〜ーwｗ笑]*[」』）】〉》]*)\\s*$`, 'u');

  function htmlBlocks(html) {
    const doc = new DOMParser().parseFromString(`<main>${String(html || '')}</main>`, 'text/html');
    const root = doc.querySelector('main');
    const els = root ? [...root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote')] : [];
    let blocks = els.map(el => (el.textContent || '').replace(/\s+/g,' ').trim()).filter(Boolean);
    if (!blocks.length) blocks = (root?.textContent || '').split(/\n+/).map(s => s.replace(/\s+/g,' ').trim()).filter(Boolean);
    return blocks;
  }

  function emojiStats(html) {
    const blocks = htmlBlocks(html), counts = new Map(), examples = new Map();
    let emojiEndBlocks = 0;
    for (const block of blocks) {
      const m = block.match(emojiAtEnd);
      if (!m) continue;
      const ems = [...m[1].matchAll(emojiGlobal)].map(x => x[0]);
      if (!ems.length) continue;
      emojiEndBlocks++;
      for (const em of new Set(ems)) {
        counts.set(em, (counts.get(em) || 0) + 1);
        if (!examples.has(em)) examples.set(em, []);
        const a = examples.get(em);
        if (a.length < 4) a.push(block.slice(-100));
      }
    }
    const ranked = [...counts.entries()].sort((a,b) => b[1]-a[1]);
    const [topEmoji, topCount] = ranked[0] || ['',0];
    return { blockCount:blocks.length, emojiEndBlocks, emojiEnds:ranked, topEmoji, topCount, emojiExamples:examples.get(topEmoji) || [] };
  }

  async function fetchDetail(c, status, i, total) {
    status(`② 本物の #はじめてのnote か確認 ${i}/${total}：${c.nickname || c.urlname}`);
    const j = await getJson(`/api/v3/notes/${encodeURIComponent(c.key)}`);
    const n = unwrapNote(j);
    c.title = titleOf(n) || c.title;
    c.publishAt = publishOf(n) || c.publishAt;
    c.urlname = urlnameOf(n) || c.urlname;
    c.nickname = nicknameOf(n) || c.nickname;
    c.likes = likesOf(n) || c.likes;
    c.hashtags = collectHashtags(j);
    c.hasTargetTag = c.hashtags.includes('はじめてのnote');
    c.detailPinned = pick(n, ['is_pinned','isPinned'], null);
    c.bodyHtml = pick(n, ['body','free_body','freeBody','description'], '') || '';
    Object.assign(c, emojiStats(c.bodyHtml));
    return c;
  }

  function archiveTotal(j) {
    const d = j?.data ?? j ?? [];
    if (!Array.isArray(d)) return null;
    let sum=0, saw=false;
    for (const y of d) {
      if (Array.isArray(y?.details)) {
        for (const m of y.details) {
          const n = Number(m?.num);
          if (Number.isFinite(n)) { sum += n; saw=true; }
        }
      } else {
        const n = Number(y?.totalNum);
        if (Number.isFinite(n)) { sum += n; saw=true; }
      }
    }
    return saw ? sum : null;
  }

  function contentsSummary(j) {
    const d = j?.data ?? j ?? {};
    const arr = Array.isArray(d.contents) ? d.contents : [];
    return {
      total: Number.isFinite(Number(d.totalCount)) ? Number(d.totalCount) : null,
      keys: arr.map(keyOf).filter(Boolean),
    };
  }

  function hasProfileText(obj) {
    const d = obj?.data ?? obj ?? {};
    const vals = [d.profile, d.biography, d.bio, d.description, d.noteIntro, d.note_intro, d.nickname];
    return vals.some(v => typeof v === 'string' && v.trim().length > 0);
  }

  async function profilePinned(urlname, targetKey) {
    try {
      const html = await getText(`/${encodeURIComponent(urlname)}`);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const bodyText = (doc.body?.textContent || '').replace(/\s+/g,' ');
      const hasFixedLabel = bodyText.includes('固定された記事');
      const links = [...doc.querySelectorAll('a[href]')].map(a => a.getAttribute('href') || '');
      return hasFixedLabel && links.some(h => h.includes(`/n/${targetKey}`));
    } catch { return false; }
  }

  async function strictCheck(c, status, i, total) {
    status(`③ 公開1記事＝固定記事を厳密確認 ${i}/${total}：${c.nickname}`);
    try {
      const [creatorJ, archivesJ, contentsJ, htmlPinned] = await Promise.all([
        getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}`),
        getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}/archives`),
        getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}/contents?kind=note&page=1&disabled_pinned=false&with_notes=false`),
        profilePinned(c.urlname, c.key),
      ]);
      const creator = creatorJ?.data ?? creatorJ ?? {};
      const cs = contentsSummary(contentsJ);
      c.noteCount = Number.isFinite(Number(creator.noteCount)) ? Number(creator.noteCount) : null;
      c.archiveCount = archiveTotal(archivesJ);
      c.contentsTotal = cs.total;
      c.contentsKeys = cs.keys;
      c.followerCount = Number.isFinite(Number(creator.followerCount)) ? Number(creator.followerCount) : null;
      c.profileConfigured = hasProfileText(creatorJ);
      c.isPinned = c.detailPinned === true || htmlPinned === true;
      c.onlyTargetInList = cs.keys.length === 1 && cs.keys[0] === c.key;

      // 必須条件：公開記事総数が本当に1、その唯一の記事が対象記事、その記事が固定。
      c.exactOneArticle = c.noteCount === 1 && c.archiveCount === 1 && (c.contentsTotal == null || c.contentsTotal === 1);
      c.strictPass = c.hasTargetTag && c.exactOneArticle && c.isPinned && (c.onlyTargetInList || cs.keys.length === 0);
    } catch (e) {
      c.strictError = String(e.message || e);
      c.strictPass = false;
    }
    return c;
  }

  async function bearLiked(key) {
    for (let start=0; start<600; start+=100) {
      try {
        const j = await getJson(`/api/v3/notes/${encodeURIComponent(key)}/likes?size=100&start=${start}`);
        const d = j?.data ?? j ?? {};
        const arr = Array.isArray(d) ? d : (d.users || d.likes || d.contents || []);
        const users = Array.isArray(arr) ? arr : [];
        if (users.some(x => {
          const u = x?.user || x?.creator || x || {};
          return (u.urlname || u.url_name || u.username) === CFG.targetLiker;
        })) return true;
        if (users.length < 100) break;
      } catch { break; }
    }
    return false;
  }

  function score(c) {
    let s = (c.topCount || 0) * 40;
    if (c.topCount >= 3) s += 80;
    if (c.topCount >= 5) s += 100;
    if (toMs(c.publishAt) >= toMs(CFG.likelyStartJst)) s += 25;
    if (c.bearLiked) s += 180;
    return s;
  }

  function makeUI() {
    const host = document.createElement('div');
    host.id = 'cosmos-strict-finder';
    host.style.cssText = 'position:fixed;right:8px;bottom:10px;z-index:2147483647;font-family:system-ui,sans-serif;color:#111';
    host.innerHTML = `
      <button id="cs-open" style="border:0;border-radius:999px;padding:12px 15px;background:#111;color:#fff;font-weight:800;box-shadow:0 4px 18px #0004">🕵️ コスモス探偵 v2.2</button>
      <div id="cs-panel" style="display:none;width:min(95vw,780px);max-height:83vh;overflow:auto;background:#fff;border-radius:16px;box-shadow:0 8px 30px #0006;margin-top:8px;padding:12px">
        <div style="display:flex;gap:8px;align-items:center;position:sticky;top:-12px;background:#fff;padding:8px 0;z-index:2">
          <b style="flex:1">公開1記事＝固定記事だけ</b><button id="cs-run">厳密スキャン</button><button id="cs-x">×</button>
        </div>
        <div id="cs-status" style="font-size:12px;background:#f4f4f4;padding:8px;border-radius:8px">待機中</div>
        <div style="font-size:11px;margin:8px 0">探索 8/1〜8/26 13:32｜8/23〜26は「先日」本命帯として加点｜必須：#はじめてのnote＋公開1記事＋その1記事が固定</div>
        <div id="cs-results"></div>
      </div>`;
    document.body.appendChild(host);

    const panel=$('#cs-panel',host), statusEl=$('#cs-status',host), results=$('#cs-results',host);
    $('#cs-open',host).onclick=()=>panel.style.display=panel.style.display==='none'?'block':'none';
    $('#cs-x',host).onclick=()=>panel.style.display='none';
    const status=s=>statusEl.textContent=s;

    $('#cs-run',host).onclick=async e=>{
      const btn=e.currentTarget; btn.disabled=true; results.innerHTML='';
      try {
        const sr=await searchPeriod(status);
        status(`検索完了：期間内 ${sr.cands.length}件。#タグを実記事で確認中…`);

        const detail=[];
        for(let i=0;i<sr.cands.length;i++){
          try{
            const c=await fetchDetail(sr.cands[i],status,i+1,sr.cands.length);
            if(c.hasTargetTag) detail.push(c);
          }catch{}
          await sleep(CFG.delayMs);
        }

        const strict=[];
        for(let i=0;i<detail.length;i++){
          await strictCheck(detail[i],status,i+1,detail.length);
          if(detail[i].strictPass) strict.push(detail[i]);
          await sleep(CFG.delayMs);
        }

        // べあ確認は絵文字が強い人＋最近の人から上限50件。
        const bearTargets=[...strict].sort((a,b)=>(b.topCount||0)-(a.topCount||0)||toMs(b.publishAt)-toMs(a.publishAt)).slice(0,CFG.maxBearChecks);
        for(let i=0;i<bearTargets.length;i++){
          status(`④ べあのスキを補助確認 ${i+1}/${bearTargets.length}：${bearTargets[i].nickname}`);
          bearTargets[i].bearLiked=await bearLiked(bearTargets[i].key);
          await sleep(CFG.delayMs);
        }

        strict.sort((a,b)=>score(b)-score(a));
        status(`完了：検索${sr.cands.length}件 → 本物タグ${detail.length}件 → 「公開1記事＝固定」${strict.length}人。`);

        results.innerHTML = strict.map((c,i)=>{
          const art=`https://note.com/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`;
          const pro=`https://note.com/${encodeURIComponent(c.urlname)}`;
          const em=c.emojiEnds?.length?c.emojiEnds.slice(0,6).map(([x,n])=>`${x}×${n}文末`).join(' / '):'文末絵文字なし';
          const ex=(c.emojiExamples||[]).map(x=>`<div style="font-size:11px;color:#555">・${esc(x)}</div>`).join('');
          const likely=toMs(c.publishAt)>=toMs(CFG.likelyStartJst)?'🔥 先日本命帯':'広域候補';
          return `<div style="border-top:1px solid #ddd;padding:12px 2px">
            <div style="display:flex;gap:8px;align-items:center"><b style="font-size:19px">#${i+1} ${esc(c.nickname)}</b><strong style="margin-left:auto">${score(c)}点</strong></div>
            <div style="font-size:12px;color:#555">@${esc(c.urlname)} / ${esc(c.publishAt).slice(5,16).replace('T',' ')} / スキ${c.likes} / フォロワー${c.followerCount ?? '?'}</div>
            <div style="font-size:13px;margin:4px 0">${esc(c.title)}</div>
            <div style="background:#eaf8ed;padding:8px;border-radius:10px;margin:6px 0"><b>✅ 公開記事1件</b>（noteCount=${c.noteCount} / archives=${c.archiveCount}）<br><b>✅ 唯一の記事が固定　✅ #はじめてのnote</b><br>${c.profileConfigured?'✅':'△'} プロフィール設定 / ${likely}${c.bearLiked?' / ⭐ べあがスキ':''}</div>
            <div><b>文末絵文字：</b>${esc(em)}</div>${ex}
            <div style="display:flex;gap:14px;margin-top:7px"><a href="${pro}" target="_blank"><b>クリエイターページ</b></a><a href="${art}" target="_blank"><b>固定記事</b></a></div>
          </div>`;
        }).join('') || '<div style="padding:16px"><b>この厳密条件では0人。</b><br>その場合は「先日」の期間ではなく、APIの固定判定・検索漏れを次に切り分けます。</div>';
      } catch(e) {
        console.error(e); status(`エラー：${e.message||e}`);
      } finally { btn.disabled=false; }
    };
  }

  if(!document.getElementById('cosmos-strict-finder')) makeUI();
})();