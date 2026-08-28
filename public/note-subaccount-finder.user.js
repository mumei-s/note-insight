// ==UserScript==
// @name         note サブ垢探偵｜コスモス条件 v3.3
// @namespace    https://github.com/mumei-s/note-insight
// @version      3.3.0
// @description  直近7日間の「はじめてのnote」から、その記事が固定＋プロフィール表示され、文末絵文字を複数回使う候補を抽出します。記事総数は条件にしません。
// @match        https://note.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
  'use strict';

  const C = {
    days: 7,
    query: 'はじめてのnote',
    bear: 'bear_l_t_puzzle',
    delay: 80,
    maxPages: 900,
    minEmojiEnds: 2,
    maxBearChecks: 80,
    excluded: new Set([
      'nazuki_days','mokushiroku1996','sab3317',
      'nero_notelover','hoshi_yui2027','mute_mimosa375'
    ])
  };

  const $ = (s, r = document) => r.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const nowMs = () => Date.now();
  const startMs = () => nowMs() - C.days * 24 * 60 * 60 * 1000;
  const parseMs = s => Date.parse(s || '') || 0;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const pick = (o, keys, fallback = '') => {
    for (const k of keys) if (o && o[k] != null) return o[k];
    return fallback;
  };
  const boolPick = (o, keys) => {
    for (const k of keys) if (o && typeof o[k] === 'boolean') return o[k];
    return null;
  };

  async function getJson(url) {
    const r = await fetch(url, {
      credentials: 'include',
      headers: { accept: 'application/json' }
    });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }

  async function getText(url) {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.text();
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
    const lo = startMs(), hi = nowMs();
    let cursor = '0', page = 0, done = false;
    const map = new Map();

    while (page < C.maxPages && !done) {
      page++;
      status(`① 直近7日を検索中 ${page}ページ / ${map.size}件`);
      const url = `/api/v3/searches?context=note&q=${encodeURIComponent(C.query)}&size=20&start=${encodeURIComponent(cursor)}&sort=new`;
      const s = normalizeSearch(await getJson(url));
      if (!s.arr.length) break;

      let oldest = Infinity;
      for (const n of s.arr) {
        const t = parseMs(publishOf(n));
        if (t) oldest = Math.min(oldest, t);
        if (t >= lo && t <= hi) {
          const key = keyOf(n), urlname = urlnameOf(n);
          if (key && urlname && !C.excluded.has(urlname)) {
            map.set(key, {
              key,
              title: titleOf(n),
              publish: publishOf(n),
              urlname,
              name: nicknameOf(n),
              likes: likesOf(n)
            });
          }
        }
      }

      if (oldest < lo || s.last || s.cursor == null || String(s.cursor) === String(cursor)) done = true;
      else cursor = String(s.cursor);
      await sleep(C.delay);
    }
    return [...map.values()];
  }

  function collectTags(j) {
    const out = new Set();
    const seen = new Set();
    const walk = (x, depth = 0) => {
      if (!x || typeof x !== 'object' || seen.has(x) || depth > 7) return;
      seen.add(x);
      if (Array.isArray(x)) {
        x.forEach(v => walk(v, depth + 1));
        return;
      }
      for (const [k, v] of Object.entries(x)) {
        if (/hashtag/i.test(k)) {
          if (typeof v === 'string') out.add(v.replace(/^#/, ''));
          if (Array.isArray(v)) {
            for (const h of v) {
              const name = typeof h === 'string' ? h : (h?.name || h?.hashtag || h?.tag || h?.hashtag_name);
              if (name) out.add(String(name).replace(/^#/, ''));
            }
          }
        }
        if (v && typeof v === 'object') walk(v, depth + 1);
      }
    };
    walk(j);
    return [...out];
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
    const source = blocks.length ? blocks : [root];
    const lines = [];
    for (const el of source) {
      for (const raw of String(el.textContent || '').split(/\n+/)) {
        const s = raw.replace(/[\t\u00a0 ]+/g, ' ').trim();
        if (s) lines.push(s);
      }
    }
    return lines;
  }

  function emojiStats(html) {
    const lines = textLinesFromHtml(html);
    const counts = new Map();
    const examples = [];
    let totalEnds = 0;

    for (const line of lines) {
      const chunks = line.split(/(?<=[。！？!?])\s*/u).map(s => s.trim()).filter(Boolean);
      for (const chunk of chunks.length ? chunks : [line]) {
        const m = chunk.match(emojiEnd);
        if (!m) continue;
        const emojis = [...m[1].matchAll(emojiGlobal)].map(x => x[0]);
        if (!emojis.length) continue;
        totalEnds++;
        for (const em of new Set(emojis)) counts.set(em, (counts.get(em) || 0) + 1);
        if (examples.length < 8) examples.push(chunk.slice(-140));
      }
    }

    const ranked = [...counts.entries()].sort((a,b) => b[1] - a[1]);
    const [topEmoji, topCount] = ranked[0] || ['', 0];
    return {
      totalEmojiEnds: totalEnds,
      emojiEnds: ranked,
      topEmoji,
      topCount,
      emojiKinds: ranked.length,
      examples,
      parsedLines: lines.length
    };
  }

  async function articleHtmlFallback(c) {
    try {
      const html = await getText(`/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const node = doc.querySelector('article') || doc.querySelector('main');
      return node?.innerHTML || '';
    } catch {
      return '';
    }
  }

  async function inspectDetail(c, status, i, total) {
    status(`② はじめてのnote＋文末絵文字 ${i}/${total}：${c.name}`);
    try {
      const j = await getJson(`/api/v3/notes/${encodeURIComponent(c.key)}`);
      const d = j?.data ?? j ?? {}, n = d.note || d;
      c.detailJson = j;
      c.title = titleOf(n) || c.title;
      c.publish = publishOf(n) || c.publish;
      c.name = nicknameOf(n) || c.name;
      c.likes = likesOf(n) || c.likes;
      c.tags = collectTags(j);
      c.firstNote = c.tags.includes('はじめてのnote') || c.tags.includes('初めてのnote') || /はじめてのnote|初めてのnote/i.test(c.title);
      let body = pick(n, ['body','free_body','freeBody','description'], '');
      if (!(typeof body === 'string' && body.trim())) body = await articleHtmlFallback(c);
      c.bodyFetched = !!(typeof body === 'string' && body.trim());
      Object.assign(c, emojiStats(body));
      c.detailPinned = boolPick(n, ['isPinned','is_pinned']);
      c.detailProfiled = boolPick(n, ['isProfiled','is_profiled']);
    } catch (e) {
      c.detailError = String(e.message || e);
      const body = await articleHtmlFallback(c);
      c.bodyFetched = !!body;
      Object.assign(c, emojiStats(body));
      c.firstNote = /はじめてのnote|初めてのnote/i.test(c.title);
      c.detailPinned = null;
      c.detailProfiled = null;
    }
  }

  function stateFromFlags(values) {
    if (values.some(v => v === true)) return 'yes';
    if (values.length && values.every(v => v === false)) return 'no';
    return 'unknown';
  }

  async function findTargetInContents(c) {
    const seen = new Set();
    const found = [];
    let totalCount = null;
    for (let page = 1; page <= 5; page++) {
      let j;
      try {
        j = await getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}/contents?kind=note&page=${page}`);
      } catch {
        break;
      }
      const d = j?.data ?? j ?? {};
      if (Number.isFinite(Number(d.totalCount))) totalCount = Number(d.totalCount);
      const arr = Array.isArray(d.contents) ? d.contents : [];
      for (const item of arr) {
        const k = keyOf(item);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        if (k === c.key) found.push(item);
      }
      const next = d.next_page ?? d.nextPage ?? j?.next_page;
      const last = d.is_last_page === true || d.isLastPage === true || j?.is_last_page === true;
      if (found.length || last || (!next && arr.length < 10)) break;
    }
    return { item: found[0] || null, totalCount };
  }

  async function inspectStructure(c, status, i, total) {
    status(`③ 固定＋プロフィール確認 ${i}/${total}：${c.name}`);
    const flagsPin = [];
    const flagsProfile = [];
    if (typeof c.detailPinned === 'boolean') flagsPin.push(c.detailPinned);
    if (typeof c.detailProfiled === 'boolean') flagsProfile.push(c.detailProfiled);

    try {
      const [creatorJ, list] = await Promise.all([
        getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}`),
        findTargetInContents(c)
      ]);
      const creator = creatorJ?.data ?? creatorJ ?? {};
      c.followers = Number.isFinite(Number(creator.followerCount ?? creator.follower_count)) ? Number(creator.followerCount ?? creator.follower_count) : null;
      c.noteCount = Number.isFinite(Number(creator.noteCount ?? creator.note_count)) ? Number(creator.noteCount ?? creator.note_count) : list.totalCount;
      const item = list.item;
      if (item) {
        const p = boolPick(item, ['isPinned','is_pinned']);
        const r = boolPick(item, ['isProfiled','is_profiled']);
        if (typeof p === 'boolean') flagsPin.push(p);
        if (typeof r === 'boolean') flagsProfile.push(r);
        if (pick(item, ['pinnedUserNoteId','pinned_user_note_id'], null) != null) flagsPin.push(true);
      }
    } catch (e) {
      c.structureError = String(e.message || e);
    }

    c.pin = stateFromFlags(flagsPin);
    c.profiled = stateFromFlags(flagsProfile);

    if (c.pin === 'unknown') {
      try {
        const html = await getText(`/${encodeURIComponent(c.urlname)}`);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const text = (doc.body?.textContent || '').replace(/\s+/g, ' ');
        const target = [...doc.querySelectorAll('a[href]')].some(a => (a.getAttribute('href') || '').includes(`/n/${c.key}`));
        if (text.includes('固定された記事') && target) c.pin = 'yes';
      } catch {}
    }
  }

  async function bearLiked(key) {
    for (let page = 1; page <= 8; page++) {
      try {
        const j = await getJson(`/api/v3/notes/${encodeURIComponent(key)}/likes?page=${page}&per_page=100`);
        const d = j?.data ?? j ?? {};
        const arr = Array.isArray(d) ? d : (d.users || d.likes || d.contents || []);
        if (arr.some(x => {
          const u = x?.user || x?.creator || x || {};
          return (u.urlname || u.url_name || u.username) === C.bear;
        })) return true;
        if ((d.next_page ?? j?.next_page) == null && arr.length < 100) break;
      } catch {
        break;
      }
    }
    return false;
  }

  const emojiCandidate = c => c.bodyFetched && c.totalEmojiEnds >= C.minEmojiEnds;
  const structureCandidate = c => c.firstNote && c.pin !== 'no' && c.profiled !== 'no';
  const exactStructure = c => c.firstNote && c.pin === 'yes' && c.profiled === 'yes';

  function score(c) {
    let s = 0;
    s += c.totalEmojiEnds * 70;
    s += c.topCount * 35;
    s += Math.min(60, c.emojiKinds * 15);
    if (c.pin === 'yes') s += 180;
    if (c.profiled === 'yes') s += 220;
    if (c.firstNote) s += 80;
    if (c.bear) s += 300;
    return s;
  }

  function card(c, i) {
    const article = `https://note.com/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`;
    const profile = `https://note.com/${encodeURIComponent(c.urlname)}`;
    const pin = c.pin === 'yes' ? '✅ 固定' : c.pin === 'no' ? '❌ 非固定' : '△ 固定判定不能';
    const prof = c.profiled === 'yes' ? '✅ プロフィール表示' : c.profiled === 'no' ? '❌ プロフィール未設定' : '△ プロフィール判定不能';
    const em = c.emojiEnds.length ? c.emojiEnds.slice(0,8).map(([e,n]) => `${e}×${n}文末`).join(' / ') : 'なし';
    const ex = c.examples.slice(0,5).map(x => `<div style="font-size:11px;color:#555">「${esc(x)}」</div>`).join('');
    return `<div style="border-top:1px solid #ddd;padding:12px 2px">
      <div style="display:flex;gap:8px"><b style="font-size:18px">#${i+1} ${esc(c.name)}</b><b style="margin-left:auto">${score(c)}点</b></div>
      <div style="font-size:12px;color:#555">@${esc(c.urlname)} / ${esc(String(c.publish || '').slice(0,16).replace('T',' '))} / 記事${c.noteCount ?? '?'} / スキ${c.likes} / フォロワー${c.followers ?? '?'}</div>
      <div style="font-size:13px;margin:4px 0"><b>${esc(c.title)}</b></div>
      <div style="background:#eef8f0;padding:8px;border-radius:9px">
        ${c.firstNote ? '✅' : '△'} はじめてのnote<br>
        ${pin}<br>${prof}
      </div>
      <div style="margin-top:6px"><b>文末絵文字：${c.totalEmojiEnds}文 / ${c.emojiKinds}種類</b><br>${esc(em)}</div>
      ${ex}
      <div style="margin-top:6px"><b>べあ：</b>${c.bear ? '★ スキ確認' : '未確認／見つからず'}</div>
      <div style="margin-top:7px"><a href="${article}" target="_blank">[記事]</a>　<a href="${profile}" target="_blank">[クリエイターページ]</a></div>
    </div>`;
  }

  function makeUI() {
    const host = document.createElement('div');
    host.id = 'cosmos-finder-v33';
    host.style.cssText = 'position:fixed;right:8px;bottom:10px;z-index:2147483647;font-family:system-ui,sans-serif;color:#111';
    host.innerHTML = `
      <button id="cf-open" style="border:0;border-radius:999px;padding:12px 15px;background:#111;color:#fff;font-weight:800">🕵️ コスモス探偵 v3.3</button>
      <div id="cf-panel" style="display:none;width:min(96vw,820px);max-height:85vh;overflow:auto;background:#fff;border-radius:15px;box-shadow:0 8px 30px #0006;margin-top:8px;padding:12px">
        <div style="display:flex;gap:8px;position:sticky;top:-12px;background:#fff;padding:8px 0;z-index:2">
          <b style="flex:1">直近7日｜固定＋プロフィール＋文末絵文字</b><button id="cf-run">探索</button><button id="cf-x">×</button>
        </div>
        <div id="cf-status" style="font-size:12px;background:#f4f4f4;padding:8px;border-radius:8px">待機中</div>
        <div id="cf-debug" style="font-size:11px;background:#fff8dc;padding:7px;border-radius:8px;margin:7px 0"></div>
        <div id="cf-results"></div>
      </div>`;
    document.body.appendChild(host);

    const panel = $('#cf-panel', host), statusEl = $('#cf-status', host), debug = $('#cf-debug', host), results = $('#cf-results', host);
    $('#cf-open', host).onclick = () => panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    $('#cf-x', host).onclick = () => panel.style.display = 'none';
    const status = s => statusEl.textContent = s;

    $('#cf-run', host).onclick = async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      results.innerHTML = '';
      debug.textContent = '';
      try {
        const raw = await searchCandidates(status);
        const detail = [];
        for (let i = 0; i < raw.length; i++) {
          await inspectDetail(raw[i], status, i + 1, raw.length);
          if (raw[i].firstNote && emojiCandidate(raw[i])) detail.push(raw[i]);
          if (i % 10 === 0) debug.textContent = `検索${raw.length} / 文末絵文字2文以上${detail.length}`;
          await sleep(C.delay);
        }

        for (let i = 0; i < detail.length; i++) {
          await inspectStructure(detail[i], status, i + 1, detail.length);
          await sleep(C.delay);
        }

        const eligible = detail.filter(structureCandidate);
        const exact = eligible.filter(exactStructure);
        const uncertain = eligible.filter(c => !exactStructure(c));

        const bearTargets = [...eligible].sort((a,b) => score(b) - score(a)).slice(0, C.maxBearChecks);
        for (let i = 0; i < bearTargets.length; i++) {
          status(`④ べあのスキ ${i+1}/${bearTargets.length}：${bearTargets[i].name}`);
          bearTargets[i].bear = await bearLiked(bearTargets[i].key);
          await sleep(C.delay);
        }

        exact.sort((a,b) => score(b) - score(a));
        uncertain.sort((a,b) => score(b) - score(a));
        debug.textContent = `検索${raw.length} / 文末絵文字2文以上${detail.length} / 固定＋プロフィール確定${exact.length} / 判定不能含む${uncertain.length}`;
        status(`完了：本命${exact.length}人 / 判定不能候補${uncertain.length}人`);

        let html = exact.length
          ? `<h3>★ 本命：固定＋プロフィール確認済み</h3>${exact.map(card).join('')}`
          : `<div style="padding:9px;background:#fff0f0"><b>固定＋プロフィールまで両方確認できた本命は0人。</b></div>`;

        if (uncertain.length) {
          html += `<details><summary><b>△ 固定またはプロフィール判定不能 (${uncertain.length})</b></summary>${uncertain.map(card).join('')}</details>`;
        }
        if (!detail.length) {
          html += `<div style="padding:9px;background:#fff0f0"><b>直近7日の「はじめてのnote」で、文末絵文字を2文以上使う記事が取得できませんでした。</b></div>`;
        }
        results.innerHTML = html;
      } catch (err) {
        console.error(err);
        status(`エラー：${err.message || err}`);
      } finally {
        btn.disabled = false;
      }
    };
  }

  if (!document.getElementById('cosmos-finder-v33')) makeUI();
})();
