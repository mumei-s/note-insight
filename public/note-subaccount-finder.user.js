// ==UserScript==
// @name         note サブ垢探偵｜文末絵文字連呼スキャナ
// @namespace    https://github.com/mumei-s/note-insight
// @version      1.4.0
// @description  #はじめてのnote候補から、同じ絵文字を文末の句点代わりに繰り返す新人を抽出します。
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
    delayMs: 90,
    minSameEmojiEnds: 3,
    targetLiker: 'bear_l_t_puzzle'
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = (s, root = document) => root.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ms = s => { const v = Date.parse(s || ''); return Number.isFinite(v) ? v : 0; };

  async function getJson(url) {
    const r = await fetch(url, { credentials: 'include', headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }

  const pick = (o, keys, fallback = '') => {
    for (const k of keys) if (o && o[k] != null) return o[k];
    return fallback;
  };

  const unwrap = j => {
    const d = j?.data ?? j ?? {};
    return d.note || d;
  };

  const userOf = n => n?.user || n?.creator || n?.note_user || {};
  const keyOf = n => pick(n, ['key','note_key','noteKey','slug']);
  const titleOf = n => pick(n, ['name','title']);
  const publishOf = n => pick(n, ['publish_at','publishAt','published_at','publishedAt','created_at']);
  const urlnameOf = n => pick(userOf(n), ['urlname','url_name','username'], pick(n,['urlname']));
  const nicknameOf = n => pick(userOf(n), ['nickname','name'], pick(n,['nickname'], urlnameOf(n)));
  const likesOf = n => Number(pick(n,['like_count','likeCount','likes_count'],0)) || 0;

  function textFromHtml(html) {
    const d = document.createElement('div');
    d.innerHTML = String(html || '')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n');
    return (d.innerText || d.textContent || '').replace(/\r/g,'');
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
    const start = ms(CFG.startJst), end = ms(CFG.endJst);
    let cursor = '0', pages = 0, reachedOld = false;
    const byKey = new Map();

    while (pages < CFG.maxSearchPages && !reachedOld) {
      pages++;
      status(`#はじめてのnote を遡り中… ${pages}ページ / ${byKey.size}件`);
      const u = `/api/v3/searches?context=note&q=${encodeURIComponent(CFG.query)}&size=${CFG.pageSize}&start=${encodeURIComponent(cursor)}&sort=new`;
      const j = await getJson(u);
      const { notes, cursor: next, isLast } = normalizeSearch(j);
      if (!notes.length) break;

      let oldest = Infinity;
      for (const n of notes) {
        const t = ms(publishOf(n));
        if (t) oldest = Math.min(oldest, t);
        if (t >= start && t <= end) {
          const key = keyOf(n);
          if (key) byKey.set(key, {
            key,
            title: titleOf(n),
            publishAt: publishOf(n),
            urlname: urlnameOf(n),
            nickname: nicknameOf(n),
            likes: likesOf(n)
          });
        }
      }
      if (oldest < start) reachedOld = true;
      if (isLast || next == null || String(next) === String(cursor)) break;
      cursor = String(next);
      await sleep(CFG.delayMs);
    }
    return [...byKey.values()];
  }

  // 1文/1段落の末尾に置かれた絵文字だけを数える。
  // 同じ行の「🤣🤣🤣」は1つの文末として1回だけ数える。
  const emojiClusterAtEnd = /((?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?(?:\u200D(?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?)?(?:[\u{1F3FB}-\u{1F3FF}])?)(?:\s*\1)*(?:[」』）】〉》]*)\s*$/u;

  function sentenceChunks(text) {
    const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
      // 長い1段落に複数文がある場合も、句点・感嘆符・疑問符の後で分ける。
      const parts = line.split(/(?<=[。！？!?])\s*/u).map(s => s.trim()).filter(Boolean);
      out.push(...parts);
    }
    return out;
  }

  function emojiEndStats(bodyHtml) {
    const text = textFromHtml(bodyHtml);
    const chunks = sentenceChunks(text);
    const counts = new Map();
    const examples = new Map();

    for (const chunk of chunks) {
      const m = chunk.match(emojiClusterAtEnd);
      if (!m) continue;
      const emoji = m[1];
      counts.set(emoji, (counts.get(emoji) || 0) + 1);
      if (!examples.has(emoji)) examples.set(emoji, []);
      const arr = examples.get(emoji);
      if (arr.length < 3) arr.push(chunk.slice(-80));
    }

    const ranked = [...counts.entries()].sort((a,b) => b[1] - a[1]);
    const [topEmoji, topCount] = ranked[0] || ['', 0];
    const totalEmojiEnds = ranked.reduce((s,[,n]) => s+n, 0);
    return {
      text,
      chunks: chunks.length,
      topEmoji,
      topCount,
      totalEmojiEnds,
      distinctEmojiEnds: ranked.length,
      examples: examples.get(topEmoji) || [],
      all: ranked
    };
  }

  async function fetchDetails(cands, status) {
    const out = [];
    for (let i=0; i<cands.length; i++) {
      const c = cands[i];
      status(`本文の文末絵文字を確認 ${i+1}/${cands.length}：${c.nickname || c.urlname}`);
      try {
        const j = await getJson(`/api/v3/notes/${encodeURIComponent(c.key)}`);
        const n = unwrap(j);
        c.title = titleOf(n) || c.title;
        c.publishAt = publishOf(n) || c.publishAt;
        c.urlname = urlnameOf(n) || c.urlname;
        c.nickname = nicknameOf(n) || c.nickname;
        c.likes = likesOf(n) || c.likes;
        const body = pick(n,['body','free_body','description'],'');
        Object.assign(c, emojiEndStats(body));
        if (c.topCount >= CFG.minSameEmojiEnds) out.push(c);
      } catch (e) {
        c.detailError = String(e.message || e);
      }
      await sleep(CFG.delayMs);
    }
    return out;
  }

  function normalizeContents(j) {
    const d = j?.data ?? j ?? {};
    const arr = d.contents || d.notes || d.items || [];
    const next = d.next_page ?? d.nextPage ?? j?.next_page ?? null;
    const last = d.is_last_page ?? d.isLastPage ?? j?.is_last_page ?? null;
    return { arr: Array.isArray(arr) ? arr : [], next, last };
  }

  async function enrichCreator(c, status) {
    status(`クリエイターページ確認：${c.nickname}`);
    try {
      const p1 = await getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}/contents?kind=note&page=1`);
      const x = normalizeContents(p1);
      c.visibleCount = x.arr.length;
      c.visibleOneArticle = x.arr.length === 1 && (x.last === true || (!x.next && x.arr.length < 10));
    } catch {
      c.visibleCount = null;
      c.visibleOneArticle = false;
    }
  }

  async function bearLiked(key) {
    for (let page=1; page<=8; page++) {
      let j;
      try { j = await getJson(`/api/v3/notes/${encodeURIComponent(key)}/likes?page=${page}&per_page=100`); }
      catch { return false; }
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

  function score(c) {
    let s = c.topCount * 20;
    if (c.topCount >= 5) s += 30;
    if (c.topCount >= 8) s += 40;
    if (c.visibleOneArticle) s += 50;
    if (c.bearLiked) s += 80;
    // 同じ絵文字への集中度が高いほど加点。
    if (c.totalEmojiEnds && c.topCount / c.totalEmojiEnds >= 0.6) s += 25;
    return s;
  }

  function makeUI() {
    const host = document.createElement('div');
    host.id = 'subacct-emoji-finder';
    host.style.cssText = 'position:fixed;right:10px;bottom:12px;z-index:2147483647;font-family:system-ui,sans-serif;color:#111';
    host.innerHTML = `
      <button id="sef-open" style="border:0;border-radius:999px;padding:12px 16px;background:#111;color:#fff;font-weight:800;box-shadow:0 4px 18px #0004">🔎 絵文字連呼探偵 v1.4</button>
      <div id="sef-panel" style="display:none;width:min(94vw,760px);max-height:80vh;overflow:auto;background:#fff;border:1px solid #ccc;border-radius:14px;box-shadow:0 10px 35px #0005;margin-top:8px;padding:12px">
        <div style="display:flex;gap:8px;align-items:center;position:sticky;top:-12px;background:#fff;padding:8px 0;z-index:2">
          <b style="flex:1">同じ文末絵文字を3回以上使う新人</b>
          <button id="sef-run">探索</button><button id="sef-close">×</button>
        </div>
        <div id="sef-status" style="font-size:12px;background:#f5f5f5;padding:8px;border-radius:8px;margin-bottom:8px">待機中</div>
        <div style="font-size:11px;margin-bottom:8px">8/20〜8/26 13:32 / #はじめてのnote / 同じ絵文字の文末使用3回以上だけ表示</div>
        <div id="sef-results"></div>
      </div>`;
    document.body.appendChild(host);

    const panel = $('#sef-panel',host), statusEl = $('#sef-status',host), results = $('#sef-results',host);
    $('#sef-open',host).onclick = () => panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    $('#sef-close',host).onclick = () => panel.style.display = 'none';
    const status = s => statusEl.textContent = s;

    $('#sef-run',host).onclick = async e => {
      const btn = e.currentTarget; btn.disabled = true; results.innerHTML = '';
      try {
        let cands = await searchPeriod(status);
        status(`期間内 ${cands.length}件。本文の文末絵文字を確認中…`);
        cands = await fetchDetails(cands,status);
        status(`同じ文末絵文字3回以上：${cands.length}人。記事数とべあスキを確認中…`);

        for (let i=0; i<cands.length; i++) {
          const c = cands[i];
          await enrichCreator(c,status);
          status(`補助確認 ${i+1}/${cands.length}：${c.nickname}`);
          try { c.bearLiked = await bearLiked(c.key); } catch { c.bearLiked = false; }
          await sleep(CFG.delayMs);
        }

        cands.sort((a,b) => score(b)-score(a));
        status(`完了：${cands.length}人。上ほど「同じ絵文字を句点代わり」に使う傾向が強い。`);

        results.innerHTML = cands.map((c,i) => {
          const article = `https://note.com/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`;
          const profile = `https://note.com/${encodeURIComponent(c.urlname)}`;
          const ex = (c.examples || []).map(x => `<div style="font-size:11px;color:#555">・${esc(x)}</div>`).join('');
          const all = c.all.slice(0,5).map(([em,n]) => `${em}×${n}`).join(' / ');
          return `<div style="border-top:1px solid #eee;padding:10px 2px">
            <div style="display:flex;gap:8px;align-items:center"><b style="font-size:18px">#${i+1} ${esc(c.nickname)}</b><strong style="margin-left:auto">${score(c)}点</strong></div>
            <div style="font-size:13px">${esc(c.title)}</div>
            <div style="font-size:12px;color:#444;margin:4px 0"><b>最頻文末絵文字 ${esc(c.topEmoji)} × ${c.topCount}</b> / 文末絵文字合計${c.totalEmojiEnds} / ${esc(all)}</div>
            <div style="font-size:12px">記事数: ${c.visibleCount ?? '?'} ${c.visibleOneArticle ? '★公開1記事' : ''} ${c.bearLiked ? '★べあがスキ' : ''}</div>
            ${ex}
            <div style="display:flex;gap:12px;margin-top:5px"><a href="${article}" target="_blank">記事</a><a href="${profile}" target="_blank">クリエイターページ</a></div>
          </div>`;
        }).join('') || '<b>同じ絵文字を文末に3回以上使う候補は0人</b>';
      } catch (err) {
        console.error(err);
        status(`エラー: ${err.message || err}`);
      } finally {
        btn.disabled = false;
      }
    };
  }

  if (!document.getElementById('subacct-emoji-finder')) makeUI();
})();