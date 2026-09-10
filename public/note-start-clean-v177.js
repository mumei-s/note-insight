(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_START_CLEAN_177__) return;
  page.__MUMEI_START_CLEAN_177__ = true;

  const VERSION = '17.7.1';
  const PANEL = 'mumei-note-source-picker-v163';
  const STATUS = 'mumei-note-source-status-v163';
  const DATA_KEY = 'mumei_likers_thin_dataset_v160';
  const RUN_PREFIX = 'mumei_likers_thin_run_v160';
  const WORK_PREFIX = 'mumei_note_source_work_v163';
  const CONTROL_PREFIX = 'mumei_note_source_control_v163';
  const STYLE = 'mumei-start-clean-v177-style';

  let startWatching = false;
  let startDatasetId = '';
  let lastAutoArmCount = -1;
  let autoArmLock = false;
  let lastOwnText = '';
  let lastOwnAt = 0;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function articleKey() {
    return location.pathname.match(/(?:^|\/)(n[a-z0-9]{8,})(?:\/|$)/i)?.[1] || '';
  }
  function runKey() { return `${RUN_PREFIX}:${articleKey() || 'unknown'}`; }
  function workKey() { return `${WORK_PREFIX}:${articleKey() || 'unknown'}`; }
  function controlKey() { return `${CONTROL_PREFIX}:${articleKey() || 'unknown'}`; }
  function getJSON(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch (_) { return fallback; }
  }
  function setJSON(key, value) {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }
  function panel() { return document.getElementById(PANEL); }
  function action(name) { return panel()?.querySelector(`button[data-a="${name}"]`) || null; }
  function dataset() { return getJSON(DATA_KEY, null); }
  function run() { return getJSON(runKey(), null); }
  function imageCount(r = run()) { return r?.images && typeof r.images === 'object' ? Object.keys(r.images).length : 0; }
  function ownStatus(text, bad = false) {
    const node = document.getElementById(STATUS);
    if (node) {
      node.textContent = text;
      node.dataset.bad = bad ? '1' : '0';
      lastOwnText = text;
      lastOwnAt = Date.now();
    }
  }

  function installStyle() {
    if (document.getElementById(STYLE) || !document.head) return;
    const style = document.createElement('style');
    style.id = STYLE;
    style.textContent = `
      #${PANEL} button[data-a="image"]{display:none!important}
      #${PANEL} .actions{grid-template-columns:1.3fr 1fr 1fr!important}
      #${PANEL} button[data-a="extract"]{background:#0f766e!important;color:#fff!important;font-size:10px!important}
    `;
    document.head.appendChild(style);
  }

  function relabel() {
    const p = panel();
    if (!p) return;
    const start = action('extract');
    if (start) {
      start.textContent = startWatching ? '準備中…' : '開始';
      start.title = '毎回最新データを取り直し、極薄画像準備まで自動';
    }
    // v18以降はパネルタイトルの所有者を本体だけに固定する。
  }

  function cleanFreshStartState() {
    const r = run();
    const images = imageCount(r);
    const cards = Array.isArray(r?.cardKeys) ? r.cardKeys.length : 0;
    if (images || cards) return false;
    localStorage.removeItem(DATA_KEY);
    localStorage.removeItem(runKey());
    localStorage.removeItem(workKey());
    localStorage.removeItem(controlKey());
    return true;
  }

  function clickImage() {
    const btn = action('image');
    if (!btn || btn.disabled) return false;
    btn.click();
    return true;
  }

  async function armWhenExtracted(expectedOldId) {
    const deadline = Date.now() + 20 * 60 * 1000;
    while (startWatching && Date.now() < deadline) {
      const d = dataset();
      const r = run();
      if (d?.datasetId && d.datasetId !== expectedOldId && r?.datasetId === d.datasetId && d.count > 0) {
        ownStatus(`最新 ${d.count}件を取得 ✅ 極薄画像を準備中…`);
        while (startWatching && Date.now() < deadline) {
          const btn = action('image');
          if (btn && !btn.disabled && clickImage()) {
            lastAutoArmCount = imageCount(r);
            startWatching = false;
            relabel();
            return;
          }
          await sleep(250);
        }
      }
      await sleep(300);
    }
    if (startWatching) {
      startWatching = false;
      relabel();
    }
  }

  async function autoArmNextChunk() {
    if (autoArmLock) return;
    const d = dataset();
    const r = run();
    if (!d?.count || !r || r.datasetId !== d.datasetId) return;
    const done = imageCount(r);
    if (done <= 0 || done >= d.count || r.pending) return;
    if (done === lastAutoArmCount) return;

    autoArmLock = true;
    try {
      lastAutoArmCount = done;
      ownStatus(`極薄画像🔗 ${done}/${d.count} ✅ 次の画像を自動準備中…`);
      for (let retry = 0; retry < 40; retry += 1) {
        if (clickImage()) return;
        await sleep(250);
      }
      ownStatus(`極薄画像🔗 ${done}/${d.count} ✅ 次の準備待ち`, true);
    } finally {
      autoArmLock = false;
    }
  }

  function mirrorUsefulStatus() {
    const d = dataset();
    const r = run();
    if (!d?.count || !r || r.datasetId !== d.datasetId) return;
    const done = imageCount(r);
    const node = document.getElementById(STATUS);
    if (!node) return;
    const raw = String(node.textContent || '');

    if (/準備OK.*[＋+].*画像|枚\s*準備OK/.test(raw)) {
      const m = raw.match(/(\d+)枚\s*準備OK/);
      const chunk = m ? Number(m[1]) : Math.min(80, Math.max(0, d.count - done));
      ownStatus(`${chunk}枚準備OK｜＋→画像を1回｜完了 ${done}/${d.count}`);
      return;
    }
    if (done >= d.count && /完成|完成済み/.test(raw)) {
      ownStatus(`極薄画像🔗 ${d.count}/${d.count} 完成 ✅ 次は「送」`);
      return;
    }
    if (/次は.?画|もう一度.?画|「画」で再開/.test(raw)) {
      ownStatus(`極薄画像🔗 ${done}/${d.count} ✅ 次の画像を自動準備中…`);
    }
  }

  function attach() {
    installStyle();
    relabel();
    const start = action('extract');
    if (!start || start.dataset.mumeiStart177 === '1') return;
    start.dataset.mumeiStart177 = '1';

    start.addEventListener('click', () => {
      const existing = run();
      if (imageCount(existing) || (Array.isArray(existing?.cardKeys) && existing.cardKeys.length)) return;
      cleanFreshStartState();
      startDatasetId = String(dataset()?.datasetId || '');
      startWatching = true;
      lastAutoArmCount = -1;
      relabel();
      ownStatus('最新データを取り直しています…');
      void armWhenExtracted(startDatasetId);
    }, true);
  }

  document.addEventListener('click', (event) => {
    const reset = event.target?.closest?.(`#${PANEL} button[data-a="reset"]`);
    if (!reset) return;
    startWatching = false;
    lastAutoArmCount = -1;
    setTimeout(relabel, 100);
  }, true);

  let lastImages = -1;
  setInterval(() => {
    attach();
    mirrorUsefulStatus();
    const d = dataset();
    const r = run();
    const done = imageCount(r);
    if (d?.count && r?.datasetId === d.datasetId && done !== lastImages) {
      lastImages = done;
      if (done > 0 && done < d.count && !r.pending) void autoArmNextChunk();
    }
    if (lastOwnText && Date.now() - lastOwnAt < 900) {
      const node = document.getElementById(STATUS);
      if (node && node.textContent !== lastOwnText) node.textContent = lastOwnText;
    }
  }, 300);

  attach();
})();
