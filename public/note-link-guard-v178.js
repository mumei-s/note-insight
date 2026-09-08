(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_LINK_GUARD_178__) return;
  page.__MUMEI_LINK_GUARD_178__ = true;

  const VERSION = '17.8.0';
  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const PANEL = 'mumei-note-source-picker-v163';
  const STATUS = 'mumei-note-source-status-v163';
  const VERIFIED_PREFIX = 'mumei_link_guard_v178';

  let viewCache = null;
  let coreCache = null;
  let guardBusy = false;
  let allowSendOnce = false;
  let lastCompletedDataset = '';
  let recoveryLock = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  class FatalError extends Error {}

  function articleKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }
  function runKey() { return `${RUN_PREFIX}:${articleKey() || 'unknown'}`; }
  function verifiedKey() { return `${VERIFIED_PREFIX}:${articleKey() || 'unknown'}`; }
  function getJSON(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch (_) { return fallback; }
  }
  function setJSON(key, value) {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }
  function dataset() { return getJSON(DATA_KEY, null); }
  function run() { return getJSON(runKey(), null); }
  function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const u = new URL(raw, location.href);
      u.search = '';
      u.hash = '';
      return u.href;
    } catch (_) { return raw; }
  }
  function setStatus(text, bad = false) {
    const node = document.getElementById(STATUS);
    if (!node) return;
    node.textContent = text;
    node.dataset.bad = bad ? '1' : '0';
  }

  function editor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]') || document.querySelector('.ProseMirror');
  }
  function looksLikeView(value) {
    try {
      return Boolean(value && typeof value === 'object' && value.state?.doc && value.state?.schema &&
        typeof value.dispatch === 'function' && value.dom && typeof value.posAtDOM === 'function');
    } catch (_) { return false; }
  }
  function findView() {
    if (looksLikeView(viewCache) && viewCache.dom?.isConnected) return viewCache;
    const root = editor();
    if (!root) return null;
    const seen = new Set(), queue = [];
    let seed = root;
    for (let i = 0; i < 6 && seed; i += 1, seed = seed.parentElement) queue.push([seed, 0]);
    let steps = 0;
    while (queue.length && steps++ < 14000) {
      const [value, depth] = queue.shift();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      if (looksLikeView(value)) return (viewCache = value);
      let keys = [];
      try { keys = Object.getOwnPropertyNames(value); } catch (_) { continue; }
      for (const key of keys) {
        if (['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(key)) continue;
        let next;
        try { next = value[key]; } catch (_) { continue; }
        if (looksLikeView(next)) return (viewCache = next);
        if (depth < 7 && next && (typeof next === 'object' || typeof next === 'function') && next !== page && next !== document) {
          queue.push([next, depth + 1]);
        }
      }
    }
    return null;
  }
  function webpackRequire() {
    const chunks = page.webpackChunk_N_E;
    if (!chunks || typeof chunks.push !== 'function') return null;
    let req = null;
    const id = 993000000 + Math.floor(Math.random() * 4000000);
    try { chunks.push([[id], {}, (runtimeRequire) => { req = runtimeRequire; }]); } catch (_) {}
    return req;
  }
  function core() {
    if (coreCache) return coreCache;
    const req = webpackRequire();
    if (!req) throw new FatalError('note内部保存処理を取得できません');
    let schemaModule, htmlModule;
    try { schemaModule = req(35130); } catch (_) {}
    try { htmlModule = req(51910); } catch (_) {}
    const serialize = schemaModule?.BF;
    const normalizeDOM = htmlModule?.zc;
    const cleanHTML = htmlModule?.jF;
    if (typeof serialize !== 'function' || typeof normalizeDOM !== 'function' || typeof cleanHTML !== 'function') {
      throw new FatalError('note保存HTML検証処理を取得できません');
    }
    coreCache = { serialize, normalizeDOM, cleanHTML };
    return coreCache;
  }
  function imageNodes(view) {
    const out = [];
    view.state.doc.descendants((node, pos) => { if (node.type?.name === 'image') out.push({ node, pos }); });
    return out;
  }
  function trackedImage(view, record) {
    if (!record) return null;
    const images = imageNodes(view);
    if (record.id) {
      const hit = images.find((entry) => String(entry.node.attrs?.id || '') === String(record.id));
      if (hit) return hit;
    }
    if (record.src) {
      const hit = images.find((entry) => String(entry.node.attrs?.src || '') === String(record.src));
      if (hit) return hit;
    }
    return null;
  }
  function trackedRows(d, r) {
    return (d?.rows || []).filter((row) => r?.images?.[row.url]);
  }
  function serializedHtml(view) {
    const c = core();
    const fragment = c.serialize(view.state);
    const holder = document.createElement('div');
    holder.appendChild(fragment);
    c.normalizeDOM(holder);
    return c.cleanHTML(holder.innerHTML);
  }
  function htmlLinkedUrls(view) {
    const html = serializedHtml(view);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const urls = new Set();
    for (const anchor of doc.querySelectorAll('a[href]')) {
      if (!anchor.querySelector('img')) continue;
      urls.add(normalizeUrl(anchor.getAttribute('href')));
    }
    return urls;
  }
  function verifyRows(view, d, r, requireAll = false) {
    const rows = requireAll ? (d?.rows || []) : trackedRows(d, r);
    const htmlUrls = htmlLinkedUrls(view);
    const bad = [];
    for (const row of rows) {
      const record = r?.images?.[row.url];
      const hit = trackedImage(view, record);
      const wanted = normalizeUrl(row.url);
      const nodeOK = Boolean(hit && normalizeUrl(hit.node.attrs?.link) === wanted);
      const htmlOK = htmlUrls.has(wanted);
      if (!nodeOK || !htmlOK) bad.push(row);
    }
    if (requireAll && rows.length !== Number(d?.count || 0)) throw new FatalError(`対象件数不一致 ${rows.length}/${d?.count || 0}`);
    if (bad.length) throw new FatalError(`🔗不足 ${bad.length}件: ${bad.slice(0, 6).map((row) => row.index || row.creator || row.url).join(', ')}`);
    return rows.length;
  }
  async function forceRelink(view, d, r, requireAll = false) {
    const rows = requireAll ? (d?.rows || []) : trackedRows(d, r);
    if (requireAll && rows.length !== Number(d?.count || 0)) throw new FatalError(`極薄画像不足 ${rows.length}/${d?.count || 0}`);
    const work = [];
    for (const row of rows) {
      const hit = trackedImage(view, r?.images?.[row.url]);
      if (!hit) throw new FatalError(`画像実体が見つかりません: ${row.index || row.url}`);
      work.push({ row, hit });
    }
    const chunk = 24;
    for (let start = 0; start < work.length; start += chunk) {
      let tr = view.state.tr;
      const end = Math.min(start + chunk, work.length);
      for (let i = start; i < end; i += 1) {
        const { row, hit } = work[i];
        tr = tr.setNodeMarkup(hit.pos, hit.node.type, { ...hit.node.attrs, link: normalizeUrl(row.url) }, hit.node.marks);
      }
      view.dispatch(tr);
      setStatus(`🔗再確認 ${end}/${work.length}…`);
      if (end < work.length) await sleep(80);
    }
    await sleep(250);
    return verifyRows(view, d, r, requireAll);
  }
  async function saveOnce(label) {
    setStatus(label);
    await sleep(1800);
    const button = [...document.querySelectorAll('button')].find((node) => {
      const text = node.textContent?.trim();
      return (text === '一時保存' || text === '下書き保存') && node.getClientRects().length;
    });
    if (button && !button.disabled) button.click();
    await sleep(5000);
  }
  async function hardenAllBeforeSend() {
    if (guardBusy) return false;
    guardBusy = true;
    try {
      const d = dataset(), r = run();
      if (!d?.datasetId || !r || r.datasetId !== d.datasetId) throw new FatalError('対象データがありません');
      if (r.pending) throw new FatalError('画像アップロード途中です。続きの回収を先に完了します');
      const count = Object.keys(r.images || {}).length;
      if (count !== d.count) throw new FatalError(`極薄画像不足 ${count}/${d.count}`);
      const view = findView();
      if (!view) throw new FatalError('EditorViewなし');
      await forceRelink(view, d, r, true);
      await saveOnce(`全${d.count}件の🔗を保存中…`);
      verifyRows(view, d, r, true);
      setJSON(verifiedKey(), { datasetId: d.datasetId, count: d.count, verifiedAt: Date.now() });
      lastCompletedDataset = d.datasetId;
      setStatus(`極薄画像🔗 ${d.count}/${d.count} 保存HTMLまで確認済み ✅ 次は「送」`);
      return true;
    } catch (error) {
      setStatus(`送信停止：${error?.message || String(error)}`, true);
      return false;
    } finally {
      guardBusy = false;
    }
  }
  async function autoHardenWhenComplete() {
    const d = dataset(), r = run();
    if (!d?.datasetId || !r || r.datasetId !== d.datasetId || r.pending) return;
    if (Object.keys(r.images || {}).length !== d.count) return;
    if (lastCompletedDataset === d.datasetId) return;
    const saved = getJSON(verifiedKey(), null);
    if (saved?.datasetId === d.datasetId && saved?.count === d.count) {
      lastCompletedDataset = d.datasetId;
      return;
    }
    await hardenAllBeforeSend();
  }
  async function recoverOldPending() {
    if (recoveryLock) return;
    const d = dataset(), r = run();
    if (!d?.datasetId || !r || r.datasetId !== d.datasetId || !r.pending) return;
    const age = Date.now() - Number(r.pending?.at || 0);
    if (age < 90000) return;
    const imageButton = document.querySelector(`#${PANEL} button[data-a="image"]`);
    if (!imageButton || imageButton.disabled) return;
    recoveryLock = true;
    try {
      setStatus('中断した画像を回収して続きから再開します…');
      imageButton.click();
      await sleep(2500);
    } finally {
      recoveryLock = false;
    }
  }

  document.addEventListener('click', (event) => {
    const send = event.target?.closest?.(`#${PANEL} button[data-a="send"]`);
    if (!send || allowSendOnce) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void (async () => {
      const ok = await hardenAllBeforeSend();
      if (!ok) return;
      allowSendOnce = true;
      try { send.click(); } finally { setTimeout(() => { allowSendOnce = false; }, 0); }
    })();
  }, true);

  document.addEventListener('click', (event) => {
    const reset = event.target?.closest?.(`#${PANEL} button[data-a="reset"]`);
    if (!reset) return;
    localStorage.removeItem(verifiedKey());
    lastCompletedDataset = '';
  }, true);

  setInterval(() => {
    void autoHardenWhenComplete();
    void recoverOldPending();
    const p = document.getElementById(PANEL);
    const title = p?.querySelector('.mumei-title-text-v164') || p?.querySelector(':scope > .title');
    if (title) title.textContent = '極薄＋通知｜セレクト v17.8';
  }, 1200);
})();
