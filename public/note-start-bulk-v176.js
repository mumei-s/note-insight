(function () {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.__MUMEI_START_BULK_176__) return;
  page.__MUMEI_START_BULK_176__ = true;

  const VERSION = '17.6.0';
  const PANEL = 'mumei-note-source-picker-v163';
  const STATUS = 'mumei-note-source-status-v163';
  const STYLE = 'mumei-start-bulk-v176-style';

  let watching = false;
  let watchToken = 0;
  let autoRearmLock = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function panel() { return document.getElementById(PANEL); }
  function action(name) { return panel()?.querySelector(`button[data-a="${name}"]`) || null; }
  function statusText() {
    return String(document.getElementById(STATUS)?.textContent || '').replace(/\s+/g, ' ').trim();
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
    const extract = action('extract');
    if (extract) {
      extract.textContent = watching ? '準備中…' : '開始';
      extract.title = '抽出→極薄画像一括準備まで自動。次は＋→画像を1回';
    }
    const title = p.querySelector('.mumei-title-text-v164') || p.querySelector(':scope > .title');
    if (title) {
      const raw = String(title.textContent || '極薄＋通知');
      title.textContent = /v\d+\.\d+/.test(raw)
        ? raw.replace(/v\d+\.\d+/i, 'v17.6')
        : '極薄＋通知 v17.6';
    }
  }

  function extractedReady(text) {
    return /抽出\s*\d+件\s*✅\s*次は.?画/.test(text) ||
      /抽出済み\s*\d+件\s*✅\s*次は.?画/.test(text) ||
      /次は.?画/.test(text);
  }

  function imageArmed(text) {
    return /準備OK.*[＋+].*画像/.test(text) ||
      /[＋+]→.?画像.*1回/.test(text) ||
      /「[＋+]」→「画像」を1回/.test(text) ||
      /枚\s*準備OK.*画像/.test(text);
  }

  function chunkDoneNeedsMore(text) {
    return /残り\s*\d+件.*もう一度.?「?画」?/.test(text) ||
      /残り\s*\d+件.*画/.test(text);
  }

  function allImagesDone(text) {
    return /極薄画像🔗\s*\d+\/\d+\s*完成/.test(text) ||
      /極薄画像🔗\s*\d+\/\d+\s*完成済み/.test(text);
  }

  function failed(text) {
    return /画像停止|抽出停止|失敗|エラー|取得できません|見つかりません|先に「削」|作り直してください/.test(text);
  }

  function clickImageAction() {
    const image = action('image');
    if (!image || image.disabled) return false;
    image.click();
    return true;
  }

  async function followInitial(token) {
    const deadline = Date.now() + 15 * 60 * 1000;
    let clicked = false;
    while (token === watchToken && Date.now() < deadline) {
      const text = statusText();
      if (!clicked && extractedReady(text)) {
        clicked = clickImageAction();
      }
      if (clicked && imageArmed(text)) {
        watching = false;
        relabel();
        try { page.navigator?.vibrate?.([40, 35, 40]); } catch (_) {}
        return;
      }
      if (failed(text) && !/次は.?画/.test(text)) {
        watching = false;
        relabel();
        return;
      }
      await sleep(300);
    }
    if (token === watchToken) {
      watching = false;
      relabel();
    }
  }

  async function autoRearmNextChunk() {
    if (autoRearmLock) return;
    autoRearmLock = true;
    try {
      await sleep(500);
      const text = statusText();
      if (!chunkDoneNeedsMore(text)) return;
      const ok = clickImageAction();
      if (!ok) return;
      const deadline = Date.now() + 2 * 60 * 1000;
      while (Date.now() < deadline) {
        const now = statusText();
        if (imageArmed(now)) {
          try { page.navigator?.vibrate?.([35, 25, 35]); } catch (_) {}
          return;
        }
        if (failed(now)) return;
        await sleep(300);
      }
    } finally {
      autoRearmLock = false;
    }
  }

  function attach() {
    installStyle();
    const p = panel();
    const extract = action('extract');
    if (!p || !extract) return;

    if (extract.dataset.mumeiStart176 !== '1') {
      extract.dataset.mumeiStart176 = '1';
      extract.addEventListener('click', () => {
        if (watching) return;
        watching = true;
        watchToken += 1;
        const token = watchToken;
        relabel();
        void followInitial(token);
      }, false);
    }
    relabel();
  }

  document.addEventListener('click', (event) => {
    const reset = event.target?.closest?.(`#${PANEL} button[data-a="reset"]`);
    if (!reset) return;
    watchToken += 1;
    watching = false;
    autoRearmLock = false;
    setTimeout(relabel, 100);
  }, true);

  let lastStatus = '';
  setInterval(() => {
    attach();
    const text = statusText();
    if (text && text !== lastStatus) {
      lastStatus = text;
      if (chunkDoneNeedsMore(text)) void autoRearmNextChunk();
      if (allImagesDone(text)) {
        watching = false;
        relabel();
      }
    }
  }, 350);

  attach();
})();
