// ==UserScript==
// @name         note サブ垢探偵｜コスモス条件・固定1記事専用
// @namespace    https://github.com/mumei-s/note-insight
// @version      2.0.0
// @description  コスモス記事の条件どおり、8/26以前の #はじめてのnote から「公開記事が本当に1件」「その1件が固定」を厳密確認し、文末絵文字の反復とべあのスキを補助表示します。
// @match        https://note.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const CFG = {
    startJst: '2026-08-20T00:00:00+09:00',
    endJst: '2026-08-26T13:32:00+09:00',
    query: 'はじめてのnote',
    pageSize: 20,
    maxSearchPages: 400,
    delayMs: 110,
    targetLiker: 'bear_l_t_puzzle',
    maxBearChecks: 60,
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = (s, root = document) => root.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toMs = s => { const v = Date.parse(s || ''); return Number.isFinite(v) ? v : 0; };
  const pick = (o, keys, fallback = '') => { for (const k of keys) if (o && o[k] != null) return o[k]; return fallback; };

  async function getJson(url) {
    const r = await fetch(url, { credentials: 'include' });
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
    const notes = notesObj.contents || notesObj.notes || d.contents || [];
    const cursor = d?.cursor?.note ?? d.note_cursor ?? notesObj.next_cursor ?? notesObj.cursor ?? null;
    const isLast = notesObj.is_last_page === true || notesObj.isLastPage === true;
    return { notes: Array.isArray(notes) ? notes : [], cursor, isLast };
  }

  function collectHashtags(j) {
    const names = new Set();
    const seen = new Set();
    const walk = (x, depth = 0) => {
      if (!x || typeof x !== 'object' || seen.has(x) || depth > 8) return;
      seen.add(x);
      if (Array.isArray(x)) { for (const v of x) walk(v, depth + 1); return; }
      for (const [k,v] of Object.entries(x)) {
        if (/hashtag/i.test(k)) {
          if (typeof v === 'string') names.add(v.replace(/^#/, ''));
          if (Array.isArray(v)) for (const h of v) {
            if (typeof h === 'string') names.add(h.replace(/^#/, ''));
            else if (h && typeof h === 'object') {
              const nm = h.name || h.hashtag || h.tag || h.hashtag_name;
              if (nm) names.add(String(nm).replace(/^#/, ''));
            }
          }
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            const nm = v.name || v.hashtag || v.tag || v.hashtag_name;
            if (nm) names.add(String(nm).replace(/^#/, ''));
          }
        }
        if (v && typeof v === 'object') walk(v, depth + 1);
      }
    };
    walk(j);
    return [...names];
  }

  async function searchPeriod(status) {
    const start = toMs(CFG.startJst), end = toMs(CFG.endJst);
    let cursor = '0', pages = 0, reachedOld = false;
    const byKey = new Map();

    while (pages < CFG.maxSearchPages && !reachedOld) {
      pages++;
      status(`① #はじめてのnote候補を遡り中… ${pages}ページ / ${byKey.size}件`);
      const u = `/api/v3/searches?context=note&q=${encodeURIComponent(CFG.query)}&size=${CFG.pageSize}&start=${encodeURIComponent(cursor)}&sort=new`;
      const j = await getJson(u);
      const { notes, cursor: next, isLast } = normalizeSearch(j);
      if (!notes.length) break;
      let pageOldest = Infinity;
      for (const n of notes) {
        const t = toMs(publishOf(n));
        if (t) pageOldest = Math.min(pageOldest, t);
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
      if (pageOldest < start) reachedOld = true;
      if (isLast || next == null || String(next) === String(cursor)) break;
      cursor = String(next);
      await sleep(CFG.delayMs);
    }
    return { cands:[...byKey.values()], pages, reachedOld };
  }

  function normalizeBodyHtml(n) {
    return pick(n, ['body','free_body','freeBody','description'], '') || '';
  }

  function htmlBlocks(html) {
    const doc = new DOMParser().parseFromString(`<main>${String(html || '')}</main>`, 'text/html');
    const root = doc.querySelector('main');
    const els = root ? [...root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote')] : [];
    let blocks = els.map(el => (el.textContent || '').replace(/\s+/g,' ').trim()).filter(Boolean);
    if (!blocks.length) {
      const text = root?.textContent || '';
      blocks = text.split(/\n+/).map(s => s.replace(/\s+/g,' ').trim()).filter(Boolean);
    }
    return blocks;
  }

  const emojiCluster = String.raw`(?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?(?:[\u{1F3FB}-\u{1F3FF}])?(?:\u200D(?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?(?:[\u{1F3FB}-\u{1F3FF}])?)*`;
  const trailingEmojiRunRe = new RegExp(`((?:${emojiCluster}\\s*)+)(?:[。．.!！?？…・~〜ーwｗ笑]*[」』）】〉》]*)\\s*$`, 'u');
  const emojiGlobalRe = new RegExp(emojiCluster, 'gu');

  function emojiPunctuationStats(html) {
    const blocks = htmlBlocks(html);
    const counts = new Map();
    const examples = new Map();
    let blocksWithEmojiEnd = 0;

    for (const block of blocks) {
      const m = block.match(trailingEmojiRunRe);
      if (!m) continue;
      const run = m[1];
      const emojis = [...run.matchAll(emojiGlobalRe)].map(x => x[0]);
      if (!emojis.length) continue;
      blocksWithEmojiEnd++;
      for (const em of new Set(emojis)) {
        counts.set(em, (counts.get(em) || 0) + 1);
        if (!examples.has(em)) examples.set(em, []);
        const ex = examples.get(em);
        if (ex.length < 4) ex.push(block.slice(-100));
      }
    }

    const ranked = [...counts.entries()].sort((a,b) => b[1]-a[1]);
    const [topEmoji, topCount] = ranked[0] || ['',0];
    return {
      blockCount: blocks.length,
      blocksWithEmojiEnd,
      topEmoji,
      topEmojiEndCount: topCount,
      emojiEnds: ranked,
      emojiExamples: examples.get(topEmoji) || [],
    };
  }

  async function enrichDetail(c, status, i, total) {
    status(`② 記事全文とタグ確認 ${i}/${total}：${c.nickname || c.urlname}`);
    const j = await getJson(`/api/v3/notes/${encodeURIComponent(c.key)}`);
    const n = unwrapNote(j);
    c.title = titleOf(n) || c.title;
    c.publishAt = publishOf(n) || c.publishAt;
    c.urlname = urlnameOf(n) || c.urlname;
    c.nickname = nicknameOf(n) || c.nickname;
    c.likes = likesOf(n) || c.likes;
    c.hashtags = collectHashtags(j);
    c.hasFirstNoteTag = c.hashtags.includes('はじめてのnote');
    c.detailPinned = pick(n, ['is_pinned','isPinned'], null);
    Object.assign(c, emojiPunctuationStats(normalizeBodyHtml(n)));
    return c;
  }

  function creatorInfoData(j) { return j?.data ?? j ?? {}; }

  function archiveTotal(j) {
    const d = j?.data ?? j ?? [];
    if (!Array.isArray(d)) return null;
    let sum = 0, saw = false;
    for (const year of d) {
      const details = year?.details;
      if (Array.isArray(details)) {
        for (const m of details) {
          const n = Number(m?.num);
          if (Number.isFinite(n)) { sum += n; saw = true; }
        }
      } else {
        const n = Number(year?.totalNum);
        if (Number.isFinite(n)) { sum += n; saw = true; }
      }
    }
    return saw ? sum : null;
  }

  function contentsSummary(j) {
    const d = j?.data ?? j ?? {};
    const arr = Array.isArray(d.contents) ? d.contents : [];
    return {
      totalCount: Number.isFinite(Number(d.totalCount)) ? Number(d.totalCount) : null,
      keys: arr.map(keyOf).filter(Boolean),
    };
  }

  async function profilePinCheck(urlname, key) {
    try {
      const html = await getText(`/${encodeURIComponent(urlname)}`);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const text = (doc.body?.textContent || '').replace(/\s+/g,' ');
      const hasFixedLabel = text.includes('固定された記事');
      const hasTargetLink = [...doc.querySelectorAll('a[href]')].some(a => (a.getAttribute('href') || '').includes(`/n/${key}`));
      return { hasFixedLabel, hasTargetLink, htmlPinned: hasFixedLabel && hasTargetLink };
    } catch {
      return { hasFixedLabel:false, hasTargetLink:false, htmlPinned:false };
    }
  }

  async function hardCheck(c, status, i, total) {
    status(`③ 公開1記事＋固定を厳密確認 ${i}/${total}：${c.nickname}`);
    try {
      const [creatorJ, archiveJ, contentsJ, htmlPin] = await Promise.all([
        getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}`),
        getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}/archives`),
        getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}/contents?kind=note&page=1&disabled_pinned=false&with_notes=false`),
        profilePinCheck(c.urlname, c.key),
      ]);

      const creator = creatorInfoData(creatorJ);
      c.noteCount = Number.isFinite(Number(creator.noteCount)) ? Number(creator.noteCount) : null;
      c.followerCount = Number.isFinite(Number(creator.followerCount)) ? Number(creator.followerCount) : null;
      c.archiveCount = archiveTotal(archiveJ);
      const cs = contentsSummary(contentsJ);
      c.contentsTotal = cs.totalCount;
      c.contentsKeys = cs.keys;
      Object.assign(c, htmlPin);

      c.exactlyOneArticle = c.noteCount === 1 && c.archiveCount === 1 && (c.contentsTotal == null || c.contentsTotal === 1);
      c.isPinned = c.detailPinned === true || c.htmlPinned === true;
      c.onlyTargetVisible = cs.keys.length === 1 && cs.keys[0] === c.key;
      c.hardPass = c.hasFirstNoteTag && c.exactlyOneArticle && c.isPinned && (c.onlyTargetVisible || cs.keys.length === 0);
    } catch (e) {
      c.hardError = String(e.message || e);
      c.hardPass = false;
    }
    return c;
  }

  async function bearLiked(key) {
    for (let start=0; start<800; start+=100) {
      try {
        const j = await getJson(`/api/v3/notes/${encodeURIComponent(key)}/likes?size=100&start=${start}`);
        const d = j?.data ?? j ?? {};
        const arr = Array.isArray(d) ? d : (d.users || d.likes || d.contents || []);
        const users = Array.isArray(arr) ? arr : [];
        if (users.some(x => {
          const u = x?.user || x?.creator || x || {};
          return (u.urlname || u.url_name || u.username) === CFG.targetLiker;
        })) return true;
        if (users.length < 100) return false;
      } catch { break; }
    }
    for (let page=1; page<=8; page++) {
      try {
        const j = await getJson(`/api/v3/notes/${encodeURIComponent(key)}/likes?page=${page}&per_page=100`);
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

  function rankScore(c) {
    let s = 0;
    s += (c.topEmojiEndCount || 0) * 25;
    s += Math.min(40, (c.blocksWithEmojiEnd || 0) * 5);
    if (c.bearLiked) s += 120;
    return s;
  }

  function fmtDate(s) {
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return s || '';
    return d.toLocaleString('ja-JP', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  }

  function makeUI() {
    const host = document.createElement('div');
    host.id = 'cosmos-sub-finder-v2';
    host.style.cssText = 'position:fixed;right:10px;bottom:12px;z-index:2147483647;font-family:system-ui,sans-serif;color:#111';
    host.innerHTML = `
      <button id="csf-open" style="border:0;border-radius:999px;padding:12px 16px;background:#111;color:#fff;font-weight:800;box-shadow:0 4px 18px #0004">🕵️ コスモス条件探偵 v2</button>
      <div id="csf-panel" style="display:none;width:min(96vw,820px);max-height:82vh;overflow:auto;background:#fff;border:1px solid #ccc;border-radius:14px;box-shadow:0 10px 35px #0005;margin-top:8px;padding:12px">
        <div style="display:flex;gap:8px;align-items:center;position:sticky;top:-12px;background:#fff;padding:8px 0;z-index:2">
          <b style="flex:1">コスモス記事の条件だけで絞る</b>
          <button id="csf-run">厳密スキャン</button><button id="csf-close">×</button>
        </div>
        <div id="csf-status" style="font-size:12px;background:#f5f5f5;padding:8px;border-radius:8px;margin-bottom:8px">待機中</div>
        <div style="font-size:11px;line-height:1.55;margin-bottom:8px">
          必須：8/26 13:32以前 / <b>#はじめてのnote</b> / <b>公開記事総数=1</b> / <b>その1記事が固定</b><br>
          その後だけ、同じ絵文字を文末の句読点代わりに何回使うかで並べます。べあのスキは補助表示。
        </div>
        <div id="csf-results"></div>
      </div>`;
    document.body.appendChild(host);

    const panel = $('#csf-panel', host), statusEl = $('#csf-status', host), results = $('#csf-results', host);
    $('#csf-open',host).onclick = () => panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    $('#csf-close',host).onclick = () => panel.style.display = 'none';
    const status = s => statusEl.textContent = s;

    $('#csf-run',host).onclick = async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      results.innerHTML = '';
      try {
        const searched = await searchPeriod(status);
        let cands = searched.cands;
        const details = [];
        for (let i=0;i<cands.length;i++) {
          try {
            const c = await enrichDetail(cands[i],status,i+1,cands.length);
            if (c.hasFirstNoteTag) details.push(c);
          } catch {}
          await sleep(CFG.delayMs);
        }

        const hard = [];
        for (let i=0;i<details.length;i++) {
          const c = await hardCheck(details[i],status,i+1,details.length);
          if (c.hardPass) hard.push(c);
          await sleep(CFG.delayMs);
        }

        const bearTargets = [...hard]
          .sort((a,b) => (b.topEmojiEndCount||0)-(a.topEmojiEndCount||0))
          .slice(0, CFG.maxBearChecks);
        for (let i=0;i<bearTargets.length;i++) {
          const c = bearTargets[i];
          status(`④ べあのスキを補助確認 ${i+1}/${bearTargets.length}：${c.nickname}`);
          try { c.bearLiked = await bearLiked(c.key); } catch { c.bearLiked = false; }
          await sleep(CFG.delayMs);
        }

        hard.sort((a,b) => rankScore(b)-rankScore(a));
        status(`完了：検索${cands.length}件 → #はじめてのnote ${details.length}件 → 「公開1記事＋固定」${hard.length}人。`);

        if (!hard.length) {
          results.innerHTML = `<div style="padding:12px;background:#fff3cd;border-radius:10px"><b>厳密条件では0人。</b><br><span style="font-size:12px">この場合は「固定判定APIの仕様差」だけを疑うべきで、記事2件以上の人は候補に戻しません。</span></div>`;
          return;
        }

        results.innerHTML = hard.map((c,i) => {
          const article = `https://note.com/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`;
          const profile = `https://note.com/${encodeURIComponent(c.urlname)}`;
          const emojiList = (c.emojiEnds || []).slice(0,5).map(([em,n]) => `${em}×${n}文末`).join(' / ') || '文末絵文字なし';
          const ex = (c.emojiExamples || []).map(x => `<div style="font-size:11px;color:#555">・${esc(x)}</div>`).join('');
          return `<div style="border-top:1px solid #e6e6e6;padding:12px 2px">
            <div style="display:flex;gap:8px;align-items:center"><b style="font-size:19px">#${i+1} ${esc(c.nickname)}</b>${c.bearLiked ? '<span style="background:#ffe082;padding:2px 6px;border-radius:999px;font-size:11px">★べあスキ</span>' : ''}<strong style="margin-left:auto">${rankScore(c)}点</strong></div>
            <div style="font-size:12px;color:#555">@${esc(c.urlname)} / ${esc(fmtDate(c.publishAt))} / スキ${c.likes} / フォロワー${c.followerCount ?? '?'}</div>
            <div style="font-size:13px;margin-top:3px">${esc(c.title)}</div>
            <div style="margin:6px 0;padding:7px;background:#eefaf0;border-radius:8px;font-size:12px"><b>✅ 公開記事1件（noteCount=1 / archives=1）　✅ 固定記事　✅ #はじめてのnote</b></div>
            <div style="font-size:12px"><b>文末絵文字：</b>${esc(emojiList)} / 絵文字で終わる段落 ${c.blocksWithEmojiEnd}/${c.blockCount}</div>
            ${ex}
            <div style="display:flex;gap:12px;margin-top:7px"><a href="${profile}" target="_blank" style="font-weight:700">クリエイターページ</a><a href="${article}" target="_blank">固定記事</a></div>
          </div>`;
        }).join('');
      } catch (e) {
        console.error('[cosmos-sub-finder]', e);
        status(`エラー：${e.message || e}`);
      } finally {
        btn.disabled = false;
      }
    };
  }

  if (!document.getElementById('cosmos-sub-finder-v2')) makeUI();
})();
