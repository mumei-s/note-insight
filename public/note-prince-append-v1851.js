(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_PRINCE_APPEND_1851__) return;
  page.__MUMEI_PRINCE_APPEND_1851__ = true;

  const VERSION = '18.5.1';
  const BASE_VERSION = '16.0.0';
  const PANEL = 'mumei-note-source-picker-v163';
  const SPECIAL = 'mumei-prince-special-v184';
  const STATUS = 'mumei-note-source-status-v163';
  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const EXPORT_URL = 'https://mumei-s.github.io/note-insight/insight-likes-export.html';
  const INSIGHT_ORIGIN = 'https://mumei-s.github.io';
  const TARGET = 500;
  const INSIGHT_CANDIDATES = 1500;
  let busy = false;
  let bridgeWaiter = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  function articleKey() { return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || ''; }
  function enabled() { return /^\/notes\/n[a-z0-9]{8,}\/edit\/?$/i.test(location.pathname) && Boolean(articleKey()); }
  function runKey() { return `${RUN_PREFIX}:${articleKey() || 'unknown'}`; }
  function getJSON(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch (_) { return fallback; }
  }
  function setJSON(key, value) {
    try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try { const u = new URL(raw, location.href); u.search = ''; u.hash = ''; return u.href; } catch (_) { return raw; }
  }
  function normUser(value) { return String(value || '').trim().replace(/^@/, '').toLowerCase(); }
  function parseTime(value) { const t = Date.parse(String(value || '')); return Number.isFinite(t) && t > 0 ? t : 0; }
  function status(text, bad = false) {
    for (const id of [STATUS, 'mumei-likers-thin-status-v160']) {
      const el = document.getElementById(id);
      if (el) { el.textContent = text; el.dataset.bad = bad ? '1' : '0'; }
    }
  }
  function setBusy(value) {
    busy = Boolean(value);
    const box = document.querySelector(`.${SPECIAL}`);
    if (box) box.querySelectorAll('button,input').forEach((node) => { node.disabled = busy; });
  }
  function gm(url, timeout = 45000) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout, responseType: 'text', anonymous: false,
        headers: { Accept: 'application/json,text/plain,*/*' },
        onload: (r) => r.status >= 200 && r.status < 300 ? resolve(r) : reject(new Error(`HTTP ${r.status}`)),
        onerror: () => reject(new Error('通信失敗')),
        ontimeout: () => reject(new Error('通信タイムアウト'))
      });
    });
  }
  async function jsonGet(url) {
    const r = await gm(url);
    try { return JSON.parse(String(r.responseText || '')); } catch (_) { throw new Error(`JSON解析失敗: ${url}`); }
  }
  async function mapLimit(items, limit, fn) {
    const out = new Array(items.length); let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
      while (true) { const index = cursor++; if (index >= items.length) return; out[index] = await fn(items[index], index); }
    });
    await Promise.all(workers); return out;
  }
  function contentList(payload) {
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    return Array.isArray(data.contents) ? data.contents : Array.isArray(data.notes) ? data.notes : [];
  }
  function thumbOf(note) {
    return [note?.eyecatch_url,note?.eyecatch,note?.image_url,note?.imageUrl,note?.thumbnail_url,note?.thumbnailUrl,note?.eyecatch?.url,note?.image?.url]
      .find((v) => typeof v === 'string' && v.trim()) || '';
  }
  function articleFromRaw(raw, creator) {
    const note = raw?.note && typeof raw.note === 'object' ? raw.note : raw;
    if (!note || typeof note !== 'object') return null;
    const key = String(note?.key || '').trim();
    if (!/^n[a-f0-9]{12}$/i.test(key)) return null;
    const user = note?.user || note?.author || {};
    const urlname = normUser(creator?.urlname || user?.urlname || user?.url_name);
    if (!urlname) return null;
    let thumbUrl = thumbOf(note) || String(creator?.actorImageUrl || user?.profileImageUrl || user?.profile_image_url || user?.user_profile_image_url || '');
    if (thumbUrl.startsWith('//')) thumbUrl = `https:${thumbUrl}`;
    return {
      ...(creator || {}), likerKey:String(creator?.likerKey || user?.key || user?.id || urlname), urlname,
      creator:String(creator?.creator || user?.nickname || user?.name || urlname).trim(), actorUrl:String(creator?.actorUrl || `https://note.com/${urlname}`),
      actorImageUrl:String(creator?.actorImageUrl || user?.profileImageUrl || user?.profile_image_url || user?.user_profile_image_url || '').trim(),
      url:normalizeUrl(note?.noteUrl || note?.url || `https://note.com/${urlname}/n/${key}`), title:String(note?.name || note?.title || '無題の記事').trim(),
      latestKey:key, publishAt:String(note?.publishAt || note?.publish_at || note?.published_at || note?.publishedAt || note?.created_at || note?.createdAt || '').trim() || null, thumbUrl
    };
  }
  async function creatorContents(urlname, pageNo = 1, disabledPinned = true) {
    const payload = await jsonGet(`https://note.com/api/v2/creators/${encodeURIComponent(urlname)}/contents?kind=note&page=${pageNo}&disabled_pinned=${disabledPinned ? 'true' : 'false'}&with_notes=false`);
    await sleep(50); return payload;
  }
  async function trueOldest(creator) {
    const firstPayload = await creatorContents(creator.urlname,1,true); const first = contentList(firstPayload); if (!first.length) return null;
    const data = firstPayload?.data && typeof firstPayload.data === 'object' ? firstPayload.data : {};
    const total = Number(data.totalCount || data.total_count || 0), per = Math.max(1, first.length), lastPage = total > per ? Math.min(500,Math.ceil(total/per)) : 1;
    const last = lastPage > 1 ? contentList(await creatorContents(creator.urlname,lastPage,true)) : first;
    const rows = last.map((raw)=>articleFromRaw(raw,creator)).filter(Boolean); rows.sort((a,b)=>parseTime(a.publishAt)-parseTime(b.publishAt));
    return rows[0] || articleFromRaw(first[first.length-1],creator);
  }
  async function chooseArticle(creator, mode) {
    try {
      if (mode === 'oldest') return await trueOldest(creator);
      if (mode === 'fixed') return articleFromRaw(contentList(await creatorContents(creator.urlname,1,false))[0],creator);
      if (mode === 'auto') {
        const pinned = articleFromRaw(contentList(await creatorContents(creator.urlname,1,false))[0],creator);
        const latest = articleFromRaw(contentList(await creatorContents(creator.urlname,1,true))[0],creator);
        return pinned && latest && pinned.latestKey !== latest.latestKey ? pinned : (latest || pinned);
      }
      return articleFromRaw(contentList(await creatorContents(creator.urlname,1,true))[0],creator);
    } catch (_) { return null; }
  }
  function currentChoice() {
    const panel = document.getElementById(PANEL);
    if (panel?.querySelector('[data-lite-auto].active')) return 'auto';
    return panel?.querySelector('button[data-choice].active')?.dataset.choice || localStorage.getItem('mumei_insight_lite_choice_v183') || 'latest';
  }
  function choiceLabel(value) { return value === 'fixed' ? '固定' : value === 'oldest' ? '最古' : value === 'auto' ? '自動' : '最新'; }

  function requestInsightCandidates() {
    return new Promise((resolve,reject)=>{
      const requestId = `prince-append-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const url = new URL(EXPORT_URL); url.searchParams.set('request',requestId); url.searchParams.set('count',String(INSIGHT_CANDIDATES)); url.searchParams.set('unique','1');
      const popup = window.open(url.href,'_blank'); if (!popup) return reject(new Error('INSIGHT取得画面を開けません'));
      const timer = setTimeout(()=>{ if (bridgeWaiter?.requestId===requestId) bridgeWaiter=null; reject(new Error('INSIGHT取得タイムアウト')); },120000);
      bridgeWaiter={requestId,resolve,reject,timer};
    });
  }
  window.addEventListener('message',(event)=>{
    if (event.origin!==INSIGHT_ORIGIN || !bridgeWaiter) return;
    const data=event.data; if (!data || data.type!=='MUMEI_INSIGHT_LIKES_V1' || data.requestId!==bridgeWaiter.requestId) return;
    const waiter=bridgeWaiter; bridgeWaiter=null; clearTimeout(waiter.timer); data.ok===true ? waiter.resolve(data) : waiter.reject(new Error(String(data.error||'INSIGHT取得失敗')));
  });

  async function collectInsight(mode) {
    status(`INSIGHTスキ候補取得中｜人物重複なし｜目標${TARGET}人｜${choiceLabel(mode)}`);
    const payload=await requestInsightCandidates(); const me=normUser(payload?.member?.noteId); const candidates=[]; const seenPeople=new Set();
    for (const raw of Array.isArray(payload?.rows)?payload.rows:[]) {
      const fromUrl=String(raw?.actorUrl||'').match(/^https?:\/\/(?:www\.)?note\.com\/([^/?#]+)/i)?.[1]||'';
      const urlname=normUser(raw?.urlname||fromUrl), identity=String(raw?.likerKey||urlname).trim();
      if (!urlname || urlname===me || !identity || seenPeople.has(identity)) continue;
      seenPeople.add(identity); candidates.push({urlname,likerKey:identity,creator:String(raw?.creator||urlname),actorUrl:String(raw?.actorUrl||`https://note.com/${urlname}`),actorImageUrl:String(raw?.actorImageUrl||''),likedAt:raw?.likedAt||null,likedArticleKey:String(raw?.likedArticleKey||'')});
    }
    if (!candidates.length) throw new Error('INSIGHTに対象スキ履歴がありません');
    const rows=[], usedPeople=new Set(), usedUrls=new Set(), batchSize=5;
    for (let start=0; start<candidates.length && rows.length<TARGET; start+=batchSize) {
      const batch=candidates.slice(start,start+batchSize), chosen=await mapLimit(batch,5,(creator)=>chooseArticle(creator,mode));
      for (const row of chosen) {
        if (!row) continue; const person=normUser(row.urlname), url=normalizeUrl(row.url);
        if (!person || usedPeople.has(person) || !url || usedUrls.has(url)) continue;
        usedPeople.add(person); usedUrls.add(url); rows.push({...row,url,combinedSource:'insight'}); if (rows.length>=TARGET) break;
      }
      status(`INSIGHT記事判定 ${Math.min(start+batchSize,candidates.length)}/${candidates.length}人｜採用 ${rows.length}/${TARGET}`);
    }
    if (!rows.length) throw new Error('INSIGHT対象者の公開記事が0件です'); return rows;
  }

  async function appendInsight() {
    if (busy || !enabled()) return;
    const dataset=getJSON(DATA_KEY,null), run=getJSON(runKey(),null);
    if (!dataset || dataset.version!==BASE_VERSION || !Array.isArray(dataset.rows) || !run || run.datasetId!==dataset.datasetId) {
      status('先に入れ終わった #王子ごっこ の作業データが見つかりません',true); return;
    }
    setBusy(true);
    try {
      const oldCount=dataset.rows.length, oldCards=Array.isArray(run.cardKeys)?run.cardKeys.length:0, oldImages=run.images&&typeof run.images==='object'?Object.keys(run.images).length:0;
      const mode=currentChoice(); const insightRows=await collectInsight(mode); const existing=new Set(dataset.rows.map((row)=>normalizeUrl(row.url)).filter(Boolean));
      const add=[]; let overlap=0;
      for (const row of insightRows) { const url=normalizeUrl(row.url); if (!url) continue; if (existing.has(url)) { overlap++; continue; } existing.add(url); add.push({...row,url}); }
      if (!add.length) throw new Error('INSIGHT500は既存の#カードと全件重複でした');
      const rows=[...dataset.rows,...add].map((row,index)=>({...row,index:index+1}));
      dataset.rows=rows; dataset.count=rows.length; dataset.sourceMode='prince-hashtag-plus-insight-500'; dataset.articleChoice=mode; dataset.insightCount=insightRows.length; dataset.insightAddedCount=add.length; dataset.mergedDuplicateCount=Number(dataset.mergedDuplicateCount||0)+overlap; dataset.updatedAt=new Date().toISOString();
      setJSON(DATA_KEY,dataset);
      run.sourceMode='prince-hashtag-plus-insight-500'; run.articleChoice=mode; run.stage='insight_appended_needs_images'; run.appendedAt=new Date().toISOString(); run.insightAddedCount=add.length; setJSON(runKey(),run);
      status(`INSIGHT追加 ${add.length}件 ✅ 既存 # ${oldCount}件は保持｜次は「画」で追加分だけ極薄化`);
      page.alert(`INSIGHT追加完了\n\n既存 #王子ごっこ: ${oldCount}件\n既存極薄画像: ${oldImages}件（保持）\n既存通知カード: ${oldCards}件（保持）\nINSIGHT人物重複なし取得: ${insightRows.length}/${TARGET}人\n既存記事との重複除外: ${overlap}件\n今回追加: ${add.length}件\n合計: ${rows.length}件\n\n次は「画」。追加分だけ極薄画像＋記事URL埋め込みを作ります。\nその後「送」で追加分の通知カードだけ作成し、既存#カードと一緒に投稿できます。`);
    } catch (error) { status(`INSIGHT追加停止：${error?.message||String(error)}`,true); }
    finally { setBusy(false); }
  }

  function patchUI() {
    if (!enabled()) return false;
    const panel=document.getElementById(PANEL), box=panel?.querySelector(`.${SPECIAL}`); if (!panel || !box) return false;
    const dataset=getJSON(DATA_KEY,null), run=getJSON(runKey(),null), hasExisting=Boolean(dataset?.version===BASE_VERSION && Array.isArray(dataset?.rows) && dataset.rows.length && run?.datasetId===dataset.datasetId);
    if (!hasExisting) return false;
    const title=panel.querySelector('.mumei-title-text-v164')||panel.querySelector(':scope > .title'); if (title) title.textContent='王子＋スキ500｜既存#へ追加';
    const label=box.querySelector('.label'); if (label) label.textContent='👑 #は保持中｜❤️ INSIGHT500だけ追加';
    const row=box.querySelector('.row');
    if (row && !row.querySelector('[data-prince-append]')) {
      row.innerHTML='<button data-prince-append type="button">❤️ INSIGHT500を今の#へ追加</button>'; row.style.gridTemplateColumns='1fr';
      row.querySelector('[data-prince-append]').addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();void appendInsight();});
    }
    const mini=box.querySelector('.mini'); if (mini) mini.textContent='今入っている #王子ごっこ の極薄画像・URL埋め込み・通知カードはそのまま保持。INSIGHT500だけ後ろへ追加します。';
    return true;
  }

  setInterval(patchUI,500); patchUI();
})();
