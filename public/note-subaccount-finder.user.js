// ==UserScript==
// @name         note サブ垢探偵｜はじめてのnote候補スキャナ
// @namespace    https://github.com/mumei-s/note-insight
// @version      1.2.0
// @description  note検索APIの新着順を使い、古い#はじめてのnote候補を期間指定で拾い、公開1記事・文末絵文字・句読点・べあのスキを照合します。
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
    maxSearchPages: 350,
    requestDelayMs: 90,
    creatorLimit: 260,
    likerLimit: 80,
    targetLiker: 'bear_l_t_puzzle',
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const $ = (s, root = document) => root.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateMs = (s) => {
    const v = Date.parse(s || '');
    return Number.isFinite(v) ? v : 0;
  };
  const textFromHtml = (html) => {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.innerText || d.textContent || '').replace(/\r/g, '');
  };

  async function getJson(url) {
    const r = await fetch(url, { credentials: 'include', headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }

  const pick = (o, keys, fallback = '') => {
    for (const k of keys) if (o && o[k] != null) return o[k];
    return fallback;
  };
  const keyOf = n => pick(n, ['key', 'note_key', 'noteKey', 'slug']);
  const titleOf = n => pick(n, ['name', 'title']);
  const publishOf = n => pick(n, ['publish_at', 'publishAt', 'published_at', 'publishedAt', 'created_at']);
  const userOf = n => n?.user || n?.creator || n?.note_user || {};
  const urlnameOf = n => pick(userOf(n), ['urlname', 'url_name', 'username'], pick(n, ['urlname']));
  const nicknameOf = n => pick(userOf(n), ['nickname', 'name'], pick(n, ['nickname'], urlnameOf(n)));
  const likesOf = n => Number(pick(n, ['like_count', 'likeCount', 'likes_count'], 0)) || 0;

  function unwrapNoteDetail(j) {
    const d = j?.data ?? j ?? {};
    return d.note || d;
  }

  function collectHashtagNames(obj) {
    const out = new Set();
    const seen = new Set();
    const walk = (x, depth = 0) => {
      if (!x || typeof x !== 'object' || seen.has(x) || depth > 7) return;
      seen.add(x);
      if (Array.isArray(x)) {
        for (const v of x) walk(v, depth + 1);
        return;
      }
      for (const [k, v] of Object.entries(x)) {
        if (/hashtag/i.test(k)) {
          if (typeof v === 'string') out.add(v.replace(/^#/, ''));
          if (Array.isArray(v)) {
            for (const h of v) {
              if (typeof h === 'string') out.add(h.replace(/^#/, ''));
              else if (h && typeof h === 'object') {
                const nm = h.name || h.hashtag || h.tag;
                if (nm) out.add(String(nm).replace(/^#/, ''));
              }
            }
          }
        }
        if (v && typeof v === 'object') walk(v, depth + 1);
      }
    };
    walk(obj);
    return [...out];
  }

  const emojiEndRe = /(?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?(?:\u200D(?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?)?(?:[\u{1F3FB}-\u{1F3FF}])?[」』）】]*\s*$/u;
  const anyEmojiRe = /\p{Extended_Pictographic}/gu;

  function styleSignals(bodyHtml, title, nickname) {
    const text = textFromHtml(bodyHtml);
    const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
    let emojiEnd = 0, dots3 = 0, ellipsis = 0, short = 0;
    const em = new Map();
    for (const line of lines) {
      if (emojiEndRe.test(line)) emojiEnd++;
      dots3 += (line.match(/・・・/g) || []).length;
      ellipsis += (line.match(/……/g) || []).length;
      if (line.length <= 30) short++;
      for (const m of line.matchAll(anyEmojiRe)) em.set(m[0], (em.get(m[0]) || 0) + 1);
    }
    const top = [...em.entries()].sort((a, b) => b[1] - a[1])[0] || ['', 0];
    const emojiEndRatio = lines.length ? emojiEnd / lines.length : 0;
    const shortRatio = lines.length ? short / lines.length : 0;
    let styleScore = 0;
    if (emojiEnd >= 2) styleScore += Math.min(28, emojiEnd * 4);
    if (emojiEndRatio >= 0.15) styleScore += 8;
    if (top[1] >= 3) styleScore += Math.min(12, top[1] * 2);
    if (dots3) styleScore += Math.min(12, dots3 * 3);
    if (ellipsis) styleScore += Math.min(8, ellipsis * 2);
    if (shortRatio >= 0.45) styleScore += 5;
    if (/はじめてのnote|初めてのnote|自己紹介/i.test(title)) styleScore += 8;

    const name = `${nickname} ${title}`;
    const clues = [];
    for (const [re, label] of [
      [/花|はな|華|コスモス|cosmos/i, '花系'],
      [/空|そら|星|月|宇宙|space|sky|star|moon/i, '宇宙系'],
      [/3人|三人|トリオ|trio/i, '3人系'],
      [/別|裏|影|匿名|名無し|無名|sub|sab|サブ/i, '別人格系'],
    ]) if (re.test(name)) { styleScore += 4; clues.push(label); }

    return {
      text, lines: lines.length, emojiEnd, emojiEndRatio, dots3, ellipsis,
      shortRatio, topEmoji: top[0], topEmojiCount: top[1], nameClues: clues, styleScore
    };
  }

  function normalizeSearch(j) {
    const d = j?.data ?? j ?? {};
    const notesObj = d.notes || {};
    const notes = notesObj.contents || notesObj.notes || [];
    const cursor = d?.cursor?.note ?? d.note_cursor ?? notesObj.next_cursor ?? notesObj.cursor ?? null;
    const isLast = notesObj.is_last_page === true || notesObj.isLastPage === true;
    return { notes: Array.isArray(notes) ? notes : [], cursor, isLast };
  }

  async function searchPeriod(status) {
    const startMs = dateMs(CFG.startJst), endMs = dateMs(CFG.endJst);
    let cursor = '0';
    let pages = 0;
    let reachedOld = false;
    let newestSeen = 0, oldestSeen = Infinity;
    const byKey = new Map();

    while (pages < CFG.maxSearchPages && !reachedOld) {
      pages++;
      status(`検索APIを新着順で遡り中… ${pages}ページ / 候補${byKey.size}`);
      const u = `/api/v3/searches?context=note&q=${encodeURIComponent(CFG.query)}&size=${CFG.pageSize}&start=${encodeURIComponent(cursor)}&sort=new`;
      const j = await getJson(u);
      const { notes, cursor: nextCursor, isLast } = normalizeSearch(j);
      if (!notes.length) break;

      let pageOldest = Infinity;
      for (const n of notes) {
        const t = dateMs(publishOf(n));
        if (t) {
          newestSeen = Math.max(newestSeen, t);
          oldestSeen = Math.min(oldestSeen, t);
          pageOldest = Math.min(pageOldest, t);
        }
        if (t >= startMs && t <= endMs) {
          const k = keyOf(n);
          if (k) byKey.set(k, {
            key: k,
            title: titleOf(n),
            publishAt: publishOf(n),
            urlname: urlnameOf(n),
            nickname: nicknameOf(n),
            likes: likesOf(n),
            searchItem: n,
          });
        }
      }
      if (pageOldest < startMs) reachedOld = true;
      if (isLast) break;
      if (nextCursor == null || String(nextCursor) === String(cursor)) break;
      cursor = String(nextCursor);
      await sleep(CFG.requestDelayMs);
    }

    return { cands: [...byKey.values()], pages, reachedOld, newestSeen, oldestSeen };
  }

  async function enrichDetails(cands, status) {
    const out = [];
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i];
      status(`記事全文・タグ確認 ${i + 1}/${cands.length}：${c.nickname || c.urlname}`);
      try {
        const j = await getJson(`/api/v3/notes/${encodeURIComponent(c.key)}`);
        const n = unwrapNoteDetail(j);
        c.title = titleOf(n) || c.title;
        c.publishAt = publishOf(n) || c.publishAt;
        c.urlname = urlnameOf(n) || c.urlname;
        c.nickname = nicknameOf(n) || c.nickname;
        c.likes = likesOf(n) || c.likes;
        c.hashtags = collectHashtagNames(j);
        c.hasTargetTag = c.hashtags.some(x => x === 'はじめてのnote' || x === '初めてのnote') || /はじめてのnote|初めてのnote/i.test(c.title);
        Object.assign(c, styleSignals(pick(n, ['body', 'free_body', 'description'], ''), c.title, c.nickname));
        if (c.hasTargetTag) out.push(c);
      } catch (e) {
        c.detailError = String(e.message || e);
      }
      await sleep(CFG.requestDelayMs);
    }
    return out;
  }

  function normalizeCreatorContents(j) {
    const d = j?.data ?? j ?? {};
    const arr = d.contents || d.notes || d.items || [];
    const last = d.is_last_page ?? d.isLastPage ?? j?.is_last_page ?? null;
    const next = d.next_page ?? d.nextPage ?? j?.next_page ?? null;
    return { arr: Array.isArray(arr) ? arr : [], last, next };
  }

  function findPinned(j, targetKey) {
    const seen = new Set();
    let hit = false;
    const walk = (x, depth = 0) => {
      if (hit || !x || typeof x !== 'object' || seen.has(x) || depth > 8) return;
      seen.add(x);
      for (const [k, v] of Object.entries(x)) {
        if (/pinned|fixed|top_note/i.test(k)) {
          const s = typeof v === 'string' ? v : JSON.stringify(v);
          if (s && targetKey && s.includes(targetKey)) { hit = true; return; }
        }
        if (v && typeof v === 'object') walk(v, depth + 1);
      }
    };
    walk(j);
    return hit;
  }

  async function enrichCreators(cands, status) {
    const sorted = [...cands].sort((a, b) => b.styleScore - a.styleScore || b.likes - a.likes).slice(0, CFG.creatorLimit);
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      status(`クリエイターページ確認 ${i + 1}/${sorted.length}：${c.nickname}`);
      try {
        const [profile, p1, p2] = await Promise.all([
          getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}`),
          getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}/contents?kind=note&page=1`),
          getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}/archives`).catch(() => null),
        ]);
        const cc = normalizeCreatorContents(p1);
        c.visibleCountPage1 = cc.arr.length;
        c.visibleIsLast = cc.last === true || (!cc.next && cc.arr.length < 10);
        c.isOneVisibleArticle = c.visibleCountPage1 === 1 && c.visibleIsLast;
        c.isPinnedLikely = findPinned(profile, c.key) || findPinned(p1, c.key);
        c.creatorScore = c.isOneVisibleArticle ? 45 : (c.visibleCountPage1 === 1 ? 18 : -25);
        if (c.isPinnedLikely) c.creatorScore += 12;
        if (p2) c.archivesFetched = true;
      } catch (e) {
        c.creatorError = String(e.message || e);
        c.creatorScore = -5;
      }
      await sleep(CFG.requestDelayMs);
    }
    return sorted;
  }

  async function bearLiked(key) {
    for (let page = 1; page <= 8; page++) {
      const j = await getJson(`/api/v3/notes/${encodeURIComponent(key)}/likes?page=${page}&per_page=100`);
      const d = j?.data ?? j ?? {};
      const arr = Array.isArray(d) ? d : (d.users || d.likes || d.contents || []);
      const users = Array.isArray(arr) ? arr : [];
      if (users.some(x => {
        const u = x?.user || x?.creator || x || {};
        return (u.urlname || u.url_name || u.username) === CFG.targetLiker;
      })) return true;
      const next = d.next_page ?? j?.next_page;
      if (!next && users.length < 100) break;
    }
    return false;
  }

  async function enrichBear(cands, status) {
    const targets = [...cands]
      .sort((a,b) => ((b.isOneVisibleArticle ? 50 : 0) + b.styleScore) - ((a.isOneVisibleArticle ? 50 : 0) + a.styleScore))
      .slice(0, CFG.likerLimit);
    for (let i = 0; i < targets.length; i++) {
      const c = targets[i];
      status(`べあのスキ確認 ${i + 1}/${targets.length}：${c.nickname}`);
      try { c.bearLiked = await bearLiked(c.key); }
      catch { c.bearLiked = false; }
      c.bearScore = c.bearLiked ? 55 : 0;
      await sleep(CFG.requestDelayMs);
    }
  }

  const score = c => (c.styleScore || 0) + (c.creatorScore || 0) + (c.bearScore || 0);
  const reason = c => {
    const a = [];
    if (c.isOneVisibleArticle) a.push('★公開1記事');
    else if (c.visibleCountPage1 != null) a.push(`プロフィール1頁:${c.visibleCountPage1}件${c.visibleIsLast ? '/最終' : ''}`);
    if (c.isPinnedLikely) a.push('固定一致');
    if (c.emojiEnd) a.push(`文末絵文字${c.emojiEnd}`);
    if (c.topEmoji) a.push(`最多${c.topEmoji}×${c.topEmojiCount}`);
    if (c.dots3) a.push(`・・・×${c.dots3}`);
    if (c.ellipsis) a.push(`……×${c.ellipsis}`);
    if (c.nameClues?.length) a.push(`名前:${c.nameClues.join('/')}`);
    if (c.bearLiked) a.push('★★べあがスキ');
    return a.join(' / ');
  };

  function makeUI() {
    const host = document.createElement('div');
    host.id = 'subacct-finder';
    host.style.cssText = 'position:fixed;right:10px;bottom:12px;z-index:2147483647;font-family:system-ui,sans-serif;color:#111;';
    host.innerHTML = `
      <button id="saf-start" style="border:0;border-radius:999px;padding:12px 16px;background:#111;color:#fff;font-weight:800;box-shadow:0 4px 18px #0004">🕵️ サブ垢探偵 v1.2</button>
      <div id="saf-panel" style="display:none;width:min(94vw,760px);max-height:80vh;overflow:auto;background:#fff;border:1px solid #ccc;border-radius:14px;box-shadow:0 10px 35px #0005;margin-top:8px;padding:12px">
        <div style="display:flex;gap:8px;align-items:center;position:sticky;top:-12px;background:#fff;padding:8px 0;z-index:2">
          <b style="flex:1">#はじめてのnote 探偵 v1.2</b>
          <button id="saf-run">検索APIで探索</button><button id="saf-close">×</button>
        </div>
        <div id="saf-status" style="font-size:12px;background:#f5f5f5;padding:8px;border-radius:8px;margin-bottom:8px">待機中</div>
        <div style="font-size:11px;margin-bottom:8px">8/20〜8/26 13:32｜タグAPI1000件上限を使わず検索API新着カーソルで過去へ遡る｜全文→プロフィール記事数→べあスキ</div>
        <div id="saf-results"></div>
      </div>`;
    document.body.appendChild(host);
    const panel = $('#saf-panel', host), statusEl = $('#saf-status', host), results = $('#saf-results', host);
    $('#saf-start', host).onclick = () => panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    $('#saf-close', host).onclick = () => panel.style.display = 'none';
    const status = s => statusEl.textContent = s;

    $('#saf-run', host).onclick = async (ev) => {
      const btn = ev.currentTarget; btn.disabled = true; results.innerHTML = '';
      try {
        const scan = await searchPeriod(status);
        status(`期間内候補${scan.cands.length}件（検索${scan.pages}頁）。全文確認へ…`);
        let cands = await enrichDetails(scan.cands, status);
        status(`タグ/タイトル一致${cands.length}件。クリエイターページ確認へ…`);
        cands = await enrichCreators(cands, status);
        await enrichBear(cands, status);

        const one = cands.filter(c => c.isOneVisibleArticle).sort((a,b) => score(b) - score(a));
        const fallback = cands.filter(c => !c.isOneVisibleArticle).sort((a,b) => score(b) - score(a));
        const ranked = one.length ? [...one, ...fallback.slice(0, 20)] : fallback;
        status(`完了：期間候補${scan.cands.length} / タグ確認${cands.length} / 公開1記事${one.length}。${scan.reachedOld ? '指定期間まで到達済み' : '検索末尾/上限で停止'}`);

        results.innerHTML = ranked.slice(0, 60).map((c, i) => {
          const article = `https://note.com/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`;
          const profile = `https://note.com/${encodeURIComponent(c.urlname)}`;
          return `<div style="border-top:1px solid #eee;padding:10px 2px;${c.isOneVisibleArticle ? 'background:#fffdf1' : ''}">
            <div style="display:flex;gap:8px;align-items:center"><b style="font-size:18px">#${i+1} ${esc(c.nickname)}</b><strong style="margin-left:auto">${score(c)}点</strong></div>
            <div style="font-size:13px">${esc(c.title)}</div>
            <div style="font-size:12px;color:#555">${esc(c.publishAt)} / スキ${c.likes}</div>
            <div style="font-size:12px;margin:4px 0">${esc(reason(c))}</div>
            <div style="display:flex;gap:12px"><a href="${article}" target="_blank">記事</a><a href="${profile}" target="_blank">クリエイターページ</a></div>
          </div>`;
        }).join('') || '<b>候補0件。画面上部の進捗文をスクショしてください。</b>';
      } catch (e) {
        console.error(e);
        status(`エラー: ${e.message || e}`);
        results.innerHTML = `<pre style="white-space:pre-wrap">${esc(e.stack || e)}</pre>`;
      } finally { btn.disabled = false; }
    };
  }

  if (!document.getElementById('subacct-finder')) makeUI();
})();
