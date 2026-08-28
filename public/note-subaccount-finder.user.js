// ==UserScript==
// @name         note サブ垢探偵｜はじめてのnote候補スキャナ
// @namespace    https://github.com/mumei-s/note-insight
// @version      1.0.0
// @description  #はじめてのnoteを期間走査し、記事数・固定候補・文末絵文字・句読点・べあのスキを自動照合して候補をランキングします。
// @match        https://note.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const CFG = {
    startJst: '2026-08-23T00:00:00+09:00',
    endJst: '2026-08-26T13:32:00+09:00',
    hashtag: 'はじめてのnote',
    maxTagPages: 80,
    tagPageDelayMs: 120,
    creatorDelayMs: 80,
    likesDelayMs: 100,
    creatorCheckLimit: 140,
    likesCheckLimit: 50,
    targetLiker: 'bear_l_t_puzzle',
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = (s, root = document) => root.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toText = html => {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.innerText || d.textContent || '').replace(/\r/g, '');
  };
  const dateMs = s => Number.isFinite(Date.parse(s)) ? Date.parse(s) : 0;

  async function getJson(url) {
    const r = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }

  function deepFind(obj, predicate, seen = new Set()) {
    if (!obj || typeof obj !== 'object' || seen.has(obj)) return undefined;
    seen.add(obj);
    for (const [k, v] of Object.entries(obj)) {
      if (predicate(k, v)) return v;
      if (v && typeof v === 'object') {
        const hit = deepFind(v, predicate, seen);
        if (hit !== undefined) return hit;
      }
    }
    return undefined;
  }

  function noteKey(n) {
    return n.key || n.note_key || n.noteKey || n.slug || '';
  }
  function noteTitle(n) {
    return n.name || n.title || '';
  }
  function noteBody(n) {
    return n.body || n.free_body || n.description || '';
  }
  function notePublish(n) {
    return n.publish_at || n.publishAt || n.published_at || n.created_at || n.createdAt || '';
  }
  function userObj(n) {
    return n.user || n.creator || n.note_user || {};
  }
  function urlnameFrom(n) {
    const u = userObj(n);
    return u.urlname || u.url_name || u.username || n.urlname || '';
  }
  function nicknameFrom(n) {
    const u = userObj(n);
    return u.nickname || u.name || n.nickname || urlnameFrom(n);
  }
  function likeCount(n) {
    return Number(n.like_count ?? n.likeCount ?? n.likes_count ?? 0) || 0;
  }

  // 文末絵文字を「句読点化」している癖を拾う。
  // Unicode property escapes対応ブラウザ（現行Edge/Chrome）前提。
  const emojiEndRe = /(?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?(?:\u200D(?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?)?(?:[\u{1F3FB}-\u{1F3FF}])?[」』）】]*\s*$/u;
  const anyEmojiRe = /\p{Extended_Pictographic}/gu;

  function styleSignals(rawBody, title, nickname) {
    const text = toText(rawBody);
    const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
    let emojiEnd = 0, punctuation3 = 0, ellipsis = 0, short = 0;
    const emojis = new Map();

    for (const line of lines) {
      if (emojiEndRe.test(line)) emojiEnd++;
      punctuation3 += (line.match(/・・・/g) || []).length;
      ellipsis += (line.match(/……/g) || []).length;
      if (line.length <= 28) short++;
      for (const m of line.matchAll(anyEmojiRe)) emojis.set(m[0], (emojis.get(m[0]) || 0) + 1);
    }
    const topEmoji = [...emojis.entries()].sort((a,b) => b[1]-a[1])[0] || ['', 0];
    const emojiEndRatio = lines.length ? emojiEnd / lines.length : 0;
    const shortRatio = lines.length ? short / lines.length : 0;

    let score = 0;
    if (emojiEnd >= 2) score += Math.min(20, emojiEnd * 4);
    if (emojiEndRatio >= .18) score += 8;
    if (punctuation3) score += Math.min(10, punctuation3 * 3);
    if (ellipsis) score += Math.min(6, ellipsis * 2);
    if (shortRatio >= .45) score += 5;
    if (/はじめてのnote|初めてのnote|自己紹介/i.test(title)) score += 8;

    // 名前ヒントは弱い加点に留める。本文・記事数を優先。
    const name = `${nickname} ${title}`;
    const nameClues = [];
    const clueMap = [
      [/花|はな|華|コスモス|cosmos/i, '花系'],
      [/空|そら|星|月|宇宙|space|sky|star|moon/i, '宇宙系'],
      [/三人|3人|三つ|トリオ|trio/i, '3人系'],
      [/別|裏|影|もうひとり|ひとり|匿名|名無し|無名|sub|sab|サブ/i, '別人格系'],
    ];
    for (const [re, label] of clueMap) if (re.test(name)) { score += 4; nameClues.push(label); }

    return { text, lines: lines.length, emojiEnd, emojiEndRatio, punctuation3, ellipsis, shortRatio, topEmoji: topEmoji[0], topEmojiCount: topEmoji[1], nameClues, styleScore: score };
  }

  function normalizeTagPayload(j) {
    const d = j?.data ?? j ?? {};
    const notes = d.notes || j.notes || d.contents || [];
    const next = d.next_page ?? j.next_page ?? null;
    const last = d.is_last_page ?? j.is_last_page ?? d.isLastPage ?? false;
    return { notes: Array.isArray(notes) ? notes : [], next, last };
  }

  async function scanTag(status) {
    const start = dateMs(CFG.startJst), end = dateMs(CFG.endJst);
    const out = [];
    let page = 1;
    let reachedOld = false;

    while (page <= CFG.maxTagPages && !reachedOld) {
      status(`タグ新着を走査中… page ${page}`);
      const url = `/api/v3/hashtags/${encodeURIComponent(CFG.hashtag)}/notes?order=new&page=${page}&paid_only=false`;
      const j = await getJson(url);
      const { notes, next, last } = normalizeTagPayload(j);
      if (!notes.length) break;

      let oldest = Infinity;
      for (const n of notes) {
        const t = dateMs(notePublish(n));
        if (t) oldest = Math.min(oldest, t);
        if (t >= start && t <= end) {
          const sig = styleSignals(noteBody(n), noteTitle(n), nicknameFrom(n));
          out.push({
            note: n,
            key: noteKey(n),
            title: noteTitle(n),
            publishAt: notePublish(n),
            urlname: urlnameFrom(n),
            nickname: nicknameFrom(n),
            likes: likeCount(n),
            ...sig,
          });
        }
      }
      if (oldest < start) reachedOld = true;
      if (last) break;
      page = Number(next) || page + 1;
      await sleep(CFG.tagPageDelayMs);
    }
    return out;
  }

  function extractNoteCount(j) {
    const d = j?.data ?? j ?? {};
    const direct = d.noteCount ?? d.note_count ?? d.notesCount ?? d.notes_count;
    if (Number.isFinite(Number(direct))) return Number(direct);
    const found = deepFind(d, (k,v) => /^(noteCount|note_count)$/.test(k) && Number.isFinite(Number(v)));
    return Number.isFinite(Number(found)) ? Number(found) : null;
  }

  function extractPinnedKey(profileJson, contentsJson) {
    const values = [];
    const crawl = (o, depth=0) => {
      if (!o || typeof o !== 'object' || depth > 7) return;
      for (const [k,v] of Object.entries(o)) {
        if (/pinned/i.test(k) && (typeof v === 'string' || typeof v === 'number')) values.push(String(v));
        if (v && typeof v === 'object') crawl(v, depth+1);
      }
    };
    crawl(profileJson); crawl(contentsJson);
    return values;
  }

  async function enrichCreators(cands, status) {
    // 文体シグナルの強い順に絞ってAPI負荷を抑える。
    const uniq = new Map();
    for (const c of cands.sort((a,b) => b.styleScore-a.styleScore || b.likes-a.likes)) {
      if (c.urlname && !uniq.has(c.urlname)) uniq.set(c.urlname, c);
    }
    const targets = [...uniq.values()].slice(0, CFG.creatorCheckLimit);

    for (let i=0; i<targets.length; i++) {
      const c = targets[i];
      status(`クリエイターページ照合 ${i+1}/${targets.length}：${c.nickname}`);
      try {
        const [p, list] = await Promise.all([
          getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}`),
          getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}/contents?kind=note&page=1`),
        ]);
        c.noteCount = extractNoteCount(p);
        c.pinnedValues = extractPinnedKey(p, list);
        c.isOneArticle = c.noteCount === 1;
        c.isPinnedLikely = c.pinnedValues.some(v => c.key && v.includes(c.key));
        // 1記事は最大加点。固定一致が取れたらさらに加点。
        c.creatorScore = c.isOneArticle ? 35 : (c.noteCount === 2 ? 5 : -20);
        if (c.isPinnedLikely) c.creatorScore += 12;
      } catch (e) {
        c.noteCount = null;
        c.creatorError = String(e.message || e);
        c.creatorScore = -5;
      }
      await sleep(CFG.creatorDelayMs);
    }
    return targets;
  }

  async function hasTargetLiker(key) {
    if (!key) return false;
    for (let page=1; page<=5; page++) {
      let j;
      try {
        j = await getJson(`/api/v3/notes/${encodeURIComponent(key)}/likes?page=${page}&per_page=100`);
      } catch {
        // APIがページ引数を受けない場合のフォールバック
        if (page > 1) return false;
        j = await getJson(`/api/v3/notes/${encodeURIComponent(key)}/likes`);
      }
      const d = j?.data ?? j ?? {};
      const arr = Array.isArray(d) ? d : (d.users || d.likes || d.data || j.users || j.likes || []);
      const found = (Array.isArray(arr) ? arr : []).some(x => {
        const u = x.user || x.creator || x;
        return (u.urlname || u.url_name || u.username) === CFG.targetLiker;
      });
      if (found) return true;
      const next = d.next_page ?? j.next_page;
      const total = d.total_count ?? j.total_count;
      if (!next && !(Number(total) > page*100)) break;
    }
    return false;
  }

  async function enrichLikes(cands, status) {
    const targets = cands
      .filter(c => c.isOneArticle)
      .sort((a,b) => (b.styleScore+b.creatorScore) - (a.styleScore+a.creatorScore))
      .slice(0, CFG.likesCheckLimit);
    for (let i=0; i<targets.length; i++) {
      const c = targets[i];
      status(`べあのスキ照合 ${i+1}/${targets.length}：${c.nickname}`);
      try { c.bearLiked = await hasTargetLiker(c.key); }
      catch { c.bearLiked = false; }
      c.bearScore = c.bearLiked ? 45 : 0;
      await sleep(CFG.likesDelayMs);
    }
  }

  function finalScore(c) {
    return (c.styleScore || 0) + (c.creatorScore || 0) + (c.bearScore || 0);
  }

  function reason(c) {
    const a = [];
    if (c.isOneArticle) a.push('公開1記事');
    else if (c.noteCount != null) a.push(`記事${c.noteCount}件`);
    if (c.isPinnedLikely) a.push('固定一致');
    if (c.emojiEnd) a.push(`文末絵文字${c.emojiEnd}`);
    if (c.topEmoji) a.push(`最多${c.topEmoji}×${c.topEmojiCount}`);
    if (c.punctuation3) a.push(`・・・×${c.punctuation3}`);
    if (c.ellipsis) a.push(`……×${c.ellipsis}`);
    if (c.nameClues?.length) a.push(`名前:${c.nameClues.join('/')}`);
    if (c.bearLiked) a.push('★べあがスキ');
    return a.join(' / ');
  }

  function makeUI() {
    const host = document.createElement('div');
    host.id = 'subacct-finder';
    host.style.cssText = 'position:fixed;right:10px;bottom:12px;z-index:2147483647;font-family:system-ui,sans-serif;color:#111;';
    host.innerHTML = `
      <button id="saf-start" style="border:0;border-radius:999px;padding:12px 16px;background:#111;color:#fff;font-weight:800;box-shadow:0 4px 18px #0004">🕵️ サブ垢探偵</button>
      <div id="saf-panel" style="display:none;width:min(94vw,720px);max-height:78vh;overflow:auto;background:#fff;border:1px solid #ccc;border-radius:14px;box-shadow:0 10px 35px #0005;margin-top:8px;padding:12px">
        <div style="display:flex;gap:8px;align-items:center;position:sticky;top:-12px;background:#fff;padding:8px 0;z-index:2">
          <b style="flex:1">#はじめてのnote サブ垢候補</b>
          <button id="saf-run">高速スキャン</button><button id="saf-close">×</button>
        </div>
        <div id="saf-status" style="font-size:12px;background:#f5f5f5;padding:8px;border-radius:8px;margin-bottom:8px">待機中</div>
        <div style="font-size:11px;margin-bottom:8px">期間: 8/23 00:00〜8/26 13:32 JST / 条件: 1記事・文末絵文字・句読点・固定・べあスキ</div>
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
        let cands = await scanTag(status);
        status(`期間内 ${cands.length}記事。文体上位をクリエイターページ照合へ…`);
        cands = await enrichCreators(cands, status);
        await enrichLikes(cands, status);
        const ranked = cands
          .filter(c => c.isOneArticle)
          .sort((a,b) => finalScore(b)-finalScore(a));
        status(`完了：公開1記事の候補 ${ranked.length}人。上位から確認。`);
        results.innerHTML = ranked.slice(0,40).map((c,i) => {
          const article = `https://note.com/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`;
          const profile = `https://note.com/${encodeURIComponent(c.urlname)}`;
          return `<div style="border-top:1px solid #eee;padding:10px 2px">
            <div style="display:flex;gap:8px;align-items:center"><b style="font-size:18px">#${i+1} ${esc(c.nickname)}</b><strong style="margin-left:auto">${finalScore(c)}点</strong></div>
            <div style="font-size:13px">${esc(c.title)}</div>
            <div style="font-size:12px;color:#555">${esc(c.publishAt)} / スキ${c.likes}</div>
            <div style="font-size:12px;margin:4px 0">${esc(reason(c))}</div>
            <div style="display:flex;gap:10px"><a href="${article}" target="_blank">記事</a><a href="${profile}" target="_blank">クリエイターページ</a></div>
          </div>`;
        }).join('') || '<b>条件一致なし</b>';
      } catch (e) {
        console.error(e); status(`エラー: ${e.message || e}`);
      } finally { btn.disabled = false; }
    };
    return host;
  }

  if (!document.getElementById('subacct-finder')) makeUI();
})();
