(function () {
  'use strict';
  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const DATA = 'mumei_likers_thin_dataset_v160', CACHE = 'mumei-prepared-thin-v1883';
  const FINAL = 'https://note.com/fuku444/n/nb4f6934381e9';
  const URL_BATCH = 'https://mumei-s.github.io/note-insight/note-yoizora-prepared-20260923.json';
  let busy = false;
  const articleKey = () => location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1] || '';
  const runKey = () => 'mumei_likers_thin_run_v160:' + articleKey();
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
  function status(text, bad = false) {
    for (const id of ['mumei-note-source-status-v163', 'mumei-likers-thin-status-v160']) { const el = document.getElementById(id); if (el) { el.textContent = text; el.dataset.bad = bad ? '1' : '0'; } }
  }
  function cacheKey(row) { return location.origin + '/__mumei_prepared__/' + encodeURIComponent(row.preparedBatchId) + '/' + row.latestKey + '/' + row.pngSha256; }
  async function digest(bytes) { return Array.from(new Uint8Array(await page.crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join(''); }
  function validate(data) {
    if (data?.format !== 'mumei-thin-prepared-v1' || !/^[a-z0-9-]+$/.test(data.batchId) || !Array.isArray(data.rows) || data.rows.length !== data.count || data.count < 1 || data.count > 3000) throw new Error('完成データの形式・件数が違います');
    const people = new Map(), urls = new Set(); let rest = false;
    const allTagArticles = data.hashtagArticleMode === 'all';
    const tagKeys = [];
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      const dynamic = row.dynamicAddition === true;
      if (row.index !== i + 1 || row.caption !== page.__MUMEI_CARD_CREATOR__.caption(row) || (!dynamic && !/^[a-f0-9]{64}$/.test(row.pngSha256 || ''))) throw new Error(`行${i + 1}の氏名・画像対応が不正です`);
      const repeatedTagAuthor = allTagArticles && row.articleSource === 'hashtag' && people.get(row.urlname) === 'hashtag';
      if (urls.has(row.url) || (people.has(row.urlname) && !repeatedTagAuthor)) throw new Error('同じ人物・記事が重複しています');
      people.set(row.urlname, row.articleSource); urls.add(row.url);
      if (row.articleSource === 'hashtag') tagKeys.push(row.latestKey);
      if (row.articleSource !== 'hashtag') rest = true;
      else if (rest) throw new Error('#記事が先頭にまとまっていません');
    }
    if (allTagArticles && (!Array.isArray(data.hashtagArticleKeys) || JSON.stringify(tagKeys) !== JSON.stringify(data.hashtagArticleKeys))) throw new Error('#全記事の件数・順序が一致しません');
    if (data.rows.at(-1).url !== FINAL || !data.rows.at(-1).finalMarker || data.rows.slice(0,-1).some(r => r.finalMarker)) throw new Error('最後に実績の算数がありません');
  }
  async function prepare(data) {
    validate(data);
    if (!page.caches || !page.crypto?.subtle) throw new Error('完成画像を保存できません。このブラウザの保存機能を確認してください');
    const cache = await page.caches.open(CACHE), rows = [];
    for (const source of data.rows) {
      rows.push(await prepareOne(source, data.batchId, cache));
      status(`完成画像を準備 ${rows.length}/${data.count}｜全員「名前＋さん」`);
    }
    return rows;
  }
  async function prepareOne(source, batchId, cache) {
    const { pngBase64, ...meta } = source, row = { ...meta, preparedBatchId: batchId };
    if (!pngBase64 || pngBase64.length > 700000) throw new Error(`画像データ不正：${row.index}`);
    const bytes = Uint8Array.from(page.atob(pngBase64), c => c.charCodeAt(0)), header = new DataView(bytes.buffer);
    if (bytes.length < 24 || header.getUint32(0) !== 0x89504e47 || header.getUint32(4) !== 0x0d0a1a0a || header.getUint32(16) !== 860 || header.getUint32(20) !== 140 || await digest(bytes) !== row.pngSha256) throw new Error(`画像の照合不一致：${row.index}`);
    await cache.put(cacheKey(row), new page.Response(bytes, { headers: { 'content-type':'image/png', 'x-mumei-url':encodeURIComponent(row.url) } }));
    return row;
  }
  function contentList(payload) {
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    return Array.isArray(data.contents) ? data.contents : Array.isArray(data.notes) ? data.notes : [];
  }
  function requestJSON(url) {
    return new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'GET',url,responseType:'text',timeout:45000,
      headers:{Accept:'application/json,text/plain,*/*'},
      onload:r=>{try{if(r.status!==200)throw new Error('HTTP '+r.status);resolve(JSON.parse(r.responseText||'{}'));}catch(e){reject(e);}},
      onerror:()=>reject(new Error('通信失敗')),ontimeout:()=>reject(new Error('通信タイムアウト'))}));
  }
  function jstDay(value) {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const pick = type => parts.find(p=>p.type===type)?.value || '';
    return pick('year')+'-'+pick('month')+'-'+pick('day');
  }
  function noteRow(raw, urlname) {
    const note = raw?.note && typeof raw.note === 'object' ? raw.note : raw;
    if (!note || typeof note !== 'object') return null;
    const key = String(note.key || '').trim();
    if (!/^n[a-f0-9]{12}$/i.test(key)) return null;
    const user = note.user || note.author || {};
    const id = String(urlname || user.urlname || user.url_name || '').trim().replace(/^@/,'').toLowerCase();
    if (!id) return null;
    let thumb = String(note.eyecatch_url || note.image_url || note.thumbnail_url || note.eyecatch?.url || '').trim();
    if (thumb.startsWith('//')) thumb='https:'+thumb;
    let avatar = String(user.profileImageUrl || user.profile_image_url || user.user_profile_image_url || '').trim();
    if (avatar.startsWith('//')) avatar='https:'+avatar;
    return {
      urlname:id, creator:String(user.nickname || user.name || id).trim(), actorUrl:'https://note.com/'+id,
      actorImageUrl:avatar, url:'https://note.com/'+id+'/n/'+key, title:String(note.name || note.title || '無題の記事').trim(),
      latestKey:key, thumbUrl:thumb, publishAt:String(note.publishAt || note.publish_at || note.published_at || note.publishedAt || note.created_at || '').trim() || null,
      sourceKeys:[], sourceTags:[], manuallyAdded:true, dynamicAddition:true
    };
  }
  async function resolveProfile(urlname) {
    const id = String(urlname || '').trim().replace(/^https?:\/\/(?:www\.)?note\.com\//i,'').split(/[/?#]/)[0].replace(/^@/,'').toLowerCase();
    if (!/^[a-z0-9_]+$/i.test(id)) throw new Error('追加プロフィールIDが不正です: '+urlname);
    const plain = await requestJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)+'/contents?kind=note&page=1&disabled_pinned=true&with_notes=false');
    const fixed = await requestJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)+'/contents?kind=note&page=1&disabled_pinned=false&with_notes=false');
    const latest = noteRow(contentList(plain)[0], id);
    const pinned = noteRow(contentList(fixed)[0], id);
    const today = jstDay(Date.now()), yesterday = jstDay(Date.now()-86400000);
    const recent = latest && [today,yesterday].includes(jstDay(latest.publishAt));
    const row = recent ? latest : (pinned || latest);
    if (!row) throw new Error('公開記事がありません: '+id);
    row.articleSource = recent ? 'todayYesterday' : 'fixedFallback';
    row.selectionCheckedAt = new Date().toISOString();
    await page.__MUMEI_CARD_CREATOR__.verifyRows([row]);
    row.caption = page.__MUMEI_CARD_CREATOR__.caption(row);
    return row;
  }
  async function dynamicRows(patch, dataset) {
    const people = new Set(dataset.rows.map(r=>String(r.urlname||'').toLowerCase()));
    const out = [];
    for (const raw of Array.isArray(patch?.profiles) ? patch.profiles : []) {
      const id = String(raw || '').replace(/^https?:\/\/(?:www\.)?note\.com\//i,'').split(/[/?#]/)[0].replace(/^@/,'').toLowerCase();
      if (!id || people.has(id)) continue;
      status('追加プロフィールを確認中… '+id);
      const row = await resolveProfile(id);
      people.add(id); out.push(row);
    }
    return out;
  }

  function withAdditions(data) {
    const patch = page.__MUMEI_YOIZORA_ADDITIONS__;
    if (!patch || patch.batchId !== data.batchId) return data;
    validate(data);
    if (patch.format !== 'mumei-thin-additions-v1' || patch.count !== patch.rows?.length) throw new Error('追加データの形式が違います');
    const people = new Set(data.rows.map(r => r.urlname));
    const added = patch.rows.filter(r => !people.has(r.urlname));
    if (!added.length) return data;
    const rows = [...data.rows.slice(0,-1), ...added, data.rows.at(-1)].map((r,i) => ({...r,index:i+1}));
    const next = {...data,rows,count:rows.length}; validate(next);
    return next;
  }
  async function sync(dataset, run) {
    const patch = page.__MUMEI_YOIZORA_ADDITIONS__;
    if (!dataset.preparedBatch || !patch || !dataset.rows.every(r => r.dynamicAddition || r.preparedBatchId === patch.batchId)) return 0;
    if (run.datasetId !== dataset.datasetId) throw new Error('この記事と対象一覧の記録が一致しません');
    const before = new Set(dataset.rows.map(r => r.url));
    let combined = withAdditions({format:'mumei-thin-prepared-v1',batchId:patch.batchId,count:dataset.count,rows:dataset.rows,
      hashtagArticleMode:'all',hashtagArticleKeys:dataset.rows.filter(r=>r.articleSource==='hashtag').map(r=>r.latestKey)});
    const dynamic = await dynamicRows(patch, combined);
    if (dynamic.length) {
      const rows = [...combined.rows.slice(0,-1), ...dynamic, combined.rows.at(-1)].map((r,i)=>({...r,index:i+1}));
      combined = {...combined,rows,count:rows.length};
      validate(combined);
    }
    const additions = combined.rows.filter(r => !before.has(r.url));
    if (!additions.length) return 0;
    const cache = await page.caches.open(CACHE), prepared = new Map();
    for (const row of additions) prepared.set(row.url, row.dynamicAddition ? row : await prepareOne(row, patch.batchId, cache));
    const next = {...dataset, count:combined.count, rows:combined.rows.map(r => prepared.get(r.url) || r)};
    localStorage.setItem(DATA, JSON.stringify(next)); Object.assign(dataset, next);
    if (run.cardKeys?.length) { run.stage = 'cards_paused'; run.cardAudit = null; localStorage.setItem(runKey(), JSON.stringify(run)); }
    status(`追加${additions.length}件を反映｜全${next.count}件｜既存の画像・カードを保持して再開`);
    return additions.length;
  }
  function missingAdditions(dataset) {
    const patch = page.__MUMEI_YOIZORA_ADDITIONS__;
    if (!dataset?.preparedBatch || !patch || !dataset.rows.every(r => r.dynamicAddition || r.preparedBatchId === patch.batchId)) return [];
    const people = new Set(dataset.rows.map(r => String(r.urlname || '').toLowerCase()));
    const missing = patch.rows.filter(r => !people.has(String(r.urlname || '').toLowerCase()));
    for (const raw of Array.isArray(patch.profiles) ? patch.profiles : []) {
      const id = String(raw || '').replace(/^https?:\/\/(?:www\.)?note\.com\//i,'').split(/[/?#]/)[0].replace(/^@/,'').toLowerCase();
      if (id && !people.has(id)) missing.push({urlname:id,creator:id,dynamicAddition:true});
    }
    return missing;
  }
  function requireCurrent(dataset) {  function requireCurrent(dataset) {
    const missing = missingAdditions(dataset);
    if (missing.length) throw new Error(`追加${missing.length}名（${missing.map(r => r.creator).join('・')}）が未反映です。「追加分」で既存の画像・カードを保持して反映してください`);
  }
  async function image(row) {
    const response = await (await page.caches.open(CACHE)).match(cacheKey(row));
    if (!response || response.headers.get('x-mumei-url') !== encodeURIComponent(row.url)) throw new Error('完成画像がありません。「宵空セット」を読み込み直してください');
    return response.blob();
  }
  async function install(data) {
    if (!articleKey() || busy || page.__MUMEI_CARD_SAFETY__?.busy()) throw new Error('現在の処理が終わってから読み込んでください');
    const run = read(runKey());
    if (run?.pending || run?.cardKeys?.length || Object.keys(run?.images || {}).length) throw new Error('前回の画像・カードがあります。先に「初期化」を押してください');
    busy = true;
    try {
      data = withAdditions(data);
      const rows = await prepare(data), datasetId = data.batchId + ':' + Date.now();
      const dataset = { version:'16.0.0', sourceKey:'n08825c632afd', datasetId, count:rows.length, rows, preparedBatch:true,
        sourceMode:'prepared-hashtag-first', sourceUrl:data.sources.join('\n'), articleChoice:data.articleChoice, extractedAt:data.createdAt, confirmationUrl:FINAL, confirmationKey:'nb4f6934381e9' };
      const next = { version:'16.0.0', articleKey:articleKey(), datasetId, stage:'extracted', images:{}, cardKeys:[], pending:null };
      // Store only verified metadata; PNGs stay outside localStorage/body backups.
      localStorage.setItem(DATA, JSON.stringify(dataset)); localStorage.setItem(runKey(), JSON.stringify(next));
      await sync(dataset, next);
      status(`完成データ ${dataset.count}件｜#${data.hashtagArticleKeys?.length || data.hashtagPeople || ''}件が先頭・最後は実績の算数｜画像を準備します`);
      document.querySelector('#mumei-note-source-picker-v163 button[data-a="image"]')?.click();
      return dataset.count;
    } finally { busy = false; }
  }
  function download() { return new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'GET',url:URL_BATCH+'?v=1886&ts='+Date.now(),timeout:120000,responseType:'text',onload:r=>{try{if(r.status!==200)throw new Error('完成データ HTTP '+r.status);resolve(JSON.parse(r.responseText));}catch(e){reject(e);}},onerror:()=>reject(new Error('完成データの通信失敗')),ontimeout:()=>reject(new Error('完成データの時間切れ'))})); }
  function mount() {
    if (!articleKey()) return false;
    const box = document.querySelector('.mumei-prince-special-v184'); if (!box) return false;
    if (document.getElementById('mumei-prepared-load')) return true;
    const row=document.createElement('div'); row.id='mumei-prepared-load';row.style.cssText='display:flex;gap:3px;margin-top:4px';
    const button=document.createElement('button');button.textContent='宵空セット';button.type='button';button.style.flex='1';
    button.onclick=async()=>{button.disabled=true;try{status('作成済み画像を読込中…');await install(await download());}catch(e){status(e.message,true);}finally{button.disabled=false;}};
    const fileButton=document.createElement('button');fileButton.textContent='データ読込';fileButton.type='button';fileButton.style.flex='1';
    fileButton.onclick=()=>{const input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.onchange=async()=>{try{if(input.files?.[0])await install(JSON.parse(await input.files[0].text()));}catch(e){status(e.message,true);}};input.click();};
    const additions=document.createElement('button');additions.textContent='追加分';additions.type='button';additions.style.flex='1';additions.dataset.preparedAdditions='1';
    additions.onclick=()=>{
      if (busy || page.__MUMEI_CARD_SAFETY__?.busy()) { status('現在の処理が停止してから追加してください',true); return; }
      const dataset=read(DATA);
      if (!dataset?.preparedBatch) { status('追加元の宵空セットがありません',true); return; }
      // The image action already checkpoints and inserts only missing rows.
      document.querySelector('#mumei-note-source-picker-v163 button[data-a="image"]')?.click();
    };
    row.append(button,fileButton,additions);box.append(row);return true;
  }
  page.__MUMEI_PREPARED_BATCH__={image,install,validate,prepare,sync,requireCurrent,missingAdditions};
  let tries=0;const timer=setInterval(()=>{if(mount()||++tries>120)clearInterval(timer);},400);mount();
})();
