// ==UserScript==
// @name         note サブ垢探偵｜コスモス条件 v3.1
// @namespace    https://github.com/mumei-s/note-insight
// @version      3.1.0
// @description  公開1記事候補から固定・プロフィール設定を確認し、同じ絵文字を別々の文末で3回以上使う候補だけを表示します。
// @match        https://note.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
  'use strict';

  const C = {
    from: '2026-08-01T00:00:00+09:00',
    likely: '2026-08-22T00:00:00+09:00',
    to: '2026-08-26T13:32:00+09:00',
    q: 'はじめてのnote',
    bear: 'bear_l_t_puzzle',
    delay: 80,
    maxPages: 1500,
    minEmojiEnds: 3,
  };

  const $ = (s, r = document) => r.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const toMs = s => Date.parse(s || '') || 0;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pick = (o, keys, fallback = '') => { for (const k of keys) if (o && o[k] != null) return o[k]; return fallback; };
  const boolPick = (o, keys) => { for (const k of keys) if (o && typeof o[k] === 'boolean') return o[k]; return null; };

  async function getJson(url) {
    const r = await fetch(url, { credentials: 'include', headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }

  const userOf = n => n?.user || n?.creator || n?.note_user || {};
  const keyOf = n => pick(n, ['key','note_key','noteKey','slug']);
  const titleOf = n => pick(n, ['name','title']);
  const publishOf = n => pick(n, ['publish_at','publishAt','published_at','publishedAt','created_at']);
  const urlnameOf = n => pick(userOf(n), ['urlname','url_name','username'], pick(n, ['urlname']));
  const nicknameOf = n => pick(userOf(n), ['nickname','name'], pick(n, ['nickname'], urlnameOf(n)));
  const likesOf = n => Number(pick(n, ['like_count','likeCount','likes_count'], 0)) || 0;

  function normalizeSearch(j) {
    const d = j?.data ?? j ?? {};
    const notes = d.notes || {};
    const arr = notes.contents || notes.notes || d.contents || [];
    return {
      arr: Array.isArray(arr) ? arr : [],
      cursor: d?.cursor?.note ?? d.note_cursor ?? notes.next_cursor ?? notes.cursor ?? null,
      last: notes.is_last_page === true || notes.isLastPage === true,
    };
  }

  async function searchCandidates(status) {
    let cursor = '0', page = 0, done = false;
    const lo = toMs(C.from), hi = toMs(C.to), map = new Map();
    while (page < C.maxPages && !done) {
      page++;
      status(`① はじめてのnoteを遡り中 ${page}ページ / 期間内${map.size}件`);
      const s = normalizeSearch(await getJson(`/api/v3/searches?context=note&q=${encodeURIComponent(C.q)}&size=20&start=${encodeURIComponent(cursor)}&sort=new`));
      if (!s.arr.length) break;
      let oldest = Infinity;
      for (const n of s.arr) {
        const t = toMs(publishOf(n));
        if (t) oldest = Math.min(oldest, t);
        if (t >= lo && t <= hi) {
          const key = keyOf(n);
          if (key) map.set(key, { key, title: titleOf(n), publish: publishOf(n), urlname: urlnameOf(n), name: nicknameOf(n), likes: likesOf(n) });
        }
      }
      if (oldest < lo || s.last || s.cursor == null || String(s.cursor) === String(cursor)) done = true;
      else cursor = String(s.cursor);
      await sleep(C.delay);
    }
    return [...map.values()];
  }

  function archiveTotal(j) {
    const d = j?.data ?? j ?? [];
    if (!Array.isArray(d)) return null;
    let sum = 0, saw = false;
    for (const y of d) {
      if (Array.isArray(y?.details)) {
        for (const m of y.details) {
          const n = Number(m?.num);
          if (Number.isFinite(n)) { sum += n; saw = true; }
        }
      } else {
        const n = Number(y?.totalNum);
        if (Number.isFinite(n)) { sum += n; saw = true; }
      }
    }
    return saw ? sum : null;
  }

  function contentsData(j) {
    const d = j?.data ?? j ?? {};
    const arr = Array.isArray(d.contents) ? d.contents : [];
    return { arr, total: Number.isFinite(Number(d.totalCount)) ? Number(d.totalCount) : null };
  }

  function itemFlag(item, type) {
    if (!item) return 'unknown';
    const keys = type === 'pin' ? ['isPinned','is_pinned'] : ['isProfiled','is_profiled'];
    const b = boolPick(item, keys);
    if (b != null) return b ? 'yes' : 'no';
    if (type === 'pin' && pick(item, ['pinnedUserNoteId','pinned_user_note_id'], null) != null) return 'yes';
    return 'unknown';
  }

  async function inspectCreator(c, status, i, total) {
    status(`② 公開1記事・固定・プロフィール確認 ${i}/${total}：${c.name || c.urlname}`);
    try {
      const [creatorJ, contentsJ] = await Promise.all([
        getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}`),
        getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}/contents?kind=note&page=1`),
      ]);
      const creator = creatorJ?.data ?? creatorJ ?? {};
      const cd = contentsData(contentsJ);
      const item = cd.arr.find(x => keyOf(x) === c.key) || (cd.arr.length === 1 ? cd.arr[0] : null);
      c.noteCount = Number.isFinite(Number(creator.noteCount ?? creator.note_count)) ? Number(creator.noteCount ?? creator.note_count) : null;
      c.followers = Number.isFinite(Number(creator.followerCount ?? creator.follower_count)) ? Number(creator.followerCount ?? creator.follower_count) : null;
      c.same = !!item && keyOf(item) === c.key;
      c.pin = itemFlag(item, 'pin');
      c.profile = itemFlag(item, 'profile');
      c.profileTab = boolPick(creator, ['isCreatorProfileTabEnabled','is_creator_profile_tab_enabled']);
      try { c.archiveCount = archiveTotal(await getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}/archives`)); }
      catch { c.archiveCount = null; }
      const counts = [c.noteCount, c.archiveCount, cd.total].filter(v => v != null);
      if (counts.some(v => Number(v) > 1)) c.articleState = 'multi';
      else if (c.noteCount === 1 && c.archiveCount === 1) c.articleState = 'one';
      else if (counts.some(v => Number(v) === 1)) c.articleState = 'maybe';
      else c.articleState = 'unknown';
      if (c.profile === 'unknown' && c.profileTab === true && c.same) c.profile = 'maybe';
    } catch (e) {
      c.creatorError = String(e.message || e);
      c.articleState = 'unknown'; c.pin = 'unknown'; c.profile = 'unknown';
    }
  }

  const EMOJI = String.raw`(?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?(?:[\u{1F3FB}-\u{1F3FF}])?(?:\u200D(?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?(?:[\u{1F3FB}-\u{1F3FF}])?)*`;
  const emojiGlobal = new RegExp(EMOJI, 'gu');
  const emojiEnd = new RegExp(`((?:${EMOJI}\\s*)+)(?:[。．.!！?？…・~〜ーwｗ笑]*[」』）】〉》]*)\\s*$`, 'u');

  function textLinesFromHtml(html) {
    const doc = new DOMParser().parseFromString(`<main>${String(html || '')}</main>`, 'text/html');
    const root = doc.querySelector('main');
    if (!root) return [];
    for (const br of [...root.querySelectorAll('br')]) br.replaceWith(doc.createTextNode('\n'));
    const blocks = [...root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote')];
    const lines = [];
    const source = blocks.length ? blocks : [root];
    for (const el of source) {
      for (const line of String(el.textContent || '').split(/\n+/)) {
        const s = line.replace(/[\t\u00a0 ]+/g, ' ').trim();
        if (s) lines.push(s);
      }
    }
    return lines;
  }

  function emojiStats(html) {
    const lines = textLinesFromHtml(html), counts = new Map(), examples = new Map();
    for (const line of lines) {
      const chunks = line.split(/(?<=[。！？!?])\s*/u).map(s => s.trim()).filter(Boolean);
      for (const chunk of chunks.length ? chunks : [line]) {
        const m = chunk.match(emojiEnd);
        if (!m) continue;
        const set = new Set([...m[1].matchAll(emojiGlobal)].map(x => x[0]));
        for (const em of set) {
          counts.set(em, (counts.get(em) || 0) + 1);
          if (!examples.has(em)) examples.set(em, []);
          if (examples.get(em).length < 6) examples.get(em).push(chunk.slice(-120));
        }
      }
    }
    const ranked = [...counts.entries()].sort((a,b) => b[1] - a[1]);
    const [topEmoji, topCount] = ranked[0] || ['', 0];
    return { emojiEnds: ranked, topEmoji, topCount, examples: examples.get(topEmoji) || [], parsedLines: lines.length };
  }

  function collectTags(j) {
    const d = j?.data ?? j ?? {}, n = d.note || d, arr = n.hashtags || d.hashtags || [], out = [];
    for (const h of Array.isArray(arr) ? arr : []) {
      const x = typeof h === 'string' ? h : (h?.name || h?.hashtag || h?.tag);
      if (x) out.push(String(x).replace(/^#/, ''));
    }
    return out;
  }

  async function inspectDetail(c, status, i, total) {
    status(`③ 文末絵文字を全文解析 ${i}/${total}：${c.name}`);
    try {
      const j = await getJson(`/api/v3/notes/${encodeURIComponent(c.key)}`);
      const d = j?.data ?? j ?? {}, n = d.note || d;
      c.title = titleOf(n) || c.title;
      c.publish = publishOf(n) || c.publish;
      c.name = nicknameOf(n) || c.name;
      c.likes = likesOf(n) || c.likes;
      c.tags = collectTags(j);
      c.hasTargetTag = c.tags.includes('はじめてのnote') || c.tags.includes('初めてのnote');
      const body = pick(n, ['body','free_body','freeBody','description'], '');
      c.bodyFetched = typeof body === 'string' && body.length > 0;
      Object.assign(c, emojiStats(body));
    } catch (e) {
      c.detailError = String(e.message || e);
      c.bodyFetched = false; c.topCount = 0; c.examples = []; c.emojiEnds = [];
    }
  }

  const oneArticle = c => c.articleState === 'one' || c.articleState === 'maybe';
  const notNegative = x => x !== 'no';
  const structuralCandidate = c => oneArticle(c) && c.same && notNegative(c.pin) && notNegative(c.profile);
  const strongEmoji = c => c.bodyFetched && c.topCount >= C.minEmojiEnds && c.examples.length >= C.minEmojiEnds;

  async function bearLiked(key) {
    for (let page = 1; page <= 8; page++) {
      try {
        const j = await getJson(`/api/v3/notes/${encodeURIComponent(key)}/likes?page=${page}&per_page=100`);
        const d = j?.data ?? j ?? {}, arr = Array.isArray(d) ? d : (d.users || d.likes || d.contents || []);
        if (arr.some(x => { const u = x?.user || x?.creator || x || {}; return (u.urlname || u.url_name || u.username) === C.bear; })) return true;
        if ((d.next_page ?? j?.next_page) == null && arr.length < 100) break;
      } catch { break; }
    }
    return false;
  }

  function score(c) {
    return c.topCount * 120 + (c.pin === 'yes' ? 70 : 0) + (c.profile === 'yes' ? 80 : 0) + (c.articleState === 'one' ? 70 : 0) + (c.hasTargetTag ? 40 : 0) + (toMs(c.publish) >= toMs(C.likely) ? 25 : 0) + (c.bear ? 300 : 0);
  }

  function stateText(c) {
    const ac = c.articleState === 'one' ? '✅ 1件確定' : c.articleState === 'maybe' ? '△ 1件の可能性' : c.articleState === 'multi' ? '❌ 複数記事' : '△ 判定不能';
    const pin = c.pin === 'yes' ? '✅ 確認' : c.pin === 'no' ? '❌ 非固定' : '△ 判定不能';
    const prof = c.profile === 'yes' ? '✅ 設定' : c.profile === 'no' ? '❌ 未設定' : '△ 判定不能';
    return { ac, pin, prof };
  }

  function card(c, i) {
    const s = stateText(c);
    const article = `https://note.com/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`;
    const profile = `https://note.com/${encodeURIComponent(c.urlname)}`;
    const emo = c.emojiEnds.slice(0,8).map(([e,n]) => `${e} × ${n}文`).join(' / ');
    const ex = c.examples.slice(0,5).map(x => `<div style="font-size:11px;color:#555">「${esc(x)}」</div>`).join('');
    return `<div style="border-top:1px solid #ddd;padding:12px 2px">
      <div style="display:flex"><b style="font-size:18px">#${i+1} ${esc(c.name)}</b><b style="margin-left:auto">${score(c)}点</b></div>
      <div style="font-size:12px;color:#555">@${esc(c.urlname)} / ${esc(String(c.publish||'').slice(0,16).replace('T',' '))} / スキ${c.likes} / フォロワー${c.followers ?? '?'}</div>
      <div style="font-size:13px;margin:4px 0"><b>${esc(c.title)}</b></div>
      <div style="background:#f5f7f5;padding:8px;border-radius:9px">記事数：<b>${s.ac}</b> (noteCount=${c.noteCount ?? '?'} / archives=${c.archiveCount ?? '?'})<br>固定：<b>${s.pin}</b><br>プロフィール記事：<b>${s.prof}</b><br>タグ：${c.hasTargetTag ? '✅ #はじめてのnote' : '△ 検索一致・タグ判定不能/なし'}<br>本文解析：✅ ${c.parsedLines}行</div>
      <div style="margin-top:7px"><b>文末絵文字：</b>${esc(emo)}</div>${ex}
      <div style="margin-top:6px"><b>べあ：</b>${c.bear ? '★ スキ確認' : '未確認／見つからず'}</div>
      <div style="margin-top:7px"><a href="${article}" target="_blank">[記事]</a>　<a href="${profile}" target="_blank">[クリエイターページ]</a></div>
    </div>`;
  }

  function makeUI() {
    const host = document.createElement('div'); host.id = 'cosmos-finder-v31';
    host.style.cssText = 'position:fixed;right:8px;bottom:10px;z-index:2147483647;font-family:system-ui;color:#111';
    host.innerHTML = `<button id="open" style="border:0;border-radius:999px;padding:12px 15px;background:#111;color:#fff;font-weight:800">🕵️ コスモス探偵 v3.1</button>
    <div id="panel" style="display:none;width:min(96vw,820px);max-height:85vh;overflow:auto;background:#fff;border-radius:15px;box-shadow:0 8px 30px #0006;margin-top:8px;padding:12px">
      <div style="display:flex;gap:8px;position:sticky;top:-12px;background:#fff;padding:8px 0;z-index:2"><b style="flex:1">同一絵文字3文以上だけ表示</b><button id="run">探索</button><button id="close">×</button></div>
      <div id="status" style="font-size:12px;background:#f4f4f4;padding:8px;border-radius:8px">待機中</div>
      <div id="debug" style="font-size:11px;background:#fff8dc;padding:7px;border-radius:8px;margin:7px 0"></div>
      <div id="results"></div>
    </div>`;
    document.body.appendChild(host);
    const panel = $('#panel', host), statusEl = $('#status', host), debug = $('#debug', host), results = $('#results', host);
    const status = x => statusEl.textContent = x;
    $('#open', host).onclick = () => panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    $('#close', host).onclick = () => panel.style.display = 'none';
    $('#run', host).onclick = async e => {
      const btn = e.currentTarget; btn.disabled = true; results.innerHTML = ''; debug.textContent = '';
      try {
        const raw = await searchCandidates(status), users = [], seen = new Set();
        for (const c of raw.sort((a,b) => toMs(b.publish)-toMs(a.publish))) if (c.urlname && !seen.has(c.urlname)) { seen.add(c.urlname); users.push(c); }
        let oneN = 0, multiN = 0;
        for (let i=0;i<users.length;i++) {
          await inspectCreator(users[i], status, i+1, users.length);
          if (oneArticle(users[i])) oneN++; if (users[i].articleState === 'multi') multiN++;
          if (i % 10 === 0) debug.textContent = `検索${raw.length} / ユーザー${users.length} / 1記事${oneN} / 複数記事${multiN}`;
          await sleep(C.delay);
        }
        const structural = users.filter(structuralCandidate);
        for (let i=0;i<structural.length;i++) { await inspectDetail(structural[i], status, i+1, structural.length); await sleep(C.delay); }
        const strong = structural.filter(strongEmoji).sort((a,b) => score(b)-score(a));
        const two = structural.filter(c => c.bodyFetched && c.topCount === 2 && c.examples.length >= 2).sort((a,b) => score(b)-score(a));
        for (let i=0;i<Math.min(strong.length,80);i++) { status(`④ べあのスキ ${i+1}/${Math.min(strong.length,80)}：${strong[i].name}`); strong[i].bear = await bearLiked(strong[i].key); await sleep(C.delay); }
        strong.sort((a,b) => score(b)-score(a));
        debug.textContent = `検索${raw.length} / ユーザー${users.length} / 1記事${oneN} / 構造候補${structural.length} / 同一絵文字3文以上${strong.length} / 2文だけ${two.length}`;
        status(`完了：本命 ${strong.length}人`);
        let html = strong.length ? `<h3>★ 同じ絵文字を3文以上の文末で使用</h3>${strong.map(card).join('')}` : '<div style="padding:10px;background:#fff0f0"><b>同一絵文字3文以上の候補は0人。</b><br>絵文字0〜1回の人は表示していません。</div>';
        if (two.length) html += `<details><summary><b>補欠：同じ絵文字2文だけ (${two.length})</b></summary>${two.map(card).join('')}</details>`;
        results.innerHTML = html;
      } catch (err) { console.error(err); status(`エラー：${err.message || err}`); }
      finally { btn.disabled = false; }
    };
  }

  if (!document.getElementById('cosmos-finder-v31')) makeUI();
})();
