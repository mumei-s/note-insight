// ==UserScript==
// @name         note サブ垢探偵｜コスモス条件 v3.2
// @namespace    https://github.com/mumei-s/note-insight
// @version      3.2.0
// @description  公開1記事候補を先に全文解析し、同じ絵文字を別々の文末で3回以上使う候補を抽出。その後に固定記事・プロフィール・べあのスキを確認します。
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
    query: 'はじめてのnote',
    bear: 'bear_l_t_puzzle',
    delay: 75,
    maxPages: 1500,
    strongEmoji: 3,
    backupEmoji: 2,
    maxBearChecks: 60,
    excluded: new Set(['nazuki_days','mokushiroku1996','sab3317','nero_notelover','hoshi_yui2027','mute_mimosa375'])
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
    const d = j?.data ?? j ?? {}, notes = d.notes || {};
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
      const s = normalizeSearch(await getJson(`/api/v3/searches?context=note&q=${encodeURIComponent(C.query)}&size=20&start=${encodeURIComponent(cursor)}&sort=new`));
      if (!s.arr.length) break;
      let oldest = Infinity;
      for (const n of s.arr) {
        const t = toMs(publishOf(n));
        if (t) oldest = Math.min(oldest, t);
        if (t >= lo && t <= hi) {
          const key = keyOf(n), urlname = urlnameOf(n);
          if (key && urlname && !C.excluded.has(urlname)) {
            map.set(key, { key, title: titleOf(n), publish: publishOf(n), urlname, name: nicknameOf(n), likes: likesOf(n) });
          }
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
    const d = j?.data ?? j ?? {}, arr = Array.isArray(d.contents) ? d.contents : [];
    return { arr, total: Number.isFinite(Number(d.totalCount)) ? Number(d.totalCount) : null };
  }

  function profileState(creator) {
    const keys = ['profile','biography','bio','description','noteIntro','note_intro'];
    let saw = false;
    for (const k of keys) {
      if (!(k in (creator || {}))) continue;
      saw = true;
      if (typeof creator[k] === 'string' && creator[k].trim()) return 'yes';
    }
    return saw ? 'no' : 'unknown';
  }

  function pinState(item) {
    if (!item) return 'unknown';
    const b = boolPick(item, ['isPinned','is_pinned']);
    if (b != null) return b ? 'yes' : 'no';
    if (pick(item, ['pinnedUserNoteId','pinned_user_note_id'], null) != null) return 'yes';
    return 'unknown';
  }

  async function inspectCreator(c, status, i, total) {
    status(`② 公開記事数を確認 ${i}/${total}：${c.name || c.urlname}`);
    try {
      const [creatorJ, contentsJ] = await Promise.all([
        getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}`),
        getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}/contents?kind=note&page=1`),
      ]);
      const creator = creatorJ?.data ?? creatorJ ?? {}, cd = contentsData(contentsJ);
      const item = cd.arr.find(x => keyOf(x) === c.key) || (cd.arr.length === 1 ? cd.arr[0] : null);
      c.noteCount = Number.isFinite(Number(creator.noteCount ?? creator.note_count)) ? Number(creator.noteCount ?? creator.note_count) : null;
      c.followers = Number.isFinite(Number(creator.followerCount ?? creator.follower_count)) ? Number(creator.followerCount ?? creator.follower_count) : null;
      c.same = !!item && keyOf(item) === c.key;
      c.pin = pinState(item);
      c.profile = profileState(creator);
      try { c.archiveCount = archiveTotal(await getJson(`/api/v2/creators/${encodeURIComponent(c.urlname)}/archives`)); }
      catch { c.archiveCount = null; }
      const counts = [c.noteCount, c.archiveCount, cd.total].filter(v => v != null);
      if (counts.some(v => Number(v) > 1)) c.articleState = 'multi';
      else if (c.noteCount === 1 && c.archiveCount === 1) c.articleState = 'one';
      else if (counts.some(v => Number(v) === 1)) c.articleState = 'maybe';
      else c.articleState = 'unknown';
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
    const source = blocks.length ? blocks : [root], lines = [];
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
        for (const em of new Set([...m[1].matchAll(emojiGlobal)].map(x => x[0]))) {
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

  async function articleHtmlFallback(c) {
    try {
      const html = await getText(`/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const node = doc.querySelector('article') || doc.querySelector('main');
      return node ? node.innerHTML : '';
    } catch { return ''; }
  }

  async function inspectDetail(c, status, i, total) {
    status(`③ 1記事候補の全文絵文字解析 ${i}/${total}：${c.name}`);
    try {
      const j = await getJson(`/api/v3/notes/${encodeURIComponent(c.key)}`);
      const d = j?.data ?? j ?? {}, n = d.note || d;
      c.title = titleOf(n) || c.title;
      c.publish = publishOf(n) || c.publish;
      c.name = nicknameOf(n) || c.name;
      c.likes = likesOf(n) || c.likes;
      c.tags = collectTags(j);
      c.hasTargetTag = c.tags.includes('はじめてのnote') || c.tags.includes('初めてのnote');
      let body = pick(n, ['body','free_body','freeBody','description'], '');
      if (!(typeof body === 'string' && body.trim())) body = await articleHtmlFallback(c);
      c.bodyFetched = typeof body === 'string' && body.trim().length > 0;
      Object.assign(c, emojiStats(body));
    } catch (e) {
      c.detailError = String(e.message || e);
      const body = await articleHtmlFallback(c);
      c.bodyFetched = !!body;
      Object.assign(c, emojiStats(body));
    }
  }

  async function htmlStructure(c) {
    try {
      const html = await getText(`/${encodeURIComponent(c.urlname)}`);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const text = (doc.body?.textContent || '').replace(/\s+/g, ' ');
      const targetLink = [...doc.querySelectorAll('a[href]')].some(a => (a.getAttribute('href') || '').includes(`/n/${c.key}`));
      if (text.includes('固定された記事') && targetLink) c.pin = 'yes';
      if (c.profile === 'unknown') {
        const meta = doc.querySelector('meta[name="description"],meta[property="og:description"]')?.getAttribute('content') || '';
        if (meta.trim()) c.profile = 'maybe';
      }
    } catch {}
  }

  const oneArticle = c => c.articleState === 'one' || c.articleState === 'maybe';
  const strongEmoji = c => c.bodyFetched && c.topCount >= C.strongEmoji && c.examples.length >= C.strongEmoji;
  const backupEmoji = c => c.bodyFetched && c.topCount === C.backupEmoji && c.examples.length >= C.backupEmoji;

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
    return c.topCount * 150 + (c.articleState === 'one' ? 90 : 0) + (c.pin === 'yes' ? 100 : c.pin === 'no' ? -80 : 0) + (c.profile === 'yes' ? 80 : c.profile === 'no' ? -40 : 0) + (c.hasTargetTag ? 45 : 0) + (toMs(c.publish) >= toMs(C.likely) ? 30 : 0) + (c.bear ? 350 : 0);
  }

  function card(c, i) {
    const article = `https://note.com/${encodeURIComponent(c.urlname)}/n/${encodeURIComponent(c.key)}`;
    const profile = `https://note.com/${encodeURIComponent(c.urlname)}`;
    const articleState = c.articleState === 'one' ? '✅ 1件確定' : '△ 1件の可能性';
    const pin = c.pin === 'yes' ? '✅ 確認' : c.pin === 'no' ? '❌ 非固定' : '△ 判定不能';
    const prof = c.profile === 'yes' ? '✅ あり' : c.profile === 'no' ? '❌ なし' : c.profile === 'maybe' ? '△ ありそう' : '△ 判定不能';
    const emojis = c.emojiEnds.slice(0,8).map(([e,n]) => `${e} × ${n}文`).join(' / ');
    const ex = c.examples.slice(0,5).map(x => `<div style="font-size:11px;color:#555">「${esc(x)}」</div>`).join('');
    return `<div style="border-top:1px solid #ddd;padding:12px 2px">
      <div style="display:flex;gap:8px"><b style="font-size:19px">#${i+1} ${esc(c.name)}</b><b style="margin-left:auto">${score(c)}点</b></div>
      <div style="font-size:12px;color:#555">@${esc(c.urlname)} / ${esc(String(c.publish || '').slice(0,16).replace('T',' '))} / スキ${c.likes} / フォロワー${c.followers ?? '?'}</div>
      <div style="font-size:13px;margin:4px 0"><b>${esc(c.title)}</b></div>
      <div style="background:#eef8ef;padding:8px;border-radius:9px">記事数：<b>${articleState}</b> (noteCount=${c.noteCount ?? '?'} / archives=${c.archiveCount ?? '?'})<br>固定：<b>${pin}</b><br>プロフィール：<b>${prof}</b><br>タグ：${c.hasTargetTag ? '✅ #はじめてのnote' : c.tags?.length ? '△ 検索一致・対象タグ未確認' : '△ タグ判定不能'}<br>${toMs(c.publish) >= toMs(C.likely) ? '🔥 直前帯' : '広域候補'}</div>
      <div style="margin-top:7px"><b>文末絵文字：</b>${esc(emojis)}</div>${ex}
      <div style="margin-top:6px"><b>べあ：</b>${c.bear ? '★ スキ確認' : '未確認／見つからず'}</div>
      <div style="margin-top:7px"><a href="${article}" target="_blank">[記事]</a>　<a href="${profile}" target="_blank">[クリエイターページ]</a></div>
    </div>`;
  }

  function makeUI() {
    const host = document.createElement('div');
    host.id = 'cosmos-finder-v32';
    host.style.cssText = 'position:fixed;right:8px;bottom:10px;z-index:2147483647;font-family:system-ui;color:#111';
    host.innerHTML = `<button id="cf-open" style="border:0;border-radius:999px;padding:12px 15px;background:#111;color:#fff;font-weight:800">🕵️ コスモス探偵 v3.2</button>
      <div id="cf-panel" style="display:none;width:min(96vw,820px);max-height:85vh;overflow:auto;background:#fff;border-radius:15px;box-shadow:0 8px 30px #0006;margin-top:8px;padding:12px">
        <div style="display:flex;gap:8px;position:sticky;top:-12px;background:#fff;padding:8px 0;z-index:2"><b style="flex:1">1記事→全文絵文字→固定・プロフィール</b><button id="cf-run">探索</button><button id="cf-x">×</button></div>
        <div id="cf-status" style="font-size:12px;background:#f4f4f4;padding:8px;border-radius:8px">待機中</div>
        <div id="cf-count" style="font-size:11px;background:#fff8dc;padding:7px;border-radius:8px;margin:7px 0"></div>
        <div id="cf-results"></div>
      </div>`;
    document.body.appendChild(host);
    const panel = $('#cf-panel', host), statusEl = $('#cf-status', host), countEl = $('#cf-count', host), results = $('#cf-results', host);
    $('#cf-open', host).onclick = () => panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    $('#cf-x', host).onclick = () => panel.style.display = 'none';
    const status = s => statusEl.textContent = s;

    $('#cf-run', host).onclick = async e => {
      const btn = e.currentTarget; btn.disabled = true; results.innerHTML = ''; countEl.textContent = '';
      try {
        const raw = await searchCandidates(status), users = [], seen = new Set();
        for (const c of raw.sort((a,b) => toMs(b.publish) - toMs(a.publish))) {
          if (!seen.has(c.urlname)) { seen.add(c.urlname); users.push(c); }
        }

        let oneCount = 0, multi = 0;
        for (let i = 0; i < users.length; i++) {
          await inspectCreator(users[i], status, i + 1, users.length);
          if (oneArticle(users[i])) oneCount++;
          if (users[i].articleState === 'multi') multi++;
          if (i % 10 === 0) countEl.textContent = `検索${raw.length} / ユーザー${users.length} / 1記事${oneCount} / 複数${multi}`;
          await sleep(C.delay);
        }

        const one = users.filter(oneArticle);
        let bodyOk = 0;
        for (let i = 0; i < one.length; i++) {
          await inspectDetail(one[i], status, i + 1, one.length);
          if (one[i].bodyFetched) bodyOk++;
          countEl.textContent = `検索${raw.length} / 1記事${one.length} / 本文取得${bodyOk} / 同一絵文字3文以上 ${one.filter(strongEmoji).length}`;
          await sleep(C.delay);
        }

        const strong = one.filter(strongEmoji), backup = one.filter(backupEmoji);
        const structureTargets = [...strong, ...backup];
        for (let i = 0; i < structureTargets.length; i++) {
          status(`④ 固定・プロフィール再確認 ${i+1}/${structureTargets.length}：${structureTargets[i].name}`);
          await htmlStructure(structureTargets[i]);
          await sleep(C.delay);
        }

        const bearTargets = [...structureTargets].sort((a,b) => score(b) - score(a)).slice(0, C.maxBearChecks);
        for (let i = 0; i < bearTargets.length; i++) {
          status(`⑤ べあのスキ ${i+1}/${bearTargets.length}：${bearTargets[i].name}`);
          bearTargets[i].bear = await bearLiked(bearTargets[i].key);
          await sleep(C.delay);
        }

        strong.sort((a,b) => score(b) - score(a)); backup.sort((a,b) => score(b) - score(a));
        countEl.textContent = `検索${raw.length} / ユーザー${users.length} / 1記事${one.length} / 本文取得${bodyOk} / 同一絵文字3文以上${strong.length} / 2文${backup.length}`;
        status(`完了：本命 ${strong.length}人${strong.length ? '' : '（0〜1回の人は非表示）'}`);

        let html = strong.length ? `<h3>★ 同じ絵文字を3文以上で使用</h3>${strong.map(card).join('')}` : '<div style="padding:12px;background:#fff0f0;border-radius:9px"><b>同じ絵文字を3文以上で使う「公開1記事」候補は0人。</b><br>0〜1回の人は表示していません。</div>';
        if (backup.length) html += `<details><summary><b>補欠：同じ絵文字2文 (${backup.length})</b></summary>${backup.map(card).join('')}</details>`;
        results.innerHTML = html;
      } catch (err) {
        console.error(err); status(`エラー：${err.message || err}`);
      } finally { btn.disabled = false; }
    };
  }

  if (!document.getElementById('cosmos-finder-v32')) makeUI();
})();
